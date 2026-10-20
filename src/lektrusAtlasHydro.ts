import type {GeoFeature} from "./lektrusAtlasData";

/** Screen-space widths in SVG pixels. They never grow with map zoom.
 * Natural Earth uses scalerank/min_zoom for generalization; neither is a
 * measured river discharge, so widths only communicate cartographic hierarchy. */
const clamp=(value:number,min:number,max:number)=>Math.min(max,Math.max(min,value));
export function atlasRiverStroke(feature:GeoFeature,hydrography=false):number{
 const p=feature.properties??{};
 const rank=Number(p.scalerank??p.SCALERANK);
 const zoom=Number(p.min_zoom??p.MIN_ZOOM);
 const level=Number.isFinite(rank)&&rank>=0?rank:Number.isFinite(zoom)&&zoom>=0?zoom:5;
 const emphasis=clamp((7-level)/7,0,1);
 return Number((hydrography?.54:.43)+emphasis*(hydrography?.47:.35)).toFixed(2);
}
export const atlasLakeStroke=()=>.38;
export const atlasShoreStroke=()=>.48;
export const atlasLandformStroke=()=>.16;
export const atlasGlacierStroke=()=>.34;
/** Preserve shoreline shape and river meanders when the camera zooms in.
 * Simplification acts in map units, not device pixels. */
export function atlasWaterGeometryTolerance(scale:number,regional:boolean){
 const screenPixels=regional?.75:1.3;
 return Math.max(.00012,Math.min(regional?.12:.55,screenPixels/Math.max(1,scale)));
}
export function atlasRiverLabelRank(feature:GeoFeature){
 const rank=Number(feature.properties?.scalerank??feature.properties?.SCALERANK);
 return Number.isFinite(rank)?rank:20;
}
