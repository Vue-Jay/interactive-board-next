import {useEffect,useMemo,useRef,useState,type PointerEvent as ReactPointerEvent,type MouseEvent as ReactMouseEvent} from "react";
import type {AtlasDocument,AtlasMode} from "./lektrusAtlasModel";
import LektrusMapBase from "./LektrusMapBase";
import {atlasModes,atlasModesFor,historicalSnapshots,nearestSnapshotIndex,yearLabel} from "./lektrusAtlasModel";
import {borderPrecision,geoFeatureName,featureLabelAnchor,loadAtlasLayer,loadHistoricalSnapshot,mapFeaturePath,
 modernDataProvider,historicDataProvider,projectGeography,featureMapPoint,featureSourceFacts,summariseNamedChanges,
historicalFeatureFacts,loadHistoricalIndex,featureFocusBounds,type HistoricalIndexRecord,type GeoCollection,type GeoFeature} from "./lektrusAtlasData";
import {findHistoricalArticle,historicalRussianName,historyArticleUrl,normalizeHistoricalName} from "./lektrusHistoryEncyclopedia";
import {findHistoricalReference} from "./lektrusHistoricalReferences";
type Props={diagram:AtlasDocument;onChange?:(next:AtlasDocument)=>void};
const MAX_ATLAS_ZOOM=256;
const hash=(value:string)=>{let h=7;for(const ch of value)h=(h*31+ch.charCodeAt(0))|0;return Math.abs(h)};
const palettes=["#c8dced","#e6c6a9","#c8e3cc","#e1d6ed","#ecd9a9","#a9d9dc","#e8c9d7","#d5dab4"];
const precisions=["Источник не указывает точность","Приблизительные границы","Средняя точность","Уточнённая граница"] as const;
const mapModeTitle=(v:AtlasMode)=>atlasModes.find(m=>m.id===v)!.title;
function AtlasMap({diagram:d,onChange}:Props){
 const [mode,setMode]=useState<AtlasMode>(d.title==="Контурная карта"?"contour":d.mode);
 const [paintColor,setPaintColor]=useState("#f3b778");
 const painted=d.paintedCountries??{};
 const savePaint=(next:Record<string,string>)=>onChange?.({...d,paintedCountries:next});
 const isContourTool=d.title==="Контурная карта";
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
 const [tinyCountries,setTinyCountries]=useState<GeoCollection|null>(null);
 const [detailWarning,setDetailWarning]=useState("");
 const [layerWarning,setLayerWarning]=useState("");
 const [compare,setCompare]=useState(false);
 const [selectedLayer,setSelectedLayer]=useState("Государство");
 const [selectedMarker,setSelectedMarker]=useState<string|null>(null);
 const [coord,setCoord]=useState<{lat:number;lon:number}|null>(null);
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState("");
 const [refresh,setRefresh]=useState(0);
 const [selected,setSelected]=useState<GeoFeature|null>(null);
 const [search,setSearch]=useState("");
 const [directoryFilter,setDirectoryFilter]=useState("");
 const [searchAcrossYears,setSearchAcrossYears]=useState(false);
 const [historyTab,setHistoryTab]=useState<"directory"|"article"|"changes">("directory");
 const [historyIndex,setHistoryIndex]=useState<HistoricalIndexRecord[]>([]);
 const [sourceYear,setSourceYear]=useState<number|null>(null);
 const [indexProblem,setIndexProblem]=useState("");
 const pendingJump=useRef<{year:number;raw:string}|null>(null);
 const [scale,setScale]=useState(1);
 const [objectMoveMode,setObjectMoveMode]=useState(false);
 const [position,setPosition]=useState({x:0,y:0});
 const pointer=useRef<{x:number;y:number;fromX:number;fromY:number;id:number}|null>(null);
 const points=useRef(new Map<number,{x:number;y:number}>());
 const pinch=useRef<{distance:number;scale:number;position:{x:number;y:number};mid:{x:number;y:number}}|null>(null);
 const dragged=useRef(false);
 const snapshot=historicalSnapshots[index];
 const modernReference=snapshot.year===2026;
 const russianView=(d.borderView??"source")==="russian";
 const scope=d.scope??(d.mode==="historical"||d.mode==="events"?"history":"geography");
 const availableModes=isContourTool?atlasModesFor(scope).filter(m=>m.id==="contour"):
  atlasModesFor(scope).filter(m=>m.id!=="contour");
 const historical=scope==="history";
 const modernBorders=!historical||modernReference;
 useEffect(()=>{
  if(!historical)return;
  let active=true;setIndexProblem("");
  loadHistoricalIndex().then(rows=>{if(active)setHistoryIndex(rows)})
   .catch(error=>{if(active)setIndexProblem(error instanceof Error?error.message:String(error))});
  return()=>{active=false};
 },[historical,refresh]);
 useEffect(()=>{setMode(d.title==="Контурная карта"?"contour":d.mode);setIndex(nearestSnapshotIndex(d.year));setSelected(null)},
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
  setError("");setLayerWarning("");setLoading(true);setSource(null);setSourceYear(null);setSelected(null);
  setPrevious(null);setSelectedMarker(null);
  const modern=loadAtlasLayer(russianView?"countries-russian":"countries-detail");
  const main=modernBorders?modern:loadHistoricalSnapshot(snapshot.year);
  const before=historical&&!modernReference&&index>0?
   loadHistoricalSnapshot(historicalSnapshots[index-1].year).catch(()=>null):Promise.resolve(null);
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
   setSource(geo);setSourceYear(snapshot.year);setPrevious(prev);setLoading(false);
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
 },[mode,index,refresh,historical,snapshot.year,modernBorders,russianView,modernReference]);
 useEffect(()=>{
  let active=true;
  if(!modernBorders||scale<5||russianView){setDetail(null);setDetailWarning("");return}
  setDetailWarning("");
  loadAtlasLayer("countries-ultra").then(geo=>{if(active)setDetail(geo)})
   .catch(()=>{if(active){setDetail(null);setDetailWarning("Слой 1:10 млн не загрузился, остаётся обзорный масштаб.")}});
  return()=>{active=false};
 },[modernBorders,scale>=5,russianView,refresh]);
 useEffect(()=>{
  let active=true;
  if(!modernBorders){setTinyCountries(null);return}
  loadAtlasLayer("tiny-countries").then(geo=>{if(active)setTinyCountries(geo)})
   .catch(()=>{if(active)setTinyCountries(null)});
  return()=>{active=false};
 },[modernBorders,refresh]);
 const mapSource=historical||mode==="political"||mode==="contour"?
  (modernBorders&&detail&&scale>=5?detail:source):null;
 const highDetail=modernBorders&&(russianView||!!detail&&scale>=5);
 const precision=highDetail?.006:modernBorders?.13:.10;
 const shapes=useMemo(()=>mapSource?.features.map((feature,i)=>({
  feature,path:mapFeaturePath(feature,precision),name:geoFeatureName(feature),i
 })).filter(f=>f.path)||[],[mapSource,precision]);
 const labels=useMemo(()=>shapes.map(s=>({...s,anchor:featureLabelAnchor(s.feature)}))
  .filter(s=>s.anchor&&s.anchor.area*scale*scale>360)
  .sort((a,b)=>b.anchor!.area-a.anchor!.area)
  .slice(0,scale>=12?220:scale>=3?105:45),[shapes,scale]);
 const tinyPoints=useMemo(()=>tinyCountries?.features.map((feature,i)=>({
  feature,point:featureMapPoint(feature),name:geoFeatureName(feature),i
 })).filter(f=>f.point)||[],[tinyCountries]);
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
 const userMarkers=d.markers.filter(marker=>!historical||
  Math.abs(marker.year-snapshot.year)<=Math.max(10,(historicalSnapshots[Math.min(index+1,historicalSnapshots.length-1)].year-
   historicalSnapshots[Math.max(0,index-1)].year)/2));
 const selectedRaw=String(selected?.properties?.NAME??selected?.properties?.ADMIN??"");
 const selectedArticle=selected&&historical&&!modernReference?
  findHistoricalArticle(selectedRaw,snapshot.year):undefined;
 const fallbackReference=selected&&historical&&!modernReference&&!selectedArticle?
  findHistoricalReference(selectedRaw,snapshot.year):undefined;
 const selectedTitle=selected?(selectedArticle?.name??fallbackReference?.title??geoFeatureName(selected)):"";
 const selectedYears=selectedRaw?historyIndex.filter(record=>record.countries.some(name=>
  normalizeHistoricalName(name)===normalizeHistoricalName(selectedRaw))).map(record=>record.year):[];
 const markerDetails=userMarkers.find(m=>m.id===selectedMarker)??null;
 const namedFeatures=mode==="cities"?cityPoints.map(f=>f.feature):
  mode==="relief"?[...landforms.map(f=>f.feature),...peakPoints.map(f=>f.feature)]:
  mode==="hydrography"?[...ponds.map(f=>f.feature),...(rivers?.features??[])]:
  [...shapes.map(f=>f.feature),...(modernBorders?tinyPoints.map(p=>p.feature):[])];
 const directoryEntries=useMemo(()=>historical?[...shapes.map(s=>({name:
  !modernReference?(historicalRussianName(String(s.feature.properties?.NAME??""),snapshot.year)??
   findHistoricalReference(String(s.feature.properties?.NAME??""),snapshot.year)?.title??s.name):s.name,
  feature:s.feature})),...(modernReference?tinyPoints.map(p=>({name:p.name,feature:p.feature})):[])]
  .filter(v=>v.name&&v.name!=="Объект без названия"&&v.name!=="Unknown"&&v.name!=="unknown")
  .sort((a,b)=>a.name.localeCompare(b.name,"ru")):[],[historical,shapes,modernReference,snapshot.year,tinyPoints]);
 const visibleDirectory=directoryEntries.filter(entry=>entry.name.toLocaleLowerCase("ru")
  .includes(directoryFilter.trim().toLocaleLowerCase("ru")));
 const globalMatches=useMemo(()=>{
  const query=directoryFilter.trim().toLocaleLowerCase("ru");
  if(query.length<2)return [];
  const found=new Map<string,{name:string;raw:string;years:number[]}>();
  for(const record of historyIndex){
   for(const raw of record.countries){
    const title=historicalRussianName(raw,record.year)??findHistoricalReference(raw,record.year)?.title??raw;
    if(!title.toLocaleLowerCase("ru").includes(query)&&
     !raw.toLocaleLowerCase("en").includes(query))continue;
    const key=normalizeHistoricalName(raw);
    const old=found.get(key);
    if(old)old.years.push(record.year);
    else found.set(key,{name:title,raw,years:[record.year]});
   }
  }
  return [...found.values()].sort((a,b)=>a.name.localeCompare(b.name,"ru")).slice(0,30);
 },[directoryFilter,historyIndex]);
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
  const s=clamp(next,1,MAX_ATLAS_ZOOM);
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
   const next=clamp(g.scale*Math.hypot(a.x-b.x,a.y-b.y)/g.distance,1,MAX_ATLAS_ZOOM);
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
  if(historical)setHistoryTab("article");
  if(dragged.current||mode==="contour")return;
  setSelected(feature);setSelectedLayer(layer);setSelectedMarker(null);
 };
 const showCountry=(feature:GeoFeature)=>{
  if(mode==="contour"){
   if(dragged.current)return;
   const key=String(feature.properties?.ADM0_A3||feature.properties?.ISO_A3||geoFeatureName(feature));
   savePaint({...painted,[key]:paintColor});
   return;
  }
  selectFeature(feature,historical?"Историческая территория":"Государство");
 };
 const jumpToPeriod=(year:number,raw?:string)=>{
  if(raw)pendingJump.current={year,raw};
  const next=nearestSnapshotIndex(year);
  if(index===next&&raw){
   const feature=source?.features.find(f=>normalizeHistoricalName(String(f.properties?.NAME??""))===
    normalizeHistoricalName(raw));
   if(feature){pendingJump.current=null;focusFeature(feature)}
   return;
  }
  setIndex(next);if(onChange)onChange({...d,year:historicalSnapshots[next].year});
  setSelected(null);setHistoryTab(raw?"article":"directory");
 };
 useEffect(()=>{
  const target=pendingJump.current;
  if(!target||!source||target.year!==snapshot.year||sourceYear!==snapshot.year)return;
  const match=source.features.find(f=>normalizeHistoricalName(String(f.properties?.NAME??""))===
   normalizeHistoricalName(target.raw));
  if(!match)return;
  pendingJump.current=null;
  const point=featureMapPoint(match);
  if(point){const zoom=2.35;setScale(zoom);
   setPosition({x:Math.max(-450*(zoom-1),Math.min(450*(zoom-1),-(point[0]-450)*zoom)),
    y:Math.max(-225*(zoom-1),Math.min(225*(zoom-1),-(point[1]-225)*zoom))})}
  setSelected(match);setSelectedLayer("Историческая территория");setHistoryTab("article");
 },[source,sourceYear,snapshot.year]);
 const onMode=(value:AtlasMode)=>{
  if(!availableModes.some(m=>m.id===value))return;
  setMode(value);setSelected(null);setSearch("");setSelectedMarker(null);
 };
 const pickCoordinates=(e:ReactMouseEvent<SVGSVGElement>)=>{
  if(dragged.current)return;
  const p=worldPoint(localPoint(e as unknown as ReactPointerEvent<SVGSVGElement>));
  if(p.x>=0&&p.x<=900&&p.y>=0&&p.y<=450)
   setCoord({lon:Math.round((p.x/900*360-180)*100)/100,
    lat:Math.round((90-p.y/450*180)*100)/100});
 };
 const focusFeature=(f:GeoFeature)=>{
  const bounds=featureFocusBounds(f);
  const point=bounds?[bounds.x,bounds.y]:featureMapPoint(f);
  if(!point)return;
  const target=bounds&&bounds.width+bounds.height>0?
   Math.min(720/Math.max(bounds.width,.05),340/Math.max(bounds.height,.05)):48;
  const s=clamp(Math.max(2,scale,target),1,MAX_ATLAS_ZOOM);
  setPosition(normalizePosition({x:-(point[0]-450)*s,y:-(point[1]-225)*s},s));
  setScale(s);setSelected(f);if(historical)setHistoryTab("article");setSelectedLayer(mode==="cities"?"Населённый пункт":
   mode==="relief"?"Форма рельефа":mode==="hydrography"?"Водный объект":"Государство");
  setSelectedMarker(null);
 };
 return <div className={"lektrus-atlas "+(historical?"lektrus-atlas-history":"")} aria-label={d.title}
  onPointerDown={e=>{if(!objectMoveMode)e.stopPropagation()}}
  onPointerUp={e=>{if(!objectMoveMode)e.stopPropagation()}}
  onClick={e=>{if(!objectMoveMode)e.stopPropagation()}}>
  <header className="lektrus-atlas-header">
   <strong title={d.title}>{d.title}</strong>
   <button type="button" aria-pressed={objectMoveMode}
    title={objectMoveMode?"Переключить на перемещение внутри карты":"Перемещать объект карты по доске"}
    onPointerDown={e=>e.stopPropagation()} onClick={()=>{setObjectMoveMode(v=>!v);points.current.clear();pointer.current=null;pinch.current=null;dragged.current=false}}>
    {objectMoveMode?"▣ Объект":"✥ Карта"}
   </button>
   <nav role="group" aria-label="Тип карты">
    {availableModes.map(m=><button key={m.id} type="button" title={m.hint}
     aria-pressed={mode===m.id} className={mode===m.id?"selected":""}
     onClick={()=>onMode(m.id)}>{m.title}</button>)}
   </nav>
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
     onClick={objectMoveMode?undefined:pickCoordinates}
     aria-label={historical?"Историческая карта мира: "+yearLabel(snapshot.year):"Карта мира: "+mapModeTitle(mode)}
     onPointerDown={objectMoveMode?undefined:onPointerDown} onPointerMove={objectMoveMode?undefined:onMove}
     onPointerUp={objectMoveMode?undefined:onPointerEnd} onPointerCancel={objectMoveMode?undefined:onPointerEnd}
     onWheel={e=>{
      if(objectMoveMode)return;
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
        const fill=mode==="contour"?(painted[String(s.feature.properties?.ADM0_A3||s.feature.properties?.ISO_A3||s.name)]||"#fafcfb"):mode==="physical"||mode==="relief"?"#d2e5c8":mode==="hydrography"||mode==="cities"?"#e6eee2":
         palettes[hash(s.name)%palettes.length];
        return <path key={s.i} d={s.path} fillRule="evenodd" fill={fill}
         stroke={highlighted||s.name===selectedTitle?"#df793e":mode==="contour"?"#839fb2":"#819fb2"}
         strokeWidth={highlighted||s.name===selectedTitle?1.9:historical&&precise===1?.75:.65}
         vectorEffect="non-scaling-stroke"
         strokeDasharray={historical&&!modernReference&&precise===1?"2.2 1.7":undefined}
         onClick={()=>showCountry(s.feature)} className="lektrus-atlas-country">
         <title>{mode==="contour"?"Граница государства":s.name}</title>
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
      {d.showLabels&&mode!=="contour"&&<g fill="#44566a" fontSize={8/scale} fontWeight="650"
       textAnchor="middle" pointerEvents="none" stroke="#fff" strokeWidth={1.5/scale} paintOrder="stroke">
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
      {modernBorders&&scale<=28&&tinyPoints.map(p=><g key={"tiny-"+p.i}
       transform={`translate(${p.point![0]} ${p.point![1]})`}
       className="lektrus-atlas-event" role="button" tabIndex={0}
       onClick={e=>{e.stopPropagation();if(dragged.current)return;
        const code=String(p.feature.properties?.ADM0_A3||p.feature.properties?.ISO_A3||"");
        const found=shapes.find(s=>code&&String(s.feature.properties?.ADM0_A3||s.feature.properties?.ISO_A3||"")===code)
         ||shapes.find(s=>s.name===p.name);
        focusFeature(found?.feature??p.feature);
       }}
       onKeyDown={e=>{if(e.key==="Enter"){e.preventDefault();focusFeature(p.feature)}}}>
       <circle r={4/scale} strokeWidth={1.2/scale} fill="#ad583b" stroke="white"/>
       <title>{p.name}: показать маленькое государство</title>
      </g>)}
      {userMarkers.map(marker=>{
       const point=projectGeography(marker.lon,marker.lat);
       return <g key={marker.id} transform={`translate(${point[0]} ${point[1]})`}
        className="lektrus-atlas-event" role="button" tabIndex={0}
        onClick={()=>{if(dragged.current)return;setSelectedMarker(marker.id);setSelected(null)}}
        onKeyDown={e=>{if(e.key==="Enter"){setSelectedMarker(marker.id);setSelected(null)}}}>
        <circle r="6" fill="#426fbd" stroke="#fff" strokeWidth="2"/>
        <title>{marker.title} ({yearLabel(marker.year)})</title>
       </g>;
      })}
     </g>
    </svg>
    {!objectMoveMode&&<div className="lektrus-atlas-zoom" role="group" aria-label="Масштаб">
     <button type="button" title="Увеличить масштаб" onClick={()=>zoomAt(scale*1.5)}>+</button>
     <button type="button" onClick={reset} title="Сбросить положение">⌖</button>
     <button type="button" title="Уменьшить масштаб" onClick={()=>zoomAt(scale/1.5)}>−</button>
     <label className="lektrus-atlas-zoom-slider">Масштаб
      <input type="range" min="0" max="8" step=".25"
       aria-label="Уровень детализации карты"
       value={Math.log2(scale)} onChange={e=>zoomAt(Math.pow(2,Number(e.target.value)))}/>
     </label>
    </div>}
    <div className="lektrus-atlas-precision">×{scale.toFixed(1)} · {highDetail?"детали 1:10 млн":modernBorders?"страны 1:50 млн":"историческая реконструкция"} · {coord?
     `${coord.lat.toFixed(2)}°, ${coord.lon.toFixed(2)}°`:objectMoveMode?"режим перемещения объекта":"обзорные геоданные"}</div>
   </div>
   <aside className="lektrus-atlas-sidebar">
    {modernBorders&&<div className="lektrus-atlas-source-note">
     <strong>Покрытие: {source?.features.length??0} территорий</strong>
     <small>Малые, островные государства и отдельные зависимости по данным Natural Earth. Границы 1:10 млн при приближении, не кадастровая точность.</small>
     <label>Картографическая позиция
      <select value={d.borderView??"source"} disabled={!onChange}
       onChange={e=>onChange?.({...d,borderView:e.target.value as "source"|"russian"})}>
       <option value="source">Базовая версия Natural Earth</option>
       <option value="russian">Российская версия Natural Earth</option>
      </select>
     </label>
     {russianView&&<small>Российская версия показывает позицию исходного набора, но не подтверждает актуальность каждого спорного участка на 2026 год.</small>}
    </div>}

    {mode==="contour"&&<div className="lektrus-atlas-paint-tools">
     <strong>Закраска стран</strong>
     <label>Цвет маркера <input type="color" value={paintColor}
      onChange={e=>setPaintColor(e.target.value)} aria-label="Цвет закраски"/></label>
     <button type="button" onClick={()=>setPaintColor("#fafcfb")}>Ластик заливки</button>
     <button type="button" onClick={()=>savePaint({})}>Очистить все заливки</button>
     <small>Выберите цвет и нажимайте на территории. Закраска сохраняется вместе с объектом доски.</small>
    </div>}
    {mode!=="contour"&&!historical&&<label>Поиск объектов
     <input value={search} onChange={e=>setSearch(e.target.value)}
      placeholder={mode==="cities"?"Название города":mode==="hydrography"?"Река или озеро":
       mode==="relief"?"Горы, пустыня, вершина":"Страна или территория"}/>
     {search.trim()&&<small>Найдено: {filteredCount}</small>}
    </label>}
    {search.trim()&&mode!=="contour"&&!historical&&<div className="lektrus-atlas-search-results">
     {results.length?results.map((f,i)=><button key={i} type="button"
      onClick={()=>focusFeature(f)}>{geoFeatureName(f)}</button>):
      <small>Совпадений нет. Названия в данных могут быть на английском.</small>}
    </div>}
    {detailWarning&&<p className="lektrus-atlas-layer-warning" role="status">{detailWarning}</p>}
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
     <strong>{yearLabel(snapshot.year)}{modernReference?" · современный обзор":""}</strong>
     <small>{modernReference?"Современный справочный слой Natural Earth, не точный снимок 2026 года":
      "Датированный исторический снимок, не интерполяция"}</small>
    </div>}
    {historical&&<div className="lektrus-history-tabs" role="tablist" aria-label="Разделы исторического справочника">
     {([["directory","Территории"],["article","Справка"],["changes","Изменения"]] as const)
      .map(([key,title])=><button type="button" key={key} role="tab"
       aria-selected={historyTab===key} className={historyTab===key?"selected":""}
       onClick={()=>setHistoryTab(key)}>{title}</button>)}
    </div>}
    {historical&&historyTab==="directory"&&<div className="lektrus-history-all-periods">
     <strong>Исторические территории</strong>
     <div className="lektrus-history-scope" role="group" aria-label="Где искать">
      <button type="button" className={!searchAcrossYears?"selected":""} aria-pressed={!searchAcrossYears}
       onClick={()=>setSearchAcrossYears(false)}>Этот период</button>
      <button type="button" className={searchAcrossYears?"selected":""} aria-pressed={searchAcrossYears}
       onClick={()=>setSearchAcrossYears(true)}>Все эпохи</button>
     </div>
     <input type="search" value={directoryFilter} onChange={e=>setDirectoryFilter(e.target.value)}
      placeholder="Название государства или территории" aria-label="Поиск исторического государства"/>
     {searchAcrossYears?<>
      <small>{historyIndex.length?historyIndex.length+" датированных карт в индексе":"Загрузка указателя периодов"}</small>
      {indexProblem&&<small>Индекс временно недоступен: {indexProblem}</small>}
      {directoryFilter.trim().length>=2?<div className="lektrus-history-results">
       {globalMatches.length?globalMatches.map(item=><div key={item.raw} className="lektrus-history-result">
        <strong>{item.name}</strong><small>{item.years.length} снимков</small>
        <button type="button" onClick={()=>jumpToPeriod(item.years[item.years.length-1],item.raw)}>
         Показать · {yearLabel(item.years[item.years.length-1])}</button>
       </div>):<small>Совпадений нет. Попробуйте исходное написание названия.</small>}
      </div>:<small>Введите минимум две буквы для поиска по всем эпохам.</small>}
      <small>Периоды присутствия названия не устанавливают даты существования государства.</small>
     </>:<>
      <div className="lektrus-atlas-directory-list" style={{maxHeight:230,overflowY:"auto"}}>
       {visibleDirectory.length?visibleDirectory.slice(0,120).map((entry,i)=><button type="button" key={i}
        onClick={()=>focusFeature(entry.feature)} title={"Показать на карте: "+entry.name}
        style={{display:"block",width:"100%",textAlign:"left",padding:"6px 8px",
         background:selected===entry.feature?"#e2edff":"transparent",border:0,cursor:"pointer"}}>
        {entry.name}
       </button>):<p>Нет названных территорий. Уточните запрос.</p>}
      </div>
      <small>Найдено: {visibleDirectory.length} из {directoryEntries.length}.
       {visibleDirectory.length>120?" Показаны первые 120. Уточните поиск.":""}</small>
     </>}
    </div>}
    {historical&&historyTab!=="article"?null:markerDetails?<div className="lektrus-atlas-description">
     <strong>{markerDetails.title}</strong>
     <p>{markerDetails.description||"Маркер преподавателя"}</p>
     <p>Координаты: {markerDetails.lat.toFixed(3)}°, {markerDetails.lon.toFixed(3)}°</p>
     {historical&&<p>Дата: {yearLabel(markerDetails.year)}</p>}
    </div>:
    selected?<div className="lektrus-atlas-description">
     <strong>{selectedTitle}</strong><small>{selectedLayer}</small>
     {featureSourceFacts(selected).map(f=><p key={f.label}>{f.label}: {f.value}</p>)}
     {historical&&<><p>Точность: {precisions[borderPrecision(selected)]}.</p>
      {selectedArticle&&<div className="lektrus-history-article">
       <p className="lektrus-history-period">{yearLabel(selectedArticle.from)} – {yearLabel(selectedArticle.to)}</p>
       <p><strong>Столица и важные центры:</strong> {selectedArticle.capital}</p>
       <p>{selectedArticle.summary}</p>
       <p><strong>Важное изменение:</strong> {selectedArticle.turn}</p>
       <a target="_blank" rel="noopener noreferrer" href={historyArticleUrl(selectedArticle)}>
        Открыть обзорную статью на русском ↗</a>
       <small>Учебная справка подготовлена отдельно от картографической базы; исторические границы и датировки необходимо сверять с дополнительными источниками.</small>
      </div>}
      {fallbackReference&&<div className="lektrus-history-article">
       <p><strong>{fallbackReference.title}</strong></p>
       {fallbackReference.capital&&<p><strong>Центры:</strong> {fallbackReference.capital}</p>}
       {fallbackReference.formation&&<p><strong>Образование:</strong> {fallbackReference.formation}</p>}
       <p>{fallbackReference.description}</p>
       <p><strong>Изменения:</strong> {fallbackReference.change}</p>
       <a href={fallbackReference.sourceUrl} target="_blank" rel="noopener noreferrer">Подробнее: {fallbackReference.sourceTitle} ↗</a>
      </div>}
      {!selectedArticle&&!fallbackReference&&!modernReference&&<p>Для этой территории ещё нет отдельной энциклопедической карточки. Ниже приведены только сведения исходного картографического набора.</p>}
      {historicalFeatureFacts(selected).map(f=><p key={f.label}><strong>{f.label}:</strong> {f.value}</p>)}
      {!modernReference&&selectedYears.length>0&&<div className="lektrus-history-observed">
       <strong>Название встречается на датированных картах</strong>
       <div>{selectedYears.map(y=><button type="button" key={y}
        className={snapshot.year===y?"selected":""} onClick={()=>jumpToPeriod(y,selectedRaw)}>{yearLabel(y)}</button>)}</div>
       <small>Это только присутствие названия в наборе, не даты основания и распада.</small>
      </div>}
      <p><strong>Период карты:</strong> {yearLabel(snapshot.year)}. Это дата слоя, а не подтверждённые даты существования государства.</p>
      {!selectedArticle&&!fallbackReference&&<p>Столица, правители и причины территориальных изменений не указаны, если их нет в подтверждённых данных.</p>}
      <p>{modernReference?
       "Современная геометрия из Natural Earth. Дата публикации набора не равна точной исторической обстановке 2026 года.":
       "Территория представлена в историческом наборе для "+yearLabel(snapshot.year)+". Границы могут отражать реконструкцию."}</p>
      <p>Названия и границы исходной базы не означают одобрение какой-либо территориальной претензии.</p>
      {selected.properties?.SUBJECTO&&<p>Административная принадлежность в источнике: {String(selected.properties.SUBJECTO)}</p>}
      {selected.properties?.PARTOF&&String(selected.properties.PARTOF)!==selectedTitle&&
       <p>Регион/группа: {String(selected.properties.PARTOF)}</p>}</>}
    </div>:
    historical?<div className="lektrus-atlas-description">
     <strong>Исторический справочник</strong>
     <p>Выберите период, затем территорию на карте либо запись в алфавитном списке. Нажатие на название приближает карту к объекту.</p>
     <p>Справочник показывает только территории из датированного набора. Неизвестные объекты не получают выдуманных названий и описаний.</p>
    </div>:
    <div className="lektrus-atlas-description"><strong>{mapModeTitle(mode)}</strong>
     <p>{atlasModes.find(m=>m.id===mode)?.hint}.</p>
     {mode==="physical"&&<p>Показаны природные объекты из Natural Earth: реки, озёра, ледники, крупные формы рельефа и высотные отметки. Сплошной цифровой модели высот здесь нет.</p>}
     {mode==="hydrography"&&<p>Нажмите на реку или озеро, чтобы изучить объект. Показаны крупные водотоки и озёра обзорного масштаба.</p>}
     {mode==="relief"&&<p>Цвет обозначает географические области, а не точную высоту поверхности. Высотные отметки берутся из атрибутов источника.</p>}
     {mode==="cities"&&<p>Показаны населённые пункты по данным Natural Earth. Оценки населения могут быть устаревшими; размер точки условный.</p>}
     {mode==="contour"&&<p>Названия скрыты: можно дать ученику задание подписать страны или выделить границы средствами доски.</p>}
    </div>}
    {historical&&historyTab==="changes"&&index>0&&<label className="lektrus-atlas-compare">
     <input type="checkbox" checked={compare} onChange={e=>setCompare(e.target.checked)}/>
     <span>Границы предыдущего снимка <small>(красный пунктир)</small></span>
    </label>}
    {historical&&historyTab==="changes"&&changes&&<div className="lektrus-atlas-changes">
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
     <a href={(historical&&!modernReference?historicDataProvider:modernDataProvider).url}
      target="_blank" rel="noopener noreferrer">Источник: {(historical&&!modernReference?historicDataProvider:modernDataProvider).name} ↗</a>
     {historical&&<><small>Границы могут быть приблизительными, спорными или неполными. Современные спорные территории требуют указания картографической позиции.</small>
      <a href={(modernReference?modernDataProvider:historicDataProvider).licenseUrl} target="_blank" rel="noopener noreferrer">Лицензия / условия использования ↗</a></>}
    </div>
   </aside>
  </div>
  {historical&&<div className="lektrus-atlas-timeline">
   <button type="button" disabled={index===0} title="Предыдущий доступный период"
    onClick={()=>jumpToPeriod(historicalSnapshots[Math.max(0,index-1)].year)}>‹</button>
   <select aria-label="Выбрать год исторической карты" className="lektrus-history-period-select"
    value={snapshot.year} onChange={e=>jumpToPeriod(Number(e.target.value))}>
    {historicalSnapshots.map(period=><option key={period.year} value={period.year}>
     {yearLabel(period.year)}{period.year===2026?" · современный обзор":""}</option>)}
   </select>
   <input aria-label="Исторический период" type="range" min={0}
    max={historicalSnapshots.length-1} step={1} value={index}
    onChange={e=>jumpToPeriod(historicalSnapshots[Number(e.target.value)].year)}/>
   <button type="button" disabled={index===historicalSnapshots.length-1} title="Следующий доступный период"
    onClick={()=>jumpToPeriod(historicalSnapshots[Math.min(historicalSnapshots.length-1,index+1)].year)}>›</button>
   <strong>{yearLabel(snapshot.year)}</strong>
   <span className="lektrus-atlas-timeline-count">{index+1}/{historicalSnapshots.length}</span>
  </div>}
 </div>;
}
export default function LektrusMapAtlas({diagram,onChange}:Props){return <AtlasMap diagram={diagram} onChange={onChange}/>};
