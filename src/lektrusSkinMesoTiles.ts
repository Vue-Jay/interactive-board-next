/** Hand-drawn-looking microrelief, not random pigment noise.
 *
 * The previous version mixed saturated red/brown noise, cellular spots and
 * thousands of flecks: at 7x it looked like blotchy diseased skin. This
 * renderer deliberately paints NO freckles, stains or large tone fields.
 *
 * Every furrow and fine highlight is a stable curve in body-local
 * coordinates. Adjacent tiles reuse the same global grid, and each stroke
 * uses the local region's orientation (arm, hand, face, torso or leg).
 * The original anatomical image owns the skin COLOR and LIGHTING.
 */
import {skinHash,skinSmoothstep,skinValueNoise,type SkinBounds}
 from "./lektrusSkinSurfaceField";

export const SKIN_MESO_TILE_WORLD=32;
export const SKIN_MESO_TILE_PIXELS=224;
export const SKIN_MESO_CACHE_LIMIT=48;
export const SKIN_MESO_CREATIONS_PER_FRAME=3;
export const SKIN_MESO_VISIBLE_TILE_LIMIT=72;

export type SkinMesoRegion="face"|"torso"|"arm"|"hand"|"leg"|"general";
export type SkinMesoProfile={
 region:SkinMesoRegion;
 direction:number;
 contrast:number;
 furrowStep:number;
 fineGrain:number;
};
const ellipse=(x:number,y:number,cx:number,cy:number,rx:number,ry:number)=>
 Math.hypot((x-cx)/rx,(y-cy)/ry);
/** Coarse anatomical atlas map. Direction is only orientation of fine skin
 * relief, not a different source texture or a hard regional crop.
 */
export function skinMesoProfile(x:number,y:number):SkinMesoProfile{
 const hand=Math.min(ellipse(x,y,57,335,22,37),
  ellipse(x,y,303,335,22,37));
 if(hand<1.15){
  return {region:"hand",direction:Math.PI*.07,contrast:.90,
   furrowStep:.64,fineGrain:1.15};
 }
 if(ellipse(x,y,180,75,38,55)<1){
  return {region:"face",direction:.2,contrast:.50,
   furrowStep:.82,fineGrain:.85};
 }
 if(ellipse(x,y,81,245,36,103)<1||
    ellipse(x,y,279,245,36,103)<1){
  const side=x<180?-1:1;
  return {region:"arm",direction:Math.PI*.48+side*.17,
   contrast:1.05,furrowStep:.68,fineGrain:1.05};
 }
 if(ellipse(x,y,136,446,28,135)<1||
    ellipse(x,y,224,446,28,135)<1){
  return {region:"leg",direction:Math.PI*.5,contrast:.85,
   furrowStep:.75,fineGrain:1.0};
 }
 if(ellipse(x,y,180,235,63,130)<1.05){
  return {region:"torso",direction:.57,contrast:.67,
   furrowStep:.88,fineGrain:.88};
 }
 return {region:"general",direction:1.1,contrast:.77,
  furrowStep:.76,fineGrain:.98};
}
/** Smoothly blend relief directions across anatomy boundaries so a hand
 * does not acquire an abrupt seam where the forearm profile ends. */
export function skinMesoFlowDirection(x:number,y:number):number{
 let vx=Math.cos(1.1),vy=Math.sin(1.1);
 const blend=(angle:number,distance:number)=>{
  const weight=1-skinSmoothstep(.70,1.22,distance);
  if(weight<=0)return;
  vx=vx*(1-weight)+Math.cos(angle)*weight;
  vy=vy*(1-weight)+Math.sin(angle)*weight;
 };
 blend(.57,ellipse(x,y,180,235,63,130));
 blend(.2,ellipse(x,y,180,75,38,55));
 blend(Math.PI*.5,Math.min(ellipse(x,y,136,446,28,135),
  ellipse(x,y,224,446,28,135)));
 blend(Math.PI*.31,ellipse(x,y,81,245,36,103));
 blend(Math.PI*.65,ellipse(x,y,279,245,36,103));
 blend(Math.PI*.07,Math.min(ellipse(x,y,57,335,22,37),
  ellipse(x,y,303,335,22,37)));
 return Math.atan2(vy,vx);
}
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
 for(let y=y0;y<=y1;y++)
  for(let x=x0;x<=x1;x++)result.push({x,y,key:skinMesoKey(x,y)});
 return result;
}
const cache=new Map<string,HTMLCanvasElement>();

/** A bounded fine-scale variation in line displacement only. We never
 * convert this noise into broad red/brown colored stains or spots.
 */
export function skinMesoTone(worldX:number,worldY:number){
 const grain=skinValueNoise(worldX*2.7,worldY*2.7,127);
 const fine=skinValueNoise(worldX*7.3,worldY*7.3,151);
 return (grain-.5)*.30+(fine-.5)*.14;
}
export type SkinFurrow={
 x:number;y:number;endX:number;endY:number;
 controlX:number;controlY:number;weight:number;width:number;
};
/** Region-specific fine skin line. Its coordinates are derived from global
 * world point and integer seed, so panning never shifts the pattern.
 */
export function skinFurrowAt(ix:number,iy:number):SkinFurrow{
 const step=.72;
 const x=(ix+.20+.60*skinHash(ix,iy,43))*step;
 const y=(iy+.20+.60*skinHash(ix,iy,53))*step;
 const profile=skinMesoProfile(x,y);
 const theta=skinMesoFlowDirection(x,y)+(skinHash(ix,iy,67)-.5)*.85;
 const length=step*(.30+.40*skinHash(ix,iy,73));
 const bend=(skinHash(ix,iy,79)-.5)*step*.12;
 const dx=Math.cos(theta)*length*.5;
 const dy=Math.sin(theta)*length*.5;
 const thickness=(.058+.020*skinHash(ix,iy,89))*profile.fineGrain;
 return {
  x:x-dx,y:y-dy,endX:x+dx,endY:y+dy,
  controlX:x+bend,controlY:y-bend,
  width:thickness,weight:profile.contrast
 };
}
/** A second hairline alongside a dark skin furrow forms a very subtle
 * relief highlight, rather than a dense speckled color noise layer.
 */
function strokeFurrow(ctx:CanvasRenderingContext2D,g:SkinFurrow){
 ctx.globalAlpha=.26*g.weight;
 ctx.lineWidth=g.width;
 ctx.strokeStyle="#94675e";
 ctx.beginPath();
 ctx.moveTo(g.x,g.y);
 ctx.quadraticCurveTo(g.controlX,g.controlY,g.endX,g.endY);
 ctx.stroke();
 ctx.globalAlpha=.15*g.weight;
 ctx.lineWidth=g.width*.66;
 ctx.strokeStyle="#fff1dd";
 ctx.beginPath();
 ctx.moveTo(g.x,g.y+g.width*1.7);
 ctx.quadraticCurveTo(g.controlX,g.controlY+g.width*1.7,
  g.endX,g.endY+g.width*1.7);
 ctx.stroke();
}
/** Crossings use much finer marks. They describe the irregular mesh of
 * the skin's shallow sulci, not a stamped dot or random pigment patch.
 */
function strokeCrossing(ctx:CanvasRenderingContext2D,ix:number,iy:number){
 if(skinHash(ix,iy,123)<.42)return;
 const g=skinFurrowAt(ix,iy);
 const theta=Math.atan2(g.endY-g.y,g.endX-g.x)+Math.PI*.55;
 const radius=.13+.08*skinHash(ix,iy,124);
 const dx=Math.cos(theta)*radius,dy=Math.sin(theta)*radius;
 const cx=g.controlX,cy=g.controlY;
 ctx.globalAlpha=.12*g.weight;
 ctx.strokeStyle="#9d756d";
 ctx.lineWidth=.036;
 ctx.beginPath();
 ctx.moveTo(cx-dx,cy-dy);
 ctx.quadraticCurveTo(cx+.035,cy-.022,cx+dx,cy+dy);
 ctx.stroke();
}
/** Annotated anatomical hand crease landmarks, not an oval texture.
 * Short metacarpal/finger folds are drawn only near the hands and are
 * feathered with local weights. Their orientation follows joint lines.
 */
export function skinHandCreaseAnchors(){
 const folds:{x:number;y:number;length:number;angle:number}[]=[];
 for(const cx of [57,303]){
  const flipped=cx>180?-1:1;
  for(const finger of [-2,-1,0,1,2]){
   // Multiple short folds at finger joints, positioned on the illustration.
   for(const [row,y] of [338,349,358].entries()){
    folds.push({
     x:cx+finger*4.9+flipped*.35*row,
     y:y+(Math.abs(finger)*.8),
     length:(1.1+skinHash(finger,row,115)*.9)*(row===0?1.25:1),
     angle:.15*flipped+(skinHash(finger,row,116)-.5)*.12
    });
   }
  }
 }
 return folds;
}
const handCreases=skinHandCreaseAnchors();
function drawHandFolds(
 ctx:CanvasRenderingContext2D,tileX:number,tileY:number
){
 const left=tileX*SKIN_MESO_TILE_WORLD;
 const top=tileY*SKIN_MESO_TILE_WORLD;
 const right=left+SKIN_MESO_TILE_WORLD;
 const bottom=top+SKIN_MESO_TILE_WORLD;
 for(const f of handCreases){
  if(f.x+f.length<left||f.x-f.length>right||
     f.y+1<top||f.y-1>bottom)continue;
  const dx=Math.cos(f.angle)*f.length*.5;
  const dy=Math.sin(f.angle)*f.length*.5;
  ctx.globalAlpha=.27;
  ctx.strokeStyle="#91685f";
  ctx.lineWidth=.085;
  ctx.beginPath();
  ctx.moveTo(f.x-dx,f.y-dy);
  ctx.quadraticCurveTo(f.x,f.y+.14,f.x+dx,f.y+dy);
  ctx.stroke();
  ctx.globalAlpha=.14;
  ctx.strokeStyle="#fff0d8";
  ctx.beginPath();
  ctx.moveTo(f.x-dx,f.y-dy+.11);
  ctx.quadraticCurveTo(f.x,f.y+.25,f.x+dx,f.y+dy+.11);
  ctx.stroke();
 }
}
function buildMesoTile(tileX:number,tileY:number){
 const canvas=document.createElement("canvas");
 canvas.width=SKIN_MESO_TILE_PIXELS;
 canvas.height=SKIN_MESO_TILE_PIXELS;
 const ctx=canvas.getContext("2d");
 if(!ctx)return canvas;
 // NO putImageData and NO alpha pigment blotch noise. The source body
 // retains its natural color; only small anatomical furrows are added.
 const originX=tileX*SKIN_MESO_TILE_WORLD;
 const originY=tileY*SKIN_MESO_TILE_WORLD;
 const pixelsPerWorld=SKIN_MESO_TILE_PIXELS/SKIN_MESO_TILE_WORLD;
 ctx.setTransform(pixelsPerWorld,0,0,pixelsPerWorld,
  -originX*pixelsPerWorld,-originY*pixelsPerWorld);
 const spacing=.72;
 const minX=Math.floor((originX-spacing)/spacing);
 const maxX=Math.ceil((originX+SKIN_MESO_TILE_WORLD+spacing)/spacing);
 const minY=Math.floor((originY-spacing)/spacing);
 const maxY=Math.ceil((originY+SKIN_MESO_TILE_WORLD+spacing)/spacing);
 for(let iy=minY;iy<=maxY;iy++){
  for(let ix=minX;ix<=maxX;ix++){
   const g=skinFurrowAt(ix,iy);
   strokeFurrow(ctx,g);
   strokeCrossing(ctx,ix,iy);
  }
 }
 drawHandFolds(ctx,tileX,tileY);
 ctx.setTransform(1,0,0,1,0,0);
 ctx.globalAlpha=1;
 return canvas;
}
export function drawSkinMesoTiles(
 ctx:CanvasRenderingContext2D,bounds:SkinBounds,zoom:number,
 opacity=1,schedule?:()=>void
):number{
 const alpha=skinMesoOpacity(zoom)*opacity;
 if(alpha<=.002)return 0;
 const coords=skinMesoTilesInBounds(bounds);
 // A wide view does not allocate a giant texture array or thrash its LRU.
 if(coords.length>Math.min(SKIN_MESO_VISIBLE_TILE_LIMIT,SKIN_MESO_CACHE_LIMIT))
  return 0;
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
