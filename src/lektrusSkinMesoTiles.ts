/** Deterministic, medium-scale skin pattern throughout the human silhouette.
 *
 * A 360x600 overview image cannot contain actual skin detail when zoomed 7x.
 * This layer supplies world-registered mesostructure without replacing the
 * underlying human, magnifying a shoulder patch or creating zoom "frames".
 * Color/tone, short furrows and tiny freckles are procedural illustration,
 * not patient-specific microscopy or a claim of calibrated photorealism.
 */
import {skinHash,skinSmoothstep,skinValueNoise,type SkinBounds}
 from "./lektrusSkinSurfaceField";

export const SKIN_MESO_TILE_WORLD=32;
export const SKIN_MESO_TILE_PIXELS=224;
export const SKIN_MESO_CACHE_LIMIT=48;
export const SKIN_MESO_CREATIONS_PER_FRAME=3;
export const SKIN_MESO_VISIBLE_TILE_LIMIT=72;
const TWO_PI=Math.PI*2;

export type SkinMesoRegion="face"|"torso"|"arm"|"hand"|"leg"|"general";
export type SkinMesoProfile={
 region:SkinMesoRegion;
 direction:number;
 contrast:number;
 furrowStep:number;
 fineGrain:number;
};
/** Region profiles reflect the illustration's rough body coordinates.
 * No separate regional camera, circular vignette or visible seam.
 */
export function skinMesoProfile(x:number,y:number):SkinMesoProfile{
 const ellipse=(cx:number,cy:number,rx:number,ry:number)=>
  Math.hypot((x-cx)/rx,(y-cy)/ry);
 const leftHand=ellipse(57,335,22,37),rightHand=ellipse(303,335,22,37);
 if(Math.min(leftHand,rightHand)<1.15){
  return {region:"hand",direction:Math.PI*.07,contrast:.90,
   furrowStep:.85,fineGrain:1.15};
 }
 if(ellipse(180,75,38,55)<1.0){
  return {region:"face",direction:.2,contrast:.50,
   furrowStep:1.55,fineGrain:.85};
 }
 if(ellipse(81,245,36,103)<1.0||ellipse(279,245,36,103)<1.0){
  const side=x<180?-1:1;
  return {region:"arm",direction:Math.PI*.48+side*.17,
   contrast:1.13,furrowStep:1.1,fineGrain:1.05};
 }
 if(ellipse(136,446,28,135)<1.0||ellipse(224,446,28,135)<1.0){
  return {region:"leg",direction:Math.PI*.5,contrast:.85,
   furrowStep:1.35,fineGrain:1.0};
 }
 if(ellipse(180,235,63,130)<1.05){
  return {region:"torso",direction:.57,contrast:.67,
   furrowStep:1.85,fineGrain:.88};
 }
 return {region:"general",direction:1.1,contrast:.77,
  furrowStep:1.40,fineGrain:.98};
}
/** The fade-on region is not the entire zoom interval: medium detail
 * resolves the blurred 360px body before microscopic pores become visible.
 * It then yields naturally to the deeper, finer corneocyte model.
 */
export function skinMesoOpacity(zoom:number){
 const enter=skinSmoothstep(3.4,7.4,zoom);
 const leave=1-skinSmoothstep(22,48,zoom);
 return enter*leave;
}
export type SkinMesoTileCoord={x:number;y:number;key:string};
export function skinMesoKey(x:number,y:number){return "meso:"+x+":"+y;}
export function skinMesoTilesInBounds(bounds:SkinBounds):SkinMesoTileCoord[]{
 if(bounds.maxX<=bounds.minX||bounds.maxY<=bounds.minY)return [];
 const x0=Math.floor(bounds.minX/SKIN_MESO_TILE_WORLD);
 const x1=Math.floor(bounds.maxX/SKIN_MESO_TILE_WORLD);
 const y0=Math.floor(bounds.minY/SKIN_MESO_TILE_WORLD);
 const y1=Math.floor(bounds.maxY/SKIN_MESO_TILE_WORLD);
 const result:SkinMesoTileCoord[]=[];
 for(let y=y0;y<=y1;y++){
  for(let x=x0;x<=x1;x++)result.push({x,y,key:skinMesoKey(x,y)});
 }
 return result;
}
const cache=new Map<string,HTMLCanvasElement>();

/** Pixel colors vary continuously with world coordinates, not tile indices.
 * Adjacent tiles share the same fBm seed and thus do not repeat as a stamp.
 */
export function skinMesoTone(worldX:number,worldY:number){
 const broad=skinValueNoise(worldX*.42,worldY*.42,107);
 const fine=skinValueNoise(worldX*2.2,worldY*2.2,127);
 const grain=skinHash(Math.floor(worldX*11),Math.floor(worldY*11),151);
 return (broad-.5)*.54+(fine-.5)*.36+(grain-.5)*.10;
}
function buildMesoTile(tileX:number,tileY:number){
 const canvas=document.createElement("canvas");
 canvas.width=SKIN_MESO_TILE_PIXELS;
 canvas.height=SKIN_MESO_TILE_PIXELS;
 const ctx=canvas.getContext("2d");
 if(!ctx)return canvas;
 const image=ctx.createImageData(SKIN_MESO_TILE_PIXELS,SKIN_MESO_TILE_PIXELS);
 const data=image.data;
 const step=SKIN_MESO_TILE_WORLD/SKIN_MESO_TILE_PIXELS;
 const originX=tileX*SKIN_MESO_TILE_WORLD;
 const originY=tileY*SKIN_MESO_TILE_WORLD;
 const profile=skinMesoProfile(originX+SKIN_MESO_TILE_WORLD/2,
  originY+SKIN_MESO_TILE_WORLD/2);
 // Transparent pigment overlay. Base outline and natural highlights remain
 // visible underneath, with low-frequency pigmentation and fine texture.
 for(let py=0;py<SKIN_MESO_TILE_PIXELS;py++){
  const worldY=originY+(py+.5)*step;
  for(let px=0;px<SKIN_MESO_TILE_PIXELS;px++){
   const worldX=originX+(px+.5)*step;
   // Pixel pigment depends on absolute coordinates only. Do not scale
   // it by the per-tile region profile: that causes visible tile seams.
   // Anatomical differences are expressed in the oriented furrows below.
   const tone=skinMesoTone(worldX,worldY);
   const magnitude=Math.min(48,Math.abs(tone)*155);
   const offset=(py*SKIN_MESO_TILE_PIXELS+px)*4;
   if(tone>=0){
    data[offset]=255;data[offset+1]=221;data[offset+2]=188;
   }else{
    data[offset]=120;data[offset+1]=68;data[offset+2]=59;
   }
   data[offset+3]=Math.round(magnitude);
  }
 }
 ctx.putImageData(image,0,0);
 // Tiny interrupted skin furrows have the spatial direction of a hand,
 // arm, face or torso instead of one generic image stamped everywhere.
 const pixelsPerWorld=SKIN_MESO_TILE_PIXELS/SKIN_MESO_TILE_WORLD;
 ctx.setTransform(pixelsPerWorld,0,0,pixelsPerWorld,
  -originX*pixelsPerWorld,-originY*pixelsPerWorld);
 const space=profile.furrowStep;
 const minX=Math.floor((originX-space)/space);
 const maxX=Math.ceil((originX+SKIN_MESO_TILE_WORLD+space)/space);
 const minY=Math.floor((originY-space)/space);
 const maxY=Math.ceil((originY+SKIN_MESO_TILE_WORLD+space)/space);
 for(let iy=minY;iy<=maxY;iy++){
  for(let ix=minX;ix<=maxX;ix++){
   const x=(ix+.25+.5*skinHash(ix,iy,43))*space;
   const y=(iy+.25+.5*skinHash(ix,iy,53))*space;
   const twist=(skinHash(ix,iy,67)-.5)*.60;
   const a=profile.direction+twist;
   const len=space*(.22+.52*skinHash(ix,iy,73));
   const dx=Math.cos(a)*len/2,dy=Math.sin(a)*len/2;
   const bend=(skinHash(ix,iy,79)-.5)*space*.16;
   ctx.globalAlpha=(.13+.10*skinHash(ix,iy,83))*profile.contrast;
   ctx.lineWidth=.055;
   ctx.strokeStyle=skinHash(ix,iy,97)>.45?"#9c6e64":"#ffebd8";
   ctx.beginPath();
   ctx.moveTo(x-dx,y-dy);
   ctx.quadraticCurveTo(x+bend,y-bend,x+dx,y+dy);
   ctx.stroke();
  }
 }
 // Sparse pigmentation spots are also world-registered and not pores.
 const sx0=Math.floor(originX/6),sx1=Math.ceil((originX+SKIN_MESO_TILE_WORLD)/6);
 const sy0=Math.floor(originY/6),sy1=Math.ceil((originY+SKIN_MESO_TILE_WORLD)/6);
 for(let iy=sy0;iy<=sy1;iy++){
  for(let ix=sx0;ix<=sx1;ix++){
   if(skinHash(ix,iy,109)<.87)continue;
   const x=(ix+.22+.56*skinHash(ix,iy,131))*6;
   const y=(iy+.22+.56*skinHash(ix,iy,137))*6;
   const size=.11+.16*skinHash(ix,iy,139);
   ctx.globalAlpha=.065*profile.contrast;
   ctx.fillStyle="#a87868";
   ctx.beginPath();ctx.ellipse(x,y,size,size*.68,.2,0,TWO_PI);ctx.fill();
  }
 }
 ctx.setTransform(1,0,0,1,0,0);
 ctx.globalAlpha=1;
 return canvas;
}
/** Draw up to three new tiles per frame and reuse the LRU cache.
 * On a wide overview no mesotiles are materialized: their pixel detail
 * would be subpixel anyway. The semantic surface is kept visible.
 */
export function drawSkinMesoTiles(
 ctx:CanvasRenderingContext2D,bounds:SkinBounds,zoom:number,
 opacity=1,schedule?:()=>void
):number{
 const alpha=skinMesoOpacity(zoom)*opacity;
 if(alpha<=.002)return 0;
 const coords=skinMesoTilesInBounds(bounds);
 // The visible working set must fit the cache. Otherwise the LRU would
 // evict still-visible tiles every frame and schedule a redraw forever.
 // At wide overviews the fine texture is subpixel; the body stays visible.
 if(coords.length>Math.min(SKIN_MESO_VISIBLE_TILE_LIMIT,SKIN_MESO_CACHE_LIMIT))return 0;
 let made=0,pending=false,drawn=0;
 for(const tile of coords){
  let canvas=cache.get(tile.key);
  if(!canvas){
   if(made>=SKIN_MESO_CREATIONS_PER_FRAME){pending=true;continue;}
   canvas=buildMesoTile(tile.x,tile.y);
   made++;
  }else cache.delete(tile.key);
  cache.set(tile.key,canvas);
  while(cache.size>SKIN_MESO_CACHE_LIMIT){
   const oldest=cache.keys().next().value;
   if(oldest===undefined)break;
   cache.delete(oldest);
  }
  ctx.save();
  ctx.globalAlpha=alpha;
  ctx.drawImage(canvas,tile.x*SKIN_MESO_TILE_WORLD,
   tile.y*SKIN_MESO_TILE_WORLD,SKIN_MESO_TILE_WORLD,SKIN_MESO_TILE_WORLD);
  ctx.restore();
  drawn++;
 }
 if(pending)schedule?.();
 return drawn;
}
export function skinMesoCacheSize(){return cache.size;}
