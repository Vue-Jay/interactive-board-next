import {useCallback,useEffect,useLayoutEffect,useRef,useState,type ReactNode} from "react";
import {createPortal} from "react-dom";
import {cachedSelfhostSession,isSelfhostBackendEnabled,selfhostMaintenanceStatus,selfhostLogout,type MaintenanceStatus} from "./selfhostApi";
import {LEKTRUS_LOCAL_TEST_MODE} from "./lektrusLocalTestMode";
import {ServiceUnavailableScreen} from "./ServiceUnavailableScreen";
import "./lektrusMaintenance.css";

const enabled=()=>isSelfhostBackendEnabled()&&!LEKTRUS_LOCAL_TEST_MODE;
const accountId=()=>cachedSelfhostSession()?.user.id??null;
const format=(value:string)=>new Intl.DateTimeFormat("ru-RU",{day:"numeric",month:"long",hour:"2-digit",minute:"2-digit"}).format(new Date(value));
export function maintenanceTime(status:MaintenanceStatus){
  if(status.state==="scheduled"&&status.starts_at)return "Начало: "+format(status.starts_at)+(status.ends_at?" · Окончание: "+format(status.ends_at):"");
  return status.ends_at?"Ожидаемое окончание: "+format(status.ends_at):"О завершении сообщим здесь.";
}
function useMaintenance(authenticated:boolean){
  const [snapshot,setSnapshot]=useState<{status:MaintenanceStatus;account:string|null}|null>(null);
  const [ready,setReady]=useState(!enabled());
  const [checking,setChecking]=useState(false);
  const [identity,setIdentity]=useState(accountId);
  const inFlight=useRef(false),pending=useRef(false),alive=useRef(true),last=useRef(0);
  const refresh=useCallback(async()=>{
    if(!enabled())return;
    if(inFlight.current){pending.current=true;return;}
    inFlight.current=true;setChecking(true);
    do{
      pending.current=false;
      const id=authenticated?accountId():null;
      try{
        const status=await selfhostMaintenanceStatus(authenticated);
        if(alive.current&&(!authenticated||id===accountId()))setSnapshot({status,account:id});
      }catch{/* Last known policy remains visible during temporary loss of network. */}
      last.current=Date.now();
    }while(pending.current&&alive.current);
    inFlight.current=false;
    if(alive.current){setReady(true);setChecking(false);}
  },[authenticated]);
  useEffect(()=>{
    alive.current=true;
    if(!enabled())return;
    void refresh();
    const timer=window.setInterval(()=>{if(document.visibilityState!=="hidden")void refresh()},30000);
    const resume=()=>{if(document.visibilityState!=="hidden")void refresh()};
    const session=()=>{setIdentity(accountId());void refresh()};
    const failure=()=>{if(Date.now()-last.current>1000&&!inFlight.current)void refresh()};
    window.addEventListener("online",resume);window.addEventListener("focus",resume);
    document.addEventListener("visibilitychange",resume);
    window.addEventListener("lektrus:maintenance-changed",resume);
    if(authenticated){
      window.addEventListener("lektrus:session-changed",session);
      window.addEventListener("storage",session);
      window.addEventListener("lektrus:service-request-failed",failure);
    }
    return ()=>{
      alive.current=false;window.clearInterval(timer);
      window.removeEventListener("online",resume);window.removeEventListener("focus",resume);
      document.removeEventListener("visibilitychange",resume);
      window.removeEventListener("lektrus:maintenance-changed",resume);
      window.removeEventListener("lektrus:session-changed",session);
      window.removeEventListener("storage",session);
      window.removeEventListener("lektrus:service-request-failed",failure);
    };
  },[authenticated,refresh]);
  useEffect(()=>{
    const value=snapshot?.status;
    const boundary=value?.state==="scheduled"?value.starts_at:value?.state==="active"?value.ends_at:null;
    if(!boundary||!value)return;
    const delay=new Date(boundary).getTime()-new Date(value.server_time).getTime();
    if(delay<=0||delay>2147483000)return;
    const timer=window.setTimeout(()=>void refresh(),delay+250);
    return ()=>window.clearTimeout(timer);
  },[snapshot,refresh]);
  return {status:snapshot?.status,verified:!authenticated||snapshot?.account===identity,identity,ready,checking,refresh};
}
function Notice({status,app=false,allowed=false}:{status:MaintenanceStatus;app?:boolean;allowed?:boolean}){
  const [dismissed,setDismissed]=useState("");
  const key=status.state+status.starts_at+status.ends_at+status.notice;
  if(status.state==="off"||dismissed===key)return null;
  return <aside className={"maintenance-notice"+(app?" maintenance-notice-app":"")} aria-label="Технические работы" role="status">
    <span className="maintenance-notice-icon" aria-hidden="true">!</span>
    <div><strong>{status.state==="scheduled"?"Запланированы технические работы":"Ведутся технические работы"}{allowed?" · У вас есть доступ":""}</strong>
      <span>{maintenanceTime(status)}{status.notice?" · "+status.notice:""}</span></div>
    {app&&<button type="button" aria-label="Скрыть уведомление" onClick={()=>setDismissed(key)}>×</button>}
  </aside>;
}
export function PublicMaintenanceNotice(){
  const {status}=useMaintenance(false);
  return status?<Notice status={status}/>:null;
}
export function MaintenanceGate({children}:{children:ReactNode}){
  const {status,verified,identity,ready,checking,refresh}=useMaintenance(true);
  const [login,setLogin]=useState(false);
  const everMounted=useRef(false);
  const restricted=status?.state==="active"&&(!verified||!status.access_allowed);
  const blocked=restricted&&!(login&&!identity);
  if(ready&&!blocked)everMounted.current=true;
  useLayoutEffect(()=>{
    const root=document.getElementById("root");
    if(!root)return;
    root.toggleAttribute("inert",!!blocked);
    if(blocked)root.setAttribute("aria-hidden","true");else root.removeAttribute("aria-hidden");
    return ()=>{root.removeAttribute("inert");root.removeAttribute("aria-hidden");};
  },[blocked]);
  const switchAccount=async()=>{
    if(identity){await selfhostLogout();window.location.assign("/app");}
    else setLogin(true);
  };
  return <>
    {everMounted.current&&children}
    {!ready&&<div className="maintenance-checking" role="status" aria-label="Проверяем доступность Lektrus"><span/></div>}
    {blocked&&status&&createPortal(<div className="maintenance-blocking">
      <ServiceUnavailableScreen reason="maintenance" checking={checking} automatic onRetry={()=>void refresh()} maintenanceMessage={(status.notice?status.notice+" ":"Проводим обслуживание Lektrus, чтобы сервис работал стабильнее. ")+maintenanceTime(status)} onSignIn={()=>void switchAccount()} signInLabel={identity?"Войти в другой аккаунт":"Войти с разрешённым аккаунтом"}/>
    </div>,document.body)}
    {!blocked&&status&&status.state!=="off"&&createPortal(<Notice status={status} app allowed={status.state==="active"&&!!identity&&verified&&status.access_allowed}/>,document.body)}
  </>;
}
