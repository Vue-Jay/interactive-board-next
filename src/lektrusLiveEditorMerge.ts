/** Three-way, field-level merge for collaborative geometry and contour editors.
 * Changed fields win, untouched fields retain the most recently received value.
 * Atlas marks/strokes have persistent IDs and can be concurrently added/edited.
 * Point-indexed geometry is merged conservatively: independent point moves are
 * combined, but structural deletions replace the affected collection.
 */
const same=(a:unknown,b:unknown)=>a===b||JSON.stringify(a)===JSON.stringify(b);
const record=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==="object"&&!Array.isArray(v);
// Old saved motion graphs used positional points. Assign a stable identity
// on both sides before merging, so the first live edit upgrades safely.
export function withMotionPointIds<T extends {id:string;graphPoints?:{id?:string}[]}>(item:T):T{
 if(!item.graphPoints?.some(point=>!point.id))return item;
 return {...item,graphPoints:item.graphPoints.map((point,index)=>({...point,id:point.id??`legacy-${item.id}-${index}`}))};
}
const isIdCollection=(values:unknown[],key:string)=>(
 ["contourMarks","contourStrokes","bodies","supports","forces","components","junctions","wires","elements","rays",
  // Chemical glassware and appliances are addressed by persistent IDs.
  // Index-based array appends can duplicate a beaker on an evaporation tick.
  "vessels","placedDevices","graphPoints","points","stickerInk"].includes(key)&&
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
   // Deleted nested items (including sticker ink) must not be resurrected
   // by a concurrent edit that still references their old IDs.
   if(result.has(id)&&!same(original,value))result.set(id,mergeEditedValue(original,value,result.get(id),key));
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
 if(same(edit,latest))return latest;
 // A queued pupil response can reach the three-way merge *after* a teacher
 // has replaced the exercise. Reject stale response fields at this boundary,
 // not only in the UI callback (which may run before the peer revision).
 if(record(base)&&record(edit)&&record(latest)&&
    base.kind===edit.kind&&base.kind===latest.kind&&
    ["sentence-builder","geo-training","flashcards","orthography"].includes(String(base.kind))){
  const source=base.kind==="sentence-builder"?["parts"]:base.kind==="geo-training"?["exercise","relation","reverse","countryCodes"]:base.kind==="flashcards"?["cards","direction"]:["questions"];
  const answers=base.kind==="sentence-builder"?["answerOrder","answerChecked"]:base.kind==="geo-training"?["practice"]:["response"];
  const changed=(a:Record<string,unknown>,b:Record<string,unknown>,fields:string[])=>fields.some(f=>!same(a[f],b[f]));
  const localSource=changed(base,edit,source),remoteSource=changed(base,latest,source);
  const result:Record<string,unknown>={...latest};
  const copy=(from:Record<string,unknown>,field:string)=>{
   if(from[field]===undefined)delete result[field];else result[field]=from[field];
  };
  for(const field of new Set([...Object.keys(base),...Object.keys(edit)])){
   if(source.includes(field)||answers.includes(field)||same(base[field],edit[field]))continue;
   if(!(field in edit))delete result[field];
   else result[field]=mergeEditedValue(base[field],edit[field],latest[field],field);
  }
  if(localSource){
   for(const field of source)copy(edit,field);
   // A newly authored assignment starts unanswered. If a peer already
   // published the identical new source, its answers are still legitimate.
   if(changed(edit,latest,source))for(const field of answers)delete result[field];
  }else if(!remoteSource&&changed(base,edit,answers)){
   // Keep answerOrder and answerChecked together (including a reset).
   for(const field of answers)copy(edit,field);
  }
  return result as T;
 }
 if(same(base,latest))return edit;
 // Permutations are atomic. Index merging can create duplicate words.
 if(key==="answerOrder"||key==="practice"||key==="response")return edit;
 // Old stickers have no ink field. Concurrent first strokes must merge just
 // as two additions to an existing sticker, instead of replacing each other.
 if(key==="stickerInk"&&base==null&&Array.isArray(edit)&&Array.isArray(latest))
  return mergeArray([],edit,latest,key) as T;
 if(Array.isArray(base)&&Array.isArray(edit)&&Array.isArray(latest))
  return mergeArray(base,edit,latest,key) as T;
 if(record(base)&&record(edit)&&record(latest)){
  let effectiveEdit:Record<string,unknown>=edit;
  // Concurrent point additions need index rebasing. Point-indexed graph
  // elements refer to vertices by integer, so simply concatenating the
  // vertex arrays would attach a newly drawn line to somebody else's point.
  const pointKey="graphPoints" in base?"graphPoints":
    "figureId" in base&&"points" in base?"points":null;
  if(pointKey){
   const old=base[pointKey],changed=edit[pointKey],remote=latest[pointKey];
   if(Array.isArray(old)&&Array.isArray(changed)&&Array.isArray(remote)&&
     changed.length>old.length&&remote.length>old.length&&
     !same(changed,remote)&&
     !(isIdCollection(old,pointKey)&&isIdCollection(changed,pointKey)&&isIdCollection(remote,pointKey))){
    // Match the exact append/deduplication rules of mergeArray. A fixed
    // offset is wrong when a previously delivered point is already present.
    const mergedTail=remote.slice(old.length);
    const rebasedIndices=new Map<number,number>();
    const remoteNames=new Set(remote.filter(record).map(p=>String(p.label??"")));
    const nameFor=(index:number)=>{
     let n=index,label="";
     do{label=String.fromCharCode(65+n%26)+label;n=Math.floor(n/26)-1;}while(n>=0);
     return label;
    };
    const appended=changed.slice(old.length).map((point,index)=>{
      let match=mergedTail.findIndex(value=>same(value,point));
      if(match<0){
        if(record(point)&&typeof point.label==="string"&&point.label){
          let label=point.label;
          if(remoteNames.has(label)){
            let i=0;label=nameFor(i);
            while(remoteNames.has(label))label=nameFor(++i);
            point={...point,label};
          }
          remoteNames.add(label);
        }
        match=mergedTail.length;
        mergedTail.push(point);
      }
      rebasedIndices.set(old.length+index,old.length+match);
      return point;
    });
    const shifted:Record<string,unknown>={...edit,[pointKey]:[...changed.slice(0,old.length),...appended]};
    const shift=(index:unknown)=>typeof index==="number"?(rebasedIndices.get(index)??index):index;
    const fields=pointKey==="graphPoints"?
      ["graphSegments","graphAngles","graphCircles","graphPolygons","graphMidpoints","graphConstraints"]:
      ["segments","angles","circles","polygons","midpoints","constraints"];
    for(const field of fields){
     const previous=base[field],following=edit[field];
     if(!Array.isArray(previous)||!Array.isArray(following))continue;
     shifted[field]=following.map((entry,i)=>{
      if(i<previous.length&&same(entry,previous[i])||!record(entry))return entry;
      const transformed:{[key:string]:unknown}={...entry};
      for(const key of ["a","b","center","edge","vertex"])
       if(key in transformed)transformed[key]=shift(transformed[key]);
      if(Array.isArray(transformed.points))
       transformed.points=transformed.points.map(shift);
      return transformed;
     });
    }
    effectiveEdit=shifted;
   }
  }
  const result:{[k:string]:unknown}={...latest};
  for(const field of new Set([...Object.keys(base),...Object.keys(effectiveEdit)])){
   if(!same(base[field],effectiveEdit[field])){
    if(!(field in effectiveEdit))delete result[field];
    else result[field]=mergeEditedValue(base[field],effectiveEdit[field],latest[field],field);
   }
  }
  return result as T;
 }
 return edit;
}

/** Small independent mutations for the editor realtime channel.
 * Other users do not need to download an entire world atlas on each stroke.
 */
export type LiveEditorOp={path:(string|number)[];kind:"set"|"remove"|"append"|"upsert-id"|"remove-id";value?:unknown;id?:string;before?:unknown};
const MAX_DEPTH=18;
export function editorDiff(before:unknown,after:unknown):LiveEditorOp[]{
 const changes:LiveEditorOp[]=[];
 let overflow=false;
 const walk=(a:unknown,b:unknown,path:(string|number)[],depth:number)=>{
  if(overflow||same(a,b))return;
  if(depth>MAX_DEPTH){overflow=true;return;}
  if(b===undefined&&path.length){changes.push({path,kind:"remove"});return;}
  if(Array.isArray(a)&&Array.isArray(b)){
   const key=String(path[path.length-1]??"");
   if(isIdCollection(a,key)&&isIdCollection(b,key)){
    const previous=new Map(a.map(v=>[(v as {id:string}).id,v]));
    const following=new Map(b.map(v=>[(v as {id:string}).id,v]));
    for(const [id,value] of following)
     if(!same(value,previous.get(id)))
      changes.push({path,kind:"upsert-id",id,value,before:previous.get(id)});
    for(const [id] of previous)if(!following.has(id))
      changes.push({path,kind:"remove-id",id});
    return;
   }
   // Upgrade existing motion graphs without appending the same legacy points.
   if(key==="graphPoints"&&isIdCollection(b,key)&&b.length){
    changes.push({path,kind:"set",value:b});return;
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
 // Never publish half of a related geometry/diagram update. The durable
 // revision still carries the entire edit when the preview budget is exceeded.
 return overflow||changes.length>300?[]:changes;
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
     // An update with a prior value is not a creation. A delayed preview
     // must not revive a peer-deleted point, wire, vessel or attached stroke.
     if(index<0)return action.before!==undefined?value:[...value,action.value];
     return value.map((v,i)=>i===index&&action.before!==undefined?mergeEditedValue(action.before,action.value,v):i===index?action.value:v);
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
