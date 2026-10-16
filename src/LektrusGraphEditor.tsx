import {useEffect, useState, type ReactNode} from "react";
import type {Item} from "./boardModel";
import LektrusColorPicker from "./LektrusColorPicker";
import {mathPresets,makeMathPresetItem,formatPiRadians,type MathPresetId} from "./lektrusMathPresets";

export type GraphDraft = {
  title: string;
  intervalStartClosed: boolean;
  intervalEndClosed: boolean;
  purpose: NonNullable<Item["graphPurpose"]>;
  axisMode: NonNullable<Item["graphAxisMode"]>;
  type: NonNullable<Item["graphType"]>;
  expression: string; connectPoints: boolean;
  a: number; b: number; c: number;
  xMin: number; xMax: number; yMin: number; yMax: number;
  grid: boolean; points: NonNullable<Item["graphPoints"]>;
  showLabels: boolean; snap: boolean; axisLabels: boolean;
  gridStep: number; showCurve: boolean; projections: boolean;
  segments: NonNullable<Item["graphSegments"]>;
  angles: NonNullable<Item["graphAngles"]>;
  circles: NonNullable<Item["graphCircles"]>;
  polygons: NonNullable<Item["graphPolygons"]>;
  midpoints: NonNullable<Item["graphMidpoints"]>;
};

export function removeGraphPoint(draft:GraphDraft,index:number):GraphDraft {
  const shift=(v:number)=>v>index?v-1:v;
  return {
    ...draft,
    points:draft.points.filter((_,i)=>i!==index),
    segments:draft.segments.filter(s=>s.a!==index&&s.b!==index).map(s=>({...s,a:shift(s.a),b:shift(s.b)})),
    circles:draft.circles.filter(c=>c.center!==index&&c.edge!==index).map(c=>({...c,center:shift(c.center),edge:shift(c.edge)})),
    angles:draft.angles.filter(a=>a.a!==index&&a.vertex!==index&&a.b!==index).map(a=>({...a,a:shift(a.a),vertex:shift(a.vertex),b:shift(a.b)})),
    midpoints:draft.midpoints.filter(m=>m.a!==index&&m.b!==index).map(m=>({...m,a:shift(m.a),b:shift(m.b)})),
    polygons:draft.polygons.map(p=>({...p,points:p.points.filter(i=>i!==index).map(shift)})).filter(p=>p.points.length>=3)
  };
}

// Keep point-index references consistent when a point is removed directly on the board.
export function removeGraphBoardPoint(item:Item,index:number):Item {
  const shift=(v:number)=>v>index?v-1:v;
  return {
    ...item,
    graphPoints:(item.graphPoints??[]).filter((_,i)=>i!==index),
    graphSegments:(item.graphSegments??[]).filter(v=>v.a!==index&&v.b!==index).map(v=>({...v,a:shift(v.a),b:shift(v.b)})),
    graphCircles:(item.graphCircles??[]).filter(v=>v.center!==index&&v.edge!==index).map(v=>({...v,center:shift(v.center),edge:shift(v.edge)})),
    graphAngles:(item.graphAngles??[]).filter(v=>v.a!==index&&v.vertex!==index&&v.b!==index).map(v=>({...v,a:shift(v.a),vertex:shift(v.vertex),b:shift(v.b)})),
    graphMidpoints:(item.graphMidpoints??[]).filter(v=>v.a!==index&&v.b!==index).map(v=>({...v,a:shift(v.a),b:shift(v.b)})),
    graphPolygons:(item.graphPolygons??[]).map(v=>({...v,points:v.points.filter(i=>i!==index).map(shift)})).filter(v=>v.points.length>=3)
  };
}

type Props = {
  draft:GraphDraft; userId:string; preview:ReactNode;
  onChange:(value:GraphDraft)=>void;
  onSave:()=>void; onCancel:()=>void; onClose:()=>void;
};

const formulas:Record<GraphDraft["type"],string>={
  linear:"2*x + 1",quadratic:"x^2 - 4*x + 3",sin:"sin(x)",cos:"cos(x)"
};

export default function LektrusGraphEditor({draft,userId,preview,onChange,onSave,onCancel,onClose}:Props) {
  const [tab,setTab]=useState<"presets"|"points"|"geometry">("presets");
  const [previewExpanded,setPreviewExpanded]=useState(false);
  useEffect(()=>{
    const key=(event:KeyboardEvent)=>{
      if(event.key==="Escape"){event.preventDefault();event.stopPropagation();onClose()}
      if((event.ctrlKey||event.metaKey)&&event.key==="Enter"){event.preventDefault();event.stopPropagation();onSave()}
    };
    document.addEventListener("keydown",key,true);
    return ()=>document.removeEventListener("keydown",key,true);
  },[onCancel,onSave]);
  const patch=(next:Partial<GraphDraft>)=>onChange({...draft,...next});
  const loadPreset=(id:MathPresetId)=>{
    const sample=makeMathPresetItem(id,0,0,"editor");
    patch({
      title:sample.text,purpose:sample.graphPurpose??"coordinates",axisMode:sample.graphAxisMode??"both",
      type:sample.graphType??"quadratic",expression:sample.graphExpression??"",
      connectPoints:sample.graphConnectPoints===true,grid:sample.graphGrid!==false,
      gridStep:sample.graphGridStep??1,xMin:sample.graphXMin??-10,xMax:sample.graphXMax??10,
      yMin:sample.graphYMin??-6,yMax:sample.graphYMax??6,
      points:(sample.graphPoints??[]).map(p=>({...p})),
      segments:(sample.graphSegments??[]).map(v=>({...v})),
      angles:(sample.graphAngles??[]).map(v=>({...v})),
      circles:(sample.graphCircles??[]).map(v=>({...v})),
      polygons:(sample.graphPolygons??[]).map(v=>({...v,points:[...v.points]})),
      midpoints:(sample.graphMidpoints??[]).map(v=>({...v})),
      intervalStartClosed:sample.graphIntervalStartClosed!==false,
      intervalEndClosed:sample.graphIntervalEndClosed!==false,
      showCurve:sample.graphShowCurve===true,projections:sample.graphProjections===true,
      snap:sample.graphSnap!==false,axisLabels:sample.graphAxisLabels!==false,showLabels:sample.graphShowLabels!==false
    });
  };
  const activeAngle=()=>{
    const point=draft.points[5];
    if(draft.purpose!=="unit-circle"||!point)return 0;
    return (Math.atan2(point.y,point.x)*180/Math.PI+360)%360;
  };
  const setCircleAngle=(degrees:number)=>{
    const theta=degrees*Math.PI/180;
    const x=Number(Math.cos(theta).toFixed(6)),y=Number(Math.sin(theta).toFixed(6));
    if(draft.points.length>5)patch({points:draft.points.map((p,i)=>i===5?{...p,x,y,label:formatPiRadians(theta)}:p)});
    else loadPreset("unit-circle");
  };
  const editPoint=(i:number,change:Partial<GraphDraft["points"][number]>)=>
    patch({points:draft.points.map((p,j)=>j===i?{...p,...change}:p)});
  const pointOptions=(exclude=-1)=>draft.points.map((p,i)=>i===exclude?null:<option key={i} value={i}>{p.label||`Точка ${i+1}`} ({p.x}; {p.y})</option>);
  const addPoint=()=>{
    if(draft.points.length>=40||draft.purpose==="unit-circle")return;
    const label=draft.purpose==="geometry"?String.fromCharCode(65+(draft.points.length%26)):"";
    patch({points:[...draft.points,{x:0,y:0,label}]});
  };
  const addConstruction=(kind:"circle"|"polygon"|"segment"|"angle")=>{
    const index=draft.points.length;
    if(index>34)return;
    const points=kind==="circle"?[{x:0,y:0,label:"O"},{x:3,y:0,label:"R"}]:
      kind==="polygon"?[{x:-3,y:-2,label:"A"},{x:3,y:-2,label:"B"},{x:0,y:3,label:"C"}]:
      kind==="angle"?[{x:3,y:0,label:"A"},{x:0,y:0,label:"O"},{x:2,y:3,label:"B"}]:
      [{x:-3,y:0,label:"A"},{x:3,y:0,label:"B"}];
    patch({
      purpose:"geometry",title:draft.purpose==="geometry"?draft.title:"Геометрическое построение",showCurve:false,
      points:[...draft.points,...points],
      circles:kind==="circle"?[...draft.circles,{center:index,edge:index+1,label:"",measure:true}]:draft.circles,
      polygons:kind==="polygon"?[...draft.polygons,{points:[index,index+1,index+2],label:"ABC",measure:true}]:draft.polygons,
      segments:kind==="segment"?[...draft.segments,{a:index,b:index+1,kind:"segment",label:"",measure:true}]:
        kind==="angle"?[...draft.segments,{a:index+1,b:index,kind:"ray",label:"",measure:false},{a:index+1,b:index+2,kind:"ray",label:"",measure:false}]:draft.segments,
      angles:kind==="angle"?[...draft.angles,{a:index,vertex:index+1,b:index+2,label:"∠AOB"}]:draft.angles
    });
  };
  return <div className={`graph-editor-backdrop lektrus-graph-overlay ${previewExpanded?"is-preview-expanded":""}`} onPointerDown={e=>{if(e.target===e.currentTarget)onClose()}}>
    <section className="graph-editor-modal lektrus-graph-dialog" role="dialog" aria-modal="true" aria-label="Редактор учебного объекта"
      onPointerDown={e=>e.stopPropagation()}>
      <header className="graph-editor-header lektrus-graph-head">
        <div><strong>Редактор учебного объекта</strong><span>Графики, координаты и геометрические построения</span></div>
        <button type="button" aria-label="Закрыть редактор" onClick={onClose}>×</button>
      </header>
      <nav className="lektrus-graph-tabs" aria-label="Разделы редактора">
        <button type="button" className={tab==="presets"?"active":""} onClick={()=>setTab("presets")}>Построить</button>
        <button type="button" className={tab==="points"?"active":""} onClick={()=>setTab("points")}>Точки <span>{draft.points.length}</span></button>
        <button type="button" className={tab==="geometry"?"active":""} onClick={()=>setTab("geometry")}>Фигуры <span>{draft.circles.length+draft.polygons.length+draft.segments.length+draft.angles.length}</span></button>
      </nav>
      <div className="graph-editor-body lektrus-graph-content">
        <div className="graph-editor-form lektrus-graph-settings">
          {tab==="presets"&&<div className="lektrus-graph-section lektrus-math-presets">
            <strong>Построить на плоскости</strong>
            <small>Выберите учебную конструкцию. Точки и фигуры можно двигать прямо в предпросмотре. Новый образец заменит текущую конструкцию в редакторе, но не изменит доску до сохранения.</small>
            {(["Числа и координаты","Функции","Геометрия","Тригонометрия"] as const).map(group=>
              <div className="lektrus-math-preset-group" key={group}>
                <h4>{group}</h4>
                <div className="lektrus-math-preset-grid">{mathPresets.filter(p=>p.group===group).map(p=>
                  <button type="button" key={p.id} className={draft.title===p.title||p.id==="blank"&&draft.title==="Координатная плоскость"?"active":""}
                    onClick={()=>loadPreset(p.id)}><strong>{p.title}</strong><small>{p.subtitle}</small></button>
                )}</div>
              </div>)}
            <label className="lektrus-graph-field"><span>Название построения</span><input value={draft.title} maxLength={100} onChange={e=>patch({title:e.target.value})}/></label>
            {draft.purpose==="function"&&<div className="lektrus-graph-section"><strong>Функция</strong>
              <label className="lektrus-graph-field"><span>Шаблон построения</span>
                <select value={draft.type} onChange={e=>{const type=e.target.value as GraphDraft["type"];patch({type,expression:formulas[type],showCurve:true})}}>
                  <option value="linear">Линейная</option><option value="quadratic">Квадратичная</option>
                  <option value="sin">Синус</option><option value="cos">Косинус</option>
                </select>
              </label>
              <label className="lektrus-graph-field"><span>Формула y =</span><input value={draft.expression} onChange={e=>patch({expression:e.target.value})} placeholder="Например: x^2 - 4*x + 3"/></label>
              <small>Можно менять формулу вручную. Доступны +, −, *, /, ^, sin, cos, sqrt, abs, exp, ln.</small>
              <label className="lektrus-graph-check"><input type="checkbox" checked={draft.showCurve} onChange={e=>patch({showCurve:e.target.checked})}/> Показывать график функции</label>
            </div>}
            {draft.purpose==="number-line"&&<div className="lektrus-graph-section">
              <strong>Промежуток на числовой прямой</strong>
              <small>Первые две точки задают границы. Пустая точка означает, что число не входит в промежуток.</small>
              <div className="lektrus-graph-intervals">
                <label><input type="checkbox" checked={draft.intervalStartClosed} onChange={e=>patch({intervalStartClosed:e.target.checked})}/> Левая граница включена</label>
                <label><input type="checkbox" checked={draft.intervalEndClosed} onChange={e=>patch({intervalEndClosed:e.target.checked})}/> Правая граница включена</label>
              </div>
              {draft.points.length>=2&&<strong>{draft.intervalStartClosed?"[":"("}{Math.min(draft.points[0].x,draft.points[1].x)}; {Math.max(draft.points[0].x,draft.points[1].x)}{draft.intervalEndClosed?"]":")"}</strong>}
            </div>}
            {draft.purpose==="unit-circle"&&<div className="lektrus-graph-section lektrus-unit-circle-controls">
              <strong>Угол на единичной окружности</strong>
              <small>Перемещайте радиус или задавайте угол. Синус и косинус вычисляются по координатам точки.</small>
              <div className="lektrus-circle-readouts">
                <span><b>{formatPiRadians(activeAngle()*Math.PI/180)}</b><small>{Math.round(activeAngle())}°</small></span>
                <span><b>{Math.cos(activeAngle()*Math.PI/180).toFixed(3)}</b><small>cos α</small></span>
                <span><b>{Math.sin(activeAngle()*Math.PI/180).toFixed(3)}</b><small>sin α</small></span>
              </div>
              <label className="lektrus-graph-field">Угол, градусы
                <input type="range" min="0" max="360" step="1" value={Math.round(activeAngle())} onChange={e=>setCircleAngle(Number(e.target.value))}/>
              </label>
              <div className="lektrus-math-angle-shortcuts">{[0,30,45,60,90,120,135,150,180,225,270,315,330].map(v=>
                <button key={v} type="button" onClick={()=>setCircleAngle(v)}>{formatPiRadians(v*Math.PI/180)}</button>)}</div>
            </div>}
          </div>}
          {tab==="points"&&<div className="lektrus-graph-section"><div className="lektrus-graph-section-head"><strong>Редактируемые точки</strong><button type="button" disabled={draft.purpose==="unit-circle"||draft.points.length>=40} onClick={addPoint}>+ Точка</button></div>
            <small>{draft.purpose==="unit-circle"?
              "Контрольные точки единичной окружности фиксированы. Угол можно задать во вкладке «Построить» или переместить радиус.":
              "Точки можно перемещать прямо на рисунке. На мобильном для точного положения используйте поля X и Y."}</small>
            {draft.points.length===0&&<p className="lektrus-graph-empty">Пока нет точек. Добавьте первую.</p>}
            {draft.points.map((p,i)=><div className="lektrus-graph-point-row" key={i}>
              <input aria-label={"Подпись точки "+(i+1)} maxLength={24}
                value={draft.purpose==="unit-circle"&&i>0?(i===5?formatPiRadians(Math.atan2(p.y,p.x)):p.label):draft.purpose==="number-line"?"":p.label}
                placeholder={draft.purpose==="geometry"?"A, B, C…":"Без подписи"} disabled={draft.purpose==="unit-circle"||draft.purpose==="number-line"}
                onChange={e=>editPoint(i,{label:e.target.value})}/>
              <input aria-label={"X точки "+(i+1)} disabled={draft.purpose==="unit-circle"} type="number" step=".25" value={p.x} onChange={e=>editPoint(i,{x:finiteNumber(e.target.value,p.x)})}/>
              <input aria-label={"Y точки "+(i+1)} title={draft.purpose==="number-line"?"На числовой прямой все точки имеют Y = 0":undefined} disabled={draft.purpose==="number-line"||draft.purpose==="unit-circle"} type="number" step=".25" value={draft.purpose==="number-line"?0:p.y} onChange={e=>editPoint(i,{y:finiteNumber(e.target.value,p.y)})}/>
              <LektrusColorPicker userId={userId} label="" compact value={p.color??"#111111"} onChange={color=>editPoint(i,{color})}/>
              <button type="button" disabled={draft.purpose==="unit-circle"} aria-label={"Удалить точку "+(i+1)} title="Удалить точку и связанные с ней построения" onClick={()=>onChange(removeGraphPoint(draft,i))}>×</button>
            </div>)}
            {draft.purpose==="number-line"&&<p className="lektrus-graph-note">Точки на числовой прямой обозначают числа. Соедините две точки, чтобы показать промежуток. Положение точек можно менять в предпросмотре.</p>}
            <label className="lektrus-graph-check"><input type="checkbox" checked={draft.connectPoints} onChange={e=>patch({connectPoints:e.target.checked})}/> Соединять все точки по порядку</label>
            <label className="lektrus-graph-check"><input type="checkbox" checked={draft.projections} onChange={e=>patch({projections:e.target.checked})}/> Строить проекции точек на оси</label>
          </div>}
          {tab==="geometry"&&<div className="lektrus-graph-section">
            <strong>Геометрические построения</strong><small>Каждое построение связано с точками. При перемещении вершин фигуры перестраиваются автоматически.</small>
            <div className="lektrus-graph-construct-actions">
              <button type="button" disabled={draft.points.length>34} onClick={()=>addConstruction("circle")}>+ Окружность</button>
              <button type="button" disabled={draft.points.length>34} onClick={()=>addConstruction("polygon")}>+ Треугольник</button>
              <button type="button" disabled={draft.points.length>34} onClick={()=>addConstruction("segment")}>+ Отрезок</button>
              <button type="button" disabled={draft.points.length>34} onClick={()=>addConstruction("angle")}>+ Угол</button>
            </div>
            <small>Каждая кнопка добавляет готовые подвижные опорные точки и построение. Связи можно уточнить ниже.</small>
            {draft.circles.map((c,i)=><div className="lektrus-graph-construction" key={"circle"+i}>
              <div className="lektrus-graph-section-head"><strong>Окружность {i+1}</strong><button type="button" onClick={()=>patch({circles:draft.circles.filter((_,j)=>j!==i)})}>Удалить</button></div>
              <label>Центр<select value={c.center} onChange={e=>patch({circles:draft.circles.map((v,j)=>j===i?{...v,center:Number(e.target.value)}:v)})}>{pointOptions()}</select></label>
              <label>Точка на окружности<select value={c.edge} onChange={e=>patch({circles:draft.circles.map((v,j)=>j===i?{...v,edge:Number(e.target.value)}:v)})}>{pointOptions()}</select></label>
              <input aria-label="Подпись окружности" placeholder="Подпись" value={c.label} onChange={e=>patch({circles:draft.circles.map((v,j)=>j===i?{...v,label:e.target.value}:v)})}/>
            </div>)}
            {draft.polygons.map((p,i)=><div className="lektrus-graph-construction" key={"polygon"+i}>
              <div className="lektrus-graph-section-head"><strong>Многоугольник {i+1}</strong><button type="button" onClick={()=>patch({polygons:draft.polygons.filter((_,j)=>j!==i)})}>Удалить</button></div>
              <input aria-label="Название многоугольника" value={p.label} onChange={e=>patch({polygons:draft.polygons.map((v,j)=>j===i?{...v,label:e.target.value}:v)})}/>
              <label>Вершины (номера точек от 1, через запятую)<input value={p.points.map(v=>v+1).join(", ")} onChange={e=>{const parsed=e.target.value.split(",").map(v=>Number(v.trim())-1);if(parsed.length>=3&&parsed.length<=20&&parsed.every(v=>Number.isInteger(v)&&v>=0&&v<draft.points.length))patch({polygons:draft.polygons.map((v,j)=>j===i?{...v,points:parsed}:v)})}}/></label>
              <label className="lektrus-graph-check"><input type="checkbox" checked={p.measure} onChange={e=>patch({polygons:draft.polygons.map((v,j)=>j===i?{...v,measure:e.target.checked}:v)})}/> Вычислять периметр</label>
            </div>)}
            {draft.segments.map((segment,i)=><div className="lektrus-graph-construction" key={"segment"+i}>
              <div className="lektrus-graph-section-head"><strong>Отрезок / прямая {i+1}</strong><button type="button" onClick={()=>patch({segments:draft.segments.filter((_,j)=>j!==i)})}>Удалить</button></div>
              <div className="lektrus-graph-inline"><select aria-label="Начало" value={segment.a} onChange={e=>patch({segments:draft.segments.map((v,j)=>j===i?{...v,a:Number(e.target.value)}:v)})}>{pointOptions()}</select>
                <select aria-label="Конец" value={segment.b} onChange={e=>patch({segments:draft.segments.map((v,j)=>j===i?{...v,b:Number(e.target.value)}:v)})}>{pointOptions()}</select>
                <select aria-label="Тип линии" value={segment.kind} onChange={e=>patch({segments:draft.segments.map((v,j)=>j===i?{...v,kind:e.target.value as typeof segment.kind}:v)})}><option value="segment">Отрезок</option><option value="ray">Луч</option><option value="line">Прямая</option></select></div>
            </div>)}
            {draft.angles.map((angle,i)=><div className="lektrus-graph-construction" key={"angle"+i}>
              <div className="lektrus-graph-section-head"><strong>Угол {i+1}</strong><button type="button" onClick={()=>patch({angles:draft.angles.filter((_,j)=>j!==i)})}>Удалить</button></div>
              <div className="lektrus-graph-inline"><select aria-label="Первый луч угла" value={angle.a} onChange={e=>patch({angles:draft.angles.map((v,j)=>j===i?{...v,a:Number(e.target.value)}:v)})}>{pointOptions()}</select>
                <select aria-label="Вершина угла" value={angle.vertex} onChange={e=>patch({angles:draft.angles.map((v,j)=>j===i?{...v,vertex:Number(e.target.value)}:v)})}>{pointOptions()}</select>
                <select aria-label="Второй луч угла" value={angle.b} onChange={e=>patch({angles:draft.angles.map((v,j)=>j===i?{...v,b:Number(e.target.value)}:v)})}>{pointOptions()}</select></div>
              <input aria-label="Подпись угла" value={angle.label} onChange={e=>patch({angles:draft.angles.map((v,j)=>j===i?{...v,label:e.target.value}:v)})}/>
            </div>)}
          </div>}
        </div>
        <aside className="graph-editor-preview lektrus-graph-preview">
          <div className="lektrus-graph-preview-title"><strong>Предпросмотр</strong><span>Изменения видны сразу</span>
            <button type="button" className="lektrus-preview-expand" aria-pressed={previewExpanded} onClick={()=>setPreviewExpanded(value=>!value)}>
              {previewExpanded?"К настройкам":"Развернуть"}
            </button>
          </div>
          <div className="lektrus-graph-canvas">{preview}</div>
          <div className="lektrus-graph-preview-hint">Перетаскивайте точки мышью или пальцем. Двойное нажатие добавляет или удаляет точку.</div>
        </aside>
      </div>
      <footer className="graph-editor-footer lektrus-graph-footer"><span>Изменения сохраняются на доске после подтверждения</span>
        <div><button type="button" className="secondary" onClick={onCancel}>Отмена</button><button type="button" className="primary" onClick={onSave}>Сохранить</button></div>
      </footer>
    </section>
  </div>;
}
