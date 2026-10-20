import {useEffect,useMemo,useRef,useState,type PointerEvent as ReactPointerEvent,type MouseEvent as ReactMouseEvent} from "react";
import type {AtlasDocument,AtlasMode} from "./lektrusAtlasModel";
import type {SchoolDiagram} from "./lektrusSchoolDiagramModel";
import LektrusMapBase from "./LektrusMapBase";
import {atlasModes,atlasModesFor,eventsNearYear,historicalSnapshots,nearestSnapshotIndex,schoolHistoryEvents,yearLabel} from "./lektrusAtlasModel";
import {borderPrecision,geoFeatureName,featureLabelAnchor,loadAtlasLayer,loadHistoricalSnapshot,mapFeaturePath,
 modernDataProvider,historicDataProvider,projectGeography,featureMapPoint,featureSourceFacts,geoFeatureKey,summariseNamedChanges,
 type GeoCollection,type GeoFeature} from "./lektrusAtlasData";
type Props={diagram:AtlasDocument;onChange?:(value:SchoolDiagram)=>void};
const precisions=["Неизвестная точность","Приблизительные границы","Средняя точность","Уточнённая граница"] as const;
const mapModeTitle=(v:AtlasMode)=>atlasModes.find(m=>m.id===v)!.title;
function AtlasMap({diagram:d,onChange}:Props){
 const [mode,setMode]=useState<AtlasMode>(d.mode);
 const [paintColor,setPaintColor]=useState("#f6c98c");
 const [index,setIndex]=useState(nearestSnapshotIndex(d.year));
 const [source,setSource]=useState<GeoCollection|null>(null);
 const [baseLand,setBaseLand]=useState<GeoCollection|null>(null);
 const [baseCoastline,setBaseCoastline]=useState<GeoCollection|null>(null);
 const [baseLoading,setBaseLoading]=useState(true);
 const [baseError,setBaseError]=useState("");
 const [previous,setPrevious]=useState<GeoCollection|null>(null);
 const [rivers,setRivers]=useState<GeoCollection|null>(null);
 const [lakes,setLakes]=useState<GeoCollection|null>(null);
 const [cities,setCities]=useState<GeoCollection|null>(null);
 const [regions,setRegions]=useState<GeoCollection|null>(null);
 const [elevations,setElevations]=useState<GeoCollection|null>(null);
 const [glaciers,setGlaciers]=useState<GeoCollection|null>(null);
 const [detail,setDetail]=useState<GeoCollection|null>(null);
 const [layerWarning,setLayerWarning]=useState("");
 const [compare,setCompare]=useState(false);
 const [selectedLayer,setSelectedLayer]=useState("Государство");
 const [selectedMarker,setSelectedMarker]=useState<string|null>(null);
 const [coord,setCoord]=useState<{lat:number;lon:number}|null>(null);
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState("");
 const [refresh,setRefresh]=useState(0);
 const [selected,setSelected]=useState<GeoFeature|null>(null);
 const [eventIndex,setEventIndex]=useState<number|null>(null);
 const [search,setSearch]=useState("");
 const [scale,setScale]=useState(1);
 const [position,setPosition]=useState({x:0,y:0});
 const pointer=useRef<{x:number;y:number;fromX:number;fromY:number;id:number}|null>(null);
 const points=useRef(new Map<number,{x:number;y:number}>());
 const pinch=useRef<{distance:number;scale:number;position:{x:number;y:number};mid:{x:number;y:number}}|null>(null);
 const dragged=useRef(false);
 const snapshot=historicalSnapshots[index];
 const scope=d.scope??(d.mode==="historical"||d.mode==="events"?"history":"geography");
 const availableModes=atlasModesFor(scope).filter(m=>d.mode==="contour"?m.id==="contour":m.id!=="contour");
 const historical=scope==="history";
 useEffect(()=>{setMode(d.mode);setIndex(nearestSnapshotIndex(d.year));setSelected(null);setEventIndex(null)},
  [d.mode,d.year]);
 useEffect(()=>{
  let active=true;
  setBaseError("");setBaseLoading(true);
  Promise.all([loadAtlasLayer("land"),loadAtlasLayer("coastline")]).then(([land,coastline])=>{
   if(!active)return;
   setBaseLand(land);setBaseCoastline(coastline);setBaseLoading(false);
  }).catch(e=>{if(!active)return;
   setBaseError(e instanceof Error?e.message:String(e));setBaseLoading(false);
  });
  return()=>{active=false};
 },[refresh]);
 useEffect(()=>{
  let active=true;
  setError("");setLayerWarning("");setLoading(true);setSource(null);setSelected(null);
  setPrevious(null);setSelectedMarker(null);
  const modern=loadAtlasLayer("countries");
  const main=historical?loadHistoricalSnapshot(snapshot.year):modern;
  const before=historical&&index>0?loadHistoricalSnapshot(historicalSnapshots[index-1].year).catch(()=>null):Promise.resolve(null);
  // Optional thematic layers never replace the original geographic geometry.
  const thematic:ReadonlyArray<[string,boolean]>=[
   ["rivers",mode==="physical"||mode==="hydrography"],
   ["lakes",mode==="physical"||mode==="hydrography"],
   ["cities",mode==="cities"],
   ["regions",mode==="physical"||mode==="relief"],
   ["elevation",mode==="physical"||mode==="relief"],
   ["glaciers",mode==="physical"||mode==="relief"]
  ];
  Promise.all([main,before]).then(async([geo,prev])=>{
   if(!active)return;
   setSource(geo);setPrevious(prev);setLoading(false);
   const requested=thematic.filter(([,needed])=>needed);
   const result=await Promise.allSettled(requested.map(([layer])=>loadAtlasLayer(layer as
    "rivers"|"lakes"|"cities"|"regions"|"elevation"|"glaciers")));
   if(!active)return;
   const missing:string[]=[];
   const found=new Map<string,GeoCollection>();
   requested.forEach(([layer],i)=>{
    const layerResult=result[i];
    if(layerResult.status==="fulfilled")found.set(layer,layerResult.value);
    else missing.push(layer);
   });
   setRivers(found.get("rivers")??null);setLakes(found.get("lakes")??null);
   setCities(found.get("cities")??null);setRegions(found.get("regions")??null);
   setElevations(found.get("elevation")??null);setGlaciers(found.get("glaciers")??null);
   setLayerWarning(missing.length?"Не удалось загрузить некоторые слои: "+missing.join(", "):"");
  }).catch(e=>{
   if(!active)return;
   setError(e instanceof Error?e.message:String(e));setLoading(false);
  });
  return()=>{active=false};
 },[mode,index,refresh,historical,snapshot.year]);
 useEffect(()=>{
  let active=true;
  if(historical||scale<2){setDetail(null);return}
  loadAtlasLayer("countries-detail").then(geo=>{if(active)setDetail(geo)}).catch(()=>{if(active)setDetail(null)});
  return()=>{active=false};
 },[historical,scale]);
 const mapSource=historical||mode==="political"||mode==="contour"?
  (!historical&&detail&&scale>=2?detail:source):null;
 const shapes=useMemo(()=>mapSource?.features.map((feature,i)=>({
  feature,path:mapFeaturePath(feature),name:geoFeatureName(feature),i
 })).filter(f=>f.path)||[],[mapSource]);
 const labels=useMemo(()=>shapes.map(s=>({...s,anchor:featureLabelAnchor(s.feature)}))
  .filter(s=>s.anchor&&s.anchor.area>380)
  .sort((a,b)=>b.anchor!.area-a.anchor!.area)
  .slice(0,45),[shapes]);
 const streams=useMemo(()=>rivers?.features.map((f,i)=>({id:i,path:mapFeaturePath(f),feature:f})).filter(v=>v.path)||[],[rivers]);
 const ponds=useMemo(()=>lakes?.features.map((f,i)=>({id:i,path:mapFeaturePath(f),feature:f})).filter(v=>v.path)||[],[lakes]);
 const landforms=useMemo(()=>regions?.features.map((f,i)=>({id:i,path:mapFeaturePath(f),feature:f}))
  .filter(v=>v.path)||[],[regions]);
 const ice=useMemo(()=>glaciers?.features.map((f,i)=>({id:i,path:mapFeaturePath(f),feature:f}))
  .filter(v=>v.path)||[],[glaciers]);
 const peakPoints=useMemo(()=>elevations?.features.map((f,i)=>({id:i,point:featureMapPoint(f),feature:f}))
  .filter(v=>v.point)||[],[elevations]);
 const cityPoints=useMemo(()=>cities?.features.map((f,i)=>({id:i,point:featureMapPoint(f),feature:f}))
  .filter(v=>v.point)||[],[cities]);
 const changes=useMemo(()=>source&&previous?summariseNamedChanges(previous,source):null,[source,previous]);
 // Curated event markers are not populated automatically: lessons start empty.
 const eventList=useMemo(()=>eventsNearYear(snapshot.year).filter(()=>false),[snapshot.year]);
 const userMarkers=d.markers.filter(marker=>!historical||
  Math.abs(marker.year-snapshot.year)<=Math.max(10,(historicalSnapshots[Math.min(index+1,historicalSnapshots.length-1)].year-
   historicalSnapshots[Math.max(0,index-1)].year)/2));
 const isEventVisible=historical&&d.showEvents;
 const activeEvent=eventIndex===null?null:schoolHistoryEvents[eventIndex]??null;
 const selectedTitle=selected?geoFeatureName(selected):"";
 const markerDetails=userMarkers.find(m=>m.id===selectedMarker)??null;
 const namedFeatures=mode==="cities"?cityPoints.map(f=>f.feature):
  mode==="relief"?[...landforms.map(f=>f.feature),...peakPoints.map(f=>f.feature)]:
  mode==="hydrography"?[...ponds.map(f=>f.feature),...(rivers?.features??[])]:shapes.map(f=>f.feature);
 const results=search.trim()?namedFeatures.filter(f=>geoFeatureName(f).toLocaleLowerCase("ru-RU")
   .includes(search.trim().toLocaleLowerCase("ru-RU"))).slice(0,18):[];
 const filteredCount=search.trim()?namedFeatures.filter(f=>geoFeatureName(f).toLocaleLowerCase("ru-RU").includes(search.trim().toLocaleLowerCase("ru-RU"))).length:0;
 const clamp=(value:number,min:number,max:number)=>Math.max(min,Math.min(max,value));
 const normalizePosition=(p:{x:number;y:number},s:number)=>{
  const limitX=450*(s-1)+40,limitY=225*(s-1)+25;
  return {x:clamp(p.x,-limitX,limitX),y:clamp(p.y,-limitY,limitY)};
 };
 // SVG's own viewport is letterboxed on many mobile screens; browser pixels
 // are never used directly as coordinates in the 900x450 world.
 const localPoint=(e:ReactPointerEvent<SVGSVGElement>)=>{
  const rect=e.currentTarget.getBoundingClientRect(),factor=Math.min(rect.width/900,rect.height/450)||1;
  return {x:(e.clientX-rect.left-(rect.width-900*factor)/2)/factor,
   y:(e.clientY-rect.top-(rect.height-450*factor)/2)/factor};
 };
 const worldPoint=(p:{x:number;y:number})=>({
  x:450+(p.x-450-position.x)/scale,y:225+(p.y-225-position.y)/scale
 });
 const zoomAt=(next:number,point={x:450,y:225})=>{
  const s=clamp(next,1,7);
  setPosition(p=>normalizePosition({
   x:p.x+(scale-s)*(point.x-450-p.x)/scale,
   y:p.y+(scale-s)*(point.y-225-p.y)/scale
  },s));
  setScale(s);
 };
 const onPointerDown=(e:ReactPointerEvent<SVGSVGElement>)=>{
  if(e.pointerType==="mouse"&&e.button!==0)return;
  const pt=localPoint(e);
  points.current.set(e.pointerId,pt);
  if(points.current.size===1){
   dragged.current=false;
   pointer.current={id:e.pointerId,x:pt.x,y:pt.y,fromX:position.x,fromY:position.y};
  }else if(points.current.size===2){
   dragged.current=true;
   const [a,b]=[...points.current.values()];
   pinch.current={distance:Math.hypot(a.x-b.x,a.y-b.y)||1,scale,
    position,mid:{x:(a.x+b.x)/2,y:(a.y+b.y)/2}};
  }
  // Capture only after dragging. Immediate capture would steal click/tap
  // events from countries, rivers, cities and historical markers.
 };
 const onMove=(e:ReactPointerEvent<SVGSVGElement>)=>{
  const pt=localPoint(e);
  if(!points.current.has(e.pointerId))return;
  points.current.set(e.pointerId,pt);
  if(points.current.size===2&&pinch.current){
   const [a,b]=[...points.current.values()],g=pinch.current;
   const next=clamp(g.scale*Math.hypot(a.x-b.x,a.y-b.y)/g.distance,1,7);
   const mid={x:(a.x+b.x)/2,y:(a.y+b.y)/2};
   const focus={x:450+(g.mid.x-450-g.position.x)/g.scale,
    y:225+(g.mid.y-225-g.position.y)/g.scale};
   setScale(next);
   setPosition(normalizePosition({x:mid.x-450-(focus.x-450)*next,
    y:mid.y-225-(focus.y-225)*next},next));
   return;
  }
  const p=pointer.current;if(!p||p.id!==e.pointerId)return;
  if(Math.hypot(pt.x-p.x,pt.y-p.y)>3)dragged.current=true;
  if(dragged.current&&!e.currentTarget.hasPointerCapture(e.pointerId))
   e.currentTarget.setPointerCapture(e.pointerId);
  setPosition(normalizePosition({x:p.fromX+pt.x-p.x,y:p.fromY+pt.y-p.y},scale));
 };
 const onPointerEnd=(e:ReactPointerEvent<SVGSVGElement>)=>{
  points.current.delete(e.pointerId);pinch.current=null;
  if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);
  const next=[...points.current.entries()][0];
  pointer.current=next?{id:next[0],x:next[1].x,y:next[1].y,
   fromX:position.x,fromY:position.y}:null;
 };
 const reset=()=>{setScale(1);setPosition({x:0,y:0});setSelected(null);setCoord(null)};
 const selectFeature=(feature:GeoFeature,layer:string)=>{
  if(dragged.current||mode==="contour")return;
  setSelected(feature);setSelectedLayer(layer);setEventIndex(null);setSelectedMarker(null);
 };
 const showCountry=(feature:GeoFeature)=>{
  if(mode==="contour"){
   const key=geoFeatureKey(feature);
   if(!key||!onChange)return;
   const entries=(d.painted??[]).filter(p=>p.key!==key);
   onChange({...d,painted:paintColor==="#ffffff"?entries:
    [...entries,{key,color:paintColor}].slice(-300)});
   return;
  }
  if(!geoFeatureName(feature))return;
  selectFeature(feature,historical?"Историческая территория":"Государство");
 };
 const onMode=(value:AtlasMode)=>{
  if(!availableModes.some(m=>m.id===value))return;
  setMode(value);setSelected(null);setSearch("");setSelectedMarker(null);setEventIndex(null);
 };
 const pickCoordinates=(e:ReactMouseEvent<SVGSVGElement>)=>{
  if(dragged.current)return;
  const p=worldPoint(localPoint(e as unknown as ReactPointerEvent<SVGSVGElement>));
  if(p.x>=0&&p.x<=900&&p.y>=0&&p.y<=450)
   setCoord({lon:Math.round((p.x/900*360-180)*100)/100,
    lat:Math.round((90-p.y/450*180)*100)/100});
 };
 const focusFeature=(f:GeoFeature)=>{
  const point=featureMapPoint(f);
  if(!point)return;
  const s=Math.max(2,scale);
  setPosition(normalizePosition({x:-(point[0]-450)*s,y:-(point[1]-225)*s},s));
  setScale(s);setSelected(f);setSelectedLayer(mode==="cities"?"Населённый пункт":
   mode==="relief"?"Форма рельефа":mode==="hydrography"?"Водный объект":"Государство");
  setEventIndex(null);setSelectedMarker(null);
 };
 return <div className="lektrus-atlas" aria-label={d.title}
  onPointerDown={e=>e.stopPropagation()} onPointerUp={e=>e.stopPropagation()}
  onClick={e=>e.stopPropagation()} onWheel={e=>{e.stopPropagation();
   setScale(s=>Math.max(1,Math.min(5,Math.round((s+(e.deltaY<0?.2:-.2))*10)/10)));}}>
  <header className="lektrus-atlas-header">
   <strong title={d.title}>{d.title}</strong>
   <nav role="group" aria-label="Тип карты">
    {availableModes.map(m=><button key={m.id} type="button" title={m.hint}
     aria-pressed={mode===m.id} className={mode===m.id?"selected":""}
     onClick={()=>onMode(m.id)}>{m.title}</button>)}
   </nav>
   {mode==="contour"&&<div className="lektrus-atlas-palette" role="group" aria-label="Раскрашивание карты">
    {["#f6c98c","#bed8f1","#bde5ce","#e6c9e9","#ffe7a9","#f6bcc5","#ffffff"].map(color=>
     <button key={color} type="button" disabled={!onChange}
      className={paintColor===color?"selected":""}
      title={color==="#ffffff"?"Стереть заливку":"Раскрасить область"}
      aria-label={color==="#ffffff"?"Стереть цвет":"Цвет "+color}
      style={{background:color}} onClick={()=>setPaintColor(color)} />)}
   </div>}
  </header>
  <div className="lektrus-atlas-body">
   <div className="lektrus-atlas-map-box">
    {(loading||baseLoading)&&<div className="lektrus-atlas-overlay" role="status">Загружается общая подложка и слои карты…</div>}
    {!loading&&!baseLoading&&(error||baseError)&&<div className="lektrus-atlas-overlay lektrus-atlas-failure" role="alert">
     <strong>Карта недоступна</strong><span>{error||baseError}</span>
     <button type="button" onClick={()=>setRefresh(i=>i+1)}>Повторить загрузку</button>
     <small>Границы не заменяются вымышленными. Для доступа необходим интернет.</small>
    </div>}
    <svg viewBox="0 0 900 450" className="lektrus-atlas-svg" role="img"
     onClick={pickCoordinates}
     aria-label={historical?"Историческая карта мира: "+yearLabel(snapshot.year):"Карта мира: "+mapModeTitle(mode)}
     onPointerDown={onPointerDown} onPointerMove={onMove}
     onPointerUp={onPointerEnd} onPointerCancel={onPointerEnd}
     onWheel={e=>{
      e.stopPropagation();e.preventDefault();
      zoomAt(scale*(e.deltaY<0?1.16:1/1.16),localPoint(e as unknown as ReactPointerEvent<SVGSVGElement>));
     }}>
     <g transform={`translate(${position.x} ${position.y}) translate(450 225) scale(${scale}) translate(-450 -225)`}>
      <LektrusMapBase land={baseLand} coastline={baseCoastline}
       grid={d.showGrid||mode==="coordinates"}/>
      <g strokeLinejoin="round">
       {shapes.map(s=>{
        const precise=historical?borderPrecision(s.feature):3;
        const highlighted=!!search&&s.name.toLocaleLowerCase("ru-RU").includes(search.toLocaleLowerCase("ru-RU"));
        const fill=mode==="contour"?(d.painted??[]).find(p=>p.key===geoFeatureKey(s.feature))?.color??"#ffffff":
         mode==="physical"||mode==="relief"?"#e4ebdf":
         mode==="hydrography"||mode==="cities"?"#e6eee2":
         historical?"#e2dfc9":"#dde7d8";
        return <path key={s.i} d={s.path} fillRule="evenodd" fill={fill}
         stroke={highlighted||s.name===selectedTitle?"#df793e":mode==="contour"?"#839fb2":"#819fb2"}
         strokeWidth={highlighted||s.name===selectedTitle?1.9:historical&&precise===1?.75:.48}
         strokeDasharray={historical&&precise===1?"2.2 1.7":undefined}
         onClick={()=>showCountry(s.feature)} className="lektrus-atlas-country">
         <title>{mode==="contour"?"Область для раскрашивания":s.name||"Территория без подтверждённого названия"}</title>
        </path>;
       })}
      </g>
      {(mode==="physical"||mode==="relief")&&<g>
       {landforms.map(f=><path key={"landform-"+f.id} d={f.path}
        fill="#c6b093" fillOpacity=".48" stroke="#a68b72" strokeWidth=".4"
        className="lektrus-atlas-country" onClick={()=>selectFeature(f.feature,"Форма рельефа")}>
        <title>{geoFeatureName(f.feature)}</title></path>)}
       {ice.map(f=><path key={"ice-"+f.id} d={f.path}
        fill="#f8fcff" stroke="#9dbdd0" strokeWidth=".6"
        className="lektrus-atlas-country" onClick={()=>selectFeature(f.feature,"Ледниковая область")}>
        <title>{geoFeatureName(f.feature)}</title></path>)}
      </g>}
      {mode==="coordinates"&&coord&&<g transform={`translate(${projectGeography(coord.lon,coord.lat)[0]} ${projectGeography(coord.lon,coord.lat)[1]})`}
       pointerEvents="none" stroke="#dd653e" strokeWidth=".9">
       <circle r="5.5" fill="#fff" fillOpacity=".7"/><path d="M-10 0H10M0 -10V10"/>
      </g>}
      {historical&&compare&&previous&&<g fill="none" stroke="#d64646"
       strokeWidth="1.1" strokeDasharray="4 2" pointerEvents="none">
       {previous.features.map((f,i)=><path key={"prior-"+i} d={mapFeaturePath(f)}/>)}
      </g>}
      {d.showLabels&&mode!=="contour"&&<g fill="#44566a" fontSize="8" fontWeight="650"
       textAnchor="middle" pointerEvents="none" stroke="#fff" strokeWidth="1.5" paintOrder="stroke">
       {labels.map(s=><text key={s.i} x={s.anchor!.x} y={s.anchor!.y}>{s.name.slice(0,23)}</text>)}
      </g>}
      {(mode==="physical"||mode==="hydrography")&&<g>
       {ponds.map(l=><path key={"lake-"+l.id} d={l.path} fill="#87bfe6" stroke="#65a3ce" strokeWidth=".65"
        onClick={()=>selectFeature(l.feature,"Озеро")} className="lektrus-atlas-country">
        <title>{geoFeatureName(l.feature)}</title></path>)}
       {streams.map(l=><path key={"river-"+l.id} d={l.path} fill="none" stroke="#328fc9"
        strokeWidth={mode==="hydrography"?1.4:.9} pointerEvents="stroke" strokeLinecap="round"
        onClick={()=>selectFeature(l.feature,"Река")} className="lektrus-atlas-country">
        <title>{geoFeatureName(l.feature)}</title></path>)}
      </g>}
      {(mode==="physical"||mode==="relief")&&<g>
       {peakPoints.map(f=><g key={"elevation-"+f.id}
        transform={`translate(${f.point![0]} ${f.point![1]})`}
        className="lektrus-atlas-event" onClick={()=>selectFeature(f.feature,"Высотная отметка")}>
        <path d="M0 -4L4 3H-4Z" fill="#816245" stroke="#fff" strokeWidth=".7"/>
        <title>{geoFeatureName(f.feature)}</title>
       </g>)}
      </g>}
      {mode==="cities"&&<g>
       {cityPoints.map(f=><g key={"city-"+f.id}
        transform={`translate(${f.point![0]} ${f.point![1]})`}
        className="lektrus-atlas-event" onClick={()=>selectFeature(f.feature,"Населённый пункт")}>
        <circle r={Math.max(2.5,Math.min(4.5,2.5+Number(f.feature.properties?.POP_MAX||0)/1e7))}
         fill="#c05745" stroke="#fff" strokeWidth=".8"/>
        <title>{geoFeatureName(f.feature)}</title>
       </g>)}
       {d.showLabels&&cityPoints.filter(f=>Number(f.feature.properties?.POP_MAX||0)>=2500000)
        .slice(0,60).map(f=><text key={"city-label-"+f.id}
         x={f.point![0]+5} y={f.point![1]-5} fontSize="7"
         fill="#764b3c" stroke="#fff" strokeWidth="1.7" paintOrder="stroke"
         pointerEvents="none">{geoFeatureName(f.feature)}</text>)}
      </g>}
      {isEventVisible&&eventList.map(event=>{
       const point=projectGeography(event.lon,event.lat),key=schoolHistoryEvents.indexOf(event);
       return <g key={event.year} transform={`translate(${point[0]} ${point[1]})`}
        className="lektrus-atlas-event" role="button" tabIndex={0}
        onClick={()=>{if(dragged.current)return;setEventIndex(key);setSelected(null);setSelectedMarker(null)}}
        onKeyDown={e=>{if(e.key==="Enter"){setEventIndex(key);setSelected(null)}}}>
        <circle r="8" fill="#fff" opacity=".88"/>
        <circle r="5.5" fill="#dd7656" stroke="#fff" strokeWidth="1.5"/>
        <title>{event.year}: {event.title}</title>
       </g>;
      })}
      {userMarkers.map(marker=>{
       const point=projectGeography(marker.lon,marker.lat);
       return <g key={marker.id} transform={`translate(${point[0]} ${point[1]})`}
        className="lektrus-atlas-event" role="button" tabIndex={0}
        onClick={()=>{if(dragged.current)return;setSelectedMarker(marker.id);setSelected(null);setEventIndex(null)}}
        onKeyDown={e=>{if(e.key==="Enter"){setSelectedMarker(marker.id);setSelected(null);setEventIndex(null)}}}>
        <circle r="6" fill="#426fbd" stroke="#fff" strokeWidth="2"/>
        <title>{marker.title} ({yearLabel(marker.year)})</title>
       </g>;
      })}
     </g>
    </svg>
    <div className="lektrus-atlas-zoom" role="group" aria-label="Масштаб">
     <button type="button" title="Увеличить масштаб" onClick={()=>zoomAt(scale*1.5)}>+</button>
     <button type="button" onClick={reset} title="Сбросить положение">⌖</button>
     <button type="button" title="Уменьшить масштаб" onClick={()=>zoomAt(scale/1.5)}>−</button>
    </div>
    <div className="lektrus-atlas-precision">×{scale.toFixed(1)} · {coord?
     `${coord.lat.toFixed(2)}°, ${coord.lon.toFixed(2)}°`:"обзорные геоданные"}</div>
   </div>
   <aside className="lektrus-atlas-sidebar">
    {mode!=="contour"&&<label>Поиск объектов
     <input value={search} onChange={e=>setSearch(e.target.value)}
      placeholder={mode==="cities"?"Название города":mode==="hydrography"?"Река или озеро":
       mode==="relief"?"Горы, пустыня, вершина":"Страна или территория"}/>
     {search.trim()&&<small>Найдено: {filteredCount}</small>}
    </label>}
    {search.trim()&&mode!=="contour"&&<div className="lektrus-atlas-search-results">
     {results.length?results.map((f,i)=><button key={i} type="button"
      onClick={()=>focusFeature(f)}>{geoFeatureName(f)}</button>):
      <small>Совпадений нет. Названия в данных могут быть на английском.</small>}
    </div>}
    {layerWarning&&<p className="lektrus-atlas-layer-warning" role="status">
     {layerWarning}. Доступные слои отображаются без подмены.</p>}
    {mode==="coordinates"&&<div className="lektrus-atlas-description">
     <strong>Географические координаты</strong>
     <p>Нажмите на карту: широта и долгота определяются с учётом масштаба и перемещения.</p>
     {coord?<p>{Math.abs(coord.lat).toFixed(2)}° {coord.lat>=0?"с. ш.":"ю. ш."},
      {" "}{Math.abs(coord.lon).toFixed(2)}° {coord.lon>=0?"в. д.":"з. д."}</p>:
      <p>Точка пока не выбрана.</p>}
    </div>}
    {historical&&<div className="lektrus-atlas-year-header">
     <strong>{yearLabel(snapshot.year)}</strong>
     <small>{snapshot.year===2026?
      "Современный справочный слой Natural Earth. Не официальная историческая карта и не юридическая фиксация границ 2026 года.":
      "Исторический датированный снимок. Оценочная точность зависит от эпохи."}</small>
    </div>}
    {markerDetails?<div className="lektrus-atlas-description">
     <strong>{markerDetails.title}</strong>
     <p>{markerDetails.description||"Маркер преподавателя"}</p>
     <p>Координаты: {markerDetails.lat.toFixed(3)}°, {markerDetails.lon.toFixed(3)}°</p>
     {historical&&<p>Дата: {yearLabel(markerDetails.year)}</p>}
    </div>:activeEvent?<div className="lektrus-atlas-description">
     <strong>{activeEvent.title} · {activeEvent.year} г.</strong>
     <p>{activeEvent.description}</p>
     <a href={activeEvent.url} target="_blank" rel="noopener noreferrer">Подробнее об историческом событии ↗</a>
    </div>:
    selected?<div className="lektrus-atlas-description">
     <strong>{selectedTitle}</strong><small>{selectedLayer}</small>
     {featureSourceFacts(selected).map(f=><p key={f.label}>{f.label}: {f.value}</p>)}
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
     {mode==="physical"&&<p>Показаны природные объекты из Natural Earth: реки, озёра, ледники, крупные формы рельефа и высотные отметки. Сплошной цифровой модели высот здесь нет.</p>}
     {mode==="hydrography"&&<p>Нажмите на реку или озеро, чтобы изучить объект. Показаны крупные водотоки и озёра обзорного масштаба.</p>}
     {mode==="relief"&&<p>Цвет обозначает географические области, а не точную высоту поверхности. Высотные отметки берутся из атрибутов источника.</p>}
     {mode==="cities"&&<p>Показаны населённые пункты по данным Natural Earth. Оценки населения могут быть устаревшими; размер точки условный.</p>}
     {mode==="contour"&&<p>Выберите цвет в палитре и нажимайте на страны. Белый цвет стирает заливку. Изменения сохраняются с доской.</p>}
    </div>}
    {historical&&<div className="lektrus-atlas-history-events">
     <strong>Важные события периода</strong>
     {eventList.length?eventList.map(event=><button key={event.year}
      type="button" className={eventIndex!==null&&schoolHistoryEvents[eventIndex]===event?"selected":""}
      onClick={()=>{setEventIndex(schoolHistoryEvents.indexOf(event));setSelected(null)}}>
      {yearLabel(event.year)} · {event.title}</button>):<p>В учебной подборке для этого промежутка события пока не описаны.</p>}
    </div>}
    {historical&&index>0&&snapshot.year!==2026&&<label className="lektrus-atlas-compare">
     <input type="checkbox" checked={compare} onChange={e=>setCompare(e.target.checked)}/>
     <span>Границы предыдущего снимка <small>(красный пунктир)</small></span>
    </label>}
    {historical&&snapshot.year!==2026&&changes&&<div className="lektrus-atlas-changes">
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
     {historical&&<><small>Границы могут быть приблизительными, спорными или неполными.</small>
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
   <span className="lektrus-atlas-timeline-count">{index+1}/{historicalSnapshots.length}</span>
  </div>}
 </div>;
}
export default function LektrusMapAtlas({diagram,onChange}:Props){return <AtlasMap diagram={diagram} onChange={onChange}/>};
