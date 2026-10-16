import {useEffect, useState, type ReactNode} from "react";
import type {Item} from "./boardModel";
import LektrusColorPicker from "./LektrusColorPicker";

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
  onSave:()=>void; onCancel:()=>void;
};

const purposes:{id:GraphDraft["purpose"];label:string;description:string}[]=[
  {id:"function",label:"График функции",description:"Построение по формуле"},
  {id:"coordinates",label:"Координатная плоскость",description:"Оси и точки"},
  {id:"number-line",label:"Числовая прямая",description:"Числа и промежутки"},
  {id:"geometry",label:"Геометрическое построение",description:"Фигуры и измерения"},
  {id:"unit-circle",label:"Окружность",description:"Центр, радиус, углы"}
];
const formulas:Record<GraphDraft["type"],string>={
  linear:"2*x + 1",quadratic:"x^2 - 4*x + 3",sin:"sin(x)",cos:"cos(x)"
};
const finiteNumber=(input:string,fallback:number)=>Number.isFinite(Number(input))?Number(input):fallback;

export default function LektrusGraphEditor({draft,userId,preview,onChange,onSave,onCancel}:Props) {
  const [tab,setTab]=useState<"settings"|"points"|"geometry">("settings");
  useEffect(()=>{
    const key=(event:KeyboardEvent)=>{
      if(event.key==="Escape"){event.preventDefault();event.stopPropagation();onCancel()}
      if((event.ctrlKey||event.metaKey)&&event.key==="Enter"){event.preventDefault();event.stopPropagation();onSave()}
    };
    document.addEventListener("keydown",key,true);
    return ()=>document.removeEventListener("keydown",key,true);
  },[onCancel,onSave]);
  const patch=(next:Partial<GraphDraft>)=>onChange({...draft,...next});
  const selectPurpose=(purpose:GraphDraft["purpose"])=>{
    if(purpose==="unit-circle"&&!draft.circles.length){
      const center=draft.points.length,edge=center+1;
      patch({purpose,title:draft.title||"Единичная окружность",expression:"",showCurve:false,
        points:[...draft.points,{x:0,y:0,label:"O"},{x:1,y:0,label:"R"}],
        circles:[...draft.circles,{center,edge,label:"r = 1",measure:true}]});
      return;
    }
    patch({purpose,axisMode:purpose==="number-line"?"x":draft.axisMode,grid:purpose==="number-line"?false:draft.grid,showCurve:purpose==="function",expression:purpose==="function"?(draft.expression||formulas[draft.type]):"",connectPoints:purpose==="number-line"});
  };
  const editPoint=(i:number,change:Partial<GraphDraft["points"][number]>)=>
    patch({points:draft.points.map((p,j)=>j===i?{...p,...change}:p)});
  const pointOptions=(exclude=-1)=>draft.points.map((p,i)=>i===exclude?null:<option key={i} value={i}>{p.label||"Точка "+(i+1)} ({p.x}; {p.y})</option>);
  const addPoint=()=>patch({points:[...draft.points,{x:0,y:0,label:String.fromCharCode(65+(draft.points.length%26))}]});
  const axisChoices:{id:GraphDraft["axisMode"];label:string;detail:string}[]=[
    {id:"none",label:"0",detail:"Без осей"}, {id:"x",label:"X",detail:"1 ось"},
    {id:"y",label:"Y",detail:"1 ось"}, {id:"both",label:"X + Y",detail:"2 оси"}
  ];
  return <div className="graph-editor-backdrop lektrus-graph-overlay" onPointerDown={e=>{if(e.target===e.currentTarget)onSave()}}>
    <section className="graph-editor-modal lektrus-graph-dialog" role="dialog" aria-modal="true" aria-label="Редактор учебного объекта"
      onPointerDown={e=>e.stopPropagation()}>
      <header className="graph-editor-header lektrus-graph-head">
        <div><strong>Редактор учебного объекта</strong><span>Графики, координаты и геометрические построения</span></div>
        <button type="button" aria-label="Закрыть редактор" onClick={onSave}>×</button>
      </header>
      <nav className="lektrus-graph-tabs" aria-label="Разделы редактора">
        <button type="button" className={tab==="settings"?"active":""} onClick={()=>setTab("settings")}>Основное</button>
        <button type="button" className={tab==="points"?"active":""} onClick={()=>setTab("points")}>Точки <span>{draft.points.length}</span></button>
        <button type="button" className={tab==="geometry"?"active":""} onClick={()=>setTab("geometry")}>Построения <span>{draft.circles.length+draft.polygons.length+draft.segments.length+draft.angles.length}</span></button>
      </nav>
      <div className="graph-editor-body lektrus-graph-content">
        <div className="graph-editor-form lektrus-graph-settings">
          {tab==="settings"&&<>
            <label className="lektrus-graph-field"><span>Название на доске</span>
              <input value={draft.title} maxLength={100} placeholder="Название учебного объекта" onChange={e=>patch({title:e.target.value})}/>
            </label>
            <div className="lektrus-graph-section"><strong>Тип объекта</strong>
              <div className="lektrus-graph-kind-grid">
                {purposes.map(p=><button key={p.id} type="button" className={draft.purpose===p.id?"active":""} onClick={()=>selectPurpose(p.id)}>
                  <b>{p.label}</b><small>{p.description}</small></button>)}
              </div>
            </div>
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
              {draft.points.length>=2&&<strong>{draft.intervalStartClosed?"[":"("}{draft.points[0].x}; {draft.points[1].x}{draft.intervalEndClosed?"]":")"}</strong>}
            </div>}
            <div className="lektrus-graph-section"><strong>Оси координат</strong><span className="lektrus-graph-note">Выберите 0, 1 или 2 оси. Третья ось требует отдельного 3D-инструмента.</span>
              <div className="lektrus-graph-axis-options">{axisChoices.map(axis=><button key={axis.id} type="button" className={draft.axisMode===axis.id?"active":""} title={axis.detail} onClick={()=>patch({axisMode:axis.id})}>{axis.label}<small>{axis.detail}</small></button>)}</div>
            </div>
            <div className="lektrus-graph-section"><strong>Координатные пределы</strong>
              <div className="graph-ranges">{(["xMin","xMax","yMin","yMax"] as const).map(key=><label key={key}>{key.replace("Min"," min").replace("Max"," max")}
                <input type="number" step=".5" value={draft[key]} onChange={e=>patch({[key]:finiteNumber(e.target.value,draft[key])})}/></label>)}</div>
              <label className="lektrus-graph-field"><span>Шаг сетки</span><select value={draft.gridStep} onChange={e=>patch({gridStep:Number(e.target.value)})}><option value={.25}>0,25</option><option value={.5}>0,5</option><option value={1}>1</option><option value={2}>2</option><option value={5}>5</option></select></label>
              <div className="lektrus-graph-checks">
                <label><input type="checkbox" checked={draft.grid} onChange={e=>patch({grid:e.target.checked})}/> Сетка</label>
                <label><input type="checkbox" checked={draft.axisLabels} onChange={e=>patch({axisLabels:e.target.checked})}/> Деления осей</label>
                <label><input type="checkbox" checked={draft.snap} onChange={e=>patch({snap:e.target.checked})}/> Привязка к сетке</label>
                <label><input type="checkbox" checked={draft.showLabels} onChange={e=>patch({showLabels:e.target.checked})}/> Подписи точек</label>
              </div>
            </div>
          </>}
          {tab==="points"&&<div className="lektrus-graph-section"><div className="lektrus-graph-section-head"><strong>Редактируемые точки</strong><button type="button" onClick={addPoint}>+ Точка</button></div>
            <small>Перемещайте точки прямо на рисунке. Двойное нажатие по пустому месту добавляет точку.</small>
            {draft.points.length===0&&<p className="lektrus-graph-empty">Пока нет точек. Добавьте первую.</p>}
            {draft.points.map((p,i)=><div className="lektrus-graph-point-row" key={i}>
              <input aria-label={"Название точки "+(i+1)} maxLength={24} value={p.label} placeholder="Имя" onChange={e=>editPoint(i,{label:e.target.value})}/>
              <input aria-label={"X точки "+(i+1)} type="number" step=".25" value={p.x} onChange={e=>editPoint(i,{x:finiteNumber(e.target.value,p.x)})}/>
              <input aria-label={"Y точки "+(i+1)} title={draft.purpose==="number-line"?"На числовой прямой все точки имеют Y = 0":undefined} disabled={draft.purpose==="number-line"} type="number" step=".25" value={draft.purpose==="number-line"?0:p.y} onChange={e=>editPoint(i,{y:finiteNumber(e.target.value,p.y)})}/>
              <LektrusColorPicker userId={userId} label="" compact value={p.color??"#111111"} onChange={color=>editPoint(i,{color})}/>
              <button type="button" aria-label={"Удалить точку "+(i+1)} title="Удалить точку и связанные с ней построения" onClick={()=>onChange(removeGraphPoint(draft,i))}>×</button>
            </div>)}
            {draft.purpose==="number-line"&&<p className="lektrus-graph-note">Точки на числовой прямой обозначают числа. Соедините две точки, чтобы показать промежуток. Положение точек можно менять в предпросмотре.</p>}
            <label className="lektrus-graph-check"><input type="checkbox" checked={draft.connectPoints} onChange={e=>patch({connectPoints:e.target.checked})}/> Соединять все точки по порядку</label>
            <label className="lektrus-graph-check"><input type="checkbox" checked={draft.projections} onChange={e=>patch({projections:e.target.checked})}/> Строить проекции точек на оси</label>
          </div>}
          {tab==="geometry"&&<div className="lektrus-graph-section">
            <strong>Геометрические построения</strong><small>Каждое построение связано с точками. При перемещении вершин фигуры перестраиваются автоматически.</small>
            <div className="lektrus-graph-construct-actions">
              <button type="button" disabled={draft.points.length<2} onClick={()=>patch({circles:[...draft.circles,{center:0,edge:1,label:"Окружность",measure:true}]})}>+ Окружность</button>
              <button type="button" disabled={draft.points.length<3} onClick={()=>patch({polygons:[...draft.polygons,{points:[0,1,2],label:"ABC",measure:true}]})}>+ Многоугольник</button>
              <button type="button" disabled={draft.points.length<2} onClick={()=>patch({segments:[...draft.segments,{a:0,b:1,kind:"segment",label:"",measure:true}]})}>+ Отрезок</button>
              <button type="button" disabled={draft.points.length<3} onClick={()=>patch({angles:[...draft.angles,{a:0,vertex:1,b:2,label:"Угол"}]})}>+ Угол</button>
            </div>
            {draft.points.length<2&&<p className="lektrus-graph-empty">Для построений сначала добавьте точки во вкладке «Точки».</p>}
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
          <div className="lektrus-graph-preview-title"><strong>Предпросмотр</strong><span>Изменения видны сразу</span></div>
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
