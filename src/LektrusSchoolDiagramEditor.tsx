import {useEffect,useState} from "react";
import {createPortal} from "react-dom";
import type {Item} from "./boardModel";
import type {CellOrganelle,FoodRole,SchoolDiagram,SchoolDiagramId} from "./lektrusSchoolDiagramModel";
import {isSchoolDiagram,isSchoolDiagramId,makeSchoolDiagram,months,organelleTitles} from "./lektrusSchoolDiagramModel";
import LektrusSchoolDiagramView from "./LektrusSchoolDiagramView";
import LektrusNextSchoolControls from "./LektrusNextSchoolControls";
import LektrusFurtherSchoolControls from "./LektrusFurtherSchoolControls";
import LektrusApprovedSchoolControls from "./LektrusApprovedSchoolControls";
import LektrusRussianSchoolControls from "./LektrusRussianSchoolControls";
import LektrusLanguageSocialControls from "./LektrusLanguageSocialControls";
import LektrusMapAtlasControls from "./LektrusMapAtlasControls";
type Props={item:Item;existing:boolean;onCancel:()=>void;onSave:(item:Item)=>void};
const max=(s:string,n:number)=>s.slice(0,n);
const roleNames:Record<FoodRole,string>={producer:"Продуцент",consumer:"Консумент",decomposer:"Редуцент"};
const keys=(cell:"plant"|"animal"):CellOrganelle[]=>cell==="plant"?
 ["wall","membrane","cytoplasm","nucleus","vacuole","chloroplast","mitochondria"]:
 ["membrane","cytoplasm","nucleus","mitochondria"];
const titles:Record<SchoolDiagramId,string>={
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
 "ru-sentence-builder":"Конструктор предложений","language-sentence-builder":"Составление предложений","civics-structure":"Государственное устройство и общество","literature-analysis":"Анализ произведения"
};
const newKey=()=>crypto.randomUUID();
export default function LektrusSchoolDiagramEditor({item,existing,onCancel,onSave}:Props){
 const id=isSchoolDiagramId(item.graphFigureId)?item.graphFigureId:"bio-cell";
 const [draft,setDraft]=useState<SchoolDiagram>(()=>{
  if(isSchoolDiagram(item.schoolDiagram))return structuredClone(item.schoolDiagram);
  return makeSchoolDiagram(id);
 });
 const [error,setError]=useState("");
 const set=(data:SchoolDiagram)=>{setDraft(data);setError("")};
 const finish=()=>{
  if(!isSchoolDiagram(draft)){setError("Проверьте данные: название, количество элементов и значения.");return}
  onSave({...item,schoolDiagram:structuredClone(draft),text:draft.title});
 };
 const close=()=>{if(existing)finish();else onCancel()};
 useEffect(()=>{
  const onKey=(e:KeyboardEvent)=>{
   if(e.key==="Escape"){e.preventDefault();e.stopImmediatePropagation();close()}
  };
  window.addEventListener("keydown",onKey,true);
  return()=>window.removeEventListener("keydown",onKey,true);
 });
 const title=<label className="lektrus-school-field">Название схемы
  <input value={draft.title} maxLength={120} onChange={e=>set({...draft,title:max(e.target.value,120)})}
   placeholder="Введите название учебной схемы"/></label>;
 return createPortal(<div className="lektrus-school-backdrop" role="presentation" onPointerDown={e=>e.stopPropagation()}>
  <section className="lektrus-school-editor" role="dialog" aria-modal="true" aria-label={"Редактор: "+titles[id]}>
   <header className="lektrus-school-header">
    <div><h2>{titles[id]}</h2><span>{id==="history-atlas"?"История · 5–11 класс":id==="maps-atlas"?"География · 5–11 класс":id==="bio-division"?"Биология · 9–11 класс":id==="info-encoding"?"Информатика · 7–11 класс":id==="bio-genetics"?"Биология · 9–11 класс":id==="info-logic"?"Информатика · 8–11 класс":id==="bio-cell"?"Биология · 5–6 класс":id==="bio-food-chain"?"Биология · 5–9 класс":id==="geo-climate"?"География · 6–8 класс":id==="history-timeline"?"История · 5–9 класс":id==="ru-syntax"?"Русский язык · 5–9 класс":id.startsWith("info-")?"Информатика · 5–9 класс":id==="bio-organ-systems"?"Биология · 8 класс":id==="ru-morphemes"?"Русский язык · 5–6 класс":id.startsWith("ru-")?"Русский язык · 5–9 класс":id==="history-family-tree"?"История и обществознание · 5–9 класс":id==="literature-analysis"?"Литература · 5–11 класс":id==="civics-structure"?"Обществознание · 6–11 класс":(id==="language-flashcards"||id==="language-sentence-builder")?"Иностранный язык · 2–11 класс":"География · 6–8 класс"}</span></div>
    <button type="button" className="lektrus-school-close" onClick={close} aria-label={existing?"Сохранить и закрыть":"Отменить создание"}>×</button>
   </header>
   <div className="lektrus-school-body">
    <div className="lektrus-school-controls">
     {title}
     {draft.kind==="atlas"&&<LektrusMapAtlasControls diagram={draft} onChange={set}/>}
     {(draft.kind==="syntax"||draft.kind==="flowchart"||draft.kind==="place-value")&&<LektrusNextSchoolControls diagram={draft} onChange={set}/>}
     {(draft.kind==="organs"||draft.kind==="relief")&&<LektrusFurtherSchoolControls diagram={draft} onChange={set}/>}
     {(draft.kind==="morphemes"||draft.kind==="family-tree"||draft.kind==="flashcards")&&<LektrusApprovedSchoolControls diagram={draft} onChange={set}/>}
     {(draft.kind==="morphology"||draft.kind==="phonetics"||draft.kind==="orthography")&&<LektrusRussianSchoolControls diagram={draft} onChange={set}/>}
     {(draft.kind==="sentence-builder"||draft.kind==="state-structure")&&<LektrusLanguageSocialControls diagram={draft} onChange={set}/>}
     {draft.kind==="division"&&<><label className="lektrus-school-field">Фаза митоза<select value={draft.phase} onChange={e=>set({...draft,phase:e.target.value as typeof draft.phase})}>{[["interphase","Интерфаза (перед митозом)"],["prophase","Профаза"],["metaphase","Метафаза"],["anaphase","Анафаза"],["telophase","Телофаза"]].map(([v,n])=><option key={v} value={v}>{n}</option>)}</select></label><label className="lektrus-school-toggle"><input type="checkbox" checked={draft.showLabels} onChange={e=>set({...draft,showLabels:e.target.checked})}/>Показывать пояснение</label><p className="lektrus-school-hint">Схематическое представление митоза животной клетки. Интерфаза предшествует митозу.</p></>}
     {draft.kind==="encoding"&&<><label className="lektrus-school-field">Текст (до 12 символов)<input maxLength={12} value={draft.message} onChange={e=>set({...draft,message:[...e.target.value].slice(0,12).join("")})}/></label><label className="lektrus-school-field">Представление<select value={draft.mode} onChange={e=>set({...draft,mode:e.target.value as typeof draft.mode})}><option value="unicode">Кодовые точки Unicode</option><option value="utf8">Байты UTF-8</option></select></label><label className="lektrus-school-toggle"><input type="checkbox" checked={draft.showCodes} onChange={e=>set({...draft,showCodes:e.target.checked})}/>Показывать коды</label></>}
     {draft.kind==="genetics"&&<><label className="lektrus-school-field">Первый родитель (два аллеля одного гена)<input maxLength={2} value={draft.parentA} onChange={e=>set({...draft,parentA:e.target.value})}/></label><label className="lektrus-school-field">Второй родитель<input maxLength={2} value={draft.parentB} onChange={e=>set({...draft,parentB:e.target.value})}/></label><p className="lektrus-school-hint">Модель моногибридного скрещивания для одного гена. Примеры: AA, Aa, aa. Родительские генотипы должны содержать аллели одного гена.</p><label className="lektrus-school-toggle"><input type="checkbox" checked={draft.showAnswers} onChange={e=>set({...draft,showAnswers:e.target.checked})}/>Показывать генотипы потомства</label></>}
     {draft.kind==="logic"&&<><label className="lektrus-school-field">Логическая операция<select value={draft.operation} onChange={e=>set({...draft,operation:e.target.value as typeof draft.operation})}>{[["and","И (конъюнкция)"],["or","ИЛИ (дизъюнкция)"],["xor","Исключающее ИЛИ"],["implication","Импликация"],["equivalence","Эквивалентность"]].map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></label><label className="lektrus-school-toggle"><input type="checkbox" checked={draft.showAnswers} onChange={e=>set({...draft,showAnswers:e.target.checked})}/>Показать столбец ответов</label></>}
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
    </div>
    <div className="lektrus-school-preview-area">
     <div className="lektrus-school-preview-heading"><strong>Предпросмотр</strong><span>Так объект будет выглядеть на доске</span></div>
     <div className="lektrus-school-preview"><LektrusSchoolDiagramView diagram={draft}/></div>
    </div>
   </div>
   <footer className="lektrus-school-footer">
    <span>{error||"Изменения видны в предпросмотре. На доску объект попадает после сохранения."}</span>
    <button type="button" className="lektrus-school-secondary" onClick={close}>{existing?"Закрыть":"Отмена"}</button>
    <button type="button" className="lektrus-school-primary" onClick={finish}>{existing?"Сохранить изменения":"Вывести на доску"}</button>
   </footer>
  </section>
 </div>,document.body);
}
