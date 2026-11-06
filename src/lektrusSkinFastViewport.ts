/** The 360×600 anatomy body is not physically magnified by changing
 * camera scale: only the world rectangle visible under the shared camera
 * is sampled from the source atlas. This prevents browsers from rasterising
 * a huge transformed 1080×1800 image at >4000% zoom.
 */
export type SkinWorldRect={minX:number;minY:number;maxX:number;maxY:number};
export type SkinImageCrop={sx:number;sy:number;sw:number;sh:number;
 dx:number;dy:number;dw:number;dh:number};
const WORLD_WIDTH=360,WORLD_HEIGHT=600;
export function skinVisibleImageCrop(
 bounds:SkinWorldRect,imageWidth:number,imageHeight:number,
 margin=1
):SkinImageCrop|null{
 if(!Number.isFinite(imageWidth)||!Number.isFinite(imageHeight)||
  imageWidth<=0||imageHeight<=0)return null;
 const x0=Math.max(0,Math.min(WORLD_WIDTH,bounds.minX-margin));
 const y0=Math.max(0,Math.min(WORLD_HEIGHT,bounds.minY-margin));
 const x1=Math.max(0,Math.min(WORLD_WIDTH,bounds.maxX+margin));
 const y1=Math.max(0,Math.min(WORLD_HEIGHT,bounds.maxY+margin));
 if(!(x1>x0&&y1>y0))return null;
 const factorX=imageWidth/WORLD_WIDTH;
 const factorY=imageHeight/WORLD_HEIGHT;
 return {
  sx:x0*factorX,sy:y0*factorY,
  sw:(x1-x0)*factorX,sh:(y1-y0)*factorY,
  dx:x0,dy:y0,dw:x1-x0,dh:y1-y0
 };
}
/** For accurate smooth outlines at ALL camera scales, sampling of the
 * neutral body raster may be cheap, while verified layer contours stay
 * real vector geometry. No pixelwise fabricated histology is rendered.
 */
export const SKIN_UNVERIFIED_MICROSTRUCTURES_ENABLED=false as const;
export const SKIN_RENDER_MODEL_STATUS="illustrative-uncalibrated" as const;
