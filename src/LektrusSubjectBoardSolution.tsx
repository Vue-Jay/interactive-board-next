import {createPortal} from "react-dom";
import type {CSSProperties} from "react";
import type {SubjectBoardWorkedSolution} from "./boardModel";
import {subjectAccentPalette,type SubjectTone} from "./lektrusSubjectAccent";

export const emptyWorkedSolution=():SubjectBoardWorkedSolution=>({
 given:"",find:"",si:"",work:"",answer:""
});
export const hasWorkedSolution=(value?:SubjectBoardWorkedSolution)=>Boolean(value&&
 (value.given.trim()||value.find.trim()||value.si.trim()||value.work.trim()||value.answer.trim()));

type Props={tone:SubjectTone;value:SubjectBoardWorkedSolution|undefined;legacyAnswer?:string};
export function LektrusSubjectBoardSolutionView({tone,value,legacyAnswer}:Props){
 const hasContent=hasWorkedSolution(value)||Boolean(legacyAnswer?.trim());
 if(!hasContent)return null;
 return <section className="lektrus-school-solution" aria-label="Оформленное решение задачи">
  <div className="lektrus-school-solution-heading">Решение</div>
  {(value?.given||value?.find||value?.si)&&<div className="lektrus-school-solution-data">
   {value?.given&&<div><b>Дано</b><p>{value.given}</p></div>}
   {value?.find&&<div><b>Найти</b><p>{value.find}</p></div>}
   {tone==="physics"&&value?.si&&<div><b>СИ</b><p>{value.si}</p></div>}
  </div>}
  {(value?.work||legacyAnswer)&&<div className="lektrus-school-solution-work">{value?.work||legacyAnswer}</div>}
  {!!value?.answer&&<div className="lektrus-school-solution-final"><b>Ответ:</b> {value.answer}</div>}
 </section>;
}
type EditorProps={
 tone:SubjectTone;
 value:SubjectBoardWorkedSolution|undefined;
 onChange:(value:SubjectBoardWorkedSolution)=>void;
 onClose:()=>void;
};
export function LektrusSubjectBoardSolutionEditor({tone,value,onChange,onClose}:EditorProps){
 const palette=subjectAccentPalette[tone];
 const current=value??emptyWorkedSolution();
 const patch=(key:keyof SubjectBoardWorkedSolution,value:string)=>onChange({...current,[key]:value});
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
      <textarea rows={3} value={current.given} maxLength={2000}
       placeholder="Запишите исходные данные и их обозначения"
       onChange={e=>patch("given",e.target.value)}/></label>
     <label><strong>Найти</strong><span>Что требуется определить</span>
      <textarea rows={3} value={current.find} maxLength={2000}
       placeholder="Запишите искомые величины"
       onChange={e=>patch("find",e.target.value)}/></label>
     {tone==="physics"&&<label className="lektrus-school-solution-si"><strong>СИ</strong>
      <span>Перевод величин в международную систему</span>
      <textarea rows={2} value={current.si} maxLength={2000}
       placeholder="Переведите исходные данные в единицы СИ"
       onChange={e=>patch("si",e.target.value)}/></label>}
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
