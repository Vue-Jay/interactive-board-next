/** Compositor-only rigid rotation of a selection.
 * No React model changes occur while the pointer is held; at release,
 * the exact same geometry is materialized in one board commit.
 */
export type GroupRotationItem={
 id:string;kind:string;x:number;y:number;width:number;height:number;rotation?:number;
 connectorStartBinding?:{itemId:string}|null;
 connectorEndBinding?:{itemId:string}|null;
};
export type GroupRotationBounds={x:number;y:number;width:number;height:number};
export type GroupRotationView={x:number;y:number;zoom:number};
export type GroupRotationStyle={
 translate:string;rotate:string;left:string;top:string;width:string;height:string;
};
export type GroupRotationTarget<T extends GroupRotationItem>={
 base:T;element:{style:Pick<GroupRotationStyle,"translate"|"rotate">};
};

/** A partly or fully attached arrow needs anchor recomputation. Ink and
 * instruments use a different painting pipeline and must keep their own path.
 */
export function canCompositeGroupRotation<T extends GroupRotationItem>(
 items:readonly T[],ids:ReadonlySet<string>,
):boolean{
 if(ids.size<2||ids.size>64)return false;
 let found=0;
 for(const item of items){
  if(ids.has(item.id)){
   found++;
   if(item.kind==="connector"||item.kind==="pen"||
      item.kind==="marker"||item.kind==="instrument")return false;
  }
  if(item.kind==="connector"&&(
    item.connectorStartBinding&&ids.has(item.connectorStartBinding.itemId)||
    item.connectorEndBinding&&ids.has(item.connectorEndBinding.itemId)))return false;
 }
 return found===ids.size;
}

/** Identical world coordinates to the ordinary group-rotate gesture in App.
 * Rotation is computed relative to item centers, never to the board origin.
 */
export function rotatedGroupItems<T extends GroupRotationItem>(
 bases:readonly T[],bounds:GroupRotationBounds,delta:number,
):T[]{
 const cx=bounds.x+bounds.width/2,cy=bounds.y+bounds.height/2;
 const rad=delta*Math.PI/180,cos=Math.cos(rad),sin=Math.sin(rad);
 return bases.map(base=>{
  const bx=base.x+base.width/2-cx,by=base.y+base.height/2-cy;
  const x=cx+bx*cos-by*sin-base.width/2;
  const y=cy+bx*sin+by*cos-base.height/2;
  return {...base,x,y,rotation:(base.rotation??0)+delta};
 });
}

export function groupRotationBounds<T extends GroupRotationItem>(
 items:readonly T[],
):GroupRotationBounds{
 let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
 for(const item of items){
  minX=Math.min(minX,item.x);minY=Math.min(minY,item.y);
  maxX=Math.max(maxX,item.x+item.width);
  maxY=Math.max(maxY,item.y+item.height);
 }
 return {x:minX,y:minY,width:maxX-minX,height:maxY-minY};
}

export function paintGroupRotationFrame<T extends GroupRotationItem>(
 targets:readonly GroupRotationTarget<T>[],
 poses:readonly T[],delta:number,
 frame:{style:Pick<GroupRotationStyle,"left"|"top"|"width"|"height">},
 view:GroupRotationView,
):void{
 for(let i=0;i<targets.length;i++){
  const {base,element}=targets[i],pose=poses[i];
  element.style.translate=`${pose.x-base.x}px ${pose.y-base.y}px`;
  element.style.rotate=`${delta}deg`;
 }
 // The group handles show the same axis-aligned bounds as the authoritative
 // React renderer, instead of being stranded at their pre-rotation position.
 const b=groupRotationBounds(poses);
 frame.style.left=`${b.x*view.zoom+view.x}px`;
 frame.style.top=`${b.y*view.zoom+view.y}px`;
 frame.style.width=`${b.width*view.zoom}px`;
 frame.style.height=`${b.height*view.zoom}px`;
}

export function clearGroupRotationFrame<T extends GroupRotationItem>(
 targets:readonly GroupRotationTarget<T>[],
):void{
 for(const {element} of targets){
  element.style.translate="";
  element.style.rotate="";
 }
}
