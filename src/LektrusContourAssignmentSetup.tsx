import type {AtlasDocument,ContourAssignment} from "./lektrusAtlasModel";
import {defaultContourAssignment} from "./lektrusAtlasModel";
import {atlasRegionGroups,atlasRegions} from "./lektrusAtlasRegions";
type Props={value:AtlasDocument;onChange:(value:AtlasDocument)=>void};
const layers:ReadonlyArray<[keyof ContourAssignment,string,string]>=[
 ["showCoastline","Береговая линия","Материки, острова и побережье"],
 ["showBorders","Границы государств","Тонкие линии без названий"],
 ["showRegions","Границы регионов","Административные единицы из геоданных"],
 ["showRivers","Реки","Водотоки без названий"],
 ["showLakes","Озёра","Озёра и водохранилища"],
 ["showGrid","Меридианы и параллели","Градусная сетка поверх карты"]
];
const instruments:ReadonlyArray<[keyof ContourAssignment,string,string]>=[
 ["allowLabels","Подписи","Наносить названия"],
 ["allowPoints","Условные знаки","Точки и цифры"],
 ["allowDrawing","Карандаш","Маршруты, направления и линии"],
 ["allowFill","Закраска","Раскрашивать территории"]
];
const examples=[
 ["","Выберите учебную тему"],
 ["Подпишите материки и океаны.","5 класс · Материки и океаны"],
 ["Подпишите крупные реки, озёра, горные системы и равнины.","6 класс · Рельеф и гидросфера"],
 ["Нанесите государства и природные объекты изучаемого материка.","7 класс · Материки и страны"],
 ["Обозначьте крупные природные районы и речные бассейны России.","8 класс · Природа России"],
 ["Отметьте промышленные центры, экономические районы и месторождения России.","9 класс · Хозяйство России"]
];
export default function LektrusContourAssignmentSetup({value,onChange}:Props){
 const config={...defaultContourAssignment,...value.contourAssignment};
 const update=(key:keyof ContourAssignment,checked:boolean)=>onChange({...value,
  contourAssignment:{...config,[key]:checked},showGrid:key==="showGrid"?checked:value.showGrid});
 return <div className="lektrus-contour-assignment">
  <header><strong>Создание задания</strong>
   <p>Настройте подложку и разрешённые инструменты. Ученику откроется только контурная карта.</p></header>
  <label className="lektrus-school-field">Название работы
   <input maxLength={120} value={value.title}
    onChange={e=>onChange({...value,title:e.target.value})}/>
  </label>
  <label className="lektrus-school-field">Задание ученику
   <textarea rows={3} maxLength={240} value={value.contourTask??""}
    onChange={e=>onChange({...value,contourTask:e.target.value})}
    placeholder="Какие объекты нужно нанести?"/>
  </label>
  <label className="lektrus-school-field">Шаблон по программе
   <select value="" aria-label="Шаблон учебного задания"
    onChange={e=>{if(e.target.value)onChange({...value,contourTask:e.target.value})}}>
    {examples.map(([v,name])=><option key={name} value={v}>{name}</option>)}
   </select>
  </label>
  <label className="lektrus-school-field">Территория
   <select value={value.regionId??"world"} onChange={e=>onChange({...value,regionId:e.target.value})}>
    {atlasRegionGroups.map(group=><optgroup key={group} label={group}>
     {atlasRegions.filter(r=>r.group===group).map(r=><option key={r.id} value={r.id}>{r.title}</option>)}
    </optgroup>)}
   </select>
  </label>
  <fieldset><legend>Подложка карты</legend>
   {layers.map(([key,title,hint])=><label key={key} className="lektrus-contour-assignment-switch">
    <input type="checkbox" checked={config[key]}
     onChange={e=>update(key,e.target.checked)}/>
    <span><b>{title}</b><small>{hint}</small></span>
   </label>)}
  </fieldset>
  <fieldset><legend>Инструменты ученика</legend>
   {instruments.map(([key,title,hint])=><label key={key} className="lektrus-contour-assignment-switch">
    <input type="checkbox" checked={config[key]} onChange={e=>update(key,e.target.checked)}/>
    <span><b>{title}</b><small>{hint}</small></span>
   </label>)}
  </fieldset>
  <p className="lektrus-school-hint">Работа выполняется на пустой карте без готовых ответов. Подложка и инструменты сохраняются вместе с заданием.</p>
 </div>;
}