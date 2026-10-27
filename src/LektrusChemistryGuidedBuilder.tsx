import {useMemo,useState} from "react";
import type {Item} from "./boardModel";
import type {EquationDraft,EquationSpecies} from "./lektrusChemicalEquationModel";
import {
 anions,cations,composeReviewedIonicCompound,getReactionGuidance,isBuilderCompatible,
 reactionEnvironments,reactionExamples,searchSchoolSubstances,
 sourceReactionDraft,substanceCategories,suggestedPartners
} from "./lektrusChemicalReactionGuide";
import type {ReactionCase,ReactionEnvironment} from "./lektrusReactionDatabase";

type Side="left"|"right";
type Props={
 item:Item;draft:EquationDraft;
 onChange:(item:Item)=>void;onDraft:(draft:EquationDraft)=>void;
 onSelectScenario:(caseData:ReactionCase,environment:ReactionEnvironment)=>void;
};
const observing:Record<string,string>={
 precipitate:"Образование осадка ↓",gas:"Выделение газа ↑",
 color:"Изменение окраски",heat:"Тепловой эффект",
 dissolution:"Растворение",none:"Без выраженного признака"
};

export default function LektrusChemistryGuidedBuilder({item,draft,onChange,onDraft,onSelectScenario}:Props){
 const [open,setOpen]=useState(true);
 const [tab,setTab]=useState<"catalog"|"ion"|"examples">("catalog");
 const [target,setTarget]=useState<Side>("left");
 const [query,setQuery]=useState("");
 const [kind,setKind]=useState("Все");
 const [cationIndex,setCationIndex]=useState(0);
 const [anionIndex,setAnionIndex]=useState(0);
 const environment=item.scienceEnvironment??"aqueous";
 const guidance=useMemo(()=>getReactionGuidance(draft,environment),[draft,environment]);
 const selected=composeReviewedIonicCompound(cations[cationIndex],anions[anionIndex]);
 const candidates=searchSchoolSubstances(query,kind,18);
 const partners=suggestedPartners(draft.left.map(s=>s.formula),environment,8);
 const fill=(formula:string,side:Side=target)=>{
  const next:EquationDraft={...draft,left:draft.left.map(v=>({...v})),right:draft.right.map(v=>({...v}))};
  const rows=next[side];
  const firstEmpty=rows.findIndex(v=>!v.formula.trim());
  const position=firstEmpty>=0?firstEmpty:rows.length;
  if(position>=10)return;
  const entry:EquationSpecies={formula,coefficient:1,indicator:""};
  if(firstEmpty>=0)rows[firstEmpty]=entry;else rows.push(entry);
  onDraft(next);
 };
 const setEnvironment=(environment:ReactionEnvironment)=>onChange({...item,scienceEnvironment:environment});
 const useReaction=(reaction:ReactionCase,env:ReactionEnvironment)=>{
  onSelectScenario(reaction,env);
  setOpen(false);
 };
 const known=guidance.matched?.status==="reaction"?guidance.matched:null;
 const prepared=known?sourceReactionDraft(known):null;
 const productsCanApply=prepared?.right.length&&guidance.products!=="match";
 return <section className="lektrus-chem-knowledge" aria-label="Помощник составления реакций">
  <button type="button" className="lektrus-chem-knowledge-title" aria-expanded={open}
   onClick={()=>setOpen(v=>!v)}>
   <span><strong>Составить реакцию</strong><small>Выберите вещества и условия, затем определите продукты</small></span>
   <span aria-hidden="true">{open?"−":"+"}</span>
  </button>
  {open&&<div className="lektrus-chem-knowledge-body">
   <div className="lektrus-chem-knowledge-steps" aria-label="Порядок работы">
    <span><b>1</b> Исходные вещества</span><span><b>2</b> Условия и продукты</span><span><b>3</b> Проверка</span>
   </div>
   <div className="lektrus-chem-knowledge-tabs" role="group" aria-label="Способ выбора вещества">
    <button type="button" aria-pressed={tab==="catalog"} onClick={()=>setTab("catalog")}>Справочник веществ</button>
    <button type="button" aria-pressed={tab==="ion"} onClick={()=>setTab("ion")}>Составить по ионам</button>
    <button type="button" aria-pressed={tab==="examples"} onClick={()=>setTab("examples")}>Проверенные реакции</button>
   </div>
   {tab!=="examples"&&<div className="lektrus-chem-target-choice" role="group" aria-label="Куда добавить вещество">
    <span>Добавить в</span>
    <button type="button" aria-pressed={target==="left"} onClick={()=>setTarget("left")}>Реагенты</button>
    <button type="button" aria-pressed={target==="right"} onClick={()=>setTarget("right")}>Продукты</button>
   </div>}
   {tab==="catalog"&&<div className="lektrus-chem-catalog">
    <div className="lektrus-chem-catalog-filters">
     <input type="search" value={query} onChange={e=>setQuery(e.target.value)}
      aria-label="Поиск вещества по названию или формуле"
      placeholder="Например: серная кислота, CuSO4..."/>
     <select value={kind} aria-label="Класс вещества"
      onChange={e=>setKind(e.target.value)}>
      {substanceCategories.map(name=><option key={name}>{name}</option>)}
     </select>
    </div>
    {target==="left"&&partners.length>0&&<div className="lektrus-chem-partners">
     <strong>Что может реагировать с выбранным веществом в этих условиях</strong>
     <div>{partners.map(s=><button type="button" key={s.id} onClick={()=>fill(s.formula,"left")}>
      <b>{s.formula}</b><small>{s.name}</small></button>)}</div>
    </div>}
    <div className="lektrus-chem-catalog-results" role="group" aria-label="Вещества из справочника">
     {candidates.map(s=><button type="button" key={s.id}
      title={"Добавить "+s.name} onClick={()=>fill(s.formula)}>
      <strong>{s.formula}</strong><span>{s.name}</span><small>{s.kind}</small>
     </button>)}
     {!candidates.length&&<p>В справочнике нет такого вещества. Используйте ручной ввод формулы ниже.</p>}
    </div>
   </div>}
   {tab==="ion"&&<div className="lektrus-chem-ions">
    <p>Выберите заряженные частицы. Индексы рассчитываются по условию электрической нейтральности. Добавить можно только вещество, присутствующее в справочнике.</p>
    <div className="lektrus-chem-ion-pickers">
     <label>Положительный ион
      <select value={cationIndex} onChange={e=>setCationIndex(Number(e.target.value))}>
       {cations.map((ion,i)=><option key={i} value={i}>{ion.name}</option>)}
      </select>
     </label>
     <label>Отрицательный ион
      <select value={anionIndex} onChange={e=>setAnionIndex(Number(e.target.value))}>
       {anions.map((ion,i)=><option key={i} value={i}>{ion.name}</option>)}
      </select>
     </label>
    </div>
    <div className="lektrus-chem-ion-result">
     <div><span>Полученная формула</span><strong>{selected.formula}</strong>
      <small>{selected.substance?.name??selected.error}</small>
     </div>
     <button type="button" disabled={!selected.substance}
      onClick={()=>selected.substance&&fill(selected.substance.formula)}>
      Добавить вещество
     </button>
    </div>
   </div>}
   {tab==="examples"&&<div className="lektrus-chem-examples">
    {reactionExamples.map(ex=><button type="button" key={ex.id}
     onClick={()=>useReaction(ex.reaction,ex.environment)}>
     <span>{ex.type}</span><strong>{ex.label}</strong>
     <small>{reactionEnvironments.find(x=>x.id===ex.environment)?.label}</small>
    </button>)}
   </div>}
   <div className="lektrus-chem-environments" aria-label="Условия протекания реакции">
    <strong>Среда и условия реакции</strong>
    <div role="group" aria-label="Среда реакции">
     {reactionEnvironments.map(e=><button type="button" key={e.id}
      aria-pressed={environment===e.id} title={e.help}
      onClick={()=>setEnvironment(e.id)}>{e.label}</button>)}
    </div>
   </div>
  </div>}
  <div className={"lektrus-chem-reaction-guidance "+guidance.status}
   role="status" aria-label="Справочная проверка реакции">
   <div className="lektrus-chem-guidance-copy">
    <strong>{guidance.title}</strong><span>{guidance.description}</span>
    {known&&<small>{observing[known.observation]??"Справочное наблюдение"}</small>}
    {guidance.warning&&<small className="lektrus-chem-guidance-warning">{guidance.warning}</small>}
    {guidance.status==="reaction"&&guidance.products==="match"&&
     <small>Состав продуктов совпадает со справочным случаем. Проверьте коэффициенты ниже.</small>}
    {guidance.status==="reaction"&&guidance.products==="different"&&
     <small className="lektrus-chem-guidance-warning">
      Указанные продукты отличаются от проверенного случая при выбранных условиях.
     </small>}
    {guidance.status==="none"&&
     <small>Не следует придумывать продукты. Попробуйте другие вещества или условия.</small>}
   </div>
   {productsCanApply&&known&&<button type="button" className="lektrus-chem-use-reaction"
    onClick={()=>useReaction(known,environment)}>Вставить проверенное уравнение</button>}
  </div>
  {!isBuilderCompatible(draft)&&<small className="lektrus-chem-guidance-warning">
   Заряженные частицы и специальные формулы лучше редактировать во вкладке «Текстом»: обычная атомная балансировка не учитывает заряд.
  </small>}
 </section>;
}
