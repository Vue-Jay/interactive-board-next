/** Human skin as an educational lateral cutaway, never a surface texture.
 * Only the left and right silhouette edges receive epidermis, dermis and
 * subcutaneous layers. The center stays a neutral silhouette; camera and
 * all world coordinates remain the same as the other six systems.
 */
import {useEffect,useRef} from "react";
import skinHighRes from "./assets/bio-atlas/human-skin-highres-registered.webp";
import skinFallback from "./assets/bio-atlas/human-skin-original-registered.webp";
import type {AnatomyCamera} from "./lektrusHumanAnatomyModel";
import {anatomyBodyFit} from "./lektrusAnatomySemanticZoom";
import {skinVisibleWorldBounds} from "./lektrusSkinSurfaceField";
import {createSkinEdgeRaster,drawSkinEdgeDetails,
 type SkinEdgeLandmark} from "./lektrusSkinEdgeSections";

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
  let edgeAtlas:HTMLCanvasElement|null=null;
  let landmarks:SkinEdgeLandmark[]=[];
  let width=0,height=0;
  const requestDraw=()=>{
   if(active&&!frame)frame=requestAnimationFrame(draw);
  };
  const makeEdgeAtlas=()=>{
   // Raster alpha is read only when the reference image loads, not on zoom.
   // The bundled asset is same-origin, so this is safe in offline builds.
   const source=document.createElement("canvas");
   source.width=RASTER_WIDTH;source.height=RASTER_HEIGHT;
   const c=source.getContext("2d",{willReadFrequently:true});
   if(!c)return;
   c.drawImage(body,0,0,RASTER_WIDTH,RASTER_HEIGHT);
   const image=c.getImageData(0,0,RASTER_WIDTH,RASTER_HEIGHT);
   const alpha=new Uint8ClampedArray(RASTER_WIDTH*RASTER_HEIGHT);
   for(let i=0;i<alpha.length;i++)alpha[i]=image.data[i*4+3];
   const result=createSkinEdgeRaster(alpha,RASTER_WIDTH,RASTER_HEIGHT);
   image.data.set(result.rgba);
   c.putImageData(image,0,0);
   edgeAtlas=source;
   landmarks=result.landmarks;
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
    // Neutral center. Do not color the whole body as skin.
    ctx.globalCompositeOperation="source-atop";
    ctx.fillStyle="#dfe9e7";ctx.globalAlpha=.80;
    ctx.fillRect(0,0,WORLD_WIDTH,WORLD_HEIGHT);
    ctx.restore();
    if(edgeAtlas){
     ctx.drawImage(edgeAtlas,0,0,WORLD_WIDTH,WORLD_HEIGHT);
     // Capillary loops and fat lobules appear gradually at the same edge
     // points as the atlas. Never spread across the silhouette center.
     const visible=skinVisibleWorldBounds(cam,w,h);
     drawSkinEdgeDetails(ctx,landmarks,cam.scale,visible);
    }
   }
   ctx.restore();
  };
  drawRef.current=requestDraw;
  const onLoaded=()=>{
   if(!active)return;
   ready=true;
   try{makeEdgeAtlas();}
   catch{
    // Browsers that block pixel reads still retain a neutral silhouette.
    edgeAtlas=null;landmarks=[];
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
  role="img" aria-label="Кожный покров в разрезе только по боковым контурам человека: эпидермис, дерма и подкожная клетчатка"/>;
}
