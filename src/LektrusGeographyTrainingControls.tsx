import {useState} from "react";
import type {GeoTrainingDiagram,GeoRelation,GeoRegion} from "./lektrusGeographyTrainingModel";
import {geoCountries,geoRegions,geoRelationNames,getGeoCountry,sampleGeoCountries} from "./lektrusGeographyTrainingModel";

type Props={diagram:GeoTrainingDiagram;onChange:(diagram:GeoTrainingDiagram)=>void};
const counts=[2,3,4,5,6,7,8,9,10,11,12] as const;
export default function LektrusGeographyTrainingControls({diagram:d,onChange}:Props){
 const [region,setRegion]=useState<GeoRegion|"Все">("Все");
 const [query,setQuery]=useState("");
 const [newCountry,setNewCountry]=useState("");
 const used=new Set(d.countryCodes);
 const available=geoCountries.filter(c=>!used.has(c.code)&&
  (region==="Все"||c.region===region)&&
  (!query.trim()||c.name.toLocaleLowerCase("ru").includes(query.trim().toLocaleLowerCase("ru"))||
   c.capital.toLocaleLowerCase("ru").includes(query.trim().toLocaleLowerCase("ru"))));
 const reorder=(i:number,j:number)=>{
  const next=[...d.countryCodes];[next[i],next[j]]=[next[j],next[i]];
  onChange({...d,countryCodes:next});
 };
 return <>
  <div className="lektrus-school-controls-heading">Тип задания</div>
  <label className="lektrus-school-field">Что сопоставляем
   <select value={d.relation} onChange={e=>onChange({...d,relation:e.target.value as GeoRelation})}>
    {Object.entries(geoRelationNames).map(([id,name])=><option value={id} key={id}>{name}</option>)}
   </select>
  </label>
  <label className="lektrus-school-toggle"><input type="checkbox" checked={d.reverse}
   onChange={e=>onChange({...d,reverse:e.target.checked})}/>
   Поменять местами вопрос и ответ
  </label>
  <p className="lektrus-school-hint">{d.exercise==="matching"?
   "На доске ученик нажимает подходящие элементы в двух колонках. Верные пары отмечаются, ошибки учитываются.":"На доске ученик сначала видит вопрос, затем переворачивает карточку и проверяет себя."}
   {" "}Направление можно менять в любом типе задания.</p>
  <div className="lektrus-school-controls-heading">Подбор стран</div>
  <label className="lektrus-school-field">Часть света
   <select value={region} onChange={e=>{setRegion(e.target.value as GeoRegion|"Все");setNewCountry("");setQuery("")}}>
    <option value="Все">Весь мир</option>
    {geoRegions.map(name=><option value={name} key={name}>{name}</option>)}
   </select>
  </label>
  <div className="lektrus-geo-setting-actions">
   <button type="button" className="lektrus-school-add" onClick={()=>
    onChange({...d,countryCodes:sampleGeoCountries(region,d.countryCodes.length)})}>
    ↻ Случайные страны
   </button>
   <label>Количество
    <select value={d.countryCodes.length} onChange={e=>
     onChange({...d,countryCodes:sampleGeoCountries(region,Number(e.target.value))})}>
     {counts.map(n=><option key={n} value={n}>{n}</option>)}
    </select>
   </label>
  </div>
  <p className="lektrus-school-hint">В справочнике {geoCountries.length} государств; для задания выбирайте от 2 до 12 разных стран. Случайная подборка изменяет текущий набор только по нажатию.</p>
  <div className="lektrus-geo-chosen" aria-label="Выбранные страны">
   {d.countryCodes.map((code,i)=>{
    const country=getGeoCountry(code);
    if(!country)return null;
    return <div key={code} className="lektrus-geo-chosen-row">
     <span className="lektrus-school-number">{i+1}</span>
     <div><strong>{country.name}</strong><small>{country.capital}</small></div>
     <button type="button" aria-label={"Выше: "+country.name} title="Выше" disabled={i===0}
      onClick={()=>reorder(i,i-1)}>↑</button>
     <button type="button" aria-label={"Ниже: "+country.name} title="Ниже"
      disabled={i===d.countryCodes.length-1} onClick={()=>reorder(i,i+1)}>↓</button>
     <button type="button" aria-label={"Убрать: "+country.name} title="Убрать страну"
      disabled={d.countryCodes.length<=2}
      onClick={()=>onChange({...d,countryCodes:d.countryCodes.filter(x=>x!==code)})}>×</button>
    </div>
   })}
  </div>
  <label className="lektrus-school-field">Поиск страны или столицы
   <input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Например, Казахстан или Астана"/>
  </label>
  <div className="lektrus-geo-add-row">
   <select value={available.some(c=>c.code===newCountry)?newCountry:(available[0]?.code??"")}
    aria-label="Страна для добавления" onChange={e=>setNewCountry(e.target.value)}>
    {available.length===0?<option value="">Нет доступных стран</option>:
     available.map(c=><option value={c.code} key={c.code}>{c.name} · {c.capital}</option>)}
   </select>
   <button type="button" disabled={d.countryCodes.length>=12||available.length===0}
    onClick={()=>{
     const code=available.some(c=>c.code===newCountry)?newCountry:available[0]?.code;
     if(code&&!used.has(code))onChange({...d,countryCodes:[...d.countryCodes,code]});
    }}>+ Добавить</button>
  </div>
  {d.countryCodes.some(code=>!!getGeoCountry(code)?.note)&&
   <details className="lektrus-geo-facts-note"><summary>Уточнения о столицах</summary>
    {d.countryCodes.map(code=>{const c=getGeoCountry(code);return c?.note?
     <p key={code}><strong>{c.name}:</strong> {c.note}</p>:null})}
   </details>}
  <p className="lektrus-school-hint">Флаги используются современные. Если нужно составить задания по историческим государствам, лучше выбирать историческую карту: государственные символы и столицы менялись.</p>
 </>;
}
