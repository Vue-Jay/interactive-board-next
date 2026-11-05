/** World-registered, scale-aware skin surface across the WHOLE human silhouette.
 *
 * One 360x600 body represents ~1700 mm of height in this teaching model.
 * Zoom is a digital CAMERA ratio, not microscope optical magnification.
 * Pores, shallow furrows and corneocyte-like tiles are deterministic world
 * structures. Their size never changes when an LOD becomes visible.
 * The renderer composites this entire field "source-atop" the body's alpha.
 * There are NO shoulder circles, magnification inset tiles or local swaps.
 */
import {anatomyScreenToBody} from "./lektrusAnatomySemanticZoom";
import type {AnatomyCamera} from "./lektrusHumanAnatomyModel";

export type SkinSurfaceLayer="regional"|"relief"|"pores"|"corneocytes";
export const APPROX_BODY_HEIGHT_MM=1700;
export const MM_PER_WORLD_UNIT=APPROX_BODY_HEIGHT_MM/600;
/** Distances are in body-local coordinates, not screen pixels. */
export const SKIN_RELIEF_STEP_WORLD=1.55;
export const SKIN_PORE_STEP_WORLD=0.44;
export const SKIN_CORNEOCYTE_STEP_WORLD=0.045;

/** Biological detail appears gradually at plausible projected sizes.
 * At a 10x camera view a pore is still tiny, NOT a 20px crater.
 */
export const SKIN_SURFACE_LEVELS:Readonly<Record<SkinSurfaceLayer,{
 appear:number;full:number;description:string;
}>>={
 regional:{appear:2.2,full:7.5,description:"Поверхность тела"},
 relief:{appear:5.5,full:17,description:"Мелкие складки кожи"},
 pores:{appear:16,full:38,description:"Поры и фолликулы"},
 corneocytes:{appear:115,full:260,description:"Модель роговых чешуек"}
};
export const MAX_DRAWN_CELLS=8500;
const clamp=(n:number,min:number,max:number)=>
 Number.isFinite(n)?Math.min(max,Math.max(min,n)):min;
export function skinSmoothstep(from:number,to:number,value:number):number{
 const t=clamp((value-from)/Math.max(1e-10,to-from),0,1);
 return t*t*(3-2*t);
}
export function skinSurfaceAlpha(scale:number,layer:SkinSurfaceLayer):number{
 const {appear,full}=SKIN_SURFACE_LEVELS[layer];
 return skinSmoothstep(appear,full,scale);
}
/** Pure stable integer hash: identical on PC and Android. */
export function skinHash(x:number,y:number,salt=0):number{
 let n=Math.imul((x|0)^salt,0x1b873593)^Math.imul(y|0,0x85ebca6b);
 n=Math.imul(n^(n>>>16),0x7feb352d);
 n=Math.imul(n^(n>>>15),0x846ca68b);
 return ((n^(n>>>16))>>>0)/4294967296;
}
export function skinValueNoise(x:number,y:number,salt=0):number{
 const ix=Math.floor(x),iy=Math.floor(y),fx=x-ix,fy=y-iy;
 const u=fx*fx*(3-2*fx),v=fy*fy*(3-2*fy);
 const lo=skinHash(ix,iy,salt)*(1-u)+skinHash(ix+1,iy,salt)*u;
 const hi=skinHash(ix,iy+1,salt)*(1-u)+skinHash(ix+1,iy+1,salt)*u;
 return lo*(1-v)+hi*v;
}

/** Culls to the viewport and global body coordinate bounds, never to a
 * fixed patch around a shoulder. The alpha silhouette clips all drawing.
 */
export function skinVisibleWorldBounds(
 camera:AnatomyCamera,width:number,height:number,margin=1.4
){
 const a=anatomyScreenToBody(camera,{x:0,y:0},width,height);
 const b=anatomyScreenToBody(camera,{x:width,y:height},width,height);
 return {
  minX:Math.max(0,Math.min(a.x,b.x)-margin),
  maxX:Math.min(360,Math.max(a.x,b.x)+margin),
  minY:Math.max(0,Math.min(a.y,b.y)-margin),
  maxY:Math.min(600,Math.max(a.y,b.y)+margin)
 };
}
export function skinSurfaceInside(x:number,y:number):boolean{
 return Number.isFinite(x)&&Number.isFinite(y)&&
  x>=0&&x<=360&&y>=0&&y<=600;
}
function gridCount(bounds:ReturnType<typeof skinVisibleWorldBounds>,step:number){
 return Math.max(0,Math.floor(bounds.maxX/step)-Math.ceil(bounds.minX/step)+1)*
  Math.max(0,Math.floor(bounds.maxY/step)-Math.ceil(bounds.minY/step)+1);
}
/** Pure LOD selection; returning 0 means the geometry would be subpixel or
 * too expensive at the current view. No abrupt relabelled giant features.
 */
export function skinDrawBudget(
 bounds:ReturnType<typeof skinVisibleWorldBounds>,step:number,scale:number,
 layer:SkinSurfaceLayer
):number{
 const count=gridCount(bounds,step);
 const minimumPixelScale=layer==="corneocytes"?95:
  layer==="pores"?14:layer==="relief"?4.5:1;
 return scale>=minimumPixelScale&&count<=MAX_DRAWN_CELLS?count:0;
}

/** All coordinates below are world-local; source-atop clipping to the
 * real body alpha is performed by the caller. Never draw a circular mask.
 */
export function drawSkinSurfaceField(
 ctx:CanvasRenderingContext2D,scale:number,
 bounds:ReturnType<typeof skinVisibleWorldBounds>,opacity=1
){
 if(bounds.minX>=bounds.maxX||bounds.minY>=bounds.maxY)return;
 const relief=skinSurfaceAlpha(scale,"relief")*opacity;
 const pores=skinSurfaceAlpha(scale,"pores")*opacity;
 const cells=skinSurfaceAlpha(scale,"corneocytes")*opacity;
 if(relief>.001&&skinDrawBudget(bounds,SKIN_RELIEF_STEP_WORLD,scale,"relief")){
  const step=SKIN_RELIEF_STEP_WORLD;
  for(let iy=Math.ceil(bounds.minY/step);iy<=Math.floor(bounds.maxY/step);iy++){
   for(let ix=Math.ceil(bounds.minX/step);ix<=Math.floor(bounds.maxX/step);ix++){
    const r=skinHash(ix,iy,13),tone=skinValueNoise(ix*.37,iy*.37,8);
    const x=step*(ix+.22+.55*skinHash(ix,iy,19));
    const y=step*(iy+.22+.55*skinHash(ix,iy,21));
    ctx.globalAlpha=relief*(.017+.035*tone);
    ctx.strokeStyle=tone>.5?"#8d6459":"#ffe0c2";
    ctx.lineWidth=.025+.022*r;
    ctx.beginPath();
    ctx.moveTo(x-step*.32,y-step*.32);
    ctx.quadraticCurveTo(x+(r-.5)*step*.3,y,
     x+step*.32,y+step*.33);
    ctx.stroke();
   }
  }
 }
 if(pores>.001&&skinDrawBudget(bounds,SKIN_PORE_STEP_WORLD,scale,"pores")){
  const step=SKIN_PORE_STEP_WORLD;
  for(let iy=Math.ceil(bounds.minY/step);iy<=Math.floor(bounds.maxY/step);iy++){
   for(let ix=Math.ceil(bounds.minX/step);ix<=Math.floor(bounds.maxX/step);ix++){
    const x=step*(ix+.18+.60*skinHash(ix,iy,41));
    const y=step*(iy+.18+.60*skinHash(ix,iy,43));
    const variant=skinHash(ix,iy,47);
    // Typical apparent pore diameter is a fraction of a millimeter,
    // about .03-.07 world units on this 170-cm model. This means ~0.5
    // screen px at 10x and 2-3 px at 50x, NOT a giant textured circle.
    const radius=.016+.020*variant;
    ctx.globalAlpha=pores*(.13+.11*variant);
    ctx.fillStyle="#b77969";
    ctx.beginPath();ctx.ellipse(x,y,radius*1.5,radius*1.2,0,0,Math.PI*2);
    ctx.fill();
    ctx.globalAlpha=pores*(.22+.13*variant);
    ctx.fillStyle="#956b63";
    ctx.beginPath();ctx.ellipse(x,y,radius*.58,radius*.47,0,0,Math.PI*2);
    ctx.fill();
    if(variant>.972){
     ctx.globalAlpha=pores*.20;
     ctx.strokeStyle="#82655a";ctx.lineWidth=.018;
     ctx.beginPath();ctx.moveTo(x,y);
     ctx.quadraticCurveTo(x+.10,y-.34,x+.09,y-.65);
     ctx.stroke();
    }
   }
  }
 }
 if(cells>.001&&skinDrawBudget(bounds,SKIN_CORNEOCYTE_STEP_WORLD,scale,"corneocytes")){
  const step=SKIN_CORNEOCYTE_STEP_WORLD;
  for(let iy=Math.ceil(bounds.minY/step);iy<=Math.floor(bounds.maxY/step);iy++){
   for(let ix=Math.ceil(bounds.minX/step);ix<=Math.floor(bounds.maxX/step);ix++){
    const x=step*(ix+(iy%2)*.5),y=step*iy;
    const tone=skinHash(ix,iy,73);
    const radius=step*(.50+.09*(tone-.5));
    ctx.globalAlpha=cells*(.14+.13*tone);
    ctx.strokeStyle="#ab786b";ctx.lineWidth=.0028;
    ctx.beginPath();
    for(let i=0;i<6;i++){
     const a=i*Math.PI/3;
     const vx=x+Math.cos(a)*radius,vy=y+Math.sin(a)*radius;
     if(!i)ctx.moveTo(vx,vy);else ctx.lineTo(vx,vy);
    }
    ctx.closePath();ctx.stroke();
   }
  }
 }
 ctx.globalAlpha=1;
}
