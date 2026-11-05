/** Original H&E-like procedural skin tissue. No imported photo and no
 * stretched low-resolution picture: pigment, collagen and adipose structure
 * are sampled in the same 360 x 600 world as the rest of the human atlas.
 *
 * Reference appearance: NCBI NBK537325; University of Leeds Histology
 * Guide, skin layers. This is an educational reconstruction, not a slide.
 */
import type {SkinSectionContour,SkinSectionPoint} from "./lektrusSkinVectorSections";

export type SkinTissueRegion="epidermis"|"dermis"|"subcutis";
export type SkinTissueSample={r:number;g:number;b:number;region:SkinTissueRegion};
export type SkinTissueView={minX:number;maxX:number;minY:number;maxY:number};
export const SKIN_TISSUE_MAX_PIXELS=260000;
export const SKIN_TISSUE_MAX_WIDTH=860;
export const SKIN_TISSUE_MAX_HEIGHT=600;
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
  if(fraction<.025)return [217,166,171] as const; // corneum, anucleate
  if(fraction<.046)return [153,94,139] as const; // granulosum
  if(fraction<.106)return [190,126,160] as const; // spinosum
  return [133,91,133] as const; // basal keratinocytes
 }
 if(region==="dermis"){
  // No false crisp boundary between papillary and reticular dermis.
  const t=reveal(.21,.37,fraction);
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
/** A 2D keratinocyte mosaic is only resolved far into the continuous zoom.
 * It is not enlarged by the thickness of the teaching cutaway. */
function keratinocyteField(x:number,y:number){
 const unit=.0082; // ~23 µm
 const gx=x/unit,gy=y/unit;
 const ix=Math.floor(gx),iy=Math.floor(gy);
 let nearest=1e9,runner=1e9;
 for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
  const xx=ix+dx,yy=iy+dy;
  const px=xx+.5+(skinTissueHash(xx,yy,139)-.5)*.33;
  const py=yy+.5+(skinTissueHash(xx,yy,147)-.5)*.33;
  const d=(gx-px)**2+(gy-py)**2;
  if(d<nearest){runner=nearest;nearest=d;}else if(d<runner)runner=d;
 }
 return {edge:1-ease(clamp((Math.sqrt(runner)-Math.sqrt(nearest))/.19,0,1)),
  center:clamp(Math.sqrt(nearest),0,1)};
}
/** H&E-like pigment tied to tissue depth. The loose papillary dermis has
 * finer fibres; deeper reticular dermis has denser interlacing collagen.
 * The epidermis is avascular, and the hypodermis has lipid vacuoles. */
export function skinTissueSample(x:number,y:number,fraction:number,scale:number):SkinTissueSample{
 const depth=clamp(fraction,0,1);
 const region:SkinTissueRegion=depth<.13?"epidermis":
  depth<.54?"dermis":"subcutis";
 const base=palette(region,depth);
 const warp=skinTissueNoise(x*1.7,y*1.4,13)-.5;
 const n1=skinTissueNoise(x*.82,y*.94,23)-.5;
 const n2=skinTissueNoise(x*4.8,y*5.4,29)-.5;
 const n3=skinTissueNoise(x*20.2,y*17.1,37)-.5;
 const tiny=skinTissueNoise(x*67,y*68,43)-.5;
 let variation=11*n1+9*n2+5*n3+2*tiny;
 let red=base[0]+variation;
 let green=base[1]+variation*.68;
 let blue=base[2]+variation*.86;
 if(region==="dermis"){
  // Domain-warped directional collagen: it does not form a perfect grid.
  const angle=skinTissueNoise(x*1.5,y*1.7,51)*2.7;
  const axis=x*Math.cos(angle)+y*Math.sin(angle);
  const axis2=x*Math.cos(angle+1.16)+y*Math.sin(angle+1.16);
  const f1=Math.sin(axis*34+warp*7+n2*2.8);
  const f2=Math.sin(axis2*51-warp*8+n3*3);
  const strandA=(1-Math.abs(f1))**8;
  const strandB=(1-Math.abs(f2))**11;
  const density=mix(.48,1,reveal(.17,.53,depth));
  const fiber=(strandA*.73+strandB*.42)*density;
  red+=fiber*33;green+=fiber*20;blue+=fiber*23;
  const dark=(1-Math.abs(Math.sin(axis*12+n2*4)))**16;
  red-=dark*6;green-=dark*4;blue-=dark*2;
 }else if(region==="epidermis"){
  // Microscopic papillae/rete pegs are subtle at lower digital zoom.
  const folds=reveal(20,90,scale);
  const wave=Math.sin(y*24+skinTissueNoise(x*1.8,y*2.2,57)*2.2);
  red+=folds*wave*5;green-=folds*wave*3;
  const detail=reveal(110,245,scale);
  if(detail>.001){
   const c=keratinocyteField(x,y);
   red-=c.edge*20*detail;
   green-=c.edge*14*detail;
   blue-=c.edge*11*detail;
   // Basal nuclei lie near the dermis, not in the anucleate corneum.
   if(depth>.046){
    const nuclei=(1-Math.abs(Math.sin(x*330+y*191+warp*3)))**38;
    red-=detail*7*nuclei;green-=detail*13*nuclei;blue-=detail*5*nuclei;
   }
  }
 }else{
  // White vacuoles in polygonal fat lobules, not yellow circles.
  const opacity=reveal(56,155,scale);
  const a=opacity>.002?skinAdiposeField(x,y):null;
  if(a){
   const light=a.interior*opacity;
   red=mix(red,253,light*.88);
   green=mix(green,247,light*.88);
   blue=mix(blue,228,light*.88);
   red-=a.boundary*opacity*19;
   green-=a.boundary*opacity*13;
   blue-=a.boundary*opacity*12;
  }
  // Mesoscopic collagen septa visible before individual adipocytes.
  const septa=(1-Math.abs(Math.sin(x*3.2+y*2.2+warp*5)))**13;
  red-=septa*10;green-=septa*7;blue-=septa*6;
 }
 return {r:Math.round(clamp(red,0,255)),
  g:Math.round(clamp(green,0,255)),
  b:Math.round(clamp(blue,0,255)),region};
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
   signature:""};
  caches.set(source,cache);
 }
 if(cache.canvas.width!==width||cache.canvas.height!==height){
  cache.canvas.width=width;cache.canvas.height=height;
  cache.rgba=cache.ctx.createImageData(width,height);
  cache.signature="";
 }
 const m=ctx.getTransform();
 if(m.a<=0||m.d<=0)return {sampledPixels:0,width,height};
 const signature=[m.a,m.d,m.e,m.f,width,height,scale].join(":");
 if(cache.signature!==signature){
  const data=cache.rgba.data;
  data.fill(0);
  const xStep=source.width/width;
  const yStep=source.height/height;
  const pixelWorld=xStep/m.a;
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
 }
 ctx.save();
 ctx.setTransform(1,0,0,1,0,0);
 ctx.globalAlpha=1;
 ctx.imageSmoothingEnabled=true;
 ctx.drawImage(cache.canvas,0,0,source.width,source.height);
 ctx.restore();
 return {sampledPixels:width*height,width,height};
}
