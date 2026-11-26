/**
 * Primary Lektrus self-hosted API client.
 * The primary API client used by the regular Lektrus application.
 */
import { Capacitor, CapacitorHttp } from "@capacitor/core";

const backendMode = String(import.meta.env.VITE_LEKTRUS_BACKEND || "").trim().toLowerCase();
export const SELFHOST_BACKEND_ENABLED = backendMode === "selfhost";
export type SelfhostRole = "teacher" | "student";
export type SelfhostBoardRole = "owner" | "editor" | "viewer";
export type SelfhostParticipantRole = "owner" | "co_teacher" | "student" | "observer";
type InvitedParticipantRole = Exclude<SelfhostParticipantRole,"owner">;
export type SelfhostUser = {
  id: string; email: string;
  guest_board_id?: string | null;
  user_metadata: { display_name?: string; first_name?: string; last_name?: string };
  account_role: SelfhostRole;
  teacher_status: "none" | "pending" | "approved" | "rejected";
  is_admin: boolean;
  requested_at?: string | null;
  reviewed_at?: string | null;
  subscription_plan?: "free" | "pro";
  subscription_until?: string | null;
};
export type SelfhostSession = {access_token:string;refresh_token:string;expires_at:number;user:SelfhostUser};
export type SelfhostBoard = {
  id:string;owner_id:string;title:string;role:SelfhostBoardRole;participant_role?:SelfhostParticipantRole;plan_read_only?:boolean;
  created_at:string;updated_at:string;
};
export type SelfhostDocument = {
  board_id:string;document:Record<string,unknown>|null;version:number;
  updated_by:string|null;updated_at:string|null;
  ink_cursors?:SelfhostCommittedCursor[];
};
export type SelfhostAccess = {
  members:Array<{user_id:string;name:string;email:string;role:"editor"|"viewer";participant_role?:InvitedParticipantRole;added_at:string}>;
  invites:Array<{id:string;email:string;role:"editor"|"viewer";participant_role?:InvitedParticipantRole;created_at:string}>;
};
export type SelfhostRealtimeStatus = "online"|"reconnecting"|"offline";
export type SelfhostPoint={x:number;y:number};
export type SelfhostLiveInkPacket={
  type:"live_ink"|"live_erase";client_id:string;stroke_id:string;kind:"pen"|"marker"|"eraser";
  color:string;weight:number;offset:number;points:SelfhostPoint[];finished:boolean;
  cancelled?:boolean;
  cut_ids?:string[];
  erase_mode?:"partial"|"stroke";
};
export type SelfhostPresenceUser={user_id:string;name:string;role:SelfhostBoardRole;participant_role?:SelfhostParticipantRole;online_at?:string};
export type SelfhostLiveEvent=
  | {type:"cursor";client_id:string;user_id:string;name:string;role:SelfhostBoardRole;x:number;y:number;sent_at:number}
  | (SelfhostLiveInkPacket&{user_id:string;name:string;role:SelfhostBoardRole;sent_at:number})
  | SelfhostRemoteObjectPreview
  | {type:"presence_state";users:SelfhostPresenceUser[]}
  | {type:"presence_diff";joins:SelfhostPresenceUser[];leaves:SelfhostPresenceUser[]}
  | {type:"work_state";user_id:string;name:string;role:SelfhostBoardRole;selected_ids:string[];editing_id:string|null;sent_at:number}
  | {type:"editor_mutation";user_id:string;name:string;role:SelfhostBoardRole;id:string;item_id:string;client_id:string;ops:Array<Record<string,unknown>>;sent_at:number}
  | {type:"object_transform";user_id:string;name:string;role:SelfhostBoardRole;client_id:string;seq:number;finished:boolean;items:Array<Record<string,unknown>>;sent_at:number}
  | {type:"focus_view";user_id:string;name:string;role:SelfhostBoardRole;target_user_id:string;center_x:number;center_y:number;zoom:number;sent_at:number}
  | {type:"teacher_view";user_id:string;name:string;role:SelfhostBoardRole;center_x:number;center_y:number;zoom:number;sent_at:number}
  | {type:"guided_follow";user_id:string;name:string;role:SelfhostBoardRole;enabled:boolean;sent_at:number}
  | {type:"attachment_request";user_id:string;name:string;role:SelfhostBoardRole;request_id:string;asset_id:string;attachment_name:string;mime:string;kind:"image"|"pdf";width:number;height:number;sent_at:number}
  | {type:"attachment_result";user_id:string;name:string;role:SelfhostBoardRole;request_id:string;target_user_id:string;approved:boolean;attachment_name:string;sent_at:number}
  | {type:"ink_ack";client_id:string;stroke_id:string;offset:number;finished:boolean}
  | {type:"comments_changed"}
  | {type:"event_error";reason:string};
export type SelfhostCommittedCursor=Extract<SelfhostLiveEvent,{type:"cursor"}>;
export type InkCommitCursor={x:number;y:number;client_id:string};
type InkCommitRequest={expected_version:number;delta:DocumentDelta;ink_gesture:string;cursor?:InkCommitCursor};
export type SelfhostBoardChannel=(()=>void)&{
  canCommitInk:()=>boolean;
  commitInk:(request:InkCommitRequest)=>Promise<{version:number}>|null;
  sendCursor:(clientId:string,x:number,y:number)=>boolean;
  sendInk:(ink:SelfhostLiveInkPacket)=>boolean;
  sendObjectPreview:(preview:SelfhostObjectPreview)=>boolean;
  sendEvent:(event:Record<string,unknown>)=>boolean};

const SESSION_KEY="lektrus.selfhost.session.v1";
const REMEMBERED_SESSION_KEY="lektrus.selfhost.remembered.v1";
const TIMEOUT_MS=15000;
const NATIVE_AUTH_TIMEOUT_MS=30000;
const HEALTH_TIMEOUT_MS=20000;
let refreshInFlight:Promise<SelfhostSession|null>|null=null;

export class SelfhostHttpError extends Error {
  readonly status:number;
  readonly code?:string;
  constructor(status:number,message:string,code?:string){
    super(message);this.name="SelfhostHttpError";this.status=status;this.code=code;
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
  if(!session||loadSession()?.user.id!==session.user.id)documentBase=null;
  if(!session)localStorage.removeItem(SESSION_KEY);
  else localStorage.setItem(SESSION_KEY,JSON.stringify(session));
  if(typeof window!=="undefined"&&typeof window.dispatchEvent==="function"&&typeof Event==="function")
    window.dispatchEvent(new Event("lektrus:session-changed"));
}
// Quick login is opt-in via the existing "Exit" affordance. Keep the
// credential separately so a page reload never silently signs back in.
function loadRememberedSession():SelfhostSession|null{
 try{
  const raw=localStorage.getItem(REMEMBERED_SESSION_KEY);
  if(!raw)return null;
  const value=JSON.parse(raw) as SelfhostSession;
  if(typeof value?.access_token!=="string"||typeof value?.refresh_token!=="string"||
     !Number.isFinite(value.expires_at)||typeof value.user?.id!=="string"||
     !value.user.email||value.user.guest_board_id)return null;
  return value;
 }catch{return null;}
}
function saveRememberedSession(session:SelfhostSession|null){
 if(session)localStorage.setItem(REMEMBERED_SESSION_KEY,JSON.stringify(session));
 else localStorage.removeItem(REMEMBERED_SESSION_KEY);
}
export function getRememberedSelfhostAccount(){
 const session=loadRememberedSession();
 if(!session)return null;
 const meta=session.user.user_metadata||{};
 return {id:session.user.id,email:session.user.email,
  name:String(meta.display_name||[meta.first_name,meta.last_name].filter(Boolean).join(" ")||session.user.email.split("@")[0])};
}
/** Leave workspace without revoking the explicitly remembered account. */
export function leaveSelfhostAccountRemembered(){
 const session=loadSession();
 if(session&&!session.user.guest_board_id&&session.user.email)saveRememberedSession(session);
 else saveRememberedSession(null);
 refreshInFlight=null;
 saveSession(null);
}
export async function forgetRememberedSelfhostAccount(){
 const session=loadRememberedSession();
 saveRememberedSession(null);
 if(!session)return;
 // Do not log out another account; this revokes only the saved credential.
 try{await rawRequest("/api/v1/auth/logout",{method:"POST"},session.access_token);}
 catch{/* Removing it locally never depends on the network. */}
}
export async function resumeRememberedSelfhostAccount():Promise<SelfhostSession>{
 const remembered=loadRememberedSession();
 if(!remembered)throw new Error("Сохранённый вход больше недоступен.");
 // Inactive until the user explicitly clicks the quick-login button.
 saveSession(remembered);
 try{
  const current=await selfhostSession();
  if(!current)throw new SelfhostHttpError(401,"Сохранённая сессия истекла. Введите пароль ещё раз.");
  // A cached access token may have been revoked. Verify it server-side.
  await selfhostRequest<SelfhostUser>("/api/v1/auth/me");
  const ready=loadSession();
  if(!ready||ready.user.id!==remembered.user.id)throw new Error("Аккаунт изменился во время входа.");
  saveRememberedSession(null);
  return ready;
 }catch(error){
  const live=loadSession();
  if(live?.user.id===remembered.user.id){
   if(!(error instanceof SelfhostHttpError&&error.status===401))saveRememberedSession(live);
   saveSession(null);
  }
  if(error instanceof SelfhostHttpError&&error.status===401)saveRememberedSession(null);
  throw error;
 }
}
export const cachedSelfhostSession=()=>loadSession();
export function clearSelfhostSession(){refreshInFlight=null;saveSession(null);}
export function notifyPlanLimit(detail:{resource?:string;message?:string}){if(typeof window!=="undefined")window.dispatchEvent(new CustomEvent("lektrus:plan-limit",{detail}));}
async function responseError(response:Response):Promise<SelfhostHttpError>{
  let detail="",code:string|undefined;
  try{
    const data=await response.json() as {detail?:string|Array<{msg:string}>|{code?:string;resource?:string;message?:string};message?:string};
    detail=typeof data.detail==="string"?data.detail:
      Array.isArray(data.detail)?data.detail.map(x=>x.msg).join("; "):data.detail?.message||data.message||"";
    if(typeof data.detail==="object"&&!Array.isArray(data.detail)&&data.detail?.code==="plan_limit"){code=data.detail.code;notifyPlanLimit(data.detail);}
  }catch{/* Do not display unsafe arbitrary response bodies. */}
  return new SelfhostHttpError(response.status,detail||("Ошибка сервера: HTTP "+response.status),code);
}
// Android's native HTTPS transport avoids the WebView's cross-origin preflight
// round trip and legacy Chromium networking. Do not patch global fetch: binary
// transfers, streamed/cancellable document requests and the web app retain it.
async function androidJsonRequest(url:string,init:RequestInit,headers:Headers,signal:AbortSignal,timeoutMs:number):Promise<Response>{
  const nativeHeaders:Record<string,string>={};
  headers.forEach((value,key)=>{nativeHeaders[key]=value;});
  nativeHeaders["cache-control"]="no-store";
  let onAbort:()=>void=()=>{};
  try{
    if(signal.aborted)throw new DOMException("Request aborted","AbortError");
    const aborted=new Promise<never>((_,reject)=>{
      onAbort=()=>reject(new DOMException("Request aborted","AbortError"));
      signal.addEventListener("abort",onAbort,{once:true});
    });
    const result=await Promise.race([aborted,CapacitorHttp.request({
      url,method:init.method||"GET",headers:nativeHeaders,
      ...(typeof init.body==="string"?{data:init.body}:{}),
      connectTimeout:timeoutMs,readTimeout:timeoutMs,
      disableRedirects:true,responseType:"text",
    })]);
    // Capacitor parses application/json even with responseType=text. Preserve
    // HTTP status (including 401 and 204), rather than treating them as errors
    // in the transport itself. Never expose arbitrary native exception text.
    const body=[204,205,304].includes(result.status)?null:
      typeof result.data==="string"?result.data:JSON.stringify(result.data??null);
    return new Response(body,{status:result.status});
  }catch(error){
    if(signal.aborted)throw error;
    const code=String((error as {code?:unknown})?.code||"");
    if(code==="UnknownHostException")throw new Error("Не удалось найти сервер Lektrus (DNS). Проверьте соединение с интернетом.");
    if(code==="SSLHandshakeException"||code==="SSLPeerUnverifiedException")throw new Error("Android не смог установить защищённое соединение с сервером Lektrus (TLS). Проверьте дату, время и обновления Android.");
    if(code==="SocketTimeoutException")throw new Error("Сервер Lektrus не ответил на запрос Android вовремя. Проверьте соединение и повторите попытку.");
    throw new Error("Не удалось установить соединение с сервером Lektrus через Android. Проверьте интернет.");
  }finally{signal.removeEventListener("abort",onAbort);}
}
// Report transport failures, not auth/permission errors. Consumers must verify
// the public health endpoint before treating an individual error as an outage.
function notifyServiceRequestFailure(path:string){
  if(path==="/api/v1/health"||path==="/api/v1/mobile/android-update"||path==="/api/v1/maintenance")return;
  if(typeof window!=="undefined"&&typeof window.dispatchEvent==="function"&&typeof Event==="function")
    window.dispatchEvent(new Event("lektrus:service-request-failed"));
}
async function rawRequest(path:string,init:RequestInit={},token?:string,timeoutMs=TIMEOUT_MS,binary=false):Promise<Response>{
  if(!path.startsWith("/api/v1/"))throw new Error("Неправильный путь API Lektrus.");
  const nativeJson=!binary&&!init.signal&&Capacitor.getPlatform()==="android"&&Capacitor.isPluginAvailable("CapacitorHttp")&&
    (init.body===undefined||typeof init.body==="string");
  if(nativeJson&&path.startsWith("/api/v1/auth/")&&timeoutMs===TIMEOUT_MS)timeoutMs=NATIVE_AUTH_TIMEOUT_MS;
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
    const response=nativeJson?await androidJsonRequest(selfhostOrigin()+path,init,headers,controller.signal,timeoutMs):
      await fetch(selfhostOrigin()+path,{
        ...init,headers,signal:controller.signal,cache:"no-store",credentials:"omit",
      });
    if(response.status>=500)notifyServiceRequestFailure(path);
    return response;
  }catch(error){
    if(!upstream?.aborted)notifyServiceRequestFailure(path);
    if(controller.signal.aborted&&!upstream?.aborted)
      throw new Error(nativeJson?"Сервер Lektrus не ответил на запрос Android вовремя. Проверьте соединение и повторите попытку.":"Время ожидания собственного сервера истекло.");
    throw error;
  }finally{
    clearTimeout(timer);
    upstream?.removeEventListener("abort",onAbort);
  }
}
/** Unauthenticated and uncached: no session refresh, no private data. */
export async function selfhostServiceHealthy():Promise<boolean>{
  try{
    const response=await rawRequest("/api/v1/health",{},undefined,HEALTH_TIMEOUT_MS);
    if(!response.ok)return false;
    const data=await response.json() as {ok?:unknown;service?:unknown};
    return data?.ok===true&&data.service==="lektrus-selfhost";
  }catch{return false}
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
  saveRememberedSession(null);
  saveSession(session);
  return session;
}
export async function selfhostGuestLogin(name:string,token:string,password?:string):Promise<SelfhostSession>{
  const response=await rawRequest("/api/v1/auth/guest",{
    method:"POST",body:JSON.stringify({name,token,password}),
  });
  if(!response.ok)throw await responseError(response);
  const session=normalizeSession(await response.json());
  if(!session.user.guest_board_id)throw new Error("Сервер не вернул приглашённую доску.");
  saveSession(session);
  return session;
}
async function refreshSession(snapshot:SelfhostSession):Promise<SelfhostSession|null>{
  const current=loadSession();
  if(!current||current.user.id!==snapshot.user.id)return null;
  // Another tab may have rotated the token while this request was waiting.
  if(current.refresh_token!==snapshot.refresh_token)return current;
  let response=await rawRequest("/api/v1/auth/refresh",{
    method:"POST",body:JSON.stringify({refresh_token:snapshot.refresh_token}),
  });
  if(response.status===401){
    // A deploy or an overlapping browser tab can briefly reject a refresh.
    // Do not delete a persisted login after ONE rejection: first check whether
    // another tab rotated it, then retry the same still-current token once.
    await new Promise(resolve=>setTimeout(resolve,1000));
    let latest=loadSession();
    if(latest?.user.id!==snapshot.user.id)return null;
    if(latest.refresh_token!==snapshot.refresh_token)return latest;
    response=await rawRequest("/api/v1/auth/refresh",{
      method:"POST",body:JSON.stringify({refresh_token:snapshot.refresh_token}),
    });
    if(response.status===401){
      await new Promise(resolve=>setTimeout(resolve,400));
      latest=loadSession();
      if(latest?.user.id!==snapshot.user.id)return null;
      if(latest.refresh_token!==snapshot.refresh_token)return latest;
      saveSession(null);
      return null;
    }
  }
  if(!response.ok)throw await responseError(response);
  const next=normalizeSession(await response.json());
  const latest=loadSession();
  if(latest?.user.id!==snapshot.user.id)return null;
  if(latest.refresh_token!==snapshot.refresh_token)return latest;
  saveSession(next);
  return next;
}
async function refreshAcrossTabs(snapshot:SelfhostSession):Promise<SelfhostSession|null>{
  const locks=typeof navigator!=="undefined"?navigator.locks:undefined;
  if(!locks)return refreshSession(snapshot);
  let entered=false;
  try{
    return await locks.request("lektrus.selfhost.refresh.v1",()=>{
      entered=true;
      return refreshSession(snapshot);
    });
  }catch(error){
    // Some native WebViews expose the API but deny locking. Never retry a
    // refresh that actually ran, since valid refresh tokens are single-use.
    if(entered)throw error;
    return refreshSession(snapshot);
  }
}
function sharedRefresh(snapshot:SelfhostSession):Promise<SelfhostSession|null>{
  if(refreshInFlight)return refreshInFlight;
  const request=refreshAcrossTabs(snapshot).finally(()=>{
    if(refreshInFlight===request)refreshInFlight=null;
  });
  refreshInFlight=request;
  return request;
}
function refreshAfterUnauthorized(session:SelfhostSession):Promise<SelfhostSession|null>{
  const current=loadSession();
  if(!current||current.user.id!==session.user.id)
    throw new SelfhostHttpError(401,"Аккаунт изменился.");
  // A delayed 401 for an old access token must not rotate a fresh token again.
  return current.access_token!==session.access_token?Promise.resolve(current):sharedRefresh(current);
}
export async function selfhostSession():Promise<SelfhostSession|null>{
  const session=loadSession();if(!session)return null;
  if(session.expires_at>Math.floor(Date.now()/1000)+60)return session;
  return sharedRefresh(session);
}
export async function selfhostLogout():Promise<void>{
  const session=loadSession();
  clearSelfhostSession();
  if(!session)return;
  try{await rawRequest("/api/v1/auth/logout",{method:"POST"},session.access_token)}
  catch{/* Clearing the local session is unconditional. */}
}
export async function selfhostRequest<T>(path:string,init:RequestInit={},timeoutMs=TIMEOUT_MS):Promise<T>{
  let session=await selfhostSession();
  if(!session)throw new SelfhostHttpError(401,"Сессия завершена. Войдите в Lektrus заново.");
  let response=await rawRequest(path,init,session.access_token,timeoutMs);
  if(response.status===401){
    session=await refreshAfterUnauthorized(session);
    if(!session)throw new SelfhostHttpError(401,"Сессия завершена. Войдите снова.");
    response=await rawRequest(path,init,session.access_token,timeoutMs);
  }
  if(!response.ok)throw await responseError(response);
  if(response.status===204)return undefined as T;
  return await response.json() as T;
}
export type MaintenanceStatus={
  state:"off"|"scheduled"|"active";starts_at:string|null;ends_at:string|null;
  notice:string;access_allowed:boolean;server_time:string;
};
export type MaintenanceConfig=MaintenanceStatus&{allowed_accounts:string[]};
export type MaintenanceSetting=Pick<MaintenanceConfig,"starts_at"|"ends_at"|"notice"|"allowed_accounts">&{start_now?:boolean};
export async function selfhostMaintenanceStatus(authenticated=false):Promise<MaintenanceStatus>{
  const session=authenticated?await selfhostSession():null;
  const response=await rawRequest("/api/v1/maintenance",{},session?.access_token,6500);
  if(!response.ok)throw await responseError(response);
  const data=await response.json() as MaintenanceStatus;
  if(!["off","scheduled","active"].includes(data?.state)||typeof data.access_allowed!=="boolean")
    throw new Error("Не удалось проверить режим технических работ.");
  return data;
}
export const selfhostMaintenanceAdmin=()=>selfhostRequest<MaintenanceConfig>("/api/v1/admin/maintenance");
export const selfhostSaveMaintenance=(value:MaintenanceSetting)=>selfhostRequest<MaintenanceConfig>("/api/v1/admin/maintenance",{method:"PUT",body:JSON.stringify(value)});
export const selfhostBoards=()=>selfhostRequest<SelfhostBoard[]>("/api/v1/boards");
// Public update discovery must work before login, and must never refresh auth.
export async function selfhostAndroidUpdate():Promise<unknown>{
  const response=await rawRequest("/api/v1/mobile/android-update",{},undefined,6500);
  if(!response.ok)throw await responseError(response);
  return response.json();
}
export const selfhostNotifications=()=>selfhostRequest<any[]>("/api/v1/notifications");
export const selfhostOrganization=()=>selfhostRequest<{categories:Array<{kind:"subject"|"group";name:string}>;boards:Array<{board_id:string;subject:string;group_name:string}>}>("/api/v1/organization");
export const selfhostDirectChats=()=>selfhostRequest<any[]>("/api/v1/direct-chats");
export const selfhostDirectContacts=()=>selfhostRequest<any[]>("/api/v1/direct-chats/contacts");
export const selfhostEnsureDirectChat=(user_id:string)=>selfhostRequest<{id:string}>("/api/v1/direct-chats",{method:"POST",body:JSON.stringify({user_id})});
export const selfhostDirectMessages=(id:string)=>selfhostRequest<any[]>("/api/v1/direct-chats/"+encodeURIComponent(id)+"/messages");
export const selfhostSendDirectMessage=(id:string,body:string)=>selfhostRequest<{ok:boolean}>("/api/v1/direct-chats/"+encodeURIComponent(id)+"/messages",{method:"POST",body:JSON.stringify({body})});
export const selfhostMarkDirectChatRead=(id:string)=>selfhostRequest<{ok:boolean}>("/api/v1/direct-chats/"+encodeURIComponent(id)+"/read",{method:"POST",body:"{}"});
export const selfhostDirectReadState=(id:string)=>selfhostRequest<{other_last_read_at:string|null}>("/api/v1/direct-chats/"+encodeURIComponent(id)+"/read-state");
export const selfhostEditDirectMessage=(id:string,body:string)=>selfhostRequest<{ok:boolean}>("/api/v1/direct-messages/"+encodeURIComponent(id),{method:"PATCH",body:JSON.stringify({body})});
export const selfhostDeleteDirectMessage=(id:string)=>selfhostRequest<{ok:boolean}>("/api/v1/direct-messages/"+encodeURIComponent(id),{method:"DELETE"});
export const selfhostSaveBoardOrganization=(board_id:string,subject:string,group_name:string)=>selfhostRequest<{ok:boolean}>("/api/v1/organization/board",{method:"PUT",body:JSON.stringify({board_id,subject,group_name})});
export const selfhostSaveCategory=(kind:"subject"|"group",name:string)=>selfhostRequest<{ok:boolean}>("/api/v1/organization/category",{method:"POST",body:JSON.stringify({kind,name})});
export const selfhostReadNotification=(id:string)=>selfhostRequest<{ok:boolean}>("/api/v1/notifications/"+encodeURIComponent(id)+"/read",{method:"POST",body:"{}"});
export const selfhostReadAllNotifications=()=>selfhostRequest<{ok:boolean}>("/api/v1/notifications/read-all",{method:"POST",body:"{}"});
export const selfhostNotificationSettings=()=>selfhostRequest<any>("/api/v1/notification-settings");
export const selfhostSaveNotificationSettings=(value:Record<string,boolean>)=>selfhostRequest<{ok:boolean}>("/api/v1/notification-settings",{method:"PUT",body:JSON.stringify(value)});
export const selfhostMaterials=()=>selfhostRequest<any[]>("/api/v1/materials");
export const selfhostMaterialMeta=(id:string,title:string,folder:string)=>selfhostRequest<any>("/api/v1/materials/"+encodeURIComponent(id),{method:"PATCH",body:JSON.stringify({title,folder})});
export const selfhostMaterialFavorite=(id:string,favorite:boolean)=>selfhostRequest<any>("/api/v1/materials/"+encodeURIComponent(id),{method:"PATCH",body:JSON.stringify({favorite})});
export const selfhostMaterialUsed=(id:string)=>selfhostRequest<{ok:boolean}>("/api/v1/materials/"+encodeURIComponent(id)+"/used",{method:"POST",body:"{}"});
export async function selfhostMaterialFile(id:string,file?:File,title?:string,folder?:string):Promise<any>{
  const path="/api/v1/materials/"+encodeURIComponent(id)+(file?"":"/file");
  let session=await selfhostSession(); if(!session)throw new SelfhostHttpError(401,"Сессия завершена. Войдите снова.");
  const init:RequestInit=file?{method:"POST",headers:{"Content-Type":file.type||"application/octet-stream","X-File-Name":encodeURIComponent(file.name),"X-Material-Title":encodeURIComponent(title||file.name),"X-Material-Folder":encodeURIComponent(folder||"")},body:file}:{};
  let response=await rawRequest(path,init,session.access_token,120000,true);
  if(!response.ok)throw await responseError(response); return file?response.json():response.blob();
}
export const selfhostDeleteMaterial=(id:string)=>selfhostRequest<void>("/api/v1/materials/"+encodeURIComponent(id),{method:"DELETE"});
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
  let response=await rawRequest(path,init,session.access_token,timeoutMs,true);
  if(response.status===401){
    session=await refreshAfterUnauthorized(session);
    if(!session)throw new SelfhostHttpError(401,"Сессия завершена. Войдите снова.");
    response=await rawRequest(path,init,session.access_token,timeoutMs,true);
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
type JsonObject=Record<string,unknown>;
type PointEdit={id:string;stroke_id?:string;count:number;keep:number;points:JsonObject[];geometry?:JsonObject};
type DocumentDelta={set?:JsonObject;remove?:string[];items?:{upsert?:JsonObject[];remove?:string[];order?:string[];point_edits?:PointEdit[]}};
type DeltaResponse=SelfhostDocument&{base_version?:number;patches?:DocumentDelta[];ink_point_deltas?:boolean};
type RevisionPatch={base_version:number;delta:DocumentDelta;updated_at:string;updated_by:string;ink_cursor?:SelfhostCommittedCursor};
const MAX_DELTA_BYTES=1024*1024;
// The raw acknowledged document, not the normalized editor snapshot. Keep only
// the currently used board to avoid retaining every board opened in a session.
let documentBase:{userId:string;boardId:string;version:number;document:JsonObject}|null=null;
let deltaSupported=true;
let pointDeltasSupported=false;
const documentPath=(boardId:string)=>"/api/v1/boards/"+encodeURIComponent(boardId)+"/document";
const jsonObject=(value:unknown):value is JsonObject=>!!value&&typeof value==="object"&&!Array.isArray(value);
function equalJson(a:unknown,b:unknown):boolean{
  if(a===b)return true;
  if(Array.isArray(a))return Array.isArray(b)&&a.length===b.length&&a.every((v,i)=>equalJson(v,b[i]));
  if(!jsonObject(a)||!jsonObject(b))return false;
  const keys=Object.keys(a);
  return keys.length===Object.keys(b).length&&keys.every(key=>Object.hasOwn(b,key)&&equalJson(a[key],b[key]));
}
function itemMap(items:unknown):Map<string,JsonObject>|null{
  if(!Array.isArray(items))return null;
  const result=new Map<string,JsonObject>();
  for(const item of items){
    if(!jsonObject(item)||typeof item.id!=="string"||!item.id||result.has(item.id))return null;
    result.set(item.id,item);
  }
  return result;
}
// Compare plain editor values against an already JSON-normalized snapshot.
// Undefined properties are omitted by JSON.stringify. Exotic objects/toJSON
// are never reused: those values take the normal serialization path.
function plainWireObject(value:object):boolean{
  const prototype=Object.getPrototypeOf(value);
  return (prototype===null||Object.getPrototypeOf(prototype)===null)&&Object.prototype.toString.call(value)==="[object Object]";
}
function equalWireJson(raw:unknown,saved:unknown):boolean{
  if(raw===null||typeof raw!=="object")return raw===saved||
    (typeof raw==="number"&&!Number.isFinite(raw)&&saved===null);
  if("toJSON" in raw)return false;
  if(Array.isArray(raw)){
    if(!Array.isArray(saved)||raw.length!==saved.length)return false;
    for(let index=0;index<raw.length;index++)if(!equalWireJson(raw[index]??null,saved[index]))return false;
    return true;
  }
  if(!jsonObject(saved)||!plainWireObject(raw))return false;
  const record=raw as JsonObject;
  let count=0;
  for(const key of Object.keys(record)){
    const value=record[key];
    if(typeof value==="function"&&"toJSON" in value)return false;
    if(value===undefined||typeof value==="function"||typeof value==="symbol")continue;
    if(!Object.hasOwn(saved,key)||!equalWireJson(value,saved[key]))return false;
    count++;
  }
  return count===Object.keys(saved).length;
}
function normalizedField(key:string,value:unknown):unknown{
  const parsed=JSON.parse(JSON.stringify({[key]:value}));
  return Object.hasOwn(parsed,key)?parsed[key]:undefined;
}
// For small edits on large native boards, reuse detached ACKed objects and
// serialize only changed values. The conservative lower bound on full JSON
// size guarantees that the PATCH is smaller without building the full body.
export function prepareSmallDocumentDelta(base:JsonObject,raw:JsonObject,expectedVersion:number,inkGesture?:string):{next:JsonObject;body:string}|null{
  if(raw.version!==1||base.version!==1||raw.pilot_schema!=null||base.pilot_schema!=null||
     "toJSON" in raw||!Array.isArray(raw.items)||"toJSON" in raw.items||(!inkGesture&&raw.items.length<100)||
     !plainWireObject(raw))return null;
  const previous=itemMap(base.items);
  if(!previous)return null;
  const entries:[string,unknown][]=[];
  try{
    for(const key of Object.keys(raw)){
      if(key==="items")continue;
      const value=raw[key];
      const normalized=Object.hasOwn(base,key)&&equalWireJson(value,base[key])?base[key]:normalizedField(key,value);
      if(normalized!==undefined)entries.push([key,normalized]);
    }
    const items:JsonObject[]=[];
    let changedItems=0;
    const changedLimit=Math.max(8,Math.ceil(raw.items.length*.05));
    for(let index=0;index<raw.items.length;index++){
      const item=raw.items[index];
      if(!jsonObject(item)||typeof item.id!=="string")return null;
      const saved=previous.get(item.id);
      const unchanged=!!saved&&equalWireJson(item,saved);
      // A bulk edit should immediately use the established full serializer
      // instead of doing an extra complete object-by-object normalization.
      if(!unchanged&&++changedItems>changedLimit)return null;
      const normalized=unchanged?saved:normalizedField(String(index),item);
      if(!jsonObject(normalized)||typeof normalized.id!=="string"||!normalized.id)return null;
      items.push(normalized);
    }
    const next=Object.fromEntries([...entries,["items",items]]);
    const fullDelta=diffSelfhostDocument(base,next);
    if(!fullDelta)return null;
    const delta=inkGesture?compactInkPointDelta(base,fullDelta,inkGesture):fullDelta;
    const body=JSON.stringify({expected_version:expectedVersion,delta});
    const bytes=new TextEncoder().encode(body).byteLength;
    // A JSON item with a nonempty id is at least 10 ASCII bytes; the actual
    // full request is larger still (metadata, commas, wrapper, etc.).
    return bytes<MAX_DELTA_BYTES&&(inkGesture||bytes<items.length*10)?{next,body}:null;
  }catch{return null}
}
const reservedField=(key:string)=>["items","version","pilot_schema","__proto__","constructor","prototype"].includes(key);
export function diffSelfhostDocument(base:JsonObject,next:JsonObject):DocumentDelta|null{
  if(base.version!==1||next.version!==1||base.pilot_schema!=null||next.pilot_schema!=null)return null;
  const before=itemMap(base.items),after=itemMap(next.items);
  if(!before||!after)return null;
  const changed=Object.entries(next).filter(([key,value])=>key!=="items"&&(!Object.hasOwn(base,key)||!equalJson(base[key],value)));
  const removed=Object.keys(base).filter(key=>key!=="items"&&!Object.hasOwn(next,key));
  if(changed.some(([key])=>reservedField(key))||removed.some(reservedField))return null;
  const upsert=[...after].filter(([id,item])=>!equalJson(before.get(id),item)).map(([,item])=>item);
  const remove=[...before.keys()].filter(id=>!after.has(id));
  const implicitOrder=[...before.keys()].filter(id=>after.has(id)).concat([...after.keys()].filter(id=>!before.has(id)));
  const order=[...after.keys()];
  const reorder=!equalJson(implicitOrder,order);
  return {
    ...(changed.length?{set:Object.fromEntries(changed)}:{}),
    ...(removed.length?{remove:removed}:{}),
    ...(upsert.length||remove.length||reorder?{items:{...(upsert.length?{upsert}:{}),...(remove.length?{remove}:{}),...(reorder?{order}:{})}}:{}),
  };
}
const geometryKeys=["x","y","width","height"] as const;
const inkKind=(item:JsonObject)=>item.kind==="pen"||item.kind==="marker";
const validPoint=(p:unknown):p is JsonObject=>jsonObject(p)&&Object.keys(p).length===2&&
  typeof p.x==="number"&&Number.isFinite(p.x)&&typeof p.y==="number"&&Number.isFinite(p.y);
const cents=(n:unknown):number=>{
  if(typeof n!=="number"||!Number.isFinite(n)||!Number.isSafeInteger(Math.round(n*100))||Math.abs(n*100-Math.round(n*100))>0.00001)
    throw new Error("Invalid ink coordinate");
  return Math.round(n*100);
};
function translatedPoints(points:JsonObject[],old:JsonObject,geometry:JsonObject):JsonObject[]{
  const dx=cents(old.x)-cents(geometry.x),dy=cents(old.y)-cents(geometry.y);
  if(!dx&&!dy)return points;
  return points.map(p=>shiftInkPoint(p,dx,dy));
}
function shiftInkPoint(p:JsonObject,dx:number,dy:number):JsonObject{
  const x=cents(p.x)+dx,y=cents(p.y)+dy;
  if(!Number.isSafeInteger(x)||!Number.isSafeInteger(y))throw new Error("Invalid ink shift");
  return {x:x/100,y:y/100};
}
const without=(item:JsonObject,keys:string[])=>Object.fromEntries(Object.entries(item).filter(([k])=>!keys.includes(k)));
function applyPointEdit(old:JsonObject,edit:PointEdit):JsonObject{
  if(!jsonObject(edit)||Object.keys(edit).some(k=>!["id","stroke_id","count","keep","points","geometry"].includes(k))||
     old.id!==edit.id||!Number.isSafeInteger(edit.count)||!Number.isSafeInteger(edit.keep)||edit.keep<1||
     edit.keep>edit.count||!Array.isArray(edit.points)||!edit.points.every(validPoint))throw new Error("Invalid point edit");
  let stroke=old,attached:Map<string,JsonObject>|null=null;
  if(edit.stroke_id!==undefined){
    if(typeof edit.stroke_id!=="string"||old.kind!=="sticky"||edit.geometry!==undefined)throw new Error("Invalid sticker edit");
    attached=itemMap(old.stickerInk);
    const found=attached?.get(edit.stroke_id);
    if(!found)throw new Error("Missing sticker ink");
    stroke=found;
  }else{
    const g=edit.geometry;
    if(!jsonObject(g)||Object.keys(g).length!==4||geometryKeys.some(k=>typeof g[k]!=="number"||!Number.isFinite(g[k]))||
      Number(g.width)<=0||Number(g.height)<=0)throw new Error("Invalid ink geometry");
  }
  if(!inkKind(stroke)||!Array.isArray(stroke.points)||stroke.points.length!==edit.count||!stroke.points.every(validPoint))
    throw new Error("Missing or changed ink base");
  const prefix=stroke.points.slice(0,edit.keep);
  const points=[...(edit.geometry?translatedPoints(prefix,stroke,edit.geometry):prefix),...edit.points];
  const updated={...stroke,...edit.geometry,points};
  if(attached){attached.set(edit.stroke_id!,updated);return {...old,stickerInk:[...attached.values()]}}
  return updated;
}
/** Lossless suffix encoding of an acknowledged permanent stroke. The existing
 * simplifier may revise its tail and the local bounding box may move left/up. */
export function compactInkPointDelta(base:JsonObject,delta:DocumentDelta,gesture:string):DocumentDelta{
  const changes=delta.items;
  if(!changes||changes.upsert?.length!==1||changes.remove?.length||changes.order||gesture.startsWith("erase:"))return delta;
  const next=changes.upsert[0],old=itemMap(base.items)?.get(String(next.id));
  if(!old)return delta;
  let a=old,b=next,geometry:JsonObject|undefined,strokeId:string|undefined;
  try{
    if(next.kind==="sticky"){
      if(!equalJson(without(old,["stickerInk"]),without(next,["stickerInk"])))return delta;
      const before=itemMap(old.stickerInk),after=itemMap(next.stickerInk);
      if(!before||!after||!equalJson([...before.keys()],[...after.keys()])||
        [...before].some(([id,value])=>id!==gesture&&!equalJson(value,after.get(id))))return delta;
      const prev=before.get(gesture),updated=after.get(gesture);
      if(!prev||!updated||!equalJson(without(prev,["points"]),without(updated,["points"])))return delta;
      a=prev;b=updated;strokeId=gesture;
    }else{
      if(next.id!==gesture||!equalJson(without(old,[...geometryKeys,"points"]),without(next,[...geometryKeys,"points"])))return delta;
      geometry=Object.fromEntries(geometryKeys.map(k=>[k,next[k]]));
    }
    if(!inkKind(a)||!inkKind(b)||!Array.isArray(a.points)||!Array.isArray(b.points)||
      !a.points.every(validPoint)||!b.points.every(validPoint))return delta;
    const dx=geometry?cents(a.x)-cents(geometry.x):0,dy=geometry?cents(a.y)-cents(geometry.y):0;
    let keep=0;
    while(keep<a.points.length&&keep<b.points.length){
      const prior=dx||dy?shiftInkPoint(a.points[keep],dx,dy):a.points[keep];
      if(prior.x!==b.points[keep].x||prior.y!==b.points[keep].y)break;
      keep++;
    }
    if(!keep)return delta;
    const edit:PointEdit={id:String(next.id),...(strokeId?{stroke_id:strokeId}:{}),count:a.points.length,keep,
      points:b.points.slice(keep),...(geometry?{geometry}:{})};
    if(geometry&&(!geometryKeys.every(k=>typeof geometry![k]==="number"&&Number.isFinite(geometry![k]))||
      Number(geometry.width)<=0||Number(geometry.height)<=0))return delta;
    const compact:DocumentDelta={...delta,items:{point_edits:[edit]}};
    // Each retained point costs at least 13 characters in a complete upsert.
    // Long strokes therefore do not need a second full JSON serialization.
    const overhead=JSON.stringify({point_edits:[{...edit,points:[]}]}).length;
    return keep*13>overhead||JSON.stringify(compact.items).length<JSON.stringify(delta.items).length?compact:delta;
  }catch{return delta}
}
export function applySelfhostDocumentDelta(base:JsonObject,delta:DocumentDelta):JsonObject{
  if(!jsonObject(delta)||Object.keys(delta).some(key=>!["set","remove","items"].includes(key)))throw new Error("Invalid delta");
  const fields=delta.set??{},removed=delta.remove??[];
  if(!jsonObject(fields)||!Array.isArray(removed)||Object.keys(fields).some(reservedField)||removed.some(key=>typeof key!=="string"||reservedField(key)||Object.hasOwn(fields,key)))throw new Error("Invalid delta fields");
  const result={...base,...fields};
  for(const key of removed)delete result[key];
  if(delta.items!==undefined){
    const changes=delta.items;
    if(!jsonObject(changes)||Object.keys(changes).some(key=>!["upsert","remove","order","point_edits"].includes(key)))throw new Error("Invalid item delta");
    const map=itemMap(base.items),upserts=itemMap(changes.upsert??[]),deletes=changes.remove??[];
    if(!map||!upserts||!Array.isArray(deletes))throw new Error("Invalid items");
    for(const id of deletes){if(typeof id!=="string"||upserts.has(id)||!map.delete(id))throw new Error("Invalid item removal")}
    if(changes.point_edits!==undefined){
      if(!Array.isArray(changes.point_edits)||changes.point_edits.length!==1||upserts.size||deletes.length||changes.order)
        throw new Error("Ambiguous point edit");
      const edit=changes.point_edits[0],old=map.get(edit?.id);
      if(!old)throw new Error("Missing ink item");
      map.set(edit.id,applyPointEdit(old,edit));
    }
    for(const [id,item] of upserts)map.set(id,item);
    const order=changes.order??[...map.keys()];
    if(!Array.isArray(order)||order.length!==map.size||new Set(order).size!==map.size||order.some(id=>!map.has(id)))throw new Error("Invalid item order");
    result.items=order.map(id=>map.get(id));
  }
  return result;
}
function rememberDocument(boardId:string,userId:string|undefined,version:number,document:JsonObject|null){
  if(!userId||loadSession()?.user.id!==userId||!document||!Number.isSafeInteger(version))return;
  if(documentBase?.boardId===boardId&&documentBase.userId===userId&&documentBase.version>version)return;
  documentBase={boardId,userId,version,document};
}
export async function selfhostReadDocument(boardId:string,signal?:AbortSignal,incremental=true):Promise<SelfhostDocument>{
  const userId=loadSession()?.user.id;
  const base=incremental&&documentBase?.boardId===boardId&&documentBase.userId===userId?documentBase:null;
  const path=documentPath(boardId);
  let row=await selfhostRequest<DeltaResponse>(path+"?ink_point_deltas=true"+(base?"&since_version="+base.version:""),{signal});
  if(row.patches!==undefined){
    try{
      if(!base||row.board_id!==boardId||row.base_version!==base.version||!Number.isSafeInteger(row.version)||!Array.isArray(row.patches)||row.patches.length!==row.version-base.version||row.patches.length>8)throw new Error("Invalid delta chain");
      row={...row,document:row.patches.reduce(applySelfhostDocumentDelta,base.document)};
    }catch{
      // A missing/malformed chain must never replace an acknowledged snapshot.
      row=await selfhostRequest<DeltaResponse>(path+"?ink_point_deltas=true",{signal});
    }
  }
  pointDeltasSupported=row.ink_point_deltas===true;
  rememberDocument(boardId,userId,row.version,row.document);
  return row;
}
export const selfhostReadDocumentVersion=(boardId:string,signal?:AbortSignal)=>selfhostRequest<{version:number}>(
  "/api/v1/boards/"+encodeURIComponent(boardId)+"/document?version_only=true",{signal}
);
export async function selfhostSaveDocument(boardId:string,expectedVersion:number,document:JsonObject,inkGesture?:string,inkCursor?:InkCommitCursor){
  const userId=loadSession()?.user.id;
  const base=documentBase?.boardId===boardId&&documentBase.userId===userId&&documentBase.version===expectedVersion?documentBase:null;
  const prepared=base&&deltaSupported&&expectedVersion>0?prepareSmallDocumentDelta(base.document,document,expectedVersion,pointDeltasSupported?inkGesture:undefined):null;
  const fullBody=prepared?null:JSON.stringify({expected_version:expectedVersion,document});
  // The fast path owns a detached snapshot, too. Changed fields are normalized
  // before any network await; unchanged values come from the ACKed snapshot.
  const next=prepared?.next??JSON.parse(fullBody!).document as JsonObject;
  const path=documentPath(boardId)+"?version_only=true"+(inkGesture?"&ink_gesture="+encodeURIComponent(inkGesture):"");
  let result:{version:number}|undefined;
  let sentOverSocket=false;
  if(base&&deltaSupported&&expectedVersion>0){
    const fullDelta=prepared?null:diffSelfhostDocument(base.document,next);
    const delta=fullDelta&&inkGesture&&pointDeltasSupported?compactInkPointDelta(base.document,fullDelta,inkGesture):fullDelta;
    if(prepared||delta){
      const body=prepared?.body??JSON.stringify({expected_version:expectedVersion,delta});
      const bytes=new TextEncoder().encode(body).byteLength;
      if(prepared||(bytes<MAX_DELTA_BYTES&&(inkGesture||(fullBody&&(bytes<fullBody.length||bytes<new TextEncoder().encode(fullBody).byteLength))))){
        try{
          // Never replay an ambiguous websocket write as HTTP. A lost ACK
          // takes the normal version-conflict recovery path.
          const ws=inkGesture?selfhostBoardSockets.get(boardId)?.commitInk({
            ...JSON.parse(body),ink_gesture:inkGesture,...(inkCursor?{cursor:inkCursor}:{})
          }):null;
          sentOverSocket=!!ws;
          result=ws?await ws:await selfhostRequest<{version:number}>(path,{method:"PATCH",body});
        }
        catch(error){
          // Older servers still support the version-checked full PUT. Do not
          // retry permissions/conflicts/unknown outcomes as a second write.
          if(!(error instanceof SelfhostHttpError)||error.status!==405)throw error;
          deltaSupported=false;
        }
      }
    }
  }
  result??=await selfhostRequest<{version:number}>(path,{method:"PUT",body:fullBody??JSON.stringify({expected_version:expectedVersion,document:next})});
  rememberDocument(boardId,userId,result.version,next);
  if(inkCursor&&!sentOverSocket)selfhostBoardSockets.get(boardId)?.sendCursor(inkCursor);
  return result;
}
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
export const selfhostInvite=(boardId:string,email:string,role:"editor"|"viewer",participant_role?:InvitedParticipantRole)=>
  selfhostRequest<{kind:"member"|"invite"}>(
    "/api/v1/boards/"+encodeURIComponent(boardId)+"/invitations",{
      method:"POST",body:JSON.stringify({email,role,participant_role}),
    });
export const selfhostClaimInvitations=(timeoutMs=TIMEOUT_MS)=>selfhostRequest<{claimed:number}>(
  "/api/v1/invitations/claim",{method:"POST"},timeoutMs
);

export async function selfhostMe():Promise<SelfhostUser>{
  const user=await selfhostRequest<SelfhostUser>("/api/v1/auth/me");
  const current=loadSession();
  if(current?.user.id===user.id)saveSession({...current,user});
  return user;
}
export const selfhostRequestTeacherAccess=(application:{
  phone:string;city:string;organization:string;focusArea:string;experience:string;motivation:string;
})=>selfhostRequest<SelfhostUser>("/api/v1/account/teacher-request",{
  method:"POST",body:JSON.stringify(application),
});
export const selfhostEnableTeacherRole=()=>selfhostRequest<SelfhostUser>("/api/v1/account/role/teacher",{method:"POST"});
export const selfhostSetStudentRole=()=>selfhostRequest<SelfhostUser>(
  "/api/v1/account/role/student",{method:"POST"}
);
export type SelfhostAdminUser={
  user_id:string;name:string;email:string;role:"teacher"|"student";
  teacher_status:"none"|"pending"|"approved"|"rejected";is_admin:boolean;
  subscription_plan:"free"|"pro";subscription_until:string|null;created_at:string;
};
export type SelfhostTeacherRequest={
  user_id:string;name:string;email:string;status:"pending"|"approved"|"rejected";
  requested_at:string|null;reviewed_at:string|null;
  application:{phone?:string;city?:string;organization?:string;focusArea?:string;experience?:string;motivation?:string}|null;
};
export type SelfhostAdminBoard={
  id:string;owner_id:string;title:string;owner_name:string;owner_email:string;
  member_count:number;created_at:string;updated_at:string;deleted_at:string|null;
};
export type SelfhostProductFeedback={
  id:string;user_id:string|null;name:string;email:string;
  topic:"Предложение"|"Отзыв о сервисе"|"Сообщить о проблеме"|"Другое";
  message:string;source:"site"|"app";status:"new"|"reviewed"|"closed";created_at:string;
  notification_id?:string|null;notification_status?:SelfhostMailStatus|null;notification_error?:string|null;notification_sent_at?:string|null;
};
export type SelfhostMailStatus="pending"|"sending"|"sent"|"failed";
export type SelfhostFeedbackMail={id:string;feedback_id:string;recipient:string;recipient_name:string;subject:string;body:string;status:SelfhostMailStatus;attempts:number;last_error:string|null;created_at:string;sent_at:string|null};
export const selfhostAdminUsers=()=>selfhostRequest<SelfhostAdminUser[]>("/api/v1/admin/users");
export const selfhostAdminDeleteUser=(userId:string,email:string)=>
  selfhostRequest<{ok:boolean;files_pending:number}>("/api/v1/admin/users/"+encodeURIComponent(userId),{
    method:"DELETE",body:JSON.stringify({email}),
  });
export const selfhostAdminTeacherRequests=()=>selfhostRequest<SelfhostTeacherRequest[]>("/api/v1/admin/teacher-requests");
export const selfhostReviewTeacherRequest=(userId:string,approve:boolean)=>selfhostRequest<{ok:boolean;status:string}>(
  "/api/v1/admin/teacher-requests/"+encodeURIComponent(userId)+"/review",{
    method:"POST",body:JSON.stringify({approve}),
  }
);
export const selfhostAdminSetSubscription=(userId:string,plan:"free"|"pro",until:string|null)=>
  selfhostRequest<{ok:boolean}>("/api/v1/admin/users/"+encodeURIComponent(userId)+"/subscription",{
    method:"PATCH",body:JSON.stringify({plan,until}),
  });
export const selfhostAdminBoards=()=>selfhostRequest<SelfhostAdminBoard[]>("/api/v1/admin/boards");
export const selfhostAdminUserWorkspace=(userId:string)=>selfhostRequest<SelfhostAdminBoard[]>(
  "/api/v1/admin/users/"+encodeURIComponent(userId)+"/boards"
);
export async function selfhostSubmitProductFeedback(input:{
  name:string;email:string;topic:"Предложение"|"Отзыв о сервисе"|"Сообщить о проблеме"|"Другое";
  message:string;source:"site"|"app";
}):Promise<SelfhostProductFeedback>{
  const response=await rawRequest("/api/v1/feedback",{
    method:"POST",body:JSON.stringify(input),
  });
  if(!response.ok)throw await responseError(response);
  return response.json();
}
export const selfhostAdminFeedback=()=>selfhostRequest<SelfhostProductFeedback[]>("/api/v1/admin/feedback");
export const selfhostUpdateProductFeedbackStatus=(id:string,status:"new"|"reviewed"|"closed")=>
  selfhostRequest<SelfhostProductFeedback>("/api/v1/admin/feedback/"+encodeURIComponent(id),{
    method:"PATCH",body:JSON.stringify({status}),
  });
export const selfhostAdminFeedbackMail=()=>selfhostRequest<SelfhostFeedbackMail[]>("/api/v1/admin/feedback-mail");
export const selfhostReplyToFeedback=(id:string,requestId:string,message:string)=>selfhostRequest<{ok:boolean;id:string}>(
  `/api/v1/admin/feedback/${encodeURIComponent(id)}/reply`,{method:"POST",body:JSON.stringify({request_id:requestId,message})});
export const selfhostRetryFeedbackMail=(id:string)=>selfhostRequest<{ok:boolean}>(
  `/api/v1/admin/feedback-mail/${encodeURIComponent(id)}/retry`,{method:"POST"});
export type SelfhostTestMailKind="confirmation"|"password_reset"|"notification"|"reply";
export type SelfhostTestMailResult={email:string;results:Array<{kind:SelfhostTestMailKind;status:"sent"|"failed"}>};
export const selfhostSendTestMail=(email:string,kinds:SelfhostTestMailKind[])=>selfhostRequest<SelfhostTestMailResult>(
  "/api/v1/admin/feedback-mail/test",{method:"POST",body:JSON.stringify({email,kinds})},70000);

export async function selfhostSignup(input:{
  email:string;password:string;name:string;first_name:string;last_name:string;
  role:"teacher"|"student";
}):Promise<{ok:boolean;message:string}>{
  // Signup waits for SMTP delivery on the server; keep the default timeout
  // for ordinary API traffic, but allow the mail handshake to finish.
  let response:Response;
  try{
    response=await rawRequest("/api/v1/auth/signup",{
      method:"POST",body:JSON.stringify(input),
    },undefined,45000);
  }catch(error){
    if(error instanceof TypeError){
      // Do not automatically replay a registration: the original request may
      // already have created a pending account or mailed a verification link.
      throw new Error("Соединение с сервером прервалось. Проверьте почту. Если письма нет, посмотрите логи приложения Amvera и повторите регистрацию с прежним паролем.");
    }
    throw error;
  }
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

export async function selfhostRequestPasswordReset(email:string):Promise<void>{
  const response=await rawRequest("/api/v1/auth/password-reset/request",{
    method:"POST",body:JSON.stringify({email:email.trim().toLowerCase()}),
  },undefined,45000);
  if(!response.ok)throw await responseError(response);
}
export async function selfhostCompletePasswordReset(token:string,password:string):Promise<void>{
  const response=await rawRequest("/api/v1/auth/password-reset/complete",{
    method:"POST",body:JSON.stringify({token,password}),
  });
  if(!response.ok)throw await responseError(response);
  saveRememberedSession(null);
}

export type SelfhostBoardComment={
  id:string;board_id:string;author_id:string;author_name:string;parent_id:string|null;
  body:string;resolved:boolean;created_at:string;updated_at:string;
};
export const selfhostBoardComments=(boardId:string)=>
  selfhostRequest<SelfhostBoardComment[]>("/api/v1/boards/"+encodeURIComponent(boardId)+"/comments");
export const selfhostBoardCommentParticipants=(boardId:string)=>
  selfhostRequest<Array<{user_id:string;display_name:string}>>(
    "/api/v1/boards/"+encodeURIComponent(boardId)+"/comment-participants"
  );
export const selfhostCreateBoardComment=(boardId:string,body:string,parentId:string|null=null)=>
  selfhostRequest<SelfhostBoardComment>("/api/v1/boards/"+encodeURIComponent(boardId)+"/comments",{
    method:"POST",body:JSON.stringify({body,parent_id:parentId}),
  });
export const selfhostResolveBoardComment=(commentId:string,resolved:boolean)=>
  selfhostRequest<SelfhostBoardComment>("/api/v1/comments/"+encodeURIComponent(commentId),{
    method:"PATCH",body:JSON.stringify({resolved}),
  });


function connectSelfhostBoard(
  boardId:string,onRevision:(version:number,patch?:RevisionPatch)=>void,
  onStatus:(status:SelfhostRealtimeStatus)=>void,
  onLive?:(event:SelfhostLiveEvent)=>void,
  presence?:{visible:boolean},
):SelfhostBoardChannel{
  let stopped=false,generation=0,attempt=0;
  let socket:WebSocket|null=null;
  let retry:ReturnType<typeof setTimeout>|undefined;
  let heartbeat:ReturnType<typeof setInterval>|undefined;
  let expiry:ReturnType<typeof setTimeout>|undefined;
  let responseDeadline:ReturnType<typeof setTimeout>|undefined;
  let lastVersion=-1;
  let ready=false;
  let compactInk=false;
  let durableInkCommits=false,commitSequence=0;
  const pendingCommits=new Map<string,{resolve:(value:{version:number})=>void;reject:(error:Error)=>void;timer:ReturnType<typeof setTimeout>}>();
  let lastCursorSent=0;
  let pendingCursor:{clientId:string;x:number;y:number}|null=null;
  let cursorTimer:ReturnType<typeof setTimeout>|undefined;
  let retryFinals:ReturnType<typeof setInterval>|undefined;
  const pendingFinals=new Map<string,{packet:SelfhostLiveInkPacket;lastSent:number;attempts:number}>();
  const queuedInk:SelfhostLiveInkPacket[]=[];
  let lastObjectSent=0;
  let pendingObject:SelfhostObjectPreview|null=null;
  let objectTimer:ReturnType<typeof setTimeout>|undefined;
  const sendRaw=(frame:Record<string,unknown>):boolean=>{
    if(!ready||!socket||socket.readyState!==WebSocket.OPEN)return false;
    try{
      const wire=compactInk&&(frame.type==="live_ink"||frame.type==="live_erase")&&Array.isArray(frame.points)
        ?{...frame,points:frame.points.map((point:SelfhostPoint)=>[point.x,point.y])}:frame;
      socket.send(JSON.stringify(wire));return true
    }
    catch{reconnect();return false}
  };
  const canCommitInk=()=>ready&&durableInkCommits&&socket?.readyState===WebSocket.OPEN;
  const commitInk=(request:InkCommitRequest):Promise<{version:number}>|null=>{
    if(!canCommitInk()||pendingCommits.size)return null;
    const request_id="ink_"+(++commitSequence);
    const wire=JSON.stringify({type:"ink_commit",request_id,...request});
    if(new TextEncoder().encode(wire).byteLength>56*1024)return null;
    // A previously queued hover must not overtake the committed ink cursor.
    clearTimeout(cursorTimer);cursorTimer=undefined;pendingCursor=null;
    return new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>{
        pendingCommits.delete(request_id);
        reject(new SelfhostHttpError(409,"Не получено подтверждение записи. Сверяем версию."));
        reconnect();
      },8000);
      pendingCommits.set(request_id,{resolve,reject,timer});
      try{socket!.send(wire)}catch{reconnect()}
    });
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
  const sendInkNow=(ink:SelfhostLiveInkPacket):boolean=>{
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
  const sendInk=(ink:SelfhostLiveInkPacket):boolean=>{
    if((ink.type!=="live_ink"&&ink.type!=="live_erase")||!Array.isArray(ink.points)||
       !ink.points.length||ink.points.length>200)return false;
    if(ready&&sendInkNow(ink))return true;
    if(queuedInk.length>=256)return false;
    queuedInk.push(ink);
    return true;
  };
  const flushObjectPreview=()=>{
    clearTimeout(objectTimer);objectTimer=undefined;
    const next=pendingObject;
    if(!next)return;
    if(sendRaw(next as unknown as Record<string,unknown>)){
      lastObjectSent=Date.now();pendingObject=null;
    }
  };
  const sendEvent=(event:Record<string,unknown>):boolean=>{
    if(typeof event.type!=="string"||!event.type)return false;
    let serialized="";
    try{serialized=JSON.stringify(event)}catch{return false}
    if(serialized.length>120_000)return false;
    if(!ready||!socket||socket.readyState!==WebSocket.OPEN)return false;
    try{socket.send(serialized);return true}catch{reconnect();return false}
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
    clearTimeout(retry);clearInterval(heartbeat);clearTimeout(expiry);clearTimeout(responseDeadline);
    retry=heartbeat=expiry=responseDeadline=undefined;
    clearTimeout(cursorTimer);cursorTimer=undefined;
    clearTimeout(objectTimer);objectTimer=undefined;pendingObject=null;
    clearInterval(retryFinals);retryFinals=undefined;
  };
  const closeSocket=()=>{
    ready=false;
    compactInk=false;durableInkCommits=false;
    for(const entry of pendingCommits.values()){
      clearTimeout(entry.timer);entry.reject(new SelfhostHttpError(409,"Соединение прервано. Сверяем версию доски."));
    }
    pendingCommits.clear();
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
    if(stopped||!navigator.onLine)return;
    const current=++generation;
    onStatus("reconnecting");
    try{
      const session=await selfhostSession();
      if(stopped||current!==generation)return;
      if(!session){
        if(loadSession())reconnect();
        else onStatus("offline");
        return;
      }
      const socketUrl=new URL(selfhostOrigin());
      socketUrl.protocol=socketUrl.protocol==="https:"?"wss:":"ws:";
      socketUrl.pathname="/api/v1/boards/"+encodeURIComponent(boardId)+"/events";
      const ws=new WebSocket(socketUrl.toString());
      socket=ws;
      const active=()=>!stopped&&generation===current&&socket===ws;
      responseDeadline=setTimeout(reconnect,15000);
      ws.onopen=()=>{
        if(!active())return;
        try{
          ws.send(JSON.stringify({
            type:"auth",token:session.access_token,compact_ink:true,document_patches:true,ink_point_deltas:true,durable_ink_commits:true,
            ...(presence?{presence:true,visible:presence.visible}:{}),
          }));
        }catch{reconnect();return}
        heartbeat=setInterval(()=>{
          if(active()&&sendRaw({type:"ping"})){
            clearTimeout(responseDeadline);
            responseDeadline=setTimeout(reconnect,8000);
          }
        },20000);
        expiry=setTimeout(reconnect,Math.max(1000,(session.expires_at-Date.now()/1000-60)*1000));
      };
      ws.onmessage=event=>{
        if(!active())return;
        try{
          const message=JSON.parse(String(event.data));
          if(message?.type==="plan_limit"){notifyPlanLimit(message);closeSocket();clearTimers();onStatus("offline");return;}
          if(message?.type==="pong"){
            clearTimeout(responseDeadline);responseDeadline=undefined;
          }
          if(message?.type==="ready"&&!ready){
            clearTimeout(responseDeadline);responseDeadline=undefined;
            compactInk=message.compact_ink===true;
            durableInkCommits=message.durable_ink_commits===true;
            attempt=0;ready=true;onStatus("online");
            // Final packets contain the full <=200-point stroke window in the
            // selfhost. Replay them if the socket died before the ack arrived.
            for(const item of pendingFinals.values()){
              if(sendRaw(item.packet as unknown as Record<string,unknown>)){
                item.lastSent=Date.now();item.attempts++;
              }
            }
            for(const packet of queuedInk.splice(0))sendInk(packet);
            if(!active())return;
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
            if(typeof message.client_id==="string"&&Number.isSafeInteger(message.offset)&&typeof message.finished==="boolean")
              onLive?.(message as SelfhostLiveEvent);
          }
          if(message?.type==="cursor"&&typeof message.client_id==="string"&&
             typeof message.user_id==="string"&&Number.isFinite(message.x)&&
             Number.isFinite(message.y)){
            onLive?.(message as SelfhostLiveEvent);
          }
          if((message?.type==="live_ink"||message?.type==="live_erase")&&typeof message.stroke_id==="string"&&
             Array.isArray(message.points)&&message.points.length<=200&&
             typeof message.user_id==="string"){
            if(message.type==="live_erase"&&(message.kind!=="eraser"||!Number.isFinite(message.weight)||message.weight<0.5||message.weight>1000))return;
            const points=message.points.map((point:unknown)=>Array.isArray(point)&&point.length===2
              ?{x:point[0],y:point[1]}:point);
            if(points.every((point:unknown)=>jsonObject(point)&&typeof point.x==="number"&&typeof point.y==="number"&&Number.isFinite(point.x)&&Number.isFinite(point.y)))
              onLive?.({...message,points} as SelfhostLiveEvent);
          }
          if(message?.type==="object_preview"&&
             typeof message.object_id==="string"&&typeof message.client_id==="string"&&
             typeof message.gesture_id==="string"&&typeof message.user_id==="string"&&
             Number.isSafeInteger(message.seq)&&Number.isSafeInteger(message.object_revision)&&
             Number.isFinite(message.x)&&Number.isFinite(message.y)){
            onLive?.(message as SelfhostRemoteObjectPreview);
          }
          if(message?.type==="presence_state"&&Array.isArray(message.users)){
            const users=message.users.filter((user:unknown)=>
              !!user&&typeof user==="object"&&
              typeof (user as Record<string,unknown>).user_id==="string"&&
              typeof (user as Record<string,unknown>).name==="string"&&
              ["owner","editor","viewer"].includes(String((user as Record<string,unknown>).role)));
            onLive?.({type:"presence_state",users} as SelfhostLiveEvent);
          }
          if(message?.type==="presence_diff"&&Array.isArray(message.joins)&&Array.isArray(message.leaves)){
            const valid=(user:unknown)=>!!user&&typeof user==="object"&&
              typeof (user as Record<string,unknown>).user_id==="string"&&
              typeof (user as Record<string,unknown>).name==="string"&&
              ["owner","editor","viewer"].includes(String((user as Record<string,unknown>).role));
            onLive?.({
              type:"presence_diff",joins:message.joins.filter(valid),
              leaves:message.leaves.filter(valid),
            } as SelfhostLiveEvent);
          }
          const relayedTypes=["work_state","editor_mutation","object_transform","focus_view",
            "teacher_view","guided_follow","attachment_request","attachment_result"];
          if(relayedTypes.includes(String(message?.type))&&typeof message.user_id==="string"&&
             typeof message.name==="string"&&
             ["owner","editor","viewer"].includes(String(message.role))){
            onLive?.(message as SelfhostLiveEvent);
          }
          if(message?.type==="event_error"&&typeof message.reason==="string"){
            onLive?.(message as SelfhostLiveEvent);
          }
          if(!ready)return;
          if(message?.type==="ink_commit_ack"){
            const entry=pendingCommits.get(message.request_id);
            if(!entry)return;
            clearTimeout(entry.timer);pendingCommits.delete(message.request_id);
            if(Number.isSafeInteger(message.version)&&message.version>0)entry.resolve({version:message.version});
            else{
              const detail=message.detail;
              if(jsonObject(detail)&&detail.code==="plan_limit")notifyPlanLimit({resource:typeof detail.resource==="string"?detail.resource:undefined,message:typeof detail.message==="string"?detail.message:undefined});
              entry.reject(new SelfhostHttpError(Number.isInteger(message.status)?message.status:500,
                typeof detail==="string"?detail:typeof detail?.message==="string"?detail.message:"Ошибка записи штриха",
                jsonObject(detail)&&typeof detail.code==="string"?detail.code:undefined));
            }
            return;
          }
          if(message?.type==="comments_changed")onLive?.({type:"comments_changed"});
          if(message?.type==="ready"||message?.type==="document_changed"||message?.type==="pong"){
            const version=message.version;
            if(Number.isSafeInteger(version)&&version>=0&&version>lastVersion){
              lastVersion=version;
              const patch=message.type==="document_changed"&&message.base_version===version-1&&
                jsonObject(message.delta)&&typeof message.updated_at==="string"&&typeof message.updated_by==="string"
                ?{base_version:message.base_version,delta:message.delta as DocumentDelta,
                  updated_at:message.updated_at,updated_by:message.updated_by,
                  ...(jsonObject(message.ink_cursor)&&message.ink_cursor.type==="cursor"&&typeof message.ink_cursor.user_id==="string"&&
                    Number.isFinite(message.ink_cursor.x)&&Number.isFinite(message.ink_cursor.y)?{ink_cursor:message.ink_cursor as SelfhostCommittedCursor}:{})}:undefined;
              onRevision(version,patch);
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
    pendingFinals.clear();queuedInk.length=0;pendingCursor=null;
    window.removeEventListener("online",networkChanged);
    window.removeEventListener("offline",networkChanged);
  };
  return Object.assign(stop,{canCommitInk,commitInk,sendCursor,sendInk,sendObjectPreview,sendEvent});
}


type BoardListener={
  onRevision:(version:number,patch?:RevisionPatch)=>void;
  onStatus:(status:SelfhostRealtimeStatus)=>void;
  onLive?:(event:SelfhostLiveEvent)=>void;
  presence?:{visible:boolean};
};

class SharedSelfhostBoard {
  private listeners=new Set<BoardListener>();
  private socket?:SelfhostBoardChannel;
  private presence?:boolean;
  private version=-1;
  private status:SelfhostRealtimeStatus="reconnecting";
  private reconcileQueued=false;

  constructor(boardId:string,onEmpty:()=>void){
    this.boardId=boardId;
    this.onEmpty=onEmpty;
  }

  private readonly boardId:string;
  private readonly onEmpty:()=>void;

  private reconcile(){
    if(this.reconcileQueued)return;
    this.reconcileQueued=true;
    queueMicrotask(()=>{
      this.reconcileQueued=false;
      if(!this.listeners.size){
        this.socket?.();
        this.socket=undefined;
        this.onEmpty();
        return;
      }
      const presence=[...this.listeners].find(listener=>listener.presence)?.presence;
      if(this.socket&&this.presence===presence?.visible)return;
      this.socket?.();
      this.presence=presence?.visible;
      this.socket=connectSelfhostBoard(this.boardId,(version,patch)=>{
        if(version<=this.version)return;
        this.version=version;
        for(const listener of this.listeners)listener.onRevision(version,patch);
      },status=>{
        this.status=status;
        for(const listener of this.listeners)listener.onStatus(status);
      },event=>{
        for(const listener of this.listeners)listener.onLive?.(event);
      },presence);
    });
  }

  canCommitInk(){return !!this.socket?.canCommitInk()}
  commitInk(request:InkCommitRequest){return this.socket?.commitInk(request)??null}
  sendCursor(cursor:InkCommitCursor){return this.socket?.sendCursor(cursor.client_id,cursor.x,cursor.y)??false}
  subscribe(listener:BoardListener):SelfhostBoardChannel{
    this.listeners.add(listener);
    this.reconcile();
    queueMicrotask(()=>{
      if(!this.listeners.has(listener))return;
      if(this.status==="online")listener.onStatus("online");
      if(this.version>=0)listener.onRevision(this.version);
    });
    const stop=()=>{
      this.listeners.delete(listener);
      this.reconcile();
    };
    return Object.assign(stop,{
      canCommitInk:()=>this.listeners.has(listener)&&this.canCommitInk(),
      commitInk:(request:InkCommitRequest)=>this.listeners.has(listener)?this.commitInk(request):null,
      sendCursor:(id:string,x:number,y:number)=>this.listeners.has(listener)&&!!this.socket?.sendCursor(id,x,y),
      sendInk:(ink:SelfhostLiveInkPacket)=>this.listeners.has(listener)&&!!this.socket?.sendInk(ink),
      sendObjectPreview:(preview:SelfhostObjectPreview)=>this.listeners.has(listener)&&!!this.socket?.sendObjectPreview(preview),
      sendEvent:(event:Record<string,unknown>)=>this.listeners.has(listener)&&!!this.socket?.sendEvent(event),
    });
  }
}

const selfhostBoardSockets=new Map<string,SharedSelfhostBoard>();

export function selfhostSubscribeBoard(
  boardId:string,onRevision:BoardListener["onRevision"],onStatus:BoardListener["onStatus"],
  onLive?:BoardListener["onLive"],presence?:BoardListener["presence"],
):SelfhostBoardChannel{
  let shared=selfhostBoardSockets.get(boardId);
  if(!shared){
    shared=new SharedSelfhostBoard(boardId,()=>selfhostBoardSockets.delete(boardId));
    selfhostBoardSockets.set(boardId,shared);
  }
  return shared.subscribe({onRevision,onStatus,onLive,presence});
}

/** Download only the latest announced revision and retry failed reads. */
export function selfhostWatchDocument(
  boardId:string,currentVersion:()=>number,onDocument:(row:SelfhostDocument)=>void,
  onStatus:(status:SelfhostRealtimeStatus)=>void,
):()=>void{
  const controller=new AbortController();
  let target=-1;
  let delivered=-1;
  let timer:ReturnType<typeof setTimeout>|undefined;
  let reading=false;
  let failures=0;
  let status:SelfhostRealtimeStatus="reconnecting";
  let pollTimer:ReturnType<typeof setTimeout>|undefined;
  let accessDenied=false;
  const committedCursors=new Map<string,{version:number;cursor:SelfhostCommittedCursor}>();
  const attachCursors=(row:SelfhostDocument):SelfhostDocument=>{
    const cursors:SelfhostCommittedCursor[]=[];
    for(const [id,entry] of committedCursors){if(entry.version<=row.version){cursors.push(entry.cursor);committedCursors.delete(id)}}
    return cursors.length?{...row,ink_cursors:cursors}:row;
  };
  const schedule=()=>{
    if(controller.signal.aborted||accessDenied||reading||timer!==undefined||
       target<=Math.max(currentVersion(),delivered))return;
    timer=setTimeout(()=>{timer=undefined;void read()},failures?Math.min(8000,500*2**failures):0);
  };
  const read=async()=>{
    if(controller.signal.aborted||accessDenied||target<=Math.max(currentVersion(),delivered))return;
    reading=true;
    try{
      const row=await selfhostReadDocument(boardId,controller.signal,true);
      if(controller.signal.aborted)return;
      if(row.document&&row.version>Math.max(currentVersion(),delivered))onDocument(attachCursors(row));
      delivered=Math.max(delivered,row.version);
      failures=row.version<target?Math.min(failures+1,5):0;
      if(!failures)onStatus(status);
    }catch(error){
      if(controller.signal.aborted)return;
      if(error instanceof SelfhostHttpError&&[401,403,404].includes(error.status)){
        delivered=target;
        accessDenied=true;
        onStatus("offline");
        return;
      }
      failures=Math.min(failures+1,5);
      if(status==="online")onStatus("reconnecting");
    }finally{
      reading=false;
      schedule();
    }
  };
  // If a proxy/VPN drops WebSocket handshakes, saved work must still arrive.
  // Poll only the small revision value, and only while WS is disconnected.
  const schedulePoll=()=>{
    clearTimeout(pollTimer);pollTimer=undefined;
    if(controller.signal.aborted||accessDenied||status==="online")return;
    pollTimer=setTimeout(async()=>{
      pollTimer=undefined;
      if(controller.signal.aborted||accessDenied||status==="online")return;
      try{
        const row=await selfhostReadDocumentVersion(boardId,controller.signal);
        if(controller.signal.aborted)return;
        if(Number.isSafeInteger(row.version)&&row.version>=0){
          target=Math.max(target,row.version);schedule();
        }
      }catch(error){
        if(error instanceof SelfhostHttpError&&[401,403,404].includes(error.status)){
          accessDenied=true;onStatus("offline");
        }
      }finally{schedulePoll()}
    },typeof document!=="undefined"&&document.hidden?10000:2500);
  };
  const socket=selfhostSubscribeBoard(boardId,(version,patch)=>{
    target=Math.max(target,version);
    if(patch?.ink_cursor&&version>Math.max(currentVersion(),delivered))committedCursors.set(patch.ink_cursor.user_id,{version,cursor:patch.ink_cursor});
    if(!controller.signal.aborted&&!accessDenied&&patch&&version>Math.max(currentVersion(),delivered)){
      const userId=loadSession()?.user.id;
      const base=documentBase;
      if(base&&base.boardId===boardId&&base.userId===userId&&base.version===patch.base_version){
        try{
          const next=applySelfhostDocumentDelta(base.document,patch.delta);
          const row:SelfhostDocument={board_id:boardId,version,document:next,
            updated_at:patch.updated_at,updated_by:patch.updated_by};
          rememberDocument(boardId,userId,version,next);
          onDocument(attachCursors(row));
          delivered=version;
          failures=0;
        }catch{/* A missed or invalid patch falls back to the versioned read. */}
      }
    }
    schedule();
  },next=>{
    const wasOnline=status==="online";
    status=next;
    if(next==="online")accessDenied=false;
    if(!wasOnline&&next==="online"){
      failures=0;
      clearTimeout(timer);timer=undefined;
      schedule();
    }
    onStatus(next);
    if(next==="online"){clearTimeout(pollTimer);pollTimer=undefined}
    else if(pollTimer===undefined)schedulePoll();
  });
  schedulePoll();
  return ()=>{
    controller.abort();
    clearTimeout(timer);clearTimeout(pollTimer);
    socket();
  };
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
export const selfhostChangeMemberRole = (boardId:string,memberId:string,role:"editor"|"viewer",participant_role?:InvitedParticipantRole) =>
  selfhostRequest<{ok:boolean;role:string}>(
    "/api/v1/boards/"+encodeURIComponent(boardId)+"/members/"+encodeURIComponent(memberId),{
      method:"PATCH",body:JSON.stringify({role,participant_role}),
    });
export const selfhostRemoveMember = (boardId:string,memberId:string) =>
  selfhostRequest<void>(
    "/api/v1/boards/"+encodeURIComponent(boardId)+"/members/"+encodeURIComponent(memberId),
    {method:"DELETE"});
export const selfhostRevokeInvitation = (boardId:string,inviteId:string) =>
  selfhostRequest<void>(
    "/api/v1/boards/"+encodeURIComponent(boardId)+"/invitations/"+encodeURIComponent(inviteId),
    {method:"DELETE"});


// Native education workflows: these endpoints replace the corresponding
// Supabase tables/RPCs in the standard application.
export const selfhostStudents=()=>selfhostRequest<any[]>("/api/v1/students");
export const selfhostSaveStudentProfile=(studentId:string,payload:{note?:string;tags?:string[]})=>
  selfhostRequest<{ok:boolean}>("/api/v1/students/"+encodeURIComponent(studentId)+"/profile",{
    method:"PUT",body:JSON.stringify(payload),
  });
export const selfhostStudentSessions=(studentId:string)=>
  selfhostRequest<any[]>("/api/v1/students/"+encodeURIComponent(studentId)+"/sessions");
export const selfhostSaveStudentSession=(session:{
  id:string;studentId:string;boardId:string;date:string;durationMinutes:number;
  topic:string;homework:string;result:string;
})=>selfhostRequest<{ok:boolean}>("/api/v1/student-sessions/"+encodeURIComponent(session.id),{
  method:"PUT",body:JSON.stringify({
    id:session.id,student_id:session.studentId,board_id:session.boardId||null,
    date:session.date,duration_minutes:session.durationMinutes,topic:session.topic,
    homework:session.homework,result:session.result,
  }),
});
export const selfhostDeleteStudentSession=(id:string)=>
  selfhostRequest<void>("/api/v1/student-sessions/"+encodeURIComponent(id),{method:"DELETE"});

export const selfhostAssignments=()=>selfhostRequest<any[]>("/api/v1/assignments");
export const selfhostCreateAssignment=(assignment:{
  id:string;studentId:string;boardId:string;title:string;description:string;
  dueAt:string|null;maxScore:number;
})=>selfhostRequest<{ok:boolean;id:string}>("/api/v1/assignments",{
  method:"POST",body:JSON.stringify({
    id:assignment.id,student_id:assignment.studentId,board_id:assignment.boardId||null,
    title:assignment.title,description:assignment.description,due_at:assignment.dueAt,
    max_score:assignment.maxScore,
  }),
});
export const selfhostDeleteAssignment=(id:string)=>
  selfhostRequest<void>("/api/v1/assignments/"+encodeURIComponent(id),{method:"DELETE"});
export const selfhostSubmitAssignment=(id:string,content:string)=>
  selfhostRequest<{ok:boolean}>("/api/v1/assignments/"+encodeURIComponent(id)+"/submit",{
    method:"POST",body:JSON.stringify({content}),
  });
export const selfhostReviewAssignment=(id:string,score:number|null,feedback:string)=>
  selfhostRequest<{ok:boolean}>("/api/v1/assignments/"+encodeURIComponent(id)+"/review",{
    method:"POST",body:JSON.stringify({score,feedback}),
  });

export const selfhostSchedule=()=>selfhostRequest<any[]>("/api/v1/schedule");
export const selfhostCreateSchedule=(items:Array<{
  id:string;studentId:string;boardId:string;title:string;startsAt:string;
  durationMinutes:number;recurrence:"none"|"weekly";recurrenceGroupId:string|null;note:string;
}>)=>selfhostRequest<{ok:boolean;created:number}>("/api/v1/schedule",{
  method:"POST",body:JSON.stringify({items:items.map(item=>({
    id:item.id,student_id:item.studentId,board_id:item.boardId||null,
    title:item.title,starts_at:item.startsAt,duration_minutes:item.durationMinutes,
    recurrence:item.recurrence,recurrence_group_id:item.recurrenceGroupId,note:item.note,
    status:"planned",
  }))}),
});
export const selfhostUpdateSchedule=(id:string,patch:Record<string,unknown>)=>
  selfhostRequest<{ok:boolean}>("/api/v1/schedule/"+encodeURIComponent(id),{
    method:"PATCH",body:JSON.stringify(patch),
  });
export const selfhostDeleteSchedule=(id:string,series=false,groupId:string|null=null)=>
  selfhostRequest<void>("/api/v1/schedule/"+encodeURIComponent(id)+
    (series&&groupId?"?series=true&group_id="+encodeURIComponent(groupId):""),{method:"DELETE"});
export const selfhostMarkScheduleStarted=(id:string)=>
  selfhostRequest<{ok:boolean}>("/api/v1/schedule/"+encodeURIComponent(id)+"/start",{method:"POST",body:"{}"});
export const selfhostCompleteSchedule=(id:string)=>
  selfhostRequest<{ok:boolean}>("/api/v1/schedule/"+encodeURIComponent(id)+"/complete",{method:"POST",body:"{}"});

export const selfhostActiveLesson=(boardId:string)=>
  selfhostRequest<any|null>("/api/v1/boards/"+encodeURIComponent(boardId)+"/lessons/active");
export const selfhostStartLesson=(boardId:string,studentId:string,topic:string,scheduleId?:string|null)=>
  selfhostRequest<any>("/api/v1/boards/"+encodeURIComponent(boardId)+"/lessons",{
    method:"POST",body:JSON.stringify({student_id:studentId,topic,schedule_id:scheduleId||null}),
  });
export const selfhostFinishLesson=(lessonId:string,result:string,homework:string)=>
  selfhostRequest<{ok:boolean;minutes:number}>("/api/v1/lessons/"+encodeURIComponent(lessonId)+"/finish",{
    method:"POST",body:JSON.stringify({result,homework}),
  });
