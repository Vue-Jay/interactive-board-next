/** Continuous, deterministic surface detail for the WHOLE 360x600 body.
 * Coordinates are anatomical world units, never screen pixels. Pores,
 * furrows and ridge patterns never change position during zoom or pan.
 * This is a teaching reconstruction, not a measured dermoscopy specimen.
 */
import {anatomyScreenToBody} from "./lektrusAnatomySemanticZoom";
import type {AnatomyCamera} from "./lektrusHumanAnatomyModel";

export type SkinSurfaceLayer="regional"|"relief"|"pores"|"corneocytes";
export type SkinRegion="general"|"palm";
export const APPROX_BODY_HEIGHT_MM=1700;
export const MM_PER_WORLD_UNIT=APPROX_BODY_HEIGHT_MM/600;
/** Coarse relief ~1.8mm; gland spacing ~1.25mm; corneocytes ~34µm.
 * Cell templates are rendered from a separate bounded texture cache.
 */
export const SKIN_RELIEF_STEP_WORLD=.62;
export const SKIN_PORE_STEP_WORLD=.44;
export const SKIN_CORNEOCYTE_STEP_WORLD=.012;
export const SKIN_SURFACE_LEVELS:Readonly<Record<SkinSurfaceLayer,{
 appear:number;full:number;description:string
}>>={
 regional:{appear:2.2,full:7.5,description:"Поверхность тела"},
 relief:{appear:5.5,full:17,description:"Мелкий рельеф и кожные гребни"},
 pores:{appear:16,full:38,description:"Поры и волосяные фолликулы"},
 corneocytes:{appear:155,full:320,description:"Безъядерные чешуйки рогового слоя"}
};
/** Inclusive upper limit on painted individual structures per pass. */
export const MAX_DRAWN_CELLS=8500;
const TARGET_DRAWN_CELLS=2600;
const clamp=(n:number,min:number,max:number)=>
 Number.isFinite(n)?Math.max(min,Math.min(max,n)):min;
export function skinSmoothstep(from:number,to:number,value:number):number{
 const t=clamp((value-from)/Math.max(1e-10,to-from),0,1);
 return t*t*(3-2*t);
}
export function skinSurfaceAlpha(scale:number,layer:SkinSurfaceLayer):number{
 const {appear,full}=SKIN_SURFACE_LEVELS[layer];
 return skinSmoothstep(appear,full,scale);
}
export function skinHash(x:number,y:number,salt=0):number{
 let n=Math.imul((x|0)^salt,0x1b873593)^Math.imul(y|0,0x85ebca6b);
 n=Math.imul(n^(n>>>16),0x7feb352d);
 n=Math.imul(n^(n>>>15),0x846ca68b);
 return ((n^(n>>>16))>>>0)/4294967296;
}
export function skinValueNoise(x:number,y:number,salt=0):number{
 const ix=Math.floor(x),iy=Math.floor(y);
 const fx=x-ix,fy=y-iy;
 const u=fx*fx*(3-2*fx),v=fy*fy*(3-2*fy);
 const lo=skinHash(ix,iy,salt)*(1-u)+skinHash(ix+1,iy,salt)*u;
 const hi=skinHash(ix,iy+1,salt)*(1-u)+skinHash(ix+1,iy+1,salt)*u;
 return lo*(1-v)+hi*v;
}
/** Approximate palms in the frontal illustration. The backs of hands,
 * dorsal feet and other body regions should not inherit palmar ridges.
 * This is region-specific illustration data, not generic biology for every
 * mammal; later atlases will supply species/organ-specific landmarks.
 */
export const SKIN_PALM_ZONES=[
 {x:57,y:331,rx:13,ry:24},
 {x:303,y:331,rx:13,ry:24}
] as const;
export function skinPalmWeight(x:number,y:number):number{
 let weight=0;
 for(const zone of SKIN_PALM_ZONES){
  const dx=(x-zone.x)/zone.rx,dy=(y-zone.y)/zone.ry;
  const radius=Math.hypot(dx,dy);
  weight=Math.max(weight,1-skinSmoothstep(.65,1,radius));
 }
 return weight;
}
export function skinRegionAt(x:number,y:number):SkinRegion{
 return skinPalmWeight(x,y)>=.5?"palm":"general";
}
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
export type SkinBounds=ReturnType<typeof skinVisibleWorldBounds>;
export function skinSurfaceInside(x:number,y:number):boolean{
 return Number.isFinite(x)&&Number.isFinite(y)&&
  x>=0&&x<=360&&y>=0&&y<=600;
}
const gridCount=(bounds:SkinBounds,step:number)=>
 Math.max(0,Math.floor(bounds.maxX/step)-Math.ceil(bounds.minX/step)+1)*
 Math.max(0,Math.floor(bounds.maxY/step)-Math.ceil(bounds.minY/step)+1);
/** An always-on progressive sampler. Earlier code returned 0 when the
 * budget was exceeded, removing the ENTIRE relief/pores layer suddenly.
 * We retain a stable sparse subset, then gradually admit finer samples.
 */
export type SkinSamplingPlan={coarse:number;fine:number;fineOpacity:number;estimated:number};
export function skinSamplingPlan(bounds:SkinBounds,step:number):SkinSamplingPlan{
 if(step<=0)return {coarse:1,fine:1,fineOpacity:0,estimated:0};
 const count=gridCount(bounds,step);
 if(!count)return {coarse:1,fine:1,fineOpacity:0,estimated:0};
 const demand=Math.sqrt(count/TARGET_DRAWN_CELLS);
 if(demand<=1)return {coarse:1,fine:1,fineOpacity:0,estimated:count};
 const coarse=2**Math.ceil(Math.log2(demand));
 const fine=Math.max(1,coarse/2);
 const fineOpacity=1-skinSmoothstep(fine,coarse,demand);
 return {coarse,fine,fineOpacity,
  estimated:Math.min(MAX_DRAWN_CELLS,Math.ceil(count/(fine*fine)))};
}
export function skinDrawBudget(
 bounds:SkinBounds,step:number,scale:number,layer:SkinSurfaceLayer
):number{
 const minScale=layer==="corneocytes"?155:
  layer==="pores"?14:layer==="relief"?4.5:1;
 if(scale<minScale)return 0;
 return skinSamplingPlan(bounds,step).estimated;
}
/** Samples of all levels use the same integer lattice and stable hash.
 * The alpha of newly admitted points rises smoothly, never an all-or-none
 * switch when the camera crosses a viewport-dependent threshold.
 */
function forSkinGrid(
 bounds:SkinBounds,step:number,draw:(ix:number,iy:number,opacity:number)=>void
){
 const plan=skinSamplingPlan(bounds,step);
 if(!plan.estimated)return;
 const minX=Math.ceil(bounds.minX/step),maxX=Math.floor(bounds.maxX/step);
 const minY=Math.ceil(bounds.minY/step),maxY=Math.floor(bounds.maxY/step);
 const fine=plan.fine,coarse=plan.coarse;
 let painted=0;
 for(let iy=Math.ceil(minY/fine)*fine;iy<=maxY;iy+=fine){
  for(let ix=Math.ceil(minX/fine)*fine;ix<=maxX;ix+=fine){
   const original=ix%coarse===0&&iy%coarse===0;
   const alpha=original?1:plan.fineOpacity;
   if(alpha<=.003)continue;
   draw(ix,iy,alpha);
   if(++painted>=MAX_DRAWN_CELLS)return;
  }
 }
}
/** Finger/palm friction ridges are procedurally continuous and non-haired.
 * Each curved line is anchored to global position, independent of zoom.
 */
function drawPalmRidges(ctx:CanvasRenderingContext2D,
 bounds:SkinBounds,scale:number,opacity:number){
 const alpha=skinSurfaceAlpha(scale,"relief")*opacity;
 if(alpha<=.001)return;
 for(const zone of SKIN_PALM_ZONES){
  if(bounds.maxX<zone.x-zone.rx||bounds.minX>zone.x+zone.rx||
   bounds.maxY<zone.y-zone.ry||bounds.minY>zone.y+zone.ry)continue;
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(zone.x,zone.y,zone.rx,zone.ry,0,0,Math.PI*2);
  ctx.clip();
  const step=.19;
  const start=Math.ceil((Math.max(bounds.minY,zone.y-zone.ry)-zone.y)/step);
  const end=Math.floor((Math.min(bounds.maxY,zone.y+zone.ry)-zone.y)/step);
  ctx.lineWidth=.016;ctx.strokeStyle="#94695f";
  for(let i=start;i<=end;i++){
   const y=zone.y+i*step;
   const distance=Math.abs((y-zone.y)/zone.ry);
   ctx.globalAlpha=alpha*.16*(1-skinSmoothstep(.72,1,distance));
   ctx.beginPath();
   ctx.moveTo(zone.x-zone.rx-1,y-.34);
   ctx.bezierCurveTo(zone.x-zone.rx*.38,y+.27,
    zone.x+zone.rx*.34,y-.4,zone.x+zone.rx+1,y+.11);
   ctx.stroke();
  }
  ctx.restore();
 }
}
export function drawSkinSurfaceField(
 ctx:CanvasRenderingContext2D,scale:number,
 bounds:SkinBounds,opacity=1
){
 if(bounds.minX>=bounds.maxX||bounds.minY>=bounds.maxY)return;
 const relief=skinSurfaceAlpha(scale,"relief")*opacity;
 const pores=skinSurfaceAlpha(scale,"pores")*opacity;
 if(relief>.001){
  const step=SKIN_RELIEF_STEP_WORLD;
  forSkinGrid(bounds,step,(ix,iy,levelAlpha)=>{
   const r=skinHash(ix,iy,13),tone=skinValueNoise(ix*.37,iy*.37,8);
   const x=step*(ix+.22+.55*skinHash(ix,iy,19));
   const y=step*(iy+.22+.55*skinHash(ix,iy,21));
   const palm=skinPalmWeight(x,y);
   ctx.globalAlpha=relief*levelAlpha*(.018+.032*tone)*(1-.78*palm);
   ctx.strokeStyle=tone>.5?"#8d6459":"#ffe0c2";
   ctx.lineWidth=.021+.022*r;
   ctx.beginPath();ctx.moveTo(x-step*.32,y-step*.32);
   ctx.quadraticCurveTo(x+(r-.5)*step*.3,y,
    x+step*.32,y+step*.33);
   ctx.stroke();
  });
  drawPalmRidges(ctx,bounds,scale,opacity);
 }
 if(pores>.001){
  const step=SKIN_PORE_STEP_WORLD;
  forSkinGrid(bounds,step,(ix,iy,levelAlpha)=>{
   const x=step*(ix+.18+.60*skinHash(ix,iy,41));
   const y=step*(iy+.18+.60*skinHash(ix,iy,43));
   const variant=skinHash(ix,iy,47);
   const palm=skinPalmWeight(x,y);
   // Sweat pores also occur on non-haired palm skin, while a visible
   // follicle and vellus hair must NEVER be drawn on the palm.
   const radius=.015+.021*variant;
   const alpha=pores*levelAlpha;
   ctx.globalAlpha=alpha*(.11+.1*variant);
   ctx.fillStyle="#b77969";
   ctx.beginPath();ctx.ellipse(x,y,radius*1.5,radius*1.2,0,0,Math.PI*2);
   ctx.fill();
   ctx.globalAlpha=alpha*(.18+.12*variant);
   ctx.fillStyle="#956b63";
   ctx.beginPath();ctx.ellipse(x,y,radius*.58,radius*.47,0,0,Math.PI*2);
   ctx.fill();
   if(variant>.972&&palm<.998){
    ctx.globalAlpha=alpha*.20*(1-palm);
    ctx.strokeStyle="#82655a";ctx.lineWidth=.016;
    ctx.beginPath();ctx.moveTo(x,y);
    ctx.quadraticCurveTo(x+.1,y-.34,x+.09,y-.65);
    ctx.stroke();
   }
  });
 }
 // At deep zoom corneocyte outlines are drawn with a capped, reusable
 // world-tile cache. Never scan millions of cells on every pointer frame.
 ctx.globalAlpha=1;
}
