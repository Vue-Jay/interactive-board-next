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
/** Epidermis strata from surface toward the dermal basement membrane.
 * The expanded cutaway is schematic, not a measured tissue thickness. */
export type SkinEpidermisStratum="corneum"|"granulosum"|"spinosum"|"basale";
export function skinEpidermisStratum(fraction:number):SkinEpidermisStratum|null{
 if(fraction<.007||fraction>=.13)return null;
 if(fraction<.025)return "corneum";
 if(fraction<.046)return "granulosum";
 if(fraction<.107)return "spinosum";
 return "basale";
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
 contours:readonly SkinSectionContour[],bounds:SkinMicroBounds,
 step:number,band:Band,budget:number,
 draw:(x:number,y:number,ix:number,iy:number,depthFraction:number)=>void
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
    const fraction=(x-p.x)/(c.inward*p.depth);
    if(fraction<band.start||fraction>band.end)continue;
    draw(x,y,ix*stride,iy*stride,fraction);
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
  result.collagen=paintGrid(contours,bounds,SKIN_COLLAGEN_GRID_WORLD,
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
  result.adipocytes=paintGrid(contours,bounds,
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
  result.keratinocytes=paintGrid(contours,bounds,
   SKIN_KERATINOCYTE_GRID_WORLD,{start:.007,end:.127},
   SKIN_MICRO_MAX_MARKS,(x,y,ix,iy,fraction)=>{
    const stratum=skinEpidermisStratum(fraction);
    if(!stratum)return;
    const j=(skinMicroHash(ix,iy,23)-.5)*.0012;
    // 17-27 µm: all radii stay anchored in body-world units.
    const radius=(.006+.0035*skinMicroHash(ix,iy,29))/2;
    const px=x+j,py=y+(skinMicroHash(ix,iy,31)-.5)*.0012;
    ctx.fillStyle=stratum==="corneum"?"#f7ddc8":
     stratum==="granulosum"?"#e8b3b0":
     stratum==="basale"?"#cf8e9e":"#f3c5bd";
    ctx.strokeStyle=stratum==="corneum"?"#d9b5a8":"#ae8288";
    ctx.lineWidth=.00085;ctx.beginPath();
    if(stratum==="corneum"){
     // Anucleate, flattened corneocytes.
     ctx.ellipse(px,py,radius*1.07,radius*.48,0,0,Math.PI*2);
    }else ctx.ellipse(px,py,radius,radius*.89,0,0,Math.PI*2);
    ctx.fill();ctx.stroke();
    if(scale>=230&&stratum!=="corneum"){
     const nr=stratum==="basale"?.0012:.00095;
     ctx.fillStyle="#8c627a";ctx.beginPath();
     ctx.ellipse(px,py,nr,nr*.76,0,0,Math.PI*2);ctx.fill();
    }
    if(scale>=285&&stratum==="granulosum"){
     // Keratohyalin granules belong only to stratum granulosum.
     ctx.fillStyle="#9d7087";ctx.beginPath();
     ctx.arc(px-radius*.35,py+radius*.20,.00058,0,Math.PI*2);
     ctx.arc(px+radius*.39,py-radius*.20,.00053,0,Math.PI*2);
     ctx.fill();
    }
    if(scale>=300&&stratum==="basale"&&
     skinMicroHash(ix,iy,43)>.989){
     // Occasional pigmented melanocyte among basal keratinocytes.
     ctx.fillStyle="#795752";ctx.beginPath();
     ctx.ellipse(px,py,radius*.76,radius*.8,0,0,Math.PI*2);
     ctx.fill();
    }
   });
  ctx.restore();
 }
 return result;
}


/** Sub-millimetre cutaway structures. Geometry uses body-world units:
 * 1 world unit corresponds to roughly 2.83 mm on the reference figure.
 * The schematic thickness of the section never multiplies fine radii. */
export const SKIN_FINE_MAX_MARKS=2200;
export function skinFineStructureOpacity(scale:number){
 return {
  elastic:smooth(20,68,scale),
  papillae:smooth(62,145,scale),
  plexus:smooth(85,185,scale),
  fibroblasts:smooth(110,225,scale),
  septa:smooth(115,230,scale),
  granules:smooth(215,335,scale)
 };
}
/** Rendered after the coarse organ/appendage plate and under the same
 * silhouette-vector clip. There is no off-body or unbounded microtile work. */
export function drawSkinFineStructures(
 ctx:CanvasRenderingContext2D,
 contours:readonly SkinSectionContour[],scale:number,bounds:SkinMicroBounds
):{elastic:number;papillae:number;plexus:number;fibroblasts:number;
 septa:number;granules:number}{
 const a=skinFineStructureOpacity(scale);
 const result={elastic:0,papillae:0,plexus:0,
  fibroblasts:0,septa:0,granules:0};
 if(a.elastic>.004){
  ctx.save();ctx.globalAlpha=.37*a.elastic;
  ctx.strokeStyle="#ad7384";ctx.lineWidth=.0025;
  result.elastic=paintGrid(contours,bounds,.125,
   {start:.21,end:.51},950,(x,y,ix,iy)=>{
    const q=skinMicroHash(ix,iy,101);
    const length=.065+.05*q;
    ctx.beginPath();ctx.moveTo(x-length/2,y-.023);
    ctx.bezierCurveTo(x-length*.18,y+.028,
     x+length*.18,y-.029,x+length/2,y+.022);
    ctx.stroke();
   });
  ctx.restore();
 }
 if(a.papillae>.004){
  // A thin, gently scalloped dermal papilla boundary; small 30-70µm
  // ondulations, not large loops or vessels inside epidermis.
  ctx.save();ctx.strokeStyle="#a86980";
  ctx.lineWidth=.0022;ctx.globalAlpha=.66*a.papillae;
  for(const c of contours){
   if(!inView(c,bounds))continue;
   const from=Math.max(c.minY,bounds.minY-.05);
   const to=Math.min(c.maxY,bounds.maxY+.05);
   let started=false;
   ctx.beginPath();
   for(let iy=Math.ceil(from/.032);iy*.032<=to;iy++){
    const y=iy*.032,p=contourAt(c,y);
    if(!p||p.depth<.025){started=false;continue;}
    const displacement=.012+.012*(1+Math.sin(y*36.2+c.inward*.7));
    const x=p.x+c.inward*(p.depth*.13+displacement);
    if(!started){ctx.moveTo(x,y);started=true;}
    else ctx.lineTo(x,y);
    result.papillae++;
    if(result.papillae>=SKIN_FINE_MAX_MARKS)break;
   }
   ctx.stroke();
   if(result.papillae>=SKIN_FINE_MAX_MARKS)break;
  }
  ctx.restore();
 }
 if(a.plexus>.004){
  ctx.save();ctx.globalAlpha=.40*a.plexus;
  ctx.lineWidth=.003;ctx.strokeStyle="#b64c69";
  result.plexus=paintGrid(contours,bounds,.22,
   {start:.155,end:.25},420,(x,y,ix,iy)=>{
    // Local dermal capillary loops, with both limbs still inside dermis.
    const arc=.020+.013*skinMicroHash(ix,iy,51);
    ctx.beginPath();ctx.moveTo(x-.024,y+.03);
    ctx.quadraticCurveTo(x-arc,y-.03,x,y-.032);
    ctx.quadraticCurveTo(x+arc,y-.03,x+.025,y+.03);
    ctx.stroke();
   });
  ctx.restore();
 }
 if(a.fibroblasts>.004){
  ctx.save();ctx.globalAlpha=.48*a.fibroblasts;
  result.fibroblasts=paintGrid(contours,bounds,.16,
   {start:.23,end:.52},500,(x,y,ix,iy)=>{
    const direction=skinMicroHash(ix,iy,107);
    const x2=(direction-.5)*.025;
    // Spindle-shaped, nucleated fibroblasts in the reticular dermis.
    ctx.fillStyle="#d398a5";ctx.strokeStyle="#9d677c";
    ctx.lineWidth=.0018;ctx.beginPath();
    ctx.ellipse(x,y,.008,.0034,x2,0,Math.PI*2);
    ctx.fill();ctx.stroke();
    ctx.fillStyle="#77576d";ctx.beginPath();
    ctx.ellipse(x,y,.0027,.0015,x2,0,Math.PI*2);ctx.fill();
   });
  ctx.restore();
 }
 if(a.septa>.004){
  ctx.save();ctx.globalAlpha=.38*a.septa;
  ctx.lineWidth=.004;ctx.strokeStyle="#b58e69";
  result.septa=paintGrid(contours,bounds,.14,
   {start:.59,end:.96},650,(x,y,ix,iy)=>{
    const bend=skinMicroHash(ix,iy,69)-.5;
    // Fine collagen septa between groups of white adipocytes.
    ctx.beginPath();ctx.moveTo(x-.05,y-bend*.07);
    ctx.quadraticCurveTo(x+.012,y-.022,x+.06,y+bend*.08);
    ctx.stroke();
   });
  ctx.restore();
 }
 if(a.granules>.004){
  ctx.save();ctx.globalAlpha=.68*a.granules;
  ctx.fillStyle="#91677f";
  result.granules=paintGrid(contours,bounds,.014,
   {start:.026,end:.044},SKIN_FINE_MAX_MARKS,
   (x,y,ix,iy)=>{
    // 3-4 µm keratohyalin granules: subcellular detail only in granulosum.
    const jitter=(skinMicroHash(ix,iy,11)-.5)*.001;
    ctx.beginPath();ctx.arc(x+jitter,y,.00065,0,Math.PI*2);
    ctx.fill();
   });
  ctx.restore();
 }
 return result;
}
