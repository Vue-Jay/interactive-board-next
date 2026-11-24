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
/** Generate zero-anchored ticks without accumulating floating-point drift. */
export function planeTicks(min:number,max:number,step:number):number[]{
  if(![min,max,step].every(Number.isFinite)||max<=min||step<=0)return [];
  const first=Math.ceil(min/step-1e-9),last=Math.floor(max/step+1e-9);
  const count=Math.max(0,last-first+1);
  if(count>101||!Number.isSafeInteger(first)||!Number.isSafeInteger(last))return [];
  return Array.from({length:count},(_,i)=>round((first+i)*step));
}
export const planeLabelHalfWidth=(value:number,font:number)=>font*(String(value).length*.36+.12);
export const isPlaneMajorTick=(value:number,step:number)=>Math.abs(value/step-Math.round(value/step))<1e-7;

/** Square grids use one 1–2–5 interval on both axes. Fit neighboring
 * printed numbers rather than a worst-case string from the raw range.
 * The configured snap step is never changed by visual subdivisions. */
export const validPlaneLabelStep=(value:unknown):value is number=>typeof value==="number"&&Number.isFinite(value)&&value>=.001&&value<=1e6;
export function planeAxisLayout(range:PlaneRange,pixelsPerUnit:number,gridStep:number,font:number,manualStep?:number){
  const empty={labelStep:1,gridStep:1,xLabels:[] as number[],yLabels:[] as number[],xGrid:[] as number[],yGrid:[] as number[]};
  if(!validRange(range)||![pixelsPerUnit,gridStep,font].every(Number.isFinite)||pixelsPerUnit<=0||gridStep<=0||font<=0)return empty;
  const {xMin,xMax,yMin,yMax}=range;
  const span=Math.max(xMax-xMin,yMax-yMin),minimumSpacing=font*1.5+5;
  const manual=validPlaneLabelStep(manualStep);
  const raw=Math.max(minimumSpacing/pixelsPerUnit,span/90),base=manual?manualStep:gridStep;
  const minPower=!manual&&raw<base&&span<base*5?Math.min(0,Math.floor(Math.log10(raw/base))):0;
  const startPower=Math.max(minPower,Math.floor(Math.log10(raw/base)));
  for(let power=startPower;power<=startPower+24;power++){
    for(const m of [1,2,5]){
      const labelStep=round(base*m*10**power);
      if(!Number.isFinite(labelStep)||labelStep<=0)return empty;
      if(labelStep<raw*(1-1e-9))continue;
      const xLabels=planeTicks(xMin,xMax,labelStep).filter(v=>v!==0);
      const yLabels=planeTicks(yMin,yMax,labelStep).filter(v=>v!==0);
      let spacing=minimumSpacing;
      for(let i=1;i<xLabels.length;i++){
        const units=(xLabels[i]-xLabels[i-1])/labelStep;
        spacing=Math.max(spacing,(planeLabelHalfWidth(xLabels[i],font)+planeLabelHalfWidth(xLabels[i-1],font)+4)/units);
      }
      if(labelStep*pixelsPerUnit<spacing-1e-8)continue;
      // Every labelled tick must sit on a grid line, including far zoom.
      // Thin the minor grid using exact subdivisions of the major interval.
      const fineMin=Math.max(Math.min(gridStep,labelStep),6/pixelsPerUnit,span/90);
      const fineCandidates=[labelStep/10,labelStep/5,labelStep/4,labelStep/2,labelStep]
        .map(round).filter(v=>v>=fineMin*(1-1e-9)&&
         (v<gridStep||Math.abs(v/gridStep-Math.round(v/gridStep))<1e-7));
      const visualStep=fineCandidates[0]??labelStep;
      return {labelStep,gridStep:visualStep,xLabels,yLabels,
        xGrid:planeTicks(xMin,xMax,visualStep),yGrid:planeTicks(yMin,yMax,visualStep)};
    }
  }
  return empty;
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
