import {simplifyStrokePath,stroke,type Item,type Point} from "./boardModel";
import {makeStickerInk} from "./stickerInk";

// At most 42 saves/second, below the server's 45/s ink limit. An
// outstanding ACK still coalesces newer samples through the version queue.
export const DURABLE_INK_SYNC_MS=24;
const CHUNK=48;
type PathState={zoom:number;sealed:Point[];offset:number;length:number;last?:Point};
const paths=new WeakMap<readonly Point[],PathState>();
/** Only simplify the changing tail. Completed chunks are immutable and
 * cannot jump as a long stroke grows; retain the real latest pointer sample. */
export function durableStrokePath(path:readonly Point[],zoom:number):Point[]{
  let state=paths.get(path);
  if(!state||state.zoom!==zoom||state.length>path.length||
     (state.length>0&&path[state.length-1]!==state.last)){
    state={zoom,sealed:[],offset:0,length:0};
    paths.set(path,state);
  }
  while(path.length-state.offset>CHUNK){
    const block=simplifyStrokePath(path.slice(state.offset,state.offset+CHUNK),zoom);
    state.sealed.push(...(state.sealed.length?block.slice(1):block));
    state.offset+=CHUNK-1;
  }
  state.length=path.length;
  state.last=path[path.length-1];
  const tail=simplifyStrokePath(path.slice(state.offset),zoom);
  return state.sealed.concat(state.sealed.length?tail.slice(1):tail);
}
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
 const reduced=durableStrokePath(path,zoom);
 if(stickerId){
  const sticker=items.find(i=>i.id===stickerId&&i.kind==="sticky");
  if(!sticker)return items;
  const next=makeStickerInk(sticker,ink,reduced,zoom,true);
  const previous=sticker.stickerInk??[];
  const attached=previous.some(s=>s.id===ink.id)?previous.map(s=>s.id===ink.id?next:s):[...previous,next];
  return items.map(i=>i===sticker?{...i,stickerInk:attached}:i);
 }
 const next={...stroke(ink.id,ink.kind,reduced,ink.color,ink.weight,zoom,true),createdBy:author};
 return items.some(i=>i.id===ink.id)?items.map(i=>i.id===ink.id?next:i):[...items,next];
}
export function peerRemovedDurableInk(base:readonly Item[],remote:readonly Item[],identity:InkIdentity):boolean{
 return (identity.stickerId!==undefined&&base.some(i=>i.id===identity.stickerId)&&!remote.some(i=>i.id===identity.stickerId))||
  (hasDurableInk(base,identity)&&!hasDurableInk(remote,identity));
}
