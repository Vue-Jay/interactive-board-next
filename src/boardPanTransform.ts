import type { View } from "./boardModel";

/** A pan is visual-only while the finger is down. Update DOM transforms
 * rather than remounting/reculling the entire React board every pointermove.
 * The ordinary persisted view is committed when the gesture ends. */
export const boardWorldTransform = (view: View) =>
  `translate(${view.x}px,${view.y}px) scale(${view.zoom})`;

/** Remote cursor / live-ink overlay uses screen-space positions relative
 * to the last committed view, so move that overlay by the same camera delta.
 * Origin is always the upper-left board corner. */
export const boardOverlayTransform = (next: View, committed: View) => {
  const factor = next.zoom / committed.zoom;
  return `translate(${next.x-committed.x*factor}px,${next.y-committed.y*factor}px) scale(${factor})`;
};

type FitRect = {x:number;y:number;width:number;height:number};

/** Fit into the visible camera area, accounting for open side panels. */
export function fitBoardCamera(bounds:FitRect, viewport:{width:number;height:number}, padding:number, sidePanels:readonly FitRect[]=[]):View {
  const {width,height}=viewport;
  let left=0,right=width;
  for(const panel of sidePanels){
    if(panel.width<=0||panel.height<=0||panel.y>=height||panel.y+panel.height<=0)continue;
    // A small floating panel in the middle of the board is not a side dock.
    if(panel.x+panel.width/2<width/2&&panel.x<32)left=Math.max(left,panel.x+panel.width+8);
    else if(panel.x+panel.width/2>=width/2&&panel.x+panel.width>width-32)right=Math.min(right,panel.x-8);
  }
  // A narrow phone may have a nearly full-screen overlay; keep a useful
  // camera rather than producing negative dimensions or an invalid zoom.
  if(right-left<120){left=0;right=width;}
  const horizontalPadding=Math.min(padding,Math.max(0,(right-left-120)/2));
  const verticalPadding=Math.min(padding,Math.max(0,(height-120)/2));
  const zoom=Math.max(.1,Math.min(4,(right-left-2*horizontalPadding)/Math.max(1,bounds.width),
    (height-2*verticalPadding)/Math.max(1,bounds.height)));
  return {zoom,x:(left+right)/2-(bounds.x+bounds.width/2)*zoom,
    y:height/2-(bounds.y+bounds.height/2)*zoom};
}
