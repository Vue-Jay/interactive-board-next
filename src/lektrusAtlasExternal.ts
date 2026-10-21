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
export function loadLocalInfrastructure(b:ExternalBounds,kind:"roads"|"waterways"="roads"):Promise<GeoCollection>{
 if(!canLoadLocalRoads(b))return Promise.resolve({type:"FeatureCollection",features:[]});
 const box=[b.south,b.west,b.north,b.east].map(x=>Number(x.toFixed(5))).join(",");
 const overpass='[out:json][timeout:15];('+
  (kind==="roads"?'way["highway"~"^(motorway|trunk|primary)$"]('+box+');':
   'way["waterway"~"^(river|stream|canal)$"]["name:ru"]('+box+');'+
   'way["waterway"~"^(river|stream|canal)$"]["name"]('+box+');')+
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
   if(kind==="roads"&&!road||kind==="waterways"&&(road||!/[А-ЯЁа-яё]/.test(ru)))continue;
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
 // This USGS major-deposit source does not index petroleum or coal fields.
 // Never advertise unavailable fossil-fuel layers as if populated.
 [/uranium|уран/i,"Уран","#92a750"],[/diamonds?|алмаз/i,"Алмазы","#8ccad6"],
 [/lithium|литий/i,"Литий","#a782ba"],[/nickel|никел/i,"Никель","#7f9697"],
 [/bauxite|aluminum|aluminium|боксит/i,"Бокситы и алюминий","#c99987"],
 [/tin\b|олов/i,"Олово","#95b1b2"],[/lead|свин/i,"Свинец","#858f9b"],
 [/zinc|цинк/i,"Цинк","#94a694"],[/potash|potassium|калийн/i,"Калийные соли","#c1a3cc"],
 [/phosphate|фосфат/i,"Фосфориты","#7cb394"],[/tungsten|вольфрам/i,"Вольфрам","#9f8e80"],
 [/manganese|марганец/i,"Марганец","#9c8fba"],[/rare earth|редкозем/i,"Редкоземельные элементы","#8baab8"],
 [/molybdenum|молибден/i,"Молибден","#7b99a6"],[/cobalt|кобальт/i,"Кобальт","#7696b5"],
 [/beryllium|берил/i,"Бериллий","#a6bf98"],[/titanium|титан/i,"Титан","#969db0"],
 [/chromium|chromite|хром/i,"Хромиты","#779c90"],[/platinum|платин/i,"Платина","#c6b4cb"],
 [/barite|baryte|барит/i,"Барит","#ae9aa6"],[/gypsum|гипс/i,"Гипс","#d2c5a2"],
 [/salt|halite|галит/i,"Каменная соль","#d9bba1"],
 [/boron|borate|борн/i,"Борные минералы","#c9aa81"],
 [/kaolin|каолин/i,"Каолин","#c2c5ae"],[/fluorite|fluorspar|флюорит/i,"Флюорит","#9cafc9"]
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
 sane(b)&&b.east-b.west<=3.5&&b.north-b.south<=3;
export function loadCityBoundaries(b:ExternalBounds):Promise<GeoCollection>{
 if(!canLoadCityBoundaries(b))return Promise.resolve({type:"FeatureCollection",features:[]});
 const bbox=[b.south,b.west,b.north,b.east].map(n=>n.toFixed(5)).join(",");
 const query='[out:json][timeout:18];('+
  'relation["boundary"="administrative"]["admin_level"~"^(7|8|9)$"]('+bbox+');'+
  'way["place"~"^(city|town)$"]('+bbox+');'+
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
