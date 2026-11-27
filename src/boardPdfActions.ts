import type {Item} from "./boardModel";

// A toolbar event may run against a stale React prop after a peer revision.
// Resolve the current ID and asset before applying page metadata or copies.
export function resolvePdfAction(items:Item[],rendered:Item,canEdit:boolean,count:number|null):Item|undefined{
 if(!canEdit||!Number.isSafeInteger(count)||!count||count<1||rendered.kind!=="pdf"||!rendered.assetId)return;
 const item=items.find(candidate=>candidate.id===rendered.id);
 if(!item||item.kind!=="pdf"||item.locked||item.assetId!==rendered.assetId)return;
 return item;
}
export function nextPdfPage(item:Item,page:number,count:number):number{
 return Math.max(1,Math.min(count,Math.round(Number.isFinite(page)?page:1)));
}
