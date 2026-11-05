/** Anti-aliased, silhouette-registered lateral skin sections.
 * A three-pixel atlas stretched 2000% produced stair-stepped coloured
 * stripes. This module extracts contour tracks ONCE from the body alpha,
 * smooths them in body-world space, and draws their tissue as vector paths.
 * Both sides of each separate limb remain independent, with neutral centers.
 */
import {skinEdgeRuns} from "./lektrusSkinEdgeSections";
export const SKIN_SECTION_WORLD_DEPTH=8.4;
export const SKIN_SECTION_NEUTRAL_FRACTION=.20;
export type SkinSectionPoint={x:number;y:number;depth:number};
export type SkinSectionContour={inward:-1|1;points:SkinSectionPoint[];
 minX:number;maxX:number;minY:number;maxY:number};
type Track={inward:-1|1;lastRow:number;lastX:number;points:SkinSectionPoint[]};
type Bounds={minX:number;maxX:number;minY:number;maxY:number};
const LAYERS=[
 {start:0,end:.13,fill:"#c37e85"},
 {start:.13,end:.54,fill:"#edb1a9"},
 {start:.54,end:1,fill:"#f4d49a"}
] as const;
export function skinSectionContours(
 alpha:Uint8ClampedArray,width:number,height:number,factor=3
):SkinSectionContour[]{
 if(width*height!==alpha.length||factor<=0||!Number.isFinite(factor))
  throw Error("Invalid skin alpha or dimensions");
 const finished:Track[]=[];
 let open:Track[]=[];
 for(let row=0;row<height;row++){
  const candidates:{inward:-1|1;x:number;depth:number}[]=[];
  for(const run of skinEdgeRuns(alpha,width,row)){
   const d=Math.min(SKIN_SECTION_WORLD_DEPTH,
    (run.end-run.start+1)/factor*(1-SKIN_SECTION_NEUTRAL_FRACTION)/2);
   // Both sides keep a central unpainted strip even on narrow limbs.
   candidates.push({inward:1,x:run.start/factor,depth:d});
   candidates.push({inward:-1,x:run.end/factor,depth:d});
  }
  const used=new Set<Track>();
  const next:Track[]=[];
  for(const candidate of candidates){
   let match:Track|undefined;
   let nearest=Number.POSITIVE_INFINITY;
   for(const track of open){
    if(used.has(track)||track.inward!==candidate.inward||
     track.lastRow!==row-1)continue;
    const diff=Math.abs(track.lastX-candidate.x);
    if(diff<nearest&&diff<2.7){nearest=diff;match=track;}
   }
   const track:Track=match??{inward:candidate.inward,lastRow:row,
    lastX:candidate.x,points:[]};
   track.points.push({x:candidate.x,y:row/factor,depth:candidate.depth});
   track.lastX=candidate.x;track.lastRow=row;
   next.push(track);used.add(track);
  }
  for(const track of open)if(!used.has(track)&&track.points.length>=8)
   finished.push(track);
  open=next;
 }
 for(const track of open)if(track.points.length>=8)finished.push(track);
 return finished.map(track=>{
  const source=track.points;
  // A small bilateral filter removes pixel stair-steps but never crosses
  // unrelated contours or changes registration on each camera frame.
  const points=source.map((point,i)=>{
   let totalX=0,totalDepth=0,totalWeight=0;
   for(let j=Math.max(0,i-5);j<=Math.min(source.length-1,i+5);j++){
    const delta=source[j].x-point.x;
    const weight=(6-Math.abs(i-j))*(Math.abs(delta)<1.75?1:.03);
    totalX+=source[j].x*weight;
    totalDepth+=source[j].depth*weight;totalWeight+=weight;
   }
   const smoothDepth=Math.min(totalDepth/totalWeight,
    point.depth+.2);
   const endRamp=Math.min(1,(i+1)/5,(source.length-i)/5);
   return {x:totalX/totalWeight,y:point.y,
    depth:Math.min(point.depth,smoothDepth)*endRamp};
  });
  return {inward:track.inward,points,
   minX:Math.min(...points.map(p=>p.x-SKIN_SECTION_WORLD_DEPTH)),
   maxX:Math.max(...points.map(p=>p.x+SKIN_SECTION_WORLD_DEPTH)),
   minY:points[0].y,maxY:points[points.length-1].y};
 });
}
/** Geometry never depends on camera or pixel dimensions. A culling margin
 * preserves smooth end-caps when the viewport pans across a section. */
function visiblePoints(contour:SkinSectionContour,b:Bounds){
 if(contour.maxY<b.minY-5||contour.minY>b.maxY+5||
  contour.maxX<b.minX-3||contour.minX>b.maxX+3)return [];
 return contour.points.filter(p=>p.y>=b.minY-4&&p.y<=b.maxY+4);
}
function appendBand(
 ctx:CanvasRenderingContext2D,contour:SkinSectionContour,
 points:readonly SkinSectionPoint[],start:number,end:number
){
 if(points.length<2)return;
 const x=(p:SkinSectionPoint,f:number)=>
  p.x+contour.inward*p.depth*f;
 const trace=(list:readonly SkinSectionPoint[],fraction:number,join:boolean)=>{
  const first=list[0];
  if(join)ctx.lineTo(x(first,fraction),first.y);
  else ctx.moveTo(x(first,fraction),first.y);
  for(let i=1;i<list.length;i++){
   const prev=list[i-1],p=list[i];
   ctx.quadraticCurveTo(x(prev,fraction),prev.y,
    (x(prev,fraction)+x(p,fraction))/2,(prev.y+p.y)/2);
  }
  const last=list[list.length-1];
  ctx.lineTo(x(last,fraction),last.y);
 };
 trace(points,start,false);
 trace([...points].reverse(),end,true);
 ctx.closePath();
}
/** Paint vectors at native canvas-device resolution at ANY zoom. */
export function drawSkinSectionBands(
 ctx:CanvasRenderingContext2D,contours:readonly SkinSectionContour[],
 bounds:Bounds
):number{
 let drawn=0;
 for(const c of contours){
  const points=visiblePoints(c,bounds);
  if(points.length<2)continue;
  for(const layer of LAYERS){
   ctx.beginPath();appendBand(ctx,c,points,layer.start,layer.end);
   ctx.fillStyle=layer.fill;ctx.globalAlpha=.98;ctx.fill();
  }
  // A soft papillary border, not square raster-band pixels.
  ctx.globalAlpha=.55;ctx.lineWidth=.045;ctx.strokeStyle="#ac6a76";
  for(const fraction of [.13,.54]){
   ctx.beginPath();
   const first=points[0];
   ctx.moveTo(first.x+c.inward*first.depth*fraction,first.y);
   for(let i=1;i<points.length;i++){
    const prev=points[i-1],p=points[i];
    const x0=prev.x+c.inward*prev.depth*fraction;
    const x1=p.x+c.inward*p.depth*fraction;
    ctx.quadraticCurveTo(x0,prev.y,(x0+x1)/2,(prev.y+p.y)/2);
   }
   ctx.stroke();
  }
  drawn++;
 }
 ctx.globalAlpha=1;
 return drawn;
}
/** Called while the caller's context is saved. Clip only actual tissue
 * strips, not the center, transparency or gaps between separate limbs. */
export function clipSkinSection(
 ctx:CanvasRenderingContext2D,contours:readonly SkinSectionContour[],
 bounds:Bounds
):number{
 ctx.beginPath();
 let count=0;
 for(const c of contours){
  const points=visiblePoints(c,bounds);
  if(points.length<2)continue;
  appendBand(ctx,c,points,0,1);count++;
 }
 if(count)ctx.clip();
 return count;
}
