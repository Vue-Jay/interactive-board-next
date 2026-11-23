import { simplifyStrokePath, stroke, type Item, type Point, type StickerInk } from "./boardModel";
import { eraseInkAlongPath, type EraserMode } from "./inkEraser";

/** Undo the object's rotation before converting to sticker-local coordinates. */
export function stickerLocalPoint(item: Item, p: Point): Point {
  const dx=p.x-item.x-item.width/2, dy=p.y-item.y-item.height/2;
  const angle=-(item.rotation??0)*Math.PI/180, c=Math.cos(angle), s=Math.sin(angle);
  return {x:dx*c-dy*s+item.width/2,y:dx*s+dy*c+item.height/2};
}

export function stickerAt(items: readonly Item[], p: Point): Item | undefined {
  // Ink itself doesn't prevent drawing on the underlying card. Other opaque
  // objects above a card do, and frames are transparent background containers.
  for(let i=items.length-1;i>=0;i--){
    const item=items[i];
    if(item.hidden||["pen","marker","frame","connector"].includes(item.kind))continue;
    const local=stickerLocalPoint(item,p);
    if(local.x>=0&&local.x<=item.width&&local.y>=0&&local.y<=item.height)
      return item.kind==="sticky"?item:undefined;
  }
}

export function makeStickerInk(item: Item, ink: Omit<StickerInk,"points">, path: readonly Point[], zoom: number): StickerInk {
  return {...ink,weight:ink.weight/Math.min(item.width,item.height),
    points:simplifyStrokePath(path,zoom).map(p=>{
      const local=stickerLocalPoint(item,p);
      return {x:local.x/item.width,y:local.y/item.height};
    })};
}

export function stickerInkPixels(item: Item, ink: StickerInk) {
  return {weight:ink.weight*Math.min(item.width,item.height),
    points:ink.points.map(p=>({x:p.x*item.width,y:p.y*item.height}))};
}

/** Keep the original ink size when the paper itself is resized. Normalized
 * storage remains compatible with existing documents and older clients. */
export function resizeStickerInk(base: Item, next: Item, keepWorldPosition=false): Item {
  if(!base.stickerInk?.length||base.width===next.width&&base.height===next.height)return next;
  const origin=keepWorldPosition?stickerLocalPoint(next,{
    x:base.x+base.width/2-Math.cos((base.rotation??0)*Math.PI/180)*base.width/2+
      Math.sin((base.rotation??0)*Math.PI/180)*base.height/2,
    y:base.y+base.height/2-Math.sin((base.rotation??0)*Math.PI/180)*base.width/2-
      Math.cos((base.rotation??0)*Math.PI/180)*base.height/2
  }):{x:0,y:0};
  return {...next,stickerInk:base.stickerInk.map(ink=>{
    const pixels=stickerInkPixels(base,ink);
    return {...ink,weight:pixels.weight/Math.min(next.width,next.height),
      points:pixels.points.map(p=>({x:(p.x+origin.x)/next.width,y:(p.y+origin.y)/next.height}))};
  })};
}

/** Visual extent including ink beyond the paper. Do not use this for resize
 * handles or for determining the surface on which a new stroke starts. */
export function stickerVisualBounds(item: Item) {
  const angle=(item.rotation??0)*Math.PI/180,c=Math.cos(angle),s=Math.sin(angle);
  const cx=item.x+item.width/2,cy=item.y+item.height/2;
  const halfW=(Math.abs(c)*item.width+Math.abs(s)*item.height)/2;
  const halfH=(Math.abs(s)*item.width+Math.abs(c)*item.height)/2;
  let left=cx-halfW,right=cx+halfW,top=cy-halfH,bottom=cy+halfH;
  for(const ink of item.stickerInk??[]){
    const radius=ink.weight*Math.min(item.width,item.height)/2;
    for(const point of ink.points){
      const dx=point.x*item.width-item.width/2,dy=point.y*item.height-item.height/2;
      const x=cx+dx*c-dy*s,y=cy+dx*s+dy*c;
      left=Math.min(left,x-radius);right=Math.max(right,x+radius);
      top=Math.min(top,y-radius);bottom=Math.max(bottom,y+radius);
    }
  }
  return {x:left,y:top,width:right-left,height:bottom-top,rotation:0};
}

/** Apply the ordinary partial-stroke eraser in the sticker's own geometry. */
export function eraseStickerInk(item: Item, path: Point[], radius: number, mode:EraserMode="partial"): Item {
  if(!item.stickerInk?.length)return item;
  const localPath=path.map(p=>stickerLocalPoint(item,p));
  const strokes=item.stickerInk.map(ink=>{
    const pixels=stickerInkPixels(item,ink);
    return stroke(ink.id,ink.kind,pixels.points,ink.color,pixels.weight,8);
  });
  const fragments=eraseInkAlongPath(strokes,localPath,radius,()=>true,mode);
  if(fragments===strokes)return item;
  const originals=new Map(strokes.map((s,i)=>[s,item.stickerInk![i]]));
  return {...item,stickerInk:fragments.map(fragment=>originals.get(fragment)??{
    id:fragment.id,kind:fragment.kind as "pen"|"marker",color:fragment.color!,
    weight:fragment.weight!/Math.min(item.width,item.height),
    points:fragment.points!.map(p=>({x:(p.x+fragment.x)/item.width,y:(p.y+fragment.y)/item.height})),
  })};
}
