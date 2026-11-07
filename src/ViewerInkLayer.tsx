import { memo, useLayoutEffect, useMemo, useRef } from "react";
import type { Item, View } from "./boardModel";
import {inkCanvasBudget,reuseInkCanvasBacking} from "./inkCanvasBudget";
import {indexInkStrokes,queryInkStrokes} from "./inkSpatialIndex";

type ViewportSize = { width: number; height: number };
type InkBounds = { x: number; y: number; width: number; height: number };
type RasterCache = {
  left: number; top: number; right: number; bottom: number;
  zoom: number; width: number; height: number; strokes: Item[];
};

/**
 * Read-only ink is rasterized in contiguous z-order batches instead of one
 * SVG + React object per stroke. A small screen-space overscan is painted once
 * and then moved by the parent's CSS transform. Ordinary pans do not repaint.
 * No board data or ink geometry is changed.
 */
const ViewerInkLayer = memo(function ViewerInkLayer({
  strokes, bounds, view, viewport,
}: {
  strokes: Item[]; bounds: InkBounds; view: View; viewport: ViewportSize;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cacheRef = useRef<RasterCache | null>(null);
  // Construct the spatial index once per immutable stroke run, not per pan.
  const spatialIndex=useMemo(()=>indexInkStrokes(strokes),[strokes]);
  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || viewport.width <= 0 || viewport.height <= 0 || view.zoom <= 0) return;
    const zoom = view.zoom;
    const worldLeft = -view.x / zoom, worldTop = -view.y / zoom;
    const worldRight = worldLeft + viewport.width / zoom;
    const worldBottom = worldTop + viewport.height / zoom;
    const cached = cacheRef.current;
    const padding = 40 / zoom;
    const tileBuffer = 320 / zoom;
    const minBuffer = 70 / zoom;
    const boundLeft = bounds.x - padding;
    const boundTop = bounds.y - padding;
    const boundRight = bounds.x + bounds.width + padding;
    const boundBottom = bounds.y + bounds.height + padding;
    // A cached tile can be reused if it contains the visible portion of
    // this batch, even when the viewport itself extends beyond its bounds.
    const requiredLeft = Math.max(worldLeft - minBuffer, boundLeft);
    const requiredTop = Math.max(worldTop - minBuffer, boundTop);
    const requiredRight = Math.min(worldRight + minBuffer, boundRight);
    const requiredBottom = Math.min(worldBottom + minBuffer, boundBottom);
    if (cached && cached.strokes === strokes && cached.zoom === zoom &&
        cached.width === viewport.width && cached.height === viewport.height &&
        cached.left <= requiredLeft && cached.top <= requiredTop &&
        cached.right >= requiredRight && cached.bottom >= requiredBottom) return;

    // Rasterize only the intersection of the nearby viewport and this group's
    // actual world bounds, rather than allocating a full viewport canvas for
    // every layer separated by a photo or PDF.
    const left = Math.max(worldLeft - tileBuffer, boundLeft);
    const top = Math.max(worldTop - tileBuffer, boundTop);
    const right = Math.min(worldRight + tileBuffer, boundRight);
    const bottom = Math.min(worldBottom + tileBuffer, boundBottom);
    if (right <= left || bottom <= top) {
      // Release GPU/backing memory for layers far outside the viewport.
      // Returning with the old canvas size held stale backing stores alive.
      if (canvas.width || canvas.height) { canvas.width = 0; canvas.height = 0; }
      cacheRef.current = null;
      return;
    }
    const cssWidth = right - left;
    const cssHeight = bottom - top;
    const pixels = inkCanvasBudget(cssWidth,cssHeight,zoom,window.devicePixelRatio||1);
    const reusedBacking=reuseInkCanvasBacking(canvas,pixels.width,pixels.height);
    canvas.style.left = `${left}px`;
    canvas.style.top = `${top}px`;
    canvas.style.width = `${cssWidth}px`;
    canvas.style.height = `${cssHeight}px`;
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;
    if(reusedBacking){
      // An unchanged backing is not automatically cleared by assigning
      // canvas dimensions. Erase the previous tile in device pixels first.
      ctx.setTransform(1,0,0,1,0,0);
      ctx.clearRect(0,0,canvas.width,canvas.height);
    }
    ctx.setTransform(pixels.scaleX, 0, 0, pixels.scaleY,
      -left * pixels.scaleX, -top * pixels.scaleY);
    for (const item of queryInkStrokes(spatialIndex,left,top,right,bottom)) {
      if (item.hidden || !item.points?.length) continue;
      const weight = item.weight ?? 3, pad = weight / 2;
      if (item.x + item.width + pad < left || item.x - pad > right ||
          item.y + item.height + pad < top || item.y - pad > bottom) continue;
      ctx.save();
      if (item.rotation) {
        const cx = item.x + item.width / 2, cy = item.y + item.height / 2;
        ctx.translate(cx, cy);
        ctx.rotate(item.rotation * Math.PI / 180);
        ctx.translate(-cx, -cy);
      }
      ctx.globalAlpha = item.kind === "marker" ? 0.32 : 1;
      ctx.strokeStyle = item.color ?? "#000000";
      ctx.fillStyle = item.color ?? "#000000";
      ctx.lineWidth = weight; ctx.lineCap = "round"; ctx.lineJoin = "round";
      const points = item.points;
      ctx.beginPath();
      if (points.length === 1) {
        ctx.arc(item.x + points[0].x, item.y + points[0].y, weight / 2, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.moveTo(item.x + points[0].x, item.y + points[0].y);
        for (let index = 1; index < points.length; index++) {
          ctx.lineTo(item.x + points[index].x, item.y + points[index].y);
        }
        ctx.stroke();
      }
      ctx.restore();
    }
    cacheRef.current = {
      left, top, right, bottom, zoom,
      width: viewport.width, height: viewport.height, strokes,
    };
  }, [strokes, spatialIndex, bounds, view.x, view.y, view.zoom, viewport.width, viewport.height]);

  return <canvas ref={canvasRef} className="viewer-ink-canvas" aria-hidden="true"
    style={{ position: "absolute", pointerEvents: "none", maxWidth: "none", maxHeight: "none" }} />;
});
export default ViewerInkLayer;
