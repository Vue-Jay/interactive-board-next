import {useRef,useState,type RefObject,type PointerEvent} from "react";
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
 return <>
      {type==="ruler"&&<svg width="410" height="88" viewBox="0 0 410 88" aria-label="Линейка с делениями"><rect x="3" y="3" width="404" height="82" rx="5" fill="#fce8a5" fillOpacity=".85" stroke="#805e25"/>{Array.from({length:41},(_,i)=><g key={i}><line x1={5+i*10} y1="45" x2={5+i*10} y2={i%10===0?13:i%5===0?23:34} stroke="#624c30" strokeWidth="1"/>{i%10===0&&<text x={5+i*10} y="62" textAnchor="middle" fontSize="12" fill="#543f26">{i/10}</text>}</g>)}</svg>}
      {type==="triangle"&&<svg width="340" height="260" viewBox="0 0 340 260" aria-label="Прямоугольный угольник"><path d="M8 8 L8 250 L330 250 Z" fill="#afe5ee" fillOpacity=".7" stroke="#367b88" strokeWidth="2"/><path d="M55 127 L55 215 L171 215 Z" fill="white" fillOpacity=".8" stroke="#367b88"/>{Array.from({length:17},(_,i)=><line key={i} x1={10+i*20} y1="249" x2={10+i*20} y2={i%5===0?229:238} stroke="#367b88"/>)}</svg>}
      {type==="protractor"&&<svg width="360" height="205" viewBox="0 0 360 205" aria-label="Транспортир с делениями от 0 до 180 градусов"><path d="M10 190 A170 170 0 0 1 350 190 Z" fill="#b8e6f6" fillOpacity=".72" stroke="#277293" strokeWidth="2"/><path d="M65 190 A115 115 0 0 1 295 190" fill="none" stroke="#277293"/>{Array.from({length:37},(_,i)=>{const a=Math.PI-i*Math.PI/36;const x=180+170*Math.cos(a),y=190-170*Math.sin(a);const xx=180+(i%2===0?151:160)*Math.cos(a),yy=190-(i%2===0?151:160)*Math.sin(a);return <g key={i}><line x1={x} y1={y} x2={xx} y2={yy} stroke="#277293"/>{i%6===0&&<text x={180+132*Math.cos(a)} y={190-132*Math.sin(a)} textAnchor="middle" fontSize="11" fill="#16445f">{i*5}°</text>}</g>})}<circle cx="180" cy="190" r="4" fill="#277293"/></svg>}
 </>;
}

function SharedInstrument({item,view,boardRef,editable,onUpdate,onRemove}:{
 item:Item;view:View;boardRef:RefObject<HTMLElement|null>;editable:boolean;
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
    {editable&&<div className="geometry-instrument-actions" style={{top:toolbarOffset}}
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
    <span className="geometry-pivot" aria-hidden="true"/>
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
      editable={editable&&!item.locked} onUpdate={onUpdate} onRemove={onRemove}/>)}
 </>;
}
