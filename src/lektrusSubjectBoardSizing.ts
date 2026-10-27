/** Intrinsic-height policy for paper objects.
 * Growth is one-way (manual resizing remains possible), starts BEFORE content
 * touches the footer, and keeps >=200 board-space pixels free below the work. */
export const SUBJECT_BOARD_BOTTOM_WARNING=120;
export const SUBJECT_BOARD_BOTTOM_RESERVE=200;
export const SUBJECT_BOARD_GROWTH_STEP=160;
export function nextSubjectBoardHeight(currentHeight:number,usedHeight:number):number|null{
 if(!Number.isFinite(currentHeight)||!Number.isFinite(usedHeight)||currentHeight<=0||usedHeight<0)return null;
 if(currentHeight-usedHeight>=SUBJECT_BOARD_BOTTOM_WARNING)return null;
 const desired=Math.max(currentHeight+SUBJECT_BOARD_GROWTH_STEP,
   usedHeight+SUBJECT_BOARD_BOTTOM_RESERVE);
 return Math.ceil(desired/40)*40;
}
