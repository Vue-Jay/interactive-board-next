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
 type EpidermisId,type EpidermisStratum} from "./lektrusEpidermisAtlas";
import type {SkinSectionContour,SkinSectionPoint} from "./lektrusSkinVectorSections";

type Bounds={minX:number;maxX:number;minY:number;maxY:number};
export const EPIDERMIS_DETAIL_MAX_CELLS=4500;
export const EPIDERMIS_MICRO_MIN_SCALE=155;
const clamp=(v:number)=>Math.max(0,Math.min(1,v));
const fracWave=(y:number)=>.0030*Math.sin(y*31.4+.4)+
 .0014*Math.sin(y*48.2+1.7);
/** Small dermal papillae on the epithelial/dermal interface.
 * Same wave in band drawing and hit testing, no screen-fixed noise. */
export function epidermisStratumEdge(y:number,f:number):number{
 const b=SKIN_ILLUSTRATIVE_LAYERS.epidermisEnd;
 if(f<=0)return f;
 return f+fracWave(y)*(f/b)**4;
}
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
function hash(a:number,b:number,salt:number){
 let v=Math.imul((a|0)^salt,0x1b873593)^Math.imul(b|0,0x85ebca6b);
 v=Math.imul(v^(v>>>16),0x7feb352d);
 return ((v^(v>>>15))>>>0)/4294967296;
}
type DetailStats={bands:number;cells:number;granules:number;melanocytes:number};
export function drawEpidermisAtlas(
 ctx:CanvasRenderingContext2D,contours:readonly SkinSectionContour[],
 scale:number,bounds:Bounds,selected:EpidermisId|null,detailed=true
):DetailStats{
 const stats:DetailStats={bands:0,cells:0,granules:0,melanocytes:0};
 if(scale<11)return stats;
 const fade=clamp((scale-11)/52);
 const microFade=detailed?clamp((scale-EPIDERMIS_MICRO_MIN_SCALE)/125):0;
 const emphasized=selectedStratum(selected);
 for(const c of contours){
  if(!inside(c,bounds))continue;
  const points=c.points.filter(p=>
   p.y>=bounds.minY-.06&&p.y<=bounds.maxY+.06);
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
   const grid=.0106; // ~30 µm center spacing in the WHOLE-BODY coordinate.
   for(const l of EPIDERMIS_LAYER_FRACTIONS){
    // Reserve independent budgets so the basal cell row cannot disappear
    // behind thousands of flattened corneocytes/spinous cell paths.
    const layerBudget=EPIDERMIS_DETAIL_MAX_CELLS/4;
    const startCount=stats.cells;
    const localWidth=(l.end-l.start)*8.4;
    const rows=Math.max(0,(y1-y0)/grid);
    const estimate=Math.max(1,rows*Math.ceil(localWidth/grid));
    const stride=Math.max(1,Math.ceil(Math.sqrt(estimate/layerBudget)));
    const step=grid*stride;
    const j0=Math.ceil(y0/step),j1=Math.floor(y1/step);
    if(stats.cells>=EPIDERMIS_DETAIL_MAX_CELLS)break;
    ctx.save();
    if(!sectionPath(ctx,c,points,l.start,l.end)){
     ctx.restore();continue;
    }
    ctx.clip();
    const isCorneum=l.id==="corneum";
    const isGranular=l.id==="granulosum";
    const isBasal=l.id==="basale";
    const outlines=new Path2D(),nuclei=new Path2D();
    const specks=new Path2D();
    for(let j=j0;j<=j1&&stats.cells-startCount<layerBudget;j++){
     const y=j*step,p=sectionAtY(c,y);
     if(!p||skinEvidenceRegionAt({x:p.x,y})!=="thin-skin-reference")
      continue;
     const x1=p.x+c.inward*p.depth*l.start;
     const x2=p.x+c.inward*p.depth*l.end;
     const minX=Math.min(x1,x2),maxX=Math.max(x1,x2);
     const k0=Math.ceil(minX/step),k1=Math.floor(maxX/step);
     for(let k=k0;k<=k1&&stats.cells-startCount<layerBudget;k++){
      const x=k*step;
      // A real basal stratum is ONE row, adjacent to its basement
      // membrane; the granular zone of thin skin contains only a few
      // flattened rows. Never fill their widened teaching bands with
      // many additional fictitious rows of nuclei.
      if(isBasal&&Math.abs(x-(x2-c.inward*.005))>step*.57)
       continue;
      if(isGranular&&Math.min(
       Math.abs(x-(x1+(x2-x1)*.32)),
       Math.abs(x-(x1+(x2-x1)*.70)))>step*.60)
       continue;
      const d=(x-p.x)/(c.inward*p.depth);
      if(d<l.start||d>=l.end)continue;
      // Cellular *morphology* comes from histology, but synthetic cell
      // locations are explicitly representative, never a sampled biopsy.
      const jx=(hash(k,j,13)-.5)*grid*.18;
      const jy=(hash(k,j,17)-.5)*grid*.18;
      const cx=x+jx,cy=y+jy;
      const rr=.0037+.0008*hash(k,j,19);
      const ry=isCorneum?rr*.36:isGranular?rr*.63:
       isBasal?rr*1.05:rr*.96;
      const rx=isCorneum?rr*1.10:isGranular?rr*1.22:
       isBasal?rr*.88:rr;
      // Spinous cells are polygonal, not uniformly circular stamps.
      if(l.id==="spinosum"){
       outlines.moveTo(cx-rx*.80,cy-ry*.18);
       outlines.lineTo(cx-rx*.47,cy-ry);
       outlines.lineTo(cx+rx*.58,cy-ry*.89);
       outlines.lineTo(cx+rx,cy-ry*.15);
       outlines.lineTo(cx+rx*.50,cy+ry);
       outlines.lineTo(cx-rx*.68,cy+ry*.82);
       outlines.closePath();
      }else{
       outlines.ellipse(cx,cy,rx,ry,0,0,Math.PI*2);
      }
      if(!isCorneum){
       nuclei.ellipse(cx,cy,.0014,isBasal?.0024:.00165,
        isBasal?0:Math.PI/8,0,Math.PI*2);
      }
      if(isGranular){
       for(let q=0;q<2;q++){
        const dx=(q?.002:-.002)*hash(k,j,31+q);
        const dy=(q?.001:-.001)*hash(k,j,37+q);
        specks.ellipse(cx+dx,cy+dy,.00072,.00042,0,0,Math.PI*2);
        stats.granules++;
       }
      }
      stats.cells++;
     }
    }
    ctx.globalAlpha=.56*microFade;
    ctx.strokeStyle=isCorneum?"#f6d6cd":isGranular?"#694772":
     isBasal?"#6d507c":"#a8799f";
    ctx.lineWidth=.00090;
    ctx.stroke(outlines);
    if(!isCorneum){
     ctx.globalAlpha=.52*microFade;ctx.fillStyle="#765478";ctx.fill(nuclei);
    }
    if(isGranular){
     ctx.globalAlpha=.8*microFade;ctx.fillStyle="#694567";ctx.fill(specks);
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
     const x=edgeX(c,p,(SKIN_ILLUSTRATIVE_LAYERS.basaleStart+
      SKIN_ILLUSTRATIVE_LAYERS.epidermisEnd)/2);
     ctx.beginPath();ctx.ellipse(x,y,.0034,.0042,0,0,Math.PI*2);
     ctx.fill();
     ctx.beginPath();ctx.moveTo(x,y);
     ctx.lineTo(x-c.inward*.010,y-.012);
     ctx.moveTo(x,y);ctx.lineTo(x-c.inward*.011,y+.014);ctx.stroke();
     stats.melanocytes++;
    }
    ctx.restore();
   }
  }
  ctx.restore();
 }
 return stats;
}
