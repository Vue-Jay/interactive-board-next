import {createPortal} from "react-dom";
import {useEffect,useRef,useState,type CSSProperties} from "react";
import type {Item,SubjectBoardEntry,SubjectTaskActivityResponse,RussianTaskWork} from "./boardModel";
import {LektrusChemicalEquationTypeset} from "./LektrusChemicalEquationEditor";
import {subjectAccentPalette,type SubjectTone} from "./lektrusSubjectAccent";
import {taskTemplateFor,subjectTaskTemplates,subjectTaskTypeKnown,freshTaskDetails,subjectBoardHasWork,isSchoolSolutionSubject,needsAutomaticWorkedSolution} from "./lektrusSubjectTaskTemplates";
import {LektrusSubjectBoardSolutionView,LektrusSubjectBoardInlineSolution,emptyWorkedSolution,hasWorkedSolution} from "./LektrusSubjectBoardSolution";
import {interactiveSubjects,preferredActivityMode,activityMatchesTask,isIntegratedInteractiveTask,interactiveModesForSubject,freshActivity,LektrusSubjectActivityBuilder,LektrusSubjectActivityRunner} from "./LektrusSubjectActivity";
import {nextSubjectBoardHeight} from "./lektrusSubjectBoardSizing";
import {LektrusLanguageTaskStudio} from "./LektrusLanguageTaskStudio";
import LektrusForeignTaskAnswer from "./LektrusForeignTaskAnswer";
import LektrusRussianTaskAnswer from "./LektrusRussianTaskAnswer";

export const subjectBoardId=(tone:SubjectTone)=>"subject-board-"+tone;
export const isSubjectBoard=(item:Item)=>item.kind==="graph"&&!!item.graphFigureId?.startsWith("subject-board-");
export const boardTone=(item:Item):SubjectTone=>{
 const tone=item.graphFigureId?.replace(/^subject-board-/,"") as SubjectTone;
 return tone in subjectAccentPalette?tone:"mathematics";
};
/** Existing untagged entries remain readable only when their format belongs to this subject.
 * Tagged entries are strictly bound to the subject where they were created. */
export const entryBelongsToSubject=(tone:SubjectTone,entry:SubjectBoardEntry):boolean=>{
 if(entry.subject&&entry.subject!==tone)return false;
 if(entry.kind==="equation")return tone==="chemistry";
 return subjectTaskTypeKnown(tone,entry.format);
};
export const subjectBoardLocked=(item:Item)=>item.subjectBoardEntries?.some(subjectBoardHasWork)===true;
export const newSubjectBoardEntry=(id:string,kind:"equation"|"task",tone:SubjectTone="chemistry"):SubjectBoardEntry=>{
 if(kind==="equation"&&tone!=="chemistry")throw new Error("Редактор химических уравнений доступен только на химической доске");
 const format=kind==="equation"?"equation":subjectTaskTemplates[tone][0].id;
 const mode=kind==="task"?preferredActivityMode(tone,format):null;
 return {id,kind,subject:tone,title:"",prompt:"",format,
  activity:mode?freshActivity(mode):undefined,
  details:kind==="task"?freshTaskDetails(tone,format):undefined,
  steps:kind==="equation"?[{expression:"",conditions:""}]:undefined,
  answer:"",solution:"",revealed:false};
};
export const subjectBoardEntryFilled=subjectBoardHasWork;

type BoardProps={
 item:Item;
 onRequestHeight?:(height:number)=>void;
 onAction?:(mode:"equation"|"task",entryId?:string)=>void;
 onAnswerChange?:(entryId:string,answer:string)=>void;
 onReveal?:(entryId:string)=>void;
 onMove?:(entryId:string,direction:-1|1)=>void;
 onEditSolution?:(entryId:string)=>void;
 onWorkedSolutionChange?:(entryId:string,solution:import("./boardModel").SubjectBoardWorkedSolution)=>void;
 onActivityAnswer?:(entryId:string,response:SubjectTaskActivityResponse)=>void;
 onRussianWorkChange?:(entryId:string,work:RussianTaskWork)=>void;
};
export function LektrusSubjectBoardView({item,onAction,onAnswerChange,onReveal,onMove,onEditSolution,onWorkedSolutionChange,onActivityAnswer,onRussianWorkChange,onRequestHeight}:BoardProps){
 const tone=boardTone(item),palette=subjectAccentPalette[tone];
 const allEntries=item.subjectBoardEntries??[];
 const entries=allEntries.filter(entry=>entryBelongsToSubject(tone,entry));
 const incompatibleCount=allEntries.length-entries.length;
 const sheetRef=useRef<HTMLDivElement>(null);
 const contentRef=useRef<HTMLDivElement>(null);
 const headerRef=useRef<HTMLElement>(null);
 const footerRef=useRef<HTMLElement>(null);
 const heightCallbackRef=useRef(onRequestHeight);
 const heightRef=useRef(item.height);
 const lastRequestedRef=useRef(0);
 heightCallbackRef.current=onRequestHeight;
 if(item.height<heightRef.current&&item.height!==lastRequestedRef.current){
   // Manual resizing is allowed, but content must still fit comfortably.
   lastRequestedRef.current=0;
 }
 heightRef.current=item.height;
 const countRef=useRef(entries.length);
 useEffect(()=>{
   const content=contentRef.current;
   if(!content)return;
   const measure=()=>{
     if(!heightCallbackRef.current)return;
     // Measure the intrinsic content, never the height of the scroll viewport.
     // Observing the latter would create an endless resize feedback loop.
     const used=content.scrollHeight+(headerRef.current?.offsetHeight??44)+
       (footerRef.current?.offsetHeight??24);
     const current=heightRef.current;
     const next=nextSubjectBoardHeight(current,used);
     if(next==null||lastRequestedRef.current>current)return;
     lastRequestedRef.current=next;
     heightCallbackRef.current(next);
   };
   const resizeObserver=typeof ResizeObserver!=="undefined"?new ResizeObserver(measure):null;
   resizeObserver?.observe(content);
   if(headerRef.current)resizeObserver?.observe(headerRef.current);
   if(footerRef.current)resizeObserver?.observe(footerRef.current);
   measure();
   return ()=>resizeObserver?.disconnect();
 },[]);
 useEffect(()=>{
   const previous=countRef.current;
   countRef.current=entries.length;
   if(entries.length>previous)sheetRef.current?.scrollTo({top:sheetRef.current.scrollHeight,behavior:"smooth"});
 },[entries.length]);
 const chemistry=tone==="chemistry";
 const style={"--subject-board-accent":palette.accent,"--subject-board-soft":palette.soft} as CSSProperties;
 return <div className="graph-view lektrus-subject-board-shell" data-worksheet-subject={tone}>
  <article className={"lektrus-subject-board"+(item.subjectBoardStandalone?" is-standalone-chemistry":chemistry?" is-chemistry-board":"")} style={style} aria-label={item.subjectBoardStandalone?palette.label+" · отдельное задание":chemistry?"Химическая доска":palette.label+" · учебная доска"}>
   <header className="lektrus-subject-board-header" ref={headerRef}>
    <span className="lektrus-subject-board-emblem" aria-hidden="true">{chemistry?"⚗":"▤"}</span>
    <strong>{chemistry&&!item.subjectBoardStandalone?"ХИМИЧЕСКАЯ ДОСКА":palette.label} {(!chemistry||item.subjectBoardStandalone)&&<span>· {item.subjectBoardStandalone?"отдельное задание":"учебная доска"}</span>}</strong>
    {onAction&&!item.subjectBoardStandalone&&<nav className="lektrus-subject-board-tools" aria-label="Инструменты предметной доски">
     {chemistry&&<button type="button" data-board-interactive="true"
       onPointerDown={e=>e.stopPropagation()} onClick={e=>{e.stopPropagation();onAction("equation")}}>
       Уравнения</button>}
     <button type="button" data-board-interactive="true" onPointerDown={e=>e.stopPropagation()}
       onClick={e=>{e.stopPropagation();onAction("task")}}>Создать задание</button>
    </nav>}
    <small>{incompatibleCount?"Есть задания другого предмета":subjectBoardLocked(item)?"Закреплена":entries.length?entries.length+" записей":chemistry?"Готова к работе":"Чистый лист"}</small>
   </header>
   <div className="lektrus-subject-board-sheet" ref={sheetRef}>
    <div className="lektrus-subject-board-content" ref={contentRef}>
    {entries.length===0&&<div className="lektrus-subject-board-empty">
      <strong>{chemistry?"Химическая доска":"Задания и решения"}</strong>
      <span>{chemistry?"Уравнения, цепочки и химические задачи":"Выберите вид задания и заполните поля"}</span>
      <span className="lektrus-subject-board-empty-note">{chemistry?"Составляйте уравнения и выполняйте химические задания прямо здесь.":"Предмет закрепится после первой записи."}</span>
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
        {definition.fields.filter(field=>entry.details?.[field.id]?.trim()&&
         !(tone==="russian"&&
          (["morphemes","syntax","morphology"].includes(entry.format??"")&&field.id==="material"||
           entry.format==="morphology"&&field.id==="target"))&&
         !(tone==="languages"&&["translation","grammar","reading"].includes(entry.format??""))).map(field=>
         <div className="lektrus-subject-board-field" key={field.id}>
          <span>{field.label}</span><p>{entry.details?.[field.id]}</p>
         </div>)}
        {Object.entries(entry.details??{}).filter(([key,value])=>key!=="markup"&&value.trim()&&!definition.fields.some(field=>field.id===key)&&
          !(needsAutomaticWorkedSolution(tone,entry.format)&&(key==="given"||key==="find")))
         .map(([key,value])=><div className="lektrus-subject-board-field" key={key}>
           <span>{key==="given"?"Дано":key==="find"?"Найти":key==="material"?"Материал":"Дополнительные данные"}</span>
           <p>{value}</p>
         </div>)}
        {needsAutomaticWorkedSolution(tone,entry.format)&&
         (entry.details?.given?.trim()||entry.details?.find?.trim())&&
         <details className="lektrus-school-solution-old-hints" data-board-interactive="true"
          onPointerDown={event=>event.stopPropagation()}>
          <summary>Сведения из старого условия</summary>
          {entry.details?.given?.trim()&&<p>{entry.details?.given}</p>}
          {entry.details?.find?.trim()&&<p>{entry.details?.find}</p>}
         </details>}
      </div>}
      {entry.kind==="task"&&activityMatchesTask(tone,entry.format,entry.activity)&&
       <LektrusSubjectActivityRunner activity={entry.activity!} response={entry.activityResponse}
        punctuation={tone==="russian"&&entry.format==="punctuation"}
        onChange={onActivityAnswer?(response)=>onActivityAnswer(entry.id,response):undefined}/>}
      {tone==="languages"&&["translation","grammar","reading"].includes(entry.format??"")&&
       <LektrusForeignTaskAnswer entry={entry} format={entry.format as "translation"|"grammar"|"reading"}
        answer={entry.answer} onChange={onAnswerChange?answer=>onAnswerChange(entry.id,answer):undefined}/>}
      {tone==="russian"&&["morphemes","syntax","morphology","text"].includes(entry.format??"")&&
       <LektrusRussianTaskAnswer entry={entry} work={entry.russianWork}
        onChange={onRussianWorkChange?work=>onRussianWorkChange(entry.id,work):undefined}/>}
      {tone==="russian"&&["orthography","punctuation"].includes(entry.format??"")&&!entry.activity&&
       <div className="lektrus-rus-answer-help">Добавьте пропуски в редакторе задания.</div>}
      {needsAutomaticWorkedSolution(tone,entry.format)&&entry.kind==="task"?
        <div className="lektrus-subject-board-solution-area">
          <LektrusSubjectBoardInlineSolution tone={tone} value={entry.workedSolution}
           onChange={onWorkedSolutionChange?solution=>onWorkedSolutionChange(entry.id,solution):undefined}/>
        </div>:isSchoolSolutionSubject(tone)&&!activityMatchesTask(tone,entry.format,entry.activity)&&
        !(tone==="physics"&&entry.format==="lab")&&
        !(tone==="chemistry"&&["experiment","chain"].includes(entry.format??""))&&
        !(tone==="chemistry"&&entry.kind==="equation")?<div className="lektrus-subject-board-solution-area">
        <LektrusSubjectBoardSolutionView tone={tone} value={entry.workedSolution} legacyAnswer={entry.answer}/>
        {onEditSolution&&<button type="button" className="lektrus-subject-board-add-solution"
         data-board-interactive="true" onPointerDown={e=>e.stopPropagation()}
         onClick={e=>{e.stopPropagation();onEditSolution(entry.id)}}>
         {hasWorkedSolution(entry.workedSolution)||entry.answer.trim()?"Изменить решение":"+ Добавить решение"}</button>}
        {!onEditSolution&&!hasWorkedSolution(entry.workedSolution)&&!entry.answer.trim()&&
         <span className="lektrus-subject-board-solution-hint">Решение пока не добавлено</span>}
      </div>:(activityMatchesTask(tone,entry.format,entry.activity)||
       tone==="russian"&&["morphemes","syntax","morphology","text","orthography","punctuation"].includes(entry.format??"")||
       tone==="languages"&&["translation","grammar","reading"].includes(entry.format??""))?null:
       <div className="lektrus-subject-board-answer">
       <label htmlFor={"board-answer-"+entry.id}>{tone==="physics"&&entry.format==="lab"?"Результаты измерений и вывод":
          tone==="chemistry"&&entry.format==="experiment"?"Наблюдения и вывод":
          tone==="chemistry"&&(entry.format==="chain"||entry.kind==="equation")?"Уравнения и пояснения":
          definition.answerLabel??"Ответ ученика"}</label>
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
   </div>
   <footer className="lektrus-subject-board-footer" ref={footerRef}><span>LEKTRUS · {palette.label.toLocaleUpperCase("ru-RU")}</span>
    <span>ЗАДАНИЯ / РЕШЕНИЯ</span></footer>
  </article>
 </div>;
}
/** Preview uses the real worksheet renderer but keeps every trial response local.
 * Nothing entered here is committed to the shared pupil board. */
function LektrusTaskPreview({tone,entry}:{tone:SubjectTone;entry:SubjectBoardEntry}){
 const [answer,setAnswer]=useState("");
 const [response,setResponse]=useState<SubjectTaskActivityResponse>({});
 const [russianWork,setRussianWork]=useState<RussianTaskWork>({});
 const [solution,setSolution]=useState<import("./boardModel").SubjectBoardWorkedSolution>(emptyWorkedSolution());
 const sheet:Item={
  id:"task-preview-sheet",kind:"graph",text:"Предпросмотр",x:0,y:0,
  width:820,height:470,graphFigureId:"subject-board-"+tone,
  graphPurpose:"geometry",graphAxisMode:"none",graphGrid:false,graphSnap:false,
  graphPoints:[],graphSegments:[],
  subjectBoardEntries:[{...entry,answer,activityResponse:response,russianWork,workedSolution:solution}]
 };
 return <section className="lektrus-task-preview" aria-label="Предпросмотр задания">
  <div className="lektrus-task-preview-heading">
   <strong>На доске ученика</strong><small>Пробные ответы не сохраняются</small>
  </div>
  <div className="lektrus-task-preview-board">
   <LektrusSubjectBoardView item={sheet} onAnswerChange={(_,value)=>setAnswer(value)}
    onActivityAnswer={(_,value)=>setResponse(value)}
    onRussianWorkChange={(_,value)=>setRussianWork(value)}
    onWorkedSolutionChange={(_,value)=>setSolution(value)}/>
  </div>
 </section>;
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
 const [previewResponse,setPreviewResponse]=useState<SubjectTaskActivityResponse>({});
 const interactive=interactiveSubjects(tone);
 const mode=preferredActivityMode(tone,current.id);
 const activeActivity=mode?(activityMatchesTask(tone,current.id,entry.activity)?entry.activity!:freshActivity(mode)):undefined;
 const integrated=isIntegratedInteractiveTask(tone,current.id);
 const activityModeLabels={choice:"Выбор ответа",fill:"Пропуски",match:"Соответствия",order:"Последовательность"} as const;
 const patch=(fields:Partial<SubjectBoardEntry>)=>onChange({...entry,...fields});
 const chooseType=(format:string)=>{
   if(!subjectTaskTemplates[tone].some(template=>template.id===format))return;
   const nextMode=preferredActivityMode(tone,format);
   patch({format,subject:tone,activity:nextMode?freshActivity(nextMode):undefined,
    activityResponse:undefined,details:freshTaskDetails(tone,format),
    workedSolution:needsAutomaticWorkedSolution(tone,format)?
     (entry.workedSolution??emptyWorkedSolution()):entry.workedSolution});
   setPreviewResponse({});
 };
 const style={"--subject-board-accent":palette.accent,"--subject-board-soft":palette.soft} as CSSProperties;
 return createPortal(<div className="lektrus-subject-task-overlay" onPointerDown={e=>{if(e.target===e.currentTarget)onClose();}}>
  <section className="lektrus-subject-task-editor" style={style} role="dialog" aria-modal="true" aria-label="Создание задания"
   onPointerDown={e=>e.stopPropagation()} onKeyDown={e=>{if(e.key==="Escape"){e.stopPropagation();onClose();}}}>
   <header><div><strong>Создание задания</strong><small>{palette.label} · {current.title} · <span className="lektrus-task-target-hint">На предметную доску</span></small></div>
    <button type="button" aria-label="Закрыть" onClick={onClose}>×</button></header>
   <div className="lektrus-subject-task-body">
    {options.length>1&&<div className="lektrus-subject-task-type">
      <strong>Вид задания</strong>
      <div className="lektrus-subject-task-types" role="group" aria-label="Тип задания">
       {options.map(template=><button type="button" key={template.id}
        className={current.id===template.id?"selected":""} aria-pressed={current.id===template.id}
        title={template.instruction} onClick={()=>chooseType(template.id)}>
        {template.title}</button>)}
      </div>
      {tone!=="russian"&&tone!=="languages"&&<small>{current.instruction}</small>}
      {!options.some(option=>option.id===current.id)&&
       <small>Это сохранённый тип прежней версии. Его содержимое останется доступным.</small>}
     </div>}
    <label className="lektrus-subject-task-title"><span>Название <small>необязательно</small></span>
     <input value={entry.title} maxLength={120} placeholder="Краткое название задания"
      onChange={e=>patch({title:e.target.value})}/></label>
    {(tone==="russian"||tone==="languages")?
      <LektrusLanguageTaskStudio tone={tone} entry={entry} template={current} onChange={onChange}/>:
      <>{/* Other subjects retain their specialised school task editors. */}
    <label className="lektrus-subject-task-prompt">{current.promptLabel}
     <textarea rows={3} maxLength={2500} value={entry.prompt}
      placeholder={current.promptPlaceholder} onChange={e=>patch({prompt:e.target.value})}/></label>
    {integrated&&activeActivity&&<div className="lektrus-subject-task-type lektrus-activity-modes">
       <strong>Как ученик будет выполнять задание</strong>
       <div className="lektrus-subject-task-types" role="group" aria-label="Способ выполнения">
        {interactiveModesForSubject(tone).map(activityMode=><button type="button" key={activityMode}
         className={activeActivity.mode===activityMode?"selected":""}
         aria-pressed={activeActivity.mode===activityMode}
         onClick={()=>{patch({activity:freshActivity(activityMode),activityResponse:undefined});setPreviewResponse({});}}>
         {activityModeLabels[activityMode]}</button>)}
       </div>
     </div>}
    {interactive&&activeActivity&&<div className="lektrus-activity-author-workspace">
      <LektrusSubjectActivityBuilder tone={tone} format={current.id} activity={activeActivity}
       onChange={activity=>{patch({activity,activityResponse:undefined});setPreviewResponse({});}}/>
      <section className="lektrus-activity-preview-section" aria-label="Предпросмотр задания">
       <div className="lektrus-activity-preview-heading">
        <strong>Как это увидит ученик</strong><span>Проверьте задание в действии</span>
       </div>
       <LektrusSubjectActivityRunner key={current.id+activeActivity.mode}
        activity={activeActivity} response={previewResponse} onChange={setPreviewResponse} compact/>
      </section>
     </div>}
    {current.fields.length>0&&(activeActivity?
     <details className="lektrus-activity-context-details">
       <summary>Дополнительные данные и условия <span>необязательно</span></summary>
       <div className="lektrus-subject-task-fields">
        {current.fields.map(field=><label key={field.id}>{field.label}
         {field.multiline?<textarea rows={2} maxLength={1800} value={entry.details?.[field.id]??""}
          placeholder={field.placeholder} onChange={e=>patch({details:{...entry.details,[field.id]:e.target.value}})}/>:
          <input maxLength={1800} value={entry.details?.[field.id]??""} placeholder={field.placeholder}
           onChange={e=>patch({details:{...entry.details,[field.id]:e.target.value}})}/>}</label>)}
       </div>
      </details>:<div className="lektrus-subject-task-fields">
     {current.fields.map(field=><label key={field.id}>{field.label}
      {field.multiline?<textarea rows={2} maxLength={1800}
       value={entry.details?.[field.id]??""} placeholder={field.placeholder}
       onChange={e=>patch({details:{...entry.details,[field.id]:e.target.value}})}/>:
       <input maxLength={1800} value={entry.details?.[field.id]??""} placeholder={field.placeholder}
       onChange={e=>patch({details:{...entry.details,[field.id]:e.target.value}})}/>}
      </label>)}
    </div>)}
      </>}
    {Object.entries(entry.details??{}).some(([key,value])=>key!=="markup"&&value.trim()&&!current.fields.some(field=>field.id===key))&&
     <details className="lektrus-subject-task-legacy">
      <summary>Дополнительные сведения прежнего задания</summary>
      {Object.entries(entry.details??{}).filter(([key,value])=>key!=="markup"&&value.trim()&&!current.fields.some(field=>field.id===key))
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
    {tone!=="russian"&&tone!=="languages"&&
     <LektrusTaskPreview key={tone+":"+current.id} tone={tone} entry={entry}/>}
   </div>
   <footer><button type="button" className="is-danger" onClick={onDelete}>Удалить задание</button>
    <button type="button" className="is-primary" onClick={onClose}>Готово</button></footer>
  </section>
 </div>,document.body);
}
