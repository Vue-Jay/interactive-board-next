/** Bound the actual backing-store memory of a visible ink tile.
 * An axis-only 4096px cap still permits a 4096x4096 canvas (64 MiB RGBA)
 * PER ink layer. A pixel-area limit protects tablets and large screens.
 * World-space drawing remains unchanged; only raster resolution adapts.
 */
export const MAX_INK_CANVAS_PIXELS = 4 * 1024 * 1024;
export const MAX_INK_CANVAS_AXIS = 4096;

export function inkCanvasBudget(cssWidth: number, cssHeight: number,
  zoom: number, devicePixelRatio: number): {
  width: number; height: number; scaleX: number; scaleY: number;
} {
  if (!(cssWidth > 0 && cssHeight > 0 && zoom > 0) ||
      !Number.isFinite(cssWidth * cssHeight * zoom)) {
    return { width: 1, height: 1, scaleX: 1, scaleY: 1 };
  }
  const ratio = Math.min(1.25, Math.max(1,
    Number.isFinite(devicePixelRatio) ? devicePixelRatio : 1));
  const requestedWidth = Math.max(1, Math.ceil(cssWidth * zoom * ratio));
  const requestedHeight = Math.max(1, Math.ceil(cssHeight * zoom * ratio));
  const factor = Math.min(1,
    MAX_INK_CANVAS_AXIS / Math.max(requestedWidth, requestedHeight),
    Math.sqrt(MAX_INK_CANVAS_PIXELS / (requestedWidth * requestedHeight)));
  // Floor each axis so rounding cannot overshoot the allocated pixel budget.
  const width = Math.max(1, Math.floor(requestedWidth * factor));
  const height = Math.max(1, Math.floor(requestedHeight * factor));
  // Use the actual integer backing dimensions for the context transform.
  // The axes differ by at most a fractional device pixel, not a world unit.
  return {width,height,scaleX:width/cssWidth,scaleY:height/cssHeight};
}

/** Setting canvas.width/height even to their current values resets the 2D
 * context and may reallocate the GPU backing store. Reuse it when possible;
 * the caller must clear it before painting another tile at the same size.
 * Returns true only when the existing backing store was preserved.
 */
export function reuseInkCanvasBacking(canvas:Pick<HTMLCanvasElement,"width"|"height">,
  width:number,height:number):boolean{
  if(canvas.width===width&&canvas.height===height)return true;
  if(canvas.width!==width)canvas.width=width;
  if(canvas.height!==height)canvas.height=height;
  return false;
}
