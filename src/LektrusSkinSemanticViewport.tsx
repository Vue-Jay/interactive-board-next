/** First production pilot of continuous anatomy: skin/shoulder only.
 *
 * A single fixed-resolution Canvas draws registered body and detail nodes
 * through ONE camera. No huge CSS-scaled DOM texture or one-image-per-step
 * slideshow. Detail resources are reusable biological representations:
 * a regional view, an explicitly virtual cutaway, a histological
 * reconstruction and a small deterministic micro-surface template.
 */
import {useEffect,useRef} from "react";
import bodyAtlas from "./assets/bio-atlas/human-seven-systems-clean.webp";
import detailAtlas from "./assets/bio-atlas/skin-semantic-lod.webp";
import type {AnatomyCamera} from "./lektrusHumanAnatomyModel";
import {SKIN_DETAIL_ATLAS,SKIN_DETAIL_NODES,anatomyBodyFit,
 anatomyDetailOpacity,skinNodeVisibleInViewport,skinSurfacePores
} from "./lektrusAnatomySemanticZoom";

type Props={camera:AnatomyCamera};
const pores=skinSurfacePores();
const TILE_SIZE=640;
const BODY_SKIN_INDEX=6;
const WORLD_WIDTH=360;
const WORLD_HEIGHT=600;

/** Rasterized once per asset; soft edges ensure neighboring LODs do
 * not flash as hard rectangular image panels during a wheel/pinch zoom. */
function makeFeatheredTiles(sprite:HTMLImageElement):HTMLCanvasElement[]{
 const tiles:HTMLCanvasElement[]=[];
 for(let i=0;i<SKIN_DETAIL_ATLAS.columns;i++){
  const canvas=document.createElement("canvas");
  canvas.width=TILE_SIZE;canvas.height=TILE_SIZE;
  const c=canvas.getContext("2d");
  if(!c)continue;
  c.drawImage(sprite,i*SKIN_DETAIL_ATLAS.tileWidth,0,
   SKIN_DETAIL_ATLAS.tileWidth,SKIN_DETAIL_ATLAS.tileHeight,
   0,0,TILE_SIZE,TILE_SIZE);
  c.globalCompositeOperation="destination-in";
  const mask=c.createRadialGradient(
   TILE_SIZE/2,TILE_SIZE/2,TILE_SIZE*.30,
   TILE_SIZE/2,TILE_SIZE/2,TILE_SIZE*.70);
  mask.addColorStop(0,"rgba(0,0,0,1)");
  mask.addColorStop(1,"rgba(0,0,0,0)");
  c.fillStyle=mask;c.fillRect(0,0,TILE_SIZE,TILE_SIZE);
  tiles.push(canvas);
 }
 return tiles;
}
export default function LektrusSkinSemanticViewport({camera}:Props){
 const canvasRef=useRef<HTMLCanvasElement>(null);
 const cameraRef=useRef(camera);
 const drawRef=useRef<()=>void>(()=>{});
 useEffect(()=>{
  const canvas=canvasRef.current;
  if(!canvas)return;
  const c=canvas.getContext("2d",{alpha:true,desynchronized:true});
  if(!c)return;
  let alive=true,frame=0,baseReady=false,detailReady=false;
  const base=new Image(),details=new Image();
  const tiles:HTMLCanvasElement[]=[];
  let stageWidth=0,stageHeight=0;
  const draw=()=>{
   frame=0;
   if(!alive)return;
   const bounds=canvas.getBoundingClientRect();
   const width=Math.max(1,bounds.width),height=Math.max(1,bounds.height);
   if(Math.abs(width-stageWidth)>.3||Math.abs(height-stageHeight)>.3){
    stageWidth=width;stageHeight=height;
    const ratio=Math.min(window.devicePixelRatio||1,1.75);
    const pixelWidth=Math.ceil(width*ratio),pixelHeight=Math.ceil(height*ratio);
    if(canvas.width!==pixelWidth||canvas.height!==pixelHeight){
     canvas.width=pixelWidth;canvas.height=pixelHeight;
    }
   }
   const ctx=canvas.getContext("2d");
   if(!ctx)return;
   ctx.setTransform(1,0,0,1,0,0);
   ctx.clearRect(0,0,canvas.width,canvas.height);
   // Memory cost stays tied to the visible viewport, even at 52x zoom.
   const dpr=canvas.width/width;
   ctx.setTransform(dpr,0,0,dpr,0,0);
   const cam=cameraRef.current;
   const fit=anatomyBodyFit(width,height);
   ctx.save();
   ctx.translate(width/2+cam.panX,height/2+cam.panY);
   ctx.scale(fit.pixelPerWorld*cam.scale,fit.pixelPerWorld*cam.scale);
   ctx.translate(-WORLD_WIDTH/2,-WORLD_HEIGHT/2);
   const visibleNodes=SKIN_DETAIL_NODES.filter(node=>
    skinNodeVisibleInViewport(node,cam,width,height));
   const actualDetail=detailReady?visibleNodes:[];
   // The original figure remains visible while nearby child detail fades
   // into place. Unmodeled skin elsewhere is never replaced with a
   // shoulder slice: it continues to show the main body plate.
   const cutaway=actualDetail.some(n=>
    (n.source==="virtual-section"||n.source==="tissue-image")&&
     anatomyDetailOpacity(cam.scale,n.scaleWindow)>.02);
   const rootOpacity=cutaway?
    1-Math.min(1,Math.max(0,(cam.scale-9)/7)):1;
   if(baseReady&&rootOpacity>0.001){
    ctx.globalAlpha=rootOpacity;
    ctx.drawImage(base,BODY_SKIN_INDEX*WORLD_WIDTH,0,WORLD_WIDTH,WORLD_HEIGHT,
     0,0,WORLD_WIDTH,WORLD_HEIGHT);
   }
   if(detailReady){
    for(const node of actualDetail){
     const alpha=anatomyDetailOpacity(cam.scale,node.scaleWindow);
     if(alpha<.001)continue;
     ctx.save();ctx.globalAlpha=alpha;
     const {x,y}=node.anchor;
     const rx=x-node.width/2,ry=y-node.height/2;
     if(node.source==="procedural-surface"){
      // The pattern is generated once for a scientific template, not for
      // every frame or every pixel. Coordinates stay stable while zooming.
      ctx.fillStyle="#e7a18b";
      for(const pore of pores){
       const xx=rx+node.width*pore.x,yy=ry+node.height*pore.y;
       const radius=pore.radius;
       ctx.globalAlpha=alpha*pore.intensity;
       ctx.beginPath();ctx.ellipse(xx,yy,radius,radius*.66,0,0,Math.PI*2);
       ctx.fill();
       ctx.beginPath();ctx.ellipse(xx+.16,yy+.12,radius*.45,radius*.31,0,0,Math.PI*2);
       ctx.fillStyle="#9e6e62";ctx.fill();
       ctx.fillStyle="#e7a18b";
      }
     }else{
      const image=node.sourceIndex===null?undefined:tiles[node.sourceIndex];
      if(image)ctx.drawImage(image,rx,ry,node.width,node.height);
     }
     ctx.restore();
    }
   }
   ctx.restore();
  };
  const schedule=()=>{
   if(!alive||frame)return;
   frame=requestAnimationFrame(draw);
  };
  drawRef.current=schedule;
  const onBase=()=>{baseReady=true;schedule();};
  const onDetail=()=>{
   detailReady=true;
   tiles.push(...makeFeatheredTiles(details));
   schedule();
  };
  base.addEventListener("load",onBase);
  details.addEventListener("load",onDetail);
  base.src=bodyAtlas;details.src=detailAtlas;
  if(base.complete&&base.naturalWidth)onBase();
  if(details.complete&&details.naturalWidth)onDetail();
  const resize=typeof ResizeObserver==="undefined"?null:new ResizeObserver(schedule);
  resize?.observe(canvas);
  schedule();
  return ()=>{
   alive=false;
   resize?.disconnect();
   base.removeEventListener("load",onBase);
   details.removeEventListener("load",onDetail);
   base.src="";details.src="";
   if(frame)cancelAnimationFrame(frame);
   drawRef.current=()=>{};
  };
 },[]);
 useEffect(()=>{
  cameraRef.current=camera;
  drawRef.current();
 },[camera]);
 return <canvas ref={canvasRef} className="lek-anatomy-semantic-canvas"
  role="img" aria-label="Кожа человека: плавная детализация от целого тела до учебного среза кожи и тканевых структур"/>;
}
