import {Fragment,useRef,useState,type ReactNode} from "react";
import {classroomEquationExamples,reviewEquationChain,applyKnownProductMarks,balancedStep,type EquationDomain,type EquationStep} from "./lektrusEquationReview";
import {createPortal} from "react-dom";
import type {Item} from "./boardModel";
import {
 parseEquationDraft,type EquationArrow,type EquationSpecies
} from "./lektrusChemicalEquationModel";
import {
 readReactionText,writeReactionText,REACTION_CONDITION_GROUPS,REACTION_CONDITION_LIMIT,
 parseConditionTokens,toggleReactionCondition
} from "./lektrusChemicalEquationControls";

type Props={item:Item;onChange:(item:Item)=>void;onSave:()=>void;onCancel:()=>void};
type Side="left"|"right";
const subscripts="₀₁₂₃₄₅₆₇₈₉";
const indexed=/([A-Z][a-z]?|[)\]])([0-9]+)/g;
const arrows:{value:EquationArrow;label:string;title:string}[]=[
 {value:"→",label:"→",title:"Необратимая реакция"},
 {value:"⇌",label:"⇌",title:"Обратимая реакция"},
 {value:"=",label:"=",title:"Уравнение со знаком равенства"}
];

function FormulaPart({value}:{value:string}){
 const normalized=value.replace(/[₀-₉]/g,s=>String(subscripts.indexOf(s)));
 const chunks:ReactNode[]=[];let last=0;
 for(const match of normalized.matchAll(indexed)){
  const start=match.index;
  if(start>last)chunks.push(normalized.slice(last,start));
  chunks.push(match[1],<sub key={start}>{match[2]}</sub>);
  last=start+match[0].length;
 }
 if(last<normalized.length)chunks.push(normalized.slice(last));
 return <span>{chunks}</span>;
}
function ReactionSide({species}:{species:EquationSpecies[]}){
 const filled=species.filter(s=>s.formula.trim());
 if(!filled.length)return <span className="lektrus-reaction-placeholder">…</span>;
 return <span className="lektrus-reaction-side">
  {filled.map((s,i)=><span key={i} className="lektrus-reaction-term">
   {i>0&&<span className="lektrus-reaction-plus">+</span>}
   <span className="lektrus-reaction-species">
    {s.coefficient>1&&<span className="lektrus-reaction-coefficient">{s.coefficient}</span>}
    <FormulaPart value={s.formula}/>
    {s.indicator&&<span className="lektrus-reaction-indicator">{s.indicator}</span>}
   </span>
  </span>)}
 </span>;
}
/** The exact same typesetter is used by the board and by the editor preview. */
export function LektrusChemicalEquationTypeset({expression,conditions}:{expression:string;conditions?:string}){
 const draft=parseEquationDraft(expression);
 if(!draft)return <div className="lektrus-reaction-equation-text">
  <FormulaPart value={expression||"Введите формулу"}/>
 </div>;
 if(!expression.trim())return <div className="lektrus-reaction-equation-text">
  <span className="lektrus-reaction-placeholder">Введите вещества</span>
 </div>;
 return <div className="lektrus-reaction-equation-text">
  <ReactionSide species={draft.left}/>
  <span className="lektrus-reaction-arrow">
   {conditions?.trim()&&<small className="lektrus-reaction-above">{conditions}</small>}
   <b>{draft.arrow}</b>
  </span>
  <ReactionSide species={draft.right}/>
 </div>;
}

export default function LektrusChemicalEquationEditor({item,onChange,onSave,onCancel,canTeach=false}:Props&{canTeach?:boolean}){
 const initialSteps:EquationStep[]=item.scienceReactionSteps?.length?item.scienceReactionSteps:
  [{expression:item.graphExpression??"",conditions:item.scienceReactionConditions??""}];
 const steps=initialSteps.slice(0,8);
 const [stepIndex,setStepIndex]=useState(0);
 const [domain,setDomain]=useState<EquationDomain>(item.scienceReactionDomain??"inorganic");
 const [reviewed,setReviewed]=useState(false);
 const [openGroup,setOpenGroup]=useState<string|null>("heat");
 const [notice,setNotice]=useState("");
 const [nextSubstance,setNextSubstance]=useState("");
 const [templateId,setTemplateId]=useState("silver-chloride");
 const focused=useRef<Side>("left");
 const inputs=useRef<{left:HTMLTextAreaElement|null;right:HTMLTextAreaElement|null}>({left:null,right:null});
 const activeIndex=Math.min(stepIndex,steps.length-1);
 const current=steps[activeIndex];
 const parts=readReactionText(current.expression);
 const draft=parseEquationDraft(current.expression);
 const products=draft?.right.filter(s=>s.formula.trim()).map(s=>s.formula.trim())??[];
 const currentReview=reviewed?reviewEquationChain(steps,domain)[activeIndex]:null;
 const allReviews=reviewed?reviewEquationChain(steps,domain):[];
 const selectedConditions=parseConditionTokens(current.conditions);
 const availableExamples=classroomEquationExamples.filter(e=>e.domain===domain);
 const complete=(step:EquationStep)=>{const p=readReactionText(step.expression);
  return !!p.reactants.trim()&&!!p.products.trim()&&!p.standalone;};
 const canSave=steps.every(st=>st.expression.length<=500&&
  (complete(st)||(steps.length===1&&readReactionText(st.expression).standalone&&st.expression.trim())))&&steps.some(s=>s.expression.trim());
 const setSteps=(newSteps:EquationStep[],index=activeIndex)=>{
  if(newSteps.length<1||newSteps.length>8||newSteps.some(s=>s.expression.length>500||s.conditions.length>REACTION_CONDITION_LIMIT)){
   setNotice("Слишком длинная запись. Допускается до 8 этапов, по 500 символов.");return;
  }
  onChange({...item,graphExpression:newSteps[0].expression,
   scienceReactionConditions:newSteps[0].conditions,scienceReactionDomain:domain,
   scienceReactionSteps:newSteps.map(s=>({...s}))});
  setStepIndex(Math.min(index,newSteps.length-1));setReviewed(false);setNotice("");
 };
 const updateStep=(step:EquationStep)=>setSteps(steps.map((s,i)=>i===activeIndex?step:s));
 const changeSide=(side:Side,text:string)=>{
  const key=side==="left"?"reactants":"products";
  const updated={...parts,[key]:text,standalone:false};
  const value=writeReactionText(updated);
  updateStep({...current,expression:value});
 };
 const changeArrow=(arrow:EquationArrow)=>{
  updateStep({...current,expression:writeReactionText({...parts,arrow,standalone:false})});
 };
 const insert=(text:string)=>{
  const side=focused.current,el=inputs.current[side];
  const original=side==="left"?parts.reactants:parts.products;
  const from=el?.selectionStart??original.length,to=el?.selectionEnd??from;
  const next=original.slice(0,from)+text+original.slice(to);
  changeSide(side,next);
  requestAnimationFrame(()=>{
   const input=inputs.current[side];input?.focus();
   input?.setSelectionRange(from+text.length,from+text.length);
  });
 };
 const changeConditions=(value:string)=>{
  if(value.length>REACTION_CONDITION_LIMIT){setNotice("Слишком длинная запись условий");return;}
  updateStep({...current,conditions:value});
 };
 const toggleCondition=(value:string)=>{
  const updated=toggleReactionCondition(current.conditions,value);
  if(updated===current.conditions&&!selectedConditions.includes(value)){
   setNotice("Сократите запись условий, чтобы добавить ещё одно.");return;
  }
  changeConditions(updated);
 };
 const switchDomain=(next:EquationDomain)=>{
  if(next===domain)return;
  setDomain(next);setReviewed(false);
  onChange({...item,scienceReactionDomain:next,scienceReactionSteps:steps,
   graphExpression:steps[0].expression,scienceReactionConditions:steps[0].conditions});
  setTemplateId(next==="organic"?"alkene":"silver-chloride");setNotice("");
 };
 const insertExample=()=>{
  const sample=availableExamples.find(e=>e.id===templateId)??availableExamples[0];
  if(!sample)return;
  updateStep({expression:sample.expression,conditions:sample.conditions});
 };
 const appendStep=()=>{
  if(steps.length>=8)return;
  const selected=nextSubstance&&products.includes(nextSubstance)?nextSubstance:(products[0]??"");
  setSteps([...steps,{expression:selected?selected+" → ":" → ",conditions:""}],steps.length);
  setNextSubstance("");
 };
 const deleteStep=(index:number)=>{
  if(steps.length<=1)return;
  setSteps(steps.filter((_,i)=>i!==index),Math.max(0,index-1));
 };
 const check=()=>{setReviewed(true);setNotice("");};
 const changeByTeacher=(which:"balance"|"marks")=>{
  if(!canTeach)return;
  const updated=which==="balance"?balancedStep(current):applyKnownProductMarks(current,domain);
  if(!updated){setNotice(which==="balance"?"Не удалось безопасно рассчитать коэффициенты.":
   "Знаки газа и осадка можно расставить только для проверенного уравнения с правильными продуктами.");return;}
  updateStep(updated);setNotice(which==="balance"?"Коэффициенты рассчитаны, формулы сохранены.":
   "Знаки продуктов расставлены по проверенному уравнению.");
 };
 const changeFromReference=()=>{
  if(!canTeach||!currentReview?.reference)return;
  updateStep({...current,expression:currentReview.reference});
  setNotice("Вставлено проверенное уравнение. Убедитесь, что условия соответствуют задаче.");
 };
 const issuesFor=(side:Side)=>currentReview?.issues.filter(v=>v.side===side||!v.side&&v.kind==="formula")??[];
 const save=()=>{if(canSave)onSave();};
 return createPortal(<div className="lektrus-chem-equation-overlay lektrus-chem-equation-v2 lektrus-chem-equation-compact lektrus-chem-one-screen lektrus-chem-reaction-workspace"
    onPointerDown={e=>{if(e.target===e.currentTarget)onCancel();}}>
   <section className="lektrus-chem-equation-editor" role="dialog" aria-modal="true" aria-label="Редактор уравнений и цепочек"
    onPointerDown={e=>e.stopPropagation()} onKeyDown={e=>{
     if(e.key==="Escape"){e.stopPropagation();onCancel();}
     if(e.key==="Enter"&&(e.ctrlKey||e.metaKey)){e.preventDefault();save();}
    }}>
    <header className="lektrus-chem-equation-header">
     <div className="lektrus-chem-equation-heading"><strong>Химические уравнения</strong>
      <small>Уравнения, распад продуктов и цепочки превращений</small></div>
     <button type="button" aria-label="Закрыть" title="Закрыть" onClick={onCancel}>×</button>
    </header>
    <nav className="lektrus-chem-domain-tabs" aria-label="Раздел химии">
     <button type="button" aria-pressed={domain==="inorganic"} onClick={()=>switchDomain("inorganic")}>Неорганика</button>
     <button type="button" aria-pressed={domain==="organic"} onClick={()=>switchDomain("organic")}>Органика</button>
     <span>Запись формулами, без справочника веществ</span>
    </nav>
    <div className="lektrus-chem-equation-content">
     <div className="lektrus-chem-reaction-topline">
      <div className="lektrus-chem-chain-steps" role="group" aria-label="Этапы цепочки">
       {steps.map((_,i)=><button type="button" key={i} aria-pressed={activeIndex===i}
        className={reviewed?("is-"+(allReviews[i]?.status??"unknown")):""}
        title={"Перейти к этапу "+(i+1)} onClick={()=>{setStepIndex(i);setNotice("");}}>
        {i+1}{steps.length>1?" этап":""}
       </button>)}
       {steps.length<8&&<button type="button" className="lektrus-chem-chain-add" onClick={appendStep}
        title="Новый этап с продуктом текущего уравнения">+ Этап</button>}
      </div>
      <div className="lektrus-chem-templates">
       <label htmlFor="lektrus-chem-template">Шаблон</label>
       <select id="lektrus-chem-template" value={availableExamples.some(e=>e.id===templateId)?templateId:availableExamples[0]?.id}
        onChange={e=>setTemplateId(e.target.value)} aria-label="Проверенный пример уравнения">
        {availableExamples.map(e=><option key={e.id} value={e.id}>{e.title}</option>)}
       </select>
       <button type="button" onClick={insertExample}>Вставить</button>
      </div>
     </div>
     <div className="lektrus-chem-equation-columns">
      {(["left","right"] as Side[]).map(side=><Fragment key={side}><label className={"lektrus-chem-equation-side "+(issuesFor(side).some(v=>v.severity==="error")?"has-error":"")} key={side}>
       <span className="lektrus-chem-equation-side-head"><strong>{side==="left"?"Реагенты":"Продукты"}</strong>
        <small>{side==="left"?"До реакции":"После реакции"}</small></span>
       <textarea ref={el=>{inputs.current[side]=el;}} rows={3} maxLength={500} spellCheck={false}
        aria-label={side==="left"?"Реагенты":"Продукты"} autoComplete="off"
        value={side==="left"?parts.reactants:parts.products}
        placeholder={side==="left"?(domain==="organic"?"C2H4 + H2":"AgNO3 + NaCl"):(domain==="organic"?"C2H6":"AgCl↓ + NaNO3")}
        onFocus={()=>{focused.current=side;}} onChange={e=>changeSide(side,e.target.value)}/>
       {reviewed&&issuesFor(side).filter(v=>v.severity==="error").slice(0,3).map((v,i)=><small key={i} className="lektrus-chem-inline-error">
        {v.formula?("⚠ "+v.formula+": "):"⚠ "}{v.message}
       </small>)}
      </label>
       {side==="left"&&<div className="lektrus-chem-arrow-chooser">
        <span>Стрелка</span><div role="group" aria-label="Знак реакции">
         {arrows.map(a=><button type="button" key={a.value} title={a.title}
          aria-pressed={!parts.standalone&&parts.arrow===a.value}
          onClick={()=>changeArrow(a.value)}>{a.label}</button>)}
        </div>
       </div>}
       </Fragment>)}
     </div>
     <div className="lektrus-chem-equation-symbols" role="group" aria-label="Химические обозначения">
      <span>Вставить знак</span>
      <div>{[
       {value:"↑",label:"↑ газ",title:"Выделение газа"},
       {value:"↓",label:"↓ осадок",title:"Выпадение осадка"},
       {value:"e⁻",label:"e⁻",title:"Электрон"},
       {value:"₂",label:"₂",title:"Индекс 2"},
       {value:"₃",label:"₃",title:"Индекс 3"},
       {value:"₄",label:"₄",title:"Индекс 4"},
       {value:"⁺",label:"⁺",title:"Положительный заряд"},
       {value:"⁻",label:"⁻",title:"Отрицательный заряд"},
       {value:"·",label:"·",title:"Точка гидратации"}
      ].map(symbol=><button type="button" key={symbol.title} title={symbol.title} aria-label={symbol.title}
       onMouseDown={e=>e.preventDefault()} onClick={()=>insert(symbol.value)}>{symbol.label}</button>)}</div>
     </div>
     {steps.length<8&&products.length>0&&<div className="lektrus-chem-decomposition">
      <span>Продолжить цепочку из продукта:</span>
      <select aria-label="Выбрать продукт для следующего этапа" value={products.includes(nextSubstance)?nextSubstance:products[0]}
       onChange={e=>setNextSubstance(e.target.value)}>
       {products.map((formula,i)=><option key={i} value={formula}>{formula}</option>)}
      </select>
      <button type="button" onClick={appendStep}>Следующее превращение</button>
      {products.includes("H2CO3")&&<button type="button" className="lektrus-chem-carbonic-step"
       onClick={()=>{
        setSteps([...steps,{expression:"H2CO3 → H2O + CO2↑",conditions:""}],steps.length);
        setNextSubstance("");
       }}>Распад H₂CO₃</button>}
     </div>}
     <section className="lektrus-chem-condition-panel" aria-label="Условия реакции над стрелкой">
      <div className="lektrus-chem-condition-heading">
       <div><strong>Условия над стрелкой</strong><small>Для этапа {activeIndex+1}</small></div>
       {!!current.conditions.trim()&&<button type="button" className="lektrus-chem-clear-conditions" onClick={()=>changeConditions("")}>Очистить</button>}
      </div>
      <label className="lektrus-chem-condition-input"><span className="sr-only">Условия реакции</span>
       <input type="text" aria-label="Условия реакции над стрелкой" value={current.conditions} maxLength={REACTION_CONDITION_LIMIT}
        placeholder="Выберите условие или напишите своё" onChange={e=>changeConditions(e.target.value)}/>
      </label>
      <div className="lektrus-chem-condition-categories">
       {REACTION_CONDITION_GROUPS.map(group=><div className="lektrus-chem-condition-group" key={group.id}>
        <button type="button" className="lektrus-chem-condition-group-title" aria-expanded={openGroup===group.id}
         onClick={()=>setOpenGroup(v=>v===group.id?null:group.id)}>
         {group.title}<span aria-hidden="true">{openGroup===group.id?"−":"+"}</span>
        </button>
        {openGroup===group.id&&<div className="lektrus-chem-condition-options" role="group" aria-label={group.title}>
         {group.tokens.map(token=><button type="button" key={token}
          aria-pressed={selectedConditions.includes(token)} onClick={()=>toggleCondition(token)}>{token}</button>)}
        </div>}
       </div>)}
      </div>
     </section>
     <section className="lektrus-chem-equation-preview" aria-label="Предпросмотр на доске">
      <div className="lektrus-chem-preview-heading"><strong>{steps.length>1?"Цепочка превращений":"Предпросмотр"}</strong>
       <span>Итоговое отображение на доске</span></div>
      {steps.map((s,i)=><div className={"lektrus-chem-stage-preview "+(i===activeIndex?"is-active":"")} key={i}>
       {steps.length>1&&<span className="lektrus-chem-stage-number">{i+1}</span>}
       <LektrusChemicalEquationTypeset expression={s.expression} conditions={s.conditions}/>
      </div>)}
     </section>
     {steps.length>1&&<div className="lektrus-chem-step-controls">
      <span>Этап {activeIndex+1} из {steps.length}</span>
      <button type="button" onClick={()=>deleteStep(activeIndex)}>Удалить этап</button>
     </div>}
     {canTeach&&<section className="lektrus-chem-teacher-tools" aria-label="Проверка преподавателя">
      <div className="lektrus-chem-teacher-header">
       <div><strong>Инструменты преподавателя</strong><small>Проверяется каждый этап, ошибки выделяются</small></div>
       <button type="button" className="lektrus-chem-review-button" onClick={check}>Проверить</button>
      </div>
      <div className="lektrus-chem-teacher-actions">
       <button type="button" onClick={()=>changeByTeacher("balance")}>Расставить коэффициенты</button>
       <button type="button" onClick={()=>changeByTeacher("marks")}>Газы и осадки</button>
       {reviewed&&currentReview?.reference&&<button type="button" onClick={changeFromReference}>Вставить проверенный вариант</button>}
      </div>
      {reviewed&&<div className={"lektrus-chem-review-report is-"+currentReview?.status} role="status">
       <strong>{currentReview?.status==="correct"?"Проверено: ошибок в справочной реакции не найдено":
        currentReview?.status==="incorrect"?"Найдены ошибки":
        currentReview?.status==="partial"?"Нужны уточнения":"Проверка ограничена справочными данными"}</strong>
       <div className="lektrus-chem-review-issues">
        {currentReview?.issues.length?currentReview.issues.map((issue,i)=><p key={i}
         className={"lektrus-chem-review-issue is-"+issue.severity}>{issue.message}</p>):
         <p>Продукты, знаки и баланс соответствуют проверенному примеру.</p>}
       </div>
       {currentReview?.reference&&<small>Проверенное уравнение: {currentReview.reference}</small>}
       {steps.length>1&&<small>Выберите другой этап сверху, чтобы увидеть его ошибки.</small>}
      </div>}
     </section>}
     {notice&&<p className="lektrus-chem-equation-notice" role="status">{notice}</p>}
    </div>
    <footer><span className="lektrus-chem-shortcut">{canTeach?"Проверка доступна только преподавателю":"Ctrl+Enter: сохранить"}</span>
     <button type="button" onClick={onCancel}>Отмена</button>
     <button type="button" className="primary" disabled={!canSave} onClick={save}>На доску</button>
    </footer>
   </section>
  </div>,document.body);
}
