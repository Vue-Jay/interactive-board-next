import { getRealtimeSocketUrl, getRemoteSession, isRemoteBackendEnabled } from "./backend";
import type { BoardRole } from "./authStore";
import type {LiveEditorOp} from "./lektrusLiveEditorMerge";
export type BoardEditorMutation={
 id:string;itemId:string;userId:string;clientId:string;
 sentAt:number;ops:LiveEditorOp[];
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
  close: () => void;
};

export function connectBoardWorkChannel(
  boardId: string,
  me: { userId: string; name: string; role: BoardRole },
  onState: (state: RemoteWorkState) => void,
  onLeave: (userId: string) => void,
  publishSelf = true,
  onEdit?: (mutation:BoardEditorMutation)=>void,
): BoardWorkChannel {
  if (!isRemoteBackendEnabled()) {
    return { publish: () => {}, publishEdit:()=>{}, close: () => {} };
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

  const topic = `realtime:board-work:${boardId}`;

  const closeSocket = () => {
    clearTimeout(deadline);
    clearInterval(heartbeat);
    clearInterval(refresh);
    clearTimeout(publishTimer);
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
  const networkChanged = () => reconnect();
  window.addEventListener("online", networkChanged);
  window.addEventListener("offline", networkChanged);
  void connect();

  return {
    publish,
    publishEdit,
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
