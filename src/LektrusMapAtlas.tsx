import {useEffect,useMemo,useRef,useState,type PointerEvent as ReactPointerEvent,type MouseEvent as ReactMouseEvent} from "react";
import type {AtlasDocument,AtlasMode} from "./lektrusAtlasModel";
import LektrusMapBase from "./LektrusMapBase";
import {fetchCityArea,cityAreaId,type AtlasCityArea} from "./lektrusAtlasCityArea";
import {loadLocalInfrastructure,loadMineralDeposits,mineralCommodity,mineralTypes,
 canLoadLocalRoads,canLoadMinerals,externalBBoxKey,type ExternalBounds} from "./lektrusAtlasExternal";
import {russianPlaceName,nationalCapital,alternateCapital,cityPopulation,chooseCityLabels,limitCitySymbols,applyVerifiedCapitalUpdates2026,capitalsForCountry,matchesCityCategory,type CityCategory} from "./lektrusAtlasPlaces";
import LektrusAtlasTerrain,{sampleTerrainElevation,type TerrainStatus} from "./LektrusAtlasTerrain";
import {atlasRiverStroke,atlasLakeStroke,atlasGlacierStroke,atlasWaterGeometryTolerance,atlasRiverLabelRank} from "./lektrusAtlasHydro";
import {atlasRegions,atlasRegionGroups,findAtlasRegion,atlasRegionCamera,atlasDistanceScale} from "./lektrusAtlasRegions";
import {atlasModes,atlasModesFor,historicalSnapshots,nearestSnapshotIndex,yearLabel} from "./lektrusAtlasModel";
import {borderPrecision,geoFeatureName,hasAtlasName,isRussianAtlasName,featureLabelAnchor,loadAtlasLayer,loadHistoricalSnapshot,mapFeaturePath,
 modernDataProvider,historicDataProvider,projectGeography,featureMapPoint,featureSourceFacts,summariseNamedChanges,
historicalFeatureFacts,loadHistoricalIndex,featureFocusBounds,featureLineMidpoint,type MapWindow,type HistoricalIndexRecord,type GeoCollection,type GeoFeature} from "./lektrusAtlasData";
import {findHistoricalArticle,historicalRussianName,historyArticleUrl,normalizeHistoricalName} from "./lektrusHistoryEncyclopedia";
import {findHistoricalReference} from "./lektrusHistoricalReferences";
type Props={diagram:AtlasDocument;onChange?:(next:AtlasDocument)=>void};
const MAX_ATLAS_ZOOM=16384;
const hash=(value:string)=>{let h=7;for(const ch of value)h=(h*31+ch.charCodeAt(0))|0;return Math.abs(h)};
const palettes=["#c8dced","#e6c6a9","#c8e3cc","#e1d6ed","#ecd9a9","#a9d9dc","#e8c9d7","#d5dab4"];
const precisions=["Источник не указывает точность","Приблизительные границы","Средняя точность","Уточнённая граница"] as const;
const mapModeTitle=(v:AtlasMode)=>atlasModes.find(m=>m.id===v)!.title;
const landformColors={
 mountains:{fill:"#b79877",opacity:.62,label:"Горные районы"},
 plateau:{fill:"#cdb39a",opacity:.55,label:"Плоскогорья и нагорья"},
 deserts:{fill:"#ecd6a6",opacity:.72,label:"Пустыни"},
 plains:{fill:"#c8e0b0",opacity:.6,label:"Равнины"},
 basins:{fill:"#b9ddc9",opacity:.54,label:"Низменности и котловины"},
 other:{fill:"#d4dcc5",opacity:.22,label:"Другие природные области"}
} as const;
const landformClass=(f:GeoFeature):keyof typeof landformColors=>{
 const raw=String(f.properties?.FEATURECLA??f.properties?.FEATURECLASS??"").toLowerCase();
 if(/range\/mtn|mountain|highland/.test(raw))return "mountains";
 if(/plateau|upland/.test(raw))return "plateau";
 if(/desert/.test(raw))return "deserts";
 if(/plain|steppe|lowland/.test(raw))return "plains";
 if(/basin|depression|valley/.test(raw))return "basins";
 return "other";
};

/** Only source-backed Russian titles; historical lookups are period-specific. */
export function atlasDisplayName(feature:GeoFeature,year:number,history:boolean):string{
 const direct=geoFeatureName(feature);
 if(!history)return direct;
 const raw=String(feature.properties?.NAME??feature.properties?.name??"").trim();
 const found=historicalRussianName(raw,year)??findHistoricalArticle(raw,year)?.name??
  findHistoricalReference(raw,year)?.title;
 return isRussianAtlasName(found)?found.trim():direct;
}
function AtlasMap({diagram:d,onChange}:Props){
 const [mode,setMode]=useState<AtlasMode>(d.title==="Контурная карта"?"contour":d.mode);
 const [paintColor,setPaintColor]=useState("#f3b778");
 const [paintRegions,setPaintRegions]=useState(false);
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
 const [marine,setMarine]=useState<GeoCollection|null>(null);
 const [physicalLabels,setPhysicalLabels]=useState<GeoCollection|null>(null);
 const [lakes,setLakes]=useState<GeoCollection|null>(null);
 const [cities,setCities]=useState<GeoCollection|null>(null);
 const [cityResolution,setCityResolution]=useState("не загружен");
 const [minCityPopulation,setMinCityPopulation]=useState(d.cityMinPopulation??0);
 const [cityCategory,setCityCategory]=useState<CityCategory>(d.cityCategory??"all");
 const [regions,setRegions]=useState<GeoCollection|null>(null);
 const [administrative,setAdministrative]=useState<GeoCollection|null>(null);
 const [elevations,setElevations]=useState<GeoCollection|null>(null);
 const [glaciers,setGlaciers]=useState<GeoCollection|null>(null);
 const [detail,setDetail]=useState<GeoCollection|null>(null);
 const [detailWarning,setDetailWarning]=useState("");
 const [layerWarning,setLayerWarning]=useState("");
 const [hydroResolution,setHydroResolution]=useState("обзорный слой");
 const [terrainStatus,setTerrainStatus]=useState<TerrainStatus>({total:0,loaded:0,failed:0});
 const [terrainPick,setTerrainPick]=useState<{lat:number;lon:number;metres:number|null;pending:boolean;error:boolean}|null>(null);
 const heightRequest=useRef(0);
 const [compare,setCompare]=useState(false);
 const [selectedLayer,setSelectedLayer]=useState("Государство");
 const [selectedMarker,setSelectedMarker]=useState<string|null>(null);
 const [coord,setCoord]=useState<{lat:number;lon:number}|null>(null);
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState("");
 const [refresh,setRefresh]=useState(0);
 const [selected,setSelected]=useState<GeoFeature|null>(null);
 const [cityArea,setCityArea]=useState<AtlasCityArea|null>(null);
 const [cityAreaLoading,setCityAreaLoading]=useState(false);
 const [cityAreaMessage,setCityAreaMessage]=useState("");
 const [infrastructure,setInfrastructure]=useState<GeoCollection|null>(null);
 const [infrastructureError,setInfrastructureError]=useState("");
 const [minerals,setMinerals]=useState<GeoCollection|null>(null);
 const [mineralError,setMineralError]=useState("");
 const [mineralLoading,setMineralLoading]=useState(false);
 const [mineralFilter,setMineralFilter]=useState("Все виды");
 const [selectedMineral,setSelectedMineral]=useState<GeoFeature|null>(null);
 const [search,setSearch]=useState("");
 const [focusedUnit,setFocusedUnit]=useState("");
 const [directoryFilter,setDirectoryFilter]=useState("");
 const [searchAcrossYears,setSearchAcrossYears]=useState(false);
 const [historyTab,setHistoryTab]=useState<"directory"|"article"|"changes">("directory");
 const [historyIndex,setHistoryIndex]=useState<HistoricalIndexRecord[]>([]);
 const [sourceYear,setSourceYear]=useState<number|null>(null);
 const [indexProblem,setIndexProblem]=useState("");
 const pendingJump=useRef<{year:number;raw:string}|null>(null);
 const [scale,setScale]=useState(1);
 const [regionId,setRegionId]=useState(d.regionId??"world");
 const selectedRegion=findAtlasRegion(regionId);
 const detailedGeography=scale>=3||regionId!=="world";
 const veryDetailedHydro=(mode==="physical"||mode==="hydrography")&&scale>=24;
 const detailedCities=mode==="cities"&&scale>=4;
 const [objectMoveMode,setObjectMoveMode]=useState(false);
 const [position,setPosition]=useState({x:0,y:0});
 const distanceBar=atlasDistanceScale(scale,position.y);
 const mapText=(base:number)=>Math.min(15.5,base+Math.log2(Math.max(1,scale))*1.05)/scale;
 const pointer=useRef<{x:number;y:number;fromX:number;fromY:number;id:number}|null>(null);
 const points=useRef(new Map<number,{x:number;y:number}>());
 const pinch=useRef<{distance:number;scale:number;position:{x:number;y:number};mid:{x:number;y:number}}|null>(null);
 const dragged=useRef(false);
 const snapshot=historicalSnapshots[index];
 const modernReference=snapshot.year===2026;
 const russianView=true; // Modern map: fixed Russian Natural Earth POV.
 const scope=d.scope??(d.mode==="historical"||d.mode==="events"?"history":"geography");
 useEffect(()=>{setRegionId(d.regionId??"world")},[d.regionId]);
 useEffect(()=>{setMinCityPopulation(d.cityMinPopulation??0)},[d.cityMinPopulation]);
 useEffect(()=>{setCityCategory(d.cityCategory??"all")},[d.cityCategory]);
 useEffect(()=>{const camera=atlasRegionCamera(findAtlasRegion(regionId));setScale(camera.scale);
  setPosition(camera.position);setSelected(null);setCoord(null)},[regionId]);
 const availableModes=isContourTool?atlasModesFor(scope).filter(m=>m.id==="contour"):
  atlasModesFor(scope).filter(m=>m.id!=="contour");
 const historical=scope==="history";
 const modernBorders=!historical||modernReference;
 const needsPoliticalGeometry=historical||mode==="political"||mode==="contour";
 const terrainEnabled=(mode==="physical"||mode==="relief")&&d.hypsometry!==false;
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
  Promise.all([loadAtlasLayer(detailedGeography?"land-detail":"land"),
   loadAtlasLayer(detailedGeography?"coastline-detail":"coastline")]).then(([land,coastline])=>{
   if(!active)return;
   setBaseLand(land);setBaseCoastline(coastline);setBaseLoading(false);
  }).catch(e=>{if(!active)return;
   setBaseError(e instanceof Error?e.message:String(e));setBaseLoading(false);
  });
  return()=>{active=false};
 },[refresh,detailedGeography]);
 useEffect(()=>{
  let active=true;
  setError("");setLayerWarning("");setLoading(true);setSource(null);setSourceYear(null);setSelected(null);
  setPrevious(null);setSelectedMarker(null);
  const modern=needsPoliticalGeometry?loadAtlasLayer("countries-russian"):Promise.resolve(null);
  const main=modernBorders?modern:loadHistoricalSnapshot(snapshot.year);
  const before=historical&&!modernReference&&index>0?
   loadHistoricalSnapshot(historicalSnapshots[index-1].year).catch(()=>null):Promise.resolve(null);
  // Optional thematic layers never replace the original geographic geometry.
  const thematic:ReadonlyArray<[string,boolean]>=[
   ["rivers",!detailedGeography&&(mode==="physical"||mode==="hydrography")],
   ["rivers-regional",detailedGeography&&!veryDetailedHydro&&(mode==="physical"||mode==="hydrography")],
   ["rivers-ultra",veryDetailedHydro],
   ["lakes",!detailedGeography&&(mode==="physical"||mode==="hydrography")],
   ["lakes-regional",detailedGeography&&!veryDetailedHydro&&(mode==="physical"||mode==="hydrography")],
   ["lakes-ultra",veryDetailedHydro],
   ["cities",mode==="political"],
   ["cities-regional",mode==="cities"&&!detailedCities],
   ["cities-local",detailedCities],
   ["admin-regional",regionId!=="world"&&!historical],
   ["regions",!detailedGeography&&(mode==="physical"||mode==="relief")],
   ["regions-regional",detailedGeography&&(mode==="physical"||mode==="relief")],
   ["elevation",!detailedGeography&&(mode==="physical"||mode==="relief")],
   ["elevation-regional",detailedGeography&&(mode==="physical"||mode==="relief")],
   ["glaciers",!detailedGeography&&(mode==="physical"||mode==="relief")],
   ["glaciers-regional",detailedGeography&&(mode==="physical"||mode==="relief")],
   ["marine",mode==="physical"||mode==="hydrography"],
   ["physical-labels",mode==="physical"||mode==="relief"]
  ];
  Promise.all([main,before]).then(async([geo,prev])=>{
   if(!active)return;
   setSource(geo);setSourceYear(snapshot.year);setPrevious(prev);setLoading(false);
   const requested=thematic.filter(([,needed])=>needed);
   let localCityLoaded=false,highRiversLoaded=false,highLakesLoaded=false;
   const result=await Promise.allSettled(requested.map(([layer])=>layer==="rivers-ultra"?
    loadAtlasLayer("rivers-ultra").then(geo=>{highRiversLoaded=true;return geo})
     .catch(()=>loadAtlasLayer("rivers-regional")):
    layer==="lakes-ultra"?
    loadAtlasLayer("lakes-ultra").then(geo=>{highLakesLoaded=true;return geo})
     .catch(()=>loadAtlasLayer("lakes-regional")):
    layer==="cities-local"?
    loadAtlasLayer("cities-local").then(geo=>{localCityLoaded=true;return geo}).catch(()=>loadAtlasLayer("cities-regional")):loadAtlasLayer(layer as
    "rivers"|"rivers-regional"|"rivers-ultra"|"lakes"|"lakes-regional"|"lakes-ultra"|"cities"|"cities-regional"|"cities-local"|"admin-regional"|"regions"|"regions-regional"|"elevation"|"elevation-regional"|"glaciers"|"glaciers-regional"|"marine"|"physical-labels")));
   if(!active)return;
   const missing:string[]=[];
   const found=new Map<string,GeoCollection>();
   requested.forEach(([layer],i)=>{
    const layerResult=result[i];
    if(layerResult.status==="fulfilled")found.set(layer,layerResult.value);
    else missing.push(layer);
   });
   setRivers(found.get("rivers-ultra")??found.get("rivers-regional")??found.get("rivers")??null);
   setMarine(found.get("marine")??null);setPhysicalLabels(found.get("physical-labels")??null);
   setLakes(found.get("lakes-ultra")??found.get("lakes-regional")??found.get("lakes")??null);
   setHydroResolution(veryDetailedHydro?
    "Реки: "+(highRiversLoaded?"1:10 млн":"1:50 млн (резервный)")+
    "; озёра: "+(highLakesLoaded?"1:10 млн":"1:50 млн (резервный)"):
    detailedGeography?"1:50 млн":"1:110 млн");
   const citySource=found.get("cities-local")??found.get("cities-regional")??found.get("cities")??null;
   setCities(citySource?applyVerifiedCapitalUpdates2026(citySource):null);
   setCityResolution(found.has("cities-local")?(localCityLoaded?"1:10 млн":"1:50 млн, резервный"):
    found.has("cities-regional")?"1:50 млн":found.has("cities")?"1:110 млн":"не загружен");
   setAdministrative(found.get("admin-regional")??null);
   setRegions(found.get("regions-regional")??found.get("regions")??null);
   setElevations(found.get("elevation-regional")??found.get("elevation")??null);
   setGlaciers(found.get("glaciers-regional")??found.get("glaciers")??null);
   setLayerWarning(missing.length?"Не удалось загрузить некоторые слои: "+missing.join(", "):"");
  }).catch(e=>{
   if(!active)return;
   setError(e instanceof Error?e.message:String(e));setLoading(false);
  });
  return()=>{active=false};
 },[mode,index,refresh,historical,snapshot.year,modernBorders,modernReference,detailedGeography,detailedCities,veryDetailedHydro,regionId,needsPoliticalGeometry]);
 useEffect(()=>{
  let active=true;
  if(!modernBorders||scale<5||russianView){setDetail(null);setDetailWarning("");return}
  setDetailWarning("");
  loadAtlasLayer("countries-ultra").then(geo=>{if(active)setDetail(geo)})
   .catch(()=>{if(active){setDetail(null);setDetailWarning("Слой 1:10 млн не загрузился, остаётся обзорный масштаб.")}});
  return()=>{active=false};
 },[modernBorders,scale>=5,russianView,refresh]);
 const mapSource=historical||mode==="political"||mode==="contour"?source:null;
 const highDetail=modernBorders&&(russianView||!!detail&&scale>=5);
 const precision=highDetail?(scale>=8?.00015:.08):modernBorders?.13:.10;
 // Land and coastlines remain cartographic background; selectable territories need names.
 const mapSourceFeatures=useMemo(()=>mapSource?.features.filter(f=>
  !!atlasDisplayName(f,snapshot.year,historical&&!modernReference))??[],
  [mapSource,snapshot.year,historical,modernReference]);
 // Quantized viewport tiles avoid rebuilding expensive high-resolution paths on every pointer move.
 const tileScale=Math.pow(2,Math.floor(Math.log2(scale)));
 const tileWidth=900/tileScale,tileHeight=450/tileScale;
 const tileX=Math.round((450-position.x/scale)/tileWidth);
 const tileY=Math.round((225-position.y/scale)/tileHeight);
 const viewport=useMemo<MapWindow|undefined>(()=>highDetail&&scale>=8?
  {left:(tileX-3)*tileWidth,right:(tileX+3)*tileWidth,
   top:(tileY-3)*tileHeight,bottom:(tileY+3)*tileHeight}:undefined,
  [highDetail,tileX,tileY,tileScale,scale>=8]);
 const shapes=useMemo(()=>mapSourceFeatures.map((feature,i)=>({
  feature,path:mapFeaturePath(feature,precision,viewport),
  name:atlasDisplayName(feature,snapshot.year,historical&&!modernReference),i
 })).filter(f=>f.path&&f.name),[mapSourceFeatures,precision,viewport,snapshot.year,historical,modernReference]);
 const labels=useMemo(()=>shapes.map(s=>({...s,anchor:featureLabelAnchor(s.feature)}))
  .filter(s=>s.anchor&&s.anchor.area*scale*scale>360)
  .sort((a,b)=>b.anchor!.area-a.anchor!.area)
  .slice(0,scale>=12?220:scale>=3?105:45),[shapes,scale]);
 const waterTolerance=atlasWaterGeometryTolerance(Math.pow(2,Math.floor(Math.log2(scale))),detailedGeography);
 const streams=useMemo(()=>rivers?.features.filter(hasAtlasName).map((f,i)=>({
  id:i,path:mapFeaturePath(f,waterTolerance,viewport),feature:f
 })).filter(v=>v.path)||[],[rivers,waterTolerance,viewport]);
 const riverNames=useMemo(()=>rivers?.features.filter(hasAtlasName).map((f,i)=>({
  id:i,point:featureLineMidpoint(f),feature:f
 })).filter(f=>f.point).sort((a,b)=>atlasRiverLabelRank(a.feature)-atlasRiverLabelRank(b.feature))||[],[rivers]);
 const ponds=useMemo(()=>lakes?.features.filter(hasAtlasName).map((f,i)=>({
  id:i,path:mapFeaturePath(f,waterTolerance*.7,viewport),feature:f
 })).filter(v=>v.path)||[],[lakes,waterTolerance,viewport]);
 const lakeNames=useMemo(()=>lakes?.features.filter(hasAtlasName).map((f,i)=>({
  id:i,point:featureMapPoint(f),feature:f
 })).filter(f=>f.point).sort((a,b)=>
  Number(a.feature.properties?.scalerank??a.feature.properties?.SCALERANK??9)-
  Number(b.feature.properties?.scalerank??b.feature.properties?.SCALERANK??9))||[],[lakes]);
 const provincePaths=useMemo(()=>administrative?.features.filter(hasAtlasName).map((f,i)=>({id:i,path:mapFeaturePath(f,.12,viewport),feature:f})).filter(f=>f.path)||[],[administrative,viewport]);
 const landforms=useMemo(()=>regions?.features.filter(hasAtlasName).map((f,i)=>({id:i,path:mapFeaturePath(f,detailedGeography?.05:.62,viewport),feature:f}))
  .filter(v=>v.path)||[],[regions,detailedGeography,viewport]);
 const ice=useMemo(()=>glaciers?.features.filter(hasAtlasName).map((f,i)=>({id:i,path:mapFeaturePath(f,detailedGeography?.05:.62,viewport),feature:f}))
  .filter(v=>v.path)||[],[glaciers,detailedGeography,viewport]);
 const marineAreas=useMemo(()=>marine?.features.filter(hasAtlasName).map((f,i)=>({id:i,path:mapFeaturePath(f,detailedGeography?.08:.5,viewport),feature:f})).filter(f=>f.path)||[],[marine,detailedGeography,viewport]);
 const marineNames=useMemo(()=>marine?.features.filter(hasAtlasName).map((f,i)=>({id:i,point:featureMapPoint(f),feature:f})).filter(f=>f.point)||[],[marine]);
 const natureNames=useMemo(()=>physicalLabels?.features.filter(hasAtlasName).map((f,i)=>({id:i,point:featureMapPoint(f),feature:f})).filter(f=>f.point)||[],[physicalLabels]);
 const peakPoints=useMemo(()=>elevations?.features.filter(hasAtlasName).map((f,i)=>({id:i,point:featureMapPoint(f),feature:f}))
  .filter(v=>v.point)||[],[elevations]);
 const cityPoints=useMemo(()=>cities?.features.filter(f=>!!russianPlaceName(f)).map((f,i)=>({id:i,point:featureMapPoint(f),feature:f}))
  .filter(v=>v.point)||[],[cities]);
 // Clip dense regional point layers to the actual visible world rectangle.
 const visibleWorld={left:450+(-450-position.x)/scale,right:450+(450-position.x)/scale,
  top:225+(-225-position.y)/scale,bottom:225+(225-position.y)/scale};
 const externalBounds:ExternalBounds={
  west:Math.max(-180,visibleWorld.left/2.5-180),
  east:Math.min(180,visibleWorld.right/2.5-180),
  south:Math.max(-85,90-visibleWorld.bottom/2.5),
  north:Math.min(85,90-visibleWorld.top/2.5)
 };
 const externalKey=externalBBoxKey(externalBounds);
 const roadsAvailable=canLoadLocalRoads(externalBounds);
 const mineralsAvailable=canLoadMinerals(externalBounds);
 useEffect(()=>{
  let active=true;
  if(!["cities","hydrography","physical"].includes(mode)||!roadsAvailable){
   setInfrastructure(null);setInfrastructureError("");return()=>{active=false};
  }
  loadLocalInfrastructure(externalBounds).then(v=>{if(active){
   setInfrastructure(v);setInfrastructureError("");
  }}).catch(()=>{if(active){setInfrastructure(null);
   setInfrastructureError("Дополнительные дороги и водотоки сейчас недоступны.")}});
  return()=>{active=false};
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[mode,externalKey,roadsAvailable]);
 useEffect(()=>{
  let active=true;
  if(mode!=="minerals"||!mineralsAvailable){
   setMinerals(null);setMineralLoading(false);setMineralError("");return()=>{active=false};
  }
  setMineralLoading(true);
  loadMineralDeposits(externalBounds).then(v=>{if(active){
   setMinerals(v);setMineralLoading(false);setMineralError("");
  }}).catch(()=>{if(active){setMinerals(null);setMineralLoading(false);
   setMineralError("Не удалось получить сведения о месторождениях из USGS.")}});
  return()=>{active=false};
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[mode,externalKey,mineralsAvailable]);
 const auxiliaryLines=useMemo(()=>infrastructure?.features.flatMap((feature,id)=>{
  const path=mapFeaturePath(feature,.018);
  return path?[{id,path,feature}]:[];
 })??[],[infrastructure]);
 const mineralPoints=useMemo(()=>minerals?.features.flatMap((feature,id)=>{
  const point=featureMapPoint(feature),commodity=mineralCommodity(feature);
  return point&&commodity?[{id,point,feature,commodity}]:[];
 })??[],[minerals]);
 const visibleMinerals=mineralPoints.filter(f=>
  (mineralFilter==="Все виды"||f.commodity.name===mineralFilter)&&
  f.point[0]>=visibleWorld.left&&f.point[0]<=visibleWorld.right&&
  f.point[1]>=visibleWorld.top&&f.point[1]<=visibleWorld.bottom).slice(0,350);
 const visiblePoint=(pt:readonly number[]|null|undefined)=>!!pt&&
  pt[0]>=visibleWorld.left-12/scale&&pt[0]<=visibleWorld.right+12/scale&&
  pt[1]>=visibleWorld.top-12/scale&&pt[1]<=visibleWorld.bottom+12/scale;
 const eligibleCities=cityPoints.filter(f=>visiblePoint(f.point)&&
  ((cityPopulation(f.feature)>=minCityPopulation&&matchesCityCategory(f.feature,cityCategory))||f.feature===selected));
 const visibleCitySymbols=limitCitySymbols(eligibleCities,scale,850);
 const focusCity=eligibleCities.find(f=>f.feature===selected);
 const shownCities=focusCity&&!visibleCitySymbols.some(f=>f.feature===selected)?
  [...visibleCitySymbols,focusCity]:visibleCitySymbols;
 const shownCapitals=cityPoints.filter(f=>visiblePoint(f.point)&&nationalCapital(f.feature));
 const totalCapitals=cityPoints.filter(f=>nationalCapital(f.feature)).length;
 const cityLabels=chooseCityLabels(shownCities,scale,scale>=20?190:scale>=5?115:55);
 const capitalLabels=chooseCityLabels(shownCapitals,scale,scale>=8?110:scale>=3?65:38);
 const shownPeaks=peakPoints.filter(f=>visiblePoint(f.point));
 const shownRiverNames=riverNames.filter(f=>visiblePoint(f.point));
 const shownLakeNames=lakeNames.filter(f=>visiblePoint(f.point));
 const shownMarineNames=marineNames.filter(f=>visiblePoint(f.point));
 const shownNatureNames=natureNames.filter(f=>visiblePoint(f.point));
 const provinceAnchors=useMemo(()=>provincePaths.map(f=>({...f,anchor:featureLabelAnchor(f.feature)})),[provincePaths]);
 const provinceLabels=provinceAnchors.filter(f=>f.anchor&&f.anchor.area*scale*scale>160&&visiblePoint(f.anchor?[f.anchor.x,f.anchor.y]:null))
  .sort((a,b)=>(b.anchor?.area??0)-(a.anchor?.area??0)).slice(0,70);
 const subregions=useMemo(()=>{
  if(!administrative||regionId==="world")return [];
  const [west,south,east,north]=selectedRegion.bounds;
  return administrative.features.flatMap((feature,i)=>{
   const point=featureMapPoint(feature);if(!point)return [];
   const lon=point[0]/2.5-180,lat=90-point[1]/2.5;
   if(lon<west||lon>east||lat<south||lat>north)return [];
   const name=geoFeatureName(feature);if(!name)return [];
   const key=String(feature.properties?.adm1_code??feature.properties?.ADM1_CODE??
    feature.properties?.iso_3166_2??feature.properties?.name??i);
   return [{key,name,feature}];
  }).sort((a,b)=>a.name.localeCompare(b.name,"ru")).slice(0,450);
 },[administrative,selectedRegion,regionId]);
 const changes=useMemo(()=>source&&previous?summariseNamedChanges(previous,source):null,[source,previous]);
 const userMarkers=d.markers.filter(marker=>!historical||
  Math.abs(marker.year-snapshot.year)<=Math.max(10,(historicalSnapshots[Math.min(index+1,historicalSnapshots.length-1)].year-
   historicalSnapshots[Math.max(0,index-1)].year)/2));
 const selectedRaw=String(selected?.properties?.NAME??selected?.properties?.ADMIN??"");
 const selectedArticle=selected&&historical&&!modernReference?
  findHistoricalArticle(selectedRaw,snapshot.year):undefined;
 const fallbackReference=selected&&historical&&!modernReference&&!selectedArticle?
  findHistoricalReference(selectedRaw,snapshot.year):undefined;
 const selectedCountryCapitals=selected&&mode==="political"?
  capitalsForCountry(selected,cityPoints.map(c=>c.feature)):[];
 const selectedIsCity=!!selected&&["Populated place","Admin-0 capital","Admin-0 capital alt",
  "Admin-0 region capital","Admin-1 capital","Admin-1 region capital"]
  .includes(String(selected.properties?.FEATURECLA??selected.properties?.featurecla??""));
 const cityWikidata=selectedIsCity?cityAreaId(selected?.properties??null):null;
 useEffect(()=>{
  let active=true;setCityArea(null);setCityAreaMessage("");
  if(!selectedIsCity){setCityAreaLoading(false);return()=>{active=false}};
  if(!cityWikidata){setCityAreaLoading(false);setCityAreaMessage("Площадь не указана в доступном источнике.");return()=>{active=false}};
  setCityAreaLoading(true);
  fetchCityArea(cityWikidata).then(area=>{if(active){
   setCityArea(area);setCityAreaLoading(false);
   if(!area)setCityAreaMessage("Площадь города отсутствует в Викиданных.");
  }}).catch(()=>{if(active){setCityAreaLoading(false);setCityAreaMessage("Не удалось получить сведения о площади.")}});
  return()=>{active=false};
 },[selectedIsCity,cityWikidata]);
 const russianSourceName=(value:unknown)=>{
  if(typeof value!=="string")return "";
  return geoFeatureName({type:"Feature",geometry:null,properties:{NAME:value}});
 };
 const historicalSubject=selected?russianSourceName(selected.properties?.SUBJECTO):"";
 const historicalPart=selected?russianSourceName(selected.properties?.PARTOF):"";
 const selectedTitle=selected?(selectedIsCity?
  (russianPlaceName(selected)??""):
  (selectedArticle?.name??fallbackReference?.title??atlasDisplayName(selected,snapshot.year,historical&&!modernReference))):"";
 const selectedYears=selectedRaw?historyIndex.filter(record=>record.countries.some(name=>
  normalizeHistoricalName(name)===normalizeHistoricalName(selectedRaw))).map(record=>record.year):[];
 const markerDetails=userMarkers.find(m=>m.id===selectedMarker)??null;
 const namedFeatures=mode==="cities"?cityPoints.filter(f=>russianPlaceName(f.feature)&&matchesCityCategory(f.feature,cityCategory)).map(f=>f.feature):
  mode==="relief"||mode==="physical"?[...landforms.map(f=>f.feature),...peakPoints.map(f=>f.feature),...natureNames.map(f=>f.feature)]:
  mode==="hydrography"?[...ponds.map(f=>f.feature),...(rivers?.features.filter(hasAtlasName)??[]),...marineNames.map(f=>f.feature)]:
  mode==="political"?[...mapSourceFeatures,...(administrative?.features.filter(hasAtlasName)??[]),...cityPoints.filter(p=>nationalCapital(p.feature)).map(p=>p.feature)]:
  mapSourceFeatures;
 const directoryEntries=useMemo(()=>historical?mapSourceFeatures.map(feature=>({
  name:atlasDisplayName(feature,snapshot.year,!modernReference),feature}))
  .filter(v=>isRussianAtlasName(v.name))
  .sort((a,b)=>a.name.localeCompare(b.name,"ru")):[],
  [historical,mapSourceFeatures,modernReference,snapshot.year]);
 const visibleDirectory=directoryEntries.filter(entry=>entry.name.toLocaleLowerCase("ru")
  .includes(directoryFilter.trim().toLocaleLowerCase("ru")));
 const globalMatches=useMemo(()=>{
  const query=directoryFilter.trim().toLocaleLowerCase("ru");
  if(query.length<2)return [];
  const found=new Map<string,{name:string;raw:string;years:number[]}>();
  for(const record of historyIndex){
   for(const raw of record.countries){
    const title=historicalRussianName(raw,record.year)??findHistoricalArticle(raw,record.year)?.name??findHistoricalReference(raw,record.year)?.title??"";
    if(!isRussianAtlasName(title))continue;
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
 const matchingFeatures=search.trim()?namedFeatures.filter(f=>{
  const title=atlasDisplayName(f,snapshot.year,historical&&!modernReference);
  return title&&title.toLocaleLowerCase("ru-RU").includes(search.trim().toLocaleLowerCase("ru-RU"));
 }):[];
 const results=matchingFeatures.slice(0,18);
 const filteredCount=matchingFeatures.length;
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
 const reset=()=>{const camera=atlasRegionCamera(selectedRegion);setScale(camera.scale);setPosition(camera.position);setSelected(null);setCoord(null)};
 const changeRegion=(id:string)=>{setRegionId(id);setFocusedUnit("");onChange?.({...d,regionId:id})};
 const paintProvince=(feature:GeoFeature)=>{
  if(mode!=="contour"||!paintRegions||dragged.current)return;
  const key="region:"+String(feature.properties?.adm1_code||feature.properties?.ADM1_CODE||feature.properties?.iso_3166_2||
   feature.properties?.name_ru||feature.properties?.name||geoFeatureName(feature));
  savePaint({...painted,[key]:paintColor});
 };
 const selectFeature=(feature:GeoFeature,layer:string)=>{
  if(historical)setHistoryTab("article");
  if(dragged.current||mode==="contour")return;
  setSelected(feature);setSelectedLayer(layer);setSelectedMarker(null);
 };
 const showCountry=(feature:GeoFeature)=>{
  if(mode==="contour"){
   if(dragged.current||paintRegions)return;
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
  if(point){const box=featureFocusBounds(match);
   const target=box&&box.width+box.height>0?
    Math.min(720/Math.max(box.width,.005),340/Math.max(box.height,.005)):4096;
   const zoom=Math.min(MAX_ATLAS_ZOOM,Math.max(2.35,target));
   const center=box?[box.x,box.y]:point;
   setScale(zoom);setPosition({x:Math.max(-450*(zoom-1),Math.min(450*(zoom-1),-(center[0]-450)*zoom)),
    y:Math.max(-225*(zoom-1),Math.min(225*(zoom-1),-(center[1]-225)*zoom))})}
  setSelected(match);setSelectedLayer("Историческая территория");setHistoryTab("article");
 },[source,sourceYear,snapshot.year]);
 const onMode=(value:AtlasMode)=>{
  if(!availableModes.some(m=>m.id===value))return;
  setMode(value);setSelected(null);setSelectedMineral(null);setSearch("");setSelectedMarker(null);
  onChange?.({...d,mode:value});
 };
 const pickCoordinates=(e:ReactMouseEvent<SVGSVGElement>)=>{
  if(dragged.current||(mode!=="coordinates"&&!terrainEnabled))return;
  const p=worldPoint(localPoint(e as unknown as ReactPointerEvent<SVGSVGElement>));
  if(p.x>=0&&p.x<=900&&p.y>=0&&p.y<=450){
   const lon=Math.round((p.x/900*360-180)*10000)/10000;
   const lat=Math.round((90-p.y/450*180)*10000)/10000;
   setCoord({lon,lat});
   if(terrainEnabled){
    const request=++heightRequest.current;
    setTerrainPick({lon,lat,metres:null,pending:true,error:false});
    sampleTerrainElevation(lon,lat,Math.max(8,Math.min(11,Math.floor(Math.log2(scale))+4)))
     .then(metres=>{if(heightRequest.current===request)
      setTerrainPick({lon,lat,metres,pending:false,error:false})})
     .catch(()=>{if(heightRequest.current===request)
      setTerrainPick({lon,lat,metres:null,pending:false,error:true})});
   }
  }
 };
 const focusFeature=(f:GeoFeature,explicitLayer?:string)=>{
  const bounds=featureFocusBounds(f);
  const point=bounds?[bounds.x,bounds.y]:featureMapPoint(f);
  if(!point)return;
  const target=bounds&&bounds.width+bounds.height>0?
   Math.min(720/Math.max(bounds.width,.005),340/Math.max(bounds.height,.005)):
   mode==="cities"?48:4096;
  const s=clamp(Math.max(2,target),1,MAX_ATLAS_ZOOM);
  setPosition(normalizePosition({x:-(point[0]-450)*s,y:-(point[1]-225)*s},s));
  setScale(s);setSelected(f);if(historical)setHistoryTab("article");setSelectedLayer(explicitLayer??(mode==="cities"?"Населённый пункт":
   mode==="relief"?"Форма рельефа":mode==="hydrography"?"Водный объект":"Государство"));
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
       grid={d.showGrid||mode==="coordinates"} scale={scale} viewport={viewport}
        terrain={<LektrusAtlasTerrain enabled={terrainEnabled} scale={scale} position={position}
         onStatus={setTerrainStatus}/>}/>
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
      {provincePaths.length>0&&(mode==="political"||mode==="contour"||mode==="cities"||mode==="coordinates")&&<g className="lektrus-atlas-admin1" stroke="#a0a7a5"
       strokeWidth=".48" vectorEffect="non-scaling-stroke"
       pointerEvents={mode==="contour"&&paintRegions||mode==="political"?"visiblePainted":"none"}>
       {provincePaths.map(f=>{
        const key="region:"+String(f.feature.properties?.adm1_code||f.feature.properties?.ADM1_CODE||f.feature.properties?.iso_3166_2||
         f.feature.properties?.name_ru||f.feature.properties?.name||geoFeatureName(f.feature));
        return <path key={"province-"+f.id} d={f.path} vectorEffect="non-scaling-stroke"
         fill={mode==="contour"&&paintRegions?(painted[key]??"#fafcfb"):mode==="political"?"transparent":"none"}
         onClick={e=>{e.stopPropagation();if(mode==="political")selectFeature(f.feature,"Административная единица");
          else paintProvince(f.feature)}}><title>{geoFeatureName(f.feature)}</title></path>;
       })}
      </g>}
      {d.showLabels&&provincePaths.length>0&&mode==="political"&&scale>=4&&
       <g pointerEvents="none" textAnchor="middle" fontWeight="600" fill="#516c83"
        stroke="#fff" strokeWidth={2/scale} paintOrder="stroke" fontSize={8/scale}>
        {provinceLabels.map(f=><text key={"admin-label-"+f.id} x={f.anchor!.x} y={f.anchor!.y}>
         {geoFeatureName(f.feature).slice(0,27)}</text>)}
       </g>}
      {(mode==="physical"||mode==="relief")&&<g>
       {landforms.map(f=>{const style=landformColors[landformClass(f.feature)];
        return <path key={"landform-"+f.id} d={f.path}
         fill={style.fill} fillOpacity={terrainEnabled?style.opacity*.20:style.opacity*.75} stroke="none"
         className="lektrus-atlas-landform" onClick={()=>selectFeature(f.feature,"Природная область")}>
         <title>{geoFeatureName(f.feature)}</title></path>})}
       {ice.map(f=><path key={"ice-"+f.id} d={f.path}
        fill="#f4faff" fillOpacity=".84" stroke="#a4c5d4" strokeWidth={atlasGlacierStroke()}
        vectorEffect="non-scaling-stroke" className="lektrus-atlas-landform" onClick={()=>selectFeature(f.feature,"Ледниковая область")}>
        <title>{geoFeatureName(f.feature)}</title></path>)}
      </g>}
      {(mode==="coordinates"||terrainEnabled)&&coord&&<g className="lektrus-atlas-coordinate-pin"
       transform={`translate(${projectGeography(coord.lon,coord.lat)[0]} ${projectGeography(coord.lon,coord.lat)[1]}) scale(${1/scale})`}
       onClick={e=>e.stopPropagation()}
       onDoubleClick={e=>{e.preventDefault();e.stopPropagation();setCoord(null);setTerrainPick(null)}}
       onContextMenu={e=>{e.preventDefault();e.stopPropagation();setCoord(null);setTerrainPick(null)}}
       role="button" aria-label="Удалить метку двойным нажатием или правой кнопкой мыши" tabIndex={0}
       onKeyDown={e=>{if(e.key==="Delete"||e.key==="Backspace"){e.preventDefault();setCoord(null);setTerrainPick(null)}}}>
       <circle r="12" fill="transparent" pointerEvents="all"/>
       <circle r="3.5" fill="#fff" stroke="#d56540" strokeWidth="1.4"/>
       <circle r="1.3" fill="#d56540" stroke="none"/>
       <title>Метка координат. Двойной щелчок или правая кнопка для удаления</title>
      </g>}
      {historical&&compare&&previous&&<g fill="none" stroke="#d64646"
       strokeWidth="1.1" strokeDasharray="4 2" pointerEvents="none">
       {previous.features.filter(f=>!!atlasDisplayName(f,historicalSnapshots[Math.max(0,index-1)].year,true)).map((f,i)=><path key={"prior-"+i} d={mapFeaturePath(f)} vectorEffect="non-scaling-stroke"/>)}
      </g>}
      {d.showLabels&&mode!=="contour"&&<g fill="#44566a" fontSize={mapText(9.2)} fontWeight="700"
       textAnchor="middle" pointerEvents="none" stroke="#fff" strokeWidth={1.5/scale} paintOrder="stroke">
       {labels.map(s=><text key={s.i} x={s.anchor!.x} y={s.anchor!.y}>{s.name.slice(0,23)}</text>)}
      </g>}
      {(mode==="physical"||mode==="hydrography")&&<g>
       {marineAreas.map(f=><path key={"marine-"+f.id} d={f.path} fill="transparent" stroke="none" vectorEffect="non-scaling-stroke"
        className="lektrus-atlas-water-feature" onClick={()=>selectFeature(f.feature,"Морская акватория")}>
        <title>{geoFeatureName(f.feature)}</title></path>)}
       {ponds.map(l=><path key={"lake-"+l.id} d={l.path} fill="#a7d5ed" fillRule="evenodd" stroke="#7bb5d1"
        strokeWidth={atlasLakeStroke()} strokeLinejoin="round" vectorEffect="non-scaling-stroke"
        onClick={()=>selectFeature(l.feature,"Озеро")} className="lektrus-atlas-water-feature lektrus-atlas-lake">
        <title>{geoFeatureName(l.feature)}</title></path>)}
       {streams.map(l=><g key={"river-"+l.id} role="button" tabIndex={0}
        className="lektrus-atlas-water-feature lektrus-atlas-river"
        onClick={e=>{e.stopPropagation();selectFeature(l.feature,"Река")}}
        onKeyDown={e=>{if(e.key==="Enter"){e.stopPropagation();selectFeature(l.feature,"Река")}}}>
        <path d={l.path} fill="none" stroke="transparent" strokeWidth="8"
         vectorEffect="non-scaling-stroke" pointerEvents="stroke"
         strokeLinecap="round" strokeLinejoin="round"/>
        <path d={l.path} fill="none" stroke="#4c9bc8"
         strokeWidth={atlasRiverStroke(l.feature,mode==="hydrography")}
         strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke"
         className="lektrus-atlas-river-ink" pointerEvents="none"/>
        <title>{geoFeatureName(l.feature)}</title></g>)}
      </g>}
      {d.showLabels&&(mode==="physical"||mode==="hydrography")&&scale>=2&&
       <g pointerEvents="none" fontSize={mapText(8.4)} fill="#235d86" stroke="#fff"
        strokeWidth={1.8/scale} paintOrder="stroke" fontWeight="650" textAnchor="middle">
        {shownLakeNames.slice(0,85).map(f=><text key={"lake-label-"+f.id}
         x={f.point![0]} y={f.point![1]}>{geoFeatureName(f.feature).slice(0,32)}</text>)}
       </g>}
      {d.showLabels&&(mode==="physical"||mode==="hydrography")&&scale>=3&&
       <g pointerEvents="none" fontSize={mapText(8.6)} fill="#256c99" stroke="#fff"
        strokeWidth={2/scale} paintOrder="stroke" fontWeight="650" textAnchor="middle">
        {shownRiverNames.slice(0,90).map(f=><text key={"river-name-"+f.id}
         x={f.point![0]} y={f.point![1]}>{geoFeatureName(f.feature).slice(0,26)}</text>)}
       </g>}
      {d.showLabels&&(mode==="physical"||mode==="hydrography")&&scale>=2&&
       <g pointerEvents="none" fontSize={mapText(9.5)} fill="#2d759f" stroke="#fff"
        strokeWidth={2/scale} paintOrder="stroke" fontWeight="650" textAnchor="middle">
        {shownMarineNames.slice(0,65).map(f=><text key={"marine-name-"+f.id}
         x={f.point![0]} y={f.point![1]}>{geoFeatureName(f.feature).slice(0,28)}</text>)}
       </g>}
      {d.showLabels&&(mode==="physical"||mode==="relief")&&scale>=2&&
       <g pointerEvents="none" fontSize={mapText(9.1)} fill="#5d492e" stroke="#fff"
        strokeWidth={2/scale} paintOrder="stroke" textAnchor="middle" fontWeight="650">
        {shownNatureNames.slice(0,110).map(f=><text key={"nature-name-"+f.id}
         x={f.point![0]} y={f.point![1]}>{geoFeatureName(f.feature).slice(0,28)}</text>)}
       </g>}
      {(mode==="physical"||mode==="relief")&&<g>
       {shownPeaks.map(f=><g key={"elevation-"+f.id}
        transform={`translate(${f.point![0]} ${f.point![1]}) scale(${1/scale})`}
        className="lektrus-atlas-event" onClick={()=>selectFeature(f.feature,"Высотная отметка")}>
        <path d="M0 -4L4 3H-4Z" fill="#816245" stroke="#fff" strokeWidth=".7"/>
        {d.showLabels&&scale>=3&&<text x="6" y="-5" fontSize="8" fill="#725c46"
         stroke="#fff" strokeWidth="1.8" paintOrder="stroke" fontWeight="650">
         {geoFeatureName(f.feature).slice(0,25)}
         {Number.isFinite(Number(f.feature.properties?.ELEVATION??f.feature.properties?.ELEV))?
          " · "+String(f.feature.properties?.ELEVATION??f.feature.properties?.ELEV)+" м":""}</text>}
        <title>{geoFeatureName(f.feature)}</title>
       </g>)}
      </g>}
      {mode==="political"&&<g className="lektrus-atlas-capitals">
       {shownCapitals.map(f=><g key={"capital-"+f.id}
        transform={`translate(${f.point![0]} ${f.point![1]}) scale(${1/scale})`}
        className="lektrus-atlas-event" role="button" tabIndex={0}
        onClick={e=>{e.stopPropagation();selectFeature(f.feature,alternateCapital(f.feature)?"Дополнительная столица по данным источника":"Столица государства")}}
        onKeyDown={e=>{if(e.key==="Enter"){e.preventDefault();selectFeature(f.feature,"Столица государства")}}}>
        <path d="M0 -4.4L4.4 0L0 4.4L-4.4 0Z"
         fill="#263c55" stroke="#fff" strokeWidth="1.15"/>
        <title>{russianPlaceName(f.feature)}: {alternateCapital(f.feature)?"дополнительная столица":"столица"}</title>
       </g>)}
       {d.showLabels&&<g pointerEvents="none" fontSize={mapText(9.4)} fill="#203e59"
        stroke="#fff" strokeWidth={2/scale} paintOrder="stroke" fontWeight="700">
        {capitalLabels.map(f=><text key={"capital-label-"+f.id}
         x={f.point![0]+6/scale} y={f.point![1]-5/scale}>{russianPlaceName(f.feature)}</text>)}
       </g>}
      </g>}
      {(mode==="cities"||mode==="hydrography"||mode==="physical")&&
       <g className="lektrus-atlas-auxiliary-lines" pointerEvents="none">
        {auxiliaryLines.map(line=><path key={"infra-"+line.id} d={line.path} fill="none"
         stroke={line.feature.properties?.ATLAS_KIND==="road"?"#c6a995":"#61a9cc"}
         strokeWidth={line.feature.properties?.ATLAS_KIND==="road"?.67:.48}
         strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke"
         strokeDasharray={line.feature.properties?.ATLAS_KIND==="road"?"2.5 1":undefined}/>)}
       </g>}
      {mode==="minerals"&&<g className="lektrus-atlas-mineral-points">
       {visibleMinerals.map(item=><g key={"mineral-"+item.id}
        transform={`translate(${item.point[0]} ${item.point[1]}) scale(${1/scale})`}
        onClick={e=>{e.stopPropagation();setSelectedMineral(item.feature);setSelected(null)}}
        className="lektrus-atlas-event" role="button" tabIndex={0}
        onKeyDown={e=>{if(e.key==="Enter"){e.preventDefault();setSelectedMineral(item.feature);setSelected(null)}}}>
        {selectedMineral===item.feature&&<circle r="10" fill="none" stroke="#b25e2e"
         strokeWidth="2" pointerEvents="none"/>}
        <circle r="4.1" fill={item.commodity.color} stroke="#fff" strokeWidth="1.1"/>
        <title>{item.commodity.name}, источник USGS</title>
       </g>)}
      </g>}
      {mode==="cities"&&<g className="lektrus-atlas-cities">
       {shownCities.map(f=><g key={"city-"+f.id}
        transform={`translate(${f.point![0]} ${f.point![1]}) scale(${1/scale})`}
        className="lektrus-atlas-event" role="button" tabIndex={0}
        onClick={e=>{e.stopPropagation();selectFeature(f.feature,nationalCapital(f.feature)?"Столица":"Населённый пункт")}}
        onKeyDown={e=>{if(e.key==="Enter"){e.preventDefault();selectFeature(f.feature,"Населённый пункт")}}}>
        {selected===f.feature&&<circle r="10" fill="#fff5d8" fillOpacity=".92"
         stroke="#e77a24" strokeWidth="2.2" pointerEvents="none"/>}
        {nationalCapital(f.feature)?
         <path d="M0 -4.4L4.4 0L0 4.4L-4.4 0Z" fill="#263c55" stroke="#fff" strokeWidth="1"/>:
         <circle r={Math.max(1.8,Math.min(4,1.8+Math.sqrt(cityPopulation(f.feature))/1200))}
          fill={selected===f.feature?"#ed7e27":"#275a82"} stroke="#fff" strokeWidth={selected===f.feature?1.7:.85}/>}
        <title>{russianPlaceName(f.feature)}{cityPopulation(f.feature)>0?
         " · население (оценка): "+cityPopulation(f.feature).toLocaleString("ru-RU"):""}</title>
       </g>)}
       {d.showLabels&&<g pointerEvents="none" fontSize={mapText(9.2)} fill="#28445e"
        stroke="#fff" strokeWidth={1.9/scale} paintOrder="stroke" fontWeight="650">
        {cityLabels.map(f=><text key={"city-label-"+f.id}
         x={f.point![0]+5/scale} y={f.point![1]-4/scale}>{russianPlaceName(f.feature)}</text>)}
       </g>}
      </g>}
      {userMarkers.map(marker=>{
       const point=projectGeography(marker.lon,marker.lat);
       return <g key={marker.id} transform={`translate(${point[0]} ${point[1]})`}
        className="lektrus-atlas-event" role="button" tabIndex={0}
        onClick={()=>{if(dragged.current)return;setSelectedMarker(marker.id);setSelected(null)}}
        onKeyDown={e=>{if(e.key==="Enter"){setSelectedMarker(marker.id);setSelected(null)}}}>
        <circle r={6/scale} fill="#426fbd" stroke="#fff" strokeWidth={2/scale}/>
        <title>{marker.title} ({yearLabel(marker.year)})</title>
       </g>;
      })}
     </g>
     <g className="lektrus-atlas-linear-scale" pointerEvents="none" role="presentation">
      <rect x="757" y="405" width="131" height="37" rx="6" fill="#fff" fillOpacity=".9" stroke="#b7c9d9" strokeWidth=".8"/>
      <text x="766" y="417" fontSize="8.4" fontWeight="650" fill="#385d7a">{distanceBar.label}</text>
      <path d={`M766 421V431H${766+distanceBar.width}V421`} fill="none" stroke="#2f5874" strokeWidth="1.8"/>
      <text x="766" y="438" fontSize="5.8" fill="#607f99">На широте центра · приближённо</text>
     </g>
    </svg>
    {!objectMoveMode&&<div className="lektrus-atlas-zoom" role="group" aria-label="Масштаб">
     <button type="button" title="Увеличить масштаб" onClick={()=>zoomAt(scale*1.5)}>+</button>
     <button type="button" onClick={reset} title="Вписать выбранный регион">⌖</button>
     <button type="button" title="Уменьшить масштаб" onClick={()=>zoomAt(scale/1.5)}>−</button>
     <label className="lektrus-atlas-zoom-slider">Масштаб
      <input type="range" min="0" max="14" step=".25"
       aria-label="Уровень детализации карты"
       value={Math.log2(scale)} onChange={e=>zoomAt(Math.pow(2,Number(e.target.value)))}/>
     </label>
    </div>}
    <div className="lektrus-atlas-precision">Увеличение ×{scale.toFixed(scale>=10?0:1)} · {highDetail?"геоданные 1:10 млн":modernBorders?"обзорный слой":"историческая реконструкция"} · {coord?
     `${coord.lat.toFixed(2)}°, ${coord.lon.toFixed(2)}°`:objectMoveMode?"режим перемещения объекта":"обзорные геоданные"}</div>
   </div>
   <aside className="lektrus-atlas-sidebar">
    <div className="lektrus-atlas-region-picker">
     <strong>Территория карты</strong>
     <select aria-label="Регион школьного атласа" value={regionId} onChange={e=>changeRegion(e.target.value)}>
      {atlasRegionGroups.map(group=><optgroup label={group} key={group}>
       {atlasRegions.filter(region=>region.group===group).map(region=><option key={region.id} value={region.id}>{region.title}</option>)}
      </optgroup>)}
     </select>
     {subregions.length>0&&!historical&&<label className="lektrus-atlas-subregion">
      Административные единицы региона
      <select aria-label="Административная единица на карте" value={focusedUnit}
       onChange={e=>{const match=subregions.find(f=>f.key===e.target.value);
        setFocusedUnit(e.target.value);if(match)focusFeature(match.feature,"Административная единица")}}>
       <option value="">Выберите для приближения</option>
       {subregions.map(f=><option key={f.key} value={f.key}>{f.name}</option>)}
      </select>
     </label>}
     <small>{regionId==="russia"||regionId==="rf-far-east"?"Россия пересекает 180-й меридиан, части её территории представлены у обоих краёв мировой проекции.":
      "Регион изменяет область просмотра, но не подменяет географические границы."}</small>
    </div>
    {modernBorders&&needsPoliticalGeometry&&<div className="lektrus-atlas-source-note">
     <strong>Покрытие: {mapSourceFeatures.length} поименованных территорий</strong>
     <small>Малые, островные государства и отдельные зависимости по данным Natural Earth. Границы 1:10 млн при приближении, не кадастровая точность.</small>
     <small>Российская картографическая позиция Natural Earth RUS (архивная геометрия, ревизия 02.06.2022). Полная актуальность границ на 2026 год по Росреестру НЕ подтверждена.</small>
     <div className="lektrus-atlas-official-sources">
      <strong>Официальные российские источники для сверки</strong>
      <a href="https://www.nspd.gov.ru/" target="_blank" rel="noopener noreferrer">НСПД Росреестра: современная карта ↗</a>
      <a href="https://rosreestr.gov.ru/activity/geodeziya-i-kartografiya/edinaya-elektronnaya-kartograficheskaya-osnova/"
       target="_blank" rel="noopener noreferrer">Единая электронная картографическая основа (ЕЭКО) ↗</a>
      <small>Проверочные источники доступны по ссылкам, но данные ЕЭКО не импортированы в этот атлас. Нельзя считать их уже сверенными с нашим GeoJSON, особенно для спорных территорий.</small>
     </div>
    </div>}

    {terrainEnabled&&terrainPick&&<div className="lektrus-atlas-description">
     <strong>Высота выбранной точки</strong>
     <p>{Math.abs(terrainPick.lat).toFixed(4)}° {terrainPick.lat>=0?"с. ш.":"ю. ш."},
      {" "}{Math.abs(terrainPick.lon).toFixed(4)}° {terrainPick.lon>=0?"в. д.":"з. д."}</p>
     <p>{terrainPick.pending?"Получение значения из DEM…":
      terrainPick.error?"Не удалось загрузить высоту из источника.":
      terrainPick.metres===null?"Нет данных о высоте для этой точки.":
      Math.round(terrainPick.metres)+" м относительно уровня моря (приблизительно)"}</p>
     <small>Нажмите на другую точку карты, чтобы проверить высоту.</small>
    </div>}
    {(mode==="physical"||mode==="relief")&&<div className="lektrus-atlas-hypsometry-options">
     <label><input type="checkbox" checked={terrainEnabled}
      onChange={e=>onChange?.({...d,hypsometry:e.target.checked})}/>
      Гипсометрическая карта: реальные высоты</label>
     {terrainEnabled&&<small>{terrainStatus.total===0?"Для этого охвата данных нет":
      "Высотная подложка: "+terrainStatus.loaded+" / "+terrainStatus.total+" фрагментов"}
      {terrainStatus.failed>0?". Не загрузились: "+terrainStatus.failed+".":""}</small>}
     {terrainEnabled&&<div className="lektrus-atlas-hypso-ramp" aria-label="Высотная шкала в метрах">
      <span>−5000 м</span><span>0 м</span><span>500 м</span><span>2000 м</span><span>5000+ м</span>
     </div>}
     <small>Высоты из Mapzen Terrain Tiles, преобразованные из проекции Меркатора. Выше 85° широты покрытие отсутствует. При сбое источника используется обычная географическая карта.</small>
     <a href="https://registry.opendata.aws/terrain-tiles/" target="_blank" rel="noopener noreferrer">Источник высот (Mapzen/AWS) ↗</a>
     <a href="https://github.com/tilezen/joerd/blob/master/docs/attribution.md" target="_blank" rel="noopener noreferrer">Авторы данных и условия использования ↗</a>
    </div>}
    {(mode==="physical"||mode==="relief")&&<div className="lektrus-atlas-natural-legend">
     <strong>Условные обозначения</strong>
     <small>Природные контуры не обводятся жирными линиями. Водная сеть: {hydroResolution}.</small>
     {(["mountains","plateau","deserts","plains","basins"] as const).map(key=>
      <div key={key}><span className="lektrus-atlas-legend-swatch" style={{background:landformColors[key].fill}}/>
       {landformColors[key].label}</div>)}
     <small>{terrainEnabled?"Природные районы показаны поверх высотной карты. Абсолютные высоты показаны шкалой выше.":"Цвет отражает класс природной области, но не абсолютную высоту. Отметки высот показываются отдельно."}</small>
    </div>}
    {mode==="hydrography"&&<div className="lektrus-atlas-natural-legend">
     <strong>Условные обозначения</strong>
     <small>Детализация гидрографии: {hydroResolution}</small>
     <div><span className="lektrus-atlas-legend-swatch" style={{background:"#4c9bc8"}}/>Реки и водотоки</div>
     <div><span className="lektrus-atlas-legend-swatch" style={{background:"#a7d5ed"}}/>Озёра и водохранилища</div>
     <div><span className="lektrus-atlas-legend-swatch" style={{background:"#dfedf9",borderColor:"#90b5d1"}}/>Морские акватории</div>
     <small>Толщина линий показывает картографическую значимость реки в Natural Earth, но не её расход воды. Условные границы морских акваторий не рисуются.</small>
    </div>}
    {mode==="political"&&<div className="lektrus-atlas-natural-legend">
     <strong>Столицы государств</strong>
     <div><span className="lektrus-atlas-legend-swatch lektrus-atlas-legend-capital"/>◆ Столица по данным Natural Earth</div>
     <small>Столиц в слое: {totalCapitals}. На карте они отмечены тёмными ромбами; это не маркеры маленьких государств.</small>
     <small>Столицы показаны по Natural Earth, кроме подтверждённых исправлений: Додома (Танзания) и Сьюдад-де-ла-Пас (Экваториальная Гвинея). Для остальных стран ещё требуется актуализация по официальным сведениям.</small>
     <a href="https://oagmis.oag.go.tz/portal/acts/52" target="_blank" rel="noopener noreferrer">Закон Танзании о столице ↗</a>
     <a href="https://www.guineaecuatorialpress.com/noticias/decreto_ley_por_el_que_se_declara_la_ciudad_de_la_paz_djibloho_capital_de_la_republica_de_guinea_ecuatorial"
      target="_blank" rel="noopener noreferrer">Декрет о столице Экваториальной Гвинеи, 2026 ↗</a>
    </div>}
    {mode==="cities"&&<div className="lektrus-atlas-natural-legend">
     <strong>Обозначения населённых пунктов</strong>
     <label className="lektrus-atlas-city-filter">Тип населённого пункта
      <select aria-label="Категория городов" value={cityCategory}
       onChange={e=>{const value=e.target.value as CityCategory;
        setCityCategory(value);onChange?.({...d,cityCategory:value})}}>
       <option value="all">Все населённые пункты</option>
       <option value="capitals">Столицы государств</option>
       <option value="regional">Административные центры регионов</option>
       <option value="ordinary">Другие города и посёлки</option>
      </select>
     </label>
     <label className="lektrus-atlas-city-filter">Численность населения
      <select aria-label="Фильтр городов по численности населения" value={minCityPopulation}
       onChange={e=>{const value=Number(e.target.value);setMinCityPopulation(value);onChange?.({...d,cityMinPopulation:value})}}>
       <option value="0">Все населённые пункты</option>
       <option value="50000">От 50 тысяч</option>
       <option value="250000">От 250 тысяч</option>
       <option value="1000000">От 1 миллиона</option>
      </select>
     </label>
     <small>Объектов в базе: {cities?.features.length??0}; с русским названием: {cities?.features.filter(f=>russianPlaceName(f)).length??0}. В видимой области показано: {shownCities.length}. Фактически загруженный слой: {cityResolution}.</small>
     <div><span className="lektrus-atlas-legend-swatch" style={{background:"#386e8d"}}/>● Населённый пункт</div>
     <div><span className="lektrus-atlas-legend-swatch lektrus-atlas-legend-capital"/>◆ Столица государства</div>
     <small>В фильтре «Другие города и посёлки» отображаются не административные центры, а населённые пункты категории Populated place. Начиная с увеличения ×4 подключается база 1:10 млн.</small>
     <small>Размер символа зависит от оценочной численности населения. Русские названия берутся из атрибутов источника. Элементы без установленного русского названия не показываются.</small>
    </div>}
    {mode==="contour"&&<div className="lektrus-atlas-paint-tools">
     <strong>Контурная карта</strong>
     {administrative&&<label className="lektrus-atlas-compare">
      <input type="checkbox" checked={paintRegions} onChange={e=>setPaintRegions(e.target.checked)}/>
      Закрашивать регионы вместо стран
     </label>}
     <label>Цвет маркера <input type="color" value={paintColor}
      onChange={e=>setPaintColor(e.target.value)} aria-label="Цвет закраски"/></label>
     <button type="button" onClick={()=>setPaintColor("#fafcfb")}>Ластик заливки</button>
     <button type="button" onClick={()=>savePaint({})}>Очистить все заливки</button>
     <small>Выберите цвет и нажимайте на страну или регион. Для работы с регионами сначала выберите территорию. Заливки сохраняются с доской.</small>
    </div>}
    {mode!=="contour"&&!historical&&<label>Поиск объектов
     <input value={search} onChange={e=>setSearch(e.target.value)}
      placeholder={mode==="cities"?"Название населённого пункта":mode==="political"?"Страна или столица":mode==="hydrography"?"Река или озеро":
       mode==="relief"?"Горы, пустыня, вершина":"Страна или территория"}/>
     {search.trim()&&<small>Найдено: {filteredCount}</small>}
    </label>}
    {search.trim()&&mode!=="contour"&&!historical&&<div className="lektrus-atlas-search-results">
     {results.length?results.map((f,i)=><button key={i} type="button"
      onClick={()=>focusFeature(f)}>{atlasDisplayName(f,snapshot.year,historical&&!modernReference)}</button>):
      <small>Совпадений нет среди названий из картографической базы. Попробуйте уточнить запрос.</small>}
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
     <small>{modernReference?"Современный обзор в российском профиле Natural Earth, не официальный снимок 2026 года":
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
     {selectedCountryCapitals.length>0&&<div className="lektrus-atlas-country-capitals">
      <strong>Столицы государства</strong>
      {selectedCountryCapitals.map((capital,i)=>
       <button key={i} type="button" onClick={()=>focusFeature(capital,"Столица государства")}>
        ◆ {russianPlaceName(capital)}
        <span>Показать на карте ↗</span>
       </button>)}
     </div>}
     {selectedIsCity&&<div className="lektrus-atlas-city-data">
      <strong>Площадь города</strong>
      {cityArea?<p>{cityArea.km2.toLocaleString("ru-RU",{maximumFractionDigits:2})} км²
       <small> Значение из Викиданных, может относиться к административной или городской территории.</small></p>:
       <p>{cityAreaLoading?"Получение площади из источника…":cityAreaMessage}</p>}
      {cityArea&&<a href={cityArea.url} target="_blank" rel="noopener noreferrer">Источник площади ↗</a>}
     </div>}
     {featureSourceFacts(selected).map(f=><p key={f.label}>{f.label}: {f.value}</p>)}
      {typeof selected.properties?.CAPITAL_CORRECTION_URL==="string"&&<a href={selected.properties.CAPITAL_CORRECTION_URL}
       target="_blank" rel="noopener noreferrer">Правовой источник уточнения столицы ↗</a>}
      {typeof selected.properties?.LOCATION_SOURCE_URL==="string"&&<a href={selected.properties.LOCATION_SOURCE_URL}
       target="_blank" rel="noopener noreferrer">Географический источник координат ↗</a>}
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
      <p>Историческая реконструкция принадлежит авторам снимка. Российская позиция применяется к современному политическому слою, но не подменяет исторические эпохи.</p>
      {historicalSubject&&<p>Административная принадлежность в источнике: {historicalSubject}</p>}
      {historicalPart&&historicalPart!==selectedTitle&&
       <p>Регион/группа: {historicalPart}</p>}</>}
    </div>:
    historical?<div className="lektrus-atlas-description">
     <strong>Исторический справочник</strong>
     <p>Выберите период, затем территорию на карте либо запись в алфавитном списке. Нажатие на название приближает карту к объекту.</p>
     <p>Справочник показывает только территории из датированного набора. Неизвестные объекты не получают выдуманных названий и описаний.</p>
    </div>:
    <div className="lektrus-atlas-description"><strong>{mapModeTitle(mode)}</strong>
     <p>{atlasModes.find(m=>m.id===mode)?.hint}.</p>
     {mode==="physical"&&<p>Природные объекты, ледники, водная сеть и высотные отметки Natural Earth. Региональный масштаб использует подробнее проработанные реки, озёра и побережье. Для высотной подложки используется отдельная модель рельефа Mapzen (при включении и доступности).</p>}
     {mode==="hydrography"&&<p>Реки, озёра и морские акватории Natural Earth. При сильном приближении автоматически подключается детализация 1:10 млн; если источник недоступен, сохраняется слой 1:50 млн. Нажмите на объект или найдите его по названию.</p>}
     {mode==="relief"&&<p>При включённой гипсометрии цвета рассчитаны по высотам DEM; без неё заливка обозначает тип природной области. Подписи высот берутся из атрибутов Natural Earth.</p>}
     {mode==="cities"&&<p>Города и другие населённые пункты из Natural Earth, включая не являющиеся административными центрами. Подробный слой подключается при приближении; численность населения дана по оценке источника и может устареть.</p>}
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
     {historical&&<><small>Исторические реконструкции могут быть приблизительными; современный обзор отображён в версии RUS.</small>
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
