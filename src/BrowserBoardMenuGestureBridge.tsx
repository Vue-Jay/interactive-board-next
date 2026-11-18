import { useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type RefObject } from "react";

type Surface={menu:HTMLElement;left:number;top:number;width:number;height:number};
const SELECTOR=".topbar-more-menu[open] > .topbar-more-popover";
const ACTION="button,a,summary,[role=button]";

/** A portrait browser can handle a physical horizontal swipe before a rotated
 * iframe receives its first event. Put just the overflow menu's touch surface
 * in the untransformed parent and convert the gesture into logical scrolling.
 * The child remains the sole owner of the menu, its state and action controls. */
export function BrowserBoardMenuGestureBridge({frame,area,enabled}:{frame:RefObject<HTMLIFrameElement|null>;area:RefObject<HTMLDivElement|null>;enabled:boolean}){
 const [surface,setSurface]=useState<Surface|null>(null);
 const overlay=useRef<HTMLDivElement>(null);
 const drag=useRef<{menu:HTMLElement;source:"pointer"|"touch";id:number;x:number;y:number;scroll:number;target:HTMLElement|null;moved:boolean}|null>(null);
 useLayoutEffect(()=>{
  if(!enabled){setSurface(null);drag.current=null;return;}
  const iframe=frame.current,region=area.current;
  if(!iframe||!region)return;
  let observer:MutationObserver|undefined,resize:ResizeObserver|undefined,observed:HTMLElement|null=null,raf=0;
  const update=()=>{
   const menu=iframe.contentDocument?.querySelector<HTMLElement>(SELECTOR)??null;
   if(menu!==observed){if(observed)resize?.unobserve(observed);observed=menu;if(menu)resize?.observe(menu);}
   if(!menu||menu.scrollHeight<=menu.clientHeight){setSurface(null);drag.current=null;return;}
   const logical=menu.getBoundingClientRect(),physical=iframe.getBoundingClientRect(),container=region.getBoundingClientRect();
   const left=Math.max(0,physical.right-logical.bottom-container.left),top=Math.max(0,physical.top+logical.left-container.top);
   const right=Math.min(region.clientWidth,physical.right-logical.top-container.left),bottom=Math.min(region.clientHeight,physical.top+logical.right-container.top);
   const width=right-left,height=bottom-top;
   if(width<=0||height<=0){setSurface(null);return;}
   setSurface(old=>old?.menu===menu&&old.left===left&&old.top===top&&old.width===width&&old.height===height?old:{menu,left,top,width,height});
  };
  const schedule=()=>{cancelAnimationFrame(raf);raf=requestAnimationFrame(update);};
  const connect=()=>{
   observer?.disconnect();resize?.disconnect();observed=null;
   const doc=iframe.contentDocument;
   if(!doc?.documentElement)return;
   observer=new MutationObserver(schedule);
   observer.observe(doc.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:["open"]});
   if(typeof ResizeObserver!=="undefined"){resize=new ResizeObserver(schedule);resize.observe(iframe);resize.observe(region);}
   update();schedule();
  };
  iframe.addEventListener("load",connect);window.addEventListener("resize",schedule);connect();
  return()=>{iframe.removeEventListener("load",connect);window.removeEventListener("resize",schedule);observer?.disconnect();resize?.disconnect();cancelAnimationFrame(raf);drag.current=null;setSurface(null);};
 },[enabled,frame,area]);
 const actionAt=(menu:HTMLElement,x:number,y:number)=>{
  const f=frame.current?.getBoundingClientRect();
  if(!f)return null;
  const target=menu.ownerDocument.elementFromPoint(y-f.top,f.right-x)?.closest<HTMLElement>(ACTION)??null;
  return target&&menu.contains(target)?target:null;
 };
 const begin=(menu:HTMLElement,source:"pointer"|"touch",id:number,x:number,y:number)=>{
  drag.current={menu,source,id,x,y,scroll:menu.scrollTop,target:actionAt(menu,x,y),moved:false};
 };
 const scroll=(source:"pointer"|"touch",id:number,x:number,y:number)=>{
  const current=drag.current;
  if(!current||current.source!==source||current.id!==id)return;
  if(!current.moved&&Math.hypot(x-current.x,y-current.y)<8)return;
  current.moved=true;
  // The logical y-axis points physically to the left after rotate(90deg).
  current.menu.scrollTop=current.scroll+x-current.x;
 };
 const finish=(source:"pointer"|"touch",id:number,x:number,y:number)=>{
  const current=drag.current;
  if(!current||current.source!==source||current.id!==id)return;
  drag.current=null;
  if(!current.menu.isConnected||current.moved||Math.hypot(x-current.x,y-current.y)>=8)return;
  // Only forward a genuine tap if it begins and ends on the same action.
  const target=actionAt(current.menu,x,y);
  if(target&&target===current.target){target.focus({preventScroll:true});target.click();}
 };
 useLayoutEffect(()=>{
  const element=overlay.current,menu=surface?.menu;
  if(!element||!menu)return;
  const wheel=(event:WheelEvent)=>{
   event.preventDefault();
   const factor=event.deltaMode===1?16:event.deltaMode===2?menu.clientHeight:1;
   menu.scrollTop+=(event.deltaY||event.deltaX)*factor;
  };
  // Use non-passive touch listeners as well as pointer events. A browser can
  // deliver either sequence; once touchstart arrives it owns that gesture.
  const touchStart=(event:TouchEvent)=>{
   if(event.touches.length!==1){drag.current=null;return;}
   event.preventDefault();const t=event.changedTouches[0];begin(menu,"touch",t.identifier,t.clientX,t.clientY);
  };
  const touchMove=(event:TouchEvent)=>{
   if(event.touches.length!==1){drag.current=null;return;}
   event.preventDefault();const t=event.changedTouches[0];scroll("touch",t.identifier,t.clientX,t.clientY);
  };
  const touchEnd=(event:TouchEvent)=>{
   event.preventDefault();const t=event.changedTouches[0];finish("touch",t.identifier,t.clientX,t.clientY);
  };
  const touchCancel=()=>{if(drag.current?.source==="touch")drag.current=null;};
  element.addEventListener("wheel",wheel,{passive:false});
  element.addEventListener("touchstart",touchStart,{passive:false});element.addEventListener("touchmove",touchMove,{passive:false});
  element.addEventListener("touchend",touchEnd,{passive:false});element.addEventListener("touchcancel",touchCancel);
  return()=>{element.removeEventListener("wheel",wheel);element.removeEventListener("touchstart",touchStart);element.removeEventListener("touchmove",touchMove);element.removeEventListener("touchend",touchEnd);element.removeEventListener("touchcancel",touchCancel);};
 },[surface?.menu]);
 const down=(event:ReactPointerEvent<HTMLDivElement>)=>{
  if(!surface||!event.isPrimary||event.button!==0)return;
  event.preventDefault();
  begin(surface.menu,"pointer",event.pointerId,event.clientX,event.clientY);
  try{event.currentTarget.setPointerCapture(event.pointerId);}catch{/* Old pointer implementation. */}
 };
 const move=(event:ReactPointerEvent<HTMLDivElement>)=>{
  if(drag.current?.source!=="pointer")return;
  event.preventDefault();scroll("pointer",event.pointerId,event.clientX,event.clientY);
 };
 const up=(event:ReactPointerEvent<HTMLDivElement>)=>{
  if(drag.current?.source!=="pointer")return;
  event.preventDefault();finish("pointer",event.pointerId,event.clientX,event.clientY);
 };
 if(!enabled||!surface)return null;
 return <div ref={overlay} className="lektrus-browser-board-menu-gesture" aria-hidden="true" style={{left:surface.left,top:surface.top,width:surface.width,height:surface.height}} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={()=>{if(drag.current?.source==="pointer")drag.current=null}} onLostPointerCapture={()=>{if(drag.current?.source==="pointer")drag.current=null}} onClick={event=>{event.preventDefault();event.stopPropagation()}}/>;
}
