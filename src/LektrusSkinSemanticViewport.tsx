/** A continuous skin surface scene, not a slideshow of zoom snapshots.
 *
 * Overview, registered shoulder photography, relief, pores and corneocytes
 * share one 360 x 600 coordinate system and one camera. LOD changes only
 * which *features* are legible; no system-wide fade to a different image.
 *
 * A histological cross-section is not optically visible beneath intact
 * skin. It is therefore an explicit, reversible virtual cutaway mode and
 * never starts automatically at an arbitrary zoom threshold.
 */
import {useEffect,useRef} from "react";
import skinOriginal from "./assets/bio-atlas/human-skin-original-registered.webp";
import detailAtlas from "./assets/bio-atlas/skin-semantic-lod.webp";
import type {AnatomyCamera} from "./lektrusHumanAnatomyModel";
import {anatomyBodyFit} from "./lektrusAnatomySemanticZoom";
import {SKIN_SURFACE_REGION,drawSkinSurfaceField,skinSurfaceAlpha,
 skinVisibleWorldBounds} from "./lektrusSkinSurfaceField";

export type SkinViewMode="surface"|"section";
type Props={camera:AnatomyCamera;mode:SkinViewMode};
const WORLD_WIDTH=360,WORLD_HEIGHT=600;
const PLATE=900;
const TILE=720;
const EDGE={x:SKIN_SURFACE_REGION.x,y:SKIN_SURFACE_REGION.y,
 width:SKIN_SURFACE_REGION.width,height:SKIN_SURFACE_REGION.height};

type SurfaceResources={body:HTMLImageElement;shoulder:HTMLCanvasElement|null;
 section:HTMLCanvasElement|null};

/** Cached region-specific views are not changed when zooming. An alpha
 * mask blends the shoulder patch into the exact registered body coordinates.
 * Only the upper arm/shoulder is cropped; no torso callout or labels.
 */
function cropFeathered(sprite:HTMLImageElement,index:0|1):HTMLCanvasElement|null{
 const target=document.createElement("canvas");
 target.width=TILE;target.height=TILE;
 const c=target.getContext("2d");
 if(!c)return null;
 if(index===0){
  // This source patch is only the textured deltoid/upper-arm skin.
  // Previous crop 440,110,405,620 included neck, chest and background,
  // all of which became visibly misplaced when projected on the shoulder.
  // Its aspect now matches SKIN_SHOULDER within normal illustration tolerance.
  c.drawImage(sprite,640,340,120,160,0,0,TILE,TILE);
 }else{
  c.drawImage(sprite,PLATE,0,PLATE,PLATE,0,0,TILE,TILE);
 }
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
  const resources:SurfaceResources={
   body:new Image(),shoulder:null,section:null
  };
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
    // The original warm skin mannequin is a dedicated registered 360x600
    // transparent plate. It is NEVER copied from the blue-gray 7-system
    // sprite. No background rectangle is painted over the atlas grid.
    ctx.drawImage(resources.body,0,0,WORLD_WIDTH,WORLD_HEIGHT);
   }
   const surfaceOpacity=1-sectionBlend;
   const shoulderAlpha=skinSurfaceAlpha(cam.scale,"regional")*surfaceOpacity;
   if(detailReady&&resources.shoulder&&shoulderAlpha>.001&&bodyReady){
    ctx.save();
    // Prevent even the soft feathered edge from bleeding into the empty
    // space between shoulder and upper arm.
    ctx.globalCompositeOperation="source-atop";
    ctx.globalAlpha=shoulderAlpha*.78;
    ctx.drawImage(resources.shoulder,EDGE.x,EDGE.y,EDGE.width,EDGE.height);
    ctx.restore();
   }
   const region=skinVisibleWorldBounds(cam,w,h);
   const relief=skinSurfaceAlpha(cam.scale,"relief")*surfaceOpacity;
   if(bodyReady&&relief>.001&&region.maxX>region.minX&&region.maxY>region.minY){
    ctx.save();
    ctx.globalCompositeOperation="source-atop";
    ctx.beginPath();
    ctx.ellipse(EDGE.x+EDGE.width/2,EDGE.y+EDGE.height/2,
     EDGE.width/2,EDGE.height/2,0,0,Math.PI*2);
    ctx.clip();
    // Progressive skin-colour field suppresses enlargement artifacts from
    // the overview raster. Its shape does not change at LOD boundaries.
    const fillAlpha=relief*skinSurfaceAlpha(cam.scale*.8,"pores")*.96;
    if(fillAlpha>.001){
     const shade=ctx.createRadialGradient(
      EDGE.x+EDGE.width*.45,EDGE.y+EDGE.height*.4,EDGE.width*.04,
      EDGE.x+EDGE.width*.5,EDGE.y+EDGE.height*.5,EDGE.width*.69);
     shade.addColorStop(0,"#eeb49b");
     shade.addColorStop(.6,"#d99b86");
     shade.addColorStop(1,"#b8796d");
     ctx.fillStyle=shade;ctx.globalAlpha=fillAlpha;
     ctx.fillRect(EDGE.x,EDGE.y,EDGE.width,EDGE.height);
    }
    ctx.globalAlpha=1;
    drawSkinSurfaceField(ctx,cam.scale,region,surfaceOpacity);
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
   resources.shoulder=cropFeathered(sprite,0);
   resources.section=cropFeathered(sprite,1);
   detailReady=!!resources.shoulder&&!!resources.section;
   requestDraw();
  };
  resources.body.addEventListener("load",loadedBody);
  sprite.addEventListener("load",loadedDetails);
  resources.body.src=skinOriginal;
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
   "Непрерывное увеличение поверхности кожи плеча: рельеф, поры и роговые чешуйки."}/>;
}
