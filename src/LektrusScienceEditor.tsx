import {useEffect,useRef,useState,type PointerEvent} from "react";
import {createPortal} from "react-dom";
import type {Item} from "./boardModel";
import {scienceToolGroupForId} from "./lektrusScienceCatalog";
import {makeSciencePresetItem,type SciencePresetId} from "./lektrusSciencePresets";
import ScienceCircuitGlyph,{circuitSymbols,type CircuitSymbol} from "./ScienceCircuitGlyph";
import {periodicElements} from "./lektrusPeriodicElements";
import {layoutScienceLabels} from "./lektrusScienceLabelLayout";

type Props={
  item:Item;
  subject:"physics"|"chem";
  onSave:(item:Item)=>void;
  onCancel:()=>void;
  onClose?:(item:Item)=>void;
};
type Link=NonNullable<Item["graphSegments"]>[number];
const clamp=(v:number,min:number,max:number)=>Math.max(min,Math.min(max,v));
const xy=(p:{x:number;y:number})=>({x:260+p.x*31,y:185-p.y*31});
const atomColors:Record<string,string>={H:"#5676c8",C:"#40546e",O:"#d34d55",N:"#3975be",S:"#df9a2c",Cl:"#30a275","e⁻":"#5579cc"};

const copyItem=(value:Item):Item=>({
  ...value,
  graphPoints:(value.graphPoints??[]).map(p=>({...p})),
  graphSegments:(value.graphSegments??[]).map(s=>({...s})),
  graphPolygons:(value.graphPolygons??[]).map(p=>({...p,points:[...p.points]})),
  graphCircles:(value.graphCircles??[]).map(c=>({...c}))
});
const deletePoint=(item:Item,index:number):Item=>{
  const remap=(i:number)=>i>index?i-1:i;
  return {...item,
    graphPoints:(item.graphPoints??[]).filter((_,i)=>i!==index),
    graphSegments:(item.graphSegments??[]).filter(s=>s.a!==index&&s.b!==index)
      .map(s=>({...s,a:remap(s.a),b:remap(s.b)})),
    graphCircles:(item.graphCircles??[]).filter(c=>c.center!==index&&c.edge!==index)
      .map(c=>({...c,center:remap(c.center),edge:remap(c.edge)})),
    graphPolygons:(item.graphPolygons??[]).filter(poly=>!poly.points.includes(index))
      .map(poly=>({...poly,points:poly.points.map(remap)})),
    graphAngles:(item.graphAngles??[]).filter(a=>a.a!==index&&a.b!==index&&a.vertex!==index)
      .map(a=>({...a,a:remap(a.a),b:remap(a.b),vertex:remap(a.vertex)})),
    graphMidpoints:(item.graphMidpoints??[]).filter(m=>m.a!==index&&m.b!==index)
      .map(m=>({...m,a:remap(m.a),b:remap(m.b)}))
  };
};

export default function LektrusScienceEditor({item,subject,onSave,onCancel,onClose}:Props){
  const [draft,setDraft]=useState<Item>(()=>copyItem(item));
  const [selected,setSelected]=useState(-1);
  const [first,setFirst]=useState(0);
  const [second,setSecond]=useState(1);
  const [order,setOrder]=useState<1|2|3>(1);
  const [arrow,setArrow]=useState(true);
  const [component,setComponent]=useState<CircuitSymbol>("wire");
  const [activeLink,setActiveLink]=useState<number|null>(null);
  const [elementQuery,setElementQuery]=useState("");
  const [placingElement,setPlacingElement]=useState<string|null>(null);
  const [elementNotice,setElementNotice]=useState("");
  const drag=useRef<{pointerId:number;index:number;kind:"point"|"point-label"|"segment-label"}|null>(null);
  const isPhysics=subject==="physics";
  const group=scienceToolGroupForId(draft.graphFigureId??"");
  const currentVariant=draft.graphFigureId??group?.templates[0]?.id??"";
  const points=draft.graphPoints??[];
  const segments=draft.graphSegments??[];
  const selectedPoint=points[selected];
  const filteredElements=periodicElements.filter(e=>
    (e.name+" "+e.symbol+" "+e.number).toLocaleLowerCase("ru-RU")
      .includes(elementQuery.trim().toLocaleLowerCase("ru-RU")));
  const molecule=group?.id==="chem-molecules";
  const motion=group?.id==="physics-graphs";
  const atom=group?.id==="chem-atoms";
  const circuit=group?.id==="physics-circuits";
  const optics=group?.id==="physics-optics";
  // Graphs use positive time/quantity axes; construction sketches use the centered sheet.
  const xMin=motion?0:-7,xMax=motion?12:7;
  const yMin=motion?0:-5,yMax=motion?10:5;
  const canvasPoint=(point:{x:number;y:number})=>motion?
    {x:56+point.x/12*440,y:330-point.y/10*290}:xy(point);


  useEffect(()=>{
    const escape=(event:KeyboardEvent)=>{if(event.key==="Escape"&&event.target instanceof HTMLElement&&!event.target.closest("input,select")){event.stopPropagation();(onClose??onCancel)(draft)}};
    window.addEventListener("keydown",escape,true);
    return()=>window.removeEventListener("keydown",escape,true);
  },[draft,onClose,onCancel]);

  const patchPoint=(index:number,update:Partial<NonNullable<Item["graphPoints"]>[number]>)=>
    setDraft(old=>({...old,graphPoints:(old.graphPoints??[]).map((p,i)=>i===index?{...p,...update}:p)}));

  const selectVariant=(id:SciencePresetId)=>{
    const next=makeSciencePresetItem(id,item.x+item.width/2,item.y+item.height/2,()=>item.id);
    setDraft(previous=>({...copyItem(next),id:item.id,x:item.x,y:item.y,
      width:item.width,height:item.height,color:previous.color,graphGrid:previous.graphGrid}));
    setSelected(-1);setFirst(0);setSecond(1);setActiveLink(null);
  };

  const addPoint=(position?:{x:number;y:number})=>{
    if(points.length>=40)return;
    const parent=selectedPoint??{x:0,y:0,label:""};
    const nextPoint={
      x:clamp(position?.x??Math.round((parent.x+1.4)*10)/10,xMin,xMax),
      y:clamp(position?.y??Math.round((parent.y-1.3)*10)/10,yMin,yMax),
      label:atom?"e⁻":circuit?"":isPhysics?"P"+String(points.length+1):placingElement??"C",
      color:atom?"#5579cc":isPhysics?"#2d5bad":placingElement=== "O"?"#c65b66":placingElement==="N"?"#567dbc":"#40546e"
    };
    setDraft(previous=>({...previous,graphPoints:[...(previous.graphPoints??[]),nextPoint]}));
    setSelected(points.length);setSecond(points.length);
  };
  const removeSelected=()=>{
    if(!points.length)return;
    setDraft(previous=>deletePoint(previous,selected));
    setSelected(Math.max(0,selected-1));setFirst(0);setSecond(1);setActiveLink(null);
  };
  const addLink=()=>{
    if(first===second||!points[first]||!points[second]||segments.length>=64)return;
    const link:Link={a:first,b:second,kind:"segment",label:"",measure:false,
      ...(circuit?{scienceCircuitSymbol:component}:isPhysics?{scienceArrow:arrow,color:arrow?"#2563eb":"#475569"}:{bondOrder:order})};
    setDraft(old=>{
      const all=old.graphSegments??[];
      const existing=all.findIndex(s=>(s.a===first&&s.b===second)||(s.a===second&&s.b===first));
      setActiveLink(existing>=0?existing:all.length);
      return {...old,graphSegments:existing>=0?all.map((s,i)=>i===existing?link:s):[...all,link]};
    });
  };
  const clear=()=>{
    setDraft(old=>({...old,graphPoints:[],graphSegments:[],graphCircles:[],
      graphPolygons:[],graphAngles:[],graphMidpoints:[],graphConnectPoints:false}));
    setSelected(-1);setFirst(0);setSecond(1);
  };
  const canvasToGraph=(clientX:number,clientY:number,element:SVGSVGElement)=>{
    const rect=element.getBoundingClientRect();
    const x=(clientX-rect.left)*520/rect.width;
    const y=(clientY-rect.top)*370/rect.height;
    const rawX=clamp(motion?(x-56)/440*12:(x-260)/31,xMin,xMax);
    const rawY=clamp(motion?(330-y)/290*10:(185-y)/31,yMin,yMax);
    const snap=draft.graphSnap===true&&!motion;
    return {x:+(snap?Math.round(rawX*2)/2:rawX).toFixed(2),
      y:+(snap?Math.round(rawY*2)/2:rawY).toFixed(2)};
  };
  const editLink=(index:number,update:Partial<Link>)=>{
    setDraft(old=>({...old,graphSegments:(old.graphSegments??[]).map((link,i)=>
      i===index?{...link,...update}:link)}));
  };
  const endDrag=(event:PointerEvent<SVGSVGElement>)=>{
    if(drag.current?.pointerId!==event.pointerId)return;
    drag.current=null;
    if(event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
  };
  const move=(event:PointerEvent<SVGSVGElement>)=>{
    const moving=drag.current;if(!moving||moving.pointerId!==event.pointerId)return;
    event.preventDefault();
    const mouse=canvasToGraph(event.clientX,event.clientY,event.currentTarget);
    if(moving.kind==="point"){patchPoint(moving.index,mouse);return}
    if(moving.kind==="point-label"){
      const origin=points[moving.index];if(!origin)return;
      patchPoint(moving.index,{labelDx:clamp(+(mouse.x-origin.x).toFixed(2),-6,6),
        labelDy:clamp(+(mouse.y-origin.y).toFixed(2),-4,4)});
      return;
    }
    const seg=segments[moving.index],a=seg&&points[seg.a],b=seg&&points[seg.b];
    if(!a||!b)return;
    editLink(moving.index,{labelDx:clamp(+(mouse.x-(a.x+b.x)/2).toFixed(2),-6,6),
      labelDy:clamp(+(mouse.y-(a.y+b.y)/2).toFixed(2),-4,4)});
  };

  const scienceLayout=isPhysics?layoutScienceLabels(points,segments,canvasPoint,520,370):null;
  const pointName=(index:number)=>points[index]?.label?.trim()||"Точка "+(index+1);
  const canLink=points.length>=2;
  const drawingHelp=circuit?"Соединяйте узлы проводами; каждый отрезок может содержать элемент цепи.":motion
    ?"Постройте условие задачи точками; вычисления остаются ученику."
    :molecule?"Расставьте атомы, выберите порядок связи и соедините их."
    :atom?"Перемещайте ядро и электроны на схеме оболочки."
    :optics?"Перемещайте источники, лучи и оптические элементы."
    :"Расположите тело, подпишите силы и задайте направления векторов.";

  return createPortal(<div className={"lektrus-science-backdrop "+(isPhysics?"physics":"chemistry")}
     onPointerDown={e=>{if(e.currentTarget===e.target)(onClose??onCancel)(draft)}}>
    <section className="lektrus-science-editor" role="dialog" aria-modal="true"
      aria-label={isPhysics?"Редактор физики":"Редактор химии"}
      onPointerDown={e=>e.stopPropagation()}>
      <header className="lektrus-science-header">
        <div className="lektrus-science-symbol" aria-hidden="true">
          <svg width="31" height="31" viewBox="0 0 40 40" fill="none">
           {molecule?<><circle cx="11" cy="29" r="4.8" stroke="currentColor" strokeWidth="1.8"/>
             <circle cx="29" cy="29" r="4.8" stroke="currentColor" strokeWidth="1.8"/>
             <circle cx="20" cy="10" r="5.8" stroke="currentColor" strokeWidth="1.8"/>
             <path d="M13 25L18 15M27 25L22 15" stroke="currentColor" strokeWidth="1.6"/></>:
             optics?<><path d="M4 31h32M20 5v26" stroke="currentColor" strokeDasharray="3 3" strokeWidth="1.4"/>
              <path d="M7 8l13 23L33 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              <path d="M29 12l4-4-5 1" stroke="currentColor" strokeWidth="1.6"/></>:
             <><circle cx="20" cy="20" r="3.4" fill="currentColor"/>
              <path d="M20 20V4m0 16l13 11M20 20L7 31M20 20H36" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
              <path d="M16 8l4-5 4 5M31 16l5 4-5 4" stroke="currentColor" strokeWidth="1.7"/></>}
          </svg>
        </div>
        <div><small>{isPhysics?"ФИЗИКА · КОНСТРУКТОР":"ХИМИЯ · КОНСТРУКТОР"}</small>
          <h2>{group?.label??(isPhysics?"Физическая схема":"Химическая структура")}</h2></div>
        <button type="button" className="lektrus-science-close"
          title="Закрыть редактор" aria-label="Закрыть редактор"
          onClick={()=>(onClose??onCancel)(draft)}>×</button>
      </header>
      <div className="lektrus-science-content">
        <aside className="lektrus-science-settings">
          <div className="lektrus-science-subhead"><strong>Построение</strong><span>01</span></div>
          {group&&<label>Вариант внутри инструмента
            <select className="lektrus-science-template" value={currentVariant}
              onChange={e=>selectVariant(e.target.value as SciencePresetId)}>
              {group.templates.map(t=><option value={t.id} key={t.id}>{t.label}</option>)}
            </select>
            <small>Смена варианта заменит текущие точки шаблоном.</small>
          </label>}
          <label>Название на доске
            <input maxLength={100} value={draft.text}
              onChange={e=>setDraft(old=>({...old,text:e.target.value}))}/>
          </label>
          {molecule&&<section className="lektrus-molecule-picker">
            <strong>Добавить химический элемент</strong>
            <input value={elementQuery} onChange={e=>setElementQuery(e.target.value)}
              placeholder="Поиск: название, символ или номер" aria-label="Поиск элемента"/>
            <div className="lektrus-molecule-elements" role="listbox" aria-label="118 химических элементов">
             {filteredElements.map(el=><button type="button" key={el.number}
              draggable onDragStart={e=>{e.dataTransfer.setData("application/x-lektrus-element",el.symbol);e.dataTransfer.effectAllowed="copy";}}
              className={placingElement===el.symbol?"active":""}
              onClick={()=>{setPlacingElement(el.symbol);setElementNotice("Нажмите на поле чертежа или перетащите элемент на него.")}}>
              <b>{el.symbol}</b><span>{el.name}</span><small>{el.number}</small></button>)}
            </div>
            <small>{elementNotice||"Выберите элемент в списке и укажите его место на чертеже."}</small>
          </section>}
          <div className="lektrus-science-subhead"><strong>{isPhysics?"Опорные точки":"Атомы и точки"}</strong><span>{points.length}</span></div>
          <p className="lektrus-science-description">{drawingHelp}</p>
          <div className="lektrus-science-points">
            {points.map((point,i)=><button type="button" key={i}
              className={selected===i?"active":""} onClick={()=>setSelected(i)}>
              <span>{point.label||"Точка "+(i+1)}</span><em>{i+1}</em>
            </button>)}
            {!points.length&&<span className="lektrus-science-empty">Добавьте первую точку</span>}
          </div>
          <div className="lektrus-science-point-actions">
            <button type="button" onClick={()=>addPoint()} disabled={points.length>=40}>+ {isPhysics?"Точка":"Атом"}</button>
            <button type="button" disabled={!selectedPoint} onClick={removeSelected} title="Удалить выбранную точку со всеми связанными линиями">Удалить</button>
          </div>
          {selectedPoint&&<div className="lektrus-science-point-editor">
            <label>{isPhysics?"Подпись":"Элемент или подпись"}
              <input value={selectedPoint.label} maxLength={24}
                onChange={e=>patchPoint(selected,{label:e.target.value,
                  ...(!isPhysics&&atomColors[e.target.value]?{color:atomColors[e.target.value]}:{})})}/>
            </label>

            <div className="lektrus-science-xy">
              <label>X<input type="number" step=".5" min={xMin} max={xMax}
                value={selectedPoint.x} onChange={e=>patchPoint(selected,{x:clamp(Number(e.target.value)||0,xMin,xMax)})}/></label>
              <label>Y<input type="number" step=".5" min={yMin} max={yMax}
                value={selectedPoint.y} onChange={e=>patchPoint(selected,{y:clamp(Number(e.target.value)||0,yMin,yMax)})}/></label>
            </div>
          </div>}
          <div className="lektrus-science-subhead"><strong>{isPhysics?"Векторы и линии":"Химические связи"}</strong><span>{segments.length}</span></div>
          <div className="lektrus-science-link-form">
            <div className="lektrus-science-xy">
              <label>От точки
                <select value={Math.min(first,Math.max(points.length-1,0))}
                  disabled={!canLink} onChange={e=>setFirst(Number(e.target.value))}>
                  {points.map((_,i)=><option key={i} value={i}>{pointName(i)}</option>)}
                </select>
              </label>
              <label>До точки
                <select value={Math.min(second,Math.max(points.length-1,0))}
                  disabled={!canLink} onChange={e=>setSecond(Number(e.target.value))}>
                  {points.map((_,i)=><option key={i} value={i}>{pointName(i)}</option>)}
                </select>
              </label>
            </div>
            {circuit?
              <label>Элемент на линии
                <select value={component} onChange={e=>setComponent(e.target.value as CircuitSymbol)}>
                  {circuitSymbols.map(option=><option key={option.id} value={option.id}>{option.label}</option>)}
                </select>
              </label>:isPhysics?
              <label className="lektrus-science-check"><input type="checkbox"
                checked={arrow} onChange={e=>setArrow(e.target.checked)}/> Стрелка на конце линии</label>:
              <label>Порядок связи
                <select value={order} onChange={e=>setOrder(Number(e.target.value) as 1|2|3)}>
                  <option value={1}>Одинарная</option><option value={2}>Двойная</option>
                  <option value={3}>Тройная</option>
                </select></label>}
            <button type="button" onClick={addLink} disabled={!canLink||first===second||segments.length>=64}
              className="lektrus-science-add-link">+ {isPhysics?"Добавить линию":"Добавить связь"}</button>
          </div>
          {segments.length>0&&<div className="lektrus-science-links">
            {segments.map((seg,i)=><div key={i} className={activeLink===i?"active":""}>
              <span onClick={()=>setActiveLink(i)} title="Изменить линию" role="button" tabIndex={0} onKeyDown={e=>{if(e.key==="Enter")setActiveLink(i)}}>{pointName(seg.a)} <b>{isPhysics?(seg.scienceArrow?"→":"—"):(seg.bondOrder===3?"≡":seg.bondOrder===2?"=":"—")}</b> {pointName(seg.b)}
              {seg.scienceCircuitSymbol&&seg.scienceCircuitSymbol!=="wire"&&<small> · {circuitSymbols.find(symbol=>symbol.id===seg.scienceCircuitSymbol)?.label}</small>}</span>
              <button type="button" aria-label={"Удалить связь "+(i+1)}
                onClick={()=>{setDraft(old=>({...old,graphSegments:(old.graphSegments??[]).filter((_,n)=>n!==i)}));setActiveLink(null)}}>×</button>
            </div>)}
          </div>}
          {activeLink!==null&&segments[activeLink]&&<section className="lektrus-science-selected-link">
            <strong>Редактирование линии {activeLink+1}</strong>
            {circuit?<label>Компонент
              <select value={segments[activeLink].scienceCircuitSymbol??"wire"}
                onChange={e=>editLink(activeLink,{scienceCircuitSymbol:e.target.value as CircuitSymbol})}>
                {circuitSymbols.map(option=><option key={option.id} value={option.id}>{option.label}</option>)}
              </select>
            </label>:molecule?<label>Порядок связи
              <select value={segments[activeLink].bondOrder??1}
                onChange={e=>editLink(activeLink,{bondOrder:Number(e.target.value) as 1|2|3})}>
                <option value={1}>Одинарная</option><option value={2}>Двойная</option><option value={3}>Тройная</option>
              </select>
            </label>:<label className="lektrus-science-check"><input type="checkbox"
              checked={segments[activeLink].scienceArrow===true}
              onChange={e=>editLink(activeLink,{scienceArrow:e.target.checked})}/> Стрелка направления</label>}
            {isPhysics&&!circuit&&<label>Подпись линии
              <input maxLength={40} value={segments[activeLink].label}
                onChange={e=>editLink(activeLink,{label:e.target.value})}/></label>}
          </section>}
          <label className="lektrus-science-check"><input type="checkbox" checked={draft.graphGrid===true}
            onChange={e=>setDraft(old=>({...old,graphGrid:e.target.checked}))}/> Сетка на чертеже</label>
          <button className="lektrus-science-clear" type="button" onClick={clear}>Очистить построение</button>
        </aside>
        <div className="lektrus-science-preview">
          <div className="lektrus-science-preview-head"><strong>Чертёж</strong><span>Перетаскивайте точки · двойной щелчок добавляет</span></div>
          <svg viewBox="0 0 520 370" role="img" aria-label="Редактируемая схема"
            onClick={event=>{if(molecule&&placingElement&&event.target===event.currentTarget){
              addPoint(canvasToGraph(event.clientX,event.clientY,event.currentTarget));
            }}}
            onDragOver={molecule?event=>{event.preventDefault();event.dataTransfer.dropEffect="copy"}:undefined}
            onDrop={molecule?event=>{event.preventDefault();
              const label=event.dataTransfer.getData("application/x-lektrus-element");
              if(!periodicElements.some(el=>el.symbol===label)||points.length>=40)return;
              const pos=canvasToGraph(event.clientX,event.clientY,event.currentTarget);
              setDraft(old=>({...old,graphPoints:[...(old.graphPoints??[]),{...pos,label,color:"#45687e"}]}));
              setSelected(points.length);
            }:undefined}
            onDoubleClick={event=>{
              // Only blank canvas, not a node, symbol or existing line.
              if(event.target!==event.currentTarget||points.length>=40||Boolean(placingElement))return;
              event.preventDefault();
              addPoint(canvasToGraph(event.clientX,event.clientY,event.currentTarget));
            }}
            onPointerMove={move} onPointerUp={endDrag} onPointerCancel={endDrag}>
            <defs><marker id="science-arrow-end" viewBox="0 0 10 10" refX="8" refY="5"
              markerWidth="4.2" markerHeight="4.2" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" fill="#5879ac"/></marker></defs>
            {draft.graphGrid&&<g className="lektrus-science-grid" pointerEvents="none">
              {Array.from({length:27},(_,i)=><path key={"v"+i} d={"M"+(i*20)+" 0V370"}/>)}
              {Array.from({length:19},(_,i)=><path key={"h"+i} d={"M0 "+(i*20)+"H520"}/>)}
            </g>}
            {motion&&<g className="lektrus-science-axes" pointerEvents="none">
              <path d="M 58 28 V 334 H 500"/><text x="60" y="18">{currentVariant==="physics-acceleration"?"a":currentVariant==="physics-speed"||currentVariant==="physics-accelerated-speed"||currentVariant==="physics-braking"?"v":"s"}</text><text x="494" y="326">t</text>
            </g>}
            {(draft.graphPolygons??[]).map((polygon,i)=>{
              const vertices=polygon.points.map(index=>points[index]).filter(Boolean);
              if(vertices.length<3)return null;
              return <polygon key={i} points={vertices.map(p=>{const q=canvasPoint(p);return q.x+","+q.y}).join(" ")}
                fill={isPhysics?"#dbe8fc":"#cce9e2"} fillOpacity=".48" stroke="#aac3e9" strokeWidth="1.5"/>;
            })}
            {(draft.graphCircles??[]).map((circle,i)=>{
              const a=points[circle.center],b=points[circle.edge];if(!a||!b)return null;
              const p=canvasPoint(a),q=canvasPoint(b);
              return <circle key={i} cx={p.x} cy={p.y}
                r={Math.hypot(p.x-q.x,p.y-q.y)} stroke="#9eb8dd" strokeWidth="2"
                fill="none" strokeDasharray="6 5"/>;
            })}
            {motion&&draft.graphConnectPoints&&points.length>1&&
              <polyline points={points.map(point=>{const p=canvasPoint(point);return p.x+","+p.y}).join(" ")}
                fill="none" stroke="#356bd5" strokeWidth="3.5" strokeLinejoin="round" strokeLinecap="round"/>}
            {segments.map((seg,i)=>{
              const a=points[seg.a],b=points[seg.b];if(!a||!b)return null;
              const p=canvasPoint(a),q=canvasPoint(b),len=Math.hypot(q.x-p.x,q.y-p.y)||1;
              return <g key={i}>
                {activeLink===i&&<line x1={p.x} y1={p.y} x2={q.x} y2={q.y}
                  stroke="#abc3ec" strokeWidth="6" strokeOpacity=".48"
                  pointerEvents="none"/>}
                {Array.from({length:seg.bondOrder??1},(_,index)=>{
                  const off=(index-((seg.bondOrder??1)-1)/2)*5.5;
                  const nx=-(q.y-p.y)/len*off,ny=(q.x-p.x)/len*off;
                  return <line key={index} x1={p.x+nx} y1={p.y+ny}
                    x2={q.x+nx} y2={q.y+ny}
                    className={!isPhysics?"lektrus-science-bond":
                      seg.label==="Зеркало"?"lektrus-science-mirror":
                      seg.label==="Нормаль"?"lektrus-science-normal":
                      seg.label==="Граница сред"?"lektrus-science-boundary":
                      seg.label==="Главная оптическая ось"?"lektrus-science-optical-axis":
                      "lektrus-science-vector"}
                    markerEnd={seg.scienceArrow?"url(#science-arrow-end)":undefined}/>;
                })}
                {seg.scienceCircuitSymbol&&seg.scienceCircuitSymbol!=="wire"&&
                  <ScienceCircuitGlyph type={seg.scienceCircuitSymbol}
                    x={(p.x+q.x)/2} y={(p.y+q.y)/2}
                    angle={Math.atan2(q.y-p.y,q.x-p.x)*180/Math.PI}/>}
                {seg.label&&(()=>{
                  const anchor={x:(p.x+q.x)/2,y:(p.y+q.y)/2};
                  const defaultX=p.x+(q.x-p.x)*(seg.label==="Зеркало"?.78:seg.scienceArrow?.36:.58);
                  const defaultY=p.y+(q.y-p.y)*(seg.label==="Зеркало"?.78:seg.scienceArrow?.36:.58)-13;
                  const lx=scienceLayout?.lines[i]?.x??(seg.labelDx!=null?anchor.x+seg.labelDx*31:defaultX);
                  const ly=scienceLayout?.lines[i]?.y??(seg.labelDy!=null?anchor.y-seg.labelDy*31:defaultY);
                  return <g className="lektrus-science-label-handle" onPointerDown={e=>{
                    e.stopPropagation();e.preventDefault();setActiveLink(i);
                    drag.current={pointerId:e.pointerId,index:i,kind:"segment-label"};
                    e.currentTarget.ownerSVGElement?.setPointerCapture(e.pointerId);
                  }}>
                   {activeLink===i&&<path d={"M"+anchor.x+" "+anchor.y+"L"+lx+" "+(ly+3)}
                    stroke="#89a7cf" strokeDasharray="3 3" strokeWidth=".9" pointerEvents="none"/>}
                   <rect x={lx-Math.max(21,seg.label.length*3.5)} y={ly-11}
                     width={Math.max(42,seg.label.length*7)} height="19" fill="transparent"/>
                   <text className="lektrus-science-link-label"
                    x={lx} y={ly} textAnchor="middle">{seg.label}</text>
                  </g>;
                })()}
                <line x1={p.x} y1={p.y} x2={q.x} y2={q.y}
                  stroke="transparent" strokeWidth="17" style={{cursor:"pointer"}}
                  pointerEvents="stroke" onClick={()=>setActiveLink(i)}
                  aria-label={"Изменить линию "+(i+1)}/>
              </g>;
            })}
            {points.map((point,i)=>{
              const p=canvasPoint(point);
              const isOrigin=isPhysics&&Math.abs(point.x)<.12&&Math.abs(point.y)<.12;
              const tip=isPhysics&&segments.some(seg=>seg.scienceArrow===true&&seg.b===i);
              const pxPer=motion?32:31;
              const defaultDx=(point.label==="O"&&isPhysics)?0.55:0;
              const defaultDy=(point.label==="O"&&isPhysics)?0.62:(isPhysics?0.45:0.62);
              const lx=scienceLayout?.points[i]?.x??(p.x+(point.labelDx??defaultDx)*pxPer);
              const ly=scienceLayout?.points[i]?.y??(p.y-(point.labelDy??defaultDy)*pxPer);
              return <g key={i} className={"lektrus-science-node"+(selected===i?" selected":"")}>
                {(selected===i||isOrigin||(!isPhysics&&!tip))&&<circle cx={p.x} cy={p.y}
                  r={selected===i?4.5:isOrigin?2.7:atom?4.8:4}
                  fill={selected===i?"#f2f6fc":isOrigin?"#4b6ea3":point.color??"#53768a"}
                  stroke={selected===i?"#557dbc":"#fff"} strokeWidth={selected===i?1.8:1}/>}
                <circle cx={p.x} cy={p.y} r="13.5" fill="transparent"
                  className="lektrus-science-point-hit" onPointerDown={event=>{
                    event.preventDefault();event.stopPropagation();
                    setSelected(i);
                    drag.current={pointerId:event.pointerId,index:i,kind:"point"};
                    event.currentTarget.ownerSVGElement?.setPointerCapture(event.pointerId);
                  }}/>
                {point.label&&<g className="lektrus-science-label-handle" onPointerDown={event=>{
                  event.preventDefault();event.stopPropagation();setSelected(i);
                  drag.current={pointerId:event.pointerId,index:i,kind:"point-label"};
                  event.currentTarget.ownerSVGElement?.setPointerCapture(event.pointerId);
                }}>
                  {selected===i&&<line x1={p.x} y1={p.y} x2={lx} y2={ly+3}
                    stroke="#8daacf" strokeWidth=".9" strokeDasharray="3 3" pointerEvents="none"/>}
                  <rect x={lx-Math.max(15,point.label.length*3.6)} y={ly-12}
                    width={Math.max(30,point.label.length*7.2)} height="19" fill="transparent"/>
                  <text x={lx} y={ly} fontSize={isPhysics?11.5:12}
                    fontWeight="560" textAnchor="middle" fill="#506e8c"
                    pointerEvents="none">{point.label}</text>
                </g>}
              </g>;
            })}
          </svg>
          <div className="lektrus-science-hint">{drawingHelp}</div>
        </div>
      </div>
      <footer>
        <span>Без автоматического решения задач</span>
        <button type="button" className="lektrus-science-cancel" onClick={onCancel}>Отмена</button>
        <button type="button" className="lektrus-science-save" onClick={()=>onSave(draft)}>Сохранить на доску</button>
      </footer>
    </section>
  </div>,document.body);
}
