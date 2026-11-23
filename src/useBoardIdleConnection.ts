import {useEffect,useRef,useState} from "react";

/** A mounted board stays visible locally, but idle viewers need no realtime
 * sockets or revision polling. Save completion is checked by the caller before
 * putting subscriptions to sleep. A resumed subscriber reads missed versions. */
export const BOARD_IDLE_MS=5*60*1000;
export const BOARD_HIDDEN_IDLE_MS=60*1000;
export const BOARD_IDLE_BUSY_RECHECK_MS=3000;

export function boardNextIdleDelay(
 now:number,lastActionAt:number,hiddenSince:number|null
):number{
 const until=Math.min(lastActionAt+BOARD_IDLE_MS,
  hiddenSince===null?Number.POSITIVE_INFINITY:hiddenSince+BOARD_HIDDEN_IDLE_MS);
 return Math.max(0,until-now);
}

export function useBoardIdleConnection(
 enabled:boolean,canSleep:()=>boolean
):boolean{
 const [awake,setAwake]=useState(true);
 const awakeRef=useRef(true);
 const canSleepRef=useRef(canSleep);
 canSleepRef.current=canSleep;
 useEffect(()=>{
  if(!enabled)return;
  let lastAction=Date.now();
  let hiddenSince:number|null=document.hidden?Date.now():null;
  let timer:ReturnType<typeof setTimeout>|undefined;
  const clear=()=>{if(timer!==undefined)clearTimeout(timer);timer=undefined;};
  const check=()=>{
   clear();
   if(!awakeRef.current)return;
   const delay=boardNextIdleDelay(Date.now(),lastAction,hiddenSince);
   if(delay>0){timer=setTimeout(check,Math.max(10,delay));return;}
   if(!canSleepRef.current()){
    // Never close a connection while an edit/save/attachment is unfinished.
    timer=setTimeout(check,BOARD_IDLE_BUSY_RECHECK_MS);
    return;
   }
   awakeRef.current=false;
   setAwake(false);
  };
  const activity=(event:Event)=>{
   // Reconnect on a real action, not every mouse hover or automatic reflow.
   lastAction=Date.now();
   if(!awakeRef.current){
    awakeRef.current=true;
    setAwake(true);
    // First gesture only wakes the session. Do not make a stale-board edit
    // before the new document revision has arrived from the server.
    if(event.cancelable)event.preventDefault();
    event.stopPropagation();
   }
   check();
  };
  const move=(event:PointerEvent)=>{
   if(event.buttons)activity(event);
  };
  const visibility=()=>{
   hiddenSince=document.hidden?Date.now():null;
   // Returning to a sleeping tab does NOT silently reconnect.
   check();
  };
  const online=()=>{
   // Connectivity coming back alone is not a reason to wake an idle board.
   if(awakeRef.current)check();
  };
  const events=["pointerdown","pointerup","keydown","wheel","input"] as const;
  for(const name of events)
   window.addEventListener(name,activity,{capture:true,passive:false});
  window.addEventListener("pointermove",move,{capture:true,passive:true});
  document.addEventListener("visibilitychange",visibility);
  window.addEventListener("online",online);
  check();
  return()=>{
   clear();
   for(const name of events)window.removeEventListener(name,activity,true);
   window.removeEventListener("pointermove",move,true);
   document.removeEventListener("visibilitychange",visibility);
   window.removeEventListener("online",online);
  };
 },[enabled]);
 return enabled?awake:true;
}
