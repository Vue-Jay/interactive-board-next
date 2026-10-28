import {useState,type SyntheticEvent} from "react";
import type {SubjectTaskActivity,SubjectTaskActivityResponse} from "./boardModel";
import type {SubjectTone} from "./lektrusSubjectAccent";

export const interactiveSubjects=(tone:SubjectTone)=>tone==="mathematics"||tone==="russian"||tone==="languages";
/** One exercise studio instead of four nearly identical task types. */
export const interactiveModesForSubject=(tone:SubjectTone):readonly SubjectTaskActivity["mode"][]=>
 tone==="russian"?["choice","match","order"]:["choice","fill","match","order"];
export const isIntegratedInteractiveTask=(tone:SubjectTone,format:string|undefined)=>
 (tone==="russian"||tone==="mathematics")&&format==="interactive";
/**
 * Each subject chooses its own interaction, not a global guess based on labels.
 * null means a written task with a normal answer/solution, not an empty quiz.
 */
export function preferredActivityMode(tone:SubjectTone,format:string):SubjectTaskActivity["mode"]|null{
 switch(tone){
  case "mathematics":
   if(format==="interactive")return "choice";
   if(format==="choice")return "choice";
   if(format==="cloze")return "fill";
   if(format==="matching")return "match";
   if(format==="sequence")return "order";
   return null; // Equations, geometry, functions and word problems need worked solutions
  case "russian":
   if(format==="interactive")return "choice";
   if(format==="orthography"||format==="punctuation"||format==="cloze")return "fill";
   if(format==="matching")return "match";
   if(format==="sequence")return "order";
   if(format==="choice")return "choice";
   return null; // Morphemic, morphological and syntactic analyses are written work
  case "languages":
   if(format==="gaps"||format==="cloze")return "fill";
   if(format==="vocabulary"||format==="matching")return "match";
   if(format==="word-order"||format==="sequence")return "order";
   if(format==="choice")return "choice";
   return null; // Translation, reading and transformations need an open answer
  default:return null;
 }
}
export const activityMatchesTask=(tone:SubjectTone,format:string|undefined,activity?:SubjectTaskActivity):boolean=>
 !!activity&&(isIntegratedInteractiveTask(tone,format)?
 interactiveModesForSubject(tone).includes(activity.mode):
 preferredActivityMode(tone,format??"task")===activity.mode);
export function freshActivity(mode:SubjectTaskActivity["mode"]):SubjectTaskActivity{
 if(mode==="choice")return {mode,options:["","",""],correctIndex:0};
 if(mode==="fill")return {mode,blanks:[{before:"",answer:""}],tail:""};
 if(mode==="match")return {mode,pairs:[{left:"",right:""},{left:"",right:""},{left:"",right:""}]};
 return {mode,tokens:["","",""]};
}
const words=(value:string)=>{
 const normalized=value.trim().replace(/\s+/g," ").toLocaleLowerCase("ru-RU");
 // A missing comma or full stop IS the answer in punctuation exercises.
 // Strip trailing sentence punctuation only when checking a word or number.
 return /[\p{L}\p{N}]/u.test(normalized)?
  normalized.replace(/[.,!?;:]+$/g,""):normalized;
};
export function activityComplete(a:SubjectTaskActivity|undefined):boolean{
 if(!a)return false;
 if(a.mode==="choice")return (a.options?.filter(x=>x.trim()).length??0)>=2&&
   !!a.options?.[a.correctIndex??0]?.trim();
 if(a.mode==="fill")return !!a.blanks?.length&&a.blanks.every(x=>x.answer.trim()&&
   (!x.choices||(x.choices.length===2&&x.choices[0]===x.answer&&!!x.choices[1].trim()&&
    x.choices[1].trim().toLocaleLowerCase("ru-RU")!==x.answer.trim().toLocaleLowerCase("ru-RU"))))&&
   (!!a.blanks.some(x=>x.before.trim())||!!a.tail?.trim());
 if(a.mode==="match")return (a.pairs?.length??0)>=2&&!!a.pairs?.every(x=>x.left.trim()&&x.right.trim());
 return (a.tokens?.length??0)>=2&&!!a.tokens?.every(x=>x.trim());
}
export function activityScore(activity:SubjectTaskActivity,response:SubjectTaskActivityResponse):{correct:number;total:number}{
 if(activity.mode==="choice")return {correct:response.selected===activity.correctIndex?1:0,total:1};
 if(activity.mode==="fill"){const blanks=activity.blanks??[];
  return {correct:blanks.filter((b,i)=>words(response.values?.[i]??"")===words(b.answer)).length,total:blanks.length};
 }
 if(activity.mode==="match"){const pairs=activity.pairs??[];
  return {correct:pairs.filter((_,i)=>response.matched?.[i]===i).length,total:pairs.length};
 }
 const tokens=activity.tokens??[];
 return {correct:tokens.filter((value,i)=>tokens[response.ordered?.[i]??-1]===value).length,total:tokens.length};
}
/** A stable exercise-specific shuffle. It avoids random shifts on re-render and
 * never exposes the source sequence in its original order. */
export function mixedIndices(length:number,seed=""):number[]{
 const positions=Array.from({length},(_,i)=>i);
 let state=2166136261;
 for(const ch of seed){state=Math.imul(state^ch.charCodeAt(0),16777619)>>>0;}
 for(let i=positions.length-1;i>0;i--){
  state=(Math.imul(state,1664525)+1013904223)>>>0;
  const j=state%(i+1);
  [positions[i],positions[j]]=[positions[j],positions[i]];
 }
 if(length>1&&positions.every((position,i)=>position===i))positions.reverse();
 return positions;
}
type EditorProps={tone:SubjectTone;format:string;activity:SubjectTaskActivity;onChange:(value:SubjectTaskActivity)=>void};
export function LektrusSubjectActivityBuilder({activity,onChange}:EditorProps){
 const [quickSource,setQuickSource]=useState("");
 const [quickHint,setQuickHint]=useState("");
 const patch=(v:Partial<SubjectTaskActivity>)=>onChange({...activity,...v});
 const title=activity.mode==="choice"?"Варианты ответа":
  activity.mode==="fill"?"Текст с пропусками":activity.mode==="match"?"Пары для сопоставления":"Последовательность";
 const help=activity.mode==="choice"?"Отметьте верный ответ.":
  activity.mode==="fill"?"Укажите текст и ответы к пропускам.":
  activity.mode==="match"?"Соедините элементы в правильные пары.":
  "Укажите исходный порядок элементов.";
 return <section className="lektrus-activity-builder" aria-label={"Конструктор: "+title}>
  <div className="lektrus-activity-builder-heading"><span className="lektrus-activity-builder-symbol" aria-hidden="true">
   {activity.mode==="choice"?"◉":activity.mode==="fill"?"▢":activity.mode==="match"?"⇄":"⇢"}</span>
   <div><strong>{title}</strong><small>{help}</small></div></div>
  {activity.mode==="choice"&&<>
   <div className="lektrus-activity-choice-editor">
    {(activity.options??[]).map((value,i)=><div className="lektrus-activity-choice-row" key={i}>
     <button type="button" className={(activity.correctIndex??0)===i?"correct":""}
      aria-pressed={activity.correctIndex===i} title="Отметить правильный ответ"
      onClick={()=>patch({correctIndex:i})}>{(activity.correctIndex??0)===i?"✓":"○"}</button>
     <input value={value} maxLength={240} aria-label={"Вариант "+(i+1)}
      placeholder={"Текст варианта "+(i+1)} onChange={e=>patch({options:activity.options?.map((v,j)=>j===i?e.target.value:v)})}/>
     {(activity.options?.length??0)>2&&<button className="remove" type="button" aria-label="Удалить вариант"
       onClick={()=>patch({options:activity.options?.filter((_,j)=>j!==i),
         correctIndex:(activity.correctIndex??0)===i?0:Math.max(0,(activity.correctIndex??0)-(i<(activity.correctIndex??0)?1:0))})}>×</button>}
    </div>)}
   </div>
   {(activity.options?.length??0)<8&&<button type="button" className="lektrus-activity-add" onClick={()=>patch({options:[...(activity.options??[]),""]})}>+ Добавить вариант</button>}
  </>}
  {activity.mode==="fill"&&<div className="lektrus-activity-fill-editor">
   {(activity.blanks??[]).map((blank,i)=><div className="lektrus-activity-fill-row" key={i}>
    <div className="lektrus-activity-fill-row-head"><span>Пропуск {i+1}</span>
     {(activity.blanks?.length??0)>1&&<button type="button" aria-label="Удалить пропуск" onClick={()=>
       patch({blanks:activity.blanks?.filter((_,j)=>j!==i)})}>Удалить</button>}</div>
    <div className="lektrus-activity-fill-grid">
     <label>Текст перед пропуском<textarea rows={2} maxLength={1200} value={blank.before}
      placeholder="Текст перед пропуском" onChange={e=>patch({blanks:activity.blanks?.map((v,j)=>j===i?{...v,before:e.target.value}:v)})}/></label>
     <label>Ответ<input value={blank.answer} maxLength={240}
      placeholder="Что ученик должен вписать" onChange={e=>patch({blanks:activity.blanks?.map((v,j)=>j===i?{...v,answer:e.target.value}:v)})}/></label>
    </div>
   </div>)}
   <label className="lektrus-activity-fill-ending">Текст после последнего пропуска
    <textarea rows={2} maxLength={1200} value={activity.tail??""} placeholder="Продолжение предложения или выражения"
     onChange={e=>patch({tail:e.target.value})}/></label>
   {(activity.blanks?.length??0)<8&&<button type="button" className="lektrus-activity-add"
     onClick={()=>patch({blanks:[...(activity.blanks??[]),{before:"",answer:""}]})}>+ Добавить пропуск</button>}
  </div>}
  {(activity.mode==="match"||activity.mode==="order")&&<details className="lektrus-activity-quick-import">
    <summary>{activity.mode==="match"?"Вставить список пар":"Разделить предложение на слова"}</summary>
    <small>{activity.mode==="match"?
     "Пары по строкам: слово — перевод (или =, Tab).":
     "Вставьте предложение, чтобы разбить его на слова."}</small>
    <textarea rows={activity.mode==="match"?4:2} maxLength={1800} value={quickSource}
     placeholder={activity.mode==="match"?"house — дом\nwindow — окно":"She is reading a book."}
     onChange={e=>{setQuickSource(e.target.value);setQuickHint("");}}/>
    <button type="button" onClick={()=>{
     if(activity.mode==="match"){
      const pairs=quickSource.split(/\r?\n/).map(line=>line.split(/\s+(?:—|→|=)\s+|\t|;/).map(piece=>piece.trim()));
      if(pairs.length<2||pairs.length>8||pairs.some(pair=>pair.length!==2||!pair[0]||!pair[1])){
       setQuickHint("Введите от 2 до 8 строк. В каждой строке разделите пару знаком —, = или табуляцией.");return;
      }
      patch({pairs:pairs.map(([left,right])=>({left,right}))});
      setQuickHint("Пары добавлены. Проверьте соответствия ниже.");
     }else{
      const tokens=quickSource.trim().split(/\s+/).filter(Boolean);
      if(tokens.length<2||tokens.length>12){setQuickHint("Для упражнения нужно от 2 до 12 слов.");return;}
      patch({tokens});setQuickHint("Слова добавлены в правильном порядке. На доске они перемешаются.");
     }
    }}>{activity.mode==="match"?"Заполнить пары":"Разделить на слова"}</button>
    {quickHint&&<small role="status">{quickHint}</small>}
   </details>}
  {activity.mode==="match"&&<div className="lektrus-activity-pairs-editor">
   {(activity.pairs??[]).map((pair,i)=><div className="lektrus-activity-pair-row" key={i}>
    <span className="lektrus-activity-index">{i+1}</span>
    <input value={pair.left} maxLength={240} aria-label={"Левый элемент пары "+(i+1)} placeholder="Первый элемент"
     onChange={e=>patch({pairs:activity.pairs?.map((v,j)=>j===i?{...v,left:e.target.value}:v)})}/>
    <span aria-hidden="true">⇄</span>
    <input value={pair.right} maxLength={240} aria-label={"Правый элемент пары "+(i+1)} placeholder="Соответствующий элемент"
     onChange={e=>patch({pairs:activity.pairs?.map((v,j)=>j===i?{...v,right:e.target.value}:v)})}/>
    {(activity.pairs?.length??0)>2&&<button type="button" className="remove" aria-label="Удалить пару"
      onClick={()=>patch({pairs:activity.pairs?.filter((_,j)=>j!==i)})}>×</button>}
   </div>)}
   {(activity.pairs?.length??0)<8&&<button type="button" className="lektrus-activity-add"
    onClick={()=>patch({pairs:[...(activity.pairs??[]),{left:"",right:""}]})}>+ Добавить пару</button>}
  </div>}
  {activity.mode==="order"&&<div className="lektrus-activity-order-editor">
    {(activity.tokens??[]).map((token,i)=><div className="lektrus-activity-order-row" key={i}>
     <span className="lektrus-activity-index">{i+1}</span>
     <input value={token} aria-label={"Элемент "+(i+1)} maxLength={240} placeholder="Слово, действие или шаг решения"
      onChange={e=>patch({tokens:activity.tokens?.map((v,j)=>j===i?e.target.value:v)})}/>
     {(activity.tokens?.length??0)>2&&<button type="button" className="remove" aria-label="Удалить элемент"
      onClick={()=>patch({tokens:activity.tokens?.filter((_,j)=>j!==i)})}>×</button>}
    </div>)}
    {(activity.tokens?.length??0)<12&&<button type="button" className="lektrus-activity-add"
     onClick={()=>patch({tokens:[...(activity.tokens??[]),""]})}>+ Добавить элемент</button>}
   </div>}
 </section>;
}
type RunnerProps={
 activity:SubjectTaskActivity;
 response?:SubjectTaskActivityResponse;
 onChange?:(response:SubjectTaskActivityResponse)=>void;
 compact?:boolean;
 punctuation?:boolean;
};
export function LektrusSubjectActivityRunner({activity,response,onChange,compact=false,punctuation=false}:RunnerProps){
 const [activeLeft,setActiveLeft]=useState<number|null>(null);
 const data=response??{};
 const patch=(values:Partial<SubjectTaskActivityResponse>)=>onChange?.({...data,...values,checked:false});
 const complete=activityComplete(activity);
 const result=data.checked&&complete?activityScore(activity,data):null;
 const order=activity.mode==="match"?mixedIndices(activity.pairs?.length??0,
  (activity.pairs??[]).map(pair=>pair.left+"|"+pair.right).join(";")):[];
 const tokens=activity.tokens??[];
 const selections=data.ordered??[];
 const choose=(index:number)=>{
  if(selections.includes(index))return;
  patch({ordered:[...selections,index]});
 };
 const check=()=>{
  if(!onChange||!complete)return;
  onChange({...data,checked:true});
 };
 const stop=(e:SyntheticEvent)=>e.stopPropagation();
 const updateGap=(index:number,value:string)=>{
  patch({values:(activity.blanks??[]).map((_,j)=>j===index?value:data.values?.[j]??"")});
 };
 return <div className={"lektrus-activity-runner"+(compact?" compact":"")}
  data-board-interactive="true" onPointerDown={stop} onClick={stop}
  aria-label="Интерактивное упражнение">
  {!complete&&<div className="lektrus-activity-unfinished">Добавьте содержание и ответы в конструкторе, чтобы задание стало интерактивным.</div>}
  {activity.mode==="choice"&&<div className="lektrus-activity-choice-options" role="group" aria-label="Выберите ответ">
   {(activity.options??[]).map((option,i)=><button key={i} type="button" disabled={!onChange||!option.trim()}
    className={(data.selected===i?"chosen ":"")+(result&&i===data.selected?(result.correct===result.total?"right":"wrong"):"")}
    aria-pressed={data.selected===i} onClick={()=>patch({selected:i})}>
    <span>{String.fromCharCode(1040+i)}</span><b>{option||"Вариант "+(i+1)}</b>
   </button>)}
  </div>}
  {activity.mode==="fill"&&<div className="lektrus-activity-gap-content">
   {(activity.blanks??[]).map((blank,i)=>{
    const hasChoice=!!blank.choices&&blank.choices[0]===blank.answer&&!!blank.choices[1]?.trim()&&
     blank.choices[1].trim().toLocaleLowerCase("ru-RU")!==blank.answer.trim().toLocaleLowerCase("ru-RU");
    const variants=hasChoice?(i%2===0?[blank.choices![1],blank.choices![0]]:blank.choices!):[];
    const selected=data.values?.[i]??"";
    return <span className="lektrus-activity-gap-part" key={i}>
     <span>{blank.before}</span>
     <span className={"lektrus-activity-gap-slot"+(hasChoice?" has-choices":"")}>
      {punctuation?<select className="lektrus-activity-punctuation-select" value={selected}
       aria-label={"Знак в контрольном месте "+(i+1)} disabled={!onChange}
       onChange={e=>updateGap(i,e.target.value)}>
       <option value="">▱</option>
       <option value="∅">нет знака</option>
       {[",",";",":","—",".","?","!","«","»","(",")"].map(sign=>
        <option key={sign} value={sign}>{sign}</option>)}
       {selected&&!["∅",",",";",":","—",".","?","!","«","»","(",")"].includes(selected)&&
        <option value={selected}>{selected}</option>}
      </select>:hasChoice?<span className={"lektrus-activity-gap-selected"+(selected?" filled":"")}
       role="status" aria-label={"Ответ в пропуске "+(i+1)}>{selected}</span>:
       <input type="text" value={selected} disabled={!onChange}
        maxLength={240} aria-label={"Пропуск "+(i+1)} placeholder=""
        style={{width:Math.min(190,Math.max(36,blank.answer.length*15+12))}}
        onChange={e=>updateGap(i,e.target.value)}/>}
      {hasChoice&&<span className="lektrus-activity-gap-choices" role="group"
       aria-label={"Варианты для пропуска "+(i+1)}>
       {variants.map((variant,j)=><button type="button" key={j} disabled={!onChange}
        className={selected===variant?"selected":""} aria-pressed={selected===variant}
        onClick={()=>updateGap(i,variant)}>{variant}</button>)}
      </span>}
     </span>
    </span>;
   })}
   <span>{activity.tail}</span>
  </div>}
  {activity.mode==="fill"&&punctuation&&(activity.blanks?.length??0)>0&&
   <details className="lektrus-activity-punctuation-explanations">
    <summary>Объяснить постановку знаков</summary>
    <p>После расстановки знаков объясните, почему в каждом отмеченном месте нужен знак или почему он не нужен. Объяснение проверяет преподаватель.</p>
    {(activity.blanks??[]).map((blank,i)=><label key={i}>
     <strong>{i+1}. {data.values?.[i]??"Знак ещё не выбран"}</strong>
     <textarea disabled={!onChange} rows={2} maxLength={500}
      placeholder="Например: запятая разделяет части сложного предложения"
      value={data.explanations?.[i]??""}
      onChange={e=>patch({explanations:(activity.blanks??[]).map((_,j)=>j===i?e.target.value:data.explanations?.[j]??"")})}/>
     {data.checked&&blank.rule&&<small>Правило преподавателя: {blank.rule}</small>}
    </label>)}
   </details>}
  {activity.mode==="match"&&<div className="lektrus-activity-match-columns">
    <div><small>Выберите слева</small>
     {(activity.pairs??[]).map((pair,i)=><button key={i} type="button" disabled={!onChange}
      className={(activeLeft===i?"active ":"")+(data.matched?.[i]!=null&&data.matched[i]>=0?"paired":"")}
      onClick={()=>setActiveLeft(i)}><span>{i+1}</span>{pair.left||"Элемент"}</button>)}
    </div>
    <div><small>Затем выберите справа</small>
     {order.map((original,j)=><button key={original} type="button" disabled={!onChange}
      className={data.matched?.includes(original)?"paired":""}
      onClick={()=>{
       if(activeLeft===null)return;
       const matched=(activity.pairs??[]).map((_,i)=>data.matched?.[i]??-1);
       matched.forEach((v,i)=>{if(v===original)matched[i]=-1;});
       matched[activeLeft]=original;
       patch({matched});setActiveLeft(null);
      }}><span>{String.fromCharCode(1040+j)}</span>{activity.pairs?.[original]?.right||"Элемент"}</button>)}
    </div>
  </div>}
  {activity.mode==="match"&&!!data.matched?.some(x=>x>=0)&&<p className="lektrus-activity-links">
    {data.matched.map((value,i)=>value>=0?<span key={i}>{i+1} → {String.fromCharCode(1040+order.indexOf(value))}</span>:null)}
   </p>}
  {activity.mode==="order"&&<>
   <div className="lektrus-activity-selected-sequence">
    <small>Ваша последовательность</small><div>
    {selections.map((i,j)=><button key={j} type="button" disabled={!onChange}
     onClick={()=>patch({ordered:selections.filter((_,k)=>k!==j)})}>{tokens[i]} <span>×</span></button>)}
    {!selections.length&&<span>Нажимайте на элементы в нужном порядке</span>}</div>
   </div>
   <div className="lektrus-activity-tokens" role="group" aria-label="Элементы для упорядочивания">
    {mixedIndices(tokens.length,tokens.join("|")).map(i=><button key={i} disabled={!onChange||selections.includes(i)}
     type="button" onClick={()=>choose(i)}>{tokens[i]||"Элемент"}</button>)}
   </div>
  </>}
  {onChange&&complete&&<div className="lektrus-activity-runner-footer">
   <button type="button" className="lektrus-activity-reset" onClick={()=>onChange({})}>Сбросить</button>
   <button type="button" className="lektrus-activity-check" onClick={check}>Проверить</button>
  </div>}
  {result&&<p className={"lektrus-activity-result "+(result.correct===result.total?"all-correct":"some-errors")} role="status">
   {result.correct===result.total?"Верно! Всё выполнено правильно.":"Верных ответов: "+result.correct+" из "+result.total+". Попробуйте ещё раз."}
  </p>}
 </div>;
}
