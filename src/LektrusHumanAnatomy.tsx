import {useCallback,useEffect,useRef,useState,type PointerEvent as ReactPointerEvent,type WheelEvent as ReactWheelEvent} from "react";
import anatomySprite from "./assets/bio-atlas/human-seven-systems-clean.webp";
import {HUMAN_BODY_SYSTEMS,type HumanFocusedSystem} from "./lektrusBioHumanBodySystems";
import LektrusBioHumanSystemIcon from "./LektrusBioHumanSystemIcon";
import LektrusSkinSemanticViewport,{type EpidermisHitTest} from "./LektrusSkinSemanticViewport";
import {EPIDERMIS_RECORDS,EPIDERMIS_STRATA_ORDER,
 EPIDERMIS_THICK_STRATA_ORDER,type EpidermisId} from "./lektrusEpidermisAtlas";
import type {ThickSkinKind} from "./lektrusThickEpidermis";
import LektrusSkinSpecimens from "./LektrusSkinSpecimens";
import {SKIN_MAX_SCALE,anatomyCameraAtBody,anatomyScreenToBody,
 anatomyBodyFit,skinDetailStage} from "./lektrusAnatomySemanticZoom";
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
 const [epidermisSelection,setEpidermisSelection]=useState<EpidermisId|null>(null);
 const [epidermisSelectedPoint,setEpidermisSelectedPoint]=useState<Point|null>(null);
 const [thickSkinKind,setThickSkinKind]=useState<ThickSkinKind|null>(null);
 const [thickUnavailable,setThickUnavailable]=useState(false);
 const epidermisCardRef=useRef<HTMLDivElement>(null);
 useEffect(()=>{
  if(!epidermisSelection||system!=="integumentary")return;
  const frame=requestAnimationFrame(()=>{
   // When selecting a thin layer on the CANVAS the right panel may be
   // scrolled above it. Bring the explanation into view immediately.
   epidermisCardRef.current?.scrollIntoView({
    block:"nearest",behavior:window.matchMedia("(prefers-reduced-motion: reduce)").matches?
     "auto":"smooth"
   });
  });
  return ()=>cancelAnimationFrame(frame);
 },[epidermisSelection,system]);
 const epidermisHit=useRef<EpidermisHitTest|null>(null);
 const epidermisAnchor=useRef<Point|null>(null);
 const thickSkinAnchors=useRef<Record<ThickSkinKind,Point|null>|null>(null);
 const tapStarts=useRef(new Map<number,Point>());
 const blockedTaps=useRef(new Set<number>());
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
 const focusEpidermis=(deep=false)=>{
  const {width,height}=dimensions();
  // User chose a virtual palm/sole reference, so keep it within the same
  // body world and zoom to its actual outline. Do NOT switch slide images.
  const reference=thickSkinKind?
   thickSkinAnchors.current?.[thickSkinKind]:null;
  const point=reference?
   {...reference}:
   epidermisAnchor.current??{x:260,y:182};
  setCamera(anatomyBoundCamera(anatomyCameraAtBody(
   point,deep?220:thickSkinKind?85:65,width,height),width,height,SKIN_MAX_SCALE));
 };
 const focusThickSkin=(kind:ThickSkinKind)=>{
  const anchor=thickSkinAnchors.current?.[kind];
  if(!anchor){setThickUnavailable(true);return;}
  setThickUnavailable(false);
  setThickSkinKind(kind);
  setEpidermisSelection("lucidum");setEpidermisSelectedPoint(null);
  const {width,height}=dimensions();
  setCamera(anatomyBoundCamera(anatomyCameraAtBody(
   {...anchor},85,width,height),
   width,height,SKIN_MAX_SCALE));
 };
 const focusThinSkin=()=>{
  setThickUnavailable(false);
  setThickSkinKind(null);setEpidermisSelection(null);setEpidermisSelectedPoint(null);
  const {width,height}=dimensions();
  setCamera(anatomyBoundCamera(anatomyCameraAtBody(
   epidermisAnchor.current??{x:260,y:182},65,width,height),
   width,height,SKIN_MAX_SCALE));
 };
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
  tapStarts.current.set(e.pointerId,point);
  const pair=[...pointers.current.entries()];
  if(pair.length>=2){
   for(const [id] of pair)blockedTaps.current.add(id);
   gesture.current={kind:"pinch",startA:pair[0][1],startB:pair[1][1],
    camera:displayed.current};
  }else gesture.current={kind:"pan",id:e.pointerId,start:point,
   camera:displayed.current};
 };
 const onMove=(e:ReactPointerEvent<HTMLDivElement>)=>{
  // A hover pointer on a visible epidermal layer is a real interaction,
  // not an image-only decoration. Keep touch gestures and dragging intact.
  if(e.pointerType==="mouse"&&e.buttons===0){
   const {width,height}=dimensions();
   const target=pointOf(e);
   const world=anatomyScreenToBody(displayed.current,target,width,height);
   const hit=system==="integumentary"&&epidermisHit.current?.(
    world,anatomyBodyFit(width,height).pixelPerWorld*displayed.current.scale);
   e.currentTarget.style.cursor=hit?"pointer":"grab";
  }
  if(!pointers.current.has(e.pointerId))return;
  const moved=pointOf(e);
  const from=tapStarts.current.get(e.pointerId);
  if(from&&between(from,moved)>8)blockedTaps.current.add(e.pointerId);
  pointers.current.set(e.pointerId,moved);
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
  const from=tapStarts.current.get(e.pointerId);
  const target=pointOf(e);
  const isTap=system==="integumentary"&&pointers.current.size===1&&
   gesture.current?.kind==="pan"&&!!from&&
   between(from,target)<=8&&!blockedTaps.current.has(e.pointerId);
  if(isTap){
   const {width,height}=dimensions();
   const bodyPoint=anatomyScreenToBody(displayed.current,target,width,height);
   const hit=epidermisHit.current?.(bodyPoint,
    anatomyBodyFit(width,height).pixelPerWorld*displayed.current.scale);
   if(hit){setEpidermisSelection(hit);setEpidermisSelectedPoint(bodyPoint);}
    else {setEpidermisSelection(null);setEpidermisSelectedPoint(null);}
  }
  tapStarts.current.delete(e.pointerId);
  blockedTaps.current.delete(e.pointerId);
  pointers.current.delete(e.pointerId);
  if(e.currentTarget.hasPointerCapture(e.pointerId))
   e.currentTarget.releasePointerCapture(e.pointerId);
  const entries=[...pointers.current.entries()];
  if(entries.length===1)gesture.current={kind:"pan",id:entries[0][0],
    start:entries[0][1],camera:displayed.current};
  else gesture.current=null;
 };
 // A cancelled touch (scroll/OS gesture) cannot select a structure.
 const onCancel=(e:ReactPointerEvent<HTMLDivElement>)=>{
  blockedTaps.current.add(e.pointerId);
  onUp(e);
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
    onPointerUp={onUp} onPointerCancel={onCancel}
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
     camera={displayCamera} selectedEpidermis={epidermisSelection}
      selectedPoint={epidermisSelectedPoint}
     thickKind={thickSkinKind}
     hitTestRef={epidermisHit} anchorRef={epidermisAnchor}
     thickAnchorsRef={thickSkinAnchors}/>:<div className="lek-anatomy-world"
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
     displayCamera.scale<=10?"Кожа · цельная модель конечностей":
     displayCamera.scale<26?"Кожа · плавное раскрытие бокового разреза":
     "Кожа в разрезе вдоль боковых контуров":
     "Одна точка обзора для всех систем"}</span>
   </div>
   <div className="lek-anatomy-footnote">
    <span>{system==="integumentary"?
     thickSkinKind?
      (thickSkinKind==="palm"?"Ладонь":"Подошва")+
      " · виртуальный пятислойный разрез, включая блестящий":
      displayCamera.scale<=10?
       "Кисти, пальцы и ноги показаны целиком · разрез откроется при дальнейшем зуме":
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
    <p>На общем виде кисти, пальцы и ноги остаются цельными.
     При сильном увеличении вдоль боковых контуров плавно
     раскрывается условный трёхслойный разрез. Центр тела
     остаётся нейтральным; настоящие клетки и сосуды
     сравнивайте с микропрепаратами ниже.</p>
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
    <section className="lek-anatomy-epidermis-inspector"
     aria-label="Интерактивное исследование эпидермиса">
     <div className="lek-anatomy-epidermis-title">
      <strong>Эпидермис · исследование</strong>
      <p>Изучайте тонкую кожу плеча или модельные разрезы толстой
       кожи ладони и подошвы. Нажмите на слой на теле либо выберите
       его в списке. У тонкой кожи четыре слоя, у толстой пять.</p>
     </div>
     <div className="lek-anatomy-skin-sample-switch" role="group"
      aria-label="Учебный участок покровной системы">
      <button type="button" aria-pressed={!thickSkinKind}
       onClick={focusThinSkin}>Плечо · 4 слоя</button>
      <button type="button" aria-pressed={thickSkinKind==="palm"}
       onClick={()=>focusThickSkin("palm")}>Ладонь · 5 слоёв</button>
      <button type="button" aria-pressed={thickSkinKind==="sole"}
       onClick={()=>focusThickSkin("sole")}>Подошва · 5 слоёв</button>
     </div>
     {thickUnavailable&&<small role="status">Контур учебного участка
      пока не удалось найти на загруженной фигуре. Его расположение
      не подменяется случайным соседним участком.</small>}
     {thickSkinKind&&<p className="lek-anatomy-thick-skin-note">
      Виртуальный срез {thickSkinKind==="palm"?"ладонной":"подошвенной"}
      поверхности привязан к кисти или стопе в единой модели.
      Фронтальный силуэт не показывает, какая именно поверхность
      видна, поэтому это <b>учебная реконструкция</b>, а не
      микрофотография данной точки. В норме здесь нет волос
      и сальных желёз; присутствует блестящий слой.</p>}
     {epidermisSelection?
      <div ref={epidermisCardRef} className="lek-anatomy-epidermis-card" role="status" aria-live="polite">
       <strong>{EPIDERMIS_RECORDS[epidermisSelection].name}</strong>
       <em>{EPIDERMIS_RECORDS[epidermisSelection].latin}</em>
       <p>{EPIDERMIS_RECORDS[epidermisSelection].summary}</p>
       <p><b>Функция:</b> {EPIDERMIS_RECORDS[epidermisSelection].function}</p>
       <p><b>Под микроскопом:</b> {EPIDERMIS_RECORDS[epidermisSelection].microAppearance}</p>
       <a href={EPIDERMIS_RECORDS[epidermisSelection].source}
        target="_blank" rel="noopener noreferrer">
        Научный источник</a>
      </div>:
      <p className="lek-anatomy-epidermis-prompt">
       Выберите слой, чтобы увидеть его строение и функции.
      </p>}
     <div className="lek-anatomy-epidermis-actions">
      <button type="button" onClick={()=>focusEpidermis()}>
       {thickSkinKind?"К слоям участка":"К слоям плеча"}</button>
      <button type="button" onClick={()=>focusEpidermis(true)}>
       {thickSkinKind?"К деталям":"К клеткам"}</button>
     </div>
     <div className="lek-anatomy-epidermis-layer-list"
      role="group" aria-label="Слои эпидермиса от наружного к внутреннему">
      {(thickSkinKind?EPIDERMIS_THICK_STRATA_ORDER:
       EPIDERMIS_STRATA_ORDER).map(id=><button type="button" key={id}
       className={epidermisSelection===id?"is-selected":""}
       aria-pressed={epidermisSelection===id}
       onClick={()=>{setEpidermisSelection(id);setEpidermisSelectedPoint(null);}}>
       <span className={"lek-anatomy-epi-swatch is-"+id}
        aria-hidden="true"/>
       <span>{EPIDERMIS_RECORDS[id].name}</span>
      </button>)}
     </div>
     {!thickSkinKind&&<div className="lek-anatomy-epidermis-cell-list" role="group"
      aria-label="Клетки и границы">
      {(["keratinocyte","melanocyte","basement"] as const).map(id=>
       <button key={id} type="button" aria-pressed={epidermisSelection===id}
        className={epidermisSelection===id?"is-selected":""}
        onClick={()=>setEpidermisSelection(id)}>
        {EPIDERMIS_RECORDS[id].name}
       </button>)}
     </div>}
     <small>Авторская учебная реконструкция по Leeds, OpenStax и NCBI:
      относительная ширина разреза увеличена. Клеточные изображения
      не являются микрофотографией конкретной точки тела.</small>
    </section>
    <LektrusSkinSpecimens/>
    {displayCamera.scale>=22&&<p>В настоящей дерме встречаются
     фолликулы, потовые и сальные железы, сосуды и нервные окончания.
     Их расположение в этом учебном разрезе не воспроизведено
     без проверенных анатомических данных.</p>}
    {displayCamera.scale>=90&&<p>Для изучения сосочкового слоя,
     коллагена и расположения капилляров откройте сравнительные
     гистопрепараты. Цифровой зум здесь не является микроскопом.</p>}
    {displayCamera.scale>=145&&<p>В {thickSkinKind?
      "толстой коже (виртуальный разрез)":"тонкой коже плеча"} эпидермис
     снаружи внутрь: роговой, {thickSkinKind&&"блестящий, "}
     зернистый, шиповатый и базальный слои. У ладоней и подошв
     развит роговой слой, волос и сальных желёз нет.</p>}
    {displayCamera.scale>=250&&<p>{thickSkinKind?
     "В выбранном виртуальном разрезе толстой кожи показаны толстый роговой слой, узкий блестящий без ядер, зернистый, шиповатый и один базальный ряд. Эти элементы не являются точными клетками выбранного человека.":
     "В области правого плеча показаны безъядерные роговые чешуйки, гранулы зернистого, многогранные клетки шиповатого и один базальный ряд."}
     {" "}Нажмите на слой, чтобы прочитать пояснение; настоящие детали
     сравнивайте с гистопрепаратами ниже.</p>}
    <small>Виртуальный учебный разрез, не микрофотография.
     Ширина разреза и слоёв специально увеличена: их размер не
     соответствует толщине кожи относительно всего тела.
     Значения 65–105 мкм для адипоцитов и 17–27 мкм для
     кератиноцитов справочные, а не масштабная линейка рисунка.
     Точное положение микроструктур на нарисованном теле
     пока не подтверждено, поэтому условные петли сосудов
     и крупные клеточные символы здесь не показываются.
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
