/** Procedural, world-registered detail on the *surface* of shoulder skin.
 *
 * This is a reusable illustrative skin model, not a patient microscopy image.
 * Nothing in this module depends on how many times the user has zoomed.
 * Every follicle, pore and corneocyte has stable anatomy-local coordinates.
 * Zoom changes only projected size and legibility, never identity/location.
 */
import {anatomyScreenToBody,SKIN_SHOULDER} from "./lektrusAnatomySemanticZoom";
import type {AnatomyCamera} from "./lektrusHumanAnatomyModel";

export type SkinSurfaceLayer="regional"|"relief"|"pores"|"corneocytes";
export const SKIN_SURFACE_LEVELS:Readonly<Record<SkinSurfaceLayer,{
 appear:number;full:number;description:string
}>>={
 regional:{appear:1.3,full:3.4,description:"Кожа плеча"},
 relief:{appear:3.2,full:8,description:"Микрорельеф кожи"},
 pores:{appear:6,full:13,description:"Поры и волосяные фолликулы"},
 corneocytes:{appear:15,full:34,description:"Роговые чешуйки эпидермиса"}
};
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
/** Fixed integer hash: works offline, stable on PC and on Android. */
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
export const SKIN_SURFACE_REGION={
 x:SKIN_SHOULDER.x,y:SKIN_SHOULDER.y,
 width:SKIN_SHOULDER.width,height:SKIN_SHOULDER.height
} as const;
export function skinVisibleWorldBounds(
 camera:AnatomyCamera,width:number,height:number,margin=4
){
 const a=anatomyScreenToBody(camera,{x:0,y:0},width,height);
 const b=anatomyScreenToBody(camera,{x:width,y:height},width,height);
 const minX=Math.max(SKIN_SURFACE_REGION.x,Math.min(a.x,b.x)-margin);
 const maxX=Math.min(SKIN_SURFACE_REGION.x+SKIN_SURFACE_REGION.width,
  Math.max(a.x,b.x)+margin);
 const minY=Math.max(SKIN_SURFACE_REGION.y,Math.min(a.y,b.y)-margin);
 const maxY=Math.min(SKIN_SURFACE_REGION.y+SKIN_SURFACE_REGION.height,
  Math.max(a.y,b.y)+margin);
 return {minX,maxX,minY,maxY};
}
export function skinSurfaceInside(x:number,y:number):boolean{
 // A feathered shoulder patch, not an unbounded blanket on the abdomen.
 const region=SKIN_SURFACE_REGION;
 const nx=(x-(region.x+region.width/2))/(region.width/2);
 const ny=(y-(region.y+region.height/2))/(region.height/2);
 return nx*nx+ny*ny<1;
}
export function skinSurfaceEdgeOpacity(x:number,y:number):number{
 const r=SKIN_SURFACE_REGION;
 const dx=(x-(r.x+r.width/2))/(r.width/2);
 const dy=(y-(r.y+r.height/2))/(r.height/2);
 return 1-skinSmoothstep(.59,1,Math.sqrt(dx*dx+dy*dy));
}
const MAX_DRAWN_CELLS=7000;
function cellsVisible(bounds:ReturnType<typeof skinVisibleWorldBounds>,step:number){
 const columns=Math.max(0,Math.floor(bounds.maxX/step)-Math.ceil(bounds.minX/step)+1);
 const rows=Math.max(0,Math.floor(bounds.maxY/step)-Math.ceil(bounds.minY/step)+1);
 return columns*rows;
}
/** Draw in already-transformed 360x600 body-local coordinates.
 * Only the visible grid is evaluated, never the million offscreen pores.
 */
export function drawSkinSurfaceField(ctx:CanvasRenderingContext2D,
 scale:number,bounds:ReturnType<typeof skinVisibleWorldBounds>,opacity=1){
 if(bounds.minX>=bounds.maxX||bounds.minY>=bounds.maxY)return;
 const relief=skinSurfaceAlpha(scale,"relief");
 const pores=skinSurfaceAlpha(scale,"pores");
 const cells=skinSurfaceAlpha(scale,"corneocytes");
 // Coherent low-frequency color variation. No image swap or atlas fade-out.
 if(relief>.001&&cellsVisible(bounds,3.4)<MAX_DRAWN_CELLS){
  const step=3.4;
  for(let iy=Math.ceil(bounds.minY/step);iy<=Math.floor(bounds.maxY/step);iy++){
   for(let ix=Math.ceil(bounds.minX/step);ix<=Math.floor(bounds.maxX/step);ix++){
    const x=ix*step,y=iy*step;
    const edge=skinSurfaceEdgeOpacity(x,y);
    if(edge<=0)continue;
    const tone=skinValueNoise(ix*.49,iy*.49,18);
    const alpha=relief*edge*(.035+.11*tone);
    ctx.fillStyle=tone>.5?"#fff0d9":"#844c49";
    ctx.globalAlpha=alpha*opacity;
    ctx.beginPath();ctx.ellipse(x,y,step*1.5,step*.95,
     (tone-.5)*.45,0,Math.PI*2);
    ctx.fill();
    // Skin furrows are irregular, gently curved and world-registered.
    const bend=(skinHash(ix,iy,7)-.5)*step;
    ctx.globalAlpha=alpha*.65*opacity;
    ctx.strokeStyle="#8b5750";ctx.lineWidth=.06+.06*tone;
    ctx.beginPath();
    ctx.moveTo(x-step*.42,y-step*.5);
    ctx.quadraticCurveTo(x+bend,y,x+step*.47,y+step*.48);
    ctx.stroke();
   }
  }
 }
 // Pores live on a coarse stable (jittered) lattice. At distant zooms
 // subpixel pores are faded out, not blown up with a low-res photograph.
 if(pores>.001&&cellsVisible(bounds,5.8)<MAX_DRAWN_CELLS){
  const step=5.8;
  for(let iy=Math.ceil(bounds.minY/step);iy<=Math.floor(bounds.maxY/step);iy++){
   for(let ix=Math.ceil(bounds.minX/step);ix<=Math.floor(bounds.maxX/step);ix++){
    const x=step*(ix+.16+.65*skinHash(ix,iy,13));
    const y=step*(iy+.16+.65*skinHash(ix,iy,29));
    const edge=skinSurfaceEdgeOpacity(x,y);
    if(edge<=0)continue;
    const variant=skinHash(ix,iy,47);
    const radius=.28+variant*.25;
    const alpha=pores*edge;
    ctx.globalAlpha=alpha*.33*opacity;
    ctx.fillStyle="#d58974";ctx.beginPath();
    ctx.ellipse(x,y,radius*1.9,radius*1.55,0,0,Math.PI*2);
    ctx.fill();
    ctx.globalAlpha=alpha*.5*opacity;
    ctx.fillStyle="#7a4943";ctx.beginPath();
    ctx.ellipse(x,y,radius*.7,radius*.48,0,0,Math.PI*2);
    ctx.fill();
    if(variant>.87){
     // Vellus hair emerging from this exact follicle, not a sprite overlay.
     ctx.globalAlpha=alpha*.37*opacity;
     ctx.strokeStyle="#795b4a";ctx.lineWidth=.095;
     ctx.beginPath();ctx.moveTo(x,y);
     ctx.quadraticCurveTo(x+1.3,y-2.4,x+.8,y-4.5);
     ctx.stroke();
    }
   }
  }
 }
 // World-locked polygonal corneocytes; no nuclei, as expected on the
 // outer stratum corneum. Reused across body regions with different seeds.
 if(cells>.001&&cellsVisible(bounds,.82)<MAX_DRAWN_CELLS){
  const step=.82;
  for(let iy=Math.ceil(bounds.minY/step);iy<=Math.floor(bounds.maxY/step);iy++){
   for(let ix=Math.ceil(bounds.minX/step);ix<=Math.floor(bounds.maxX/step);ix++){
    const x=step*(ix+(iy%2)*.5),y=step*iy;
    const edge=skinSurfaceEdgeOpacity(x,y);
    if(edge<=0)continue;
    const intensity=skinHash(ix,iy,73);
    const alpha=cells*edge;
    ctx.globalAlpha=alpha*(.23+.22*intensity)*opacity;
    ctx.fillStyle=intensity>.51?"#f4c7a8":"#c98374";
    ctx.strokeStyle="#ad6e60";ctx.lineWidth=.045;
    ctx.beginPath();
    for(let i=0;i<6;i++){
     const angle=i*Math.PI/3;
     const radial=step*(.55+.09*(skinHash(ix+i,iy,91)-.5));
     const vx=x+Math.cos(angle)*radial;
     const vy=y+Math.sin(angle)*radial;
     if(i===0)ctx.moveTo(vx,vy);else ctx.lineTo(vx,vy);
    }
    ctx.closePath();ctx.fill();
    ctx.globalAlpha=alpha*.47*opacity;ctx.stroke();
   }
  }
 }
 ctx.globalAlpha=1;
}
