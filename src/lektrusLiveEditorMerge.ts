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
