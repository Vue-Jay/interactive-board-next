import {useRef,useState,type CSSProperties} from "react";
import type {SubjectBoardEntry,SubjectTaskActivity,SubjectTaskActivityResponse,RussianTaskWork} from "./boardModel";
import type {SubjectTaskTemplate} from "./lektrusSubjectTaskTemplates";
import {subjectAccentPalette} from "./lektrusSubjectAccent";
import {activityMatchesTask,freshActivity,interactiveModesForSubject,
 isIntegratedInteractiveTask,preferredActivityMode,LektrusSubjectActivityBuilder,
 LektrusSubjectActivityRunner} from "./LektrusSubjectActivity";
import {isLanguageGapExercise,languageGapText,parseLanguageGapText,preserveGapChoices} from "./lektrusLanguageGapModel";
import LektrusRussianTaskAnswer from "./LektrusRussianTaskAnswer";
import LektrusForeignTaskAnswer from "./LektrusForeignTaskAnswer";

type Props={
 tone:"russian"|"languages";
 entry:SubjectBoardEntry;
 template:SubjectTaskTemplate;
 onChange:(next:SubjectBoardEntry)=>void;
};
const activityTitles:Record<SubjectTaskActivity["mode"],string>={
 choice:"Выбрать ответ",fill:"Заполнить пропуски",match:"Соединить пары",order:"Собрать по порядку"
};
const introduction:Record<string,{title:string;hint:string}>={
 "russian:task":{title:"Свободное задание",hint:"Вопрос или упражнение со свободным ответом."},
 "russian:orthography":{title:"Найди орфограмму",hint:"Выделите буквы и создайте пропуски."},
 "russian:punctuation":{title:"Пунктуационный практикум",hint:"Отметьте знаки и места без знака."},
 "russian:morphemes":{title:"Разбор слова по составу",hint:"Разделите слово и обозначьте морфемы."},
 "russian:morphology":{title:"Морфологический разбор",hint:"Выберите слово и выполните школьный разбор."},
 "russian:syntax":{title:"Разбор предложения",hint:"Подчеркните члены предложения."},
 "russian:text":{title:"Работа с текстом",hint:"Текст и вопросы к нему."},
 "russian:interactive":{title:"Интерактивная практика",hint:"Создайте упражнение с проверкой."},
 "languages:task":{title:"Свободное задание",hint:"Вопрос или письменное упражнение."},
 "languages:translation":{title:"Перевод текста",hint:"Исходный текст и направление перевода."},
 "languages:gaps":{title:"Заполнение пропусков",hint:"Выделите слова для пропусков."},
 "languages:vocabulary":{title:"Сопоставление слов",hint:"Составьте пары слов."},
 "languages:word-order":{title:"Составление предложения",hint:"Введите слова в правильном порядке."},
 "languages:grammar":{title:"Грамматическое преобразование",hint:"Задайте правило и исходные предложения."},
 "languages:reading":{title:"Чтение и понимание",hint:"Добавьте текст и вопросы."},
 "languages:choice":{title:"Вопрос с вариантами",hint:"Укажите вопрос и правильный вариант."}
};
/** The same stored field can have different school meaning in different workflows. */
const subjectFieldInfo:Record<string,{label:string;hint:string;rows?:number}>={
 "russian:morphemes:material":{label:"Слово для разбора",hint:"Одно слово, без пробелов"},
 "russian:morphology:material":{label:"Предложение",hint:"Введите предложение с разбираемым словом",rows:4},
 "russian:morphology:target":{label:"Разбираемое слово",hint:"Введите одно слово из этого предложения"},
 "russian:syntax:material":{label:"Предложение для разбора",hint:"Введите предложение для подчёркивания членов",rows:4},
 "russian:text:material":{label:"Исходный текст",hint:"Введите текст для чтения и анализа",rows:6},
 "russian:text:questions":{label:"Вопросы и задания",hint:"Укажите вопросы к тексту и требуемые действия",rows:4},
 "languages:translation:material":{label:"Исходный текст",hint:"Введите текст, который нужно перевести",rows:6},
 "languages:translation:direction":{label:"Перевести на язык",hint:"Укажите язык, на который нужно перевести"},
 "languages:grammar:material":{label:"Предложения для преобразования",hint:"Введите предложения, которые нужно изменить",rows:5},
 "languages:grammar:instruction":{label:"Грамматическое действие",hint:"Укажите требуемое время, форму или правило",rows:3},
 "languages:reading:material":{label:"Текст для чтения",hint:"Введите текст, который ученик будет читать",rows:7},
 "languages:reading:questions":{label:"Вопросы к тексту",hint:"Введите вопросы к прочитанному",rows:5}
};
const fieldInfo:Record<string,{label:string;hint:string;rows?:number}>={
 material:{label:"Учебный материал",hint:"Введите текст, слова или предложения для работы",rows:5},
 direction:{label:"Язык перевода",hint:"Укажите, на какой язык нужно перевести"},
 instruction:{label:"Что необходимо сделать",hint:"Опишите требуемое преобразование или действие",rows:2},
 questions:{label:"Вопросы к тексту",hint:"Запишите вопросы, на которые ученик должен ответить",rows:4}
};
export function LektrusLanguageTaskStudio({tone,entry,template,onChange}:Props){
 const [previewAnswer,setPreviewAnswer]=useState<SubjectTaskActivityResponse>({});
 const [previewRussian,setPreviewRussian]=useState<RussianTaskWork>({});
 const [previewForeign,setPreviewForeign]=useState("");
 const [selectionHint,setSelectionHint]=useState("");
 const selectedRef=useRef<HTMLTextAreaElement>(null);
 const punctuation=tone==="russian"&&template.id==="punctuation";
 const orthography=tone==="russian"&&template.id==="orthography";
 const note=introduction[tone+":"+template.id]??{title:template.title,hint:template.instruction};
 const defaultMode=preferredActivityMode(tone,template.id);
 const integrated=isIntegratedInteractiveTask(tone,template.id);
 const isGap=isLanguageGapExercise(tone,template.id);
 const markup=isGap?(entry.details?.markup??languageGapText(entry.activity)):"";
 const gapState=isGap?preserveGapChoices(parseLanguageGapText(markup),entry.activity):null;
 const activity=isGap?gapState?.activity:(defaultMode?
  (activityMatchesTask(tone,template.id,entry.activity)?entry.activity:freshActivity(defaultMode)):undefined);
 const patch=(next:Partial<SubjectBoardEntry>)=>onChange({...entry,...next,subject:tone});
 const changeMaterial=(id:string,value:string)=>patch({details:{...entry.details,[id]:value}});
 const changeMarkup=(value:string)=>{
  const parsed=preserveGapChoices(parseLanguageGapText(value),activity);
  patch({details:{...entry.details,markup:value},activity:parsed.activity,activityResponse:undefined});
  setPreviewAnswer({});
  setSelectionHint("");
 };
 const configureChoices=(index:number,enabled:boolean)=>{
  if(activity?.mode!=="fill")return;
  const blanks=(activity.blanks??[]).map((blank,i)=>{
   if(i!==index)return blank;
   if(!enabled){const rest={...blank};delete rest.choices;return rest;}
   return {...blank,choices:[blank.answer,""] as [string,string]};
  });
  patch({activity:{...activity,blanks},activityResponse:undefined});setPreviewAnswer({});
 };
 const updateDistractor=(index:number,distractor:string)=>{
  if(activity?.mode!=="fill")return;
  const blanks=(activity.blanks??[]).map((blank,i)=>i===index?
   {...blank,choices:[blank.answer,distractor] as [string,string]}:blank);
  patch({activity:{...activity,blanks},activityResponse:undefined});setPreviewAnswer({});
 };
 const punctuationRules=[
  "Однородные члены предложения","Части сложного предложения",
  "Обращение","Вводное слово или конструкция","Причастный или деепричастный оборот",
  "Уточнение или пояснение","Прямая речь и диалог",
  "Тире между подлежащим и сказуемым","Конец предложения","Знак не требуется"
 ];
 const updatePunctuationRule=(index:number,rule:string)=>{
  if(activity?.mode!=="fill")return;
  const blanks=activity.blanks?.map((blank,i)=>i===index?{...blank,rule}:blank);
  patch({activity:{...activity,blanks},activityResponse:undefined});setPreviewAnswer({});
 };
 const markAllPunctuation=()=>{
  if(!markup.trim())return setSelectionHint("Сначала введите предложение.");
  let count=gapState?.count??0,inBlank=false,added=0;
  const next=Array.from(markup).map((ch,i,chars)=>{
   if(ch==="[")inBlank=true;
   if(ch==="]"){inBlank=false;return ch;}
   if(inBlank||count>=8)return ch;
   if(!/[,;:!?—]/.test(ch))return ch;
   if(ch==="—"&&chars[i-1]!==" "&&chars[i+1]!==" ")return ch;
   count++;added++;return "["+ch+"]";
  }).join("");
  if(!added){setSelectionHint("Новых знаков не найдено. Выделите нужный знак или добавьте место без знака.");return;}
  changeMarkup(next);setSelectionHint("Создано контрольных мест: "+added+". Добавьте несколько мест без знака для проверки понимания.");
 };
 const removeGap=(index:number)=>{
  if(!gapState?.activity?.blanks)return;
  const blanks=gapState.activity.blanks;
  changeMarkup(blanks.map((part,i)=>part.before+(i===index?part.answer:"["+part.answer+"]")).join("")+(gapState.activity.tail??""));
 };
 const insertPunctuation=(mark:string)=>{
  const textarea=selectedRef.current;
  if(!textarea)return;
  const begin=textarea.selectionStart,end=textarea.selectionEnd;
  if(markup.slice(begin,end).includes("[")||markup.slice(begin,end).includes("]")){
   setSelectionHint("Выберите место вне уже созданного пропуска");return;
  }
  if((gapState?.count??0)>=8){setSelectionHint("Можно создать до восьми пропусков");return;}
  const next=markup.slice(0,begin)+"["+mark+"]"+markup.slice(end);
  changeMarkup(next);setSelectionHint("Место для знака добавлено. Ученик не увидит правильный ответ.");
  requestAnimationFrame(()=>{textarea.focus();textarea.setSelectionRange(begin+mark.length+2,begin+mark.length+2);});
 };
 const markSelected=()=>{
  const textarea=selectedRef.current;
  if(!textarea)return;
  const begin=textarea.selectionStart,end=textarea.selectionEnd;
  if(begin===end){setSelectionHint("Сначала выделите букву, знак или слово в тексте");textarea.focus();return;}
  if(markup.slice(begin,end).includes("[")||markup.slice(begin,end).includes("]")){
   setSelectionHint("Выделите обычный текст, а не готовый пропуск");return;
  }
  if((gapState?.count??0)>=8){setSelectionHint("В одном упражнении не больше восьми пропусков");return;}
  const selection=markup.slice(begin,end);
  if(orthography&&!/[\p{L}]/u.test(selection)){setSelectionHint("Для орфографии выделите букву или часть слова");return;}
  if(punctuation&&!/^[,.;:!?—–«»()"'-]+$/.test(selection.trim())){
   setSelectionHint("Выделите только знак препинания. Для нового знака воспользуйтесь палитрой ниже.");return;
  }
  changeMarkup(markup.slice(0,begin)+"["+selection+"]"+markup.slice(end));
  setSelectionHint("Готово: выбранный фрагмент скрыт от ученика.");
 };
 const style={"--subject-board-accent":subjectAccentPalette[tone].accent,
  "--subject-board-soft":subjectAccentPalette[tone].soft} as CSSProperties;
 const promptNeeded=!(template.id==="task");
 return <div className="lektrus-language-studio" style={style}>
  <div className="lektrus-language-studio-intro">
   <strong>{note.title}</strong><small>{note.hint}</small>
  </div>
  <div className={"lektrus-language-studio-layout"+(tone==="russian"&&["morphemes","syntax","morphology"].includes(template.id)?" lektrus-language-wide-preview":"")}>
   <div className="lektrus-language-author">
    {promptNeeded&&<details key={tone+":"+template.id} className="lektrus-language-prompt-optional">
      <summary>Инструкция ученику <small>{entry.prompt.trim()?"заполнена":"необязательно"}</small></summary>
      <textarea rows={2} value={entry.prompt} maxLength={2500}
       aria-label="Инструкция ученику" placeholder="Что нужно сделать"
       onChange={e=>patch({prompt:e.target.value})}/>
     </details>}
    {template.id==="task"&&<label className="lektrus-language-field">Задание для ученика
      <textarea rows={4} value={entry.prompt} maxLength={2500}
       placeholder="Сформулируйте вопрос или упражнение"
       onChange={e=>patch({prompt:e.target.value})}/>
     </label>}
    {isGap&&<>
     <div className="lektrus-language-gap-heading">
      <strong>{punctuation?"Предложение для пунктуационного анализа":"Текст упражнения"}</strong>
      <small>{punctuation?"Отметьте знаки и места без знака.":"Выделите буквы или слова для пропусков."}</small>
     </div>
     <textarea className="lektrus-language-gap-source" ref={selectedRef} rows={5} maxLength={1800}
      aria-label="Текст упражнения для создания пропусков" value={markup}
      placeholder={punctuation?"Напишите предложение. Выделите существующий знак или выберите место для нового.":"Напишите слова или предложения, затем выделите орфограммы."}
      onChange={e=>changeMarkup(e.target.value)}/>
     <div className="lektrus-language-gap-actions">
      <button type="button" onMouseDown={e=>e.preventDefault()} onClick={markSelected}>
       <span aria-hidden="true">▱</span> {punctuation?"Скрыть знак":"Сделать пропуск"}
      </button>
     </div>
     {punctuation&&<div className="lektrus-language-punctuation-editor">
      <strong>Контрольные места</strong>
      <div className="lektrus-language-punctuation-actions">
       <button type="button" onClick={markAllPunctuation}>Разметить знаки</button>
       <button type="button" onMouseDown={e=>e.preventDefault()} onClick={()=>insertPunctuation("∅")}>+ Место без знака</button>
      </div>
      <small>Добавьте места без знака, чтобы проверить понимание правил.</small>
     </div>}
     {gapState&&gapState.count>0&&!gapState.issue&&<div className="lektrus-language-gaps-list">
      <strong>Пропуски <span>{gapState.count}/8</span></strong>
      <div className="lektrus-language-gap-settings">
       {activity?.mode==="fill"&&activity.blanks?.map((part,i)=>
        <div className="lektrus-language-gap-setting" key={i}>
         <div className="lektrus-language-gap-setting-heading">
          <span><small>{i+1}</small> Ответ: <b>{part.answer}</b></span>
          <button type="button" onClick={()=>removeGap(i)} aria-label={"Убрать пропуск "+(i+1)}>Убрать ×</button>
         </div>
         {punctuation&&<label className="lektrus-language-field lektrus-language-punctuation-rule">
          Правило <small>необязательно</small>
          <select aria-label={"Правило для места "+(i+1)} value={part.rule??""}
           onChange={e=>updatePunctuationRule(i,e.target.value)}>
           <option value="">Без подсказки</option>
           {punctuationRules.map(rule=><option key={rule} value={rule}>{rule}</option>)}
          </select>
         </label>}
         {orthography&&part.answer.length<=24&&<label className="lektrus-language-choice-toggle">
          <input type="checkbox" checked={!!part.choices} onChange={e=>configureChoices(i,e.target.checked)}/>
          Два варианта под пропуском
         </label>}
         {orthography&&part.answer.length>24&&<small>Для двух вариантов выделите не более 24 букв.</small>}
         {orthography&&part.choices&&<label className="lektrus-language-distractor">
          Второй вариант
          <input value={part.choices[1]} maxLength={24} placeholder="Например, о"
           aria-label={"Неправильный вариант для пропуска "+(i+1)}
           onChange={e=>updateDistractor(i,e.target.value)}/>
          {part.choices[1]&&part.choices[1].toLocaleLowerCase("ru-RU")===part.answer.toLocaleLowerCase("ru-RU")&&
           <small>Варианты должны отличаться.</small>}
         </label>}
        </div>)}
      </div>
     </div>}
     {selectionHint&&<p className="lektrus-language-studio-help" role="status">{selectionHint}</p>}
     {gapState?.issue&&<p className="lektrus-language-studio-warning" role="status">{gapState.issue}</p>}
    </>}
    {integrated&&activity&&<section className="lektrus-language-mode-picker">
     <strong>Способ выполнения</strong>
     <div className="lektrus-language-mode-buttons" role="group" aria-label="Способ выполнения">
      {interactiveModesForSubject(tone).map(mode=><button key={mode} type="button"
       className={activity.mode===mode?"selected":""} aria-pressed={activity.mode===mode}
       onClick={()=>{patch({activity:freshActivity(mode),activityResponse:undefined});setPreviewAnswer({});}}>
       {activityTitles[mode]}</button>)}
     </div>
    </section>}
    {!isGap&&activity&&<LektrusSubjectActivityBuilder tone={tone} format={template.id} activity={activity}
     onChange={next=>{patch({activity:next,activityResponse:undefined});setPreviewAnswer({});}}/>}
    {template.fields.length>0&&<div className="lektrus-language-studio-fields">
     {template.fields.filter(field=>!(tone==="russian"&&template.id==="morphology"&&field.id==="target")).map(field=>{
      const content=subjectFieldInfo[tone+":"+template.id+":"+field.id]??fieldInfo[field.id];
      if(tone==="languages"&&template.id==="grammar"&&field.id==="material"){
       const sentences=(entry.details?.material??"").split(/\r?\n/).slice(0,12);
       const setSentences=(items:string[])=>changeMaterial("material",items.join("\n").slice(0,1800));
       return <div className="lektrus-language-question-editor" key={field.id}>
        <div className="lektrus-language-gap-heading"><strong>Предложения для преобразования</strong>
         <small>До 12 предложений, по одному на строку.</small></div>
        {(sentences.length?sentences:[""]).map((sentence,i)=>
         <div className="lektrus-language-question-row" key={i}>
          <span>{i+1}</span>
          <input value={sentence} maxLength={240} aria-label={"Предложение "+(i+1)}
           placeholder="Например: She reads every day."
           onChange={e=>setSentences((sentences.length?sentences:[""]).map((old,j)=>j===i?e.target.value:old))}/>
          {sentences.length>1&&<button type="button" aria-label={"Удалить предложение "+(i+1)}
           onClick={()=>setSentences(sentences.filter((_,j)=>j!==i))}>×</button>}
         </div>)}
        {sentences.length<12&&<button type="button" className="lektrus-language-add-question"
         onClick={()=>setSentences([...sentences,""])}>+ Добавить предложение</button>}
       </div>;
      }
      if(tone==="languages"&&template.id==="translation"&&field.id==="direction"){
       const directions=["На русский язык","На изучаемый язык"];
       return <div className="lektrus-language-field lektrus-language-direction" key={field.id}>
        <strong>Направление перевода</strong>
        <div>{directions.map(direction=><button key={direction} type="button"
         className={entry.details?.direction===direction?"selected":""}
         onClick={()=>changeMaterial("direction",direction)}>{direction}</button>)}</div>
        <input value={entry.details?.direction??""} maxLength={100}
         placeholder="При необходимости укажите конкретный язык"
         onChange={e=>changeMaterial("direction",e.target.value)}/>
       </div>;
      }
      if(tone==="languages"&&template.id==="grammar"&&field.id==="instruction"){
       const common=["Сделайте предложение вопросительным","Поставьте в отрицательную форму",
        "Поставьте в прошедшее время","Поставьте в будущее время",
        "Измените число","Преобразуйте в пассивную конструкцию"];
       return <div className="lektrus-language-field lektrus-language-directions" key={field.id}>
        <strong>Что изменить</strong>
        <div>{common.map(action=><button key={action} type="button"
         className={entry.details?.instruction===action?"selected":""}
         onClick={()=>changeMaterial("instruction",action)}>{action}</button>)}</div>
        <textarea rows={2} value={entry.details?.instruction??""} maxLength={500}
         placeholder="Например: преобразуйте утверждения в вопросы в Present Simple"
         onChange={e=>changeMaterial("instruction",e.target.value)}/>
       </div>;
      }
      if(field.id==="questions"&&((tone==="russian"&&template.id==="text")||(tone==="languages"&&template.id==="reading"))){
       const questions=(entry.details?.questions??"").split(/\r?\n/).slice(0,15);
       const setQuestions=(next:string[])=>changeMaterial("questions",next.join("\n"));
       return <div className="lektrus-language-question-editor" key={field.id}>
        <div className="lektrus-language-gap-heading"><strong>{content?.label??"Вопросы"}</strong>
         <small>По одному вопросу на строку.</small></div>
        {(questions.length?questions:[""]).map((question,i)=>
         <div className="lektrus-language-question-row" key={i}>
          <span>{i+1}</span>
          <input value={question} maxLength={350} aria-label={"Вопрос "+(i+1)}
           placeholder="Напишите вопрос к тексту"
           onChange={e=>setQuestions((questions.length?questions:[""]).map((old,j)=>j===i?e.target.value:old))}/>
          {questions.length>1&&<button type="button" aria-label={"Удалить вопрос "+(i+1)}
           title="Удалить вопрос" onClick={()=>setQuestions(questions.filter((_,j)=>j!==i))}>×</button>}
         </div>)}
        {questions.length<15&&<button type="button" className="lektrus-language-add-question"
         onClick={()=>setQuestions([...questions,""])}>+ Добавить вопрос</button>}
       </div>;
      }
      return <label className="lektrus-language-field" key={field.id}>
       {content?.label??field.label}
       {field.multiline||content?.rows?<textarea rows={content?.rows??4} maxLength={1800}
        value={entry.details?.[field.id]??""} placeholder={content?.hint??field.placeholder}
        onChange={e=>changeMaterial(field.id,e.target.value)}/>:
        <input maxLength={tone==="russian"&&template.id==="morphemes"&&field.id==="material"?64:1800} value={entry.details?.[field.id]??""}
         placeholder={content?.hint??field.placeholder}
         onChange={e=>changeMaterial(field.id,e.target.value)}/>}
      </label>;
     })}
     {tone==="russian"&&template.id==="morphology"&&<div className="lektrus-language-target">
      <strong>Слово для разбора</strong>
      <div role="group" aria-label="Слова предложения">
       {(entry.details?.material??"").match(/[\p{L}]+(?:[-’][\p{L}]+)*/gu)?.slice(0,60).map((word,i)=>
        <button type="button" key={i} className={word.toLocaleLowerCase("ru-RU")===(entry.details?.target??"").toLocaleLowerCase("ru-RU")?"selected":""}
         onClick={()=>changeMaterial("target",word)}>{word}</button>)}
      </div>
      <label className="lektrus-language-field">Разбираемое слово
       <input maxLength={100} value={entry.details?.target??""}
        placeholder="Выберите слово или введите"
        onChange={e=>changeMaterial("target",e.target.value)}/>
      </label>
     </div>}
     {tone==="russian"&&template.id==="morphemes"&&/\\s/.test(entry.details?.material?.trim()??"")&&
      <p className="lektrus-language-studio-warning">Для разбора по составу укажите одно слово без пробелов.</p>}
     {tone==="russian"&&template.id==="text"&&
      (entry.details?.questions?.split(/\\r?\\n/).filter(line=>line.trim()).length??0)>15&&
      <p className="lektrus-language-studio-warning">В одном задании можно задать не больше 15 вопросов.</p>}
    </div>}
   </div>
   <aside className="lektrus-language-preview" aria-label="Предпросмотр задания для ученика">
    <div className="lektrus-language-preview-header">
     <strong>На доске ученика</strong><small>Предпросмотр</small>
    </div>
    <div className="lektrus-language-preview-content">
     <strong>{entry.title.trim()||template.title}</strong>
     {entry.prompt.trim()&&<p className="lektrus-language-preview-instruction">{entry.prompt}</p>}
     {template.fields.filter(()=>!(tone==="russian"&&["morphemes","morphology","syntax"].includes(template.id))&&
      !(tone==="languages"&&["translation","grammar","reading"].includes(template.id))).map(field=>(entry.details?.[field.id]?.trim()?
      <div key={field.id} className="lektrus-language-preview-material">
       <small>{subjectFieldInfo[tone+":"+template.id+":"+field.id]?.label??field.label}</small><p>{entry.details?.[field.id]}</p>
      </div>:null))}
     {tone==="languages"&&["translation","grammar","reading"].includes(template.id)?
       <LektrusForeignTaskAnswer entry={entry} format={template.id as "translation"|"grammar"|"reading"}
        answer={previewForeign} onChange={setPreviewForeign}/>:
      tone==="russian"&&["morphemes","morphology","syntax","text"].includes(template.id)?
       <LektrusRussianTaskAnswer entry={entry} work={previewRussian} onChange={setPreviewRussian}/>:
      activity?<LektrusSubjectActivityRunner activity={activity} response={previewAnswer}
       onChange={setPreviewAnswer} punctuation={punctuation} compact/>:
      <div className="lektrus-language-preview-answer">
       {isGap?"Добавьте хотя бы один пропуск, чтобы увидеть упражнение":"Место для письменного ответа ученика"}
      </div>}
    </div>

   </aside>
  </div>
 </div>;
}
