import {geoFeatureName,isRussianAtlasName,type GeoFeature,type GeoCollection} from "./lektrusAtlasData";

/** Exact Russian labels from the mapped source, not guessed translations. */
export function russianPlaceName(feature:GeoFeature):string|null{
 const name=geoFeatureName(feature);
 return isRussianAtlasName(name)?name:null;
}
/** Natural Earth national capital attribute. Region and local capitals are
 * never silently promoted to capitals of sovereign states. */
export function nationalCapital(feature:GeoFeature):boolean{
 const p=feature.properties??{};
 const flag=Number(p.ADM0CAP??p.adm0cap);
 const type=String(p.FEATURECLA??p.featurecla??"");
 return flag===1&&/^Admin-0 capital(?: alt)?$/i.test(type);
}
export function alternateCapital(feature:GeoFeature):boolean{
 return /Admin-0 capital alt/i.test(String(feature.properties?.FEATURECLA??feature.properties?.featurecla??""));
}
export function cityPopulation(feature:GeoFeature):number{
 const p=feature.properties??{};
 const val=Number(p.POP_MAX??p.pop_max??p.POP_MIN??p.pop_min??0);
 return Number.isFinite(val)&&val>0?val:0;
}
export function cityRank(feature:GeoFeature):number{
 const p=feature.properties??{};
 const raw=Number(p.LABELRANK??p.labelrank??p.SCALERANK??p.scalerank??10);
 return Number.isFinite(raw)?raw:10;
}
export type PlacePoint={id:number;point:[number,number]|null;feature:GeoFeature};
/** Deterministic screen-space collision filter: the visible labels have no
 * overlap at the selected zoom. All points remain searchable/selectable. */
export function chooseCityLabels<T extends PlacePoint>(points:readonly T[],scale:number,
 maxCount:number):T[]{
 const sorted=[...points].filter(f=>f.point&&russianPlaceName(f.feature))
  .sort((a,b)=>cityRank(a.feature)-cityRank(b.feature)||
   cityPopulation(b.feature)-cityPopulation(a.feature)||a.id-b.id);
 const placed:{x:number;y:number;w:number}[]=[],out:T[]=[];
 const fontPx=Math.min(15.5,9.2+Math.log2(Math.max(1,scale))*1.05);
 for(const item of sorted){
  const text=russianPlaceName(item.feature)!;
  const x=item.point![0]*scale,y=item.point![1]*scale;
  const w=Math.min(260,Math.max(24,text.length*fontPx*.56));
  const overlap=placed.some(p=>Math.abs(p.y-y)<fontPx*1.3&&x<=p.x+p.w+8&&p.x<=x+w+8);
  if(overlap)continue;
  placed.push({x,y,w});out.push(item);
  if(out.length>=maxCount)break;
 }
 return out;
}
/** Density filter is a visual limit, not a restriction on the source's
 * actual cities or their availability in the name search. */
export function limitCitySymbols<T extends PlacePoint>(points:readonly T[],
 scale:number,limit=850):T[]{
 const cap=Math.max(1,Math.min(limit,Math.round(limit*(scale>=4?1:scale>=2?.7:.4))));
 const ranked=[...points].sort((a,b)=>cityRank(a.feature)-cityRank(b.feature)||
  cityPopulation(b.feature)-cityPopulation(a.feature)||a.id-b.id);
 // Major settlements stay visible; close neighbours wait until zooming in.
 // Spatial grid avoids quadratic overlap checks on dense city layers.
 const separation=scale<3?10:7,grid=new Map<string,{x:number;y:number}>();
 const visible:T[]=[];
 for(const city of ranked){
  if(!city.point)continue;
  const x=city.point[0]*scale,y=city.point[1]*scale;
  const gx=Math.floor(x/separation),gy=Math.floor(y/separation);
  let crowded=false;
  for(let dx=-1;dx<=1&&!crowded;dx++)for(let dy=-1;dy<=1;dy++){
   const near=grid.get((gx+dx)+":"+(gy+dy));
   if(near&&Math.hypot(near.x-x,near.y-y)<separation){crowded=true;break}
  }
  if(crowded)continue;
  grid.set(gx+":"+gy,{x,y});visible.push(city);
  if(visible.length>=cap)break;
 }
 return visible;
}

/** Explicit, dated corrections to the static Natural Earth capital attributes.
 * Only facts verified from primary government/legislative documents are changed.
 * Coordinates for the new Equatorial Guinea capital refer to the OSM locality,
 * not a government-building point, and remain approximate. */
const CAPITAL_UPDATES=[
 {country:"GQ",old:"Malabo",current:"Ciudad de la Paz",rus:"Сьюдад-де-ла-Пас",
  lon:10.8268,lat:1.5995,
  note:"Столица Экваториальной Гвинеи с января 2026 года по декрету № 1/2026.",
  document:"https://www.guineaecuatorialpress.com/noticias/decreto_ley_por_el_que_se_declara_la_ciudad_de_la_paz_djibloho_capital_de_la_republica_de_guinea_ecuatorial"},
 {country:"TZ",old:"Dar es Salaam",current:"Dodoma",rus:"Додома",
  lon:35.750004,lat:-6.183306,
  note:"Столица Танзании Додома закреплена законом о столице 2018 года.",
  document:"https://oagmis.oag.go.tz/portal/acts/52"},
 {country:"BJ",old:"Cotonou",current:"Porto-Novo",rus:"Порто-Ново",
  lon:2.616626,lat:6.483311,
  note:"Конституционная столица Бенина Порто-Ново; Котону является местом пребывания правительства.",
  document:"https://www.gouv.bj/article/935/allons--ensemble-decouverte-communes-benin/"}
] as const;
export const verifiedCapitalUpdates2026=CAPITAL_UPDATES;
export function applyVerifiedCapitalUpdates2026(collection:GeoCollection):GeoCollection{
 // Features are never mutated; the same source may be used on multiple maps.
 const items=collection.features.map(feature=>{
  const p=feature.properties??{};
  const iso=String(p.ISO_A2??p.iso_a2??"").toUpperCase();
  const raw=String(p.NAME??p.name??"");
  const nameCandidates=[raw,String(p.NAME_RU??""),String(p.NAMEASCII??"")];
  if(iso==="KZ"&&nameCandidates.some(v=>/^(?:nur[-\\s]?sultan|нур[-\\s]?султан|astana|астана)$/iu.test(v.trim()))){
   return {...feature,properties:{...p,NAME:"Astana",NAMEASCII:"Astana",
    NAME_RU:"Астана",NAME_ALT:"Нур-Султан",ADM0CAP:1,CAPALT:0,
    FEATURECLA:"Admin-0 capital",
    CAPITAL_CORRECTION_RU:"Столица Казахстана вновь называется Астана с 17 сентября 2022 года.",
    CAPITAL_CORRECTION_URL:"https://akorda.kz/ru/o-pereimenovanii-goroda-nur-sultana-stolicy-respubliki-kazahstan-v-gorod-astanu-stolicu-respubliki-kazahstan-1782457"}};
  }
  const relevant=CAPITAL_UPDATES.find(c=>c.country===iso&&(c.old===raw||c.current===raw));
  if(!relevant)return feature;
  const isNew=relevant.current===raw;
  return {...feature,properties:{...p,ADM0CAP:isNew?1:0,CAPALT:0,
   FEATURECLA:isNew?"Admin-0 capital":"Populated place",
   CAPITAL_CORRECTION_RU:isNew?relevant.note:"Прежняя столица; актуальный статус изменён. "+relevant.note,
   CAPITAL_CORRECTION_URL:relevant.document}};
 });
 // Natural Earth's older place records do not contain the newest capital.
 for(const c of CAPITAL_UPDATES){
  if(items.some(f=>String(f.properties?.ISO_A2??"").toUpperCase()===c.country&&
   String(f.properties?.NAME??"")===c.current))continue;
  items.push({type:"Feature",geometry:{type:"Point",coordinates:[c.lon,c.lat]},
   properties:{NAME:c.current,NAME_RU:c.rus,ISO_A2:c.country,
    FEATURECLA:"Admin-0 capital",ADM0CAP:1,CAPALT:0,
    CAPITAL_CORRECTION_RU:c.note,CAPITAL_CORRECTION_URL:c.document,
    LOCATION_SOURCE_RU:"Координаты населённого пункта по OpenStreetMap/Mapcarta (приблизительно)",
    LOCATION_SOURCE_URL:"https://mapcarta.com/Ciudad_de_la_Paz"}});
 }
 return {...collection,features:items};
}

/** National capitals matched by actual country codes, not polygon centroids. */
export function capitalsForCountry(country:GeoFeature,places:readonly GeoFeature[]):GeoFeature[]{
 const p=country.properties??{};
 const iso=String(p.ISO_A2??p.ISO_A2_EH??"").toUpperCase();
 const a3=String(p.ADM0_A3??p.ISO_A3??"").toUpperCase();
 if(!/^[A-Z]{2}$/.test(iso)&&!/^[A-Z]{3}$/.test(a3))return [];
 return places.filter(place=>{
  if(!nationalCapital(place))return false;
  const q=place.properties??{};
  return /^[A-Z]{2}$/.test(iso)&&String(q.ISO_A2??"").toUpperCase()===iso||
   /^[A-Z]{3}$/.test(a3)&&String(q.ADM0_A3??"").toUpperCase()===a3;
 }).sort((a,b)=>cityRank(a)-cityRank(b)||
  (russianPlaceName(a)??"").localeCompare(russianPlaceName(b)??"","ru"));
}

export type CityCategory="all"|"capitals"|"regional"|"ordinary";
export function matchesCityCategory(feature:GeoFeature,category:CityCategory):boolean{
 if(category==="all")return true;
 if(category==="capitals")return nationalCapital(feature);
 const cls=String(feature.properties?.FEATURECLA??feature.properties?.featurecla??"");
 if(category==="regional")return /^Admin-(?:0 region|1(?: region)?) capital$/i.test(cls);
 return /^Populated place$/i.test(cls);
}
