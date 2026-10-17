import {useEffect,useId,useLayoutEffect,useRef,useState,type CSSProperties,type PointerEvent} from "react";
import {createPortal} from "react-dom";
import {periodicElements} from "./lektrusPeriodicElements";
import {elementFacts} from "./lektrusElementFacts";
import {atomViews,type AtomViewMode} from "./lektrusAtomModel";
import LektrusAtomView from "./LektrusAtomView";

type Point={x:number;y:number};
type Layout="school"|"long";
type Props={
 number:number;layout:Layout;stageRef:{current:HTMLDivElement|null};
 selected:boolean;onClose:()=>void;onToggle?:()=>void;slot?:number;fixed?:boolean;
};
type Geometry={left:number;top:number;width:number;height:number;scaleX:number;scaleY:number;localW:number;localH:number;windowScale:number};
const BASE_STAGE_WIDTH=840,BASE_STAGE_HEIGHT=484;
const CARD_WIDTH=238;
const clamp=(v:number,min:number,max:number)=>Math.max(min,Math.min(max,v));
const near=(a:number,b:number)=>Math.abs(a-b)<.2;
const geometryMatches=(a:Geometry|null,b:Geometry)=>!!a&&
 near(a.left,b.left)&&near(a.top,b.top)&&near(a.width,b.width)&&near(a.height,b.height)&&
 near(a.localW,b.localW)&&near(a.localH,b.localH)&&near(a.windowScale,b.windowScale);

export default function LektrusPeriodicFloatingInfo({
 number,layout,stageRef,selected,onClose,onToggle,slot=0,fixed=false
}:Props){
 const element=periodicElements[number-1],facts=elementFacts[number-1];
 const [atomOpen,setAtomOpen]=useState(false);
 const [mode,setMode]=useState<AtomViewMode>("shell");
 const [offset,setOffset]=useState<Point|null>(null);
 const [geometry,setGeometry]=useState<Geometry|null>(null);
 const cardRef=useRef<HTMLElement>(null);
 const drag=useRef<{id:number;startX:number;startY:number;origin:Point}|null>(null);
 const atomId=useId();

 // The panel is portaled outside the board. Forward Ctrl+wheel to the
 // board's existing non-passive wheel handler instead of zooming the browser.
 useEffect(()=>{
  const panel=cardRef.current;
  if(!panel)return;
  const handleWheel=(event:WheelEvent)=>{
   if(!event.ctrlKey&&!event.metaKey)return;
   event.preventDefault();
   event.stopPropagation();
   if(fixed)return;
   const stage=stageRef.current;
   if(!stage)return;
   stage.dispatchEvent(new WheelEvent("wheel",{
    bubbles:true,cancelable:true,
    ctrlKey:event.ctrlKey,metaKey:event.metaKey,
    altKey:event.altKey,shiftKey:event.shiftKey,
    clientX:event.clientX,clientY:event.clientY,
    deltaX:event.deltaX,deltaY:event.deltaY,deltaZ:event.deltaZ,
    deltaMode:event.deltaMode
   }));
  };
  panel.addEventListener("wheel",handleWheel,{passive:false});
  return()=>panel.removeEventListener("wheel",handleWheel);
 },[fixed,stageRef]);

 useEffect(()=>{setAtomOpen(false);setMode("shell");setOffset(null)},[number,layout]);
 useLayoutEffect(()=>{
  let alive=true,frame=0;
  const measure=()=>{
   const stage=stageRef.current;
   if(stage){
    const rect=stage.getBoundingClientRect();
    const localW=stage.clientWidth||rect.width,localH=stage.clientHeight||rect.height;
    if(rect.width>0&&rect.height>0&&localW>0&&localH>0){
     const next:Geometry={
      left:rect.left,top:rect.top,width:rect.width,height:rect.height,
      localW,localH,scaleX:rect.width/localW,scaleY:rect.height/localH,
      windowScale:Math.sqrt((rect.width/BASE_STAGE_WIDTH)*(rect.height/BASE_STAGE_HEIGHT))
     };
     setGeometry(previous=>geometryMatches(previous,next)?previous:next);
    }
   }
   if(alive)frame=requestAnimationFrame(measure);
  };
  measure();
  return()=>{alive=false;cancelAnimationFrame(frame)};
 },[stageRef]);

 if(!element||!facts)return null;
 const localW=geometry?.localW??stageRef.current?.clientWidth??840;
 const localH=geometry?.localH??stageRef.current?.clientHeight??484;
 // One compact window immediately to the right of the TABLE, never over chemical cells.
 // Other elements opened with Ctrl/touch comparison appear beneath the first.
 const defaultPosition:Point={x:1.009,y:-.012+slot*.38};
 const ratio=offset??defaultPosition;
 const position={x:ratio.x*localW,y:ratio.y*localH};
 const startDrag=(event:PointerEvent<HTMLDivElement>)=>{
  if(fixed||(event.target as HTMLElement).closest("button"))return;
  event.preventDefault();event.stopPropagation();
  drag.current={id:event.pointerId,startX:event.clientX,startY:event.clientY,origin:position};
  event.currentTarget.setPointerCapture(event.pointerId);
 };
 const moveDrag=(event:PointerEvent<HTMLDivElement>)=>{
  const current=drag.current,g=geometry;
  if(!current||event.pointerId!==current.id||!g||fixed)return;
  // Movement remains board-relative even if the user pans or zooms while working.
  const panelW=(cardRef.current?.offsetWidth??CARD_WIDTH)*g.windowScale;
  const panelH=(cardRef.current?.offsetHeight??140)*g.windowScale;
  const minX=(8-g.left)/g.scaleX;
  const maxX=(window.innerWidth-8-g.left-panelW)/g.scaleX;
  const minY=(8-g.top)/g.scaleY;
  const maxY=(window.innerHeight-8-g.top-panelH)/g.scaleY;
  const nextX=clamp(current.origin.x+(event.clientX-current.startX)/g.scaleX,minX,Math.max(minX,maxX));
  const nextY=clamp(current.origin.y+(event.clientY-current.startY)/g.scaleY,minY,Math.max(minY,maxY));
  setOffset({x:nextX/g.localW,y:nextY/g.localH});
 };
 const endDrag=(event:PointerEvent<HTMLDivElement>)=>{
  if(drag.current?.id!==event.pointerId)return;
  drag.current=null;
  if(event.currentTarget.hasPointerCapture(event.pointerId))event.currentTarget.releasePointerCapture(event.pointerId);
 };

 const boardStyle:CSSProperties=geometry?{
  position:"fixed",
  left:geometry.left+position.x*geometry.scaleX,
  top:geometry.top+position.y*geometry.scaleY,
  transform:"scale("+geometry.windowScale+")",transformOrigin:"top left"
 }:{position:"fixed",visibility:"hidden"};
 const editorStyle:CSSProperties={
  position:"absolute",right:0,top:slot*35+"%",left:"auto",
  transform:"scale("+(geometry?.windowScale??1)+")",
  transformOrigin:"top right"
 };
 const content=<section ref={cardRef}
   className={"lektrus-chem-window lektrus-chem-window--combined"+(atomOpen?" is-expanded":"")+(atomOpen&&mode==="orbital"?" is-orbital":"")+(fixed?" is-editor":" is-board")}
   style={fixed?editorStyle:boardStyle}
   aria-label={"Информация об элементе "+element.name}
   onPointerDown={event=>event.stopPropagation()}
   onPointerMove={event=>event.stopPropagation()}
   onPointerUp={event=>event.stopPropagation()}
   onClick={event=>event.stopPropagation()}
   onDoubleClick={event=>event.stopPropagation()}>
   <div className="lektrus-chem-window-head" style={{touchAction:"none"}}
     onPointerDown={startDrag} onPointerMove={moveDrag}
     onPointerUp={endDrag} onPointerCancel={endDrag}>
    <b className="lektrus-chem-element-symbol">{element.symbol}</b>
    <strong>{element.name}</strong>
    {!fixed&&<span className="lektrus-chem-drag-handle" aria-hidden="true">⠿</span>}
    <button className="lektrus-chem-close" type="button"
      onClick={onClose} aria-label="Закрыть карточку" title="Закрыть карточку">
      <svg viewBox="0 0 20 20" width="14" height="14" aria-hidden="true">
       <path d="M4 4L16 16M16 4L4 16" fill="none" stroke="currentColor"
         strokeWidth="2" strokeLinecap="round"/>
      </svg>
    </button>
   </div>
   <div className="lektrus-chem-facts">
    <span>№ <b>{number}</b></span><span>A<sub>r</sub> <b>{facts.atomicMass}</b></span>
    <span>Период <b>{element.period}</b></span><span>Группа <b>{element.group}</b></span>
   </div>
   <div className="lektrus-chem-detail">
    <span>Конфигурация: </span>{facts.electronConfiguration}
   </div>
   <div className="lektrus-chem-detail">
    <span>Степени окисления: </span>{facts.oxidationStates}
   </div>
   {onToggle&&<div className="lektrus-chem-actions">
    <button type="button" onClick={onToggle}>{selected?"Снять выделение":"Выделить"}</button>
   </div>}
   <button type="button" className="lektrus-chem-atom-toggle"
     aria-expanded={atomOpen} aria-controls={atomId} onClick={()=>setAtomOpen(v=>!v)}>
    <span>Строение атома</span>
    <span className={"lektrus-chem-chevron"+(atomOpen?" is-open":"")} aria-hidden="true">⌄</span>
   </button>
   {atomOpen&&<div className="lektrus-chem-atom-panel" id={atomId}>
    <div className="lektrus-chem-atom-modes" role="group" aria-label="Модель атома">
     {atomViews.map(view=><button type="button" key={view.id}
       aria-pressed={mode===view.id} onClick={()=>setMode(view.id)}>{view.name}</button>)}
    </div>
    <div className="lektrus-chem-atom-drawing">
     <LektrusAtomView model={{atomicNumber:number,mode,labelX:0,labelY:0,showElectronConfiguration:true}}
       labelScale={1.5} compactInPanel/>
    </div>
   </div>}
  </section>;

 return fixed?content:typeof document!=="undefined"?createPortal(content,document.body):null;
}
