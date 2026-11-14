/** Pure layout helpers for pointer and keyboard word ordering.
 * IDs, not labels, identify chips: repeated words must remain independent. */
export type SentenceWordRect={left:number;top:number;width:number;height:number};

export function moveSentenceWord(order:readonly string[],wordId:string,slot:number):string[]{
 const from=order.indexOf(wordId);
 if(from<0)return [...order];
 const remaining=order.filter((_,index)=>index!==from);
 const insertion=Math.max(0,Math.min(remaining.length,Math.trunc(Number.isFinite(slot)?slot:from)));
 const next=[...remaining.slice(0,insertion),wordId,...remaining.slice(insertion)];
 return next.every((id,index)=>id===order[index])?order as string[]:next;
}

/** Position relative to chips OTHER than the dragged chip.
 * In wrapped rows, Y takes priority so dropping at the end of a row
 * does not unexpectedly jump a word to the end of the whole sentence. */
export function sentenceWordDropSlot(x:number,y:number,rects:readonly SentenceWordRect[]):number{
 if(!Number.isFinite(x)||!Number.isFinite(y))return rects.length;
 for(let index=0;index<rects.length;index++){
  const rect=rects[index];
  if(y<rect.top||(
   y<=rect.top+rect.height&&x<rect.left+rect.width/2
  ))return index;
 }
 return rects.length;
}
