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
import {skinVisibleImageCrop} from "./lektrusSkinFastViewport";
import {drawSkinTissueTexture} from "./lektrusSkinTissueTexture";
import {skinSectionContours,drawSkinSectionBands,clipSkinSection,
 type SkinSectionContour} from "./lektrusSkinVectorSections";

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
  let refined=false;
  let idleTimer:ReturnType<typeof setTimeout>|undefined;
  // One debounced refinement, not dozens of synchronous histology
  // regenerations during the 88ms animated camera easing.
  const refineAfterMotion=()=>{
   refined=false;
   if(idleTimer!==undefined)clearTimeout(idleTimer);
   requestDraw();
   idleTimer=setTimeout(()=>{
    idleTimer=undefined;refined=true;requestDraw();
   },180);
  };
  const body=new Image();
  let contours:SkinSectionContour[]=[];
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
   const visible=skinVisibleWorldBounds(cam,w,h,1.6);
   ctx.save();
   ctx.translate(w/2+cam.panX,h/2+cam.panY);
   ctx.scale(fit.pixelPerWorld*cam.scale,fit.pixelPerWorld*cam.scale);
   ctx.translate(-WORLD_WIDTH/2,-WORLD_HEIGHT/2);
   if(ready){
    // Enlarging the 1080px overview plate hundreds of times creates
    // pixellated false "microdetail". Fade it out before tissue inspection.
    const overview=Math.max(0,Math.min(1,(20-cam.scale)/12));
    if(overview>.001){
     // Even while transitioning from whole body to tissue, sample ONLY
     // the part of the 1080×1800 source in the visible world rectangle.
     // Drawing the full image at 1200–2000% can saturate mobile Canvas.
     const crop=skinVisibleImageCrop(visible,
      body.naturalWidth,body.naturalHeight,1.2);
     if(crop){
      ctx.save();ctx.globalAlpha=.46*overview;
      ctx.drawImage(body,crop.sx,crop.sy,crop.sw,crop.sh,
       crop.dx,crop.dy,crop.dw,crop.dh);
      ctx.globalCompositeOperation="source-atop";
      ctx.fillStyle="#dfe9e7";ctx.globalAlpha=.80*overview;
      ctx.fillRect(crop.dx,crop.dy,crop.dw,crop.dh);
      ctx.restore();
     }
    }
    if(contours.length){
     drawSkinSectionBands(ctx,contours,visible);
     // Only refine a low/medium-zoom *illustrative* tone when the camera
     // stops. Never run 170k pixel shaders at 4152%, 12000%, 36000%.
     if(refined&&cam.scale>2.5&&cam.scale<14){
      ctx.save();
      const clipped=clipSkinSection(ctx,contours,visible);
      if(clipped){
       // The previous 8-unit vascular loops, random nuclei and fat
       // honeycomb were not anatomically registered and looked like fake
       // microscopic anatomy. Only an explicitly *illustrative* soft tissue
       // tone is drawn. Real evidence remains in the specimen panel.
       // Never perform a pixel-sampling pass during animated zoom/pan.
       drawSkinTissueTexture(ctx,contours,cam.scale,visible);
      }
      ctx.restore();
     }
    }
   }
   ctx.restore();
  };
  drawRef.current=()=>{
   if(cameraRef.current.scale<14){refineAfterMotion();return;}
   // Deep zoom has only native-resolution vector layers. Do not schedule
   // an expensive idle refinement or extra RAF after every camera change.
   refined=false;
   if(idleTimer!==undefined){clearTimeout(idleTimer);idleTimer=undefined;}
   requestDraw();
  };
  const onLoaded=()=>{
   if(!active)return;
   ready=true;
   try{buildSkin();}
   catch{
    // If image alpha read is prohibited, retain the neutral silhouette
    // without painting unrelated fallback anatomy over it.
    contours=[];
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
   if(idleTimer!==undefined)clearTimeout(idleTimer);
   drawRef.current=()=>{};
  };
 },[]);
 useEffect(()=>{cameraRef.current=camera;drawRef.current();},[camera]);
 return <canvas ref={canvasRef} className="lek-anatomy-semantic-canvas"
  role="img" aria-label="Условный боковой разрез кожи по контуру тела: эпидермис, дерма и подкожная клетчатка. Реальные микроснимки показаны отдельно"/>;
}
