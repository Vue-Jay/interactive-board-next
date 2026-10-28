/** Screen coordinates are percentages of the same interactive bench stage.
 * The tabletop is wider than the old central strip: only cupboards/sink are
 * excluded. Dimensions in mount helpers refer to the actual SVG sizes. */
export const LAB_WORKSPACE={left:9,right:81,top:43,bottom:89} as const;
const clamp=(n:number,min:number,max:number)=>Math.min(max,Math.max(min,n));
const lerp=(min:number,max:number,t:number)=>min+(max-min)*t;
export function labDisplayPoint(point:{x:number;y:number},crowded=false){
 return {
  x:lerp(LAB_WORKSPACE.left,LAB_WORKSPACE.right,clamp((point.x-10)/80,0,1)),
  y:clamp(lerp(LAB_WORKSPACE.top,LAB_WORKSPACE.bottom,
   clamp((point.y-10)/80,0,1)),crowded?52:53,crowded?84:85)
 };
}
export function labLogicalPoint(point:{x:number;y:number}){
 return {
  x:clamp(10+80*(point.x-LAB_WORKSPACE.left)/(LAB_WORKSPACE.right-LAB_WORKSPACE.left),10,90),
  y:clamp(10+80*(point.y-LAB_WORKSPACE.top)/(LAB_WORKSPACE.bottom-LAB_WORKSPACE.top),10,90)
 };
}
export const isLabSink=(p:{x:number;y:number})=>p.x>=83&&p.y>=45&&p.y<=94;
export const isLabCupboard=(p:{x:number;y:number})=>p.x>=55&&p.x<83&&p.y>=8&&p.y<=41;
export const isLabWorktop=(p:{x:number;y:number})=>
 p.x>=5&&p.x<=82&&p.y>=43&&p.y<=91;
const size=(min:number,relative:number,max:number,width:number)=>
 clamp(width*relative,min,max);
export type LabMountGeometry={x:number;y:number;kind:string;standHeight?:number};
export type LabVesselGeometry={kind:string};
/** Shared, responsive alignment for a beaker resting on a heater top,
 * a flask suspended over a flame, or a tube inside a stand clamp.
 * Unlike fixed percentages, anchors track the actual model dimensions. */
export function labMountedGlasswarePoint(
 device:LabMountGeometry,vessel:LabVesselGeometry,
 width:number,height:number,crowded=false
){
 const w=width||1600,h=height||1000,small=w<=690;
 const dWidth=(device.kind==="tripod"||device.kind==="stand-shelf")?
  (small?size(112,.17,146,w):size(130,.11,190,w)):
  device.kind==="burner"?size(119,.096,166,w):
  (small?size(101,.16,138,w):size(119,.103,175,w));
 const dHeight=(device.kind==="tripod"||device.kind==="stand-shelf")?
  (small?size(150,.21,174,w):size(168,.14,212,w)):
  device.kind==="burner"?size(138,.114,180,w):
  (small?size(116,.18,152,w):size(130,.115,178,w));
 let vHeight=small?size(96,.17,130,w):size(112,.157,158,w);
 if(crowded)vHeight=size(100,.133,136,w);
 if(vessel.kind==="burette")
  vHeight=small?size(130,.24,164,w):size(151,.20,198,w);
 if(vessel.kind==="dish"||vessel.kind==="crucible")
  vHeight=size(98,.12,125,w);
 // The glass SVG's bottom is y=120/133; the instrument platform is at
 // y=36/108. Align those surfaces, not their enclosing rectangle centers.
 const foot=(vessel.kind==="conical"||vessel.kind==="crucible"?.385:
  vessel.kind==="dish"?.33:.36)*vHeight;
 const clampY=(.5-(52-29*(device.standHeight??.5))/108)*dHeight;
 const yPx=device.kind==="stand-shelf"?.16*dHeight-foot:
  device.kind==="tripod"?clampY+.27*vHeight:
  device.kind==="burner"?-.23*dHeight-foot:
  -.167*dHeight-foot;
 const xPx=device.kind==="tripod"?.23*dWidth:
  device.kind==="stand-shelf"?.19*dWidth:0;
 return {
  x:clamp(device.x+xPx/w*100,5,82),
  y:clamp(device.y+yPx/h*100,47,86)
 };
}
