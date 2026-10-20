import {useEffect,useMemo,useRef,useState,type PointerEvent as ReactPointerEvent} from "react";
import type {AtlasDocument,AtlasMode} from "./lektrusAtlasModel";
import {atlasModes,atlasModesForScope,getAtlasScope,isHistoricalAtlasMode,eventsNearYear,historicalSnapshots,nearestSnapshotIndex,schoolHistoryEvents,yearLabel} from "./lektrusAtlasModel";
import LektrusMapBase from "./LektrusMapBase";
import {borderPrecision,geoFeatureName,featureLabelAnchor,loadAtlasLayer,loadHistoricalSnapshot,mapFeaturePath,
 modernDataProvider,historicDataProvider,projectGeography,summariseNamedChanges,
 type GeoCollection,type GeoFeature} from "./lektrusAtlasData";
type Props={diagram:AtlasDocument};
const hash=(value:string)=>{let h=7;for(const ch of value)h=(h*31+ch.charCodeAt(0))|0;return Math.abs(h)};
const palettes=["#c8dced","#e6c6a9","#c8e3cc","#e1d6ed","#ecd9a9","#a9d9dc","#e8c9d7","#d5dab4"];
const precisions=["Неизвестная точность","Приблизительные границы","Средняя точность","Уточнённая граница"] as const;
const mapModeTitle=(v:AtlasMode)=>atlasModes.find(m=>m.id===v)!.title;
function AtlasMap({diagram:d}:Props){
 const [mode,setMode]=useState<AtlasMode>(d.mode);
 const [index,setIndex]=useState(nearestSnapshotIndex(d.year));
 const scope=getAtlasScope(d);
 const availableModes=atlasModesForScope(scope);
 const [baseLand,setBaseLand]=useState<GeoCollection|null>(null);
 const [baseCoastline,setBaseCoastline]=useState<GeoCollection|null>(null);
 const [baseLoading,setBaseLoading]=useState(true);
 const [baseError,setBaseError]=useState("");
 const [source,setSource]=useState<GeoCollection|null>(null);
 const [previous,setPrevious]=useState<GeoCollection|null>(null);
 const [rivers,setRivers]=useState<GeoCollection|null>(null);
 const [lakes,setLakes]=useState<GeoCollection|null>(null);
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState("");
 const [refresh,setRefresh]=useState(0);
 const [selected,setSelected]=useState<GeoFeature|null>(null);
 const [eventIndex,setEventIndex]=useState<number|null>(null);
 const [search,setSearch]=useState("");
 const [scale,setScale]=useState(1);
 const [position,setPosition]=useState({x:0,y:0});
 const pointer=useRef<{x:number;y:number;fromX:number;fromY:number;id:number}|null>(null);
 const snapshot=historicalSnapshots[index];
 const historical=isHistoricalAtlasMode(mode);
 const waterMode=mode==="physical"||mode==="hydrography";
 useEffect(()=>{
  setMode(atlasModesForScope(getAtlasScope(d)).some(m=>m.id===d.mode)?
   d.mode:scope==="history"?"historical":"political");
  setIndex(nearestSnapshotIndex(d.year));setSelected(null);setEventIndex(null);
 },[d.mode,d.year,d.scope,scope]);
 useEffect(()=>{
  let active=true;
  setBaseError("");setBaseLoading(true);
  Promise.all([loadAtlasLayer("land"),loadAtlasLayer("coastline")])
   .then(([land,coast])=>{
    if(!active)return;
    setBaseLand(land);setBaseCoastline(coast);setBaseLoading(false);
   }).catch(e=>{
    if(!active)return;
    setBaseError(e instanceof Error?e.message:String(e));setBaseLoading(false);
   });
  return()=>{active=false};
 },[refresh]);
 useEffect(()=>{
  let active=true;
  setError("");setLoading(true);setSource(null);setSelected(null);setPrevious(null);
  const main=historical?loadHistoricalSnapshot(snapshot.year):
   mode==="political"||mode==="contour"?loadAtlasLayer("countries"):Promise.resolve(null);
  const before=historical&&index>0?loadHistoricalSnapshot(historicalSnapshots[index-1].year).catch(()=>null):Promise.resolve(null);
  const water=waterMode?Promise.all([loadAtlasLayer("rivers"),loadAtlasLayer("lakes")]):
   Promise.resolve([null,null] as [GeoCollection|null,GeoCollection|null]);
  Promise.all([main,before,water]).then(([geo,prev,w])=>{
   if(!active)return;
   setSource(geo);setPrevious(prev);setRivers(w[0]);setLakes(w[1]);setLoading(false);
  }).catch(e=>{
   if(!active)return;
   setError(e instanceof Error?e.message:String(e));setLoading(false);
  });
  return()=>{active=false};
 },[mode,index,refresh,historical,waterMode,snapshot.year]);
 const shapes=useMemo(()=>source?.features.map((feature,i)=>({
  feature,path:mapFeaturePath(feature),name:geoFeatureName(feature),i
 })).filter(f=>f.path)||[],[source]);
 const labels=useMemo(()=>shapes.map(s=>({...s,anchor:featureLabelAnchor(s.feature)}))
  .filter(s=>s.anchor&&s.anchor.area>380)
  .sort((a,b)=>b.anchor!.area-a.anchor!.area)
  .slice(0,45),[shapes]);
 const streams=useMemo(()=>rivers?.features.map((f,i)=>({id:i,path:mapFeaturePath(f)})).filter(v=>v.path)||[],[rivers]);
 const ponds=useMemo(()=>lakes?.features.map((f,i)=>({id:i,path:mapFeaturePath(f)})).filter(v=>v.path)||[],[lakes]);
 const changes=useMemo(()=>source&&previous?summariseNamedChanges(previous,source):null,[source,previous]);
 const eventList=useMemo(()=>eventsNearYear(snapshot.year),[snapshot.year]);
 const userMarkers=d.markers.filter(marker=>!historical||
  Math.abs(marker.year-snapshot.year)<=Math.max(10,(historicalSnapshots[Math.min(index+1,historicalSnapshots.length-1)].year-
   historicalSnapshots[Math.max(0,index-1)].year)/2));
 const isEventVisible=historical&&d.showEvents;
 const activeEvent=eventIndex===null?null:schoolHistoryEvents[eventIndex]??null;
 const selectedTitle=selected?geoFeatureName(selected):"";
 const filteredCount=shapes.filter(s=>s.name.toLocaleLowerCase("ru-RU").includes(search.toLocaleLowerCase("ru-RU"))).length;
 const onMove=(e:ReactPointerEvent<SVGSVGElement>)=>{
  const p=pointer.current;if(!p||p.id!==e.pointerId)return;
  setPosition({x:p.fromX+(e.clientX-p.x),y:p.fromY+(e.clientY-p.y)});
 };
 const reset=()=>{setScale(1);setPosition({x:0,y:0});setSelected(null)};
 const showCountry=(feature:GeoFeature)=>{if(mode==="contour")return;setSelected(feature);setEventIndex(null)};
 const onMode=(value:AtlasMode)=>{
  if(!availableModes.some(candidate=>candidate.id===value))return;
  setMode(value);setSelected(null);setEventIndex(null);
 };
 return <div className="lektrus-atlas" aria-label={d.title}
  onPointerDown={e=>e.stopPropagation()} onPointerUp={e=>e.stopPropagation()}
  onClick={e=>e.stopPropagation()} onWheel={e=>e.stopPropagation()}>
  <header className="lektrus-atlas-header">
   <strong title={d.title}>{d.title}</strong>
   <nav role="group" aria-label="Тип карты">
    {availableModes.map(m=><button key={m.id} type="button" title={m.hint}
     aria-pressed={mode===m.id} className={mode===m.id?"selected":""}
     onClick={()=>onMode(m.id)}>{m.title}</button>)}
   </nav>
  </header>
  <div className="lektrus-atlas-body">
   <div className="lektrus-atlas-map-box">
    {(loading||baseLoading)&&<div className="lektrus-atlas-overlay" role="status">Загружается общая подложка и картографические слои…</div>}
    {!loading&&!baseLoading&&(error||baseError)&&<div className="lektrus-atlas-overlay lektrus-atlas-failure" role="alert">
     <strong>Карта недоступна</strong><span>{error||baseError}</span>
     <button type="button" onClick={()=>setRefresh(i=>i+1)}>Повторить загрузку</button>
     <small>Границы не заменяются вымышленными. Для доступа необходим интернет.</small>
    </div>}
    <svg viewBox="0 0 900 450" className="lektrus-atlas-svg" role="img"
     aria-label={historical?"Историческая карта мира: "+yearLabel(snapshot.year):"Карта мира: "+mapModeTitle(mode)}
     onPointerDown={e=>{if(e.button!==0)return;pointer.current={id:e.pointerId,x:e.clientX,y:e.clientY,fromX:position.x,fromY:position.y};e.currentTarget.setPointerCapture(e.pointerId)}}
     onPointerMove={onMove}
     onPointerUp={e=>{pointer.current=null;if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId)}}
     onPointerCancel={()=>{pointer.current=null}}>
     
     <g transform={`translate(${position.x} ${position.y}) translate(450 225) scale(${scale}) translate(-450 -225)`}>
      <LektrusMapBase land={baseLand} coastline={baseCoastline} grid={d.showGrid}/>
      <g strokeLinejoin="round">
       {shapes.map(s=>{
        const precise=historical?borderPrecision(s.feature):3;
        const highlighted=!!search&&s.name.toLocaleLowerCase("ru-RU").includes(search.toLocaleLowerCase("ru-RU"));
        const fill=mode==="contour"?"transparent":palettes[hash(s.name)%palettes.length];
        return <path key={s.i} d={s.path} fillRule="evenodd" fill={fill}
         stroke={highlighted||s.name===selectedTitle?"#df793e":mode==="contour"?"#839fb2":"#819fb2"}
         strokeWidth={highlighted||s.name===selectedTitle?1.9:historical&&precise===1?.75:.48}
         strokeDasharray={historical&&precise===1?"2.2 1.7":undefined}
         onClick={()=>showCountry(s.feature)} className="lektrus-atlas-country">
         <title>{mode==="contour"?"Граница государства":s.name}</title>
        </path>;
       })}
      </g>
      {d.showLabels&&mode!=="contour"&&<g fill="#44566a" fontSize="8" fontWeight="650"
       textAnchor="middle" pointerEvents="none" stroke="#fff" strokeWidth="1.5" paintOrder="stroke">
       {labels.map(s=><text key={s.i} x={s.anchor!.x} y={s.anchor!.y}>{s.name.slice(0,23)}</text>)}
      </g>}
      {waterMode&&<g pointerEvents="none">
       {ponds.map(l=><path key={"lake-"+l.id} d={l.path} fill="#87bfe6" stroke="#65a3ce" strokeWidth=".65"/>)}
       {streams.map(l=><path key={"river-"+l.id} d={l.path} fill="none" stroke="#6aadd7" strokeWidth=".8"/>)}
      </g>}
      {isEventVisible&&eventList.map(event=>{
       const point=projectGeography(event.lon,event.lat),key=schoolHistoryEvents.indexOf(event);
       return <g key={event.year} transform={`translate(${point[0]} ${point[1]})`}
        className="lektrus-atlas-event" role="button" tabIndex={0}
        onClick={()=>{setEventIndex(key);setSelected(null)}}
        onKeyDown={e=>{if(e.key==="Enter"){setEventIndex(key);setSelected(null)}}}>
        <circle r="8" fill="#fff" opacity=".88"/>
        <circle r="5.5" fill="#dd7656" stroke="#fff" strokeWidth="1.5"/>
        <title>{event.year}: {event.title}</title>
       </g>;
      })}
      {userMarkers.map(marker=>{
       const point=projectGeography(marker.lon,marker.lat);
       return <g key={marker.id} transform={`translate(${point[0]} ${point[1]})`}>
        <circle r="6" fill="#426fbd" stroke="#fff" strokeWidth="2"/>
        <title>{marker.title} ({yearLabel(marker.year)})</title>
       </g>;
      })}
     </g>
    </svg>
    <div className="lektrus-atlas-zoom" role="group" aria-label="Масштаб">
     <button type="button" onClick={()=>setScale(s=>Math.min(5,Math.round((s+.4)*10)/10))}>+</button>
     <button type="button" onClick={reset} title="Сбросить положение">⌖</button>
     <button type="button" onClick={()=>setScale(s=>Math.max(1,Math.round((s-.4)*10)/10))}>−</button>
    </div>
   </div>
   <aside className="lektrus-atlas-sidebar">
    {mode==="political"&&<label>Найти государство
     <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Название страны"/>
     {search&&<small>Совпадений в данных: {filteredCount}</small>}
    </label>}
    {historical&&<div className="lektrus-atlas-year-header">
     <strong>{yearLabel(snapshot.year)}</strong>
     <small>Датированный снимок границ, не интерполяция</small>
    </div>}
    {activeEvent?<div className="lektrus-atlas-description">
     <strong>{activeEvent.title} · {activeEvent.year} г.</strong>
     <p>{activeEvent.description}</p>
     <a href={activeEvent.url} target="_blank" rel="noopener noreferrer">Подробнее об историческом событии ↗</a>
    </div>:
    selected?<div className="lektrus-atlas-description">
     <strong>{selectedTitle}</strong>
     {historical&&<><p>Точность: {precisions[borderPrecision(selected)]}.</p>
      <p>Указанная территория показана по состоянию на {yearLabel(snapshot.year)} согласно выбранной базе.</p>
      {selected.properties?.SUBJECTO&&<p>Административная принадлежность в источнике: {String(selected.properties.SUBJECTO)}</p>}
      {selected.properties?.PARTOF&&String(selected.properties.PARTOF)!==selectedTitle&&
       <p>Регион/группа: {String(selected.properties.PARTOF)}</p>}</>}
    </div>:
    historical?<div className="lektrus-atlas-description">
     <strong>Исторический обзор</strong>
     <p>Выберите государство на карте или событие. Для древности границы часто условны и не являются юридическими линиями.</p>
    </div>:
    <div className="lektrus-atlas-description"><strong>{mapModeTitle(mode)}</strong>
     <p>{atlasModes.find(m=>m.id===mode)?.hint}.</p>
     {waterMode&&<p>Общая подложка суши и морей дополнена реками и озёрами. Это не рельеф высот.</p>}
     {mode==="contour"&&<p>Названия скрыты: можно дать ученику задание подписать страны или выделить границы средствами доски.</p>}
    </div>}
    {historical&&<div className="lektrus-atlas-history-events">
     <strong>Важные события периода</strong>
     {eventList.length?eventList.map(event=><button key={event.year}
      type="button" className={eventIndex!==null&&schoolHistoryEvents[eventIndex]===event?"selected":""}
      onClick={()=>{setEventIndex(schoolHistoryEvents.indexOf(event));setSelected(null)}}>
      {yearLabel(event.year)} · {event.title}</button>):<p>В учебной подборке для этого промежутка события пока не описаны.</p>}
    </div>}
    {historical&&changes&&<div className="lektrus-atlas-changes">
     <strong>Отличия от предыдущего снимка</strong>
     <small>{yearLabel(historicalSnapshots[index-1].year)} → {yearLabel(snapshot.year)}</small>
     <p>Новые наименования в базе: {changes.appeared.length?changes.appeared.join(", "):"не обнаружены"}.</p>
     <p>Отсутствуют в новом снимке: {changes.disappeared.length?changes.disappeared.join(", "):"не обнаружены"}.</p>
     <small>Это сравнение названий объектов, не доказательство изменения каждой границы или причины события.</small>
    </div>}
    {d.markers.length>0&&<div className="lektrus-atlas-user-markers">
     <strong>Маркеры преподавателя</strong>
     {userMarkers.map(marker=><div key={marker.id} title={marker.description}>
      {marker.title} · {yearLabel(marker.year)}
     </div>)}
    </div>}
    <div className="lektrus-atlas-source">
     <a href={(historical?historicDataProvider:modernDataProvider).url}
      target="_blank" rel="noopener noreferrer">Источник: {(historical?historicDataProvider:modernDataProvider).name} ↗</a>
     <small>Общая географическая основа всех режимов: современная береговая линия и суша Natural Earth.</small>
     {historical&&<><small>Исторические границы нанесены на современную географическую основу; они могут быть приблизительными, спорными или неполными.</small>
      <a href={historicDataProvider.licenseUrl} target="_blank" rel="noopener noreferrer">Лицензия исходных данных: GPL-3.0 ↗</a></>}
    </div>
   </aside>
  </div>
  {historical&&<div className="lektrus-atlas-timeline">
   <button type="button" disabled={index===0} title="Предыдущий доступный период"
    onClick={()=>setIndex(i=>Math.max(0,i-1))}>‹</button>
   <input aria-label="Исторический период" type="range" min={0}
    max={historicalSnapshots.length-1} step={1} value={index}
    onChange={e=>{setIndex(Number(e.target.value));setEventIndex(null);setSelected(null)}}/>
   <button type="button" disabled={index===historicalSnapshots.length-1} title="Следующий доступный период"
    onClick={()=>setIndex(i=>Math.min(historicalSnapshots.length-1,i+1))}>›</button>
   <strong>{yearLabel(snapshot.year)}</strong>
  </div>}
 </div>;
}
export default function LektrusMapAtlas({diagram}:Props){return <AtlasMap diagram={diagram}/>};
