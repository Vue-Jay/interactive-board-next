import {Fragment,useRef,useState,type ReactNode} from "react";
import {createPortal} from "react-dom";
import type {Item} from "./boardModel";
import {
 blankSpecies,inspectEquationBalance,parseEquationDraft,readSpecies,writeEquationDraft,
 type EquationArrow,type EquationDraft,type EquationSpecies
} from "./lektrusChemicalEquationModel";

type Props={item:Item;onChange:(item:Item)=>void;onSave:()=>void;onCancel:()=>void};
type Side="left"|"right";
const subscripts="₀₁₂₃₄₅₆₇₈₉";
const indexed=/([A-Z][a-z]?|[)\]])([0-9]+)/g;
const arrows:{value:EquationArrow;label:string}[]=[
 {value:"→",label:"→"},{value:"⇌",label:"⇌"},{value:"=",label:"="}
];
const symbols=["₂","₃","₄","₅","(",")","[","]","·","⁺","⁻"];
const quickConditions=["t°","hν","кат."];

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
/** One shared rendering for the editor preview and existing objects on the board. */
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
 const first=useRef(item.graphExpression??"");
 const [mode,setMode]=useState<"builder"|"source">(()=>
  parseEquationDraft(first.current)?"builder":"source");
 const [symbolsOpen,setSymbolsOpen]=useState(false);
 const [notice,setNotice]=useState("");
 const focused=useRef<{side:Side;index:number}|null>(null);
 const inputs=useRef(new Map<string,HTMLInputElement>());
 const rawArea=useRef<HTMLTextAreaElement>(null);
 const raw=item.graphExpression??"";
 const draft=parseEquationDraft(raw);
 const balance=draft?inspectEquationBalance(draft):null;
 const complete=!!draft&&draft.left.length>0&&draft.right.length>0&&
  [...draft.left,...draft.right].every(s=>s.formula.trim().length>0);
 const canSave=raw.trim().length>0&&raw.length<=500&&(mode==="source"||complete);

 const updateSource=(value:string)=>{
  if(value.length>500){setNotice("Максимум 500 символов");return;}
  onChange({...item,graphExpression:value});setNotice("");
 };
 const updateDraft=(next:EquationDraft)=>{
  const value=writeEquationDraft(next);
  updateSource(value);
 };
 const copyDraft=():EquationDraft=>({
  left:(draft?.left??[blankSpecies()]).map(s=>({...s})),
  right:(draft?.right??[blankSpecies()]).map(s=>({...s})),
  arrow:draft?.arrow??"→"
 });
 const patch=(side:Side,index:number,updates:Partial<EquationSpecies>)=>{
  const next=copyDraft();
  if(!next[side][index])return;
  next[side][index]={...next[side][index],...updates};
  updateDraft(next);
 };
 const addSpecies=(side:Side)=>{
  const next=copyDraft();if(next[side].length>=10)return;
  next[side].push(blankSpecies());
  updateDraft(next);
  const index=next[side].length-1;
  requestAnimationFrame(()=>inputs.current.get(side+index)?.focus());
 };
 const deleteSpecies=(side:Side,index:number)=>{
  const next=copyDraft();
  if(next[side].length===1)next[side][0]=blankSpecies();
  else next[side].splice(index,1);
  focused.current=null;updateDraft(next);
 };
 const insertSymbol=(symbol:string)=>{
  const insertion=mode==="source"?symbol:
   symbol.replace(/[₀-₉]/g,v=>String(subscripts.indexOf(v)));
  if(mode==="source"){
   const el=rawArea.current,start=el?.selectionStart??raw.length,end=el?.selectionEnd??start;
   updateSource(raw.slice(0,start)+insertion+raw.slice(end));
   requestAnimationFrame(()=>{el?.focus();el?.setSelectionRange(start+insertion.length,start+insertion.length);});
   return;
  }
  const target=focused.current??{side:"left" as const,index:0};
  const next=copyDraft();const row=next[target.side][target.index];
  if(!row)return;
  const el=inputs.current.get(target.side+target.index);
  const start=el?.selectionStart??row.formula.length,end=el?.selectionEnd??start;
  row.formula=row.formula.slice(0,start)+insertion+row.formula.slice(end);
  updateDraft(next);
  requestAnimationFrame(()=>{el?.focus();el?.setSelectionRange(start+insertion.length,start+insertion.length);});
 };
 const applyBalance=()=>{
  if(!draft||balance?.status!=="unbalanced"||!balance.coefficients)return;
  const next=copyDraft();let i=0;
  for(const side of ["left","right"] as const)
   next[side].forEach(row=>{row.coefficient=balance.coefficients![i++];});
  updateDraft(next);setNotice("Коэффициенты расставлены по числу атомов.");
 };
 const makeReaction=()=>{
  updateDraft({left:[readSpecies(raw)],right:[blankSpecies()],arrow:"→"});
  setMode("builder");
 };
 const appendCondition=(condition:string)=>{
  const before=(item.scienceReactionConditions??"").trim();
  const next=before?before+", "+condition:condition;
  if(next.length<=90)onChange({...item,scienceReactionConditions:next});
 };
 const submit=()=>{if(canSave)onSave();};
 return createPortal(
  <div className="lektrus-chem-equation-overlay lektrus-chem-equation-v2 lektrus-chem-equation-compact"
   onPointerDown={e=>{if(e.target===e.currentTarget)onCancel()}}>
   <section className="lektrus-chem-equation-editor" role="dialog" aria-modal="true"
    aria-label="Редактор химических уравнений"
    onPointerDown={e=>e.stopPropagation()}
    onKeyDown={e=>{
     if(e.key==="Escape"){e.stopPropagation();onCancel();}
     if(e.key==="Enter"&&(e.ctrlKey||e.metaKey)){e.preventDefault();submit();}
    }}>
    <header className="lektrus-chem-equation-header">
     <div className="lektrus-chem-equation-heading"><strong>Химическое уравнение</strong>
      <small>Введите вещества, оформите реакцию и проверьте коэффициенты</small></div>
     <button type="button" aria-label="Закрыть" title="Закрыть" onClick={onCancel}>×</button>
    </header>
    <div className="lektrus-chem-equation-mode" role="tablist" aria-label="Способ редактирования">
     <button type="button" role="tab" aria-selected={mode==="builder"} disabled={!draft}
      onClick={()=>setMode("builder")}>По веществам</button>
     <button type="button" role="tab" aria-selected={mode==="source"}
      onClick={()=>setMode("source")}>Одной строкой</button>
    </div>
    <div className="lektrus-chem-equation-content">
     {mode==="builder"&&draft?
      <div className="lektrus-chem-builder">
       <div className="lektrus-chem-equation-columns">
        {(["left","right"] as Side[]).map(side=><Fragment key={side}><section className="lektrus-chem-side">
         <div className="lektrus-chem-side-heading">
          <strong>{side==="left"?"Реагенты":"Продукты"}</strong>
          <small>{side==="left"?"До реакции":"После реакции"}</small>
         </div>
         <div className="lektrus-chem-species-list">
          {draft[side].map((s,index)=><div className="lektrus-chem-species-card" key={side+index}>
           <label className="lektrus-chem-coeff-field">
            <span className="sr-only">Коэффициент</span>
            <input type="number" inputMode="numeric" min={1} max={999} step={1}
             title="Коэффициент (1 не пишется)"
             aria-label={"Коэффициент "+(side==="left"?"реагента ":"продукта ")+(index+1)}
             value={s.coefficient===1?"":s.coefficient} placeholder="1"
             onChange={e=>patch(side,index,{coefficient:Math.min(999,Math.max(1,Math.floor(Number(e.target.value)||1)))})}/>
           </label>
           <label className="lektrus-chem-formula-field">
            <span className="sr-only">Формула вещества</span>
            <input type="text" autoComplete="off" spellCheck={false} maxLength={120}
             aria-label={"Формула "+(side==="left"?"реагента ":"продукта ")+(index+1)}
             placeholder={side==="left"?"Например, H2SO4":"Например, H2O"} value={s.formula}
             ref={el=>{if(el)inputs.current.set(side+index,el);else inputs.current.delete(side+index);}}
             onFocus={()=>{focused.current={side,index};}}
             onChange={e=>patch(side,index,{formula:e.target.value})}
             onKeyDown={e=>{
              if(e.key==="Enter"&&!e.ctrlKey&&!e.metaKey){e.preventDefault();addSpecies(side);}
              if(e.key==="Backspace"&&!s.formula&&draft[side].length>1){
               e.preventDefault();deleteSpecies(side,index);
              }
             }}/>
           </label>
           {side==="right"&&<select className="lektrus-chem-state" value={s.indicator}
             title="Обозначение выделения газа или осадка"
             aria-label={"Признак продукта "+(index+1)}
             onChange={e=>patch(side,index,{indicator:e.target.value as EquationSpecies["indicator"]})}>
             <option value="">—</option><option value="↑">↑ газ</option><option value="↓">↓ осадок</option>
            </select>}
           <button type="button" className="lektrus-chem-remove-species"
            aria-label={"Убрать "+(side==="left"?"реагент ":"продукт ")+(index+1)}
            title="Убрать вещество" onClick={()=>deleteSpecies(side,index)}>×</button>
          </div>)}
         </div>
         <button type="button" className="lektrus-chem-add-species"
          onClick={()=>addSpecies(side)} disabled={draft[side].length>=10}>+ Вещество</button>
        </section>
        {side==="left"&&<div className="lektrus-chem-arrow-chooser">
         <span>Знак реакции</span>
         <div role="group" aria-label="Знак реакции">{arrows.map(a=><button type="button" key={a.value}
          title={"Использовать "+a.label} aria-pressed={draft.arrow===a.value}
          onClick={()=>updateDraft({...copyDraft(),arrow:a.value})}>{a.label}</button>)}</div>
        </div>}
        </Fragment>)}
       </div>
      </div>:
      <div className="lektrus-chem-source">
       <label><strong>Запись уравнения</strong><span>Для ионных уравнений и нестандартных обозначений</span>
        <textarea ref={rawArea} rows={4} spellCheck={false} maxLength={500} value={raw}
         placeholder="Na2CO3 + 2HCl → 2NaCl + CO2↑ + H2O"
         onChange={e=>updateSource(e.target.value)}/>
       </label>
       {!draft&&raw.trim()&&!/(→|⇌|⇄|↔|⟶|⟹|=|->)/.test(raw)&&
        <button type="button" className="lektrus-chem-make-reaction"
         onClick={makeReaction}>Превратить формулу в уравнение</button>}
      </div>}
     <div className="lektrus-chem-equation-conditions">
      <label className="lektrus-chem-equation-condition-field">
       <span>Условия над стрелкой</span>
       <input type="text" maxLength={90} value={item.scienceReactionConditions??""}
        placeholder="Необязательно" onChange={e=>onChange({...item,scienceReactionConditions:e.target.value})}/>
      </label>
      <div className="lektrus-chem-conditions-quick" aria-label="Частые условия реакции">
       {quickConditions.map(cond=><button key={cond} type="button"
        title={"Добавить "+cond} onClick={()=>appendCondition(cond)}>{cond}</button>)}
      </div>
     </div>
     <div className="lektrus-chem-palettes">
      <button type="button" className="lektrus-chem-palette-toggle" aria-expanded={symbolsOpen}
       onClick={()=>setSymbolsOpen(v=>!v)}>
       Специальные символы <span>{symbolsOpen?"−":"+"}</span>
      </button>
      {symbolsOpen&&<div className="lektrus-chem-palettes-rows">
       <div className="lektrus-chem-palettes-row"><div role="group" aria-label="Вставка символов">
        {symbols.map(symbol=><button type="button" key={symbol}
         onMouseDown={e=>e.preventDefault()} title={"Вставить "+symbol}
         onClick={()=>insertSymbol(symbol)}>{symbol}</button>)}
       </div></div>
      </div>}
     </div>
     <section className="lektrus-chem-equation-preview" aria-label="Предпросмотр записи">
      <div className="lektrus-chem-preview-heading">
       <strong>Предпросмотр</strong><span>Так уравнение появится на доске</span>
      </div>
      <LektrusChemicalEquationTypeset expression={raw} conditions={item.scienceReactionConditions}/>
     </section>
     {draft&&raw.trim()&&<div className={"lektrus-chem-balance "+(balance?.status??"")} role="status">
      <div className="lektrus-chem-balance-description">
       <strong>{balance?.status==="balanced"?"Число атомов совпадает":
        balance?.status==="unbalanced"?"Коэффициенты не уравнены":
        balance?.status==="invalid"?"Проверьте состав веществ":"Проверка коэффициентов"}</strong>
       <span>{balance?.message}.</span>
      </div>
      {mode==="builder"&&balance?.status==="unbalanced"&&balance.coefficients&&
       <button type="button" className="lektrus-chem-apply-balance" onClick={applyBalance}>
        Расставить коэффициенты</button>}
     </div>}
     {notice&&<p className="lektrus-chem-equation-notice" role="status">{notice}</p>}
     <p className="lektrus-chem-equation-footnote">
      Проверка относится к числу атомов, а не к возможности протекания реакции.
     </p>
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
