/** A schematic three-layer skin section drawn only along the sides of
 * each opaque part of the body. All coordinates share the 360x600 world.
 * The width is deliberately exaggerated for educational visibility.
 */
export const SKIN_EDGE_WORLD_WIDTH=2.9;
export const SKIN_EDGE_NATIVE_FACTOR=3;
export const SKIN_EDGE_ALPHA_THRESHOLD=44;
export const SKIN_EDGE_LAYER_WIDTHS={epidermis:.43,dermis:1.15,subcutis:1.32} as const;
export type SkinEdgeLayer="epidermis"|"dermis"|"subcutis";
export type SkinEdgeRun={start:number;end:number};
export type SkinEdgeLandmark={x:number;y:number;inward:-1|1};
export const SKIN_EDGE_COLORS={
 epidermis:[177,83,107],dermis:[233,154,151],subcutis:[243,203,118]
} as const;
export function skinEdgeLayerAt(distance:number):SkinEdgeLayer|null{
 if(!Number.isFinite(distance)||distance<0||distance>SKIN_EDGE_WORLD_WIDTH)return null;
 if(distance<SKIN_EDGE_LAYER_WIDTHS.epidermis)return "epidermis";
 if(distance<SKIN_EDGE_LAYER_WIDTHS.epidermis+SKIN_EDGE_LAYER_WIDTHS.dermis)return "dermis";
 return "subcutis";
}
export function skinEdgeRuns(alpha:Uint8ClampedArray,width:number,row:number):SkinEdgeRun[]{
 const runs:SkinEdgeRun[]=[];
 let start=-1;
 for(let x=0;x<=width;x++){
  const opaque=x<width&&alpha[row*width+x]>=SKIN_EDGE_ALPHA_THRESHOLD;
  if(opaque&&start===-1)start=x;
  if(!opaque&&start!==-1){
   if(x-start>=4)runs.push({start,end:x-1});
   start=-1;
  }
 }
 return runs;
}
export function createSkinEdgeRaster(
 alpha:Uint8ClampedArray,width:number,height:number,
 factor=SKIN_EDGE_NATIVE_FACTOR
):{rgba:Uint8ClampedArray;landmarks:SkinEdgeLandmark[]}{
 if(width*height!==alpha.length)throw Error("Invalid silhouette dimensions");
 const rgba=new Uint8ClampedArray(width*height*4);
 const landmarks:SkinEdgeLandmark[]=[];
 for(let y=0;y<height;y++){
  for(const span of skinEdgeRuns(alpha,width,y)){
   const {start,end}=span;
   const last=Math.min(Math.ceil(SKIN_EDGE_WORLD_WIDTH*factor),(end-start)/2);
   for(let d=0;d<=last;d++){
    const layer=skinEdgeLayerAt(d/factor);
    if(!layer)continue;
    const rgb=SKIN_EDGE_COLORS[layer];
    for(const x of [start+d,end-d]){
     const a=Math.round(alpha[y*width+x]*.96);
     const i=(y*width+x)*4;
     if(a<=rgba[i+3])continue;
     rgba[i]=rgb[0];rgba[i+1]=rgb[1];rgba[i+2]=rgb[2];rgba[i+3]=a;
    }
   }
   if(y%(factor*8)===0&&end-start>factor*8){
    landmarks.push({x:start/factor,y:y/factor,inward:1},
     {x:end/factor,y:y/factor,inward:-1});
   }
  }
 }
 return {rgba,landmarks};
}

const smooth=(a:number,b:number,value:number)=>{
 const t=Math.max(0,Math.min(1,(value-a)/(b-a)));
 return t*t*(3-2*t);
};
export function skinEdgeDetailsAlpha(scale:number){return smooth(2.5,6.5,scale);}
/** Repeating schematic vessels and fat lobules are anchored to the SAME
 * silhouette edge, never a blanket texture across the body.
 */
export function drawSkinEdgeDetails(
 ctx:CanvasRenderingContext2D,
 landmarks:readonly SkinEdgeLandmark[],scale:number,
 bounds:{minX:number;maxX:number;minY:number;maxY:number}
):number{
 const opacity=skinEdgeDetailsAlpha(scale);
 if(opacity<.005)return 0;
 let painted=0;
 for(const p of landmarks){
  if(p.y<bounds.minY-4||p.y>bounds.maxY+4||
   p.x<bounds.minX-4||p.x>bounds.maxX+4)continue;
  const x=p.x+p.inward*1.0,y=p.y;
  ctx.save();
  ctx.globalAlpha=opacity*.7;
  ctx.strokeStyle="#bb5168";ctx.lineWidth=.08;
  ctx.beginPath();ctx.moveTo(x,y+1.0);
  ctx.bezierCurveTo(x-p.inward*.25,y+.1,x+p.inward*.37,y-.3,
   x+p.inward*.3,y-1);
  ctx.stroke();
  ctx.strokeStyle="#7c9abd";ctx.lineWidth=.055;
  ctx.beginPath();ctx.moveTo(x+p.inward*.38,y-1);
  ctx.quadraticCurveTo(x+p.inward*.65,y+.2,x+p.inward*.42,y+1);
  ctx.stroke();
  ctx.globalAlpha=opacity*.7;
  ctx.fillStyle="#fff2c6";
  ctx.beginPath();ctx.ellipse(p.x+p.inward*2.35,y+2.5,
   .34,.46,.1,0,Math.PI*2);ctx.fill();
  ctx.restore();painted++;
 }
 return painted;
}
