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
 (v as GeoCollection).features.every(f=>f?.type==="Feature"&&(f.geometry===null||!!f.geometry))&&
 (v as GeoCollection).features.some(f=>!!f.geometry);
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
    // GeoJSON explicitly permits null geometry. Natural Earth's 10m admin-1
    // lines contain one such New Zealand record; rejecting the whole dataset
    // would discard thousands of genuine borders. Never invent its line.
    const drawable={...body,features:body.features.filter(f=>f.geometry!==null)};
    const corrected=key==="modern-countries-russian"?correctModernTerritoryLabels(drawable):drawable;
    cache.set(key,corrected);
    // Keep memory bounded. Slow phones should not hold decades of geometry.
    if(cache.size>8)cache.delete(cache.keys().next().value!);
    return corrected;
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
  "Antigua and Barbuda":"Антигуа и Барбуда",
  "Bosnia and Herzegovina":"Босния и Герцеговина",
  "Byelarus":"Беларусь",
  "Congo":"Республика Конго",
  "Gambia, The":"Гамбия",
  "Korea, Democratic People's Republic of":"Корейская Народно-Демократическая Республика",
  "Korea, Republic of":"Республика Корея",
  "Netherlands Antilles":"Нидерландские Антильские острова",
  "Rapa Nui":"Рапа-Нуи (остров Пасхи)",
  "Saint Barthelemy":"Сен-Бартелеми",
  "Saint Kitts and Nevis":"Сент-Китс и Невис",
  "Saint Lucia":"Сент-Люсия",
  "Saint Martin":"Сен-Мартен",
  "Saint Vincent and the Grenadines":"Сент-Винсент и Гренадины",
  "Tanzania, United Republic of":"Танзания",
  "Trinidad":"Тринидад",
  "Turkish Cypriot-administered area":"Территория под управлением турок-киприотов",
  "Turks and Caicos Islands":"Теркс и Кайкос",
  "United States Virgin Islands":"Американские Виргинские острова",
  "Wallis and Futuna Islands":"Уоллис и Футуна",
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
/** Original historical names can be browsed before a Russian translation has
 * been verified. This is not a name to draw as a Russian map label. */
export function historicalSourceName(value:unknown):string{
 if(typeof value!=="string")return "";
 const name=value.trim();
 return name.length>1&&name.length<=160&&!atlasUnnamed.test(name)?name:"";
}
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
// Exact identities from the pinned RUS 2022 file. Its eight intentionally
// unnamed polygons are geographical records, not additional sovereign states.
// Require the exact archive code AND bbox before projecting a label onto them.
type ModernTerritoryRecord={label?:string;bbox?:number[];note:string;url:string};
const unGeorgia="https://www.un.org/pga/80/2026/06/04/pga-remarks-at-an-annual-meeting-on-guam-status-of-internally-displaced-persons-and-refugees-from-abkhazia-georgia-and-the-tskhinvali-region-south-ossetia-georgia/";
const unUkraine="https://digitallibrary.un.org/record/3990400";
const brazilUruguay="https://funag.gov.br/loja/download/685-O_estatuto_da_fronteira_brasil_uruguai.pdf";
const southChinaArbitration="https://pca-cpa.org/en/cases/7/";
const modernArchiveTerritories:Record<string,ModernTerritoryRecord>={
 B38:{label:"Нагорный Карабах (архивный контур)",bbox:[46.291365,39.538156,47.203353,40.412728],note:"Архивный контур района Нагорного Карабаха, не независимое государство и не линия контроля на 2026 г. После событий сентября 2023 г. Международный суд ООН обязал Азербайджан обеспечить безопасное возвращение и выезд жителей.",url:"https://api.icj-cij.org/sites/default/files/press-releases/0/000-20240722-sta-01-00-en.pdf"},
 C03:{label:"Луганская область (архивный участок)",bbox:[38.255732,47.811527,39.993248,48.705613],note:"Один архивный участок карты 2022 г., а не вся Луганская область или актуальная линия контроля. Резолюция ГА ООН ES-11/4 не признаёт изменение международно признанных границ Украины.",url:unUkraine},
 C02:{label:"Донецкая область (архивный участок)",bbox:[37.49331,47.026353,39.055529,48.454614],note:"Один архивный участок карты 2022 г., а не вся Донецкая область или актуальная линия контроля. Резолюция ГА ООН ES-11/4 не признаёт изменение международно признанных границ Украины.",url:unUkraine},
 "-99":{label:"Южное Патагонское ледниковое плато",bbox:[-73.588036,-49.759959,-73.057424,-49.272754],note:"Участок Южного Патагонского ледникового поля, идентифицирован по совпадающей геометрии нейтральной версии Natural Earth. Аргентина и Чили заключили соглашение о линии границы в 1998 г.; архивный участок не определяет суверенитет.",url:"https://www.argentina.gob.ar/normativa/nacional/resoluci%C3%B3n-142-2018-307629/texto"},
 B92:{label:"Ринкон-де-Артигас (архивный участок)",bbox:[-56.02239,-31.082443,-55.816728,-30.856161],note:"Участок на границе Бразилии и Уругвая; картографическое сопоставление не разрешает разногласия по прохождению границы.",url:brazilUruguay},
 PFA:{label:"Парасельские острова",bbox:[111.192882,15.775377,112.736827,16.933254],note:"Архипелаг в Южно-Китайском море. Вьетнам заявляет права на Хоангша (Парасельские острова), находящиеся под контролем Китая. Архивный контур не является решением вопроса о суверенитете.",url:"https://mofa.gov.vn/web/ministry-of-foreign-affairs/detail/chi-tiet/the-announcement-of-the-spokesperson-of-the-ministry-of-foreign-affairs-of-viet-nam-pham-thu-hang-on-viet-nam-s-position-concerning-china-s-invasion-of-the-hoang-sa-paracel-islands-in-1974--51.html"},
 DEN:{label:"Остров Ханса (Тартупалук)",bbox:[-66.377919,80.820258,-66.297963,80.832831],note:"Канада и Дания подписали соглашение о разделении острова в июне 2022 г. По материалам правительства Канады от 16 июня 2026 г. работа над условиями доступа продолжалась в ожидании ратификации. Контур предшествует соглашению.",url:"https://international.canada.ca/en/global-affairs/corporate/transparency/briefing-documents/parliamentary-committee/2026-06-16-faae"},
 KOD:{label:"Скалы Лианкур (Токто / Такэсима)",bbox:[131.860148,37.241606,131.862522,37.244006],note:"Островки находятся под управлением Республики Корея (Токто); Япония предъявляет претензии (Такэсима). Подпись не выражает признания претензий какой-либо стороны.",url:"https://www.mofa.go.jp/region/asia-paci/takeshima/"},
 PGA:{label:"Острова Спратли",bbox:[114.02768,9.679511,115.848806,11.117987],note:"Архипелаг в Южно-Китайском море. Арбитраж 2016 г. касался морских прав и статуса отдельных объектов, а не определения суверенитета над островами. В архиве ошибочно записано Уэйк; это другой остров на Тихом океане.",url:southChinaArbitration},
 SAH:{note:"Западная Сахара включена ООН в список несамоуправляющихся территорий. Отдельный контур не означает признания окончательного суверенитета.",url:"https://www.un.org/dppa/decolonization/en/nsgt"},
 B35:{note:"Абхазия: де-факто отдельная администрация; ООН подтверждает территориальную целостность Грузии в международно признанных границах. Контур не определяет юридический статус.",url:unGeorgia},
 B37:{note:"Южная Осетия: де-факто отдельная администрация; ООН подтверждает территориальную целостность Грузии в международно признанных границах. Контур не определяет юридический статус.",url:unGeorgia},
 BRI:{note:"Остров Бразилера у устья реки Куараи; Бразилия и Уругвай расходятся в трактовке принадлежности острова.",url:brazilUruguay},
 BRT:{note:"Бир-Тавиль — участок между Египтом и Суданом. Обозначение в Natural Earth не является юридическим подтверждением отсутствия суверенитета.",url:"https://www.naturalearthdata.com/downloads/10m-cultural-vectors/10m-admin-0-breakaway-disputed-areas/"},
 ATA:{note:"Антарктида не является государством. Статья IV Договора об Антарктике сохраняет позиции сторон по территориальным претензиям и запрещает новые или расширенные претензии во время действия договора.",url:"https://www.ats.aq/e/peaceful.html"},
 IOA:{note:"Архивная объединённая запись острова Рождества и Кокосовых (Килинг) островов. Это две отдельные внешние территории Австралии, а не одно государство.",url:"https://www.ga.gov.au/scientific-topics/national-location-information/geography/external-territories"},
 SGS:{note:"Южная Георгия и Южные Сандвичевы острова управляются Великобританией; Аргентина заявляет права на них. Контур не разрешает спор о суверенитете.",url:"https://treaties.un.org/Pages/ViewDetails.aspx?chapter=19&clang=_en&mtdsg_no=XIX-41-a&src=IND"},
 FLK:{note:"Фолклендские (Мальвинские) острова — несамоуправляющаяся территория в списке ООН, управляемая Великобританией; существует спор о суверенитете с Аргентиной.",url:"https://www.un.org/dppa/decolonization/en/content/falkland-islands-malvinas"},
 CSI:{note:"Острова Кораллового моря — внешняя территория Австралии; разрозненные рифы и островки не следует считать сплошной сушей.",url:"https://www.ga.gov.au/scientific-topics/national-location-information/dimensions/remote-offshore-territories/coral-sea-islands"},
 SCR:{note:"Риф Скарборо (Скарборо-Шол) — спорный морской объект. Арбитраж 2016 г. не определял суверенитет над ним.",url:southChinaArbitration},
 FRA:{note:"Архивный полигон включает Французскую Гвиану, а источник ООН M49 выделяет её отдельно. Статистическая площадь Франции не обязана совпадать с контуром, включающим заморскую территорию.",url:"https://unstats.un.org/unsd/methodology/m49/overview"},
 NOR:{note:"Архивный полигон включает Шпицберген и Ян-Майен. Статистическое управление Норвегии отдельно учитывает основную территорию, Шпицберген и Ян-Майен; их площади нельзя сравнивать без одинакового охвата.",url:"https://www.ssb.no/en/natur-og-miljo/areal/statistikk/areal-av-land-og-ferskvatn"},
 SRB:{note:"Архивный контур включает Косово, в другой картографической базе оно выделено отдельно. Резолюция Совета Безопасности ООН 1244 определяет мандат международного присутствия; сравнение полигонов не устанавливает окончательный статус.",url:"https://digitallibrary.un.org/record/274488?ln=en"},
 GEO:{note:"В архивной геометрии Абхазия и Южная Осетия выделены из контура Грузии. ООН подтверждает территориальную целостность Грузии в международно признанных границах; контуры отражают разные картографические подходы.",url:unGeorgia},
};
function modernArchiveTerritory(feature:GeoFeature):ModernTerritoryRecord|undefined{
 if(!["Polygon","MultiPolygon"].includes(feature.geometry?.type??""))return undefined;
 const p=feature.properties??{},code=String(p.ADM0_A3??p.ADM0_A3_RU??"");
 if(!Object.hasOwn(modernArchiveTerritories,code))return undefined;
 const record=modernArchiveTerritories[code];
 if(!record)return undefined;
 if(record.bbox&&(!feature.bbox||feature.bbox.length!==4||!record.bbox.every((value,i)=>Math.abs(value-feature.bbox![i])<1e-6)))return undefined;
 return record;
}
export function correctModernTerritoryLabels(collection:GeoCollection):GeoCollection{
 return {...collection,features:collection.features.map(f=>{
  if(f.properties?.ATLAS_MODERN_TERRITORY_LABEL===true)return f;
  const record=modernArchiveTerritory(f);
  if(!record?.label)return f;
  const p=f.properties??{};
  // Preserve raw source identity, but never request unrelated Wake Island facts.
  return {...f,properties:{...p,ATLAS_ORIGINAL_NAME_RU:p.NAME_RU??null,NAME_RU:record.label,
   ...(p.ADM0_A3==="PGA"?{ATLAS_ORIGINAL_WIKIDATAID:p.WIKIDATAID,ATLAS_ORIGINAL_NAME_EN:p.NAME_EN,WIKIDATAID:null,NAME_EN:"Spratly Islands"}:{}),
   ATLAS_MODERN_TERRITORY_LABEL:true}};
 })};
}
/** Dated corrections for the modern overview. Do not apply to historical
 * shapes or change geometry in the absence of an authoritative new layer. */
export function modernAtlasTerritoryUpdate(feature:GeoFeature):{note:string;url:string}|undefined{
 if(!["Polygon","MultiPolygon"].includes(feature.geometry?.type??""))return undefined;
 const code=String(feature.properties?.ADM0_A3??"");
 const reviewed=modernArchiveTerritory(feature);
 if(reviewed)return {note:reviewed.note,url:reviewed.url};
 if(code==="VAT")return {
  note:"Территория Ватикана — 0,44 км² по данным государства. Контур Natural Earth 2022 г. является крайне условным (около 0,012 км² при сравнении в равновеликой проекции); непригоден для точного определения границы. Экстерриториальные объекты Святого Престола не следует считать территорией Ватикана.",
  url:"https://www.vaticanstate.va/en/state-and-government/general-informations/geography.html"};
 if(code==="MCO")return {
  note:"Площадь суши Монако — 2,08 км² по справке ЕС за 2026 г. Архивный контур Natural Earth (около 18,84 км²) сильно преувеличивает размеры государства; необходима замена на согласованную геометрию границы с Францией и береговой линии.",
  url:"https://data.consilium.europa.eu/doc/document/WK-3179-2026-INIT/en/pdf"};
 if(code==="SGP")return {
  note:"Площадь суши Сингапура в июне 2026 г. составляет 745,1 км² по кадастровым данным Singapore Land Authority. Намыв территорий изменяет береговую линию; архивная карта 2022 г. не подтверждает её современное положение.",
  url:"https://data.gov.sg/datasets/d_d5472d7368d6547892138f779872bbff/view"};
 if(code==="KGZ"||code==="TJK")return {
  note:"13 марта 2025 г. Кыргызстан и Таджикистан подписали договор о государственной границе. 14 июля 2026 г. началась совместная установка первых пограничных столбов. Архивный контур Natural Earth 2022 г. не подтверждает новую договорную линию.",
  url:"https://www.gov.kg/index.php/ru/post/s/26456-kyrgyzstan-menen-tazikstandyn-mamlekettik-cek-arasyn-demarkaciyaloo-isterinin-alkagynda-algacky-cek-ara-mamycalaryn-ornotuu-bastaldy"};
 if(code==="IOT"||code==="MUS")return {
  note:"Архипелаг Чагос: Великобритания и Маврикий подписали соглашение о суверенитете 22 мая 2025 г. По ответу правительства Великобритании от 6 ноября 2026 г. соглашение ещё не реализовано; архивный контур не заменяет описание спорного статуса.",
  url:"https://questions-statements.parliament.uk/written-questions/detail/2026-10-19/35838"};
 if(code==="ARM"||code==="AZE")return {
  note:"15 мая 2024 г. комиссии Армении и Азербайджана согласовали описания четырёх участков государственной границы по геодезическим измерениям. Архивный контур 2022 г. не является подтверждением линии после этой делимитации.",
  url:"https://www.mfa.am/en/press-releases/2024/05/15/arm_az/12644"};
 if(code==="RUS"||code==="UKR")return {
  note:"Архивный слой от 2 июня 2022 г. предшествует решениям России от сентября 2022 г. о статусе Донецкой, Луганской, Запорожской и Херсонской областей. Генеральная Ассамблея ООН в резолюции ES-11/4 от 12 октября 2022 г. не признала изменение международно признанных границ Украины. Картографическая позиция и фактический контроль территорий не равнозначны международному признанию.",
  url:"https://digitallibrary.un.org/record/3990400"};
 return undefined;
}
export const borderPrecision=(f:GeoFeature):number=>{
 if(f.properties?.ATLAS_HISTORICAL_LABEL)return 1;
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
// Source polygons may carry modern country names even when those states did
// not exist. Retain their geometry as an approximate territorial outline,
// but never present those names/sovereignties as historical facts.
const unDecolonization="https://www.un.org/dppa/decolonization/history/former-trust-and-nsgts";
const diplomaticHistory="https://history.state.gov/countries/";
type HistoricalLabelCorrection=[label:string,affiliation:string,source:string];
const colonialNames:Record<string,string>={Belize:"Британский Гондурас",Botswana:"Бечуаналенд",Lesotho:"Басутоленд",Guyana:"Британская Гвиана",Malawi:"Ньясаленд",Zambia:"Северная Родезия",Zimbabwe:"Южная Родезия",Namibia:"Юго-Западная Африка"};
const historicalCorrectionCache=new Map<number,Record<string,HistoricalLabelCorrection>>();
function historicalCorrectionsForYear(year:number):Record<string,HistoricalLabelCorrection>{
 const cached=historicalCorrectionCache.get(year);
 if(cached)return cached;
 const corrections:Record<string,HistoricalLabelCorrection>=Object.create(null);
 const colonial=(names:Record<string,string>,affiliation:string,from:number,to:number,sourceUrl=unDecolonization)=>{
  if(year<from||year>to)return;
  for(const [name,label] of Object.entries(names))corrections[name]=[label,affiliation,sourceUrl];
 };
 // Apply dated rules only to periods in which the documented administration
 // actually existed. Modern geographic names alone are not evidence of statehood.
 for(const [name,label] of Object.entries(colonialNames)){
  if(year>=1920&&year<=1960||year===1914&&!["Namibia","Zambia","Zimbabwe"].includes(name))
   corrections[name]=[label,name==="Namibia"?"Южно-Африканская администрация":"Британская империя",unDecolonization];
 }
 colonial({Belize:"Британский Гондурас",Guyana:"Британская Гвиана",Lesotho:"Басутоленд"},"Великобритания",1878,1960);
 colonial({Botswana:"Бечуаналенд"},"Великобритания",1900,1960);
 colonial({"Gambia, The":"Гамбия",Gambia:"Гамбия","Sierra Leone":"Сьерра-Леоне",Malta:"Мальта",Jamaica:"Ямайка",Barbados:"Барбадос",Grenada:"Гренада",Dominica:"Доминика",Montserrat:"Монтсеррат",Anguilla:"Ангилья","Saint Lucia":"Сент-Люсия","Saint Kitts and Nevis":"Сент-Китс и Невис","Saint Vincent and the Grenadines":"Сент-Винсент и Гренадины","Antigua and Barbuda":"Антигуа и Барбуда",Trinidad:"Тринидад",Bahamas:"Багамские острова","Turks and Caicos Islands":"Теркс и Кайкос",Fiji:"Фиджи"},"Великобритания",1878,1960);
 colonial({Uganda:"Уганда",Kenya:"Кения",Swaziland:"Свазиленд",Brunei:"Бруней"},"Британский протекторат / колониальная администрация",1914,1960);
 colonial({Ghana:"Золотой Берег"},"Великобритания",1900,1945);
 colonial({Malaysia:"Малайские территории (условный контур)"},"Британская администрация; статус областей различался",1914,1945);
 colonial({"Guinea-Bissau":"Португальская Гвинея",Angola:"Ангола",Mozambique:"Мозамбик"},"Португалия",1900,1960);
 colonial({"Equatorial Guinea":"Испанская Гвинея"},"Испания",1914,1960);
 colonial({"Western Sahara":"Испанская Сахара"},"Испания",1920,1960);
 colonial({Djibouti:"Французский берег Сомали"},"Франция",1914,1960);
 colonial({Algeria:"Алжир"},"Французская администрация; с 1954 г. война за независимость",1960,1960,"https://digitallibrary.un.org/record/860972/files/1963-E.pdf");
 colonial({Algeria:"Алжир"},"Франция",1900,1945);
 colonial({Tunisia:"Тунис"},"Французский протекторат",1900,1945);
 colonial({Morocco:"Марокко (условный контур)"},"Французский и испанский протектораты; статус областей различался",1914,1945);
 colonial({"French Guiana":"Французская Гвиана",Guadeloupe:"Гваделупа",Martinique:"Мартиника"},"Франция",1878,2010);
 colonial({Greenland:"Гренландия"},"Дания",1878,2010);
 colonial({"Netherlands Antilles":"Нидерландские владения в Карибском море"},"Нидерланды",1878,1945);
 colonial({"Netherlands Antilles":"Нидерландские Антильские острова"},"Королевство Нидерландов",1960,2000);
 colonial({"Netherlands Antilles":"Нидерландские Антильские острова (до 10 октября 2010 г.)"},"В течение 2010 года статус изменился",2010,2010,"https://www.government.nl/themes/government-and-democracy/caribbean-parts-of-the-kingdom");
 colonial({"United States Virgin Islands":"Датская Вест-Индия"},"Дания",1878,1914,"https://www.doi.gov/oia/islands/virgin-islands");
 colonial({"United States Virgin Islands":"Американские Виргинские острова"},"США",1920,2010,"https://www.doi.gov/oia/islands/virgin-islands");
 colonial({"American Samoa":"Самоанские острова (восточная часть)"},"Местные политические образования; контур условный",1878,1880,"https://www.doi.gov/sites/default/files/elips/documents/575-dm-1.pdf");
 colonial({"American Samoa":"Американское Самоа"},"США; присоединение в 1900–1904 гг.",1900,2010,"https://www.doi.gov/sites/default/files/elips/documents/575-dm-1.pdf");
 colonial({"Kingdom of Hawaii":"Гавайские острова"},"США (аннексия 1898 г.)",1900,1900,diplomaticHistory+"hawaii");
 colonial({"Kingdom of Brazil":"Бразильская республика"},"Бразилия",1900,1900,"https://history.state.gov/historicaldocuments/frus1894app2/ch7subch1");
 colonial({Iran:"Персия"},"Персия",1920,1930,"https://history.state.gov/historicaldocuments/frus1935v01/d338");
 colonial({Israel:"Подмандатная Палестина (условный контур)"},"Британский мандат",1930,1945,"https://history.state.gov/milestones/1945-1952/creation-israel");
 colonial({"Tanzania, United Republic of":"Танганьика и Занзибар (условный контур)"},"Британская администрация; отдельные территории",1920,1960);
 colonial({Burundi:"Бурунди (часть Руанды-Урунди)",Rwanda:"Руанда (часть Руанды-Урунди)"},"Бельгийская администрация",1920,1960);
 colonial({"Papua New Guinea":"Папуа и Новая Гвинея (условный контур)"},"Статус частей территории различался; австралийская администрация",1920,1960);
 colonial({"Saar Protectorate":"Саарская область"},"Французская оккупационная зона; особый статус оформлен позднее",1945,1945,"https://www.saarland.de/stk/EN/service/downloads/Entstehung_Saarland.pdf?__blob=publicationFile&v=1");
 colonial({Zaire:"Демократическая Республика Конго"},"Демократическая Республика Конго",2000,2010);
 colonial({Burma:"Мьянма"},"Союз Мьянма; название в ООН изменено в июне 1989 г.",1994,2010,"https://www.un.org/en/about-us/member-states/myanmar");
 colonial({Byelarus:"Беларусь"},"Республика Беларусь; название в ООН изменено 19 сентября 1991 г.",1994,2010,"https://research.un.org/en/unmembers/currentmembers");
 colonial({Macedonia:"Республика Македония"},"В ООН в 1993–2019 гг. использовалось временное наименование «бывшая югославская Республика Македония»",1994,2010,"https://digitallibrary.un.org/record/914046");
 colonial({"Puerto Rico":"Пуэрто-Рико"},"Территория США, не отдельное суверенное государство",1994,2010,"https://www.doi.gov/oia/islands/politicatypes");
 colonial({Trinidad:"Тринидад и Тобаго (неполный контур)"},"Независимое государство с 1962 г.; исходный полигон не охватывает остров Тобаго",1994,2010,"https://digitallibrary.un.org/record/707403/files/A_HRC_WG.6_12_TTO_1-EN.pdf");
 colonial({Italy:"Италия (условный контур)"},"В исходном контуре включено местоположение Сан-Марино; Сан-Марино — отдельное государство и член ООН с 1992 г.",1994,2010,"https://www.un.org/en/about-us/growth-in-un-membership");
 colonial({Indonesia:"Индонезия (условный контур)"},"Восточный Тимор — независимое государство с 2002 г.; источник 2010 г. не выделяет его отдельной границей",2010,2010,"https://peacekeeping.un.org/sites/default/files/past/unmit/background.shtml");
 colonial({Indonesia:"Индонезия (условный контур)"},"В Восточном Тиморе с 1999 г. действовала переходная администрация ООН; отдельная граница в слое 2000 г. отсутствует",2000,2000,"https://peacekeeping.un.org/sites/default/files/past/unmit/background.shtml");
 colonial({Switzerland:"Швейцария"},"Швейцарская Конфедерация; основной исходный полигон восстановлен по проверенному идентификатору геометрии",1994,2010,"https://www.swisstopo.admin.ch/en/national-border");
 colonial({"Hong Kong":"Гонконг"},"КНР, специальный административный район с 1 июля 1997 г.",2000,2010,"https://www.basiclaw.gov.hk/en/basiclaw/preamble.html");
 colonial({"Saint Barthelemy":"Сен-Бартелеми"},"Франция; самостоятельная заморская общность с 2007 г.",1994,2000,"https://www.outre-mer.gouv.fr/territoires/saint-barthelemy");
 colonial({"Saint Martin":"Сен-Мартен (французская часть)"},"Франция; самостоятельная заморская общность с 2007 г.",1994,2000,"https://www.outre-mer.gouv.fr/territoires/saint-martin");
 colonial({"Saint Barthelemy":"Сен-Бартелеми"},"Заморская общность Франции",2010,2010,"https://www.outre-mer.gouv.fr/territoires/saint-barthelemy");
 colonial({"Saint Martin":"Сен-Мартен (французская часть)"},"Заморская общность Франции",2010,2010,"https://www.outre-mer.gouv.fr/territoires/saint-martin");
 colonial({Serbia:"Сербия",Montenegro:"Черногория"},"Союзная Республика Югославия",1994,2000,diplomaticHistory+"serbia/summary");
 // The following polygons explicitly use a polity name outside its known
 // period. Their geometry is not evidence for a replacement polity; mark the
 // territorial outline rather than assign a guessed successor to the shape.
 const disputedContour=(name:string,label:string,period:number,reason:string,url:string)=>{
  if(year===period)corrections[name]=[label+" (условный контур)",reason+"; принадлежность по этому контуру не установлена",url];
 };
 disputedContour("Mauryan Empire","Бывшие земли империи Маурьев",-100,"Империя распалась около 185 г. до н. э.","https://www.metmuseum.org/essays/mauryan-empire-ca-323-185-b-c");
 disputedContour("Parthian Empire","Бывшие земли Парфянской державы",300,"Парфянская держава прекратила существование в 224 г.","https://www.metmuseum.org/toah/hd/paru/hd_paru.htm");
 disputedContour("Sasanian Empire","Бывшие земли Сасанидов",700,"Держава Сасанидов пала к 651 г.","https://www.metmuseum.org/essays/the-sasanian-empire-224-651-a-d");
 disputedContour("Sui Empire","Бывшие земли империи Суй",700,"Династия Суй прекратилась в 618 г.","https://www.metmuseum.org/toah/ht/06/eac.html");
 disputedContour("Koguryo","Бывшие земли Когурё",700,"Когурё пало в 668 г.","https://www.metmuseum.org/toah/ht/06/eak.html");
 disputedContour("Paekche","Бывшие земли Пэкче",700,"Пэкче пало в 660 г.","https://www.metmuseum.org/toah/ht/06/eak.html");
 disputedContour("Xixia","Тангутские земли",1000,"Государство Си Ся сформировалось позже", "https://www.metmuseum.org/toah/ht/07/nc.html");
 disputedContour("Mongol Empire","Монгольские земли",1200,"Монгольская империя образована в 1206 г.","https://www.metmuseum.org/toah/ht/07/nc.html");
 disputedContour("Sultanate of Delhi","Земли будущего Делийского султаната",1200,"Делийский султанат основан в 1206 г.","https://www.metmuseum.org/toah/ht/07/ssn.html");
 disputedContour("Fatimid Caliphate","Бывшие земли Фатимидов",1200,"Фатимидский халифат прекратил существование в 1171 г.","https://www.metmuseum.org/toah/ht/07/wae.html");
 for(const period of [1300,1400])disputedContour("Chola Empire","Бывшие земли Чола",period,"Имперская династия Чола завершилась к 1279 г.","https://www.metmuseum.org/toah/ht/07/sss.html");
 disputedContour("Inca Empire","Бывшие земли империи инков",1600,"Империя инков пала в 1530-х гг.; последнее государство инков в Вилькабамбе — в 1572 г.","https://www.metmuseum.org/toah/ht/08/sanc.html");
 colonial({"Poland-Lithuania":"Королевство Польское и Великое княжество Литовское (условный контур)"},"Польско-литовская династическая уния; Речь Посполитая образована в 1569 г.",1400,1530,"https://pamiecpolski.archiwa.gov.pl/akt-unii-krewskiej/");
 colonial({"United Kingdom":"Королевство Великобритания"},"Королевство Великобритания (1707–1800); уния с Ирландией с 1801 г.",1715,1800,"https://www.parliament.uk/about/living-heritage/evolutionofparliament/legislativescrutiny/act-of-union-1707/overview/the-articles-constitution-and-trade/");
 colonial({"United Kingdom of Great Britain and Ireland":"Соединённое Королевство Великобритании и Северной Ирландии"},"Название Соединённого Королевства уточнено законом 1927 г.",1930,2010,"https://www.legislation.gov.uk/ukpga/1927/4/pdfs/ukpga_19270004_en.pdf");
 colonial({Hail:"Хаиль (условный контур)",Hejaz:"Хиджаз (условный контур)"},"Королевство Хиджаза и Неджда; переименовано в Саудовскую Аравию в 1932 г.",1930,1930,"https://history.state.gov/historicaldocuments/frus1933v02/ch26subch1");
 colonial({Kuwait:"Кувейт"},"Британская договорная защита до 19 июня 1961 г.",1900,1960,diplomaticHistory+"kuwait");
 colonial({Qatar:"Катар"},"Британский протекторат до 1971 г.",1920,1960,diplomaticHistory+"qatar/recognition");
 colonial({Egypt:"Египетское королевство"},"Египет; формальная независимость с 1922 г., сохранялось британское влияние",1930,1945,diplomaticHistory+"egypt");
 colonial({Egypt:"Объединённая Арабская Республика (Египет)",Syria:"Объединённая Арабская Республика (Сирия)"},"Объединённая Арабская Республика, 1958–1961 гг. (союз Египта и Сирии)",1960,1960,diplomaticHistory+"egypt");
 colonial({Vietnam:"Северный и Южный Вьетнам (общий условный контур)"},"После Женевских соглашений 1954 г. существовали ДРВ и Республика Вьетнам; временная военная линия разделения, не политическая граница, в исходном контуре отсутствует",1960,1960,"https://history.state.gov/historicaldocuments/frus1952-54v16/d1035");
 colonial({Eritrea:"Эритрея"},"Автономная единица в федерации с Эфиопией под суверенитетом Эфиопской короны",1960,1960,"https://history.state.gov/historicaldocuments/frus1951v05/d701");
 colonial({Philippines:"Филиппины"},"Под суверенитетом США; полная независимость с 1946 г.",1900,1938,diplomaticHistory+"philippines");
 colonial({Philippines:"Филиппины (Содружество)"},"В 1945 г. завершалось освобождение от японской оккупации; полная независимость с 1946 г.",1945,1945,diplomaticHistory+"philippines");
 const sovietConstitution="https://projects.rusarchives.ru/statehood/09-05-konstitution-project-1924.shtml";
 colonial({"White Russia":"СССР (условный контур)","Far Eastern SSR":"СССР (Дальний Восток, условный контур)"},"СССР; исходная подпись и контур не соответствуют отдельной союзной республике",1930,1930,sovietConstitution);
 colonial({Georgia:"Грузинская ССР",Armenia:"Армянская ССР",Azerbaijan:"Азербайджанская ССР"},"СССР, Закавказская СФСР",1930,1930,sovietConstitution);
 colonial({Armenia:"Армянская ССР",Georgia:"Грузинская ССР",Azerbaijan:"Азербайджанская ССР"},"Союзная республика СССР",1938,1960,"https://guides.rusarchives.ru/node/1397");
 colonial({India:"Британская Индия (условный контур)"},"Британская администрация; княжества имели особый статус",1900,1938,diplomaticHistory+"india");
 if(year===1914){
  delete corrections.Namibia;delete corrections.Zambia;delete corrections.Zimbabwe;
  for(const [n,label] of Object.entries({Armenia:"Армянские земли Закавказья",Azerbaijan:"Азербайджанские земли Закавказья",Georgia:"Грузинские земли Закавказья",Finland:"Великое княжество Финляндское"}))corrections[n]=[label,"Российская империя",diplomaticHistory+n.toLowerCase()];
  corrections["Manchu Empire"]=["Китайская республика","Китайская республика",diplomaticHistory+"china"];
  corrections["South Africa"]=["Южно-Африканский Союз","Британская империя",unDecolonization];
 }
 if(year===1920){
  corrections.USSR=["Советская Россия","Советская Россия",diplomaticHistory+"russia"];
  corrections["Far Eastern SSR"]=["Дальневосточная республика (с апреля 1920 г.)","Образована 6 апреля 1920 г.; границы и контроль менялись в течение года","https://guides.rusarchives.ru/terms/74/11935/organy-vlasti-i-upravleniya-dalnevostochnoy-respubliki"];
  corrections.Georgia=["Грузинская демократическая республика","Грузия",diplomaticHistory+"georgia"];
  corrections.Azerbaijan=["Азербайджан (смена власти в 1920 г.)","Статус менялся в течение года",diplomaticHistory+"azerbaijan"];
  corrections.Armenia=["Армения (смена власти в 1920 г.)","Статус менялся в течение года",diplomaticHistory+"armenia"];
  corrections.Ghana=["Золотой Берег","Британская империя",unDecolonization];
  corrections.Malaysia=["Малайские территории","Британская империя",unDecolonization];
 }
 if(year===1945){
  for(const n of ["India","Pakistan","Bangladesh"])corrections[n]=["Британская Индия (условный контур)","Британская империя",diplomaticHistory+"pakistan"];
  corrections.Israel=["Подмандатная Палестина (условный контур)","Британский мандат",diplomaticHistory+"israel"];
  corrections.Jordan=["Трансиордания","Британский мандат",diplomaticHistory+"jordan"];
  corrections.Zaire=["Бельгийское Конго","Бельгия",unDecolonization];
  corrections.Malaysia=["Малайские территории","Британская администрация; японская оккупация завершилась в 1945 г.",unDecolonization];
 }
 if(year===1960){
  corrections.Zaire=["Республика Конго (Леопольдвиль)","Независимость Бельгийского Конго с 1960 г.; название Заир появилось в 1971 г.",unDecolonization];
  corrections.Congo=["Республика Конго (Браззавиль)","Независимость от Франции в 1960 г.; не путать с Конго (Леопольдвиль)",unDecolonization];
  corrections.Malaysia=["Малайская Федерация и британские территории (условный контур)","Малайская Федерация независима с 1957 г.; контур включает Северное Борнео и Саравак, вошедшие в Малайзию в 1963 г.",unDecolonization];
  corrections.Yemen=["Йеменское королевство и британские владения (условный контур)","Север — Йеменское Мутаваккилийское королевство; юг — Аден и британские протектораты. Объединение Йемена произошло только в 1990 г.",diplomaticHistory+"yemen"];
  corrections.Indonesia=["Индонезия (условный контур)","В западной части Новой Гвинеи сохранялась нидерландская администрация; переход под управление ООН начался в 1962 г., передача Индонезии — в 1963 г.","https://peacekeeping.un.org/sites/default/files/past/unsfbackgr.html"];
  corrections.Pakistan=["Пакистан (Западный и Восточный)","В 1960 г. включал Восточный Пакистан (ныне Бангладеш); разделение произошло в 1971 г.","https://www.na.gov.pk/en/content.php?id=75"];
  corrections.Cameroon=["Республика Камерун (условный контур)","Французский подопечный Камерун стал независимым в 1960 г.; британские подопечные территории разделены между Камеруном и Нигерией в 1961 г.",unDecolonization];
  colonial({Chad:"Республика Чад","Central African Republic":"Центральноафриканская Республика",Gabon:"Габонская Республика","Ivory Coast":"Республика Берег Слоновой Кости",Niger:"Республика Нигер"},"Бывшая территория Французской Африки; независимость получена в течение 1960 г.",1960,1960);
  colonial({Madagascar:"Малагасийская Республика"},"Независимость от Франции получена в течение 1960 г.",1960,1960);
  colonial({Togo:"Тоголезская Республика"},"Бывшая подопечная территория ООН под управлением Франции; независимость получена в течение 1960 г.",1960,1960);
  colonial({Cyprus:"Республика Кипр",Nigeria:"Федерация Нигерии"},"Независимость от Великобритании получена в течение 1960 г.",1960,1960);
  colonial({Mauritania:"Исламская Республика Мавритания"},"Независимость от Франции получена в 1960 г.; в ООН принята в 1961 г.",1960,1960);
  corrections.Somalia=["Сомалийская Республика", "В течение 1960 г. бывшие британская и итальянская территории стали независимыми и объединились",unDecolonization];
  corrections.Mali=["Республика Мали (условный контур)","Федерация Мали получила независимость 20 июня 1960 г.; Республика Мали провозглашена 22 сентября 1960 г. после её распада","https://legal.un.org/ilc/publications/yearbooks/english/ilc_1962_v2.pdf"];
  corrections.Senegal=["Республика Сенегал (условный контур)","В 1960 г. входил в Федерацию Мали; независимая Республика Сенегал провозглашена 20 августа 1960 г.","https://legal.un.org/ilc/publications/yearbooks/english/ilc_1962_v2.pdf"];
  corrections.China=["Китайская Народная Республика","КНР на материке; в ООН место Китая в 1960 г. занимали представители Китайской Республики","https://history.state.gov/historicaldocuments/frus1969-76v17/d167"];
  corrections.Taiwan=["Китайская Республика (Тайвань)","Правительство Китайской Республики на Тайване; представляло Китай в ООН до 1971 г.","https://history.state.gov/historicaldocuments/frus1969-76v17/d167"];
  corrections.Tibet=["Тибет (условный контур)","Под фактическим контролем КНР после событий 1959 г.; отдельный контур не означает международно признанную независимость","https://history.state.gov/historicaldocuments/frus1958-60v19/d367"];
  corrections["South Africa"]=["Южно-Африканский Союз","Название в голосовании ООН от 14 декабря 1960 г.; республика образована в 1961 г.","https://digitallibrary.un.org/record/662085"];
  colonial({Niue:"Ниуэ"},"Администрация Новой Зеландии; самоуправление в свободной ассоциации с Новой Зеландией с 1974 г.",1960,1960);
  colonial({Samoa:"Западное Самоа"},"Подопечная территория ООН под управлением Новой Зеландии; независимость с 1962 г.",1960,1960);
  colonial({Suriname:"Суринам"},"Автономная часть Королевства Нидерландов; независимость с 1975 г.",1960,1960);
  colonial({"Hong Kong":"Гонконг"},"Британская администрация",1960,1960);
  colonial({"Puerto Rico":"Пуэрто-Рико"},"Территория США, не отдельное суверенное государство",1960,1960,"https://www.doi.gov/oia/islands/politicatypes");
  colonial({Tonga:"Королевство Тонга"},"Государство под британской договорной защитой; не обычная британская колония",1960,1960,"https://treaties.un.org/PAGES/ViewDetails.aspx?chapter=14&clang=_en&mtdsg_no=XIV-2&src=TREATY");
  colonial({"Rapa Nui":"Рапа-Нуи (остров Пасхи)"},"Чили",1960,1960,"https://whc.unesco.org/en/list/715/");
 }
 if(year===1945||year===1960){
  corrections["United Arab Emirates"]=["Договорный Оман","Британские договорные протектораты",diplomaticHistory+"united-arab-emirates"];
  corrections["Sri Lanka"]=["Цейлон",year===1945?"Британская империя":"Цейлон",unDecolonization];
  corrections.Benin=["Дагомея",year===1945?"Французская Западная Африка":"Независимость с 1 августа 1960 г.",year===1945?unDecolonization:diplomaticHistory+"benin"];
  corrections["Burkina Faso"]=[year===1945?"Территория будущей Верхней Вольты":"Верхняя Вольта (условный контур)",year===1945?"Французская Западная Африка":"Независимость с 5 августа 1960 г.",year===1945?unDecolonization:diplomaticHistory+"burkina-faso"];
 }
 historicalCorrectionCache.set(year,corrections);
 return corrections;
}
export function correctHistoricalLabels(source:GeoCollection,year:number):GeoCollection{
 const corrections=historicalCorrectionsForYear(year);
 if(!Object.keys(corrections).length||!source.features.some(f=>Boolean(corrections[String(f.properties?.NAME??"").trim()])))return source;
 return {...source,features:source.features.map(f=>{
  // The same pinned unnamed polygon occurs in all three late snapshots.
  // Its geographic extent matches swisstopo and the Natural Earth layer;
  // exact ring sizes and fingerprint prevent attributing arbitrary blanks.
  let name=String(f.properties?.NAME??"").trim();
  let restored=false;
  if(!name&&[1994,2000,2010].includes(year)&&f.geometry?.type==="MultiPolygon"){
   const p=f.geometry.coordinates as number[][][][];
   if(p?.length===1&&p[0]?.length===3&&p[0][0]?.length===2857&&p[0][1]?.length===15&&p[0][2]?.length===16){
    let hash=2166136261;
    for(const char of JSON.stringify(f.geometry))hash=Math.imul(hash^char.charCodeAt(0),16777619)>>>0;
    if(hash===0x64809a59){name="Switzerland";restored=true;}
   }
  }
  const correction=corrections[name];
  if(!correction)return f;
  return {...f,properties:{...f.properties,...(restored?{NAME:name,ATLAS_ORIGINAL_NAME:f.properties?.NAME??null}:{}),ATLAS_HISTORICAL_LABEL:correction[0],ATLAS_HISTORICAL_AFFILIATION:correction[1],ATLAS_HISTORICAL_SOURCE:correction[2],ATLAS_HISTORICAL_NOTE:restored?"Основной полигон присутствовал в источнике без имени. Восстановлена подпись, исходный контур не изменён.":"Название и статус уточнены. Контур взят из исходной реконструкции и может содержать современные границы."}};
 })};
}
export function correctedHistoricalIndexLabel(raw:string,year:number):string|undefined{
 return historicalCorrectionsForYear(year)[raw.trim()]?.[0];
}
export function loadHistoricalSnapshot(year:number){
 if(year===2026)return loadAtlasLayer("countries-russian"); // contemporary Russian POV, not a dated historical snapshot
 const found=historicalSnapshots.find(s=>s.year===year);
 if(!found)return Promise.reject(new Error("Исторического снимка на этот год нет"));
 return requestGeojson("historical-"+year,[HIST+found.file,HIST_BACKUP+found.file]).then(source=>correctHistoricalLabels(source,year));
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
      countries:[...new Set(item.countries.map(name=>name.trim()).filter(Boolean))]});
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
   // +180 and -180 may describe the same meridian. The historical
   // source includes consecutive points on opposite representations of
   // that seam; a zero denominator must never produce NaN SVG vertices.
   const t=adjusted===a[0]?1:(edge-a[0])/(adjusted-a[0]);
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
 // The Natural Earth elevation-point layer uses lower-case attributes.
 const sourceValue=(key:string)=>p[key]??p[key.toLowerCase()];
 const peakName=String(sourceValue("NAME")??"");
 const officialPeak=String(sourceValue("FEATURECLA")).toLowerCase()==="mountain"?
  peakName==="Mount Everest"?{height:8848.86,source:"Совместное измерение Непала и Китая, 2020 г."}:
  peakName==="Cerro Aconcagua"?{height:6960.8,source:"Национальный географический институт Аргентины, 2012 г."}:null:null;
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
  const value=String(sourceValue(property)??"");
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
  const value=sourceValue(key);
  if((typeof value==="string"&&value.trim()!==""||
   typeof value==="number"&&Number.isFinite(value))&&!seen.has(label)){
   let display=String(value).trim();
   if(key==="ELEVATION"||key==="ELEV"||key==="POP_MAX"||key==="POP_MIN"){
    const measurement=Number(display);
    // Natural Earth uses negative sentinel values for unavailable records.
    // Actual below-sea-level elevations remain valid.
    if(!Number.isFinite(measurement)||((key==="POP_MAX"||key==="POP_MIN")?measurement<=0:measurement<=-9999))continue;
    if(officialPeak&&(key==="ELEVATION"||key==="ELEV"))display=officialPeak.height.toLocaleString("ru-RU",{useGrouping:false});
   }
   if(key==="FEATURECLA"||key==="FEATURECLASS"){
    // An unknown English source category is metadata, not a translated legend.
    if(/^Admin-0 capital(?: alt)?$/i.test(display)&&Number(p.ADM0CAP??p.adm0cap)===0)
     display=Number(p.CAPALT??p.capalt)===1?"Столичный статус в источнике (требует уточнения)":"Населённый пункт";
    else display=localizedFeatureClasses[display]??"";
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
 if(officialPeak&&seen.has("Высота, м"))result.push({label:"Источник уточнённой высоты",value:officialPeak.source});
 return result;
}

export function summariseNamedChanges(prev:GeoCollection,next:GeoCollection){
 const names=(geo:GeoCollection)=>new Set(geo.features.map(f=>String(f.properties?.ATLAS_HISTORICAL_LABEL??geoFeatureName(f))).filter(Boolean));
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
  if(p.ATLAS_HISTORICAL_LABEL&&["SUBJECTO","PARTOF","BORDERPRECISION","BORDER_PRECISION"].includes(key))return [];
  const value=key==="NAME"&&Object.hasOwn(p,"ATLAS_ORIGINAL_NAME")?p.ATLAS_ORIGINAL_NAME:p[key];
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
