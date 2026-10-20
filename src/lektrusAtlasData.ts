import {historicalSnapshots} from "./lektrusAtlasModel";

export type GeoPosition=[number,number];
export type GeoGeometry={type:"Polygon"|"MultiPolygon"|"LineString"|"MultiLineString"|"Point"|"MultiPoint";
 coordinates:unknown};
export type GeoFeature={type:"Feature";properties:Record<string,unknown>|null;geometry:GeoGeometry|null};
export type GeoCollection={type:"FeatureCollection";features:GeoFeature[]};
export type GeoLayer="countries"|"countries-detail"|"countries-ultra"|"countries-russian"|"tiny-countries"|"land"|"coastline"|"rivers"|"lakes"|"cities"|"elevation"|"regions"|"glaciers";
const BASE="https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/";
const BACKUP="https://cdn.jsdelivr.net/gh/nvkelso/natural-earth-vector@master/geojson/";
const HIST="https://raw.githubusercontent.com/aourednik/historical-basemaps/master/geojson/";
const HIST_BACKUP="https://cdn.jsdelivr.net/gh/aourednik/historical-basemaps@master/geojson/";
const names:Record<GeoLayer,string>={
 land:"ne_110m_land.geojson",
 coastline:"ne_110m_coastline.geojson",
 countries:"ne_110m_admin_0_countries.geojson",
 "countries-detail":"ne_50m_admin_0_countries.geojson",
 "countries-ultra":"ne_10m_admin_0_countries.geojson",
 "countries-russian":"ne_10m_admin_0_countries_rus.geojson",
 "tiny-countries":"ne_50m_admin_0_tiny_countries.geojson",
 rivers:"ne_110m_rivers_lake_centerlines.geojson",
 lakes:"ne_110m_lakes.geojson",
 cities:"ne_110m_populated_places.geojson",
 elevation:"ne_110m_geography_regions_elevation_points.geojson",
 regions:"ne_110m_geography_regions_polys.geojson",
 glaciers:"ne_110m_glaciated_areas.geojson"
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
    if(cache.size>8)cache.delete(cache.keys().next().value!);
    return body;
   }catch(error){errors.push(error instanceof Error?error.message:String(error))}
  }
  throw new Error("Не удалось получить геоданные: "+errors.join("; "));
 })();
 pending.set(key,task);
 try{return await task}finally{pending.delete(key)}
}
const russianCountryNames=new Intl.DisplayNames(["ru"],{type:"region"});
const historicNames:Record<string,string>={
 "Roman Empire":"Римская империя","Eastern Roman Empire":"Восточная Римская империя",
 "Byzantine Empire":"Византийская империя","Soviet Union":"Советский Союз",
 "USSR":"СССР","Russian Empire":"Российская империя",
 "Mongol Empire":"Монгольская империя","Ottoman Empire":"Османская империя",
 "Holy Roman Empire":"Священная Римская империя","British Empire":"Британская империя",
 "Kingdom of France":"Королевство Франция","Kingdom of England":"Королевство Англия",
 "Persian Empire":"Персидская империя","Ancient Egypt":"Древний Египет",
 "Caliphate":"Халифат","Golden Horde":"Золотая Орда",
 "Kievan Rus":"Древняя Русь","Muscovy":"Московское государство"
};
export const geoFeatureName=(feature:GeoFeature)=>{
 const p=feature.properties??{};
 const named=p.NAME_RU||p.NAME_ru||p.name_ru;
 if(typeof named==="string"&&named.trim())return named.trim();
 const english=String(p.NAME||p.NAMEASCII||p.GEONAME||p.ADMIN||p.name||"").trim();
 if(historicNames[english])return historicNames[english];
 const iso=String(p.ISO_A2||p.ISO_A2_EH||"");
 if(/^[A-Z]{2}$/.test(iso)){
  const localized=russianCountryNames.of(iso);
  if(localized&&localized!==iso)return localized;
 }
 return english||"Объект без названия";
};
export const borderPrecision=(f:GeoFeature):number=>{
 const number=Number(f.properties?.BORDERPRECISION);
 return Number.isFinite(number)&&number>=1&&number<=3?number:0;
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
 if(year===2026)return loadAtlasLayer("countries-detail"); // non-dated modern overview only
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
/** Split antimeridian crossings instead of drawing an artificial line across the world.
 * Each fragment is clipped at ±180° and continues on the opposite edge. */
function pathForRing(points:number[][],close:boolean,minDistance=.62):string{
 if(points.length<2)return "";
 const valid=points.filter(p=>Array.isArray(p)&&Number.isFinite(p[0])&&Number.isFinite(p[1]))
  .map(p=>[Math.max(-180,Math.min(180,p[0])),Math.max(-90,Math.min(90,p[1]))]);
 if(valid.length<2)return "";
 // Polygon segments are closed explicitly so every crossing can be clipped at the map edge.
 if(close&&valid.length>2&&(valid[0][0]!==valid[valid.length-1][0]||valid[0][1]!==valid[valid.length-1][1]))
  valid.push([...valid[0]]);
 const fragments:number[][][]=[];
 let fragment:number[][]=[valid[0]];
 for(let i=1;i<valid.length;i++){
  const a=valid[i-1],b=valid[i],dx=b[0]-a[0];
  if(Math.abs(dx)>180){
   const edge=dx>0?-180:180;
   const adjusted=dx>0?b[0]-360:b[0]+360;
   const t=(edge-a[0])/(adjusted-a[0]);
   const lat=a[1]+t*(b[1]-a[1]);
   fragment.push([edge,lat]);fragments.push(fragment);
   fragment=[[-edge,lat],b];
  }else fragment.push(b);
 }
 fragments.push(fragment);
 return fragments.map(fragment=>{
  const selected:GeoPosition[]=[];
  for(let i=0;i<fragment.length;i++){
   const current=projectGeography(fragment[i][0],fragment[i][1]);
   const last=selected[selected.length-1];
   if(!last||i===fragment.length-1||Math.abs(last[0]-current[0])+Math.abs(last[1]-current[1])>=minDistance)
    selected.push(current);
  }
  if(selected.length<2)return "";
  // Do not close a split fragment back across the world or to a false border.
  const shouldClose=close&&fragments.length===1;
  const digits=minDistance<.01?4:minDistance<.15?3:1;
  return selected.map(([x,y],i)=>(i?"L":"M")+x.toFixed(digits)+" "+y.toFixed(digits)).join("")+(shouldClose?"Z":"");
 }).filter(Boolean).join("");
}
export function mapFeaturePath(f:GeoFeature,minDistance=.62):string{
 const all:string[]=[];
 if(f.geometry?.type==="Polygon"||f.geometry?.type==="MultiPolygon"){
  for(const multi of polygons(f))for(const ring of multi){
   const p=pathForRing(ring,true,minDistance);
   if(p)all.push(p);
  }
 }else for(const line of lines(f)){
  const p=pathForRing(line,false,minDistance);
  if(p)all.push(p);
 }
 return all.join("");
}
/** A conservative label anchor computed from the largest polygon ring; there is
 * intentionally no claim of a politically defined capital or country centroid. */
export function featureLabelAnchor(feature:GeoFeature):{x:number;y:number;area:number}|null{
 if(!feature.geometry||!["Polygon","MultiPolygon"].includes(feature.geometry.type))return null;
 let best:{x:number;y:number;area:number}|null=null;
 for(const part of polygons(feature)){
  const ring=part[0]??[];
  if(ring.length<3)continue;
  const xs:number[]=[],ys:number[]=[];
  for(const [lon,lat] of ring){
   if(!Number.isFinite(lon)||!Number.isFinite(lat))continue;
   const [x,y]=projectGeography(lon,lat);xs.push(x);ys.push(y);
  }
  if(xs.length<3)continue;
  const a=Math.min(...xs),b=Math.max(...xs),c=Math.min(...ys),d=Math.max(...ys);
  if(b-a>520)continue; // Antimeridian: a center would be misleading.
  const area=(b-a)*(d-c);
  if(!best||area>best.area)best={x:(a+b)/2,y:(c+d)/2,area};
 }
 return best;
}
/** A point from the source, not a guessed place or a calculated capital.
 * Non-point features use their geographic label anchor when available. */
export function featureMapPoint(feature:GeoFeature):GeoPosition|null{
 const g=feature.geometry;
 if(!g)return null;
 if(g.type==="Point"){
  const p=g.coordinates as number[];
  return p.length>=2&&Number.isFinite(p[0])&&Number.isFinite(p[1])?projectGeography(p[0],p[1]):null;
 }
 if(g.type==="MultiPoint"){
  const points=g.coordinates as number[][];
  if(points.length&&points[0].length>=2&&Number.isFinite(points[0][0])&&Number.isFinite(points[0][1]))
   return projectGeography(points[0][0],points[0][1]);
 }
 const anchor=featureLabelAnchor(feature);
 return anchor?[anchor.x,anchor.y]:null;
}
/** Only output values present in a source property; do not infer elevations,
 * population, capital status or administrative control from a feature's name. */
export function featureSourceFacts(feature:GeoFeature):Array<{label:string;value:string}>{
 const p=feature.properties??{};
 const fields:[string,string][]=[
  ["ELEVATION","Высота, м"],["ELEV","Высота, м"],
  ["POP_MAX","Население (оценка источника)"],["POP_MIN","Население (минимальная оценка)"],
  ["SOVEREIGNT","Суверенное государство в источнике"],["ADM0NAME","Страна в источнике"],
  ["FEATURECLA","Категория"],["FEATURECLASS","Категория"]];
 const result:Array<{label:string;value:string}>=[];
 const seen=new Set<string>();
 for(const [key,label] of fields){
  const value=p[key];
  if((typeof value==="string"&&value.trim()!==""||
   typeof value==="number"&&Number.isFinite(value))&&!seen.has(label)){
   result.push({label,value:String(value)});seen.add(label);
  }
 }
 return result;
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

/** Descriptive historical atlas metadata. Fields are copied from the selected
 * source feature, never guessed from modern nation names. */
export function historicalFeatureFacts(feature:GeoFeature):Array<{label:string;value:string}>{
 const p=feature.properties??{};
 const fields:[string,string][]=[
  ["NAME","Название в исходной базе"],["SUBJECTO","Подчинение / принадлежность в базе"],
  ["PARTOF","В составе / историческая область"],["BORDERPRECISION","Условная точность границ"],
  ["BORDER_PRECISION","Точность границ"],["TYPE","Тип исторической территории"],
  ["ENTITY","Историческое образование"],["CAPITAL","Столица (по источнику)"],
  ["START","Начало периода (по источнику)"],["END","Конец периода (по источнику)"],
  ["SOURCE","Источник атрибута"],["NOTES","Примечания источника"]];
 return fields.flatMap(([key,label])=>{
  const value=p[key];
  return (typeof value==="string"&&value.trim()||typeof value==="number"&&Number.isFinite(value))?
   [{label,value:String(value).slice(0,320)}]:[];
 });
}

/** Locate the largest contiguous polygon of a country. Bounding multipart features
 * as a whole is unusable for island groups crossing the antimeridian. */
export function featureFocusBounds(f:GeoFeature):{x:number;y:number;width:number;height:number}|null{
 const g=f.geometry;
 if(!g)return null;
 if(g.type==="Point"||g.type==="MultiPoint"){
  const p=featureMapPoint(f);
  return p?{x:p[0],y:p[1],width:0,height:0}:null;
 }
 let best:{x:number;y:number;width:number;height:number;area:number}|null=null;
 for(const polygon of polygons(f)){
  const ring=polygon[0];
  if(!ring||ring.length<3)continue;
  const longitudes=ring.map(p=>p[0]).filter(Number.isFinite);
  const latitudes=ring.map(p=>p[1]).filter(Number.isFinite);
  if(!longitudes.length||!latitudes.length)continue;
  const lo=Math.min(...longitudes),hi=Math.max(...longitudes);
  if(hi-lo>180)continue;
  const x0=projectGeography(lo,0)[0],x1=projectGeography(hi,0)[0];
  const y0=projectGeography(0,Math.max(...latitudes))[1],y1=projectGeography(0,Math.min(...latitudes))[1];
  const width=x1-x0,height=y1-y0,area=Math.max(.000001,width*height);
  if(!best||area>best.area)best={x:(x0+x1)/2,y:(y0+y1)/2,width,height,area};
 }
 return best?{x:best.x,y:best.y,width:best.width,height:best.height}:null;
}
/** Safe minimum symbol size on overview maps for tiny country points.
 * Symbols carry no historical claims and must not be shown on past-date layers. */
export function isTinyMapFeature(f:GeoFeature):boolean{
 return f.geometry?.type==="Point"||f.geometry?.type==="MultiPoint";
}
