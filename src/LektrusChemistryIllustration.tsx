import {useEffect,useState} from "react";
import type {Item} from "./boardModel";
import {LektrusChemicalEquationBoardView} from "./LektrusChemicalEquationEditor";
import {LektrusReactionScene} from "./LektrusReactionLab";
import LektrusChemistryBenchSurface from "./LektrusChemistryBench";
import {pourLabVessel,putLabReagent,readLabBench,selectLabVessel,type LabBench}
 from "./lektrusChemistryBenchModel";

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
const observationPalette={
 gas:{stroke:"#348ac7",fill:"#e6f4ff"},
 solid:{stroke:"#71869b",fill:"#acbdce"},
 solution:{stroke:"#648bad",fill:"#83bde6"}
} as const;
// The same shapes and symbols mean the same observation in every experiment;
// colour is data, not a different vessel or different notation.
function ObservationIcon({type,color}:{type:"gas"|"solid"|"solution";color:string}){
 return <svg viewBox="0 0 28 23" width="28" height="23" aria-hidden="true">
  {type==="gas"?<g fill="none" stroke={color} strokeWidth="1.7">
   <circle cx="8" cy="14" r="3.6"/><circle cx="17" cy="7" r="4.5"/><circle cx="21" cy="17" r="2.5"/>
  </g>:type==="solid"?<g fill={color} stroke={color}>
   <circle cx="8" cy="16" r="3"/><circle cx="14" cy="10" r="3.2"/><circle cx="20" cy="16" r="3"/>
  </g>:<g stroke={color} strokeWidth="1.6" fill="none">
   <path d="M5 4v13q0 4 4 4h10q4 0 4-4V4"/><path d="M6 12h16" strokeWidth="4" opacity=".45"/>
  </g>}
 </svg>
}
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
export default function LektrusChemistryIllustration({item,onStageChange,onBenchChange,onOpenEditor}:{
 item:Item;onStageChange?:(stage:0|1)=>void;
 onBenchChange?:(bench:LabBench)=>void;onOpenEditor?:()=>void
}){
 const experiment=experiments[item.graphFigureId??""];
 const [localStage,setLocalStage]=useState<0|1>(item.scienceExperimentStage??0);
 const [pourSource]=useState<string|null>(null);
 const bench=readLabBench(item);
 const changeBench=(next:LabBench)=>{if(next!==bench)onBenchChange?.(next)};
 const pour=(from:string,to:string)=>changeBench(pourLabVessel(bench,from,to));
 useEffect(()=>setLocalStage(item.scienceExperimentStage??0),[item.scienceExperimentStage,item.id]);
 const stage=onStageChange?(item.scienceExperimentStage??0):localStage;
 const setStage=(next:0|1)=>onStageChange?onStageChange(next):setLocalStage(next);
 if(item.graphFigureId==="chem-experiment-free")return item.scienceLabBench?
  <div className="lektrus-chemistry-bench-on-board">
   <LektrusChemistryBenchSurface bench={bench} editable={!!onBenchChange}
    pouringId={pourSource} onChange={changeBench}
    onSelect={id=>changeBench(selectLabVessel(bench,id))}
    onPour={onBenchChange?pour:undefined}
    onDropReagent={onBenchChange?(id,reagent,dose)=>{
      const updated=putLabReagent(bench,id,reagent,dose);
      if(updated!==bench)changeBench(updated);
    }:undefined}/>
  </div>:
  <LektrusReactionScene item={item} stage={stage} onStageChange={onStageChange??setLocalStage}/>;
 if(!experiment)return <LektrusChemicalEquationBoardView item={item}/>;
 const before=stage===0;
 const salt=item.graphFigureId==="chem-experiment-salt";
 const indicator=item.graphFigureId==="chem-experiment-litmus";
 const lime=item.graphFigureId==="chem-experiment-lime";
 const liquidColor=indicator?(before?"#4a83d1":"#d4566d"):(lime?(before?"#cfe5f5":"#dce4eb"):"#9ed0ed");
 const gasColor=observationPalette.gas.stroke;
 const gas=lime&&before;
 const sediment=(salt&&before)||(lime&&!before);
 const precipitate=lime&&!before;
 const solidColor=precipitate?"#8b9cab":salt?"#d3e3f2":observationPalette.solid.fill;
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
     fill="none" stroke={gasColor} strokeWidth="1.7"/>)}
   {sediment&&particles(28).map((p,i)=><ellipse key={"solid"+i}
     cx={p.x} cy={p.y+(precipitate?10:3)} rx={p.r+1} ry={p.r*.63}
     fill={solidColor} stroke={observationPalette.solid.stroke}
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
  <div className="lektrus-chem-experiment-legend lektrus-observation-legend" aria-label="Условные обозначения">
   <span className={gas?"active":""}><ObservationIcon type="gas" color={gasColor}/> Газ · пузырьки</span>
   <span className={sediment?"active":""}><ObservationIcon type="solid" color={solidColor}/> {lime?"Осадок":"Твёрдое вещество"} · частицы</span>
   <span className="active"><ObservationIcon type="solution" color={liquidColor}/> Окраска раствора</span>
  </div>
  <div className="lektrus-chem-experiment-formula"><Formula value={experiment.formula}/></div>
  <small>{experiment.note} Схема качественная: размеры и количества частиц условны.</small>
 </div>;
}
