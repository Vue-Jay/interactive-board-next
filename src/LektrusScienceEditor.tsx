import {useState,type PointerEvent} from "react";
import {createPortal} from "react-dom";
import type {Item} from "./boardModel";

type Props={item:Item;subject:"physics"|"chem";onSave:(item:Item)=>void;onCancel:()=>void};
const clamp=(v:number,min:number,max:number)=>Math.max(min,Math.min(max,v));
const svgCoord=(point:{x:number;y:number})=>({x:260+point.x*31,y:185-point.y*31});
export default function LektrusScienceEditor({item,subject,onSave,onCancel}:Props){
 const [draft,setDraft]=useState<Item>(()=>({...item,graphPoints:(item.graphPoints??[]).map(p=>({...p})),graphSegments:(item.graphSegments??[]).map(s=>({...s})),graphCircles:(item.graphCircles??[]).map(s=>({...s}))}));
 const [selected,setSelected]=useState(0);
 const isPhysics=subject==="physics";
 const points=draft.graphPoints??[];
 const segments=draft.graphSegments??[];
 const selectedPoint=points[selected];
 const patch=(index:number,change:Partial<{x:number;y:number;label:string}>)=>setDraft(old=>({...old,graphPoints:(old.graphPoints??[]).map((p,i)=>i===index?{...p,...change}:p)}));
 const move=(e:PointerEvent<SVGSVGElement>)=>{
   if(e.buttons!==1||!(e.currentTarget as SVGSVGElement).hasPointerCapture(e.pointerId))return;
   const rect=e.currentTarget.getBoundingClientRect();
   const x=(e.clientX-rect.left)*520/rect.width,y=(e.clientY-rect.top)*370/rect.height;
   patch(selected,{x:+clamp((x-260)/31,-7,7).toFixed(2),y:+clamp((185-y)/31,-5,5).toFixed(2)});
 };
 return createPortal(<div className={"lektrus-science-backdrop "+(isPhysics?"physics":"chemistry")} onPointerDown={e=>{if(e.currentTarget===e.target)onCancel()}}>
  <section className="lektrus-science-editor" role="dialog" aria-modal="true" aria-label={isPhysics?"Редактор физических схем":"Редактор химических структур"} onPointerDown={e=>e.stopPropagation()}>
   <header className="lektrus-science-header">
    <div className="lektrus-science-symbol">{isPhysics?"F":"H₂O"}</div>
    <div><small>{isPhysics?"ФИЗИКА · СХЕМА":"ХИМИЯ · СТРУКТУРА"}</small><h2>{isPhysics?"Редактор физических схем":"Редактор химических структур"}</h2></div>
    <button type="button" className="lektrus-science-close" aria-label="Закрыть без сохранения" onClick={onCancel}>×</button>
   </header>
   <div className="lektrus-science-content">
    <aside className="lektrus-science-settings">
      <label>Название схемы<input maxLength={100} value={draft.text} onChange={e=>setDraft(old=>({...old,text:e.target.value}))}/></label>
      <strong>{isPhysics?"Векторы и опорные точки":"Атомы и связи"}</strong>
      <p>{isPhysics?"Выберите точку, переместите её на чертеже и подпишите физическую величину.":"Выберите атом, измените его обозначение и положение. Связи перестроятся вместе с атомом."}</p>
      <div className="lektrus-science-points">{points.map((p,i)=><button type="button" key={i} className={selected===i?"active":""} onClick={()=>setSelected(i)}>{p.label||"Точка"} <span>{i+1}</span></button>)}</div>
      {selectedPoint&&<div className="lektrus-science-point-editor">
        <label>{isPhysics?"Подпись":"Символ / подпись"}<input maxLength={22} value={selectedPoint.label} onChange={e=>patch(selected,{label:e.target.value})}/></label>
        <div><label>X<input type="number" step=".5" min="-7" max="7" value={selectedPoint.x} onChange={e=>patch(selected,{x:clamp(Number(e.target.value)||0,-7,7)})}/></label><label>Y<input type="number" step=".5" min="-5" max="5" value={selectedPoint.y} onChange={e=>patch(selected,{y:clamp(Number(e.target.value)||0,-5,5)})}/></label></div>
      </div>}
      <label className="lektrus-science-check"><input type="checkbox" checked={draft.graphGrid===true} onChange={e=>setDraft(old=>({...old,graphGrid:e.target.checked}))}/> Показывать сетку</label>
    </aside>
    <div className="lektrus-science-preview"><div className="lektrus-science-preview-head"><strong>Чертёж</strong><span>Перетаскивайте точки мышью</span></div>
     <svg viewBox="0 0 520 370" role="img" aria-label="Редактируемый чертёж" onPointerDown={e=>{if(e.target!==e.currentTarget)return}} onPointerMove={move} onPointerUp={e=>{if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId)}} onPointerCancel={e=>{if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId)}}>
      {draft.graphGrid&&Array.from({length:27},(_,i)=><g key={i} stroke="#e0e8f3" strokeWidth=".7"><path d={`M ${i*20} 0 V 370`}/><path d={`M 0 ${i*20} H 520`}/></g>)}
      {segments.map((line,i)=>{const a=points[line.a],b=points[line.b];if(!a||!b)return null;const p=svgCoord(a),q=svgCoord(b);return <g key={i}><path d={`M${p.x},${p.y} L${q.x},${q.y}`} stroke={isPhysics?"#3270c7":"#548e94"} strokeWidth="3" strokeLinecap="round" fill="none"/>{line.label&&<text x={(p.x+q.x)/2} y={(p.y+q.y)/2-8} fontSize="11" textAnchor="middle" fill="#526785">{line.label}</text>}</g>})}
      {(draft.graphCircles??[]).map((circle,i)=>{const a=points[circle.center],b=points[circle.edge];if(!a||!b)return null;const p=svgCoord(a),q=svgCoord(b);return <circle key={i} cx={p.x} cy={p.y} r={Math.hypot(p.x-q.x,p.y-q.y)} stroke="#b8c9e7" strokeWidth="2" fill="none" strokeDasharray="5 5"/>})}
      {points.map((point,i)=>{const p=svgCoord(point);return <g key={i} onPointerDown={e=>{e.stopPropagation();setSelected(i);e.currentTarget.ownerSVGElement?.setPointerCapture(e.pointerId)}}><circle cx={p.x} cy={p.y} r={isPhysics?9:14} fill={selected===i?"#3461c6":isPhysics?"#9bbcf6":"#b3e5dd"} stroke="#fff" strokeWidth="3"/><text x={p.x} y={p.y-18} textAnchor="middle" fontSize="13" fontWeight="700" fill="#203959">{point.label}</text></g>})}
     </svg>
     <div className="lektrus-science-hint">{isPhysics?"Оформление школьной задачи, без автоматического решения.":"Учебная схема: изменяйте обозначения и расположение атомов."}</div>
    </div>
   </div>
   <footer><button type="button" className="lektrus-science-cancel" onClick={onCancel}>Отмена</button><button type="button" className="lektrus-science-save" onClick={()=>onSave(draft)}>Сохранить на доску</button></footer>
  </section>
 </div>,document.body);
}
