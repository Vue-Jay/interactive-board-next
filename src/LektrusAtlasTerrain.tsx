import {useEffect,useMemo,useState} from "react";
import {atlasTerrainTiles,decodeTerrarium,hypsometricRGB,terrainMercatorY,terrainTileURL,
 type TerrainTile,terrainPixelAddress} from "./lektrusAtlasTerrainMath";

export type TerrainStatus={total:number;loaded:number;failed:number};
type Props={scale:number;position:{x:number;y:number};enabled:boolean;
 onStatus:(status:TerrainStatus)=>void};
const rasterCache=new Map<string,Promise<string>>();
const elevationPixels=new Map<string,Promise<Uint8ClampedArray>>();
// Pixel-by-pixel palette interpolation allocated several arrays per pixel.
// Quantize elevation to one metre for a reusable 63 KiB RGB lookup table.
// This preserves school hypsometric colour stops within subpixel accuracy.
let elevationPalette:Uint8Array|null=null;
function terrainPalette():Uint8Array{
 if(elevationPalette)return elevationPalette;
 const colors=new Uint8Array((9500+12000+1)*3);
 for(let metres=-12000;metres<=9500;metres++){
  const [red,green,blue]=hypsometricRGB(metres),offset=(metres+12000)*3;
  colors[offset]=red;colors[offset+1]=green;colors[offset+2]=blue;
 }
 elevationPalette=colors;
 return colors;
}
type TileKey=Pick<TerrainTile,"key"|"z"|"x"|"y">;
async function getElevationPixels(tile:TileKey):Promise<Uint8ClampedArray>{
 const cached=elevationPixels.get(tile.key);if(cached)return cached;
 const task=(async()=>{
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),18000);
  try{
   const response=await fetch(terrainTileURL(tile),{signal:controller.signal,mode:"cors"});
   if(!response.ok)throw new Error("Terrain HTTP "+response.status);
   const bitmap=await createImageBitmap(await response.blob());
   const canvas=document.createElement("canvas");canvas.width=256;canvas.height=256;
   const context=canvas.getContext("2d",{willReadFrequently:true});
   if(!context)throw new Error("Canvas 2D недоступен");
   try{context.drawImage(bitmap,0,0,256,256)}finally{bitmap.close()}
   return context.getImageData(0,0,256,256).data;
  }finally{clearTimeout(timer)}
 })().catch(error=>{elevationPixels.delete(tile.key);throw error});
 elevationPixels.set(tile.key,task);
 if(elevationPixels.size>48)elevationPixels.delete(elevationPixels.keys().next().value!);
 return task;
}
/** Sample a measured terrain height, not a rendered colour. */
export async function sampleTerrainElevation(lon:number,lat:number,z=9):Promise<number|null>{
 const address=terrainPixelAddress(lon,lat,z);if(!address)return null;
 const pixels=await getElevationPixels(address);
 const start=(address.py*256+address.px)*4;
 const height=decodeTerrarium(pixels[start],pixels[start+1],pixels[start+2]);
 return pixels[start+3]===0||height<-12000||height>9500?null:height;
}
/** CORS failures show a visible warning; no misleading synthetic DEM is drawn. */
async function getColorizedTile(tile:TerrainTile):Promise<string>{
 const cached=rasterCache.get(tile.key);if(cached)return cached;
 const task=(async()=>{
  const pixels=await getElevationPixels(tile);
  const output=document.createElement("canvas");output.width=256;output.height=256;
   const outputContext=output.getContext("2d");
   if(!outputContext)throw new Error("Canvas 2D недоступен");
   const colored=outputContext.createImageData(256,256);
   const palette=terrainPalette();
   for(let row=0;row<256;row++){
    // Raster rows are Web Mercator: invert projection before drawing in lat/lon.
    const latitude=tile.north-(tile.north-tile.south)*(row+.5)/256;
    const sourceRow=Math.max(0,Math.min(255,Math.floor((terrainMercatorY(latitude,tile.z)-tile.y)*256)));
    for(let col=0;col<256;col++){
     const offset=(sourceRow*256+col)*4,destination=(row*256+col)*4;
     const metres=decodeTerrarium(pixels[offset],pixels[offset+1],pixels[offset+2]);
     if(metres<-12000||metres>9500||pixels[offset+3]===0)continue;
     const offsetColor=(Math.max(-12000,Math.min(9500,Math.round(metres)))+12000)*3;
     colored.data[destination]=palette[offsetColor];
     colored.data[destination+1]=palette[offsetColor+1];
     colored.data[destination+2]=palette[offsetColor+2];
     colored.data[destination+3]=255;
    }
   }
   outputContext.putImageData(colored,0,0);
   return output.toDataURL("image/png");
 })().catch(error=>{rasterCache.delete(tile.key);throw error});
 rasterCache.set(tile.key,task);
 if(rasterCache.size>56)rasterCache.delete(rasterCache.keys().next().value!);
 return task;
}
export default function LektrusAtlasTerrain({scale,position,enabled,onStatus}:Props){
 const tiles=useMemo(()=>enabled?atlasTerrainTiles(scale,position):[],
  [enabled,scale,position.x,position.y]);
 const keys=tiles.map(tile=>tile.key).join("|");
 const [painted,setPainted]=useState<Record<string,string>>({});
 useEffect(()=>{
  let active=true;
  if(!enabled||tiles.length===0){
   onStatus({total:0,loaded:0,failed:0});return()=>{active=false};
  }
  let loaded=0,failed=0;
  onStatus({total:tiles.length,loaded:0,failed:0});
  setPainted(old=>Object.fromEntries(Object.entries(old).filter(([key])=>keys.includes(key))));
  // Only four DEM fetch/decode tasks at once. Abandoned camera views stop
  // enqueueing new work; shared caches still deduplicate in-flight tiles.
  let next=0;
  const worker=async()=>{
   while(active&&next<tiles.length){
    const tile=tiles[next++];
    try{
     const url=await getColorizedTile(tile);
     if(!active)return;
     loaded++;setPainted(prev=>({...prev,[tile.key]:url}));
    }catch{
     if(!active)return;
     failed++;
    }
    // Raster progress remains local to the terrain child. Reporting every tile
    // to the parent re-rendered the entire GIS scene up to 24 times per camera
    // view, including thousands of SVG paths and mineral symbols.
    if(loaded+failed===tiles.length)onStatus({total:tiles.length,loaded,failed});
   }
  };
  for(let i=0;i<Math.min(4,tiles.length);i++)void worker();
  return()=>{active=false};
 // key is stable between render steps so minor panning does not restart tile loading.
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[keys,enabled,onStatus]);
 if(!enabled)return null;
 return <g className="lektrus-atlas-elevation-tiles" pointerEvents="none">
  {tiles.map(tile=>painted[tile.key]?<image key={tile.key}
   href={painted[tile.key]} x={tile.left} y={tile.top}
   width={tile.width} height={tile.height} preserveAspectRatio="none"/>:null)}
 </g>;
}
