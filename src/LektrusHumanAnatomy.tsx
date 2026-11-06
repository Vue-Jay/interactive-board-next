import {useCallback,useEffect,useRef,useState,type PointerEvent as ReactPointerEvent,type WheelEvent as ReactWheelEvent} from "react";
import anatomySprite from "./assets/bio-atlas/human-seven-systems-clean.webp";
import {HUMAN_BODY_SYSTEMS,type HumanFocusedSystem} from "./lektrusBioHumanBodySystems";
import LektrusBioHumanSystemIcon from "./LektrusBioHumanSystemIcon";
import LektrusSkinSemanticViewport from "./LektrusSkinSemanticViewport";
import {SKIN_MAX_SCALE,anatomyCameraAtBody,
 skinDetailStage} from "./lektrusAnatomySemanticZoom";
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
 const [displayCamera,setDisplayCamera]=useState<AnatomyCamera>(ANATOMY_INITIAL_CAMERA);
 const displayed=useRef<AnatomyCamera>(ANATOMY_INITIAL_CAMERA);
 // Interpolate the same scale and pan fraction at each frame: the point
 // under the cursor remains fixed throughout the animation, not only at
 // its final destination. Switching systems leaves this camera untouched.
 useEffect(()=>{
  let raf=0,last=0;
  const tick=(time:number)=>{
   const dt=last?Math.min(60,time-last):16;last=time;
   const k=1-Math.exp(-dt/88);
   const from=displayed.current;
   const next:AnatomyCamera={
    scale:from.scale+(camera.scale-from.scale)*k,
    panX:from.panX+(camera.panX-from.panX)*k,
    panY:from.panY+(camera.panY-from.panY)*k
   };
   const done=Math.abs(next.scale-camera.scale)<.0004&&
    Math.abs(next.panX-camera.panX)<.035&&
    Math.abs(next.panY-camera.panY)<.035;
   displayed.current=done?camera:next;
   setDisplayCamera(displayed.current);
   if(!done)raf=requestAnimationFrame(tick);
  };
  raf=requestAnimationFrame(tick);
  return ()=>cancelAnimationFrame(raf);
 },[camera]);
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
  setCamera(prev=>{
   // The WHOLE skin system has one scale range. No hit testing against a
   // single shoulder is required before the user can investigate a leg,
   // cheek, abdomen or hand.
   const max=system==="integumentary"?SKIN_MAX_SCALE:
    Math.max(3.25,prev.scale);
   const safeFactor=system!=="integumentary"&&prev.scale>=3.25?
    Math.min(1,factor):factor;
   return anatomyZoomAt(prev,prev.scale*safeFactor,
    at??{x:width/2,y:height/2},width,height,max);
  });
 },[system]);
 const reset=()=>setCamera(ANATOMY_INITIAL_CAMERA);
 const focusSkin=(side:"left"|"right"="right")=>{
  const {width,height}=dimensions();
  const point=side==="left"?{x:80,y:245}:{x:280,y:245};
  setCamera(anatomyBoundCamera(
   anatomyCameraAtBody(point,4.3,width,height),
   width,height,SKIN_MAX_SCALE));
 };
 const wheel=(e:ReactWheelEvent<HTMLDivElement>)=>{
  e.preventDefault();e.stopPropagation();
  const r=e.currentTarget.getBoundingClientRect();
  const at={x:e.clientX-r.left,y:e.clientY-r.top};
  // Zoom the entire body at the point under the wheel, no shoulder
  // activation gate or automatic relocation to another skin region.
  zoom(Math.exp(-clip(e.deltaY,-220,220)*.0018),at);
 };
 const onDown=(e:ReactPointerEvent<HTMLDivElement>)=>{
  if(e.button!==0&&e.pointerType==="mouse")return;
  e.preventDefault();e.stopPropagation();
  e.currentTarget.setPointerCapture(e.pointerId);
  const point=pointOf(e);pointers.current.set(e.pointerId,point);
  const pair=[...pointers.current.entries()];
  if(pair.length>=2){
   gesture.current={kind:"pinch",startA:pair[0][1],startB:pair[1][1],
    camera:displayed.current};
  }else gesture.current={kind:"pan",id:e.pointerId,start:point,
   camera:displayed.current};
 };
 const onMove=(e:ReactPointerEvent<HTMLDivElement>)=>{
  if(!pointers.current.has(e.pointerId))return;
  pointers.current.set(e.pointerId,pointOf(e));
  const g=gesture.current,r=e.currentTarget.getBoundingClientRect();
  if(!g)return;
  if(g.kind==="pan"&&g.id===e.pointerId){
   const p=pointers.current.get(e.pointerId)!;
   setCamera(anatomyPan(g.camera,p.x-g.start.x,p.y-g.start.y,r.width,r.height,
    system==="integumentary"?SKIN_MAX_SCALE:Math.max(3.25,g.camera.scale)));
  }else if(g.kind==="pinch"&&pointers.current.size>=2){
   const p=[...pointers.current.values()];
   const startMid={x:(g.startA.x+g.startB.x)/2,y:(g.startA.y+g.startB.y)/2};
   const mid={x:(p[0].x+p[1].x)/2,y:(p[0].y+p[1].y)/2};
   const factor=between(p[0],p[1])/Math.max(1,between(g.startA,g.startB));
   const max=system==="integumentary"?SKIN_MAX_SCALE:
    Math.max(3.25,g.camera.scale);
   const next=anatomyZoomAt(g.camera,g.camera.scale*factor,
    startMid,r.width,r.height,max);
   setCamera(anatomyPan(next,mid.x-startMid.x,mid.y-startMid.y,r.width,r.height,max));
  }
 };
 const onUp=(e:ReactPointerEvent<HTMLDivElement>)=>{
  pointers.current.delete(e.pointerId);
  if(e.currentTarget.hasPointerCapture(e.pointerId))
   e.currentTarget.releasePointerCapture(e.pointerId);
  const entries=[...pointers.current.entries()];
  if(entries.length===1)gesture.current={kind:"pan",id:entries[0][0],
    start:entries[0][1],camera:displayed.current};
  else gesture.current=null;
 };
 const focus=(pos:Point|undefined)=>{
  if(!pos)return;
  const {width,height}=dimensions();
  const imageScale=height/ANATOMY_SPRITE_HEIGHT*.94;
  const scale=Math.max(1.75,camera.scale);
  setCamera(anatomyBoundCamera({scale,
   panX:-pos.x*imageScale*scale,panY:-pos.y*imageScale*scale},
   width,height,Math.max(3.25,camera.scale)));
 };
 const showDescriptions=diagram.showDescriptions;
 const spritePosition=anatomySpritePosition(system);
 return <div className="lek-anatomy-container"><section className={"lek-anatomy"+(editorMode?" lek-anatomy--editor":"")}
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
      setCamera(c=>anatomyPan(c,dir.x,dir.y,d.width,d.height,
       system==="integumentary"?SKIN_MAX_SCALE:Math.max(3.25,c.scale)));
     }
    }}>
    <div className="lek-anatomy-stage-grid" aria-hidden="true"/>
    {system==="integumentary"?<LektrusSkinSemanticViewport
     camera={displayCamera}/>:<div className="lek-anatomy-world"
     style={{transform:`translate3d(${displayCamera.panX}px,${displayCamera.panY}px,0) scale(${displayCamera.scale})`}}>
     <div className="lek-anatomy-figure"
      data-anatomy-system={system}
      role="img" aria-label={selected.name+" система человека"}
      style={{backgroundImage:`url("${anatomySprite}")`,
       backgroundSize:`${spriteWidthPercent}% 100%`,
       backgroundPosition:`${spritePosition}% 0%`,
       backgroundColor:colors[system],
       ["--lek-anatomy-paper" as string]:colors[system]}}>
     </div>
    </div>}
    <div className="lek-anatomy-zoom" onPointerDown={e=>e.stopPropagation()}>
     <button type="button" aria-label="Приблизить" onClick={()=>zoom(1.22)}>+</button>
     <span aria-live="off">{Math.round(camera.scale*100)}%</span>
     <button type="button" aria-label="Отдалить" onClick={()=>zoom(1/1.22)}>−</button>
    </div>
    <span className="lek-anatomy-stage-hint">{system==="integumentary"?
     "Кожа в разрезе вдоль боковых контуров":
     "Одна точка обзора для всех систем"}</span>
   </div>
   <div className="lek-anatomy-footnote">
    <span>{system==="integumentary"?
     skinDetailStage(displayCamera.scale)+" · только по краям":
     "Переключение системы не меняет положение и увеличение."}</span>
    <span>{system==="integumentary"?
     "Цифровой зум, не физическое увеличение микроскопа":
     "Колесо мыши / два пальца для масштаба"}</span>
   </div>
  </div>
  <aside className="lek-anatomy-details" aria-label="Сведения о системе">
   <div className="lek-anatomy-details-top">
    <span className="lek-anatomy-section-kicker">СТРОЕНИЕ И ФУНКЦИИ</span>
    <h3>{selected.name}</h3>
    {showDescriptions&&<p>{details.summary}</p>}
   </div>
   {system==="integumentary"&&<div className="lek-anatomy-skin-explore">
    <strong>Кожный покров в разрезе</strong>
    <p>Слои кожи видны только по боковым контурам головы,
     туловища, рук и ног. Центр тела остаётся нейтральным.
     Приближайте край: постепенно проявятся фолликулы, железы,
     сосуды, волокна дермы и клетки эпидермиса.</p>
    <div className="lek-anatomy-skin-modes" role="group"
     aria-label="Приблизить боковой разрез">
     <button type="button" onClick={()=>focusSkin("left")}>Левый бок</button>
     <button type="button" onClick={()=>focusSkin("right")}>Правый бок</button>
    </div>
    <div className="lek-anatomy-skin-legend" aria-label="Слои кожи">
     <span><i className="is-epidermis"/> Эпидермис</span>
     <span><i className="is-dermis"/> Дерма</span>
     <span><i className="is-subcutis"/> Подкожная клетчатка</span>
    </div>
    {displayCamera.scale>=22&&<p>В дерме: волосяной фолликул с луковицей,
     сальная железа и мышца, поднимающая волос; извитая потовая железа
     с протоком к поверхности, капилляры и нервные окончания.</p>}
    {displayCamera.scale>=90&&<p>При глубоком увеличении в дерме
     становятся различимы сосочки, тонкие эластические волокна,
     капиллярные петли и клетки-фибробласты.</p>}
    {displayCamera.scale>=145&&<p>Эпидермис снаружи внутрь: роговой,
     зернистый, шиповатый и базальный слои. В базальном слое —
     меланоциты; глубже — волокна дермы и жировые клетки.
     Блестящий слой характерен для толстой кожи ладоней и подошв
     и здесь не показан.</p>}
    {displayCamera.scale>=250&&<p>В зернистом слое заметны мелкие
     гранулы кератогиалина, роговой слой состоит из безъядерных
     плоских клеток, а в базальном слое встречаются меланоциты.</p>}
    <small>Виртуальный учебный разрез, не микрофотография.
     Ширина разреза и слоёв специально увеличена: их размер не
     соответствует толщине кожи относительно всего тела.
     Значения 65–105 мкм для адипоцитов и 17–27 мкм для
     кератиноцитов справочные, а не масштабная линейка рисунка.
     Сейчас достоверно привязанный учебный образец придатков
     расположен в области правого плеча; в остальных областях
     конкретное размещение желез и фолликулов не подтверждено.
     Эпидермис не имеет собственных кровеносных сосудов.
     Подкожная клетчатка расположена под дермой.</small>
   </div>}
   <strong className="lek-anatomy-details-heading">Основные органы и структуры</strong>
   <div className="lek-anatomy-organs">
    {details.organs.map((organ,i)=><button type="button" key={i}
      className="lek-anatomy-organ"
      onClick={()=>{
       if(system!=="integumentary"){focus(organ.position);return;}
       if(i===0)focusSkin("right");
       if(i===1||i===2)focusSkin("left");
       if(i===3){
        // Nails are an actual visible body part; focus the foot without
        // opening a fictitious follicle micrograph on the shoulder.
        const {width,height}=dimensions();
        setCamera(anatomyBoundCamera(
         anatomyCameraAtBody({x:220,y:549},2.2,width,height),
         width,height,SKIN_MAX_SCALE));
       }
      }}
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
 </section></div>;
}
