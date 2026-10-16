import {useEffect, useState, type ReactNode} from "react";
import type {Item} from "./boardModel";
import LektrusColorPicker from "./LektrusColorPicker";
import {mathPresets,makeMathPresetItem,formatPiRadians,type MathPresetId} from "./lektrusMathPresets";

export type GraphDraft = {
  title: string; figureId:string;
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
  triangleLines: NonNullable<Item["graphTriangleLines"]>;
  givenSides:string[]; givenAngles:string[]; triangleInputMode:"SSS"|"SAS"|"ASA";
  triangleVertex: 0|1|2;
  showArea: boolean;
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
  draft:GraphDraft; userId:string; preview:ReactNode; mode:"coordinates"|"geometry";
  onChange:(value:GraphDraft)=>void;
  onSave:()=>void; onCancel:()=>void; onClose:()=>void;
};

const finiteNumber=(text:string,fallback:number)=>{const value=Number(text);return Number.isFinite(value)?value:fallback};

const formulas:Record<GraphDraft["type"],string>={
  linear:"2*x + 1",quadratic:"x^2 - 4*x + 3",sin:"sin(x)",cos:"cos(x)"
};

export default function LektrusGraphEditor({draft,userId,preview,mode,onChange,onSave,onCancel,onClose}:Props) {
  const [tab,setTab]=useState<"presets"|"givens"|"points"|"geometry">("presets");
  const [previewExpanded,setPreviewExpanded]=useState(false);
  const [geometryError,setGeometryError]=useState("");
  const [figureCategory,setFigureCategory]=useState<"Геометрия"|"Объёмные фигуры">(()=>["cube","prism","pyramid","rectangular-prism","triangular-pyramid","sphere","cylinder","cone"].includes(draft.figureId)?"Объёмные фигуры":"Геометрия");
  const solidPresetIds=new Set<MathPresetId>(["cube","prism","pyramid","rectangular-prism","triangular-pyramid","sphere","cylinder","cone"]);
  const isSolid=solidPresetIds.has(draft.figureId as MathPresetId);
  const roundSolid=draft.figureId==="cone"||draft.figureId==="cylinder";
  const equalSideFigure=["square","rhombus","pentagon","hexagon","octagon"].includes(draft.figureId);
  const rectangleFigure=["square","rectangle"].includes(draft.figureId);
  useEffect(()=>{
    const key=(event:KeyboardEvent)=>{
      if(event.key==="Escape"){event.preventDefault();event.stopPropagation();onClose()}
      if((event.ctrlKey||event.metaKey)&&event.key==="Enter"){event.preventDefault();event.stopPropagation();onSave()}
    };
    document.addEventListener("keydown",key,true);
    return ()=>document.removeEventListener("keydown",key,true);
  },[onClose,onSave]);
  const patch=(next:Partial<GraphDraft>)=>onChange({...draft,...next});
  const loadPreset=(id:MathPresetId)=>{
    const sample=makeMathPresetItem(id,0,0,"editor");
    setGeometryError("");
    if(mode==="geometry"){setFigureCategory(solidPresetIds.has(id)?"Объёмные фигуры":"Геометрия");if(tab==="givens"&&id!=="triangle")setTab("presets")}
    patch({
      figureId:id,title:sample.text,purpose:sample.graphPurpose??"coordinates",axisMode:sample.graphAxisMode??"both",
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
      triangleLines:[...(sample.graphTriangleLines??[])],givenSides:[],givenAngles:id==="triangle-right"?["90","",""]:[],triangleInputMode:id==="triangle-right"?"SAS":"SSS",
      triangleVertex:sample.graphTriangleVertex??0,showArea:sample.graphShowArea!==false,
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
  const addSchoolElement=(kind:"diagonal"|"midpoint"|"midline"|"perpendicular-bisector"|"incircle"|"circumcircle"|"radius"|"diameter"|"chord"|"tangent"|"secant"|"axis")=>{
    const points=draft.points.map(p=>({...p}));
    const segments=draft.segments.map(v=>({...v}));
    const circles=draft.circles.map(v=>({...v}));
    const midpoints=draft.midpoints.map(v=>({...v}));
    const push=(x:number,y:number,label="")=>{
      if(points.length>=40)return -1;
      points.push({x,y,label});return points.length-1;
    };
    const line=(a:number,b:number,lineKind:"segment"|"line"="segment")=>{
      if(a>=0&&b>=0&&a!==b&&segments.length<60)segments.push({a,b,kind:lineKind,label:"",measure:false});
    };
    const poly=draft.polygons.find(p=>p.points.length>=3);
    const circle=draft.circles[0];
    const get=(index:number)=>points[index];
    if(["diagonal","midpoint","midline","perpendicular-bisector","incircle","circumcircle"].includes(kind)){
      if(!poly){setGeometryError("Сначала выберите многоугольник.");return}
      const ids=poly.points;
      const a=get(ids[0]),b=get(ids[1]),c=get(ids[2]);
      if(!a||!b||!c)return;
      const midpoint=(p:typeof a,q:typeof a)=>({x:(p.x+q.x)/2,y:(p.y+q.y)/2});
      if(kind==="diagonal"){
        if(ids.length<4){setGeometryError("Диагональ можно построить у фигуры с четырьмя и более вершинами.");return}
        line(ids[0],ids[2]);
      }
      if(kind==="midpoint"&&midpoints.length<40)midpoints.push({a:ids[0],b:ids[1],label:"M"});
      if(kind==="midline"){
        const m=midpoint(a,b),n=midpoint(a,c);
        line(push(m.x,m.y,"M"),push(n.x,n.y,"N"));
      }
      if(kind==="perpendicular-bisector"){
        const m=midpoint(a,b),dx=b.x-a.x,dy=b.y-a.y,len=Math.hypot(dx,dy)||1;
        const p=push(m.x-dy/len*3,m.y+dx/len*3,""),q=push(m.x+dy/len*3,m.y-dx/len*3,"");
        line(p,q,"line");
        if(midpoints.length<40)midpoints.push({a:ids[0],b:ids[1],label:"M"});
      }
      if((kind==="incircle"||kind==="circumcircle")&&ids.length===3){
        let cx=0,cy=0,radius=0;
        if(kind==="incircle"){
          const aa=Math.hypot(b.x-c.x,b.y-c.y),bb=Math.hypot(a.x-c.x,a.y-c.y),cc=Math.hypot(a.x-b.x,a.y-b.y);
          const total=aa+bb+cc;if(total<.0001)return;
          cx=(aa*a.x+bb*b.x+cc*c.x)/total;cy=(aa*a.y+bb*b.y+cc*c.y)/total;
          radius=Math.abs((b.x-a.x)*(a.y-cy)-(a.x-cx)*(b.y-a.y))/Math.max(.0001,Math.hypot(b.x-a.x,b.y-a.y));
        }else{
          const det=2*(a.x*(b.y-c.y)+b.x*(c.y-a.y)+c.x*(a.y-b.y));
          if(Math.abs(det)<.00001){setGeometryError("У этих вершин нельзя построить описанную окружность.");return}
          const q=a.x*a.x+a.y*a.y,w=b.x*b.x+b.y*b.y,z=c.x*c.x+c.y*c.y;
          cx=(q*(b.y-c.y)+w*(c.y-a.y)+z*(a.y-b.y))/det;
          cy=(q*(c.x-b.x)+w*(a.x-c.x)+z*(b.x-a.x))/det;
          radius=Math.hypot(cx-a.x,cy-a.y);
        }
        const center=push(cx,cy,"O"),edge=push(cx+radius,cy,"");
        if(center>=0&&edge>=0&&circles.length<30)circles.push({center,edge,label:"",measure:false});
      }
    }else if(kind==="axis"&&roundSolid){
      if(points.length>=38){setGeometryError("Достигнут предел опорных точек.");return}
      const bottom=points[0],top=points[17];
      if(!bottom||!top)return;
      const a=push(0,bottom.y,"O"),b=push(0,top.y,"O₁");
      line(a,b);
    }else{
      if(!circle){setGeometryError("Сначала добавьте окружность.");return}
      const origin=get(circle.center),edge=get(circle.edge);
      if(!origin||!edge)return;
      const dx=edge.x-origin.x,dy=edge.y-origin.y,r=Math.hypot(dx,dy);
      if(r<.0001)return;
      const nx=dx/r,ny=dy/r;
      if(kind==="radius")line(circle.center,circle.edge);
      if(kind==="diameter"){
        const opposite=push(origin.x-dx,origin.y-dy,"B");
        line(circle.edge,opposite);
      }
      if(kind==="chord"||kind==="secant"){
        const offset=.4*r,span=(kind==="chord"?.9165:1.4)*r;
        const a=push(origin.x+nx*offset-ny*span,origin.y+ny*offset+nx*span,"A");
        const b=push(origin.x+nx*offset+ny*span,origin.y+ny*offset-nx*span,"B");
        line(a,b,kind==="secant"?"line":"segment");
      }
      if(kind==="tangent"){
        const a=push(edge.x-ny*r,edge.y+nx*r,""),b=push(edge.x+ny*r,edge.y-nx*r,"");
        line(a,b,"line");
      }
    }
    if(points.length===draft.points.length&&segments.length===draft.segments.length&&circles.length===draft.circles.length&&midpoints.length===draft.midpoints.length)return;
    patch({points,segments,circles,midpoints});setGeometryError("");
  };
  const figureSections=mode!=="geometry"?
    ["Числа и координаты","Функции","Тригонометрия"].map(name=>({name,presets:mathPresets.filter(p=>p.group===name)})):
    figureCategory==="Геометрия"?[
      {name:"Треугольники",ids:["triangle","triangle-right","triangle-isosceles","triangle-equilateral","triangle-obtuse"]},
      {name:"Четырёхугольники",ids:["quadrilateral","square","rectangle","parallelogram","rhombus","kite","trapezoid","trapezoid-isosceles","trapezoid-right"]},
      {name:"Правильные многоугольники",ids:["pentagon","hexagon","octagon"]},
      {name:"Окружность и углы",ids:["circle","angle"]},
      {name:"Прямые и отрезки",ids:["segment","ray","line","parallel","perpendicular"]}
    ].map(section=>({name:section.name,presets:mathPresets.filter(p=>section.ids.includes(p.id))})):
    [
      {name:"Многогранники",ids:["cube","rectangular-prism","prism","pyramid","triangular-pyramid"]},
      {name:"Тела вращения",ids:["cylinder","cone","sphere"]}
    ].map(section=>({name:section.name,presets:mathPresets.filter(p=>section.ids.includes(p.id))}));
  return <div className={`graph-editor-backdrop lektrus-graph-overlay ${previewExpanded?"is-preview-expanded":""}`} onPointerDown={e=>{if(e.target===e.currentTarget)onClose()}}>
    <section className="graph-editor-modal lektrus-graph-dialog" role="dialog" aria-modal="true" aria-label="Редактор учебного объекта"
      onPointerDown={e=>e.stopPropagation()}>
      <header className="graph-editor-header lektrus-graph-head">
        <div><strong>{mode==="geometry"?"Геометрический конструктор":"Координатная плоскость"}</strong><span>{mode==="geometry"?"Фигуры и геометрические построения":"Графики, координаты и тригонометрия"}</span></div>
        <button type="button" aria-label="Закрыть редактор" onClick={onClose}>×</button>
      </header>
      <nav className="lektrus-graph-tabs" aria-label="Разделы редактора">
        <button type="button" className={tab==="presets"?"active":""} onClick={()=>setTab("presets")}>{mode==="geometry"?"Фигура":"Построение"}</button>
        {mode==="geometry"&&<button type="button" className={tab==="givens"?"active":""} onClick={()=>setTab("givens")}>Размеры</button>}
        {mode==="geometry"&&<button type="button" className={tab==="geometry"?"active":""} onClick={()=>setTab("geometry")}>Элементы <span>{draft.circles.length+draft.polygons.length+draft.segments.length+draft.angles.length}</span></button>}
        {!roundSolid&&<button type="button" className={tab==="points"?"active":""} onClick={()=>setTab("points")}>Точки <span>{draft.points.length}</span></button>}
      </nav>
      <div className="graph-editor-body lektrus-graph-content">
        <div className="graph-editor-form lektrus-graph-settings">
          {tab==="presets"&&<div className="lektrus-graph-section lektrus-math-presets">
            <strong>{mode==="geometry"?"Выберите фигуру":"Выберите построение"}</strong>
            <small>Шаблон можно изменить до сохранения. У объёмных фигур показана редактируемая проекция, вершины и рёбра можно перемещать вручную. Готовых вычислений нет.</small>
            {mode==="geometry"&&<div className="lektrus-math-figure-categories" role="group" aria-label="Тип фигур">
              <button type="button" className={figureCategory==="Геометрия"?"active":""} aria-pressed={figureCategory==="Геометрия"} onClick={()=>setFigureCategory("Геометрия")}>Плоские фигуры</button>
              <button type="button" className={figureCategory==="Объёмные фигуры"?"active":""} aria-pressed={figureCategory==="Объёмные фигуры"} onClick={()=>setFigureCategory("Объёмные фигуры")}>Объёмные фигуры</button>
            </div>}
            {figureSections.map(section=>
              <div className="lektrus-math-preset-group" key={section.name}>
                <h4>{section.name}</h4>
                <div className="lektrus-math-preset-grid">{section.presets.map(p=>
                  <button type="button" key={p.id} className={draft.figureId===p.id||!draft.figureId&&draft.title===p.title?"active":""}
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
              <small>Перемещайте радиус или задавайте угол. Подписи углов показаны в радианах без готовых значений тригонометрических функций.</small>
              <label className="lektrus-graph-field">Угол, градусы
                <input type="range" min="0" max="360" step="1" value={Math.round(activeAngle())} onChange={e=>setCircleAngle(Number(e.target.value))}/>
              </label>
              <div className="lektrus-math-angle-shortcuts">{[0,30,45,60,90,120,135,150,180,225,270,315,330].map(v=>
                <button key={v} type="button" onClick={()=>setCircleAngle(v)}>{formatPiRadians(v*Math.PI/180)}</button>)}</div>
            </div>}
          </div>}
          {mode==="geometry"&&tab==="givens"&&<div className="lektrus-graph-section lektrus-geometry-guided">
            <div className="lektrus-graph-section-head"><strong>Размеры и подписи</strong></div>
            <small>{roundSolid?"Настройте радиус основания и высоту.":isSolid?"Размеры и оформление объёмной фигуры.":"Для треугольника можно задать стороны и углы. Готовые ответы не выводятся."}</small>
            {!isSolid&&draft.polygons.some(p=>p.points.length!==3)&&<div className="lektrus-geometry-givens">
              <strong>Подписи сторон и углов</strong>
              <small>Значения, которые вы впишете, будут показаны непосредственно у соответствующей стороны или вершины. Они не являются ответами и не вычисляются автоматически.</small>
              {draft.polygons.slice(0,1).map((poly,pi)=><div key={pi}>
                {!rectangleFigure&&<div className="lektrus-geometry-given-grid">
                  {poly.points.map((index,i)=>{
                    if(equalSideFigure&&i>0)return null;
                    const next=poly.points[(i+1)%poly.points.length];
                    const name=(draft.points[index]?.label||String.fromCharCode(65+i))+(draft.points[next]?.label||String.fromCharCode(65+(i+1)%poly.points.length));
                    return <label key={i}>{equalSideFigure?"Длина каждой стороны":"Сторона "+name}
                      <input aria-label={"Длина стороны "+name} inputMode="decimal" maxLength={32} placeholder="Например, 5 см"
                        value={draft.givenSides[i]??""} onChange={e=>patch({givenSides:Array.from({length:Math.max(poly.points.length,draft.givenSides.length)},(_,j)=>equalSideFigure?e.target.value:j===i?e.target.value:draft.givenSides[j]??"")})}/>
                    </label>;
                  })}
                </div>}
                <details className="lektrus-geometry-extra-labels"><summary>Подписать углы</summary>
                  <div className="lektrus-geometry-given-grid">
                    {poly.points.map((index,i)=><label key={i}>Угол {draft.points[index]?.label||String.fromCharCode(65+i)}
                      <input aria-label={"Величина угла "+(draft.points[index]?.label||i+1)} inputMode="decimal" maxLength={32} placeholder="Например, 60"
                        value={draft.givenAngles[i]??""} onChange={e=>patch({givenAngles:Array.from({length:Math.max(poly.points.length,draft.givenAngles.length)},(_,j)=>j===i?e.target.value:draft.givenAngles[j]??"")})}/>
                    </label>)}
                  </div>
                </details>
              </div>)}
            </div>}
            {!isSolid&&draft.angles.length>0&&<div className="lektrus-geometry-givens">
              <strong>Величина угла</strong>
              <small>Введите градусы. На чертеже величина появится возле дуги угла.</small>
              {draft.angles.map((angle,i)=><div key={i} className="lektrus-geometry-given-grid">
                <label>Угол {i+1}, °
                  <input inputMode="decimal" placeholder="Например, 45" value={angle.label.replace(/°$/,"")}
                    onChange={e=>patch({angles:draft.angles.map((a,j)=>j===i?{...a,label:e.target.value.slice(0,30)}:a)})}/>
                </label>
                <button type="button" onClick={()=>{
                  const value=Number(angle.label.replace("°","").replace(",","."));
                  if(!(value>0&&value<180)){setGeometryError("Введите угол больше 0° и меньше 180°.");return}
                  const origin=draft.points[angle.vertex],start=draft.points[angle.a],end=draft.points[angle.b];
                  if(!origin||!start||!end)return;
                  const radians=(Math.atan2(start.y-origin.y,start.x-origin.x)+value*Math.PI/180);
                  const length=Math.max(2,Math.hypot(end.x-origin.x,end.y-origin.y));
                  patch({points:draft.points.map((p,j)=>j===angle.b?{...p,x:origin.x+length*Math.cos(radians),y:origin.y+length*Math.sin(radians)}:p)});
                  setGeometryError("");
                }}>Построить угол</button>
              </div>)}
              {geometryError&&<small role="alert" className="lektrus-geometry-error">{geometryError}</small>}
            </div>}
            {!isSolid&&draft.segments.length>0&&draft.polygons.length===0&&draft.angles.length===0&&<div className="lektrus-geometry-givens">
              <strong>Обозначения отрезков и прямых</strong>
              {draft.segments.map((seg,i)=><label key={i}>Отрезок или прямая {i+1}
                <input placeholder="Длина или обозначение" value={seg.label} onChange={e=>patch({segments:draft.segments.map((v,j)=>j===i?{...v,label:e.target.value.slice(0,32)}:v)})}/>
              </label>)}
            </div>}
            {(!isSolid||draft.figureId==="sphere")&&draft.circles.length>0&&<div className="lektrus-geometry-givens">
              <strong>Радиус окружности</strong>
              {draft.circles.map((circle,i)=><label key={i}>Радиус {i+1}
                <input type="number" min="0.1" step="any" inputMode="decimal"
                  value={draft.givenSides[i]??String(Math.hypot((draft.points[circle.edge]?.x??3)-(draft.points[circle.center]?.x??0),(draft.points[circle.edge]?.y??0)-(draft.points[circle.center]?.y??0)).toFixed(2))}
                  onChange={e=>patch({givenSides:Array.from({length:Math.max(i+1,draft.givenSides.length)},(_,j)=>j===i?e.target.value:draft.givenSides[j]??"")})}/>
              </label>)}
              <button type="button" onClick={()=>{
                const points=draft.points.map(p=>({...p}));
                for(let i=0;i<draft.circles.length;i++){
                  const c=draft.circles[i],radius=Number((draft.givenSides[i]??"3").replace(",","."));
                  if(!(radius>0&&Number.isFinite(radius))){setGeometryError("Радиус должен быть положительным.");return}
                  const center=points[c.center],edge=points[c.edge];if(!center||!edge)continue;
                  const theta=Math.atan2(edge.y-center.y,edge.x-center.x);
                  points[c.edge]={...edge,x:center.x+radius*Math.cos(theta),y:center.y+radius*Math.sin(theta)};
                }
                patch({points});setGeometryError("");
              }}>Применить радиус</button>
              {geometryError&&<small role="alert" className="lektrus-geometry-error">{geometryError}</small>}
            </div>}
            {!isSolid&&rectangleFigure&&draft.polygons.some(p=>p.points.length===4)&&<div className="lektrus-geometry-givens">
              <strong>{draft.figureId==="square"?"Сторона квадрата":"Длина и ширина прямоугольника"}</strong>
              <small>Задайте длину и ширину для прямоугольной основы. Подписи можно изменить на вкладке «Точки».</small>
              <div className="lektrus-geometry-given-grid">
                {(draft.figureId==="square"?["Сторона"]:["Длина","Ширина"]).map((label,i)=><label key={label}>{label}
                  <input type="number" min="0.1" step="any" value={draft.givenSides[i]??"6"}
                    onChange={e=>{const v=e.target.value;patch({givenSides:draft.figureId==="square"?[v,v,v,v]:[v===undefined?"":i===0?v:draft.givenSides[0]??"6",i===1?v:draft.givenSides[1]??"6",i===0?v:draft.givenSides[0]??"6",i===1?v:draft.givenSides[1]??"6"]})}}/>
                </label>)}
              </div>
              <button type="button" onClick={()=>{
                const length=Number(draft.givenSides[0]??"6"),width=draft.figureId==="square"?length:Number(draft.givenSides[1]??"6");
                if(!Number.isFinite(length)||!Number.isFinite(width)||length<=0||width<=0){setGeometryError("Укажите положительные размеры.");return}
                const poly=draft.polygons.find(p=>p.points.length===4);
                if(!poly)return;
                const factor=7/Math.max(length,width);
                const coords=[[-length/2,-width/2],[length/2,-width/2],[length/2,width/2],[-length/2,width/2]];
                patch({points:draft.points.map((point,index)=>{
                  const k=poly.points.indexOf(index);return k<0?point:{...point,x:coords[k][0]*factor,y:coords[k][1]*factor};
                })});setGeometryError("");
              }}>Применить размеры</button>
              {geometryError&&<small role="alert" className="lektrus-geometry-error">{geometryError}</small>}
            </div>}
            {isSolid&&!roundSolid&&draft.figureId!=="sphere"&&<div className="lektrus-geometry-givens">
              <strong>{draft.figureId==="cube"?"Ребро куба":"Длина, ширина и высота"}</strong>
              <small>Задайте пропорции объёмной фигуры; готовые формулы и ответы не выводятся.</small>
              <div className="lektrus-geometry-given-grid">
                {(draft.figureId==="cube"?["Ребро"]:["Длина","Ширина","Высота"]).map((label,i)=><label key={label}>{label}
                  <input type="number" min="0.1" step="any" inputMode="decimal" value={draft.givenSides[i]??"4"} onChange={e=>patch({givenSides:draft.figureId==="cube"?[e.target.value,e.target.value,e.target.value]:[0,1,2].map(j=>j===i?e.target.value:draft.givenSides[j]??"4")})}/>
                </label>)}
              </div>
              <button type="button" onClick={()=>{
                const dimensions=[0,1,2].map(i=>Number((draft.givenSides[i]??"4").replace(",",".")));
                if(dimensions.some(n=>!Number.isFinite(n)||n<=0)){setGeometryError("Все размеры должны быть положительными.");return}
                const [length,width,height]=draft.figureId==="cube"?[dimensions[0],dimensions[0],dimensions[0]]:dimensions;
                const max=Math.max(...dimensions);
                const lx=length/max*5,wy=width/max*2,h=height/max*6;
                const vertices=(draft.figureId==="cube"||draft.figureId==="rectangular-prism")?
                  [[-lx/2-wy/2,-h/2-wy/2],[lx/2-wy/2,-h/2-wy/2],[lx/2+wy/2,-h/2+wy/2],[-lx/2+wy/2,-h/2+wy/2],[-lx/2-wy/2,h/2-wy/2],[lx/2-wy/2,h/2-wy/2],[lx/2+wy/2,h/2+wy/2],[-lx/2+wy/2,h/2+wy/2]]:
                  draft.figureId==="prism"?
                  [[-lx/2,-h/2],[lx/2,-h/2],[0,-h/2+wy],[-lx/2+wy/2,h/2],[lx/2+wy/2,h/2],[wy/2,h/2+wy]]:
                  draft.figureId==="triangular-pyramid"?
                  [[-lx/2,-h/2],[lx/2,-h/2],[0,-h/2+wy],[0,h/2]]:
                  [[-lx/2,-h/2],[lx/2,-h/2],[lx/2+wy/2,-h/2+wy/2],[-lx/2+wy/2,-h/2+wy/2],[wy/4,h/2]];
                patch({points:draft.points.map((p,i)=>vertices[i]?{...p,x:vertices[i][0],y:vertices[i][1]}:p)});
                setGeometryError("");
              }}>Применить размеры</button>
              {geometryError&&<small role="alert" className="lektrus-geometry-error">{geometryError}</small>}
            </div>}
            {roundSolid&&<div className="lektrus-geometry-givens">
              <strong>Радиус основания и высота</strong>
              <small>Задайте радиус и высоту, не редактируя точки окружностей.</small>
              <div className="lektrus-geometry-given-grid">
                {(["Радиус","Высота"] as const).map((label,i)=><label key={label}>{label}
                  <input type="number" min="0.1" step="any" inputMode="decimal" value={draft.givenSides[i]??(i===0?"3.2":"6")} onChange={e=>patch({givenSides:[0,1].map(j=>j===i?e.target.value:draft.givenSides[j]??(j===0?"3.2":"6"))})}/>
                </label>)}
              </div>
              <button type="button" onClick={()=>{
                const radius=Number((draft.givenSides[0]??"3.2").replace(",",".")),height=Number((draft.givenSides[1]??"6").replace(",","."));
                if(!Number.isFinite(radius)||!Number.isFinite(height)||radius<=0||height<=0){setGeometryError("Укажите положительные радиус и высоту.");return}
                const radiusView=4*radius/Math.max(radius,height),heightView=7*height/Math.max(radius,height);
                const arc=(cy:number)=>Array.from({length:17},(_,i)=>({x:Number((radiusView*Math.cos(2*Math.PI*i/16)).toFixed(5)),y:Number((cy+radiusView*.34*Math.sin(2*Math.PI*i/16)).toFixed(5)),label:""}));
                patch({points:[...arc(-heightView/2),...(draft.figureId==="cylinder"?arc(heightView/2):[{x:0,y:heightView/2,label:"S"}])]});
                setGeometryError("");
              }}>Применить размеры</button>
              {geometryError&&<small role="alert" className="lektrus-geometry-error">{geometryError}</small>}
            </div>}
            {!isSolid&&draft.polygons.some(p=>p.points.length===3)?<>
              <div className="lektrus-geometry-givens">
                <strong>Дано в условии задачи</strong>
                <small>Значения указываются на рисунке. Автоматические ответы и вычисления не показываются.</small>
                {!["triangle-right","triangle-equilateral","triangle-isosceles"].includes(draft.figureId)&&<label>Способ построения
                  <select value={draft.triangleInputMode} onChange={e=>patch({triangleInputMode:e.target.value as "SSS"|"SAS"|"ASA"})}>
                    <option value="SSS">По трём сторонам (AB, BC, CA)</option>
                    <option value="SAS">По двум сторонам AB, CA и углу A</option>
                    <option value="ASA">По стороне AB и двум углам A, B</option>
                  </select>
                </label>}
                {draft.figureId==="triangle-right"&&<small>Прямой угол A = 90°. Введите катеты AB и AC.</small>}
                {draft.figureId==="triangle-equilateral"&&<small>Введите одну сторону. Остальные равны ей.</small>}
                {draft.figureId==="triangle-isosceles"&&<small>Введите основание AB и равную боковую сторону BC = CA.</small>}
                <div className="lektrus-geometry-given-grid">
                  {["AB","BC","CA"].map((side,i)=>{
                    const required=draft.figureId==="triangle-equilateral"?i===0:draft.figureId==="triangle-isosceles"?i<2:draft.figureId==="triangle-right"?i!==1:draft.triangleInputMode==="SSS"||i===0||draft.triangleInputMode==="SAS"&&i===2;
                    return required?<label key={side}>{side} <small>длина</small>
                      <input inputMode="decimal" placeholder="Например, 5" value={draft.givenSides[i]??""} onChange={e=>{const value=e.target.value.slice(0,32);const sides=draft.figureId==="triangle-equilateral"?[value,value,value]:[0,1,2].map(j=>j===i?value:draft.givenSides[j]??"");if(draft.figureId==="triangle-isosceles"&&i===1)sides[2]=value;patch({givenSides:sides})}}/>
                    </label>:null;
                  })}
                  {["∠A","∠B","∠C"].map((angle,i)=>{
                    const required=["triangle-right","triangle-isosceles","triangle-equilateral"].includes(draft.figureId)?false:draft.triangleInputMode==="SAS"&&i===0||draft.triangleInputMode==="ASA"&&i<2;
                    return required?<label key={angle}>{angle} <small>градусы</small>
                      <input inputMode="decimal" placeholder="Например, 60" value={draft.givenAngles[i]??""} onChange={e=>patch({givenAngles:[0,1,2].map(j=>j===i?e.target.value.slice(0,32):draft.givenAngles[j]??"")})}/>
                    </label>:null;
                  })}
                </div>
                <details className="lektrus-geometry-extra-labels">
                  <summary>Остальные подписи для условия задачи</summary>
                  <small>Необязательные значения подписываются на чертеже, но не используются для построения.</small>
                  <div className="lektrus-geometry-given-grid">
                    {["AB","BC","CA"].map((side,i)=><label key={side}>{side}
                      <input inputMode="decimal" placeholder="Подпись стороны" value={draft.givenSides[i]??""} onChange={e=>patch({givenSides:[0,1,2].map(j=>j===i?e.target.value.slice(0,32):draft.givenSides[j]??"")})}/>
                    </label>)}
                    {["∠A","∠B","∠C"].map((angle,i)=><label key={angle}>{angle}
                      <input inputMode="decimal" placeholder="Подпись угла" value={draft.givenAngles[i]??""} onChange={e=>patch({givenAngles:[0,1,2].map(j=>j===i?e.target.value.slice(0,32):draft.givenAngles[j]??"")})}/>
                    </label>)}
                  </div>
                </details>
                <button type="button" onClick={()=>{
                  const parse=(text:string)=>{const n=Number(text.replace(",",".").trim());return text.trim()!==""&&Number.isFinite(n)&&n>0?n:NaN};
                  const ab=parse(draft.givenSides[0]??""),bc=parse(draft.givenSides[1]??""),ca=parse(draft.givenSides[2]??"");
                  let ax=0,ay=0,bx=0,by=0,cx=0,cy=0;
                  if(draft.triangleInputMode==="SSS"){
                    if(![ab,bc,ca].every(Number.isFinite)||ab+bc<=ca||ab+ca<=bc||bc+ca<=ab){setGeometryError("Укажите три положительные стороны, удовлетворяющие неравенству треугольника.");return}
                    bx=ab;cx=(ab*ab+ca*ca-bc*bc)/(2*ab);cy=Math.sqrt(Math.max(0,ca*ca-cx*cx));
                  }else if(draft.triangleInputMode==="SAS"){
                    const degrees=parse(draft.givenAngles[0]??"");
                    if(!Number.isFinite(ab)||!Number.isFinite(ca)||!Number.isFinite(degrees)||degrees>=180){setGeometryError("Для построения укажите AB, CA и угол A от 0° до 180°.");return}
                    bx=ab;cx=ca*Math.cos(degrees*Math.PI/180);cy=ca*Math.sin(degrees*Math.PI/180);
                  }else{
                    const angleA=parse(draft.givenAngles[0]??""),angleB=parse(draft.givenAngles[1]??"");
                    if(!Number.isFinite(ab)||!Number.isFinite(angleA)||!Number.isFinite(angleB)||angleA+angleB>=180){
                      setGeometryError("Для построения укажите сторону AB и два положительных угла A и B, сумма которых меньше 180°.");return;
                    }
                    const a=angleA*Math.PI/180,b=angleB*Math.PI/180,c=Math.PI-a-b;
                    const ac=ab*Math.sin(b)/Math.sin(c);
                    bx=ab;cx=ac*Math.cos(a);cy=ac*Math.sin(a);
                  }
                  const triangle=draft.polygons.find(p=>p.points.length===3);
                  if(!triangle){setGeometryError("Сначала выберите шаблон треугольника.");return}
                  const max=Math.max(ab,Number.isFinite(ca)?ca:0,Math.abs(cx),Math.abs(cy),1),factor=5/max;
                  const coords=[{x:ax,y:ay},{x:bx*factor,y:by},{x:cx*factor,y:cy*factor}];
                  patch({points:draft.points.map((p,i)=>{const k=triangle.points.indexOf(i);return k<0?p:{...p,...coords[k]}})});
                  setGeometryError("");
                }}>Построить по заданным значениям</button>
                {geometryError&&<small role="alert" className="lektrus-geometry-error">{geometryError}</small>}
              </div>


            </>:!roundSolid&&<div className="lektrus-graph-empty">{isSolid?"Габариты проекции настраиваются перемещением вершин в предпросмотре или на вкладке «Точки».":"Построение по заданным сторонам и углам доступно для треугольника. Выберите его во вкладке «Фигура»."}</div>}
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
          {mode==="geometry"&&tab==="geometry"&&<div className="lektrus-graph-section">
            <strong>Дополнительные элементы</strong><small>Добавьте окружности, отрезки, углы и вспомогательные линии. Для ввода сторон и углов используйте вкладку «Стороны и углы».</small>
            <div className="lektrus-graph-construct-actions">
              <button type="button" disabled={draft.points.length>34} onClick={()=>addConstruction("circle")}>+ Окружность</button>
              <button type="button" disabled={draft.points.length>34} onClick={()=>addConstruction("polygon")}>+ Треугольник</button>
              <button type="button" disabled={draft.points.length>34} onClick={()=>addConstruction("segment")}>+ Отрезок</button>
              <button type="button" disabled={draft.points.length>34} onClick={()=>addConstruction("angle")}>+ Угол</button>
            </div>
            <small>Элементы привязываются к опорным точкам фигуры. Размеры задаются во вкладке «Размеры».</small>
            {draft.polygons.length>0&&<div className="lektrus-graph-construction">
              <strong>Школьные построения на многоугольнике</strong>
              <div className="lektrus-graph-construct-actions">
                {draft.polygons.some(p=>p.points.length>=4)&&<button type="button" onClick={()=>addSchoolElement("diagonal")}>+ Диагональ</button>}
                <button type="button" onClick={()=>addSchoolElement("midpoint")}>+ Середина стороны</button>
                <button type="button" onClick={()=>addSchoolElement("midline")}>+ Средняя линия</button>
                <button type="button" onClick={()=>addSchoolElement("perpendicular-bisector")}>+ Серединный перпендикуляр</button>
                {draft.polygons.some(p=>p.points.length===3)&&<>
                  <button type="button" onClick={()=>addSchoolElement("incircle")}>+ Вписанная окружность</button>
                  <button type="button" onClick={()=>addSchoolElement("circumcircle")}>+ Описанная окружность</button>
                </>}
              </div>
            </div>}
            {draft.circles.length>0&&!roundSolid&&<div className="lektrus-graph-construction">
              <strong>Элементы окружности</strong>
              <div className="lektrus-graph-construct-actions">
                {(["radius","diameter","chord","tangent","secant"] as const).map((kind,i)=><button type="button" key={kind} onClick={()=>addSchoolElement(kind)}>+ {["Радиус","Диаметр","Хорда","Касательная","Секущая"][i]}</button>)}
              </div>
            </div>}
            {roundSolid&&<div className="lektrus-graph-construction"><strong>Элементы тела вращения</strong>
              <button type="button" onClick={()=>addSchoolElement("axis")}>+ Ось симметрии</button>
            </div>}
            {geometryError&&<small role="alert" className="lektrus-geometry-error">{geometryError}</small>}

            {draft.polygons.some(p=>p.points.length===3)&&<div className="lektrus-graph-construction">
              <strong>Медиана, высота и биссектриса</strong>
              <label className="lektrus-graph-field">Вершина построений
                <select value={draft.triangleVertex} onChange={e=>patch({triangleVertex:Number(e.target.value) as 0|1|2})}>
                  {draft.polygons.find(p=>p.points.length===3)?.points.map((pointIndex,index)=>
                    <option key={index} value={index}>{draft.points[pointIndex]?.label||["A","B","C"][index]}</option>)}
                </select>
              </label>


              <small>Построения автоматически перестраиваются при движении вершин первого треугольника.</small>
              {([{id:"median",label:"Медиана"},{id:"altitude",label:"Высота"},{id:"bisector",label:"Биссектриса"}] as const).map(option=>
                <label key={option.id} className="lektrus-graph-check"><input type="checkbox" checked={draft.triangleLines.includes(option.id)}
                  onChange={e=>patch({triangleLines:e.target.checked?[...draft.triangleLines,option.id]:draft.triangleLines.filter(v=>v!==option.id)})}/>{option.label} из выбранной вершины</label>)}
            </div>}

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
              <label className="lektrus-graph-check"><input type="checkbox" checked={p.measure} onChange={e=>patch({polygons:draft.polygons.map((v,j)=>j===i?{...v,measure:e.target.checked}:v)})}/> Показывать подпись фигуры</label>
            </div>)}
            {draft.segments.map((segment,i)=><div className="lektrus-graph-construction" key={"segment"+i}>
              <div className="lektrus-graph-section-head"><strong>Отрезок / прямая {i+1}</strong><button type="button" onClick={()=>patch({segments:draft.segments.filter((_,j)=>j!==i)})}>Удалить</button></div>
              <div className="lektrus-graph-inline"><select aria-label="Начало" value={segment.a} onChange={e=>patch({segments:draft.segments.map((v,j)=>j===i?{...v,a:Number(e.target.value)}:v)})}>{pointOptions()}</select>
                <select aria-label="Конец" value={segment.b} onChange={e=>patch({segments:draft.segments.map((v,j)=>j===i?{...v,b:Number(e.target.value)}:v)})}>{pointOptions()}</select>
                <select aria-label="Тип линии" value={segment.kind} onChange={e=>patch({segments:draft.segments.map((v,j)=>j===i?{...v,kind:e.target.value as typeof segment.kind}:v)})}><option value="segment">Отрезок</option><option value="ray">Луч</option><option value="line">Прямая</option></select></div>
              <label className="lektrus-graph-field"><span>Подпись или заданная длина</span><input aria-label={"Подпись или длина линии "+(i+1)} placeholder="Например, 5 см или a" maxLength={32} value={segment.label} onChange={e=>patch({segments:draft.segments.map((v,j)=>j===i?{...v,label:e.target.value}:v)})}/></label>
            </div>)}
            {draft.midpoints.map((midpoint,i)=><div className="lektrus-graph-construction" key={"midpoint"+i}>
              <div className="lektrus-graph-section-head"><strong>Середина отрезка {i+1}</strong><button type="button" onClick={()=>patch({midpoints:draft.midpoints.filter((_,j)=>j!==i)})}>Удалить</button></div>
              <label className="lektrus-graph-field"><span>Название точки</span><input maxLength={24} value={midpoint.label} onChange={e=>patch({midpoints:draft.midpoints.map((v,j)=>j===i?{...v,label:e.target.value}:v)})}/></label>
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
