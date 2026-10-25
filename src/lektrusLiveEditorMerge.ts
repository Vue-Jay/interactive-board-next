/** Three-way, field-level merge for collaborative geometry and contour editors.
 * Changed fields win, untouched fields retain the most recently received value.
 * Atlas marks/strokes have persistent IDs and can be concurrently added/edited.
 * Point-indexed geometry is merged conservatively: independent point moves are
 * combined, but structural deletions replace the affected collection.
 */
type Json=unknown;
const same=(a:unknown,b:unknown)=>a===b||JSON.stringify(a)===JSON.stringify(b);
const record=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==="object"&&!Array.isArray(v);
const isIdCollection=(values:unknown[],key:string)=>(
 ["contourMarks","contourStrokes"].includes(key)&&
 values.every(x=>record(x)&&typeof x.id==="string")
);
function mergeArray(base:unknown[],edit:unknown[],latest:unknown[],key:string):unknown[]{
 if(isIdCollection(base,key)&&isIdCollection(edit,key)&&isIdCollection(latest,key)){
  const before=new Map(base.map(v=>[(v as {id:string}).id,v]));
  const result=new Map(latest.map(v=>[(v as {id:string}).id,v]));
  for(const value of edit){
   const id=(value as {id:string}).id;
   const original=before.get(id);
   if(original===undefined){result.set(id,value);continue;}
   if(!same(original,value))result.set(id,mergeEditedValue(original,value,result.get(id)??original,key));
  }
  for(const [id] of before)if(!edit.some(v=>(v as {id:string}).id===id))result.delete(id);
  return [...result.values()];
 }
 // Editing coordinates of an existing vertex cannot overwrite edits to other
 // vertices. Unrelated new vertices and strokes are appended, not discarded.
 if(base.length<=edit.length&&base.length<=latest.length){
  const result=latest.slice();
  for(let i=0;i<base.length;i++){
   if(!same(base[i],edit[i]))result[i]=mergeEditedValue(base[i],edit[i],result[i]??base[i],key);
  }
  const newEntries=edit.slice(base.length);
  // Append only entries absent from this revision. Prevent retransmissions
  // duplicating a vertex, while preserving independently-created entries.
  for(const entry of newEntries)if(!result.slice(base.length).some(value=>same(value,entry)))result.push(entry);
  return result;
 }
 // Structural removal/reordering is atomic. A conflicting reordering cannot
 // safely be combined with index-based geometry references.
 return edit;
}
export function mergeEditedValue<T>(base:T,edit:T,latest:T,key=""):T{
 if(same(base,edit))return latest;
 if(same(base,latest))return edit;
 if(Array.isArray(base)&&Array.isArray(edit)&&Array.isArray(latest))
  return mergeArray(base,edit,latest,key) as T;
 if(record(base)&&record(edit)&&record(latest)){
  const result:{[k:string]:unknown}={...latest};
  for(const field of new Set([...Object.keys(base),...Object.keys(edit)])){
   if(!same(base[field],edit[field])){
    if(!(field in edit))delete result[field];
    else result[field]=mergeEditedValue(base[field],edit[field],latest[field],field);
   }
  }
  return result as T;
 }
 return edit;
}

/** Small independent mutations for the editor realtime channel.
 * Other users do not need to download an entire world atlas on each stroke.
 */
export type LiveEditorOp={path:(string|number)[];kind:"set"|"remove"|"append"|"upsert-id"|"remove-id";value?:unknown;id?:string};
const MAX_DEPTH=18;
export function editorDiff(before:unknown,after:unknown):LiveEditorOp[]{
 const changes:LiveEditorOp[]=[];
 const walk=(a:unknown,b:unknown,path:(string|number)[],depth:number)=>{
  if(same(a,b)||depth>MAX_DEPTH)return;
  if(Array.isArray(a)&&Array.isArray(b)){
   const key=String(path[path.length-1]??"");
   if(isIdCollection(a,key)&&isIdCollection(b,key)){
    const previous=new Map(a.map(v=>[(v as {id:string}).id,v]));
    const following=new Map(b.map(v=>[(v as {id:string}).id,v]));
    for(const [id,value] of following)
     if(!same(value,previous.get(id)))
      changes.push({path,kind:"upsert-id",id,value});
    for(const [id] of previous)if(!following.has(id))
      changes.push({path,kind:"remove-id",id});
    return;
   }
   if(b.length>=a.length){
    for(let i=0;i<a.length;i++)walk(a[i],b[i],[...path,i],depth+1);
    if(b.length>a.length)changes.push({path,kind:"append",value:b.slice(a.length)});
    return;
   }
  }
  if(record(a)&&record(b)){
   for(const field of new Set([...Object.keys(a),...Object.keys(b)])){
    if(!(field in b))changes.push({path:[...path,field],kind:"remove"});
    else walk(a[field],b[field],[...path,field],depth+1);
   }
   return;
  }
  changes.push({path,kind:"set",value:b});
 };
 walk(before,after,[],0);
 return changes.slice(0,300);
}
export function applyEditorOps<T>(input:T,ops:readonly LiveEditorOp[]):T{
 let result:unknown=input;
 const replaceAt=(value:unknown,path:readonly (string|number)[],action:LiveEditorOp,depth=0):unknown=>{
  if(depth<path.length){
   const field=path[depth];
   const output:Array<unknown>|Record<string,unknown>=Array.isArray(value)?
     value.slice():record(value)?{...value}:typeof field==="number"?[]:{};
   (output as unknown as Record<string|number,unknown>)[field]=replaceAt(
     (output as unknown as Record<string|number,unknown>)[field],path,action,depth+1);
   return output;
  }
  switch(action.kind){
   case "set":return action.value;
   case "remove":return undefined;
   case "append":{
     if(!Array.isArray(value)||!Array.isArray(action.value))return value;
     return [...value,...action.value];
   }
   case "upsert-id":{
     if(!Array.isArray(value)||!action.id||!record(action.value))return value;
     const index=value.findIndex(v=>record(v)&&v.id===action.id);
     if(index<0)return [...value,action.value];
     return value.map((v,i)=>i===index?mergeEditedValue(v,action.value,action.value):v);
   }
   case "remove-id":{
     if(!Array.isArray(value))return value;
     return value.filter(v=>!record(v)||v.id!==action.id);
   }
  }
 };
 for(const op of ops){
  if(op.path.length>MAX_DEPTH||op.path.some(p=>typeof p==="string"&&
   (p==="__proto__"||p==="constructor"||p==="prototype")))continue;
  result=replaceAt(result,op.path,op);
 }
 return result as T;
}
