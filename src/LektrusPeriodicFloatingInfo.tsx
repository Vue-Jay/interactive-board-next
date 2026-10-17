import {useEffect,useRef,useState,type PointerEvent,type CSSProperties} from "react";
import {createPortal} from "react-dom";
import {periodicElements} from "./lektrusPeriodicElements";
import {elementFacts} from "./lektrusElementFacts";
import {atomViews,type AtomViewMode} from "./lektrusAtomModel";
import LektrusAtomView from "./LektrusAtomView";

type Props={number:number|null;layout:"school"|"long";anchor:HTMLElement|null;
 selected:boolean;onClose:()=>void;onToggle?:()=>void};
type XY={x:number;y:number};
const clamp=(v:number,min:number,max:number)=>Math.max(min,Math.min(max,v));
export default function LektrusPeriodicFloatingInfo({number,layout,anchor,selected,onClose,onToggle}:Props){
 const [position,setPosition]=useState<XY|null>(null);
 const [atomOpen,setAtomOpen]=useState(false);
 const [mode,setMode]=useState<AtomViewMode>("shell");
 const [atomPosition,setAtomPosition]=useState<XY|null>(null);
 const drag=useRef<{id:number;startX:number;startY:number;origin:XY;kind:"info"|"atom"}|null>(null);
 useEffect(()=>{setPosition(null);setAtomOpen(false);setAtomPosition(null)},[layout,anchor]);
 useEffect(()=>{setAtomOpen(false);setMode("shell")},[number]);
 if(number==null)return null;
 const element=periodicElements[number-1],facts=elementFacts[number-1];
 if(!element||!facts)return null;
 const rect=anchor?.getBoundingClientRect();
 const defaultInfo:XY=layout==="school"
  ?{x:Math.min(window.innerWidth-272,Math.max(12,(rect?.right??window.innerWidth*.75)+10)),y:Math.max(12,(rect?.top??130)+18)}
  :{x:Math.max(12,(rect?.left??70)+Math.min(170,(rect?.width??700)*.17)),y:Math.max(12,(rect?.top??130)+52)};
 const info=position??defaultInfo;
 const atom=atomPosition??{x:clamp(info.x-110,12,window.innerWidth-530),y:clamp(info.y+168,12,window.innerHeight-450)};
 const move=(e:PointerEvent<HTMLDivElement>)=>{
  const d=drag.current;if(!d||d.id!==e.pointerId)return;
  const w=d.kind==="info"?260:510,h=d.kind==="info"?152:425;
  const next={x:clamp(d.origin.x+e.clientX-d.startX,8,Math.max(8,window.innerWidth-w-8)),
   y:clamp(d.origin.y+e.clientY-d.startY,8,Math.max(8,window.innerHeight-h-8))};
  if(d.kind==="info")setPosition(next);else setAtomPosition(next);
 };
 const begin=(e:PointerEvent<HTMLDivElement>,kind:"info"|"atom")=>{
  if((e.target as HTMLElement).closest("button"))return;
  e.stopPropagation();e.preventDefault();
  drag.current={id:e.pointerId,startX:e.clientX,startY:e.clientY,origin:kind==="info"?info:atom,kind};
  e.currentTarget.setPointerCapture(e.pointerId);
 };
 const end=(e:PointerEvent<HTMLDivElement>)=>{
  if(drag.current?.id===e.pointerId)drag.current=null;
  if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);
 };
 const panel:CSSProperties={position:"fixed",zIndex:99999,background:"#fff",border:"1px solid #bed0e9",borderRadius:10,
  boxShadow:"0 8px 25px #12244333",color:"#263956",fontFamily:"Arial,sans-serif",boxSizing:"border-box",pointerEvents:"auto"};
 const btn:React.CSSProperties={border:"1px solid #b9ceee",background:"#f0f6ff",borderRadius:5,padding:"4px 6px",cursor:"pointer",fontSize:11};
 return createPortal(<>
  <div style={{...panel,left:info.x,top:info.y,width:260,minHeight:145,padding:8}} onClick={e=>e.stopPropagation()} onPointerDown={e=>e.stopPropagation()}>
   <div onPointerDown={e=>begin(e,"info")} onPointerMove={move} onPointerUp={end} onPointerCancel={end}
     style={{touchAction:"none",display:"flex",alignItems:"center",gap:5,cursor:"grab",userSelect:"none",paddingBottom:4}}>
    <strong style={{fontSize:19,color:"#2c5c99"}}>{element.symbol}</strong>
    <b style={{fontSize:11,flex:1}}>{element.name}</b>
    <span style={{fontSize:9,color:"#8293a9"}}>⠿</span>
    <button style={btn} onClick={onClose} aria-label="Закрыть сведения">×</button>
   </div>
   <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"2px 8px",fontSize:10}}>
    <span>№ <b>{number}</b></span><span>Ar <b>{facts.atomicMass}</b></span>
    <span>Период <b>{element.period}</b></span><span>Группа <b>{element.group}</b></span>
   </div>
   <div style={{fontSize:10,marginTop:4}}>Конфигурация: {facts.electronConfiguration}</div>
   <div style={{fontSize:10,marginTop:2}}>Степени окисления: {facts.oxidationStates}</div>
   <div style={{display:"flex",gap:5,marginTop:7}}>
    <button style={{...btn,flex:1}} onClick={()=>setAtomOpen(v=>!v)}>Строение атома</button>
    {onToggle&&<button style={{...btn,flex:1}} onClick={onToggle}>{selected?"Снять выделение":"Выделить"}</button>}
   </div>
  </div>
  {atomOpen&&<div style={{...panel,left:atom.x,top:atom.y,width:510,padding:10}}
    onClick={e=>e.stopPropagation()} onPointerDown={e=>e.stopPropagation()}>
   <div onPointerDown={e=>begin(e,"atom")} onPointerMove={move} onPointerUp={end} onPointerCancel={end}
    style={{touchAction:"none",cursor:"grab",userSelect:"none",display:"flex",alignItems:"center",gap:8,marginBottom:7}}>
    <b style={{fontSize:12,flex:1}}>Строение атома {element.name} · {element.symbol}</b>
    <span style={{fontSize:10}}>⠿ Переместить</span>
    <button style={btn} onClick={()=>setAtomOpen(false)}>×</button>
   </div>
   <div style={{display:"flex",flexWrap:"wrap",gap:4,marginBottom:7}}>
    {atomViews.map(v=><button key={v.id} style={{...btn,background:mode===v.id?"#d9e7ff":"#f8fbff"}}
      onClick={()=>setMode(v.id)}>{v.name}</button>)}
   </div>
   <div style={{maxHeight:"min(52vh,390px)",overflowY:"auto"}}>
    <LektrusAtomView model={{atomicNumber:number,mode,labelX:0,labelY:0,showElectronConfiguration:true}}/>
   </div>
  </div>}
 </>,document.body);
}
