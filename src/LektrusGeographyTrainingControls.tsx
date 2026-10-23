import {useState} from "react";
import type {GeoTrainingDiagram,GeoRelation,GeoRegion,GeoDifficulty} from "./lektrusGeographyTrainingModel";
import {geoCountries,geoRegions,geoRelationNames,geoDifficultyNames,geoDifficultyHints,
 getGeoCountry,sampleGeoCountries} from "./lektrusGeographyTrainingModel";

type Props={diagram:GeoTrainingDiagram;onChange:(diagram:GeoTrainingDiagram)=>void};
const counts=[2,3,4,5,6,7,8,9,10,11,12] as const;
const difficultyLevels:GeoDifficulty[]=["easy","medium","hard"];
export default function LektrusGeographyTrainingControls({diagram:d,onChange}:Props){
 const [region,setRegion]=useState<GeoRegion|"Все">("Все");
 const [difficulty,setDifficulty]=useState<GeoDifficulty>(
  d.difficulty&&d.difficulty!=="custom"?d.difficulty:"medium");
 const [count,setCount]=useState(d.countryCodes.length>=2?d.countryCodes.length:6);
 const [query,setQuery]=useState("");
 const [newCountry,setNewCountry]=useState("");
 const used=new Set(d.countryCodes);
 const available=geoCountries.filter(c=>!used.has(c.code)&&
  (region==="Все"||c.region===region)&&
  (!query.trim()||c.name.toLocaleLowerCase("ru").includes(query.trim().toLocaleLowerCase("ru"))||
   c.capital.toLocaleLowerCase("ru").includes(query.trim().toLocaleLowerCase("ru"))));
 const manual=(countryCodes:string[])=>onChange({...d,countryCodes,difficulty:"custom"});
 const reorder=(i:number,j:number)=>{
  const next=[...d.countryCodes];[next[i],next[j]]=[next[j],next[i]];
  manual(next);
 };
 const generate=()=>onChange({...d,
  countryCodes:sampleGeoCountries(region,count,difficulty),difficulty});
 return <>
  <div className="lektrus-school-controls-heading">Тип задания</div>
  <div className="lektrus-geo-config-grid lektrus-geo-mode-fields">
   <label className="lektrus-school-field">Что сопоставляем
   <select value={d.relation} onChange={e=>onChange({...d,relation:e.target.value as GeoRelation})}>
    {Object.entries(geoRelationNames).map(([id,name])=><option value={id} key={id}>{name}</option>)}
   </select>
  </label>
  <label className="lektrus-school-toggle"><input type="checkbox" checked={d.reverse}
   onChange={e=>onChange({...d,reverse:e.target.checked})}/>
   Поменять местами вопрос и ответ
  </label>
  </div>
  <p className="lektrus-school-hint lektrus-geo-compact-note">{d.exercise==="matching"?
   "На доске ученик выбирает связанные элементы в двух колонках. Верные пары отмечаются, ошибки учитываются.":
   "На доске ученик переворачивает карточку и самостоятельно проверяет ответ."}
   {" "}Направление можно менять в обоих инструментах. Контуры строятся по данным нашего атласа.</p>
  <div className="lektrus-school-controls-heading">Генерация задания</div>
  <div className="lektrus-geo-config-grid lektrus-geo-generator-fields">
  <label className="lektrus-school-field">Часть света
   <select value={region} onChange={e=>{setRegion(e.target.value as GeoRegion|"Все");setNewCountry("");setQuery("")}}>
    <option value="Все">Весь мир</option>
    {geoRegions.map(name=><option value={name} key={name}>{name}</option>)}
   </select>
  </label>
  <label className="lektrus-school-field">Уровень сложности
   <select value={difficulty} onChange={e=>setDifficulty(e.target.value as GeoDifficulty)}>
    {difficultyLevels.map(level=><option value={level} key={level}>{geoDifficultyNames[level]}</option>)}
   </select>
  </label>
   <label className="lektrus-school-field">Количество заданий
    <select value={count} onChange={e=>setCount(Number(e.target.value))}>
     {counts.map(n=><option key={n} value={n}>{n}</option>)}
    </select>
   </label>
   <button type="button" className="lektrus-school-add lektrus-geo-generate" onClick={generate}>
    ↻ Сгенерировать задание
   </button>
  </div>
  <p className="lektrus-school-hint lektrus-geo-compact-note">{geoDifficultyHints[difficulty]} Если в выбранном регионе стран этого уровня мало, добавляются страны соседних уровней.</p>
  <div className="lektrus-geo-selected-heading">
   <div className="lektrus-school-controls-heading">Выбранные страны ({d.countryCodes.length})</div>
   {d.countryCodes.length>0&&<button type="button" className="lektrus-geo-clear"
    onClick={()=>manual([])}>Очистить список</button>}
  </div>
  {d.countryCodes.length===0?
   <p className="lektrus-school-hint lektrus-geo-empty">
    Пока ничего не выбрано. Задайте сложность и нажмите «Сгенерировать задание» либо добавьте страны по одной.
   </p>:
   <p className="lektrus-school-hint">Набор: {d.difficulty&&d.difficulty!=="custom"?geoDifficultyNames[d.difficulty]:"ручной выбор"}.
    Новая генерация заменит этот набор.</p>}
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
      onClick={()=>manual(d.countryCodes.filter(x=>x!==code))}>×</button>
    </div>
   })}
  </div>
  <div className="lektrus-school-controls-heading">Добавить страну вручную</div>
  <div className="lektrus-geo-manual-grid">
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
     if(code&&!used.has(code))manual([...d.countryCodes,code]);
    }}>+ Добавить</button>
  </div>
  </div>
  <p className="lektrus-school-hint lektrus-geo-compact-note">{geoCountries.length} государств в справочнике. Для сохранения выберите от 2 до 12 разных стран.</p>
  {d.countryCodes.some(code=>!!getGeoCountry(code)?.note)&&
   <details className="lektrus-geo-facts-note"><summary>Уточнения о столицах</summary>
    {d.countryCodes.map(code=>{const c=getGeoCountry(code);return c?.note?
     <p key={code}><strong>{c.name}:</strong> {c.note}</p>:null})}
   </details>}
  <p className="lektrus-school-hint lektrus-geo-compact-note">Флаги и контуры: современная карта. Исторические границы смотрите в историческом атласе.</p>
 </>;
}
