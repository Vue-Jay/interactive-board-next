import {useEffect,useMemo,useState} from "react";
import {atlasTerrainTiles,decodeTerrarium,hypsometricRGB,terrainMercatorY,terrainTileURL,
 type TerrainTile} from "./lektrusAtlasTerrainMath";

export type TerrainStatus={total:number;loaded:number;failed:number};
type Props={scale:number;position:{x:number;y:number};enabled:boolean;
 onStatus:(status:TerrainStatus)=>void};
const rasterCache=new Map<string,Promise<string>>();
/** CORS failures show a visible warning; no misleading synthetic DEM is drawn. */
async function getColorizedTile(tile:TerrainTile):Promise<string>{
 const cached=rasterCache.get(tile.key);if(cached)return cached;
 const task=(async()=>{
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),18000);
  try{
   const response=await fetch(terrainTileURL(tile),{signal:controller.signal,mode:"cors"});
   if(!response.ok)throw new Error("Terrain HTTP "+response.status);
   const bitmap=await createImageBitmap(await response.blob());
   const input=document.createElement("canvas");input.width=256;input.height=256;
   const sourceContext=input.getContext("2d",{willReadFrequently:true});
   if(!sourceContext)throw new Error("Canvas 2D недоступен");
   sourceContext.drawImage(bitmap,0,0,256,256);bitmap.close();
   const pixels=sourceContext.getImageData(0,0,256,256).data;
   const output=document.createElement("canvas");output.width=256;output.height=256;
   const outputContext=output.getContext("2d");
   if(!outputContext)throw new Error("Canvas 2D недоступен");
   const colored=outputContext.createImageData(256,256);
   for(let row=0;row<256;row++){
    // Raster rows are Web Mercator: invert projection before drawing in lat/lon.
    const latitude=tile.north-(tile.north-tile.south)*(row+.5)/256;
    const sourceRow=Math.max(0,Math.min(255,Math.floor((terrainMercatorY(latitude,tile.z)-tile.y)*256)));
    for(let col=0;col<256;col++){
     const offset=(sourceRow*256+col)*4,destination=(row*256+col)*4;
     const metres=decodeTerrarium(pixels[offset],pixels[offset+1],pixels[offset+2]);
     if(metres<-12000||metres>9500||pixels[offset+3]===0)continue;
     const [r,g,b]=hypsometricRGB(metres);
     colored.data[destination]=r;colored.data[destination+1]=g;
     colored.data[destination+2]=b;colored.data[destination+3]=255;
    }
   }
   outputContext.putImageData(colored,0,0);
   return output.toDataURL("image/png");
  }finally{clearTimeout(timer)}
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
  for(const tile of tiles){
   getColorizedTile(tile).then(url=>{
    if(!active)return;
    loaded++;setPainted(prev=>({...prev,[tile.key]:url}));
    onStatus({total:tiles.length,loaded,failed});
   }).catch(()=>{if(!active)return;failed++;onStatus({total:tiles.length,loaded,failed})});
  }
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
