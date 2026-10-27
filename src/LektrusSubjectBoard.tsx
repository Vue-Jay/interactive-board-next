import {createPortal} from "react-dom";
import {useEffect,useRef,type CSSProperties} from "react";
import type {Item,SubjectBoardEntry} from "./boardModel";
import {LektrusChemicalEquationTypeset} from "./LektrusChemicalEquationEditor";
import {subjectAccentPalette,type SubjectTone} from "./lektrusSubjectAccent";
import {taskTemplateFor,subjectTaskTemplates,freshTaskDetails,subjectBoardHasWork,isSchoolSolutionSubject} from "./lektrusSubjectTaskTemplates";
import {LektrusSubjectBoardSolutionView,hasWorkedSolution} from "./LektrusSubjectBoardSolution";

export const subjectBoardId=(tone:SubjectTone)=>"subject-board-"+tone;
export const isSubjectBoard=(item:Item)=>item.kind==="graph"&&!!item.graphFigureId?.startsWith("subject-board-");
export const boardTone=(item:Item):SubjectTone=>{
 const tone=item.graphFigureId?.replace(/^subject-board-/,"") as SubjectTone;
 return tone in subjectAccentPalette?tone:"mathematics";
};
export const subjectBoardLocked=(item:Item)=>item.subjectBoardEntries?.some(subjectBoardHasWork)===true;
export const newSubjectBoardEntry=(id:string,kind:"equation"|"task",tone:SubjectTone="chemistry"):SubjectBoardEntry=>{
 const format=kind==="equation"?"equation":subjectTaskTemplates[tone][0].id;
 return {id,kind,title:"",prompt:"",format,
  details:kind==="task"?freshTaskDetails(tone,format):undefined,
  steps:kind==="equation"?[{expression:"",conditions:""}]:undefined,
  answer:"",solution:"",revealed:false};
};
export const subjectBoardEntryFilled=subjectBoardHasWork;

type BoardProps={
 item:Item;
 onAction?:(mode:"equation"|"task",entryId?:string)=>void;
 onAnswerChange?:(entryId:string,answer:string)=>void;
 onReveal?:(entryId:string)=>void;
 onMove?:(entryId:string,direction:-1|1)=>void;
 onEditSolution?:(entryId:string)=>void;
};
export function LektrusSubjectBoardView({item,onAction,onAnswerChange,onReveal,onMove,onEditSolution}:BoardProps){
 const tone=boardTone(item),palette=subjectAccentPalette[tone];
 const entries=item.subjectBoardEntries??[];
 const sheetRef=useRef<HTMLDivElement>(null);
 const countRef=useRef(entries.length);
 useEffect(()=>{
   const previous=countRef.current;
   countRef.current=entries.length;
   if(entries.length>previous)sheetRef.current?.scrollTo({top:sheetRef.current.scrollHeight,behavior:"smooth"});
 },[entries.length]);
 const chemistry=tone==="chemistry";
 const style={"--subject-board-accent":palette.accent,"--subject-board-soft":palette.soft} as CSSProperties;
 return <div className="graph-view lektrus-subject-board-shell" data-worksheet-subject={tone}>
  <article className="lektrus-subject-board" style={style} aria-label={palette.label+" · учебная доска"}>
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
    <small>{subjectBoardLocked(item)?"Закреплена":entries.length?entries.length+" заданий":"Чистый лист"}</small>
   </header>
   <div className="lektrus-subject-board-sheet" ref={sheetRef}>
    {entries.length===0&&<div className="lektrus-subject-board-empty">
      <strong>Задания и решения</strong>
      <span>{chemistry?"Уравнения, цепочки и химические задачи":"Выберите вид задания и заполните поля"}</span>
      <span className="lektrus-subject-board-empty-note">Предмет закрепится после первой записи.</span>
    </div>}
    {entries.map((entry,index)=>{
      const definition=taskTemplateFor(tone,entry.format);
      return <section className="lektrus-subject-board-entry" key={entry.id}>
      <div className="lektrus-subject-board-entry-head">
       <span className="lektrus-subject-board-index">{String(index+1).padStart(2,"0")}</span>
       <strong>{entry.title.trim()||(entry.kind==="equation"?"Уравнения и превращения":definition.title)}</strong>
       {onMove&&entries.length>1&&<span className="lektrus-subject-board-reorder" role="group" aria-label="Порядок заданий">
        <button type="button" disabled={index===0} aria-label="Поднять задание выше" title="Переместить вверх" data-board-interactive="true"
         onPointerDown={e=>e.stopPropagation()} onClick={e=>{e.stopPropagation();onMove(entry.id,-1);}}>↑</button>
        <button type="button" disabled={index===entries.length-1} aria-label="Опустить задание ниже" title="Переместить вниз" data-board-interactive="true"
         onPointerDown={e=>e.stopPropagation()} onClick={e=>{e.stopPropagation();onMove(entry.id,1);}}>↓</button>
       </span>}
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
      {entry.kind==="task"&&<div className="lektrus-subject-board-fields">
        {definition.fields.filter(field=>entry.details?.[field.id]?.trim()).map(field=>
         <div className="lektrus-subject-board-field" key={field.id}>
          <span>{field.label}</span><p>{entry.details?.[field.id]}</p>
         </div>)}
        {Object.entries(entry.details??{}).filter(([key,value])=>value.trim()&&!definition.fields.some(field=>field.id===key))
         .map(([key,value])=><div className="lektrus-subject-board-field" key={key}>
           <span>{key==="given"?"Дано":key==="find"?"Найти":key==="material"?"Материал":"Дополнительные данные"}</span>
           <p>{value}</p>
         </div>)}
      </div>}
      {isSchoolSolutionSubject(tone)?<div className="lektrus-subject-board-solution-area">
        <LektrusSubjectBoardSolutionView tone={tone} value={entry.workedSolution} legacyAnswer={entry.answer}/>
        {onEditSolution&&<button type="button" className="lektrus-subject-board-add-solution"
         data-board-interactive="true" onPointerDown={e=>e.stopPropagation()}
         onClick={e=>{e.stopPropagation();onEditSolution(entry.id)}}>
         {hasWorkedSolution(entry.workedSolution)||entry.answer.trim()?"Изменить решение":"+ Добавить решение"}</button>}
        {!onEditSolution&&!hasWorkedSolution(entry.workedSolution)&&!entry.answer.trim()&&
         <span className="lektrus-subject-board-solution-hint">Решение пока не добавлено</span>}
      </div>:<div className="lektrus-subject-board-answer">
       <label htmlFor={"board-answer-"+entry.id}>{definition.answerLabel??"Ответ ученика"}</label>
       {onAnswerChange?<textarea id={"board-answer-"+entry.id} rows={2} value={entry.answer} maxLength={2000}
        placeholder="Введите свой ответ" data-board-interactive="true"
        onPointerDown={e=>e.stopPropagation()} onClick={e=>e.stopPropagation()} onDoubleClick={e=>e.stopPropagation()}
        onChange={e=>onAnswerChange(entry.id,e.target.value)}/>:
        <div className="lektrus-subject-board-answer-text">{entry.answer||"Место для ответа"}</div>}
      </div>}
      {entry.solution.trim()&&<>
       {entry.revealed?<div className="lektrus-subject-board-solution"><b>Образец ответа</b><span>{entry.solution}</span></div>:
        <div className="lektrus-subject-board-solution-hidden">Ответ преподавателя скрыт</div>}
       {onReveal&&<button type="button" className="lektrus-subject-board-reveal" data-board-interactive="true"
        onPointerDown={e=>e.stopPropagation()} onClick={e=>{e.stopPropagation();onReveal(entry.id);}}>
        {entry.revealed?"Скрыть образец":"Показать образец"}</button>}
      </>}
    </section>})}
   </div>
   <footer className="lektrus-subject-board-footer"><span>LEKTRUS · {palette.label.toLocaleUpperCase("ru-RU")}</span>
    <span>ЗАДАНИЯ / РЕШЕНИЯ</span></footer>
  </article>
 </div>;
}
type EditorProps={
 tone:SubjectTone;entry:SubjectBoardEntry;onChange:(entry:SubjectBoardEntry)=>void;
 onClose:()=>void;onDelete:()=>void;
};
/** One shared editor driven by the chosen school subject and the task's own fields. */
export function LektrusSubjectBoardTaskEditor({tone,entry,onChange,onClose,onDelete}:EditorProps){
 const palette=subjectAccentPalette[tone];
 const options=subjectTaskTemplates[tone];
 const current=taskTemplateFor(tone,entry.format);
 const patch=(fields:Partial<SubjectBoardEntry>)=>onChange({...entry,...fields});
 const style={"--subject-board-accent":palette.accent,"--subject-board-soft":palette.soft} as CSSProperties;
 return createPortal(<div className="lektrus-subject-task-overlay" onPointerDown={e=>{if(e.target===e.currentTarget)onClose();}}>
  <section className="lektrus-subject-task-editor" style={style} role="dialog" aria-modal="true" aria-label="Создание задания"
   onPointerDown={e=>e.stopPropagation()} onKeyDown={e=>{if(e.key==="Escape"){e.stopPropagation();onClose();}}}>
   <header><div><strong>Создание задания</strong><small>{palette.label} · {current.title}</small></div>
    <button type="button" aria-label="Закрыть" onClick={onClose}>×</button></header>
   <div className="lektrus-subject-task-body">
    {options.length>1&&<label className="lektrus-subject-task-kind">Тип задания
     <select value={options.some(opt=>opt.id===entry.format)?entry.format:"task"}
      onChange={e=>patch({format:e.target.value,details:{...freshTaskDetails(tone,e.target.value),...entry.details}})}>
      {options.map(template=><option value={template.id} key={template.id}>{template.title}</option>)}
     </select></label>}
    <label className="lektrus-subject-task-title">Название <small>Необязательно</small>
     <input value={entry.title} maxLength={120} placeholder="Краткое название задания"
      onChange={e=>patch({title:e.target.value})}/></label>
    <label className="lektrus-subject-task-prompt">{current.promptLabel}
     <textarea rows={3} maxLength={2500} value={entry.prompt}
      placeholder={current.promptPlaceholder} onChange={e=>patch({prompt:e.target.value})}/></label>
    {current.fields.length>0&&<div className="lektrus-subject-task-fields">
     {current.fields.map(field=><label key={field.id}>{field.label}
      {field.multiline?<textarea rows={2} maxLength={1800}
       value={entry.details?.[field.id]??""} placeholder={field.placeholder}
       onChange={e=>patch({details:{...entry.details,[field.id]:e.target.value}})}/>:
       <input maxLength={1800} value={entry.details?.[field.id]??""} placeholder={field.placeholder}
       onChange={e=>patch({details:{...entry.details,[field.id]:e.target.value}})}/>}
      </label>)}
    </div>}
    {Object.entries(entry.details??{}).some(([key,value])=>value.trim()&&!current.fields.some(field=>field.id===key))&&
     <details className="lektrus-subject-task-legacy">
      <summary>Дополнительные сведения прежнего задания</summary>
      {Object.entries(entry.details??{}).filter(([key,value])=>value.trim()&&!current.fields.some(field=>field.id===key))
       .map(([key,value])=><label key={key}>Сохранённое поле
         <textarea rows={2} maxLength={1800} value={value}
          onChange={e=>patch({details:{...entry.details,[key]:e.target.value}})}/>
       </label>)}
     </details>}
    <details className="lektrus-subject-task-teacher-answer">
      <summary>Ответ для проверки <span>необязательно, скрыт от учеников</span></summary>
      <label>Правильный ответ / образец
       <textarea rows={2} maxLength={2000} value={entry.solution}
        placeholder="Введите правильный ответ или краткие критерии проверки"
        onChange={e=>patch({solution:e.target.value})}/></label>
    </details>
   </div>
   <footer><button type="button" className="is-danger" onClick={onDelete}>Удалить задание</button>
    <button type="button" className="is-primary" onClick={onClose}>Готово</button></footer>
  </section>
 </div>,document.body);
}
