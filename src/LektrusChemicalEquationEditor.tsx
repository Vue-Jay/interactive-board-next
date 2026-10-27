import {useRef,useState,type ReactNode} from "react";
import {createPortal} from "react-dom";
import type {Item} from "./boardModel";
import {
 blankSpecies,countFormulaAtoms,inspectEquationBalance,parseEquationDraft,
 readSpecies,writeEquationDraft,type EquationArrow,type EquationDraft,
 type EquationSpecies
} from "./lektrusChemicalEquationModel";

const subscriptAfter=/([A-Z][a-z]?|[)\]])([0-9]+)/g;
const supDigits="⁰¹²³⁴⁵⁶⁷⁸⁹";
function FormulaPart({value}:{value:string}){
 const chunks:ReactNode[]=[];
 const normalized=value.replace(/[₀-₉]/g,v=>String("₀₁₂₃₄₅₆₇₈₉".indexOf(v)));
 let last=0;
 for(const match of normalized.matchAll(subscriptAfter)){
  const at=match.index;
  if(at>last)chunks.push(normalized.slice(last,at));
  chunks.push(match[1],<sub key={at}>{match[2]}</sub>);
  last=at+match[0].length;
 }
 if(last<normalized.length)chunks.push(normalized.slice(last));
 return <span>{chunks}</span>;
}
const toSup=(s:string)=>s.replace(/\d/g,n=>supDigits[Number(n)]);
function RenderSpecies({species}:{species:EquationSpecies}){
 // Formula labels and stoichiometric coefficients are separate, so 2H2O
 // cannot accidentally become an index in the typesetter.
 return <span className="lektrus-reaction-species">
  {species.coefficient>1&&<span className="lektrus-reaction-coefficient">{species.coefficient}</span>}
  <FormulaPart value={species.formula}/>
  {species.indicator&&<span className="lektrus-reaction-indicator">{species.indicator}</span>}
 </span>;
}
function ReactionSide({species}:{species:EquationSpecies[]}){
 return <span className="lektrus-reaction-side">
  {species.map((s,i)=><span key={i} className="lektrus-reaction-term">
   {i>0&&<span className="lektrus-reaction-plus">+</span>}
   <RenderSpecies species={s}/>
  </span>)}
 </span>;
}
/** Shared preview on the editing surface and on the board: identical notation. */
export function LektrusChemicalEquationTypeset({expression,conditions}:{expression:string;conditions?:string}){
 const draft=parseEquationDraft(expression);
 if(!draft)return <div className="lektrus-reaction-equation-text">
  <FormulaPart value={expression||"Введите формулу"}/>
 </div>;
 if(!expression.trim())return <div className="lektrus-reaction-equation-text">
  <span className="lektrus-reaction-placeholder">Добавьте реагенты и продукты</span>
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
type Props={item:Item;onChange:(item:Item)=>void;onSave:()=>void;onCancel:()=>void};
type Side="left"|"right";
const helpers=[
 {label:"Индексы",symbols:["₂","₃","₄","₅","₆","₇","₈"]},
 {label:"Группы",symbols:["(",")","[","]","·"]},
 {label:"Заряды и знаки",symbols:["⁺","⁻","²⁺","³⁺","↑","↓"]}
];
const conditionsQuick=["t°","hν","кат.","H₂SO₄","электролиз"];
const arrows:{value:EquationArrow;label:string;title:string}[]=[
 {value:"→",label:"→",title:"Направленная реакция"},
 {value:"⇌",label:"⇌",title:"Обратимая реакция"},
 {value:"=",label:"=",title:"Знак равенства"}
];
export default function LektrusChemicalEquationEditor({item,onChange,onSave,onCancel}:Props){
 const initial=useRef(item.graphExpression??"");
 const [mode,setMode]=useState<"builder"|"source">(()=>
  parseEquationDraft(initial.current)?"builder":"source");
 const [paletteOpen,setPaletteOpen]=useState(true);
 const [notice,setNotice]=useState("");
 const focused=useRef<{side:Side;index:number}|null>(null);
 const inputs=useRef(new Map<string,HTMLInputElement>());
 const rawArea=useRef<HTMLTextAreaElement>(null);
 const raw=item.graphExpression??"";
 const draft=parseEquationDraft(raw);
 const results=draft?inspectEquationBalance(draft):null;
 const saveReady=raw.trim().length>0&&raw.length<=500&&(
  mode==="source"||!!draft&&
    [...draft.left,...draft.right].every(s=>s.formula.trim().length>0));
 const updateSource=(value:string)=>{if(value.length<=500){onChange({...item,graphExpression:value});setNotice("");}};
 const changeDraft=(next:EquationDraft)=>{
  const value=writeEquationDraft(next);
  if(value.length<=500){onChange({...item,graphExpression:value});setNotice("");}
  else setNotice("Достигнут предел 500 символов");
 };
 const cloneDraft=():EquationDraft=>({
  left:(draft?.left??[blankSpecies()]).map(s=>({...s})),
  right:(draft?.right??[blankSpecies()]).map(s=>({...s})),
  arrow:draft?.arrow??"→"
 });
 const patch=(side:Side,index:number,part:Partial<EquationSpecies>)=>{
  const next=cloneDraft();if(!next[side][index])return;
  next[side][index]={...next[side][index],...part};changeDraft(next);
 };
 const addTerm=(side:Side)=>{
  const next=cloneDraft();
  if(next[side].length>=10)return;
  next[side].push(blankSpecies());changeDraft(next);
  const index=next[side].length-1;
  requestAnimationFrame(()=>inputs.current.get(side+index)?.focus());
 };
 const removeTerm=(side:Side,index:number)=>{
  const next=cloneDraft();
  if(next[side].length===1){next[side]=[blankSpecies()];}
  else next[side].splice(index,1);
  focused.current=null;changeDraft(next);
 };
 const moveTerm=(side:Side,index:number,direction:-1|1)=>{
  const next=cloneDraft(),to=index+direction;
  if(!next[side][to])return;
  [next[side][index],next[side][to]]=[next[side][to],next[side][index]];
  focused.current={side,index:to};changeDraft(next);
  requestAnimationFrame(()=>inputs.current.get(side+to)?.focus());
 };
 const insert=(symbol:string)=>{
  if(mode==="source"){
   const el=rawArea.current,pos=el?.selectionStart??raw.length,end=el?.selectionEnd??pos;
   updateSource(raw.slice(0,pos)+symbol+raw.slice(end));
   requestAnimationFrame(()=>{el?.focus();el?.setSelectionRange(pos+symbol.length,pos+symbol.length);});
   return;
  }
  const target=focused.current??{side:"left" as const,index:0};
  const next=cloneDraft(),entry=next[target.side][target.index];
  if(!entry)return;
  const el=inputs.current.get(target.side+target.index);
  const start=el?.selectionStart??entry.formula.length,end=el?.selectionEnd??start;
  // Formula inputs retain normal ASCII indices for chemical calculations.
  const insertion=symbol.replace(/[₀-₉]/g,v=>String("₀₁₂₃₄₅₆₇₈₉".indexOf(v)));
  entry.formula=entry.formula.slice(0,start)+insertion+entry.formula.slice(end);
  changeDraft(next);
  requestAnimationFrame(()=>{el?.focus();el?.setSelectionRange(start+insertion.length,start+insertion.length);});
 };
 const autoBalance=()=>{
  if(!draft||results?.status!=="unbalanced"||!results.coefficients)return;
  const next=cloneDraft();let i=0;
  for(const side of ["left","right"] as const)
   next[side].forEach(s=>{s.coefficient=results.coefficients![i++];});
  changeDraft(next);setNotice("Коэффициенты рассчитаны. Формулы веществ не изменены.");
 };
 const resetBalance=()=>{
  const next=cloneDraft();
  for(const side of ["left","right"] as const)next[side].forEach(s=>s.coefficient=1);
  changeDraft(next);
 };
 const createReaction=()=>{
  changeDraft({left:[readSpecies(raw)],right:[blankSpecies()],arrow:"→"});
  setMode("builder");
 };
 const handleSave=()=>{if(saveReady)onSave();};
 return createPortal(<div className="lektrus-chem-equation-overlay lektrus-chem-equation-v2"
    onPointerDown={e=>{if(e.target===e.currentTarget)onCancel()}}>
  <section role="dialog" aria-modal="true" aria-label="Редактор химических уравнений"
   className="lektrus-chem-equation-editor"
   onPointerDown={e=>e.stopPropagation()}
   onKeyDown={e=>{if(e.key==="Enter"&&(e.ctrlKey||e.metaKey)){e.preventDefault();handleSave();}}}>
   <header className="lektrus-chem-equation-header">
    <div className="lektrus-chem-equation-heading"><strong>Химические уравнения</strong>
     <small>Составьте реакцию, проверьте коэффициенты и оформите запись</small></div>
    <button type="button" aria-label="Закрыть без сохранения" title="Закрыть без сохранения" onClick={onCancel}>×</button>
   </header>
   <div className="lektrus-chem-equation-mode" role="tablist" aria-label="Режим редактора">
    <button type="button" role="tab" aria-selected={mode==="builder"} disabled={!draft}
     onClick={()=>setMode("builder")}>Конструктор</button>
    <button type="button" role="tab" aria-selected={mode==="source"}
     onClick={()=>setMode("source")}>Текстом</button>
    <span>Все изменения сразу видны в предпросмотре</span>
   </div>
   <div className="lektrus-chem-equation-content">
    {mode==="builder"&&draft?<div className="lektrus-chem-builder">
     <div className="lektrus-chem-equation-columns">
      {(["left","right"] as Side[]).map((side,sideIndex)=><section className="lektrus-chem-side" key={side}>
       <div className="lektrus-chem-side-heading">
        <span className="lektrus-chem-side-number">{sideIndex+1}</span>
        <strong>{side==="left"?"Реагенты":"Продукты"}</strong>
        <span>{side==="left"?"Исходные вещества":"Результат реакции"}</span>
       </div>
       <div className="lektrus-chem-species-list">
        {draft[side].map((s,index)=><div className="lektrus-chem-species-card" key={side+index}>
         <label className="lektrus-chem-coeff-field">
          <span>Коэф.</span>
          <input aria-label={"Коэффициент "+(side==="left"?"реагента ":"продукта ")+(index+1)}
           type="number" inputMode="numeric" min={1} max={999} step={1}
           value={s.coefficient===1?"":s.coefficient} placeholder="1"
           onChange={e=>patch(side,index,{coefficient:Math.min(999,Math.max(1,Math.floor(Number(e.target.value)||1)))})}/>
         </label>
         <label className="lektrus-chem-formula-field">
          <span>Формула вещества</span>
          <input type="text" inputMode="text" spellCheck={false} autoComplete="off"
           aria-label={"Формула "+(side==="left"?"реагента ":"продукта ")+(index+1)}
           value={s.formula} maxLength={120} placeholder={side==="left"?"Например, H2SO4":"Например, H2O"}
           ref={el=>{if(el)inputs.current.set(side+index,el);else inputs.current.delete(side+index);}}
           onFocus={()=>{focused.current={side,index};}}
           onChange={e=>patch(side,index,{formula:e.target.value})}
           onKeyDown={e=>{
            if(e.key==="Enter"){e.preventDefault();addTerm(side);}
            if(e.key==="Backspace"&&!s.formula&&draft[side].length>1){
             e.preventDefault();removeTerm(side,index);
            }
           }}/>
         </label>
         <div className="lektrus-chem-species-actions">
          <button type="button" title="Выделение газа или осадка" aria-label="Переключить знак выделения газа или осадка"
           onClick={()=>patch(side,index,{indicator:s.indicator===""?"↑":s.indicator==="↑"?"↓":""})}>
           {s.indicator||"↑↓"}</button>
          <button type="button" title="Переместить выше" aria-label="Переместить вещество выше" disabled={index===0}
           onClick={()=>moveTerm(side,index,-1)}>↑</button>
          <button type="button" title="Переместить ниже" aria-label="Переместить вещество ниже"
           disabled={index===draft[side].length-1} onClick={()=>moveTerm(side,index,1)}>↓</button>
          <button type="button" title="Удалить вещество" aria-label="Удалить вещество"
           onClick={()=>removeTerm(side,index)}>×</button>
         </div>
        </div>)}
       </div>
       <button type="button" className="lektrus-chem-add-species" onClick={()=>addTerm(side)}
        disabled={draft[side].length>=10}>+ Добавить вещество</button>
      </section>)}
     </div>
     <section className="lektrus-chem-equation-conditions">
      <div className="lektrus-chem-equation-arrows">
       <strong>Знак реакции</strong>
       <div role="group" aria-label="Тип реакции">{arrows.map(a=><button key={a.value}
        type="button" aria-pressed={draft.arrow===a.value} title={a.title}
        onClick={()=>changeDraft({...cloneDraft(),arrow:a.value})}>{a.label}</button>)}</div>
      </div>
      <label className="lektrus-chem-equation-condition-field"><span>Условия над стрелкой</span>
       <input type="text" maxLength={90} value={item.scienceReactionConditions??""}
        placeholder="Нагревание, свет, катализатор..."
        onChange={e=>onChange({...item,scienceReactionConditions:e.target.value})}/>
      </label>
      <div className="lektrus-chem-conditions-quick" aria-label="Быстрые условия">
       {conditionsQuick.map(s=><button type="button" key={s} title={"Добавить условие "+s}
        onClick={()=>onChange({...item,scienceReactionConditions:
         [item.scienceReactionConditions?.trim(),s].filter(Boolean).join(", ").slice(0,90)})}>{s}</button>)}
      </div>
     </section>
    </div>:<div className="lektrus-chem-source">
      <label><strong>Формула или уравнение</strong>
       <span>Можно вводить запись целиком, включая ионы, стрелки и нестандартные обозначения.</span>
       <textarea ref={rawArea} rows={4} value={raw} maxLength={500} spellCheck={false}
        placeholder="Na2CO3 + 2HCl → 2NaCl + CO2↑ + H2O"
        onChange={e=>updateSource(e.target.value)}/>
      </label>
      {!draft&&<div className="lektrus-chem-convert-hint">
       {raw.trim()&&!/(→|⇌|⇄|↔|⟶|⟹|=|->)/.test(raw)?
        <><span>Это отдельная формула, а не уравнение.</span>
         <button type="button" onClick={createReaction}>Сделать реагентом и открыть конструктор</button></>:
        <span>Для перехода к конструктору используйте стрелку →, ⇌ или знак =.</span>}
      </div>}
      <label className="lektrus-chem-source-condition"><strong>Условия над стрелкой</strong>
       <input value={item.scienceReactionConditions??""} maxLength={90}
        placeholder="t°, катализатор, свет"
        onChange={e=>onChange({...item,scienceReactionConditions:e.target.value})}/>
      </label>
    </div>}
    <div className="lektrus-chem-palettes">
     <button type="button" className="lektrus-chem-palette-toggle" aria-expanded={paletteOpen}
      onClick={()=>setPaletteOpen(v=>!v)}>Символы и группы <span>{paletteOpen?"⌃":"⌄"}</span></button>
     {paletteOpen&&<div className="lektrus-chem-palettes-rows">
      {helpers.map(group=><div key={group.label} className="lektrus-chem-palettes-row">
       <span>{group.label}</span><div role="group" aria-label={group.label}>
        {group.symbols.map(symbol=><button type="button" key={symbol} title={"Вставить "+symbol}
         onMouseDown={e=>e.preventDefault()} onClick={()=>insert(symbol)}>{symbol}</button>)}
       </div></div>)}
     </div>}
    </div>
    <section className="lektrus-chem-equation-preview" aria-label="Предпросмотр на доске">
     <div className="lektrus-chem-preview-heading"><strong>Предпросмотр</strong><span>Так уравнение увидят ученики</span></div>
     <LektrusChemicalEquationTypeset expression={raw} conditions={item.scienceReactionConditions}/>
    </section>
    {draft&&raw.trim()&&<div className={"lektrus-chem-balance "+(results?.status??"")} role="status">
     <div className="lektrus-chem-balance-description">
      <strong>{results?.status==="balanced"?"Уравнение уравнено":
       results?.status==="unbalanced"?"Проверка коэффициентов":
       results?.status==="invalid"?"Проверьте вещества":"Проверка уравнения"}</strong>
      <span>{results?.message}</span>
     </div>
     {mode==="builder"&&<div className="lektrus-chem-balance-buttons">
      {results?.status==="unbalanced"&&results.coefficients&&<button type="button" className="primary"
       onClick={autoBalance}>Расставить коэффициенты</button>}
      {[...draft.left,...draft.right].some(s=>s.coefficient!==1)&&
       <button type="button" onClick={resetBalance}>Сбросить коэффициенты</button>}
     </div>}
    </div>}
    {notice&&<p className="lektrus-chem-equation-notice" role="status">{notice}</p>}
   </div>
   <footer><span className="lektrus-chem-shortcut">Enter: новое вещество · Ctrl+Enter: сохранить</span>
    <button type="button" onClick={onCancel}>Отмена</button>
    <button className="primary" type="button" disabled={!saveReady} onClick={handleSave}>
     Сохранить на доску
    </button>
   </footer>
  </section>
 </div>,document.body);
}
