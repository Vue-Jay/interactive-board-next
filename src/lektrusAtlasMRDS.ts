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
 ["Поваренная соль",["HAL"]],["Фосфориты",["P"]],
 ["Калийные соли",["K"]]
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
