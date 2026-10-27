import {createPortal} from "react-dom";
import type {CSSProperties} from "react";
import type {Item,SubjectBoardEntry} from "./boardModel";
import {LektrusChemicalEquationTypeset} from "./LektrusChemicalEquationEditor";
import {subjectAccentPalette,type SubjectTone} from "./lektrusSubjectAccent";

export const subjectBoardId=(tone:SubjectTone)=>"subject-board-"+tone;
export const isSubjectBoard=(item:Item)=>item.kind==="graph"&&!!item.graphFigureId?.startsWith("subject-board-");
export const boardTone=(item:Item):SubjectTone=>{
 const tone=item.graphFigureId?.replace(/^subject-board-/,"") as SubjectTone;
 return tone in subjectAccentPalette?tone:"chemistry";
};
export const newSubjectBoardEntry=(id:string,kind:"equation"|"task"):SubjectBoardEntry=>({
 id,kind,title:"",prompt:"",format:kind==="equation"?"equation":"problem",
 steps:kind==="equation"?[{expression:"",conditions:""}]:undefined,
 answer:"",solution:"",revealed:false
});
export const subjectBoardEntryFilled=(entry:SubjectBoardEntry)=>Boolean(
 entry.title.trim()||entry.prompt.trim()||entry.solution.trim()||entry.answer.trim()||
 entry.steps?.some(step=>step.expression.replace(/[→⇌=\s]/g,"").trim()||step.conditions.trim())
);

type BoardProps={
 item:Item;
 onAction?:(mode:"equation"|"task",entryId?:string)=>void;
 onAnswerChange?:(entryId:string,answer:string)=>void;
 onReveal?:(entryId:string)=>void;
};
export function LektrusSubjectBoardView({item,onAction,onAnswerChange,onReveal}:BoardProps){
 const tone=boardTone(item),palette=subjectAccentPalette[tone];
 const entries=item.subjectBoardEntries??[];
 const chemistry=tone==="chemistry";
 return <div className="graph-view lektrus-subject-board-shell">
  <article className="lektrus-subject-board" style={{"--subject-board-accent":palette.accent,"--subject-board-soft":palette.soft} as CSSProperties}
   aria-label={palette.label+" · учебная доска"}>
   <header className="lektrus-subject-board-header">
    <span className="lektrus-subject-board-emblem" aria-hidden="true">▤</span>
    <strong>{palette.label} <span>· учебная доска</span></strong>
    {onAction&&<nav className="lektrus-subject-board-tools" aria-label="Инструменты предметной доски">
     {chemistry&&<button type="button" data-board-interactive="true"
       onPointerDown={e=>e.stopPropagation()} onClick={e=>{e.stopPropagation();onAction("equation")}}>
       Уравнения</button>}
     <button type="button" data-board-interactive="true" onPointerDown={e=>e.stopPropagation()}
       onClick={e=>{e.stopPropagation();onAction("task")}}>Создать задание</button>
    </nav>}
    <small>{entries.length?entries.length+" заданий":"Чистый лист"}</small>
   </header>
   <div className="lektrus-subject-board-sheet">
    {entries.length===0&&<div className="lektrus-subject-board-empty">
      <strong>Место для заданий и решений</strong>
      <span>{chemistry?"Добавьте уравнение, цепочку или задание":"Добавьте задание, затем запишите решение на доске"}</span>
    </div>}
    {entries.map((entry,index)=><section className="lektrus-subject-board-entry" key={entry.id}>
      <div className="lektrus-subject-board-entry-head">
       <span className="lektrus-subject-board-index">{String(index+1).padStart(2,"0")}</span>
       <strong>{entry.title.trim()||((entry.kind==="equation")?"Уравнение / цепочка":"Задание")}</strong>
       {onAction&&<button type="button" data-board-interactive="true" onPointerDown={e=>e.stopPropagation()}
        onClick={e=>{e.stopPropagation();onAction(entry.kind,entry.id);}} title="Изменить задание">Изменить</button>}
      </div>
      {entry.prompt&&<p className="lektrus-subject-board-prompt">{entry.prompt}</p>}
      {entry.kind==="equation"&&<div className="lektrus-subject-board-equations">
        {(entry.steps??[]).filter(step=>step.expression.trim()).map((step,j)=>
         <div className="lektrus-subject-board-formula" key={j}>
          {(entry.steps?.length??0)>1&&<span>{j+1}.</span>}
          <LektrusChemicalEquationTypeset expression={step.expression} conditions={step.conditions}/>
         </div>)}
      </div>}
      {entry.kind==="task"&&entry.format==="chain"&&<div className="lektrus-subject-board-exercise-type">Цепочка превращений</div>}
      <div className="lektrus-subject-board-answer">
       <label htmlFor={"board-answer-"+entry.id}>Решение</label>
       {onAnswerChange?<textarea id={"board-answer-"+entry.id} rows={2} value={entry.answer} maxLength={2000}
        placeholder="Запишите решение или ответ…"
        onPointerDown={e=>e.stopPropagation()} onDoubleClick={e=>e.stopPropagation()}
        onChange={e=>onAnswerChange(entry.id,e.target.value)}/>:
        <div className="lektrus-subject-board-answer-text">{entry.answer||"Место для решения"}</div>}
      </div>
      {entry.solution.trim()&&<>
       {entry.revealed?<div className="lektrus-subject-board-solution"><b>Образец ответа</b><span>{entry.solution}</span></div>:
        <div className="lektrus-subject-board-solution-hidden">Ответ преподавателя скрыт</div>}
       {onReveal&&<button type="button" className="lektrus-subject-board-reveal" data-board-interactive="true"
        onPointerDown={e=>e.stopPropagation()} onClick={e=>{e.stopPropagation();onReveal(entry.id);}}>
        {entry.revealed?"Скрыть образец":"Показать образец"}</button>}
      </>}
    </section>)}
   </div>
   <footer className="lektrus-subject-board-footer"><span>LEKTRUS · {palette.label.toLocaleUpperCase("ru-RU")}</span>
    <span>ЗАДАНИЯ / РЕШЕНИЯ</span></footer>
  </article>
 </div>;
}
type EditorProps={
 subject:string;entry:SubjectBoardEntry;onChange:(entry:SubjectBoardEntry)=>void;
 onClose:()=>void;onDelete:()=>void;
};
/** One entry editor, not a second canvas. Every keystroke updates the original shared board. */
export function LektrusSubjectBoardTaskEditor({subject,entry,onChange,onClose,onDelete}:EditorProps){
 const patch=(fields:Partial<SubjectBoardEntry>)=>onChange({...entry,...fields});
 return createPortal(<div className="lektrus-subject-task-overlay" onPointerDown={e=>{if(e.target===e.currentTarget)onClose();}}>
  <section className="lektrus-subject-task-editor" role="dialog" aria-modal="true" aria-label="Создание задания"
   onPointerDown={e=>e.stopPropagation()} onKeyDown={e=>{if(e.key==="Escape"){e.stopPropagation();onClose();}}}>
   <header><div><strong>Создание задания</strong><small>{subject} · общая предметная доска</small></div>
    <button type="button" aria-label="Закрыть" onClick={onClose}>×</button></header>
   <div className="lektrus-subject-task-body">
    <label>Тип задания<select value={entry.format??"problem"} onChange={e=>patch({format:e.target.value as SubjectBoardEntry["format"]})}>
      <option value="problem">Задача / вопрос</option>
      <option value="equation">Уравнения</option>
      <option value="chain">Цепочки</option>
      <option value="exercise">Упражнение</option>
     </select></label>
    <label>Название<input value={entry.title} maxLength={120} placeholder="Например: Задание 1" onChange={e=>patch({title:e.target.value})}/></label>
    <label>Условие<textarea rows={5} maxLength={2500} value={entry.prompt}
       placeholder="Что нужно выполнить? Можно записать несколько уравнений или этапов."
       onChange={e=>patch({prompt:e.target.value})}/></label>
    <label>Ответ преподавателя<textarea rows={3} maxLength={2000} value={entry.solution}
       placeholder="Необязательно. Будет скрыт до показа."
       onChange={e=>patch({solution:e.target.value})}/></label>
    <p>Ученик вводит своё решение прямо на предметной доске. Все участники видят обновления.</p>
   </div>
   <footer><button type="button" className="is-danger" onClick={onDelete}>Удалить задание</button>
    <button type="button" className="is-primary" onClick={onClose}>Готово</button></footer>
  </section>
 </div>,document.body);
}
