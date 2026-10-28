import {useEffect,useId,useRef,useState,type PointerEvent} from "react";
import {createPortal} from "react-dom";
import type {LabBench,LabVessel,LabGlassware,LabDose,LabDevice} from "./lektrusChemistryBenchModel";
import {addLabVessel,arrangeLabVessels,emptyLabVessel,labBenchSettings,labGlassware,labObservation,
 labIndicatorResult,labIndicators,setLabIndicator,setLabEnvironment,labDevices,placedLabDevices,addPlacedLabDevice,movePlacedLabDevice,returnPlacedLabDevice,applyPlacedLabDevice,stopPlacedLabDevice,labTitrationTargets,dripLabVessel,positionLabVessel,putLabReagent,removeLabVessel,selectedLabVessel,setLabBenchSettings,
 } from "./lektrusChemistryBenchModel";
import {reactionAppearance,reviewedReactionCases,substances,type Observation} from "./lektrusReactionDatabase";
import {reagentAppearance} from "./lektrusLabAppearance";
import {buildLabCatalog,cabinetColor,cabinetPhase,phaseNames,type CatalogueGroup,type CatalogueSort,type StoragePhase}
 from "./lektrusLabCatalog";
import {titrationReading} from "./lektrusLabTitration";
import LektrusLabGlasswareIcon from "./LektrusLabGlasswareIcon";
import LektrusLabDeviceIcon from "./LektrusLabDeviceIcon";
import {labDisplayPoint,labLogicalPoint,isLabSink,isLabCupboard,isLabWorktop} from "./lektrusLabLayout";

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
export function LabVesselGraphic({vessel,small=false,showLabels=true,stirring=false,titrationResult}:{
 vessel:LabVessel;small?:boolean;showLabels?:boolean;stirring?:boolean;
 titrationResult?:ReturnType<typeof titrationReading>}){
 const id=useId().replace(/:/g,"");
 const result=labObservation(vessel);
 const verified=result.status==="reaction"?result.caseData:undefined;
 const visualCase=vessel.completedReaction??verified;
 const appearance=reactionAppearance(visualCase);
 const indicator=titrationResult&&vessel.indicator?{
  medium:titrationResult.phase==="acidic"?"acid":titrationResult.phase==="alkaline"?"base":"neutral",
  label:"pH "+titrationResult.pH,color:titrationResult.tint,
  note:"Расчётное значение при титровании, 25 °C"
 }:labIndicatorResult(vessel);
 const reagent=vessel.reagents[0]?reagentAppearance(vessel.reagents[0],vessel.environment):null;
 const active=Boolean(visualCase);
 const color=titrationResult?(vessel.indicator?titrationResult.tint:"#dceff0"):
  indicator?.color??(active?appearance.solutionAfter:reagent?.color??"#e7f3f3");
 const observation=visualCase?.observation??"none";
 const singlePhase=vessel.reagents.length===1&&!active?reagent?.phase:undefined;
 const geo=shape[vessel.kind];
 const labels=vessel.reagents.map(r=>substances.find(s=>s.id===r)?.formula??r);
 const volumeMl=Object.values(vessel.doses??{}).reduce((sum,d)=>sum+(d.unit==="ml"?d.value:0),0);
 const capacity=vessel.kind==="burette"?100:
  vessel.kind==="pipette"?25:vessel.kind==="tube"?25:150;
 const fillFraction=volumeMl>0?Math.min(.92,Math.max(.08,volumeMl/capacity)):
  (vessel.reagents.length>0?0.5:0);
 return <div className={"lektrus-lab-vessel-art"+(small?" is-small":"")}>
  <svg viewBox="0 0 100 133" role="img" aria-label={names[vessel.kind]+": "+(labels.join(", ")||"пустой")}>
   <defs>
    <clipPath id={id+"clip"}><path d={geo.inside}/></clipPath>
    <clipPath id={id+"level"}><rect x="0" y={120-106*fillFraction}
     width="100" height="133"/></clipPath>
    <linearGradient id={id+"glass"} x1="0" x2="1"><stop stopColor="#e9f6f4" stopOpacity=".35"/><stop offset=".3" stopColor="#fff" stopOpacity=".08"/><stop offset=".8" stopColor="#acc9c8" stopOpacity=".2"/><stop offset="1" stopColor="#fff" stopOpacity=".12"/></linearGradient>
   </defs>
   <ellipse cx="50" cy="126" rx="34" ry="4" fill="#254f49" opacity=".12"/>
   <path d={geo.inside} fill={"url(#"+id+"glass)"} stroke="none"/>
   <g clipPath={"url(#"+id+"clip)"}>
    {labels.length>0&&singlePhase!=="solid"&&singlePhase!=="metal"&&singlePhase!=="gas"&&
     <path d={geo.liquid} clipPath={"url(#"+id+"level)"} fill={color} opacity=".76" className="lektrus-lab-fluid"/>}
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
    {stirring&&labels.length>0&&<g className="lektrus-lab-stir-vortex">
     <ellipse cx="50" cy="90" rx="24" ry="6" fill="none" stroke="#effffd" strokeWidth="2" opacity=".85"/>
     <ellipse cx="50" cy="93" rx="14" ry="4" fill="none" stroke="#318f90" strokeWidth="2" opacity=".75"/>
     <path d="M42 87Q51 81 59 89" stroke="#e9ffff" strokeWidth="2.5" strokeLinecap="round" fill="none"/>
    </g>}
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
 const dialogRef=useRef<HTMLElement>(null);
 const sinkId=useId().replace(/:/g,"");
 const scrollRef=useRef<HTMLDivElement>(null);
 const gesture=useRef<{id:string;startX:number;startY:number;x:number;y:number;dragged:boolean}|null>(null);
 const shelfGesture=useRef<{kind:LabGlassware;startX:number;startY:number;dragged:boolean}|null>(null);
 const deviceShelfGesture=useRef<{kind:LabDevice;startX:number;startY:number;dragged:boolean}|null>(null);
 const deviceGesture=useRef<{id:string;startX:number;startY:number;x:number;y:number;dragged:boolean}|null>(null);
 const [devicePreview,setDevicePreview]=useState<{id:string;x:number;y:number}|null>(null);
 const [deviceShelfGhost,setDeviceShelfGhost]=useState<{kind:LabDevice;x:number;y:number}|null>(null);
 const [activeDeviceId,setActiveDeviceId]=useState<string|null>(null);
 const [preview,setPreview]=useState<{id:string;x:number;y:number}|null>(null);
 const [shelfGhost,setShelfGhost]=useState<{kind:LabGlassware;x:number;y:number}|null>(null);
 const [dropTarget,setDropTarget]=useState<string|null>(null);
 const [dropFurniture,setDropFurniture]=useState<"sink"|"glassware"|null>(null);
 const [transfer,setTransfer]=useState<{from:{x:number;y:number};to:{x:number;y:number}}|null>(null);
 const [cabinet,setCabinet]=useState<"reagents"|"glassware"|"equipment"|"settings"|null>(null);
 const [query,setQuery]=useState("");
 const [category,setCategory]=useState("Все");
 const [phase,setPhase]=useState<"all"|StoragePhase>("all");
 const [sort,setSort]=useState<CatalogueSort>("name");
 const [group,setGroup]=useState<CatalogueGroup>("class");
 const [cabinetTab,setCabinetTab]=useState<
 "all"|"acid"|"base"|"salt"|"oxide"|"metal"|"organic"|"other"|"experiments">("all");
 const [effectFilter,setEffectFilter]=useState<"all"|Observation>("all");
 const [chosen,setChosen]=useState<string|null>(null);
 const [amount,setAmount]=useState("10");
 const [unit,setUnit]=useState<"ml"|"g">("ml");
 const [molarity,setMolarity]=useState("0.1");
 const [titrationTarget,setTitrationTarget]=useState("");
 const [localPourId,setLocalPourId]=useState<string|null>(null);
 const [notice,setNotice]=useState("");
 const [sinkFlow,setSinkFlow]=useState(false);
 const [doseEffect,setDoseEffect]=useState<{x:number;y:number;color:string}|null>(null);
 const settings=labBenchSettings(bench);
 const selected=selectedLabVessel(bench);
 const physicalDevices=placedLabDevices(bench);
 const activeDevice=physicalDevices.find(d=>d.id===activeDeviceId);
 const isGlobalSearch=!!query.trim();
 const catalogKind=(v:{kind:string})=>{
  if(cabinetTab==="all"||isGlobalSearch)return true;
  if(cabinetTab==="acid")return v.kind==="кислота";
  if(cabinetTab==="base")return v.kind==="основание";
  if(cabinetTab==="salt")return v.kind==="соль";
  if(cabinetTab==="oxide")return v.kind==="оксид";
  if(cabinetTab==="metal")return v.kind==="металл"||v.kind==="неметалл";
  if(cabinetTab==="organic")return v.kind==="органика";
  return !["кислота","основание","соль","оксид","металл","неметалл","органика"].includes(v.kind);
 };
 const catalogue=buildLabCatalog({query,kind:isGlobalSearch?"Все":category,
  phase:isGlobalSearch?"all":phase,sort,group:isGlobalSearch?"class":group})
  .map(section=>({...section,items:section.items.filter(catalogKind)}))
  .filter(section=>section.items.length>0);
 const visibleSubstances=catalogue.flatMap(v=>v.items);
 const reagent=chosen?substances.find(s=>s.id===chosen):null;
 const classes=["Все",...new Set(substances.map(s=>s.kind))];
 const titrationSources=bench.vessels.filter(v=>v.kind==="burette"&&v.reagents.length>0);
 const activeBurette=selected?.kind==="burette"?selected:titrationSources.find(v=>
  bench.titrationPair?.sourceId===v.id);
 const availableTargets=activeBurette?labTitrationTargets(bench,activeBurette.id):[];
 const effectivePouringId=pouringId??localPourId;
 const chosenTitrationTarget=availableTargets.find(v=>v.id===titrationTarget)?titrationTarget:
  availableTargets[0]?.id;
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
 const inGlassware=isLabCupboard;
 const inSink=isLabSink;
 const targetAt=(sourceId:string,p:{x:number;y:number})=>{
  const rect=host.current?.getBoundingClientRect();
  const source=bench.vessels.find(v=>v.id===sourceId);
  if(!rect||!source?.reagents.length||!onPour)return null;
  return bench.vessels.filter(v=>v.id!==sourceId).map(v=>{
   const screen=labDisplayPoint(v,bench.vessels.length>3);
   return {id:v.id,dist:Math.hypot((p.x-screen.x)*rect.width/100,
     (p.y-screen.y)*rect.height/100)};
  }).filter(v=>v.dist<Math.min(115,Math.max(54,rect.width*.15))).sort((a,b)=>a.dist-b.dist)[0]?.id??null;
 };
 const drip=(sourceId:string,targetId:string,ml:number)=>{
  const next=dripLabVessel(bench,sourceId,targetId,ml);
  if(next===bench){
   setNotice("Для титрования наполните бюретку и колбу кислотой и щёлочью с известной концентрацией");
   return;
  }
  onChange?.(next);
  const from=bench.vessels.find(v=>v.id===sourceId);
  const to=bench.vessels.find(v=>v.id===targetId);
  if(from&&to){
   const start=labDisplayPoint(from,bench.vessels.length>3),
    end=labDisplayPoint(to,bench.vessels.length>3);
   setTransfer({from:{x:start.x,y:start.y-11},to:{x:end.x,y:end.y-10}});
  }
  setNotice("Добавлено "+ml.toLocaleString("ru-RU")+" мл из бюретки");
 };
 const transferVessel=(sourceId:string,targetId:string)=>{
  const from=bench.vessels.find(v=>v.id===sourceId),to=bench.vessels.find(v=>v.id===targetId);
  if(from?.kind==="burette"&&labTitrationTargets(bench,sourceId).some(v=>v.id===targetId)){
   drip(sourceId,targetId,1);return;
  }
  if(from&&to&&from.reagents.length){
   const start=labDisplayPoint(from,bench.vessels.length>3),end=labDisplayPoint(to,bench.vessels.length>3);
   setTransfer({from:{x:start.x,y:start.y-12},to:{x:end.x,y:end.y-12}});
  }
  onPour?.(sourceId,targetId);
  setLocalPourId(null);
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
  const next=addLabVessel(bench,kind,p&&isLabWorktop(p)?
   labLogicalPoint(p):undefined);
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
   const a=labDisplayPoint({x:g.x,y:g.y},bench.vessels.length>3);
   setPreview({id:g.id,...labLogicalPoint({
    x:a.x+p.x-g.startX,y:a.y+p.y-g.startY})});
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
    else{
     const a=labDisplayPoint({x:g.x,y:g.y},bench.vessels.length>3);
     const next=labLogicalPoint({x:a.x+p.x-g.startX,y:a.y+p.y-g.startY});
     onChange?.(positionLabVessel(bench,g.id,next.x,next.y));
    }
   }
  }else if(!g.dragged&&effectivePouringId&&effectivePouringId!==g.id)transferVessel(effectivePouringId,g.id);
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
  const p=point(event);if(g.dragged&&p&&isLabWorktop(p))
   take(g.kind,p);
  else if(!g.dragged)take(g.kind);
  setShelfGhost(null);
 };
 const takeDevice=(kind:LabDevice,p?:{x:number;y:number})=>{
  const updated=addPlacedLabDevice(bench,kind,p&&isLabWorktop(p)?p:undefined);
  if(updated===bench){setNotice("На столе не больше десяти приборов");return}
  onChange?.(updated);
  const newest=placedLabDevices(updated).at(-1);
  setActiveDeviceId(newest?.id??null);
  setNotice("Прибор установлен: "+(labDevices.find(d=>d.id===kind)?.name??kind));
  setCabinet(null);
 };
 const beginDeviceShelf=(e:PointerEvent<HTMLButtonElement>,kind:LabDevice)=>{
  if(!editable||e.button!==0||!e.isPrimary)return;
  e.preventDefault();e.stopPropagation();
  deviceShelfGesture.current={kind,startX:e.clientX,startY:e.clientY,dragged:false};
  e.currentTarget.setPointerCapture(e.pointerId);
 };
 const moveDeviceShelf=(e:PointerEvent<HTMLButtonElement>)=>{
  const g=deviceShelfGesture.current;if(!g)return;
  e.stopPropagation();
  const p=point(e);if(!p)return;
  if(Math.hypot(e.clientX-g.startX,e.clientY-g.startY)>7)g.dragged=true;
  if(g.dragged)setDeviceShelfGhost({kind:g.kind,...p});
 };
 const finishDeviceShelf=(e:PointerEvent<HTMLButtonElement>)=>{
  const g=deviceShelfGesture.current;if(!g)return;
  deviceShelfGesture.current=null;e.preventDefault();e.stopPropagation();
  if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);
  const p=point(e);takeDevice(g.kind,g.dragged&&p&&isLabWorktop(p)?p:undefined);
  setDeviceShelfGhost(null);
 };
 const nearestVessel=(p:{x:number;y:number})=>{
  const bounds=host.current?.getBoundingClientRect();
  if(!bounds)return null;
  const candidates=bench.vessels.map(v=>{
   const q=labDisplayPoint(v,bench.vessels.length>3);
   return {id:v.id,distance:Math.hypot((q.x-p.x)*bounds.width/100,(q.y-p.y)*bounds.height/100)};
  }).sort((a,b)=>a.distance-b.distance);
  return candidates[0]&&candidates[0].distance<Math.min(150,Math.max(65,bounds.width*.10))?
   candidates[0].id:null;
 };
 const attachDevice=(id:string,vesselId:string)=>{
  const device=physicalDevices.find(d=>d.id===id);
  const next=applyPlacedLabDevice(bench,id,vesselId);
  if(next===bench){setNotice("Этот прибор нельзя использовать с выбранной посудой");return}
  onChange?.(next);setActiveDeviceId(id);
  const name=labDevices.find(d=>d.id===device?.kind)?.name??"Прибор";
  const target=bench.vessels.find(v=>v.id===vesselId);
  setNotice(name+" · "+(target?names[target.kind]:"сосуд")+
   (device?.kind==="thermometer"?" (температура не вычисляется)":""));
 };
 const downDevice=(e:PointerEvent<HTMLButtonElement>,id:string,x:number,y:number)=>{
  if(!editable||e.button!==0||!e.isPrimary)return;
  e.preventDefault();e.stopPropagation();
  const p=point(e);if(!p)return;
  deviceGesture.current={id,startX:p.x,startY:p.y,x,y,dragged:false};
  e.currentTarget.setPointerCapture(e.pointerId);
 };
 const moveDevice=(e:PointerEvent<HTMLButtonElement>)=>{
  const g=deviceGesture.current;if(!g)return;
  e.stopPropagation();const p=point(e),rect=host.current?.getBoundingClientRect();
  if(!p||!rect)return;
  if(Math.hypot((p.x-g.startX)*rect.width/100,(p.y-g.startY)*rect.height/100)>8)g.dragged=true;
  if(g.dragged)setDevicePreview({id:g.id,x:Math.max(9,Math.min(81,g.x+p.x-g.startX)),
   y:Math.max(53,Math.min(84,g.y+p.y-g.startY))});
 };
 const finishDevice=(e:PointerEvent<HTMLButtonElement>)=>{
  const g=deviceGesture.current;if(!g)return;
  deviceGesture.current=null;e.preventDefault();e.stopPropagation();
  if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);
  const p=point(e);
  if(g.dragged&&p){
   if(p.y<42&&p.x>=82){
    onChange?.(returnPlacedLabDevice(bench,g.id));
    setActiveDeviceId(null);setNotice("Прибор возвращён в шкаф");
   }else{
    const moved=movePlacedLabDevice(bench,g.id,g.x+p.x-g.startX,g.y+p.y-g.startY);
    const vesselId=nearestVessel(p);
    const final=vesselId?applyPlacedLabDevice(moved,g.id,vesselId):moved;
    onChange?.(final);
    setActiveDeviceId(g.id);
    setNotice(vesselId&&final!==moved?"Прибор установлен рядом с сосудом":"Прибор перемещён по столу");
   }
  }else setActiveDeviceId(g.id);
  setDevicePreview(null);
 };
 const dispense=()=>{
  if(!editable||!chosen)return;
  if(!selected){setNotice("Возьмите чистую посуду из шкафа");return}
  const value=Number(amount.replace(",","."));
  if(!Number.isFinite(value)||value<=0||value>10000){setNotice("Укажите количество больше нуля и не более 10000");return}
  const isTitrant=["HCl","HNO3","HBr","NaOH","KOH"].includes(chosen);
  const concentration=Number(molarity.replace(",","."));
  if(isTitrant&&unit==="ml"&&(!Number.isFinite(concentration)||
    concentration<.001||concentration>2)){
    setNotice("Укажите концентрацию от 0,001 до 2 моль/л");return;
  }
  const dose:LabDose={value:Math.round(value*100)/100,unit,
   ...(isTitrant&&unit==="ml"?{concentrationM:concentration}:{})};
  const updated=putLabReagent(bench,selected.id,chosen,dose);
  if(updated===bench){setNotice("Реагент уже добавлен или посуда заполнена");return}
  onChange?.(updated);
  setDoseEffect({...labDisplayPoint(selected,bench.vessels.length>3),color:reagentAppearance(chosen).color});
  setNotice(chosen+" · "+dose.value+" "+(unit==="ml"?"мл":"г")+" добавлено в "+names[selected.kind]);
  setCabinet(null);setChosen(null);
 };
 const prepareExample=(row:(typeof reviewedReactionCases)[number])=>{
  const vessels=row.reactants.map((reagent,i)=>({
   id:"v"+(i+1),kind:(i===0?"beaker":"tube") as LabGlassware,
   x:i===0?31:72,y:69,reagents:[reagent],
   environment:row.environment,observed:false
  }));
  if(!vessels.length)return;
  onChange?.({...bench,vessels,selectedId:vessels[0].id,event:bench.event+1});
  setNotice("Опыт подготовлен: соедините вещества, чтобы наблюдать реакцию");
  setCabinet(null);
 };
 const openCabinet=(next:"reagents"|"glassware"|"equipment"|"settings")=>{
  if(!editable)return;setCabinet(next);setNotice("");setChosen(null);
 };
 return <div className={"lektrus-lab-bench"+(!editable?" is-readonly":"")+(bench.vessels.length>3?" is-crowded":"")+
  (!settings.animateEffects?" lab-reduced-animation":"")} ref={host}
  aria-label="Интерактивный химический стол с шкафами и раковиной">
  <div className="lektrus-lab-bench-backdrop" aria-hidden="true">
   <div className="lektrus-lab-back-shelf"/>
   <div className="lektrus-lab-counter"/>
   <div className="lektrus-lab-counter-front"/>
   <div className="lektrus-lab-worktop-zone"/>
  </div>
  <div className="lektrus-lab-scene-header">
   <span className="lektrus-lab-scene-brand">LEKTRUS <span>LAB</span></span>
   <strong>Химическая лаборатория</strong>
   <span className="lektrus-lab-scene-stats">{bench.vessels.length} из 6 сосудов <b>·</b> {physicalDevices.length} приборов</span>
   {editable&&bench.vessels.length>1&&<button type="button" className="lektrus-lab-arrange-btn"
    aria-label="Автоматически расставить посуду без наложений"
    title="Упорядочить посуду" data-board-interactive="true"
    onPointerDown={e=>e.stopPropagation()} onPointerUp={e=>e.stopPropagation()}
    onClick={e=>{e.stopPropagation();onChange?.(arrangeLabVessels(bench))}}>
    <span aria-hidden="true">▦</span> Расставить
   </button>}
  </div>
  {settings.showEquationBoard&&<div className="lektrus-lab-chalkboard" aria-live="polite">
   <small>{shownReaction?"УРАВНЕНИЕ РЕАКЦИИ":"ПЛАН ЭКСПЕРИМЕНТА"}</small>
   {shownReaction?<><strong key={shownReaction.equation}>{shownReaction.equation}</strong>
    <span>{shownReaction.description}</span></>:
    <div className="lektrus-lab-chalk-steps">
     <strong>Приступим к опыту</strong>
     <span><b>1</b> Возьмите посуду из шкафа</span>
     <span><b>2</b> Добавьте вещества и условия</span>
     <span><b>3</b> Смешайте и наблюдайте</span>
    </div>}
  </div>}
  {!settings.showEquationBoard&&<div className="lektrus-lab-wall-guide">
   <span>LEKTRUS · ЛАБОРАТОРНЫЙ СТОЛ</span>
   <strong>Экспериментируйте на доске</strong>
   <p>Возьмите посуду, выберите реактивы и наблюдайте за опытом.</p>
   <div><b>Посуда</b><b>Реактивы</b><b>Наблюдение</b></div>
  </div>}
  {!selected?.reagents.length&&<div className="lektrus-lab-worktop-caption">
   <strong>{selected?"Выбрано: "+names[selected.kind]:"Рабочее место"}</strong>
   <span>{selected?(selected.reagents.length?selected.reagents.join(" + "):"Чистая посуда"):
    "Возьмите посуду из шкафа"}</span>
  </div>}
  <button type="button" className="lektrus-lab-reagent-furniture" data-board-interactive="true"
    disabled={!editable} onPointerDown={e=>e.stopPropagation()} onPointerUp={e=>e.stopPropagation()}
    onClick={e=>{e.stopPropagation();openCabinet("reagents")}}
    aria-label="Открыть шкаф реактивов" title="Шкаф реактивов · выбор вещества, объёма и массы">
   <span className="lektrus-lab-furniture-title">РЕАКТИВЫ</span>
   <span className="lektrus-lab-bottle-rack" aria-hidden="true">
    {[
     {id:"CuSO4",color:"#66a8c7"},{id:"HCl",color:"#f3dfb8"},
     {id:"KMnO4",color:"#a07ab5"},{id:"FeSO4",color:"#9fc5a3"},
     {id:"K2Cr2O7",color:"#dda979"},{id:"H2O",color:"#b8dce0"}
    ].map(v=><i key={v.id} style={{"--bottle-color":v.color} as React.CSSProperties}>
     <span>{v.id}</span>
    </i>)}
   </span>
   <span className="lektrus-lab-furniture-foot">{editable?"Выбрать реактивы":"Каталог веществ"}</span>
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
      <LektrusLabGlasswareIcon kind={kind.id} size={32}/>
      <small>{kind.name}</small>
     </button>)}
   </div>
   <span className="lektrus-lab-furniture-foot">Нажмите или перетащите</span>
  </div>
  <div className="lektrus-lab-device-cupboard" data-board-interactive="true"
   onPointerDown={e=>e.stopPropagation()} onPointerUp={e=>e.stopPropagation()}>
   <button type="button" className="lektrus-lab-device-cupboard-title"
    disabled={!editable} onClick={e=>{e.stopPropagation();openCabinet("equipment")}}>
    ПРИБОРЫ <span>{physicalDevices.length}/10</span>
   </button>
   <div className="lektrus-lab-device-cupboard-shelf">
    {labDevices.map(device=><button type="button" key={device.id}
     disabled={!editable} title={"Взять: "+device.name+" · нажмите или перетащите на стол"}
     aria-label={"Взять прибор: "+device.name}
     onPointerDown={e=>beginDeviceShelf(e,device.id)}
     onPointerMove={moveDeviceShelf} onPointerUp={finishDeviceShelf}
     onPointerCancel={e=>{e.stopPropagation();deviceShelfGesture.current=null;setDeviceShelfGhost(null)}}
     onClick={e=>{e.stopPropagation();if(e.detail===0)takeDevice(device.id)}}>
     <LektrusLabDeviceIcon kind={device.id} size={40}/>
     <small>{device.name}</small>
    </button>)}
   </div>
   <span className="lektrus-lab-furniture-foot">Нажмите или перетащите</span>
  </div>
  {physicalDevices.map((device,i)=>{
   const current=devicePreview?.id===device.id?devicePreview:device;
   const meta=labDevices.find(d=>d.id===device.kind);
   const focused=activeDeviceId===device.id;
   return <button key={device.id} type="button" data-board-interactive="true"
    disabled={!editable} title={(meta?.name??device.kind)+": переместить на столе или поднести к сосуду"}
    aria-label={(meta?.name??device.kind)+(device.active?" · работает":" · выключен")}
    aria-pressed={focused}
    className={"lektrus-lab-placed-device is-"+device.kind+
     (focused?" is-selected":"")+(device.active?" is-running":"")}
    style={{left:current.x+"%",top:current.y+"%",zIndex:focused?29:18+i}}
    onPointerDown={e=>downDevice(e,device.id,device.x,device.y)}
    onPointerMove={moveDevice} onPointerUp={finishDevice}
    onPointerCancel={e=>{e.stopPropagation();deviceGesture.current=null;setDevicePreview(null)}}
    onClick={e=>{e.stopPropagation();if(e.detail===0)setActiveDeviceId(device.id)}}>
    <LektrusLabDeviceIcon kind={device.kind} size={68}/>
    <span>{meta?.name}</span>
    {device.active&&<small>{device.kind==="stirrer"?"Перемешивание":
     device.kind==="hotplate"?"Нагрев":device.kind==="burner"?"Пламя":"Прикреплён"}</small>}
   </button>;
  })}
  {deviceShelfGhost&&<div className="lektrus-lab-device-shelf-ghost"
   style={{left:deviceShelfGhost.x+"%",top:deviceShelfGhost.y+"%"}} aria-hidden="true">
   <LektrusLabDeviceIcon kind={deviceShelfGhost.kind} size={58}/>
  </div>}
  {editable&&activeDevice&&<div className="lektrus-lab-device-actions"
   data-board-interactive="true"
   onPointerDown={e=>e.stopPropagation()} onPointerUp={e=>e.stopPropagation()}>
   <strong>{labDevices.find(d=>d.id===activeDevice.kind)?.name}</strong>
   <select aria-label="К какому сосуду применить прибор" value={bench.vessels.some(v=>v.id===bench.selectedId)?
    bench.selectedId:(bench.vessels[0]?.id??"")}
    onChange={e=>onSelect?.(e.target.value)}>
    {bench.vessels.map(v=><option key={v.id} value={v.id}>{names[v.kind]} · {v.id}</option>)}
   </select>
   {activeDevice.active&&<button type="button" onClick={e=>{e.stopPropagation();
    onChange?.(stopPlacedLabDevice(bench,activeDevice.id));setNotice("Прибор выключен")}}>Выключить</button>}
   <button type="button" disabled={!bench.vessels.length} onClick={e=>{e.stopPropagation();
    const target=bench.vessels.some(v=>v.id===bench.selectedId)?bench.selectedId:bench.vessels[0]?.id;
    if(target)attachDevice(activeDevice.id,target)}}>Применить</button>
   <button type="button" onClick={e=>{e.stopPropagation();
    onChange?.(returnPlacedLabDevice(bench,activeDevice.id));setActiveDeviceId(null);
    setNotice("Прибор убран в шкаф")}}>В шкаф</button>
   <button type="button" aria-label="Закрыть управление прибором"
    onClick={e=>{e.stopPropagation();setActiveDeviceId(null)}}>×</button>
  </div>}
  {editable&&selected&&selected.reagents.length>0&&
   (!activeBurette||availableTargets.length===0)&&
   <div className="lektrus-lab-worktop-actions" data-board-interactive="true"
    onPointerDown={e=>e.stopPropagation()} onPointerUp={e=>e.stopPropagation()}>
    <label>Индикатор
     <select aria-label="Индикатор выбранной посуды" value={selected.indicator??""}
      onChange={e=>onChange?.(setLabIndicator(bench,selected.id,
       (e.target.value||undefined) as typeof selected.indicator))}>
      <option value="">Без индикатора</option>
      {labIndicators.map(v=><option key={v.id} value={v.id}>{v.name}</option>)}
     </select>
    </label>
    <label>Условия
     <select value={selected.environment} aria-label="Условия реакции"
      onChange={e=>onChange?.(setLabEnvironment(bench,selected.id,
       e.target.value as typeof selected.environment))}>
      <option value="aqueous">Раствор</option>
      <option value="dry">Сухая среда</option>
      <option value="heated">Нагрев</option>
      <option value="ignited">Горение</option>
     </select>
    </label>
    {onPour&&<button type="button" className={effectivePouringId===selected.id?"active":""}
     onClick={e=>{e.stopPropagation();
      setLocalPourId(effectivePouringId===selected.id?null:selected.id)}}>
     {effectivePouringId===selected.id?"Отмена":"⇢ Перелить"}
    </button>}
   </div>}
  {editable&&activeBurette&&availableTargets.length>0&&<div
   className="lektrus-lab-titration-on-table" data-board-interactive="true"
   onPointerDown={e=>e.stopPropagation()} onPointerUp={e=>e.stopPropagation()}>
   <strong><span aria-hidden="true">◉</span> Бюретка</strong>
   <label>В колбу
    <select aria-label="Колба для титрования" value={chosenTitrationTarget}
     onChange={e=>setTitrationTarget(e.target.value)}>
     {availableTargets.map(v=><option key={v.id} value={v.id}>
      {names[v.kind]} · {v.reagents[0]}
     </option>)}
    </select>
   </label>
   <div className="lektrus-lab-titration-drops">
    {[.1,1,5].map(ml=><button type="button" key={ml}
     onClick={e=>{e.stopPropagation();if(chosenTitrationTarget)
      drip(activeBurette.id,chosenTitrationTarget,ml)}}>+{ml.toLocaleString("ru-RU")} мл</button>)}
   </div>
   {bench.titration&&bench.titrationPair?.sourceId===activeBurette.id&&
    <span className="lektrus-lab-ph-readout">
     pH {titrationReading(bench.titration).pH} ·
     {bench.titration.addedMl.toLocaleString("ru-RU")} мл
    </span>}
  </div>}
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
   <span className="lektrus-lab-sink-caption"><strong>РАКОВИНА</strong>
    <small>{sinkFlow?"Раствор слит":"Слить раствор"}</small></span>
  </button>

  <button type="button" data-board-interactive="true"
   className="lektrus-lab-settings-trigger" title="Настройки химического стола"
   aria-label="Настройки химического стола" disabled={!editable}
   onPointerDown={e=>e.stopPropagation()} onPointerUp={e=>e.stopPropagation()}
   onClick={e=>{e.stopPropagation();openCabinet("settings")}}>⚙</button>
  {bench.vessels.map((v,i)=>{
   const p=labDisplayPoint(preview?.id===v.id?preview:v,bench.vessels.length>3);
   const selectedVessel=bench.selectedId===v.id;
   return <button type="button" key={v.id} data-board-interactive="true"
    className={"lektrus-lab-vessel"+(selectedVessel?" selected":"")+
    (effectivePouringId===v.id?" is-pouring":"")+
    (dropTarget===v.id?" is-drop-target":"")+(bench.stirringVesselId===v.id?" is-stirring":"")+
    (preview?.id===v.id&&dropTarget?" is-pour-drag":"")+
    (effectivePouringId&&effectivePouringId!==v.id?" is-pour-target":"")}
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
    {bench.instrumentTarget?.vesselId===v.id&&<span
     className="lektrus-lab-instrument-attachment">
     {bench.instrumentTarget.kind==="thermometer"?"Термометр · показания не моделируются":"На штативе"}
    </span>}
    <LabVesselGraphic vessel={v} showLabels={settings.showVesselLabels}
     stirring={bench.stirringVesselId===v.id}
     titrationResult={bench.titrationPair?.targetId===v.id&&bench.titration?
      titrationReading(bench.titration):undefined}/>
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
  {editable&&(dropTarget||effectivePouringId||dropFurniture||notice)&&<div className="lektrus-lab-pour-hint" aria-live="polite">
   {dropFurniture==="sink"?"Отпустите для слива в раковину":
    dropFurniture==="glassware"?"Отпустите, чтобы вернуть пустую посуду":
    dropTarget?"Отпустите, чтобы перелить":
    effectivePouringId?"Выберите посуду для переливания":notice}
  </div>}
  {cabinet&&createPortal(<div className={"lektrus-lab-furniture-modal is-"+cabinet}
   data-board-interactive="true"
   onPointerDown={e=>e.stopPropagation()} onPointerMove={e=>e.stopPropagation()}
   onPointerUp={e=>e.stopPropagation()}
   onWheel={e=>e.stopPropagation()} onTouchMove={e=>e.stopPropagation()}
   onClick={e=>{e.stopPropagation();if(e.target===e.currentTarget)setCabinet(null)}}>
    <section ref={dialogRef} tabIndex={-1}
     className={"lektrus-lab-furniture-dialog is-"+cabinet} role="dialog" aria-modal="true"
     aria-label={cabinet==="reagents"?"Шкаф реактивов":cabinet==="glassware"?"Шкаф посуды":cabinet==="equipment"?"Шкаф приборов":"Настройки химического стола"}
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
       <span><strong>{cabinet==="reagents"?"Шкаф реактивов":cabinet==="glassware"?"Шкаф посуды":cabinet==="equipment"?"Шкаф приборов":"Настройки стола"}</strong>
        <small>{cabinet==="reagents"?"Выберите вещество и отмерьте нужное количество":
          cabinet==="glassware"?"Возьмите посуду на рабочий стол":cabinet==="equipment"?"Возьмите прибор и работайте с ним на столе":"Настройки этой лаборатории"}</small></span>
      </div>
      <button type="button" aria-label="Закрыть шкаф" onClick={()=>setCabinet(null)}>×</button>
     </header>
     {cabinet==="reagents"&&<>
      <div className="lektrus-lab-modal-tabs lektrus-lab-class-tabs" role="tablist"
       aria-label="Разделы шкафа реактивов">
       {([
        ["all","Все"],["acid","Кислоты"],["base","Основания"],
        ["salt","Соли"],["oxide","Оксиды"],["metal","Простые вещества"],
        ["organic","Органические"],["other","Прочие"],["experiments","Готовые опыты"]
       ] as const).map(([id,name])=><button type="button" key={id} role="tab"
        className={cabinetTab===id?"active":""} aria-selected={cabinetTab===id}
        onClick={()=>{setCabinetTab(id);setChosen(null);setCategory("Все");setPhase("all")}}>{name}</button>)}
      </div>
      <div className="lektrus-lab-modal-filters">
       <input type="search" placeholder="Поиск по всем веществам и формулам" value={query}
        onChange={e=>{setQuery(e.target.value);if(e.target.value.trim())setCabinetTab("all")}}
        aria-label="Поиск по всем веществам"/>
       {cabinetTab!=="experiments"?<select value={category} onChange={e=>setCategory(e.target.value)}
        aria-label="Класс реактива">
        {classes.map(c=><option key={c}>{c}</option>)}
       </select>:<select value={effectFilter}
        aria-label="Признак реакции" onChange={e=>setEffectFilter(e.target.value as "all"|Observation)}>
        <option value="all">Все</option><option value="gas">Газ</option>
        <option value="precipitate">Осадок</option><option value="color">Цвет</option>
        <option value="heat">Тепло</option><option value="dissolution">Растворение</option>
       </select>}
      </div>
      {cabinetTab!=="experiments"&&<div className="lektrus-lab-modal-sortbar">
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
       <span><strong>{cabinetTab!=="experiments"?visibleSubstances.length:experimentCases.length}</strong>
        {cabinetTab!=="experiments"?" веществ в каталоге":" опытов найдено"}</span>
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
       {cabinetTab!=="experiments"?catalogue.map(({title,items})=>
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
       {((cabinetTab!=="experiments"?visibleSubstances:experimentCases).length===0)&&
        <p>Совпадений не найдено</p>}
      </div>
      {cabinetTab!=="experiments"&&<div className="lektrus-lab-modal-dose">
       <div><strong>{reagent?.name??"Выберите реактив"}</strong>
        <small>{reagent?reagentAppearance(reagent.id).label:"Сначала выберите вещество из шкафа"}</small>
       </div>
       <div className="lektrus-lab-dose-controls">
        <label>Количество
         <input type="number" inputMode="decimal" min="0.01" max="10000" step="0.1"
          value={amount} onChange={e=>setAmount(e.target.value)} /></label>
        {chosen&&unit==="ml"&&["HCl","HNO3","HBr","NaOH","KOH"].includes(chosen)&&
         <label>Концентрация, моль/л
          <input type="number" min=".001" max="2" step=".01" value={molarity}
           onChange={e=>setMolarity(e.target.value)} />
         </label>}
        <label>Единица
         <select value={unit} onChange={e=>setUnit(e.target.value as "ml"|"g")}>
          <option value="ml">мл</option><option value="g">г</option>
         </select></label>
        <button type="button" className="primary" disabled={!chosen||!selected}
         onClick={dispense}>Отлить в сосуд</button>
       </div>
       <small>Для титрования заполните бюретку и колбу кислотой и щёлочью с известными концентрациями. {selected?"Выбран: "+names[selected.kind]:"Выберите посуду на столе."}</small>
      </div>}
     </>}
     {cabinet==="glassware"&&<div className="lektrus-lab-modal-ware">
      {labGlassware.map(v=><button type="button" key={v.id}
       disabled={bench.vessels.length>=6} onClick={()=>take(v.id)}>
       <LektrusLabGlasswareIcon kind={v.id} size={60}/>
       <strong>{v.name}</strong><small>{v.description}</small></button>)}
      <p>В шкаф возвращается только пустая посуда. Сначала слейте содержимое в раковину.</p>
      <button type="button" className="lektrus-lab-store-selected"
       disabled={!selected||!!selected.reagents.length}
       onClick={()=>{if(selected)returnGlass(selected.id);setCabinet(null)}}>
       Вернуть выбранную пустую посуду
      </button>
     </div>}
     {cabinet==="equipment"&&<div className="lektrus-lab-equipment-catalog">
      <p>Выберите прибор. Он появится на столе и будет доступен каждому участнику.</p>
      <div className="lektrus-lab-equipment-grid">
       {labDevices.map(device=>{
        const count=physicalDevices.filter(d=>d.kind===device.id).length;
        return <button type="button" key={device.id}
         aria-label={"Поставить на стол: "+device.name} onClick={()=>takeDevice(device.id)}>
         <LektrusLabDeviceIcon kind={device.id} size={56}/>
         <strong>{device.name}</strong><small>{device.description}</small>
         <em>＋ На стол {count>0?" · "+count:""}</em>
        </button>;
       })}
      </div>
      <p className="lektrus-lab-safe-caption">Нагрев и горение изменяют условия выбранного сосуда только в виртуальной модели. Мешалка и штатив не создают новых химических продуктов; термометр не показывает выдуманную температуру.</p>
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
