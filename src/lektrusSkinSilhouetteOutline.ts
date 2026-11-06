/** Silhouette outlines are NOT tissue sections.
 * Trace every alpha boundary of the supplied registered whole-body plate.
 * Unlike section contours, NO minimum finger width/track length is applied:
 * the last pixels of every fingertip and toe must remain outlined.
 * The source plate is read once; paths and bounds are then immutable and
 * camera zoom or pan cannot generate or change anatomical features.
 */
export type SkinOutlinePoint={x:number;y:number};
export type SkinOutlineLoop={
 points:SkinOutlinePoint[];
 minX:number;maxX:number;minY:number;maxY:number;
};
type Bounds={minX:number;maxX:number;minY:number;maxY:number};
type Edge={from:number;to:number;direction:0|1|2|3};
type RenderPath={path:Path2D;bounds:Bounds};
export type SkinSilhouettePaths=readonly RenderPath[];
/** Deterministic oriented pixel-boundary tracer.
 * Right-hand edge orientation guarantees that two separate fingertips
 * meeting diagonally at one grid vertex remain distinct paths.
 */
export function traceSkinSilhouette(
 alpha:Uint8ClampedArray,width:number,height:number,factor=3
):SkinOutlineLoop[]{
 if(width<=0||height<=0||width*height!==alpha.length||
  factor<=0||!Number.isFinite(factor))
  throw Error("Invalid whole-body silhouette alpha");
 const stride=width+1;
 const edgeList:Edge[]=[];
 const outgoing=new Map<number,number[]>();
 const foreground=(x:number,y:number)=>
  x>=0&&x<width&&y>=0&&y<height&&alpha[y*width+x]>=64;
 const encode=(x:number,y:number)=>y*stride+x;
 const put=(x1:number,y1:number,x2:number,y2:number,
  direction:0|1|2|3)=>{
  const from=encode(x1,y1),to=encode(x2,y2);
  const idx=edgeList.length;
  edgeList.push({from,to,direction});
  const entries=outgoing.get(from);
  if(entries)entries.push(idx);else outgoing.set(from,[idx]);
 };
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){
  if(!foreground(x,y))continue;
  if(!foreground(x,y-1))put(x,y,x+1,y,0);
  if(!foreground(x+1,y))put(x+1,y,x+1,y+1,1);
  if(!foreground(x,y+1))put(x+1,y+1,x,y+1,2);
  if(!foreground(x-1,y))put(x,y+1,x,y,3);
 }
 const used=new Uint8Array(edgeList.length),loops:SkinOutlineLoop[]=[];
 const point=(encoded:number)=>({
  x:(encoded%stride)/factor,
  y:Math.floor(encoded/stride)/factor
 });
 for(let first=0;first<edgeList.length;first++){
  if(used[first])continue;
  const vertices:number[]=[];
  const start=edgeList[first].from;
  let idx=first;
  for(let steps=0;steps<=edgeList.length;steps++){
   if(used[idx])break;
   const e=edgeList[idx];used[idx]=1;
   vertices.push(e.from);
   if(e.to===start)break;
   const candidates=(outgoing.get(e.to)??[]).filter(i=>!used[i]);
   if(!candidates.length)break;
   // A right turn follows the same foreground pixel at ambiguous
   // diagonal contacts. Never bridge distinct digits through a corner.
   const order=[1,0,3,2];
   candidates.sort((i,j)=>
    order.indexOf((edgeList[i].direction-e.direction+4)%4)-
    order.indexOf((edgeList[j].direction-e.direction+4)%4));
   idx=candidates[0];
  }
  if(vertices.length<5)continue;
  const original=vertices.map(point);
  // Remove collinear native raster samples, not the tips or forks.
  const corners=original.filter((p,i)=>{
   const a=original[(i+original.length-1)%original.length];
   const b=original[(i+1)%original.length];
   return Math.abs((p.x-a.x)*(b.y-p.y)-
    (p.y-a.y)*(b.x-p.x))>1e-9;
  });
  if(corners.length<4)continue;
  // A one-pixel antialias island is noise, not part of the figure.
  const minX=Math.min(...corners.map(p=>p.x)),
   maxX=Math.max(...corners.map(p=>p.x)),
   minY=Math.min(...corners.map(p=>p.y)),
   maxY=Math.max(...corners.map(p=>p.y));
  if((maxX-minX)*(maxY-minY)<.09)continue;
  loops.push({points:corners,minX,maxX,minY,maxY});
 }
 return loops;
}
/** Cache smooth world-space Path2Ds just once after the alpha image loads. */
export function buildSkinSilhouettePaths(
 alpha:Uint8ClampedArray,width:number,height:number,factor=3
):SkinSilhouettePaths{
 return traceSkinSilhouette(alpha,width,height,factor).map(loop=>{
  const points=loop.points,n=points.length;
  const softened=points.map((p,i)=>{
   const prev=points[(i+n-1)%n],next=points[(i+1)%n];
   return {x:(prev.x+p.x*2+next.x)/4,
    y:(prev.y+p.y*2+next.y)/4};
  });
  const path=new Path2D();
  const p0=softened[n-1],p1=softened[0];
  path.moveTo((p0.x+p1.x)/2,(p0.y+p1.y)/2);
  for(let i=0;i<n;i++){
   const p=softened[i],next=softened[(i+1)%n];
   path.quadraticCurveTo(p.x,p.y,(p.x+next.x)/2,(p.y+next.y)/2);
  }
  path.closePath();
  return {path,bounds:{minX:loop.minX,maxX:loop.maxX,
   minY:loop.minY,maxY:loop.maxY}};
 });
}
export function drawSkinSilhouettePaths(
 ctx:CanvasRenderingContext2D,paths:SkinSilhouettePaths,
 bounds:Bounds,pixelsPerWorld:number
):number{
 let count=0;
 ctx.save();
 ctx.strokeStyle="#879ba5";
 ctx.globalAlpha=.76;
 ctx.lineWidth=Math.max(.012,1.05/Math.max(1,pixelsPerWorld));
 ctx.lineJoin="round";ctx.lineCap="round";
 for(const p of paths){
  const b=p.bounds;
  if(b.maxX<bounds.minX||b.minX>bounds.maxX||
   b.maxY<bounds.minY||b.minY>bounds.maxY)continue;
  ctx.stroke(p.path);count++;
 }
 ctx.restore();return count;
}
