/** Histology-informed *teaching reconstruction* of a localized thin
 * epidermal section. Cell positions are stable in world coordinates; no
 * microscope calibration or alleged biopsy location is implied.
 *
 * Leeds Histology Guide Epidermis: anucleate corneocytes, 3–5 granular
 * rows, nucleated polygonal spinous keratinocytes, ONE basal cell row.
 * OpenStax A&P 2e §5.1: keratinization, morphology, melanocytes and
 * basal membrane. Nothing in this model depicts vessels in epidermis.
 */
import {EPIDERMIS_LAYER_FRACTIONS,epidermisStratumEdge,sectionAtY,
 type EpidermisPoint} from "./lektrusEpidermisAtlas";
import type {SkinSectionContour,SkinSectionPoint} from "./lektrusSkinVectorSections";

type Bounds={minX:number;maxX:number;minY:number;maxY:number};
export type EpidermisCellStats={cells:number;granules:number};
export const EPIDERMIS_CELL_SHEET_BUDGET=1800;

function shapeBand(ctx:CanvasRenderingContext2D,
 c:SkinSectionContour,points:readonly SkinSectionPoint[],
 start:number,end:number){
 ctx.beginPath();
 const x=(p:SkinSectionPoint,f:number)=>
  p.x+c.inward*p.depth*epidermisStratumEdge(p.y,f);
 points.forEach((p,i)=>{if(i===0)ctx.moveTo(x(p,start),p.y);
  else ctx.lineTo(x(p,start),p.y);});
 for(let i=points.length-1;i>=0;i--){
  const p=points[i];ctx.lineTo(x(p,end),p.y);
 }
 ctx.closePath();ctx.clip();
}
const layout={
 corneum:{columns:5,rowStep:.089,cells:"#f0d7c9",outline:"#bf9b9b"},
 granulosum:{columns:3,rowStep:.070,cells:"#b996ab",outline:"#805d86"},
 spinosum:{columns:8,rowStep:.058,cells:"#eac5ce",outline:"#a87f9d"},
 basale:{columns:1,rowStep:.059,cells:"#c3a0b7",outline:"#7b567a"}
} as const;

export type EpidermisDrawnCell={
 layer:keyof typeof layout;center:EpidermisPoint;rx:number;ry:number;
};
/** One geometry function for both painting and pointer picking.
 * Coordinates are in body-world units, not pixel/fake optical magnification.
 */
function sheetCell(c:SkinSectionContour,layer:typeof EPIDERMIS_LAYER_FRACTIONS[number],
 row:number,column:number):EpidermisDrawnCell|null{
 const style=layout[layer.id];
 const y=row*style.rowStep,p=sectionAtY(c,y);
 if(!p||p.depth<1)return null;
 const fraction=layer.start+(column+.5)*
  (layer.end-layer.start)/style.columns;
 const x=p.x+c.inward*p.depth*epidermisStratumEdge(y,fraction);
 const rx=p.depth*(layer.end-layer.start)/style.columns*
  (layer.id==="basale"?.46:.44);
 const ry=style.rowStep*(layer.id==="corneum"?.47:
  layer.id==="granulosum"?.45:.46);
 const cy=y+((row+column)%2?1:-1)*style.rowStep*.025;
 return {layer:layer.id,center:{x,y:cy},rx,ry};
}
/** Returns a cell ONLY within its visible drawn glyph, never from neutral
 * space or the outside of a cutaway. The same sheetCell routine is used
 * to paint its contour and to select it on mouse and touch.
 */
export function epidermisVisibleCellAt(
 c:SkinSectionContour,point:EpidermisPoint
):EpidermisDrawnCell|null{
 if(point.y<148||point.y>216)return null;
 for(const layer of EPIDERMIS_LAYER_FRACTIONS){
  const style=layout[layer.id];
  const row=Math.round(point.y/style.rowStep);
  for(let j=row-1;j<=row+1;j++)
   for(let col=0;col<style.columns;col++){
    const cell=sheetCell(c,layer,j,col);
    if(!cell)continue;
    const dx=(point.x-cell.center.x)/cell.rx;
    const dy=(point.y-cell.center.y)/cell.ry;
    // Inner ellipse for the polygon and cuboidal cells prevents hits
    // in invisible corners of each illustrative cell outline.
    const limit=layer.id==="spinosum"?.69:
     layer.id==="basale"?.70:.82;
    if(dx*dx+dy*dy<=limit)return cell;
   }
 }
 return null;
}
function nucleus(path:Path2D,x:number,y:number,rx:number,ry:number){
 path.moveTo(x+rx,y);path.ellipse(x,y,rx,ry,0,0,Math.PI*2);
}
function cellOutline(
 path:Path2D,id:keyof typeof layout,x:number,y:number,
 rx:number,ry:number,seed:number
){
 const tilt=((seed%7)-3)*.03;
 if(id==="spinosum"){
  // Apposed polyhedral cells with natural straight sides (not circles).
  path.moveTo(x-rx*.84,y-ry*.16);
  path.lineTo(x-rx*.56,y-ry*.83);
  path.lineTo(x+rx*.40,y-ry*(.93+tilt));
  path.lineTo(x+rx*.92,y-ry*.26);
  path.lineTo(x+rx*.78,y+ry*.68);
  path.lineTo(x-rx*.13,y+ry*.96);
  path.lineTo(x-rx*.87,y+ry*.47);path.closePath();
 }else if(id==="basale"){
  // ONE basal cuboidal/low-columnar row along the basement junction.
  path.moveTo(x-rx*.86,y-ry*.84);
  path.lineTo(x+rx*.86,y-ry*.84);
  path.lineTo(x+rx*.89,y+ry*.81);
  path.lineTo(x-rx*.89,y+ry*.81);path.closePath();
 }else{
  // Granular and corneal cells flatten PARALLEL to the local surface:
  // Y is the tangent; X is the depth of this lateral section.
  path.moveTo(x-rx,y-ry*.18);
  path.quadraticCurveTo(x-rx*.87,y-ry*.88,x,y-ry*.92);
  path.quadraticCurveTo(x+rx*.89,y-ry*.78,x+rx,y);
  path.quadraticCurveTo(x+rx*.82,y+ry*.90,x,y+ry*.92);
  path.quadraticCurveTo(x-rx*.9,y+ry*.82,x-rx,y-ry*.18);
  path.closePath();
 }
}
export function drawEpidermisCellSheet(
 ctx:CanvasRenderingContext2D,c:SkinSectionContour,
 points:readonly SkinSectionPoint[],bounds:Bounds,
 pixelsPerWorld:number,opacity:number
):EpidermisCellStats{
 const stats:EpidermisCellStats={cells:0,granules:0};
 // The cell sheet must not appear as unresolved grain at smaller zooms.
 if(points.length<2||pixelsPerWorld<195||opacity<.12)return stats;
 const yMin=Math.max(bounds.minY,c.minY,148);
 const yMax=Math.min(bounds.maxY,c.maxY,216);
 if(yMax<=yMin)return stats;
 for(const layer of EPIDERMIS_LAYER_FRACTIONS){
  const id=layer.id,style=layout[id];
  ctx.save();shapeBand(ctx,c,points,layer.start,layer.end);
  const cells=new Path2D(),nuclei=new Path2D(),granules=new Path2D();
  const rowStart=Math.ceil((yMin-style.rowStep)/style.rowStep);
  const rowEnd=Math.floor((yMax+style.rowStep)/style.rowStep);
  for(let row=rowStart;row<=rowEnd;row++){
   const y=row*style.rowStep;
   const p=sectionAtY(c,y);
   if(!p||p.depth<1||stats.cells>=EPIDERMIS_CELL_SHEET_BUDGET)continue;
   for(let column=0;column<style.columns;column++){
    if(stats.cells>=EPIDERMIS_CELL_SHEET_BUDGET)break;
    const cell=sheetCell(c,layer,row,column);
    if(!cell)continue;
    const centerX=cell.center.x,cy=cell.center.y;
    const {rx,ry}=cell;
    cellOutline(cells,id,centerX,cy,rx,ry,row+column);
    if(id!=="corneum"){
     nucleus(nuclei,centerX,cy,
      Math.min(rx*.32,id==="basale"?.014:.010),
      Math.min(ry*.37,id==="granulosum"?.009:.013));
    }
    if(id==="granulosum"){
     // Keratohyalin granules, distinct from the secretory lamellar bodies.
     for(let k=0;k<3;k++){
      const gx=centerX+(k-1)*rx*.42;
      const gy=cy+(k%2?-.24:.23)*ry;
      nucleus(granules,gx,gy,.0025,.0033);
      stats.granules++;
     }
    }
    stats.cells++;
   }
  }
  ctx.fillStyle=style.cells;ctx.globalAlpha=.76*opacity;ctx.fill(cells);
  ctx.strokeStyle=style.outline;ctx.globalAlpha=.86*opacity;
  ctx.lineWidth=.0015;ctx.stroke(cells);
  if(id!=="corneum"){
   ctx.fillStyle="#714b72";ctx.globalAlpha=.78*opacity;ctx.fill(nuclei);
  }
  if(id==="granulosum"){
   ctx.fillStyle="#5d4267";ctx.globalAlpha=.90*opacity;ctx.fill(granules);
  }
  ctx.restore();
 }
 return stats;
}
