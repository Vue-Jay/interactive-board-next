import {geometryLabelLayout,type LabelEdge} from "./lektrusGeometryLabelLayout";
import {MECH_WIDTH,MECH_HEIGHT,mechanicsForceOrigin,mechanicsForceTip,type MechanicsDocument} from "./lektrusMechanicsModel";

export const mechanicsForceCaption=(f:MechanicsDocument["forces"][number])=>`${f.label||"F"}${f.showValue?` = ${f.magnitude} Н`:""}`;

/** All three kinds of caption share the same obstacles and avoid one another. */
export function mechanicsLabels(doc:MechanicsDocument){
 const forces=doc.forces.map(f=>({f,a:mechanicsForceOrigin(f,doc),b:mechanicsForceTip(f,doc)}));
 const bodies=doc.bodies.map(b=>({left:b.x-b.width/2-7,right:b.x+b.width/2+7,top:b.y-b.height/2-7,bottom:b.y+b.height/2+7}));
 const supports=doc.supports.map(s=>{
  const angle=-s.angle*Math.PI/180,c=Math.cos(angle),sin=Math.sin(angle);
  const w=s.kind==="pivot"?35:s.width/2+12,top=s.kind==="pivot"?-24:-6,bottom=s.kind==="pivot"?27:18;
  return [[-w,top],[w,top],[w,bottom],[-w,bottom]].map(([x,y])=>({x:s.x+x*c-y*sin,y:s.y+x*sin+y*c}));
 });
 const edges:LabelEdge[]=forces.map(({a,b})=>[a,b]);
 const points=[
  ...forces.map(({f,a,b})=>({x:(a.x+b.x)/2,y:(a.y+b.y)/2,label:mechanicsForceCaption(f),fontSize:15,preferredAngle:Math.atan2(b.y-a.y,b.x-a.x)-Math.PI/2})),
  ...doc.bodies.map(b=>({x:b.x,y:b.y-b.height/2,label:b.label||"Тело",fontSize:15,preferredAngle:-Math.PI/2})),
  ...doc.supports.map(s=>({x:s.x,y:s.y,label:s.label,fontSize:14,preferredAngle:Math.PI/2-s.angle*Math.PI/180}))
 ];
 const captions=geometryLabelLayout(points,supports,edges,MECH_WIDTH,MECH_HEIGHT,bodies);
 return {forces:captions.slice(0,forces.length),bodies:captions.slice(forces.length,forces.length+doc.bodies.length),supports:captions.slice(forces.length+doc.bodies.length)};
}
