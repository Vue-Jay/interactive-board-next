/** One continuous body camera, with a crisp anatomy section along the
 * silhouette flanks. At deep zoom, vector tissue and cellular structures
 * replace the pixelated stripes of the old 1080 px raster-edge mask.
 * Nothing is drawn over the neutral center of the body. */
import {useEffect,useRef} from "react";
import skinHighRes from "./assets/bio-atlas/human-skin-highres-registered.webp";
import skinFallback from "./assets/bio-atlas/human-skin-original-registered.webp";
import type {AnatomyCamera} from "./lektrusHumanAnatomyModel";
import {anatomyBodyFit} from "./lektrusAnatomySemanticZoom";
import {skinVisibleWorldBounds} from "./lektrusSkinSurfaceField";
import {createSkinEdgeRaster,drawSkinEdgeDetails,
 SKIN_EDGE_WORLD_WIDTH,type SkinEdgeLandmark} from "./lektrusSkinEdgeSections";
import {skinSectionContours,drawSkinSectionBands,clipSkinSection,
 SKIN_SECTION_WORLD_DEPTH,type SkinSectionContour} from "./lektrusSkinVectorSections";

type Props={camera:AnatomyCamera};
const WORLD_WIDTH=360,WORLD_HEIGHT=600;
const ATLAS_FACTOR=3;
const RASTER_WIDTH=WORLD_WIDTH*ATLAS_FACTOR;
const RASTER_HEIGHT=WORLD_HEIGHT*ATLAS_FACTOR;

export default function LektrusSkinSemanticViewport({camera}:Props){
 const canvasRef=useRef<HTMLCanvasElement>(null);
 const cameraRef=useRef(camera);
 const drawRef=useRef<()=>void>(()=>{});
 useEffect(()=>{
  const canvas=canvasRef.current;
  if(!canvas)return;
  if(!canvas.getContext("2d",{alpha:true,desynchronized:true}))return;
  let active=true,frame=0,ready=false,usingFallback=false;
  const body=new Image();
  let contours:SkinSectionContour[]=[];
  let landmarks:SkinEdgeLandmark[]=[];
  let width=0,height=0;
  const requestDraw=()=>{
   if(active&&!frame)frame=requestAnimationFrame(draw);
  };
  const buildSkin=()=>{
   // Read bundled, same-origin silhouette once. At no point is a scaled
   // raster skin atlas reused as visible tissue at high magnification.
   const source=document.createElement("canvas");
   source.width=RASTER_WIDTH;source.height=RASTER_HEIGHT;
   const c=source.getContext("2d",{willReadFrequently:true});
   if(!c)return;
   c.drawImage(body,0,0,RASTER_WIDTH,RASTER_HEIGHT);
   const rgba=c.getImageData(0,0,RASTER_WIDTH,RASTER_HEIGHT).data;
   const alpha=new Uint8ClampedArray(RASTER_WIDTH*RASTER_HEIGHT);
   for(let i=0;i<alpha.length;i++)alpha[i]=rgba[i*4+3];
   contours=skinSectionContours(alpha,RASTER_WIDTH,RASTER_HEIGHT);
   landmarks=createSkinEdgeRaster(alpha,RASTER_WIDTH,RASTER_HEIGHT).landmarks;
  };
  const draw=()=>{
   frame=0;
   if(!active)return;
   const bounds=canvas.getBoundingClientRect();
   const w=Math.max(1,bounds.width),h=Math.max(1,bounds.height);
   if(Math.abs(width-w)>.2||Math.abs(height-h)>.2){
    width=w;height=h;
    const dpr=Math.min(window.devicePixelRatio||1,1.75);
    const sw=Math.ceil(w*dpr),sh=Math.ceil(h*dpr);
    if(canvas.width!==sw||canvas.height!==sh){
     canvas.width=sw;canvas.height=sh;
    }
   }
   const ctx=canvas.getContext("2d");
   if(!ctx)return;
   ctx.setTransform(1,0,0,1,0,0);
   ctx.clearRect(0,0,canvas.width,canvas.height);
   ctx.setTransform(canvas.width/w,0,0,canvas.width/w,0,0);
   ctx.imageSmoothingEnabled=true;
   ctx.imageSmoothingQuality="high";
   const cam=cameraRef.current,fit=anatomyBodyFit(w,h);
   ctx.save();
   ctx.translate(w/2+cam.panX,h/2+cam.panY);
   ctx.scale(fit.pixelPerWorld*cam.scale,fit.pixelPerWorld*cam.scale);
   ctx.translate(-WORLD_WIDTH/2,-WORLD_HEIGHT/2);
   if(ready){
    ctx.save();
    ctx.globalAlpha=.46;
    ctx.drawImage(body,0,0,WORLD_WIDTH,WORLD_HEIGHT);
    ctx.globalCompositeOperation="source-atop";
    ctx.fillStyle="#dfe9e7";ctx.globalAlpha=.80;
    ctx.fillRect(0,0,WORLD_WIDTH,WORLD_HEIGHT);
    ctx.restore();
    if(contours.length){
     const visible=skinVisibleWorldBounds(cam,w,h,5);
     drawSkinSectionBands(ctx,contours,visible);
     if(cam.scale>2.5){
      ctx.save();
      const clipped=clipSkinSection(ctx,contours,visible);
      if(clipped)drawSkinEdgeDetails(ctx,landmarks,cam.scale,visible,
       SKIN_SECTION_WORLD_DEPTH/SKIN_EDGE_WORLD_WIDTH);
      ctx.restore();
     }
    }
   }
   ctx.restore();
  };
  drawRef.current=requestDraw;
  const onLoaded=()=>{
   if(!active)return;
   ready=true;
   try{buildSkin();}
   catch{
    // If image alpha read is prohibited, retain the neutral silhouette
    // without painting unrelated fallback anatomy over it.
    contours=[];landmarks=[];
   }
   requestDraw();
  };
  const onError=()=>{
   if(!active||usingFallback)return;
   usingFallback=true;body.src=skinFallback;
  };
  body.addEventListener("load",onLoaded);
  body.addEventListener("error",onError);
  body.src=skinHighRes;
  if(body.complete&&body.naturalWidth)onLoaded();
  const observer=typeof ResizeObserver==="undefined"?null:
   new ResizeObserver(requestDraw);
  observer?.observe(canvas);
  requestDraw();
  return ()=>{
   active=false;observer?.disconnect();
   body.removeEventListener("load",onLoaded);
   body.removeEventListener("error",onError);
   if(frame)cancelAnimationFrame(frame);
   drawRef.current=()=>{};
  };
 },[]);
 useEffect(()=>{cameraRef.current=camera;drawRef.current();},[camera]);
 return <canvas ref={canvasRef} className="lek-anatomy-semantic-canvas"
  role="img" aria-label="Боковой разрез кожи с плавными контурами: эпидермис, дерма, подкожная клетчатка, сосуды, железы, фолликулы и клетки"/>;
}
