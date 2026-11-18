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
 const drag=useRef<{menu:HTMLElement;id:number;x:number;y:number;scroll:number;target:HTMLElement|null;moved:boolean}|null>(null);
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
 useLayoutEffect(()=>{
  const element=overlay.current,menu=surface?.menu;
  if(!element||!menu)return;
  const wheel=(event:WheelEvent)=>{
   event.preventDefault();
   const factor=event.deltaMode===1?16:event.deltaMode===2?menu.clientHeight:1;
   menu.scrollTop+=(event.deltaY||event.deltaX)*factor;
  };
  element.addEventListener("wheel",wheel,{passive:false});
  return()=>element.removeEventListener("wheel",wheel);
 },[surface?.menu]);
 const actionAt=(menu:HTMLElement,x:number,y:number)=>{
  const f=frame.current?.getBoundingClientRect();
  if(!f)return null;
  const target=menu.ownerDocument.elementFromPoint(y-f.top,f.right-x)?.closest<HTMLElement>(ACTION)??null;
  return target&&menu.contains(target)?target:null;
 };
 const down=(event:ReactPointerEvent<HTMLDivElement>)=>{
  if(!surface||!event.isPrimary||event.button!==0)return;
  event.preventDefault();
  const {menu}=surface;
  drag.current={menu,id:event.pointerId,x:event.clientX,y:event.clientY,scroll:menu.scrollTop,target:actionAt(menu,event.clientX,event.clientY),moved:false};
  try{event.currentTarget.setPointerCapture(event.pointerId);}catch{/* Old pointer implementation. */}
 };
 const move=(event:ReactPointerEvent<HTMLDivElement>)=>{
  const current=drag.current;
  if(!current||current.id!==event.pointerId)return;
  if(!current.moved&&Math.hypot(event.clientX-current.x,event.clientY-current.y)<8)return;
  current.moved=true;event.preventDefault();
  // The logical y-axis points physically to the left after rotate(90deg).
  current.menu.scrollTop=current.scroll+event.clientX-current.x;
 };
 const up=(event:ReactPointerEvent<HTMLDivElement>)=>{
  const current=drag.current;
  if(!current||current.id!==event.pointerId)return;
  drag.current=null;event.preventDefault();
  if(!current.menu.isConnected||current.moved||Math.hypot(event.clientX-current.x,event.clientY-current.y)>=8)return;
  // Only forward a genuine tap if it begins and ends on the same action.
  // Same-origin child activation remains inside this real pointerup handler.
  const target=actionAt(current.menu,event.clientX,event.clientY);
  if(target&&target===current.target){target.focus({preventScroll:true});target.click();}
 };
 if(!enabled||!surface)return null;
 return <div ref={overlay} className="lektrus-browser-board-menu-gesture" aria-hidden="true" style={{left:surface.left,top:surface.top,width:surface.width,height:surface.height}} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={()=>{drag.current=null}} onLostPointerCapture={()=>{drag.current=null}} onClick={event=>{event.preventDefault();event.stopPropagation()}}/>;
}
