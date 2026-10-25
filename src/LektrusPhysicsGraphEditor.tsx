import {useEffect,useMemo,useRef,useState,type PointerEvent as ReactPointerEvent} from "react";
import {createPortal} from "react-dom";
import type {Item} from "./boardModel";
import {scienceToolGroupForId} from "./lektrusScienceCatalog";
import type {SciencePresetId} from "./lektrusSciencePresets";

type Props={item:Item;onSave:(next:Item)=>void;onCancel:()=>void;onClose?:(next:Item)=>void};
type Point={x:number;y:number;label:string;color?:string};
type Draft={figureId:string;title:string;points:Point[];xMax:number;yMin:number;yMax:number;grid:boolean;snap:boolean;connect:boolean;showLabels:boolean};
type History={past:Draft[];present:Draft;future:Draft[]};
type Tool="select"|"point";
const presetIds=new Set<string>(["physics-motion","physics-speed","physics-accelerated-speed","physics-acceleration","physics-braking","physics-rest"]);
const defaultTitle="График движения";
const initial=(item:Item):Draft=>({
  figureId:presetIds.has(item.graphFigureId??"")?item.graphFigureId!:"physics-motion",
  title:item.text?.trim()||defaultTitle,
  points:(item.graphPoints??[]).map(point=>({x:point.x,y:point.y,label:point.label??"",color:point.color})),
  xMax:Math.max(1,item.graphXMax??12),
  yMin:item.graphYMin??0,
  yMax:Math.max((item.graphYMin??0)+1,item.graphYMax??10),
  grid:item.graphGrid!==false,snap:item.graphSnap===true,
  connect:item.graphConnectPoints!==false,showLabels:item.graphShowLabels===true
});
const clamp=(n:number,a:number,b:number)=>Math.max(a,Math.min(b,n));
const format=(n:number)=>Number(n.toFixed(2)).toLocaleString("ru-RU");
const PLOT={left:88,top:48,width:812,height:451};
function axes(figureId:string){
  if(figureId==="physics-acceleration")return {variable:"a",unit:"м/с²",title:"Ускорение"};
  if(["physics-speed","physics-accelerated-speed","physics-braking"].includes(figureId))
    return {variable:"v",unit:"м/с",title:"Скорость"};
  return {variable:"s",unit:"м",title:"Путь"};
}
function makeItem(item:Item,d:Draft):Item{
  return {...item,text:d.title.trim().slice(0,100)||defaultTitle,graphFigureId:d.figureId,
    graphPurpose:"coordinates",graphAxisMode:"both",graphType:"linear",
    graphShowCurve:false,graphExpression:"",graphGrid:d.grid,graphSnap:d.snap,
    graphConnectPoints:d.connect,graphShowLabels:d.showLabels,graphAxisLabels:true,
    graphXMin:0,graphXMax:d.xMax,graphYMin:d.yMin,graphYMax:d.yMax,
    graphPoints:[...d.points].sort((a,b)=>a.x-b.x).map(point=>({...point})),graphSegments:[],graphPolygons:[],
    graphCircles:[],graphAngles:[],graphMidpoints:[]};
}
export default function LektrusPhysicsGraphEditor({item,onSave,onCancel,onClose}:Props){
  const [history,setHistory]=useState<History>(()=>({past:[],present:initial(item),future:[]}));
  const draft=history.present;
  const [tool,setTool]=useState<Tool>("select");
  const [selected,setSelected]=useState<number|null>(null);
  const [settingsOpen,setSettingsOpen]=useState(()=>typeof window==="undefined"||!window.matchMedia("(max-width:760px)").matches);
  const [notice,setNotice]=useState("");
  const [measurementOpen,setMeasurementOpen]=useState(false);
  const [aim,setAim]=useState<Point|null>(null);
  const [preview,setPreview]=useState<{index:number;point:Point}|null>(null);
  const drag=useRef<{id:number;index:number;start:Point;last:Point}|null>(null);
  const data=useMemo(()=>draft.points.map((point,i)=>preview?.index===i?preview.point:point),[draft.points,preview]);
  const axis=axes(draft.figureId);
  const choices=scienceToolGroupForId("physics-motion")?.templates??[];
  const sx=(x:number)=>PLOT.left+x/draft.xMax*PLOT.width;
  const sy=(y:number)=>PLOT.top+(draft.yMax-y)/(draft.yMax-draft.yMin)*PLOT.height;
  const fromScreen=(event:{clientX:number;clientY:number},svg:SVGSVGElement):Point=>{
    const rect=svg.getBoundingClientRect();
    const scale=Math.min(rect.width/980,rect.height/590)||1;
    const px=(rect.width-980*scale)/2,py=(rect.height-590*scale)/2;
    const x=(event.clientX-rect.left-px)/scale,y=(event.clientY-rect.top-py)/scale;
    const rawX=clamp((x-PLOT.left)/PLOT.width*draft.xMax,0,draft.xMax);
    const rawY=clamp(draft.yMax-(y-PLOT.top)/PLOT.height*(draft.yMax-draft.yMin),draft.yMin,draft.yMax);
    const snap=(value:number)=>draft.snap?Math.round(value*2)/2:+value.toFixed(2);
    return {x:clamp(snap(rawX),0,draft.xMax),y:clamp(snap(rawY),draft.yMin,draft.yMax),label:""};
  };
  const commit=(next:Draft)=>{
    if(next===draft)return;
    setHistory(h=>({past:[...h.past.slice(-60),h.present],present:next,future:[]}));
  };
  const patch=(change:Partial<Draft>)=>commit({...draft,...change});
  const undo=()=>{setHistory(h=>h.past.length?{past:h.past.slice(0,-1),present:h.past[h.past.length-1],future:[h.present,...h.future].slice(0,60)}:h);setSelected(null)};
  const redo=()=>{setHistory(h=>h.future.length?{past:[...h.past.slice(-60),h.present],present:h.future[0],future:h.future.slice(1)}:h);setSelected(null)};
  const patchPoint=(i:number,change:Partial<Point>)=>{
    if(!draft.points[i])return;
    commit({...draft,points:draft.points.map((point,index)=>index===i?{...point,...change}:point)});
  };
  const addPoint=(point?:Point)=>{
    if(draft.points.length>=80){setNotice("Не более 80 точек на одном графике");return}
    const next=point??{x:Math.min(draft.xMax,(draft.points.at(-1)?.x??0)+draft.xMax/8),
      y:clamp(draft.points.at(-1)?.y??0,draft.yMin,draft.yMax),label:""};
    const sorted=[...draft.points,next].sort((a,b)=>a.x-b.x);
    commit({...draft,points:sorted});
    setSelected(sorted.indexOf(next));setNotice("Точка добавлена");
  };
  const removeSelected=()=>{
    if(selected===null)return;
    commit({...draft,points:draft.points.filter((_,i)=>i!==selected)});
    setSelected(null);
  };
  // Changing the measured quantity never overwrites work with a sample curve.
  const setGraphKind=(id:SciencePresetId)=>{
    patch({figureId:id});
    setSelected(null);setNotice("Вид графика изменён. Построенные точки сохранены.");
  };
  const close=()=>onClose?onClose(makeItem(item,draft)):onCancel();
  const startDrag=(event:ReactPointerEvent<SVGCircleElement>,i:number)=>{
    event.preventDefault();event.stopPropagation();
    setSelected(i);
    const start=data[i];
    drag.current={id:event.pointerId,index:i,start,last:start};
    event.currentTarget.ownerSVGElement?.setPointerCapture(event.pointerId);
  };
  const move=(event:ReactPointerEvent<SVGSVGElement>)=>{
    if(drag.current?.id!==event.pointerId)return;
    event.preventDefault();
    const index=drag.current.index;
    const pos=fromScreen(event,event.currentTarget);
    drag.current.last={...drag.current.start,x:pos.x,y:pos.y};
    setPreview({index,point:drag.current.last});
  };
  const finish=(event:ReactPointerEvent<SVGSVGElement>)=>{
    if(drag.current?.id!==event.pointerId)return;
    const dragging=drag.current;drag.current=null;
    if(event.currentTarget.hasPointerCapture(event.pointerId))event.currentTarget.releasePointerCapture(event.pointerId);
    setPreview(null);
    if(dragging.last.x!==dragging.start.x||dragging.last.y!==dragging.start.y)
      patchPoint(dragging.index,{x:dragging.last.x,y:dragging.last.y});
  };
  useEffect(()=>{
    const keyboard=(event:KeyboardEvent)=>{
      if(event.target instanceof HTMLElement&&event.target.closest("input,textarea,select,[contenteditable]"))return;
      if(event.key==="Escape"){
        event.stopPropagation();
        if(tool!=="select"){setTool("select");return}
        close();return;
      }
      const modifier=event.ctrlKey||event.metaKey;
      if(modifier&&event.key.toLowerCase()==="z"){event.preventDefault();event.stopPropagation();if(event.shiftKey)redo();else undo()}
      else if(modifier&&event.key.toLowerCase()==="y"){event.preventDefault();event.stopPropagation();redo()}
      else if(event.key==="Delete"||event.key==="Backspace"){if(selected!==null){event.preventDefault();removeSelected()}}
    };
    window.addEventListener("keydown",keyboard,true);
    return()=>window.removeEventListener("keydown",keyboard,true);
  });
  const ordered=[...data].sort((a,b)=>a.x-b.x);
  const polyline=ordered.map(point=>`${sx(point.x)},${sy(point.y)}`).join(" ");
  const ticks=Array.from({length:7},(_,i)=>i);
  const measurement=useMemo(()=>{
    const ordered=[...data].sort((a,b)=>a.x-b.x);
    if(ordered.length<2)return null;
    const first=ordered[0],last=ordered[ordered.length-1],dt=last.x-first.x;
    const area=ordered.slice(1).reduce((sum,pt,i)=>
      sum+(pt.y+ordered[i].y)/2*(pt.x-ordered[i].x),0);
    return {dt,change:last.y-first.y,slope:dt>0?(last.y-first.y)/dt:0,area};
  },[data]);
  const slopeUnit=axis.variable==="s"?"м/с":axis.variable==="v"?"м/с²":"м/с³";
  const integralLabel=axis.variable==="v"?"Перемещение Δx, м":
    axis.variable==="a"?"Изменение скорости Δv, м/с":"Площадь под s(t)";

  return createPortal(<div className="lektrus-motion-backdrop" onPointerDown={event=>{if(event.currentTarget===event.target)close()}}>
    <section className={"lektrus-motion-editor"+(settingsOpen?"":" is-compact")} role="dialog" aria-modal="true" aria-label="Редактор физических графиков"
      onPointerDown={event=>event.stopPropagation()}>
      <header className="lektrus-motion-header">
        <div className="lektrus-motion-brand"><span aria-hidden="true">ƒ</span><div><small>ФИЗИКА · ГРАФИКИ ДВИЖЕНИЯ</small><strong>График {axis.variable}(t)</strong></div></div>
        <div className="lektrus-motion-actions">
          <button type="button" disabled={!history.past.length} onClick={undo} title="Отменить · Ctrl+Z" aria-label="Отменить">↶</button>
          <button type="button" disabled={!history.future.length} onClick={redo} title="Повторить · Ctrl+Y" aria-label="Повторить">↷</button>
          <button type="button" aria-pressed={settingsOpen} onClick={()=>setSettingsOpen(v=>!v)}>{settingsOpen?"Скрыть настройки":"Настройки"}</button>
          <button type="button" className="lektrus-motion-close" onClick={close} title="Закрыть редактор" aria-label="Закрыть редактор">×</button>
        </div>
      </header>
      <div className="lektrus-motion-layout">
        <aside className="lektrus-motion-settings" aria-label="Параметры физического графика">
          <label>Вид зависимости
            <select value={draft.figureId} onChange={e=>setGraphKind(e.target.value as SciencePresetId)}>
              {choices.map(choice=><option key={choice.id} value={choice.id}>{choice.label}</option>)}
            </select>
          </label>
          <label>Название на доске<input maxLength={100} value={draft.title} onChange={e=>patch({title:e.target.value})}/></label>
          <div className="lektrus-motion-section-title">Оси и шкалы</div>
          <div className="lektrus-motion-fields">
            <label>Время до, с<input type="number" min={1} max={10000} step="1" value={draft.xMax}
              onChange={e=>{const n=Number(e.target.value);if(Number.isFinite(n)&&n>=1)patch({xMax:clamp(n,1,10000)})}}/></label>
            <label>{axis.variable} от, {axis.unit}<input type="number" step=".5" value={draft.yMin}
              onChange={e=>{const n=Number(e.target.value);if(Number.isFinite(n)&&n<draft.yMax)patch({yMin:n})}}/></label>
            <label>{axis.variable} до, {axis.unit}<input type="number" step=".5" value={draft.yMax}
              onChange={e=>{const n=Number(e.target.value);if(Number.isFinite(n)&&n>draft.yMin)patch({yMax:n})}}/></label>
          </div>
          <div className="lektrus-motion-toggles">
            <label><input type="checkbox" checked={draft.grid} onChange={e=>patch({grid:e.target.checked})}/> Сетка</label>
            <label><input type="checkbox" checked={draft.snap} onChange={e=>patch({snap:e.target.checked})}/> Привязка 0,5</label>
            <label><input type="checkbox" checked={draft.connect} onChange={e=>patch({connect:e.target.checked})}/> Соединять точки</label>
            <label><input type="checkbox" checked={draft.showLabels} onChange={e=>patch({showLabels:e.target.checked})}/> Подписи точек</label>
          </div>
          <div className="lektrus-motion-section-title">Точки <span>{draft.points.length}</span></div>
          <div className="lektrus-motion-point-table">
            <div className="lektrus-motion-table-head"><span>№</span><span>t, с</span><span>{axis.variable}, {axis.unit}</span><span/></div>
            {draft.points.map((point,i)=><div className={"lektrus-motion-point-row"+(selected===i?" selected":"")} key={i}>
              <button type="button" className="lektrus-motion-point-select" onClick={()=>setSelected(i)} aria-label={`Выбрать точку ${i+1}`}>{i+1}</button>
              <input aria-label={`Время точки ${i+1}`} type="number" step=".5" min={0} max={draft.xMax} value={point.x}
                onChange={e=>{const n=Number(e.target.value);if(Number.isFinite(n))patchPoint(i,{x:clamp(n,0,draft.xMax)})}}/>
              <input aria-label={`Значение точки ${i+1}`} type="number" step=".5" min={draft.yMin} max={draft.yMax} value={point.y}
                onChange={e=>{const n=Number(e.target.value);if(Number.isFinite(n))patchPoint(i,{y:clamp(n,draft.yMin,draft.yMax)})}}/>
              <button type="button" aria-label={`Удалить точку ${i+1}`} className="lektrus-motion-delete-point"
                onClick={()=>{commit({...draft,points:draft.points.filter((_,j)=>i!==j)});setSelected(null)}}>×</button>
            </div>)}
          </div>
          <button type="button" className="lektrus-motion-add-row" onClick={()=>addPoint()}>+ Добавить точку</button>
          <p>Начните с пустой координатной плоскости. Поставьте точки на листе или введите значения в таблицу.</p>
        </aside>
        <main className="lektrus-motion-stage">
          <div className="lektrus-motion-toolbar">
            <div className="lektrus-motion-tools" role="group" aria-label="Режим работы с графиком">
              <button type="button" className={tool==="select"?"active":""} onClick={()=>setTool("select")}>Выбор</button>
              <button type="button" className={tool==="point"?"active":""} onClick={()=>setTool("point")}>+ Точка</button>
            </div>
            <button type="button" className="lektrus-motion-measure-toggle" aria-pressed={measurementOpen}
              onClick={()=>setMeasurementOpen(v=>!v)}>Измерения</button>
            <div className="lektrus-motion-toolbar-status"><b>{axis.title}</b><span>t, с · {axis.variable}, {axis.unit}</span></div>
          </div>
          {measurementOpen&&<div className="lektrus-motion-measurements" role="status">
            {measurement?<>
              <span>Δt: <b>{format(measurement.dt)} с</b></span>
              <span>Δ{axis.variable}: <b>{format(measurement.change)} {axis.unit}</b></span>
              <span>Δ{axis.variable}/Δt: <b>{format(measurement.slope)} {slopeUnit}</b></span>
              {axis.variable!=="s"&&<span>{integralLabel}: <b>{format(measurement.area)}</b></span>}
            </>:<span>Для измерений необходимо не менее двух точек.</span>}
          </div>}
          <div className="lektrus-motion-sheet">
            <svg viewBox="0 0 980 590" preserveAspectRatio="xMidYMid meet" className={"lektrus-motion-svg mode-"+tool} role="img"
              aria-label={`Интерактивный график ${axis.variable} от времени`}
              onPointerMove={event=>{
                move(event);
                if(event.pointerType!=="touch"&&tool==="point")setAim(fromScreen(event,event.currentTarget));
              }}
              onPointerLeave={()=>setAim(null)}
              onPointerUp={finish} onPointerCancel={finish}
              onClick={event=>{if(tool!=="point"||event.target!==event.currentTarget)return;addPoint(fromScreen(event,event.currentTarget))}}>
              <rect width="980" height="590" fill="#fff" onClick={event=>{
                if(tool==="point"){event.stopPropagation();addPoint(fromScreen(event,event.currentTarget.ownerSVGElement!))}
                else if(tool==="select")setSelected(null);
              }}/>
              <g className="lektrus-motion-grid" pointerEvents="none">
                {draft.grid&&ticks.map(i=><g key={i}>
                  <line x1={PLOT.left+PLOT.width*i/6} y1={PLOT.top} x2={PLOT.left+PLOT.width*i/6} y2={PLOT.top+PLOT.height}/>
                  <line x1={PLOT.left} y1={PLOT.top+PLOT.height*i/6} x2={PLOT.left+PLOT.width} y2={PLOT.top+PLOT.height*i/6}/>
                </g>)}
              </g>
              <g className="lektrus-motion-axis" pointerEvents="none">
                <path d={`M${PLOT.left} ${PLOT.top-6}V${PLOT.top+PLOT.height}H${PLOT.left+PLOT.width+10}`}/>
                {ticks.map(i=><g key={i}>
                  <text x={PLOT.left+PLOT.width*i/6} y={PLOT.top+PLOT.height+27} textAnchor="middle">{format(draft.xMax*i/6)}</text>
                  <text x={PLOT.left-12} y={PLOT.top+PLOT.height*(6-i)/6+4} textAnchor="end">{format(draft.yMin+(draft.yMax-draft.yMin)*i/6)}</text>
                </g>)}
                <text x={PLOT.left+PLOT.width+20} y={PLOT.top+PLOT.height+5} className="axis-title">t, с</text>
                <text x={PLOT.left} y={PLOT.top-19} className="axis-title">{axis.variable}, {axis.unit}</text>
              </g>
              {draft.connect&&ordered.length>1&&<polyline points={polyline} className="lektrus-motion-line" pointerEvents="none"/>}
              {aim&&tool==="point"&&<g transform={`translate(${sx(aim.x)} ${sy(aim.y)})`}
                pointerEvents="none" className="lektrus-editor-cursor">
                <circle r="10" fill="#fff" fillOpacity=".9" stroke="#3266c9" strokeWidth="2"/>
                <circle r="2.5" fill="#3266c9"/>
                <circle r="16" fill="none" stroke="#9ebfe8" strokeDasharray="5 6" strokeWidth="1.3"/>
              </g>}
              {data.map((point,i)=><g key={i}>
                {selected===i&&<circle cx={sx(point.x)} cy={sy(point.y)} r="14" fill="#dce9ff" pointerEvents="none"/>}
                <circle cx={sx(point.x)} cy={sy(point.y)} r={selected===i?6.2:5} fill={selected===i?"#194ba6":"#3878d5"}
                  stroke="#fff" strokeWidth="2" pointerEvents="none"/>
                {draft.showLabels&&<text x={sx(point.x)+10} y={sy(point.y)-11} fontSize="13" fill="#32527b" pointerEvents="none">{point.label||`(${format(point.x)}; ${format(point.y)})`}</text>}
                <circle cx={sx(point.x)} cy={sy(point.y)} r="18" fill="transparent"
                  className="lektrus-motion-point-hit" onPointerDown={event=>startDrag(event,i)}
                  onClick={event=>{event.stopPropagation();setSelected(i)}}/>
              </g>)}
            </svg>
          </div>
          <div className="lektrus-motion-hint" role="status">
            <span>{notice||(tool==="point"?"Нажмите на поле графика, чтобы поставить точку.":"Выберите или перетащите точку, чтобы изменить график.")}</span>
            <span>Точек: {draft.points.length} · Масштаб t: 0–{format(draft.xMax)} с</span>
          </div>
        </main>
      </div>
      <footer className="lektrus-motion-footer">
        <span>Отдельный инструмент физических графиков · без сил и схемных обозначений</span>
        <button type="button" onClick={onCancel}>Отмена</button>
        <button type="button" className="primary" onClick={()=>onSave(makeItem(item,draft))}>Сохранить на доску</button>
      </footer>
    </section>
  </div>,document.body);
}
