/** Cached procedural stratum-corneum microtiles, not hand-painted frames.
 *
 * Tile texture is generated ONCE from fixed world coordinates. Moving the
 * camera cannot reseed the same cell or introduce a visible tile seam.
 * Each tile is an educational model of flat, anucleate corneocytes;
 * it is not a patient sample or a living nucleated epidermis.
 */
import {skinHash,skinSurfaceAlpha,SKIN_CORNEOCYTE_STEP_WORLD,
 type SkinBounds} from "./lektrusSkinSurfaceField";

export const SKIN_MICROTILE_WORLD=1.3;
export const SKIN_MICROTILE_PIXELS=288;
export const SKIN_MICROTILE_CACHE_LIMIT=48;
export const SKIN_MICROTILE_CREATIONS_PER_FRAME=2;

export type SkinTileCoord={x:number;y:number;key:string};
export function skinMicrotileKey(x:number,y:number):string{
 return x+":"+y;
}
export function skinVisibleMicrotiles(bounds:SkinBounds):SkinTileCoord[]{
 if(bounds.maxX<=bounds.minX||bounds.maxY<=bounds.minY)return [];
 const minX=Math.floor(bounds.minX/SKIN_MICROTILE_WORLD);
 const maxX=Math.floor(bounds.maxX/SKIN_MICROTILE_WORLD);
 const minY=Math.floor(bounds.minY/SKIN_MICROTILE_WORLD);
 const maxY=Math.floor(bounds.maxY/SKIN_MICROTILE_WORLD);
 const result:SkinTileCoord[]=[];
 for(let y=minY;y<=maxY;y++){
  for(let x=minX;x<=maxX;x++){
   result.push({x,y,key:skinMicrotileKey(x,y)});
  }
 }
 return result;
}
export function skinCorneocyteAlpha(scale:number):number{
 return skinSurfaceAlpha(scale,"corneocytes");
}
/** Geometry identity is a function of the global cell index alone.
 * Adjacent tiles have identical cell edges on their shared seam.
 */
export function skinCorneocyteGeometry(ix:number,iy:number){
 const tone=skinHash(ix,iy,113);
 return {x:(ix+(iy%2)*.50)*SKIN_CORNEOCYTE_STEP_WORLD,
  y:iy*SKIN_CORNEOCYTE_STEP_WORLD,
  radius:SKIN_CORNEOCYTE_STEP_WORLD*(.46+.06*(tone-.5)),
  angle:(skinHash(ix,iy,71)-.5)*.16,
  tone};
}
const cache=new Map<string,HTMLCanvasElement>();
function buildTile(x:number,y:number):HTMLCanvasElement{
 const canvas=document.createElement("canvas");
 canvas.width=SKIN_MICROTILE_PIXELS;canvas.height=SKIN_MICROTILE_PIXELS;
 const c=canvas.getContext("2d");
 if(!c)return canvas;
 const x0=x*SKIN_MICROTILE_WORLD,y0=y*SKIN_MICROTILE_WORLD;
 const scale=SKIN_MICROTILE_PIXELS/SKIN_MICROTILE_WORLD;
 c.setTransform(scale,0,0,scale,-x0*scale,-y0*scale);
 const step=SKIN_CORNEOCYTE_STEP_WORLD;
 const minX=Math.floor((x0-step*2)/step),maxX=Math.ceil((x0+SKIN_MICROTILE_WORLD+step*2)/step);
 const minY=Math.floor((y0-step*2)/step),maxY=Math.ceil((y0+SKIN_MICROTILE_WORLD+step*2)/step);
 c.lineWidth=step*.040;
 c.strokeStyle="#855a52";
 for(let iy=minY;iy<=maxY;iy++){
  for(let ix=minX;ix<=maxX;ix++){
   const g=skinCorneocyteGeometry(ix,iy);
   // Flat corneocyte borders, with subtle cellular variation. Never
   // render nuclei on the OUTER stratum corneum.
   c.globalAlpha=.075+.075*g.tone;
   c.beginPath();
   for(let i=0;i<6;i++){
    const angle=i*Math.PI/3+g.angle;
    const jitter=.92+.15*skinHash(ix*7+i,iy*11+i,5);
    const vx=g.x+Math.cos(angle)*g.radius*jitter;
    const vy=g.y+Math.sin(angle)*g.radius*jitter;
    if(i===0)c.moveTo(vx,vy);else c.lineTo(vx,vy);
   }
   c.closePath();c.stroke();
  }
 }
 c.setTransform(1,0,0,1,0,0);
 return canvas;
}
/** The caller is already in body-local coordinates and source-atop mode.
 * Only visible tiles are materialized, two per RAF. The original body
 * remains visible while resources become ready. LRU bounds GPU/CPU memory.
 */
export function drawSkinMicrotiles(
 ctx:CanvasRenderingContext2D,bounds:SkinBounds,
 scale:number,opacity=1,scheduleDraw?:()=>void
):number{
 const alpha=skinCorneocyteAlpha(scale)*opacity;
 if(alpha<=.002)return 0;
 const tiles=skinVisibleMicrotiles(bounds);
 // Avoid unbounded generation during overview and very wide stage layouts.
 if(tiles.length>SKIN_MICROTILE_CACHE_LIMIT)return 0;
 let made=0,pending=false,drawn=0;
 for(const tile of tiles){
  let sprite=cache.get(tile.key);
  if(!sprite){
   if(made>=SKIN_MICROTILE_CREATIONS_PER_FRAME){pending=true;continue;}
   sprite=buildTile(tile.x,tile.y);
   made++;
  }else cache.delete(tile.key);
  cache.set(tile.key,sprite);
  while(cache.size>SKIN_MICROTILE_CACHE_LIMIT){
   const oldest=cache.keys().next().value;
   if(oldest===undefined)break;
   cache.delete(oldest);
  }
  ctx.save();
  ctx.globalAlpha=alpha;
  ctx.drawImage(sprite,tile.x*SKIN_MICROTILE_WORLD,
   tile.y*SKIN_MICROTILE_WORLD,SKIN_MICROTILE_WORLD,SKIN_MICROTILE_WORLD);
  ctx.restore();
  drawn++;
 }
 if(pending)scheduleDraw?.();
 return drawn;
}
export function skinMicrotileCacheSize():number{return cache.size;}
