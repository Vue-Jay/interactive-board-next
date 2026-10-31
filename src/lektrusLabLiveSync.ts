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

/** Only send laboratory properties, never a second copy of the whole board
 * object, its geometry, or unrelated editing fields. */
export function labLiveEditorDiff(before:Item,after:Item):LiveEditorOp[]{
 if(!isLab(before)||!isLab(after)||before.id!==after.id)return [];
 if(before.scienceLabBench===after.scienceLabBench)return [];
 const ops=editorDiff(
  {scienceLabBench:before.scienceLabBench},
  {scienceLabBench:after.scienceLabBench});
 if(!ops.length||ops.length>=300||JSON.stringify(ops).length>OPS_LIMIT)return [];
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
