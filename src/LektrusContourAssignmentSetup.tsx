import type {AtlasDocument,ContourAssignment} from "./lektrusAtlasModel";
import {defaultContourAssignment} from "./lektrusAtlasModel";
import {atlasRegionGroups,atlasRegions} from "./lektrusAtlasRegions";

type Props={value:AtlasDocument;onChange:(value:AtlasDocument)=>void};
const baseLayers:ReadonlyArray<[keyof ContourAssignment,string]>=[
 ["showCoastline","Береговая линия"],["showBorders","Границы стран"],
 ["showRegions","Границы регионов"],["showRivers","Реки"],["showLakes","Озёра"],
 ["showGrid","Меридианы и параллели"]
];
const studentTools:ReadonlyArray<[keyof ContourAssignment,string]>=[
 ["allowLabels","Подписи"],["allowPoints","Условные знаки"],
 ["allowDrawing","Карандаш"],["allowFill","Закраска"]
];

export default function LektrusContourAssignmentSetup({value,onChange}:Props){
 const config={...defaultContourAssignment,...value.contourAssignment};
 const update=(key:keyof ContourAssignment,checked:boolean)=>{
  const next={...config,[key]:checked};
  onChange({...value,contourAssignment:next,showGrid:next.showGrid});
 };
 const enabledLayers=baseLayers.filter(([key])=>config[key]).length;
 const enabledTools=studentTools.filter(([key])=>config[key]).length;
 return <div className="lektrus-contour-assignment">
  <div className="lektrus-contour-task-fields">
   <label className="lektrus-school-field" htmlFor="lektrus-contour-title">Название
    <input id="lektrus-contour-title" maxLength={120} value={value.title}
     autoComplete="off" placeholder="Например, Реки России"
     onChange={e=>onChange({...value,title:e.target.value})}/>
   </label>
   <label className="lektrus-school-field" htmlFor="lektrus-contour-task">Задание
    <textarea id="lektrus-contour-task" rows={4} maxLength={240}
     value={value.contourTask??""}
     placeholder="Например: подпишите Волгу, Обь и Енисей и обозначьте их истоки."
     onChange={e=>onChange({...value,contourTask:e.target.value})}/>
   </label>
   <label className="lektrus-school-field" htmlFor="lektrus-contour-region">Территория
    <select id="lektrus-contour-region" value={value.regionId??"world"}
     onChange={e=>onChange({...value,regionId:e.target.value})}>
     {atlasRegionGroups.map(group=><optgroup key={group} label={group}>
      {atlasRegions.filter(r=>r.group===group).map(region=>
       <option key={region.id} value={region.id}>{region.title}</option>)}
     </optgroup>)}
    </select>
   </label>
  </div>
  <div className="lektrus-contour-task-options">
   <details className="lektrus-contour-task-section">
    <summary><span>Подложка карты</span><small>{enabledLayers} из {baseLayers.length}</small></summary>
    <div className="lektrus-contour-task-choice-grid">
     {baseLayers.map(([key,title])=><label className="lektrus-contour-task-choice" key={key}>
      <input type="checkbox" checked={config[key]} onChange={e=>update(key,e.target.checked)}/>
      <span>{title}</span>
     </label>)}
    </div>
   </details>
   <details className="lektrus-contour-task-section">
    <summary><span>Инструменты ученика</span><small>{enabledTools} из {studentTools.length}</small></summary>
    <div className="lektrus-contour-task-choice-grid">
     {studentTools.map(([key,title])=><label className="lektrus-contour-task-choice" key={key}>
      <input type="checkbox" checked={config[key]} onChange={e=>update(key,e.target.checked)}/>
      <span>{title}</span>
     </label>)}
    </div>
   </details>
  </div>
 </div>;
}
