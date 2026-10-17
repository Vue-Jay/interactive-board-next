import {useEffect,useState} from "react";
import type {Item} from "./boardModel";

export const isChemicalIllustration=(item:Item)=>/^(chem-formula-|chem-experiment-)/.test(item.graphFigureId??"");
export const chemicalFormulaParts=(value:string)=>value.split(/([A-Z][a-z]?|\)|\])([0-9]+)/g);
// Chemical indices must be subscript; stoichiometric coefficients stay on the baseline.
function Formula({value}:{value:string}){
 const fragments=value.split(/([A-Z][a-z]?|\)|\])([0-9]+)/g);
 const parts:({part:string;sub:boolean})[]=[];
 for(let i=0;i<fragments.length;i++){
  const part=fragments[i];if(!part)continue;
  if(i>=2&&i%3===2){parts.push({part,sub:true});continue}
  parts.push({part,sub:false});
 }
 return <span className="lektrus-chemical-typeset">{parts.map((item,i)=>item.sub?
   <sub key={i}>{item.part}</sub>:<span key={i}>{item.part}</span>)}</span>;
}
type Experiment={before:string;after:string;formula:string;initial:string;final:string;note:string;colorBefore:string;colorAfter:string};
const experiments:Record<string,Experiment>={
 "chem-experiment-salt":{
  before:"Кристалл NaCl и вода",after:"Гидратированные ионы",formula:"NaCl → Na⁺ + Cl⁻",
  initial:"Кристалл соли",final:"Na⁺        Cl⁻",note:"Растворение и диссоциация в воде. Это не новая реакция синтеза.",
  colorBefore:"#94b6dc",colorAfter:"#b5dcf3"},
 "chem-experiment-litmus":{
  before:"Синий лакмус",after:"Лакмус в кислой среде",formula:"Индикатор: синий → красный",
  initial:"Лакмус",final:"Лакмус",note:"Качественная модель изменения окраски индикатора в кислой среде.",
  colorBefore:"#4570c4",colorAfter:"#d35d68"},
 "chem-experiment-lime":{
  before:"Известковая вода",after:"Помутнение",formula:"CO2 + Ca(OH)2 → CaCO3↓ + H2O",
  initial:"Прозрачный раствор",final:"Осадок CaCO₃",note:"Образование карбоната кальция показано условно, не в масштабе.",
  colorBefore:"#d8eefa",colorAfter:"#c9d0d6"}
};
export default function LektrusChemistryIllustration({item,onStageChange}:{
 item:Item;onStageChange?:(stage:0|1)=>void
}){
 const experiment=experiments[item.graphFigureId??""];
 const [localStage,setLocalStage]=useState<0|1>(item.scienceExperimentStage??0);
 useEffect(()=>setLocalStage(item.scienceExperimentStage??0),[item.scienceExperimentStage,item.id]);
 const stage=onStageChange?(item.scienceExperimentStage??0):localStage;
 const setStage=(next:0|1)=>onStageChange?onStageChange(next):setLocalStage(next);
 if(!experiment)return <div className="lektrus-chem-formula-sheet">
  <strong>{item.text}</strong>
  <Formula value={item.graphExpression??""}/>
  <small>Числа после символов обозначены нижними индексами. Коэффициенты не изменяются.</small>
 </div>;
 const before=stage===0;
 return <div className="lektrus-chem-experiment-sheet">
  <strong>{item.text}</strong>
  <div className="lektrus-chem-experiment-stages" role="group" aria-label="Этап учебного опыта">
   <button type="button" aria-pressed={before} onClick={()=>setStage(0)}>До</button>
   <button type="button" aria-pressed={!before} onClick={()=>setStage(1)}>После</button>
  </div>
  <svg viewBox="0 0 540 280" role="img" aria-label={(before?experiment.before:experiment.after)}>
   <defs><linearGradient id={"liquid-"+item.id} x1="0" x2="0" y1="0" y2="1">
    <stop stopColor="#fff" offset="0"/><stop stopColor={before?experiment.colorBefore:experiment.colorAfter} offset="1"/>
   </linearGradient></defs>
   <rect x="54" y="22" width="432" height="234" rx="16" fill="#f8fbff" stroke="#d8e4f4"/>
   <path d="M155 65 L155 208 Q155 236 182 236 L360 236 Q385 236 385 208 L385 65" stroke="#7096c5"
     strokeWidth="6" fill="none" strokeLinecap="round"/>
   <path d="M162 146 H378 V204 Q378 229 357 229 H185 Q162 229 162 204Z"
     fill={before?experiment.colorBefore:experiment.colorAfter} fillOpacity=".65"/>
   <path d="M162 146 H378" stroke="#86aed0" strokeWidth="2" strokeDasharray="8 5"/>
   {item.graphFigureId==="chem-experiment-salt"?before?
    <g>{Array.from({length:9},(_,i)=><rect key={i} x={225+(i%3)*24} y={173+Math.floor(i/3)*19}
      width="18" height="14" fill="#f4fbff" stroke="#7492b7"/>)}</g>:
    <g>{[["+","Na",205,176],["−","Cl",312,180],["+","Na",240,213],["−","Cl",341,210]].map(([sign,ion,x,y],i)=>
      <g key={i}><circle cx={Number(x)} cy={Number(y)} r="16" fill={sign==="+"?"#cce4fa":"#eff5fb"} stroke="#719ac4"/>
       <text x={Number(x)} y={Number(y)+4} textAnchor="middle" fill="#345f94" fontSize="13" fontWeight="700">{ion}{sign}</text></g>)}</g>
   :item.graphFigureId==="chem-experiment-litmus"?
    <g transform="rotate(12 280 160)"><rect x="266" y="86" width="26" height="145" rx="4" fill={before?"#4479cb":"#d45b6d"}
      stroke="#38547a" strokeWidth="1.4"/></g>
   :!before?<g>{Array.from({length:34},(_,i)=><circle key={i}
       cx={185+(i*41)%171} cy={165+(i*13)%56} r={i%4===0?6:3.5}
       fill="#f9fbfd" stroke="#afb9c6" strokeWidth=".7"/>)}</g>:null}
   <text x="270" y="51" textAnchor="middle" fill="#385b86" fontSize="19" fontWeight="700">
    {before?experiment.before:experiment.after}
   </text>
  </svg>
  <div className="lektrus-chem-experiment-formula"><Formula value={experiment.formula}/></div>
  <small>{experiment.note} Учебная визуализация, не инструкция к лабораторному опыту.</small>
 </div>;
}
