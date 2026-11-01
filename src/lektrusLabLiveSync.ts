/** Low-latency chemistry previews over the existing board-work WebSocket.
 * The transport carries measured-state deltas, not a new chemical calculator.
 * The authoritative version remains the RLS-checked saved board document.
 */
import {parseDocument,type Item} from "./boardModel";
import {applyEditorOps,editorDiff,type LiveEditorOp} from "./lektrusLiveEditorMerge";

const PREVIEW_LIMIT=180_000;
const OPS_LIMIT=100_000;
const isLab=(item:Item)=>item.kind==="graph"&&
 item.graphFigureId==="chem-experiment-free"&&!!item.scienceLabBench;
const isEpochOp=(op:LiveEditorOp)=>op.path.length===2&&
 op.path[0]==="scienceLabBench"&&op.path[1]==="tableEpoch";

/** Only send laboratory properties, never a second copy of the whole board
 * object, its geometry, or unrelated editing fields. */
export function labLiveEditorDiff(before:Item,after:Item):LiveEditorOp[]{
 if(!isLab(before)||!isLab(after)||before.id!==after.id)return [];
 if(before.scienceLabBench===after.scienceLabBench)return [];
 const ops=editorDiff(
  {scienceLabBench:before.scienceLabBench},
  {scienceLabBench:after.scienceLabBench});
 if(!ops.length)return [];
 // Every realtime delta must declare which physical TABLE generation it
 // was based on. Without this barrier a late heating/drag packet from a
 // previous experiment can resurrect equipment after the teacher clears it.
 // The assertion is carried as an ordinary validated editor operation so
 // the existing WebSocket protocol does not need an extra message type.
 const previousEpoch=before.scienceLabBench?.tableEpoch??null;
 const currentEpoch=after.scienceLabBench?.tableEpoch;
 const epochOp=ops.find(isEpochOp);
 if(epochOp)epochOp.before=previousEpoch;
 else ops.unshift({path:["scienceLabBench","tableEpoch"],kind:"set",
  value:currentEpoch,before:previousEpoch});
 if(ops.length>=300||JSON.stringify(ops).length>OPS_LIMIT)return [];
 return ops;
}

/** Realtime packets are untrusted. Validate the entire candidate laboratory
 * with the SAME readback rules as persisted boards, in a bounded one-item
 * document. An invalid hint cannot corrupt an actual board or render unsafe
 * chemical arrays. No preview is committed to history/storage.
 */
export function applyLabLivePreview(stored:Item,previous:Item|undefined,
 ops:readonly LiveEditorOp[]):Item|null{
 if(!isLab(stored)||!ops.length||ops.length>=300||
  ops.some(op=>op.path[0]!=="scienceLabBench"||
   !["set","remove","append","upsert-id","remove-id"].includes(op.kind)))return null;
 // Reject oversized payloads before allocating or parsing a temporary document.
 if(JSON.stringify(ops).length>OPS_LIMIT)return null;
 const input=previous&&previous.id===stored.id&&isLab(previous)?previous:stored;
 const epochOps=ops.filter(isEpochOp);
 if(epochOps.length>1)return null;
 const epoch=epochOps[0];
 if(epoch){
  // Explicit null is a JSON-safe marker for legacy tables without an epoch.
  // Reject untrusted or unversioned packets before any upsert-id operation
  // can re-create a vessel that the teacher has already removed.
  if(!Object.prototype.hasOwnProperty.call(epoch,"before")||
   epoch.before!==null&&typeof epoch.before!=="string"||
   (epoch.kind!=="set"&&epoch.kind!=="remove")||
   epoch.kind==="set"&&epoch.value!==undefined&&typeof epoch.value!=="string")
   return null;
  if((input.scienceLabBench?.tableEpoch??null)!==epoch.before)return null;
 }else if(input.scienceLabBench?.tableEpoch!==undefined){
  // Accept older clients only on truly legacy boards with no generation.
  // Their ordinary saves still sync, but stale previews cannot undo resets.
  return null;
 }
 const candidate=applyEditorOps(input,ops);
 if(!isLab(candidate)||candidate.id!==stored.id||
  candidate.graphFigureId!==stored.graphFigureId)return null;
 try{
  const raw=JSON.stringify({version:1,title:"Lab live preview",
   view:{x:0,y:0,zoom:1},items:[candidate]});
  if(raw.length>PREVIEW_LIMIT)return null;
  const parsed=parseDocument(raw).items[0];
  return parsed&&isLab(parsed)&&parsed.id===stored.id?parsed:null;
 }catch{return null;}
}
