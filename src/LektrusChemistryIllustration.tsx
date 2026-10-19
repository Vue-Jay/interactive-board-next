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
 const salt=item.graphFigureId==="chem-experiment-salt";
 const indicator=item.graphFigureId==="chem-experiment-litmus";
 const lime=item.graphFigureId==="chem-experiment-lime";
 const liquidColor=indicator?(before?"#4a83d1":"#d4566d"):(lime?(before?"#cfe5f5":"#dce4eb"):"#9ed0ed");
 const gas=lime&&before;
 const sediment=(salt&&before)||(lime&&!before);
 const precipitate=lime&&!before;
 const particles=(count:number)=>Array.from({length:count},(_,i)=>({
   x:193+(i*37)%158,y:200+(i*17)%30,r:2+(i%3)
 }));
 return <div className="lektrus-chem-experiment-sheet">
  <strong>{item.text}</strong>
  <div className="lektrus-chem-experiment-stages" role="group" aria-label="Этап учебного опыта">
   <button type="button" aria-pressed={before} onClick={()=>setStage(0)}>До</button>
   <button type="button" aria-pressed={!before} onClick={()=>setStage(1)}>После</button>
  </div>
  <svg viewBox="0 0 540 310" role="img" aria-label={(before?experiment.before:experiment.after)}>
   <rect x="48" y="15" width="444" height="273" rx="16" fill="#f8fbff" stroke="#dce7f5"/>
   <text x="270" y="44" textAnchor="middle" fill="#365a85" fontWeight="700" fontSize="19">
    {before?experiment.before:experiment.after}
   </text>
   <path d="M153 72V234 Q153 265 184 265H356 Q387 265 387 234V72"
      stroke="#79a1c9" strokeWidth="6" fill="none" strokeLinecap="round"/>
   <path d="M161 157H379V236 Q379 257 357 257H183Q161 257 161 236Z"
      fill={liquidColor} fillOpacity=".63"/>
   <path d="M161 157H379" stroke="#83a8cd" strokeWidth="2" fill="none"/>
   {/* One symbol system is used for all experiments: circles=gas, grains=solid, fill=colour. */}
   {gas&&Array.from({length:9},(_,i)=><circle key={"gas"+i}
     cx={209+(i*31)%131} cy={135-(i*23)%95} r={4+i%3}
     fill="none" stroke="#4592ca" strokeWidth="1.7"/>)}
   {sediment&&particles(28).map((p,i)=><ellipse key={"solid"+i}
     cx={p.x} cy={p.y+(precipitate?10:3)} rx={p.r+1} ry={p.r*.63}
     fill={precipitate?"#8e9ba9":"#f6fbff"} stroke={precipitate?"#6a798b":"#7895b4"}
     strokeWidth=".8"/>)}
   {indicator&&<rect x="266" y="85" width="14" height="165" rx="3"
     transform="rotate(11 273 165)" fill={before?"#3e71bd":"#bd4b62"}
     stroke="#527395" strokeWidth="1.4"/>}
   {salt&&!before&&Array.from({length:9},(_,i)=>{
    const plus=i%2===0,x=195+(i*41)%154,y=170+(i*19)%69;
    return <g key={"ion"+i}><circle cx={x} cy={y} r="12"
      fill={plus?"#d2e7f8":"#e8f5fd"} stroke="#78a1c7"/>
     <text x={x} y={y+4} textAnchor="middle" fill="#38679c" fontSize="10" fontWeight="700">
      {plus?"Na⁺":"Cl⁻"}
     </text></g>;
   })}
  </svg>
  <div className="lektrus-chem-experiment-legend" aria-label="Условные обозначения">
   <span><i className="lektrus-legend-gas"/> Газ</span>
   <span><i className="lektrus-legend-solid"/> {lime?"Осадок":"Твёрдое вещество"}</span>
   <span><i className="lektrus-legend-liquid" style={{background:liquidColor}}/> Цвет раствора</span>
  </div>
  <div className="lektrus-chem-experiment-formula"><Formula value={experiment.formula}/></div>
  <small>{experiment.note} Схема качественная: размеры и количества частиц условны.</small>
 </div>;
}
