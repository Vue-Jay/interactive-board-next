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
  return {width:600,height:Math.max(120,Math.min(1800,600*item.height/Math.max(1,item.width)))};
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
