import {isInkItem,type Item} from "./boardModel";
import {STUDENT_PROTECTED_OBJECT_KINDS} from "./lektrusBoardRolePreview";

/**
 * Authors belong to an item ID, not to the most recent editor. In particular,
 * moving a teacher's object must never turn it into a student's property.
 * Legacy items without an author remain unowned, never guessed from the
 * person who happened to open the board first.
 */
export function stampNewBoardItemAuthors(
 before:readonly Item[],after:readonly Item[],actorId:string
):Item[]{
 const originals=new Map(before.map(item=>[item.id,item]));
 return after.map(candidate=>{
  const item=withoutInkLock(candidate);
  const existing=originals.get(item.id);
  const author=existing?existing.createdBy:actorId;
  // Pen and marker strokes are never lockable, including imported legacy ink.
  if(isInkItem(item)){
   const {locked:_ignored,...stroke}=item;
   return stroke.createdBy===author?stroke:{...stroke,createdBy:author};
  }
  if(existing){
   return item.createdBy===author?item:{...item,createdBy:author};
  }
  return {...item,createdBy:author};
 });
}

/** Ink is never lockable. Provenance still governs destructive actions,
 * but an explicit object lock is reserved for placed board objects. */
export const isLockableBoardItem=(item:Pick<Item,"kind">):boolean=>
 item.kind!=="pen"&&item.kind!=="marker";

/** Ignore stale/spoofed ink locks without touching any other item flags. */
export function withoutInkLock<T extends Item>(item:T):T{
 if(isLockableBoardItem(item)||item.locked!==true)return item;
 const {locked:_locked,...unlocked}=item;
 return unlocked as T;
}

/** A stroke is never locked, but authorship is separate from locking:
 * pupils cannot erase someone else's ink. The board owner can still remove
 * any object. This keeps shared deletion rights consistent across object types.
 */
export function canRemoveBoardItem(
 item:Item,actorId:string,isStudent:boolean,isBoardOwner=false
):boolean{
 if(isBoardOwner)return true;
 if(!isStudent)return true;
 return !!actorId&&item.createdBy===actorId&&!item.locked&&
  !(STUDENT_PROTECTED_OBJECT_KINDS as readonly string[]).includes(item.kind);
}

/** Guard the model mutation, not only the toolbar/keyboard handler: tools
 * such as ink erasers, instrument removal, selection and provisional
 * editors may remove items without calling deleteSelected().
 */
export function blockedBoardItemRemovals(
 before:readonly Item[],after:readonly Item[],actorId:string,
 isStudent:boolean,isBoardOwner=false
):Item[]{
 if(!isStudent||isBoardOwner)return [];
 const retained=new Set(after.map(item=>item.id));
 return before.filter(item=>!retained.has(item.id)&&
  !canRemoveBoardItem(item,actorId,true,isBoardOwner));
}
