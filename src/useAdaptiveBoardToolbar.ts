import {useLayoutEffect,useRef} from "react";
import {calculateToolbarCapacity} from "./toolbarCapacity";

/**
 * Presentation-only overflow for the existing vertical desktop tool rail.
 * Keeps navigation, More, search, subject tools, AI and settings accessible.
 * Collapsed icons fade out from the bottom upwards instead of overflowing
 * under browser controls. The existing "More" button reveals all tools.
 */
export function useAdaptiveBoardToolbar(expanded:boolean,pinnedSignature:string) {
  const ref=useRef<HTMLElement|null>(null);

  useLayoutEffect(()=>{
    const rail=ref.current;
    if(!rail)return;
    const items=Array.from(rail.querySelectorAll<HTMLElement>(".toolbar-list > .tool-wrap:not(.secondary-tool)"));
    const restore=(item:HTMLElement)=>{
      item.classList.remove("lektrus-auto-overflow");
      const button=item.querySelector<HTMLButtonElement>(".tool-button");
      if(button){button.removeAttribute("tabindex");button.removeAttribute("aria-hidden")}
    };
    const update=()=>{
      const style=getComputedStyle(rail);
      const finePointer=window.matchMedia?.("(pointer: fine)").matches ?? true;
      if(!finePointer||style.display==="none"){items.forEach(restore);return}
      const list=rail.querySelector<HTMLElement>(".toolbar-list");
      if(!list)return;
      const maxH=parseFloat(style.maxHeight);
      const availableHeight=Number.isFinite(maxH)
        ? Math.min(maxH,Math.max(0,window.innerHeight-24))
        : Math.max(0,window.innerHeight-105);
      const visible=(item:HTMLElement)=>getComputedStyle(item).display!=="none";
      const otherChildren=Array.from(rail.children).filter((node):node is HTMLElement=>node instanceof HTMLElement&&node!==list&&visible(node));
      const size=(node:HTMLElement)=>{
        const computed=getComputedStyle(node);
        const n=(v:string)=>parseFloat(v)||0;
        return node.getBoundingClientRect().height+n(computed.marginTop)+n(computed.marginBottom);
      };
      const rest=otherChildren.reduce((sum,node)=>sum+size(node),0);
      const railPad=(parseFloat(style.paddingTop)||0)+(parseFloat(style.paddingBottom)||0);
      const listStyle=getComputedStyle(list);
      const gap=parseFloat(listStyle.rowGap)||3;
      const sample=items[0]?.querySelector<HTMLElement>(".tool-button");
      const itemHeight=sample?.getBoundingClientRect().height||44;
      // Small safety margin accounts for flex gaps and separators.
      const count=calculateToolbarCapacity(
        availableHeight,rest+railPad+12,itemHeight,gap,items.length
      );
      items.forEach((item,index)=>{
        const hidden=index>=count;
        item.classList.toggle("lektrus-auto-overflow",hidden);
        const button=item.querySelector<HTMLButtonElement>(".tool-button");
        if(button){
          if(hidden){button.tabIndex=-1;button.setAttribute("aria-hidden","true")}
          else{button.removeAttribute("tabindex");button.removeAttribute("aria-hidden")}
        }
      });
      rail.classList.toggle("lektrus-overflowing",count<items.length);
    };
    let frame=0;
    const schedule=()=>{
      cancelAnimationFrame(frame);
      frame=requestAnimationFrame(update);
    };
    update();
    const observer=typeof ResizeObserver!=="undefined"?new ResizeObserver(schedule):null;
    observer?.observe(rail);
    window.addEventListener("resize",schedule,{passive:true});
    window.visualViewport?.addEventListener("resize",schedule,{passive:true});
    return ()=>{
      cancelAnimationFrame(frame);
      observer?.disconnect();
      window.removeEventListener("resize",schedule);
      window.visualViewport?.removeEventListener("resize",schedule);
      items.forEach(restore);
      rail.classList.remove("lektrus-overflowing");
    };
  },[expanded,pinnedSignature]);

  return ref;
}
