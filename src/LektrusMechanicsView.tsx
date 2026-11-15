import {useId,useMemo,type PointerEvent as ReactPointerEvent} from "react";
import {MECH_WIDTH,MECH_HEIGHT,mechanicsForceOrigin,mechanicsForceTip,type MechanicsDocument,type MechanicsSelection,type MechanicsTool} from "./lektrusMechanicsModel";
import {svgClientPoint,clampCanvasPoint} from "./lektrusSvgPointer";
import {mechanicsLabels,mechanicsForceCaption} from "./lektrusMechanicsLabels";
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
 const labels=useMemo(()=>doc.labels?mechanicsLabels(doc):null,[doc]);
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
  {doc.supports.map((s,i)=><g key={s.id} className={"lektrus-mechanics-part"+(selected("support",s.id)?" selected":"")} data-board-interactive={onPartDown?"true":undefined}
   onPointerDown={onPartDown||onPlace?e=>partPointerDown(e,{type:"support",id:s.id}):undefined}
>
   <g transform={`translate(${s.x} ${s.y}) rotate(${-s.angle})`}>
    {editable&&<rect className="mechanics-hit" x={s.kind==="pivot"?-43:-s.width/2-12} y="-28" width={s.kind==="pivot"?86:s.width+24} height="55" fill="transparent" pointerEvents="all"/>}
    {s.kind==="pivot"?<g><path d="M0 -20L-24 20H24Z" stroke="#657a95" fill="#e9f0f9" strokeWidth="2"/><path d="M-31 23h62" stroke="#72849e" strokeWidth="3"/></g>:<g>
     <path d={`M${-s.width/2} 0h${s.width}`} stroke={selected("support",s.id)?"#245dc1":"#627e9f"} strokeWidth="5" strokeLinecap="round"/>
     {Array.from({length:Math.floor(s.width/24)+1},(_,i)=><path key={i} d={`M${-s.width/2+i*24} 3l-10 12`} stroke="#afbdd0" strokeWidth="1.5"/>)}
    </g>}
   </g>
   {labels?.supports[i]?.leader&&<line x1={s.x} y1={s.y} x2={labels.supports[i]!.x} y2={labels.supports[i]!.y} stroke="#7895bb" strokeWidth="1" strokeDasharray="3 3" pointerEvents="none"/>}
   {labels?.supports[i]&&<text x={labels.supports[i]!.x} y={labels.supports[i]!.y} fill="#567493" fontSize="14" textAnchor="middle" dominantBaseline="central" pointerEvents="none">{s.label}</text>}
  </g>)}
  {doc.bodies.map((b,i)=><g key={b.id} className={"lektrus-mechanics-part"+(selected("body",b.id)?" selected":"")} data-board-interactive={onPartDown?"true":undefined}
   onPointerDown={onPartDown||onPlace?e=>partPointerDown(e,{type:"body",id:b.id}):undefined}
>
   {selected("body",b.id)&&<rect x={b.x-b.width/2-7} y={b.y-b.height/2-7} width={b.width+14} height={b.height+14} rx="13"
    fill="#dbe9ff" fillOpacity=".42" stroke="#5690e0" strokeDasharray="6 5" pointerEvents="none"/>}
   {b.kind==="block"?<rect x={b.x-b.width/2} y={b.y-b.height/2} width={b.width} height={b.height} rx="8"
    fill="#e5efff" stroke="#4d7bb8" strokeWidth="2.5"/>:
    <ellipse cx={b.x} cy={b.y} rx={b.width/2} ry={b.height/2} fill="#e5efff" stroke="#4d7bb8" strokeWidth="2.5"/>}
   <circle cx={b.x} cy={b.y} r="3" fill="#3e6fb1"/>
   {labels?.bodies[i]?.leader&&<line x1={b.x} y1={b.y-b.height/2} x2={labels.bodies[i]!.x} y2={labels.bodies[i]!.y} stroke="#7895bb" strokeWidth="1" strokeDasharray="3 3" pointerEvents="none"/>}
   {labels?.bodies[i]&&<text x={labels.bodies[i]!.x} y={labels.bodies[i]!.y} fontSize="15" fontWeight="750" fill="#315587"
    textAnchor="middle" dominantBaseline="central" pointerEvents="none">{b.label||"Тело"}</text>}
   {editable&&<rect className="mechanics-hit" x={b.x-b.width/2-8} y={b.y-b.height/2-8}
     width={b.width+16} height={b.height+16} fill="transparent" pointerEvents="all"/>}
  </g>)}
  {doc.forces.map((f,i)=>{
    const a=mechanicsForceOrigin(f,doc),b=mechanicsForceTip(f,doc),picked=selected("force",f.id);
    const caption=labels?.forces[i];
    return <g key={f.id} className={"lektrus-mechanics-force"+(picked?" selected":"")} data-board-interactive={onPartDown?"true":undefined}
      onPointerDown={onPartDown||onPlace?e=>partPointerDown(e,{type:"force",id:f.id}):undefined}
>
      {picked&&<line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#a8c9ff" strokeWidth="12" opacity=".7" pointerEvents="none"/>}
      <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#296bd5" strokeWidth="3.5" strokeLinecap="round"
        markerEnd={"url(#mechanics-arrow-"+id+")"} pointerEvents="none"/>
      <circle cx={a.x} cy={a.y} r="4.5" fill="#fff" stroke="#2861b8" strokeWidth="2" pointerEvents="none"/>
      {picked&&<circle cx={b.x} cy={b.y} r="6" fill="#fff" stroke="#2861b8" strokeWidth="2" pointerEvents="none"/>}
      {caption?.leader&&<line x1={(a.x+b.x)/2} y1={(a.y+b.y)/2} x2={caption.x} y2={caption.y} stroke="#7895bb" strokeWidth="1" strokeDasharray="3 3" pointerEvents="none"/>}
      {caption&&<text x={caption.x} y={caption.y} fontSize="15" fontWeight="770" textAnchor="middle" dominantBaseline="central"
        fill="#2256af" stroke="#fff" strokeWidth="4" paintOrder="stroke" pointerEvents="none">
         {mechanicsForceCaption(f)}</text>}
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
