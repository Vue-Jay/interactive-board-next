import type {Item,Point} from "./boardModel";

/** Legacy untyped mathematical planes are also valid. Subject diagrams
 * and typed science graphs keep their existing editor gestures. */
export const isCoordinatePlane=(item:Item)=>item.kind==="graph"&&
  (item.graphPurpose==="coordinates"||!item.graphPurpose&&!item.graphExpression&&!item.graphPolygons?.length&&!item.graphCircles?.length)&&
  (!item.graphFigureId||item.graphFigureId==="blank");

export const isCoordinatePointGraph=(item:Item)=>isCoordinatePlane(item)||
  item.kind==="graph"&&item.graphPurpose==="number-line";

export const graphPointSnapEnabled=(item:Item)=>item.graphSnap??isCoordinatePointGraph(item);

export function coordinatePlaneViewport(item:Item){
  if(item.graphPurpose==="number-line")return {width:600,height:360};
  // One SVG unit equals one local board unit, independently of the aspect ratio.
  // A fixed width of 600 caused every glyph, point and control to scale with
  // horizontal resizing even when the coordinate range expanded correctly.
  return {width:Math.max(1,item.width),height:Math.max(1,item.height)};
}

export function planePointFromSvg(item:Item,point:Point):Point {
  const {width,height}=coordinatePlaneViewport(item);
  const xMin=item.graphXMin??-10,xMax=item.graphXMax??10;
  const yMin=item.graphYMin??-10,yMax=item.graphYMax??10;
  const scale=Math.min(width/Math.max(.01,xMax-xMin),height/Math.max(.01,yMax-yMin));
  let x=(xMin+xMax)/2+(point.x-width/2)/scale;
  let y=(yMin+yMax)/2-(point.y-height/2)/scale;
  if(graphPointSnapEnabled(item)){
    const step=Math.max(.1,item.graphGridStep??1);
    x=Math.round(x/step)*step;y=Math.round(y/step)*step;
  }
  return {x:Number(x.toFixed(4)),y:item.graphPurpose==="number-line"?0:Number(y.toFixed(4))};
}

export function planePointFromClient(item:Item,svg:SVGSVGElement,client:Point):Point|null{
  const matrix=svg.getScreenCTM();
  if(!matrix)return null;
  const point=svg.createSVGPoint();point.x=client.x;point.y=client.y;
  const local=point.matrixTransform(matrix.inverse());
  const {width,height}=coordinatePlaneViewport(item);
  if(local.x<0||local.x>width||local.y<0||local.y>height)return null;
  return planePointFromSvg(item,local);
}

/** Range edits change physical dimensions; zoom changes only the range.
 * Resizing is the inverse of range edits and never changes point coordinates. */
export type PlaneRange={xMin:number;xMax:number;yMin:number;yMax:number};
type PlaneSize={width:number;height:number};
export const planeRange=(item:Item):PlaneRange=>({
  xMin:item.graphXMin??-10,xMax:item.graphXMax??10,
  yMin:item.graphYMin??-10,yMax:item.graphYMax??10
});
const validRange=(r:PlaneRange)=>[r.xMin,r.xMax,r.yMin,r.yMax].every(Number.isFinite)&&r.xMax>r.xMin&&r.yMax>r.yMin;
const round=(n:number)=>Number(n.toPrecision(12));
export function planeSizeForRange(previous:PlaneRange,size:PlaneSize,next:PlaneRange):PlaneSize{
  if(!validRange(previous)||!validRange(next))return size;
  const x=next.xMax-next.xMin,y=next.yMax-next.yMin;
  const unit=Math.min(size.width/(previous.xMax-previous.xMin),size.height/(previous.yMax-previous.yMin));
  const scale=Math.min(unit,12000/Math.max(x,y));
  return {width:Math.max(1,round(x*scale)),height:Math.max(1,round(y*scale))};
}
export function scalePlaneRange(range:PlaneRange,xFactor:number,yFactor=xFactor):PlaneRange{
  if(!validRange(range)||!Number.isFinite(xFactor)||!Number.isFinite(yFactor)||xFactor<=0||yFactor<=0)return range;
  const sx=range.xMax-range.xMin,sy=range.yMax-range.yMin;
  const cx=(range.xMax+range.xMin)/2,cy=(range.yMax+range.yMin)/2;
  const limit=(span:number,factor:number)=>Math.max(Math.min(.01,span),Math.min(Math.max(2e6,span),span*factor));
  const x=limit(sx,xFactor),y=limit(sy,yFactor);
  const next={xMin:round(cx-x/2),xMax:round(cx+x/2),yMin:round(cy-y/2),yMax:round(cy+y/2)};
  return validRange(next)?next:range;
}
const rangeFields=(r:PlaneRange)=>({graphXMin:r.xMin,graphXMax:r.xMax,graphYMin:r.yMin,graphYMax:r.yMax});
/** Keep the opposite edge fixed in graph coordinates, including rotated
 * objects (the board passes the LOCAL resize handle). A proportional group
 * resize can also grow an axis that has no handle; that axis grows centrally. */
export function resizeCoordinatePlane(base:Item,resized:Item,handle:string):Item{
  if(!isCoordinatePlane(base)||base.width===resized.width&&base.height===resized.height)return resized;
  const range=planeRange(base);
  if(!validRange(range))return resized;
  const span=(old:number,factor:number)=>Math.max(Math.min(.01,old),Math.min(Math.max(2e6,old),old*factor));
  const axis=(min:number,max:number,factor:number,moveMin:boolean,moveMax:boolean):[number,number]=>{
    if(factor===1||!Number.isFinite(factor)||factor<=0)return [min,max];
    const length=span(max-min,factor);
    let nextMin=min,nextMax=max;
    if(moveMin)nextMin=round(max-length);
    else if(moveMax)nextMax=round(min+length);
    else{const center=min+(max-min)/2;nextMin=round(center-length/2);nextMax=round(center+length/2);}
    return Number.isFinite(nextMin)&&Number.isFinite(nextMax)&&nextMin<nextMax?[nextMin,nextMax]:[min,max];
  };
  const [xMin,xMax]=axis(range.xMin,range.xMax,resized.width/base.width,handle.includes("w"),handle.includes("e"));
  // SVG screen Y increases downwards, mathematical Y increases upwards.
  const [yMin,yMax]=axis(range.yMin,range.yMax,resized.height/base.height,handle.includes("s"),handle.includes("n"));
  return {...resized,...rangeFields({xMin,xMax,yMin,yMax})};
}
/** Persist only explicit plane zoom, not a change of the coordinate bounds.
 * Bound the displayed font separately so reversing zoom restores its size. */
export function planeAxisLabelScale(value?:number):number{
  return typeof value==="number"&&Number.isFinite(value)?Math.max(1e-9,Math.min(1e9,value)):1;
}
/** Gentle, bounded font scaling instead of enlarging digits as fast as the grid. */
export function planeAxisLabelFont(value?:number):number{
  return Math.max(12,Math.min(16,14*Math.pow(planeAxisLabelScale(value),.35)));
}
/** The fine grid is independent. Use a 1–2–5 progression for numeric labels,
 * based on available local space and a conservative estimate of glyph width. */
export function planeAxisLabelTicks(min:number,max:number,pixelsPerUnit:number,gridStep:number,font:number,axis:"x"|"y"):number[]{
  if(![min,max,pixelsPerUnit,gridStep,font].every(Number.isFinite)||max<=min||pixelsPerUnit<=0||gridStep<=0||font<=0)return [];
  // Pick a nice step by measuring the labels that will actually be drawn.
  // Raw range boundaries become long floating-point strings after zooming;
  // counting their characters causes arbitrary jumps in the tick interval.
  const minMultiple=Math.max(1,(max-min)/(gridStep*90));
  if(!Number.isFinite(minMultiple))return [];
  const startPower=Math.max(0,Math.floor(Math.log10(minMultiple)));
  for(let power=startPower;power<=startPower+24;power++){
    for(const multiplier of [1,2,5]){
      const step=gridStep*multiplier*10**power;
      if(!Number.isFinite(step)||step<=0)return [];
      const first=Math.ceil(min/step-1e-9),last=Math.floor(max/step+1e-9);
      const count=Math.max(0,last-first+1);
      if(count>91)continue;
      const labels=Array.from({length:count},(_,i)=>round((first+i)*step)).filter(value=>value!==0);
      if(!labels.length)return [];
      const longest=Math.max(1,...labels.map(value=>String(value).length));
      const spacing=axis==="x"?font*.72*longest+9:font*1.5+5;
      if(step*pixelsPerUnit>=spacing||labels.length===1)return labels;
    }
  }
  return [];
}
export function zoomPlaneAxisLabelScale(value:number|undefined,previous:PlaneRange,next:PlaneRange):number|undefined{
  if(!validRange(previous)||!validRange(next))return value;
  const factor=Math.min((previous.xMax-previous.xMin)/(next.xMax-next.xMin),
    (previous.yMax-previous.yMin)/(next.yMax-next.yMin));
  if(Math.abs(factor-1)<1e-10)return value;
  const result=round(planeAxisLabelScale(planeAxisLabelScale(value)*factor));
  return result===1?undefined:result;
}
export function zoomCoordinatePlane(item:Item,factor:number):Item{
  if(!isCoordinatePlane(item))return item;
  const previous=planeRange(item),next=scalePlaneRange(previous,factor);
  const labelScale=zoomPlaneAxisLabelScale(item.graphAxisLabelScale,previous,next);
  const updated={...item,...rangeFields(next)};
  if(labelScale===undefined)delete updated.graphAxisLabelScale;
  else updated.graphAxisLabelScale=labelScale;
  return updated;
}
