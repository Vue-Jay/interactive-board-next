import {useState} from "react";
import type {RussianTaskWork,SubjectBoardEntry} from "./boardModel";
import {morphemeNames,type MorphemeRole} from "./lektrusApprovedSchoolModel";
import {grammarRoles,type WordRole} from "./lektrusNextSchoolModel";
import {posNames,type RussianPartOfSpeech} from "./lektrusRussianSchoolModel";
import {changeRussianMorphemeBoundary,isSingleRussianWord,russianLetters,russianWordParts,russianTaskHasWork,russianSentenceTokens} from "./lektrusRussianWorkLogic";

export const splitRussianSentence=(source:string):string[]=>
 russianSentenceTokens(source).slice(0,100);
export const separateRussianQuestions=(source:string)=>
 source.split(/\r?\n/).map(v=>v.trim()).filter(Boolean).slice(0,15);
export const russianWorkSource=(entry:SubjectBoardEntry):string=>{
 const detail=entry.details??{};
 if(entry.format==="text")return detail.questions?.trim()??"";
 if(entry.format==="morphology")return [detail.target?.trim(),detail.material?.trim()].filter(Boolean).join(" · ").slice(0,1800);
 return detail.material?.trim()??"";
};

const grammaticalRoles=Object.entries(grammarRoles) as [WordRole,string][];
const morphemeRoles=Object.entries(morphemeNames) as [MorphemeRole,string][];
const sentencePunctuation=/^[^\p{L}\p{N}]+$/u;
const stop=(e:React.SyntheticEvent)=>e.stopPropagation();

type Props={entry:SubjectBoardEntry;work?:RussianTaskWork;onChange?:(next:RussianTaskWork)=>void};
export default function LektrusRussianTaskAnswer({entry,work,onChange}:Props){
 const [selectedRole,setSelectedRole]=useState<WordRole>("subject");
 const source=russianWorkSource(entry);
 const state=work?.source===source?work:undefined;
 const update=(delta:Partial<RussianTaskWork>)=>onChange?.({...state,...delta,source});
 const editable=Boolean(onChange);
 if(entry.format==="morphemes"){
  // One lexical word per analysis. Existing multi-word material remains visible as a
  // prompt rather than silently splitting an unspecified word into misleading morphemes.
  const word=source.replace(/\s+/g," ").trim();
  const letters=russianLetters(word);
  const validWord=isSingleRussianWord(word);
  const splits=state?.cuts??[];
  const sections=russianWordParts(word,state);
  const toggle=(n:number)=>update(changeRussianMorphemeBoundary(word,state,n));
  if(!validWord)return <div className="lektrus-rus-answer-help">
   {word?"Для разбора используйте одно слово без пробелов, цифр и знаков препинания (до 64 букв).":"Преподаватель ещё не указал слово для разбора."}
  </div>;
  return <div className="lektrus-rus-task-work lektrus-rus-morpheme-work" onPointerDown={stop} onClick={stop}>
   <div className="lektrus-rus-work-top"><strong>Разделите слово на морфемы</strong>
    <small>Нажмите между буквами, затем выберите роль каждой части</small></div>
   <div className="lektrus-rus-word-divider" role="group" aria-label="Границы морфем">
    {letters.map((letter,i)=><span className="lektrus-rus-letter" key={i}>
     <span>{letter}</span>{i<letters.length-1&&<button type="button" disabled={!editable}
      className={splits.includes(i+1)?"is-cut":""} aria-pressed={splits.includes(i+1)}
      aria-label={"Граница после буквы "+(i+1)} title="Разделить или объединить части"
      onClick={()=>toggle(i+1)}>│</button>}</span>)}
   </div>
   <div className="lektrus-rus-morpheme-sections">
    {sections.map(({text,role},i)=><label key={i} className={"lektrus-rus-morpheme-section lektrus-rus-mark-"+role}>
      <span className="lektrus-rus-morpheme-graphic">{text}</span>
      <select aria-label={"Часть слова "+(i+1)} value={role} disabled={!editable}
       onChange={e=>{const next=sections.map(section=>section.role);
        next[i]=e.target.value as MorphemeRole|"unset";
        update({morphemeRoles:next,zeroEnding:next.includes("ending")?false:state?.zeroEnding??false})}}>
       <option value="unset">Выберите часть слова</option>
       {morphemeRoles.map(([id,label])=><option key={id} value={id}>{label}</option>)}
      </select>
     </label>)}
   </div>
   {editable&&russianTaskHasWork(state)&&<button type="button" className="lektrus-rus-clear"
     onClick={()=>update({cuts:[],morphemeRoles:["unset"],zeroEnding:false})}>
     Сбросить разбор</button>}
   <label className="lektrus-rus-zero-ending">
    <input type="checkbox" checked={state?.zeroEnding??false} disabled={!editable}
     onChange={e=>update({zeroEnding:e.target.checked,
       morphemeRoles:e.target.checked?sections.map(part=>part.role==="ending"?"unset":part.role):sections.map(part=>part.role)})}/> Нулевое окончание (∅)
   </label>
  </div>;
 }
 if(entry.format==="syntax"){
  const tokens=splitRussianSentence(source);
  const applied=state?.syntaxRoles??[];
  if(!tokens.length)return <div className="lektrus-rus-answer-help">Введите предложение для разбора.</div>;
  return <div className="lektrus-rus-task-work lektrus-rus-syntax-work" onPointerDown={stop} onClick={stop}>
   <div className="lektrus-rus-work-top"><strong>Подчеркните члены предложения</strong>
    <small>Выберите линию и нажмите на слово. Повторное нажатие снимает отметку.</small></div>
   <div className="lektrus-rus-roles" role="group" aria-label="Подчёркивание членов предложения">
    {grammaticalRoles.map(([role,label])=><button key={role} type="button"
      disabled={!editable} aria-pressed={selectedRole===role}
      className={selectedRole===role?"selected":""} onClick={()=>setSelectedRole(role)}>
      <span className={"lektrus-rus-grammar-mark mark-"+role}>{label.split(" ")[0]}</span>
      <small>{label}</small>
     </button>)}
   </div>
   <div className="lektrus-rus-sentence-tokens" role="group" aria-label="Разбор предложения">
    {tokens.map((token,i)=>{
     const punctuation=sentencePunctuation.test(token);
     const role=(applied[i]??"none") as WordRole;
     return punctuation?<span key={i} className="lektrus-rus-punctuation">{token}</span>:
      <button key={i} type="button" disabled={!editable} className={"lektrus-rus-token mark-"+role}
        title={grammarRoles[role]} aria-label={token+": "+grammarRoles[role]}
        onClick={()=>update({syntaxRoles:tokens.map((_,j)=>j===i?(role===selectedRole?"none":selectedRole):applied[j]??"none")})}>
       {token}</button>;
    })}
   </div>
   <div className="lektrus-rus-marking-footer">
    <small className="lektrus-rus-legend">Подлежащее: одна линия · сказуемое: две · определение: волнистая · дополнение: пунктир · обстоятельство: штрихпунктир</small>
    {editable&&applied.some(role=>role&&role!=="none")&&<button type="button" className="lektrus-rus-clear"
     onClick={()=>update({syntaxRoles:tokens.map(()=>"none")})}>Снять все подчёркивания</button>}
   </div>
  </div>;
 }
 if(entry.format==="morphology"){
  return <div className="lektrus-rus-task-work lektrus-rus-morphology-work" onPointerDown={stop} onClick={stop}>
   <div className="lektrus-rus-work-top"><strong>Морфологический разбор</strong><small>Заполните признаки самостоятельно. Программа не определяет их вместо вас.</small></div>
   {entry.details?.target&&<p className="lektrus-rus-analysis-target">Разбираемое слово: <strong>{entry.details.target}</strong></p>}
   {!entry.details?.target&&<p className="lektrus-rus-answer-help">Преподавателю нужно указать разбираемое слово.</p>}
   <label className="lektrus-rus-work-field">Часть речи
     <select disabled={!editable} value={state?.partOfSpeech??""}
      onChange={e=>update({partOfSpeech:e.target.value})}>
      <option value="">Выберите часть речи</option>
      {(Object.entries(posNames) as [RussianPartOfSpeech,string][]).map(([id,name])=>
       <option key={id} value={id}>{name}</option>)}
     </select>
   </label>
   <div className="lektrus-rus-analysis-fields">
    {([["permanent","Постоянные признаки"],["variable","Непостоянные признаки"],
       ["syntax","Синтаксическая роль"]] as const).map(([key,label])=>
     <label key={key} className="lektrus-rus-work-field">{label}
       {editable?<textarea rows={2} maxLength={key==="syntax"?1000:1500}
        placeholder={key==="syntax"?"Укажите член предложения":"Запишите грамматические признаки"}
        value={state?.[key]??""} onChange={e=>update({[key]:e.target.value})}/>:
        <p>{state?.[key]||"Ещё не заполнено"}</p>}
     </label>)}
   </div>
  </div>;
 }
 if(entry.format==="text"){
  const questions=separateRussianQuestions(entry.details?.questions??"");
  if(!questions.length)return <div className="lektrus-rus-answer-help">Преподаватель пока не добавил вопросы к тексту.</div>;
  return <div className="lektrus-rus-task-work lektrus-rus-reading-work" onPointerDown={stop} onClick={stop}>
   <div className="lektrus-rus-work-top"><strong>Ответьте на вопросы к тексту</strong></div>
   {questions.map((question,i)=><label key={i} className="lektrus-rus-reading-question">
    <strong>{i+1}. {question}</strong>
    {editable?<textarea rows={2} maxLength={1500} value={state?.textAnswers?.[i]??""}
     placeholder="Ваш ответ" onChange={e=>update({textAnswers:questions.map((_,j)=>j===i?e.target.value:state?.textAnswers?.[j]??"")})}/>:
     <p>{state?.textAnswers?.[i]||"Ответ не записан"}</p>}
   </label>)}
  </div>;
 }
 return null;
}
