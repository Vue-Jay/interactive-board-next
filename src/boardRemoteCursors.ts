import type { RemoteCursor } from "./boardBroadcast";
import type { RemoteInkScheduler } from "./boardLiveInk";

const CURSOR_TTL=12_000;
const FRAME_FALLBACK=50;
const browserScheduler:RemoteInkScheduler={
  now:()=>Date.now(),requestFrame:callback=>requestAnimationFrame(callback),
  cancelFrame:id=>cancelAnimationFrame(id),
  setTimer:(callback,delay)=>window.setTimeout(callback,delay),clearTimer:id=>window.clearTimeout(id),
};

/** Cursor movement is ephemeral, independent of the document and its React
 * render. Keep only the last position per participant in a frame and expire
 * by local receipt time, independent of clock skew between participants. */
export function createRemoteCursorStore(scheduler:RemoteInkScheduler=browserScheduler){
  let snapshot:ReadonlyMap<string,RemoteCursor>=new Map();
  const pending=new Map<string,RemoteCursor>();
  const deadlines=new Map<string,number>();
  const subscribers=new Set<()=>void>();
  let frame:number|undefined,fallback:number|undefined,expiry:number|undefined;
  const publish=()=>{for(const subscriber of subscribers)subscriber()};
  const cancelFrame=()=>{
    if(frame!==undefined)scheduler.cancelFrame(frame);
    if(fallback!==undefined)scheduler.clearTimer(fallback);
    frame=fallback=undefined;
  };
  const flush=()=>{
    cancelFrame();
    if(!pending.size)return;
    const next=new Map(snapshot);
    for(const [id,cursor] of pending)next.set(id,cursor);
    pending.clear();snapshot=next;publish();
  };
  const remove=(ids:Iterable<string>)=>{
    let next:Map<string,RemoteCursor>|undefined;
    for(const id of ids){
      pending.delete(id);deadlines.delete(id);
      if(snapshot.has(id)){next??=new Map(snapshot);next.delete(id)}
    }
    if(!pending.size)cancelFrame();
    if(!deadlines.size&&expiry!==undefined){scheduler.clearTimer(expiry);expiry=undefined}
    if(next){snapshot=next;publish()}
  };
  const scheduleExpiry=()=>{
    if(expiry!==undefined||!deadlines.size)return;
    let earliest=Infinity;
    for(const value of deadlines.values())earliest=Math.min(earliest,value);
    expiry=scheduler.setTimer(()=>{
      expiry=undefined;
      const now=scheduler.now();
      remove([...deadlines].filter(([,deadline])=>deadline<=now).map(([id])=>id));
      scheduleExpiry();
    },Math.max(0,earliest-scheduler.now()));
  };
  return {
    getSnapshot:()=>snapshot,
    getCount:()=>snapshot.size,
    subscribe:(subscriber:()=>void)=>{
      subscribers.add(subscriber);return()=>{subscribers.delete(subscriber)};
    },
    push:(cursor:RemoteCursor)=>{
      deadlines.set(cursor.userId,scheduler.now()+CURSOR_TTL);scheduleExpiry();
      const old=pending.get(cursor.userId)??snapshot.get(cursor.userId);
      if(old&&old.x===cursor.x&&old.y===cursor.y&&old.name===cursor.name&&old.role===cursor.role)return;
      pending.set(cursor.userId,cursor);
      if(frame===undefined){
        frame=scheduler.requestFrame(flush);fallback=scheduler.setTimer(flush,FRAME_FALLBACK);
      }
    },
    retainOnline:(online:ReadonlySet<string>)=>remove([...deadlines.keys()].filter(id=>!online.has(id))),
    reset:()=>{
      cancelFrame();if(expiry!==undefined)scheduler.clearTimer(expiry);expiry=undefined;
      pending.clear();deadlines.clear();
      if(snapshot.size){snapshot=new Map();publish()}
    },
  };
}
export type RemoteCursorStore=ReturnType<typeof createRemoteCursorStore>;
