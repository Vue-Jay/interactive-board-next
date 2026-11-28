import type {Item} from "./boardModel";

/**
 * An operation belongs to the viewer who COMMITTED it, not to the author
 * of every affected object. Students are allowed to move a teacher's
 * unlocked object and erase shared ink, but Undo must never roll back a
 * separate participant's later changes.
 */
export type PersonalBoardEdit={before:Item[];after:Item[];beforeOrder?:string[];afterOrder?:string[]};
const record=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==="object"&&!Array.isArray(v);
// JSONB and the board parser reorder keys. Equality must describe content,
// including nested point objects, not the insertion order of properties.
const same=(a:unknown,b:unknown):boolean=>{
 if(a===b)return true;
 if(Array.isArray(a)&&Array.isArray(b))return a.length===b.length&&a.every((v,i)=>same(v,b[i]));
 if(!record(a)||!record(b))return false;
 const keys=Object.keys(a).filter(k=>a[k]!==undefined);
 const other=Object.keys(b).filter(k=>b[k]!==undefined);
 return keys.length===other.length&&keys.every(k=>Object.hasOwn(b,k)&&same(a[k],b[k]));
};
type Identified=Record<string,unknown>&{id:string};
const idList=(v:unknown):v is Identified[]=>Array.isArray(v)&&v.every(x=>record(x)&&typeof x.id==="string"&&!!x.id)&&new Set(v.map(x=>x.id)).size===v.length;
type InverseResult={value:unknown;changed:boolean;conflicts:number};

// Compare against what this participant actually wrote, recursively. An
// independent edit to a peer's sticker stroke, atlas mark or circuit element
// must not block undo of our own element or be reverted by it.
function inverseValue(expected:unknown,desired:unknown,live:unknown):InverseResult{
 if(same(expected,desired))return {value:live,changed:false,conflicts:0};
 if(same(expected,live))return {value:desired,changed:true,conflicts:0};
 if(record(expected)&&record(desired)&&record(live)){
  const result={...live};let changed=false,conflicts=0;
  // Assignment answers must be undone as a coherent unit and only against
  // the original source. A later peer edit to one response field must not
  // leave a mixture of the old answer and a new exercise.
  const grouped=new Set<string>();
  if(expected.kind===desired.kind&&expected.kind===live.kind){
   const kind=expected.kind;
   const source=kind==="sentence-builder"?["parts"]:kind==="geo-training"?["exercise","relation","reverse","countryCodes"]:
     kind==="flashcards"?["cards","direction"]:kind==="orthography"?["questions"]:kind==="place-value"?["base"]:[];
   const answer=kind==="sentence-builder"?["answerOrder","answerChecked"]:kind==="geo-training"?["practice"]:
     kind==="flashcards"||kind==="orthography"?["response"]:kind==="place-value"?["digits"]:[];
   if(source.length&&answer.length){
    const keys=[...source,...answer];keys.forEach(k=>grouped.add(k));
    if(keys.some(k=>!same(expected[k],desired[k]))){
     if(keys.every(k=>same(expected[k],live[k]))){
      for(const k of keys)if(!same(expected[k],desired[k])){
       if(desired[k]===undefined)delete result[k];else result[k]=desired[k];
       changed=true;
      }
     }else conflicts++;
    }
   }
   // Syntax words carry both teacher text and pupil role. Independent
   // markings may still undo independently, but not across a replaced word.
   if(kind==="syntax"&&Array.isArray(expected.words)&&Array.isArray(desired.words)&&Array.isArray(live.words)&&
      expected.words.every(record)&&desired.words.every(record)&&live.words.every(record)){
    const sourceOf=(words:Record<string,unknown>[])=>words.map(w=>[w.id,w.text]);
    if(!same(sourceOf(expected.words),sourceOf(desired.words))||!same(sourceOf(expected.words),sourceOf(live.words))){
     grouped.add("words");
     if(!same(expected.words,desired.words)){
      if(same(expected.words,live.words)){result.words=desired.words;changed=true;}
      else conflicts++;
     }
    }
   }
  }
  for(const key of new Set([...Object.keys(expected),...Object.keys(desired)])){
   if(grouped.has(key))continue;
   if(key==="id"||key==="createdBy"||key==="__proto__"||key==="constructor"||key==="prototype")continue;
   const next=inverseValue(expected[key],desired[key],live[key]);
   conflicts+=next.conflicts;
   if(!next.changed)continue;
   if(next.value!==undefined||Object.hasOwn(desired,key))result[key]=next.value;else delete result[key];
   changed=true;
  }
  return {value:changed?result:live,changed,conflicts};
 }
 const expectedList=expected===undefined?[]:expected;
 const desiredList=desired===undefined?[]:desired;
 if(idList(expectedList)&&idList(desiredList)&&idList(live)){
  const old=new Map(expectedList.map(x=>[x.id,x])),target=new Map(desiredList.map(x=>[x.id,x]));
  const result=new Map(live.map(x=>[x.id,x]));
  let changed=false,conflicts=0;
  for(const id of new Set([...old.keys(),...target.keys()])){
   const next=inverseValue(old.get(id),target.get(id),result.get(id));
   conflicts+=next.conflicts;
   if(!next.changed)continue;
   if(next.value===undefined)result.delete(id);else result.set(id,next.value as Identified);
   changed=true;
  }
  // Stable IDs permit independent additions/deletions. Preserve live slots;
  // never impose an obsolete array order on a collaborator's new element.
  const shared=new Set(expectedList.filter(x=>target.has(x.id)&&result.has(x.id)).map(x=>x.id));
  const oldOrder=expectedList.filter(x=>shared.has(x.id)).map(x=>x.id);
  const nextOrder=desiredList.filter(x=>shared.has(x.id)).map(x=>x.id);
  const items=[...result.values()];
  if(!same(oldOrder,nextOrder)){
   const liveOrder=items.filter(x=>shared.has(x.id)).map(x=>x.id);
   if(!same(liveOrder,oldOrder))conflicts++;
   else{
    let index=0;
    for(let i=0;i<items.length;i++)if(shared.has(items[i].id))items[i]=result.get(nextOrder[index++])!;
    changed=true;
   }
  }
  return {value:changed?(desired===undefined&&!items.length?undefined:items):live,changed,conflicts};
 }
 // Positional arrays (including pen geometry and non-ID graph vertices)
 // cannot safely be merged when another participant changed their structure.
 return {value:live,changed:false,conflicts:1};
}

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
 current:readonly Item[],edit:PersonalBoardEdit,direction:"undo"|"redo",
 canonicalize?:(item:Item)=>Item
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
  const rawOld=expectedById.get(id),rawTarget=desiredById.get(id),rawLive=currentById.get(id);
  // Locally created objects may omit defaults added by the validated server
  // parser. Compare the same representation for touched IDs only.
  const normalize=(item:Item|undefined)=>item&&canonicalize?canonicalize(item):item;
  const old=normalize(rawOld),target=normalize(rawTarget),live=normalize(rawLive);
  if(!old&&target){
   // Undo of this user's deletion or redo of this user's insertion.
   // Never replace an independently resurrected/created item with this ID.
   if(live){conflicts++;continue;}
   changes.set(id,rawTarget!);continue;
  }
  if(old&&!target){
   // A peer has since edited the item: that work must NOT disappear.
   if(!live||!same(live,old)){conflicts++;continue;}
   changes.set(id,null);continue;
  }
  if(!old||!target)continue;
  if(!live){conflicts++;continue;}
  const next={...rawLive} as Record<string,unknown>;
  const comparison=live as unknown as Record<string,unknown>;
  const was=old as unknown as Record<string,unknown>;
  const to=target as unknown as Record<string,unknown>;
  let changed=false;
  for(const field of new Set([...Object.keys(was),...Object.keys(to)])){
   if(field==="id"||field==="createdBy"||same(was[field],to[field]))continue;
   const inverse=inverseValue(was[field],to[field],comparison[field]);
   conflicts+=inverse.conflicts;
   if(!inverse.changed)continue;
   if(inverse.value!==undefined||Object.hasOwn(to,field))next[field]=inverse.value;
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

/** Typing checkpoints can be persisted before the user leaves the editor.
 * Track the local action separately from the mutable acknowledged board. */
export type TextEditSession={id:string;before:string;draft:string;changed:boolean};
export function beginTextEdit(id:string,text:string):TextEditSession{
 return {id,before:text,draft:text,changed:false};
}
export function updateTextEdit(session:TextEditSession,text:string):TextEditSession{
 return {...session,draft:text,changed:session.changed||text!==session.draft};
}
export function rebaseTextEdit(session:TextEditSession,acknowledged:string|undefined,remote:string,merged:string):TextEditSession{
 // A genuinely new peer value either supersedes our already saved typing,
 // or becomes the base under an outstanding local text change. An unrelated
 // revision merely echoing our text checkpoint must not erase the undo step.
 if(remote!==acknowledged&&remote!==session.draft)
  return {...session,before:remote,draft:merged,changed:merged!==remote};
 return {...session,draft:merged};
}
