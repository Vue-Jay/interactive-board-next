/** ONE continuous, freely pannable human atlas canvas.
 * No page-changing "portal" on zoom: depth is a fractional 0..4 camera
 * coordinate and anatomical layers alpha-blend in the same world.
 * The art is a school teaching reconstruction, not a literal optical scan.
 */
import {useCallback,useEffect,useMemo,useRef,useState} from "react";
import type {PointerEvent as RP,KeyboardEvent as RK,CSSProperties} from "react";
import bodyImage from "./assets/bio-atlas/body.webp";
import organsImage from "./assets/bio-atlas/organs.webp";
import heartImage from "./assets/bio-atlas/heart.webp";
import tissueImage from "./assets/bio-atlas/tissue.webp";
import cellImage from "./assets/bio-atlas/cell.webp";
import {bioChildren,bioNodes,type BioNode} from "./lektrusBioMicroscopeModel";
import LektrusBioAnatomyScene from "./LektrusBioAnatomyScene";
import {
 HUMAN_ATLAS_WIDTH as W,HUMAN_ATLAS_HEIGHT as H,HUMAN_INITIAL_CAMERA,
 HUMAN_ZOOM_LABELS,humanScale,humanUnproject,humanZoomAt,humanFocusAt,
 humanPan,humanRegionAt,humanRegionAnchor,humanLayerOpacity,humanVisibleField,
 type HumanPoint,type HumanCamera,type HumanRegion
} from "./lektrusBioContinuousHumanModel";
import "./lektrusBioContinuousHuman.css";

type Pointer={id:number,x:number,y:number};
const dist=(a:HumanPoint,b:HumanPoint)=>Math.hypot(a.x-b.x,a.y-b.y);
const regionNames:Record<HumanRegion,string>={
 heart:"Сердце",lungs:"Лёгкие",brain:"Головной мозг",skin:"Кожа и покровы"
};
function SkinSection({depth}:{depth:number}){
 return <svg viewBox="0 0 480 330" preserveAspectRatio="xMidYMid slice"
  role="img" aria-label="Обобщённый учебный срез кожи человека">
  <defs>
   <linearGradient id="human-skin-section" x1="0" y1="0" x2=".9" y2="1">
    <stop stopColor="#f1c4ab"/><stop offset=".5" stopColor="#e8ae9f"/>
    <stop offset="1" stopColor="#d98f89"/>
   </linearGradient>
  </defs>
  <rect width="480" height="330" fill="#fff6ee"/>
  {depth<3?<>
   <path d="M0 64Q80 53 163 59T325 58T480 61V164H0Z"
    fill="#d6a38f" stroke="#a87268" strokeWidth="4"/>
   <path d="M0 87Q100 97 200 81T480 90V167H0Z"
    fill="#eab8a1" opacity=".85"/>
   <path d="M0 164Q106 148 206 164T480 163V275H0Z"
    fill="url(#human-skin-section)"/>
   <path d="M0 273Q115 256 236 277T480 274V330H0Z"
    fill="#efd399"/>
   {Array.from({length:16},(_,i)=>{
    const x=20+(i%8)*60,y=112+Math.floor(i/8)*30;
    return <ellipse key={i} cx={x} cy={y} rx="19" ry="13"
     fill="#f2ceba" stroke="#bd8a80" strokeWidth="2"/>;
   })}
   <path d="M160 55q12 33 7 87t-20 91" fill="none" stroke="#74514a"
    strokeWidth="12" strokeLinecap="round"/>
   <ellipse cx="152" cy="242" rx="23" ry="17" fill="#e7bab0" stroke="#a9797d" strokeWidth="3"/>
   <path d="M250 276Q280 192 323 243T423 260" stroke="#b95565"
    strokeWidth="12" fill="none"/>
   <path d="M250 285Q277 215 326 259T425 271" stroke="#779aaa"
    strokeWidth="6" fill="none"/>
   <text x="19" y="39" fontSize="18" fill="#764d4d" fontWeight="700">Эпидермис</text>
   <text x="345" y="187" fontSize="17" fill="#945f60" fontWeight="700">Дерма</text>
   <text x="25" y="309" fontSize="17" fill="#83683c" fontWeight="700">Подкожная клетчатка</text>
  </>:<>
   <path d="M50 113Q90 68 144 78H337Q406 92 417 156V262Q384 290 328 289H139Q76 273 50 238Z"
    fill="#efbeab" stroke="#b4817d" strokeWidth="7"/>
   <path d="M69 154Q105 117 151 127H334Q384 141 393 178V254Q350 269 321 270H142Q97 255 69 228Z"
    fill="#e8ad9e" stroke="#ce948b" strokeWidth="3"/>
   <ellipse cx="230" cy="222" rx="54" ry="36" fill="#c4a0c4" stroke="#967aa1" strokeWidth="5"/>
   <circle cx="223" cy="219" r="17" fill="#8e719e"/>
   {Array.from({length:8},(_,i)=>{
    const a=i*Math.PI/4;
    return <ellipse key={i} cx={231+111*Math.cos(a)} cy={188+69*Math.sin(a)}
     rx="17" ry="11" fill="#d89e84" stroke="#ac7a70" strokeWidth="2"/>;
   })}
   <text x="22" y="40" fontSize="19" fill="#774f52" fontWeight="750">Кератиноцит · учебная схема</text>
   <text x="25" y="312" fontSize="13" fill="#7b6966">Клетка эпидермиса с ядром</text>
  </>}
 </svg>;
}
function Layer({asset,node,opacity,className,annotation,depth}:{
 asset?:string;node?:BioNode;opacity:number;className:string;
 annotation?:string;depth?:number
}){
 if(opacity<=0)return null;
 return <div className={"lektrus-human-tile "+className}
  aria-hidden="true" style={{opacity}}>
  {asset?<img src={asset} alt="" draggable={false}/>:node?
   <LektrusBioAnatomyScene organism="human" node={node} children={[]}
    interactive={false} onSelect={()=>{}}/>:
   <SkinSection depth={depth??2}/>}
  {annotation&&<span className="lektrus-human-tile-label">{annotation}</span>}
 </div>;
}
export default function LektrusBioContinuousHuman(){
 const nodes=useMemo(()=>bioNodes("human"),[]);
 const [cam,setCamera]=useState<HumanCamera>(HUMAN_INITIAL_CAMERA);
 const camera=useRef<HumanCamera>(HUMAN_INITIAL_CAMERA);
 const [region,setRegion]=useState<HumanRegion>("heart");
 const [selectedSpot,setSpot]=useState<HumanPoint>({x:483,y:194});
 const [guided,setGuided]=useState(false);
 const [showLabels,setShowLabels]=useState(true);
 const [notice,setNotice]=useState("Наведите курсор на любую область тела и приближайте");
 const stage=useRef<HTMLDivElement>(null);
 const pointers=useRef(new Map<number,HumanPoint>());
 const started=useRef<{id:number;point:HumanPoint;moved:boolean}|null>(null);
 const lastTap=useRef<{point:HumanPoint;time:number}|null>(null);
 const anim=useRef<number|undefined>(undefined);
 const apply=useCallback((next:HumanCamera)=>{
  camera.current=next;setCamera(next);
 },[]);
 useEffect(()=>()=>{if(anim.current!==undefined)window.clearTimeout(anim.current);},[]);
 const travel=useCallback((target:HumanCamera)=>{
  setGuided(true);apply(target);
  if(anim.current!==undefined)window.clearTimeout(anim.current);
  anim.current=window.setTimeout(()=>{setGuided(false);anim.current=undefined;},460);
 },[apply]);
 const interrupt=useCallback(()=>{
  if(anim.current!==undefined)window.clearTimeout(anim.current);
  anim.current=undefined;setGuided(false);
 },[]);
 const coords=useCallback((x:number,y:number):HumanPoint=>{
  const rect=stage.current?.getBoundingClientRect();
  if(!rect||rect.width===0||rect.height===0)return {x:W/2,y:H/2};
  return {x:(x-rect.left)*W/rect.width,y:(y-rect.top)*H/rect.height};
 },[]);
 const choose=useCallback((point:HumanPoint)=>{
  const found=humanRegionAt(point);
  setRegion(found);setSpot(point);
  setNotice(found==="skin"
   ?"Эта область доступна для свободного приближения. Для неразмеченных структур показан типовой срез кожи."
   :"Выбран участок: "+regionNames[found]+". Приближайте дальше, чтобы увидеть внутреннее строение.");
 },[]);
 const zoom=useCallback((delta:number,point:HumanPoint)=>{
  interrupt();
  const before=camera.current;
  if(before.depth<.95&&delta>0)choose(humanUnproject(before,point));
  apply(humanZoomAt(before,before.depth+delta,point));
 },[apply,choose,interrupt]);
 useEffect(()=>{
  const element=stage.current;if(!element)return;
  const wheel=(e:WheelEvent)=>{
   if((e.target as Element).closest("button,input"))return;
   e.preventDefault();
   zoom(Math.max(-.38,Math.min(.38,-e.deltaY*.0018)),coords(e.clientX,e.clientY));
  };
  element.addEventListener("wheel",wheel,{passive:false});
  return ()=>element.removeEventListener("wheel",wheel);
 },[coords,zoom]);
 const press=(e:RP<HTMLDivElement>)=>{
  if((e.target as Element).closest("button,input,a"))return;
  if(e.pointerType==="mouse"&&e.button!==0)return;
  interrupt();
  e.currentTarget.setPointerCapture(e.pointerId);
  const point=coords(e.clientX,e.clientY);
  pointers.current.set(e.pointerId,point);
  if(pointers.current.size===1)started.current={id:e.pointerId,point,moved:false};
  else {started.current=null;lastTap.current=null;}
 };
 const move=(e:RP<HTMLDivElement>)=>{
  const old=pointers.current.get(e.pointerId);if(!old)return;
  const next=coords(e.clientX,e.clientY);
  const before=[...pointers.current.values()];
  pointers.current.set(e.pointerId,next);
  if(started.current?.id===e.pointerId&&dist(next,started.current.point)>7)
   started.current.moved=true;
  if(before.length>=2){
   const after=[...pointers.current.values()];
   const midpoint=(a:HumanPoint,b:HumanPoint):HumanPoint=>({
    x:(a.x+b.x)/2,y:(a.y+b.y)/2});
   const p0=midpoint(before[0],before[1]),p1=midpoint(after[0],after[1]);
   const d0=dist(before[0],before[1]),d1=dist(after[0],after[1]);
   let nextCam=humanPan(camera.current,p1.x-p0.x,p1.y-p0.y);
   if(d0>3&&d1>3){
    const depthDelta=Math.log(d1/d0)/Math.log(2.18);
    nextCam=humanZoomAt(nextCam,nextCam.depth+depthDelta,p1);
    if(camera.current.depth<.95&&depthDelta>.02)choose(humanUnproject(camera.current,p1));
   }
   apply(nextCam);
  }else apply(humanPan(camera.current,next.x-old.x,next.y-old.y));
 };
 const release=(e:RP<HTMLDivElement>)=>{
  const was=pointers.current.size,tracked=pointers.current.has(e.pointerId);
  pointers.current.delete(e.pointerId);
  if(e.currentTarget.hasPointerCapture(e.pointerId))
   e.currentTarget.releasePointerCapture(e.pointerId);
  const start=started.current;started.current=null;
  if(e.type!=="pointerup"||!tracked||was!==1||!start||start.id!==e.pointerId||
   start.moved)return;
  const point=coords(e.clientX,e.clientY);
  if(dist(point,start.point)>8)return;
  const world=humanUnproject(camera.current,point);
  if(camera.current.depth<.95)choose(world);
  if(e.pointerType==="touch"){
   const prev=lastTap.current;
   if(prev&&e.timeStamp-prev.time<330&&dist(point,prev.point)<28){
    lastTap.current=null;zoom(.68,point);
   }else lastTap.current={point,time:e.timeStamp};
  }
 };
 const changeLevel=(newDepth:number)=>{
  interrupt();
  if(newDepth===0)travel(HUMAN_INITIAL_CAMERA);
  else travel(humanFocusAt(humanRegionAnchor(region,selectedSpot),newDepth));
 };
 const choosePreset=(next:HumanRegion)=>{
  const point=humanRegionAnchor(next,selectedSpot);
  setRegion(next);setSpot(point);
  setNotice("Область: "+regionNames[next]+". Увеличение остаётся плавным.");
  travel(humanFocusAt(point,Math.max(1.15,camera.current.depth)));
 };
 const onKey=(e:RK<HTMLDivElement>)=>{
  if(e.target!==e.currentTarget)return;
  const pan:Record<string,HumanPoint>={
   ArrowLeft:{x:-27,y:0},ArrowRight:{x:27,y:0},
   ArrowUp:{x:0,y:-27},ArrowDown:{x:0,y:27}};
  if(pan[e.key]){e.preventDefault();interrupt();apply(humanPan(camera.current,pan[e.key].x,pan[e.key].y));}
  else if(e.key==="+"||e.key==="="){e.preventDefault();zoom(.3,{x:W/2,y:H/2});}
  else if(e.key==="-"){e.preventDefault();zoom(-.3,{x:W/2,y:H/2});}
  else if(e.key==="Home"||e.key==="Escape"){e.preventDefault();changeLevel(0);}
 };
 const scale=humanScale(cam.depth),layer=[0,1,2,3,4].map(i=>humanLayerOpacity(cam.depth,i));
 const root=region==="heart"?"кровеносная-система":region==="lungs"?"дыхательная-система":"нервная-система";
 const sys=nodes.find(n=>n.id==="human/"+root);
 const organ=sys?bioChildren(nodes,sys.id)[0]:undefined;
 const tissue=organ?bioChildren(nodes,organ.id)[0]:undefined;
 const cell=tissue?bioChildren(nodes,tissue.id)[0]:undefined;
 const isHeart=region==="heart";
 const isSkin=region==="skin";
 // All five tiers share one camera and one spatial coordinate; the retinal
 // and histological views are qualitative reconstructions, not the same
 // physical photomicrograph at a calibrated magnification.
 const spriteStyle:CSSProperties={
  transform:"translate("+(cam.panX/W*100)+"%, "+(cam.panY/H*100)+"%) scale("+scale+")"
 };
 const mini=humanVisibleField(cam);
 const activeLabel=HUMAN_ZOOM_LABELS[Math.min(4,Math.round(cam.depth))];
 return <section className="lektrus-human" aria-label="Непрерывный анатомический атлас человека">
  <div className="lektrus-human-intro">
   <div><span className="lektrus-human-eyebrow">LEKTRUS · BIOLOGY ATLAS</span>
    <h3>Человек. От организма до клетки</h3>
    <p>Один холст. Приближайте любую область тела, перемещайтесь по нему
     и наблюдайте, как постепенно открываются внутренние слои.</p>
   </div>
   <button type="button" className="lektrus-human-reset" onClick={()=>changeLevel(0)}>
    <span aria-hidden="true">↺</span> Весь организм
   </button>
  </div>
  <div className="lektrus-human-stage" ref={stage} tabIndex={0}
   role="application" aria-label="Атлас: колесо мыши или два пальца для приближения, перетаскивание для перемещения, плюс и минус для масштаба"
   onKeyDown={onKey} onPointerDown={press} onPointerMove={move}
   onPointerUp={release} onPointerCancel={release}>
   <div className="lektrus-human-backdrop" aria-hidden="true"/>
   <div className={"lektrus-human-world"+(guided?" is-travelling":"")}
    style={spriteStyle} aria-hidden="true">
    <div className="lektrus-human-body" style={{opacity:layer[0]}}>
     <img src={bodyImage} draggable={false} alt=""/>
    </div>
    <Layer className="lektrus-human-layer-organs" asset={isHeart?organsImage:undefined}
     node={isSkin?undefined:sys} depth={1} opacity={layer[1]}
     annotation={showLabels?"Внутреннее строение":undefined}/>
    <Layer className="lektrus-human-layer-organ" asset={isHeart?heartImage:undefined}
     node={isSkin?undefined:organ} depth={2} opacity={layer[2]}
     annotation={showLabels?(isSkin?"Кожа":regionNames[region]):undefined}/>
    <Layer className="lektrus-human-layer-tissue" asset={isHeart?tissueImage:undefined}
     node={isSkin?undefined:tissue} depth={3} opacity={layer[3]}
     annotation={showLabels?(isSkin?"Слои эпидермиса":"Ткань"):undefined}/>
    <Layer className="lektrus-human-layer-cell" asset={isHeart?cellImage:undefined}
     node={isSkin?undefined:cell} depth={4} opacity={layer[4]}
     annotation={showLabels?(isSkin?"Кератиноцит":"Клетка"):undefined}/>
    {cam.depth<1.15&&<span className="lektrus-human-beacon"
     style={{left:(483/W*100)+"%",top:(194/H*100)+"%",opacity:1-cam.depth/1.15}}/>}
   </div>
   <div className="lektrus-human-stage-caption">
    <span className="lektrus-human-depth-dot"/>
    <span>{activeLabel}</span>
    <span className="lektrus-human-caption-sep">/</span>
    <strong>{regionNames[region]}</strong>
   </div>
   <div className="lektrus-human-tip">Потяните, чтобы переместиться. Прокрутите или разведите два пальца для увеличения.</div>
   <div className="lektrus-human-minimap" aria-label="Расположение поля зрения на теле">
    <img src={bodyImage} draggable={false} alt=""/>
    <span className="lektrus-human-minimap-field" style={{
     left:(mini.x/W*100)+"%",top:(mini.y/H*100)+"%",
     width:(mini.width/W*100)+"%",height:(mini.height/H*100)+"%"
    }}/>
   </div>
   <div className="lektrus-human-zoom" aria-label="Управление масштабом">
    <button type="button" aria-label="Приблизить" onClick={()=>zoom(.28,{x:W/2,y:H/2})}>+</button>
    <input type="range" aria-label="Глубина приближения" min="0" max="4" step=".01"
     value={cam.depth} onChange={e=>changeLevel(Number(e.target.value))}/>
    <button type="button" aria-label="Отдалить" onClick={()=>zoom(-.28,{x:W/2,y:H/2})}>−</button>
   </div>
  </div>
  <div className="lektrus-human-levels" role="group" aria-label="Уровни анатомического приближения">
   {HUMAN_ZOOM_LABELS.map((label,i)=><button type="button" key={label}
    className={Math.abs(cam.depth-i)<.43?"is-current":""}
    aria-pressed={Math.abs(cam.depth-i)<.43} onClick={()=>changeLevel(i)}>
    <span className="lektrus-human-level-index">{i+1}</span>{label}
   </button>)}
  </div>
  <div className="lektrus-human-footer">
   <div className="lektrus-human-region-list" role="group" aria-label="Анатомические области">
    <span>Рассмотреть:</span>
    {(["heart","lungs","brain","skin"] as const).map(k=>
     <button type="button" key={k} aria-pressed={region===k}
      onClick={()=>choosePreset(k)}>{regionNames[k]}</button>)}
   </div>
   <label className="lektrus-human-label-option">
    <input type="checkbox" checked={showLabels}
     onChange={e=>setShowLabels(e.target.checked)}/> Подписи
   </label>
  </div>
  <p className="lektrus-human-notice" role="status">{notice}</p>
  <small className="lektrus-human-caveat">
   Учебный анатомический атлас, не медицинский снимок. Плавный цифровой масштаб не соответствует
   физическому оптическому увеличению. В неразмеченных областях показана типовая модель кожи,
   а не вымышленные внутренние органы.
  </small>
 </section>;
}
