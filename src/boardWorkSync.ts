import { getRealtimeSocketUrl, getRemoteSession, isRemoteBackendEnabled } from "./backend";
import type { BoardRole } from "./authStore";
import type {LiveEditorOp} from "./lektrusLiveEditorMerge";
import { isSelfhostBackendEnabled, selfhostSubscribeBoard } from "./selfhostApi";
export type BoardEditorMutation={
 id:string;itemId:string;userId:string;clientId:string;
 sentAt:number;ops:LiveEditorOp[];
};

export type BoardObjectPose = {
  id: string; x: number; y: number; width: number; height: number; rotation: number;
  origin: string; connectorStart?: {x:number;y:number}; connectorEnd?: {x:number;y:number};
};
export type BoardTransformMutation = {
  clientId: string; userId: string; seq: number; sentAt: number; finished: boolean;
  items: BoardObjectPose[];
};

export type RemoteWorkState = {
  userId: string;
  name: string;
  role: BoardRole;
  selectedIds: string[];
  editingId: string | null;
  updatedAt: number;
};

export type BoardWorkChannel = {
  publish: (selectedIds: string[], editingId: string | null) => void;
  publishEdit: (itemId:string,ops:LiveEditorOp[])=>void;
  publishTransform: (items:BoardObjectPose[],finished?:boolean)=>void;
  close: () => void;
};

export function connectBoardWorkChannel(
  boardId: string,
  me: { userId: string; name: string; role: BoardRole },
  onState: (state: RemoteWorkState) => void,
  onLeave: (userId: string) => void,
  publishSelf = true,
  onEdit?: (mutation:BoardEditorMutation)=>void,
  onTransform?: (mutation:BoardTransformMutation)=>void,
): BoardWorkChannel {
  if (isSelfhostBackendEnabled()) {
    let stopped = false, ready = false;
    let latest = { selectedIds: [] as string[], editingId: null as string | null };
    let lastFingerprint = "";
    let publishTimer: ReturnType<typeof setTimeout> | undefined;
    let transformTimer: ReturnType<typeof setTimeout> | undefined;
    let pendingTransform: BoardObjectPose[] | null = null;
    let lastTransformSent = 0, editSequence = 0, transformSeq = 0;
    const clientId = Math.random().toString(36).slice(2) + Date.now().toString(36);
    const seenEdits = new Set<string>();
    const receivedTransformSeq = new Map<string, number>();
    let channel: ReturnType<typeof selfhostSubscribeBoard>;
    const sendState = () => {
      clearTimeout(publishTimer); publishTimer = undefined;
      if (!publishSelf || !ready) return;
      const fingerprint = JSON.stringify(latest);
      if (fingerprint === lastFingerprint) return;
      lastFingerprint = fingerprint;
      channel.sendEvent({
        type: "work_state", selected_ids: latest.selectedIds.slice(0, 100),
        editing_id: latest.editingId,
      });
    };
    const sendTransform = () => {
      clearTimeout(transformTimer); transformTimer = undefined;
      const items = pendingTransform; pendingTransform = null;
      if (!items || !ready) return;
      channel.sendEvent({
        type: "object_transform", client_id: clientId, seq: ++transformSeq,
        finished: false, items,
      });
      lastTransformSent = Date.now();
    };
    channel = selfhostSubscribeBoard(boardId, () => {}, status => {
      ready = status === "online";
      if (ready) sendState();
    }, event => {
      if (event.type === "presence_diff") {
        for (const user of event.leaves) onLeave(user.user_id);
        return;
      }
      if (event.type === "work_state") {
        if (event.user_id === me.userId) return;
        const role: BoardRole = event.role === "owner" || event.role === "editor" || event.role === "viewer" ? event.role : "viewer";
        onState({
          userId: event.user_id, name: event.name || "Участник", role,
          selectedIds: Array.isArray(event.selected_ids) ? event.selected_ids.slice(0, 100) : [],
          editingId: typeof event.editing_id === "string" ? event.editing_id : null,
          updatedAt: event.sent_at || Date.now(),
        });
        return;
      }
      if (event.type === "editor_mutation") {
        if (event.user_id === me.userId || !event.client_id || !event.item_id ||
            !event.id || !Array.isArray(event.ops) || event.ops.length > 300) return;
        if (seenEdits.has(event.id)) return;
        seenEdits.add(event.id);
        if (seenEdits.size > 3000) seenEdits.clear();
        onEdit?.({
          id: event.id, itemId: event.item_id, userId: event.user_id,
          clientId: event.client_id, sentAt: event.sent_at || Date.now(),
          ops: event.ops as unknown as LiveEditorOp[],
        });
        return;
      }
      if (event.type === "object_transform") {
        if (event.user_id === me.userId || !event.client_id ||
            !Number.isSafeInteger(event.seq) || !Array.isArray(event.items) ||
            !event.items.length || event.items.length > 64) return;
        const previous = receivedTransformSeq.get(event.client_id) ?? 0;
        if (event.seq <= previous) return;
        const poses: BoardObjectPose[] = [];
        const seenIds = new Set<string>();
        for (const raw of event.items) {
          const item = raw as Partial<BoardObjectPose>;
          if (!item || typeof item.id !== "string" || !item.id ||
              typeof item.origin !== "string" || !item.origin ||
              seenIds.has(item.id) ||
              !["x", "y", "width", "height", "rotation"].every(key =>
                typeof item[key as keyof BoardObjectPose] === "number" &&
                Number.isFinite(item[key as keyof BoardObjectPose]) &&
                Math.abs(item[key as keyof BoardObjectPose] as number) < 1e7) ||
              item.width! < 0 || item.height! < 0 ||
              ![item.connectorStart, item.connectorEnd].every(point => point === undefined ||
                !!point && typeof point === "object" && !Array.isArray(point) &&
                typeof point.x === "number" && Number.isFinite(point.x) && Math.abs(point.x) < 1e7 &&
                typeof point.y === "number" && Number.isFinite(point.y) && Math.abs(point.y) < 1e7)) return;
          seenIds.add(item.id); poses.push(item as BoardObjectPose);
        }
        receivedTransformSeq.delete(event.client_id);
        receivedTransformSeq.set(event.client_id, event.seq);
        if (receivedTransformSeq.size > 256) {
          const oldest = receivedTransformSeq.keys().next().value;
          if (oldest) receivedTransformSeq.delete(oldest);
        }
        onTransform?.({
          clientId: event.client_id, userId: event.user_id,
          seq: event.seq, sentAt: event.sent_at || Date.now(),
          finished: event.finished, items: poses,
        });
      }
    }, { visible: publishSelf });
    return {
      publish: (selectedIds, editingId) => {
        if (stopped || !publishSelf) return;
        latest = { selectedIds: [...new Set(selectedIds)].slice(0, 100), editingId };
        clearTimeout(publishTimer);
        publishTimer = setTimeout(sendState, 80);
      },
      publishEdit: (itemId, ops) => {
        if (stopped || !publishSelf || !itemId || !ops.length || ops.length > 300) return;
        channel.sendEvent({
          type: "editor_mutation", id: clientId + ":" + (++editSequence),
          item_id: itemId, client_id: clientId, ops,
        });
      },
      publishTransform: (items, finished = false) => {
        if (stopped || !publishSelf || !items.length || items.length > 64 || !ready) return;
        pendingTransform = items;
        if (finished) {
          clearTimeout(transformTimer); transformTimer = undefined; pendingTransform = null;
          channel.sendEvent({
            type: "object_transform", client_id: clientId, seq: ++transformSeq,
            finished: true, items,
          });
          lastTransformSent = Date.now();
          return;
        }
        if (Date.now() - lastTransformSent >= 65) sendTransform();
        else if (!transformTimer) transformTimer = setTimeout(sendTransform, Math.max(1, 65 - (Date.now() - lastTransformSent)));
      },
      close: () => {
        stopped = true;
        clearTimeout(publishTimer); clearTimeout(transformTimer);
        channel(); onLeave(me.userId);
      },
    };
  }
  if (!isRemoteBackendEnabled()) {
    return { publish: () => {}, publishEdit:()=>{}, publishTransform:()=>{}, close: () => {} };
  }

  let stopped = false;
  let generation = 0;
  let socket: WebSocket | null = null;
  let retry: ReturnType<typeof setTimeout> | undefined;
  let deadline: ReturnType<typeof setTimeout> | undefined;
  let heartbeat: ReturnType<typeof setInterval> | undefined;
  let refresh: ReturnType<typeof setInterval> | undefined;
  let attempt = 0;
  let sequence = 0;
  let pendingHeartbeat: string | null = null;
  let ready = false;
  let latest: { selectedIds: string[]; editingId: string | null } = { selectedIds: [], editingId: null };
  let lastFingerprint = "";
  let publishTimer: ReturnType<typeof setTimeout> | undefined;
  const clientId=Math.random().toString(36).slice(2)+Date.now().toString(36);
  let editSequence=0;
  const seenEdits=new Set<string>();
  let transformSeq=0,lastTransformSent=0;
  let pendingTransform:BoardObjectPose[]|null=null;
  let transformTimer:ReturnType<typeof setTimeout>|undefined;
  const receivedTransformSeq=new Map<string,number>();

  const topic = `realtime:board-work:${boardId}`;

  const closeSocket = () => {
    clearTimeout(deadline);
    clearInterval(heartbeat);
    clearInterval(refresh);
    clearTimeout(publishTimer);
    clearTimeout(transformTimer);
    transformTimer=undefined;pendingTransform=null;
    pendingHeartbeat = null;
    ready = false;
    if (socket) {
      socket.onopen = null;
      socket.onmessage = null;
      socket.onerror = null;
      socket.onclose = null;
      try { socket.close(); } catch { /* already closed */ }
      socket = null;
    }
  };

  const reconnect = () => {
    if (stopped) return;
    generation++;
    closeSocket();
    clearTimeout(retry);
    retry = setTimeout(() => void connect(), Math.min(1000 * 2 ** attempt++, 30000));
  };

  const sendState = () => {
    clearTimeout(publishTimer);
    if (!publishSelf) return;
    publishTimer = undefined;
    if (!ready || !socket || socket.readyState !== WebSocket.OPEN) return;

    const fingerprint = JSON.stringify(latest);
    if (fingerprint === lastFingerprint) return;
    lastFingerprint = fingerprint;

    socket.send(JSON.stringify({
      topic,
      event: "broadcast",
      payload: {
        type: "broadcast",
        event: "work_state",
        payload: {
          userId: me.userId,
          name: me.name,
          role: me.role,
          selectedIds: latest.selectedIds.slice(0, 100),
          editingId: latest.editingId,
          sentAt: Date.now(),
        },
      },
      ref: String(++sequence),
      join_ref: null,
    }));
  };

  const connect = async () => {
    if (stopped) return;
    const current = ++generation;
    try {
      const session = await getRemoteSession();
      if (stopped || current !== generation) return;
      if (!session) { reconnect(); return; }

      const ws = new WebSocket(getRealtimeSocketUrl());
      socket = ws;
      let token = session.access_token;
      const joinRef = String(++sequence);
      const active = () => !stopped && current === generation && socket === ws;

      const send = (event: string, payload: unknown, channel = topic, ref = String(++sequence)) => {
        if (!active() || ws.readyState !== WebSocket.OPEN) return false;
        ws.send(JSON.stringify({ topic: channel, event, payload, ref, join_ref: channel === topic ? joinRef : null }));
        return true;
      };

      deadline = setTimeout(reconnect, 15000);

      ws.onopen = () => {
        if (!active()) return;
        try {
          send("phx_join", {
            access_token: token,
            config: { private: false, broadcast: { self: false, ack: false }, presence: { enabled: false } },
          }, topic, joinRef);
        } catch { reconnect(); return; }

        heartbeat = setInterval(() => {
          if (pendingHeartbeat) { reconnect(); return; }
          const ref = String(++sequence);
          try { if (send("heartbeat", {}, "phoenix", ref)) pendingHeartbeat = ref; }
          catch { reconnect(); }
        }, 25000);

        let refreshing = false;
        refresh = setInterval(() => {
          if (refreshing) return;
          refreshing = true;
          void getRemoteSession().then((next) => {
            if (!active()) return;
            if (!next) { reconnect(); return; }
            if (next.access_token !== token) {
              token = next.access_token;
              send("access_token", { access_token: token });
            }
          }).catch(() => { if (active()) reconnect(); }).finally(() => { refreshing = false; });
        }, 20000);
      };

      ws.onmessage = (event) => {
        if (!active()) return;
        try {
          const message = JSON.parse(String(event.data));
          if (message.topic === "phoenix" && message.event === "phx_reply" && message.ref === pendingHeartbeat) {
            pendingHeartbeat = null;
            return;
          }
          if (message.topic !== topic) return;
          if (message.event === "phx_error" || message.event === "phx_close" ||
              (message.event === "phx_reply" && message.payload?.status === "error")) {
            reconnect();
            return;
          }
          if (message.event === "phx_reply" && message.ref === joinRef && message.payload?.status === "ok") {
            clearTimeout(deadline);
            attempt = 0;
            ready = true;
            lastFingerprint = "";
            sendState();
            return;
          }
          if (message.event !== "broadcast") return;
          if (message.payload?.event === "editor_mutation"){
            const raw=message.payload?.payload as Partial<BoardEditorMutation>|undefined;
            if(!raw||!raw.clientId||raw.clientId===clientId||!raw.itemId||!raw.id||
              !Array.isArray(raw.ops)||raw.ops.length>300||
              raw.ops.some(op=>!Array.isArray(op.path)||op.path.length>18))return;
            if(seenEdits.has(raw.id))return;
            seenEdits.add(raw.id);
            if(seenEdits.size>3000)seenEdits.clear();
            onEdit?.({
              id:raw.id,itemId:raw.itemId,userId:raw.userId??"",
              clientId:raw.clientId,sentAt:Number(raw.sentAt)||Date.now(),
              ops:raw.ops
            });
            return;
          }
          if (message.payload?.event === "object_transform") {
            const raw=message.payload?.payload as Partial<BoardTransformMutation>|undefined;
            if(!raw || typeof raw.clientId!=="string" || !raw.clientId ||
              raw.clientId.length>128 || raw.clientId===clientId ||
              typeof raw.userId!=="string" || !raw.userId || raw.userId.length>128 ||
              !Number.isSafeInteger(raw.seq)||raw.seq === undefined || raw.seq<=0 ||
              typeof raw.finished!=="boolean" || !Array.isArray(raw.items) ||
              !raw.items.length || raw.items.length>64) return;
            const poses:BoardObjectPose[]=[];
            const seenIds=new Set<string>();
            for(const item of raw.items){
              if(!item||typeof item.id!=="string"||!item.id||item.id.length>128||
                typeof item.origin!=="string"||!item.origin||item.origin.length>128||
                seenIds.has(item.id)||!["x","y","width","height","rotation"].every(key=>
                  typeof item[key as keyof BoardObjectPose]==="number" &&
                  Number.isFinite(item[key as keyof BoardObjectPose]) &&
                  Math.abs(item[key as keyof BoardObjectPose] as number)<1e7) ||
                item.width<0||item.height<0||
                ![item.connectorStart,item.connectorEnd].every(point=>point===undefined||
                  !!point&&typeof point==="object"&&!Array.isArray(point)&&
                  typeof point.x==="number"&&Number.isFinite(point.x)&&Math.abs(point.x)<1e7&&
                  typeof point.y==="number"&&Number.isFinite(point.y)&&Math.abs(point.y)<1e7)) return;
              seenIds.add(item.id);poses.push(item);
            }
            const previous=receivedTransformSeq.get(raw.clientId)??0;
            if(raw.seq===undefined || raw.seq<=previous)return;
            receivedTransformSeq.delete(raw.clientId);
            receivedTransformSeq.set(raw.clientId,raw.seq);
            if(receivedTransformSeq.size>256){
              const oldest=receivedTransformSeq.keys().next().value;
              if(oldest)receivedTransformSeq.delete(oldest);
            }
            onTransform?.({
              clientId:raw.clientId,userId:raw.userId,seq:raw.seq,
              sentAt:Date.now(),finished:raw.finished,items:poses,
            });
            return;
          }
          if (message.payload?.event !== "work_state") return;

          const payload = message.payload?.payload ?? {};
          const userId = String(payload.userId || "").trim();
          if (!userId || userId === me.userId) return;
          const role: BoardRole = payload.role === "owner" || payload.role === "editor" || payload.role === "viewer" ? payload.role : "viewer";
          const selectedIds = Array.isArray(payload.selectedIds)
            ? payload.selectedIds.filter((id: unknown): id is string => typeof id === "string").slice(0, 100)
            : [];
          const editingId = typeof payload.editingId === "string" && payload.editingId ? payload.editingId : null;

          onState({
            userId,
            name: String(payload.name || "Участник").trim() || "Участник",
            role,
            selectedIds,
            editingId,
            updatedAt: Date.now(),
          });
        } catch { /* unrelated/malformed frame */ }
      };

      ws.onerror = ws.onclose = () => { if (active()) reconnect(); };
    } catch { if (!stopped && current === generation) reconnect(); }
  };

  const publish = (selectedIds: string[], editingId: string | null) => {
    if (stopped || !publishSelf) return;
    latest = { selectedIds: [...new Set(selectedIds)].slice(0, 100), editingId };
    clearTimeout(publishTimer);
    publishTimer = setTimeout(sendState, 80);
  };

  const publishEdit=(itemId:string,ops:LiveEditorOp[])=>{
    if(stopped||!publishSelf||!ready||!socket||socket.readyState!==WebSocket.OPEN||
      !itemId||!ops.length||ops.length>300)return;
    const mutation:BoardEditorMutation={
      id:clientId+":"+(++editSequence),itemId,userId:me.userId,clientId,
      sentAt:Date.now(),ops
    };
    const payload=JSON.stringify({
      topic,event:"broadcast",payload:{type:"broadcast",event:"editor_mutation",payload:mutation},
      ref:String(++sequence),join_ref:null
    });
    if(payload.length>120000)return;
    socket.send(payload);
  };
  const sendTransform=()=>{
    clearTimeout(transformTimer);transformTimer=undefined;
    const poses=pendingTransform;
    pendingTransform=null;
    if(!poses||!ready||!socket||socket.readyState!==WebSocket.OPEN)return;
    const mutation:BoardTransformMutation={
      clientId,userId:me.userId,seq:++transformSeq,
      sentAt:Date.now(),finished:false,items:poses
    };
    const frame=JSON.stringify({
      topic,event:"broadcast",payload:{type:"broadcast",event:"object_transform",payload:mutation},
      ref:String(++sequence),join_ref:null
    });
    if(frame.length>24000)return;
    try{socket.send(frame);lastTransformSent=Date.now()}
    catch{reconnect()}
  };
  const publishTransform=(items:BoardObjectPose[],finished=false)=>{
    // Preview is visual-only. Do not queue stale transforms across reconnects
    // or grant the broadcast authority over the saved board document.
    if(stopped||!ready||!socket||socket.readyState!==WebSocket.OPEN||
      !items.length||items.length>64)return;
    pendingTransform=items;
    if(finished){
      clearTimeout(transformTimer);transformTimer=undefined;
      pendingTransform=null;
      const mutation:BoardTransformMutation={
        clientId,userId:me.userId,seq:++transformSeq,
        sentAt:Date.now(),finished:true,items
      };
      const frame=JSON.stringify({
        topic,event:"broadcast",payload:{type:"broadcast",event:"object_transform",payload:mutation},
        ref:String(++sequence),join_ref:null
      });
      if(frame.length>24000)return;
      try{socket.send(frame);lastTransformSent=Date.now()}
      catch{reconnect()}
      return;
    }
    if(Date.now()-lastTransformSent>=65){sendTransform();return}
    if(!transformTimer)transformTimer=setTimeout(sendTransform,Math.max(1,65-(Date.now()-lastTransformSent)));
  };
  const networkChanged = () => reconnect();
  window.addEventListener("online", networkChanged);
  window.addEventListener("offline", networkChanged);
  void connect();

  return {
    publish,
    publishEdit,
    publishTransform,
    close: () => {
      stopped = true;
      generation++;
      clearTimeout(retry);
      closeSocket();
      onLeave(me.userId);
      window.removeEventListener("online", networkChanged);
      window.removeEventListener("offline", networkChanged);
    },
  };
}
