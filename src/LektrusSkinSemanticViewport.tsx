/** One continuous body camera, with a crisp anatomy section along the
 * silhouette flanks. At deep zoom, vector tissue and cellular structures
 * replace the pixelated stripes of the old 1080 px raster-edge mask.
 * Nothing is drawn over the neutral center of the body. */
import {useEffect,useRef} from "react";
import {pickEpidermisAt,sectionAtY,type EpidermisId,type EpidermisPoint} from "./lektrusEpidermisAtlas";
import {skinEvidenceRegionAt} from "./lektrusSkinEvidenceModel";
import {drawEpidermisAtlas} from "./lektrusEpidermisRenderer";
import {resolveThickSkinSample,thickSkinFocusPoint,
 type ThickSkinKind,type ThickSkinSample} from "./lektrusThickEpidermis";
import {drawThickEpidermisSample} from "./lektrusThickEpidermisRenderer";
import skinHighRes from "./assets/bio-atlas/human-skin-highres-registered.webp";
import skinFallback from "./assets/bio-atlas/human-skin-original-registered.webp";
import type {AnatomyCamera} from "./lektrusHumanAnatomyModel";
import {anatomyBodyFit} from "./lektrusAnatomySemanticZoom";
import {skinVisibleWorldBounds} from "./lektrusSkinSurfaceField";
import {drawSkinTissueTexture} from "./lektrusSkinTissueTexture";
import {skinSectionContours,skinCutawayBlend,drawSkinSectionBands,clipSkinSection,
 type SkinSectionContour} from "./lektrusSkinVectorSections";

export type EpidermisHitTest=(point:EpidermisPoint,pixelsPerWorld:number)=>EpidermisId|null;
type Props={camera:AnatomyCamera;selectedEpidermis?:EpidermisId|null;
 thickKind?:ThickSkinKind|null;
 hitTestRef?:{current:EpidermisHitTest|null};
 anchorRef?:{current:EpidermisPoint|null};
 thickAnchorsRef?:{current:Record<ThickSkinKind,EpidermisPoint|null>|null}};
const WORLD_WIDTH=360,WORLD_HEIGHT=600;
const ATLAS_FACTOR=3;
const RASTER_WIDTH=WORLD_WIDTH*ATLAS_FACTOR;
const RASTER_HEIGHT=WORLD_HEIGHT*ATLAS_FACTOR;

export default function LektrusSkinSemanticViewport({camera,selectedEpidermis=null,
 thickKind=null,hitTestRef,anchorRef,thickAnchorsRef}:Props){
 const canvasRef=useRef<HTMLCanvasElement>(null);
 const cameraRef=useRef(camera);
 const selectionRef=useRef<EpidermisId|null>(selectedEpidermis);
 const thickKindRef=useRef<ThickSkinKind|null>(thickKind);
 const thickSitesRef=useRef<Record<ThickSkinKind,ThickSkinSample|null>>({
  palm:null,sole:null
 });
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
  // Body alpha defines only the outline, not fictional skin anatomy.
  let neutralPlate:HTMLCanvasElement|null=null;
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
   // Make a neutral plate from the exact source alpha once. No
   // procedural texture inside the body and no disconnected fingers.
   c.globalCompositeOperation="source-in";
   c.fillStyle="#f5f2ee";
   c.fillRect(0,0,RASTER_WIDTH,RASTER_HEIGHT);
   c.globalCompositeOperation="source-over";
   neutralPlate=source;
   contours=skinSectionContours(alpha,RASTER_WIDTH,RASTER_HEIGHT);
   thickSitesRef.current={
    palm:resolveThickSkinSample(contours,"palm"),
    sole:resolveThickSkinSample(contours,"sole")
   };
   if(thickAnchorsRef)thickAnchorsRef.current={
    palm:thickSitesRef.current.palm?
     thickSkinFocusPoint(thickSitesRef.current.palm):null,
    sole:thickSitesRef.current.sole?
     thickSkinFocusPoint(thickSitesRef.current.sole):null
   };
   if(hitTestRef)hitTestRef.current=(point,ppu)=>{
    const zoom=cameraRef.current.scale;
    // Hit tests must agree with pixels, not merely with an invisible
    // precomputed layer or a cell hidden during camera movement.
    if(skinCutawayBlend(zoom)<=.03)return null;
    const chosen=pickEpidermisAt(contours,point,ppu,
     thickKindRef.current?thickSitesRef.current[thickKindRef.current]:null);
    if(chosen==="keratinocyte"&&(!refined||zoom<218))
     return "spinosum";
    if(chosen==="melanocyte"&&(!refined||zoom<218))
     return "basale";
    return chosen;
   };
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
    // Keep ALL of the human silhouette at every magnification. The former
   // fade-to-zero made the hands, feet and neutral interior disappear at
   // 2600%, exposing enlarged stripes instead of intact anatomy.
   if(neutralPlate){
    ctx.drawImage(neutralPlate,0,0,WORLD_WIDTH,WORLD_HEIGHT);
   }else{
    ctx.drawImage(body,0,0,WORLD_WIDTH,WORLD_HEIGHT);
   }
   const cutawayAlpha=skinCutawayBlend(cam.scale);
   if(contours.length&&cutawayAlpha>0){
     const visible=skinVisibleWorldBounds(cam,w,h,5);
     drawSkinSectionBands(ctx,contours,visible,cutawayAlpha);
     // Keep a subtle unverified context tone only outside focused
    // epidermis inspection. It is NOT used to imitate individual cells.
    if(cam.scale>25&&refined&&selectionRef.current===null&&
     thickKindRef.current===null){
      ctx.save();
      const clipped=clipSkinSection(ctx,contours,visible);
      if(clipped)drawSkinTissueTexture(ctx,contours,cam.scale,visible);
      ctx.restore();
     }
     // Detailed strata remain registered to the same world coordinates.
     // Do not magnify synthetic epidermal cells over hand silhouettes
     // until the user is examining a real side section at deep zoom.
     if(cam.scale>11){
      drawEpidermisAtlas(ctx,contours,cam.scale,visible,
       selectionRef.current,refined,fit.pixelPerWorld*cam.scale);
      const thick=thickKindRef.current?
       thickSitesRef.current[thickKindRef.current]:null;
      if(thick)drawThickEpidermisSample(ctx,thick,cam.scale,visible,
       selectionRef.current,refined,fit.pixelPerWorld*cam.scale);
     }
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
   if(thickAnchorsRef)thickAnchorsRef.current=null;
  };
 },[]);
 useEffect(()=>{cameraRef.current=camera;drawRef.current();},[camera]);
 useEffect(()=>{selectionRef.current=selectedEpidermis;drawRef.current();},[selectedEpidermis]);
 useEffect(()=>{thickKindRef.current=thickKind;drawRef.current();},[thickKind]);
 return <canvas ref={canvasRef} className="lek-anatomy-semantic-canvas"
  role="img" aria-label="Интерактивный виртуальный разрез кожи: четыре слоя тонкой или пять слоёв толстой кожи, в том числе блестящий; нажатие открывает описание. Это не микрофотография"/>;
}
