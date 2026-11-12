import {useRef,type CSSProperties,type DragEvent,type PointerEvent,type ReactNode} from "react";
import type {SiteBlock} from "./marketingSiteConfig";
import {putSiteCanvasTransfer} from "./SiteCanvasDnD";

export type SiteBlockDimensions={width:number;minHeight:number};
export const clampSiteBlockWidth=(value:number)=>Math.max(35,Math.min(100,Math.round(value)));
export const clampSiteBlockHeight=(value:number)=>Math.max(0,Math.min(1200,Math.round(value)));

type ResizeDirection="x"|"y"|"both";
type ResizeState={
 pointerId:number;startX:number;startY:number;startWidth:number;startHeight:number;containerWidth:number;direction:ResizeDirection;
};
export function SiteResizableBlock({block,selected,preview,children}:{block:SiteBlock;selected:boolean;preview:boolean;children:ReactNode}){
 const wrapper=useRef<HTMLDivElement>(null);
 const resize=useRef<ResizeState|null>(null);
 const width=block.style?.width??100;
 const height=block.style?.minHeight??0;
 const style:CSSProperties={width:width+"%",minHeight:height?height+"px":undefined,marginInline:"auto"};

 const select=()=>{
  window.parent.postMessage({type:"lektrus:site-select-block",id:block.id},window.location.origin);
 };
 const start=(event:PointerEvent<HTMLButtonElement>,direction:ResizeDirection)=>{
  if(!preview||!selected||!wrapper.current||event.button!==0)return;
  event.preventDefault();event.stopPropagation();
  const bounds=wrapper.current.getBoundingClientRect();
  const container=wrapper.current.closest("#marketing-main")?.getBoundingClientRect();
  const containerWidth=Math.max(1,container?.width||window.innerWidth);
  resize.current={pointerId:event.pointerId,startX:event.clientX,startY:event.clientY,startWidth:width,
   startHeight:height||Math.ceil(bounds.height),containerWidth,direction};
  event.currentTarget.setPointerCapture(event.pointerId);
  wrapper.current.classList.add("site-block-is-resizing");
 };
 const move=(event:PointerEvent<HTMLButtonElement>)=>{
  const session=resize.current,element=wrapper.current;
  if(!session||!element||event.pointerId!==session.pointerId)return;
  event.preventDefault();event.stopPropagation();
  if(session.direction!=="y"){
   const updated=clampSiteBlockWidth(session.startWidth+(event.clientX-session.startX)/session.containerWidth*100);
   element.style.width=updated+"%";
   element.dataset.resizeWidth=String(updated);
  }
  if(session.direction!=="x"){
   const updated=clampSiteBlockHeight(session.startHeight+event.clientY-session.startY);
   element.style.minHeight=updated+"px";
   element.dataset.resizeHeight=String(updated);
  }
 };
 const end=(event:PointerEvent<HTMLButtonElement>)=>{
  const session=resize.current,element=wrapper.current;
  if(!session||!element||event.pointerId!==session.pointerId)return;
  event.preventDefault();event.stopPropagation();
  resize.current=null;
  element.classList.remove("site-block-is-resizing");
  const widthNext=clampSiteBlockWidth(Number(element.dataset.resizeWidth??width));
  const heightNext=clampSiteBlockHeight(Number(element.dataset.resizeHeight??height));
  delete element.dataset.resizeWidth;
  delete element.dataset.resizeHeight;
  if(widthNext===width&&heightNext===height)return;
  window.parent.postMessage({
   type:"lektrus:site-resize-block",id:block.id,width:widthNext,minHeight:heightNext
  },window.location.origin);
 };
 const stopDrag=(event:DragEvent<HTMLDivElement>)=>{
  if((event.target as Element).closest("[data-site-editor-control]")){event.preventDefault();return}
  if(preview)putSiteCanvasTransfer(event,{type:"move",id:block.id});
 };
 return <div ref={wrapper} className="site-editable-block" style={style} data-site-block-id={block.id}
  data-site-selected={selected?"true":undefined} draggable={preview} onDragStart={stopDrag}>
  {children}
  {preview&&<div className="site-block-editor-tools" data-site-editor-control>
   <button type="button" className="site-block-select-button" data-site-editor-control
    onClick={event=>{event.preventDefault();event.stopPropagation();select()}}
    title="Выбрать и изменить размер этого блока">▣ Блок</button>
   {selected&&<span className="site-block-editor-size">{width}% · {height?height+" px":"по содержимому"}</span>}
  </div>}
  {preview&&selected&&(["x","y","both"] as ResizeDirection[]).map(direction=><button key={direction}
   type="button" data-site-editor-control data-direction={direction} draggable={false}
   className={"site-block-resize-handle site-block-resize-"+direction}
   aria-label={direction==="x"?"Изменить ширину блока":direction==="y"?"Изменить высоту блока":"Изменить ширину и высоту блока"}
   title={direction==="x"?"Ширина":direction==="y"?"Высота":"Ширина и высота"}
   onPointerDown={event=>start(event,direction)}
   onPointerMove={move} onPointerUp={end} onPointerCancel={end}
   onClick={event=>{event.preventDefault();event.stopPropagation()}}>
   <span aria-hidden="true">{direction==="x"?"↔":direction==="y"?"↕":"⤡"}</span>
  </button>)}
 </div>;
}
