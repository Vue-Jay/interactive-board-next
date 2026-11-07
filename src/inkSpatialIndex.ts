import type { Item } from "./boardModel";

/** Spatial lookup for immutable ink batches. The Canvas renderer previously
 * tested every stroke on every new viewport tile, even if only a few occupied
 * the tile. Intervals are sorted by left edge with a prefix maximum right edge
 * to stop searching once no earlier stroke can intersect the viewport.
 * Output is restored to original z-order before drawing.
 */
type InkSpan={
  item:Item; order:number; left:number; right:number; top:number; bottom:number;
};
export type InkSpatialIndex={
  spans:InkSpan[];
  maxRightPrefix:number[];
};

export function indexInkStrokes(strokes:readonly Item[]):InkSpatialIndex{
  const spans:InkSpan[]=[];
  strokes.forEach((item,order)=>{
    if(item.hidden||!item.points?.length)return;
    const pad=(item.weight??3)/2;
    spans.push({item,order,left:item.x-pad,right:item.x+item.width+pad,
      top:item.y-pad,bottom:item.y+item.height+pad});
  });
  spans.sort((a,b)=>a.left-b.left||a.order-b.order);
  let furthest=-Infinity;
  const maxRightPrefix=spans.map(span=>{
    furthest=Math.max(furthest,span.right);
    return furthest;
  });
  return {spans,maxRightPrefix};
}

/** Same inclusion semantics as the previous Canvas bounding-box checks.
 * A candidate may still be rejected by Canvas' own pixel clip. */
export function queryInkStrokes(index:InkSpatialIndex,left:number,top:number,
  right:number,bottom:number):Item[]{
  if(right<=left||bottom<=top)return [];
  const {spans,maxRightPrefix}=index;
  let lo=0,hi=spans.length;
  // First interval whose left edge exceeds the visible right boundary.
  while(lo<hi){
    const mid=(lo+hi)>>>1;
    if(spans[mid].left<=right)lo=mid+1;
    else hi=mid;
  }
  const hits:InkSpan[]=[];
  for(let i=lo-1;i>=0&&maxRightPrefix[i]>=left;i--){
    const span=spans[i];
    if(span.right<left||span.bottom<top||span.top>bottom)continue;
    hits.push(span);
  }
  hits.sort((a,b)=>a.order-b.order);
  return hits.map(hit=>hit.item);
}
