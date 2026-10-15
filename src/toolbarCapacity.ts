/**
 * Number of pinned items that fit in a vertical toolbar after reserving space
 * for navigation, the More button and always-available utility actions.
 * Pure function kept separate from React so small-viewports can be tested.
 */
export function calculateToolbarCapacity(
  availableHeight:number,
  reservedHeight:number,
  itemHeight:number,
  gap:number,
  pinnedTotal:number
):number {
  if(pinnedTotal<=0)return 0;
  if(!Number.isFinite(availableHeight)||!Number.isFinite(reservedHeight)
    ||!Number.isFinite(itemHeight)||itemHeight<=0)return pinnedTotal;
  const itemStep=itemHeight+Math.max(0,gap);
  return Math.min(pinnedTotal,Math.max(0,Math.floor(
    (Math.max(0,availableHeight-reservedHeight)+Math.max(0,gap))/itemStep
  )));
}
