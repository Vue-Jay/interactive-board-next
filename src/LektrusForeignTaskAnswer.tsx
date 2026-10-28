import type {SubjectBoardEntry} from "./boardModel";

type ForeignFormat="translation"|"grammar"|"reading";
type Props={
 entry:SubjectBoardEntry;format:ForeignFormat;answer:string;
 onChange?:(value:string)=>void;
};
const stop=(e:React.SyntheticEvent)=>e.stopPropagation();
export const foreignTaskLines=(source:string,max=15)=>source.split(/\r?\n/)
 .map(text=>text.trim()).filter(Boolean).slice(0,max);
/** Store one answer per line in the existing task answer: no new permissions,
 * data migration or opaque JSON is needed for pupil and guest edits. */
export function foreignAnswerAt(source:string,index:number):string{
 return source.split("\n")[index]??"";
}
export function editForeignAnswer(source:string,index:number,value:string,total:number):string{
 const next=Array.from({length:total},(_,i)=>i===index?value.replace(/[\r\n]+/g," "):foreignAnswerAt(source,i));
 return next.join("\n").length<=2000?next.join("\n"):source;
}
export default function LektrusForeignTaskAnswer({entry,format,answer,onChange}:Props){
 const details=entry.details??{};
 const source=details.material?.trim()??"";
 const rows=format==="grammar"?foreignTaskLines(source,12):
  format==="reading"?foreignTaskLines(details.questions??"",15):[];
 const title=format==="translation"?"Переведите текст":format==="grammar"?"Преобразуйте предложения":"Ответьте по тексту";
 return <section className="lektrus-foreign-work" data-board-interactive="true"
  onPointerDown={stop} onClick={stop} onDoubleClick={stop} aria-label={title}>
  <div className="lektrus-foreign-work-head">
   <strong>{title}</strong>
   <small>{format==="translation"?("Направление: "+(details.direction?.trim()||"указано в условии")):
    format==="grammar"?"Каждое предложение преобразуйте отдельно":"Ответы записывайте под соответствующими вопросами"}</small>
  </div>
  {format==="translation"&&<>
   {source&&<div className="lektrus-foreign-work-source">{source}</div>}
   {onChange?<label className="lektrus-foreign-work-answer">
    Ваш перевод<textarea rows={4} maxLength={2000} value={answer}
     placeholder="Напишите перевод, сохранив смысл и грамматику"
     onChange={e=>onChange(e.target.value)}/>
   </label>:<div className="lektrus-foreign-work-source">{answer||"Перевод пока не записан."}</div>}
  </>}
  {format==="grammar"&&<>
   {details.instruction?.trim()&&<div className="lektrus-foreign-work-instruction">{details.instruction}</div>}
   {rows.length===0?<small>Преподаватель ещё не добавил предложения.</small>:
    rows.map((sentence,i)=><label className="lektrus-foreign-work-row" key={i}>
     <span className="lektrus-foreign-work-index">{i+1}</span>
     <div className="lektrus-foreign-work-row-body">
      <strong>{sentence}</strong>
      {onChange?<textarea rows={2} maxLength={220} aria-label={"Преобразованное предложение "+(i+1)}
       placeholder="Запишите изменённое предложение"
       value={foreignAnswerAt(answer,i)}
       onChange={e=>onChange(editForeignAnswer(answer,i,e.target.value,rows.length))}/>:
       <p>{foreignAnswerAt(answer,i)||"Ответ пока не записан"}</p>}
     </div>
    </label>)}
  </>}
  {format==="reading"&&<>
   {source&&<div className="lektrus-foreign-work-source">{source}</div>}
   {rows.length===0?<small>Преподаватель ещё не добавил вопросы к тексту.</small>:
    rows.map((question,i)=><label className="lektrus-foreign-work-row" key={i}>
     <span className="lektrus-foreign-work-index">{i+1}</span>
     <div className="lektrus-foreign-work-row-body">
      <strong>{question}</strong>
      {onChange?<textarea rows={2} maxLength={240} aria-label={"Ответ на вопрос "+(i+1)}
       placeholder="Ответьте своими словами на изучаемом языке"
       value={foreignAnswerAt(answer,i)}
       onChange={e=>onChange(editForeignAnswer(answer,i,e.target.value,rows.length))}/>:
       <p>{foreignAnswerAt(answer,i)||"Ответ пока не записан"}</p>}
     </div>
    </label>)}
  </>}
 </section>;
}
