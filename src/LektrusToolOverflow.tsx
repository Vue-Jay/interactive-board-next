import {useLayoutEffect,useRef,useState,type CSSProperties,type ReactNode} from "react";
import {createPortal} from "react-dom";

/** Floating, viewport-bound menu. The whiteboard rail never grows when More is opened. */
export default function LektrusToolOverflow({
  anchor,onClose,children,
}:{
  anchor:HTMLElement|null;
  onClose:()=>void;
  children:ReactNode;
}){
  const dialogRef=useRef<HTMLElement|null>(null);
  const [position,setPosition]=useState<CSSProperties>({left:72,top:136});
  useLayoutEffect(()=>{
    if(!anchor)return;
    let frame=0;
    const update=()=>{
      const rect=anchor.getBoundingClientRect();
      const viewportWidth=window.visualViewport?.width ?? window.innerWidth;
      const viewportHeight=window.visualViewport?.height ?? window.innerHeight;
      const width=Math.min(354,viewportWidth-24);
      const height=Math.min(586,viewportHeight-24);
      const right=rect.right+10;
      const left=right+width<=viewportWidth-8?right:Math.max(8,rect.left-width-10);
      const top=Math.max(8,Math.min(rect.top,viewportHeight-height-8));
      setPosition(current=>current.left===left&&current.top===top?current:{left,top});
    };
    const schedule=()=>{cancelAnimationFrame(frame);frame=requestAnimationFrame(update)};
    update();
    const observer=typeof ResizeObserver==="undefined"?null:new ResizeObserver(schedule);
    observer?.observe(anchor);
    window.addEventListener("resize",schedule);
    window.addEventListener("scroll",schedule,true);
    window.visualViewport?.addEventListener("resize",schedule);
    return()=>{
      cancelAnimationFrame(frame);
      observer?.disconnect();
      window.removeEventListener("resize",schedule);
      window.removeEventListener("scroll",schedule,true);
      window.visualViewport?.removeEventListener("resize",schedule);
    };
  },[anchor]);
  useLayoutEffect(()=>{
    const key=(event:KeyboardEvent)=>{if(event.key==="Escape"){event.stopPropagation();onClose()}};
    const outside=(event:PointerEvent)=>{
      const target=event.target;
      if(!(target instanceof Node))return;
      if(dialogRef.current?.contains(target)||anchor?.contains(target))return;
      onClose();
    };
    document.addEventListener("keydown",key,true);
    document.addEventListener("pointerdown",outside,true);
    return()=>{
      document.removeEventListener("keydown",key,true);
      document.removeEventListener("pointerdown",outside,true);
    };
  },[anchor,onClose]);
  return createPortal(
    <section
      id="lektrus-tool-overflow"
      ref={dialogRef}
      className="lektrus-tool-overflow-popover"
      role="dialog"
      aria-modal="false"
      aria-label="Все инструменты доски"
      style={position}
      onPointerDown={event=>event.stopPropagation()}
      onContextMenu={event=>event.stopPropagation()}>
      {children}
    </section>,
    document.body
  );
}
