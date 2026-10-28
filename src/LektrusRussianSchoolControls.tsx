import type {RussianSchoolDiagram,RussianPartOfSpeech,TraitGroup} from "./lektrusRussianSchoolModel";
import {posNames,traitGroupNames,totalSounds,synchronizePhoneticLetters,phoneticWordValid,russianMorphologyFeatures} from "./lektrusRussianSchoolModel";
type Props={diagram:RussianSchoolDiagram;onChange:(value:RussianSchoolDiagram)=>void};
const makeId=()=>crypto.randomUUID();
export default function LektrusRussianSchoolControls({diagram:d,onChange}:Props){
 if(d.kind==="morphology"){
  const setRow=(id:string,changes:Partial<(typeof d.rows)[number]>)=>
   onChange({...d,rows:d.rows.map(row=>row.id===id?{...row,...changes}:row)});
  return <>
   <label className="lektrus-school-field">Слово для разбора
    <input value={d.word} maxLength={65} onChange={e=>onChange({...d,word:e.target.value})}/></label>
   <label className="lektrus-school-field">Предложение (по желанию)
    <textarea rows={2} value={d.sentence} maxLength={220}
     onChange={e=>onChange({...d,sentence:e.target.value})}/></label>
   <label className="lektrus-school-field">Часть речи
    <select value={d.partOfSpeech} onChange={e=>onChange({...d,partOfSpeech:e.target.value as RussianPartOfSpeech})}>
     {Object.entries(posNames).map(([id,name])=><option key={id} value={id}>{name}</option>)}
    </select>
   </label>
   <div className="lektrus-school-controls-heading">Признаки и синтаксическая роль</div>
   {russianMorphologyFeatures[d.partOfSpeech]&&<div className="lektrus-russian-feature-groups">
    {(["permanent","variable"] as const).map(group=><div className="lektrus-russian-feature-group" key={group}>
     <strong>{traitGroupNames[group]}</strong>
     <div role="group" aria-label={"Добавить "+traitGroupNames[group].toLocaleLowerCase("ru-RU")}>
      {russianMorphologyFeatures[d.partOfSpeech]?.[group].map(feature=><button type="button" key={feature}
       disabled={d.rows.length>=18||d.rows.some(row=>row.feature===feature&&row.group===group)}
       onClick={()=>onChange({...d,rows:[...d.rows,{id:makeId(),group,feature,value:""}]})}>
       + {feature}</button>)}
     </div>
    </div>)}
   </div>}
   <button type="button" className="lektrus-school-add" disabled={d.rows.length>=18}
    onClick={()=>onChange({...d,rows:[...d.rows,{id:makeId(),group:"syntax",feature:"Член предложения",value:""}]})}>
    + Синтаксическая роль
   </button>
   <p className="lektrus-school-hint">Учитель самостоятельно задаёт признаки. У разных частей речи они различаются, поэтому поля полностью редактируемые. Программа не выполняет автоматический разбор.</p>
   {d.rows.map((row,i)=><div className="lektrus-russian-edit-row" key={row.id}>
    <div className="lektrus-russian-edit-header"><span className="lektrus-school-number">{i+1}</span>
     <select aria-label={"Раздел "+(i+1)} value={row.group}
      onChange={e=>setRow(row.id,{group:e.target.value as TraitGroup})}>
      {Object.entries(traitGroupNames).map(([id,name])=><option key={id} value={id}>{name}</option>)}
     </select>
     <button type="button" title="Удалить признак"
      onClick={()=>onChange({...d,rows:d.rows.filter(x=>x.id!==row.id)})}>×</button>
    </div>
    <input aria-label={"Название признака "+(i+1)} value={row.feature} maxLength={52}
     placeholder="Признак" onChange={e=>setRow(row.id,{feature:e.target.value})}/>
    <input aria-label={"Значение признака "+(i+1)} value={row.value} maxLength={90}
     placeholder="Значение" onChange={e=>setRow(row.id,{value:e.target.value})}/>
   </div>)}
   <button type="button" className="lektrus-school-add" disabled={d.rows.length>=18}
    onClick={()=>onChange({...d,rows:[...d.rows,{id:makeId(),group:"variable",feature:"",value:""}]})}>
    + Добавить признак ({d.rows.length}/18)</button>
   <label className="lektrus-school-toggle"><input type="checkbox" checked={d.showAnalysis}
    onChange={e=>onChange({...d,showAnalysis:e.target.checked})}/> Показывать готовый разбор на доске</label>
   <p className="lektrus-school-hint">Отключите показ готового разбора, чтобы ученик самостоятельно записывал признаки рядом со схемой. Ответы останутся в редакторе преподавателя.</p>
  </>;
 }
 if(d.kind==="phonetics"){
  const update=(id:string,changes:Partial<(typeof d.letters)[number]>)=>
   onChange({...d,letters:d.letters.map(letter=>letter.id===id?{...letter,...changes}:letter)});
  const lettersCount=d.letters.length,soundsCount=totalSounds(d.letters);
  return <>
   <label className="lektrus-school-field">Слово для фонетического разбора
    <input value={d.word} maxLength={24} onChange={e=>{
     const word=e.target.value.trim().slice(0,24);
     if(!phoneticWordValid(word))return;
     onChange({...d,word,letters:synchronizePhoneticLetters(word,d.letters,makeId)});
    }} placeholder="Введите одно слово"/></label>
   <p className="lektrus-school-hint">Таблица букв создаётся сразу при вводе слова. Данные неизменённых букв сохраняются; у исправленной буквы звуки и признаки не угадываются автоматически. Для Ь и Ъ можно оставить список звуков пустым.</p>
   <div className="lektrus-school-controls-heading">Буквы и звуки ({lettersCount} букв, {soundsCount} звуков)</div>
   {d.letters.map((entry,i)=><div className="lektrus-russian-phonetic-row" key={entry.id}>
    <span className="lektrus-school-number">{i+1}</span>
    <label>Буква
     <input value={entry.letter} maxLength={4} aria-label={"Буква "+(i+1)}
      onChange={e=>onChange({...d,word:d.letters.map(l=>l.id===entry.id?e.target.value:l.letter).join(""),
       letters:d.letters.map(l=>l.id===entry.id?{...l,letter:e.target.value}:l)})}/></label>
    <label>Звуки (через пробел)
     <input value={entry.sounds.join(" ")} aria-label={"Звуки буквы "+(i+1)}
      placeholder="Запишите звуки буквы через пробел" onChange={e=>{
       const sounds=e.target.value.trim().split(/\s+/u).filter(Boolean).slice(0,2).map(v=>v.slice(0,12));
       update(entry.id,{sounds,stressed:sounds.length?entry.stressed:false});
      }}/></label>
    <label className="lektrus-russian-stress">
     <input type="checkbox" checked={entry.stressed}
      disabled={entry.sounds.length===0} aria-label={"Ударение на букве "+(i+1)}
      onChange={e=>onChange({...d,letters:d.letters.map(l=>({...l,
       stressed:l.id===entry.id?e.target.checked:false}))})}/> Ударение
    </label>
    <label className="lektrus-russian-characteristic">Характеристика
     <input value={entry.characteristic} maxLength={100} placeholder="Укажите признаки звука"
      aria-label={"Характеристика звуков буквы "+(i+1)}
      onChange={e=>update(entry.id,{characteristic:e.target.value})}/></label>
   </div>)}
   <label className="lektrus-school-toggle"><input type="checkbox" checked={d.showSounds}
    onChange={e=>onChange({...d,showSounds:e.target.checked})}/> Показать звуки и ударение на доске</label>
   <label className="lektrus-school-toggle"><input type="checkbox" checked={d.showCharacteristics}
    onChange={e=>onChange({...d,showCharacteristics:e.target.checked})}/> Показать характеристики</label>
   <p className="lektrus-school-hint">Для самостоятельной работы скройте оба набора ответов. Запись звуков и характеристики определяет учитель с учётом конкретного слова. Длина таблицы ограничена 24 буквами.</p>
  </>;
 }
 const edit=(id:string,changes:Partial<(typeof d.questions)[number]>)=>
  onChange({...d,questions:d.questions.map(q=>q.id===id?{...q,...changes}:q)});
 return <>
  <div className="lektrus-school-controls-heading">Задания с пропущенной буквой</div>
  <p className="lektrus-school-hint">В каждом задании вставьте символ □ вместо пропущенной буквы. Задайте 2–4 варианта и правильный ответ. На доске ученик выбирает вариант и нажимает «Проверить»; ответы не отображаются заранее.</p>
  {d.questions.map((q,i)=><div className="lektrus-russian-question" key={q.id}>
   <div className="lektrus-russian-edit-header">
    <span className="lektrus-school-number">{i+1}</span>
    <b>Задание {i+1}</b>
    <button type="button" title="Удалить задание"
     onClick={()=>onChange({...d,questions:d.questions.filter(x=>x.id!==q.id)})}>×</button>
   </div>
   <label>Текст с одним пропуском □
    <input value={q.prompt} maxLength={180} placeholder="Текст с одним пропуском □"
     onChange={e=>edit(q.id,{prompt:e.target.value})}/>
   </label>
   {q.prompt.split("□").length!==2&&<small className="lektrus-russian-validation">В тексте должен быть один пропуск □.</small>}
   {!q.prompt.includes("□")&&<button type="button" className="lektrus-russian-insert-gap"
     onClick={()=>edit(q.id,{prompt:q.prompt+"□"})}>+ Добавить пропуск □</button>}
   {q.options.some(option=>!option.trim())&&<small className="lektrus-russian-validation">Заполните все варианты ответа перед публикацией.</small>}
   <div className="lektrus-russian-options">
    {q.options.map((option,index)=><label key={index}>
     <input type="radio" name={"orthography-answer-"+q.id} checked={index===q.correct}
      aria-label={"Правильный ответ "+(index+1)}
      onChange={()=>edit(q.id,{correct:index})}/>
     <input value={option} maxLength={24} aria-label={"Вариант ответа "+(index+1)}
      onChange={e=>edit(q.id,{options:q.options.map((o,j)=>j===index?e.target.value:o)})}/>
     <button type="button" title="Убрать вариант" disabled={q.options.length<=2}
      onClick={()=>edit(q.id,{options:q.options.filter((_,j)=>j!==index),
       correct:Math.max(0,q.correct===index?0:q.correct>index?q.correct-1:q.correct)})}>×</button>
    </label>)}
   </div>
   <button type="button" disabled={q.options.length>=4} onClick={()=>edit(q.id,{
    options:[...q.options,""]})}>+ Вариант ({q.options.length}/4)</button>
   <label>Пояснение к правильному ответу (по желанию)
    <textarea rows={2} value={q.explanation} maxLength={250}
     onChange={e=>edit(q.id,{explanation:e.target.value})}/></label>
  </div>)}
  <button type="button" className="lektrus-school-add" disabled={d.questions.length>=20}
   onClick={()=>onChange({...d,questions:[...d.questions,{id:makeId(),
    prompt:"□",options:["",""],correct:0,explanation:""}]})}>
   + Добавить задание ({d.questions.length}/20)</button>
  <label className="lektrus-school-toggle"><input type="checkbox" checked={d.showExplanation}
   onChange={e=>onChange({...d,showExplanation:e.target.checked})}/> Показывать объяснение после правильного ответа</label>
  <p className="lektrus-school-hint">Это задания с проверкой варианта, без автоматической генерации орфограмм. Выбор учеников хранится только в открытом тренажёре, не изменяет содержимое доски.</p>
 </>;
}
