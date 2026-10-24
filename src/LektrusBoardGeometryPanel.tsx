import {useEffect,useState} from "react";
import LektrusGeometryToolIcon,{type GeometryToolIconName} from "./LektrusGeometryToolIcon";
import type {Item} from "./boardModel";
import type {ExistingPointTool} from "./lektrusGeometryExistingPoints";
import {geometryAngle,geometryDistance,geometryPolygonMetrics,formatGeometryMetric,type PrecisionMode} from "./lektrusGeometryPrecision";
import type {SchoolConstruction} from "./lektrusSchoolConstructions";
import type {ConstructionKind} from "./lektrusConstructionCleanup";

export type BoardGeometryMode="move"|"point"|ExistingPointTool;
type PanelTab="draw"|"exact"|"school"|"objects";
const schoolActions:readonly {id:SchoolConstruction;label:string}[]=[
  {id:"triangle-medians",label:"Медианы треугольника"},
  {id:"triangle-altitudes",label:"Высоты треугольника"},
  {id:"triangle-bisectors",label:"Биссектрисы треугольника"},
  {id:"centroid",label:"Центр тяжести"},
  {id:"orthocenter",label:"Ортоцентр"},
  {id:"incenter",label:"Инцентр"},
  {id:"circumcenter",label:"Центр описанной окружности"},
  {id:"incircle",label:"Вписанная окружность"},
  {id:"circumcircle",label:"Описанная окружность"},
  {id:"diagonals",label:"Диагонали многоугольника"},
  {id:"triangle-midline",label:"Средняя линия треугольника"},
  {id:"trapezoid-midline",label:"Средняя линия трапеции"},
  {id:"radius",label:"Радиус"},
  {id:"diameter",label:"Диаметр"},
  {id:"chord",label:"Хорда"},
  {id:"tangent",label:"Касательная"},
  {id:"secant",label:"Секущая"},
  {id:"two-tangents",label:"Две касательные"},
  {id:"central-angle",label:"Центральный угол"},
  {id:"inscribed-angle",label:"Вписанный угол"},
  {id:"circumference-midpoint",label:"Середина дуги"},
  {id:"inscribed-polygon",label:"Вписанный многоугольник"},
  {id:"circumscribed-polygon",label:"Описанный многоугольник"}
];
const modeChoices:readonly {id:BoardGeometryMode;label:string;icon:GeometryToolIconName}[]=[
 {id:"move",label:"Выбор",icon:"move"},
 {id:"point",label:"Точка",icon:"point"},
 {id:"segment",label:"Отрезок",icon:"segment"},
 {id:"line",label:"Прямая",icon:"line"},
 {id:"ray",label:"Луч",icon:"ray"},
 {id:"polygon",label:"Контур",icon:"polygon"},
 {id:"angle",label:"Угол",icon:"angle"},
 {id:"circle",label:"Окружность",icon:"circle"},
 {id:"midpoint",label:"Середина",icon:"midpoint"},
 {id:"measure",label:"Измерить",icon:"measure"}
];
type Props={
 item:Item;mode:BoardGeometryMode;selected:readonly number[];error:string;
 onMode:(mode:BoardGeometryMode)=>void;onPickBack:()=>void;onClear:()=>void;onFinish:()=>void;
 onAdjust:(mode:PrecisionMode,value?:number)=>void;
 onConstraint:(mode:"horizontal"|"vertical"|"distance",value?:number)=>void;
 onRelease:(index:number)=>void;onSchool:(kind:SchoolConstruction)=>void;
 onRemove:(kind:ConstructionKind,index:number)=>void;onRemoveSchool:(group:string)=>void;
 onPointEdit:(index:number,change:{x?:number;y?:number;label?:string})=>void;
 onRemovePoint:(index:number)=>void;onNewLine:()=>void;onClosePolygon:()=>void;
 onToggle:(field:"graphGrid"|"graphSnap"|"graphMagneticSnap"|"graphShowLabels")=>void;
 onOpenEditor:()=>void;
};
export default function LektrusBoardGeometryPanel({item,mode,selected,error,onMode,onPickBack,onClear,onFinish,onAdjust,onConstraint,onRelease,onSchool,onRemove,onRemoveSchool,onPointEdit,onRemovePoint,onNewLine,onClosePolygon,onToggle,onOpenEditor}:Props){
 const [tab,setTab]=useState<PanelTab>("draw");
 const [collapsed,setCollapsed]=useState(false);
 const [value,setValue]=useState("");
 const [school,setSchool]=useState<SchoolConstruction>("triangle-medians");
 useEffect(()=>{if(mode==="measure")setTab("exact");else if(mode!=="move"&&mode!=="point")setTab("draw")},[mode]);
 const points=item.graphPoints??[],segments=item.graphSegments??[],circles=item.graphCircles??[],polygons=item.graphPolygons??[],angles=item.graphAngles??[],midpoints=item.graphMidpoints??[];
 const pick=selected.map(i=>points[i]).filter((p):p is NonNullable<typeof p>=>!!p);
 const length=pick.length>=2?geometryDistance(pick[0],pick[1]):null;
 const angle=pick.length>=3?geometryAngle(pick[0],pick[1],pick[2]):null;
 const area=pick.length>=3?geometryPolygonMetrics(pick):null;
 const groups=Array.from(new Map([...points,...segments,...circles,...polygons,...angles,...midpoints].filter(p=>p.schoolGroupId).map(p=>[p.schoolGroupId!,p.schoolGroupLabel||"Построение"])));
 const total=segments.length+circles.length+polygons.length+angles.length+midpoints.length+groups.length;
 const instruction=mode==="move"?"Перетаскивайте точки на рисунке. Двойное нажатие удаляет точку.":
  mode==="point"?"Коснитесь свободного места, чтобы добавить точку.":"Нажимайте готовые точки или свободное место: новая точка добавится автоматически.";
 const pickNames=selected.map(i=>points[i]?.label||`№${i+1}`).join(" → ");
 const button=(id:BoardGeometryMode,label:string,icon:GeometryToolIconName)=><button type="button" key={id}
   className={mode===id?"active":""} aria-pressed={mode===id} aria-label={label}
   title={label} onClick={()=>onMode(id)}><LektrusGeometryToolIcon name={icon} size={21}/><span className="lektrus-board-geometry-tool-label">{label}</span></button>;
 const removeRows=(kind:ConstructionKind,list:readonly unknown[],title:string)=>
  list.map((_,i)=><div key={kind+i} className="lektrus-board-geometry-entry"><span>{title} {i+1}</span><button type="button" title={`Удалить ${title.toLowerCase()}`} onClick={()=>onRemove(kind,i)}>Удалить</button></div>);
 const apply=()=>{const n=Number(value.replace(",","."));onAdjust(selected.length===3?"angle":"distance",n)};
 return <section className={`lektrus-board-geometry-panel ${collapsed?"is-collapsed":""}`}
   aria-label="Построение фигур на доске" data-board-interactive="true"
   onPointerDown={e=>e.stopPropagation()} onClick={e=>e.stopPropagation()}>
   <div className="lektrus-board-geometry-head">
    <div className="lektrus-board-geometry-identity"><strong>Черчение</strong><small>{points.length} т. · {total} эл.</small></div>
    <div className="lektrus-board-geometry-head-actions">
      <button type="button" className="lektrus-board-geometry-editor-link"
        title="Открыть полный редактор фигур"
        aria-label="Открыть полный редактор фигур" onClick={onOpenEditor}>
        <LektrusGeometryToolIcon name="editor" size={16}/><span>Редактор</span>
      </button>
      <button type="button" className="lektrus-board-geometry-collapse"
        aria-label={collapsed?"Развернуть инструменты черчения":"Свернуть инструменты черчения"}
        title={collapsed?"Развернуть":"Свернуть"} onClick={()=>setCollapsed(v=>!v)}>
        <LektrusGeometryToolIcon name={collapsed?"expand":"collapse"} size={17}/>
      </button>
    </div>
   </div>
   {!collapsed&&<>
    <nav className="lektrus-board-geometry-tabs" aria-label="Разделы построения">
     {([["draw","Инструменты"],["exact","Размеры"],["school","Школьные"],["objects","Объекты"]] as const).map(([id,label])=>
      <button type="button" key={id} className={tab===id?"active":""} onClick={()=>setTab(id)}>{label}</button>)}
    </nav>
    {tab==="draw"&&<>
      <div className="lektrus-board-geometry-actions">
       {modeChoices.map(choice=>button(choice.id,choice.label,choice.icon))}
      </div>
      <p className="lektrus-board-geometry-hint">{instruction}</p>
      {mode==="polygon"&&<p className="lektrus-board-geometry-hint">Замкните нажатием на первую вершину либо кнопкой ниже.</p>}
      {mode==="point"&&item.graphFigureId==="free"&&<div className="lektrus-board-geometry-buttons">
        <button type="button" onClick={onClosePolygon}>Замкнуть контур</button>
        <button type="button" onClick={onNewLine}>Новая линия</button>
      </div>}
      <div className="lektrus-board-geometry-switches">
       <label><input type="checkbox" checked={item.graphGrid!==false} onChange={()=>onToggle("graphGrid")}/> Сетка</label>
       <label><input type="checkbox" checked={item.graphSnap!==false} onChange={()=>onToggle("graphSnap")}/> Шаг</label>
       <label><input type="checkbox" checked={item.graphMagneticSnap!==false} onChange={()=>onToggle("graphMagneticSnap")}/> Магнит</label>
       <label><input type="checkbox" checked={item.graphShowLabels!==false} onChange={()=>onToggle("graphShowLabels")}/> Буквы</label>
      </div>
    </>}
    {tab==="exact"&&<>
      <div className="lektrus-board-geometry-buttons"><button type="button" className={mode==="measure"?"active":""} onClick={()=>onMode("measure")}>Выбрать вершины</button>
       <button type="button" onClick={onClear} disabled={!selected.length}>Сбросить</button></div>
      <p className="lektrus-board-geometry-hint">Выберите 2 точки для длины или 3 для угла (вершина вторая).</p>
      {length!==null&&<div className="lektrus-board-geometry-measure">Длина: <b>{formatGeometryMetric(length)} ед.</b></div>}
      {angle!==null&&<div className="lektrus-board-geometry-measure">Угол: <b>{formatGeometryMetric(angle)}°</b></div>}
      {area&&<div className="lektrus-board-geometry-measure">P = {formatGeometryMetric(area.perimeter)} · S = {formatGeometryMetric(area.area)}</div>}
      <div className="lektrus-board-geometry-buttons">
       <button type="button" disabled={selected.length!==2} onClick={()=>onAdjust("horizontal")}>Горизонтально</button>
       <button type="button" disabled={selected.length!==2} onClick={()=>onAdjust("vertical")}>Вертикально</button>
      </div>
      <label className="lektrus-board-geometry-value">{selected.length===3?"Угол, °":"Длина, ед."}
       <span><input type="text" inputMode="decimal" placeholder={selected.length===3?"90":"5"} value={value} onChange={e=>setValue(e.target.value.slice(0,20))}/>
       <button type="button" onClick={apply} disabled={selected.length!==2&&selected.length!==3}>Задать</button></span></label>
      <div className="lektrus-board-geometry-buttons">
       <button type="button" disabled={selected.length!==2} onClick={()=>onConstraint("horizontal")}>Фикс. горизонталь</button>
       <button type="button" disabled={selected.length!==2} onClick={()=>onConstraint("vertical")}>Фикс. вертикаль</button>
       <button type="button" disabled={selected.length!==2} onClick={()=>onConstraint("distance",length??undefined)}>Фикс. длину</button>
      </div>
      {!!item.graphConstraints?.length&&<details className="lektrus-board-geometry-details"><summary>Связи ({item.graphConstraints.length})</summary>
       {item.graphConstraints.map((c,i)=><div key={i} className="lektrus-board-geometry-entry"><span>{points[c.a]?.label} ↔ {points[c.b]?.label} · {c.kind==="distance"?"длина":c.kind==="horizontal"?"горизонталь":"вертикаль"}</span><button type="button" onClick={()=>onRelease(i)}>Снять</button></div>)}
      </details>}
    </>}
    {tab==="school"&&<>
      <p className="lektrus-board-geometry-hint">Построения добавляются к текущему чертежу. Нужные исходные фигуры должны уже быть на нём.</p>
      <label className="lektrus-board-geometry-value">Геометрическая конструкция
       <select value={school} onChange={e=>setSchool(e.target.value as SchoolConstruction)}>
        {schoolActions.map(entry=><option key={entry.id} value={entry.id}>{entry.label}</option>)}
       </select></label>
      <button type="button" className="lektrus-board-geometry-primary" onClick={()=>onSchool(school)}>Добавить на чертёж</button>
      {!!groups.length&&<details className="lektrus-board-geometry-details"><summary>Добавленные построения ({groups.length})</summary>
       {groups.map(([id,label])=><div key={id} className="lektrus-board-geometry-entry"><span>{label}</span><button type="button" onClick={()=>onRemoveSchool(id)}>Удалить</button></div>)}
      </details>}
    </>}
    {tab==="objects"&&<>
      <details className="lektrus-board-geometry-details" open><summary>Точки ({points.length})</summary>
       <div className="lektrus-board-geometry-points">{points.map((p,i)=><div key={i} className="lektrus-board-geometry-point">
        <input aria-label={`Название точки ${i+1}`} defaultValue={p.label} key={i+":"+p.label} onBlur={e=>{if(e.target.value!==p.label)onPointEdit(i,{label:e.target.value})}}/>
        <input aria-label={`X точки ${p.label}`} type="number" step=".25" defaultValue={p.x} key={i+":x:"+p.x} onBlur={e=>{if(e.target.value!==String(p.x))onPointEdit(i,{x:Number(e.target.value)})}}/>
        <input aria-label={`Y точки ${p.label}`} type="number" step=".25" defaultValue={p.y} key={i+":y:"+p.y} onBlur={e=>{if(e.target.value!==String(p.y))onPointEdit(i,{y:Number(e.target.value)})}}/>
        <button type="button" title={`Удалить точку ${p.label}`} onClick={()=>onRemovePoint(i)}>×</button>
       </div>)}</div>
      </details>
      <details className="lektrus-board-geometry-details"><summary>Элементы ({total})</summary>
       {removeRows("segment",segments,"Линия")}
       {removeRows("circle",circles,"Окружность")}
       {removeRows("polygon",polygons,"Многоугольник")}
       {removeRows("angle",angles,"Угол")}
       {removeRows("midpoint",midpoints,"Середина")}
       {!total&&<p className="lektrus-board-geometry-hint">Пока нет элементов.</p>}
      </details>
    </>}
    {!!selected.length&&<div className="lektrus-board-geometry-selection" role="status">
      <span>{pickNames}</span><div>
       <button type="button" onClick={onPickBack} title="Отменить последнюю точку">↶</button>
       <button type="button" onClick={onClear} title="Очистить выбор">×</button>
       {mode==="polygon"&&<button type="button" disabled={selected.length<3} onClick={onFinish}>Замкнуть</button>}
      </div>
    </div>}
    {error&&<p className="lektrus-board-geometry-error" role="alert">{error}</p>}
   </>}
 </section>;
}
