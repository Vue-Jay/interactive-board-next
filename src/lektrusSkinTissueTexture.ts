/** Original H&E-like procedural skin tissue. No imported photo and no
 * stretched low-resolution picture: pigment, collagen and adipose structure
 * are sampled in the same 360 x 600 world as the rest of the human atlas.
 *
 * Reference appearance: NCBI NBK537325; University of Leeds Histology
 * Guide, skin layers. This is an educational reconstruction, not a slide.
 */
import type {SkinSectionContour,SkinSectionPoint} from "./lektrusSkinVectorSections";
import {SKIN_ILLUSTRATIVE_LAYERS} from "./lektrusSkinEvidenceModel";

export type SkinTissueRegion="epidermis"|"dermis"|"subcutis";
export type SkinTissueSample={r:number;g:number;b:number;region:SkinTissueRegion};
export type SkinTissueView={minX:number;maxX:number;minY:number;maxY:number};
export const SKIN_TISSUE_MAX_PIXELS=44000;
export const SKIN_TISSUE_MAX_WIDTH=360;
export const SKIN_TISSUE_MAX_HEIGHT=260;
const clamp=(x:number,a:number,b:number)=>Math.max(a,Math.min(b,x));
const mix=(a:number,b:number,t:number)=>a+(b-a)*t;
const ease=(x:number)=>x*x*(3-2*x);
const reveal=(a:number,b:number,value:number)=>ease(clamp((value-a)/(b-a),0,1));
/** Stable integer lattice noise, not Math.random or screen-fixed grain. */
export function skinTissueHash(x:number,y:number,salt:number):number{
 let n=Math.imul((x|0)^salt,0x1b873593)^Math.imul((y|0)^(salt*13),0x85ebca6b);
 n=Math.imul(n^(n>>>16),0x7feb352d);
 n=Math.imul(n^(n>>>15),0x846ca68b);
 return ((n^(n>>>16))>>>0)/4294967296;
}
export function skinTissueNoise(x:number,y:number,salt:number):number{
 const i=Math.floor(x),j=Math.floor(y);
 const u=ease(x-i),v=ease(y-j);
 return mix(
  mix(skinTissueHash(i,j,salt),skinTissueHash(i+1,j,salt),u),
  mix(skinTissueHash(i,j+1,salt),skinTissueHash(i+1,j+1,salt),u),v);
}
function palette(region:SkinTissueRegion,fraction:number){
 if(region==="epidermis"){
  if(fraction<SKIN_ILLUSTRATIVE_LAYERS.granulosumStart)return [217,166,171] as const; // corneum, anucleate
  if(fraction<SKIN_ILLUSTRATIVE_LAYERS.spinosumStart)return [153,94,139] as const; // granulosum
  if(fraction<SKIN_ILLUSTRATIVE_LAYERS.basaleStart)return [190,126,160] as const; // spinosum
  return [133,91,133] as const; // basal keratinocytes
 }
 if(region==="dermis"){
  // No false crisp boundary between papillary and reticular dermis.
  const t=reveal(.14,.48,fraction);
  return [mix(239,225,t),mix(190,164,t),mix(197,178,t)] as const;
 }
 return [240,218,195] as const;
}
/** Small, irregular white adipocyte lacunae at genuine cell dimensions,
 * with mauve septa. At 20x the cell-sized term is zero (no giant discs).
 * The Voronoi cell geometry is locked to world coordinates. */
export function skinAdiposeField(x:number,y:number){
 const unit=.034; // ~96 µm
 const gx=x/unit,gy=y/unit;
 const ix=Math.floor(gx),iy=Math.floor(gy);
 let closest=1e9,second=1e9;
 for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
  const cx=ix+dx,cy=iy+dy;
  const jitterX=(skinTissueHash(cx,cy,89)-.5)*.35;
  const jitterY=(skinTissueHash(cx,cy,97)-.5)*.35;
  const ux=gx-(cx+.5+jitterX),uy=gy-(cy+.5+jitterY);
  const d=ux*ux+uy*uy;
  if(d<closest){second=closest;closest=d;}
  else if(d<second)second=d;
 }
 const membrane=clamp((Math.sqrt(second)-Math.sqrt(closest))/.23,0,1);
 return {interior:ease(membrane),boundary:1-ease(membrane)};
}
/** Shallow rete ridges and dermal papillae follow the world Y coordinate.
 * Amplitude is only a small fraction of the teaching section, so the
 * epidermis does not turn into a jagged high-contrast ribbon. */
export function skinTissueReteBoundary(y:number):number{
 const warp=skinTissueNoise(y*.33,y*.78,67);
 return SKIN_ILLUSTRATIVE_LAYERS.epidermisEnd+
  .003*Math.sin(y*12+warp*3.2)+
  .002*Math.sin(y*34.5+warp*4.1);
}
/** Restrained illustrative tissue tones, NOT a synthetic microscopic slide.
 * Earlier Voronoi "adipocytes", wavy tubes and periodic fake nuclei were
 * interpreted as anatomical structures. They had no specimen registration.
 * The specimen panel holds real tissue photography. Here only render a
 * continuous, subtle connective-tissue tone without invented cells/vessels.
 * At every camera scale the same world point has the same colour.
 */
export function skinTissueSample(x:number,y:number,fraction:number,_scale:number):SkinTissueSample{
 const original=clamp(fraction,0,1);
 const boundary=skinTissueReteBoundary(y);
 const depth=clamp(original+(SKIN_ILLUSTRATIVE_LAYERS.epidermisEnd-boundary)*
  (1-reveal(.075,.12,original)),0,1);
 const region:SkinTissueRegion=depth<SKIN_ILLUSTRATIVE_LAYERS.epidermisEnd?"epidermis":
  depth<SKIN_ILLUSTRATIVE_LAYERS.dermisEnd?"dermis":"subcutis";
 const base=palette(region,depth);
 // Low-contrast, stable tonal modulation does not depict individual cells.
 const coarse=skinTissueNoise(x*1.55,y*1.36,23)-.5;
 const medium=skinTissueNoise(x*5.4,y*4.1,29)-.5;
 const small=skinTissueNoise(x*17.2,y*15.8,37)-.5;
 const tone=(coarse*13+medium*6+small*2)*
  (region==="epidermis"?.45:region==="dermis"?.60:.36);
 const r=base[0]+tone, g=base[1]+tone*.70, b=base[2]+tone*.80;
 return {r:Math.round(clamp(r,0,255)),g:Math.round(clamp(g,0,255)),
  b:Math.round(clamp(b,0,255)),region};
}

function positionAt(c:SkinSectionContour,y:number):SkinSectionPoint|null{
 const points=c.points;
 if(points.length<2||y<points[0].y||y>points[points.length-1].y)return null;
 let lo=0,hi=points.length-1;
 while(hi-lo>1){
  const mid=(lo+hi)>>1;
  if(points[mid].y<y)lo=mid;else hi=mid;
 }
 const a=points[lo],b=points[hi];
 const t=clamp((y-a.y)/Math.max(1e-7,b.y-a.y),0,1);
 return {x:mix(a.x,b.x,t),y,depth:mix(a.depth,b.depth,t)};
}
export type SkinTissueRenderStats={sampledPixels:number;width:number;height:number};
type TextureCache={
 canvas:HTMLCanvasElement;ctx:CanvasRenderingContext2D;
 rgba:ImageData;signature:string;
 anchor:{a:number;d:number;e:number;f:number}|null;
};
const caches=new WeakMap<HTMLCanvasElement,TextureCache>();
/** Capped viewport buffer. On any camera change its world-coordinate
 * photomicrograph is re-sampled, rather than stretching a static small image.
 * The calling ctx is already clipped to the correct vector flank contours.
 */
export function drawSkinTissueTexture(
 ctx:CanvasRenderingContext2D,
 contours:readonly SkinSectionContour[],scale:number,
 bounds:SkinTissueView
):SkinTissueRenderStats{
 const source=ctx.canvas;
 if(!source||!contours.length)return {sampledPixels:0,width:0,height:0};
 const ratio=Math.min(1,SKIN_TISSUE_MAX_WIDTH/source.width,
  SKIN_TISSUE_MAX_HEIGHT/source.height,
  Math.sqrt(SKIN_TISSUE_MAX_PIXELS/(source.width*source.height)));
 const width=Math.max(1,Math.floor(source.width*ratio));
 const height=Math.max(1,Math.floor(source.height*ratio));
 let cache=caches.get(source);
 if(!cache){
  const canvas=document.createElement("canvas");
  const context=canvas.getContext("2d",{alpha:true});
  if(!context)return {sampledPixels:0,width,height};
  canvas.width=width;canvas.height=height;
  cache={canvas,ctx:context,rgba:context.createImageData(width,height),
   signature:"",anchor:null};
  caches.set(source,cache);
 }
 if(cache.canvas.width!==width||cache.canvas.height!==height){
  cache.canvas.width=width;cache.canvas.height=height;
  cache.rgba=cache.ctx.createImageData(width,height);
  cache.signature="";cache.anchor=null;
 }
 const m=ctx.getTransform();
 if(m.a<=0||m.d<=0)return {sampledPixels:0,width,height};
 const signature=[m.a,m.d,m.e,m.f,width,height,scale].join(":");
 const anchor=cache.anchor;
 // During a small camera animation, reproject the *same* world-anchored
 // tissue image instead of blocking every requestAnimationFrame with noise
 // regeneration. Refresh after a meaningful pan or zoom. Cell vectors are
 // always redrawn at native device resolution.
 const needsRefresh=cache.signature!==signature&&(
  !anchor||Math.abs(Math.log(m.a/anchor.a))>.06||
  Math.abs(m.e-anchor.e)>18||Math.abs(m.f-anchor.f)>18);
 if(needsRefresh){
  const data=cache.rgba.data;
  data.fill(0);
  const xStep=source.width/width;
  const yStep=source.height/height;
  const candidates=contours.filter(c=>c.maxX>=bounds.minX&&
   c.minX<=bounds.maxX&&c.maxY>=bounds.minY&&c.minY<=bounds.maxY);
  for(let j=0;j<height;j++){
   const y=((j+.5)*yStep-m.f)/m.d;
   if(y<bounds.minY||y>bounds.maxY)continue;
   for(const contour of candidates){
    if(y<contour.minY||y>contour.maxY)continue;
    const p=positionAt(contour,y);
    if(!p||p.depth<=0)continue;
    const ax=p.x, bx=p.x+contour.inward*p.depth;
    const left=Math.min(ax,bx),right=Math.max(ax,bx);
    const i0=clamp(Math.ceil((m.a*left+m.e)/xStep-.5),0,width-1);
    const i1=clamp(Math.floor((m.a*right+m.e)/xStep-.5),0,width-1);
    for(let i=i0;i<=i1;i++){
     const x=((i+.5)*xStep-m.e)/m.a;
     const fraction=(x-p.x)/(contour.inward*p.depth);
     if(fraction<0||fraction>1)continue;
     const color=skinTissueSample(x,y,fraction,scale);
     const k=(j*width+i)*4;
     data[k]=color.r;data[k+1]=color.g;
     data[k+2]=color.b;data[k+3]=255;
    }
   }
  }
  cache.ctx.putImageData(cache.rgba,0,0);
  cache.signature=signature;
  cache.anchor={a:m.a,d:m.d,e:m.e,f:m.f};
 }
 // The cached image was generated in an earlier camera frame. Draw its
 // EXACT world-space rectangle through the CURRENT camera matrix, so pan
 // and smooth zoom never make fibers or cells "swim" in screen coordinates.
 const painted=cache.anchor;
 if(painted){
  ctx.save();ctx.globalAlpha=1;ctx.imageSmoothingEnabled=true;
  ctx.drawImage(cache.canvas,
   -painted.e/painted.a,-painted.f/painted.d,
   source.width/painted.a,source.height/painted.d);
  ctx.restore();
 }
 return {sampledPixels:width*height,width,height};
}
