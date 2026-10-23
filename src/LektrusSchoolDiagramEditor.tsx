import {compatibleRandomUUID} from "./cryptoUuidCompatibility";
import {useEffect,useState} from "react";
import {createPortal} from "react-dom";
import type {Item} from "./boardModel";
import type {CellOrganelle,FoodRole,SchoolDiagram,SchoolDiagramId} from "./lektrusSchoolDiagramModel";
import {isSchoolDiagram,isSchoolDiagramId,makeSchoolDiagram,months,organelleTitles} from "./lektrusSchoolDiagramModel";
import {normalizeAtlasDocument} from "./lektrusAtlasModel";
import LektrusContourAssignmentSetup from "./LektrusContourAssignmentSetup";
import LektrusSchoolDiagramView from "./LektrusSchoolDiagramView";
import LektrusNextSchoolControls from "./LektrusNextSchoolControls";
import LektrusFurtherSchoolControls from "./LektrusFurtherSchoolControls";
import LektrusApprovedSchoolControls from "./LektrusApprovedSchoolControls";
import LektrusRussianSchoolControls from "./LektrusRussianSchoolControls";
import LektrusLanguageSocialControls from "./LektrusLanguageSocialControls";
import LektrusBiologyExtensionControls from "./LektrusBiologyExtensionControls";
import LektrusLogicCircuitControls from "./LektrusLogicCircuitControls";
import LektrusProgrammingControls from "./LektrusProgrammingControls";
import LektrusGeographyTrainingControls from "./LektrusGeographyTrainingControls";
type Props={item:Item;existing:boolean;studentMode?:boolean;userId?:string;onCancel:()=>void;onSave:(item:Item)=>void};
const max=(s:string,n:number)=>s.slice(0,n);
const roleNames:Record<FoodRole,string>={producer:"Продуцент",consumer:"Консумент",decomposer:"Редуцент"};
const keys=(cell:"plant"|"animal"):CellOrganelle[]=>cell==="plant"?
 ["wall","membrane","cytoplasm","nucleus","vacuole","chloroplast","mitochondria"]:
 ["membrane","cytoplasm","nucleus","mitochondria"];
const titles:Record<SchoolDiagramId,string>={
 "info-programming":"Программирование",
 "info-circuit":"Логические схемы",
 "bio-dna":"Строение ДНК","bio-taxonomy":"Классификация организмов",
 "bio-division":"Деление клетки","info-encoding":"Кодирование текста",
 "bio-genetics":"Генетические скрещивания","info-logic":"Таблица истинности",
 "bio-cell":"Строение клетки","bio-food-chain":"Цепь питания",
 "geo-climate":"Климатограмма","history-timeline":"Лента времени",
 "ru-syntax":"Разбор предложения","info-flowchart":"Блок-схема алгоритма",
 "info-place-value":"Разрядная таблица",
 "bio-organ-systems":"Системы органов","geo-relief-profile":"Профиль рельефа",
 "ru-morphemes":"Разбор слова по составу","history-family-tree":"Генеалогическое дерево",
 "language-flashcards":"Карточки иностранных слов",
 "ru-morphology":"Морфологический разбор","ru-phonetics":"Фонетический разбор",
 "ru-orthography":"Орфографический тренажёр",
 "maps-atlas":"Географические карты","contour-atlas":"Контурная карта","history-atlas":"Исторические карты",
 "geo-matching":"Сопоставление","geo-question-cards":"Карточки вопросов",
 "ru-sentence-builder":"Конструктор предложений","language-sentence-builder":"Составление предложений","civics-structure":"Государственное устройство и общество","literature-analysis":"Анализ произведения"
};
const newKey=()=>compatibleRandomUUID();
export default function LektrusSchoolDiagramEditor({item,existing,studentMode=false,userId="",onCancel,onSave}:Props){
 const id=isSchoolDiagramId(item.graphFigureId)?item.graphFigureId:"bio-cell";
 const [draft,setDraft]=useState<SchoolDiagram>(()=>{
  if(isSchoolDiagram(item.schoolDiagram)){
   const saved=structuredClone(item.schoolDiagram);
   return saved.kind==="atlas"?normalizeAtlasDocument(saved):saved;
  }
  return makeSchoolDiagram(id);
 });
 const isAtlas=id==="maps-atlas"||id==="contour-atlas"||id==="history-atlas";
 const isContour=id==="contour-atlas";
 const [error,setError]=useState("");
 const [contourSettingsOpen,setContourSettingsOpen]=useState(false);
 const set=(data:SchoolDiagram)=>{setDraft(data);setError("")};
 const finish=()=>{
  if(draft.kind==="geo-training"&&draft.countryCodes.length<2){
   setError("Выберите не менее двух стран вручную или сгенерируйте задание.");return;
  }
  if(isContour&&!studentMode&&draft.kind==="atlas"&&!draft.contourTask?.trim()){
   setError("Напишите задание для ученика.");return;
  }
  if(!isSchoolDiagram(draft)){setError("Проверьте данные: название, количество элементов и значения.");return}
  onSave({...item,schoolDiagram:structuredClone(draft),text:draft.title});
 };
 // Geography exercises are only committed with the explicit Save button.
 // Closing the editor must not persist a partially generated question set.
 const close=()=>{if(isContour||draft.kind==="geo-training"){onCancel();return}if(existing)finish();else onCancel()};
 useEffect(()=>{
  const onKey=(e:KeyboardEvent)=>{
   if(e.key==="Escape"){e.preventDefault();e.stopImmediatePropagation();close()}
  };
  window.addEventListener("keydown",onKey,true);
  return()=>window.removeEventListener("keydown",onKey,true);
 });
 if(isContour&&!existing&&draft.kind==="atlas")return createPortal(
  <div className="lektrus-school-backdrop lektrus-contour-task-backdrop" role="presentation"
   onPointerDown={e=>e.stopPropagation()}>
   <section className="lektrus-school-editor lektrus-school-editor--contour-task lektrus-contour-create-preview"
    role="dialog" aria-modal="true" aria-labelledby="lektrus-contour-create-title">
    <header className="lektrus-school-header">
     <h2 id="lektrus-contour-create-title">Создать задание по контурной карте</h2>
     <button type="button" className="lektrus-school-close" aria-label="Закрыть без сохранения"
      onClick={onCancel}>×</button>
    </header>
    <div className="lektrus-contour-create-body">
     <div className="lektrus-contour-create-fields">
      <LektrusContourAssignmentSetup value={draft} onChange={set}/>
     </div>
     <div className="lektrus-contour-create-preview-pane">
      <div className="lektrus-contour-create-preview-heading">
       <strong>Предпросмотр карты</strong><small>Так карта будет выглядеть после добавления на доску</small>
      </div>
      <div className="lektrus-contour-create-preview-map">
       <LektrusSchoolDiagramView diagram={draft}/>
      </div>
     </div>
    </div>
    <footer className="lektrus-school-footer">
     {error&&<span className="lektrus-contour-task-error" role="alert">{error}</span>}
     <button type="button" className="lektrus-school-secondary" onClick={onCancel}>Отмена</button>
     <button type="button" className="lektrus-school-primary" onClick={finish}>Добавить на доску</button>
    </footer>
   </section>
  </div>,document.body);
 if(isContour&&draft.kind==="atlas")return createPortal(
  <div className="lektrus-school-backdrop lektrus-contour-editor-backdrop" role="presentation"
   onPointerDown={e=>e.stopPropagation()}>
   <section className="lektrus-school-editor lektrus-contour-editor-fullscreen"
    role="dialog" aria-modal="true" aria-labelledby="lektrus-contour-editor-heading">
    <header className="lektrus-contour-editor-header">
     <div className="lektrus-contour-editor-title">
      <span>КОНТУРНАЯ КАРТА</span>
      <h2 id="lektrus-contour-editor-heading">{studentMode?"Выполнение задания: "+(draft.title||"Контурная карта"):draft.title||"Контурная карта"}</h2>
     </div>
     <div className="lektrus-contour-editor-header-actions">
      {!studentMode&&<button type="button" className={contourSettingsOpen?"active":""}
       aria-expanded={contourSettingsOpen} aria-controls="lektrus-contour-editor-options"
       onClick={()=>setContourSettingsOpen(v=>!v)}>⚙ Задание и подложка</button>}
      <button type="button" className="lektrus-contour-editor-close" aria-label="Закрыть без сохранения"
       title="Закрыть без сохранения" onClick={onCancel}>×</button>
     </div>
    </header>
    <div className="lektrus-contour-editor-main">
     {!studentMode&&contourSettingsOpen&&<aside className="lektrus-contour-editor-options"
      id="lektrus-contour-editor-options" aria-label="Настройки задания">
      <div className="lektrus-contour-editor-options-heading">
       <strong>Настройки задания</strong>
       <button type="button" aria-label="Закрыть настройки задания"
        onClick={()=>setContourSettingsOpen(false)}>×</button>
      </div>
      <LektrusContourAssignmentSetup value={draft} onChange={set}/>
     </aside>}
     <div className="lektrus-contour-editor-map">
      <LektrusSchoolDiagramView diagram={draft} onChange={set} editorMode userId={userId}/>
     </div>
    </div>
    <footer className="lektrus-contour-editor-footer">
     {error?<span className="lektrus-contour-task-error" role="alert">{error}</span>:
      <span className="lektrus-contour-editor-hint">Редактируйте карту здесь. После сохранения на доске останется только карта, без инструментов.</span>}
     <div className="lektrus-contour-editor-footer-actions">
      <button type="button" className="lektrus-school-secondary" onClick={onCancel}>Отмена</button>
      <button type="button" className="lektrus-school-primary" onClick={finish}>
       {existing?"Сохранить изменения":"Сохранить на доску"}
      </button>
     </div>
    </footer>
   </section>
  </div>,document.body);
 const title=<label className="lektrus-school-field">Название схемы
  <input value={draft.title} maxLength={120} onChange={e=>set({...draft,title:max(e.target.value,120)})}
   placeholder="Введите название учебной схемы"/></label>;
 return createPortal(<div className="lektrus-school-backdrop" role="presentation" onPointerDown={e=>e.stopPropagation()}>
  <section className={"lektrus-school-editor"+(isAtlas?" lektrus-school-editor--atlas":"")+(isContour?" lektrus-school-editor--contour-setup":"")} role="dialog" aria-modal="true" aria-label={"Редактор: "+titles[id]}>
   <header className="lektrus-school-header">
    <div className={isAtlas?"lektrus-atlas-editor-heading":undefined}>{isAtlas&&<div className="lektrus-atlas-editor-kicker">ИНТЕРАКТИВНЫЙ АТЛАС</div>}<h2>{titles[id]}</h2><span>{id==="history-atlas"?"История · 5–11 класс":id==="maps-atlas"?"География · 5–11 класс":id==="geo-matching"||id==="geo-question-cards"?"География · 5–11 класс":(id==="bio-dna"||id==="bio-taxonomy")?"Биология · 6–11 класс":id==="bio-division"?"Биология · 9–11 класс":id==="info-encoding"?"Информатика · 7–11 класс":id==="bio-genetics"?"Биология · 9–11 класс":id==="info-logic"?"Информатика · 8–11 класс":id==="bio-cell"?"Биология · 5–6 класс":id==="bio-food-chain"?"Биология · 5–9 класс":id==="geo-climate"?"География · 6–8 класс":id==="history-timeline"?"История · 5–9 класс":id==="ru-syntax"?"Русский язык · 5–9 класс":id.startsWith("info-")?"Информатика · 5–9 класс":id==="bio-organ-systems"?"Биология · 8 класс":id==="ru-morphemes"?"Русский язык · 5–6 класс":id.startsWith("ru-")?"Русский язык · 5–9 класс":id==="history-family-tree"?"История и обществознание · 5–9 класс":id==="literature-analysis"?"Литература · 5–11 класс":id==="civics-structure"?"Обществознание · 6–11 класс":(id==="language-flashcards"||id==="language-sentence-builder")?"Иностранный язык · 2–11 класс":"География · 6–8 класс"}</span></div>
    <button type="button" className="lektrus-school-close" onClick={close} aria-label={draft.kind==="geo-training"?"Закрыть без сохранения":existing?"Сохранить и закрыть":"Отменить создание"}>×</button>
   </header>
   <div className="lektrus-school-body">
    {!isAtlas&&<div className="lektrus-school-controls">
     {title}
     {draft.kind==="programming"&&<LektrusProgrammingControls diagram={draft} onChange={set}/>}
     {draft.kind==="logic-circuit"&&<LektrusLogicCircuitControls diagram={draft} onChange={set}/>}
     {(draft.kind==="dna"||draft.kind==="taxonomy")&&<LektrusBiologyExtensionControls diagram={draft} onChange={set}/>}
     {(draft.kind==="syntax"||draft.kind==="flowchart"||draft.kind==="place-value")&&<LektrusNextSchoolControls diagram={draft} onChange={set}/>}
     {(draft.kind==="organs"||draft.kind==="relief")&&<LektrusFurtherSchoolControls diagram={draft} onChange={set}/>}
     {(draft.kind==="morphemes"||draft.kind==="family-tree"||draft.kind==="flashcards")&&<LektrusApprovedSchoolControls diagram={draft} onChange={set}/>}
      {draft.kind==="geo-training"&&<LektrusGeographyTrainingControls diagram={draft} onChange={set}/>}
     {(draft.kind==="morphology"||draft.kind==="phonetics"||draft.kind==="orthography")&&<LektrusRussianSchoolControls diagram={draft} onChange={set}/>}
     {(draft.kind==="sentence-builder"||draft.kind==="state-structure")&&<LektrusLanguageSocialControls diagram={draft} onChange={set}/>}
     {draft.kind==="division"&&<><label className="lektrus-school-field">Фаза митоза<select value={draft.phase} onChange={e=>set({...draft,phase:e.target.value as typeof draft.phase})}>{[["interphase","Интерфаза (перед митозом)"],["prophase","Профаза"],["metaphase","Метафаза"],["anaphase","Анафаза"],["telophase","Телофаза"]].map(([v,n])=><option key={v} value={v}>{n}</option>)}</select></label><label className="lektrus-school-toggle"><input type="checkbox" checked={draft.showLabels} onChange={e=>set({...draft,showLabels:e.target.checked})}/>Показывать пояснение</label><p className="lektrus-school-hint">Схематическое представление митоза животной клетки. Интерфаза предшествует митозу.</p></>}
     {draft.kind==="encoding"&&<><label className="lektrus-school-field">Текст (до 12 символов)<input maxLength={12} value={draft.message} onChange={e=>set({...draft,message:[...e.target.value].slice(0,12).join("")})}/></label><label className="lektrus-school-field">Представление<select value={draft.mode} onChange={e=>set({...draft,mode:e.target.value as typeof draft.mode})}><option value="unicode">Кодовые точки Unicode</option><option value="utf8">Байты UTF-8</option></select></label><label className="lektrus-school-toggle"><input type="checkbox" checked={draft.showCodes} onChange={e=>set({...draft,showCodes:e.target.checked})}/>Показывать коды</label></>}
     {draft.kind==="genetics"&&<><label className="lektrus-school-field">Первый родитель (два аллеля одного гена)<input maxLength={2} value={draft.parentA} onChange={e=>set({...draft,parentA:e.target.value})}/></label><label className="lektrus-school-field">Второй родитель<input maxLength={2} value={draft.parentB} onChange={e=>set({...draft,parentB:e.target.value})}/></label><p className="lektrus-school-hint">Модель моногибридного скрещивания для одного гена. Примеры: AA, Aa, aa. Родительские генотипы должны содержать аллели одного гена.</p><label className="lektrus-school-toggle"><input type="checkbox" checked={draft.showAnswers} onChange={e=>set({...draft,showAnswers:e.target.checked})}/>Показывать генотипы потомства</label></>}
     {draft.kind==="logic"&&<><label className="lektrus-school-field">Логическая операция<select value={draft.operation} onChange={e=>set({...draft,operation:e.target.value as typeof draft.operation})}>{[["and","И (конъюнкция)"],["or","ИЛИ (дизъюнкция)"],["xor","Исключающее ИЛИ"],["implication","Импликация"],["equivalence","Эквивалентность"]].map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></label><label className="lektrus-school-field">Значение A<select value={draft.inputA??0} onChange={e=>set({...draft,inputA:Number(e.target.value) as 0|1})}><option value={0}>0, ложь</option><option value={1}>1, истина</option></select></label><label className="lektrus-school-field">Значение B<select value={draft.inputB??0} onChange={e=>set({...draft,inputB:Number(e.target.value) as 0|1})}><option value={0}>0, ложь</option><option value={1}>1, истина</option></select></label><p className="lektrus-school-hint">Выбранная комбинация выделяется в таблице истинности.</p><label className="lektrus-school-toggle"><input type="checkbox" checked={draft.showAnswers} onChange={e=>set({...draft,showAnswers:e.target.checked})}/>Показать столбец ответов</label></>}
     {draft.kind==="cell"&&<>
      <label className="lektrus-school-field">Тип клетки
       <select value={draft.cell} onChange={e=>{
        const cell=e.target.value as "plant"|"animal";
        set({...draft,cell,title:cell==="plant"?"Растительная клетка":"Животная клетка",visible:keys(cell)});
       }}><option value="plant">Растительная</option><option value="animal">Животная</option></select>
      </label>
      <div className="lektrus-school-controls-heading">Что показать на схеме</div>
      <div className="lektrus-school-checks">{keys(draft.cell).map(key=>
       <label key={key}><input type="checkbox" checked={draft.visible.includes(key)}
        onChange={e=>set({...draft,visible:e.target.checked?[...draft.visible,key]:draft.visible.filter(v=>v!==key)})}/>
        {organelleTitles[key]}</label>)}</div>
      <label className="lektrus-school-toggle"><input type="checkbox" checked={draft.showLabels}
       onChange={e=>set({...draft,showLabels:e.target.checked})}/> Подписи частей клетки</label>
      <p className="lektrus-school-hint">Схематическая модель. Размеры органоидов условны. Можно скрыть названия для задания ученику.</p>
     </>}
     {draft.kind==="food-chain"&&<>
      <div className="lektrus-school-controls-heading">Организмы от пищи к потребителю</div>
      {draft.organisms.map((entry,i)=><div className="lektrus-school-edit-row" key={entry.id}>
       <span className="lektrus-school-number">{i+1}</span>
       <div className="lektrus-school-edit-content">
        <input aria-label={"Организм "+(i+1)} value={entry.name} maxLength={45}
         onChange={e=>set({...draft,organisms:draft.organisms.map(o=>o.id===entry.id?{...o,name:max(e.target.value,45)}:o)})}/>
        <select aria-label={"Роль "+(i+1)} value={entry.role} onChange={e=>set({...draft,
         organisms:draft.organisms.map(o=>o.id===entry.id?{...o,role:e.target.value as FoodRole}:o)})}>
         {Object.entries(roleNames).map(([value,label])=><option key={value} value={value}>{label}</option>)}
        </select>
       </div>
       <div className="lektrus-school-row-actions">
        <button type="button" disabled={i===0} title="Переместить раньше" onClick={()=>{
         const list=[...draft.organisms];[list[i-1],list[i]]=[list[i],list[i-1]];set({...draft,organisms:list})}}>↑</button>
        <button type="button" disabled={i===draft.organisms.length-1} title="Переместить позже" onClick={()=>{
         const list=[...draft.organisms];[list[i+1],list[i]]=[list[i],list[i+1]];set({...draft,organisms:list})}}>↓</button>
        <button type="button" disabled={draft.organisms.length<=2} title="Удалить" onClick={()=>
         set({...draft,organisms:draft.organisms.filter(o=>o.id!==entry.id)})}>×</button>
       </div>
      </div>)}
      <button type="button" className="lektrus-school-add" disabled={draft.organisms.length>=6}
       onClick={()=>set({...draft,organisms:[...draft.organisms,{id:newKey(),name:"Новый организм",role:"consumer"}]})}>
       + Добавить организм ({draft.organisms.length}/6)</button>
      <label className="lektrus-school-toggle"><input type="checkbox" checked={draft.showRoles}
       onChange={e=>set({...draft,showRoles:e.target.checked})}/> Показывать роли организмов</label>
      <p className="lektrus-school-hint">Стрелка означает перенос вещества и энергии от съеденного организма к потребителю. Последовательность определяет учитель, программа её не подсказывает.</p>
     </>}
     {draft.kind==="climate"&&<>
      <div className="lektrus-school-controls-heading">Данные по месяцам</div>
      <div className="lektrus-school-climate-head"><span>Месяц</span><span>Температура, °C</span><span>Осадки, мм</span></div>
      <div className="lektrus-school-climate-grid">{draft.months.map((month,i)=><div key={i} className="lektrus-school-climate-row">
       <span>{months[i]}</span>
       <input type="number" step="1" min="-70" max="60" aria-label={months[i]+" температура"}
        value={month.temperature} onChange={e=>set({...draft,months:draft.months.map((m,j)=>j===i?
         {...m,temperature:Math.max(-70,Math.min(60,Number(e.target.value)||0))}:m)})}/>
       <input type="number" step="1" min="0" max="1000" aria-label={months[i]+" осадки"}
        value={month.precipitation} onChange={e=>set({...draft,months:draft.months.map((m,j)=>j===i?
         {...m,precipitation:Math.max(0,Math.min(1000,Number(e.target.value)||0))}:m)})}/>
      </div>)}</div>
      <label className="lektrus-school-toggle"><input type="checkbox" checked={draft.showLegend}
       onChange={e=>set({...draft,showLegend:e.target.checked})}/> Легенда графика</label>
      <p className="lektrus-school-hint">На графике красная линия показывает температуру, синие столбцы осадки. Исходные значения демонстрационные, не относятся к реальному городу. Введите свои данные наблюдений.</p>
     </>}
     {draft.kind==="timeline"&&<>
      <div className="lektrus-school-controls-heading">Исторические события</div>
      {[...draft.events].sort((a,b)=>a.year-b.year).map((entry,i)=><div className="lektrus-school-edit-row" key={entry.id}>
       <span className="lektrus-school-number">{i+1}</span>
       <div className="lektrus-school-edit-content">
        <input type="number" step="1" min="-3000" max="2100" aria-label={"Год события "+(i+1)}
         value={entry.year} onChange={e=>set({...draft,events:draft.events.map(v=>v.id===entry.id?
          {...v,year:Math.max(-3000,Math.min(2100,Number(e.target.value)||1))}:v)})}/>
        <input value={entry.label} maxLength={90} aria-label={"Название события "+(i+1)}
         onChange={e=>set({...draft,events:draft.events.map(v=>v.id===entry.id?{...v,label:max(e.target.value,90)}:v)})}/>
       </div>
       <button type="button" className="lektrus-school-delete" disabled={draft.events.length<=2}
        onClick={()=>set({...draft,events:draft.events.filter(v=>v.id!==entry.id)})}>×</button>
      </div>)}
      <button type="button" className="lektrus-school-add" disabled={draft.events.length>=8}
       onClick={()=>set({...draft,events:[...draft.events,{id:newKey(),year:1900,label:"Новое событие"}]})}>
       + Добавить событие ({draft.events.length}/8)</button>
      <label className="lektrus-school-toggle"><input type="checkbox" checked={draft.showEra}
       onChange={e=>set({...draft,showEra:e.target.checked})}/> Подписи эры (до н. э. / г.)</label>
      <p className="lektrus-school-hint">События автоматически упорядочиваются по годам. Для дат до нашей эры вводите отрицательный год, например −500. Нулевого года нет. Длина интервалов на рисунке условна.</p>
     </>}
    </div>}
    <div className="lektrus-school-preview-area">
     {!isAtlas&&<div className="lektrus-school-preview-heading"><strong>Предпросмотр</strong><span>Так объект будет выглядеть на доске</span></div>}
     <div className="lektrus-school-preview"><LektrusSchoolDiagramView diagram={draft} onChange={isAtlas?set:undefined} editorMode={isAtlas} userId={userId}/></div>
    </div>
   </div>
   <footer className="lektrus-school-footer">
    <span>{error||(isContour?"Задание, территория, содержание подложки и инструменты ученика сохранятся при добавлении карты.":isAtlas?"Перемещайте карту и изменяйте масштаб. Вид сохранится после добавления.":"Изменения видны в предпросмотре. На доску объект попадает после сохранения.")}</span>
    <button type="button" className="lektrus-school-secondary" onClick={close}>{draft.kind==="geo-training"?"Отмена":existing?"Закрыть":"Отмена"}</button>
    <button type="button" className="lektrus-school-primary" onClick={finish}>{existing?"Сохранить изменения":"Вывести на доску"}</button>
   </footer>
  </section>
 </div>,document.body);
}
