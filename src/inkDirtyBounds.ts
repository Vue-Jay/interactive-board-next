import type { Item } from "./boardModel";

export type InkDirtyBounds={left:number;top:number;right:number;bottom:number};
export function changedInkBounds(before:Item|undefined,after:Item|undefined,zoom:number):InkDirtyBounds|null{
  if(before===after)return null;
  let left=Infinity,top=Infinity,right=-Infinity,bottom=-Infinity;
  const include=(x:number,y:number,pad:number)=>{
    left=Math.min(left,x-pad);top=Math.min(top,y-pad);
    right=Math.max(right,x+pad);bottom=Math.max(bottom,y+pad);
  };
  const full=(item:Item|undefined)=>{
    if(!item||item.hidden)return;
    const pad=(item.weight??3)/2+3/zoom;
    include(item.x,item.y,pad);include(item.x+item.width,item.y+item.height,pad);
  };
  // Compare world coordinates, not bounding-box-relative points: expanding a
  // stroke towards the left can translate every saved local coordinate.
  // The predecessor point is included for the old/new round cap and join.
  if(before&&after&&before.id===after.id&&!before.hidden&&!after.hidden&&
    !before.rotation&&!after.rotation&&before.kind===after.kind&&
    before.color===after.color&&before.weight===after.weight&&
    before.points?.length&&after.points?.length){
    const a=before.points,b=after.points;
    let prefix=0;
    while(prefix<Math.min(a.length,b.length)&&
      Math.abs(before.x+a[prefix].x-after.x-b[prefix].x)<1e-8&&
      Math.abs(before.y+a[prefix].y-after.y-b[prefix].y)<1e-8)prefix++;
    if(prefix===a.length&&prefix===b.length)return null;
    const pad=(after.weight??3)/2+3/zoom;
    for(let i=Math.max(0,prefix-1);i<a.length;i++)include(before.x+a[i].x,before.y+a[i].y,pad);
    for(let i=Math.max(0,prefix-1);i<b.length;i++)include(after.x+b[i].x,after.y+b[i].y,pad);
  }else{full(before);full(after)}
  return Number.isFinite(left)?{left,top,right,bottom}:null;
}
