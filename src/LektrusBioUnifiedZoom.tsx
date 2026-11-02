/** One camera, one viewport, one linked organism -> cell world.
 * Pointer, pinch, zoom and transitions all use the same 480x330 stage.
 * Deliberately avoids pretending different physical specimens are one photo.
 */
import {useCallback,useEffect,useMemo,useRef,useState} from "react";
import type {PointerEvent as ReactPointerEvent,KeyboardEvent as ReactKeyboardEvent,CSSProperties} from "react";
import type {BioNode,BioOrganism,BioImageSpot} from "./lektrusBioMicroscopeModel";
import {BIO_LEVEL_LABELS,BIO_LEVELS,bioCellFeatures,bioNodes} from "./lektrusBioMicroscopeModel";
import LektrusBioAnatomyScene from "./LektrusBioAnatomyScene";
import LektrusBioParentOverview from "./LektrusBioParentOverview";
import {
 BIO_ZOOM_GATE,BIO_ZOOM_INITIAL,BIO_ZOOM_MAX,
 bioZoomAt,bioZoomBound,bioZoomPan,bioZoomToWorld,bioZoomClosestChild,bioZoomPoint,
 bioZoomPortalCamera,bioZoomHitRadius,bioZoomScreenPoint,bioZoomParentContext,
 bioZoomImageFor,bioZoomSharedFrame,bioZoomPath,bioZoomChildCandidates,
 type BioZoomCamera
} from "./lektrusBioUnifiedZoomModel";
import "./lektrusBioUnifiedZoom.css";

type XY={x:number;y:number};
type Ghost={node:BioNode;from:BioZoomCamera;to:BioZoomCamera;direction:"in"|"out";spot?:BioImageSpot};
const identity=(a:XY,b:XY)=>Math.hypot(a.x-b.x,a.y-b.y);
const cameraTransform=(cam:BioZoomCamera)=>
 "translate("+(cam.x/480*100)+"%, "+(cam.y/330*100)+"%) scale("+cam.scale+")";
export default function LektrusBioUnifiedZoom({organism}:{organism:BioOrganism}){
 const nodes=useMemo(()=>bioNodes(organism),[organism]);
 const [currentId,setCurrentId]=useState<string>(organism);
 const current=nodes.find(n=>n.id===currentId)??nodes[0];
 const [camera,setCamera]=useState<BioZoomCamera>(BIO_ZOOM_INITIAL);
 const cameraRef=useRef<BioZoomCamera>(BIO_ZOOM_INITIAL);
 const currentRef=useRef(current);
 currentRef.current=current;
 const [ghost,setGhost]=useState<Ghost|null>(null);
 const ghostRef=useRef(false);
 const [feature,setFeature]=useState<string|null>(null);
 const [notice,setNotice]=useState("");
 const [focus,setFocus]=useState(0);
 const [light,setLight]=useState(75);
 const [photoError,setPhotoError]=useState<string|null>(null);
 const viewport=useRef<HTMLDivElement>(null);
 const pointers=useRef(new Map<number,XY>());
 const gestureStart=useRef<{id:number;point:XY;moved:boolean}|null>(null);
 const lastTap=useRef<{point:XY;at:number}|null>(null);
 const visits=useRef(new Map<string,BioZoomCamera>());
 const transitionTimer=useRef<number|undefined>(undefined);
 const route=bioZoomPath(nodes,current.id);
 const parentContext=bioZoomParentContext(organism,nodes,current);
 const children=bioZoomChildCandidates(nodes,current);
 const photo=bioZoomImageFor(organism,current);
 const cellParts=bioCellFeatures(current);
 const selectedFeature=cellParts.find(x=>x.name===feature);
 const stageLevel=BIO_LEVELS.indexOf(current.level);
 const isMicroscopic=stageLevel>=3;
 const setCam=useCallback((next:BioZoomCamera)=>{
  const bounded=bioZoomBound(next);cameraRef.current=bounded;setCamera(bounded);
 },[]);
 useEffect(()=>{
  if(transitionTimer.current!==undefined)window.clearTimeout(transitionTimer.current);
  visits.current.clear();
  pointers.current.clear();gestureStart.current=null;lastTap.current=null;
  ghostRef.current=false;setGhost(null);
  setCurrentId(organism);setCam(BIO_ZOOM_INITIAL);
  setFeature(null);setPhotoError(null);setNotice("");
 },[organism,setCam]);
 useEffect(()=>()=>{if(transitionTimer.current!==undefined)window.clearTimeout(transitionTimer.current);},[]);
 const transition=useCallback((target:BioNode,focusPoint?:BioImageSpot)=>{
  if(ghostRef.current||currentRef.current.id===target.id)return;
  const old=currentRef.current;
  const departingCamera=cameraRef.current;
  const descending=target.parentId===old.id;
  const spot=focusPoint??{x:240,y:165};
  // Save the actual frame the observer saw, BEFORE any portal animation.
  // The preceding implementation saved a temporary camera already zoomed
  // to a child, causing a jump and a wrong Back position.
  visits.current.set(old.id,departingCamera);
  pointers.current.clear();gestureStart.current=null;lastTap.current=null;
  if(bioZoomSharedFrame(organism,old,target)){
   // The sunflower stomatal imprint is one genuine field across two depths.
   // Here we increase the digital magnification of THAT SAME photograph,
   // rather than cross-fading to a fictitious different sample.
   const incoming=descending
    ?bioZoomAt(departingCamera,Math.min(BIO_ZOOM_MAX,
       Math.max(departingCamera.scale+.15,departingCamera.scale*1.28)),
       bioZoomScreenPoint(departingCamera,spot))
    :(visits.current.get(target.id)??BIO_ZOOM_INITIAL);
   currentRef.current=target;setCurrentId(target.id);
   setCam(incoming);setFeature(null);setPhotoError(null);setNotice("");
   return;
  }
  const endingCamera=descending
   ?bioZoomPortalCamera(departingCamera,spot)
   :bioZoomAt(departingCamera,Math.max(1,departingCamera.scale*.67),{x:240,y:165});
  ghostRef.current=true;
  setGhost({node:old,from:departingCamera,to:endingCamera,
   direction:descending?"in":"out",spot:descending?spot:undefined});
  currentRef.current=target;setCurrentId(target.id);
  setCam(visits.current.get(target.id)??BIO_ZOOM_INITIAL);
  setFeature(null);setPhotoError(null);setNotice("");
  if(transitionTimer.current!==undefined)window.clearTimeout(transitionTimer.current);
  transitionTimer.current=window.setTimeout(()=>{
   setGhost(null);ghostRef.current=false;transitionTimer.current=undefined;
  },440);
 },[organism,setCam]);
 const descend=useCallback((child:BioNode)=>{
  const parent=currentRef.current;
  const all=bioZoomChildCandidates(nodes,parent);
  const index=all.findIndex(n=>n.id===child.id);
  if(index<0)return;
  const pt=bioZoomPoint(organism,parent,child,index,all.length);
  // The portal starts at the real parent camera and travels to THIS spot.
  // Do not apply a temporary magnified frame before saving the parent view.
  transition(child,pt);
 },[nodes,organism,transition]);
 const ascend=useCallback(()=>{
  const parent=nodes.find(n=>n.id===currentRef.current.parentId);
  if(parent)transition(parent);
  else {setCam(BIO_ZOOM_INITIAL);setNotice("Виден весь организм");}
 },[nodes,setCam,transition]);
 const at=(clientX:number,clientY:number):XY=>{
  const rect=viewport.current?.getBoundingClientRect();
  if(!rect||rect.width<=0||rect.height<=0)return {x:240,y:165};
  // PreserveAspectRatio 480×330 and matching viewport ratio.
  return {x:Math.min(480,Math.max(0,(clientX-rect.left)/rect.width*480)),
          y:Math.min(330,Math.max(0,(clientY-rect.top)/rect.height*330))};
 };
 const zoom=useCallback((multiplier:number,point:XY)=>{
  if(ghostRef.current)return;
  const node=currentRef.current,old=cameraRef.current;
  const desired=old.scale*multiplier;
  if(multiplier<1&&node.parentId&&desired<.97){
   ascend();return;
  }
  if(multiplier>1&&desired>=BIO_ZOOM_GATE){
   const candidates=bioZoomChildCandidates(nodes,node);
   const imagePoint=bioZoomToWorld(old,point);
   // Only zoom deeper when pointer really lies over a linked anatomical spot.
   const nearby=bioZoomClosestChild(organism,node,candidates,imagePoint,bioZoomHitRadius(old));
   if(nearby){descend(nearby.child);return;}
   if(candidates.length>0)setNotice("Переместите указатель к подсвеченной области, чтобы увидеть следующий слой");
   else setNotice("Это последний проверенный уровень строения. Ниже нет достоверного изображения.");
  }else if(multiplier<1){setNotice("");}
  setCam(bioZoomAt(old,desired,point));
 },[ascend,descend,nodes,organism,setCam]);
 useEffect(()=>{
  const el=viewport.current;if(!el)return;
  const onWheel=(e:WheelEvent)=>{
   e.preventDefault();
   const rect=el.getBoundingClientRect();
   zoom(Math.exp(-e.deltaY*.0017),
    {x:(e.clientX-rect.left)/rect.width*480,y:(e.clientY-rect.top)/rect.height*330});
  };
  el.addEventListener("wheel",onWheel,{passive:false});
  return ()=>el.removeEventListener("wheel",onWheel);
 },[zoom]);
 const onDown=(e:ReactPointerEvent<HTMLDivElement>)=>{
  if(e.pointerType==="mouse"&&e.button!==0)return;
  e.currentTarget.setPointerCapture(e.pointerId);
  const point=at(e.clientX,e.clientY);
  pointers.current.set(e.pointerId,point);
  if(e.pointerType==="touch"&&pointers.current.size===1)
   gestureStart.current={id:e.pointerId,point,moved:false};
  else if(pointers.current.size>1)gestureStart.current=null;
 };
 const onMove=(e:ReactPointerEvent<HTMLDivElement>)=>{
  const map=pointers.current,previous=map.get(e.pointerId);
  if(!previous||ghostRef.current)return;
  const next=at(e.clientX,e.clientY),before=[...map.values()];
  map.set(e.pointerId,next);
  if(gestureStart.current?.id===e.pointerId&&identity(next,gestureStart.current.point)>13)
   gestureStart.current.moved=true;
  if(map.size>=2&&before.length>=2){
   gestureStart.current=null;lastTap.current=null;
   const after=[...map.values()];
   const p0={x:(before[0].x+before[1].x)/2,y:(before[0].y+before[1].y)/2};
   const p1={x:(after[0].x+after[1].x)/2,y:(after[0].y+after[1].y)/2};
   const first=identity(before[0],before[1]),ratio=first>3?identity(after[0],after[1])/first:1;
   setCam(bioZoomPan(cameraRef.current,p1.x-p0.x,p1.y-p0.y));
   zoom(ratio,p1);
  }else setCam(bioZoomPan(cameraRef.current,next.x-previous.x,next.y-previous.y));
 };
 const onEnd=(e:ReactPointerEvent<HTMLDivElement>)=>{
  const count=pointers.current.size,wasTracked=pointers.current.has(e.pointerId);
  pointers.current.delete(e.pointerId);
  if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);
  // Native-feeling mobile microscope: two short taps focus on the tapped
  // field, but never reinterpret a drag, pinch or anatomical marker as a tap.
  const start=gestureStart.current;
  gestureStart.current=null;
  if(e.type!=="pointerup"||e.pointerType!=="touch"||!wasTracked||count!==1||
     !start||start.id!==e.pointerId||start.moved||ghostRef.current)return;
  const point=at(e.clientX,e.clientY);
  if(identity(point,start.point)>13){lastTap.current=null;return;}
  const now=e.timeStamp,last=lastTap.current;
  if(last&&now-last.at<340&&identity(last.point,point)<32){
   lastTap.current=null;zoom(1.75,point);
  }else lastTap.current={point,at:now};
 };
 const key=(e:ReactKeyboardEvent<HTMLDivElement>)=>{
  const keys:Record<string,XY>={ArrowLeft:{x:-24,y:0},ArrowRight:{x:24,y:0},
   ArrowUp:{x:0,y:-24},ArrowDown:{x:0,y:24}};
  if(keys[e.key]){
   e.preventDefault();
   setCam(bioZoomPan(cameraRef.current,keys[e.key].x,keys[e.key].y));
  }else if(e.key==="+"||e.key==="="){e.preventDefault();zoom(1.3,{x:240,y:165});}
  else if(e.key==="-"){e.preventDefault();zoom(.7,{x:240,y:165});}
  else if(e.key==="Backspace"){e.preventDefault();ascend();}
  else if(e.key==="Home"){e.preventDefault();setCurrentId(organism);setCam(BIO_ZOOM_INITIAL);}
 };
 const draw=(node:BioNode,cam:BioZoomCamera,includeMarkers:boolean,portalTo?:BioZoomCamera,portalSpot?:BioImageSpot)=>{
  const imgBlur=BIO_LEVELS.indexOf(node.level)>=3?Math.abs(focus)*.24:0;
  const sceneChildren=bioZoomChildCandidates(nodes,node);
  const image=bioZoomImageFor(organism,node);
  const portalStyle=portalTo
   ?{"--bio-ghost-start":cameraTransform(cam),"--bio-ghost-end":cameraTransform(portalTo)} as CSSProperties
   :{};
  return <div className="lektrus-bio-unified-world"
   style={{...portalStyle,transform:cameraTransform(cam),
    filter:"brightness("+(.5+light*.007)+" ) blur("+imgBlur.toFixed(1)+"px)"}}>
   {image&&photoError!==node.id?
    <img key={image.file} src={image.file} loading="lazy" draggable={false} alt={image.caption}
     className="lektrus-bio-unified-photo" onError={()=>setPhotoError(node.id)}/>:
    <LektrusBioAnatomyScene organism={organism} node={node} children={sceneChildren}
     interactive={false} onSelect={()=>{}} activeFeatureName={feature}
     onFeatureSelect={includeMarkers&&node.level==="cell"?setFeature:undefined}/>}
   {portalSpot&&<svg className="lektrus-bio-portal-mark" viewBox="0 0 480 330"
      aria-hidden="true" pointerEvents="none">
     <circle data-bio-portal-focus="true" cx={portalSpot.x} cy={portalSpot.y}
      r="42" fill="#f7edb8" fillOpacity=".12" stroke="#fff0c1"
      strokeWidth="4" strokeDasharray="10 5"/>
     <circle cx={portalSpot.x} cy={portalSpot.y} r="10" fill="none" stroke="#ffe69b" strokeWidth="5"/>
   </svg>}
   {includeMarkers&&sceneChildren.length>0&&<svg className="lektrus-bio-unified-anchors" viewBox="0 0 480 330"
    aria-label="Точки следующего уровня">
    {sceneChildren.map((child,i)=>{
     const spot=bioZoomPoint(organism,node,child,i,sceneChildren.length);
     return <g key={child.id} transform={"translate("+spot.x+" "+spot.y+")"}
      role="button" tabIndex={0} aria-label={"Приблизить: "+child.name}
      data-bio-zoom-target={child.id} className="lektrus-bio-unified-hotspot"
      onPointerDown={e=>e.stopPropagation()}
      onClick={e=>{e.stopPropagation();descend(child);}}
      onKeyDown={e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();descend(child);}}}>
      <circle r="28" className="lektrus-bio-unified-halo"/>
      <circle r="13" className="lektrus-bio-unified-dot"/>
      <circle r="4" fill="#d6f8e0"/>
      <title>{child.name}</title>
     </g>;
    })}
   </svg>}
  </div>;
 };
 return <section className="lektrus-bio-unified" aria-label="Непрерывное исследование организма">
  <div className="lektrus-bio-unified-heading">
   <div><span className="lektrus-bio-unified-kicker">ГЛУБИНА ИССЛЕДОВАНИЯ · {stageLevel+1} / 5</span>
    <strong>{current.name}</strong>
    <small>{BIO_LEVEL_LABELS[current.level]} · {organism==="pine"?"Pinus sylvestris":"Анатомическая схема"}</small>
   </div>
   <div className="lektrus-bio-unified-header-actions">
    {current.parentId&&<button type="button" onClick={ascend} aria-label="Вернуться на один уровень">← Назад</button>}
    <button type="button" onClick={()=>{setCurrentId(organism);setCam(BIO_ZOOM_INITIAL);setFeature(null);setNotice("");}}>
     Весь организм
    </button>
   </div>
  </div>
  <div className="lektrus-bio-unified-breadcrumbs" role="navigation" aria-label="Путь приближения">
   {route.map((n,i)=><button key={n.id} aria-current={i===route.length-1?"step":undefined}
    onClick={()=>{if(n.id!==current.id)transition(n);}}>
    {n.name}</button>)}
  </div>
  <div className="lektrus-bio-unified-viewport" ref={viewport} role="region" tabIndex={0}
   aria-label="Область исследования: перемещайте объект, колесом или двумя пальцами увеличивайте выбранный участок"
   onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onEnd}
   onPointerCancel={onEnd} onLostPointerCapture={e=>pointers.current.delete(e.pointerId)}
   onKeyDown={key}>
   <div className={"lektrus-bio-unified-arriving"+(ghost?" is-transitioning":"")}>
    {draw(current,camera,true)}
   </div>
   {ghost&&<div className={"lektrus-bio-unified-ghost is-"+ghost.direction} aria-hidden="true">
    {draw(ghost.node,ghost.from,false,ghost.to,ghost.spot)}
   </div>}
   {parentContext&&<LektrusBioParentOverview key={parentContext.parent.id}
    organism={organism} context={parentContext}
    parentCamera={visits.current.get(parentContext.parent.id)??BIO_ZOOM_INITIAL}
    onBack={ascend}/>}
   <div className="lektrus-bio-unified-hud" aria-hidden="true">
    <span>{BIO_LEVEL_LABELS[current.level]}</span><span>Масштаб просмотра ×{camera.scale.toFixed(1)}</span>
   </div>
   {notice&&<div className="lektrus-bio-unified-notice" role="status">{notice}</div>}
  </div>
  <div className="lektrus-bio-unified-controls" aria-label="Управление просмотром">
   <div className="lektrus-bio-unified-zoom-control">
    <button type="button" aria-label="Отдалить" onClick={()=>zoom(.73,{x:240,y:165})}>−</button>
    <label>Приближение <input type="range" min="1" max={BIO_ZOOM_MAX} step=".03"
      value={camera.scale} aria-label="Плавное увеличение текущей структуры"
      onChange={e=>zoom(Number(e.target.value)/cameraRef.current.scale,{x:240,y:165})}/></label>
    <button type="button" aria-label="Приблизить" onClick={()=>zoom(1.4,{x:240,y:165})}>+</button>
   </div>
   <label>Освещение <input type="range" min="25" max="100" value={light}
    onChange={e=>setLight(Number(e.target.value))} aria-label="Яркость изображения"/></label>
   {isMicroscopic&&<label>Фокусировка <input type="range" min="-8" max="8" value={focus}
    onChange={e=>setFocus(Number(e.target.value))} aria-label="Фокусировка изображения"/></label>}
  </div>
  <div className="lektrus-bio-unified-details">
   <p>{current.description}</p>
   {photo&&<div className="lektrus-bio-unified-photo-source">
    <span>Реальное изображение: {photo.caption}</span>
    <a href={photo.source} target="_blank" rel="noopener noreferrer">{photo.author} · {photo.license} · Wikimedia Commons</a>
    <small>Учебная фотосерия одного вида, но разных экземпляров и препаратов. При переходе на следующий уровень используется новое изображение, а не оптическая съёмка той же точки.</small>
   </div>}
   {cellParts.length>0&&<div className="lektrus-bio-unified-cell-parts">
    <strong>Строение клетки</strong>
    {cellParts.map(x=><button type="button" key={x.name} className={feature===x.name?"is-active":""}
     onClick={()=>setFeature(x.name)}>{x.name}</button>)}
    {selectedFeature&&<p role="status"><b>{selectedFeature.name}:</b> {selectedFeature.description}</p>}
   </div>}
   {children.length>0&&<div className="lektrus-bio-unified-branches" aria-label="Доступные области">
    <strong>Приблизьте нужную область</strong>
    {children.map(child=><button type="button" key={child.id} onClick={()=>descend(child)}>{child.name}</button>)}
   </div>}
   <small className="lektrus-bio-unified-honesty">
    Навигация непрерывная, но иллюстрации разных уровней являются научно-предметными реконструкциями или разными фотопрепаратами. Увеличение и фокусировка цифровые, физический микрометровый масштаб не измерен.
   </small>
  </div>
 </section>;
}
