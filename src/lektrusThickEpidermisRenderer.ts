/** Compact glabrous epidermis illustration at a user-selected body site.
 * It is an expressly VIRTUAL five-layer side cutaway attached to the
 * hand/foot landmark, not a claim that the neutral frontal plate exposes
 * the palm or sole. No pseudo-hair or fictitious microscope calibration.
 *
 * Reference anatomy: OpenStax A&P 2e §5.1; Leeds Thick/Thin Skin;
 * University of Minnesota MHS 235/MH 091bhr thick-skin slides.
 */
import type {SkinSectionPoint} from "./lektrusSkinVectorSections";
import {thickSkinInfluence,thickSkinBandsAt,thickSkinBoundaryAt,
 THICK_SKIN_SPAN,type ThickSkinSample} from "./lektrusThickEpidermis";
import type {EpidermisId} from "./lektrusEpidermisAtlas";
import {sectionAtY} from "./lektrusEpidermisAtlas";

type Bounds={minX:number;maxX:number;minY:number;maxY:number};
export type ThickEpidermisStats={bands:number;lamellae:number;cells:number;granules:number};
export const THICK_EPIDERMIS_MAX_CELLS=920;
const clamp=(v:number,a:number,b:number)=>Math.min(b,Math.max(a,v));
function samplePoints(site:ThickSkinSample,b:Bounds,ppu:number,detailed:boolean){
 const c=site.contour;
 const minY=Math.max(c.minY,site.anchor.y-THICK_SKIN_SPAN,b.minY-.08);
 const maxY=Math.min(c.maxY,site.anchor.y+THICK_SKIN_SPAN,b.maxY+.08);
 if(maxY<=minY)return [] as SkinSectionPoint[];
 const step=detailed?clamp(3/Math.max(1,ppu),.009,.09):.11;
 const count=Math.min(620,Math.max(2,Math.ceil((maxY-minY)/step)));
 const points:SkinSectionPoint[]=[];
 for(let i=0;i<=count;i++){
  const y=minY+(maxY-minY)*i/count;
  const p=sectionAtY(c,y);
  if(p)points.push(p);
 }
 return points;
}
function edgeX(site:ThickSkinSample,p:SkinSectionPoint,index:number,
 side:"start"|"end"){
 const w=thickSkinInfluence(site.contour,p.y,site);
 const layers=thickSkinBandsAt(site.contour,p.y,site);
 const layer=layers[index];
 const f=side==="start"?layer.start:layer.end;
 const width=layers[layers.length-1].end;
 return p.x+site.contour.inward*p.depth*
  thickSkinBoundaryAt(p.y,f,width,w);
}
function layerPath(ctx:CanvasRenderingContext2D,site:ThickSkinSample,
 points:readonly SkinSectionPoint[],index:number){
 if(points.length<2)return;
 ctx.beginPath();
 for(let i=0;i<points.length;i++){
  const p=points[i],x=edgeX(site,p,index,"start");
  if(i===0)ctx.moveTo(x,p.y);else ctx.lineTo(x,p.y);
 }
 for(let i=points.length-1;i>=0;i--){
  const p=points[i];ctx.lineTo(edgeX(site,p,index,"end"),p.y);
 }
 ctx.closePath();
}
function histologyLamina(
 ctx:CanvasRenderingContext2D,site:ThickSkinSample,
 bounds:Bounds,index:number,position:number,alpha:number
){
 const start=Math.max(site.anchor.y-THICK_SKIN_SPAN,bounds.minY);
 const end=Math.min(site.anchor.y+THICK_SKIN_SPAN,bounds.maxY);
 const step=Math.max(.02,(end-start)/240);
 ctx.beginPath();let has=false;
 for(let y=start;y<=end;y+=step){
  const p=sectionAtY(site.contour,y);
  if(!p||thickSkinInfluence(site.contour,y,site)<.18)continue;
  const a=edgeX(site,p,index,"start"),b=edgeX(site,p,index,"end");
  const x=a+(b-a)*position;
  if(!has)ctx.moveTo(x,y);else ctx.lineTo(x,y);
  has=true;
 }
 if(has){ctx.globalAlpha=alpha;ctx.stroke();}
}
function hash(i:number,j:number){
 let v=Math.imul(i,0x9e3779b1)^Math.imul(j,0x85ebca6b);
 v=Math.imul(v^(v>>>15),0x846ca68b);
 return ((v^(v>>>16))>>>0)/4294967296;
}
export function drawThickEpidermisSample(
 ctx:CanvasRenderingContext2D,site:ThickSkinSample|null,
 scale:number,bounds:Bounds,selected:EpidermisId|null,
 detailed:boolean,pixelsPerWorld:number
):ThickEpidermisStats{
 const stats:ThickEpidermisStats={bands:0,lamellae:0,cells:0,granules:0};
 if(!site||scale<11)return stats;
 if(site.anchor.x<bounds.minX-12||site.anchor.x>bounds.maxX+12||
  site.anchor.y<bounds.minY-THICK_SKIN_SPAN||
  site.anchor.y>bounds.maxY+THICK_SKIN_SPAN)return stats;
 const points=samplePoints(site,bounds,pixelsPerWorld,detailed);
 if(points.length<2)return stats;
 const fade=clamp((scale-11)/30,0,1);
 const sampleLayer=thickSkinBandsAt(site.contour,site.anchor.y,site);
 ctx.save();
 for(let k=0;k<sampleLayer.length;k++){
  layerPath(ctx,site,points,k);
  ctx.globalAlpha=.97*fade;
  ctx.fillStyle=sampleLayer[k].color;ctx.fill();stats.bands++;
  if(selected===sampleLayer[k].id){
   ctx.globalAlpha=.30*fade;
   ctx.fillStyle="#ffe69a";ctx.fill();
  }
 }
 // A clear, thin and subtle stratum lucidum. It has neither living nuclei
 // nor tiny painted "cells", and it can be indistinct in ordinary H&E.
 if(detailed&&fade>.4){
  ctx.strokeStyle="#faeee6";ctx.lineWidth=.0014;
  for(let k=0;k<5;k++){
   histologyLamina(ctx,site,bounds,0,(k+.6)/6,.22*fade);
   stats.lamellae++;
  }
  ctx.strokeStyle="#fdf4e8";ctx.lineWidth=.0011;
  for(const f of [.32,.68]){
   histologyLamina(ctx,site,bounds,1,f,.30*fade);
   stats.lamellae++;
  }
 }
 // A few restrained keratohyalin foci within granular keratinocytes,
 // and a morphologically correct ONE-row basal tier. They are indicative
 // anatomy, not invented measured cells from the depicted person.
 if(detailed&&scale>=155){
  const y0=Math.max(site.anchor.y-THICK_SKIN_SPAN,bounds.minY);
  const y1=Math.min(site.anchor.y+THICK_SKIN_SPAN,bounds.maxY);
  const step=clamp(4/Math.max(1,pixelsPerWorld),.018,.055);
  const max=Math.min(THICK_EPIDERMIS_MAX_CELLS,
   Math.ceil((y1-y0)/step));
  const gram=new Path2D(),basal=new Path2D(),basalNuclei=new Path2D();
  const spinous=new Path2D(),spinousNuclei=new Path2D();
  for(let i=0;i<max;i++){
   const y=y0+i*step,p=sectionAtY(site.contour,y);
   if(!p||thickSkinInfluence(site.contour,y,site)<.30)continue;
   // Spinous polyhedra remain distributed under the granular layer,
   // but the low-detail sampling NEVER forms uniform giant circles.
   const s0=edgeX(site,p,3,"start"),s1=edgeX(site,p,3,"end");
   for(let k=0;k<2;k++){
    const x=s0+(s1-s0)*(.28+k*.38);
    const radius=.006+hash(i,k)*.002;
    spinous.moveTo(x-radius,y);
    spinous.lineTo(x-radius*.48,y-radius*.8);
    spinous.lineTo(x+radius*.66,y-radius*.64);
    spinous.lineTo(x+radius,y+radius*.2);
    spinous.lineTo(x+radius*.20,y+radius);
    spinous.lineTo(x-radius*.75,y+radius*.55);
    spinous.closePath();
    spinousNuclei.moveTo(x+.0018,y);
    spinousNuclei.ellipse(x,y,.0018,.002,0,0,Math.PI*2);
    stats.cells++;
   }
   const g0=edgeX(site,p,2,"start"),g1=edgeX(site,p,2,"end");
   const gx=g0+(g1-g0)*.55;
   for(let k=0;k<2;k++){
    const gy=y+(k-.5)*.005;
    gram.moveTo(gx+.0008,gy);
    gram.ellipse(gx,gy,.0008,.0005,0,0,Math.PI*2);
    stats.granules++;
   }
   const b0=edgeX(site,p,4,"start"),b1=edgeX(site,p,4,"end");
   const bx=(b0+b1)/2;
   basal.moveTo(bx+.004,y);
   basal.ellipse(bx,y,.004,.0062,0,0,Math.PI*2);
   basalNuclei.moveTo(bx+.0017,y);
   basalNuclei.ellipse(bx,y,.0017,.0026,0,0,Math.PI*2);
   stats.cells++;
  }
  ctx.globalAlpha=.50*fade;ctx.strokeStyle="#956b92";ctx.lineWidth=.0012;
  ctx.stroke(spinous);
  ctx.globalAlpha=.75*fade;ctx.fillStyle="#745374";
  ctx.fill(spinousNuclei);
  ctx.fill(gram);
  ctx.globalAlpha=.72*fade;ctx.strokeStyle="#795778";ctx.stroke(basal);
  ctx.fill(basalNuclei);
 }
 // One shared, wavy interface is a contour, not a painted vessel.
 ctx.beginPath();
 for(let i=0;i<points.length;i++){
  const p=points[i],x=edgeX(site,p,4,"end");
  if(i===0)ctx.moveTo(x,p.y);else ctx.lineTo(x,p.y);
 }
 ctx.lineWidth=selected==="basement"?.004:.0017;
 ctx.globalAlpha=.54*fade;
 ctx.strokeStyle=selected==="basement"?"#e5a944":"#866078";
 ctx.stroke();ctx.restore();
 return stats;
}
