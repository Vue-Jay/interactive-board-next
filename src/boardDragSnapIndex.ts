/** Stable alignment-guide index for large interactive whiteboards.
 *
 * Dragging must not rescan 3× every object on each pointermove. We build
 * three left/center/right and top/middle/bottom anchors once per gesture,
 * then resolve six queries with binary search for each move.
 *
 * Original traversal order is retained when two equally close guides exist,
 * so snapping stays identical to the legacy full-scan implementation.
 */
export type BoardDragBounds={x:number;y:number;width:number;height:number};
export type BoardDragGuideState={x?:number;y?:number};
type AxisEntry={value:number;order:number};
type AxisIndex={positions:number[];orders:number[]};
export type BoardDragSnapIndex={x:AxisIndex;y:AxisIndex};

const axisIndex=(objects:readonly BoardDragBounds[],horizontal:boolean):AxisIndex=>{
  const entries:AxisEntry[]=[];
  for(let i=0;i<objects.length;i++){
    const box=objects[i];
    const start=horizontal?box.x:box.y;
    const span=horizontal?box.width:box.height;
    if(!Number.isFinite(start)||!Number.isFinite(span))continue;
    entries.push({value:start,order:i*3});
    entries.push({value:start+span/2,order:i*3+1});
    entries.push({value:start+span,order:i*3+2});
  }
  entries.sort((a,b)=>a.value-b.value||a.order-b.order);
  const positions:number[]=[],orders:number[]=[];
  // Identical guide coordinates only need their earliest encounter.
  for(const entry of entries){
    if(entry.value===positions[positions.length-1])continue;
    positions.push(entry.value);
    orders.push(entry.order);
  }
  return {positions,orders};
};

export function buildBoardDragSnapIndex(others:readonly BoardDragBounds[]):BoardDragSnapIndex{
  return {x:axisIndex(others,true),y:axisIndex(others,false)};
}

function lowerBound(values:readonly number[],target:number):number{
  let lo=0,hi=values.length;
  while(lo<hi){
    const mid=(lo+hi)>>>1;
    if(values[mid]<target)lo=mid+1;
    else hi=mid;
  }
  return lo;
}

function nearestAxis(
  sourceStart:number,sourceSpan:number,rawDelta:number,
  threshold:number,index:AxisIndex
):{delta:number;guide?:number}{
  let best=threshold+1,rank=Infinity,guide:number|undefined;
  const values=index.positions,orders=index.orders;
  const anchors=[sourceStart,sourceStart+sourceSpan/2,sourceStart+sourceSpan];
  for(let source=0;source<3;source++){
    const desired=anchors[source]+rawDelta;
    const slot=lowerBound(values,desired);
    for(const candidate of [slot-1,slot]){
      if(candidate<0||candidate>=values.length)continue;
      const value=values[candidate],distance=Math.abs(value-desired);
      // In the old nested loops target-order came after source-order.
      const targetOrder=orders[candidate];
      const originalRank=Math.floor(targetOrder/3)*9+source*3+targetOrder%3;
      if(distance<=threshold&&(distance<best||distance===best&&originalRank<rank)){
        best=distance;rank=originalRank;guide=value;
      }
    }
  }
  return guide===undefined?{delta:rawDelta}:{delta:rawDelta+guide-(anchors[Math.floor(rank%9/3)]+rawDelta),guide};
}

/** Drop-in equivalent of scanning every other object for alignment guides. */
export function snapBoardDrag(
  moving:BoardDragBounds,index:BoardDragSnapIndex,
  rawDx:number,rawDy:number,threshold:number
):{dx:number;dy:number;guides:BoardDragGuideState}{
  const x=nearestAxis(moving.x,moving.width,rawDx,threshold,index.x);
  const y=nearestAxis(moving.y,moving.height,rawDy,threshold,index.y);
  return {dx:x.delta,dy:y.delta,guides:{x:x.guide,y:y.guide}};
}
