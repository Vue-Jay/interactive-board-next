import {useRef,useState,type PointerEvent as PE} from "react";
import type {Item} from "./boardModel";
import LektrusMechanicsView,{mechanicsSvgPoint} from "./LektrusMechanicsView";
import LektrusOpticsView,{opticsSvgPoint} from "./LektrusOpticsView";
import LektrusCircuitView,{circuitSvgCoords} from "./LektrusCircuitView";
import {movePhysicalPart,physicalPartPivot,type PhysicalTarget} from "./lektrusPhysicalBoardMove";

type Point={x:number;y:number};
type Props={item:Item;editable:boolean;
  onMoveEnd?:(target:PhysicalTarget,position:Point)=>void;
  onMovePreview?:(target:PhysicalTarget,position:Point)=>void};
type Gesture={id:number;target:PhysicalTarget;from:Point;origin:Point;last:Point;lastPublish:number};
const isTarget=(v:PhysicalTarget|null):v is PhysicalTarget=>v!==null;
/** The same school-object SVG is used in the fullscreen editor and on the
 * board. Existing diagrams stay viewable, even without editing permissions. */
export default function LektrusPhysicalBoardView({item,editable,onMoveEnd,onMovePreview}:Props){
  const [selection,setSelection]=useState<PhysicalTarget|null>(null);
  const [preview,setPreview]=useState<Item|null>(null);
  const drag=useRef<Gesture|null>(null);
  const previewRef=useRef<Item|null>(null);
  const readPosition=(svg:SVGSVGElement,x:number,y:number):Point=>
    item.scienceMechanics?mechanicsSvgPoint(x,y,svg):
    item.scienceOptics?opticsSvgPoint(x,y,svg):
    circuitSvgCoords(x,y,svg);
  const begin=(event:PE<SVGElement>,target:PhysicalTarget)=>{
    if(!editable||!event.isPrimary||event.button!==0)return;
    const svg=event.currentTarget.ownerSVGElement;
    if(!svg)return;
    const origin=physicalPartPivot(item,target);if(!origin)return;
    event.preventDefault();event.stopPropagation();
    const from=readPosition(svg,event.clientX,event.clientY);
    setSelection(target);
    drag.current={id:event.pointerId,target,from,origin,last:origin,lastPublish:0};
    try{svg.setPointerCapture(event.pointerId)}catch{/* handled by bubbling while within the board */}
  };
  const onMove=(event:PE<HTMLDivElement>)=>{
    const current=drag.current;if(!current||current.id!==event.pointerId)return;
    const svg=event.currentTarget.querySelector("svg");
    if(!svg)return;
    const point=readPosition(svg,event.clientX,event.clientY);
    const next={x:current.origin.x+point.x-current.from.x,y:current.origin.y+point.y-current.from.y};
    current.last=next;
    const updated=movePhysicalPart(item,current.target,next.x,next.y);
    if(updated!==item){
      previewRef.current=updated;
      setPreview(updated);
      if(Date.now()-current.lastPublish>=75){
        current.lastPublish=Date.now();
        onMovePreview?.(current.target,next);
      }
    }
    event.stopPropagation();event.preventDefault();
  };
  const finish=(event:PE<HTMLDivElement>,cancel=false)=>{
    const current=drag.current;if(!current||current.id!==event.pointerId)return;
    drag.current=null;
    const svg=event.currentTarget.querySelector("svg");
    try{if(svg?.hasPointerCapture(event.pointerId))svg.releasePointerCapture(event.pointerId)}catch{}
    if(!cancel&&Math.hypot(current.last.x-current.origin.x,current.last.y-current.origin.y)>.5)
      onMoveEnd?.(current.target,current.last);
    previewRef.current=null;setPreview(null);
    event.stopPropagation();
  };
  const displayed=previewRef.current??preview??item;
  const currentSelection=selection&&isTarget(selection)?selection:null;
  const handleOptics=(event:PE<SVGGElement>,part:{id:string})=>begin(event,{kind:"optical",id:part.id});
  const handleMechanics=(event:PE<SVGGElement>,selected:{type:"body"|"support"|"force";id:string})=>
    begin(event,{kind:selected.type,id:selected.id});
  return <div className="graph-view lektrus-physical-board-inline"
    data-physics-inline={editable?"editing":"view"}
    onPointerMove={editable?onMove:undefined}
    onPointerUp={editable?event=>finish(event):undefined}
    onPointerCancel={editable?event=>finish(event,true):undefined}>
    {displayed.scienceMechanics&&<LektrusMechanicsView doc={displayed.scienceMechanics}
      selection={currentSelection&&["body","support","force"].includes(currentSelection.kind)
        ?{type:currentSelection.kind as "body"|"support"|"force",id:currentSelection.id}:null}
      tool="select" onPartDown={editable?handleMechanics:undefined}/>}
    {displayed.scienceOptics&&<LektrusOpticsView doc={displayed.scienceOptics}
      selection={currentSelection?.kind==="optical"?{kind:"element",id:currentSelection.id}:null}
      tool="select" onElementDown={editable?handleOptics:undefined}/>}
    {displayed.scienceCircuit&&<LektrusCircuitView doc={displayed.scienceCircuit} mode="select"
      selection={currentSelection?.kind==="component"||currentSelection?.kind==="junction"
        ?{kind:currentSelection.kind,id:currentSelection.id}:null}
      onComponentDown={editable?(event,part)=>begin(event,{kind:"component",id:part.id}):undefined}
      onJunctionDown={editable?(event,part)=>begin(event,{kind:"junction",id:part.id}):undefined}/>}
    {editable&&<div className="lektrus-physical-inline-note" aria-hidden="true">Перемещайте детали</div>}
  </div>;
}
