import {useEffect,useId,useRef,useState,type PointerEvent} from "react";
import type {LabBench,LabVessel,LabGlassware,LabDose} from "./lektrusChemistryBenchModel";
import {addLabVessel,emptyLabVessel,labBenchSettings,labGlassware,labObservation,
 labIndicatorResult,positionLabVessel,removeLabVessel,selectedLabVessel,setLabBenchSettings,
 } from "./lektrusChemistryBenchModel";
import {reactionAppearance,substances} from "./lektrusReactionDatabase";
import {reagentAppearance} from "./lektrusLabAppearance";

const names:Record<LabGlassware,string>=Object.fromEntries(labGlassware.map(v=>[v.id,v.name])) as Record<LabGlassware,string>;
const shape:Record<LabGlassware,{inside:string;outline:string;liquid:string}> ={
 beaker:{
  inside:"M20 18H80V104Q80 116 68 116H32Q20 116 20 104Z",
  outline:"M17 14V105Q17 120 32 120H68Q83 120 83 105V14M15 14H85",
  liquid:"M18 69H82V103Q82 119 67 119H33Q18 119 18 103Z"
 },
 tube:{
  inside:"M33 13H67V101Q67 120 50 120Q33 120 33 101Z",
  outline:"M31 12V101Q31 123 50 123Q69 123 69 101V12M29 12H71",
  liquid:"M32 71H68V100Q68 122 50 122Q32 122 32 100Z"
 },
 flask:{
  inside:"M41 12H59V48L80 101Q84 119 66 119H34Q16 119 20 101L41 48Z",
  outline:"M40 10V47L18 102Q13 122 34 122H66Q87 122 82 102L60 47V10M38 10H62",
  liquid:"M27 75H73L81 103Q84 119 66 119H34Q16 119 19 103Z"
 },
 cylinder:{
  inside:"M28 10H72V109Q72 118 65 118H35Q28 118 28 109Z",
  outline:"M26 9V110Q26 121 35 121H65Q74 121 74 110V9M24 9H76",
  liquid:"M28 66H72V109Q72 118 65 118H35Q28 118 28 109Z"
 },
 dish:{
  inside:"M12 70Q14 117 50 117Q86 117 88 70Z",
  outline:"M12 70Q14 117 50 117Q86 117 88 70M12 70Q50 82 88 70",
  liquid:"M14 86Q50 94 86 86Q78 115 50 115Q22 115 14 86Z"
 }
};
export function LabVesselGraphic({vessel,small=false,showLabels=true}:{vessel:LabVessel;small?:boolean;showLabels?:boolean}){
 const id=useId().replace(/:/g,"");
 const result=labObservation(vessel);
 const verified=result.status==="reaction"?result.caseData:undefined;
 const visualCase=vessel.completedReaction??verified;
 const appearance=reactionAppearance(visualCase);
 const indicator=labIndicatorResult(vessel);
 const reagent=vessel.reagents[0]?reagentAppearance(vessel.reagents[0],vessel.environment):null;
 const active=Boolean(visualCase);
 const color=indicator?.color??(active?appearance.solutionAfter:reagent?.color??"#e7f3f3");
 const observation=visualCase?.observation??"none";
 const geo=shape[vessel.kind];
 const labels=vessel.reagents.map(r=>substances.find(s=>s.id===r)?.formula??r);
 return <div className={"lektrus-lab-vessel-art"+(small?" is-small":"")}>
  <svg viewBox="0 0 100 133" role="img" aria-label={names[vessel.kind]+": "+(labels.join(", ")||"пустой")}>
   <defs>
    <clipPath id={id+"clip"}><path d={geo.inside}/></clipPath>
    <linearGradient id={id+"glass"} x1="0" x2="1"><stop stopColor="#e9f6f4" stopOpacity=".35"/><stop offset=".3" stopColor="#fff" stopOpacity=".08"/><stop offset=".8" stopColor="#acc9c8" stopOpacity=".2"/><stop offset="1" stopColor="#fff" stopOpacity=".12"/></linearGradient>
   </defs>
   <ellipse cx="50" cy="126" rx="34" ry="4" fill="#254f49" opacity=".12"/>
   <path d={geo.inside} fill={"url(#"+id+"glass)"} stroke="none"/>
   <g clipPath={"url(#"+id+"clip)"}>
    {labels.length>0&&<path d={geo.liquid} fill={color} opacity={reagent?.phase==="solid"&&!active?.4:.78} className="lektrus-lab-fluid"/>}
    {labels.length>0&&reagent?.phase==="solid"&&!active&&Array.from({length:15},(_,i)=><circle
      key={"grain"+i} cx={31+(i*17)%38} cy={100+(i*13)%13} r={1.3+i%3*.65}
      fill={color} stroke="#526962" strokeOpacity=".24"/>)}
    {active&&observation==="precipitate"&&<>
     <rect className="lektrus-lab-sediment" x="16" y="106" width="70" height="18"
      fill={appearance.solidColor||"#d6dee1"} opacity=".94"/>
     {Array.from({length:18},(_,i)=><circle key={i} className="lektrus-lab-particle"
      cx={28+i*31%45} cy={76+i*13%31} r={1.1+i%3*.5}
      fill={appearance.solidColor||"#cddbe0"}
      style={{animationDelay:-(i%9)*.25+"s"}}/>)}
    </>}
    {active&&observation==="gas"&&Array.from({length:17},(_,i)=><circle key={i}
     className="lektrus-lab-bubble" cx={31+i*29%38} cy={98-i*17%45}
     r={2+i%3} stroke="#528eb1" strokeWidth=".9" fill="#fff" fillOpacity=".2"
     style={{animationDelay:-(i%8)*.27+"s",animationDuration:2+i%5*.32+"s"}}/>)}
   </g>
   <path d={geo.outline} fill="none" stroke="#75a4a4" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"/>
   <path d={geo.outline} fill="none" stroke="#fff" strokeWidth="1.25" opacity=".8" strokeLinecap="round"/>
   {vessel.indicator&&<g className="lektrus-lab-indicator-strip">
    <rect x="73" y="24" width="7" height="73" rx="2" fill="#f4edda" stroke="#9a9f91" strokeWidth="1" transform="rotate(12 76 60)"/>
    <rect x="73" y="71" width="7" height="24" rx="1" fill={indicator?.color??"#b5b9b3"} opacity=".95" transform="rotate(12 76 60)"/>
   </g>}
   <path d="M29 32V57" stroke="#fff" strokeWidth="5" strokeLinecap="round" opacity=".5"/>
  </svg>
  {showLabels&&<div className="lektrus-lab-vessel-label"><b>{names[vessel.kind]}</b>
   <span>{labels.length?labels.join(" + "):"Пусто"}</span>
  </div>}
  {indicator&&<span className="lektrus-lab-indicator-tag" title={indicator.note}>
   <span className="lektrus-lab-indicator-dot" style={{background:indicator.color??"#a2a9a4"}}/>
   {indicator.label}
  </span>}
  {active&&observation!=="none"&&showLabels&&<span className="lektrus-lab-effect-tag">
   {observation==="gas"?"↑ Газ":observation==="precipitate"?"↓ Осадок":
    observation==="color"?"◉ Цвет":observation==="heat"?"♨ Тепло":"Растворение"}
  </span>}
 </div>;
}
type SurfaceProps={
 bench:LabBench;editable?:boolean;
 pouringId?:string|null;
 onChange?:(bench:LabBench)=>void;
 onSelect?:(id:string)=>void;
 onPour?:(sourceId:string,targetId:string)=>void;
 onDropReagent?:(id:string,reagent:string,dose?:LabDose)=>void;
};
/** Furniture is part of the shared bench, not a second toolbar. Both the
 * editor and the board use these exact same interactions. */
export default function LektrusChemistryBenchSurface({bench,editable=false,pouringId,
 onChange,onSelect,onPour,onDropReagent}:SurfaceProps){
 const host=useRef<HTMLDivElement>(null);
 const gesture=useRef<{id:string;startX:number;startY:number;x:number;y:number;dragged:boolean}|null>(null);
 const shelfGesture=useRef<{kind:LabGlassware;startX:number;startY:number;dragged:boolean}|null>(null);
 const [preview,setPreview]=useState<{id:string;x:number;y:number}|null>(null);
 const [shelfGhost,setShelfGhost]=useState<{kind:LabGlassware;x:number;y:number}|null>(null);
 const [dropTarget,setDropTarget]=useState<string|null>(null);
 const [dropFurniture,setDropFurniture]=useState<"sink"|"glassware"|null>(null);
 const [transfer,setTransfer]=useState<{from:{x:number;y:number};to:{x:number;y:number}}|null>(null);
 const [cabinet,setCabinet]=useState<"reagents"|"glassware"|"settings"|null>(null);
 const [query,setQuery]=useState("");
 const [category,setCategory]=useState("Все");
 const [chosen,setChosen]=useState<string|null>(null);
 const [amount,setAmount]=useState("10");
 const [unit,setUnit]=useState<"ml"|"g">("ml");
 const [notice,setNotice]=useState("");
 const [sinkFlow,setSinkFlow]=useState(false);
 const settings=labBenchSettings(bench);
 const selected=selectedLabVessel(bench);
 const visibleSubstances=substances.filter(v=>
  (category==="Все"||category===v.kind)&&
  (v.formula+" "+v.name).toLocaleLowerCase("ru-RU").includes(query.trim().toLocaleLowerCase("ru-RU")));
 const reagent=chosen?substances.find(s=>s.id===chosen):null;
 const classes=["Все",...new Set(substances.map(s=>s.kind))];
 const rxn=selected?labObservation(selected):null;
 const shownReaction=(rxn?.status==="reaction"?rxn.caseData:undefined)??
  bench.vessels.map(v=>labObservation(v)).find(v=>v.status==="reaction")?.caseData;
 useEffect(()=>{if(!transfer)return;const timer=setTimeout(()=>setTransfer(null),900);return()=>clearTimeout(timer)},[transfer]);
 useEffect(()=>{if(!sinkFlow)return;const timer=setTimeout(()=>setSinkFlow(false),900);return()=>clearTimeout(timer)},[sinkFlow]);
 const point=(event:PointerEvent)=>{const rect=host.current?.getBoundingClientRect();
  if(!rect||!rect.width||!rect.height)return null;
  return{x:(event.clientX-rect.left)/rect.width*100,y:(event.clientY-rect.top)/rect.height*100};};
 const inGlassware=(p:{x:number;y:number})=>p.x>=74&&p.y>=7&&p.y<=43;
 const inSink=(p:{x:number;y:number})=>p.x>=76&&p.y>=52&&p.y<=87;
 const targetAt=(sourceId:string,p:{x:number;y:number})=>{
  const rect=host.current?.getBoundingClientRect();
  const source=bench.vessels.find(v=>v.id===sourceId);
  if(!rect||!source?.reagents.length||!onPour)return null;
  return bench.vessels.filter(v=>v.id!==sourceId).map(v=>({
   id:v.id,dist:Math.hypot((p.x-v.x)*rect.width/100,(p.y-v.y)*rect.height/100)
  })).filter(v=>v.dist<Math.min(115,Math.max(54,rect.width*.15))).sort((a,b)=>a.dist-b.dist)[0]?.id??null;
 };
 const transferVessel=(sourceId:string,targetId:string)=>{
  const from=bench.vessels.find(v=>v.id===sourceId),to=bench.vessels.find(v=>v.id===targetId);
  if(from&&to&&from.reagents.length)setTransfer({from:{x:from.x,y:from.y-12},
   to:{x:to.x,y:to.y-12}});
  onPour?.(sourceId,targetId);
 };
 const clean=(id:string)=>{
  const next=emptyLabVessel(bench,id);
  if(next===bench)return;
  onChange?.(next);setSinkFlow(true);setNotice("Содержимое слито в виртуальную раковину");
 };
 const returnGlass=(id:string)=>{
  const next=removeLabVessel(bench,id);
  if(next===bench){setNotice("Сначала слейте содержимое в раковину");return}
  onChange?.(next);setNotice("Чистая посуда возвращена в шкаф");
 };
 const take=(kind:LabGlassware,p?:{x:number;y:number})=>{
  const next=addLabVessel(bench,kind,p&&p.x>=21&&p.x<77&&p.y>=41?
   {x:p.x,y:p.y}:undefined);
  if(next===bench){setNotice("На столе не больше шести сосудов");return}
  onChange?.(next);setNotice("Посуда добавлена на стол");setCabinet(null);
 };
 const down=(event:PointerEvent<HTMLButtonElement>,v:LabVessel)=>{
  if(!editable||event.button!==0||!event.isPrimary)return;
  event.preventDefault();event.stopPropagation();const p=point(event);if(!p)return;
  gesture.current={id:v.id,startX:p.x,startY:p.y,x:v.x,y:v.y,dragged:false};
  event.currentTarget.setPointerCapture(event.pointerId);
 };
 const move=(event:PointerEvent<HTMLButtonElement>)=>{
  const g=gesture.current;if(!g||!editable)return;
  event.stopPropagation();const p=point(event),rect=host.current?.getBoundingClientRect();if(!p||!rect)return;
  if(Math.hypot((p.x-g.startX)*rect.width/100,(p.y-g.startY)*rect.height/100)>8)g.dragged=true;
  if(g.dragged){
   const furniture=inSink(p)?"sink":inGlassware(p)?"glassware":null;
   setDropFurniture(furniture);
   setDropTarget(furniture?null:targetAt(g.id,p));
   setPreview({id:g.id,x:Math.max(8,Math.min(92,g.x+p.x-g.startX)),
    y:Math.max(8,Math.min(92,g.y+p.y-g.startY))});
  }
 };
 const finish=(event:PointerEvent<HTMLButtonElement>)=>{
  const g=gesture.current;if(!g)return;gesture.current=null;
  event.preventDefault();event.stopPropagation();
  if(event.currentTarget.hasPointerCapture(event.pointerId))event.currentTarget.releasePointerCapture(event.pointerId);
  const p=point(event);
  if(g.dragged&&p){
   if(inSink(p))clean(g.id);
   else if(inGlassware(p))returnGlass(g.id);
   else{
    const target=targetAt(g.id,p);
    if(target)transferVessel(g.id,target);
    else onChange?.(positionLabVessel(bench,g.id,g.x+p.x-g.startX,g.y+p.y-g.startY));
   }
  }else if(!g.dragged&&pouringId&&pouringId!==g.id)transferVessel(pouringId,g.id);
  else if(!g.dragged)onSelect?.(g.id);
  setPreview(null);setDropTarget(null);setDropFurniture(null);
 };
 const beginShelf=(event:PointerEvent<HTMLButtonElement>,kind:LabGlassware)=>{
  if(!editable||event.button!==0||!event.isPrimary)return;
  event.stopPropagation();event.preventDefault();
  shelfGesture.current={kind,startX:event.clientX,startY:event.clientY,dragged:false};
  event.currentTarget.setPointerCapture(event.pointerId);
 };
 const moveShelf=(event:PointerEvent<HTMLButtonElement>)=>{
  const g=shelfGesture.current;if(!g)return;
  event.stopPropagation();const p=point(event);if(!p)return;
  if(Math.hypot(event.clientX-g.startX,event.clientY-g.startY)>7)g.dragged=true;
  if(g.dragged)setShelfGhost({kind:g.kind,x:p.x,y:p.y});
 };
 const finishShelf=(event:PointerEvent<HTMLButtonElement>)=>{
  const g=shelfGesture.current;if(!g)return;shelfGesture.current=null;
  event.stopPropagation();event.preventDefault();
  if(event.currentTarget.hasPointerCapture(event.pointerId))event.currentTarget.releasePointerCapture(event.pointerId);
  const p=point(event);if(g.dragged&&p&&p.x>=21&&p.x<77&&p.y>=42)
   take(g.kind,p);
  else if(!g.dragged)take(g.kind);
  setShelfGhost(null);
 };
 const dispense=()=>{
  if(!editable||!chosen)return;
  if(!selected){setNotice("Возьмите чистую посуду из шкафа");return}
  const value=Number(amount.replace(",","."));
  if(!Number.isFinite(value)||value<=0||value>10000){setNotice("Укажите количество больше нуля и не более 10000");return}
  const dose:LabDose={value:Math.round(value*100)/100,unit};
  onDropReagent?.(selected.id,chosen,dose);
  setNotice(chosen+" · "+dose.value+" "+(unit==="ml"?"мл":"г")+" добавлено в "+names[selected.kind]);
  setCabinet(null);setChosen(null);
 };
 const openCabinet=(next:"reagents"|"glassware"|"settings")=>{
  if(!editable)return;setCabinet(next);setNotice("");setChosen(null);
 };
 return <div className={"lektrus-lab-bench"+(!editable?" is-readonly":"")+
  (!settings.animateEffects?" lab-reduced-animation":"")} ref={host}
  aria-label="Интерактивный химический стол с шкафами и раковиной">
  <div className="lektrus-lab-bench-backdrop" aria-hidden="true">
   <div className="lektrus-lab-board-top">LEKTRUS <span>CHEM LAB</span></div>
   <div className="lektrus-lab-back-shelf"/>
   <div className="lektrus-lab-counter"/>
   <div className="lektrus-lab-counter-front"/>
  </div>
  {settings.showEquationBoard&&<div className="lektrus-lab-chalkboard" aria-live="polite">
   <small>УРАВНЕНИЕ РЕАКЦИИ</small>
   <strong>{shownReaction?.equation??"Выберите опыт и смешайте вещества"}</strong>
   {shownReaction&&<span>{shownReaction.description}</span>}
  </div>}
  <button type="button" className="lektrus-lab-reagent-furniture" data-board-interactive="true"
    disabled={!editable} onPointerDown={e=>e.stopPropagation()} onPointerUp={e=>e.stopPropagation()}
    onClick={e=>{e.stopPropagation();openCabinet("reagents")}}
    aria-label="Открыть шкаф реактивов" title="Шкаф реактивов · выбор вещества, объёма и массы">
   <span className="lektrus-lab-furniture-title">РЕАКТИВЫ</span>
   <span className="lektrus-lab-bottle-rack" aria-hidden="true">
    {["#66a8c7","#e3c17c","#a07ab5","#b4d9a3","#dda979","#6aaead"].map((color,i)=>
     <i key={i} style={{"--bottle-color":color} as React.CSSProperties}/>)}
   </span>
   <span className="lektrus-lab-furniture-foot">{editable?"Открыть шкаф":"Шкаф реактивов"}</span>
  </button>
  <div className={"lektrus-lab-glass-cupboard"+(dropFurniture==="glassware"?" is-dropzone":"")} data-board-interactive="true"
    onPointerDown={e=>e.stopPropagation()} onPointerUp={e=>e.stopPropagation()}>
   <span className="lektrus-lab-furniture-title">ПОСУДА</span>
   <div className="lektrus-lab-shelf-items">
    {labGlassware.map(kind=><button type="button" key={kind.id} disabled={!editable}
      className="lektrus-lab-shelf-item" title={"Взять: "+kind.name}
      aria-label={"Взять из шкафа "+kind.name} onPointerDown={e=>beginShelf(e,kind.id)}
      onPointerMove={moveShelf} onPointerUp={finishShelf}
      onPointerCancel={e=>{e.stopPropagation();shelfGesture.current=null;setShelfGhost(null)}}>
      <span className={"lektrus-lab-mini-glass is-"+kind.id} aria-hidden="true">♙</span>
      <small>{kind.name}</small>
     </button>)}
   </div>
   <span className="lektrus-lab-furniture-foot">Взять или вернуть пустую</span>
  </div>
  <button type="button" data-board-interactive="true"
   className={"lektrus-lab-sink"+(dropFurniture==="sink"?" is-dropzone":"")+
     (sinkFlow?" is-flowing":"")}
   disabled={!editable} onPointerDown={e=>e.stopPropagation()} onPointerUp={e=>e.stopPropagation()}
   onClick={e=>{e.stopPropagation();if(selected?.reagents.length)clean(selected.id);else setNotice("Выберите заполненный сосуд")}}
   title="Слейте выбранный раствор или перетащите сюда посуду"
   aria-label="Раковина: слить содержимое выбранного сосуда">
   <span className="lektrus-lab-sink-tap" aria-hidden="true">⌒</span>
   <span className="lektrus-lab-sink-basin" aria-hidden="true">◉</span>
   <small>СЛИВ</small>
  </button>
  <button type="button" data-board-interactive="true"
   className="lektrus-lab-settings-trigger" title="Настройки химического стола"
   aria-label="Настройки химического стола" disabled={!editable}
   onPointerDown={e=>e.stopPropagation()} onPointerUp={e=>e.stopPropagation()}
   onClick={e=>{e.stopPropagation();openCabinet("settings")}}>⚙</button>
  {bench.vessels.map((v,i)=>{
   const p=preview?.id===v.id?preview:v;
   const selectedVessel=bench.selectedId===v.id;
   return <button type="button" key={v.id} data-board-interactive="true"
    className={"lektrus-lab-vessel"+(selectedVessel?" selected":"")+
    (pouringId===v.id?" is-pouring":"")+
    (dropTarget===v.id?" is-drop-target":"")+
    (preview?.id===v.id&&dropTarget?" is-pour-drag":"")+
    (pouringId&&pouringId!==v.id?" is-pour-target":"")}
    style={{left:p.x+"%",top:p.y+"%",zIndex:selectedVessel||preview?.id===v.id?25:10+i}}
    disabled={!editable} aria-label={"Сосуд "+(i+1)+": "+names[v.kind]+
      (v.reagents.length?", "+v.reagents.join(", "):", пустой")}
    aria-pressed={selectedVessel} title={editable?
      "Выбрать или переместить; перетащить на сосуд для переливания, на раковину для слива, в шкаф для возврата":"Посуда"}
    onPointerDown={e=>down(e,v)} onPointerMove={move} onPointerUp={finish}
    onPointerCancel={e=>{e.stopPropagation();gesture.current=null;setPreview(null);
     setDropTarget(null);setDropFurniture(null)}}
    onDragOver={e=>{if(editable)e.preventDefault()}}
    onDrop={e=>{if(!editable)return;e.preventDefault();e.stopPropagation();
     const id=e.dataTransfer.getData("application/x-lektrus-reagent");
     if(id)onDropReagent?.(v.id,id);
    }}>
    <LabVesselGraphic vessel={v} showLabels={settings.showVesselLabels}/>
   </button>;
  })}
  {shelfGhost&&<div className="lektrus-lab-shelf-ghost"
    style={{left:shelfGhost.x+"%",top:shelfGhost.y+"%"}} aria-hidden="true">
    {names[shelfGhost.kind]}</div>}
  {transfer&&<svg className="lektrus-lab-pour-stream" viewBox="0 0 100 100"
    preserveAspectRatio="none" aria-hidden="true">
   <path d={`M ${transfer.from.x} ${transfer.from.y} Q ${(transfer.from.x+transfer.to.x)/2} ${Math.min(transfer.from.y,transfer.to.y)-12} ${transfer.to.x} ${transfer.to.y}`}
     fill="none" stroke="#58afe0" strokeWidth=".9" strokeLinecap="round"/>
  </svg>}
  {editable&&(dropTarget||pouringId||dropFurniture||notice)&&<div className="lektrus-lab-pour-hint" aria-live="polite">
   {dropFurniture==="sink"?"Отпустите для слива в раковину":
    dropFurniture==="glassware"?"Отпустите, чтобы вернуть пустую посуду":
    dropTarget?"Отпустите, чтобы перелить":
    pouringId?"Выберите посуду для переливания":notice}
  </div>}
  {cabinet&&<div className="lektrus-lab-furniture-modal" data-board-interactive="true"
   onPointerDown={e=>e.stopPropagation()} onPointerMove={e=>e.stopPropagation()}
   onPointerUp={e=>e.stopPropagation()} onClick={e=>e.stopPropagation()}>
    <section className="lektrus-lab-furniture-dialog" role="dialog" aria-modal="true"
     aria-label={cabinet==="reagents"?"Шкаф реактивов":cabinet==="glassware"?"Шкаф посуды":"Настройки химического стола"}>
     <header><strong>{cabinet==="reagents"?"Шкаф реактивов":cabinet==="glassware"?"Шкаф посуды":"Настройки стола"}</strong>
      <button type="button" aria-label="Закрыть шкаф" onClick={()=>setCabinet(null)}>×</button></header>
     {cabinet==="reagents"&&<>
      <div className="lektrus-lab-modal-filters">
       <input type="search" placeholder="Формула или название" value={query}
        onChange={e=>setQuery(e.target.value)} aria-label="Найти реактив"/>
       <select value={category} onChange={e=>setCategory(e.target.value)}
        aria-label="Класс реактива">
        {classes.map(c=><option key={c}>{c}</option>)}
       </select>
      </div>
      <div className="lektrus-lab-modal-reagents">
       {visibleSubstances.map(v=><button key={v.id} type="button"
        className={chosen===v.id?"active":""} aria-pressed={chosen===v.id}
        onClick={()=>{setChosen(v.id);setUnit(reagentAppearance(v.id).phase==="solid"?"g":"ml");setAmount(reagentAppearance(v.id).phase==="solid"?"1":"10")}}>
        <i style={{background:reagentAppearance(v.id).color}}/>
        <strong>{v.formula}</strong><span>{v.name}</span>
       </button>)}
       {!visibleSubstances.length&&<p>Ничего не найдено</p>}
      </div>
      <div className="lektrus-lab-modal-dose">
       <div><strong>{reagent?.name??"Выберите реактив"}</strong>
        <small>{reagent?reagentAppearance(reagent.id).label:"Сначала выберите вещество из шкафа"}</small>
       </div>
       <div className="lektrus-lab-dose-controls">
        <label>Количество
         <input type="number" inputMode="decimal" min="0.01" max="10000" step="0.1"
          value={amount} onChange={e=>setAmount(e.target.value)} /></label>
        <label>Единица
         <select value={unit} onChange={e=>setUnit(e.target.value as "ml"|"g")}>
          <option value="ml">мл</option><option value="g">г</option>
         </select></label>
        <button type="button" className="primary" disabled={!chosen||!selected}
         onClick={dispense}>Отлить в сосуд</button>
       </div>
       <small>Масса и объём фиксируются для учёта, но не используются как стехиометрический расчёт. {selected?"Выбран: "+names[selected.kind]:"Сначала возьмите посуду."}</small>
      </div>
     </>}
     {cabinet==="glassware"&&<div className="lektrus-lab-modal-ware">
      {labGlassware.map(v=><button type="button" key={v.id}
       disabled={bench.vessels.length>=6} onClick={()=>take(v.id)}>
       <span className={"lektrus-lab-mini-glass is-"+v.id}>♙</span>
       <strong>{v.name}</strong><small>{v.description}</small></button>)}
      <p>В шкаф возвращается только пустая посуда. Сначала слейте содержимое в раковину.</p>
     </div>}
     {cabinet==="settings"&&<div className="lektrus-lab-modal-settings">
      <p>Настройки принадлежат этому химическому столу и сохраняются с ним.</p>
      {([
       ["showEquationBoard","Доска с уравнениями","Показывать на стене уравнение проверенной реакции"],
       ["showVesselLabels","Подписи посуды","Показывать названия и содержимое сосудов"],
       ["animateEffects","Анимации","Газ, осадок, переливание и слив"]
      ] as const).map(([id,title,description])=><label key={id}>
       <span><strong>{title}</strong><small>{description}</small></span>
       <input type="checkbox" checked={settings[id]}
        onChange={e=>onChange?.(setLabBenchSettings(bench,{[id]:e.target.checked}))}/>
      </label>)}
     </div>}
    </section>
   </div>}
 </div>;
}
