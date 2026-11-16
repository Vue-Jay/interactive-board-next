import {geoFeatureName,isRussianAtlasName,type GeoFeature,type GeoCollection} from "./lektrusAtlasData";

/** Natural Earth snapshots use old names and sometimes omit a valid ISO_A2.
 * Check known historical aliases against the geographical location, not only ISO.
 */
export function isAstanaCapitalFeature(feature:GeoFeature):boolean{
 const p=feature.properties??{};
 const names=[p.NAME,p.name,p.NAME_RU,p.NAMEASCII,p.NAMEASCII_RU,p.NAMEALT_RU]
  .map(v=>String(v??"").trim());
 if(!names.some(v=>/^(?:nur[-–\s]?sultan|нур[-–\s]?султан|нұр[-–\s]?сұлтан|astana|астана)$/iu.test(v)))return false;
 const iso=String(p.ISO_A2??p.iso_a2??"").toUpperCase();
 const a3=String(p.ADM0_A3??p.adm0_a3??p.SOV_A3??"").toUpperCase();
 if(iso==="KZ"||a3==="KAZ")return true;
 if(feature.geometry?.type==="Point"&&Array.isArray(feature.geometry.coordinates)){
  const point=feature.geometry.coordinates as number[];
  return Math.abs(point[0]-71.43)<.6&&Math.abs(point[1]-51.17)<.6;
 }
 return false;
}
/** Exact Russian labels from the mapped source, not guessed translations. */
export function russianPlaceName(feature:GeoFeature):string|null{
 if(isAstanaCapitalFeature(feature))return "Астана";
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
  document:"https://www.gouv.bj/article/935/allons--ensemble-decouverte-communes-benin/"},
 {country:"LK",old:"Colombo",current:"Sri Jayawardenepura Kotte",rus:"Шри-Джаяварденепура-Котте",
  lon:79.91,lat:6.89,
  note:"Административная столица Шри-Ланки — Шри-Джаяварденепура-Котте; Коломбо — коммерческая столица.",
  document:"https://www.mfa.gov.lk/en/national-profile-and-geography"},
 {country:"NG",old:"Lagos",current:"Abuja",rus:"Абуджа",
  lon:7.49,lat:9.06,
  note:"Абуджа стала столицей Нигерии 12 декабря 1991 года вместо Лагоса.",
  document:"https://faan.gov.ng/international-airports/"},
 {country:"BI",old:"Bujumbura",current:"Gitega",rus:"Гитега",
  lon:29.92,lat:-3.43,
  note:"Политическая столица Бурунди с 2019 года — Гитега, экономическая столица — Бужумбура.",
  document:"https://primature.gov.bi/presentation-generale/"},
 {country:"CI",old:"Abidjan",current:"Yamoussoukro",rus:"Ямусукро",
  lon:-5.28,lat:6.82,
  note:"Политическая и административная столица Кот-д’Ивуара — Ямусукро, экономическая — Абиджан.",
  document:"https://onu.diplomatie.gouv.ci/?lang=en"}
] as const;
export const verifiedCapitalUpdates2026=CAPITAL_UPDATES;
const SOUTH_AFRICA_CAPITALS=[
 {name:"Pretoria",rus:"Претория",role:"Административная столица ЮАР",lon:28.19,lat:-25.75},
 {name:"Cape Town",rus:"Кейптаун",role:"Законодательная столица ЮАР",lon:18.42,lat:-33.92},
 {name:"Bloemfontein",rus:"Блумфонтейн",role:"Судебная столица ЮАР",lon:26.21,lat:-29.12}
] as const;
const SOUTH_AFRICA_SOURCE="https://www.gov.za/about-sa/south-africas-provinces";
const JUBA_SOURCE="https://data.un.org/legacy/en/iso/ss.html";
const ESWATINI_SOURCE="https://au.int/en/cities/lobambaroyal-and-legislative-mbabane-administrative";
const KIRIBATI_SOURCE="https://www.dfat.gov.au/geo/heads-of-government/kiribati";
export const NAURU_CAPITAL_NOTE={text:"У Науру нет официальной столицы. Органы правительства расположены в округе Ярен; его часто называют фактической столицей.",url:"https://www.dfat.gov.au/geo/heads-of-government/naoero"};
export function applyVerifiedCapitalUpdates2026(collection:GeoCollection):GeoCollection{
 // Features are never mutated; the same source may be used on multiple maps.
 const hasBairiki=collection.features.some(f=>String(f.properties?.ISO_A2??f.properties?.iso_a2)==="KI"&&String(f.properties?.NAME??f.properties?.name)==="Bairiki");
 const items=collection.features.map(feature=>{
  const p=feature.properties??{};
  const iso=String(p.ISO_A2??p.iso_a2??"").toUpperCase();
  const raw=String(p.NAME??p.name??"");
  if(iso==="SZ"&&(raw==="Mbabane"||raw==="Lobamba"))return {...feature,properties:{...p,
   NAME:raw,NAME_RU:raw==="Mbabane"?"Мбабане":"Лобамба",ADM0CAP:1,CAPALT:0,FEATURECLA:"Admin-0 capital",
   CAPITAL_CORRECTION_RU:raw==="Mbabane"?"Административная столица Эсватини":"Королевская и законодательная столица Эсватини",
   CAPITAL_CORRECTION_URL:ESWATINI_SOURCE}};
  if(iso==="KI"&&(raw==="Tarawa"||raw==="Bairiki"))return {...feature,properties:{...p,
   NAME_RU:hasBairiki&&raw==="Tarawa"?"Тарава":"Южная Тарава (Баирики)",
   ADM0CAP:hasBairiki&&raw==="Tarawa"?0:1,CAPALT:0,FEATURECLA:hasBairiki&&raw==="Tarawa"?"Populated place":"Admin-0 capital",
   CAPITAL_CORRECTION_RU:"Правительственный центр Кирибати — Баирики, часть Южной Таравы.",CAPITAL_CORRECTION_URL:KIRIBATI_SOURCE}};
  if(iso==="NR"&&raw==="Yaren")return {...feature,properties:{...p,ADM0CAP:0,CAPALT:0,FEATURECLA:"Populated place",
   CAPITAL_CORRECTION_RU:NAURU_CAPITAL_NOTE.text,CAPITAL_CORRECTION_URL:NAURU_CAPITAL_NOTE.url}};
  if((iso==="SS"||String(p.ADM0_A3??p.adm0_a3)==="SSD")&&raw==="Juba")return {...feature,properties:{...p,
   NAME:"Juba",NAME_RU:"Джуба",ISO_A2:"SS",ADM0_A3:"SSD",ADM0CAP:1,CAPALT:0,FEATURECLA:"Admin-0 capital",
   CAPITAL_CORRECTION_RU:"Столица Южного Судана по данным ООН — Джуба.",CAPITAL_CORRECTION_URL:JUBA_SOURCE}};
  const southAfrica=(iso==="ZA"||String(p.ADM0_A3??p.adm0_a3)==="ZAF")&&SOUTH_AFRICA_CAPITALS.find(c=>c.name===raw);
  if(southAfrica)return {...feature,properties:{...p,ISO_A2:"ZA",NAME:southAfrica.name,NAME_RU:southAfrica.rus,ADM0CAP:1,
   CAPALT:0,FEATURECLA:"Admin-0 capital",CAPITAL_CORRECTION_RU:southAfrica.role,
   CAPITAL_CORRECTION_URL:SOUTH_AFRICA_SOURCE}};
  if(iso==="ZA"&&raw==="Johannesburg")return {...feature,properties:{...p,ADM0CAP:0,CAPALT:0,
   FEATURECLA:"Populated place",CAPITAL_CORRECTION_RU:"Йоханнесбург — крупнейший город ЮАР, но не одна из трёх столиц.",
   CAPITAL_CORRECTION_URL:SOUTH_AFRICA_SOURCE}};
  if(isAstanaCapitalFeature(feature)){
   return {...feature,properties:{...p,NAME:"Astana",NAMEASCII:"Astana",
    NAME_RU:"Астана",NAME_ALT:"Нур-Султан",ADM0CAP:1,CAPALT:0,
    FEATURECLA:"Admin-0 capital",
    CAPITAL_CORRECTION_RU:"Столица Казахстана вновь называется Астана с 17 сентября 2022 года.",
    CAPITAL_CORRECTION_URL:"https://akorda.kz/ru/o-pereimenovanii-goroda-nur-sultana-stolicy-respubliki-kazahstan-v-gorod-astanu-stolicu-respubliki-kazahstan-1782457"}};
  }
  const relevant=CAPITAL_UPDATES.find(c=>c.country===iso&&(c.old===raw||c.current===raw));
  if(!relevant)return feature;
  const isNew=relevant.current===raw;
  return {...feature,properties:{...p,...(isNew?{NAME:relevant.current,NAME_RU:relevant.rus,ISO_A2:iso}:{}),ADM0CAP:isNew?1:0,CAPALT:0,
   FEATURECLA:isNew?"Admin-0 capital":"Populated place",
   CAPITAL_CORRECTION_RU:isNew||["BJ","LK","BI","CI"].includes(iso)?relevant.note:"Прежняя столица; актуальный статус изменён. "+relevant.note,
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
    LOCATION_SOURCE_RU:"Приблизительный центр города",
    ...(c.country==="GQ"?{LOCATION_SOURCE_URL:"https://mapcarta.com/Ciudad_de_la_Paz"}:{})}});
 }
 for(const c of SOUTH_AFRICA_CAPITALS){
  if(items.some(f=>f.properties?.ISO_A2==="ZA"&&f.properties?.NAME===c.name))continue;
  items.push({type:"Feature",geometry:{type:"Point",coordinates:[c.lon,c.lat]},properties:{
   NAME:c.name,NAME_RU:c.rus,ISO_A2:"ZA",ADM0_A3:"ZAF",ADM0CAP:1,CAPALT:0,
   FEATURECLA:"Admin-0 capital",CAPITAL_CORRECTION_RU:c.role,CAPITAL_CORRECTION_URL:SOUTH_AFRICA_SOURCE,
   LOCATION_SOURCE_RU:"Приблизительный центр города"}});
 }
 if(!items.some(f=>f.properties?.ISO_A2==="SS"&&f.properties?.NAME==="Juba"))items.push({type:"Feature",geometry:{type:"Point",coordinates:[31.58,4.85]},
  properties:{NAME:"Juba",NAME_RU:"Джуба",ISO_A2:"SS",ADM0_A3:"SSD",ADM0CAP:1,CAPALT:0,FEATURECLA:"Admin-0 capital",
   LOCATION_SOURCE_RU:"Приблизительный центр города",CAPITAL_CORRECTION_RU:"Столица Южного Судана по данным ООН — Джуба.",CAPITAL_CORRECTION_URL:JUBA_SOURCE}});
 for(const c of [{name:"Mbabane",rus:"Мбабане",role:"Административная столица Эсватини",lon:31.14,lat:-26.32},
  {name:"Lobamba",rus:"Лобамба",role:"Королевская и законодательная столица Эсватини",lon:31.20,lat:-26.45}]){
  if(!items.some(f=>f.properties?.ISO_A2==="SZ"&&f.properties?.NAME===c.name))items.push({type:"Feature",geometry:{type:"Point",coordinates:[c.lon,c.lat]},
   properties:{NAME:c.name,NAME_RU:c.rus,ISO_A2:"SZ",ADM0_A3:"SWZ",ADM0CAP:1,CAPALT:0,FEATURECLA:"Admin-0 capital",
    LOCATION_SOURCE_RU:"Приблизительный центр города",CAPITAL_CORRECTION_RU:c.role,CAPITAL_CORRECTION_URL:ESWATINI_SOURCE}});
 }
 if(!items.some(f=>f.properties?.ISO_A2==="NR"&&f.properties?.NAME==="Yaren"))items.push({type:"Feature",geometry:{type:"Point",coordinates:[166.92,-0.55]},
  properties:{NAME:"Yaren",NAME_RU:"Ярен",ISO_A2:"NR",ADM0_A3:"NRU",ADM0CAP:0,CAPALT:0,FEATURECLA:"Populated place",
   LOCATION_SOURCE_RU:"Приблизительный центр округа",CAPITAL_CORRECTION_RU:NAURU_CAPITAL_NOTE.text,CAPITAL_CORRECTION_URL:NAURU_CAPITAL_NOTE.url}});
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
