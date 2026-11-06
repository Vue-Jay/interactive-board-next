/** One continuous body camera, with a crisp anatomy section along the
 * silhouette flanks. At deep zoom, vector tissue and cellular structures
 * replace the pixelated stripes of the old 1080 px raster-edge mask.
 * Nothing is drawn over the neutral center of the body. */
import {useEffect,useRef} from "react";
import {pickEpidermisAt,sectionAtY,type EpidermisId,type EpidermisPoint} from "./lektrusEpidermisAtlas";
import {skinEvidenceRegionAt} from "./lektrusSkinEvidenceModel";
import {drawEpidermisAtlas} from "./lektrusEpidermisRenderer";
import skinHighRes from "./assets/bio-atlas/human-skin-highres-registered.webp";
import skinFallback from "./assets/bio-atlas/human-skin-original-registered.webp";
import type {AnatomyCamera} from "./lektrusHumanAnatomyModel";
import {anatomyBodyFit} from "./lektrusAnatomySemanticZoom";
import {skinVisibleWorldBounds} from "./lektrusSkinSurfaceField";
import {drawSkinTissueTexture} from "./lektrusSkinTissueTexture";
import {skinSectionContours,drawSkinSectionBands,clipSkinSection,
 type SkinSectionContour} from "./lektrusSkinVectorSections";

export type EpidermisHitTest=(point:EpidermisPoint,pixelsPerWorld:number)=>EpidermisId|null;
type Props={camera:AnatomyCamera;selectedEpidermis?:EpidermisId|null;
 hitTestRef?:{current:EpidermisHitTest|null};
 anchorRef?:{current:EpidermisPoint|null}};
const WORLD_WIDTH=360,WORLD_HEIGHT=600;
const ATLAS_FACTOR=3;
const RASTER_WIDTH=WORLD_WIDTH*ATLAS_FACTOR;
const RASTER_HEIGHT=WORLD_HEIGHT*ATLAS_FACTOR;

export default function LektrusSkinSemanticViewport({camera,selectedEpidermis=null,hitTestRef,anchorRef}:Props){
 const canvasRef=useRef<HTMLCanvasElement>(null);
 const cameraRef=useRef(camera);
 const selectionRef=useRef<EpidermisId|null>(selectedEpidermis);
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
   if(hitTestRef)hitTestRef.current=(point,ppu)=>pickEpidermisAt(contours,point,ppu);
   // Register an actual epithelial contour point, not the approximate
   // shoulder centre: zooming the centre at 360× hid the epidermis entirely.
   if(anchorRef){
    const candidates=contours.filter(c=>c.inward===-1)
     .map(c=>({c,p:sectionAtY(c,182)}))
     .filter((item):item is {c:SkinSectionContour;p:{x:number;y:number;depth:number}}=>
      !!item.p&&skinEvidenceRegionAt(item.p)==="thin-skin-reference");
    const best=candidates.sort((a,b)=>
     Math.abs(a.p.x-260)-Math.abs(b.p.x-260))[0];
    anchorRef.current=best?
     {x:best.p.x+best.c.inward*best.p.depth*.0325,y:182}:
     {x:260,y:182};
   }
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
    // Enlarging the 1080px overview plate hundreds of times creates
    // pixellated false "microdetail". Fade it out before tissue inspection.
    const overview=Math.max(0,Math.min(1,(20-cam.scale)/12));
    if(overview>.001){
     ctx.save();ctx.globalAlpha=.46*overview;
     ctx.drawImage(body,0,0,WORLD_WIDTH,WORLD_HEIGHT);
     ctx.globalCompositeOperation="source-atop";
     ctx.fillStyle="#dfe9e7";ctx.globalAlpha=.80*overview;
     ctx.fillRect(0,0,WORLD_WIDTH,WORLD_HEIGHT);
     ctx.restore();
    }
    if(contours.length){
     const visible=skinVisibleWorldBounds(cam,w,h,5);
     drawSkinSectionBands(ctx,contours,visible);
     if(cam.scale>2.5&&refined){
      ctx.save();
      const clipped=clipSkinSection(ctx,contours,visible);
      if(clipped)drawSkinTissueTexture(ctx,contours,cam.scale,visible);
      ctx.restore();
     }
     // Four genuine anatomical strata remain registered to exactly the
     // same world coordinates. Cell illustrations are reserved for the
     // approved upper-arm site and the idle/detail pass.
     if(cam.scale>11)drawEpidermisAtlas(
      ctx,contours,cam.scale,visible,selectionRef.current,refined);
    }
   }
   ctx.restore();
  };
  drawRef.current=refineAfterMotion;
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
   if(hitTestRef)hitTestRef.current=null;
   if(anchorRef)anchorRef.current=null;
  };
 },[]);
 useEffect(()=>{cameraRef.current=camera;drawRef.current();},[camera]);
 useEffect(()=>{selectionRef.current=selectedEpidermis;drawRef.current();},[selectedEpidermis]);
 return <canvas ref={canvasRef} className="lek-anatomy-semantic-canvas"
  role="img" aria-label="Интерактивный разрез кожи: четыре слоя эпидермиса выделяются на глубоком масштабе, нажмите на слой для объяснения. Модель не является микрофотографией"/>;
}
