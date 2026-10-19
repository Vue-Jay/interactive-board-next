import {useMemo,useState} from "react";
import {createPortal} from "react-dom";
import type {Item} from "./boardModel";
import {identifyReaction,substances,reviewedReactionCases,type ReactionEnvironment,type Observation} from "./lektrusReactionDatabase";
import {LektrusChemicalEquationTypeset} from "./LektrusChemicalEquationEditor";

const conditions:{id:ReactionEnvironment;title:string;help:string}[]=[
 {id:"aqueous",title:"Водная среда",help:"Растворы, разбавленные кислоты и щёлочи"},
 {id:"dry",title:"Без растворителя",help:"Реакции или изменения без водной среды"},
 {id:"heated",title:"Нагревание",help:"Только для реакций, для которых известен соответствующий нагрев"},
 {id:"ignited",title:"Горение",help:"Теоретическая модель окисления при достатке кислорода"}
];
const phases:Record<Observation,{caption:string;color:string}>={
 gas:{caption:"Газ · пузырьки",color:"#6aa9e3"},
 precipitate:{caption:"Осадок · частицы",color:"#ac8d66"},
 color:{caption:"Изменение окраски",color:"#759abb"},
 heat:{caption:"Выделение энергии",color:"#e3ab6b"},
 dissolution:{caption:"Растворение",color:"#77b9c5"},
 none:{caption:"Нет изменений",color:"#95a9bf"}
};
export function LektrusReactionScene({item,stage,onStageChange}:{item:Item;stage:0|1;onStageChange?:(v:0|1)=>void}){
 const ids=item.scienceReagents??[];
 const matched=identifyReaction(ids,item.scienceEnvironment??"aqueous");
 const matchedCase=matched.caseData;
 const observation=stage===1&&matched.status==="reaction"?matchedCase?.observation??"none":"none";
 const reagentNames=ids.map(id=>substances.find(s=>s.id===id)?.name??id);
 const selectedSubstances=ids.map(id=>substances.find(s=>s.id===id));
 const beforeColor=matchedCase?.beforeColor??"#bcdcf4";
 // A coloured precipitate is NOT the colour of the remaining solution.
 // Keep phase colours separate to avoid teaching the wrong observation.
 const solidColor=matchedCase?.afterColor??"#bdc7d0";
 const afterColor=observation==="precipitate"?"#d9eaf5":
   observation==="color"?(matchedCase?.afterColor??"#d5b89e"):
   matchedCase?.afterColor??beforeColor;
 const color=stage===1?afterColor:beforeColor;
 const theme=matched.status==="reaction"?"reaction":matched.status==="none"?"none":"unknown";
 return <div className={"lektrus-reaction-scene is-"+theme}>
  <div className="lektrus-reaction-scene-head">
   <strong>{reagentNames.length?reagentNames.join(" + "):"Выберите вещества"}</strong>
   <span>{conditions.find(c=>c.id===(item.scienceEnvironment??"aqueous"))?.title}</span>
  </div>
  {onStageChange&&<div className="lektrus-chem-experiment-stages" role="group" aria-label="Этап реакции">
   <button type="button" aria-pressed={stage===0} onClick={()=>onStageChange(0)}>До</button>
   <button type="button" aria-pressed={stage===1} onClick={()=>onStageChange(1)}>После</button>
  </div>}
  <div className="lektrus-reaction-addition" aria-label="Выбранные вещества">
   {selectedSubstances.map((reagent,index)=><div className="lektrus-reaction-addition-vial" key={ids[index]+index}>
    <span className="lektrus-reaction-addition-index">{index+1}</span>
    <span className="lektrus-reaction-vial-icon" aria-hidden="true"><span/></span>
    <strong>{reagent?.formula??ids[index]}</strong>
    <small>{reagent?.name??"Справочное вещество"}</small>
   </div>)}
   {!ids.length&&<small>Добавьте реагенты слева, чтобы увидеть их в модели</small>}
  </div>
  <svg viewBox="0 0 520 270" role="img" aria-label="Качественная модель смеси, пузырьков газа и осадка">
   <defs>
    <linearGradient id="lektrus-liquid-glow" x1="0%" y1="0%" x2="100%" y2="80%">
     <stop offset="0%" stopColor="#fff" stopOpacity=".52"/>
     <stop offset="55%" stopColor="#fff" stopOpacity=".05"/>
     <stop offset="100%" stopColor="#5f95b8" stopOpacity=".18"/>
    </linearGradient>
   </defs>
   <rect x="18" y="10" width="484" height="250" rx="13" fill="#f5f9ff" stroke="#dce7f4"/>
   <ellipse cx="260" cy="228" rx="113" ry="8" fill="#87a9ca" opacity=".13"/>
   <path d="M160 40V205Q160 231 186 231H334Q360 231 360 205V40" fill="none" stroke="#84a9d1" strokeWidth="6" strokeLinecap="round"/>
   <path d="M165 135H355V207Q355 226 334 226H186Q165 226 165 207Z" fill={color} opacity=".82"/>
   <path d="M165 135H355V207Q355 226 334 226H186Q165 226 165 207Z" fill="url(#lektrus-liquid-glow)"/>
   <path d="M165 135Q202 131 244 135T355 135" stroke="#6199cb" fill="none" strokeWidth="2.5" strokeLinecap="round"/>
   {stage===1&&matched.status==="reaction"&&<>
    {observation==="gas"&&<g>
     {Array.from({length:24},(_,i)=>{
      const cx=185+(i*47)%150,cy=150+(i*29)%63,r=2.8+(i%5)*1.3;
      return <g key={i} className="lektrus-reaction-bubble">
       <circle cx={cx} cy={cy} r={r} fill="#fff" fillOpacity=".28" stroke="#568ec4" strokeWidth="1.5"/>
       <path d={"M"+(cx-r*.45)+" "+(cy-r*.35)+"q"+(r*.2)+" "+(-r*.35)+" "+(r*.48)+" "+(-r*.24)} stroke="#fff" strokeWidth="1.3" fill="none" strokeLinecap="round"/>
      </g>;
     })}
     {Array.from({length:5},(_,i)=><circle key={"escape"+i} cx={213+i*22} cy={120-(i%3)*18} r={2.5+(i%2)} fill="none" stroke="#7caad3" strokeWidth="1.5" opacity=".7"/>)}
    </g>}
    {observation==="precipitate"&&<g>
     <path d="M166 211Q191 199 218 207T273 208T328 205Q345 206 354 210V210Q353 225 334 226H186Q169 226 166 211Z"
      fill={solidColor} opacity=".9"/>
     <path d="M171 212Q204 201 235 211T306 208T349 210" stroke="#71869a" fill="none" strokeWidth="1.3" opacity=".65"/>
     {Array.from({length:64},(_,i)=>{const cx=176+(i*37)%169,cy=207+(i*17)%17;
      return <circle key={i} cx={cx} cy={cy} r={.9+i%4*.47} fill={i%4===0?"#eef3f8":solidColor} stroke="#71839b" strokeWidth=".45" opacity=".85"/>;
     })}
     {Array.from({length:12},(_,i)=><circle key={"s"+i} cx={189+(i*31)%140} cy={158+(i*17)%43} r={1.3+i%3*.7} fill={solidColor} opacity=".58"/>)}
    </g>}
    {observation==="dissolution"&&Array.from({length:9},(_,i)=><circle key={i} cx={200+(i*39)%135} cy={156+(i*17)%55} r="3" fill="#8eafd0" opacity=".45"/>)}
    {observation==="heat"&&<g fill="none" stroke="#d68a44" strokeWidth="2">
     <path d="M220 120Q207 100 220 80M260 120Q247 100 260 80M300 120Q287 100 300 80"/>
    </g>}
   </>}
   {stage===1&&matched.status!=="reaction"&&<>
    <circle cx="260" cy="104" r="27" fill="#fff" stroke={matched.status==="none"?"#8aa4bb":"#d9b26e"} strokeWidth="2"/>
    <text x="260" y="114" textAnchor="middle" fill={matched.status==="none"?"#7593b2":"#b08036"}
      fontSize="29" fontWeight="750">{matched.status==="none"?"−":"?"}</text>
   </>}
   <text x="260" y="251" textAnchor="middle" fontSize="11" fill="#6781a0">
    {stage===0?"Исходное состояние":matched.status==="reaction"?phases[observation].caption:matched.status==="none"?"Нет наблюдаемого превращения":"Нет достоверной модели"}
   </text>
  </svg>
  <div className="lektrus-reaction-outcome" role="status">
   <strong>{stage===0?"Исходные вещества":matched.status==="reaction"?"Реакция подтверждена":matched.status==="none"?"Превращение не наблюдается":"Данных недостаточно"}</strong>
   <p>{stage===0?"Выбранные реагенты и среда. Нажмите «После», чтобы увидеть известный результат.":matched.message}</p>
   {stage===1&&matchedCase?.equation&&<LektrusChemicalEquationTypeset expression={matchedCase.equation}/>}
   {stage===1&&matchedCase?.safety&&<small>{matchedCase.safety}</small>}
  </div>
  <small className="lektrus-reaction-disclaimer">Схема качественная. Не моделирует скорости, концентрации и точные количества продуктов. Не является лабораторной инструкцией.</small>
 </div>;
}
type Props={item:Item;onChange:(item:Item)=>void;onSave:()=>void;onCancel:()=>void};
export default function LektrusReactionLab({item,onChange,onSave,onCancel}:Props){
 const [query,setQuery]=useState("");
 const [group,setGroup]=useState("Все классы");
 const [remote,setRemote]=useState<{formula:string;name:string}|null>(null);
 const [remoteState,setRemoteState]=useState("");
 const [stage,setStage]=useState<0|1>(item.scienceExperimentStage??0);
 const chosen=item.scienceReagents??[];
 const classes=useMemo(()=>["Все классы",...new Set(substances.map(s=>s.kind))],[]);
 const options=useMemo(()=>substances.filter(s=>
  (group==="Все классы"||s.kind===group)&&
  (s.name+" "+s.formula+" "+s.kind).toLocaleLowerCase("ru").includes(query.toLocaleLowerCase("ru"))
 ).slice(0,250),[group,query]);
 const findPubChem=async()=>{
  if(query.trim().length<2)return;
  setRemote(null);setRemoteState("Поиск в PubChem…");
  try{
   const response=await fetch("https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/"+
     encodeURIComponent(query.trim())+"/property/MolecularFormula/JSON");
   if(!response.ok)throw Error("Нет однозначного совпадения или сервис недоступен");
   const data=await response.json() as {PropertyTable?:{Properties?:{MolecularFormula?:string}[]}};
   const formula=data.PropertyTable?.Properties?.[0]?.MolecularFormula;
   if(!formula||formula.length>70)throw Error("Невозможно получить формулу");
   setRemote({formula,name:query.trim()});
   setRemoteState("Найдено совпадение PubChem. Подтвердите формулу перед добавлением.");
  }catch(error){setRemoteState((error instanceof Error?error.message:"Ошибка поиска")+
    ". Данные PubChem требуют доступа к интернету.");}
 };
 const toggle=(id:string)=>{
  setStage(0);
  onChange({...item,scienceReagents:chosen.includes(id)?
   chosen.filter(v=>v!==id):chosen.length<6?[...chosen,id]:chosen,scienceExperimentStage:0});
 };
 return createPortal(<div className="lektrus-reaction-lab-overlay"
  onPointerDown={e=>{if(e.target===e.currentTarget)onCancel()}}>
  <section className="lektrus-reaction-lab" role="dialog" aria-modal="true" aria-label="Моделирование химической реакции"
    onPointerDown={e=>e.stopPropagation()}>
   <header><div><strong>Моделирование опытов</strong>
    <small>{substances.length} веществ · {reviewedReactionCases.length} проверенных случаев</small></div>
    <button type="button" onClick={onCancel} aria-label="Закрыть">×</button>
   </header>
   <div className="lektrus-reaction-lab-body">
    <aside className="lektrus-reaction-reagents">
     <strong>Вещества (до 6)</strong>
     <div className="lektrus-reaction-chosen" role="group" aria-label="Выбранные реагенты">
      {chosen.length===0?<small>Выберите два или более вещества. Для некоторых термических разложений достаточно одного.</small>:chosen.map((id,index)=>{
       const reagent=substances.find(s=>s.id===id);
       return <button className="lektrus-reaction-selected-chip" key={id} type="button" onClick={()=>toggle(id)} title="Убрать реагент">
        <span className="lektrus-reaction-selected-number">{index+1}</span>
        <span><strong>{reagent?.formula??id}</strong><small>{reagent?.name??"Добавленный реагент"}</small></span>
        <span className="lektrus-reaction-remove" aria-hidden="true">×</span>
       </button>;
      })}
     </div>
     <input type="search" value={query} placeholder="Поиск по названию или формуле"
      onChange={e=>setQuery(e.target.value)} aria-label="Поиск веществ"/>
     <div className="lektrus-remote-substance">
      <button type="button" disabled={!query.trim()} onClick={()=>void findPubChem()}>
       Найти в PubChem
      </button>
      {remoteState&&<small role="status">{remoteState}</small>}
      {remote&&<button type="button" className="lektrus-remote-result"
       onClick={()=>{
        if(!chosen.includes(remote.formula)&&chosen.length<6){
         setStage(0);onChange({...item,scienceReagents:[...chosen,remote.formula],scienceExperimentStage:0});
        }
        setRemote(null);
       }}>{remote.formula} · добавить после проверки</button>}
     </div>
     <select value={group} onChange={e=>setGroup(e.target.value)} aria-label="Класс вещества">
      {classes.map(g=><option key={g} value={g}>{g}</option>)}
     </select>
     <div className="lektrus-reaction-reagent-list" role="group" aria-label="Вещества">
      {options.map(s=><button key={s.id} type="button" className={chosen.includes(s.id)?"selected":""}
       aria-pressed={chosen.includes(s.id)} onClick={()=>toggle(s.id)}
       disabled={!chosen.includes(s.id)&&chosen.length>=6}>
       <b>{s.formula}</b><span>{s.name}</span><small>{s.kind}</small>
      </button>)}
     </div>
    </aside>
    <div className="lektrus-reaction-simulator">
     <label>Условия
      <select value={item.scienceEnvironment??"aqueous"}
        onChange={e=>{setStage(0);onChange({...item,scienceEnvironment:e.target.value as ReactionEnvironment,scienceExperimentStage:0})}}>
       {conditions.map(c=><option key={c.id} value={c.id}>{c.title}</option>)}
      </select>
     </label>
     <small>{conditions.find(c=>c.id===(item.scienceEnvironment??"aqueous"))?.help}</small>
     <LektrusReactionScene item={item} stage={stage} onStageChange={next=>{
      setStage(next);onChange({...item,scienceExperimentStage:next});
     }}/>
    </div>
   </div>
   <footer><button type="button" onClick={onCancel}>Отмена</button>
    <button type="button" className="primary" disabled={!chosen.length}
     onClick={onSave}>Вывести модель на доску</button></footer>
  </section>
 </div>,document.body);
}
