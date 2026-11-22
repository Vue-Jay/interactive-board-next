import { simplifyStrokePath, stroke, type Item, type Point, type StickerInk } from "./boardModel";
import { eraseInkAlongPath } from "./inkEraser";

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

/** Split a continuous pointer path at the actual (possibly rotated) paper
 * boundary, even when a single pointer sample jumps across the whole card. */
export function splitStickerPath(item: Item, path: readonly Point[]) {
  const pieces:{inside:boolean;points:Point[]}[]=[];
  const local=path.map(p=>stickerLocalPoint(item,p));
  const inside=(p:Point)=>p.x>=0&&p.x<=item.width&&p.y>=0&&p.y<=item.height;
  if(path.length===1)return [{inside:inside(local[0]),points:[path[0]]}];
  const add=(onCard:boolean,a:Point,b:Point)=>{
    const last=pieces[pieces.length-1];
    if(last?.inside===onCard)last.points.push(b);
    else pieces.push({inside:onCard,points:[a,b]});
  };
  for(let i=1;i<path.length;i++){
    const a=local[i-1],b=local[i],dx=b.x-a.x,dy=b.y-a.y;
    const ts=[0,1];
    for(const [start,delta,limit] of [[a.x,dx,item.width],[a.y,dy,item.height]]){
      if(Math.abs(delta)<1e-9)continue;
      for(const edge of [0,limit]){
        const t=(edge-start)/delta;
        if(t>0&&t<1)ts.push(t);
      }
    }
    ts.sort((a,b)=>a-b);
    const at=(t:number)=>({x:path[i-1].x+(path[i].x-path[i-1].x)*t,y:path[i-1].y+(path[i].y-path[i-1].y)*t});
    for(let j=1;j<ts.length;j++){
      if(ts[j]-ts[j-1]<1e-9)continue;
      const mid=(ts[j]+ts[j-1])/2;
      add(inside({x:a.x+dx*mid,y:a.y+dy*mid}),at(ts[j-1]),at(ts[j]));
    }
  }
  return pieces;
}

/** Apply the ordinary partial-stroke eraser in the sticker's own geometry. */
export function eraseStickerInk(item: Item, path: Point[], radius: number): Item {
  if(!item.stickerInk?.length)return item;
  const localPath=path.map(p=>stickerLocalPoint(item,p));
  const strokes=item.stickerInk.map(ink=>{
    const pixels=stickerInkPixels(item,ink);
    return stroke(ink.id,ink.kind,pixels.points,ink.color,pixels.weight,8);
  });
  const fragments=eraseInkAlongPath(strokes,localPath,radius);
  if(fragments===strokes)return item;
  const originals=new Map(strokes.map((s,i)=>[s,item.stickerInk![i]]));
  return {...item,stickerInk:fragments.map(fragment=>originals.get(fragment)??{
    id:fragment.id,kind:fragment.kind as "pen"|"marker",color:fragment.color!,
    weight:fragment.weight!/Math.min(item.width,item.height),
    points:fragment.points!.map(p=>({x:(p.x+fragment.x)/item.width,y:(p.y+fragment.y)/item.height})),
  })};
}
