/**
 * Migration-only browser client. Keeps its tokens away from Supabase.
 * Never enabled in an ordinary Lektrus production build.
 */
export const SELFHOST_PILOT_ENABLED = import.meta.env.VITE_LEKTRUS_SELFHOST_PILOT === "true";
export type PilotRole = "teacher" | "student";
export type PilotBoardRole = "owner" | "editor" | "viewer";
export type PilotUser = {
  id: string; email: string;
  user_metadata: { display_name?: string; first_name?: string; last_name?: string };
  account_role: PilotRole;
  teacher_status: "none" | "pending" | "approved" | "rejected";
  is_admin: boolean;
};
export type PilotSession = {access_token:string;refresh_token:string;expires_at:number;user:PilotUser};
export type PilotBoard = {
  id:string;owner_id:string;title:string;role:PilotBoardRole;
  created_at:string;updated_at:string;
};
export type PilotDocument = {
  board_id:string;document:Record<string,unknown>|null;version:number;
  updated_by:string|null;updated_at:string|null;
};
export type PilotAccess = {
  members:Array<{user_id:string;name:string;email:string;role:"editor"|"viewer";added_at:string}>;
  invites:Array<{id:string;email:string;role:"editor"|"viewer";created_at:string}>;
};
export type PilotRealtimeStatus = "online"|"reconnecting"|"offline";
export type PilotPoint={x:number;y:number};
export type PilotLiveInkPacket={
  type:"live_ink";client_id:string;stroke_id:string;kind:"pen"|"marker";
  color:string;weight:number;offset:number;points:PilotPoint[];finished:boolean;
};
export type PilotLiveEvent=
  | {type:"cursor";client_id:string;user_id:string;name:string;role:PilotBoardRole;x:number;y:number;sent_at:number}
  | (PilotLiveInkPacket&{user_id:string;name:string;role:PilotBoardRole;sent_at:number})
  | {type:"event_error";reason:string};
export type PilotBoardChannel=(()=>void)&{
  sendCursor:(clientId:string,x:number,y:number)=>boolean;
    sendInk:(ink:PilotLiveInkPacket)=>boolean};

const SESSION_KEY="lektrus.selfhost.pilot.session.v1";
const TIMEOUT_MS=15000;
let refreshInFlight:Promise<PilotSession|null>|null=null;

export class PilotHttpError extends Error {
  readonly status:number;
  constructor(status:number,message:string){
    super(message);this.name="PilotHttpError";this.status=status;
  }
}
export function pilotOrigin():string{
  if(!SELFHOST_PILOT_ENABLED)throw new Error("Тестовый режим собственного сервера выключен.");
  const configured=(import.meta.env.VITE_LEKTRUS_SELFHOST_API_ORIGIN as string|undefined)?.trim();
  const origin=new URL(configured||window.location.origin);
  const devLocal=import.meta.env.DEV&&["localhost","127.0.0.1"].includes(origin.hostname);
  if((origin.protocol!=="https:"&&!(devLocal&&origin.protocol==="http:"))||
     origin.username||origin.password||origin.search||origin.hash||
     origin.pathname!=="/"||(origin.port&&!devLocal)||
     origin.hostname.endsWith(".supabase.co")){
     throw new Error("Для тестового API нужен HTTPS-домен без пути и параметров.");
  }
  return origin.origin;
}
function loadSession():PilotSession|null{
  try{
    const raw=sessionStorage.getItem(SESSION_KEY);
    if(!raw)return null;
    const v=JSON.parse(raw) as PilotSession;
    if(typeof v?.access_token!=="string"||typeof v?.refresh_token!=="string"||
       typeof v?.user?.id!=="string"||!Number.isFinite(v.expires_at))return null;
    return v;
  }catch{return null}
}
function saveSession(session:PilotSession|null){
  if(!session)sessionStorage.removeItem(SESSION_KEY);
  else sessionStorage.setItem(SESSION_KEY,JSON.stringify(session));
}
export const cachedPilotSession=()=>loadSession();
export function clearPilotSession(){refreshInFlight=null;saveSession(null);}
async function responseError(response:Response):Promise<PilotHttpError>{
  let detail="";
  try{
    const data=await response.json() as {detail?:string|Array<{msg:string}>;message?:string};
    detail=typeof data.detail==="string"?data.detail:
      Array.isArray(data.detail)?data.detail.map(x=>x.msg).join("; "):data.message||"";
  }catch{/* Do not display unsafe arbitrary response bodies. */}
  return new PilotHttpError(response.status,detail||("Ошибка сервера: HTTP "+response.status));
}
async function rawRequest(path:string,init:RequestInit={},token?:string):Promise<Response>{
  if(!path.startsWith("/api/v1/"))throw new Error("Неправильный путь тестового API.");
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),TIMEOUT_MS);
  const upstream=init.signal;
  const onAbort=()=>controller.abort();
  if(upstream?.aborted)controller.abort();
  else upstream?.addEventListener("abort",onAbort,{once:true});
  try{
    const headers=new Headers(init.headers);
    if(token)headers.set("Authorization","Bearer "+token);
    if(init.body!==undefined&&!headers.has("Content-Type"))headers.set("Content-Type","application/json");
    return await fetch(pilotOrigin()+path,{
      ...init,headers,signal:controller.signal,cache:"no-store",credentials:"omit",
    });
  }catch(error){
    if(controller.signal.aborted&&!upstream?.aborted)
      throw new Error("Время ожидания собственного сервера истекло.");
    throw error;
  }finally{
    clearTimeout(timer);
    upstream?.removeEventListener("abort",onAbort);
  }
}
function normalizeSession(data:{
  access_token:string;refresh_token:string;expires_in:number;user:PilotUser;
}):PilotSession{
  if(!data?.access_token||!data?.refresh_token||!data?.user?.id)
    throw new Error("Сервер вернул неполную сессию.");
  return {access_token:data.access_token,refresh_token:data.refresh_token,
    expires_at:Math.floor(Date.now()/1000)+Number(data.expires_in||900),user:data.user};
}
export async function pilotLogin(email:string,password:string):Promise<PilotSession>{
  const response=await rawRequest("/api/v1/auth/login",{
    method:"POST",body:JSON.stringify({email:email.trim().toLowerCase(),password}),
  });
  if(!response.ok)throw await responseError(response);
  const session=normalizeSession(await response.json());
  saveSession(session);
  return session;
}
async function refreshSession(snapshot:PilotSession):Promise<PilotSession|null>{
  const response=await rawRequest("/api/v1/auth/refresh",{
    method:"POST",body:JSON.stringify({refresh_token:snapshot.refresh_token}),
  });
  if(!response.ok){
    if([400,401].includes(response.status)){
      if(loadSession()?.refresh_token===snapshot.refresh_token)saveSession(null);
      return null;
    }
    throw await responseError(response);
  }
  const next=normalizeSession(await response.json());
  if(loadSession()?.refresh_token!==snapshot.refresh_token)return null;
  saveSession(next);
  return next;
}
export async function pilotSession():Promise<PilotSession|null>{
  const session=loadSession();if(!session)return null;
  if(session.expires_at>Math.floor(Date.now()/1000)+60)return session;
  if(!refreshInFlight)refreshInFlight=refreshSession(session).finally(()=>{refreshInFlight=null});
  return refreshInFlight;
}
export async function pilotLogout():Promise<void>{
  const session=loadSession();
  clearPilotSession();
  if(!session)return;
  try{await rawRequest("/api/v1/auth/logout",{method:"POST"},session.access_token)}
  catch{/* Clearing the local session is unconditional. */}
}
export async function pilotRequest<T>(path:string,init:RequestInit={}):Promise<T>{
  let session=await pilotSession();
  if(!session)throw new PilotHttpError(401,"Войдите в тестовый аккаунт заново.");
  let response=await rawRequest(path,init,session.access_token);
  if(response.status===401){
    const snapshot=loadSession();
    if(!snapshot||snapshot.user.id!==session.user.id)
      throw new PilotHttpError(401,"Аккаунт изменился.");
    if(!refreshInFlight)refreshInFlight=refreshSession(snapshot).finally(()=>{refreshInFlight=null});
    session=await refreshInFlight;
    if(!session)throw new PilotHttpError(401,"Сессия завершена. Войдите снова.");
    response=await rawRequest(path,init,session.access_token);
  }
  if(!response.ok)throw await responseError(response);
  if(response.status===204)return undefined as T;
  return await response.json() as T;
}
export const pilotBoards=()=>pilotRequest<PilotBoard[]>("/api/v1/boards");
export const pilotCreateBoard=(title:string)=>pilotRequest<PilotBoard>("/api/v1/boards",{
  method:"POST",body:JSON.stringify({title,is_pilot:true}),
});
export const pilotReadDocument=(boardId:string)=>pilotRequest<PilotDocument>(
  "/api/v1/boards/"+encodeURIComponent(boardId)+"/document"
);
export const pilotSaveDocument=(boardId:string,expectedVersion:number,document:Record<string,unknown>)=>
  pilotRequest<PilotDocument>("/api/v1/boards/"+encodeURIComponent(boardId)+"/document",{
    method:"PUT",body:JSON.stringify({expected_version:expectedVersion,document}),
  });
export type PilotStoredStroke={
  id:string;client_id:string;created_by:string;kind:"pen"|"marker";
  color:string;weight:number;points:PilotPoint[];
};
export type PilotInkOperationResult={
  operation_id:string;stroke_id:string;version:number;duplicate:boolean;
};
export type PilotInkHistoryRow={
  operation_id:string;actor_id:string;type:"ink_append"|"ink_undo";
  stroke_id:string;version:number;created_at:string;
};
export function pilotAppendStroke(
  boardId:string,operationId:string,ink:PilotLiveInkPacket,
):Promise<PilotInkOperationResult>{
  return pilotRequest<PilotInkOperationResult>(
    "/api/v1/boards/"+encodeURIComponent(boardId)+"/pilot/ink",{
      method:"POST",body:JSON.stringify({
        operation_id:operationId,client_id:ink.client_id,
        stroke_id:ink.stroke_id,kind:ink.kind,color:ink.color,
        weight:ink.weight,points:ink.points,
      }),
    });
}
export function pilotUndoStroke(boardId:string,operationId:string){
  return pilotRequest<PilotInkOperationResult>(
    "/api/v1/boards/"+encodeURIComponent(boardId)+"/pilot/ink/undo",{
      method:"POST",body:JSON.stringify({operation_id:operationId}),
    });
}
export const pilotInkHistory=(boardId:string)=>
  pilotRequest<PilotInkHistoryRow[]>(
    "/api/v1/boards/"+encodeURIComponent(boardId)+"/pilot/history"
  );
export const pilotAccess=(boardId:string)=>pilotRequest<PilotAccess>(
  "/api/v1/boards/"+encodeURIComponent(boardId)+"/access"
);
export const pilotInvite=(boardId:string,email:string,role:"editor"|"viewer")=>
  pilotRequest<{kind:"member"|"invite"}>(
    "/api/v1/boards/"+encodeURIComponent(boardId)+"/invitations",{
      method:"POST",body:JSON.stringify({email,role}),
    });
export const pilotClaimInvitations=()=>pilotRequest<{claimed:number}>(
  "/api/v1/invitations/claim",{method:"POST"}
);
export async function pilotSignup(input:{
  email:string;password:string;name:string;first_name:string;last_name:string;
  role:"teacher"|"student";
}):Promise<{ok:boolean;message:string}>{
  const response=await rawRequest("/api/v1/auth/signup",{
    method:"POST",body:JSON.stringify(input),
  });
  if(!response.ok)throw await responseError(response);
  return response.json();
}
export async function pilotVerifyEmail(token:string):Promise<{ok:boolean;message:string}>{
  const response=await rawRequest("/api/v1/auth/verify-email",{
    method:"POST",body:JSON.stringify({token}),
  });
  if(!response.ok)throw await responseError(response);
  return response.json();
}


/** Version notices only: actual board document is fetched once after a new revision. */
export function pilotSubscribeBoard(
  boardId:string,onRevision:(version:number)=>void,
  onStatus:(status:PilotRealtimeStatus)=>void,
  onLive?:(event:PilotLiveEvent)=>void,
):PilotBoardChannel{
  let stopped=false,generation=0,attempt=0;
  let socket:WebSocket|null=null;
  let retry:ReturnType<typeof setTimeout>|undefined;
  let heartbeat:ReturnType<typeof setInterval>|undefined;
  let expiry:ReturnType<typeof setTimeout>|undefined;
  let lastVersion=-1;
  let ready=false;
  let lastCursorSent=0;
  let pendingCursor:{clientId:string;x:number;y:number}|null=null;
  let cursorTimer:ReturnType<typeof setTimeout>|undefined;
  let retryFinals:ReturnType<typeof setInterval>|undefined;
  const pendingFinals=new Map<string,{packet:PilotLiveInkPacket;lastSent:number;attempts:number}>();
  const sendRaw=(frame:Record<string,unknown>):boolean=>{
    if(!ready||!socket||socket.readyState!==WebSocket.OPEN)return false;
    socket.send(JSON.stringify(frame));
    return true;
  };
  const flushCursor=()=>{
    clearTimeout(cursorTimer);cursorTimer=undefined;
    if(!pendingCursor)return;
    const current=pendingCursor;
    if(sendRaw({type:"cursor",client_id:current.clientId,x:current.x,y:current.y})){
      lastCursorSent=Date.now();pendingCursor=null;
    }
  };
  const sendCursor=(clientId:string,x:number,y:number):boolean=>{
    if(!ready||!Number.isFinite(x)||!Number.isFinite(y)||
       !/^[A-Za-z0-9_-]{1,96}$/.test(clientId))return false;
    pendingCursor={clientId,x,y};
    const delay=Math.max(0,50-(Date.now()-lastCursorSent));
    if(!cursorTimer)cursorTimer=setTimeout(flushCursor,delay);
    return true;
  };
  const sendInk=(ink:PilotLiveInkPacket):boolean=>{
    if(!ready||ink.type!=="live_ink"||!Array.isArray(ink.points)||
       !ink.points.length||ink.points.length>200)return false;
    const sent=sendRaw(ink as unknown as Record<string,unknown>);
    if(sent&&ink.finished){
      pendingFinals.set(ink.stroke_id,{packet:ink,lastSent:Date.now(),attempts:1});
      if(pendingFinals.size>64){
        const first=pendingFinals.keys().next().value;
        if(first!==undefined)pendingFinals.delete(first);
      }
    }
    return sent;
  };
  const clearTimers=()=>{
    clearTimeout(retry);clearInterval(heartbeat);clearTimeout(expiry);
    retry=heartbeat=expiry=undefined;
    clearTimeout(cursorTimer);cursorTimer=undefined;
    clearInterval(retryFinals);retryFinals=undefined;
  };
  const closeSocket=()=>{
    ready=false;
    const old=socket;socket=null;
    if(!old)return;
    old.onopen=old.onclose=old.onmessage=old.onerror=null;
    try{old.close()}catch{/* Already closed. */}
  };
  const reconnect=()=>{
    if(stopped)return;
    generation++;closeSocket();clearTimers();
    onStatus(navigator.onLine?"reconnecting":"offline");
    retry=setTimeout(()=>void connect(),Math.min(30000,1000*2**Math.min(attempt++,5)));
  };
  const connect=async()=>{
    if(stopped)return;
    const current=++generation;
    onStatus(navigator.onLine?"reconnecting":"offline");
    try{
      const session=await pilotSession();
      if(stopped||current!==generation)return;
      if(!session){onStatus("offline");return}
      const socketUrl=new URL(pilotOrigin());
      socketUrl.protocol=socketUrl.protocol==="https:"?"wss:":"ws:";
      socketUrl.pathname="/api/v1/boards/"+encodeURIComponent(boardId)+"/events";
      const ws=new WebSocket(socketUrl.toString());
      socket=ws;
      const active=()=>!stopped&&generation===current&&socket===ws;
      ws.onopen=()=>{
        if(!active())return;
        ws.send(JSON.stringify({type:"auth",token:session.access_token}));
        heartbeat=setInterval(()=>{
          if(active()&&ws.readyState===WebSocket.OPEN)
            ws.send(JSON.stringify({type:"ping"}));
        },20000);
        expiry=setTimeout(reconnect,Math.max(1000,(session.expires_at-Date.now()/1000-60)*1000));
      };
      ws.onmessage=event=>{
        if(!active())return;
        try{
          const message=JSON.parse(String(event.data));
          if(message?.type==="ready"){
            attempt=0;ready=true;onStatus("online");
            // Final packets contain the full <=200-point stroke window in the
            // pilot. Replay them if the socket died before the ack arrived.
            for(const item of pendingFinals.values()){
              if(sendRaw(item.packet as unknown as Record<string,unknown>)){
                item.lastSent=Date.now();item.attempts++;
              }
            }
            retryFinals=setInterval(()=>{
              if(!active()||!ready)return;
              for(const [id,item] of pendingFinals){
                if(item.attempts>=4){
                  pendingFinals.delete(id);
                  onLive?.({type:"event_error",reason:"ink_ack_timeout"});
                }else if(Date.now()-item.lastSent>1200){
                  if(sendRaw(item.packet as unknown as Record<string,unknown>)){
                    item.lastSent=Date.now();item.attempts++;
                  }
                }
              }
            },400);
          }
          if(message?.type==="ink_ack"&&typeof message.stroke_id==="string"){
            const pending=pendingFinals.get(message.stroke_id);
            if(pending&&pending.packet.client_id===message.client_id&&
              pending.packet.offset===message.offset)
              pendingFinals.delete(message.stroke_id);
          }
          if(message?.type==="cursor"&&typeof message.client_id==="string"&&
             typeof message.user_id==="string"&&Number.isFinite(message.x)&&
             Number.isFinite(message.y)){
            onLive?.(message as PilotLiveEvent);
          }
          if(message?.type==="live_ink"&&typeof message.stroke_id==="string"&&
             Array.isArray(message.points)&&message.points.length<=200&&
             typeof message.user_id==="string"){
            onLive?.(message as PilotLiveEvent);
          }
          if(message?.type==="event_error"&&typeof message.reason==="string"){
            onLive?.(message as PilotLiveEvent);
          }
          if(message?.type==="ready"||message?.type==="document_changed"){
            const version=message.version;
            if(Number.isSafeInteger(version)&&version>=0&&version>lastVersion){
              lastVersion=version;onRevision(version);
            }
          }
        }catch{/* Ignore malformed frames. */}
      };
      ws.onerror=ws.onclose=()=>{if(active())reconnect()};
    }catch{if(!stopped&&current===generation)reconnect()}
  };
  const networkChanged=()=>reconnect();
  window.addEventListener("online",networkChanged);
  window.addEventListener("offline",networkChanged);
  void connect();
  const stop=()=>{
    stopped=true;generation++;clearTimers();closeSocket();
    pendingFinals.clear();pendingCursor=null;
    window.removeEventListener("online",networkChanged);
    window.removeEventListener("offline",networkChanged);
  };
  return Object.assign(stop,{sendCursor,sendInk});
}
