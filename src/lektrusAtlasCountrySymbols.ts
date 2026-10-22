/** Country symbols for the political and historical atlases.
 * Current flags come from the ISO 3166-1 catalogue. Historical flags are
 * shown ONLY in conservatively dated cases where the current design applied.
 * Every other historical territory receives an explicitly NON-official,
 * deterministic monogram, never a fabricated historic flag or coat of arms. */
import type {GeoFeature} from "./lektrusAtlasData";
export type AtlasCountrySymbol={kind:"flag"|"symbol";code:string|null;monogram:string;
 label:string;note:string;key:string};
const englishNames=new Intl.DisplayNames(["en"],{type:"region"});
const russianNames=new Intl.DisplayNames(["ru"],{type:"region"});
const isoByName=(()=>{
 const lookup=new Map<string,string>();
 for(let a=65;a<=90;a++)for(let b=65;b<=90;b++){
  const iso=String.fromCharCode(a,b),english=englishNames.of(iso),russian=russianNames.of(iso);
  if(english&&english!==iso)lookup.set(english.toLocaleLowerCase("en"),iso);
  if(russian&&russian!==iso)lookup.set(russian.toLocaleLowerCase("ru"),iso);
 }
 const aliases:Record<string,string>={
  "United States of America":"US","United States":"US","USA":"US",
  "Russian Federation":"RU","Russia":"RU","Россия":"RU",
  "Great Britain":"GB","United Kingdom":"GB","Великобритания":"GB",
  "People's Republic of China":"CN","China":"CN",
  "Republic of Korea":"KR","South Korea":"KR","Korea, Republic of":"KR",
  "North Korea":"KP","Korea, Democratic People's Republic of":"KP",
  "Congo":"CG","Republic of Congo":"CG","Republic of the Congo":"CG",
  "Democratic Republic of Congo":"CD","Byelarus":"BY",
  "Burma":"MM","Zaire":"CD","West Germany":"DE",
  "Czech Republic":"CZ","Macedonia":"MK","Ivory Coast":"CI",
  "Gambia, The":"GM","Tanzania, United Republic of":"TZ",
  "Netherlands Antilles":"AN","Rapa Nui":"CL","Trinidad":"TT",
  "East Timor":"TL","Cape Verde":"CV"
 };
 for(const [name,iso]of Object.entries(aliases))lookup.set(name.toLocaleLowerCase("ru"),iso);
 return lookup;
})();
const allowedCode=(value:unknown):string|null=>{
 const iso=typeof value==="string"?value.trim().toUpperCase():"";
 return /^[A-Z]{2}$/.test(iso)&&iso!=="ZZ"&&iso!=="XX"?iso:null;
};
const isCountryPolygon=(feature:GeoFeature)=>feature.geometry?.type==="Polygon"||
 feature.geometry?.type==="MultiPolygon";
export function atlasCountryIso(feature:GeoFeature):string|null{
 if(!isCountryPolygon(feature))return null;
 const props=feature.properties??{};
 for(const key of ["ISO_A2","ISO_A2_EH","WB_A2","iso_a2","iso_3166_1_alpha_2"]){
  const iso=allowedCode(props[key]);
  if(iso&&russianNames.of(iso)!==iso)return iso;
 }
 for(const key of ["NAME","ADMIN","SOVEREIGNT","NAME_EN","NAME_RU","name","name_ru"]){
  const name=props[key];
  if(typeof name!=="string")continue;
  const iso=isoByName.get(name.trim().toLocaleLowerCase("ru"));
  if(iso)return iso;
 }
 return null;
}
// Design-application dates are deliberately conservative; when uncertain,
// the user sees an abstract symbol rather than a present-day national flag.
const datedFlagStart:Readonly<Record<string,number>>={
 US:1960,GB:1801,RU:1993,FR:1946,DE:1990,IT:1946,CA:1965,
 JP:1870,CN:1950,IN:1947,KR:1948,KP:1948,
 AU:1908,NZ:1902,BR:1992,MX:1984,ZA:1995,
 ES:1982,PT:1911,CH:1889,SE:1906,NO:1899,
 PL:1980,FI:1918,TR:1936,IL:1948,
 AR:1985,BD:1972
};
const validHistoricalNames:Readonly<Record<string,string[]>>={
 US:["United States","United States of America","USA"],
 GB:["United Kingdom","Great Britain","United Kingdom of Great Britain and Northern Ireland"],
 RU:["Russian Federation","Russia"],
 FR:["France","French Republic"],
 DE:["Germany","Federal Republic of Germany","West Germany"],
 IT:["Italy","Italian Republic"],
 CA:["Canada"],JP:["Japan"],CN:["China","People's Republic of China"],
 IN:["India","Republic of India"],
 KR:["South Korea","Republic of Korea","Korea, Republic of"],
 KP:["North Korea","Democratic People's Republic of Korea","Korea, Democratic People's Republic of"],
 AU:["Australia"],NZ:["New Zealand"],BR:["Brazil"],MX:["Mexico"],
 ZA:["South Africa"],ES:["Spain"],PT:["Portugal"],
 CH:["Switzerland"],SE:["Sweden"],NO:["Norway"],PL:["Poland"],
 FI:["Finland"],TR:["Turkey","Türkiye"],IL:["Israel"],AR:["Argentina"],BD:["Bangladesh"]
};
function initials(name:string):string{
 const words=name.replace(/[()]/g," ").split(/[\s,;:–—-]+/).filter(Boolean);
 const significant=words.filter(w=>!["и","the","of","de","des","la","в"].includes(w.toLocaleLowerCase("ru")));
 const letters=(significant.length>1?significant.slice(0,2):words.slice(0,1))
  .map(w=>Array.from(w)[0]?.toLocaleUpperCase("ru")??"").join("");
 return letters.slice(0,2)||"•";
}
export function atlasCountryFlagUrl(code:string):string{
 return "https://flagcdn.com/w160/"+code.toLocaleLowerCase("en")+".png";
}
export function atlasCountrySymbol(feature:GeoFeature,title:string,year:number,historical:boolean):AtlasCountrySymbol{
 const raw=String(feature.properties?.NAME??feature.properties?.name??"").trim();
 const code=atlasCountryIso(feature);
 const dated=code&&datedFlagStart[code]!==undefined&&year>=datedFlagStart[code]&&
  validHistoricalNames[code]?.some(name=>name.toLocaleLowerCase("en")===raw.toLocaleLowerCase("en"));
 const flag=!!code&&(!historical||dated);
 const label=flag?"Флаг государства":"Условный картографический знак";
 return {kind:flag?"flag":"symbol",code:flag?code:null,monogram:initials(title||raw),
  label,note:flag?(historical?"Флаг соответствует известному периоду использования":"Современный государственный флаг"):
   historical?"Исторический флаг или герб не подтверждён: показан условный знак, не официальный символ":
   "Флаг для этой территории не определён: показан условный знак",
  key:raw+"|"+year+"|"+(code??"")};
}
