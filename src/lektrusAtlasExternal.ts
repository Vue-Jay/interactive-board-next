import type {GeoCollection,GeoFeature} from "./lektrusAtlasData";

export type ExternalBounds={west:number;south:number;east:number;north:number};
export const externalBBoxKey=(b:ExternalBounds)=>
 [b.west,b.south,b.east,b.north].map(v=>Math.round(v*2)/2).join(",");
const cache=new Map<string,Promise<GeoCollection>>();
const MAX_EXTERNAL_FEATURES=1100;
const sane=(b:ExternalBounds)=>Object.values(b).every(Number.isFinite)&&
 b.west>=-180&&b.east<=180&&b.south>=-85&&b.north<=85&&
 b.east>b.west&&b.north>b.south;
export const canLoadLocalRoads=(b:ExternalBounds)=>
 sane(b)&&b.east-b.west<=8&&b.north-b.south<=5;
export const canLoadMinerals=(b:ExternalBounds)=>sane(b)&&
 b.east-b.west<=55&&b.north-b.south<=30;
const safeFetch=async(url:string)=>{
 const c=new AbortController(),timer=setTimeout(()=>c.abort(),16000);
 try{
  const r=await fetch(url,{signal:c.signal,mode:"cors"});
  if(!r.ok)throw new Error("HTTP "+r.status);
  return await r.json();
 }finally{clearTimeout(timer)}
};
const memo=(id:string,work:()=>Promise<GeoCollection>)=>{
 if(cache.has(id))return cache.get(id)!;
 const promise=work().catch(e=>{cache.delete(id);throw e});
 cache.set(id,promise);if(cache.size>7)cache.delete(cache.keys().next().value!);
 return promise;
};
/** OSM Overpass geometry for a SMALL map viewport. This is not a full street map. */
export function loadLocalInfrastructure(b:ExternalBounds):Promise<GeoCollection>{
 if(!canLoadLocalRoads(b))return Promise.resolve({type:"FeatureCollection",features:[]});
 const box=[b.south,b.west,b.north,b.east].map(x=>Number(x.toFixed(5))).join(",");
 const overpass='[out:json][timeout:15];('+
  'way["highway"~"^(motorway|trunk|primary)$"]('+box+');'+
  'way["waterway"~"^(river|stream|canal)$"]["name:ru"]('+box+');'+
  ');out geom;';
 const url="https://overpass.kumi.systems/api/interpreter?data="+encodeURIComponent(overpass);
 return memo("osm:"+externalBBoxKey(b),async()=>{
  const json=await safeFetch(url);
  const features:GeoFeature[]=[];
  for(const item of json.elements??[]){
   if(features.length>=MAX_EXTERNAL_FEATURES)break;
   if(item.type!=="way"||!Array.isArray(item.geometry)||item.geometry.length<2)continue;
   const tags=item.tags??{},road=typeof tags.highway==="string";
   const ru=String(tags["name:ru"]??"").trim();
   if(!road&&!/[А-ЯЁа-яё]/.test(ru))continue;
   const coords=item.geometry.filter((v:{lon:number;lat:number})=>Number.isFinite(v.lon)&&Number.isFinite(v.lat))
    .map((v:{lon:number;lat:number})=>[v.lon,v.lat]);
   if(coords.length<2)continue;
   features.push({type:"Feature",geometry:{type:"LineString",coordinates:coords},
    properties:{NAME_RU:ru,OSM_ID:item.id,ATLAS_KIND:road?"road":"waterway",
     ATLAS_CLASS:road?tags.highway:tags.waterway}});
  }
  return {type:"FeatureCollection",features};
 });
}
const mineralWords:ReadonlyArray<[RegExp,string,string]>=[
 [/gold|aurum|золот/i,"Золото","#dfb345"],[/silver|argent|серебр/i,"Серебро","#aab8c4"],
 [/copper|медн|cupr/i,"Медь","#c2794f"],[/iron|желез|ferrous/i,"Железная руда","#ab6252"],
 [/coal|угол/i,"Уголь","#4b525a"],[/petroleum|oil|нефт/i,"Нефть","#585453"],
 [/natural gas|gas field|газов/i,"Природный газ","#a3a7bb"],
 [/uranium|уран/i,"Уран","#92a750"],[/diamonds?|алмаз/i,"Алмазы","#8ccad6"],
 [/lithium|литий/i,"Литий","#a782ba"],[/nickel|никел/i,"Никель","#7f9697"],
 [/bauxite|aluminum|aluminium|боксит/i,"Бокситы и алюминий","#c99987"],
 [/tin\b|олов/i,"Олово","#95b1b2"],[/lead|свин/i,"Свинец","#858f9b"],
 [/zinc|цинк/i,"Цинк","#94a694"],[/potash|potassium|калийн/i,"Калийные соли","#c1a3cc"],
 [/phosphate|фосфат/i,"Фосфориты","#7cb394"],[/tungsten|вольфрам/i,"Вольфрам","#9f8e80"],
 [/manganese|марганец/i,"Марганец","#9c8fba"],[/rare earth|редкозем/i,"Редкоземельные элементы","#8baab8"]
];
export const mineralTypes=mineralWords.map(x=>({name:x[1],color:x[2]}));
export function mineralCommodity(feature:GeoFeature):{name:string;color:string}|null{
 const p=feature.properties??{};
 const candidates=["commod1","commod2","commod3","commodities","commodity","COMMOD1","COMMODITIES",
  "commodity_name","main_commodity","dep_type"].map(k=>String(p[k]??"")).join(" ");
 const found=mineralWords.find(x=>x[0].test(candidates));
 return found?{name:found[1],color:found[2]}:null;
}
/** USGS published data, global but known to have incomplete coverage outside the US.
 * Only a viewport-sized subset is downloaded; absent records are not fabricated. */
export function loadMineralDeposits(b:ExternalBounds):Promise<GeoCollection>{
 if(!canLoadMinerals(b))return Promise.resolve({type:"FeatureCollection",features:[]});
 const params=new URLSearchParams({where:"1=1",geometry:[
  b.west,b.south,b.east,b.north].map(v=>v.toFixed(4)).join(","),
  geometryType:"esriGeometryEnvelope",inSR:"4326",outSR:"4326",
  spatialRel:"esriSpatialRelIntersects",outFields:"*",returnGeometry:"true",
  resultRecordCount:"350",f:"json"});
 const url="https://energy.usgs.gov/arcgis/rest/services/Hosted/Major_mineral_deposits/FeatureServer/0/query?"+params.toString();
 return memo("usgs:"+externalBBoxKey(b),async()=>{
  const data=await safeFetch(url);
  if(data.error)throw Error("USGS: "+String(data.error.message));
  const features:GeoFeature[]=[];
  for(const row of data.features??[]){
   const a=row.attributes??{},g=row.geometry??{};
   const lat=Number(g.y),lon=Number(g.x);
   if(!Number.isFinite(lat)||!Number.isFinite(lon)||Math.abs(lat)>90||Math.abs(lon)>180)continue;
   const feature:GeoFeature={type:"Feature",geometry:{type:"Point",coordinates:[lon,lat]},
    properties:a};
   if(mineralCommodity(feature))features.push(feature);
  }
  return {type:"FeatureCollection",features};
 });
}
