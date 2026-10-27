import {useRef,useState,type ReactNode} from "react";
import {createPortal} from "react-dom";
import type {Item} from "./boardModel";
import {
 inspectEquationBalance,parseEquationDraft,writeEquationDraft,type EquationArrow,type EquationSpecies
} from "./lektrusChemicalEquationModel";
import {
 readReactionText,writeReactionText,REACTION_CONDITION_GROUPS,REACTION_CONDITION_LIMIT,
 parseConditionTokens,toggleReactionCondition,type ReactionTextParts
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
const symbols=[
 {value:" + ",label:"+",title:"Добавить следующее вещество"},
 {value:"(",label:"(",title:"Открывающая скобка"},
 {value:")",label:")",title:"Закрывающая скобка"},
 {value:"₂",label:"₂",title:"Индекс 2"},
 {value:"₃",label:"₃",title:"Индекс 3"},
 {value:"·",label:"·",title:"Точка гидратации"},
 {value:"↑",label:"↑",title:"Выделение газа"},
 {value:"↓",label:"↓",title:"Выпадение осадка"},
 {value:"⁺",label:"⁺",title:"Положительный заряд"},
 {value:"⁻",label:"⁻",title:"Отрицательный заряд"}
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

export default function LektrusChemicalEquationEditor({item,onChange,onSave,onCancel}:Props){
 const legacyFormula=useRef(!!item.graphExpression?.trim()&&readReactionText(item.graphExpression).standalone);
 const [openGroup,setOpenGroup]=useState<string|null>("heat");
 const [notice,setNotice]=useState("");
 const focused=useRef<Side>("left");
 const inputs=useRef<{left:HTMLTextAreaElement|null;right:HTMLTextAreaElement|null}>({left:null,right:null});
 const raw=item.graphExpression??"";
 const parts=readReactionText(raw);
 const draft=parseEquationDraft(raw);
 const balance=draft?inspectEquationBalance(draft):null;
 const complete=!!parts.reactants.trim()&&!!parts.products.trim()&&!parts.standalone;
 const canSave=raw.trim().length>0&&raw.length<=500&&
  (complete||(legacyFormula.current&&parts.standalone&&!!parts.reactants.trim()));
 const selectedConditions=parseConditionTokens(item.scienceReactionConditions??"");
 const updateEquation=(next:ReactionTextParts)=>{
  const value=writeReactionText(next,legacyFormula.current&&next.standalone);
  if(value.length>500){setNotice("Максимальная длина уравнения: 500 символов");return;}
  onChange({...item,graphExpression:value});setNotice("");
 };
 const changeSide=(side:Side,value:string)=>{
  updateEquation({...parts,[side==="left"?"reactants":"products"]:value,
   standalone:legacyFormula.current&&side==="left"&&!parts.products.trim()});
 };
 const changeArrow=(arrow:EquationArrow)=>updateEquation({...parts,arrow,standalone:false});
 const insert=(value:string)=>{
  const side=focused.current,input=inputs.current[side];
  const before=side==="left"?parts.reactants:parts.products;
  const start=input?.selectionStart??before.length,end=input?.selectionEnd??start;
  const next=before.slice(0,start)+value+before.slice(end);
  changeSide(side,next);
  requestAnimationFrame(()=>{
   const el=inputs.current[side];el?.focus();
   el?.setSelectionRange(start+value.length,start+value.length);
  });
 };
 const applyBalance=()=>{
  if(!draft||balance?.status!=="unbalanced"||!balance.coefficients)return;
  const updated={...draft,left:draft.left.map(s=>({...s})),right:draft.right.map(s=>({...s}))};
  let i=0;
  for(const side of ["left","right"] as const)
   updated[side].forEach(s=>{s.coefficient=balance.coefficients![i++];});
  const expression=writeEquationDraft(updated);
  if(expression.length>500)return;
  onChange({...item,graphExpression:expression});
  setNotice("Коэффициенты расставлены. Формулы веществ не изменены.");
 };
 const changeConditions=(value:string)=>{
  if(value.length>REACTION_CONDITION_LIMIT){setNotice("Слишком длинная запись условий");return;}
  onChange({...item,scienceReactionConditions:value});setNotice("");
 };
 const toggleCondition=(value:string)=>{
  const before=item.scienceReactionConditions??"";
  const after=toggleReactionCondition(before,value);
  if(after===before&&!selectedConditions.includes(value)){
   setNotice("Слишком много условий. Удалите ненужные или сократите запись.");
   return;
  }
  changeConditions(after);
 };
 const submit=()=>{if(canSave)onSave();};
 return createPortal(
  <div className="lektrus-chem-equation-overlay lektrus-chem-equation-v2 lektrus-chem-equation-compact lektrus-chem-one-screen"
   onPointerDown={e=>{if(e.target===e.currentTarget)onCancel();}}>
   <section className="lektrus-chem-equation-editor" role="dialog" aria-modal="true"
    aria-label="Редактор химических уравнений"
    onPointerDown={e=>e.stopPropagation()}
    onKeyDown={e=>{
     if(e.key==="Escape"){e.stopPropagation();onCancel();}
     if(e.key==="Enter"&&(e.ctrlKey||e.metaKey)){e.preventDefault();submit();}
    }}>
    <header className="lektrus-chem-equation-header">
     <div className="lektrus-chem-equation-heading">
      <strong>Химическое уравнение</strong>
      <small>Реагенты, продукты и условия в одном окне</small>
     </div>
     <button type="button" title="Закрыть" aria-label="Закрыть" onClick={onCancel}>×</button>
    </header>
    <div className="lektrus-chem-equation-content">
     <div className="lektrus-chem-equation-columns">
      <label className="lektrus-chem-equation-side">
       <span className="lektrus-chem-equation-side-head"><strong>Реагенты</strong><small>Исходные вещества</small></span>
       <textarea ref={el=>{inputs.current.left=el;}} rows={3}
        aria-label="Реагенты" spellCheck={false} autoComplete="off" maxLength={500}
        value={parts.reactants} placeholder="H2 + O2"
        onFocus={()=>{focused.current="left";}}
        onChange={e=>changeSide("left",e.target.value)}/>
      </label>
      <div className="lektrus-chem-arrow-chooser">
       <span>Стрелка</span>
       <div role="group" aria-label="Знак химической реакции">
        {arrows.map(a=><button type="button" key={a.value} title={a.title}
         aria-pressed={!parts.standalone&&parts.arrow===a.value}
         onClick={()=>changeArrow(a.value)}>{a.label}</button>)}
       </div>
      </div>
      <label className="lektrus-chem-equation-side">
       <span className="lektrus-chem-equation-side-head"><strong>Продукты</strong><small>Результат реакции</small></span>
       <textarea ref={el=>{inputs.current.right=el;}} rows={3}
        aria-label="Продукты" spellCheck={false} autoComplete="off" maxLength={500}
        value={parts.products} placeholder="2H2O, CO2↑"
        onFocus={()=>{focused.current="right";}}
        onChange={e=>changeSide("right",e.target.value)}/>
      </label>
     </div>
     <div className="lektrus-chem-equation-symbols" role="group" aria-label="Кнопки ввода химических символов">
      <span>Вставить</span>
      <div>{symbols.map(symbol=><button type="button" key={symbol.title}
       title={symbol.title} aria-label={symbol.title}
       onMouseDown={e=>e.preventDefault()} onClick={()=>insert(symbol.value)}>{symbol.label}</button>)}</div>
     </div>
     <section className="lektrus-chem-condition-panel" aria-label="Условия реакции над стрелкой">
      <div className="lektrus-chem-condition-heading">
       <div><strong>Условия реакции</strong><small>Будут показаны над стрелкой</small></div>
       {!!item.scienceReactionConditions?.trim()&&<button type="button"
        className="lektrus-chem-clear-conditions" onClick={()=>changeConditions("")}>Очистить</button>}
      </div>
      <label className="lektrus-chem-condition-input">
       <span className="sr-only">Условия реакции, отображаемые над стрелкой</span>
       <input type="text" aria-label="Условия реакции над стрелкой"
        value={item.scienceReactionConditions??""} maxLength={REACTION_CONDITION_LIMIT}
        placeholder="Выберите ниже или впишите свои условия"
        onChange={e=>changeConditions(e.target.value)}/>
      </label>
      <div className="lektrus-chem-condition-categories">
       {REACTION_CONDITION_GROUPS.map(group=><div className="lektrus-chem-condition-group" key={group.id}>
        <button type="button" className="lektrus-chem-condition-group-title"
         aria-expanded={openGroup===group.id}
         onClick={()=>setOpenGroup(v=>v===group.id?null:group.id)}>
         {group.title}<span aria-hidden="true">{openGroup===group.id?"−":"+"}</span>
        </button>
        {openGroup===group.id&&<div className="lektrus-chem-condition-options" role="group"
         aria-label={"Условия: "+group.title}>
         {group.tokens.map(token=><button type="button" key={token}
          aria-pressed={selectedConditions.includes(token)} title={"Условие: "+token}
          onClick={()=>toggleCondition(token)}>{token}</button>)}
        </div>}
       </div>)}
      </div>
     </section>
     <section className="lektrus-chem-equation-preview" aria-label="Предпросмотр записи на доске">
      <div className="lektrus-chem-preview-heading">
       <strong>Предпросмотр</strong><span>Так уравнение будет выглядеть на доске</span>
      </div>
      <LektrusChemicalEquationTypeset expression={raw} conditions={item.scienceReactionConditions}/>
     </section>
     {complete&&<div className={"lektrus-chem-balance "+(balance?.status??"")} role="status">
      <div className="lektrus-chem-balance-description">
       <strong>{balance?.status==="balanced"?"Атомы уравнены":
        balance?.status==="unbalanced"?"Проверьте коэффициенты":
        balance?.status==="invalid"?"Разный состав элементов":"Проверка коэффициентов"}</strong>
       <span>{balance?.message}</span>
      </div>
      {balance?.status==="unbalanced"&&balance.coefficients&&
       <button type="button" className="lektrus-chem-apply-balance"
        onClick={applyBalance}>Расставить коэффициенты</button>}
     </div>}
     {notice&&<p className="lektrus-chem-equation-notice" role="status">{notice}</p>}
    </div>
    <footer>
     <span className="lektrus-chem-shortcut">Ctrl+Enter: сохранить</span>
     <button type="button" onClick={onCancel}>Отмена</button>
     <button type="button" className="primary" disabled={!canSave} onClick={submit}>На доску</button>
    </footer>
   </section>
  </div>,document.body
 );
}
