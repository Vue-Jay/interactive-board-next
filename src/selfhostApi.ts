/**
 * Primary Lektrus self-hosted API client.
 * The primary API client used by the regular Lektrus application.
 */
const backendMode = String(import.meta.env.VITE_LEKTRUS_BACKEND || "").trim().toLowerCase();
export const SELFHOST_BACKEND_ENABLED = backendMode === "selfhost";
export type SelfhostRole = "teacher" | "student";
export type SelfhostBoardRole = "owner" | "editor" | "viewer";
export type SelfhostUser = {
  id: string; email: string;
  user_metadata: { display_name?: string; first_name?: string; last_name?: string };
  account_role: SelfhostRole;
  teacher_status: "none" | "pending" | "approved" | "rejected";
  is_admin: boolean;
};
export type SelfhostSession = {access_token:string;refresh_token:string;expires_at:number;user:SelfhostUser};
export type SelfhostBoard = {
  id:string;owner_id:string;title:string;role:SelfhostBoardRole;
  created_at:string;updated_at:string;
};
export type SelfhostDocument = {
  board_id:string;document:Record<string,unknown>|null;version:number;
  updated_by:string|null;updated_at:string|null;
};
export type SelfhostAccess = {
  members:Array<{user_id:string;name:string;email:string;role:"editor"|"viewer";added_at:string}>;
  invites:Array<{id:string;email:string;role:"editor"|"viewer";created_at:string}>;
};
export type SelfhostRealtimeStatus = "online"|"reconnecting"|"offline";
export type SelfhostPoint={x:number;y:number};
export type SelfhostLiveInkPacket={
  type:"live_ink";client_id:string;stroke_id:string;kind:"pen"|"marker";
  color:string;weight:number;offset:number;points:SelfhostPoint[];finished:boolean;
};
export type SelfhostLiveEvent=
  | {type:"cursor";client_id:string;user_id:string;name:string;role:SelfhostBoardRole;x:number;y:number;sent_at:number}
  | (SelfhostLiveInkPacket&{user_id:string;name:string;role:SelfhostBoardRole;sent_at:number})
  | SelfhostRemoteObjectPreview
  | {type:"event_error";reason:string};
export type SelfhostBoardChannel=(()=>void)&{
  sendCursor:(clientId:string,x:number,y:number)=>boolean;
    sendInk:(ink:SelfhostLiveInkPacket)=>boolean;
    sendObjectPreview:(preview:SelfhostObjectPreview)=>boolean};

const SESSION_KEY="lektrus.selfhost.session.v1";
const TIMEOUT_MS=15000;
let refreshInFlight:Promise<SelfhostSession|null>|null=null;

export class SelfhostHttpError extends Error {
  readonly status:number;
  constructor(status:number,message:string){
    super(message);this.name="SelfhostHttpError";this.status=status;
  }
}
export function selfhostOrigin():string{
  if(!SELFHOST_BACKEND_ENABLED)throw new Error("Собственный сервер Lektrus не подключён.");
  const configured=(import.meta.env.VITE_LEKTRUS_API_ORIGIN as string|undefined)?.trim();
  const origin=new URL(configured||window.location.origin);
  const devLocal=import.meta.env.DEV&&["localhost","127.0.0.1"].includes(origin.hostname);
  if((origin.protocol!=="https:"&&!(devLocal&&origin.protocol==="http:"))||
     origin.username||origin.password||origin.search||origin.hash||
     origin.pathname!=="/"||(origin.port&&!devLocal)||
     origin.hostname.endsWith(".supabase.co")){
     throw new Error("Для API Lektrus нужен HTTPS-домен без пути и параметров.");
  }
  return origin.origin;
}
function loadSession():SelfhostSession|null{
  try{
    const raw=localStorage.getItem(SESSION_KEY);
    if(!raw)return null;
    const v=JSON.parse(raw) as SelfhostSession;
    if(typeof v?.access_token!=="string"||typeof v?.refresh_token!=="string"||
       typeof v?.user?.id!=="string"||!Number.isFinite(v.expires_at))return null;
    return v;
  }catch{return null}
}
function saveSession(session:SelfhostSession|null){
  if(!session)localStorage.removeItem(SESSION_KEY);
  else localStorage.setItem(SESSION_KEY,JSON.stringify(session));
}
export const cachedSelfhostSession=()=>loadSession();
export function clearSelfhostSession(){refreshInFlight=null;saveSession(null);}
async function responseError(response:Response):Promise<SelfhostHttpError>{
  let detail="";
  try{
    const data=await response.json() as {detail?:string|Array<{msg:string}>;message?:string};
    detail=typeof data.detail==="string"?data.detail:
      Array.isArray(data.detail)?data.detail.map(x=>x.msg).join("; "):data.message||"";
  }catch{/* Do not display unsafe arbitrary response bodies. */}
  return new SelfhostHttpError(response.status,detail||("Ошибка сервера: HTTP "+response.status));
}
async function rawRequest(path:string,init:RequestInit={},token?:string,timeoutMs=TIMEOUT_MS):Promise<Response>{
  if(!path.startsWith("/api/v1/"))throw new Error("Неправильный путь API Lektrus.");
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),timeoutMs);
  const upstream=init.signal;
  const onAbort=()=>controller.abort();
  if(upstream?.aborted)controller.abort();
  else upstream?.addEventListener("abort",onAbort,{once:true});
  try{
    const headers=new Headers(init.headers);
    if(token)headers.set("Authorization","Bearer "+token);
    if(init.body!==undefined&&!headers.has("Content-Type"))headers.set("Content-Type","application/json");
    return await fetch(selfhostOrigin()+path,{
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
  access_token:string;refresh_token:string;expires_in:number;user:SelfhostUser;
}):SelfhostSession{
  if(!data?.access_token||!data?.refresh_token||!data?.user?.id)
    throw new Error("Сервер вернул неполную сессию.");
  return {access_token:data.access_token,refresh_token:data.refresh_token,
    expires_at:Math.floor(Date.now()/1000)+Number(data.expires_in||900),user:data.user};
}
export async function selfhostLogin(email:string,password:string):Promise<SelfhostSession>{
  const response=await rawRequest("/api/v1/auth/login",{
    method:"POST",body:JSON.stringify({email:email.trim().toLowerCase(),password}),
  });
  if(!response.ok)throw await responseError(response);
  const session=normalizeSession(await response.json());
  saveSession(session);
  return session;
}
async function refreshSession(snapshot:SelfhostSession):Promise<SelfhostSession|null>{
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
export async function selfhostSession():Promise<SelfhostSession|null>{
  const session=loadSession();if(!session)return null;
  if(session.expires_at>Math.floor(Date.now()/1000)+60)return session;
  if(!refreshInFlight)refreshInFlight=refreshSession(session).finally(()=>{refreshInFlight=null});
  return refreshInFlight;
}
export async function selfhostLogout():Promise<void>{
  const session=loadSession();
  clearSelfhostSession();
  if(!session)return;
  try{await rawRequest("/api/v1/auth/logout",{method:"POST"},session.access_token)}
  catch{/* Clearing the local session is unconditional. */}
}
export async function selfhostRequest<T>(path:string,init:RequestInit={}):Promise<T>{
  let session=await selfhostSession();
  if(!session)throw new SelfhostHttpError(401,"Сессия завершена. Войдите в Lektrus заново.");
  let response=await rawRequest(path,init,session.access_token);
  if(response.status===401){
    const snapshot=loadSession();
    if(!snapshot||snapshot.user.id!==session.user.id)
      throw new SelfhostHttpError(401,"Аккаунт изменился.");
    if(!refreshInFlight)refreshInFlight=refreshSession(snapshot).finally(()=>{refreshInFlight=null});
    session=await refreshInFlight;
    if(!session)throw new SelfhostHttpError(401,"Сессия завершена. Войдите снова.");
    response=await rawRequest(path,init,session.access_token);
  }
  if(!response.ok)throw await responseError(response);
  if(response.status===204)return undefined as T;
  return await response.json() as T;
}
export const selfhostBoards=()=>selfhostRequest<SelfhostBoard[]>("/api/v1/boards");
export const selfhostCreateBoard=(title:string,isPilot=false)=>selfhostRequest<SelfhostBoard>("/api/v1/boards",{
  method:"POST",body:JSON.stringify({title,is_pilot:isPilot}),
});

function assetEndpoint(boardId:string,assetId:string):string{
  if(!/^[0-9a-f-]{36}$/i.test(boardId)||!/^[A-Za-z0-9_-]{1,160}$/.test(assetId))
    throw new Error("Некорректный идентификатор вложения.");
  return "/api/v1/boards/"+encodeURIComponent(boardId)+"/assets/"+encodeURIComponent(assetId);
}
async function selfhostAssetRequest(path:string,init:RequestInit,timeoutMs=TIMEOUT_MS):Promise<Response>{
  let session=await selfhostSession();
  if(!session)throw new SelfhostHttpError(401,"Сессия завершена. Войдите в Lektrus заново.");
  let response=await rawRequest(path,init,session.access_token,timeoutMs);
  if(response.status===401){
    const snapshot=loadSession();
    if(!snapshot||snapshot.user.id!==session.user.id)
      throw new SelfhostHttpError(401,"Аккаунт изменился.");
    if(!refreshInFlight)refreshInFlight=refreshSession(snapshot).finally(()=>{refreshInFlight=null});
    session=await refreshInFlight;
    if(!session)throw new SelfhostHttpError(401,"Сессия завершена. Войдите снова.");
    response=await rawRequest(path,init,session.access_token,timeoutMs);
  }
  return response;
}
export async function selfhostAssetExists(boardId:string,assetId:string):Promise<boolean>{
  const response=await selfhostAssetRequest(assetEndpoint(boardId,assetId),{method:"HEAD"});
  if(response.status===404)return false;
  if(!response.ok)throw await responseError(response);
  return true;
}
export async function selfhostUploadAsset(boardId:string,assetId:string,blob:Blob):Promise<void>{
  const response=await selfhostAssetRequest(assetEndpoint(boardId,assetId),{
    method:"POST",headers:{"Content-Type":blob.type||"application/octet-stream"},body:blob,
  },120000);
  if(response.status===409&&await selfhostAssetExists(boardId,assetId))return;
  if(!response.ok)throw await responseError(response);
}
export async function selfhostDownloadAsset(boardId:string,assetId:string):Promise<Blob|null>{
  const response=await selfhostAssetRequest(assetEndpoint(boardId,assetId),{method:"GET"},120000);
  if(response.status===404)return null;
  if(!response.ok)throw await responseError(response);
  return response.blob();
}
export const selfhostReadDocument=(boardId:string)=>selfhostRequest<SelfhostDocument>(
  "/api/v1/boards/"+encodeURIComponent(boardId)+"/document"
);
export const selfhostSaveDocument=(boardId:string,expectedVersion:number,document:Record<string,unknown>)=>
  selfhostRequest<SelfhostDocument>("/api/v1/boards/"+encodeURIComponent(boardId)+"/document",{
    method:"PUT",body:JSON.stringify({expected_version:expectedVersion,document}),
  });
export type SelfhostObjectPreview={
  type:"object_preview";client_id:string;object_id:string;gesture_id:string;
  seq:number;object_revision:number;x:number;y:number;
};
export type SelfhostRemoteObjectPreview=SelfhostObjectPreview&{
  user_id:string;name:string;role:SelfhostBoardRole;sent_at:number;
};
export const selfhostAccess=(boardId:string)=>selfhostRequest<SelfhostAccess>(
  "/api/v1/boards/"+encodeURIComponent(boardId)+"/access"
);
export const selfhostInvite=(boardId:string,email:string,role:"editor"|"viewer")=>
  selfhostRequest<{kind:"member"|"invite"}>(
    "/api/v1/boards/"+encodeURIComponent(boardId)+"/invitations",{
      method:"POST",body:JSON.stringify({email,role}),
    });
export const selfhostClaimInvitations=()=>selfhostRequest<{claimed:number}>(
  "/api/v1/invitations/claim",{method:"POST"}
);
export async function selfhostSignup(input:{
  email:string;password:string;name:string;first_name:string;last_name:string;
  role:"teacher"|"student";
}):Promise<{ok:boolean;message:string}>{
  const response=await rawRequest("/api/v1/auth/signup",{
    method:"POST",body:JSON.stringify(input),
  });
  if(!response.ok)throw await responseError(response);
  return response.json();
}
export async function selfhostVerifyEmail(token:string):Promise<SelfhostSession>{
  const response=await rawRequest("/api/v1/auth/verify-email",{
    method:"POST",body:JSON.stringify({token}),
  });
  if(!response.ok)throw await responseError(response);
  const session=normalizeSession(await response.json());
  saveSession(session);
  return session;
}


/** Version notices only: actual board document is fetched once after a new revision. */
export function selfhostSubscribeBoard(
  boardId:string,onRevision:(version:number)=>void,
  onStatus:(status:SelfhostRealtimeStatus)=>void,
  onLive?:(event:SelfhostLiveEvent)=>void,
):SelfhostBoardChannel{
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
  const pendingFinals=new Map<string,{packet:SelfhostLiveInkPacket;lastSent:number;attempts:number}>();
  let lastObjectSent=0;
  let pendingObject:SelfhostObjectPreview|null=null;
  let objectTimer:ReturnType<typeof setTimeout>|undefined;
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
  const sendInk=(ink:SelfhostLiveInkPacket):boolean=>{
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
  const flushObjectPreview=()=>{
    clearTimeout(objectTimer);objectTimer=undefined;
    const next=pendingObject;
    if(!next)return;
    if(sendRaw(next as unknown as Record<string,unknown>)){
      lastObjectSent=Date.now();pendingObject=null;
    }
  };
  const sendObjectPreview=(next:SelfhostObjectPreview):boolean=>{
    if(!ready||next.type!=="object_preview"||
       !/^[A-Za-z0-9_-]{1,128}$/.test(next.object_id)||
       !/^[A-Za-z0-9_-]{1,128}$/.test(next.client_id)||
       !/^[A-Za-z0-9_-]{1,128}$/.test(next.gesture_id)||
       !Number.isSafeInteger(next.seq)||next.seq<0||
       !Number.isSafeInteger(next.object_revision)||next.object_revision<1||
       !Number.isFinite(next.x)||!Number.isFinite(next.y)||
       next.x<0||next.y<0||next.x>1000||next.y>1000)return false;
    // Only the latest cursor-like drag preview matters; older samples can be
    // dropped. Do not send dozens of full board JSON objects per second.
    pendingObject=next;
    if(!objectTimer){
      const delay=Math.max(0,50-(Date.now()-lastObjectSent));
      objectTimer=setTimeout(flushObjectPreview,delay);
    }
    return true;
  };
  const clearTimers=()=>{
    clearTimeout(retry);clearInterval(heartbeat);clearTimeout(expiry);
    retry=heartbeat=expiry=undefined;
    clearTimeout(cursorTimer);cursorTimer=undefined;
    clearTimeout(objectTimer);objectTimer=undefined;pendingObject=null;
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
      const session=await selfhostSession();
      if(stopped||current!==generation)return;
      if(!session){onStatus("offline");return}
      const socketUrl=new URL(selfhostOrigin());
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
            // selfhost. Replay them if the socket died before the ack arrived.
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
            onLive?.(message as SelfhostLiveEvent);
          }
          if(message?.type==="live_ink"&&typeof message.stroke_id==="string"&&
             Array.isArray(message.points)&&message.points.length<=200&&
             typeof message.user_id==="string"){
            onLive?.(message as SelfhostLiveEvent);
          }
          if(message?.type==="object_preview"&&
             typeof message.object_id==="string"&&typeof message.client_id==="string"&&
             typeof message.gesture_id==="string"&&typeof message.user_id==="string"&&
             Number.isSafeInteger(message.seq)&&Number.isSafeInteger(message.object_revision)&&
             Number.isFinite(message.x)&&Number.isFinite(message.y)){
            onLive?.(message as SelfhostRemoteObjectPreview);
          }
          if(message?.type==="event_error"&&typeof message.reason==="string"){
            onLive?.(message as SelfhostLiveEvent);
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
  return Object.assign(stop,{sendCursor,sendInk,sendObjectPreview});
}


export const isSelfhostBackendEnabled = () => SELFHOST_BACKEND_ENABLED;
export const getCachedSelfhostSession = cachedSelfhostSession;
export const getSelfhostSession = selfhostSession;
export const selfhostRenameBoard = (boardId:string,title:string) =>
  selfhostRequest<SelfhostBoard>("/api/v1/boards/"+encodeURIComponent(boardId),{
    method:"PATCH",body:JSON.stringify({title}),
  });
export const selfhostDeleteBoard = (boardId:string) =>
  selfhostRequest<{ok:boolean}>("/api/v1/boards/"+encodeURIComponent(boardId),{method:"DELETE"});
export const selfhostChangeMemberRole = (boardId:string,memberId:string,role:"editor"|"viewer") =>
  selfhostRequest<{ok:boolean;role:string}>(
    "/api/v1/boards/"+encodeURIComponent(boardId)+"/members/"+encodeURIComponent(memberId),{
      method:"PATCH",body:JSON.stringify({role}),
    });
export const selfhostRemoveMember = (boardId:string,memberId:string) =>
  selfhostRequest<void>(
    "/api/v1/boards/"+encodeURIComponent(boardId)+"/members/"+encodeURIComponent(memberId),
    {method:"DELETE"});
export const selfhostRevokeInvitation = (boardId:string,inviteId:string) =>
  selfhostRequest<void>(
    "/api/v1/boards/"+encodeURIComponent(boardId)+"/invitations/"+encodeURIComponent(inviteId),
    {method:"DELETE"});
