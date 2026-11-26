import {stroke,type Item,type Point} from "./boardModel";
import {makeStickerInk} from "./stickerInk";

export const DURABLE_INK_SYNC_MS=180;
export type InkIdentity={id:string;stickerId?:string};
export type InkStyle={id:string;kind:"pen"|"marker";color:string;weight:number};
export function hasDurableInk(items:readonly Item[],identity:InkIdentity):boolean{
 return identity.stickerId?
  !!items.find(i=>i.id===identity.stickerId)?.stickerInk?.some(i=>i.id===identity.id):
  items.some(i=>i.id===identity.id);
}
export function removeDurableInk(items:Item[],identity:InkIdentity):Item[]{
 if(!hasDurableInk(items,identity))return items;
 return identity.stickerId?items.map(i=>i.id===identity.stickerId?
  {...i,stickerInk:i.stickerInk!.filter(s=>s.id!==identity.id)}:i):
  items.filter(i=>i.id!==identity.id);
}
/** All samples update the same ordinary document object. No remote preview,
 * expiration timer or replacement ID exists. Never call after peer deletion. */
export function writeDurableInk(items:Item[],ink:InkStyle,path:Point[],zoom:number,author:string,stickerId?:string):Item[]{
 if(!path.length)return items;
 if(stickerId){
  const sticker=items.find(i=>i.id===stickerId&&i.kind==="sticky");
  if(!sticker)return items;
  const next=makeStickerInk(sticker,ink,path,zoom);
  const previous=sticker.stickerInk??[];
  const attached=previous.some(s=>s.id===ink.id)?previous.map(s=>s.id===ink.id?next:s):[...previous,next];
  return items.map(i=>i===sticker?{...i,stickerInk:attached}:i);
 }
 const next={...stroke(ink.id,ink.kind,path,ink.color,ink.weight,zoom),createdBy:author};
 return items.some(i=>i.id===ink.id)?items.map(i=>i.id===ink.id?next:i):[...items,next];
}
export function peerRemovedDurableInk(base:readonly Item[],remote:readonly Item[],identity:InkIdentity):boolean{
 return (identity.stickerId!==undefined&&base.some(i=>i.id===identity.stickerId)&&!remote.some(i=>i.id===identity.stickerId))||
  (hasDurableInk(base,identity)&&!hasDurableInk(remote,identity));
}
