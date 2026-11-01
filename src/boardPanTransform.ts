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
