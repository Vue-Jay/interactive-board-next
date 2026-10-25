/** Exact client-to-drawing mapping, including SVG viewBox letterboxing,
 * CSS scaling, browser zoom, nested transforms and the editor's pan/zoom.
 * Native SVG CTM is the authoritative source for hit placement.
 */
export type CanvasPoint={x:number;y:number};
export function svgClientPoint(svg:SVGSVGElement,clientX:number,clientY:number):CanvasPoint{
  const ctm=svg.getScreenCTM?.();
  if(ctm&&typeof svg.createSVGPoint==="function"){
    try{
      const cursor=svg.createSVGPoint();
      cursor.x=clientX;cursor.y=clientY;
      const local=cursor.matrixTransform(ctm.inverse());
      if(Number.isFinite(local.x)&&Number.isFinite(local.y))
        return {x:local.x,y:local.y};
    }catch{/* Detached SVG: use the proportional fallback below. */}
  }
  const box=svg.getBoundingClientRect();
  const vb=svg.viewBox?.baseVal;
  const viewX=vb?.x??0,viewY=vb?.y??0,viewW=vb?.width||960,viewH=vb?.height||560;
  const scale=Math.min(box.width/viewW,box.height/viewH)||1;
  const insetX=(box.width-viewW*scale)/2;
  const insetY=(box.height-viewH*scale)/2;
  return {x:viewX+(clientX-box.left-insetX)/scale,
    y:viewY+(clientY-box.top-insetY)/scale};
}
export function clampCanvasPoint(point:CanvasPoint,width:number,height:number):CanvasPoint{
 return {x:Math.max(0,Math.min(width,point.x)),
   y:Math.max(0,Math.min(height,point.y))};
}
