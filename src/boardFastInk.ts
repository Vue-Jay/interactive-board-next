import type {Item} from "./boardModel";
import {stableJsonHash} from "./boardSync";

export type FastInkItemChange={id:string;before:Item|null;after:Item|null;nextId?:string};
const isInk=(item:Item)=>item.kind==="pen"||item.kind==="marker";
const same=(a:Item,b:Item)=>a===b||stableJsonHash(a)===stableJsonHash(b);

/** The regular board renderer sees one object per ID. A fast frame never
 * mutates the committed snapshot, saves peer geometry or creates another
 * canvas. A local edit to the same ID takes precedence over a pending frame.
 * Existing-only mode gives the eraser the latest visible geometry of an
 * already committed ID, preserving its authoritative ownership/permissions. */
export function projectFastInkItems(items:Item[],changes:FastInkItemChange[],existingOnly=false):Item[]{
 if(!changes.length)return items;
 const updates=new Map(changes.map(change=>[change.id,change]));
 const ids=new Set(items.map(item=>item.id));
 let changed=false;
 const result:Item[]=[];
 for(const item of items){
   const entry=updates.get(item.id);
   // An eraser must visually win even against a writer's newer local tail of
   // the same ID. Only the confirmed revision may interrupt/persist that edit.
   if(!existingOnly&&entry?.before&&!entry.after&&isInk(item)&&isInk(entry.before)&&
      item.kind===entry.before.kind&&item.createdBy===entry.before.createdBy){
     changed=true;continue;
   }
   if(!entry?.before||!same(item,entry.before)){result.push(item);continue;}
   if(existingOnly){
     const after=entry.after;
     if(after&&isInk(item)&&after.kind===item.kind){
       result.push({...item,x:after.x,y:after.y,width:after.width,height:after.height,points:after.points});
       changed=true;
     }else if(after&&item.kind==="sticky"&&after.kind==="sticky"){
       result.push({...item,stickerInk:after.stickerInk});changed=true;
     }else result.push(item);
   }else{
     if(entry.after)result.push(entry.after);
     changed=true;
   }
 }
 if(!existingOnly){
   // Reverse insertion preserves the exact order of newly cut fragments.
   for(let i=changes.length-1;i>=0;i--){
     const entry=changes[i];
     if(entry.before||!entry.after||ids.has(entry.id))continue;
     const next=entry.nextId?result.findIndex(item=>item.id===entry.nextId):-1;
     result.splice(next<0?result.length:next,0,entry.after);
     ids.add(entry.id);changed=true;
   }
 }
 return changed?result:items;
}

/** Only the locally erased objects can enter the next durable save. Never
 * accidentally save untouched pending geometry from another participant. */
export function restoreUntouchedFastInk(original:Item[],input:Item[],changed:Item[]):Item[]{
 if(original===input)return changed;
 const stored=new Map(original.map(item=>[item.id,item]));
 const visible=new Map(input.map(item=>[item.id,item]));
 return changed.map(item=>item===visible.get(item.id)?stored.get(item.id)??item:item);
}
