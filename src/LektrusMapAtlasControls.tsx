import type {AtlasDocument,AtlasMode} from "./lektrusAtlasModel";
import {atlasModesForScope,getAtlasScope,isHistoricalAtlasMode,historicalSnapshots,nearestSnapshotIndex,schoolHistoryEvents,yearLabel} from "./lektrusAtlasModel";
type Props={diagram:AtlasDocument;onChange:(diagram:AtlasDocument)=>void};
const makeId=()=>crypto.randomUUID();
export default function LektrusMapAtlasControls({diagram:d,onChange}:Props){
 const scope=getAtlasScope(d);
 const modes=atlasModesForScope(scope);
 const historic=scope==="history"&&isHistoricalAtlasMode(d.mode);
 const index=nearestSnapshotIndex(d.year);
 const patch=(next:Partial<AtlasDocument>)=>onChange({...d,...next});
 return <>
  <label className="lektrus-school-field">Тип карты
   <select value={d.mode} onChange={e=>patch({mode:e.target.value as AtlasMode})}>
    {modes.map(m=><option key={m.id} value={m.id}>{m.title}</option>)}
   </select>
  </label>
  <p className="lektrus-school-hint">{modes.find(m=>m.id===d.mode)?.hint}.
   Общая географическая подложка не меняется: переключаются только тематические слои.</p>
  {historic&&<>
   <div className="lektrus-school-controls-heading">Временная шкала</div>
   <label className="lektrus-school-field">Доступный датированный снимок
    <select value={d.year} onChange={e=>patch({year:Number(e.target.value)})}>
     {historicalSnapshots.map(s=><option value={s.year} key={s.year}>{yearLabel(s.year)}</option>)}
    </select>
   </label>
   <input aria-label="Год исторической карты" type="range" min="0" max={historicalSnapshots.length-1}
    step="1" value={index} onChange={e=>patch({year:historicalSnapshots[Number(e.target.value)].year})}/>
   <div className="lektrus-school-inspector-quick">
    <button type="button" disabled={index===0}
     onClick={()=>patch({year:historicalSnapshots[index-1].year})}>‹ Раньше</button>
    <button type="button" disabled={index===historicalSnapshots.length-1}
     onClick={()=>patch({year:historicalSnapshots[index+1].year})}>Позже ›</button>
   </div>
   <p className="lektrus-school-hint">Доступно {historicalSnapshots.length} датированных картографических снимка от древних эпох до 2010 года. Каждый снимок имеет самостоятельные границы. В промежутках не строятся вымышленные границы и не предполагается непрерывная точность.</p>
   <label className="lektrus-school-toggle"><input type="checkbox" checked={d.showEvents}
    onChange={e=>patch({showEvents:e.target.checked})}/> Показывать важные исторические события</label>
   <div className="lektrus-school-controls-heading">События из учебной подборки</div>
   {schoolHistoryEvents.filter(ev=>Math.abs(ev.year-d.year)<70).map(ev=>
    <div key={ev.year} className="lektrus-atlas-curriculum-event">
     <strong>{yearLabel(ev.year)} · {ev.title}</strong>
     <small>{ev.description}</small>
    </div>)}
  </>}
  <label className="lektrus-school-toggle"><input type="checkbox" checked={d.showGrid}
   onChange={e=>patch({showGrid:e.target.checked})}/> Меридианы и параллели</label>
  {d.mode!=="contour"&&<label className="lektrus-school-toggle"><input type="checkbox" checked={d.showLabels}
   onChange={e=>patch({showLabels:e.target.checked})}/> Названия крупных государств на карте</label>}
  <div className="lektrus-school-controls-heading">Маркеры преподавателя ({d.markers.length}/40)</div>
  <p className="lektrus-school-hint">Добавляйте места и события с реальными координатами. Значения долготы от −180 до 180°, широты от −90 до 90°. Маркеры сохраняются с доской, их можно использовать для исторических заданий.</p>
  {d.markers.map((marker,i)=><div key={marker.id} className="lektrus-atlas-marker-editor">
   <div className="lektrus-russian-edit-header"><span className="lektrus-school-number">{i+1}</span>
    <strong>Маркер {i+1}</strong><button type="button" title="Удалить маркер"
     onClick={()=>patch({markers:d.markers.filter(m=>m.id!==marker.id)})}>×</button>
   </div>
   <label>Название
    <input value={marker.title} maxLength={80} onChange={e=>patch({markers:d.markers.map(m=>m.id===marker.id?
     {...m,title:e.target.value}:m)})}/></label>
   <div className="lektrus-atlas-marker-numbers">
    {(["lat","lon","year"] as const).map(key=><label key={key}>
     {key==="lat"?"Широта, °":key==="lon"?"Долгота, °":"Год"}
     <input type="number" step={key==="year"?1:.1} value={marker[key]}
      min={key==="lat"?-90:key==="lon"?-180:-123000}
      max={key==="lat"?90:key==="lon"?180:2100}
      onChange={e=>patch({markers:d.markers.map(m=>m.id===marker.id?{...m,[key]:Number(e.target.value)}:m)})}/>
    </label>)}
   </div>
   <label>Описание
    <textarea rows={2} maxLength={300} value={marker.description}
     onChange={e=>patch({markers:d.markers.map(m=>m.id===marker.id?
      {...m,description:e.target.value}:m)})}/>
   </label>
  </div>)}
  <button type="button" className="lektrus-school-add" disabled={d.markers.length>=40}
   onClick={()=>patch({markers:[...d.markers,{id:makeId(),title:"Новый маркер",lat:55.75,lon:37.62,
    year:d.year,description:""}]})}>+ Добавить маркер</button>
  <p className="lektrus-school-hint">Единая географическая подложка (все виды карт): суша, береговая линия Natural Earth (public domain).
   {historic?"Границы исторических эпох: Historical Basemaps (А. Оуредник и участники; GPL-3.0).":"Современные границы, реки и озёра: Natural Earth (public domain)."}
   Полные исторические данные загружаются из внешнего источника по мере просмотра.
   Не все даты и территории одинаково достоверны; перед коммерческим распространением необходимо
   проверить лицензионные условия исторического набора.</p>
 </>;
}
