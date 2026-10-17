import {useEffect,useRef,useState,type CSSProperties,type PointerEvent} from "react";
import {periodicElements} from "./lektrusPeriodicElements";
import {elementFacts} from "./lektrusElementFacts";
import {atomViews,type AtomViewMode} from "./lektrusAtomModel";
import LektrusAtomView from "./LektrusAtomView";

type Point={x:number;y:number};
type Props={
 number:number|null;layout:"school"|"long";anchor:HTMLElement|null;
 selected:boolean;onClose:()=>void;onToggle?:()=>void;
 fixed?:boolean;slot?:number;inline?:boolean;
};
const clamp=(n:number,min:number,max:number)=>Math.min(max,Math.max(min,n));

/** All sheets belong to the periodic table's own coordinate system.
 * Never use document.body / viewport-fixed positioning here. */
export default function LektrusPeriodicFloatingInfo({
 number,layout,anchor,selected,onClose,onToggle,fixed=false
}:Props){
 const [mode,setMode]=useState<AtomViewMode>("shell");
 const [atomOpen,setAtomOpen]=useState(false);
 const [dragPosition,setDragPosition]=useState<Point|null>(null);
 const dragging=useRef<{id:number;startX:number;startY:number;origin:Point}|null>(null);
 const cardRef=useRef<HTMLDivElement>(null);

 useEffect(()=>{
  setMode("shell");setAtomOpen(false);
 },[number]);
 useEffect(()=>{setDragPosition(null)},[layout,anchor]);

 if(number==null)return null;
 const element=periodicElements[number-1],facts=elementFacts[number-1];
 if(!element||!facts)return null;

 const cardStyle:CSSProperties=dragPosition?{
   position:"absolute",left:dragPosition.x,top:dragPosition.y,
   width:atomOpen?"min(48%, 475px)":"min(31%, 250px)",zIndex:6
 }:{position:"relative",width:"100%"};
 const begin=(e:PointerEvent<HTMLDivElement>)=>{
  if(fixed||!anchor||(e.target as HTMLElement).closest("button"))return;
  const panel=cardRef.current;
  if(!panel)return;
  const box=panel.getBoundingClientRect(),stage=anchor.getBoundingClientRect();
  const scaleX=stage.width/Math.max(1,anchor.clientWidth);
  const scaleY=stage.height/Math.max(1,anchor.clientHeight);
  dragging.current={id:e.pointerId,startX:e.clientX,startY:e.clientY,
    origin:{x:(box.left-stage.left)/scaleX,y:(box.top-stage.top)/scaleY}};
  e.currentTarget.setPointerCapture(e.pointerId);
  e.preventDefault();e.stopPropagation();
 };
 const move=(e:PointerEvent<HTMLDivElement>)=>{
  const drag=dragging.current;
  if(!drag||drag.id!==e.pointerId||!anchor)return;
  const stage=anchor.getBoundingClientRect();
  const scaleX=stage.width/Math.max(1,anchor.clientWidth);
  const scaleY=stage.height/Math.max(1,anchor.clientHeight);
  const w=cardRef.current?.offsetWidth??230,h=cardRef.current?.offsetHeight??140;
  setDragPosition({
    x:clamp(drag.origin.x+(e.clientX-drag.startX)/scaleX,4,Math.max(4,anchor.clientWidth-w-4)),
    y:clamp(drag.origin.y+(e.clientY-drag.startY)/scaleY,4,Math.max(4,anchor.clientHeight-h-4))
  });
 };
 const end=(e:PointerEvent<HTMLDivElement>)=>{
  if(dragging.current?.id!==e.pointerId)return;
  dragging.current=null;
  if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);
 };

 return <div ref={cardRef} className={"lektrus-floating-element-card"+(dragPosition?" is-dragged":"")+(atomOpen?" atom-open":"")} style={cardStyle}
  onClick={e=>e.stopPropagation()} onDoubleClick={e=>e.stopPropagation()}
  onPointerDown={e=>e.stopPropagation()}>
  <div className="lektrus-floating-element-head"
    onPointerDown={begin} onPointerMove={move} onPointerUp={end} onPointerCancel={end}
    style={{touchAction:"none",cursor:fixed?"default":"grab",userSelect:"none"}}>
   <b className="lektrus-floating-element-symbol">{element.symbol}</b>
   <strong className="lektrus-floating-element-name">{element.name}</strong>
   {!fixed&&<span className="lektrus-floating-element-drag" aria-hidden="true">⠿</span>}
   <button type="button" onClick={onClose} aria-label={"Закрыть "+element.name}>×</button>
  </div>
  <div className="lektrus-floating-element-facts">
    <span>№ <b>{number}</b></span>
    <span>A<sub>r</sub> <b>{facts.atomicMass}</b></span>
    <span>Период <b>{element.period}</b></span>
    <span>Группа <b>{element.group}</b></span>
  </div>
  <div className="lektrus-floating-element-configuration">
   <span>Электронная конфигурация</span><b>{facts.electronConfiguration}</b>
  </div>
  <div className="lektrus-floating-element-oxidation">
   <span>Степени окисления</span><b>{facts.oxidationStates}</b>
  </div>
  <div className="lektrus-floating-element-actions">
   <button type="button" aria-expanded={atomOpen} onClick={()=>setAtomOpen(v=>!v)}>
    {atomOpen?"Скрыть атом":"Строение атома"}
   </button>
   {onToggle&&<button type="button" onClick={onToggle}>{selected?"Снять выделение":"Выделить"}</button>}
  </div>
  {atomOpen&&<section className="lektrus-periodic-atom-subpanel" aria-label={"Строение атома "+element.name}>
   <div className="lektrus-periodic-atom-heading">
    <strong>Строение атома {element.symbol}</strong>
    <button type="button" onClick={()=>setAtomOpen(false)} aria-label="Закрыть модель атома">×</button>
   </div>
   <div className="lektrus-periodic-atom-modes" role="group" aria-label="Модель атома">
    {atomViews.map(view=><button key={view.id} type="button"
      aria-pressed={mode===view.id} onClick={()=>setMode(view.id)}>{view.name}</button>)}
   </div>
   <div className="lektrus-periodic-atom-visual">
    <LektrusAtomView model={{atomicNumber:number,mode,labelX:0,labelY:0,showElectronConfiguration:true}}/>
   </div>
  </section>}
 </div>;
}
