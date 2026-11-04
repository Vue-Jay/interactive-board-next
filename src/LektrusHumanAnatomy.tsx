import {useCallback,useRef,useState,type PointerEvent as ReactPointerEvent,type WheelEvent as ReactWheelEvent} from "react";
import anatomySprite from "./assets/bio-atlas/human-seven-systems.webp";
import {HUMAN_BODY_SYSTEMS,type HumanFocusedSystem} from "./lektrusBioHumanBodySystems";
import LektrusBioHumanSystemIcon from "./LektrusBioHumanSystemIcon";
import {ANATOMY_INITIAL_CAMERA,ANATOMY_SPRITE_WIDTH,ANATOMY_CROP_WIDTH,
 ANATOMY_SPRITE_HEIGHT,ANATOMY_SYSTEM_DETAILS,anatomySpritePosition,
 anatomyZoomAt,anatomyPan,anatomyBoundCamera,
 type HumanAnatomyDiagram,type AnatomyCamera} from "./lektrusHumanAnatomyModel";
import "./lektrusHumanAnatomy.css";

type Props={diagram:HumanAnatomyDiagram;
 onChange?:(diagram:HumanAnatomyDiagram)=>void;editorMode?:boolean};
type Point={x:number;y:number};
type Gesture={kind:"pan";id:number;start:Point;camera:AnatomyCamera}|
 {kind:"pinch";startA:Point;startB:Point;camera:AnatomyCamera};
const spriteWidthPercent=ANATOMY_SPRITE_WIDTH/ANATOMY_CROP_WIDTH*100;
const colors:Record<HumanFocusedSystem,string>={
 nervous:"#f3eefa",respiratory:"#eef5fc",circulatory:"#faf0f7",
 digestive:"#eef9f2",urinary:"#eef8fc",musculoskeletal:"#eef6fd",
 integumentary:"#eef8fd"
};
const clip=(v:number,a:number,b:number)=>Math.max(a,Math.min(b,v));
function pointOf(e:ReactPointerEvent<HTMLElement>):Point{
 const r=e.currentTarget.getBoundingClientRect();
 return {x:e.clientX-r.left,y:e.clientY-r.top};
}
const between=(a:Point,b:Point)=>Math.hypot(a.x-b.x,a.y-b.y);

export default function LektrusHumanAnatomy({diagram,onChange,editorMode=false}:Props){
 const [localSystem,setLocalSystem]=useState<HumanFocusedSystem>(diagram.system);
 const system=onChange?diagram.system:localSystem;
 // A single camera lives on this component, outside any system illustration.
 // Never key the viewport by system or auto-focus on a switch.
 const [camera,setCamera]=useState<AnatomyCamera>(ANATOMY_INITIAL_CAMERA);
 const stage=useRef<HTMLDivElement>(null);
 const pointers=useRef(new Map<number,Point>());
 const gesture=useRef<Gesture|null>(null);
 const selected=HUMAN_BODY_SYSTEMS.find(x=>x.id===system)!;
 const details=ANATOMY_SYSTEM_DETAILS[system];
 const chooseSystem=(next:HumanFocusedSystem)=>{
  if(next===system)return;
  if(onChange)onChange({...diagram,system:next});
  else setLocalSystem(next);
  // Intentionally no setCamera here: same center, scale and pan.
 };
 const dimensions=()=>{
  const r=stage.current?.getBoundingClientRect();
  return {width:Math.max(1,r?.width??700),height:Math.max(1,r?.height??500)};
 };
 const zoom=useCallback((factor:number,at?:Point)=>{
  const {width,height}=dimensions();
  setCamera(prev=>anatomyZoomAt(prev,prev.scale*factor,
   at??{x:width/2,y:height/2},width,height));
 },[]);
 const reset=()=>setCamera(ANATOMY_INITIAL_CAMERA);
 const wheel=(e:ReactWheelEvent<HTMLDivElement>)=>{
  e.preventDefault();e.stopPropagation();
  const r=e.currentTarget.getBoundingClientRect();
  zoom(Math.exp(-clip(e.deltaY,-220,220)*.0018),
   {x:e.clientX-r.left,y:e.clientY-r.top});
 };
 const onDown=(e:ReactPointerEvent<HTMLDivElement>)=>{
  if(e.button!==0&&e.pointerType==="mouse")return;
  e.preventDefault();e.stopPropagation();
  e.currentTarget.setPointerCapture(e.pointerId);
  const point=pointOf(e);pointers.current.set(e.pointerId,point);
  const pair=[...pointers.current.entries()];
  if(pair.length>=2){
   gesture.current={kind:"pinch",startA:pair[0][1],startB:pair[1][1],camera};
  }else gesture.current={kind:"pan",id:e.pointerId,start:point,camera};
 };
 const onMove=(e:ReactPointerEvent<HTMLDivElement>)=>{
  if(!pointers.current.has(e.pointerId))return;
  pointers.current.set(e.pointerId,pointOf(e));
  const g=gesture.current,r=e.currentTarget.getBoundingClientRect();
  if(!g)return;
  if(g.kind==="pan"&&g.id===e.pointerId){
   const p=pointers.current.get(e.pointerId)!;
   setCamera(anatomyPan(g.camera,p.x-g.start.x,p.y-g.start.y,r.width,r.height));
  }else if(g.kind==="pinch"&&pointers.current.size>=2){
   const p=[...pointers.current.values()];
   const startMid={x:(g.startA.x+g.startB.x)/2,y:(g.startA.y+g.startB.y)/2};
   const mid={x:(p[0].x+p[1].x)/2,y:(p[0].y+p[1].y)/2};
   const factor=between(p[0],p[1])/Math.max(1,between(g.startA,g.startB));
   const next=anatomyZoomAt(g.camera,g.camera.scale*factor,startMid,r.width,r.height);
   setCamera(anatomyPan(next,mid.x-startMid.x,mid.y-startMid.y,r.width,r.height));
  }
 };
 const onUp=(e:ReactPointerEvent<HTMLDivElement>)=>{
  pointers.current.delete(e.pointerId);
  if(e.currentTarget.hasPointerCapture(e.pointerId))
   e.currentTarget.releasePointerCapture(e.pointerId);
  const entries=[...pointers.current.entries()];
  if(entries.length===1)gesture.current={kind:"pan",id:entries[0][0],
    start:entries[0][1],camera};
  else gesture.current=null;
 };
 const focus=(pos:Point|undefined)=>{
  if(!pos)return;
  const {width,height}=dimensions();
  const imageScale=height/ANATOMY_SPRITE_HEIGHT*.94;
  const scale=Math.max(1.75,camera.scale);
  setCamera(anatomyBoundCamera({scale,
   panX:-pos.x*imageScale*scale,panY:-pos.y*imageScale*scale},width,height));
 };
 const showDescriptions=diagram.showDescriptions;
 const spritePosition=anatomySpritePosition(system);
 return <section className={"lek-anatomy"+(editorMode?" lek-anatomy--editor":"")}
   aria-label="Интерактивный атлас анатомии человека">
  <nav className="lek-anatomy-rail" aria-label="Системы организма">
   <div className="lek-anatomy-rail-title">Системы человека
    <small>7 систем · единая модель</small></div>
   <div className="lek-anatomy-rail-options">
    {HUMAN_BODY_SYSTEMS.map(entry=><button type="button" key={entry.id}
     aria-pressed={system===entry.id}
     className={"lek-anatomy-system"+(system===entry.id?" is-active":"")}
     onClick={()=>chooseSystem(entry.id)}>
      <span className="lek-anatomy-system-icon"><LektrusBioHumanSystemIcon system={entry.id}/></span>
      <span>{entry.name}</span><span className="lek-anatomy-system-check" aria-hidden="true">✓</span>
     </button>)}
   </div>
  </nav>
  <div className="lek-anatomy-main">
   <div className="lek-anatomy-main-head">
    <div><small>АНАТОМИЧЕСКИЙ АТЛАС</small><strong>{selected.name} система</strong></div>
    <button type="button" onClick={reset} className="lek-anatomy-reset" title="Вернуть весь организм">
     <span aria-hidden="true">↺</span> Весь организм
    </button>
   </div>
   <div className="lek-anatomy-stage" ref={stage} role="application" tabIndex={0}
    aria-label="Тело человека: перемещение перетаскиванием, приближение колесом мыши или двумя пальцами"
    onWheel={wheel} onPointerDown={onDown} onPointerMove={onMove}
    onPointerUp={onUp} onPointerCancel={onUp}
    onKeyDown={e=>{
     if(e.key==="+"||e.key==="="){e.preventDefault();zoom(1.2);}
     else if(e.key==="-"){e.preventDefault();zoom(1/1.2);}
     else if(e.key==="0"){e.preventDefault();reset();}
     else if(["ArrowLeft","ArrowRight","ArrowUp","ArrowDown"].includes(e.key)){
      e.preventDefault();const d=dimensions();
      const dir=e.key==="ArrowLeft"?{x:-32,y:0}:e.key==="ArrowRight"?
       {x:32,y:0}:e.key==="ArrowUp"?{x:0,y:-32}:{x:0,y:32};
      setCamera(c=>anatomyPan(c,dir.x,dir.y,d.width,d.height));
     }
    }}>
    <div className="lek-anatomy-stage-grid" aria-hidden="true"/>
    <div className="lek-anatomy-world"
     style={{transform:`translate3d(${camera.panX}px,${camera.panY}px,0) scale(${camera.scale})`}}>
     <div className="lek-anatomy-figure"
      data-anatomy-system={system}
      role="img" aria-label={selected.name+" система человека"}
      style={{backgroundImage:`url("${anatomySprite}")`,
       backgroundSize:`${spriteWidthPercent}% 100%`,
       backgroundPosition:`${spritePosition}% 0%`,
       backgroundColor:colors[system],
       ["--lek-anatomy-paper" as string]:colors[system]}}>
     </div>
    </div>
    <div className="lek-anatomy-zoom" onPointerDown={e=>e.stopPropagation()}>
     <button type="button" aria-label="Приблизить" onClick={()=>zoom(1.22)}>+</button>
     <span aria-live="off">{Math.round(camera.scale*100)}%</span>
     <button type="button" aria-label="Отдалить" onClick={()=>zoom(1/1.22)}>−</button>
    </div>
    <span className="lek-anatomy-stage-hint">Одна точка обзора для всех систем</span>
   </div>
   <div className="lek-anatomy-footnote">
    <span>Переключение системы не меняет положение и увеличение.</span>
    <span>Колесо мыши / два пальца для масштаба</span>
   </div>
  </div>
  <aside className="lek-anatomy-details" aria-label="Сведения о системе">
   <div className="lek-anatomy-details-top">
    <span className="lek-anatomy-section-kicker">СТРОЕНИЕ И ФУНКЦИИ</span>
    <h3>{selected.name}</h3>
    {showDescriptions&&<p>{details.summary}</p>}
   </div>
   <strong className="lek-anatomy-details-heading">Основные органы и структуры</strong>
   <div className="lek-anatomy-organs">
    {details.organs.map((organ,i)=><button type="button" key={i}
      className="lek-anatomy-organ"
      onClick={()=>focus(organ.position)}
      title={organ.position?"Приблизить область":"Сведения об органе"}>
     <span className="lek-anatomy-organ-number">{String(i+1).padStart(2,"0")}</span>
     <span><b>{organ.name}</b>
      {showDescriptions&&<small>{organ.detail}</small>}</span>
     {organ.position&&<span aria-hidden="true">⌕</span>}
    </button>)}
   </div>
   <p className="lek-anatomy-reference">Учебные иллюстрации, не медицинские снимки.
    Отдельные органы можно приблизить кнопками в списке.</p>
  </aside>
 </section>;
}
