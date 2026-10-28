import {useEffect,useId,useRef,useState,type PointerEvent} from "react";
import {createPortal} from "react-dom";
import type {LabBench,LabVessel,LabGlassware,LabDose} from "./lektrusChemistryBenchModel";
import {addLabVessel,emptyLabVessel,labBenchSettings,labGlassware,labObservation,
 labIndicatorResult,labDevices,toggleLabDevice,useLabDevice,positionLabVessel,putLabReagent,removeLabVessel,selectedLabVessel,setLabBenchSettings,
 } from "./lektrusChemistryBenchModel";
import {reactionAppearance,reviewedReactionCases,substances,type Observation} from "./lektrusReactionDatabase";
import {reagentAppearance} from "./lektrusLabAppearance";
import {buildLabCatalog,cabinetColor,cabinetPhase,phaseNames,type CatalogueGroup,type CatalogueSort,type StoragePhase}
 from "./lektrusLabCatalog";
import {titrationReading} from "./lektrusLabTitration";
import LektrusLabTitrationPanel from "./LektrusLabTitrationPanel";

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
 },
 conical:{
  inside:"M39 12H61V55L86 105Q88 119 73 120H27Q12 119 14 105L39 55Z",
  outline:"M38 10V55L13 105Q9 123 27 123H73Q91 123 87 105L62 55V10M36 10H64",
  liquid:"M27 88H73L84 108Q86 120 70 120H30Q14 120 16 108Z"
 },
 volumetric:{
  inside:"M44 9H56V61Q83 75 82 98Q82 121 50 122Q18 121 18 98Q17 75 44 61Z",
  outline:"M43 8V60Q17 72 17 98Q17 124 50 124Q83 124 83 98Q83 72 57 60V8M40 8H60",
  liquid:"M26 91Q50 87 74 91Q83 117 50 120Q17 117 26 91Z"
 },
 crucible:{
  inside:"M22 61H78L72 112Q69 120 50 120Q31 120 28 112Z",
  outline:"M19 58H81L74 113Q70 124 50 124Q30 124 26 113ZM18 57H82",
  liquid:"M26 83H74L69 113Q50 122 31 113Z"
 },
 pipette:{
  inside:"M45 9H55V52L61 76Q62 92 55 99V121H45V99Q38 92 39 76L45 52Z",
  outline:"M43 7H57V50L63 75Q65 92 57 101V125H43V101Q35 92 37 75L43 50ZM40 8H60",
  liquid:"M42 78H58Q62 93 55 101V121H45V101Q38 93 42 78Z"
 },
 burette:{
  inside:"M44 8H56V108H44Z",
  outline:"M43 7H57V111H43ZM39 111H61M50 111V126",
  liquid:"M45 33H55V107H45Z"
 },
 funnel:{
  inside:"M13 35H87L55 83V122H45V83Z",
  outline:"M12 33H88L56 83V124H44V83ZM12 33H88",
  liquid:"M21 47H79L55 85H45Z"
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
 const singlePhase=vessel.reagents.length===1&&!active?reagent?.phase:undefined;
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
    {labels.length>0&&singlePhase!=="solid"&&singlePhase!=="metal"&&singlePhase!=="gas"&&
     <path d={geo.liquid} fill={color} opacity=".76" className="lektrus-lab-fluid"/>}
    {labels.length>0&&(singlePhase==="solid"||singlePhase==="metal")&&<>
     <path d="M17 107Q29 99 47 103Q69 98 82 107L79 119H21Z" fill={color} opacity=".88"/>
     {Array.from({length:22},(_,i)=><circle key={"grain"+i}
      cx={27+(i*17)%46} cy={102+(i*13)%13} r={1.2+i%3*.7}
      fill={color} stroke="#526962" strokeOpacity=".28"/>)}
    </>}
    {labels.length>0&&singlePhase==="gas"&&<>
     <path d={geo.inside} fill={color} opacity=".17"/>
     {Array.from({length:9},(_,i)=><circle key={"gascloud"+i}
      cx={34+(i*13)%33} cy={32+(i*21)%61} r={3+i%3}
      fill={color} opacity=".42"/>)}
    </>}
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
 onOpenEditor?:()=>void;
};
/** Furniture is part of the shared bench, not a second toolbar. Both the
 * editor and the board use these exact same interactions. */
export default function LektrusChemistryBenchSurface({bench,editable=false,pouringId,
 onChange,onSelect,onPour,onDropReagent,onOpenEditor}:SurfaceProps){
 const host=useRef<HTMLDivElement>(null);
 const dialogRef=useRef<HTMLElement>(null);
 const sinkId=useId().replace(/:/g,"");
 const scrollRef=useRef<HTMLDivElement>(null);
 const gesture=useRef<{id:string;startX:number;startY:number;x:number;y:number;dragged:boolean}|null>(null);
 const shelfGesture=useRef<{kind:LabGlassware;startX:number;startY:number;dragged:boolean}|null>(null);
 const [preview,setPreview]=useState<{id:string;x:number;y:number}|null>(null);
 const [shelfGhost,setShelfGhost]=useState<{kind:LabGlassware;x:number;y:number}|null>(null);
 const [dropTarget,setDropTarget]=useState<string|null>(null);
 const [dropFurniture,setDropFurniture]=useState<"sink"|"glassware"|null>(null);
 const [transfer,setTransfer]=useState<{from:{x:number;y:number};to:{x:number;y:number}}|null>(null);
 const [cabinet,setCabinet]=useState<"reagents"|"glassware"|"equipment"|"titration"|"settings"|null>(null);
 const [query,setQuery]=useState("");
 const [category,setCategory]=useState("Все");
 const [phase,setPhase]=useState<"all"|StoragePhase>("all");
 const [sort,setSort]=useState<CatalogueSort>("name");
 const [group,setGroup]=useState<CatalogueGroup>("class");
 const [cabinetTab,setCabinetTab]=useState<"substances"|"experiments">("substances");
 const [effectFilter,setEffectFilter]=useState<"all"|Observation>("all");
 const [chosen,setChosen]=useState<string|null>(null);
 const [amount,setAmount]=useState("10");
 const [unit,setUnit]=useState<"ml"|"g">("ml");
 const [notice,setNotice]=useState("");
 const [sinkFlow,setSinkFlow]=useState(false);
 const [doseEffect,setDoseEffect]=useState<{x:number;y:number;color:string}|null>(null);
 const settings=labBenchSettings(bench);
 const selected=selectedLabVessel(bench);
 const catalogue=buildLabCatalog({query,kind:category,phase,sort,group});
 const visibleSubstances=catalogue.flatMap(v=>v.items);
 const reagent=chosen?substances.find(s=>s.id===chosen):null;
 const classes=["Все",...new Set(substances.map(s=>s.kind))];
 const experimentCases=reviewedReactionCases.filter(v=>v.status==="reaction"&&
  v.reactants.length<=2&&(effectFilter==="all"||v.observation===effectFilter)&&
  (v.equation+" "+v.description+" "+v.reactants.join(" ")).toLocaleLowerCase("ru-RU")
   .includes(query.trim().toLocaleLowerCase("ru-RU"))).slice(0,80);
 const rxn=selected?labObservation(selected):null;
 const shownReaction=(rxn?.status==="reaction"?rxn.caseData:undefined)??
  bench.vessels.map(v=>labObservation(v)).find(v=>v.status==="reaction")?.caseData;
 useEffect(()=>{if(cabinet)dialogRef.current?.focus()},[cabinet]);
 useEffect(()=>{scrollRef.current?.scrollTo({top:0})},
  [cabinet,cabinetTab,query,category,phase,sort,group,effectFilter]);
 useEffect(()=>{
  if(!cabinet)return;
  const onEscape=(event:KeyboardEvent)=>{
   if(event.key!=="Escape")return;
   event.preventDefault();event.stopPropagation();setCabinet(null);
  };
  document.addEventListener("keydown",onEscape,true);
  return()=>document.removeEventListener("keydown",onEscape,true);
 },[cabinet]);
 useEffect(()=>{if(!transfer)return;const timer=setTimeout(()=>setTransfer(null),900);return()=>clearTimeout(timer)},[transfer]);
 useEffect(()=>{if(!sinkFlow)return;const timer=setTimeout(()=>setSinkFlow(false),900);return()=>clearTimeout(timer)},[sinkFlow]);
 useEffect(()=>{if(!doseEffect)return;const timer=setTimeout(()=>setDoseEffect(null),900);return()=>clearTimeout(timer)},[doseEffect]);
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
  const updated=putLabReagent(bench,selected.id,chosen,dose);
  if(updated===bench){setNotice("Реагент уже добавлен или посуда заполнена");return}
  onChange?.(updated);
  setDoseEffect({x:selected.x,y:selected.y,color:reagentAppearance(chosen).color});
  setNotice(chosen+" · "+dose.value+" "+(unit==="ml"?"мл":"г")+" добавлено в "+names[selected.kind]);
  setCabinet(null);setChosen(null);
 };
 const prepareExample=(row:(typeof reviewedReactionCases)[number])=>{
  const vessels=row.reactants.map((reagent,i)=>({
   id:"v"+(i+1),kind:(i===0?"beaker":"tube") as LabGlassware,
   x:i===0?40:60,y:67,reagents:[reagent],
   environment:row.environment,observed:false
  }));
  if(!vessels.length)return;
  onChange?.({...bench,vessels,selectedId:vessels[0].id,event:bench.event+1});
  setNotice("Опыт подготовлен: соедините вещества, чтобы наблюдать реакцию");
  setCabinet(null);
 };
 const openCabinet=(next:"reagents"|"glassware"|"equipment"|"titration"|"settings")=>{
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
   <strong key={shownReaction?.equation??"idle"}>{shownReaction?.equation??"Выберите опыт и смешайте вещества"}</strong>
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
   <button type="button" className="lektrus-lab-furniture-title lektrus-lab-shelf-header"
    disabled={!editable} aria-label="Открыть шкаф посуды"
    onClick={e=>{e.stopPropagation();openCabinet("glassware")}}>ПОСУДА</button>
   <div className="lektrus-lab-shelf-items">
    {labGlassware.map(kind=><button type="button" key={kind.id} disabled={!editable}
      className="lektrus-lab-shelf-item" title={"Взять: "+kind.name}
      aria-label={"Взять из шкафа "+kind.name} onPointerDown={e=>beginShelf(e,kind.id)}
      onPointerMove={moveShelf} onPointerUp={finishShelf}
      onClick={e=>{if(e.detail===0)take(kind.id)}}
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
   <svg className="lektrus-lab-sink-art" viewBox="0 0 220 164"
    role="img" aria-label="Лабораторная раковина с краном">
    <defs>
     <linearGradient id={sinkId+"-steel"} x1="0" y1="0" x2=".9" y2="1">
      <stop stopColor="#f1f8f7"/><stop offset=".47" stopColor="#b7cecb"/>
      <stop offset="1" stopColor="#789f9a"/>
     </linearGradient>
     <linearGradient id={sinkId+"-ceramic"} x1="0" y1="0" x2="0" y2="1">
      <stop stopColor="#f4f8f5"/><stop offset=".55" stopColor="#d8e6e2"/>
      <stop offset="1" stopColor="#a4c1b9"/>
     </linearGradient>
    </defs>
    <ellipse cx="113" cy="138" rx="100" ry="14" fill="#14392f" opacity=".19"/>
    <path d="M27 87H194Q205 87 203 100L194 137Q191 145 179 145H45Q33 145 30 137L19 100Q17 87 27 87Z"
     fill="#8ca7a0" stroke="#6c928a" strokeWidth="2"/>
    <ellipse cx="110" cy="94" rx="96" ry="39" fill={"url(#"+sinkId+"-steel)"} stroke="#7baba2" strokeWidth="3"/>
    <ellipse cx="110" cy="97" rx="79" ry="27" fill="#779d98" stroke="#c9e2d9" strokeWidth="3"/>
    <ellipse cx="110" cy="105" rx="70" ry="22" fill={"url(#"+sinkId+"-ceramic)"} opacity=".98"/>
    <ellipse cx="110" cy="115" rx="17" ry="5.5" fill="#5e8582" opacity=".65"/>
    <ellipse cx="110" cy="114" rx="10" ry="3" fill="#3d716f"/>
    <path d="M112 80V40Q112 26 126 26H147Q160 26 160 39V50"
     stroke="#5e8f90" strokeWidth="15" strokeLinecap="round" fill="none"/>
    <path d="M112 78V40Q112 26 126 26H147Q160 26 160 39V49"
     stroke={"url(#"+sinkId+"-steel)"} strokeWidth="10" strokeLinecap="round" fill="none"/>
    <path d="M153 50h15" stroke="#548789" strokeWidth="7" strokeLinecap="round"/>
    <rect x="102" y="69" width="22" height="17" rx="7" fill="#b7ccca" stroke="#679690" strokeWidth="2"/>
    <path d="M125 23v-9h20" stroke="#5b8a88" strokeWidth="5" strokeLinecap="round"/>
    <rect x="145" y="11" width="18" height="7" rx="3" fill="#b9d0c9" stroke="#709d94"/>
    {sinkFlow&&<>
     <path className="lektrus-lab-sink-water" d="M160 52Q162 72 153 94"
      fill="none" stroke="#b1e7ee" strokeWidth="5" strokeLinecap="round"/>
     <circle className="lektrus-lab-sink-drop" cx="147" cy="110" r="6"
      fill="#8ac8d1" opacity=".8"/>
    </>}
   </svg>
   <span className="lektrus-lab-sink-caption"><strong>МОЙКА</strong>
    <small>{sinkFlow?"Раствор слит":"Слить содержимое"}</small></span>
  </button>
  {onOpenEditor&&editable&&<button type="button" data-board-interactive="true"
   className="lektrus-lab-journal-trigger" title="Журнал опыта: условия и наблюдения"
   aria-label="Открыть лабораторный журнал"
   onPointerDown={e=>e.stopPropagation()} onPointerUp={e=>e.stopPropagation()}
   onClick={e=>{e.stopPropagation();onOpenEditor()}}>▤</button>}
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
  {doseEffect&&<svg className="lektrus-lab-dose-animation" viewBox="0 0 100 100"
   preserveAspectRatio="none" aria-hidden="true">
   <path d={`M 22 34 Q 30 20 ${doseEffect.x} ${doseEffect.y-13}`}
    fill="none" stroke={doseEffect.color} strokeWidth="1" strokeLinecap="round"/>
  </svg>}
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
  {cabinet&&createPortal(<div className={"lektrus-lab-furniture-modal is-"+cabinet}
   data-board-interactive="true"
   onPointerDown={e=>e.stopPropagation()} onPointerMove={e=>e.stopPropagation()}
   onPointerUp={e=>e.stopPropagation()}
   onWheel={e=>e.stopPropagation()} onTouchMove={e=>e.stopPropagation()}
   onClick={e=>{e.stopPropagation();if(e.target===e.currentTarget)setCabinet(null)}}>
    <section ref={dialogRef} tabIndex={-1}
     className={"lektrus-lab-furniture-dialog is-"+cabinet} role="dialog" aria-modal="true"
     aria-label={cabinet==="reagents"?"Шкаф реактивов":cabinet==="glassware"?"Шкаф посуды":"Настройки химического стола"}
     onKeyDown={event=>{
      if(event.key!=="Tab")return;
      const focusable=dialogRef.current?.querySelectorAll<HTMLElement>(
       'button:not([disabled]),input:not([disabled]),select:not([disabled]),[tabindex="0"]');
      if(!focusable?.length)return;
      const first=focusable[0],last=focusable[focusable.length-1];
      if(event.shiftKey&&(document.activeElement===first||document.activeElement===dialogRef.current)){
       event.preventDefault();last.focus();
      }else if(!event.shiftKey&&document.activeElement===last){
       event.preventDefault();first.focus();
      }
     }}>
     <header className="lektrus-lab-modal-head">
      <div className="lektrus-lab-modal-heading">
       <span className="lektrus-lab-modal-emblem" aria-hidden="true">{cabinet==="reagents"?"⚗":cabinet==="glassware"?"◈":"⚙"}</span>
       <span><strong>{cabinet==="reagents"?"Шкаф реактивов":cabinet==="glassware"?"Шкаф посуды":"Настройки стола"}</strong>
        <small>{cabinet==="reagents"?"Выберите вещество и отмерьте нужное количество":
          cabinet==="glassware"?"Возьмите посуду на рабочий стол":"Настройки этой лаборатории"}</small></span>
      </div>
      <button type="button" aria-label="Закрыть шкаф" onClick={()=>setCabinet(null)}>×</button>
     </header>
     {cabinet==="reagents"&&<>
      <div className="lektrus-lab-modal-tabs" role="group" aria-label="Раздел шкафа реактивов">
       <button type="button" className={cabinetTab==="substances"?"active":""}
        aria-pressed={cabinetTab==="substances"} onClick={()=>setCabinetTab("substances")}>Вещества</button>
       <button type="button" className={cabinetTab==="experiments"?"active":""}
        aria-pressed={cabinetTab==="experiments"} onClick={()=>setCabinetTab("experiments")}>Готовые опыты</button>
      </div>
      <div className="lektrus-lab-modal-filters">
       <input type="search" placeholder="Формула или название" value={query}
        onChange={e=>setQuery(e.target.value)} aria-label="Найти реактив"/>
       {cabinetTab==="substances"?<select value={category} onChange={e=>setCategory(e.target.value)}
        aria-label="Класс реактива">
        {classes.map(c=><option key={c}>{c}</option>)}
       </select>:<select value={effectFilter}
        aria-label="Признак реакции" onChange={e=>setEffectFilter(e.target.value as "all"|Observation)}>
        <option value="all">Все</option><option value="gas">Газ</option>
        <option value="precipitate">Осадок</option><option value="color">Цвет</option>
        <option value="heat">Тепло</option><option value="dissolution">Растворение</option>
       </select>}
      </div>
      {cabinetTab==="substances"&&<div className="lektrus-lab-modal-sortbar">
       <label>Состояние <select aria-label="Агрегатное состояние" value={phase}
        onChange={e=>setPhase(e.target.value as "all"|StoragePhase)}>
        <option value="all">Все</option>
        {Object.entries(phaseNames).map(([id,name])=><option key={id} value={id}>{name}</option>)}
       </select></label>
       <label>Сортировка <select aria-label="Сортировка реактивов" value={sort}
        onChange={e=>setSort(e.target.value as CatalogueSort)}>
        <option value="name">По названию</option><option value="formula">По формуле</option>
       </select></label>
       <label>Группировка <select aria-label="Группировка реактивов" value={group}
        onChange={e=>setGroup(e.target.value as CatalogueGroup)}>
        <option value="class">По классам</option><option value="phase">По состоянию</option>
        <option value="none">Без группировки</option>
       </select></label>
      </div>}
      <div className="lektrus-lab-modal-results-head">
       <span><strong>{cabinetTab==="substances"?visibleSubstances.length:experimentCases.length}</strong>
        {cabinetTab==="substances"?" веществ в каталоге":" опытов найдено"}</span>
       <span className="lektrus-lab-modal-scroll-help">Колесо мыши, тачпад или прокрутка пальцем</span>
       <div className="lektrus-lab-scroll-buttons">
        <button type="button" aria-label="Прокрутить список вверх"
         onClick={()=>scrollRef.current?.scrollBy({top:-310,behavior:"smooth"})}>↑</button>
        <button type="button" aria-label="Прокрутить список вниз"
         onClick={()=>scrollRef.current?.scrollBy({top:310,behavior:"smooth"})}>↓</button>
       </div>
      </div>
      <div ref={scrollRef} className="lektrus-lab-modal-reagents"
       role="region" tabIndex={0} aria-label="Прокручиваемый список веществ и опытов"
       onWheel={e=>e.stopPropagation()} onTouchMove={e=>e.stopPropagation()}>
       {cabinetTab==="substances"?catalogue.map(({title,items})=>
        <div className="lektrus-lab-reagent-group" key={title}>
         {group!=="none"&&<h3>{title}<small>{items.length}</small></h3>}
         <div className="lektrus-lab-reagent-group-grid">
          {items.map(v=><button key={v.id} type="button"
           className={chosen===v.id?"active":""} aria-pressed={chosen===v.id}
           onClick={()=>{setChosen(v.id);
            setUnit(cabinetPhase(v)==="solid"?"g":"ml");
            setAmount(cabinetPhase(v)==="solid"?"1":"10")}}>
           <i style={{background:cabinetColor(v)}}/>
           <strong>{v.formula}</strong>
           <span>{v.name}<small>{phaseNames[cabinetPhase(v)]}</small></span>
          </button>)}
         </div>
        </div>):experimentCases.map((row,i)=><button type="button" key={i}
         className="lektrus-lab-example-choice" onClick={()=>prepareExample(row)}
         title="Разместить исходные вещества отдельно">
         <strong>{row.reactants.join(" + ")}</strong>
         <span>{row.description}</span>
        </button>)}
       {((cabinetTab==="substances"?visibleSubstances:experimentCases).length===0)&&
        <p>Совпадений не найдено</p>}
      </div>
      {cabinetTab==="substances"&&<div className="lektrus-lab-modal-dose">
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
      </div>}
     </>}
     {cabinet==="glassware"&&<div className="lektrus-lab-modal-ware">
      {labGlassware.map(v=><button type="button" key={v.id}
       disabled={bench.vessels.length>=6} onClick={()=>take(v.id)}>
       <span className={"lektrus-lab-mini-glass is-"+v.id}>♙</span>
       <strong>{v.name}</strong><small>{v.description}</small></button>)}
      <p>В шкаф возвращается только пустая посуда. Сначала слейте содержимое в раковину.</p>
      <button type="button" className="lektrus-lab-store-selected"
       disabled={!selected||!!selected.reagents.length}
       onClick={()=>{if(selected)returnGlass(selected.id);setCabinet(null)}}>
       Вернуть выбранную пустую посуду
      </button>
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
   </div>,document.body)}
 </div>;
}
