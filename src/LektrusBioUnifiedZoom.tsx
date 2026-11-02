/** One camera, one viewport, one linked organism -> cell world.
 * Pointer, pinch, zoom and transitions all use the same 480x330 stage.
 * Deliberately avoids pretending different physical specimens are one photo.
 */
import {useCallback,useEffect,useMemo,useRef,useState} from "react";
import type {PointerEvent as ReactPointerEvent,KeyboardEvent as ReactKeyboardEvent} from "react";
import type {BioNode,BioOrganism,BioImageSpot} from "./lektrusBioMicroscopeModel";
import {BIO_LEVEL_LABELS,BIO_LEVELS,bioCellFeatures,bioNodes} from "./lektrusBioMicroscopeModel";
import LektrusBioAnatomyScene from "./LektrusBioAnatomyScene";
import {
 BIO_ZOOM_GATE,BIO_ZOOM_INITIAL,BIO_ZOOM_MAX,
 bioZoomAt,bioZoomBound,bioZoomPan,bioZoomToWorld,bioZoomClosestChild,bioZoomPoint,
 bioZoomImageFor,bioZoomSharedFrame,bioZoomPath,bioZoomChildCandidates,
 type BioZoomCamera
} from "./lektrusBioUnifiedZoomModel";
import "./lektrusBioUnifiedZoom.css";

type XY={x:number;y:number};
type Ghost={node:BioNode;camera:BioZoomCamera;direction:"in"|"out"};
const identity=(a:XY,b:XY)=>Math.hypot(a.x-b.x,a.y-b.y);
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
 const visits=useRef(new Map<string,BioZoomCamera>());
 const transitionTimer=useRef<number|undefined>(undefined);
 const route=bioZoomPath(nodes,current.id);
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
  ghostRef.current=false;setGhost(null);
  setCurrentId(organism);setCam(BIO_ZOOM_INITIAL);
  setFeature(null);setPhotoError(null);setNotice("");
 },[organism,setCam]);
 useEffect(()=>()=>{if(transitionTimer.current!==undefined)window.clearTimeout(transitionTimer.current);},[]);
 const transition=useCallback((target:BioNode,focusPoint?:BioImageSpot)=>{
  if(ghostRef.current||currentRef.current.id===target.id)return;
  const old=currentRef.current;
  // If the next depth is another view of the same real photograph, do not
  // swap specimens or restart its camera. The user truly magnifies the
  // already visible epidermal field rather than entering a new illustration.
  if(bioZoomSharedFrame(organism,old,target)){
   visits.current.set(old.id,cameraRef.current);
   currentRef.current=target;
   setCurrentId(target.id);
   if(target.parentId!==old.id)setCam(visits.current.get(target.id)??BIO_ZOOM_INITIAL);
   setFeature(null);setPhotoError(null);setNotice("");
   return;
  }
  const ascending=target.parentId!==old.id;
  const spot=focusPoint??{x:240,y:165};
  ghostRef.current=true;
  visits.current.set(old.id,cameraRef.current);
  const departing=ascending?cameraRef.current:
   bioZoomBound({x:(240-spot.x)*BIO_ZOOM_GATE,y:(165-spot.y)*BIO_ZOOM_GATE,scale:BIO_ZOOM_GATE});
  setGhost({node:old,camera:departing,direction:ascending?"out":"in"});
  currentRef.current=target;
  setCurrentId(target.id);
  setCam(ascending?(visits.current.get(target.id)??BIO_ZOOM_INITIAL):BIO_ZOOM_INITIAL);
  setFeature(null);setPhotoError(null);setNotice("");
  if(transitionTimer.current!==undefined)window.clearTimeout(transitionTimer.current);
  transitionTimer.current=window.setTimeout(()=>{
   setGhost(null);ghostRef.current=false;transitionTimer.current=undefined;
  },360);
 },[organism,setCam]);
 const descend=useCallback((child:BioNode)=>{
  const parent=currentRef.current;
  const all=bioZoomChildCandidates(nodes,parent);
  const index=all.findIndex(n=>n.id===child.id);
  if(index<0)return;
  const pt=bioZoomPoint(organism,parent,child,index,all.length);
  // Save the precise spot in the parent scene; when ascending it restores.
  const zoomed=bioZoomBound({scale:BIO_ZOOM_GATE,x:(240-pt.x)*BIO_ZOOM_GATE,y:(165-pt.y)*BIO_ZOOM_GATE});
  setCam(zoomed);
  transition(child,pt);
 },[nodes,organism,setCam,transition]);
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
   const nearby=bioZoomClosestChild(organism,node,candidates,imagePoint,68);
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
  pointers.current.set(e.pointerId,at(e.clientX,e.clientY));
 };
 const onMove=(e:ReactPointerEvent<HTMLDivElement>)=>{
  const map=pointers.current,previous=map.get(e.pointerId);
  if(!previous||ghostRef.current)return;
  const next=at(e.clientX,e.clientY),before=[...map.values()];
  map.set(e.pointerId,next);
  if(map.size>=2&&before.length>=2){
   const after=[...map.values()];
   const p0={x:(before[0].x+before[1].x)/2,y:(before[0].y+before[1].y)/2};
   const p1={x:(after[0].x+after[1].x)/2,y:(after[0].y+after[1].y)/2};
   const first=identity(before[0],before[1]),ratio=first>3?identity(after[0],after[1])/first:1;
   setCam(bioZoomPan(cameraRef.current,p1.x-p0.x,p1.y-p0.y));
   zoom(ratio,p1);
  }else setCam(bioZoomPan(cameraRef.current,next.x-previous.x,next.y-previous.y));
 };
 const onEnd=(e:ReactPointerEvent<HTMLDivElement>)=>{
  pointers.current.delete(e.pointerId);
  if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);
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
 const imgBlur=isMicroscopic?Math.abs(focus)*.24:0;
 const draw=(node:BioNode,cam:BioZoomCamera,includeMarkers:boolean)=>{
  const sceneChildren=bioZoomChildCandidates(nodes,node);
  const image=bioZoomImageFor(organism,node);
  return <div className="lektrus-bio-unified-world"
   style={{transform:"translate("+cam.x/480*100+"%, "+cam.y/330*100+"%) scale("+cam.scale+")",
    filter:"brightness("+(.5+light*.007)+" ) blur("+imgBlur.toFixed(1)+"px)"}}>
   {image&&photoError!==node.id?
    <img key={image.file} src={image.file} loading="lazy" draggable={false} alt={image.caption}
     className="lektrus-bio-unified-photo" onError={()=>setPhotoError(node.id)}/>:
    <LektrusBioAnatomyScene organism={organism} node={node} children={sceneChildren}
     interactive={false} onSelect={()=>{}} activeFeatureName={feature}
     onFeatureSelect={includeMarkers&&node.level==="cell"?setFeature:undefined}/>}
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
   {draw(current,camera,true)}
   {ghost&&<div className={"lektrus-bio-unified-ghost is-"+ghost.direction} aria-hidden="true">
    {draw(ghost.node,ghost.camera,false)}
   </div>}
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
