import {useId,type PointerEvent as ReactPointerEvent} from "react";
import {MECH_WIDTH,MECH_HEIGHT,mechanicsForceOrigin,mechanicsForceTip,type MechanicsDocument,type MechanicsSelection,type MechanicsTool} from "./lektrusMechanicsModel";
import {svgClientPoint,clampCanvasPoint} from "./lektrusSvgPointer";
export const mechanicsSvgPoint=(x:number,y:number,svg:SVGSVGElement)=>{
  return clampCanvasPoint(svgClientPoint(svg,x,y),MECH_WIDTH,MECH_HEIGHT);
};
type Props={doc:MechanicsDocument;selection?:MechanicsSelection;tool?:MechanicsTool;
 onPlace?:(x:number,y:number,bodyId?:string)=>void;
 onSelect?:(s:MechanicsSelection)=>void;
 onPartDown?:(e:ReactPointerEvent<SVGGElement>,selected:NonNullable<MechanicsSelection>)=>void;
 cursor?:{x:number;y:number}|null};
export default function LektrusMechanicsView({doc,selection=null,tool="select",onPlace,onSelect,onPartDown,cursor=null}:Props){
 const id=useId().replaceAll(":","");
 const editable=Boolean(onPlace||onSelect||onPartDown);
 const selected=(type:string,objectId:string)=>selection?.type===type&&selection.id===objectId;
 const partPointerDown=(e:ReactPointerEvent<SVGGElement>,target:NonNullable<MechanicsSelection>)=>{
   e.stopPropagation();
   if(tool==="select"||(tool==="force"&&target.type==="body"))onPartDown?.(e,target);
   else if(onPlace){
     e.preventDefault();
     const svg=e.currentTarget.ownerSVGElement!;
     const point=mechanicsSvgPoint(e.clientX,e.clientY,svg);
     onPlace(point.x,point.y);
   }
 };
 return <svg className={"lektrus-mechanics-svg mode-"+tool} viewBox="0 0 960 560"
   preserveAspectRatio="xMidYMid meet" role="img" aria-label="Редактируемая физическая схема"
   style={{touchAction:editable?"none":undefined}}>
  <defs>
   <pattern id={"mechanics-dot-"+id} width="20" height="20" patternUnits="userSpaceOnUse"><circle cx="10" cy="10" r=".85" fill="#cddceb"/></pattern>
   <marker id={"mechanics-arrow-"+id} markerWidth="9" markerHeight="8" refX="8" refY="4" orient="auto"><path d="M0 0L8 4L0 8Z" fill="#2765ca"/></marker>
  </defs>
  <rect width="960" height="560" fill="#fff" onPointerDown={e=>{
   if(!onPlace)return;e.stopPropagation();const p=mechanicsSvgPoint(e.clientX,e.clientY,e.currentTarget.ownerSVGElement!);
   onPlace(p.x,p.y);
  }}/>
  {doc.grid&&<rect width="960" height="560" fill={"url(#mechanics-dot-"+id+")"} pointerEvents="none"/>}
  {doc.supports.map(s=><g key={s.id} className={"lektrus-mechanics-part"+(selected("support",s.id)?" selected":"")}
   onPointerDown={onPartDown||onPlace?e=>partPointerDown(e,{type:"support",id:s.id}):undefined}
   onClick={onSelect?e=>{e.stopPropagation();onSelect({type:"support",id:s.id})}:undefined}>
   <g transform={`translate(${s.x} ${s.y}) rotate(${-s.angle})`}>
    {s.kind==="pivot"?<g><path d="M0 -20L-24 20H24Z" stroke="#657a95" fill="#e9f0f9" strokeWidth="2"/><path d="M-31 23h62" stroke="#72849e" strokeWidth="3"/></g>:<g>
     <path d={`M${-s.width/2} 0h${s.width}`} stroke={selected("support",s.id)?"#245dc1":"#627e9f"} strokeWidth="5" strokeLinecap="round"/>
     {Array.from({length:Math.floor(s.width/24)+1},(_,i)=><path key={i} d={`M${-s.width/2+i*24} 3l-10 12`} stroke="#afbdd0" strokeWidth="1.5"/>)}
    </g>}
   </g>
   {doc.labels&&s.label&&<text x={s.x} y={s.y+37} fill="#567493" fontSize="14" textAnchor="middle">{s.label}</text>}
   {editable&&<rect className="mechanics-hit" x={s.x-s.width/2-12} y={s.y-28} width={s.width+24} height="55" fill="transparent" pointerEvents="all"/>}
  </g>)}
  {doc.bodies.map(b=><g key={b.id} className={"lektrus-mechanics-part"+(selected("body",b.id)?" selected":"")}
   onPointerDown={onPartDown||onPlace?e=>partPointerDown(e,{type:"body",id:b.id}):undefined}
   onClick={onSelect&&tool==="select"?e=>{e.stopPropagation();onSelect({type:"body",id:b.id})}:undefined}>
   {selected("body",b.id)&&<rect x={b.x-b.width/2-7} y={b.y-b.height/2-7} width={b.width+14} height={b.height+14} rx="13"
    fill="#dbe9ff" fillOpacity=".42" stroke="#5690e0" strokeDasharray="6 5" pointerEvents="none"/>}
   {b.kind==="block"?<rect x={b.x-b.width/2} y={b.y-b.height/2} width={b.width} height={b.height} rx="8"
    fill="#e5efff" stroke="#4d7bb8" strokeWidth="2.5"/>:
    <ellipse cx={b.x} cy={b.y} rx={b.width/2} ry={b.height/2} fill="#e5efff" stroke="#4d7bb8" strokeWidth="2.5"/>}
   <circle cx={b.x} cy={b.y} r="3" fill="#3e6fb1"/>
   {doc.labels&&<text x={b.x} y={b.y-b.height/2-16} fontSize="15" fontWeight="750" fill="#315587"
    textAnchor="middle">{b.label||"Тело"}</text>}
   {editable&&<rect className="mechanics-hit" x={b.x-b.width/2-8} y={b.y-b.height/2-8}
     width={b.width+16} height={b.height+16} fill="transparent" pointerEvents="all"/>}
  </g>)}
  {doc.forces.map(f=>{
    const a=mechanicsForceOrigin(f,doc),b=mechanicsForceTip(f,doc),picked=selected("force",f.id);
    const mid={x:(a.x+b.x)/2,y:(a.y+b.y)/2};
    return <g key={f.id} className={"lektrus-mechanics-force"+(picked?" selected":"")}
      onPointerDown={onPartDown||onPlace?e=>partPointerDown(e,{type:"force",id:f.id}):undefined}
      onClick={onSelect?e=>{e.stopPropagation();onSelect({type:"force",id:f.id})}:undefined}>
      {picked&&<line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#a8c9ff" strokeWidth="12" opacity=".7" pointerEvents="none"/>}
      <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#296bd5" strokeWidth="3.5" strokeLinecap="round"
        markerEnd={"url(#mechanics-arrow-"+id+")"} pointerEvents="none"/>
      <circle cx={a.x} cy={a.y} r="4.5" fill="#fff" stroke="#2861b8" strokeWidth="2" pointerEvents="none"/>
      {picked&&<circle cx={b.x} cy={b.y} r="6" fill="#fff" stroke="#2861b8" strokeWidth="2" pointerEvents="none"/>}
      {doc.labels&&<text x={mid.x+8} y={mid.y-12} fontSize="15" fontWeight="770"
        fill="#2256af" stroke="#fff" strokeWidth="4" paintOrder="stroke" pointerEvents="none">
         {f.label||"F"}{f.showValue?` = ${f.magnitude} Н`:""}</text>}
      {editable&&<line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="transparent"
        strokeWidth="23" pointerEvents="stroke" className="mechanics-hit"/>}
    </g>;
  })}
  {cursor&&editable&&tool!=="select"&&<g transform={`translate(${cursor.x} ${cursor.y})`}
    className="lektrus-editor-cursor" pointerEvents="none">
    <circle r="13" fill="#ffffff" fillOpacity=".97" stroke="#2862c8" strokeWidth="2.4"/>
    <circle r="3" fill="#2862c8"/>
    <g transform={cursor.x>780?"translate(-148 -34)":"translate(19 -34)"}>
      <rect x="0" y="0" width="132" height="27" rx="9" fill="#ffffff" stroke="#bad0ee" strokeWidth="1.4"/>
      <text x="9" y="18" fontSize="12" fontWeight="750" fill="#2557a5">{({block:"Брусок",circle:"Шар",floor:"Плоскость",incline:"Наклонная плоскость",pivot:"Опора",force:"Сила"} as Record<string,string>)[tool]??"Добавить"}</text>
    </g>
  </g>}
 </svg>;
}
