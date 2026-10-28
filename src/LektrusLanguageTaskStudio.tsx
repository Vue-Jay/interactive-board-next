import {useRef,useState,type CSSProperties} from "react";
import type {SubjectBoardEntry,SubjectTaskActivity,SubjectTaskActivityResponse,RussianTaskWork} from "./boardModel";
import type {SubjectTaskTemplate} from "./lektrusSubjectTaskTemplates";
import {subjectAccentPalette} from "./lektrusSubjectAccent";
import {activityMatchesTask,freshActivity,interactiveModesForSubject,
 isIntegratedInteractiveTask,preferredActivityMode,LektrusSubjectActivityBuilder,
 LektrusSubjectActivityRunner} from "./LektrusSubjectActivity";
import {isLanguageGapExercise,languageGapText,parseLanguageGapText} from "./lektrusLanguageGapModel";
import LektrusRussianTaskAnswer from "./LektrusRussianTaskAnswer";

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
 "russian:task":{title:"Свободное задание",hint:"Запишите вопрос или инструкцию. Ученик ответит на доске."},
 "russian:orthography":{title:"Найди орфограмму",hint:"Подготовьте текст, выделите трудные места. Ученик восстанавливает буквы прямо в словах и проверяет себя."},
 "russian:punctuation":{title:"Расставь знаки",hint:"Создайте предложение с пропусками. Ученик выбирает знаки из палитры или вводит их сам."},
 "russian:morphemes":{title:"Разбор слова по составу",hint:"Укажите слово. Ученик сам разделит его на морфемы и назначит обозначения."},
 "russian:morphology":{title:"Морфологический разбор",hint:"Укажите предложение и слово. Ученик разберёт его по удобному плану с признаками для выбранной части речи."},
 "russian:syntax":{title:"Разбор предложения",hint:"Введите предложение. Ученик выберет тип линии и отметит члены предложения на словах."},
 "russian:text":{title:"Работа с текстом",hint:"Разместите текст и вопросы к нему. Ученик ответит самостоятельно."},
 "russian:interactive":{title:"Интерактивная практика",hint:"Выберите способ выполнения и создайте упражнение с проверкой ответа."},
 "languages:task":{title:"Свободное задание",hint:"Запишите инструкцию. Ученик напишет ответ."},
 "languages:translation":{title:"Перевод текста",hint:"Укажите исходный текст и язык перевода. Ученик напишет перевод самостоятельно."},
 "languages:gaps":{title:"Заполнение пропусков",hint:"Выделите в тексте слова или формы, которые ученик должен вписать."},
 "languages:vocabulary":{title:"Сопоставление слов",hint:"Заполните соответствующие пары. На доске ученику предложат перемешанные варианты."},
 "languages:word-order":{title:"Составление предложения",hint:"Добавьте слова отдельно в правильном порядке. На доске они появятся перемешанными."},
 "languages:grammar":{title:"Грамматическое преобразование",hint:"Укажите предложения и требуемое изменение. Ученик запишет новые формы."},
 "languages:reading":{title:"Чтение с вопросами",hint:"Поместите текст и вопросы. Ученик читает и записывает ответы."},
 "languages:choice":{title:"Вопрос с вариантами",hint:"Создайте вопрос и варианты, обозначив правильный ответ."}
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
 const [selectionHint,setSelectionHint]=useState("");
 const selectedRef=useRef<HTMLTextAreaElement>(null);
 const punctuation=tone==="russian"&&template.id==="punctuation";
 const orthography=tone==="russian"&&template.id==="orthography";
 const note=introduction[tone+":"+template.id]??{title:template.title,hint:template.instruction};
 const defaultMode=preferredActivityMode(tone,template.id);
 const integrated=isIntegratedInteractiveTask(tone,template.id);
 const isGap=isLanguageGapExercise(tone,template.id);
 const markup=isGap?(entry.details?.markup??languageGapText(entry.activity)):"";
 const gapState=isGap?parseLanguageGapText(markup):null;
 const activity=isGap?gapState?.activity:(defaultMode?
  (activityMatchesTask(tone,template.id,entry.activity)?entry.activity:freshActivity(defaultMode)):undefined);
 const patch=(next:Partial<SubjectBoardEntry>)=>onChange({...entry,...next,subject:tone});
 const changeMaterial=(id:string,value:string)=>patch({details:{...entry.details,[id]:value}});
 const changeMarkup=(value:string)=>{
  const parsed=parseLanguageGapText(value);
  patch({details:{...entry.details,markup:value},activity:parsed.activity,activityResponse:undefined});
  setPreviewAnswer({});
  setSelectionHint("");
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
  if(orthography&&!/[\\p{L}]/u.test(selection)){setSelectionHint("Для орфографии выделите букву или часть слова");return;}
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
   <span className="lektrus-language-studio-number">01</span>
   <div><strong>{note.title}</strong><p>{note.hint}</p></div>
  </div>
  <div className={"lektrus-language-studio-layout"+(tone==="russian"&&["morphemes","syntax","morphology"].includes(template.id)?" lektrus-language-wide-preview":"")}>
   <div className="lektrus-language-author">
    {promptNeeded&&<label className="lektrus-language-field">Инструкция ученику <small>Необязательно, если вид задания очевиден</small>
      <textarea rows={2} value={entry.prompt} maxLength={2500}
       placeholder="Кратко объясните, что требуется выполнить"
       onChange={e=>patch({prompt:e.target.value})}/>
     </label>}
    {template.id==="task"&&<label className="lektrus-language-field">Задание для ученика
      <textarea rows={5} value={entry.prompt} maxLength={2500}
       placeholder="Сформулируйте вопрос или упражнение"
       onChange={e=>patch({prompt:e.target.value})}/>
     </label>}
    {isGap&&<>
     <div className="lektrus-language-gap-heading">
      <strong>{punctuation?"Предложение со знаками":"Текст упражнения"}</strong>
      <small>{punctuation?"Выделите готовый знак или поставьте курсор между словами и нажмите на знак в палитре.":"Введите текст, затем выделите букву, часть слова или целое слово."}</small>
     </div>
     <textarea className="lektrus-language-gap-source" ref={selectedRef} rows={8} maxLength={1800}
      aria-label="Текст упражнения для создания пропусков" value={markup}
      placeholder={punctuation?"Напишите предложение. Выделите существующий знак или выберите место для нового.":"Напишите слова или предложения, затем выделите орфограммы."}
      onChange={e=>changeMarkup(e.target.value)}/>
     <div className="lektrus-language-gap-actions">
      <button type="button" onMouseDown={e=>e.preventDefault()} onClick={markSelected}>
       <span aria-hidden="true">▱</span> {punctuation?"Сделать пропуск из знака":"Сделать пропуск из выделения"}
      </button>
     </div>
     {punctuation&&<div className="lektrus-language-punctuation-editor">
      <strong>Добавить место для знака</strong>
      <div role="group" aria-label="Вставка знака препинания">
       {[",",".",":",";","—","?","!","«","»","(",")"].map(mark=>
        <button type="button" key={mark} onMouseDown={e=>e.preventDefault()}
         title={"Добавить скрытый знак "+mark} onClick={()=>insertPunctuation(mark)}>{mark}</button>)}
      </div>
      <small>Поставьте курсор в нужное место. Знак появится как пропуск с правильным ответом для проверки.</small>
     </div>}
     {gapState&&gapState.count>0&&!gapState.issue&&<div className="lektrus-language-gaps-list">
      <strong>Скрытые фрагменты <span>{gapState.count}/8</span></strong>
      <div>{gapState.activity?.blanks?.map((part,i)=>
       <button type="button" key={i} aria-label={"Вернуть в текст фрагмент "+part.answer}
        title="Вернуть фрагмент в текст" onClick={()=>removeGap(i)}>
        <small>{i+1}</small> {part.answer} <span aria-hidden="true">×</span>
       </button>)}</div>
      <small>Нажмите на фрагмент, чтобы вернуть его в текст. Ответы ученику не показываются.</small>
     </div>}
     {selectionHint&&<p className="lektrus-language-studio-help" role="status">{selectionHint}</p>}
     {gapState?.issue&&<p className="lektrus-language-studio-warning" role="status">{gapState.issue}</p>}
     {gapState&&gapState.count>0&&!gapState.issue&&<p className="lektrus-language-studio-ready">
      <span aria-hidden="true">✓</span> Задание готово: {gapState.count} {gapState.count===1?"пропуск":"пропусков"}.
     </p>}
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
      <strong>Выберите слово для разбора</strong>
      <small>Нажмите на слово из предложения или введите своё ниже</small>
      <div role="group" aria-label="Слова предложения">
       {(entry.details?.material??"").match(/[\\p{L}]+(?:[-’][\\p{L}]+)*/gu)?.slice(0,60).map((word,i)=>
        <button type="button" key={i} className={word.toLocaleLowerCase("ru-RU")===(entry.details?.target??"").toLocaleLowerCase("ru-RU")?"selected":""}
         onClick={()=>changeMaterial("target",word)}>{word}</button>)}
      </div>
      <label className="lektrus-language-field">Разбираемое слово
       <input maxLength={100} value={entry.details?.target??""}
        placeholder="Выберите слово выше или введите вручную"
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
     <span className="lektrus-language-studio-number">02</span>
     <div><strong>На доске ученика</strong><small>Интерактивный предпросмотр задания</small></div>
    </div>
    <div className="lektrus-language-preview-content">
     <strong>{entry.title.trim()||template.title}</strong>
     {entry.prompt.trim()&&<p className="lektrus-language-preview-instruction">{entry.prompt}</p>}
     {template.fields.filter(field=>!(tone==="russian"&&["morphemes","morphology","syntax"].includes(template.id))).map(field=>(entry.details?.[field.id]?.trim()?
      <div key={field.id} className="lektrus-language-preview-material">
       <small>{subjectFieldInfo[tone+":"+template.id+":"+field.id]?.label??field.label}</small><p>{entry.details?.[field.id]}</p>
      </div>:null))}
     {tone==="russian"&&["morphemes","morphology","syntax","text"].includes(template.id)?
       <LektrusRussianTaskAnswer entry={entry} work={previewRussian} onChange={setPreviewRussian}/>:
      activity?<LektrusSubjectActivityRunner activity={activity} response={previewAnswer}
       onChange={setPreviewAnswer} punctuation={punctuation} orthography={orthography} compact/>:
      <div className="lektrus-language-preview-answer">
       {isGap?"Добавьте хотя бы один пропуск, чтобы увидеть упражнение":"Место для письменного ответа ученика"}
      </div>}
    </div>
    <div className="lektrus-language-preview-foot">Предпросмотр не изменяет ответы учеников</div>
   </aside>
  </div>
 </div>;
}
