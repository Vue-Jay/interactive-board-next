import type {Item} from "./boardModel";
import {mechClamp,mechanicsForceOrigin} from "./lektrusMechanicsModel";
import {clampCircuit,gridCircuit} from "./lektrusCircuitModel";
export type PhysicalTarget={kind:"body"|"support"|"force"|"optical"|"component"|"junction";id:string};
const limit=(v:number,min:number,max:number)=>Math.max(min,Math.min(max,Math.round(v)));
/** Move one stable-ID part without replacing other participants' parts.
 * Coordinates are in that instrument's own SVG viewBox, not board pixels. */
export function movePhysicalPart(item:Item,target:PhysicalTarget,x:number,y:number):Item{
 if(!Number.isFinite(x)||!Number.isFinite(y))return item;
 if(item.scienceMechanics){
  const doc=item.scienceMechanics;
  if(target.kind==="body"){
   if(!doc.bodies.some(part=>part.id===target.id))return item;
   return {...item,scienceMechanics:{...doc,bodies:doc.bodies.map(part=>part.id===target.id?
     {...part,x:mechClamp(Math.round(x),20,940),y:mechClamp(Math.round(y),20,540)}:part)}};
  }
  if(target.kind==="support"){
   if(!doc.supports.some(part=>part.id===target.id))return item;
   return {...item,scienceMechanics:{...doc,supports:doc.supports.map(part=>part.id===target.id?
     {...part,x:mechClamp(Math.round(x),20,940),y:mechClamp(Math.round(y),20,540)}:part)}};
  }
  if(target.kind==="force"){
   const force=doc.forces.find(part=>part.id===target.id);
   if(!force)return item;
   const origin=mechanicsForceOrigin(force,doc);
   const deltaX=x-origin.x,deltaY=origin.y-y;
   const length=Math.hypot(deltaX,deltaY);
   if(length<.01)return item;
   return {...item,scienceMechanics:{...doc,forces:doc.forces.map(part=>part.id===target.id?
    {...part,angle:Math.round(Math.atan2(deltaY,deltaX)*180/Math.PI),
      length:mechClamp(Math.round(length),15,400)}:part)}};
  }
 }
 if(item.scienceOptics&&target.kind==="optical"){
  const doc=item.scienceOptics;
  if(!doc.elements.some(part=>part.id===target.id))return item;
  return {...item,scienceOptics:{...doc,elements:doc.elements.map(part=>part.id===target.id?
    {...part,x:limit(x,35,925),y:limit(y,35,525)}:part)}};
 }
 if(item.scienceCircuit){
  const doc=item.scienceCircuit;
  if(target.kind==="component"){
   if(!doc.components.some(part=>part.id===target.id))return item;
   return {...item,scienceCircuit:{...doc,components:doc.components.map(part=>part.id===target.id?
     {...part,x:clampCircuit(gridCircuit(x,doc.snap),25,875),
       y:clampCircuit(gridCircuit(y,doc.snap),25,555)}:part)}};
  }
  if(target.kind==="junction"){
   if(!doc.junctions.some(part=>part.id===target.id))return item;
   return {...item,scienceCircuit:{...doc,junctions:doc.junctions.map(part=>part.id===target.id?
     {...part,x:clampCircuit(gridCircuit(x,doc.snap),10,890),
       y:clampCircuit(gridCircuit(y,doc.snap),10,570)}:part)}};
  }
 }
 return item;
}
export function physicalPartPivot(item:Item,target:PhysicalTarget):{x:number;y:number}|null{
 const d=item.scienceMechanics;
 if(d){
  if(target.kind==="body")return d.bodies.find(v=>v.id===target.id)??null;
  if(target.kind==="support")return d.supports.find(v=>v.id===target.id)??null;
  if(target.kind==="force"){
   const f=d.forces.find(v=>v.id===target.id);
   if(!f)return null;
   const origin=mechanicsForceOrigin(f,d),r=f.angle*Math.PI/180;
   return {x:origin.x+Math.cos(r)*f.length,y:origin.y-Math.sin(r)*f.length};
  }
 }
 if(item.scienceOptics&&target.kind==="optical")return item.scienceOptics.elements.find(v=>v.id===target.id)??null;
 if(item.scienceCircuit){
  if(target.kind==="component")return item.scienceCircuit.components.find(v=>v.id===target.id)??null;
  if(target.kind==="junction")return item.scienceCircuit.junctions.find(v=>v.id===target.id)??null;
 }
 return null;
}
