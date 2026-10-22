import {historicalSnapshots} from "./lektrusAtlasModel";

export type GeoPosition=[number,number];
export type GeoGeometry={type:"Polygon"|"MultiPolygon"|"LineString"|"MultiLineString"|"Point"|"MultiPoint";
 coordinates:unknown};
export type GeoFeature={type:"Feature";properties:Record<string,unknown>|null;geometry:GeoGeometry|null;bbox?:number[]};
export type GeoCollection={type:"FeatureCollection";features:GeoFeature[]};
export type GeoLayer="countries"|"countries-detail"|"countries-ultra"|"countries-russian"|"tiny-countries"|"land"|"coastline"|"rivers"|"lakes"|"cities"|"elevation"|"regions"|"glaciers"|"land-detail"|"coastline-detail"|"rivers-regional"|"lakes-regional"|"rivers-ultra"|"lakes-ultra"|"cities-regional"|"cities-local"|"admin-regional"|"admin-world-overview"|"admin-world-lines"|"regions-regional"|"elevation-regional"|"glaciers-regional"|"marine"|"physical-labels";
// Pin the dataset snapshots used by school lessons.
const BASE="https://raw.githubusercontent.com/nvkelso/natural-earth-vector/ca96624a56bd078437bca8184e78163e5039ad19/geojson/";
const BACKUP="https://cdn.jsdelivr.net/gh/nvkelso/natural-earth-vector@ca96624a56bd078437bca8184e78163e5039ad19/geojson/";
const HIST="https://raw.githubusercontent.com/aourednik/historical-basemaps/da7a4b735ecef70aebdc9c73e409d8a2500d50f3/geojson/";
const HIST_BACKUP="https://cdn.jsdelivr.net/gh/aourednik/historical-basemaps@da7a4b735ecef70aebdc9c73e409d8a2500d50f3/geojson/";
const names:Record<GeoLayer,string>={
 land:"ne_110m_land.geojson",
 coastline:"ne_110m_coastline.geojson",
 "land-detail":"ne_50m_land.geojson",
 "coastline-detail":"ne_50m_coastline.geojson",
 "rivers-regional":"ne_50m_rivers_lake_centerlines.geojson",
 "lakes-regional":"ne_50m_lakes.geojson",
 "rivers-ultra":"ne_10m_rivers_lake_centerlines.geojson",
 "lakes-ultra":"ne_10m_lakes.geojson",
 "cities-regional":"ne_50m_populated_places.geojson",
 "cities-local":"ne_10m_populated_places.geojson",
 "admin-regional":"ne_50m_admin_1_states_provinces.geojson",
 "admin-world-overview":"ne_50m_admin_1_states_provinces_lines.geojson",
 "admin-world-lines":"ne_10m_admin_1_states_provinces_lines.geojson",
 "regions-regional":"ne_50m_geography_regions_polys.geojson",
 "elevation-regional":"ne_50m_geography_regions_elevation_points.geojson",
 "glaciers-regional":"ne_50m_glaciated_areas.geojson",
 marine:"ne_50m_geography_marine_polys.geojson",
 "physical-labels":"ne_50m_geography_regions_points.geojson",
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
/** Conventional school names for objects present in the actual map source. */
const naturalNames:Record<string,string>={
 "Black Sea": "Чёрное море",
 "Caspian Sea": "Каспийское море",
 "Baltic Sea": "Балтийское море",
 "Azov Sea": "Азовское море",
 "Mediterranean Sea": "Средиземное море",
 "Red Sea": "Красное море",
 "White Sea": "Белое море",
 "Barents Sea": "Баренцево море",
 "Kara Sea": "Карское море",
 "Laptev Sea": "Море Лаптевых",
 "East Siberian Sea": "Восточно-Сибирское море",
 "Chukchi Sea": "Чукотское море",
 "Bering Sea": "Берингово море",
 "Okhotsk Sea": "Охотское море",
 "Sea of Japan": "Японское море",
 "North Sea": "Северное море",
 "Norwegian Sea": "Норвежское море",
 "Arabian Sea": "Аравийское море",
 "Coral Sea": "Коралловое море",
 "Caribbean Sea": "Карибское море",
 "Philippine Sea": "Филиппинское море",
 "Sargasso Sea": "Саргассово море",
 "Atlantic Ocean": "Атлантический океан",
 "Pacific Ocean": "Тихий океан",
 "Indian Ocean": "Индийский океан",
 "Arctic Ocean": "Северный Ледовитый океан",
 "Southern Ocean": "Южный океан",
 "Lake Baikal": "Байкал",
 "Baikal": "Байкал",
 "Lake Ladoga": "Ладожское озеро",
 "Lake Onega": "Онежское озеро",
 "Volga": "Волга",
 "Ob": "Обь",
 "Yenisei": "Енисей",
 "Lena": "Лена",
 "Amur": "Амур",
 "Don": "Дон",
 "Dnieper": "Днепр",
 "Danube": "Дунай",
 "Nile": "Нил",
 "Amazon": "Амазонка",
 "Mississippi": "Миссисипи",
 "Ural Mountains": "Уральские горы",
 "Caucasus Mountains": "Кавказские горы",
 "Greater Caucasus": "Большой Кавказ",
 "Alps": "Альпы",
 "Himalayas": "Гималаи",
 "Andes": "Анды",
 "Altai Mountains": "Алтайские горы",
 "Altai": "Алтай",
 "Sayan Mountains": "Саяны",
 "Tian Shan": "Тянь-Шань",
 "East European Plain": "Восточно-Европейская равнина",
 "West Siberian Plain": "Западно-Сибирская равнина",
 "Central Siberian Plateau": "Среднесибирское плоскогорье",
 "Gobi Desert": "пустыня Гоби",
 "Sahara": "Сахара",
 "Sahara Desert": "Сахара",
 "Arabian Peninsula": "Аравийский полуостров",
 "Kamchatka Peninsula": "полуостров Камчатка",
 "Crimean Peninsula": "Крымский полуостров",
 "Iberian Peninsula": "Пиренейский полуостров",
 "Bering Strait": "Берингов пролив",
 "Gibraltar Strait": "Гибралтарский пролив",
 "English Channel": "Ла-Манш",
 "Strait of Malacca": "Малаккский пролив"
};
Object.assign(naturalNames,{"Yenisey":"Енисей","Yenisei River":"Енисей","Volga River":"Волга","Lena River":"Лена","Ob River":"Обь","Ob'":"Обь","Irtysh":"Иртыш","Kama":"Кама","Angara":"Ангара","Pechora":"Печора","Northern Dvina":"Северная Двина","Oka":"Ока","Kolyma":"Колыма","Indigirka":"Индигирка","Aldan":"Алдан","Amur River":"Амур","Ussuri":"Уссури","Don River":"Дон","Nile River":"Нил","Congo":"Конго","Congo River":"Конго","Zambezi":"Замбези","Mekong":"Меконг","Ganges":"Ганг","Brahmaputra":"Брахмапутра","Huang He":"Хуанхэ","Yangtze":"Янцзы","Missouri":"Миссури","Parana":"Парана","Paraná":"Парана","Orinoco":"Ориноко","Rhine":"Рейн","Rhone":"Рона","Loire":"Луара","Seine":"Сена","Elbe":"Эльба","Vistula":"Висла","Dniester":"Днестр","Lake Victoria":"озеро Виктория","Lake Tanganyika":"озеро Танганьика","Lake Superior":"Верхнее озеро","Lake Michigan":"озеро Мичиган","Lake Huron":"озеро Гурон","Lake Erie":"озеро Эри","Lake Ontario":"озеро Онтарио","Aral Sea":"Аральское море","Lake Balkhash":"Балхаш","Lake Issyk-Kul":"Иссык-Куль"});
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
/** Translate only attested source names, without changing the historical
 * boundaries or treating a modern country as an ancient polity.
 * CLDR provides Russian equivalents for ISO 3166 country names, including
 * small and island states often absent from hand-maintained dictionaries. */
const englishCountryNames=new Intl.DisplayNames(["en"],{type:"region"});
const historicalCountryNames=(()=>{
 const names=new Map<string,string>();
 for(let first=65;first<=90;first++)for(let second=65;second<=90;second++){
  const iso=String.fromCharCode(first,second);
  const en=englishCountryNames.of(iso),ru=russianCountryNames.of(iso);
  if(en&&en!==iso&&ru&&ru!==iso&&/[А-ЯЁа-яё]/.test(ru)){
   names.set(en.toLocaleLowerCase("en"),ru);
  }
 }
 // Historical spellings and common English exonyms. These translate a name
 // only when it is actually present in the dated source.
 const aliases:Record<string,string>={
  "United States of America":"Соединённые Штаты Америки",
  "United States":"Соединённые Штаты Америки",
  "Russian Federation":"Российская Федерация",
  "Russia":"Россия",
  "United Kingdom of Great Britain and Northern Ireland":"Великобритания",
  "Great Britain":"Великобритания",
  "The Netherlands":"Нидерланды",
  "Czech Republic":"Чехия",
  "Republic of Korea":"Республика Корея",
  "South Korea":"Республика Корея",
  "Democratic People's Republic of Korea":"Корейская Народно-Демократическая Республика",
  "North Korea":"Корейская Народно-Демократическая Республика",
  "People's Republic of China":"Китайская Народная Республика",
  "Republic of China":"Китайская Республика",
  "Taiwan":"Тайвань",
  "Myanmar (Burma)":"Мьянма",
  "Burma":"Бирма",
  "Ivory Coast":"Кот-д'Ивуар",
  "Cote d'Ivoire":"Кот-д'Ивуар",
  "Democratic Republic of Congo":"Демократическая Республика Конго",
  "Democratic Republic of the Congo":"Демократическая Республика Конго",
  "Republic of Congo":"Республика Конго",
  "Republic of the Congo":"Республика Конго",
  "Cape Verde":"Кабо-Верде",
  "East Timor":"Восточный Тимор",
  "Swaziland":"Свазиленд",
  "Macedonia":"Македония",
  "North Macedonia":"Северная Македония",
  "Turkey":"Турция",
  "Syria":"Сирия",
  "Iran":"Иран",
  "Vietnam":"Вьетнам",
  "Viet Nam":"Вьетнам",
  "Laos":"Лаос",
  "Moldova":"Молдавия",
  "Kyrgyzstan":"Кыргызстан",
  "Kyrgyz Republic":"Кыргызстан",
  "Slovak Republic":"Словакия",
  "Federal Republic of Germany":"Федеративная Республика Германия",
  "West Germany":"Федеративная Республика Германия",
  "East Germany":"Германская Демократическая Республика",
  "German Democratic Republic":"Германская Демократическая Республика",
  "Czechoslovakia":"Чехословакия",
  "Czech and Slovak Federative Republic":"Чешская и Словацкая Федеративная Республика",
  "Yugoslavia":"Югославия",
  "Federal Republic of Yugoslavia":"Союзная Республика Югославия",
  "Socialist Federal Republic of Yugoslavia":"Социалистическая Федеративная Республика Югославия",
  "Serbia and Montenegro":"Сербия и Черногория",
  "Zaire":"Заир",
  "Upper Volta":"Верхняя Вольта",
  "Rhodesia":"Родезия",
  "South Vietnam":"Южный Вьетнам",
  "North Vietnam":"Северный Вьетнам",
  "Tanganyika":"Танганьика",
  "French West Africa":"Французская Западная Африка",
  "British India":"Британская Индия",
  "Austro-Hungarian Empire":"Австро-Венгрия",
  "Austria-Hungary":"Австро-Венгрия",
  "Soviet Union":"СССР",
  "Union of Soviet Socialist Republics":"СССР",
  "USSR":"СССР"
 };
 for(const [name,translation] of Object.entries(aliases))names.set(name.toLocaleLowerCase("en"),translation);
 return names;
})();
export function historicalCountryName(rawName:string):string{
 const source=rawName.trim();
 if(!source||source.length>110)return "";
 if(/[А-ЯЁа-яё]/.test(source))return source;
 return historicalCountryNames.get(source.toLocaleLowerCase("en"))??"";
}

/** Only real, meaningful Russian proper names may appear on the map.
 * Unnamed / placeholder entries must not acquire invented titles. */
const atlasUnnamed=/^(?:unknown|unnamed|no[ -]?name|name[ -]?unknown|none|null|undefined|n.a|not applicable|unassigned|untitled|без названия|неизвестно|объект без названия|безымянн(?:ый|ая|ое)|[-?.\s]+)$/i;
export function isRussianAtlasName(value:unknown):value is string{
 return typeof value==="string"&&value.trim().length>1&&
  /[А-ЯЁа-яё]/.test(value)&&!atlasUnnamed.test(value.trim());
}
/** Read all documented Russian name fields before consulting school-name dictionaries.
 * No English fallback or nation-name substitution for anonymous city / admin units. */
export function geoFeatureName(feature:GeoFeature):string{
 const p=feature.properties??{};
 for(const key of ["NAME_RU","NAME_ru","name_ru","name_rus","NAME_RUS","NAME_RUSSIAN","name_russian","NAME_CYR","NAMEALT_RU"]){
  if(isRussianAtlasName(p[key]))return String(p[key]).trim();
 }
 const sourceNames=["NAME","NAMEASCII","NAME_EN","GEONAME","NAME_LONG","ADMIN","name","name_en","NAMEALT"];
 for(const key of sourceNames){
  const raw=p[key];
  if(typeof raw!=="string"||!raw.trim()||atlasUnnamed.test(raw.trim()))continue;
  const candidate=raw.trim();
  const school=historicNames[candidate]??naturalNames[candidate];
  if(isRussianAtlasName(candidate))return candidate;
  if(isRussianAtlasName(school))return school;
 }
 // Translate ISO names only for actual country polygons. Admin-1 regions and
 // point settlements also carry their country's ISO code: it is NOT their name.
 const g=feature.geometry?.type??"";
 const isCountry=(g==="Polygon"||g==="MultiPolygon")&&
  (typeof p.SOVEREIGNT==="string"||typeof p.ADMIN==="string")&&
  p.adm1_code===undefined&&p.ADM1_CODE===undefined;
 const iso=String(p.ISO_A2??p.ISO_A2_EH??"").toUpperCase();
 if(isCountry&&/^[A-Z]{2}$/.test(iso)){
  const localized=russianCountryNames.of(iso);
  if(isRussianAtlasName(localized))return localized;
 }
 return "";
}
/** Never discard a real historical territory because its label lacks a
 * Russian translation. Source coverage and localization are separate concerns. */
export function historicalMapFeatures(source:GeoCollection|null):GeoFeature[]{
 return source?.features.filter(feature=>feature.geometry?.type==="Polygon"||
  feature.geometry?.type==="MultiPolygon")??[];
}
export const hasAtlasName=(feature:GeoFeature)=>geoFeatureName(feature).length>0;
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
 if(year===2026)return loadAtlasLayer("countries-russian"); // contemporary Russian POV, not a dated historical snapshot
 const found=historicalSnapshots.find(s=>s.year===year);
 if(!found)return Promise.reject(new Error("Исторического снимка на этот год нет"));
 return requestGeojson("historical-"+year,[HIST+found.file,HIST_BACKUP+found.file]);
}
/** Lightweight per-year name index supplied by Historical Basemaps.
 * A name appearing on a dated map does NOT establish founding/dissolution dates. */
export type HistoricalIndexRecord={year:number;filename:string;countries:string[]};
let indexPromise:Promise<HistoricalIndexRecord[]>|null=null;
export function loadHistoricalIndex():Promise<HistoricalIndexRecord[]>{
 if(indexPromise)return indexPromise;
 indexPromise=(async()=>{
  let failure="";
  for(const url of [
   "https://raw.githubusercontent.com/aourednik/historical-basemaps/da7a4b735ecef70aebdc9c73e409d8a2500d50f3/index.json",
   "https://cdn.jsdelivr.net/gh/aourednik/historical-basemaps@da7a4b735ecef70aebdc9c73e409d8a2500d50f3/index.json"
  ]){
   const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),16000);
   try{
    const response=await fetch(url,{signal:controller.signal,cache:"force-cache",mode:"cors"});
    if(!response.ok)throw new Error("HTTP "+response.status);
    const json:unknown=await response.json();
    const list=(json&&typeof json==="object"&&"years" in json)?
     (json as {years:unknown}).years:undefined;
    if(!Array.isArray(list))throw new Error("Неправильный формат справочника");
    const available=new Map<number,string>(historicalSnapshots.map(s=>[s.year,s.file]));
    const rows:HistoricalIndexRecord[]=[];
    for(const row of list){
     if(!row||typeof row!=="object")continue;
     const item=row as Partial<HistoricalIndexRecord>;
     if(typeof item.year!=="number"||typeof item.filename!=="string"||
      !Array.isArray(item.countries)||item.countries.length>20000||
      item.countries.some(name=>typeof name!=="string"||name.length>160))continue;
     if(available.get(item.year)!==item.filename||item.year===2026)continue;
     rows.push({year:item.year,filename:item.filename,
      countries:[...new Set(item.countries.filter(name=>name.trim()))]});
    }
    if(rows.length<35)throw new Error("Неполный индекс периодов");
    return rows.sort((a,b)=>a.year-b.year);
   }catch(e){failure=e instanceof Error?e.message:String(e)}
   finally{clearTimeout(timer)}
  }
  throw new Error("Индекс исторических наименований недоступен: "+failure);
 })().catch(e=>{indexPromise=null;throw e});
 return indexPromise;
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
export type MapWindow={left:number;right:number;top:number;bottom:number};
function pathForRing(points:number[][],close:boolean,minDistance=.62,viewport?:MapWindow):string{
 if(points.length<2)return "";
 const valid=points.filter(p=>Array.isArray(p)&&Number.isFinite(p[0])&&Number.isFinite(p[1]))
  .map(p=>[Math.max(-180,Math.min(180,p[0])),Math.max(-90,Math.min(90,p[1]))]);
 if(valid.length<2)return "";
 if(viewport){
  let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;
  for(const [lon,lat] of valid){
   const [x,y]=projectGeography(lon,lat);
   minX=Math.min(minX,x);maxX=Math.max(maxX,x);
   minY=Math.min(minY,y);maxY=Math.max(maxY,y);
  }
  if(maxX<viewport.left||minX>viewport.right||maxY<viewport.top||minY>viewport.bottom)return "";
 }
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
// Cached geographic extents let us reject offscreen geometries BEFORE their
// potentially tens of thousands of vertices are projected into SVG paths.
const extentMemo=new WeakMap<GeoFeature,[number,number,number,number]>();
function geographicExtent(f:GeoFeature):[number,number,number,number]{
 const cached=extentMemo.get(f);if(cached)return cached;
 if(f.bbox?.length===4&&f.bbox.every(Number.isFinite)){
  const b=f.bbox as [number,number,number,number];extentMemo.set(f,b);return b;
 }
 let west=Infinity,east=-Infinity,south=Infinity,north=-Infinity;
 const traverse=(value:unknown):void=>{
  if(!Array.isArray(value))return;
  if(value.length>=2&&typeof value[0]==="number"&&typeof value[1]==="number"){
   const lon=value[0],lat=value[1];
   if(Number.isFinite(lon)&&Number.isFinite(lat)){
    west=Math.min(west,lon);east=Math.max(east,lon);
    south=Math.min(south,lat);north=Math.max(north,lat);
   }
  }else for(const child of value)traverse(child);
 };
 traverse(f.geometry?.coordinates);
 const result:[number,number,number,number]=[west,south,east,north];
 extentMemo.set(f,result);return result;
}
export function featureIntersectsViewport(f:GeoFeature,view:MapWindow):boolean{
 const [west,south,east,north]=geographicExtent(f);
 if(!Number.isFinite(west))return false;
 const left=(west+180)*2.5,right=(east+180)*2.5;
 const top=(90-north)*2.5,bottom=(90-south)*2.5;
 return right>=view.left&&left<=view.right&&bottom>=view.top&&top<=view.bottom;
}
export function mapFeaturePath(f:GeoFeature,minDistance=.62,viewport?:MapWindow):string{
 if(viewport&&!featureIntersectsViewport(f,viewport))return "";
 const all:string[]=[];
 if(f.geometry?.type==="Polygon"||f.geometry?.type==="MultiPolygon"){
  for(const multi of polygons(f))for(const ring of multi){
   const p=pathForRing(ring,true,minDistance,viewport);
   if(p)all.push(p);
  }
 }else for(const line of lines(f)){
  const p=pathForRing(line,false,minDistance,viewport);
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
/** A river label at half the length of the longest component.
 * The function uses source coordinates and avoids invented river centres. */
export function featureLineMidpoint(feature:GeoFeature):GeoPosition|null{
 const paths=lines(feature);
 if(!paths.length)return featureMapPoint(feature);
 let longest:GeoPosition[]=[];let maximum=0;
 for(const line of paths){
  const points=line.filter(p=>p.length>=2&&Number.isFinite(p[0])&&Number.isFinite(p[1]))
   .map(p=>projectGeography(p[0],p[1]));
  if(points.length<2)continue;
  let distance=0;
  for(let i=1;i<points.length;i++){
   const dx=Math.abs(points[i][0]-points[i-1][0]);
   if(dx>450)continue;
   distance+=Math.hypot(dx,points[i][1]-points[i-1][1]);
  }
  if(distance>maximum){maximum=distance;longest=points}
 }
 if(maximum<=0)return null;
 const half=maximum/2;let travelled=0;
 for(let i=1;i<longest.length;i++){
  const a=longest[i-1],b=longest[i];
  const dx=Math.abs(b[0]-a[0]);if(dx>450)continue;
  const segment=Math.hypot(dx,b[1]-a[1]);
  if(travelled+segment>=half){
   const t=(half-travelled)/Math.max(1e-9,segment);
   return [a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t];
  }
  travelled+=segment;
 }
 return longest[Math.floor(longest.length/2)]??null;
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
/** Only standard category values are translated; unknown values are retained
 * as source metadata rather than replaced by an imagined classification. */
const localizedFeatureClasses:Record<string,string>={
 "Admin-0 capital":"Столица государства",
 "Admin-0 capital alt":"Альтернативная столица государства",
 "Admin-0 region capital":"Столица территории",
 "Admin-1 capital":"Административный центр региона",
 "Admin-1 region capital":"Административный центр региона",
 "Populated place":"Населённый пункт",
 "Scientific station":"Научная станция",
 "River":"Река","Lake":"Озеро","Reservoir":"Водохранилище",
 "Lake Centerline":"Ось водоёма","Marine Area":"Морская акватория",
 "mountain":"Горная вершина","depression":"Низменность",
 "glacier":"Ледник","Glacier":"Ледник",
 "Range/mtn":"Горная система","Plateau":"Плоскогорье",
 "Plain":"Равнина","Desert":"Пустыня",
 "Admin-0 country":"Государство","Admin-1 state":"Административная единица"
};
const continentSchoolNames:Record<string,string>={
 "Africa":"Африка","Asia":"Азия","Europe":"Европа",
 "North America":"Северная Америка","South America":"Южная Америка",
 "Oceania":"Океания","Antarctica":"Антарктида",
 "Seven seas (open ocean)":"Мировой океан",
 "Central Asia":"Центральная Азия","Eastern Asia":"Восточная Азия",
 "Western Asia":"Западная Азия","South Asia":"Южная Азия",
 "Southeast Asia":"Юго-Восточная Азия","Northern Europe":"Северная Европа",
 "Southern Europe":"Южная Европа","Eastern Europe":"Восточная Европа",
 "Western Europe":"Западная Европа","Northern Africa":"Северная Африка",
 "Eastern Africa":"Восточная Африка","Western Africa":"Западная Африка",
 "Central Africa":"Центральная Африка","Southern Africa":"Южная Африка",
 "Middle Africa":"Центральная Африка","Central America":"Центральная Америка",
 "Caribbean":"Карибский регион","Australia and New Zealand":"Австралия и Новая Зеландия",
 "Melanesia":"Меланезия","Micronesia":"Микронезия","Polynesia":"Полинезия"
};
export function featureSourceFacts(feature:GeoFeature):Array<{label:string;value:string}>{
 const p=feature.properties??{};
 const fields:[string,string][]=[
  ["ELEVATION","Высота, м"],["ELEV","Высота, м"],
  ["POP_MAX","Население (оценка источника)"],["POP_MIN","Население (минимальная оценка)"],
  ["SOVEREIGNT","Суверенное государство в источнике"],["ADM0NAME","Страна в источнике"],
  ["FEATURECLA","Категория"],["FEATURECLASS","Категория"]];
 const result:Array<{label:string;value:string}>=[];
 const population=Number(p.POP_EST??p.pop_est);
 if(Number.isFinite(population)&&population>0){
  const year=Number(p.POP_YEAR??p.pop_year);
  result.push({label:"Население (оценка картографического источника)",
   value:Math.round(population).toLocaleString("ru-RU")+
    (Number.isFinite(year)&&year>1900&&year<=2100?" ("+year+" г.)":" (год не указан)")});
 }
 for(const [property,label] of [["CONTINENT","Часть света"],["SUBREGION","Регион мира"],["REGION_UN","Регион ООН"]] as const){
  const value=String(p[property]??"");
  if(continentSchoolNames[value])result.push({label,value:continentSchoolNames[value]});
 }
 const gdp=Number(p.GDP_MD??p.gdp_md);
 if(Number.isFinite(gdp)&&gdp>0&&gdp<1e10){
  const year=Number(p.GDP_YEAR??p.gdp_year);
  result.push({label:"ВВП (оценка источника)",value:gdp.toLocaleString("ru-RU")+
   " млн долл. США"+(Number.isFinite(year)&&year>1900&&year<=2100?" ("+year+" г.)":" (год не указан)")});
 }
 if(typeof p.CAPITAL_CORRECTION_RU==="string")
  result.push({label:"Уточнение столицы",value:p.CAPITAL_CORRECTION_RU});
 if(typeof p.LOCATION_SOURCE_RU==="string")
  result.push({label:"Точность координат",value:p.LOCATION_SOURCE_RU});
 const seen=new Set<string>();
 for(const [key,label] of fields){
  const value=p[key];
  if((typeof value==="string"&&value.trim()!==""||
   typeof value==="number"&&Number.isFinite(value))&&!seen.has(label)){
   let display=String(value).trim();
   if(key==="FEATURECLA"||key==="FEATURECLASS"){
    // An unknown English source category is metadata, not a translated legend.
    display=localizedFeatureClasses[display]??"";
   }else if(key==="ADM0NAME"||key==="SOVEREIGNT"){
    // Do not confuse a dependent territory's ISO code with its sovereign state.
    display=geoFeatureName({type:"Feature",geometry:null,properties:{NAME:display}});
   }
   // The map, selection card and export must never show untranslated
   // source-place names or opaque source category codes as Russian labels.
   if(!display||(typeof value==="string"&&!isRussianAtlasName(display)&&
     key!=="ELEVATION"&&key!=="ELEV"&&key!=="POP_MAX"&&key!=="POP_MIN"))continue;
   result.push({label,value:display});seen.add(label);
  }
 }
 return result;
}

export function summariseNamedChanges(prev:GeoCollection,next:GeoCollection){
 const names=(geo:GeoCollection)=>new Set(geo.features.map(geoFeatureName).filter(Boolean));
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
  if(typeof value==="number"&&Number.isFinite(value))
   return [{label,value:String(value)}];
  if(typeof value!=="string"||!value.trim())return [];
  if(key==="NAME"||key==="SUBJECTO"||key==="PARTOF"||key==="CAPITAL"){
   const translated=geoFeatureName({type:"Feature",properties:{NAME:value},geometry:null});
   return translated?[{label,value:translated}]:[];
  }
  // Retain a source description only if it is already written in Russian.
  return isRussianAtlasName(value)?[{label,value:value.slice(0,320)}]:[];
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
  let lo=Infinity,hi=-Infinity,latMin=Infinity,latMax=-Infinity;
  for(const p of ring){
   if(!Number.isFinite(p[0])||!Number.isFinite(p[1]))continue;
   lo=Math.min(lo,p[0]);hi=Math.max(hi,p[0]);
   latMin=Math.min(latMin,p[1]);latMax=Math.max(latMax,p[1]);
  }
  if(!Number.isFinite(lo)||!Number.isFinite(latMin)||hi-lo>180)continue;
  const x0=projectGeography(lo,0)[0],x1=projectGeography(hi,0)[0];
  const y0=projectGeography(0,latMax)[1],y1=projectGeography(0,latMin)[1];
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
