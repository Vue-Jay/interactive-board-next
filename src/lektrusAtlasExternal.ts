import type {GeoCollection,GeoFeature} from "./lektrusAtlasData";
import {SCHOOL_ATLAS_USGS_MINERALS} from "./lektrusSchoolAtlasMinerals";

export type ExternalBounds={west:number;south:number;east:number;north:number};
export const externalBBoxKey=(b:ExternalBounds)=>
 [b.west,b.south,b.east,b.north].map(v=>Math.round(v*2)/2).join(",");
const cache=new Map<string,Promise<GeoCollection>>();
const MAX_EXTERNAL_FEATURES=1100;
const sane=(b:ExternalBounds)=>Object.values(b).every(Number.isFinite)&&
 b.west>=-180&&b.east<=180&&b.south>=-85&&b.north<=85&&
 b.east>b.west&&b.north>b.south;
export const canLoadLocalRoads=(b:ExternalBounds)=>
 sane(b)&&b.east-b.west<=10.01&&b.north-b.south<=7.01;
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
 cache.set(id,promise);if(cache.size>45)cache.delete(cache.keys().next().value!);
 return promise;
};
/** OSM Overpass geometry for a SMALL map viewport. This is not a full street map. */
export function loadLocalInfrastructure(b:ExternalBounds,kind:"roads"|"waterways"="roads"):Promise<GeoCollection>{
 if(!canLoadLocalRoads(b))return Promise.resolve({type:"FeatureCollection",features:[]});
 const box=[b.south,b.west,b.north,b.east].map(x=>Number(x.toFixed(5))).join(",");
 const overpass='[out:json][timeout:15];('+
  (kind==="roads"?'way["highway"~"^(motorway|trunk|primary|secondary)$"]('+box+');':
   'way["waterway"~"^(river|stream|canal)$"]('+box+');')+
  ');out geom;';
 // The Russian full-planet mirror is preferred; overloaded public servers
 // remain fallbacks. Never draw invented roads when all mirrors fail.
 const servers=["https://maps.mail.ru/osm/tools/overpass/api/interpreter?data=",
  "https://overpass-api.de/api/interpreter?data=",
  "https://overpass.kumi.systems/api/interpreter?data="];
 return memo("osm:"+kind+":"+externalBBoxKey(b),async()=>{
  let json:unknown=null,lastError:unknown=null;
  for(const endpoint of servers){
   try{json=await safeFetch(endpoint+encodeURIComponent(overpass));break}
   catch(e){lastError=e}
  }
  if(!json)throw lastError instanceof Error?lastError:new Error("Overpass недоступен");
  const overpassData=json as {elements?:Array<{type:string;geometry?:Array<{lon:number;lat:number}>;tags?:Record<string,string>;id:number}>};
  const features:GeoFeature[]=[];
  const usedIds=new Set<number>();
  for(const item of overpassData.elements??[]){
   if(features.length>=MAX_EXTERNAL_FEATURES)break;
   if(item.type!=="way"||usedIds.has(item.id)||!Array.isArray(item.geometry)||item.geometry.length<2)continue;
   usedIds.add(item.id);
   const tags=item.tags??{},road=typeof tags.highway==="string";
   const ruSource=String(tags["name:ru"]??"").trim();
   const alternate=String(tags.name??"").trim();
   const ru=/[А-ЯЁа-яё]/.test(ruSource)?ruSource:/[А-ЯЁа-яё]/.test(alternate)?alternate:"";
   if(kind==="roads"&&!road||kind==="waterways"&&road)continue;
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
/** Only types in the Russian school atlas. Specialized USGS commodities stay
 * in the source database but are not rendered as extra school map symbols. */
const mineralWords:ReadonlyArray<[RegExp,string,string]>=[
 [/iron(?:\\s+ore)?|железн|ferrous/i,"Железные руды","#333"],
 [/manganese|марганц/i,"Марганцевые руды","#333"],
 [/chromium|chromite|хромит/i,"Хромовые руды","#333"],
 [/nickel|никел/i,"Никелевые руды","#333"],
 [/tungsten|вольфрам/i,"Вольфрамовые руды","#333"],
 [/molybdenum|молибден/i,"Молибденовые руды","#333"],
 [/bauxite|alumini?um|боксит|алюмини/i,"Алюминиевые руды","#333"],
 [/copper|медн|cupr/i,"Медные руды","#333"],
 [/polymetallic|lead|zinc|свинц|цинк|полиметал/i,"Полиметаллические руды","#333"],
 [/\\btin\\b|олов/i,"Оловянные руды","#333"],
 [/gold|aurum|золот/i,"Золото","#333"],
 [/mercury|cinnabar|ртут|киновар/i,"Ртутные руды","#333"],
 [/asbestos|асбест/i,"Асбест","#333"],
 [/graphite|графит/i,"Графит","#333"],
 [/mica|слюд/i,"Слюда","#333"],
 [/apatite|апатит/i,"Апатиты","#333"],
 [/phosphate|phosphorite|фосфат|фосфорит/i,"Фосфориты","#333"],
 [/potash|potassium|калийн/i,"Калийные соли","#333"],
 [/halite|rock salt|каменн(?:ая|ой)\\s*сол|поваренн(?:ая|ой)\\s*сол/i,"Поваренная соль","#333"],
 [/glauber|mirabilite|глаубер|мирабилит/i,"Глауберова соль","#333"],
 [/diamonds?|алмаз/i,"Алмазы","#333"]
];
// Keep filter order and legend exactly aligned to the school curriculum.
export const mineralTypes=SCHOOL_ATLAS_USGS_MINERALS.map(name=>{
 const entry=mineralWords.find(([,label])=>label===name);
 if(!entry)throw Error("Отсутствует школьный тип полезного ископаемого: "+name);
 return {name,color:entry[2]};
});
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

/** Known geological genesis classes, never inferred from the deposit name. */
const mineralOriginRu:Record<string,string>={
 Hydrothermal:"Гидротермальное",Igneous:"Магматическое",
 Metamorphic:"Метаморфогенное",Sedimentary:"Осадочное",
 Surficial:"Приповерхностное",Gemstone:"Месторождение драгоценных камней",
 Unclassified:"Тип происхождения в источнике не установлен"
};
export function mineralDepositFacts(feature:GeoFeature):Array<{label:string;value:string}>{
 const p=feature.properties??{},result:Array<{label:string;value:string}>=[];
 const type=String(p.dep_type??"").trim();
 if(mineralOriginRu[type])result.push({label:"Генетический тип",value:mineralOriginRu[type]});
 const code=String(p.model_code??"").trim();
 if(code&&/^[A-Za-z0-9 ._/-]{1,16}$/.test(code))
  result.push({label:"Код геологической модели USGS",value:code});
 const ref=Number(p.rec_id);
 if(Number.isInteger(ref)&&ref>0)result.push({label:"Номер записи USGS",value:String(ref)});
 return result;
}
export function mineralDepositSource(feature:GeoFeature):string|null{
 const url=String(feature.properties?.url??"").trim();
 if(/^https:\/\/[^\s]+$/i.test(url)&&/^https:\/\/(?:[^/]+\.)?(?:usgs\.gov|mrdata\.usgs\.gov)\//i.test(url))return url;
 return null;
}

/** Real administrative boundaries for cities across the world, queried for the
 * current small viewport. Coverage depends on locally mapped OSM relations.
 * No guessed municipality outlines are ever drawn. */
export const canLoadCityBoundaries=(b:ExternalBounds)=>
 sane(b)&&b.east-b.west<=6.01&&b.north-b.south<=5.01;
export function loadCityBoundaries(b:ExternalBounds):Promise<GeoCollection>{
 if(!canLoadCityBoundaries(b))return Promise.resolve({type:"FeatureCollection",features:[]});
 const bbox=[b.south,b.west,b.north,b.east].map(n=>n.toFixed(5)).join(",");
 const query='[out:json][timeout:18];('+
  'relation["boundary"="administrative"]["admin_level"~"^(6|7|8|9|10)$"]('+bbox+');'+
  'way["boundary"="administrative"]["place"~"^(city|town)$"]('+bbox+');'+
  ');out geom;';
 const endpoints=["https://overpass-api.de/api/interpreter?data=",
  "https://overpass.kumi.systems/api/interpreter?data="];
 return memo("city-boundaries:"+externalBBoxKey(b),async()=>{
  let data:unknown=null,error:unknown;
  for(const endpoint of endpoints){
   try{data=await safeFetch(endpoint+encodeURIComponent(query));break}catch(e){error=e}
  }
  if(!data)throw error instanceof Error?error:new Error("Сервис границ городов недоступен");
  type Node={lon:number;lat:number};
  type Member={type:string;role?:string;geometry?:Node[]};
  type Element={type:string;id:number;tags?:Record<string,string>;geometry?:Node[];members?:Member[]};
  const elements=(data as {elements?:Element[]}).elements??[];
  const features:GeoFeature[]=[];
  const append=(nodes:Node[]|undefined,element:Element,role="outer")=>{
   if(!nodes||nodes.length<3||features.length>=450)return;
   const coordinates=nodes.filter(n=>Number.isFinite(n.lon)&&Number.isFinite(n.lat)&&
    n.lon>=-180&&n.lon<=180&&n.lat>=-90&&n.lat<=90).map(n=>[n.lon,n.lat]);
   if(coordinates.length<3)return;
   const tags=element.tags??{},ru=tags["name:ru"]??tags.name??"";
   features.push({type:"Feature",geometry:{type:"LineString",coordinates},
    properties:{NAME_RU:/[А-ЯЁа-яё]/.test(ru)?ru:"",
     ATLAS_KIND:"city-boundary",OSM_ID:element.id,
     ADMIN_LEVEL:tags.admin_level??"",OSM_ROLE:role,OSM_TYPE:element.type}});
  };
  for(const item of elements){
   if(features.length>=450)break;
   if(item.type==="way")append(item.geometry,item);
   if(item.type==="relation"){
    for(const member of item.members??[]){
     if(features.length>=450)break;
     if(member.type==="way"&&(member.role==="outer"||member.role==="inner"))
      append(member.geometry,item,member.role);
    }
   }
  }
  return {type:"FeatureCollection",features};
 });
}

/** Worldwide overview uses a bounded, geographically distributed sample of real
 * USGS records. Six geographic partitions prevent a worldwide first-page query
 * from showing deposits only near a single region. Counts represent records in
 * this sample, not all deposits or reserves on Earth.
 */
export function loadWorldMineralOverview():Promise<GeoCollection>{
 return memo("usgs:world-overview:v2",async()=>{
  const longitudes=[[-180,-60],[-60,60],[60,180]];
  const latitudes=[[-60,0],[0,85]];
  const tiles=longitudes.flatMap(([west,east])=>latitudes.map(([south,north])=>({west,east,south,north})));
  const results=await Promise.allSettled(tiles.map(async b=>{
   const params=new URLSearchParams({
    where:"1=1",geometry:[b.west,b.south,b.east,b.north].join(","),
    geometryType:"esriGeometryEnvelope",inSR:"4326",outSR:"4326",
    spatialRel:"esriSpatialRelIntersects",
    outFields:"gid,rec_id,dep_name,commodity,dep_type",
    returnGeometry:"true",resultRecordCount:"350",f:"json"
   });
   const endpoint="https://energy.usgs.gov/arcgis/rest/services/Hosted/Major_mineral_deposits/FeatureServer/0/query?"+params.toString();
   const response=await safeFetch(endpoint);
   if(response.error)throw Error(String(response.error.message));
   const features:GeoFeature[]=[];
   for(const row of response.features??[]){
    const properties=row.attributes??{},lat=Number(row.geometry?.y),lon=Number(row.geometry?.x);
    if(!Number.isFinite(lat)||!Number.isFinite(lon)||lat<-90||lat>90||lon<-180||lon>180)continue;
    const feature:GeoFeature={type:"Feature",geometry:{type:"Point",coordinates:[lon,lat]},properties};
    if(mineralCommodity(feature))features.push(feature);
   }
   return features;
  }));
  const combined:GeoFeature[]=[],ids=new Set<string>();
  let successful=0;
  for(const result of results){
   if(result.status!=="fulfilled")continue;
   successful++;
   for(const f of result.value){
    const id=String(f.properties?.gid??f.properties?.rec_id??"")+":"+
     JSON.stringify(f.geometry?.coordinates);
    if(ids.has(id))continue;
    ids.add(id);combined.push(f);
   }
  }
  if(!successful)throw Error("Обзорные месторождения USGS недоступны");
  return {type:"FeatureCollection",features:combined};
 });
}

/** OSM is global but live query services cannot return every world boundary at once.
 * Load deterministic geographic tiles as the user navigates. Sparse/absent OSM
 * coverage remains absent rather than manufacturing city polygons.
 */
export type AtlasOSMCoverageKind="roads"|"city-boundaries";
export function atlasOSMCoverageTiles(bounds:ExternalBounds,kind:AtlasOSMCoverageKind):ExternalBounds[]{
 if(!sane(bounds))return [];
 const width=bounds.east-bounds.west,height=bounds.north-bounds.south;
 if(kind==="roads"?(width>46||height>29):(width>27||height>17))return [];
 // Smaller tiles at high zoom avoid querying entire regions when a teacher
 // needs only city blocks or the immediate road network.
 const stepLon=kind==="roads"?(width<=9?3:width<=22?5:10):
  width<=7?1.5:width<=15?3:6;
 const stepLat=kind==="roads"?(height<=7?2:height<=15?4:7):
  height<=5?1:height<=11?2.5:5;
 const cx=(bounds.west+bounds.east)/2,cy=(bounds.south+bounds.north)/2;
 const tiles:ExternalBounds[]=[];
 const firstX=Math.floor(bounds.west/stepLon),lastX=Math.floor((bounds.east-1e-8)/stepLon);
 const firstY=Math.floor(bounds.south/stepLat),lastY=Math.floor((bounds.north-1e-8)/stepLat);
 for(let x=firstX;x<=lastX;x++)for(let y=firstY;y<=lastY;y++){
  const west=Math.max(-180,x*stepLon),east=Math.min(180,(x+1)*stepLon);
  const south=Math.max(-85,y*stepLat),north=Math.min(85,(y+1)*stepLat);
  if(east>west&&north>south)tiles.push({west,east,south,north});
 }
 // At coarse scales prioritize a few tiles nearest the viewport centre,
 // avoiding dozens of simultaneous heavy Overpass requests.
 tiles.sort((a,b)=>{
  const da=Math.hypot((a.west+a.east)/2-cx,(a.south+a.north)/2-cy);
  const db=Math.hypot((b.west+b.east)/2-cx,(b.south+b.north)/2-cy);
  return da-db||a.west-b.west||a.south-b.south;
 });
 return tiles.slice(0,kind==="roads"?12:12);
}
export function loadAtlasOSMCoverage(bounds:ExternalBounds,kind:AtlasOSMCoverageKind):Promise<GeoCollection>{
 const tiles=atlasOSMCoverageTiles(bounds,kind);
 if(!tiles.length)return Promise.resolve({type:"FeatureCollection",features:[]});
 const cacheKey="coverage:"+kind+":"+tiles.map(externalBBoxKey).sort().join("|");
 return memo(cacheKey,async()=>{
  // Query groups of three concurrently to avoid overwhelming shared Overpass services.
  const loaded:GeoFeature[]=[],used=new Set<string>();
  let successful=0;
  for(let i=0;i<tiles.length;i+=3){
   const batch=await Promise.allSettled(tiles.slice(i,i+3).map(tile=>kind==="roads"?
    loadLocalInfrastructure(tile,"roads"):loadCityBoundaries(tile)));
   for(const result of batch){
    if(result.status!=="fulfilled")continue;
    successful++;
    for(const feature of result.value.features){
     if(loaded.length>=(kind==="roads"?2600:1800))break;
     const props=feature.properties??{};
     const code=String(props.OSM_TYPE??"way")+":"+String(props.OSM_ID??"")+":"+
      String(props.OSM_ROLE??"")+":"+JSON.stringify(
       feature.geometry?.type==="LineString"?(feature.geometry.coordinates as number[][])[0]:null);
     if(used.has(code))continue;
     used.add(code);loaded.push(feature);
    }
   }
  }
  if(!successful)throw Error("Не удалось получить границы и дороги OSM для этой территории");
  return {type:"FeatureCollection",features:loaded};
 });
}
