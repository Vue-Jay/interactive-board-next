/** Source-linked school facts for any mapped item carrying a Wikidata Q-ID.
 * Missing facts are omitted, never fabricated. Client fetch happens only on selection.
 */
export type AtlasSchoolFact={label:string;value:string};
export type AtlasSchoolReference={
 id:string;title:string;description:string;facts:AtlasSchoolFact[];url:string;
};
type WikidataSnak={mainsnak?:{datavalue?:{value?:unknown}};rank?:string;
 qualifiers?:Record<string,Array<{datavalue?:{value?:unknown}}>>};
type WikidataEntity={labels?:Record<string,{value:string}>;
 descriptions?:Record<string,{value:string}>;
 claims?:Record<string,WikidataSnak[]>};
type WikidataResponse={entities?:Record<string,WikidataEntity>};
const promises=new Map<string,Promise<AtlasSchoolReference|null>>();
const idPattern=/^Q[1-9]\d{0,11}$/;
export function atlasFactEntityId(properties:Record<string,unknown>|null|undefined):string|null{
 const value=String(properties?.WIKIDATAID??properties?.wikidataid??
  properties?.wikidata_id??properties?.WIKIDATA_ID??"").trim();
 return idPattern.test(value)?value:null;
}
async function queryWikidata(ids:string[]):Promise<Record<string,WikidataEntity>>{
 const url="https://www.wikidata.org/w/api.php?action=wbgetentities&ids="+
  encodeURIComponent(ids.join("|"))+
  "&props=labels%7Cdescriptions%7Cclaims&languages=ru%7Cen&format=json&origin=*";
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),10000);
 try{
  const response=await fetch(url,{signal:controller.signal,cache:"force-cache"});
  if(!response.ok)throw new Error("Справочник Wikidata временно недоступен");
  const result=await response.json() as WikidataResponse;
  return result.entities??{};
 }finally{clearTimeout(timer)}
}
function label(entity:WikidataEntity|undefined):string{
 return entity?.labels?.ru?.value??entity?.labels?.en?.value??"";
}
function snakValue(claim:WikidataSnak):unknown{
 return claim.mainsnak?.datavalue?.value;
}
function wikidataYear(claim:WikidataSnak):number|null{
 const temporal=claim.qualifiers?.P585?.[0]?.datavalue?.value as {time?:unknown}|undefined;
 const year=typeof temporal?.time==="string"?/^\+?(\d{1,6})-/.exec(temporal.time)?.[1]:undefined;
 return year?Number(year):null;
}
function bestClaim(claims:WikidataSnak[]|undefined):WikidataSnak|undefined{
 if(!claims?.length)return undefined;
 const candidates=claims.filter(c=>c.rank!=="deprecated"&&snakValue(c)!==undefined);
 candidates.sort((a,b)=>(b.rank==="preferred"?1:0)-(a.rank==="preferred"?1:0)||
  (wikidataYear(b)??0)-(wikidataYear(a)??0));
 return candidates[0];
}
function linkedId(claim:WikidataSnak|undefined):string|null{
 const value=claim&&snakValue(claim) as {id?:unknown}|undefined;
 return typeof value?.id==="string"&&idPattern.test(value.id)?value.id:null;
}
function quantity(claim:WikidataSnak|undefined):{value:number;unit:string;year:number|null}|null{
 const item=claim&&snakValue(claim) as {amount?:unknown;unit?:unknown}|undefined;
 if(typeof item?.amount!=="string")return null;
 const value=Number(item.amount),unit=String(item.unit??"");
 return Number.isFinite(value)&&value>=0?{value,unit,year:wikidataYear(claim!)}:null;
}
function ruNumber(value:number,digits=0):string{
 return value.toLocaleString("ru-RU",{maximumFractionDigits:digits});
}
const entityProperties=[
 ["P36","Столица"],["P30","Часть света"],["P17","Государство"],
 ["P131","Административная принадлежность"],["P37","Официальный язык"],
 ["P38","Валюта"],["P403","Устье реки"],["P610","Высшая точка"],
 ["P276","Местоположение"],["P361","В составе"]
] as const;
export async function fetchAtlasSchoolReference(id:string):Promise<AtlasSchoolReference|null>{
 if(!idPattern.test(id))return null;
 const present=promises.get(id);if(present)return present;
 const task=(async()=>{
  const record=(await queryWikidata([id]))[id];
  if(!record)return null;
  const claims=record.claims??{};
  const references=entityProperties.flatMap(([property])=>{
   const linked=linkedId(bestClaim(claims[property]));return linked?[linked]:[];
  });
  const unique=[...new Set(references)].slice(0,12);
  const entities=unique.length?await queryWikidata(unique):{};
  const facts:AtlasSchoolFact[]=[];
  const add=(name:string,value:string|undefined)=>{
   if(value&&facts.length<18&&![...facts].some(f=>f.label===name))
    facts.push({label:name,value});
  };
  const people=quantity(bestClaim(claims.P1082));
  if(people){
   const year=people.year?" ("+people.year+" г.)":" (дата в источнике не указана)";
   add("Численность населения",ruNumber(people.value)+year);
  }
  const area=quantity(bestClaim(claims.P2046));
  if(area){
   const km2=area.unit.endsWith("/Q712226")?area.value:
    area.unit.endsWith("/Q25343")?area.value/1e6:null;
   if(km2!==null)add("Площадь",ruNumber(km2,km2<10?2:0)+" км²");
  }
  for(const [property,title] of entityProperties){
   const link=linkedId(bestClaim(claims[property]));
   if(link)add(title,label(entities[link]));
  }
  const length=quantity(bestClaim(claims.P2043));
  if(length){
   const km=length.unit.endsWith("/Q828224")?length.value:
    length.unit.endsWith("/Q11573")?length.value/1000:null;
   if(km!==null)add("Протяжённость",ruNumber(km,km<10?2:0)+" км");
  }
  const height=quantity(bestClaim(claims.P2044));
  if(height&&height.unit.endsWith("/Q11573"))
   add("Высота над уровнем моря",ruNumber(height.value)+" м");
  const coords=snakValue(bestClaim(claims.P625)??{}) as {latitude?:number;longitude?:number}|undefined;
  if(typeof coords?.latitude==="number"&&typeof coords.longitude==="number")
   add("Географические координаты",Math.abs(coords.latitude).toFixed(3)+"° "+
    (coords.latitude>=0?"с. ш.":"ю. ш.")+", "+Math.abs(coords.longitude).toFixed(3)+"° "+
    (coords.longitude>=0?"в. д.":"з. д."));
  return {id,title:label(record),description:record.descriptions?.ru?.value??"",
   facts,url:"https://www.wikidata.org/wiki/"+id};
 })().catch(error=>{promises.delete(id);throw error});
 promises.set(id,task);
 if(promises.size>90)promises.delete(promises.keys().next().value!);
 return task;
}
