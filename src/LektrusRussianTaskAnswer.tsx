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

type MorphFeature={name:string;options:readonly string[]};
type MorphPlan={permanent:readonly MorphFeature[];variable:readonly MorphFeature[];unchanging?:boolean};
const feature=(name:string,...options:string[]):MorphFeature=>({name,options});
/** School plans are prompts, not inferred grammatical answers. Empty fields are allowed
 * when a feature is inapplicable to a concrete word or a particular school programme. */
const morphologyPlans:Partial<Record<RussianPartOfSpeech,MorphPlan>>={
 noun:{permanent:[
  feature("Собственное / нарицательное","нарицательное","собственное"),
  feature("Одушевлённость","одушевлённое","неодушевлённое"),
  feature("Род","мужской","женский","средний","общий","не определяется"),
  feature("Склонение","1-е","2-е","3-е","разносклоняемое","несклоняемое")],
  variable:[feature("Число","единственное","множественное"),
   feature("Падеж","именительный","родительный","дательный","винительный","творительный","предложный")]},
 adjective:{permanent:[feature("Разряд","качественное","относительное","притяжательное")],
  variable:[feature("Форма","полная","краткая"),feature("Степень сравнения","положительная","сравнительная","превосходная"),
   feature("Род","мужской","женский","средний"),feature("Число","единственное","множественное"),
   feature("Падеж","именительный","родительный","дательный","винительный","творительный","предложный")]},
 verb:{permanent:[feature("Вид","совершенный","несовершенный"),
   feature("Переходность","переходный","непереходный"),
   feature("Возвратность","возвратный","невозвратный"),
   feature("Спряжение","I","II","разноспрягаемый","особое спряжение")],
  variable:[feature("Наклонение","изъявительное","повелительное","условное"),
   feature("Время","настоящее","прошедшее","будущее"),
   feature("Лицо","1-е","2-е","3-е"),feature("Род","мужской","женский","средний"),
   feature("Число","единственное","множественное")]},
 pronoun:{permanent:[feature("Разряд","личное","возвратное","притяжательное","указательное","определительное","вопросительное","относительное","отрицательное","неопределённое"),
   feature("Лицо","1-е","2-е","3-е")],
  variable:[feature("Падеж","именительный","родительный","дательный","винительный","творительный","предложный"),
   feature("Число","единственное","множественное"),feature("Род","мужской","женский","средний")]},
 numeral:{permanent:[feature("Значение","количественное","порядковое","собирательное"),
   feature("Строение","простое","сложное","составное")],
  variable:[feature("Падеж","именительный","родительный","дательный","винительный","творительный","предложный"),
   feature("Род","мужской","женский","средний"),feature("Число","единственное","множественное")]},
 participle:{permanent:[feature("Вид","совершенный","несовершенный"),
   feature("Время","настоящее","прошедшее"),feature("Залог","действительное","страдательное"),
   feature("Возвратность","возвратное","невозвратное")],
  variable:[feature("Форма","полная","краткая"),feature("Род","мужской","женский","средний"),
   feature("Число","единственное","множественное"),
   feature("Падеж","именительный","родительный","дательный","винительный","творительный","предложный")]},
 gerund:{permanent:[feature("Вид","совершенный","несовершенный"),
   feature("Возвратность","возвратное","невозвратное")],variable:[],unchanging:true},
 adverb:{permanent:[feature("Разряд по значению","образа действия","меры и степени","места","времени","причины","цели")],
  variable:[feature("Степень сравнения","положительная","сравнительная","превосходная")]},
 preposition:{permanent:[feature("Происхождение","производный","непроизводный"),
   feature("Строение","простой","составной")],variable:[],unchanging:true},
 conjunction:{permanent:[feature("Сочинительный / подчинительный","сочинительный","подчинительный"),
   feature("Строение","простой","составной")],variable:[],unchanging:true},
 particle:{permanent:[feature("Разряд","формообразующая","отрицательная","смысловая")],variable:[],unchanging:true},
 interjection:{permanent:[],variable:[],unchanging:true}
};
const morphRows=(value:string)=>value.split(/\\r?\\n/).reduce<Record<string,string>>((result,line)=>{
 const divider=line.indexOf(": ");if(divider>0)result[line.slice(0,divider)]=line.slice(divider+2);return result;
},{});
const morphNotes=(value:string)=>value.split(/\\r?\\n/).filter(line=>!line.includes(": ")).join("\\n");
const setMorphRow=(source:string,name:string,value:string)=>{
 const lines=source.split(/\\r?\\n/).filter(Boolean).filter(line=>!line.startsWith(name+": "));
 if(value)lines.push(name+": "+value);return lines.join("\\n");
};

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
  const part=state?.partOfSpeech as RussianPartOfSpeech|undefined;
  const plan=part?morphologyPlans[part]:undefined;
  const initial=(state?.initialForm??"");
  const morphGroup=(group:"permanent"|"variable",heading:string,number:string)=>{
   const features=plan?.[group]??[];
   const values=morphRows(state?.[group]??"");
   const notes=morphNotes(state?.[group]??"");
   return <section className="lektrus-rus-morph-step">
    <div className="lektrus-rus-morph-step-title"><span>{number}</span><strong>{heading}</strong></div>
    {features.length>0?<div className="lektrus-rus-morph-features">
     {features.map(f=>{
      const selected=values[f.name]??"";
      const custom=selected.startsWith("Свой вариант: ")?selected.slice(14):"";
      return <label key={f.name} className="lektrus-rus-morph-feature">
       <span>{f.name}</span>
       <select disabled={!editable} aria-label={f.name}
        value={custom?"__custom__":f.options.includes(selected)?selected:selected?"__custom__":""}
        onChange={e=>update({[group]:setMorphRow(state?.[group]??"",f.name,
         e.target.value==="__custom__"?"Свой вариант: ":e.target.value)})}>
        <option value="">Не указано / не применяется</option>
        {f.options.map(value=><option key={value} value={value}>{value}</option>)}
        <option value="__custom__">Свой вариант…</option>
       </select>
       {(custom||selected==="Свой вариант: "||selected&&!f.options.includes(selected))&&
        <input disabled={!editable} aria-label={f.name+": свой вариант"} value={custom||(!selected.startsWith("Свой вариант: ")?selected:"")}
         placeholder="Уточните признак" maxLength={100}
         onChange={e=>update({[group]:setMorphRow(state?.[group]??"",f.name,"Свой вариант: "+e.target.value)})}/>}
      </label>;
     })}
    </div>:<p className="lektrus-rus-morph-invariable">{plan?.unchanging?"Эта часть речи не изменяется.":"Для этой части речи обязательные признаки не заданы."}</p>}
    <label className="lektrus-rus-morph-notes">Дополнительные сведения <small>По желанию, если школьный план требует уточнения</small>
      <textarea rows={2} maxLength={600} disabled={!editable}
       placeholder="Необязательные особенности разбора" value={notes}
       onChange={e=>update({[group]:[...Object.entries(values).map(([k,v])=>k+": "+v),e.target.value].filter(Boolean).join("\\n")})}/>
    </label>
   </section>;
  };
  return <div className="lektrus-rus-task-work lektrus-rus-morphology-work" onPointerDown={stop} onClick={stop}>
   <div className="lektrus-rus-work-top"><strong>Морфологический разбор</strong><small>Разбирайте по плану. Признаки выбирает ученик, без автоматических подсказок с ответами.</small></div>
   {entry.details?.material&&<p className="lektrus-rus-morph-context">{entry.details.material}</p>}
   {entry.details?.target?<p className="lektrus-rus-analysis-target">Слово: <strong>{entry.details.target}</strong></p>:
    <p className="lektrus-rus-answer-help">Преподавателю нужно выбрать слово из предложения.</p>}
   <section className="lektrus-rus-morph-step">
    <div className="lektrus-rus-morph-step-title"><span>01</span><strong>Часть речи и начальная форма</strong></div>
    <div className="lektrus-rus-morph-first">
     <label className="lektrus-rus-morph-feature"><span>Часть речи</span>
      <select disabled={!editable} value={part??""}
       onChange={e=>update({partOfSpeech:e.target.value,permanent:"",variable:""})}>
       <option value="">Выберите часть речи</option>
       {(Object.entries(posNames) as [RussianPartOfSpeech,string][]).map(([id,name])=>
        <option key={id} value={id}>{name}</option>)}
      </select></label>
     <label className="lektrus-rus-morph-feature"><span>Начальная форма</span>
      <input disabled={!editable} value={initial} maxLength={120}
       placeholder="Запишите начальную форму" onChange={e=>update({initialForm:e.target.value})}/></label>
    </div>
   </section>
   {part&&<>{morphGroup("permanent","Постоянные признаки","02")}
    {morphGroup("variable","Непостоянные признаки","03")}
    <section className="lektrus-rus-morph-step">
     <div className="lektrus-rus-morph-step-title"><span>04</span><strong>Роль в предложении</strong></div>
     <label className="lektrus-rus-morph-feature"><span>Синтаксическая роль</span>
      <select disabled={!editable} value={state?.syntax??""}
       onChange={e=>update({syntax:e.target.value})}>
       <option value="">Ещё не определена</option>
       {["подлежащее","сказуемое","определение","дополнение","обстоятельство","не является членом предложения"].map(v=>
        <option key={v} value={v}>{v}</option>)}
       {state?.syntax&&!["подлежащее","сказуемое","определение","дополнение","обстоятельство","не является членом предложения"].includes(state.syntax)&&
        <option value={state.syntax}>{state.syntax}</option>}
      </select>
     </label>
    </section></>}
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
