import {useEffect,useId,useRef,useState,type RefObject,type PointerEvent} from "react";
import "./lektrusMeasurementInstruments.css";
import {createPortal} from "react-dom";
import type {Item} from "./boardModel";

export type InstrumentType="ruler"|"triangle"|"protractor";
type Point={x:number;y:number};
type View={x:number;y:number;zoom:number};
type InstrumentGesture={
 pointer:number;mode:"move"|"rotate";startX:number;startY:number;
 x:number;y:number;angle:number;startAngle:number;
 latest:{x:number;y:number;rotation:number};
};
const labels:Record<InstrumentType,string>={
 ruler:"Линейка",triangle:"Угольник",protractor:"Транспортир"
};
const dimensions:Record<InstrumentType,[number,number]>={
 ruler:[410,88],triangle:[340,260],protractor:[360,205]
};
const clamp=(n:number,min:number,max:number)=>Math.max(min,Math.min(max,n));
const angleTo=(x:number,y:number,point:Point)=>Math.atan2(y-point.y,x-point.x)*180/Math.PI;

function InstrumentGraphic({type}:{type:InstrumentType}){
 // Keep the graduations in SVG: rotation and zoom must not move the ticks
 // independently of the shared instrument object.
 const gradient="lektrus-measure-"+useId().replace(/:/g,"");
 if(type==="ruler")return <svg width="410" height="88" viewBox="0 0 410 88" role="img" aria-label="Прозрачная линейка, 20 сантиметров">
  <defs><linearGradient id={gradient} x1="0" y1="0" x2="0" y2="1">
   <stop offset="0" stopColor="#f9fdff" stopOpacity=".94"/>
   <stop offset=".56" stopColor="#dceefa" stopOpacity=".88"/>
   <stop offset="1" stopColor="#c4def2" stopOpacity=".9"/>
  </linearGradient></defs>
  <rect x="2" y="2" width="406" height="84" rx="11" fill={"url(#"+gradient+")"} stroke="#7398ba" strokeWidth="1.5"/>
  <rect x="6" y="6" width="398" height="76" rx="8" fill="#fff" fillOpacity=".18" stroke="#fff" strokeOpacity=".75"/>
  <path d="M12 10H398" stroke="#fff" strokeWidth="2" strokeLinecap="round" opacity=".82"/>
  <path d="M13 33H395" stroke="#668dac" strokeWidth=".8" opacity=".5"/>
  {Array.from({length:101},(_,i)=>{
   const x=13+i*3.82,major=i%5===0,half=i%5!==0&&i%5===2;
   return <g key={i}>
    <line x1={x} x2={x} y1={major?12:half?20:24} y2="33"
      stroke="#254967" strokeWidth={major?1.4:half?1:.75} strokeOpacity={major?1:.73}/>
    {major&&<text x={x} y="49" textAnchor="middle" fontSize="9.5" fontWeight="600" fill="#294a67">{i/5}</text>}
   </g>;
  })}
  <path d="M13 59H395" stroke="#8bb1ce" strokeOpacity=".55"/>
  <text x="16" y="73" fontFamily="inherit" fontSize="9" fontWeight="700" letterSpacing="1.6" fill="#6083a1">LEKTRUS</text>
  <text x="394" y="73" fontFamily="inherit" fontSize="10" textAnchor="end" fill="#527995">см</text>
 </svg>;
 if(type==="triangle")return <svg width="340" height="260" viewBox="0 0 340 260" role="img" aria-label="Прозрачный угольник с угловой разметкой">
  <defs><linearGradient id={gradient} x1="0" y1="0" x2=".8" y2="1">
   <stop offset="0" stopColor="#f4fcff" stopOpacity=".87"/>
   <stop offset="1" stopColor="#b8ddf3" stopOpacity=".83"/>
  </linearGradient></defs>
  <path d="M12 10V248H330L12 10Z M66 132V208H167L66 132Z" fill={"url(#"+gradient+")"} fillRule="evenodd"/>
  <path d="M12 10V248H330L12 10Z" fill="none" stroke="#5f93ba" strokeWidth="2" strokeLinejoin="round"/>
  <path d="M66 132V208H167L66 132Z" fill="none" stroke="#6799bb" strokeWidth="1.5" strokeLinejoin="round"/>
  <path d="M20 30V242" fill="none" stroke="#fff" strokeWidth="2" strokeOpacity=".8" strokeLinecap="round"/>
  {Array.from({length:17},(_,i)=>{
   const x=55+i*12.5,major=i%4===0;
   return <g key={i}>
    <line x1={x} y1={major?231:236} x2={x} y2="242" stroke="#335f7b" strokeWidth={major?1.6:1} strokeOpacity=".86"/>
    {major&&<text x={x} y="224" fontSize="9.5" fontWeight="650" textAnchor="middle" fill="#355e7c">{i/4}</text>}
   </g>;
  })}
  <path d="M24 210V226H40" fill="none" stroke="#416e8c" strokeWidth="1.5"/>
  <path d="M12 38 A28 28 0 0 0 34.4 26.8" fill="none" stroke="#719fbe" strokeWidth="1.5"/>
  <text x="36" y="123" transform="rotate(-90 36 123)" textAnchor="middle" fontSize="8.5" letterSpacing="1" fontWeight="750" fill="#597b96">LEKTRUS</text>
 </svg>;
 return <svg width="360" height="205" viewBox="0 0 360 205" role="img" aria-label="Прозрачный транспортир, от 0 до 180 градусов">
  <defs><linearGradient id={gradient} x1="0" y1="0" x2="0" y2="1">
   <stop offset="0" stopColor="#f7fcff" stopOpacity=".9"/>
   <stop offset="1" stopColor="#c0e2f6" stopOpacity=".85"/>
  </linearGradient><path id={`${gradient}-brand-arc`} d="M140 93 A106 106 0 0 1 220 93"/></defs>
  <path d="M6 191A174 174 0 0 1 354 191Z M77 191A103 103 0 0 1 283 191Z" fill={"url(#"+gradient+")"} fillRule="evenodd"/>
  <path d="M6 191A174 174 0 0 1 354 191Z" fill="none" stroke="#6295ba" strokeWidth="2"/>
  <path d="M77 191A103 103 0 0 1 283 191" fill="none" stroke="#6e9fbe" strokeWidth="1.5"/>
  <path d="M14 191H346" stroke="#456e8b" strokeWidth="1.1"/>
  {Array.from({length:37},(_,i)=>{
   const a=Math.PI-i*Math.PI/36,major=i%6===0,mid=i%2===0;
   const outer=170,inner=major?142:mid?150:157;
   return <g key={i}>
    <line x1={180+outer*Math.cos(a)} y1={191-outer*Math.sin(a)}
      x2={180+inner*Math.cos(a)} y2={191-inner*Math.sin(a)}
      stroke="#315978" strokeWidth={major?1.65:1} strokeOpacity={major?1:.75}/>
    {major&&<text x={180+134*Math.cos(a)} y={major&&(i===0||i===36)?181:194-134*Math.sin(a)}
      fontSize="9.5" fontWeight="650" textAnchor="middle" fill="#2d5878">{180-i*5}°</text>}
   </g>;
  })}
  <text fontFamily="inherit" fontSize="9" fontWeight="750" letterSpacing="1.35" fill="#597b96" textAnchor="middle" pointerEvents="none"><textPath href={`#${gradient}-brand-arc`} startOffset="50%">LEKTRUS</textPath></text>
  <path d="M180 179v24M168 191h24" stroke="#477898" strokeWidth=".9"/>
  <circle cx="180" cy="191" r="4.1" fill="#f4fcff" stroke="#416d8c" strokeWidth="1.5"/>
 </svg>;
}

function SharedInstrument({item,view,boardRef,editable,selected,onUpdate,onRemove}:{
 item:Item;view:View;boardRef:RefObject<HTMLElement|null>;editable:boolean;selected:boolean;
 onUpdate:(id:string,patch:Partial<Item>)=>void;
 onRemove:(id:string)=>void;
}){
 const type=item.instrumentType??"ruler";
 const [width,height]=dimensions[type];
 const [live,setLive]=useState<{x:number;y:number;rotation:number}|null>(null);
 const gesture=useRef<InstrumentGesture|null>(null);
 const point=live??{x:item.x,y:item.y,rotation:item.rotation??0};
 const rotation=point.rotation;
 const zoom=Math.max(.01,view.zoom);
 const visualScale=zoom*(item.instrumentScale??1);
 const rect=boardRef.current?.getBoundingClientRect();
 const screenPosition={
  x:(rect?.left??0)+view.x+point.x*zoom,
  y:(rect?.top??0)+view.y+point.y*zoom,
 };
 const rad=rotation*Math.PI/180;
 const rotatedHalfHeight=(Math.abs(Math.sin(rad))*width+Math.abs(Math.cos(rad))*height)*visualScale/2;
 const toolbarOffset=-rotatedHalfHeight-57;
 const begin=(event:PointerEvent<HTMLElement>,mode:InstrumentGesture["mode"])=>{
  if(!editable)return;
  event.preventDefault();event.stopPropagation();
  gesture.current={
   pointer:event.pointerId,mode,startX:event.clientX,startY:event.clientY,
   x:item.x,y:item.y,angle:item.rotation??0,
   startAngle:angleTo(event.clientX,event.clientY,screenPosition),
   latest:{x:item.x,y:item.y,rotation:item.rotation??0}
  };
  try{event.currentTarget.setPointerCapture(event.pointerId)}catch{/* old WebView */}
 };
 const moving=(event:PointerEvent<HTMLElement>)=>{
  const g=gesture.current;
  if(!g||event.pointerId!==g.pointer)return;
  event.preventDefault();event.stopPropagation();
  const next=g.mode==="move"?{
   x:g.x+(event.clientX-g.startX)/zoom,
   y:g.y+(event.clientY-g.startY)/zoom,
   rotation:g.angle,
  }:{
   x:g.x,y:g.y,
   rotation:g.angle+angleTo(event.clientX,event.clientY,screenPosition)-g.startAngle
  };
  g.latest=next;setLive(next);
 };
 const finish=(event:PointerEvent<HTMLElement>)=>{
  const g=gesture.current;
  if(!g||event.pointerId!==g.pointer)return;
  gesture.current=null;event.stopPropagation();
  const next=g.latest;setLive(null);
  if(event.type==="pointercancel")return;
  if(next.x!==item.x||next.y!==item.y||next.rotation!==(item.rotation??0))
   onUpdate(item.id,{x:next.x,y:next.y,rotation:next.rotation});
 };
 const updateScale=(delta:number)=>editable&&onUpdate(item.id,{
  instrumentScale:clamp(+((item.instrumentScale??1)+delta).toFixed(2),.25,3)
 });
 return createPortal(
  <div className="geometry-instrument geometry-instrument-centered"
    data-shared-instrument={item.id}
    style={{left:screenPosition.x,top:screenPosition.y}}>
    {editable&&selected&&<div className="geometry-instrument-actions" style={{top:toolbarOffset}}
      onPointerDown={event=>event.stopPropagation()}>
      <span>{labels[type]}</span>
      <span className="geometry-angle-readout" title="Угол поворота">
       {Math.round(((rotation%360)+360)%360)}°
      </span>
      <button type="button" className="geometry-rotation-handle"
        onPointerDown={event=>begin(event,"rotate")} onPointerMove={moving}
        onPointerUp={finish} onPointerCancel={finish}
        title="Повернуть инструмент" aria-label="Повернуть инструмент">⟳</button>
      <button type="button" onClick={()=>onUpdate(item.id,{rotation:0})}
        aria-label="Сбросить угол">0°</button>
      <button type="button" onClick={()=>updateScale(-.1)} aria-label="Уменьшить инструмент">−</button>
      <button type="button" onClick={()=>updateScale(.1)} aria-label="Увеличить инструмент">+</button>
      <button type="button" onClick={()=>onRemove(item.id)}
        title="Убрать инструмент с общей доски" aria-label="Убрать инструмент">×</button>
    </div>}
    <div className="geometry-instrument-body" aria-label={labels[type]}
      style={{
        width,height,
        transform:`translate(-50%,-50%) rotate(${rotation}deg) scale(${visualScale})`,
        transformOrigin:"center center",
        cursor:editable?"grab":"default"
      }}
      onPointerDown={event=>begin(event,"move")}
      onPointerMove={moving} onPointerUp={finish} onPointerCancel={finish}>
      <InstrumentGraphic type={type}/>
    </div>

  </div>,document.body);
}

export default function GeometryInstruments({
 mobile=false,view,boardRef,instruments,onAdd,onUpdate,onRemove,
 editable=true,renderOverlays=true
}:{
 mobile?:boolean;view:View;boardRef:RefObject<HTMLElement|null>;
 instruments:readonly Item[];
 onAdd:(type:InstrumentType,point:Point,scale:number)=>void;
 onUpdate:(id:string,patch:Partial<Item>)=>void;
 onRemove:(id:string)=>void;
 editable?:boolean;renderOverlays?:boolean;
}){
 const [open,setOpen]=useState(false);
 const [selectedInstrumentId,setSelectedInstrumentId]=useState<string|null>(null);
 useEffect(()=>{
  if(!renderOverlays)return;
  const selectFromPointer=(event:globalThis.PointerEvent)=>{
   const target=event.target;
   if(!(target instanceof Element))return;
   const instrument=target.closest<HTMLElement>("[data-shared-instrument]");
   setSelectedInstrumentId(instrument?.dataset.sharedInstrument??null);
  };
  // Capture catches clicks outside even when the canvas stops bubbling.
  document.addEventListener("pointerdown",selectFromPointer,true);
  return()=>document.removeEventListener("pointerdown",selectFromPointer,true);
 },[renderOverlays]);
 useEffect(()=>{
  if(selectedInstrumentId&&!instruments.some(item=>item.id===selectedInstrumentId&&!item.hidden))
   setSelectedInstrumentId(null);
 },[instruments,selectedInstrumentId]);
 const [menuPosition,setMenuPosition]=useState({left:72,top:120});
 const toggleMenu=(button:HTMLButtonElement)=>{
  if(!editable)return;
  const rect=button.getBoundingClientRect(),menuWidth=158;
  const left=mobile?clamp(rect.left-45,8,window.innerWidth-menuWidth-8):
    clamp(rect.right+8,8,window.innerWidth-menuWidth-8);
  const top=mobile?Math.max(8,rect.top-62):clamp(rect.top,8,window.innerHeight-62);
  setMenuPosition({left,top});setOpen(value=>!value);
 };
 const add=(type:InstrumentType)=>{
  const [width,height]=dimensions[type];
  const rect=boardRef.current?.getBoundingClientRect();
  if(!rect||!editable)return;
  const zoom=Math.max(.01,view.zoom);
  const scale=Math.max(.25,Math.min(1,(rect.width-70)/(width*zoom),(rect.height-140)/(height*zoom)));
  const offset=(instruments.length%6)*35;
  onAdd(type,{
    x:(rect.width/2-view.x+offset)/zoom,
    y:(rect.height/2-view.y+offset)/zoom
  },scale);
  setOpen(false);
 };
 return <>
  <div className={`geometry-tools ${mobile?"geometry-tools-mobile":""}`}
    onPointerDown={event=>event.stopPropagation()}>
    <button type="button" className={`geometry-trigger ${open||instruments.length?"active":""}`}
      title="Добавить линейку, угольник или транспортир"
      aria-label="Добавить измерительный инструмент"
      aria-expanded={open} disabled={!editable}
      onClick={event=>toggleMenu(event.currentTarget)}>
      <svg width="21" height="21" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 18 17.5 4.5l3 3L7 21H4z"/>
        <path d="m13 9 2 2M10 12l2 2M7 15l2 2"/>
      </svg>
    </button>
    {open&&createPortal(<div className="geometry-picker geometry-picker-portal"
      style={{left:menuPosition.left,top:menuPosition.top}}
      role="group" aria-label="Добавить измерительный инструмент">
      {(["ruler","triangle","protractor"] as const).map(type=>
        <button type="button" key={type} title={`Добавить: ${labels[type]}`}
          aria-label={`Добавить: ${labels[type]}`} onClick={()=>add(type)}>
          {type==="ruler"?<svg viewBox="0 0 24 24"><rect x="2" y="7" width="20" height="10" rx="1"/>
            <path d="M6 7v5m4-5v3m4-3v5m4-5v3"/></svg>:
           type==="triangle"?<svg viewBox="0 0 24 24"><path d="M3 3v18h18z"/><path d="M8 13v4h4z"/></svg>:
           <svg viewBox="0 0 24 24"><path d="M2 20a10 10 0 0 1 20 0z"/><path d="M12 20V9M6 20l3-8m9 8-3-8"/></svg>}
        </button>)}
    </div>,document.body)}
  </div>
  {renderOverlays&&instruments.filter(i=>!i.hidden).map(item=>
    <SharedInstrument key={item.id} item={item} view={view} boardRef={boardRef}
      editable={editable&&!item.locked} selected={selectedInstrumentId===item.id}
      onUpdate={onUpdate} onRemove={onRemove}/>)}
 </>;
}
