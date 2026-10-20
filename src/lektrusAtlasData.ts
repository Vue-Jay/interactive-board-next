import {historicalSnapshots} from "./lektrusAtlasModel";

export type GeoPosition=[number,number];
export type GeoGeometry={type:"Polygon"|"MultiPolygon"|"LineString"|"MultiLineString";
 coordinates:unknown};
export type GeoFeature={type:"Feature";properties:Record<string,unknown>|null;geometry:GeoGeometry|null};
export type GeoCollection={type:"FeatureCollection";features:GeoFeature[]};
export type GeoLayer="countries"|"rivers"|"lakes";
const BASE="https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/";
const BACKUP="https://cdn.jsdelivr.net/gh/nvkelso/natural-earth-vector@master/geojson/";
const HIST="https://raw.githubusercontent.com/aourednik/historical-basemaps/master/geojson/";
const HIST_BACKUP="https://cdn.jsdelivr.net/gh/aourednik/historical-basemaps@master/geojson/";
const names:Record<GeoLayer,string>={
 countries:"ne_110m_admin_0_countries.geojson",
 rivers:"ne_110m_rivers_lake_centerlines.geojson",
 lakes:"ne_110m_lakes.geojson"
};
const cache=new Map<string,GeoCollection>();
const pending=new Map<string,Promise<GeoCollection>>();
const validData=(v:unknown):v is GeoCollection=>!!v&&typeof v==="object"&&
 (v as GeoCollection).type==="FeatureCollection"&&Array.isArray((v as GeoCollection).features)&&
 (v as GeoCollection).features.length>0&&
 (v as GeoCollection).features.every(f=>f?.type==="Feature"&&!!f.geometry);
async function requestGeojson(key:string,urls:string[]):Promise<GeoCollection>{
 const saved=cache.get(key);
 if(saved)return saved;
 const existing=pending.get(key);
 if(existing)return existing;
 const task=(async()=>{
  const errors:string[]=[];
  for(const url of urls){
   try{
    const timeout=new AbortController();
    const timer=setTimeout(()=>timeout.abort(),16000);
    let response:Response;
    try{response=await fetch(url,{signal:timeout.signal,cache:"force-cache",mode:"cors"})}
    finally{clearTimeout(timer)}
    if(!response.ok)throw new Error("HTTP "+response.status);
    const body=await response.json();
    if(!validData(body))throw new Error("Некорректный GeoJSON");
    cache.set(key,body);
    // Keep memory bounded. Slow phones should not hold decades of geometry.
    if(cache.size>5)cache.delete(cache.keys().next().value!);
    return body;
   }catch(error){errors.push(error instanceof Error?error.message:String(error))}
  }
  throw new Error("Не удалось получить геоданные: "+errors.join("; "));
 })();
 pending.set(key,task);
 try{return await task}finally{pending.delete(key)}
}
export const geoFeatureName=(feature:GeoFeature)=>
 String(feature.properties?.NAME_RU||feature.properties?.NAME||feature.properties?.ADMIN||
 feature.properties?.name||"Объект без названия");
export const borderPrecision=(f:GeoFeature):number=>{
 const number=Number(f.properties?.BORDERPRECISION);
 return Number.isFinite(number)&&number>=1&&number<=3?number:1;
};
export const historicDataProvider={
 name:"Historical Basemaps, A. Ourednik и участники",
 url:"https://github.com/aourednik/historical-basemaps",
 license:"GPL-3.0; применимость лицензии к данным уточняется автором",
 licenseUrl:"https://github.com/aourednik/historical-basemaps/blob/master/LICENSE"
};
export const modernDataProvider={
 name:"Natural Earth (общественное достояние, public domain)",
 url:"https://www.naturalearthdata.com/",
 license:"Public domain",
 licenseUrl:"https://www.naturalearthdata.com/about/terms-of-use/"
};
export function loadAtlasLayer(layer:GeoLayer){
 const filename=names[layer];
 return requestGeojson("modern-"+layer,[BASE+filename,BACKUP+filename]);
}
export function loadHistoricalSnapshot(year:number){
 const found=historicalSnapshots.find(s=>s.year===year);
 if(!found)return Promise.reject(new Error("Исторического снимка на этот год нет"));
 return requestGeojson("historical-"+year,[HIST+found.file,HIST_BACKUP+found.file]);
}
const WIDTH=900,HEIGHT=450;
/** World equirectangular projection. Longitude/latitude are clipped to WGS84. */
export function projectGeography(lon:number,lat:number):GeoPosition{
 return [((Math.max(-180,Math.min(180,lon))+180)/360)*WIDTH,
  ((90-Math.max(-90,Math.min(90,lat)))/180)*HEIGHT];
}
type Rings=number[][][]; // [rings][points][lon,lat]
function polygons(f:GeoFeature):Rings[]{
 const geometry=f.geometry;
 if(!geometry)return [];
 if(geometry.type==="Polygon")return [geometry.coordinates as Rings];
 if(geometry.type==="MultiPolygon")return geometry.coordinates as Rings[];
 return [];
}
function lines(f:GeoFeature):number[][][]{
 const geometry=f.geometry;
 if(!geometry)return [];
 if(geometry.type==="LineString")return [geometry.coordinates as number[][]];
 if(geometry.type==="MultiLineString")return geometry.coordinates as number[][][];
 return [];
}
function pathForRing(points:number[][],close:boolean):string{
 if(points.length<2)return "";
 const selected:GeoPosition[]=[];
 for(let i=0;i<points.length;i++){
  const p=points[i];
  if(!Array.isArray(p)||!Number.isFinite(p[0])||!Number.isFinite(p[1]))continue;
  const current=projectGeography(p[0],p[1]);
  const last=selected[selected.length-1];
  if(!last||i===points.length-1||Math.abs(last[0]-current[0])+Math.abs(last[1]-current[1])>=.62)
   selected.push(current);
 }
 if(selected.length<2)return "";
 return selected.map(([x,y],i)=>(i?"L":"M")+x.toFixed(1)+" "+y.toFixed(1)).join("")+(close?"Z":"");
}
export function mapFeaturePath(f:GeoFeature):string{
 const all:string[]=[];
 if(f.geometry?.type==="Polygon"||f.geometry?.type==="MultiPolygon"){
  for(const multi of polygons(f))for(const ring of multi){
   const p=pathForRing(ring,true);
   if(p)all.push(p);
  }
 }else for(const line of lines(f)){
  const p=pathForRing(line,false);
  if(p)all.push(p);
 }
 return all.join("");
}
export function summariseNamedChanges(prev:GeoCollection,next:GeoCollection){
 const names=(geo:GeoCollection)=>new Set(geo.features.map(geoFeatureName).filter(n=>n!=="Объект без названия"));
 const a=names(prev),b=names(next);
 return {
  appeared:[...b].filter(n=>!a.has(n)).sort().slice(0,24),
  disappeared:[...a].filter(n=>!b.has(n)).sort().slice(0,24),
  before:a.size,after:b.size
 };
}
