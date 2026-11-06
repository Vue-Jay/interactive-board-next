/** Lossless topological body outline, extracted ONCE from the registered
 * high-res source alpha. Unlike stretching a 1080x1800 raster at 360x,
 * the same body contour is then traced as crisp native-resolution paths.
 * This is only silhouette geometry, NOT fabricated microanatomy.
 */
export type SkinSilhouetteVector={
 path:Path2D;
 loops:number;
 boundaryEdges:number;
};
const threshold=100;
/** All directed edges run with the solid body to their RIGHT. */
export function skinSilhouetteVector(
 alpha:Uint8ClampedArray,width:number,height:number,factor=3
):SkinSilhouetteVector{
 if(!width||!height||width*height!==alpha.length||
  !Number.isFinite(factor)||factor<=0)
  throw Error("Invalid silhouette alpha dimensions");
 const stride=width+1;
 const next=new Map<number,number[]>();
 let boundaryEdges=0;
 const solid=(x:number,y:number)=>x>=0&&y>=0&&
  x<width&&y<height&&alpha[y*width+x]>=threshold;
 const edge=(a:number,b:number)=>{
  const list=next.get(a);
  if(list)list.push(b);else next.set(a,[b]);
  boundaryEdges++;
 };
 for(let y=0;y<height;y++){
  for(let x=0;x<width;x++){
   if(!solid(x,y))continue;
   const top=y*stride+x,bottom=top+stride;
   if(!solid(x,y-1))edge(top,top+1);
   if(!solid(x+1,y))edge(top+1,bottom+1);
   if(!solid(x,y+1))edge(bottom+1,bottom);
   if(!solid(x-1,y))edge(bottom,top);
  }
 }
 const direction=(a:number,b:number)=>{
  const d=b-a;
  return d===1?0:d===stride?1:d===-1?2:3;
 };
 const path=new Path2D();
 let loops=0,visited=0;
 // Choose the right-hand continuation at corner-touching pixels. This
 // retains separate adjacent digit loops without bridging transparent gaps.
 while(next.size){
  const first=next.entries().next().value as [number,number[]]|undefined;
  if(!first)break;
  const start=first[0];
  let here=start,priorDir=-1;
  const points:number[]=[start];
  for(let i=0;i<=boundaryEdges;i++){
   const options=next.get(here);
   if(!options?.length)break;
   let chosen=0,best=99;
   for(let j=0;j<options.length;j++){
    const dir=direction(here,options[j]);
    const turn=priorDir<0?0:(dir-priorDir+4)%4;
    const priority=turn===1?0:turn===0?1:turn===3?2:3;
    if(priority<best){best=priority;chosen=j;}
   }
   const to=options.splice(chosen,1)[0];
   if(!options.length)next.delete(here);
   priorDir=direction(here,to);here=to;visited++;
   if(to===start)break;
   points.push(to);
  }
  if(points.length<4||here!==start)continue;
  const length=points.length;
  const xy=points.map(v=>({
   x:(v%stride)/factor,y:Math.floor(v/stride)/factor
  }));
  // A two-pixel local lowpass removes raster staircase transitions
  // without moving an edge from one finger to another or erasing gaps.
  const smooth=xy.map((p,i)=>{
   const a=xy[(i+length-2)%length],b=xy[(i+length-1)%length],
    c=xy[(i+1)%length],d=xy[(i+2)%length];
   return {x:(a.x+2*b.x+4*p.x+2*c.x+d.x)/10,
    y:(a.y+2*b.y+4*p.y+2*c.y+d.y)/10};
  });
  const last=smooth[length-1],firstPoint=smooth[0];
  path.moveTo((last.x+firstPoint.x)/2,(last.y+firstPoint.y)/2);
  for(let i=0;i<length;i++){
   const a=smooth[i],b=smooth[(i+1)%length];
   path.quadraticCurveTo(a.x,a.y,(a.x+b.x)/2,(a.y+b.y)/2);
  }
  path.closePath();loops++;
 }
 return {path,loops,boundaryEdges};
}
