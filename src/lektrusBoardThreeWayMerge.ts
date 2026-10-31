import type {DocumentData,Item} from "./boardModel";
import {expandDocumentInk,packDocumentInk} from "./boardModel";
import {mergeEditedValue} from "./lektrusLiveEditorMerge";
import {mergeLabBench} from "./lektrusChemistryBenchModel";

/**
 * Rebase local unsaved board edits onto a newer server version.
 * Normal object moves, resizes, pen strokes and eraser deletions are all
 * identified by stable item IDs, not only edits made inside special editors.
 * A remote snapshot is never allowed to roll back a locally edited item.
 */
const same=(a:unknown,b:unknown)=>a===b||JSON.stringify(a)===JSON.stringify(b);

export function mergeBoardItems(base:readonly Item[],local:readonly Item[],remote:readonly Item[]):Item[]{
 const originals=new Map(base.map(item=>[item.id,item]));
 const changed=new Map(local.map(item=>[item.id,item]));
 const received=new Map(remote.map(item=>[item.id,item]));
 const result:Item[]=[];
 for(const serverItem of remote){
  const original=originals.get(serverItem.id);
  const localItem=changed.get(serverItem.id);
  // A locally deleted stroke stays erased instead of reappearing whenever
  // a collaborator commits a different change.
  if(original&&!localItem)continue;
  if(!localItem){result.push(serverItem);continue;}
  if(!original){
   result.push(same(localItem,serverItem)?serverItem:localItem);
  }else if(same(original,localItem)){
   result.push(serverItem);
  }else if(same(original,serverItem)){
   result.push(localItem);
  }else if(original.graphFigureId==="chem-experiment-free"&&
    localItem.graphFigureId==="chem-experiment-free"&&
    serverItem.graphFigureId==="chem-experiment-free"&&
    original.scienceLabBench&&localItem.scienceLabBench&&serverItem.scienceLabBench){
   // Generic positional-array merge can resurrect a cleared worktop when
   // an evaporation tick competes with a server checkpoint. Chemistry arrays
   // use stable vessel IDs and an explicit clear/kit generation barrier.
   const baseWithout={...original,scienceLabBench:undefined};
   const localWithout={...localItem,scienceLabBench:undefined};
   const remoteWithout={...serverItem,scienceLabBench:undefined};
   result.push({...mergeEditedValue(baseWithout,localWithout,remoteWithout),
    scienceLabBench:mergeLabBench(original.scienceLabBench,
     localItem.scienceLabBench,serverItem.scienceLabBench)});
  }else{
   result.push(mergeEditedValue(original,localItem,serverItem));
  }
 }
 for(const item of local){
  if(received.has(item.id))continue;
  const original=originals.get(item.id);
  // Local drawing never disappears just because it is missing in the
  // competing server revision. A remote deletion does win if no local edit.
  if(!original||!same(original,item))result.push(item);
 }
 return result;
}

export function mergeBoardDocumentEdits(
 base:DocumentData|null,local:DocumentData,remote:DocumentData
):DocumentData{
 const mergedItems=mergeBoardItems(
  base?expandDocumentInk(base):[],
  expandDocumentInk(local),expandDocumentInk(remote));
 return packDocumentInk({
  ...remote,
  title:base?mergeEditedValue(base.title,local.title,remote.title):remote.title,
  background:base?mergeEditedValue(base.background,local.background,remote.background):remote.background,
  backgroundShared:base?mergeEditedValue(base.backgroundShared,local.backgroundShared,remote.backgroundShared):remote.backgroundShared,
  subject:base?mergeEditedValue(base.subject,local.subject,remote.subject):remote.subject,
  view:local.view,
  items:mergedItems,
  ink:undefined,
 });
}
