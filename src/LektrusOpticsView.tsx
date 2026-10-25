import {useId,useMemo,type PointerEvent as ReactPointerEvent} from "react";
import type {OpticsDocument,OpticalElement} from "./lektrusOpticsModel";
import {OPTICS_WIDTH,OPTICS_HEIGHT,traceOptics} from "./lektrusOpticsModel";
import {svgClientPoint,clampCanvasPoint} from "./lektrusSvgPointer";
export type OpticsSelection={kind:"element"|"ray";id:string}|null;
export type OpticsTool="select"|"source"|"mirror"|"converging-lens"|"diverging-lens"|"interface"|"screen"|"prism";
type Props={doc:OpticsDocument;selection?:OpticsSelection;tool?:OpticsTool;
  onPlace?:(x:number,y:number)=>void;
  onElementDown?:(e:ReactPointerEvent<SVGGElement>,part:OpticalElement)=>void;
  onSelect?:(selected:OpticsSelection)=>void;
  onRaySelect?:(rayId:string)=>void;
  cursor?:{x:number;y:number}|null;
};
export function opticsSvgPoint(clientX:number,clientY:number,svg:SVGSVGElement){
  return clampCanvasPoint(svgClientPoint(svg,clientX,clientY),OPTICS_WIDTH,OPTICS_HEIGHT);
}
const captions:Record<OpticalElement["kind"],string>={
 source:"Источник","mirror":"Зеркало","converging-lens":"Собирающая линза",
 "diverging-lens":"Рассеивающая линза",interface:"Граница сред",screen:"Экран",prism:"Призма"};
export default function LektrusOpticsView({doc,selection=null,tool="select",onPlace,onElementDown,onSelect,onRaySelect,cursor=null}:Props){
 const id=useId().replaceAll(":","");
 const interactive=Boolean(onPlace||onSelect||onElementDown);
 const paths=useMemo(()=>traceOptics(doc),[doc]);
 return <svg className={"lektrus-optics-svg optics-mode-"+tool} viewBox="0 0 960 560"
    preserveAspectRatio="xMidYMid meet" role="img" aria-label="Оптическая схема" style={{touchAction:interactive?"none":undefined}}>
  <defs>
   <pattern id={"optics-dot-"+id} width="20" height="20" patternUnits="userSpaceOnUse"><circle cx="10" cy="10" r=".8" fill="#c9d9eb"/></pattern>
   <marker id={"optics-arrow-"+id} markerWidth="5" markerHeight="5" refX="4" refY="2.5" orient="auto">
    <path d="M0 0L5 2.5L0 5Z" fill="#f19c38"/></marker>
   <linearGradient id={"optics-glass-"+id} x1="0" y1="0" x2="1" y2="0"><stop stopColor="#ebf7ff"/><stop offset=".5" stopColor="#9cd3fa"/><stop offset="1" stopColor="#e6f7ff"/></linearGradient>
  </defs>
  <rect x="0" y="0" width="960" height="560" fill="#fff" onPointerDown={e=>{
    if(!onPlace)return;e.stopPropagation();const p=opticsSvgPoint(e.clientX,e.clientY,e.currentTarget.ownerSVGElement!);
    onPlace(p.x,p.y);
  }}/>
  {doc.grid&&<rect width="960" height="560" fill={"url(#optics-dot-"+id+")"} pointerEvents="none"/>}
  {!!doc.legacy?.length&&<g pointerEvents="none" className="lektrus-optics-legacy">
    {doc.legacy.map(stroke=><g key={stroke.id}>
      <path d={`M${stroke.x1} ${stroke.y1}L${stroke.x2} ${stroke.y2}`}
        fill="none" stroke="#8397ae" strokeWidth="2" strokeLinecap="round"
        strokeDasharray={stroke.label==="Нормаль"?"6 5":undefined}/>
      {stroke.label&&doc.labels&&<text x={(stroke.x1+stroke.x2)/2+6}
        y={(stroke.y1+stroke.y2)/2-10} fontSize="12" fill="#637b98">{stroke.label}</text>}
    </g>)}
  </g>}
  <g pointerEvents="none" className="lektrus-optics-paths">
   {paths.map(path=><g key={path.id}>
     <polyline points={path.points.map(p=>p.x+","+p.y).join(" ")}
       stroke={path.color} strokeWidth="2.5" fill="none" strokeLinejoin="round"
       strokeLinecap="round" opacity=".92"/>
     {path.points.slice(1,-1).map((p,index)=><circle key={"hit-"+index}
       cx={p.x} cy={p.y} r="3.5" fill="#fff" stroke={path.color}
       strokeWidth="2" opacity=".95"/>)}
     {selection?.kind==="ray"&&selection.id===path.id&&path.events?.map((event,index)=><g
       key={"event-"+index} transform={`translate(${event.point.x} ${event.point.y})`}>
       <circle r="10.5" fill="#fff" stroke={event.kind==="tir"?"#e59a34":"#3e79bf"} strokeWidth="1.8"/>
       <text x="0" y="3.7" textAnchor="middle" fontSize="10.5" fontWeight="750"
          fill="#285995">{index+1}</text>
       <title>{event.text}</title>
     </g>)}
     {path.points.slice(0,-1).map((p,i)=>{
       const next=path.points[i+1],mx=(p.x+next.x)/2,my=(p.y+next.y)/2;
       const angle=Math.atan2(next.y-p.y,next.x-p.x)*180/Math.PI;
       return <path key={i} d="M-6 -4 L0 0 L-6 4" transform={`translate(${mx} ${my}) rotate(${angle})`}
         fill="none" stroke={path.color} strokeWidth="2" strokeLinecap="round"/>;
     })}
   </g>)}
  </g>
  {onRaySelect&&tool==="select"&&<g className="lektrus-optics-ray-hits">
    {paths.map(path=><polyline key={path.id} points={path.points.map(p=>p.x+","+p.y).join(" ")}
      fill="none" stroke="transparent" strokeWidth="19" pointerEvents="stroke"
      onPointerDown={e=>{e.stopPropagation();onRaySelect(path.id)}}/>)}
  </g>}
  <g className="lektrus-optics-elements">
   {doc.elements.map(part=>{
     const picked=selection?.kind==="element"&&selection.id===part.id;
     const length=part.length,top=part.y-length/2,bottom=part.y+length/2;
     const label=part.label.trim()||captions[part.kind];
     return <g key={part.id} className={"lektrus-optics-part"+(picked?" selected":"")}
       onPointerDown={onElementDown||onPlace?e=>{
         e.stopPropagation();
         if(tool==="select")onElementDown?.(e,part);
         else if(onPlace){
           e.preventDefault();
           const svg=e.currentTarget.ownerSVGElement!;
           const point=opticsSvgPoint(e.clientX,e.clientY,svg);
           onPlace(point.x,point.y);
         }
       }:undefined}
>
       {picked&&<rect x={part.x-23} y={part.y-Math.min(length/2,110)-15} width="46" height={Math.min(length,220)+30} rx="8"
         fill="#cce0ff" fillOpacity=".35" stroke="#6e9bdf" strokeDasharray="5 5" strokeWidth="1" pointerEvents="none"/>}
       {part.kind==="source"&&<g>
         <circle cx={part.x} cy={part.y} r="13" fill="#fff9df" stroke="#e9a94c" strokeWidth="2"/>
         <circle cx={part.x} cy={part.y} r="4" fill="#efae43"/>
         {Array.from({length:8},(_,i)=><path key={i}
           d="M0 -18V-23" transform={`translate(${part.x} ${part.y}) rotate(${i*45})`}
           stroke="#e9a94c" strokeWidth="2" strokeLinecap="round"/>)}
       </g>}
       {part.kind==="mirror"&&<g>
         <line x1={part.x} y1={top} x2={part.x} y2={bottom} stroke="#315a88" strokeWidth="4"/>
         {Array.from({length:Math.min(18,Math.floor(length/14))},(_,i)=><path key={i}
           d={`M${part.x+3} ${top+i*14+4}l10 8`} stroke="#9fb4ca" strokeWidth="1.5"/>)}
       </g>}
       {(part.kind==="converging-lens"||part.kind==="diverging-lens")&&<g>
         <path d={part.kind==="converging-lens"?
           `M${part.x} ${top} Q${part.x-20} ${part.y} ${part.x} ${bottom} Q${part.x+20} ${part.y} ${part.x} ${top}Z`:
           `M${part.x-16} ${top} Q${part.x+12} ${part.y} ${part.x-16} ${bottom} L${part.x+16} ${bottom} Q${part.x-12} ${part.y} ${part.x+16} ${top}Z`}
           fill={"url(#optics-glass-"+id+")"} fillOpacity=".85" stroke="#3577b8" strokeWidth="2"/>
         {doc.normals&&<g stroke="#9fbbe4" strokeDasharray="5 5" strokeWidth="1.1">
           <path d={`M${part.x-145} ${part.y}h290`}/>
           <circle cx={part.x-part.focalLength} cy={part.y} r="3.2" fill="#497fb7"/>
           <circle cx={part.x+part.focalLength} cy={part.y} r="3.2" fill="#497fb7"/>
         </g>}
       </g>}
       {part.kind==="interface"&&<g>
         <rect x={part.x} y={top} width={Math.max(0,960-part.x)} height={length} fill="#d1eeff" fillOpacity=".32"/>
         <path d={`M${part.x} ${top}V${bottom}`} stroke="#5e96c9" strokeWidth="2.5"/>
         {doc.normals&&<path d={`M${part.x-58} ${part.y}h116`} stroke="#87a9ca" strokeDasharray="5 4"/>}
       </g>}
       {part.kind==="screen"&&<g><rect x={part.x-5} y={top} width="10" height={length} rx="3" fill="#7e99ad" stroke="#4d677b" strokeWidth="1.5"/></g>}
       {part.kind==="prism"&&<g><path d={`M${part.x} ${part.y-85}l-74 150h148Z`} fill="#c0e5ff" fillOpacity=".42" stroke="#3a90c5" strokeWidth="2.4"/></g>}
       {doc.labels&&<text x={part.x} y={part.kind==="source"?part.y+38:Math.min(548,bottom+20)}
          textAnchor="middle" className="lektrus-optics-caption" fontSize="13" fill="#456b91">{label}</text>}
       {interactive&&<rect className="lektrus-optics-hit" x={part.x-(part.kind==="prism"?82:23)}
         y={part.kind==="source"?part.y-25:part.kind==="prism"?part.y-90:top-6}
         width={part.kind==="prism"?164:46} height={part.kind==="source"?50:part.kind==="prism"?170:length+12}
         fill="transparent" pointerEvents="all"/>}
     </g>;
   })}
  </g>
  {cursor&&interactive&&tool!=="select"&&<g transform={`translate(${cursor.x} ${cursor.y})`}
    className="lektrus-editor-cursor" pointerEvents="none">
    <circle r="13" fill="#fff" fillOpacity=".97" stroke="#2676be" strokeWidth="2.5"/>
    <circle r="3" fill="#2676be"/>
    <g transform={cursor.x>770?"translate(-162 -34)":"translate(19 -34)"}>
      <rect x="0" y="0" width="146" height="27" rx="9" fill="#ffffff" stroke="#bad5ed" strokeWidth="1.4"/>
      <text x="9" y="18" fontSize="12" fontWeight="750" fill="#225c9b">{({source:"Источник света",mirror:"Зеркало","converging-lens":"Собирающая линза","diverging-lens":"Рассеивающая линза",interface:"Граница сред",screen:"Экран",prism:"Призма"} as Record<string,string>)[tool]??"Добавить"}</text>
    </g>
  </g>}
 </svg>;
}
