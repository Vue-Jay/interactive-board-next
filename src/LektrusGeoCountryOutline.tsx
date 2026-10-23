import {useEffect,useState} from "react";
import {atlasCountryIso} from "./lektrusAtlasCountrySymbols";
import {loadAtlasLayer,type GeoCollection,type GeoFeature} from "./lektrusAtlasData";
import {buildCountryOutline,type GeoOutline} from "./lektrusGeoOutlineGeometry";

/** Load the identical modern Russian-view polygon layer used by the atlas.
 * One shared request serves every silhouette on the board. */
const groupCountries=(collection:GeoCollection):Map<string,GeoFeature[]>=>{
 const byCode=new Map<string,GeoFeature[]>();
 for(const feature of collection.features){
  const code=atlasCountryIso(feature);
  if(!code)continue;
  const current=byCode.get(code);
  if(current)current.push(feature);
  else byCode.set(code,[feature]);
 }
 return byCode;
};
let primary:Promise<Map<string,GeoFeature[]>>|null=null;
let secondary:Promise<Map<string,GeoFeature[]>>|null=null;
const outlines=new Map<string,GeoOutline>();
const inflight=new Map<string,Promise<GeoOutline|null>>();
function mainAtlas(){
 if(!primary)primary=loadAtlasLayer("countries-russian")
  .catch(()=>loadAtlasLayer("countries-ultra"))
  .then(groupCountries)
  .catch(error=>{primary=null;throw error});
 return primary;
}
function fallbackAtlas(){
 if(!secondary)secondary=loadAtlasLayer("countries-detail")
  .then(groupCountries).catch(error=>{secondary=null;throw error});
 return secondary;
}
async function fetchOutline(code:string):Promise<GeoOutline|null>{
 const cached=outlines.get(code);
 if(cached)return cached;
 const fetching=inflight.get(code);
 if(fetching)return fetching;
 const task=(async()=>{
  const atlas=await mainAtlas();
  let features=atlas.get(code)??[];
  let outline=buildCountryOutline(features);
  if(!outline){
   const fallback=await fallbackAtlas();
   features=fallback.get(code)??[];
   outline=buildCountryOutline(features);
  }
  if(outline)outlines.set(code,outline);
  return outline;
 })();
 inflight.set(code,task);
 try{return await task}finally{inflight.delete(code)}
}
export default function LektrusGeoCountryOutline({code}:{code:string}){
 const [shape,setShape]=useState<GeoOutline|null>(()=>outlines.get(code)??null);
 const [status,setStatus]=useState<"loading"|"ready"|"missing"|"error">(
  ()=>outlines.has(code)?"ready":"loading");
 useEffect(()=>{
  let active=true;
  const saved=outlines.get(code);
  if(saved){setShape(saved);setStatus("ready");return()=>{active=false}};
  setShape(null);setStatus("loading");
  fetchOutline(code).then(outline=>{
   if(!active)return;
   setShape(outline);setStatus(outline?"ready":"missing");
  }).catch(()=>{if(active){setShape(null);setStatus("error")}});
  return()=>{active=false};
 },[code]);
 return <span className="lektrus-geo-outline" role="img" aria-label="Контур государства">
  {shape?<svg className="lektrus-geo-outline-svg" viewBox={shape.viewBox}
   preserveAspectRatio="xMidYMid meet" aria-hidden="true" focusable="false">
   <path d={shape.path} fill="#6596d1" stroke="#2d5985" strokeWidth="1.5"
    strokeLinejoin="round" fillRule="evenodd"/>
  </svg>:<span className="lektrus-geo-outline-status">
   {status==="loading"?"Загрузка контура…":status==="missing"?
    "Контур в атласе отсутствует":"Не удалось загрузить контур"}
  </span>}
 </span>;
}
