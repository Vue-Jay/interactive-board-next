/** Small, deterministic geometry identity for transient peer transforms.
 * A preview is valid only against the exact object it started from. This
 * rejects late packets arriving after a newer authoritative document, without
 * needing to compare unsynchronized client clocks.
 */
export type ObjectPoseGeometry={
 x:number;y:number;width:number;height:number;rotation?:number
};
const rounded=(value:number)=>Number(value.toFixed(3));
export function objectPoseOrigin(geometry:ObjectPoseGeometry):string{
 return [
  geometry.x,geometry.y,geometry.width,geometry.height,geometry.rotation??0
 ].map(rounded).join(",");
}
export function objectPoseMatches(a:ObjectPoseGeometry,b:ObjectPoseGeometry):boolean{
 return Math.abs(a.x-b.x)<.001&&Math.abs(a.y-b.y)<.001&&
  Math.abs(a.width-b.width)<.001&&Math.abs(a.height-b.height)<.001&&
  Math.abs((a.rotation??0)-(b.rotation??0))<.001;
}

/** Keep only the latest index; histories may retain hundreds of older item
 * arrays, so a WeakMap of every revision would retain those indexes too.
 * Board items are replaced immutably, including local gesture commits. */
export function createCurrentItemIndex<T extends {id:string}>(){
 let source:readonly T[]|undefined;
 let index:ReadonlyMap<string,T>=new Map();
 return (items:readonly T[])=>{
  if(items!==source){source=items;index=new Map(items.map(item=>[item.id,item]))}
  return index;
 };
}
