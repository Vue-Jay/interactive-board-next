import { memo, useLayoutEffect, useMemo, useRef } from "react";
import type { Item, View } from "./boardModel";
import {inkCanvasBudget,reuseInkCanvasBacking} from "./inkCanvasBudget";
import {indexInkStrokes,queryInkStrokes} from "./inkSpatialIndex";

type ViewportSize = { width: number; height: number };
type InkBounds = { x: number; y: number; width: number; height: number };
type RasterCache = {
  left: number; top: number; right: number; bottom: number;
  zoom: number; width: number; height: number; strokes: Item[];
  pixelWidth:number;pixelHeight:number;
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
    const keepTile=!!cached&&cached.zoom===zoom&&cached.width===viewport.width&&cached.height===viewport.height&&
      cached.left<=requiredLeft&&cached.top<=requiredTop&&cached.right>=requiredRight&&cached.bottom>=requiredBottom;
    const left = keepTile?cached!.left:Math.max(worldLeft - tileBuffer, boundLeft-64/zoom);
    const top = keepTile?cached!.top:Math.max(worldTop - tileBuffer, boundTop-64/zoom);
    const right = keepTile?cached!.right:Math.min(worldRight + tileBuffer, boundRight+64/zoom);
    const bottom = keepTile?cached!.bottom:Math.min(worldBottom + tileBuffer, boundBottom+64/zoom);
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
    let dirtyLeft=left,dirtyTop=top,dirtyRight=right,dirtyBottom=bottom;
    if(keepTile&&reusedBacking&&cached!.pixelWidth===pixels.width&&cached!.pixelHeight===pixels.height){
      // A cut or append changes only a small region. Repaint all intersecting
      // strokes in z-order, including translucent marker overlaps, but never
      // clear and rebuild the full screen on every eraser sample.
      const before=new Map(cached!.strokes.map(item=>[item.id,item]));
      const after=new Map(strokes.map(item=>[item.id,item]));
      const commonBefore=cached!.strokes.filter(item=>after.has(item.id)).map(item=>item.id);
      const commonAfter=strokes.filter(item=>before.has(item.id)).map(item=>item.id);
      const reordered=commonBefore.some((id,i)=>id!==commonAfter[i]);
      if(!reordered&&!cached!.strokes.some(item=>item.rotation)&&!strokes.some(item=>item.rotation)){
        let x1=Infinity,y1=Infinity,x2=-Infinity,y2=-Infinity;
        const include=(item:Item)=>{
          const pad=(item.weight??3)/2+3/zoom;
          x1=Math.min(x1,item.x-pad);y1=Math.min(y1,item.y-pad);
          x2=Math.max(x2,item.x+item.width+pad);y2=Math.max(y2,item.y+item.height+pad);
        };
        for(const item of cached!.strokes)if(after.get(item.id)!==item)include(item);
        for(const item of strokes)if(before.get(item.id)!==item)include(item);
        dirtyLeft=Math.max(left,left+Math.floor((x1-left)*pixels.scaleX)/pixels.scaleX);
        dirtyTop=Math.max(top,top+Math.floor((y1-top)*pixels.scaleY)/pixels.scaleY);
        dirtyRight=Math.min(right,left+Math.ceil((x2-left)*pixels.scaleX)/pixels.scaleX);
        dirtyBottom=Math.min(bottom,top+Math.ceil((y2-top)*pixels.scaleY)/pixels.scaleY);
      }
    }
    cacheRef.current={left,top,right,bottom,zoom,width:viewport.width,height:viewport.height,
      strokes,pixelWidth:pixels.width,pixelHeight:pixels.height};
    if(dirtyRight<=dirtyLeft||dirtyBottom<=dirtyTop)return;
    ctx.setTransform(pixels.scaleX,0,0,pixels.scaleY,-left*pixels.scaleX,-top*pixels.scaleY);
    ctx.save();
    ctx.beginPath();
    ctx.rect(dirtyLeft,dirtyTop,dirtyRight-dirtyLeft,dirtyBottom-dirtyTop);
    ctx.clip();
    ctx.clearRect(dirtyLeft,dirtyTop,dirtyRight-dirtyLeft,dirtyBottom-dirtyTop);
    for (const item of queryInkStrokes(spatialIndex,dirtyLeft,dirtyTop,dirtyRight,dirtyBottom)) {
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
    ctx.restore();
  }, [strokes, spatialIndex, bounds, view.x, view.y, view.zoom, viewport.width, viewport.height]);

  return <canvas ref={canvasRef} className="viewer-ink-canvas" aria-hidden="true"
    style={{ position: "absolute", pointerEvents: "none", maxWidth: "none", maxHeight: "none" }} />;
},(a,b)=>a.view.x===b.view.x&&a.view.y===b.view.y&&a.view.zoom===b.view.zoom&&
 a.viewport.width===b.viewport.width&&a.viewport.height===b.viewport.height&&
 a.bounds.x===b.bounds.x&&a.bounds.y===b.bounds.y&&a.bounds.width===b.bounds.width&&a.bounds.height===b.bounds.height&&
 a.strokes.length===b.strokes.length&&a.strokes.every((item,i)=>item===b.strokes[i]));
export default ViewerInkLayer;
