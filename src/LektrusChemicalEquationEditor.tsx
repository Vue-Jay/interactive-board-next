import {useRef,type ReactNode} from "react";
import {createPortal} from "react-dom";
import type {Item} from "./boardModel";

const arrowMatcher=/(⇌|↔|→|⟶|⟹|=|->)/;
const subscriptAfter=/([A-Z][a-z]?|\)|\])([0-9]+)/g;
const superscript=(value:string)=>value.replace(/[0-9]/g,n=>"⁰¹²³⁴⁵⁶⁷⁸⁹"[Number(n)]);

function FormulaPart({value}:{value:string}){
 const chunks:ReactNode[]=[];
 let last=0;
 for(const match of value.matchAll(subscriptAfter)){
  const at=match.index;
  if(at>last)chunks.push(value.slice(last,at));
  chunks.push(match[1],<sub key={at}>{match[2]}</sub>);
  last=at+match[0].length;
 }
 if(last<value.length)chunks.push(value.slice(last));
 return <span>{chunks}</span>;
}
export function LektrusChemicalEquationTypeset({expression,conditions}:{expression:string;conditions?:string}){
 const arrow=arrowMatcher.exec(expression);
 if(!arrow)return <div className="lektrus-reaction-equation-text"><FormulaPart value={expression||"Введите формулу"}/></div>;
 const i=arrow.index;
 const left=expression.slice(0,i),right=expression.slice(i+arrow[0].length);
 return <div className="lektrus-reaction-equation-text">
  <FormulaPart value={left}/>
  <span className="lektrus-reaction-arrow">
   {conditions&&<small className="lektrus-reaction-above">{conditions}</small>}
   <b>{arrow[0]==="->"?"→":arrow[0]}</b>
  </span>
  <FormulaPart value={right}/>
 </div>;
}
type Props={item:Item;onChange:(item:Item)=>void;onSave:()=>void;onCancel:()=>void};
export default function LektrusChemicalEquationEditor({item,onChange,onSave,onCancel}:Props){
 const area=useRef<HTMLTextAreaElement>(null);
 const add=(str:string)=>{
  const el=area.current,start=el?.selectionStart??item.graphExpression?.length??0;
  const end=el?.selectionEnd??start,old=item.graphExpression??"";
  onChange({...item,graphExpression:old.slice(0,start)+str+old.slice(end)});
  requestAnimationFrame(()=>{area.current?.focus();area.current?.setSelectionRange(start+str.length,start+str.length)});
 };
 return createPortal(<div className="lektrus-chem-equation-overlay" onPointerDown={e=>{if(e.target===e.currentTarget)onCancel()}}>
  <section role="dialog" aria-modal="true" aria-label="Химическое уравнение" className="lektrus-chem-equation-editor"
   onPointerDown={e=>e.stopPropagation()}>
   <header><strong>Химическое уравнение</strong><button type="button" onClick={onCancel} aria-label="Закрыть">×</button></header>
   <label>Формула или реакция
    <textarea ref={area} rows={3} autoFocus value={item.graphExpression??""} maxLength={600}
     spellCheck={false} placeholder="Например: Na2CO3 + 2HCl → 2NaCl + CO2↑ + H2O"
     onChange={e=>onChange({...item,graphExpression:e.target.value})}/>
   </label>
   <div role="group" className="lektrus-chem-insert-symbols" aria-label="Специальные символы">
    {["→","⇌","↑","↓","Δ","t°","hν","°C","+","−","·","⇄","⁺","⁻"].map(symbol=>
     <button type="button" key={symbol} title={"Вставить "+symbol}
      onMouseDown={e=>e.preventDefault()} onClick={()=>add(symbol)}>{symbol}</button>)}
    <button type="button" onClick={()=>add(superscript("2"))} title="Вставить степень 2">²</button>
   </div>
   <label>Условия над стрелкой
    <input value={item.scienceReactionConditions??""} maxLength={90}
      placeholder="t°, катализатор, свет, H₂SO₄"
      onChange={e=>onChange({...item,scienceReactionConditions:e.target.value})}/>
   </label>
   <div className="lektrus-chem-equation-preview"><strong>Предпросмотр</strong>
    <LektrusChemicalEquationTypeset expression={item.graphExpression??""}
     conditions={item.scienceReactionConditions}/>
   </div>
   <footer><button type="button" onClick={onCancel}>Отмена</button>
    <button className="primary" type="button" disabled={!item.graphExpression?.trim()} onClick={onSave}>
     Вывести на доску
    </button>
   </footer>
  </section>
 </div>,document.body);
}
