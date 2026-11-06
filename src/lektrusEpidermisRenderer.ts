/** Compact vector microstructure of *representative thin epidermis*, in the
 * same continuous 360x600 human body coordinates. Reference morphology:
 * Leeds Epidermis; OpenStax A&P §5.1; NCBI NBK537325.
 *
 * This is an explanatory tissue reconstruction, NOT a microphotograph,
 * a pixel-calibrated serial section, or a claim to map actual patient cells.
 * Only the approved upper-arm reference site gets the cellular stage.
 * Correct layer relationships: flat anucleate corneocytes, granular cells,
 * polyhedral spinous cells with nuclei, and one cuboidal basal cell row.
 */
import {skinEvidenceRegionAt,SKIN_ILLUSTRATIVE_LAYERS} from "./lektrusSkinEvidenceModel";
import {EPIDERMIS_LAYER_FRACTIONS,sectionAtY,
 epidermisStratumEdge,epidermisMelanocyteCenter,
 epidermisKeratinocyteCenter,
 type EpidermisId,type EpidermisStratum,type EpidermisPoint} from "./lektrusEpidermisAtlas";
export {epidermisStratumEdge} from "./lektrusEpidermisAtlas";
import type {SkinSectionContour,SkinSectionPoint} from "./lektrusSkinVectorSections";
import {drawEpidermisCellSheet,epidermisVisibleCellAt} from "./lektrusEpidermisCellSheet";

type Bounds={minX:number;maxX:number;minY:number;maxY:number};
export const EPIDERMIS_DETAIL_MAX_CELLS=1800;
export const EPIDERMIS_MICRO_MIN_SCALE=155;
const clamp=(v:number)=>Math.max(0,Math.min(1,v));
function edgeX(c:SkinSectionContour,p:SkinSectionPoint,f:number){
 return p.x+c.inward*p.depth*epidermisStratumEdge(p.y,f);
}
function selectedStratum(id:EpidermisId|null):EpidermisStratum|null{
 if(id==="keratinocyte")return "spinosum";
 if(id==="melanocyte"||id==="basement")return "basale";
 return id==="corneum"||id==="granulosum"||
  id==="spinosum"||id==="basale"?id:null;
}
function inside(c:SkinSectionContour,b:Bounds){
 return c.maxX>=b.minX&&c.minX<=b.maxX&&
  c.maxY>=b.minY&&c.minY<=b.maxY;
}
/** Densify the once-sampled body alpha contour only INSIDE the viewport.
 * The old 1/3-world-unit polygon jumps became 80-100px sharp saw teeth
 * at high zoom. Smooth interpolation retains the same anatomy coordinates;
 * a ceiling on samples keeps touch-panning responsive. */
function smoothVisiblePoints(c:SkinSectionContour,b:Bounds,ppu:number){
 const start=Math.max(c.minY,b.minY-.03);
 const stop=Math.min(c.maxY,b.maxY+.03);
 if(stop<=start)return [] as SkinSectionPoint[];
 const desired=Math.max(.006,Math.min(.10,2.5/Math.max(1,ppu)));
 const count=Math.max(2,Math.min(950,Math.ceil((stop-start)/desired)));
 const result:SkinSectionPoint[]=[];
 for(let i=0;i<=count;i++){
  const y=start+(stop-start)*i/count;
  const p=sectionAtY(c,y);
  if(p)result.push(p);
 }
 return result;
}
function sectionPath(ctx:CanvasRenderingContext2D,c:SkinSectionContour,
 points:readonly SkinSectionPoint[],a:number,b:number){
 if(points.length<2)return false;
 ctx.beginPath();
 for(let i=0;i<points.length;i++){
  const p=points[i],x=edgeX(c,p,a);
  if(i===0)ctx.moveTo(x,p.y);else ctx.lineTo(x,p.y);
 }
 for(let i=points.length-1;i>=0;i--){
  const p=points[i];ctx.lineTo(edgeX(c,p,b),p.y);
 }
 ctx.closePath();return true;
}
function curveRow(ctx:CanvasRenderingContext2D,c:SkinSectionContour,
 y0:number,y1:number,f:number){
 const a=sectionAtY(c,y0),b=sectionAtY(c,y1);
 if(!a||!b)return;
 ctx.moveTo(edgeX(c,a,f),y0);
 const middle=sectionAtY(c,(y0+y1)/2);
 if(!middle)return;
 ctx.quadraticCurveTo(edgeX(c,middle,f),middle.y,
  edgeX(c,b,f),y1);
}
type DetailStats={bands:number;cells:number;granules:number;melanocytes:number};
export function drawEpidermisAtlas(
 ctx:CanvasRenderingContext2D,contours:readonly SkinSectionContour[],
 scale:number,bounds:Bounds,selected:EpidermisId|null,detailed=true,
 pixelsPerWorld=scale,selectedPoint:EpidermisPoint|null=null
):DetailStats{
 const stats:DetailStats={bands:0,cells:0,granules:0,melanocytes:0};
 if(scale<11)return stats;
 const fade=clamp((scale-11)/52);
 const microFade=detailed?clamp((scale-EPIDERMIS_MICRO_MIN_SCALE)/125):0;
 const emphasized=selectedStratum(selected);
 for(const c of contours){
  if(!inside(c,bounds))continue;
  // During a gesture keep the contour coarse; restore fine curves
  // only after motion stops, avoiding heavy path reconstruction on
  // every intermediate animation frame.
  const points=smoothVisiblePoints(c,bounds,
   detailed?pixelsPerWorld:Math.min(pixelsPerWorld,55));
  if(points.length<2)continue;
  ctx.save();
  // Four visually distinct *tissue* layers. They do not claim absolute
  // thickness; thin skin elsewhere on the body is not a cell-registered scan.
  for(const l of EPIDERMIS_LAYER_FRACTIONS){
   if(!sectionPath(ctx,c,points,l.start,l.end))continue;
   ctx.globalAlpha=.95*fade;
   ctx.fillStyle=l.color;ctx.fill();
   if(selected===l.id||emphasized===l.id){
    ctx.globalAlpha=.26*fade;ctx.fillStyle="#ffe89e";ctx.fill();
   }
   stats.bands++;
  }
  // Narrow granular interface and papillary junction.
  ctx.globalAlpha=.63*fade;
  ctx.strokeStyle="#6d4675";
  ctx.lineWidth=.0018;
  ctx.beginPath();
  for(let i=0;i<points.length;i++){
   const p=points[i],x=edgeX(c,p,SKIN_ILLUSTRATIVE_LAYERS.spinosumStart);
   if(i===0)ctx.moveTo(x,p.y);else ctx.lineTo(x,p.y);
  }
  ctx.stroke();
  ctx.beginPath();
  ctx.strokeStyle=selected==="basement"?"#e7b454":"#93637e";
  ctx.lineWidth=selected==="basement"?.008:.003;
  for(let i=0;i<points.length;i++){
   const p=points[i],x=edgeX(c,p,SKIN_ILLUSTRATIVE_LAYERS.epidermisEnd);
   if(i===0)ctx.moveTo(x,p.y);else ctx.lineTo(x,p.y);
  }
  ctx.stroke();
  if(detailed&&fade>.08){
   // Corneum: flat, layered, ANUCLEATE squames parallel to the skin.
   const first=Math.ceil(Math.max(bounds.minY,c.minY)/.045);
   const last=Math.floor(Math.min(bounds.maxY,c.maxY)/.045);
   ctx.strokeStyle="#f8ded1";ctx.lineWidth=.0018;
   ctx.globalAlpha=.55*fade;ctx.beginPath();
   for(let k=0;k<8;k++){
    const f=(k+.65)/9*SKIN_ILLUSTRATIVE_LAYERS.granulosumStart;
    for(let j=first;j<=last;j++){
     const y0=j*.045+((k%3)*.014),y1=y0+.038;
     curveRow(ctx,c,y0,y1,f);
    }
   }
   ctx.stroke();
  }
  // Microstructure is displayed at a scientifically identified sample
  // AREA (right upper arm), not invented over the entire model.
  // Only render after the camera stops. Cell positions are deterministic.
  if(microFade>.005&&stats.cells<EPIDERMIS_DETAIL_MAX_CELLS){
   const y0=Math.max(bounds.minY,c.minY,148);
   const y1=Math.min(bounds.maxY,c.maxY,216);
   const detail=drawEpidermisCellSheet(
    ctx,c,points,bounds,pixelsPerWorld,microFade);
   stats.cells+=detail.cells;
   stats.granules+=detail.granules;
   // A sparse set of individually selectable example keratinocytes,
   // actually present in the spinous cell sheet and positioned by the
   // same helper used for hit testing. These are NOT fabricated biopsy
   // locations and never appear on unrelated hands or feet.
   if(microFade>.50){
    ctx.save();ctx.globalAlpha=.86*microFade;
    for(let k=Math.ceil(y0/.23);k*.23<=y1;k++){
     const y=k*.23,center=epidermisKeratinocyteCenter(c,y);
     if(!center)continue;
     const x=center.x;
     ctx.beginPath();
     ctx.moveTo(x-.023,y-.005);
     ctx.lineTo(x-.014,y-.027);
     ctx.lineTo(x+.014,y-.026);
     ctx.lineTo(x+.024,y+.005);
     ctx.lineTo(x+.012,y+.028);
     ctx.lineTo(x-.018,y+.024);
     ctx.closePath();
     ctx.fillStyle="#ebc4ce";ctx.fill();
     ctx.strokeStyle="#916a91";ctx.lineWidth=.0013;ctx.stroke();
     ctx.beginPath();ctx.ellipse(x,y,.007,.009,0,0,Math.PI*2);
     ctx.fillStyle="#74536d";ctx.fill();
     if(selected==="keratinocyte"&&selectedPoint&&
       Math.abs(x-selectedPoint.x)<=.024&&
       Math.abs(y-selectedPoint.y)<=.028){
      ctx.beginPath();ctx.ellipse(x,y,.027,.033,0,0,Math.PI*2);
      ctx.strokeStyle="#f6d369";ctx.lineWidth=.0019;
      ctx.globalAlpha=.95;ctx.stroke();
     }
    }
    ctx.restore();
   }
   // Rare illustrative melanocytes in the basal zone, specifically the
   // registered thin-skin reference. 0.31 world spacing is a visual sample
   // and must not be interpreted as actual cell population density.
   if(microFade>.50){
    ctx.save();ctx.fillStyle="#87627b";ctx.strokeStyle="#84526d";
    ctx.lineWidth=.0011;ctx.globalAlpha=.72*microFade;
    for(let k=Math.ceil(y0/.31);k*.31<=y1;k++){
     const y=k*.31,p=sectionAtY(c,y);
     if(!p||skinEvidenceRegionAt({x:p.x,y})!=="thin-skin-reference")
      continue;
     const center=epidermisMelanocyteCenter(c,y);
     if(!center)continue;
     const x=center.x;
     ctx.beginPath();ctx.ellipse(x,y,.015,.020,0,0,Math.PI*2);
     ctx.fill();
     ctx.beginPath();ctx.moveTo(x,y);
     ctx.lineTo(x-c.inward*.025,y-.029);
     ctx.moveTo(x,y);ctx.lineTo(x-c.inward*.028,y+.028);ctx.stroke();
     if(selected==="melanocyte"&&selectedPoint&&
       Math.abs(x-selectedPoint.x)<=.015&&
       Math.abs(y-selectedPoint.y)<=.020){
      ctx.beginPath();ctx.ellipse(x,y,.020,.025,0,0,Math.PI*2);
      ctx.strokeStyle="#f7d763";ctx.lineWidth=.002;
      ctx.globalAlpha=.95;ctx.stroke();
     }
     stats.melanocytes++;
    }
    ctx.restore();
   }
  }
  // Highlight exactly the tapped cell of the visible reconstructed
  // epithelial sheet. Shared geometry is also used by hit testing.
  if(selected==="keratinocyte"&&selectedPoint&&microFade>.5){
   const cell=epidermisVisibleCellAt(c,selectedPoint);
   if(cell){
    ctx.save();ctx.strokeStyle="#edb93f";ctx.globalAlpha=.95;
    ctx.lineWidth=Math.max(.002,1.8/Math.max(1,pixelsPerWorld));
    ctx.beginPath();
    ctx.ellipse(cell.center.x,cell.center.y,
     cell.rx*1.16,cell.ry*1.16,0,0,Math.PI*2);
    ctx.stroke();ctx.restore();
   }
  }
  ctx.restore();
 }
 return stats;
}
