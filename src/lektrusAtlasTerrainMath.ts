/** Global DEM raster maths for the Lektrus atlas.
 * Mapzen Terrain Tiles: https://registry.opendata.aws/terrain-tiles/
 * Terrarium RGB stores elevation in metres (EPSG:3857).
 * Map objects use WGS84 equirectangular coordinates, so each tile must be
 * resampled in latitude rather than stretched as a Mercator bitmap. */
export const TERRARIUM_SOURCE="https://s3.amazonaws.com/elevation-tiles-prod/terrarium/";
export type TerrainTile={key:string;z:number;x:number;y:number;
  left:number;top:number;width:number;height:number;north:number;south:number};
const bound=(v:number,min:number,max:number)=>Math.min(max,Math.max(min,v));
export const terrainLatitude=(y:number,z:number)=>Math.atan(Math.sinh(Math.PI*(1-2*y/Math.pow(2,z))))*180/Math.PI;
export const terrainMercatorY=(lat:number,z:number)=>{
 const phi=bound(lat,-85.05112878,85.05112878)*Math.PI/180;
 return (1-Math.asinh(Math.tan(phi))/Math.PI)/2*Math.pow(2,z);
};
/** Address the exact DEM pixel under a geographic location for classroom
 * point-height queries. No sample outside the supported WebMercator domain. */
export function terrainPixelAddress(lon:number,lat:number,z:number){
 if(!Number.isFinite(lon)||!Number.isFinite(lat)||lat>85.05112878||lat< -85.05112878||
  lon>180||lon< -180||z<0||z>13)return null;
 const count=2**z,xx=bound((lon+180)/360*count,0,count-1e-9);
 const yy=bound(terrainMercatorY(lat,z),0,count-1e-9);
 const x=Math.floor(xx),y=Math.floor(yy);
 const px=bound(Math.floor((xx-x)*256),0,255),py=bound(Math.floor((yy-y)*256),0,255);
 return {key:z+"/"+x+"/"+y,z,x,y,px,py};
}
export const decodeTerrarium=(red:number,green:number,blue:number)=>red*256+green+blue/256-32768;
export const terrainTileURL=(tile:Pick<TerrainTile,"z"|"x"|"y">)=>
 TERRARIUM_SOURCE+tile.z+"/"+tile.x+"/"+tile.y+".png";
export function atlasTerrainTiles(scale:number,position:{x:number;y:number},maxTiles=24):TerrainTile[]{
 const w=bound(((450+(-450-position.x)/scale)/900)*360-180,-180,180);
 const e=bound(((450+(450-position.x)/scale)/900)*360-180,-180,180);
 const n=bound(90-((225+(-225-position.y)/scale)/450)*180,-85.05112878,85.05112878);
 const s=bound(90-((225+(225-position.y)/scale)/450)*180,-85.05112878,85.05112878);
 if(w>=e||s>=n)return [];
 let z=bound(Math.floor(Math.log2(Math.max(1,scale)))+2,2,11);
 let x0=0,x1=0,y0=0,y1=0;
 for(;;){
  const size=2**z,EPS=1e-9;
  x0=bound(Math.floor((w+180)/360*size),0,size-1);
  x1=bound(Math.floor((e+180)/360*size-EPS),0,size-1);
  y0=bound(Math.floor(terrainMercatorY(n,z)),0,size-1);
  y1=bound(Math.floor(terrainMercatorY(s,z)-EPS),0,size-1);
  if((x1-x0+1)*(y1-y0+1)<=maxTiles||z===2)break;
  z--;
 }
 const tiles:TerrainTile[]=[];
 const size=2**z;
 for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){
  const north=terrainLatitude(y,z),south=terrainLatitude(y+1,z);
  tiles.push({key:z+"/"+x+"/"+y,z,x,y,
   left:x/size*900,top:(90-north)/180*450,
   width:900/size,height:(north-south)/180*450,north,south});
 }
 return tiles;
}
/** Authored school-atlas hypsometry, data-driven by decoded DEM elevations. */
export const HYPSO_STOPS:ReadonlyArray<readonly [number,number,number,number]>=[
 [-11000,20,57,110],[-5000,32,92,158],[-2500,50,127,190],
 [-500,103,176,216],[-1,189,225,241],[0,98,164,109],
 [200,135,186,112],[500,189,205,128],[1000,216,195,126],
 [2000,197,151,105],[3500,163,117,88],[5000,225,212,193],
 [7000,250,250,249]
];
export function hypsometricRGB(metres:number):[number,number,number]{
 if(metres<=HYPSO_STOPS[0][0])return HYPSO_STOPS[0].slice(1) as [number,number,number];
 for(let i=1;i<HYPSO_STOPS.length;i++){
  const a=HYPSO_STOPS[i-1],b=HYPSO_STOPS[i];
  if(metres<=b[0]){
   const t=bound((metres-a[0])/(b[0]-a[0]),0,1);
   return [1,2,3].map(channel=>Math.round(a[channel]+(b[channel]-a[channel])*t)) as [number,number,number];
  }
 }
 return HYPSO_STOPS[HYPSO_STOPS.length-1].slice(1) as [number,number,number];
}
