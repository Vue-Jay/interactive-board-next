import type {GeoCollection,GeoFeature} from "./lektrusAtlasData";

/** Exact commodity codes published by USGS MRDS. Never classify a mine
 * from its place name: "gold mine" may refer to historic, exhausted production.
 * MRDS itself is an archival, incomplete reference, not a 2026 cadastre.
 */
export const MRDS_SERVICE="https://energy.usgs.gov/arcgis/rest/services/Hosted/Mineral_Resource_Data_System/FeatureServer/0/query";
const CODE_MATCHES:ReadonlyArray<[string,readonly string[]]>=[
 ["Алмазы",["DIA"]],["Золото",["AU"]],["Железные руды",["FE"]],
 ["Медные руды",["CU"]],["Марганцевые руды",["MN"]],
 ["Хромовые руды",["CR"]],["Никелевые руды",["NI"]],
 ["Вольфрамовые руды",["W"]],["Молибденовые руды",["MO"]],
 ["Оловянные руды",["SN"]],["Ртутные руды",["HG"]],
 ["Асбест",["ASB"]],["Графит",["GRF"]],
 ["Алюминиевые руды",["AL1"]],["Слюда",["MIC","MIC1","MIC2","MIC3"]],
 ["Поваренная соль",["HAL"]]
];
const schoolInk="#202528";
export function mrdsMineralCommodity(feature:GeoFeature):{name:string;color:string}|null{
 const p=feature.properties??{};
 if(p.ATLAS_DATASET!=="MRDS")return null;
 // Commodity codes are tokens, not English free text. An exact token check
 // avoids e.g. confusing "AG" (silver) with "AGT" or "CU" with other codes.
 const codes=new Set(String(p.code_list??"").toUpperCase()
  .split(/[^A-Z0-9]+/).filter(Boolean));
 if(codes.has("PB")&&codes.has("ZN"))
  return {name:"Полиметаллические руды",color:schoolInk};
 const match=CODE_MATCHES.find(([,values])=>values.some(code=>codes.has(code)));
 return match?{name:match[0],color:schoolInk}:null;
}

export function parseMRDSFeatures(data:unknown):GeoCollection{
 const features:GeoFeature[]=[];
 const response=data as {features?:Array<{attributes?:Record<string,unknown>;geometry?:{x?:unknown;y?:unknown}}>}|null;
 for(const row of response?.features??[]){
  const p=row.attributes??{},lon=Number(row.geometry?.x),lat=Number(row.geometry?.y);
  if(!Number.isFinite(lon)||!Number.isFinite(lat)||Math.abs(lon)>180||Math.abs(lat)>90)continue;
  const properties={...p,ATLAS_DATASET:"MRDS",ATLAS_SOURCE:"USGS MRDS"};
  const feature:GeoFeature={type:"Feature",geometry:{type:"Point",coordinates:[lon,lat]},properties};
  if(mrdsMineralCommodity(feature))features.push(feature);
 }
 return {type:"FeatureCollection",features};
}

/** Small bounded geospatial request with only display fields, no full reports. */
export function mrdsRequestUrl(west:number,south:number,east:number,north:number,count=650){
 const params=new URLSearchParams({
  where:"code_list IS NOT NULL",geometry:[west,south,east,north].map(n=>n.toFixed(4)).join(","),
  geometryType:"esriGeometryEnvelope",inSR:"4326",outSR:"4326",
  spatialRel:"esriSpatialRelIntersects",outFields:"objectid_1,dep_id,site_name,code_list,dev_stat,url",
  returnGeometry:"true",resultRecordCount:String(Math.min(1200,Math.max(1,count))),
  orderByFields:"objectid_1",f:"json"
 });
 return MRDS_SERVICE+"?"+params.toString();
}

type MRDSBounds={west:number;south:number;east:number;north:number};
const cache=new Map<string,Promise<GeoCollection>>();
function cached(key:string,loader:()=>Promise<GeoCollection>):Promise<GeoCollection>{
 const existing=cache.get(key);if(existing)return existing;
 const request=loader().catch(error=>{cache.delete(key);throw error});
 cache.set(key,request);if(cache.size>32)cache.delete(cache.keys().next().value!);
 return request;
}
async function fetchMRDSTile(b:MRDSBounds,count:number):Promise<GeoCollection>{
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),12000);
 try{
  const response=await fetch(mrdsRequestUrl(b.west,b.south,b.east,b.north,count),
   {signal:controller.signal,mode:"cors"});
  if(!response.ok)throw new Error("USGS MRDS: HTTP "+response.status);
  const data=await response.json();
  if(data.error)throw new Error("USGS MRDS: "+String(data.error.message));
  return parseMRDSFeatures(data);
 }finally{clearTimeout(timer)}
}
export function loadMRDSRegionalDeposits(b:MRDSBounds):Promise<GeoCollection>{
 if(![b.west,b.south,b.east,b.north].every(Number.isFinite)||
  b.east<=b.west||b.north<=b.south||b.east-b.west>56||b.north-b.south>31)
  return Promise.resolve({type:"FeatureCollection",features:[]});
 const key="local:"+[b.west,b.south,b.east,b.north].map(n=>Math.round(n*2)/2).join(":");
 return cached(key,()=>fetchMRDSTile(b,1000));
}
/** Geographic slices prevent the full-world limit from returning nearly
 * all records from a few densely documented US states. Still a sample.
 */
export function loadMRDSWorldOverview():Promise<GeoCollection>{
 return cached("world:12:v1",async()=>{
  const longitudes=[-180,-120,-60,0,60,120,180];
  const latitudes=[-60,5,85];
  const tiles:MRDSBounds[]=[];
  for(let y=0;y<latitudes.length-1;y++)
   for(let x=0;x<longitudes.length-1;x++)
    tiles.push({west:longitudes[x],east:longitudes[x+1],
     south:latitudes[y],north:latitudes[y+1]});
  const records:GeoFeature[]=[],ids=new Set<string>();let successful=0;
  // Four concurrent requests: avoids a burst of 12 expensive GIS queries.
  let next=0;
  await Promise.all(Array.from({length:4},async()=>{
   while(next<tiles.length){
    const tile=tiles[next++];
    try{
     const result=await fetchMRDSTile(tile,650);
     successful++;
     for(const feature of result.features){
      const key=String(feature.properties?.dep_id??feature.properties?.objectid_1??"")+
       ":"+JSON.stringify(feature.geometry?.coordinates);
      if(ids.has(key))continue;
      ids.add(key);records.push(feature);
     }
    }catch{/* Other slices may still be available. */}
   }
  }));
  if(!successful)throw new Error("USGS MRDS недоступна");
  return {type:"FeatureCollection",features:records};
 });
}
