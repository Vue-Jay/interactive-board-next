import type {Item} from "./boardModel";

/**
 * An operation belongs to the viewer who COMMITTED it, not to the author
 * of every affected object. Students are allowed to move a teacher's
 * unlocked object and erase shared ink, but Undo must never roll back a
 * separate participant's later changes.
 */
export type PersonalBoardEdit={before:Item[];after:Item[];beforeOrder?:string[];afterOrder?:string[]};
const same=(a:unknown,b:unknown)=>a===b||JSON.stringify(a)===JSON.stringify(b);

export function personalBoardEdit(before:readonly Item[],after:readonly Item[]):PersonalBoardEdit|null{
 const old=new Map(before.map(item=>[item.id,item]));
 const next=new Map(after.map(item=>[item.id,item]));
 const touched=new Set<string>();
 for(const [id,item] of old)if(!same(item,next.get(id)))touched.add(id);
 for(const [id,item] of next)if(!same(item,old.get(id)))touched.add(id);
 const beforeOrder=before.filter(item=>next.has(item.id)).map(item=>item.id);
 const afterOrder=after.filter(item=>old.has(item.id)).map(item=>item.id);
 const reordered=!same(beforeOrder,afterOrder);
 if(!touched.size&&!reordered)return null;
 return {
  before:before.filter(item=>touched.has(item.id)),
  after:after.filter(item=>touched.has(item.id)),
  ...(reordered?{beforeOrder,afterOrder}:{}),
 };
}

export function applyPersonalBoardEdit(
 current:readonly Item[],edit:PersonalBoardEdit,direction:"undo"|"redo"
):{items:Item[];changed:boolean;conflicts:number}{
 const expected=direction==="undo"?edit.after:edit.before;
 const desired=direction==="undo"?edit.before:edit.after;
 const expectedById=new Map(expected.map(item=>[item.id,item]));
 const desiredById=new Map(desired.map(item=>[item.id,item]));
 const currentById=new Map(current.map(item=>[item.id,item]));
 const ids=new Set([...expectedById.keys(),...desiredById.keys()]);
 const changes=new Map<string,Item|null>();
 let conflicts=0;
 for(const id of ids){
  const old=expectedById.get(id),target=desiredById.get(id),live=currentById.get(id);
  if(!old&&target){
   // Undo of this user's deletion or redo of this user's insertion.
   // Never replace an independently resurrected/created item with this ID.
   if(live){conflicts++;continue;}
   changes.set(id,target);continue;
  }
  if(old&&!target){
   // A peer has since edited the item: that work must NOT disappear.
   if(!live||!same(live,old)){conflicts++;continue;}
   changes.set(id,null);continue;
  }
  if(!old||!target)continue;
  if(!live){conflicts++;continue;}
  const next={...live} as Record<string,unknown>;
  const was=old as unknown as Record<string,unknown>;
  const to=target as unknown as Record<string,unknown>;
  let changed=false;
  for(const field of new Set([...Object.keys(was),...Object.keys(to)])){
   if(field==="id"||field==="createdBy"||same(was[field],to[field]))continue;
   if(!same(next[field],was[field])){conflicts++;continue;}
   if(Object.hasOwn(to,field))next[field]=to[field];
   else delete next[field];
   changed=true;
  }
  if(changed)changes.set(id,next as unknown as Item);
 }
 const result:Item[]=[];
 for(const item of current){
  if(!changes.has(item.id)){result.push(item);continue;}
  const replacement=changes.get(item.id);
  if(replacement)result.push(replacement);
 }
 // A restored stroke/object is inserted without touching the stacking order
 // of any surviving collaborator object.
 for(const item of desired)if(changes.get(item.id)===item&&!currentById.has(item.id))
  result.push(item);
 const expectedOrder=direction==="undo"?edit.afterOrder:edit.beforeOrder;
 const desiredOrder=direction==="undo"?edit.beforeOrder:edit.afterOrder;
 let reordered=false;
 if(expectedOrder&&desiredOrder){
  const byId=new Map(result.map(item=>[item.id,item]));
  const shared=new Set(expectedOrder.filter(id=>byId.has(id)));
  const expectedSurvivors=expectedOrder.filter(id=>shared.has(id));
  const targetSurvivors=desiredOrder.filter(id=>shared.has(id));
  const liveOrder=result.filter(item=>shared.has(item.id)).map(item=>item.id);
  if(!same(liveOrder,expectedSurvivors))conflicts++;
  else if(!same(liveOrder,targetSurvivors)){
   let index=0;
   for(let i=0;i<result.length;i++)if(shared.has(result[i].id))result[i]=byId.get(targetSurvivors[index++])!;
   reordered=true;
  }
 }
 const changed=changes.size>0||reordered;
 return {items:changed?result:current as Item[],changed,conflicts};
}

/** A newly restored shared stroke is a new write by the undoing participant.
 * Keep its ID and geometry, attribute the insertion to that participant, and
 * update the history entry so redo still compares against the actual object.
 * Do not reattribute any existing object or anyone else's surviving ink. */
export function reattributeRestoredSharedInk(
 current:readonly Item[],items:Item[],edit:PersonalBoardEdit,actorId:string
):{items:Item[];edit:PersonalBoardEdit}{
 const present=new Set(current.map(item=>item.id));
 const restored=new Map<string,Item>();
 const next=items.map(item=>{
  if(present.has(item.id)||!(item.kind==="pen"||item.kind==="marker")||item.createdBy===actorId)return item;
  const owned={...item,createdBy:actorId};
  restored.set(item.id,owned);return owned;
 });
 if(!restored.size)return {items,edit};
 return {items:next,edit:{...edit,before:edit.before.map(item=>restored.get(item.id)??item),
                         after:edit.after.map(item=>restored.get(item.id)??item)}};
}
