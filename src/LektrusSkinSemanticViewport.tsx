/** A continuous skin surface scene, not a slideshow of zoom snapshots.
 *
 * The same 360x600 silhouette is uniformly zoomed at ALL body locations.
 * Natural-sized furrows, pores and corneocyte-like microstructures are
 * anchored to body coordinates, not to a blown-up shoulder circle.
 * No surface region is substituted or enlarged independently.
 *
 * A histological cross-section is not optically visible beneath intact
 * skin. It is therefore an explicit, reversible virtual cutaway mode and
 * never starts automatically at an arbitrary zoom threshold.
 */
import {useEffect,useRef} from "react";
import skinHighRes from "./assets/bio-atlas/human-skin-highres-registered.webp";
import skinOriginalFallback from "./assets/bio-atlas/human-skin-original-registered.webp";
import detailAtlas from "./assets/bio-atlas/skin-semantic-lod.webp";
import type {AnatomyCamera} from "./lektrusHumanAnatomyModel";
import {anatomyBodyFit} from "./lektrusAnatomySemanticZoom";
import {drawSkinSurfaceField,skinSurfaceAlpha,
 skinVisibleWorldBounds} from "./lektrusSkinSurfaceField";
import {SKIN_SHOULDER} from "./lektrusAnatomySemanticZoom";
import {drawSkinMicrotiles} from "./lektrusSkinMicroTiles";
import {drawSkinMesoTiles} from "./lektrusSkinMesoTiles";

export type SkinViewMode="surface"|"section";
type Props={camera:AnatomyCamera;mode:SkinViewMode};
const WORLD_WIDTH=360,WORLD_HEIGHT=600;
const PLATE=900;
const TILE=720;
const EDGE=SKIN_SHOULDER;
type SurfaceResources={body:HTMLImageElement;section:HTMLCanvasElement|null};

/** Only the EXPLICIT virtual cross-section needs a stored anatomical plate.
 * Surface zoom never draws a cropped region or a radial inset.
 */
function cropSection(sprite:HTMLImageElement):HTMLCanvasElement|null{
 const target=document.createElement("canvas");
 target.width=TILE;target.height=TILE;
 const c=target.getContext("2d");
 if(!c)return null;
 c.drawImage(sprite,PLATE,0,PLATE,PLATE,0,0,TILE,TILE);
 c.globalCompositeOperation="destination-in";
 const gradient=c.createRadialGradient(TILE/2,TILE/2,TILE*.22,
  TILE/2,TILE/2,TILE*.62);
 gradient.addColorStop(0,"rgba(0,0,0,1)");
 gradient.addColorStop(.70,"rgba(0,0,0,.96)");
 gradient.addColorStop(1,"rgba(0,0,0,0)");
 c.fillStyle=gradient;c.fillRect(0,0,TILE,TILE);
 c.globalCompositeOperation="source-over";
 return target;
}
export default function LektrusSkinSemanticViewport({camera,mode}:Props){
 const canvasRef=useRef<HTMLCanvasElement>(null);
 const cameraRef=useRef(camera);
 const modeRef=useRef(mode);
 const drawRef=useRef<()=>void>(()=>{});
 useEffect(()=>{
  const canvas=canvasRef.current;
  if(!canvas)return;
  if(!canvas.getContext("2d",{alpha:true,desynchronized:true}))return;
  let active=true,frame=0,sectionBlend=modeRef.current==="section"?1:0;
  let previousTime=0;
  let bodyReady=false,detailReady=false;
  const resources:SurfaceResources={body:new Image(),section:null};
  const sprite=new Image();
  let width=0,height=0;
  const requestDraw=()=>{
   if(active&&!frame)frame=requestAnimationFrame(draw);
  };
  const draw=(time=performance.now())=>{
   frame=0;
   if(!active)return;
   const bounds=canvas.getBoundingClientRect();
   const w=Math.max(1,bounds.width),h=Math.max(1,bounds.height);
   if(Math.abs(width-w)>.2||Math.abs(height-h)>.2){
    width=w;height=h;
    const dpr=Math.min(window.devicePixelRatio||1,1.75);
    const pixelWidth=Math.ceil(w*dpr),pixelHeight=Math.ceil(h*dpr);
    if(canvas.width!==pixelWidth||canvas.height!==pixelHeight){
     canvas.width=pixelWidth;canvas.height=pixelHeight;
    }
   }
   const ctx=canvas.getContext("2d");
   if(!ctx)return;
   ctx.setTransform(1,0,0,1,0,0);
   ctx.clearRect(0,0,canvas.width,canvas.height);
   const dpr=canvas.width/w;
   ctx.setTransform(dpr,0,0,dpr,0,0);
   ctx.imageSmoothingEnabled=true;
   ctx.imageSmoothingQuality="high";
   const targetBlend=modeRef.current==="section"?1:0;
   const dt=previousTime?Math.min(64,time-previousTime):16;
   previousTime=time;
   // Cross-section changes only by explicit user action; the camera does
   // not move and its spatial anchor stays fixed for the full transition.
   sectionBlend+=(targetBlend-sectionBlend)*(1-Math.exp(-dt/180));
   if(Math.abs(sectionBlend-targetBlend)<.0005)sectionBlend=targetBlend;
   const cam=cameraRef.current;
   const fit=anatomyBodyFit(w,h);
   ctx.save();
   ctx.translate(w/2+cam.panX,h/2+cam.panY);
   ctx.scale(fit.pixelPerWorld*cam.scale,fit.pixelPerWorld*cam.scale);
   ctx.translate(-WORLD_WIDTH/2,-WORLD_HEIGHT/2);
   // Never fade the whole figure out. Even when a detail isn't available,
   // the old image remains a spatial reference rather than disappearing.
   if(bodyReady){
    // A 1080x1800 body raster retains the original 360x600 world coords.
    // Zoom changes only the shared camera, never crop/anchor positions.
    // Preserve the distinct skin illustration, not the gray 7-system atlas.
    ctx.drawImage(resources.body,0,0,WORLD_WIDTH,WORLD_HEIGHT);
   }
   const surfaceOpacity=1-sectionBlend;
   if(bodyReady&&surfaceOpacity>.001){
    // A WHOLE-BODY material field. The body bitmap sets one registered
    // anatomical silhouette; its native alpha masks everything below.
    // At high scale this gentle tone suppresses blurry upscaled pixels
    // without masking the figure with a circular shoulder texture.
    ctx.save();
    ctx.globalCompositeOperation="source-atop";
    const smoothBase=skinSurfaceAlpha(cam.scale,"regional")*surfaceOpacity;
    if(smoothBase>.001){
     const shade=ctx.createLinearGradient(80,50,290,560);
     shade.addColorStop(0,"#eab7a0");
     shade.addColorStop(.52,"#e0a58f");
     shade.addColorStop(1,"#d39a85");
     // The old near-opaque smooth gradient erased every skin highlight
     // from the 360x600 source at medium zoom. Keep natural body shading
     // readable while texture fills in the missing subpixel information.
     // Preserve the artist's actual shading at ordinary 4–12x views.
     // The old 40% flat tint washed away knuckles and skin contours,
     // while red/brown pigment noise was mistaken for detail.
     ctx.globalAlpha=smoothBase*(.025+.18*skinSurfaceAlpha(cam.scale,"pores"));
     ctx.fillStyle=shade;
     ctx.fillRect(0,0,WORLD_WIDTH,WORLD_HEIGHT);
    }
    const region=skinVisibleWorldBounds(cam,w,h);
    if(region.maxX>region.minX&&region.maxY>region.minY){
     ctx.globalAlpha=1;
     // Fine dermatoglyphic furrows are drawn over the original skin
     // shading. No blotchy pigment, freckles, enlarged dots or snapshots.
     // One global field works on the entire body with regional directions.
     drawSkinMesoTiles(ctx,region,cam.scale,surfaceOpacity,requestDraw);
     drawSkinSurfaceField(ctx,cam.scale,region,surfaceOpacity);
     // Beyond the sub-mm relief, cached corneocyte structures emerge
     // smoothly at their WORLD coordinates. No image-size substitution.
     drawSkinMicrotiles(ctx,region,cam.scale,surfaceOpacity,requestDraw);
    }
    ctx.restore();
   }
   if(detailReady&&resources.section&&sectionBlend>.001&&bodyReady){
    ctx.save();
    ctx.globalCompositeOperation="source-atop";
    ctx.globalAlpha=sectionBlend;
    ctx.drawImage(resources.section,EDGE.x,EDGE.y,EDGE.width,EDGE.height);
    ctx.restore();
   }
   ctx.restore();
   if(Math.abs(sectionBlend-targetBlend)>.0005)requestDraw();
  };
  drawRef.current=requestDraw;
  const loadedBody=()=>{bodyReady=true;requestDraw();};
  const loadedDetails=()=>{
   resources.section=cropSection(sprite);
   detailReady=!!resources.section;
   requestDraw();
  };
  let usingFallback=false;
  const fallbackBody=()=>{
   // Offline packages may contain older cached entrypoints. A missing
   // high-resolution asset must not leave the anatomy stage blank.
   // Track explicitly: HTMLImageElement.src resolves to absolute URLs.
   if(!usingFallback){
    usingFallback=true;
    resources.body.src=skinOriginalFallback;
   }
  };
  resources.body.addEventListener("load",loadedBody);
  resources.body.addEventListener("error",fallbackBody);
  sprite.addEventListener("load",loadedDetails);
  resources.body.src=skinHighRes;
  sprite.src=detailAtlas;
  if(resources.body.complete&&resources.body.naturalWidth)loadedBody();
  if(sprite.complete&&sprite.naturalWidth)loadedDetails();
  const observer=typeof ResizeObserver!=="undefined"?
   new ResizeObserver(requestDraw):null;
  observer?.observe(canvas);
  requestDraw();
  return ()=>{
   active=false;
   observer?.disconnect();
   resources.body.removeEventListener("load",loadedBody);
   resources.body.removeEventListener("error",fallbackBody);
   sprite.removeEventListener("load",loadedDetails);
   if(frame)cancelAnimationFrame(frame);
   drawRef.current=()=>{};
  };
 },[]);
 useEffect(()=>{
  cameraRef.current=camera;drawRef.current();
 },[camera]);
 useEffect(()=>{
  modeRef.current=mode;drawRef.current();
 },[mode]);
 return <canvas ref={canvasRef} className="lek-anatomy-semantic-canvas"
  role="img"
  aria-label={mode==="section"?
   "Виртуальный анатомический срез кожи плеча. Учебная реконструкция.":
   "Вся поверхность тела: непрерывный рельеф, кожные гребни ладоней, поры и структуры рогового слоя."}/>;
}
