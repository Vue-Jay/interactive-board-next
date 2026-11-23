import type {Item} from "./boardModel";

/** Local operation journal, scoped to the authenticated viewer. A board-wide
 * snapshot is NOT an undo step: another participant may have edited the board
 * since this action was recorded. Keep only the IDs actually changed here. */
export type StudentBoardChange={
 id:string;before:Item|null;after:Item|null;
 beforeIndex:number;afterIndex:number;
};
export type StudentBoardAction={
 actorId:string;changes:StudentBoardChange[];
};
export type StudentBoardReplay=
 |{ok:true;items:Item[]}
 |{ok:false;reason:"wrong-user"|"changed-by-another-user"};

const same=(a:Item|null,b:Item|null):boolean=>
 a===b||a!==null&&b!==null&&JSON.stringify(a)===JSON.stringify(b);

/** Capture only this user's just-committed mutation, never a remote revision. */
export function captureStudentBoardAction(
 before:readonly Item[],after:readonly Item[],actorId:string
):StudentBoardAction|null{
 if(!actorId)return null;
 const original=new Map(before.map((item,index)=>[item.id,{item,index}] as const));
 const updated=new Map(after.map((item,index)=>[item.id,{item,index}] as const));
 const changes:StudentBoardChange[]=[];
 for(const [id,old] of original){
  const fresh=updated.get(id);
  if(!same(old.item,fresh?.item??null))changes.push({
   id,before:old.item,after:fresh?.item??null,
   beforeIndex:old.index,afterIndex:fresh?.index??-1
  });
 }
 for(const [id,fresh] of updated){
  if(original.has(id))continue;
  changes.push({id,before:null,after:fresh.item,beforeIndex:-1,afterIndex:fresh.index});
 }
 return changes.length?{actorId,changes}:null;
}

/** An undo is an inverse operation on changed IDs, NOT replacement of the board.
 * Reject the whole step if any affected item changed remotely. This ensures
 * that neither undo nor redo overwrites another person's later edits.
 * Unrelated new or edited items stay exactly as they are in the live board. */
export function replayStudentBoardAction(
 live:readonly Item[],action:StudentBoardAction,actorId:string,
 direction:"undo"|"redo"
):StudentBoardReplay{
 if(!actorId||action.actorId!==actorId)return {ok:false,reason:"wrong-user"};
 const present=new Map(live.map(item=>[item.id,item]));
 for(const change of action.changes){
  const expected=direction==="undo"?change.after:change.before;
  if(!same(present.get(change.id)??null,expected))
   return {ok:false,reason:"changed-by-another-user"};
 }
 const changes=new Map(action.changes.map(change=>[change.id,change]));
 const result:Item[]=[];
 for(const item of live){
  const change=changes.get(item.id);
  if(!change){result.push(item);continue;}
  const replacement=direction==="undo"?change.before:change.after;
  if(replacement)result.push(replacement);
 }
 const restored=action.changes.filter(change=>
  (direction==="undo"?change.after:change.before)===null&&
  (direction==="undo"?change.before:change.after)!==null
 ).sort((a,b)=>direction==="undo"?a.beforeIndex-b.beforeIndex:a.afterIndex-b.afterIndex);
 for(const change of restored){
  const value=direction==="undo"?change.before:change.after;
  if(!value)continue;
  const wanted=direction==="undo"?change.beforeIndex:change.afterIndex;
  result.splice(Math.max(0,Math.min(result.length,wanted)),0,value);
 }
 return {ok:true,items:result};
}
