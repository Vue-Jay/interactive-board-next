import { getRealtimeSocketUrl, getRemoteSession, isRemoteBackendEnabled } from "./backend";
import type { BoardRole } from "./authStore";
import { isSelfhostBackendEnabled, selfhostSubscribeBoard, type InkCommitCursor } from "./selfhostApi";

export type RemoteCursor = {
  userId: string;
  name: string;
  role: BoardRole;
  x: number;
  y: number;
  updatedAt: number;
};

export type LiveInkMessage = { clientId: string; userId: string; id: string; kind: "pen" | "marker" | "eraser"; color: string; weight: number; points: { x: number; y: number }[]; finished: boolean; offset?: number; cancelled?:boolean; cutIds?:string[]; eraserMode?:"partial"|"stroke" };

export type BoardCursorChannel = {
  sendCursor: (x: number, y: number) => void;
  commitCursor?: (x:number,y:number)=>InkCommitCursor|undefined;
  sendInk: (ink: Omit<LiveInkMessage, "userId" | "clientId">) => void;
  close: () => void;
};

const isRole = (value: unknown): value is BoardRole =>
  value === "owner" || value === "editor" || value === "viewer";

export function connectBoardCursorChannel(
  boardId: string,
  me: { userId: string; name: string; role: BoardRole },
  onCursor: (cursor: RemoteCursor) => void,
  publishSelf = true,
  onInk?: (ink: LiveInkMessage) => void,
  onDiagnostics?: (status: string) => void,
  publishInkSelf = true,
): BoardCursorChannel {
  if (isSelfhostBackendEnabled()) {
    const clientId = (() => {
      if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID().replaceAll("-", "_");
      return Math.random().toString(36).slice(2) + Date.now().toString(36);
    })();
    let attempted = 0, sent = 0, received = 0, acknowledged = 0;
    let online = false, stopped = false, lastSentAt = 0;
    let inkTimer: ReturnType<typeof setTimeout> | undefined;
    type OutgoingInk = Omit<LiveInkMessage, "userId" | "clientId">;
    // Pointer events contain an overlapping history window. Keep only the
    // latest window per stroke, send new indices, and pace actual WS frames
    // below the server's 30 frames/sec limit, including completed strokes.
    const pending = new Map<string, OutgoingInk>();
    const sentEnds = new Map<string, number>();
    const reportSelfhost = (status: string) =>
      onDiagnostics?.(`${status} · вызов ${attempted} · отправлено ${sent} · сервер ${acknowledged} · получено ${received}`);
    const scheduleInk = () => {
      if(stopped || !online || !pending.size || inkTimer!==undefined) return;
      inkTimer=setTimeout(flushInk,Math.max(0,50-(Date.now()-lastSentAt)));
    };
    const flushInk = () => {
      inkTimer=undefined;
      if(stopped||!online)return;
      const next=pending.entries().next().value;
      if(!next)return;
      const [id,ink]=next;
      const start=ink.offset??0,end=start+ink.points.length;
      const already=Math.max(start,sentEnds.get(id)??start);
      if(already>=end&&!ink.finished){pending.delete(id);scheduleInk();return}
      // A final point must still mark completion even if every point was
      // already relayed. Send a single endpoint rather than the entire stroke.
      const offset=Math.min(already,end-1);
      const points=ink.points.slice(offset-start,offset-start+200);
      const finished=ink.finished&&offset+points.length>=end;
      const ok=channel.sendInk({
        type:ink.kind==="eraser"?"live_erase":"live_ink",client_id:clientId,stroke_id:id,
        kind:ink.kind,color:ink.color,weight:ink.weight,offset,points,finished,
        ...(ink.kind==="eraser"?{cancelled:finished&&!!ink.cancelled,cut_ids:finished?ink.cutIds??[]:[],...(ink.eraserMode==="stroke"?{erase_mode:"stroke" as const}:{})}:{}),
      });
      lastSentAt=Date.now();
      if(ok){
        sent++;
        if(finished){pending.delete(id);sentEnds.delete(id)}
        else{
          sentEnds.set(id,offset+points.length);
          if(offset+points.length>=end)pending.delete(id);
        }
        if(sent===1||sent%20===0||finished)reportSelfhost("подключено");
      }
      scheduleInk();
    };
    const channel = selfhostSubscribeBoard(boardId, () => {}, status => {
      online=status==="online";
      if(!online){clearTimeout(inkTimer);inkTimer=undefined;sentEnds.clear()}
      reportSelfhost(online?"подключено":status==="offline"?"отключено":"подключается");
      scheduleInk();
    }, event => {
      if (event.type === "cursor" && event.user_id !== me.userId) {
        onCursor({
          userId: event.user_id, name: event.name, role: event.role,
          x: event.x, y: event.y, updatedAt: event.sent_at || Date.now(),
        });
      } else if ((event.type === "live_ink"||event.type === "live_erase") && event.client_id !== clientId) {
        received++;
        onInk?.({
          clientId: event.client_id, userId: event.user_id,
          id: event.stroke_id, kind: event.kind, color: event.color,
          weight: event.weight, points: event.points,
          finished: event.finished, offset: event.offset,cancelled:event.cancelled,cutIds:event.cut_ids,eraserMode:event.erase_mode,
        });
        if(received===1||received%20===0||event.finished)reportSelfhost("подключено");
      } else if(event.type==="ink_ack"&&event.client_id===clientId){
        acknowledged++;
        if(acknowledged===1||acknowledged%20===0||event.finished)reportSelfhost("подключено");
      } else if (event.type === "event_error") {
        reportSelfhost(event.reason);
      }
    });
    return {
      commitCursor:(x,y)=>publishSelf&&channel.canCommitInk()?{client_id:clientId,x,y}:undefined,
      sendCursor: (x, y) => {
        if (publishSelf) channel.sendCursor(clientId, x, y);
      },
      sendInk: ink => {
        attempted++;
        if (stopped||!publishInkSelf||!ink.points.length) return;
        const dropped=Math.max(0,ink.points.length-500);
        const previous=pending.get(ink.id);
        if(previous?.finished&&!ink.finished)return;
        pending.set(ink.id,{...ink,offset:(ink.offset??0)+dropped,points:ink.points.slice(dropped)});
        // A disconnected peer can recover the authoritative saved document.
        // Keep bounded previews and preserve completed strokes first.
        if(pending.size>64){
          const oldest=[...pending.entries()].find(([,value])=>!value.finished)?.[0]??pending.keys().next().value;
          if(oldest!==undefined){pending.delete(oldest);sentEnds.delete(oldest)}
        }
        if(sentEnds.size>64){
          const oldest=sentEnds.keys().next().value;
          if(oldest!==undefined)sentEnds.delete(oldest);
        }
        scheduleInk();
      },
      close: () => {
        stopped=true;clearTimeout(inkTimer);pending.clear();sentEnds.clear();channel();
      },
    };
  }
  if (!isRemoteBackendEnabled()) {
    return { sendCursor: () => {}, sendInk: () => {}, close: () => {} };
  }

  const clientId = (() => {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
    const bytes = new Uint8Array(16);
    if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") crypto.getRandomValues(bytes);
    else for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
    return Array.from(bytes, value => value.toString(16).padStart(2, "0")).join("");
  })();
  let stopped = false;
  let generation = 0;
  let socket: WebSocket | null = null;
  let retry: ReturnType<typeof setTimeout> | undefined;
  let deadline: ReturnType<typeof setTimeout> | undefined;
  let heartbeat: ReturnType<typeof setInterval> | undefined;
  let refresh: ReturnType<typeof setInterval> | undefined;
  let flushTimer: ReturnType<typeof setTimeout> | undefined;

  let attempt = 0;
  let sequence = 0;
  let pendingHeartbeat: string | null = null;
  let ready = false;

  let latest: { x: number; y: number } | null = null;
  let lastSentAt = 0;

  const topic = `realtime:board-cursors:${boardId}`;
  let sentInkCount = 0;
  let attemptedInkCount = 0;
  let blockedInkCount = 0;
  let receivedInkCount = 0;
  let echoInkCount = 0;
  let acknowledged = 0;
  const pendingAcks = new Set<string>();
  const report = (status: string) => onDiagnostics?.(`${status} · вызов ${attemptedInkCount} · блок ${blockedInkCount} · отправлено ${sentInkCount} · сервер ${acknowledged} · эхо ${echoInkCount} · получено ${receivedInkCount}`);
  const minInterval = 45;
  let lastInkSent = 0;
  type OutgoingInk = Omit<LiveInkMessage, "userId" | "clientId">;
  // A single throttled slot can overwrite the FINAL packet for stroke A
  // when stroke B starts immediately afterwards. Keep completed strokes
  // separately so short handwritten letters never disappear on peers.
  const completedInk = new Map<string, OutgoingInk>();
  // Remember how many world-space points were already transmitted for each
  // active stroke. Only new points are broadcast, not the same 500 samples
  // every 45ms. A full final window remains available for loss recovery.
  const sentStrokeEnd = new Map<string, number>();
  const unconfirmedFinals = new Map<string, OutgoingInk>();
  let pendingInk: OutgoingInk | null = null;
  let inkTimer: ReturnType<typeof setTimeout> | undefined;
  const sendInkNow = () => {
    clearTimeout(inkTimer); inkTimer = undefined;
    if (!ready || !publishInkSelf) return;
    const sendPacket = (ink: OutgoingInk) => {
      const start = ink.offset ?? 0;
      const end = start + ink.points.length;
      const alreadySent = sentStrokeEnd.get(ink.id) ?? start;
      const skip = !ink.finished && ink.offset !== undefined
        ? Math.min(ink.points.length, Math.max(0, alreadySent - start))
        : 0;
      if (!ink.finished && skip === ink.points.length) return true;
      const outgoing = skip ? {...ink,offset:start+skip,points:ink.points.slice(skip)} : ink;
      const ref = String(++sequence);
      if (!rawSend("broadcast", {type:"broadcast",event:ink.kind==="eraser"?"live_erase":"live_ink",payload:{...outgoing,userId:me.userId,clientId}}, topic, ref)) return false;
      lastInkSent = Date.now();
      sentInkCount++;
      pendingAcks.add(ref);
      if (ink.finished) {
        sentStrokeEnd.delete(ink.id);
        unconfirmedFinals.set(ref,ink);
      } else if (ink.offset !== undefined) {
        sentStrokeEnd.delete(ink.id);
        sentStrokeEnd.set(ink.id,end);
        if (sentStrokeEnd.size > 512) {
          const oldest = sentStrokeEnd.keys().next().value;
          if (oldest !== undefined) sentStrokeEnd.delete(oldest);
        }
      }
      if(sentInkCount===1 || sentInkCount%25===0) report("подключено");
      return true;
    };
    // Flush every completed stroke even when a reconnect or several very
    // quick pen gestures coalesced all their intermediate preview messages.
    for (const [id, ink] of completedInk) {
      if (!sendPacket(ink)) return;
      completedInk.delete(id);
    }
    if (pendingInk) {
      const ink = pendingInk;
      if (sendPacket(ink)) pendingInk = null;
    }
  };

  const active = () => !stopped && socket?.readyState === WebSocket.OPEN;

  const rawSend = (
    event: string,
    payload: unknown,
    channel = topic,
    ref = String(++sequence),
  ) => {
    if (active() && socket) {
      socket.send(JSON.stringify({
        topic: channel,
        event,
        payload,
        ref,
        join_ref: channel === topic ? String(generation) : null,
      }));
      return true;
    }
    return false;
  };

  const broadcastCursor = (point: { x: number; y: number }) => {
    if (!publishSelf || !ready) return false;

    const sent = rawSend("broadcast", {
      type: "broadcast",
      event: "cursor",
      payload: {
        userId: me.userId,
        name: me.name,
        role: me.role,
        x: point.x,
        y: point.y,
        sentAt: Date.now(),
      },
    });

    if (sent) lastSentAt = Date.now();
    return sent;
  };

  const flush = () => {
    flushTimer = undefined;
    if (!latest || !ready) return;

    const point = latest;
    latest = null;

    if (!broadcastCursor(point)) {
      latest = point;
    }
  };

  const closeSocket = () => {
    clearTimeout(deadline);
    clearTimeout(flushTimer);
    clearTimeout(inkTimer);
    inkTimer = undefined;
    clearInterval(heartbeat);
    clearInterval(refresh);

    flushTimer = undefined;
    pendingHeartbeat = null;
    // The socket may close after writing a final packet but before its
    // server acknowledgement. Replay the exact stroke on the next join.
    for (const ink of unconfirmedFinals.values())
      completedInk.set(ink.id,ink);
    unconfirmedFinals.clear();
    pendingAcks.clear();
    sentStrokeEnd.clear();
    ready = false;
    report("отключено");

    if (socket) {
      socket.onopen = socket.onmessage = socket.onerror = socket.onclose = null;
      try { socket.close(); } catch { /* already closed */ }
      socket = null;
    }
  };

  const reconnect = () => {
    if (stopped) return;

    generation++;
    closeSocket();
    clearTimeout(retry);

    retry = setTimeout(
      () => void connect(),
      Math.min(1000 * 2 ** attempt++, 30000),
    );
  };

  const connect = async () => {
    if (stopped) return;

    const current = ++generation;
    report("подключается");

    try {
      const session = await getRemoteSession();
      if (stopped || current !== generation) return;

      if (!session) {
        reconnect();
        return;
      }

      const ws = new WebSocket(getRealtimeSocketUrl());
      socket = ws;

      let token = session.access_token;
      const joinRef = String(current);

      const currentConnection = () =>
        !stopped &&
        current === generation &&
        socket === ws;

      const send = (
        event: string,
        payload: unknown,
        channel = topic,
        ref = String(++sequence),
      ) => {
        if (currentConnection() && ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({
            topic: channel,
            event,
            payload,
            ref,
            join_ref: channel === topic ? joinRef : null,
          }));
          return true;
        }
        return false;
      };

      deadline = setTimeout(reconnect, 15000);

      ws.onopen = () => {
        if (!currentConnection()) return;

        try {
          send("phx_join", {
            access_token: token,
            config: {
              private: false,
              broadcast: { self: true, ack: true },
              presence: { enabled: false },
            },
          }, topic, joinRef);
        } catch {
          reconnect();
          return;
        }

        heartbeat = setInterval(() => {
          if (pendingHeartbeat) {
            reconnect();
            return;
          }

          try {
            const ref = String(++sequence);
            if (send("heartbeat", {}, "phoenix", ref)) {
              pendingHeartbeat = ref;
            }
          } catch {
            reconnect();
          }
        }, 25000);

        let refreshing = false;

        refresh = setInterval(() => {
          if (refreshing) return;
          refreshing = true;

          void getRemoteSession()
            .then((next) => {
              if (!currentConnection()) return;

              if (!next) {
                reconnect();
                return;
              }

              if (next.access_token !== token) {
                token = next.access_token;
                send("access_token", { access_token: token });
              }
            })
            .catch(() => {
              if (currentConnection()) reconnect();
            })
            .finally(() => {
              refreshing = false;
            });
        }, 20000);
      };

      ws.onmessage = (event) => {
        if (!currentConnection()) return;

        try {
          const message = JSON.parse(String(event.data));

          if (
            message.topic === "phoenix" &&
            message.event === "phx_reply" &&
            message.ref === pendingHeartbeat
          ) {
            pendingHeartbeat = null;
            return;
          }

          if (message.topic !== topic) return;
          if (message.event === "phx_reply" && pendingAcks.delete(String(message.ref))) {
            const pendingFinal=unconfirmedFinals.get(String(message.ref));
            unconfirmedFinals.delete(String(message.ref));
            if (message.payload?.status === "ok") acknowledged++;
            else {
              if (pendingFinal) {
                completedInk.set(pendingFinal.id,pendingFinal);
                sendInkNow();
              }
              report("broadcast отклонён сервером");
            }
            if(acknowledged===1 || acknowledged%25===0) report("подключено");
            return;
          }

          if (
            message.event === "phx_error" ||
            message.event === "phx_close" ||
            (message.event === "phx_reply" && message.payload?.status === "error")
          ) {
            report("ошибка канала");
            reconnect();
            return;
          }

          if (
            message.event === "phx_reply" &&
            message.ref === joinRef &&
            message.payload?.status === "ok"
          ) {
            clearTimeout(deadline);
            attempt = 0;
            ready = true;
            report("подключено");

            if (latest) flush();
            if (pendingInk || completedInk.size) sendInkNow();
            return;
          }

          if (message.event === "broadcast" && ["live_ink","live_erase"].includes(message.payload?.event)) {
            const p = message.payload?.payload;
            if (!p || typeof p.userId !== "string" ||
                typeof p.id !== "string" || !(message.payload.event==="live_erase"?["eraser"]:["pen","marker"]).includes(p.kind) ||
                (p.kind==="eraser"&&(!Number.isFinite(p.weight)||p.weight<0.5||p.weight>1000)) ||
                !Array.isArray(p.points) || p.points.length > 500 ||
                (p.offset !== undefined && (!Number.isSafeInteger(p.offset) || p.offset < 0 || p.offset > 1_000_000)) ||
                p.points.some((pt: {x:number;y:number}) => !Number.isFinite(pt?.x) || !Number.isFinite(pt?.y))) return;
            if (p.clientId === clientId) {
              echoInkCount++;
              if(echoInkCount===1 || echoInkCount%25===0) report("подключено");
              return;
            }
            receivedInkCount++;
            if(receivedInkCount===1 || receivedInkCount%25===0) report("подключено");
            onInk?.({clientId:typeof p.clientId === "string" ? p.clientId : p.userId,userId:p.userId,id:p.id,kind:p.kind,color:typeof p.color === "string" ? p.color : "#222222",weight:Number.isFinite(p.weight)?p.weight:3,points:p.points,finished:p.finished === true,cancelled:p.kind==="eraser"&&p.cancelled===true,
              ...(p.offset === undefined ? {} : {offset:p.offset}),
              ...(p.kind==="eraser"&&p.eraserMode==="stroke"?{eraserMode:"stroke" as const}:{}),
              ...(p.kind==="eraser"&&p.finished===true&&Array.isArray(p.cutIds)?{cutIds:p.cutIds.filter((id:unknown)=>typeof id==="string"&&id.length<=128).slice(0,500)}:{})});
            return;
          }
          if (
            message.event === "broadcast" &&
            message.payload?.event === "cursor"
          ) {
            const payload = message.payload?.payload ?? {};
            const userId = String(payload.userId || "").trim();
            const x = Number(payload.x);
            const y = Number(payload.y);

            if (
              !userId ||
              userId === me.userId ||
              !Number.isFinite(x) ||
              !Number.isFinite(y)
            ) {
              return;
            }

            onCursor({
              userId,
              name: String(payload.name || "Пользователь").trim() || "Пользователь",
              role: isRole(payload.role) ? payload.role : "viewer",
              x,
              y,
              updatedAt: Date.now(),
            });
          }
        } catch {
          /* Ignore malformed or unrelated frames. */
        }
      };

      ws.onerror = ws.onclose = () => {
        if (currentConnection()) reconnect();
      };
    } catch {
      if (!stopped && current === generation) reconnect();
    }
  };

  const sendCursor = (x: number, y: number) => {
    if (stopped || !publishSelf || !Number.isFinite(x) || !Number.isFinite(y)) return;

    latest = { x, y };

    const elapsed = Date.now() - lastSentAt;

    if (ready && elapsed >= minInterval && !flushTimer) {
      flush();
      return;
    }

    if (!flushTimer) {
      flushTimer = setTimeout(
        flush,
        Math.max(8, minInterval - elapsed),
      );
    }
  };

  const sendInk = (ink: Omit<LiveInkMessage, "userId" | "clientId">) => {
    attemptedInkCount++;
    if (stopped || !publishInkSelf) { blockedInkCount++; report(stopped ? "канал закрыт" : "отправка запрещена"); return; }
    if (!ready) { blockedInkCount++; report("ожидание подписки"); }
    if (attemptedInkCount === 1 || attemptedInkCount % 25 === 0) report(ready ? "подключено" : "ожидание подписки");
    const dropped = Math.max(0,ink.points.length-500);
    const packet = {...ink,points:ink.points.slice(-500),
      ...(ink.offset === undefined ? {} : {offset:ink.offset+dropped})};
    if (ink.finished) {
      completedInk.set(ink.id, packet);
      if (pendingInk?.id===ink.id) pendingInk=null;
      sendInkNow();
      return;
    }
    // Never let an older in-progress packet supersede an already queued final.
    if (completedInk.has(ink.id)) return;
    pendingInk=packet;
    if (Date.now()-lastInkSent >= 45) sendInkNow();
    else if (!inkTimer) inkTimer = setTimeout(sendInkNow,45-(Date.now()-lastInkSent));
  };

  const networkChanged = () => reconnect();

  window.addEventListener("online", networkChanged);
  window.addEventListener("offline", networkChanged);

  void connect();

  return {
    sendCursor,
    sendInk,
    close: () => {
      stopped = true;
      generation++;

      clearTimeout(retry);
      closeSocket();

      window.removeEventListener("online", networkChanged);
      window.removeEventListener("offline", networkChanged);
    },
  };
}
