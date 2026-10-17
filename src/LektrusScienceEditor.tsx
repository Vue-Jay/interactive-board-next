import {useEffect,useRef,useState,type PointerEvent} from "react";
import {createPortal} from "react-dom";
import type {Item} from "./boardModel";
import {scienceToolGroupForId} from "./lektrusScienceCatalog";
import {makeSciencePresetItem,type SciencePresetId} from "./lektrusSciencePresets";
import ScienceCircuitGlyph,{circuitSymbols,type CircuitSymbol} from "./ScienceCircuitGlyph";

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
const options=["H","C","O","N","S","Cl"];
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
  const [selected,setSelected]=useState(0);
  const [first,setFirst]=useState(0);
  const [second,setSecond]=useState(1);
  const [order,setOrder]=useState<1|2|3>(1);
  const [arrow,setArrow]=useState(true);
  const [component,setComponent]=useState<CircuitSymbol>("wire");
  const drag=useRef<{pointerId:number;index:number}|null>(null);
  const isPhysics=subject==="physics";
  const group=scienceToolGroupForId(draft.graphFigureId??"");
  const currentVariant=draft.graphFigureId??group?.templates[0]?.id??"";
  const points=draft.graphPoints??[];
  const segments=draft.graphSegments??[];
  const selectedPoint=points[selected];
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
    setSelected(0);setFirst(0);setSecond(1);
  };

  const addPoint=()=>{
    if(points.length>=32)return;
    const parent=selectedPoint??{x:0,y:0,label:""};
    const nextPoint={
      x:clamp(Math.round((parent.x+1.4)*10)/10,xMin,xMax),
      y:clamp(Math.round((parent.y-1.3)*10)/10,yMin,yMax),
      label:atom?"e⁻":circuit?"":isPhysics?"P"+String(points.length+1):"C",
      color:atom?"#5579cc":isPhysics?"#2d5bad":"#40546e"
    };
    setDraft(previous=>({...previous,graphPoints:[...(previous.graphPoints??[]),nextPoint]}));
    setSelected(points.length);setSecond(points.length);
  };
  const removeSelected=()=>{
    if(!points.length)return;
    setDraft(previous=>deletePoint(previous,selected));
    setSelected(Math.max(0,selected-1));setFirst(0);setSecond(1);
  };
  const addLink=()=>{
    if(first===second||!points[first]||!points[second]||segments.length>=64)return;
    const link:Link={a:first,b:second,kind:"segment",label:"",measure:false,
      ...(circuit?{scienceCircuitSymbol:component}:isPhysics?{scienceArrow:arrow}:{bondOrder:order})};
    setDraft(old=>{
      const all=old.graphSegments??[];
      const existing=all.findIndex(s=>(s.a===first&&s.b===second)||(s.a===second&&s.b===first));
      return {...old,graphSegments:existing>=0?all.map((s,i)=>i===existing?link:s):[...all,link]};
    });
  };
  const clear=()=>{
    setDraft(old=>({...old,graphPoints:[],graphSegments:[],graphCircles:[],
      graphPolygons:[],graphAngles:[],graphMidpoints:[],graphConnectPoints:false}));
    setSelected(0);setFirst(0);setSecond(1);
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
    const rect=event.currentTarget.getBoundingClientRect();
    const x=(event.clientX-rect.left)*520/rect.width;
    const y=(event.clientY-rect.top)*370/rect.height;
    patchPoint(moving.index,{
      x:+clamp(motion?(x-56)/440*12:(x-260)/31,xMin,xMax).toFixed(2),
      y:+clamp(motion?(330-y)/290*10:(185-y)/31,yMin,yMax).toFixed(2)
    });
  };

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
        <div className="lektrus-science-symbol" aria-hidden="true">{circuit?"⏚":isPhysics?"F⃗":"⚛"}</div>
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
            <button type="button" onClick={addPoint} disabled={points.length>=32}>+ {isPhysics?"Точка":"Атом"}</button>
            <button type="button" disabled={!points.length} onClick={removeSelected} title="Удалить выбранную точку со всеми связанными линиями">Удалить</button>
          </div>
          {selectedPoint&&<div className="lektrus-science-point-editor">
            <label>{isPhysics?"Подпись":"Элемент или подпись"}
              <input value={selectedPoint.label} maxLength={24}
                onChange={e=>patchPoint(selected,{label:e.target.value,
                  ...(!isPhysics&&atomColors[e.target.value]?{color:atomColors[e.target.value]}:{})})}/>
            </label>
            {!isPhysics&&<div className="lektrus-science-elements">
              {options.map(element=><button type="button" key={element} title={"Атом "+element}
                className={selectedPoint.label===element?"active":""}
                onClick={()=>patchPoint(selected,{label:element,color:atomColors[element]})}>{element}</button>)}
            </div>}
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
            {segments.map((seg,i)=><div key={i}>
              <span>{pointName(seg.a)} <b>{isPhysics?(seg.scienceArrow?"→":"—"):(seg.bondOrder===3?"≡":seg.bondOrder===2?"=":"—")}</b> {pointName(seg.b)}
              {seg.scienceCircuitSymbol&&seg.scienceCircuitSymbol!=="wire"&&<small> · {circuitSymbols.find(symbol=>symbol.id===seg.scienceCircuitSymbol)?.label}</small>}</span>
              <button type="button" aria-label={"Удалить связь "+(i+1)}
                onClick={()=>setDraft(old=>({...old,graphSegments:(old.graphSegments??[]).filter((_,n)=>n!==i)}))}>×</button>
            </div>)}
          </div>}
          <label className="lektrus-science-check"><input type="checkbox" checked={draft.graphGrid===true}
            onChange={e=>setDraft(old=>({...old,graphGrid:e.target.checked}))}/> Сетка на чертеже</label>
          <button className="lektrus-science-clear" type="button" onClick={clear}>Очистить построение</button>
        </aside>
        <div className="lektrus-science-preview">
          <div className="lektrus-science-preview-head"><strong>Чертёж</strong><span>Перемещайте точки мышью</span></div>
          <svg viewBox="0 0 520 370" role="img" aria-label="Редактируемая схема"
            onPointerMove={move} onPointerUp={endDrag} onPointerCancel={endDrag}>
            <defs><marker id="science-arrow-end" viewBox="0 0 10 10" refX="8" refY="5"
              markerWidth="5.5" markerHeight="5.5" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" fill="#275eae"/></marker></defs>
            {draft.graphGrid&&<g className="lektrus-science-grid" pointerEvents="none">
              {Array.from({length:27},(_,i)=><path key={"v"+i} d={"M"+(i*20)+" 0V370"}/>)}
              {Array.from({length:19},(_,i)=><path key={"h"+i} d={"M0 "+(i*20)+"H520"}/>)}
            </g>}
            {motion&&<g className="lektrus-science-axes" pointerEvents="none">
              <path d="M 58 28 V 334 H 500"/><text x="60" y="18">{currentVariant==="physics-speed"?"v":"s"}</text><text x="494" y="326">t</text>
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
              const p=xy(a),q=xy(b),len=Math.hypot(q.x-p.x,q.y-p.y)||1;
              return <g key={i}>
                {Array.from({length:seg.bondOrder??1},(_,index)=>{
                  const off=(index-((seg.bondOrder??1)-1)/2)*5.5;
                  const nx=-(q.y-p.y)/len*off,ny=(q.x-p.x)/len*off;
                  return <line key={index} x1={p.x+nx} y1={p.y+ny}
                    x2={q.x+nx} y2={q.y+ny}
                    className={isPhysics?"lektrus-science-vector":"lektrus-science-bond"}
                    markerEnd={seg.scienceArrow?"url(#science-arrow-end)":undefined}/>;
                })}
                {seg.scienceCircuitSymbol&&seg.scienceCircuitSymbol!=="wire"&&
                  <ScienceCircuitGlyph type={seg.scienceCircuitSymbol}
                    x={(p.x+q.x)/2} y={(p.y+q.y)/2}
                    angle={Math.atan2(q.y-p.y,q.x-p.x)*180/Math.PI}/>}
                {seg.label&&<text className="lektrus-science-link-label"
                  x={(p.x+q.x)/2+8} y={(p.y+q.y)/2-9}>{seg.label}</text>}
              </g>;
            })}
            {points.map((point,i)=>{
              const p=xy(point);
              const pointColor=point.color??(isPhysics?"#3a6bc0":"#587f96");
              return <g key={i} className={"lektrus-science-node"+(selected===i?" selected":"")}>
                <circle cx={p.x} cy={p.y} r={isPhysics?8:13}
                  fill={pointColor} stroke="#fff" strokeWidth={selected===i?4:2.5}
                  onPointerDown={event=>{
                    event.preventDefault();event.stopPropagation();
                    setSelected(i);
                    drag.current={pointerId:event.pointerId,index:i};
                    event.currentTarget.ownerSVGElement?.setPointerCapture(event.pointerId);
                  }}/>
                {point.label&&<text x={p.x} y={p.y-(isPhysics?18:23)}
                  fontSize="13" fontWeight="750" textAnchor="middle" fill="#1b355b"
                  pointerEvents="none">{point.label}</text>}
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
