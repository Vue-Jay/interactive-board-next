/** Scale-aware human skin histology, registered to the 360 x 600 body.
 * Expanded teaching cutaways do NOT enlarge individual cells: the nuclei,
 * keratinocytes and adipocytes retain dimensions in body-world units.
 * At ordinary zoom we show dermal connective tissue, not gigantic cells.
 * Geometry is deterministic and restricted to the visible tissue bands.
 */
import type {SkinSectionContour,SkinSectionPoint} from "./lektrusSkinVectorSections";

export type SkinMicroBounds={minX:number;maxX:number;minY:number;maxY:number};
export const SKIN_MM_PER_WORLD_UNIT=1700/600;
export const SKIN_ADIPOCYTE_GRID_WORLD=.033; // ~94 micrometres between centers
export const SKIN_KERATINOCYTE_GRID_WORLD=.0085; // ~24 micrometres
export const SKIN_COLLAGEN_GRID_WORLD=.105;
export const SKIN_MICRO_MAX_MARKS=6000;
const smooth=(a:number,b:number,value:number)=>{
 const t=Math.max(0,Math.min(1,(value-a)/Math.max(.00001,b-a)));
 return t*t*(3-2*t);
};
/** Explicit stage gates: at 24x the eye sees tissue, NOT huge individual cells. */
export function skinMicroOpacity(scale:number){
 return {collagen:smooth(8,38,scale),adipocytes:smooth(65,145,scale),
  keratinocytes:smooth(145,310,scale)};
}
export function skinMicroCellDiameterMicrons(kind:"adipocyte"|"keratinocyte"){
 return kind==="adipocyte"?{min:65,max:105}:{min:17,max:27};
}
export function skinMicroHash(x:number,y:number,salt=0):number{
 let v=Math.imul((x|0)^salt,0x1b873593)^Math.imul(y|0,0x85ebca6b);
 v=Math.imul(v^(v>>>16),0x7feb352d);
 v=Math.imul(v^(v>>>15),0x846ca68b);
 return ((v^(v>>>16))>>>0)/4294967296;
}
type Band={start:number;end:number};
/** Index lookup is logarithmic in contour length: world positions stay
 * stationary during camera animation, unlike frame-local raster stamps. */
function contourAt(c:SkinSectionContour,y:number):SkinSectionPoint|null{
 const list=c.points;
 if(list.length<2||y<list[0].y||y>list[list.length-1].y)return null;
 let lo=0,hi=list.length-1;
 while(hi-lo>1){
  const m=(hi+lo)>>1;
  if(list[m].y<=y)lo=m;else hi=m;
 }
 const a=list[lo],b=list[hi];
 const t=Math.max(0,Math.min(1,(y-a.y)/Math.max(1e-7,b.y-a.y)));
 return {x:a.x+(b.x-a.x)*t,y,depth:a.depth+(b.depth-a.depth)*t};
}
function inView(c:SkinSectionContour,b:SkinMicroBounds):boolean{
 return c.maxX>=b.minX&&c.minX<=b.maxX&&
  c.maxY>=b.minY&&c.minY<=b.maxY;
}
/** Iterate an anchored world grid along the true contour band. Each tier
 * has an independent budget and camera-stable power-of-two thinning. */
function paintGrid(
 ctx:CanvasRenderingContext2D,
 contours:readonly SkinSectionContour[],bounds:SkinMicroBounds,
 step:number,band:Band,budget:number,
 draw:(x:number,y:number,ix:number,iy:number)=>void
):number{
 if(bounds.minX>=bounds.maxX||bounds.minY>=bounds.maxY)return 0;
 let count=0;
 const visible=contours.filter(c=>inView(c,bounds));
 // Conservative density estimate for the actual section, not full viewport.
 let estimate=0;
 for(const c of visible){
  const h=Math.max(0,Math.min(bounds.maxY,c.maxY)-
   Math.max(bounds.minY,c.minY));
  const width=Math.min(bounds.maxX-bounds.minX,
   (band.end-band.start)*8.4);
  estimate+=h*width/(step*step);
 }
 if(!estimate)return 0;
 const stride=2**Math.max(0,Math.ceil(Math.log2(Math.sqrt(
  estimate/Math.max(1,budget)))));
 const jump=step*stride;
 for(const c of visible){
  const startY=Math.max(bounds.minY,c.minY);
  const endY=Math.min(bounds.maxY,c.maxY);
  const firstY=Math.ceil(startY/jump),lastY=Math.floor(endY/jump);
  for(let iy=firstY;iy<=lastY;iy++){
   const y=iy*jump;
   const p=contourAt(c,y);
   if(!p||p.depth<.02)continue;
   const left=p.x+c.inward*p.depth*band.start;
   const right=p.x+c.inward*p.depth*band.end;
   const minX=Math.max(bounds.minX,Math.min(left,right));
   const maxX=Math.min(bounds.maxX,Math.max(left,right));
   if(maxX<=minX)continue;
   const startX=Math.ceil(minX/jump),endX=Math.floor(maxX/jump);
   for(let ix=startX;ix<=endX;ix++){
    const x=ix*jump;
    draw(x,y,ix*stride,iy*stride);
    if(++count>=budget)return count;
   }
  }
 }
 return count;
}
/** Canvas output is clipped by clipSkinSection upstream and further limited
 * to the matching histological band here. No epidermal blood vessels. */
export function drawSkinMicroscopicDetails(
 ctx:CanvasRenderingContext2D,
 contours:readonly SkinSectionContour[],scale:number,
 bounds:SkinMicroBounds
):{collagen:number;adipocytes:number;keratinocytes:number}{
 const level=skinMicroOpacity(scale);
 const result={collagen:0,adipocytes:0,keratinocytes:0};
 if(level.collagen>.003){
  ctx.save();
  ctx.globalAlpha=.23*level.collagen;
  ctx.strokeStyle="#9e6a78";
  ctx.lineWidth=.0034;
  result.collagen=paintGrid(ctx,contours,bounds,SKIN_COLLAGEN_GRID_WORLD,
   {start:.15,end:.53},1400,(x,y,ix,iy)=>{
    const bend=(skinMicroHash(ix,iy,81)-.5)*.06;
    const length=.045+.05*skinMicroHash(ix,iy,83);
    ctx.beginPath();ctx.moveTo(x-length*.5,y-bend);
    ctx.quadraticCurveTo(x,y+.035+bend,x+length*.5,y+bend);
    ctx.stroke();
   });
  ctx.restore();
 }
 if(level.adipocytes>.003){
  ctx.save();
  ctx.globalAlpha=.62*level.adipocytes;
  result.adipocytes=paintGrid(ctx,contours,bounds,
   SKIN_ADIPOCYTE_GRID_WORLD,{start:.55,end:.985},SKIN_MICRO_MAX_MARKS,
   (x,y,ix,iy)=>{
    const jitter=.12*SKIN_ADIPOCYTE_GRID_WORLD;
    const px=x+(skinMicroHash(ix,iy,11)-.5)*jitter;
    const py=y+(skinMicroHash(ix,iy,17)-.5)*jitter;
    // 65-105 µm diameter (≈ .023-.037 world units), not 1-3 mm.
    const radius=(.023+.014*skinMicroHash(ix,iy,19))/2;
    ctx.fillStyle="#fae5ab";ctx.strokeStyle="#cdab83";
    ctx.lineWidth=.00135;
    ctx.beginPath();ctx.ellipse(px,py,radius,radius*.94,0,0,Math.PI*2);
    ctx.fill();ctx.stroke();
    if(scale>=175){
     const nuclearRadius=.0018;
     ctx.fillStyle="#98647c";
     ctx.beginPath();
     ctx.ellipse(px+radius*.80,py-radius*.39,
      nuclearRadius,nuclearRadius*.72,0,0,Math.PI*2);
     ctx.fill();
    }
   });
  ctx.restore();
 }
 if(level.keratinocytes>.003){
  ctx.save();
  ctx.globalAlpha=.72*level.keratinocytes;
  result.keratinocytes=paintGrid(ctx,contours,bounds,
   SKIN_KERATINOCYTE_GRID_WORLD,{start:.007,end:.127},
   SKIN_MICRO_MAX_MARKS,(x,y,ix,iy)=>{
    const j=(skinMicroHash(ix,iy,23)-.5)*.0012;
    // ~17-27 µm diameter: individual cells are only resolved under
    // deep magnification, while tissue bands remain visible much earlier.
    const radius=(.006+.0035*skinMicroHash(ix,iy,29))/2;
    const px=x+j,py=y+(skinMicroHash(ix,iy,31)-.5)*.0012;
    ctx.fillStyle="#f3c5bd";ctx.strokeStyle="#ae8288";
    ctx.lineWidth=.00085;
    ctx.beginPath();
    ctx.ellipse(px,py,radius,radius*.89,0,0,Math.PI*2);
    ctx.fill();ctx.stroke();
    // Surface corneocytes are anucleate; granular/spinous/basal cells
    // are nucleated. Only small nuclei, never giant pink dots.
    if(scale>=230){
     const nuclearRadius=.0011;
     ctx.fillStyle="#8c627a";
     ctx.beginPath();ctx.ellipse(px,py,nuclearRadius,
      nuclearRadius*.76,0,0,Math.PI*2);ctx.fill();
    }
   });
  ctx.restore();
 }
 return result;
}
