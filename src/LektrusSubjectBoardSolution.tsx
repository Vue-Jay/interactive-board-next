import {createPortal} from "react-dom";
import {useLayoutEffect,useRef,type CSSProperties} from "react";
import type {SubjectBoardWorkedSolution} from "./boardModel";
import {subjectAccentPalette,type SubjectTone} from "./lektrusSubjectAccent";

export const emptyWorkedSolution=():SubjectBoardWorkedSolution=>({
 given:"",find:"",si:"",work:"",answer:""
});
/** Keep older SI notes visible, but integrate them into "Дано" rather than a separate field. */
export const givenWithLegacyUnits=(value?:SubjectBoardWorkedSolution):string=>{
 const given=value?.given??"";
 const units=value?.si?.trim()??"";
 return units?[given.trimEnd(),units].filter(Boolean).join("\n"):given;
};
export const withoutSeparateUnits=(value:SubjectBoardWorkedSolution):SubjectBoardWorkedSolution=>({
 ...value,given:givenWithLegacyUnits(value),si:""
});
export const hasWorkedSolution=(value?:SubjectBoardWorkedSolution)=>Boolean(value&&
 (givenWithLegacyUnits(value).trim()||value.find.trim()||value.work.trim()||value.answer.trim()));

type Props={tone:SubjectTone;value:SubjectBoardWorkedSolution|undefined;legacyAnswer?:string};
export function LektrusSubjectBoardSolutionView({tone,value,legacyAnswer}:Props){
 const hasContent=hasWorkedSolution(value)||Boolean(legacyAnswer?.trim());
 if(!hasContent)return null;
 return <section className="lektrus-school-solution" aria-label="Оформленное решение задачи">
  <div className="lektrus-school-solution-heading">Решение</div>
  {(givenWithLegacyUnits(value)||value?.find)&&<div className="lektrus-school-solution-data">
   {givenWithLegacyUnits(value)&&<div><b>Дано</b><p>{givenWithLegacyUnits(value)}</p></div>}
   {value?.find&&<div><b>Найти</b><p>{value.find}</p></div>}
  </div>}
  {(value?.work||legacyAnswer)&&<div className="lektrus-school-solution-work">{value?.work||legacyAnswer}</div>}
  {!!value?.answer&&<div className="lektrus-school-solution-final"><b>Ответ:</b> {value.answer}</div>}
 </section>;
}
/** Controlled growing handwriting-style line editor, measured at intrinsic height. */
function SchoolWritingArea({value,onChange,placeholder,label,limit=2000,rows=2}:{
 value:string;onChange?:(next:string)=>void;placeholder:string;label:string;limit?:number;rows?:number;
}){
 const ref=useRef<HTMLTextAreaElement>(null);
 useLayoutEffect(()=>{
   const el=ref.current;
   if(!el)return;
   el.style.height="auto";
   el.style.height=Math.max(el.scrollHeight,rows*24)+"px";
 },[value,rows]);
 return onChange?<textarea ref={ref} rows={rows} aria-label={label} maxLength={limit}
   value={value} placeholder={placeholder} data-board-interactive="true"
   onPointerDown={e=>e.stopPropagation()} onClick={e=>e.stopPropagation()}
   onDoubleClick={e=>e.stopPropagation()} onChange={e=>onChange(e.target.value)}/>:
   <p className="lektrus-school-written-text">{value||" "}</p>;
}

/** School layout: Дано | Решение, then Найти | Ответ, following the notebook sketch.
 * The subject's question belongs to the teacher; all four fields belong to pupils. */
export function LektrusSubjectBoardInlineSolution({tone,value,onChange}:{
 tone:SubjectTone;
 value?:SubjectBoardWorkedSolution;
 onChange?:(value:SubjectBoardWorkedSolution)=>void;
}){
 const current=value??emptyWorkedSolution();
 const patch=(field:keyof SubjectBoardWorkedSolution,next:string)=>{
  if(onChange)onChange({...withoutSeparateUnits(current),[field]:next});
 };
 return <section className="lektrus-school-notebook" aria-label="Школьное оформление решения задачи">
   <div className="lektrus-school-notebook-left">
     <label className="lektrus-school-notebook-part lektrus-school-notebook-given">
       <strong>Дано:</strong>
       <SchoolWritingArea label="Дано" value={givenWithLegacyUnits(current)} rows={4}
        placeholder="Данные, величины и перевод единиц" onChange={onChange?text=>patch("given",text):undefined}/>
     </label>
     <label className="lektrus-school-notebook-part lektrus-school-notebook-find">
       <strong>Найти:</strong>
       <SchoolWritingArea label="Найти" value={current.find}
        placeholder="Укажите искомое" onChange={onChange?text=>patch("find",text):undefined}/>

     </label>
   </div>
   <div className="lektrus-school-notebook-right">
     <label className="lektrus-school-notebook-part lektrus-school-notebook-working">
       <strong>Решение:</strong>
       <SchoolWritingArea label="Решение" value={current.work} rows={6} limit={5000}
        placeholder="Запишите действия, формулы и вычисления"
        onChange={onChange?text=>patch("work",text):undefined}/>
     </label>
     <label className="lektrus-school-notebook-part lektrus-school-notebook-result">
       <strong>Ответ:</strong>
       <SchoolWritingArea label="Ответ" value={current.answer}
        placeholder="Запишите ответ" onChange={onChange?text=>patch("answer",text):undefined}/>
     </label>
   </div>
 </section>;
}
type EditorProps={
 tone:SubjectTone;
 value:SubjectBoardWorkedSolution|undefined;
 initialGiven?:string;
 initialFind?:string;
 onChange:(value:SubjectBoardWorkedSolution)=>void;
 onClose:()=>void;
};
export function LektrusSubjectBoardSolutionEditor({tone,value,initialGiven="",initialFind="",onChange,onClose}:EditorProps){
 const palette=subjectAccentPalette[tone];
 const current=value??{...emptyWorkedSolution(),given:initialGiven,find:initialFind};
 const patch=(key:keyof SubjectBoardWorkedSolution,value:string)=>
  onChange({...withoutSeparateUnits(current),[key]:value});
 const style={"--subject-board-accent":palette.accent,"--subject-board-soft":palette.soft} as CSSProperties;
 return createPortal(<div className="lektrus-subject-task-overlay" onPointerDown={e=>{if(e.target===e.currentTarget)onClose();}}>
  <section className="lektrus-school-solution-editor" style={style} role="dialog" aria-modal="true"
   aria-label="Редактор решения задачи" onPointerDown={e=>e.stopPropagation()}
   onKeyDown={e=>{if(e.key==="Escape"){e.stopPropagation();onClose()}}}>
   <header className="lektrus-school-solution-editor-head">
    <div><strong>Решение задачи</strong><small>{palette.label} · школьное оформление</small></div>
    <button type="button" aria-label="Закрыть" onClick={onClose}>×</button>
   </header>
   <div className="lektrus-school-solution-editor-body">
    <div className="lektrus-school-solution-edit-grid">
     <label><strong>Дано</strong><span>Все известные величины из условия</span>
      <textarea rows={3} value={givenWithLegacyUnits(current)} maxLength={2000}
       placeholder="Запишите исходные данные, обозначения и перевод единиц"
       onChange={e=>patch("given",e.target.value)}/></label>
     <label><strong>Найти</strong><span>Что требуется определить</span>
      <textarea rows={3} value={current.find} maxLength={2000}
       placeholder="Запишите искомые величины"
       onChange={e=>patch("find",e.target.value)}/></label>

    </div>
    <label className="lektrus-school-solution-work-editor"><strong>Решение</strong>
     <span>Формулы, преобразования, подстановка значений, вычисления и пояснения по строкам</span>
     <textarea rows={6} value={current.work} maxLength={5000}
      placeholder="Запишите ход решения по шагам: формула, преобразование, вычисление"
      onChange={e=>patch("work",e.target.value)}/></label>
    <label className="lektrus-school-solution-answer-editor"><strong>Ответ</strong>
     <input value={current.answer} maxLength={2000}
      placeholder="Запишите окончательный результат с единицами измерения"
      onChange={e=>patch("answer",e.target.value)}/></label>
   </div>
   <footer className="lektrus-school-solution-editor-foot">
    <span>Содержимое сохраняется на общей доске</span>
    <button type="button" onClick={onClose}>Готово</button>
   </footer>
  </section>
 </div>,document.body);
}
