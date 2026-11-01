import type { View } from "./boardModel";

/** A periodic grid is visually identical after displacement by one cell.
 * Rebase its CSS translation to one cell instead of repainting a huge
 * radial/linear-gradient background for every finger movement. */
export const boardGridTransform=(next:View,committed:View)=>{
  const factor=next.zoom/committed.zoom;
  const period=Math.max(0.01,24*next.zoom);
  const wrap=(v:number)=>((v+period/2)%period+period)%period-period/2;
  return `translate3d(${wrap(next.x-committed.x*factor)}px,${wrap(next.y-committed.y*factor)}px,0) scale(${factor})`;
};
