import {useId,type PointerEvent as ReactPointerEvent} from "react";
import type {CircuitAnchor,CircuitComponent,CircuitDocument,CircuitJunction,CircuitWire} from "./lektrusCircuitModel";
import {circuitPolyline,circuitPolylineString,circuitTerminal} from "./lektrusCircuitModel";
import ScienceCircuitGlyph from "./ScienceCircuitGlyph";

export type CircuitSelection=
  |{kind:"component";id:string}|{kind:"wire";id:string}|{kind:"junction";id:string}|null;
export type CircuitTool="select"|"wire"|"junction"|"place";
type Point={x:number;y:number};
type Props={
  doc:CircuitDocument;
  mode?:CircuitTool;
  selection?:CircuitSelection;
  pending?:CircuitAnchor|null;
  cursor?:Point|null;
  onBlank?:(point:Point)=>void;
  onAnchor?:(anchor:CircuitAnchor)=>void;
  onComponentDown?:(e:ReactPointerEvent<SVGGElement>,component:CircuitComponent)=>void;
  onJunctionDown?:(e:ReactPointerEvent<SVGCircleElement>,junction:CircuitJunction)=>void;
  onSelection?:(next:CircuitSelection)=>void;
  onSvgMove?:(e:ReactPointerEvent<SVGSVGElement>)=>void;
  onSvgUp?:(e:ReactPointerEvent<SVGSVGElement>)=>void;
  onSvgLeave?:()=>void;
  onDrop?:(e:React.DragEvent<SVGSVGElement>)=>void;
};
export function circuitSvgCoords(clientX:number,clientY:number,svg:SVGSVGElement):Point{
  const rect=svg.getBoundingClientRect();
  const scale=Math.min(rect.width/900,rect.height/580)||1;
  const padX=(rect.width-900*scale)/2,padY=(rect.height-580*scale)/2;
  return {x:Math.max(0,Math.min(900,(clientX-rect.left-padX)/scale)),
    y:Math.max(0,Math.min(580,(clientY-rect.top-padY)/scale))};
}
export default function LektrusCircuitView({
  doc,mode="select",selection=null,pending=null,cursor=null,onBlank,
  onAnchor,onComponentDown,onJunctionDown,onSelection,onSvgMove,onSvgUp,
  onSvgLeave,onDrop
}:Props){
  const gridId="circuit-grid-"+useId().replaceAll(":","");
  const activeWire=mode==="wire";
  const resolve=(anchor:CircuitAnchor)=>anchor.kind==="terminal"?
    (()=>{const c=doc.components.find(c=>c.id===anchor.componentId);return c?circuitTerminal(c,anchor.side):null})():
    (()=>{const j=doc.junctions.find(j=>j.id===anchor.junctionId);return j?{x:j.x,y:j.y}:null})();
  const waiting=pending?resolve(pending):null;
  const stop=(e:React.SyntheticEvent)=>e.stopPropagation();
  return <svg className={"lektrus-circuit-svg mode-"+mode} viewBox="0 0 900 580"
    preserveAspectRatio="xMidYMid meet" role="img"
    aria-label="Редактируемая электрическая схема"
    onPointerMove={onSvgMove} onPointerUp={onSvgUp}
    onPointerCancel={onSvgUp} onPointerLeave={onSvgLeave}
    onDragOver={onDrop?e=>{e.preventDefault();e.dataTransfer.dropEffect="copy"}:undefined}
    onDrop={onDrop}>
    <defs>
      <pattern id={gridId} width="20" height="20" patternUnits="userSpaceOnUse">
        <circle cx="10" cy="10" r=".75" fill="#b8c9df"/>
      </pattern>
    </defs>
    <rect x="0" y="0" width="900" height="580" rx="10" fill="#fff"
      className="lektrus-circuit-hitarea"
      onClick={onBlank?e=>{stop(e);onBlank(circuitSvgCoords(e.clientX,e.clientY,e.currentTarget.ownerSVGElement!))}:undefined}/>
    {doc.showGrid&&<rect x="0" y="0" width="900" height="580" rx="10"
      fill={"url(#"+gridId+")"} pointerEvents="none"/>}
    <g className="lektrus-circuit-wires">
      {doc.wires.map((wire:CircuitWire)=>{
        const points=circuitPolyline(doc,wire);
        if(points.length<2)return null;
        const selected=selection?.kind==="wire"&&selection.id===wire.id;
        return <g key={wire.id}>
          {selected&&<polyline points={circuitPolylineString(points)} fill="none"
            stroke="#b6caff" strokeWidth="9" strokeLinecap="round" strokeLinejoin="round"
            pointerEvents="none"/>}
          <polyline points={circuitPolylineString(points)} fill="none"
            stroke="#39516d" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
            pointerEvents="none"/>
          {onSelection&&<polyline points={circuitPolylineString(points)} fill="none"
            stroke="transparent" strokeWidth="14" pointerEvents="stroke"
            className="lektrus-circuit-wire-hit"
            onClick={e=>{stop(e);onSelection({kind:"wire",id:wire.id})}}/>}
        </g>;
      })}
    </g>
    {waiting&&activeWire&&cursor&&<polyline
      points={circuitPolylineString([waiting,{x:cursor.x,y:waiting.y},cursor])}
      fill="none" stroke="#4176d5" strokeDasharray="6 6"
      strokeWidth="1.7" strokeLinecap="round" pointerEvents="none"/>}
    <g className="lektrus-circuit-components">
      {doc.components.map((component:CircuitComponent)=>{
        const selected=selection?.kind==="component"&&selection.id===component.id;
        const a=circuitTerminal(component,"a"),b=circuitTerminal(component,"b");
        return <g key={component.id} className={"lektrus-circuit-part"+(selected?" selected":"")}
          onPointerDown={onComponentDown?e=>{stop(e);onComponentDown(e,component)}:undefined}
          onClick={onSelection?e=>{stop(e);if(mode!=="wire")onSelection({kind:"component",id:component.id})}:undefined}>
          {selected&&<rect x={component.x-43} y={component.y-44} width="86" height="89" rx="10"
            fill="#eaf1ff" fillOpacity=".4" stroke="#7398e1" strokeDasharray="4 4" strokeWidth="1.2" pointerEvents="none"/>}
          <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#39516d"
            strokeWidth="1.8" strokeLinecap="round" pointerEvents="none"/>
          <ScienceCircuitGlyph type={component.type} x={component.x} y={component.y}
            angle={component.rotation} closed={component.closed}/>
          <rect x={component.x-23} y={component.y-24} width="46" height="48"
            fill="transparent" pointerEvents="all"
            className="lektrus-circuit-component-body"/>
          {(component.label||component.value)&&<text x={component.x} y={component.y+51}
            fontSize="11.5" fill="#536784" textAnchor="middle"
            pointerEvents="none">{(component.label+" "+component.value).trim()}</text>}
          {(["a","b"] as const).map(side=>{
            const anchor:CircuitAnchor={kind:"terminal",componentId:component.id,side};
            const p=side==="a"?a:b;
            return <g key={side} className="lektrus-circuit-terminal">
              <circle cx={p.x} cy={p.y} r={activeWire||selected?4.5:2}
                fill="#fff" stroke="#466586" strokeWidth={activeWire||selected?1.75:1}
                pointerEvents="none"/>
              {onAnchor&&<circle cx={p.x} cy={p.y} r="12" fill="transparent" pointerEvents="all"
                className="lektrus-circuit-terminal-hit"
                onPointerDown={stop} onClick={e=>{stop(e);onAnchor(anchor)}}/>}
            </g>;
          })}
        </g>;
      })}
    </g>
    <g className="lektrus-circuit-junctions">
      {doc.junctions.map((junction:CircuitJunction)=>{
        const selected=selection?.kind==="junction"&&selection.id===junction.id;
        return <g key={junction.id}>
          {selected&&<circle cx={junction.x} cy={junction.y} r="11"
            fill="#dbe8ff" pointerEvents="none"/>}
          <circle cx={junction.x} cy={junction.y} r={activeWire||selected?4.5:3.3}
            fill="#39516d" stroke={selected?"#fff":"none"} strokeWidth="2"
            onPointerDown={onJunctionDown?e=>{stop(e);onJunctionDown(e,junction)}:undefined}
            onClick={onAnchor?e=>{stop(e);if(activeWire)onAnchor({kind:"junction",junctionId:junction.id});
              else onSelection?.({kind:"junction",id:junction.id})}:undefined}/>
          {onAnchor&&<circle cx={junction.x} cy={junction.y} r="12"
            fill="transparent" pointerEvents="all"
            onPointerDown={onJunctionDown?e=>{stop(e);onJunctionDown(e,junction)}:undefined}
            onClick={e=>{stop(e);if(activeWire)onAnchor({kind:"junction",junctionId:junction.id});
              else onSelection?.({kind:"junction",id:junction.id})}}/>}
        </g>;
      })}
    </g>
  </svg>;
}
