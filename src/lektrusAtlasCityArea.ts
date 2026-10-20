export type AtlasCityArea={km2:number;url:string};
const cityAreaCache=new Map<string,Promise<AtlasCityArea|null>>();
export function cityAreaId(p:Record<string,unknown>|null):string|null{
 const id=String(p?.WIKIDATAID??p?.wikidataid??"").trim();
 return /^Q[1-9]\d{0,10}$/.test(id)?id:null;
}
export async function fetchCityArea(id:string):Promise<AtlasCityArea|null>{
 if(!/^Q[1-9]\d{0,10}$/.test(id))return null;
 if(cityAreaCache.has(id))return cityAreaCache.get(id)!;
 const promise=(async()=>{
  const url="https://www.wikidata.org/w/api.php?action=wbgetentities&ids="+encodeURIComponent(id)+"&props=claims&format=json&origin=*";
  const c=new AbortController(),timer=setTimeout(()=>c.abort(),12000);
  try{
   const r=await fetch(url,{signal:c.signal});
   if(!r.ok)throw Error("Wikidata HTTP "+r.status);
   const json=await r.json(),claims=json?.entities?.[id]?.claims?.P2046;
   if(!Array.isArray(claims))return null;
   for(const claim of claims){
    if(claim.rank==="deprecated")continue;
    const v=claim?.mainsnak?.datavalue?.value;
    if(!v||typeof v.amount!=="string")continue;
    const quantity=Number(v.amount),unit=String(v.unit??"");
    const km2=unit.endsWith("/Q712226")?quantity:unit.endsWith("/Q25343")?quantity/1e6:null;
    if(km2!==null&&Number.isFinite(km2)&&km2>0&&km2<500000)
     return {km2,url:"https://www.wikidata.org/wiki/"+id};
   }
   return null;
  }finally{clearTimeout(timer)}
 })().catch(e=>{cityAreaCache.delete(id);throw e});
 cityAreaCache.set(id,promise);
 if(cityAreaCache.size>90)cityAreaCache.delete(cityAreaCache.keys().next().value!);
 return promise;
}
