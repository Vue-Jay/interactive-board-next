/** Screen coordinates are percentages of the same interactive bench stage.
 * The tabletop is wider than the old central strip: only cupboards/sink are
 * excluded. Dimensions in mount helpers refer to the actual SVG sizes. */
export const LAB_WORKSPACE={left:9,right:81,top:43,bottom:89} as const;
const clamp=(n:number,min:number,max:number)=>Math.min(max,Math.max(min,n));
const lerp=(min:number,max:number,t:number)=>min+(max-min)*t;
export function labDisplayPoint(point:{x:number;y:number},crowded=false){
 void crowded;
 return {
  x:lerp(LAB_WORKSPACE.left,LAB_WORKSPACE.right,clamp((point.x-10)/80,0,1)),
  y:clamp(lerp(LAB_WORKSPACE.top,LAB_WORKSPACE.bottom,
   clamp((point.y-10)/80,0,1)),53,85)
 };
}
export function labLogicalPoint(point:{x:number;y:number}){
 return {
  x:clamp(10+80*(point.x-LAB_WORKSPACE.left)/(LAB_WORKSPACE.right-LAB_WORKSPACE.left),10,90),
  y:clamp(10+80*(point.y-LAB_WORKSPACE.top)/(LAB_WORKSPACE.bottom-LAB_WORKSPACE.top),10,90)
 };
}
/** Match the relocated bottom-right sink's physical footprint.
 * Same coordinates are used for drag-to-drain hit testing. */
export const LAB_SINK_BOUNDS={left:74.5,right:97.5,top:63.5,bottom:93.5} as const;
export const isLabSink=(p:{x:number;y:number})=>
 p.x>=LAB_SINK_BOUNDS.left&&p.x<=LAB_SINK_BOUNDS.right&&
 p.y>=LAB_SINK_BOUNDS.top&&p.y<=LAB_SINK_BOUNDS.bottom;
export const isLabCupboard=(p:{x:number;y:number})=>p.x>=55&&p.x<83&&p.y>=8&&p.y<=41;
export const isLabWorktop=(p:{x:number;y:number})=>
 p.x>=5&&p.x<=82&&p.y>=43&&p.y<=91;
const size=(min:number,relative:number,max:number,width:number)=>
 clamp(width*relative,min,max);
export type LabMountGeometry={x:number;y:number;kind:string;standHeight?:number};
export type LabVesselGeometry={kind:string};
/** One adjustable retort clamp, shared by illustration and layout. */
export const LAB_STAND_CLAMP_LOW_Y=61;
export const LAB_STAND_CLAMP_HIGH_Y=12;
export const labStandClampSvgY=(height=0.5)=>
 LAB_STAND_CLAMP_LOW_Y-
 (LAB_STAND_CLAMP_LOW_Y-LAB_STAND_CLAMP_HIGH_Y)*clamp(height,0,1);
/** Clamp grip in the 100 x 133 glassware SVG, measured from its top. */
export const labStandVesselGripSvgY=(kind:string)=>
 kind==="dish"||kind==="crucible"?76:
 kind==="beaker"?40:
 kind==="burette"?49:
 kind==="pipette"?67:kind==="tube"?54:kind==="volumetric"?46:48;

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
  (small?size(350,.54,385,w):size(400,.32,460,w)):
  device.kind==="burner"?size(138,.114,180,w):
  (small?size(116,.18,152,w):size(130,.115,178,w));
 let vHeight=small?size(96,.17,130,w):size(112,.157,158,w);
 void crowded;
 if(vessel.kind==="burette")
  vHeight=small?size(130,.24,164,w):size(151,.20,198,w);
 if(vessel.kind==="dish"||vessel.kind==="crucible")
  vHeight=size(98,.12,125,w);
 if(device.kind==="tripod"||device.kind==="stand-shelf"){
  const clampY=labStandClampSvgY(device.standHeight);
  // Translate both SVG landmarks into actual stage pixels. Earlier math
  // reversed the sign, sending suspended glassware below the upper clamp.
  const gripY=labStandVesselGripSvgY(vessel.kind);
  const xPx=(83/110-0.5)*dWidth;
  const yPx=(clampY/108-0.5)*dHeight+(0.55-gripY/133)*vHeight;
  return {x:clamp(device.x+xPx/w*100,5,86),
   y:clamp(device.y+yPx/h*100,34,86)};
 }
 // The glass SVG's bottom is y=120/133; the instrument platform is at
 // y=36/108. Align those surfaces, not their enclosing rectangle centers.
 const foot=(vessel.kind==="conical"||vessel.kind==="crucible"?.385:
  vessel.kind==="dish"?.33:.36)*vHeight;
 const yPx=device.kind==="burner"?-.23*dHeight-foot:-.167*dHeight-foot;
 const xPx=0;
 return {
  x:clamp(device.x+xPx/w*100,5,82),
  y:clamp(device.y+yPx/h*100,47,86)
 };
}

/** Place receiving glassware on the right half of a wide retort stand base, clear of the left rod.
 * The bottom of the vessel, not its middle, coincides with SVG y=96/108.
 * Keep the same responsive dimensions as the rendered stand and glass. */
export function labStandBaseVesselPoint(
 stand:LabMountGeometry,vessel:LabVesselGeometry,
 width:number,height:number,crowded=false
){
 const w=width||1600,h=height||1000,small=w<=690;
 const dw=small?size(112,.17,146,w):size(130,.11,190,w);
 const dh=small?size(350,.54,385,w):size(400,.32,460,w);
 let vh=small?size(96,.17,130,w):size(112,.157,158,w);
 void crowded;
 if(vessel.kind==="dish"||vessel.kind==="crucible")vh=size(98,.12,125,w);
 const vesselFoot=0.4*vh;
 return {
  x:clamp(stand.x+(77/110-.5)*dw/w*100,5,82),
  y:clamp(stand.y+((96/108-.5)*dh-vesselFoot)/h*100,46,85)
 };
}

/** Position visible titration droplets at the true SVG nozzle and the
 * recipient's open rim, not at an arbitrary offset from a vessel centre.
 * The SVG pictures are aspect-ratio contained in the rendered glassware
 * buttons, whose logical viewBox is 100 × 133. Keep the stage in pixels
 * so teardrops remain circular when the tabletop stretches horizontally. */
export function labTitrationDropEndpoints(
 source:{x:number;y:number},receiver:{x:number;y:number},
 receiverKind:string,stageWidth:number,stageHeight:number
):{x:number;y:number;targetX:number;targetY:number}|null{
 if(!Number.isFinite(stageWidth)||!Number.isFinite(stageHeight)||
  stageWidth<=0||stageHeight<=0)return null;
 const w=stageWidth,h=stageHeight,compact=w<=690;
 const clampSize=(min:number,relative:number,max:number)=>
  Math.max(min,Math.min(max,w*relative));
 const sourceWidth=compact?clampSize(47,.07,67):clampSize(52,.047,78);
 const sourceHeight=compact?clampSize(130,.24,164):clampSize(151,.20,198);
 const targetWidth=compact?(
  receiverKind==="tube"?clampSize(50,.045,72):clampSize(52,.09,82)):
  receiverKind==="tube"?clampSize(50,.045,72):
  receiverKind==="cylinder"||receiverKind==="volumetric"?clampSize(56,.053,86):
  clampSize(58,.063,104);
 const targetHeight=compact?clampSize(96,.17,130):
  receiverKind==="dish"||receiverKind==="crucible"?clampSize(98,.12,125):
  clampSize(112,.157,158);
 const pictureHeight=(width:number,height:number)=>Math.min(height,width*1.33);
 const sourcePicture=pictureHeight(sourceWidth,sourceHeight);
 const targetPicture=pictureHeight(targetWidth,targetHeight);
 const nozzleSvgY=126; // burette nozzle in LabVesselGraphic
 const rimSvgY=receiverKind==="beaker"?14:
  receiverKind==="tube"?12:
  receiverKind==="flask"||receiverKind==="conical"?9:12;
 const x=source.x*w/100;
 const y=source.y*h/100-sourceHeight*.54+
  (sourceHeight-sourcePicture)/2+sourcePicture*nozzleSvgY/133;
 const targetX=receiver.x*w/100;
 const targetY=receiver.y*h/100-targetHeight*.54+
  (targetHeight-targetPicture)/2+targetPicture*rimSvgY/133;
 return targetY>y+4?{x,y,targetX,targetY}:null;
}
