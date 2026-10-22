import type {ContourMark,ContourStroke} from "./lektrusAtlasModel";

type WorldPoint={x:number;y:number};
const screenPoint=(lon:number,lat:number):WorldPoint=>({x:(lon+180)*2.5,y:(90-lat)*2.5});
const distanceToSegment=(p:WorldPoint,a:WorldPoint,b:WorldPoint):number=>{
 const dx=b.x-a.x,dy=b.y-a.y,denom=dx*dx+dy*dy;
 const t=denom?Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/denom)):0;
 return Math.hypot(p.x-a.x-t*dx,p.y-a.y-t*dy);
};
/** Hit test screen-sized annotations in world geometry; zoom is the SVG camera scale. */
export function contourEraserHits(marks:ContourMark[],strokes:ContourStroke[],
 point:WorldPoint,scale:number,radiusPx=12,labelUiScale=1):{marks:string[];strokes:string[]}{
 const factor=Math.max(.1,scale),radius=radiusPx/factor;
 const hitMarks=marks.filter(mark=>{
  const anchor=screenPoint(mark.lon,mark.lat),dx=point.x-anchor.x,dy=point.y-anchor.y;
  const width=Math.max(36,Math.min(80,mark.text.length)*9+20)*labelUiScale/factor;
  const pointOffset=mark.kind==="point"?11*labelUiScale/factor:0;
  return dx>=pointOffset-(mark.kind==="point"?0:width/2)-radius
   &&dx<=pointOffset+(mark.kind==="point"?width:width/2)+radius
   &&dy>=-19*labelUiScale/factor-radius&&dy<=9*labelUiScale/factor+radius;
 }).map(mark=>mark.id);
 const hitStrokes=strokes.filter(line=>{
  for(let i=1;i<line.points.length;i++){
   const a=screenPoint(line.points[i-1][0],line.points[i-1][1]);
   const b=screenPoint(line.points[i][0],line.points[i][1]);
   if(distanceToSegment(point,a,b)<=radius+1/factor)return true;
  }
  return false;
 }).map(line=>line.id);
 return {marks:hitMarks,strokes:hitStrokes};
}
/** Coordinates remain geographic and survive map pan, zoom and board-object resize. */
export function moveContourMark(mark:ContourMark,start:WorldPoint,end:WorldPoint):ContourMark{
 return {...mark,lon:Math.max(-180,Math.min(180,mark.lon+(end.x-start.x)/2.5)),
  lat:Math.max(-90,Math.min(90,mark.lat-(end.y-start.y)/2.5))};
}
