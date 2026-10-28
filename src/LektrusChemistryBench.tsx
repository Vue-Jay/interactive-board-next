import {useId,useRef,useState,type PointerEvent} from "react";
import type {LabBench,LabVessel,LabGlassware} from "./lektrusChemistryBenchModel";
import {labObservation,labIndicatorResult,positionLabVessel} from "./lektrusChemistryBenchModel";
import {reactionAppearance,substances} from "./lektrusReactionDatabase";

const names:Record<LabGlassware,string>={beaker:"Стакан",tube:"Пробирка",flask:"Колба"};
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
 }
};
export function LabVesselGraphic({vessel,small=false}:{vessel:LabVessel;small?:boolean}){
 const id=useId().replace(/:/g,"");
 const result=labObservation(vessel);
 const active=result.status==="reaction"&&vessel.observed;
 const appearance=reactionAppearance(active?result.caseData:undefined);
 const indicator=labIndicatorResult(vessel);
 const baseColors:Record<string,string>={
  CuSO4:"#6bb0d7","Cu(NO3)2":"#75b8de",CuCl2:"#83c5b7",
  FeCl3:"#e1c36f",FeSO4:"#bad49e",KMnO4:"#ab76c8",K2Cr2O7:"#ebb466",
  I2:"#b99867"
 };
 const baseColor=vessel.reagents.find(r=>baseColors[r]);
 const color=indicator?.color??(active?appearance.solutionAfter:baseColor?baseColors[baseColor]:"#b8dbe5");
 const observation=active?result.caseData?.observation:"none";
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
    {labels.length>0&&<path d={geo.liquid} fill={color} opacity=".88" className="lektrus-lab-fluid"/>}
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
  <div className="lektrus-lab-vessel-label"><b>{names[vessel.kind]}</b>
   <span>{labels.length?labels.join(" + "):"Пусто"}</span>
  </div>
  {indicator&&<span className="lektrus-lab-indicator-tag" title={indicator.note}>
   <span className="lektrus-lab-indicator-dot" style={{background:indicator.color??"#a2a9a4"}}/>
   {indicator.label}
  </span>}
  {active&&observation!=="none"&&<span className="lektrus-lab-effect-tag">
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
 onDropReagent?:(id:string,reagent:string)=>void;
};
export default function LektrusChemistryBenchSurface({bench,editable=false,pouringId,
 onChange,onSelect,onPour,onDropReagent}:SurfaceProps){
 const host=useRef<HTMLDivElement>(null);
 const gesture=useRef<{id:string;startX:number;startY:number;x:number;y:number;dragged:boolean}|null>(null);
 const [preview,setPreview]=useState<{id:string;x:number;y:number}|null>(null);
 const [dropTarget,setDropTarget]=useState<string|null>(null);
 const point=(event:PointerEvent)=>{const rect=host.current?.getBoundingClientRect();
  if(!rect||!rect.width||!rect.height)return null;
  return {x:(event.clientX-rect.left)/rect.width*100,
   y:(event.clientY-rect.top)/rect.height*100};};
 const targetAt=(sourceId:string,p:{x:number;y:number})=>{
  const rect=host.current?.getBoundingClientRect();
  const source=bench.vessels.find(v=>v.id===sourceId);
  if(!rect||!source?.reagents.length||!onPour)return null;
  const candidates=bench.vessels.filter(v=>v.id!==sourceId).map(v=>({
   id:v.id,dist:Math.hypot((p.x-v.x)*rect.width/100,(p.y-v.y)*rect.height/100)
  })).filter(v=>v.dist<Math.min(115,Math.max(54,rect.width*.15))).sort((a,b)=>a.dist-b.dist);
  return candidates[0]?.id??null;
 };
 const down=(event:PointerEvent<HTMLButtonElement>,v:LabVessel)=>{
  if(!editable||event.button!==0||!event.isPrimary)return;
  event.stopPropagation();event.preventDefault();
  const p=point(event);if(!p)return;
  gesture.current={id:v.id,startX:p.x,startY:p.y,x:v.x,y:v.y,dragged:false};
  event.currentTarget.setPointerCapture(event.pointerId);
 };
 const move=(event:PointerEvent<HTMLButtonElement>)=>{
  const g=gesture.current;if(!g||!editable)return;
  event.stopPropagation();
  const p=point(event);if(!p)return;
  const rect=host.current?.getBoundingClientRect();
  if(rect&&Math.hypot((p.x-g.startX)*rect.width/100,(p.y-g.startY)*rect.height/100)>8)g.dragged=true;
  if(g.dragged){
   const target=targetAt(g.id,p);setDropTarget(target);
   setPreview({id:g.id,x:Math.max(8,Math.min(92,g.x+p.x-g.startX)),
    y:Math.max(8,Math.min(92,g.y+p.y-g.startY))});
  }
 };
 const finish=(event:PointerEvent<HTMLButtonElement>)=>{
  const g=gesture.current;if(!g)return;gesture.current=null;
  event.stopPropagation();event.preventDefault();
  if(event.currentTarget.hasPointerCapture(event.pointerId))event.currentTarget.releasePointerCapture(event.pointerId);
  const p=point(event);
  if(g.dragged){
   const destination=p?targetAt(g.id,p):null;
   if(destination)onPour?.(g.id,destination);
   else if(p)onChange?.(positionLabVessel(bench,g.id,g.x+p.x-g.startX,g.y+p.y-g.startY));
  }else if(pouringId&&pouringId!==g.id)onPour?.(pouringId,g.id);
  else onSelect?.(g.id);
  setPreview(null);setDropTarget(null);
 };
 return <div className={"lektrus-lab-bench"+(!editable?" is-readonly":"")} ref={host}
  aria-label="Химический стол с посудой">
  <div className="lektrus-lab-bench-backdrop" aria-hidden="true">
   <div className="lektrus-lab-board-top">LEKTRUS <span>CHEM LAB</span></div>
   <div className="lektrus-lab-back-shelf"/>
   <div className="lektrus-lab-counter"/>
   <div className="lektrus-lab-counter-front"/>
  </div>
  {bench.vessels.map((v,i)=>{
   const p=preview?.id===v.id?preview:v;
   const selected=bench.selectedId===v.id;
   const pouring=pouringId===v.id;
   return <button type="button" key={v.id} data-board-interactive="true" className={"lektrus-lab-vessel"+
    (selected?" selected":"")+(pouring?" is-pouring":"")+
    (dropTarget===v.id?" is-drop-target":"")+
    (preview?.id===v.id&&dropTarget?" is-pour-drag":"")+
    (pouringId&&pouringId!==v.id?" is-pour-target":"")}
    style={{left:p.x+"%",top:p.y+"%",zIndex:selected||preview?.id===v.id?10:i+1}}
    disabled={!editable} aria-label={"Сосуд "+(i+1)+": "+names[v.kind]+
      (v.reagents.length?", "+v.reagents.join(", "):", пустой")}
    aria-pressed={selected} title={editable?
      "Нажмите для выбора; перетащите для перемещения или на другой сосуд для переливания":names[v.kind]}
    onPointerDown={e=>down(e,v)} onPointerMove={move}
    onPointerUp={finish} onPointerCancel={e=>{
      e.stopPropagation();gesture.current=null;setPreview(null);setDropTarget(null);
    }}
    onDragOver={e=>{if(editable)e.preventDefault()}}
    onDrop={e=>{if(!editable)return;e.preventDefault();e.stopPropagation();
      const id=e.dataTransfer.getData("application/x-lektrus-reagent");if(id)onDropReagent?.(v.id,id);
    }}>
    <LabVesselGraphic vessel={v}/>
   </button>;
  })}
  {editable&&(dropTarget||pouringId)&&<div className="lektrus-lab-pour-hint" aria-live="polite">
   {dropTarget?"Отпустите, чтобы перелить содержимое": "Выберите сосуд назначения или перетащите исходный на него"}</div>}
 </div>;
}
