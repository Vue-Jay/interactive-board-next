import type { Item } from "./boardModel";

export type BoardPoint = { x:number; y:number };
export type SelectionRect = { x:number; y:number; width:number; height:number };
export function normalizeSelectionRect(a:BoardPoint,b:BoardPoint):SelectionRect {
  return {x:Math.min(a.x,b.x),y:Math.min(a.y,b.y),
    width:Math.abs(a.x-b.x),height:Math.abs(a.y-b.y)};
}
function overlaps(a:SelectionRect,b:SelectionRect):boolean{
  return a.x<=b.x+b.width && a.x+a.width>=b.x &&
    a.y<=b.y+b.height && a.y+a.height>=b.y;
}
function contains(box:SelectionRect,p:BoardPoint):boolean{
  return p.x>=box.x && p.x<=box.x+box.width && p.y>=box.y && p.y<=box.y+box.height;
}
function crosses(a:BoardPoint,b:BoardPoint,c:BoardPoint,d:BoardPoint):boolean {
  const orient=(p:BoardPoint,q:BoardPoint,r:BoardPoint)=>
    (q.x-p.x)*(r.y-p.y)-(q.y-p.y)*(r.x-p.x);
  const one=orient(a,b,c),two=orient(a,b,d);
  const three=orient(c,d,a),four=orient(c,d,b);
  // Collinear/touching endpoints count as intersections.
  const within=(p:BoardPoint,q:BoardPoint,r:BoardPoint)=>
    q.x>=Math.min(p.x,r.x)-1e-7 && q.x<=Math.max(p.x,r.x)+1e-7 &&
    q.y>=Math.min(p.y,r.y)-1e-7 && q.y<=Math.max(p.y,r.y)+1e-7;
  if(Math.abs(one)<1e-7&&within(a,c,b))return true;
  if(Math.abs(two)<1e-7&&within(a,d,b))return true;
  if(Math.abs(three)<1e-7&&within(c,a,d))return true;
  if(Math.abs(four)<1e-7&&within(c,b,d))return true;
  return ((one>0)!==(two>0))&&((three>0)!==(four>0));
}
function segmentTouchesRect(a:BoardPoint,b:BoardPoint,r:SelectionRect):boolean {
  if(contains(r,a)||contains(r,b))return true;
  const tl={x:r.x,y:r.y},tr={x:r.x+r.width,y:r.y};
  const br={x:tr.x,y:r.y+r.height},bl={x:r.x,y:br.y};
  return crosses(a,b,tl,tr)||crosses(a,b,tr,br)||
    crosses(a,b,br,bl)||crosses(a,b,bl,tl);
}
export function itemIntersectsSelection(item:Item,selection:SelectionRect):boolean {
  if(item.hidden)return false;
  if((item.kind==="pen"||item.kind==="marker")&&item.points?.length){
    const points=item.points;
    const pad=Math.max(1,(item.weight??3)/2);
    const expanded={x:selection.x-pad,y:selection.y-pad,
      width:selection.width+2*pad,height:selection.height+2*pad};
    let previous={x:item.x+points[0].x,y:item.y+points[0].y};
    if(contains(expanded,previous))return true;
    for(let index=1;index<points.length;index++){
      const next={x:item.x+points[index].x,y:item.y+points[index].y};
      if(segmentTouchesRect(previous,next,expanded))return true;
      previous=next;
    }
    return false;
  }
  const w=Math.max(1,Math.abs(item.width)),h=Math.max(1,Math.abs(item.height));
  const angle=(item.rotation??0)*Math.PI/180;
  if(!angle)return overlaps(selection,{x:item.x,y:item.y,width:w,height:h});
  const center={x:item.x+w/2,y:item.y+h/2};
  const cos=Math.cos(angle),sin=Math.sin(angle);
  const corners=[[-w/2,-h/2],[w/2,-h/2],[w/2,h/2],[-w/2,h/2]].map(([dx,dy])=>
    ({x:center.x+dx*cos-dy*sin,y:center.y+dx*sin+dy*cos}));
  const rx=Math.min(...corners.map(p=>p.x)),ry=Math.min(...corners.map(p=>p.y));
  const right=Math.max(...corners.map(p=>p.x)),bottom=Math.max(...corners.map(p=>p.y));
  // Conservative rotated AABB. Prevents missing large objects and rotated frames.
  return overlaps(selection,{x:rx,y:ry,width:right-rx,height:bottom-ry});
}
export function itemsInsideRect(items:Item[],a:BoardPoint,b:BoardPoint):string[] {
  const region=normalizeSelectionRect(a,b);
  if(region.width<.1&&region.height<.1)return [];
  const matched=items.filter(item=>itemIntersectsSelection(item,region));
  const ids=new Set(matched.map(item=>item.id));
  const grouped=new Set(matched.map(item=>item.groupId).filter(Boolean));
  for(const item of items)if(!item.hidden&&item.groupId&&grouped.has(item.groupId))ids.add(item.id);
  return [...ids];
}
