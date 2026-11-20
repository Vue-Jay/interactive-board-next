import {useEffect,useRef,useState} from "react";
import {Capacitor} from "@capacitor/core";
import {App as CapacitorApp} from "@capacitor/app";
import {selfhostServiceHealthy} from "./selfhostApi";
import type {UnavailableReason} from "./ServiceUnavailableScreen";

const RETRY_MS=15_000;
const RESUME_MS=60_000;

export function useServiceAvailability(enabled:boolean,preserveView=false){
  const [reason,setReason]=useState<UnavailableReason|null>(null);
  const [checking,setChecking]=useState(false);
  const retry=useRef<()=>void>(()=>{});
  const enabledRef=useRef(enabled);enabledRef.current=enabled;
  useEffect(()=>{
    setReason(null);setChecking(false);
    if(!enabled)return;
    let alive=true,inFlight=false,unavailable=false,lastCheck=0,lastFailureCheck=0;
    let timer:ReturnType<typeof setTimeout>|undefined;
    const mark=(next:UnavailableReason)=>{
      unavailable=true;setReason(next);
      clearTimeout(timer);
      if(document.visibilityState==="visible")timer=setTimeout(()=>void check(),RETRY_MS);
    };
    const check=async()=>{
      if(!alive||!enabledRef.current||inFlight)return;
      clearTimeout(timer);
      if(navigator.onLine===false){mark("offline");return}
      inFlight=true;lastCheck=Date.now();setChecking(true);
      try{
        const healthy=await selfhostServiceHealthy();
        if(!alive||!enabledRef.current)return;
        if(!healthy||!navigator.onLine)mark(!navigator.onLine?"offline":"server");
        else if(unavailable&&!preserveView){
          // A full navigation restores failed reads, exact deep links and the
          // existing persisted session. This hook is disabled on open boards.
          window.location.reload();
        }else {unavailable=false;setReason(null);}
      }finally{
        inFlight=false;
        if(alive)setChecking(false);
      }
    };
    retry.current=()=>void check();
    const failure=()=>{
      // Only the public health endpoint can promote a request error to a
      // service-wide outage. Bad credentials, 404s and isolated errors stay local.
      if(Date.now()-lastFailureCheck<3000)return;
      lastFailureCheck=Date.now();void check();
    };
    const resume=()=>{
      if(document.visibilityState==="visible"&&(unavailable||Date.now()-lastCheck>=RESUME_MS))void check();
    };
    const online=()=>void check();
    const offline=()=>{if(alive)mark("offline")};
    window.addEventListener("lektrus:service-request-failed",failure);
    window.addEventListener("online",online);
    window.addEventListener("offline",offline);
    window.addEventListener("focus",resume);
    document.addEventListener("visibilitychange",resume);
    const listener=Capacitor.isNativePlatform()?CapacitorApp.addListener("appStateChange",({isActive})=>{if(isActive)resume()}):null;
    void listener?.catch(()=>{});
    void check();
    return ()=>{
      alive=false;clearTimeout(timer);retry.current=()=>{};
      window.removeEventListener("lektrus:service-request-failed",failure);
      window.removeEventListener("online",online);window.removeEventListener("offline",offline);
      window.removeEventListener("focus",resume);document.removeEventListener("visibilitychange",resume);
      void listener?.then(handle=>handle.remove()).catch(()=>{});
    };
  },[enabled,preserveView]);
  return {reason:enabled?reason:null,checking,check:()=>retry.current()};
}
