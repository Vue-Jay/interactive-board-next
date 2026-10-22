import {useEffect,useMemo,useRef,useState,type PointerEvent as ReactPointerEvent,type MouseEvent as ReactMouseEvent} from "react";
import type {AtlasDocument,AtlasMode,ContourMark,ContourStroke} from "./lektrusAtlasModel";
import {contourEraserHits,moveContourMark} from "./lektrusContourInteractions";
import {eraseContourInkAlongPath} from "./lektrusContourInk";
import {defaultContourAssignment} from "./lektrusAtlasModel";
import {schoolCountryName,layoutAtlasLabels,type AtlasLabelCandidate,type AtlasLabelKind} from "./lektrusAtlasLabels";
import {clusterMineralMapPoints} from "./lektrusAtlasMineralClusters";
import {loadMRDSRegionalDeposits,loadMRDSWorldOverview,mrdsMineralCommodity} from "./lektrusAtlasMRDS";
import {atlasFactEntityId,fetchAtlasSchoolReference,type AtlasSchoolReference} from "./lektrusAtlasSchoolFacts";
import LektrusMapBase,{LektrusAtlasGraticule} from "./LektrusMapBase";
import LektrusColorPicker from "./LektrusColorPicker";
import LektrusAtlasCountrySymbol from "./LektrusAtlasCountrySymbol";
import {atlasCountrySymbol} from "./lektrusAtlasCountrySymbols";
import {INK_WIDTHS} from "./LectrisObjectEditor";
import {colorPoliticalCountries} from "./lektrusAtlasPoliticalColors";
import {LektrusMineralSymbol,MineralAtlasGlyph} from "./LektrusMineralSymbol";
import {SCHOOL_ATLAS_GROUPS,SCHOOL_ATLAS_MINERALS,SCHOOL_ATLAS_FUEL_MINERALS} from "./lektrusSchoolAtlasMinerals";
import {fetchCityArea,cityAreaId,type AtlasCityArea} from "./lektrusAtlasCityArea";
import {mineralGuide} from "./lektrusAtlasMineralGuide";
import {atlasOSMCoverageTiles,loadAtlasOSMCoverage,loadMineralDeposits,loadWorldMineralOverview,mineralCommodity,mineralDepositFacts,mineralDepositSource,
 canLoadMinerals,externalBBoxKey,type ExternalBounds} from "./lektrusAtlasExternal";
import {russianPlaceName,nationalCapital,alternateCapital,cityPopulation,chooseCityLabels,limitCitySymbols,applyVerifiedCapitalUpdates2026,capitalsForCountry,matchesCityCategory,type CityCategory} from "./lektrusAtlasPlaces";
import LektrusAtlasTerrain,{sampleTerrainElevation,type TerrainStatus} from "./LektrusAtlasTerrain";
import {atlasRiverStroke,atlasLakeStroke,atlasGlacierStroke,atlasWaterGeometryTolerance,atlasRiverLabelRank} from "./lektrusAtlasHydro";
import {atlasRegions,atlasRegionGroups,findAtlasRegion,atlasRegionCamera,atlasDistanceScale,zoomAtlasCamera} from "./lektrusAtlasRegions";
import {atlasModes,atlasModesFor,normalizeAtlasMode,historicalSnapshots,nearestSnapshotIndex,yearLabel} from "./lektrusAtlasModel";
import {borderPrecision,geoFeatureName,hasAtlasName,isRussianAtlasName,featureLabelAnchor,loadAtlasLayer,loadHistoricalSnapshot,mapFeaturePath,
 modernDataProvider,historicDataProvider,projectGeography,featureMapPoint,featureSourceFacts,summariseNamedChanges,
historicalFeatureFacts,historicalCountryName,historicalMapFeatures,loadHistoricalIndex,featureFocusBounds,featureLineMidpoint,type MapWindow,type HistoricalIndexRecord,type GeoCollection,type GeoFeature} from "./lektrusAtlasData";
import {findHistoricalArticle,historicalRussianName,historyArticleUrl} from "./lektrusHistoryEncyclopedia";
import {findHistoricalReference,historicalReferences,normalizeHistoricalReferenceName} from "./lektrusHistoricalReferences";
type Props={diagram:AtlasDocument;onChange?:(next:AtlasDocument)=>void;editorMode?:boolean;userId?:string};
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
 if(!history){
  const props=feature.properties??{},geo=feature.geometry?.type;
  const sovereign=(geo==="Polygon"||geo==="MultiPolygon")&&
   (typeof props.ADMIN==="string"||typeof props.SOVEREIGNT==="string")&&
   props.adm1_code===undefined&&props.ADM1_CODE===undefined;
  return sovereign?schoolCountryName(direct,String(props.ISO_A2??props.ISO_A2_EH??"")):direct;
 }
 const raw=String(feature.properties?.NAME??feature.properties?.name??"").trim();
 const found=historicalRussianName(raw,year)??findHistoricalArticle(raw,year)?.name??
  findHistoricalReference(raw,year)?.title??historicalCountryName(raw);
 return isRussianAtlasName(found)?found.trim():direct;
}
type ContourToolName="select"|"hand"|"pen"|"fill"|"erase"|"label";
function ContourToolIcon({name}:{name:ContourToolName}){
 return <svg className="lektrus-contour-tool-icon" width="23" height="23" viewBox="0 0 24 24"
  fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round"
  strokeLinejoin="round" aria-hidden="true">
  {name==="select"&&<><path d="m5 3 13 9-7 1-3 7z"/><path d="m11 13 4 7"/></>}
  {name==="hand"&&<><path d="M8 13V6a1.5 1.5 0 0 1 3 0v5-7a1.5 1.5 0 0 1 3 0v7-5a1.5 1.5 0 0 1 3 0v6-3a1.5 1.5 0 0 1 3 0v6c0 4-3 6-7 6h-2c-2 0-3-1-4-3l-3-4a1.7 1.7 0 0 1 2.7-2z"/></>}
  {name==="pen"&&<><path d="m4 20 5-1 11-11-4-4L5 15z"/><path d="m13 7 4 4"/></>}
  {name==="fill"&&<><path d="M4 13 13 4l8 8-9 9z"/><path d="m9 8 6 6M20 17c-1 2-1 3-1 3a2 2 0 0 0 4 0c0-1-2-3-2-3"/></>}
  {name==="erase"&&<><path d="m8 21-5-5a2 2 0 0 1 0-3L14 2a2 2 0 0 1 3 0l5 5a2 2 0 0 1 0 3L11 21z"/><path d="m6 10 8 8M8 21h14"/></>}
  {name==="label"&&<><path d="M3 5h12v12H3z"/><path d="m9 8-3 6M12 14 9 8M6.8 12h4.5M17 10l4 4-4 4"/></>}
 </svg>;
}
function AtlasMap({diagram:d,onChange,editorMode=false,userId=""}:Props){
 const [inspectorOpen,setInspectorOpen]=useState(!editorMode);
 const [coordinatesEnabled,setCoordinatesEnabled]=useState(d.showCoordinates===true||d.mode==="coordinates");
 useEffect(()=>setCoordinatesEnabled(d.showCoordinates===true||d.mode==="coordinates"),[d.showCoordinates,d.mode]);
 const [mode,setMode]=useState<AtlasMode>(d.title==="Контурная карта"?"contour":normalizeAtlasMode(d.mode));
 const isWorksheet=mode==="contour";
 const worksheetEditor=isWorksheet&&editorMode;
 const worksheetOnBoard=isWorksheet&&!editorMode;
 const contourConfig={...defaultContourAssignment,...d.contourAssignment};
 const citiesOn=mode==="political"&&d.showCities!==false;
 const mineralContext=mode==="minerals";
 const landmarkCities=citiesOn||mineralContext||isWorksheet&&(contourConfig.showCapitals||contourConfig.showMajorCities);
 const hydroContext=mode==="physical"||mode==="hydrography"||mineralContext||isWorksheet&&(contourConfig.showRivers||contourConfig.showLakes);
 const reliefContext=mode==="physical"||mode==="relief"||mineralContext;
 // This reuses the measured relief tiles, without turning every click on
 // the mineral map into an elevation/coordinate query.
 const mineralTerrainEnabled=mineralContext&&d.hypsometry!==false;
 const [paintColor,setPaintColor]=useState("#000000");
 const [toolThickness,setToolThickness]=useState<number>(3);
 const [paintRegions,setPaintRegions]=useState(false);
 const [contourAction,setContourAction]=useState<"select"|"hand"|"fill"|"label"|"point"|"pen"|"erase">("select");
 const [lastLabelKind,setLastLabelKind]=useState<"label"|"point">("label");
 const [territoryMenuOpen,setTerritoryMenuOpen]=useState(false);
 const territoryMenuRef=useRef<HTMLDivElement|null>(null);
 useEffect(()=>{
  if(!territoryMenuOpen)return;
  const dismiss=(event:PointerEvent)=>{
   if(!territoryMenuRef.current?.contains(event.target as Node))setTerritoryMenuOpen(false);
  };
  const escape=(event:KeyboardEvent)=>{if(event.key==="Escape")setTerritoryMenuOpen(false)};
  document.addEventListener("pointerdown",dismiss);
  document.addEventListener("keydown",escape);
  return()=>{document.removeEventListener("pointerdown",dismiss);document.removeEventListener("keydown",escape)};
 },[territoryMenuOpen]);
 useEffect(()=>{
  const allowed={select:true,hand:true,label:contourConfig.allowLabels,point:contourConfig.allowPoints,
   pen:contourConfig.allowDrawing,fill:contourConfig.allowFill,erase:true};
  if(!allowed[contourAction])setContourAction((["label","point","pen","fill","erase"] as const)
   .find(id=>allowed[id])??"select");
 },[contourAction,contourConfig.allowLabels,contourConfig.allowPoints,contourConfig.allowDrawing,contourConfig.allowFill]);
 const [contourText,setContourText]=useState("");
 const contourDrawing=useRef<Array<[number,number]>>([]);
 const contourLivePath=useRef<SVGPathElement|null>(null);
 const mapSvgRef=useRef<SVGSVGElement|null>(null);
 const contourEraserPreview=useRef<SVGPathElement|null>(null);
 const eraserGesture=useRef<{pointerId:number;marks:Set<string>;fills:Set<string>;path:Array<{x:number;y:number}>}|null>(null);
 const [pendingErasure,setPendingErasure]=useState<{marks:string[];fills:string[]}>({marks:[],fills:[]});
 const [liveErasedStrokes,setLiveErasedStrokes]=useState<ContourStroke[]|null>(null);
 const markerGesture=useRef<{pointerId:number;mark:ContourMark;start:{x:number;y:number};moved:boolean}|null>(null);
 const [previewContourMark,setPreviewContourMark]=useState<ContourMark|null>(null);
 const [selectedContourMarkId,setSelectedContourMarkId]=useState<string|null>(null);
 // Match the political atlas exactly: labels use map camera scale rather
 // than board-object pixel ratio. No extra mobile text magnification.
 const labelUiScale=1;
 const contourMarks=d.contourMarks??[],contourStrokes=d.contourStrokes??[];
 const selectedContourMark=contourMarks.find(mark=>mark.id===selectedContourMarkId);
 // Hold the last drag preview until the board acknowledges persisted
 // coordinates. Clearing it in pointer-up caused the old-position flash.
 useEffect(()=>{
  if(!previewContourMark||markerGesture.current)return;
  const persisted=contourMarks.find(mark=>mark.id===previewContourMark.id);
  if(!persisted||persisted.lon===previewContourMark.lon&&persisted.lat===previewContourMark.lat){
   setPreviewContourMark(null);
  }
 },[contourMarks,previewContourMark]);
 const deleteContourMark=(id:string)=>{
  if(!onChange)return;
  captureContour();setSelectedContourMarkId(null);
  setPreviewContourMark(null);
  onChange({...d,contourMarks:contourMarks.filter(mark=>mark.id!==id)});
 };
 const [contourHistory,setContourHistory]=useState<Array<{marks:typeof contourMarks;strokes:typeof contourStrokes;
  fills:Record<string,string>}>>([]);
 const captureContour=()=>{
  setContourHistory(h=>[...h.slice(-19),{marks:contourMarks,strokes:contourStrokes,fills:painted}]);
 };
 const contourUndo=()=>{
  const last=contourHistory[contourHistory.length-1];if(!last)return;
  onChange?.({...d,contourMarks:last.marks,contourStrokes:last.strokes,paintedCountries:last.fills});
  setContourHistory(h=>h.slice(0,-1));
 };

 const painted=d.paintedCountries??{};
 const savePaint=(next:Record<string,string>)=>{captureContour();onChange?.({...d,paintedCountries:next})};
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
 const [worldAdminLines,setWorldAdminLines]=useState<GeoCollection|null>(null);
 const [worldAdminError,setWorldAdminError]=useState("");
 const [cityBoundaries,setCityBoundaries]=useState<GeoCollection|null>(null);
 const [cityBoundaryError,setCityBoundaryError]=useState("");
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
 const [worldMinerals,setWorldMinerals]=useState<GeoCollection|null>(null);
 const [mrdsWorld,setMrdsWorld]=useState<GeoCollection|null>(null);
 const [mrdsRegion,setMrdsRegion]=useState<GeoCollection|null>(null);
 const [mrdsWorldLoading,setMrdsWorldLoading]=useState(false);
 const [mrdsWorldError,setMrdsWorldError]=useState("");
 const [mrdsRegionLoading,setMrdsRegionLoading]=useState(false);
 const [worldMineralError,setWorldMineralError]=useState("");
 const [worldMineralsLoading,setWorldMineralsLoading]=useState(false);
 const [mineralError,setMineralError]=useState("");
 const [mineralLoading,setMineralLoading]=useState(false);
 const [mineralFilter,setMineralFilter]=useState("Все виды");
 const [selectedMineral,setSelectedMineral]=useState<GeoFeature|null>(null);
 const [search,setSearch]=useState("");
 const [focusedUnit,setFocusedUnit]=useState("");
 const [directoryFilter,setDirectoryFilter]=useState("");
 const [searchAcrossYears,setSearchAcrossYears]=useState(false);
 const [referenceOnlyCurrentPeriod,setReferenceOnlyCurrentPeriod]=useState(false);
 const [historyTab,setHistoryTab]=useState<"directory"|"article"|"changes">("directory");
 const [historyIndex,setHistoryIndex]=useState<HistoricalIndexRecord[]>([]);
 const [sourceYear,setSourceYear]=useState<number|null>(null);
 const [indexProblem,setIndexProblem]=useState("");
 const pendingJump=useRef<{year:number;raw:string}|null>(null);
 const [scale,setScale]=useState(1);
 const [regionId,setRegionId]=useState(d.regionId??"world");
 const selectedRegion=findAtlasRegion(regionId);
 const detailedGeography=scale>=3||regionId!=="world";
 const veryDetailedHydro=(mode==="physical"||mode==="hydrography")&&scale>=4;
 const detailedCities=landmarkCities&&scale>=4;
 // A worksheet is first and foremost a selectable, resizable board object.
 // Opt into its internal map tools explicitly; otherwise let pointer events
 // reach the board's normal selection, dragging and transform handles.
 const [objectMoveMode,setObjectMoveMode]=useState(isWorksheet&&!editorMode);
 const [position,setPosition]=useState({x:0,y:0});
 const cameraRef=useRef({scale:1,position:{x:0,y:0}});
 const cameraFrame=useRef<number|null>(null);
 const cameraLayerRef=useRef<SVGGElement|null>(null);
 const cameraIdleRef=useRef<ReturnType<typeof setTimeout>|null>(null);
 const cameraTransform=(cam:{scale:number;position:{x:number;y:number}})=>
  `translate(${cam.position.x} ${cam.position.y}) translate(450 225) scale(${cam.scale}) translate(-450 -225)`;
 const paintCamera=(cam:{scale:number;position:{x:number;y:number}})=>{
  cameraLayerRef.current?.setAttribute("transform",cameraTransform(cam));
 };

 const lastPointer=useRef({x:450,y:225});
 const commitCamera=(camera:{scale:number;position:{x:number;y:number}})=>{
  if(cameraFrame.current!==null){cancelAnimationFrame(cameraFrame.current);cameraFrame.current=null}
  if(cameraIdleRef.current!==null){clearTimeout(cameraIdleRef.current);cameraIdleRef.current=null}
  cameraRef.current=camera;paintCamera(camera);
  setScale(camera.scale);setPosition(camera.position);
  if(worksheetEditor&&onChange){
   const previous=d.contourCamera;
   if(!previous||previous.regionId!==regionId||
     Math.abs(previous.scale-camera.scale)>1e-6||
     Math.abs(previous.position.x-camera.position.x)>.01||
     Math.abs(previous.position.y-camera.position.y)>.01){
    onChange({...d,contourCamera:{regionId,scale:camera.scale,position:{...camera.position}}});
   }
  }
 };
 // Crucial performance fix: live gesture moves ONE SVG transform, not thousands
 // of React paths, labels and DEM tiles every animation frame. Recompute complex
 // geometry only after the interaction becomes idle.
 const scheduleCamera=(camera:{scale:number;position:{x:number;y:number}})=>{
  cameraRef.current=camera;
  if(cameraFrame.current===null)cameraFrame.current=requestAnimationFrame(()=>{
   cameraFrame.current=null;paintCamera(cameraRef.current);
  });
  // A held pointer must not trigger expensive scene reconstruction between
  // slow drag events. Only mouse wheel/trackpad zoom needs an idle commit.
  if(cameraIdleRef.current!==null){clearTimeout(cameraIdleRef.current);cameraIdleRef.current=null}
  if(points.current.size===0)cameraIdleRef.current=setTimeout(()=>{
   cameraIdleRef.current=null;commitCamera(cameraRef.current);
  },190);
 };
 useEffect(()=>()=>{if(cameraFrame.current!==null)cancelAnimationFrame(cameraFrame.current);
  if(cameraIdleRef.current!==null)clearTimeout(cameraIdleRef.current)},[]);
 const distanceBar=atlasDistanceScale(scale,position.y);
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
 useEffect(()=>{
  const stored=d.contourCamera;
  const camera=isWorksheet&&stored?.regionId===regionId?
   {scale:stored.scale,position:stored.position}:
   atlasRegionCamera(findAtlasRegion(regionId));
  // The teacher's saved camera is replayed on the board. Only the editor may
  // write view changes; re-opening never resets the student's work or zoom.
  commitCamera(camera);
  setSelected(null);setCoord(null);
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[regionId]);
 const availableModes=isContourTool?atlasModesFor(scope).filter(m=>m.id==="contour"):
  atlasModesFor(scope).filter(m=>m.id!=="contour");
 const historical=scope==="history";
 const modernBorders=!historical||modernReference;
 const needsPoliticalGeometry=historical||mode==="political"||isWorksheet&&(contourConfig.showBorders||contourConfig.allowFill||contourConfig.showRegions)||mode==="minerals";
 const terrainEnabled=(mode==="physical"||mode==="relief")&&d.hypsometry!==false;
 useEffect(()=>{
  if(!historical)return;
  let active=true;setIndexProblem("");
  loadHistoricalIndex().then(rows=>{if(active)setHistoryIndex(rows)})
   .catch(error=>{if(active)setIndexProblem(error instanceof Error?error.message:String(error))});
  return()=>{active=false};
 },[historical,refresh]);
 useEffect(()=>{setMode(d.title==="Контурная карта"?"contour":normalizeAtlasMode(d.mode));setIndex(nearestSnapshotIndex(d.year));setSelected(null)},
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
   ["rivers",!detailedGeography&&hydroContext&&(!isWorksheet||contourConfig.showRivers)],
   ["rivers-regional",detailedGeography&&!veryDetailedHydro&&hydroContext&&(!isWorksheet||contourConfig.showRivers)],
   ["rivers-ultra",veryDetailedHydro],
   ["lakes",!detailedGeography&&hydroContext&&(!isWorksheet||contourConfig.showLakes)],
   ["lakes-regional",detailedGeography&&!veryDetailedHydro&&hydroContext&&(!isWorksheet||contourConfig.showLakes)],
   ["lakes-ultra",veryDetailedHydro],
   ["cities",landmarkCities&&!detailedGeography],
   ["cities-regional",landmarkCities&&detailedGeography&&!detailedCities],
   ["cities-local",detailedCities],
   ["admin-regional",!historical&&(isWorksheet?contourConfig.showRegions||contourConfig.allowFill&&paintRegions:regionId!=="world"||citiesOn&&scale>=2.5)],
   ["regions",!detailedGeography&&reliefContext],
   ["regions-regional",detailedGeography&&reliefContext],
   ["elevation",!detailedGeography&&(mode==="physical"||mode==="relief")],
   ["elevation-regional",detailedGeography&&(mode==="physical"||mode==="relief")],
   ["glaciers",!detailedGeography&&(mode==="physical"||mode==="relief")],
   ["glaciers-regional",detailedGeography&&(mode==="physical"||mode==="relief")],
   ["marine",mode==="physical"||mode==="hydrography"],
   ["physical-labels",reliefContext]
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
 },[mode,index,refresh,historical,snapshot.year,modernBorders,modernReference,detailedGeography,detailedCities,veryDetailedHydro,regionId,needsPoliticalGeometry,scale>=2.5,citiesOn,landmarkCities,hydroContext,reliefContext,contourConfig.showRivers,contourConfig.showLakes,contourConfig.showRegions,contourConfig.allowFill,paintRegions]);
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
  if(!citiesOn||scale<2.5){
   setWorldAdminLines(null);setWorldAdminError("");return()=>{active=false};
  }
  setWorldAdminError("");
  const selectedLayer=scale>=3.5?"admin-world-lines":"admin-world-overview";
  loadAtlasLayer(selectedLayer).then(data=>{if(active){
   setWorldAdminLines(data);setWorldAdminError("");
  }}).catch(()=>{
   if(!active)return;
   if(selectedLayer==="admin-world-lines"){
    loadAtlasLayer("admin-world-overview").then(data=>{
     if(active){setWorldAdminLines(data);setWorldAdminError("Использованы обзорные границы регионов 1:50 млн.");}
    }).catch(()=>{if(active){setWorldAdminLines(null);
     setWorldAdminError("Не удалось загрузить границы регионов Natural Earth.");}});
   }else{setWorldAdminLines(null);
    setWorldAdminError("Не удалось загрузить границы регионов Natural Earth.");}
  });
  return()=>{active=false};
 },[citiesOn,scale>=2.5,scale>=3.5,refresh]);
 const mapSource=historical||mode==="political"||mode==="contour"||mode==="minerals"?source:null;
 const highDetail=modernBorders&&(russianView||!!detail&&scale>=5);
 // Simplify country paths to roughly a fraction of a display pixel. The old
 // fixed 0.00015 world-unit tolerance produced excessive SVG geometry at ×8.
 const precision=highDetail?(scale>=8?Math.max(.00015,.4/scale):.08):modernBorders?.13:.10;
 // Historical geometry must never depend on the completeness of the Russian
 // label dictionary. Every polygon in the dated source is drawn; only labels
 // and directory entries require translated names.
 const mapSourceFeatures=useMemo(()=>historical&&!modernReference?
  historicalMapFeatures(mapSource):
  mapSource?.features.filter(f=>!!atlasDisplayName(f,snapshot.year,false))??[],
  [mapSource,snapshot.year,historical,modernReference]);
 // Quantized viewport tiles avoid rebuilding expensive high-resolution paths on every pointer move.
 const tileScale=Math.pow(2,Math.floor(Math.log2(scale)));
 const tileWidth=900/tileScale,tileHeight=450/tileScale;
 const tileX=Math.round((450-position.x/scale)/tileWidth);
 const tileY=Math.round((225-position.y/scale)/tileHeight);
 const viewport=useMemo<MapWindow|undefined>(()=>highDetail&&scale>=3?
  {left:(tileX-3)*tileWidth,right:(tileX+3)*tileWidth,
   top:(tileY-3)*tileHeight,bottom:(tileY+3)*tileHeight}:undefined,
  [highDetail,tileX,tileY,tileScale,scale>=3]);
 const gridViewport=useMemo<MapWindow>(()=>{
  const worldW=900/scale,worldH=450/scale;
  const cx=450-position.x/scale,cy=225-position.y/scale;
  return {left:Math.max(0,cx-worldW/2),right:Math.min(900,cx+worldW/2),
   top:Math.max(0,cy-worldH/2),bottom:Math.min(450,cy+worldH/2)};
 },[scale,position.x,position.y]);
 const politicalColors=useMemo(()=>mode==="political"?colorPoliticalCountries(mapSourceFeatures):[],[mapSourceFeatures,mode]);
 const shapes=useMemo(()=>mapSourceFeatures.map((feature,i)=>({
  feature,path:mapFeaturePath(feature,precision,viewport),
  name:atlasDisplayName(feature,snapshot.year,historical&&!modernReference),i
 })).filter(f=>f.path&&(historical&&!modernReference||!!f.name)),[mapSourceFeatures,precision,viewport,snapshot.year,historical,modernReference]);
 // Feature label anchors depend only on immutable source geometry.
 // Reuse them when a deep-zoom viewport pans to the next clipping tile.
 const countryAnchorCache=useMemo(()=>mapSourceFeatures.map(feature=>featureLabelAnchor(feature)),
  [mapSourceFeatures]);
 const shapeAnchors=useMemo(()=>shapes.map(s=>({...s,anchor:countryAnchorCache[s.i]}))
  .filter(s=>s.anchor),[shapes,countryAnchorCache]);
 const labels=useMemo(()=>shapeAnchors
  .filter(s=>isRussianAtlasName(s.name)&&s.anchor!.area*scale*scale>190)
  .sort((a,b)=>b.anchor!.area-a.anchor!.area)
  .slice(0,scale>=12?220:scale>=3?145:85),[shapeAnchors,scale]);
 const waterTolerance=atlasWaterGeometryTolerance(Math.pow(2,Math.floor(Math.log2(scale))),detailedGeography);
 // Draw even unnamed waterways; only labels require Russian names.
 const streams=useMemo(()=>rivers?.features.map((f,i)=>({
  id:i,path:mapFeaturePath(f,waterTolerance,viewport),feature:f
 })).filter(v=>v.path)||[],[rivers,waterTolerance,viewport]);
 const riverNames=useMemo(()=>rivers?.features.filter(hasAtlasName).map((f,i)=>({
  id:i,point:featureLineMidpoint(f),feature:f
 })).filter(f=>f.point).sort((a,b)=>atlasRiverLabelRank(a.feature)-atlasRiverLabelRank(b.feature))||[],[rivers]);
 const ponds=useMemo(()=>lakes?.features.map((f,i)=>({
  id:i,path:mapFeaturePath(f,waterTolerance*.7,viewport),feature:f
 })).filter(v=>v.path)||[],[lakes,waterTolerance,viewport]);
 const lakeNames=useMemo(()=>lakes?.features.filter(hasAtlasName).map((f,i)=>({
  id:i,point:featureMapPoint(f),feature:f
 })).filter(f=>f.point).sort((a,b)=>
  Number(a.feature.properties?.scalerank??a.feature.properties?.SCALERANK??9)-
  Number(b.feature.properties?.scalerank??b.feature.properties?.SCALERANK??9))||[],[lakes]);
 const provinceViewport=useMemo<MapWindow|undefined>(()=>
  citiesOn&&scale>=4?
   {left:(tileX-2)*tileWidth,right:(tileX+2)*tileWidth,
    top:(tileY-2)*tileHeight,bottom:(tileY+2)*tileHeight}:viewport,
  [mode,scale>=4,tileX,tileY,tileWidth,tileHeight,viewport]);
 const provincePaths=useMemo(()=>administrative?.features
  .filter(f=>f.geometry&&(f.geometry.type==="Polygon"||f.geometry.type==="MultiPolygon"))
  .map((f,i)=>({id:i,path:mapFeaturePath(f,.2,provinceViewport),feature:f}))
  .filter(f=>f.path)||[],[administrative,provinceViewport]);
 const adminLineViewport=useMemo<MapWindow|undefined>(()=>citiesOn&&scale>=2.5?
  {left:(tileX-2)*tileWidth,right:(tileX+2)*tileWidth,
   top:(tileY-2)*tileHeight,bottom:(tileY+2)*tileHeight}:undefined,
  [citiesOn,scale>=2.5,tileX,tileY,tileWidth,tileHeight]);
 const worldAdminLinePaths=useMemo(()=>{
  if(!worldAdminLines||!adminLineViewport)return [];
  const west=adminLineViewport.left/2.5-180,east=adminLineViewport.right/2.5-180;
  const south=90-adminLineViewport.bottom/2.5,north=90-adminLineViewport.top/2.5;
  return worldAdminLines.features
   .filter(f=>!f.bbox||f.bbox[2]>=west&&f.bbox[0]<=east&&f.bbox[3]>=south&&f.bbox[1]<=north)
   .map((feature,i)=>({id:i,path:mapFeaturePath(feature,.13,adminLineViewport),feature}))
   .filter(f=>f.path);
 },[worldAdminLines,adminLineViewport]);
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
 const roadTiles=citiesOn?atlasOSMCoverageTiles(externalBounds,"roads"):[];
 const waterwayTiles=mode==="physical"?atlasOSMCoverageTiles(externalBounds,"waterways"):[];
 const cityTiles=citiesOn?atlasOSMCoverageTiles(externalBounds,"city-boundaries"):[];
 const roadTileKey=roadTiles.map(externalBBoxKey).sort().join("|");
 const waterwayTileKey=waterwayTiles.map(externalBBoxKey).sort().join("|");
 const cityTileKey=cityTiles.map(externalBBoxKey).sort().join("|");
 const roadsAvailable=roadTiles.length>0;
 const mineralsAvailable=canLoadMinerals(externalBounds);
 useEffect(()=>{
  let active=true;
  const loadRoads=citiesOn&&!!roadTileKey;
  const loadWaterways=mode==="physical"&&!!waterwayTileKey;
  if(!loadRoads&&!loadWaterways){
   setInfrastructure(null);setInfrastructureError("");return()=>{active=false};
  }
  setInfrastructure(null);setInfrastructureError("");
  const onPartial=(data:GeoCollection)=>{if(active)setInfrastructure(data)};
  const request=loadRoads?loadAtlasOSMCoverage(externalBounds,"roads",onPartial):
   loadAtlasOSMCoverage(externalBounds,"waterways",onPartial);
  request.then(v=>{if(active){setInfrastructure(v);setInfrastructureError("")}})
   .catch(()=>{if(active){setInfrastructure(null);
    setInfrastructureError("Основные дороги или водотоки OSM сейчас недоступны.")}});
  return()=>{active=false};
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[mode,roadTileKey,waterwayTileKey,citiesOn]);
 useEffect(()=>{
  let active=true;
  if(mode!=="minerals"||!mineralsAvailable){
   setMinerals(null);setMineralLoading(false);setMineralError("");
   return()=>{active=false};
  }
  setMineralLoading(true);
  loadMineralDeposits(externalBounds).then(v=>{if(active){
   setMinerals(v);setMineralLoading(false);setMineralError("");
  }}).catch(()=>{if(active){
   setMinerals(null);setMineralLoading(false);
   setMineralError("Не удалось получить сведения о месторождениях из USGS.");
  }});
  return()=>{active=false};
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[mode,externalKey,mineralsAvailable]);
 // Source-aware MRDS is complementary to the smaller major-deposits catalogue.
 // Debounce moving-camera queries so panning doesn't flood USGS requests.
 useEffect(()=>{
  let active=true;
  if(mode!=="minerals"||!mineralsAvailable){
   setMrdsRegion(null);setMrdsRegionLoading(false);return()=>{active=false};
  }
  const timer=setTimeout(()=>{
   if(!active)return;
   setMrdsRegionLoading(true);
   loadMRDSRegionalDeposits(externalBounds)
    .then(geo=>{if(active)setMrdsRegion(geo)})
    .catch(()=>{if(active)setMrdsRegion(null)})
    .finally(()=>{if(active)setMrdsRegionLoading(false)});
  },260);
  return()=>{active=false;clearTimeout(timer)};
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[mode,externalKey,mineralsAvailable]);
 const auxiliaryDetailZoom=Math.pow(2,Math.floor(Math.log2(scale)));
 const auxiliaryLines=useMemo(()=>infrastructure?.features.flatMap((feature,id)=>{
  const path=mapFeaturePath(feature,Math.max(.00003,.22/auxiliaryDetailZoom),viewport);
  return path?[{id,path,feature}]:[];
 })??[],[infrastructure,auxiliaryDetailZoom,viewport]);
 const auxiliaryRiverLabels=useMemo(()=>infrastructure?.features
  .filter(f=>f.properties?.ATLAS_KIND==="waterway")
  .map((feature,id)=>({id,feature,point:featureLineMidpoint(feature)}))
  .filter(f=>f.point).slice(0,80)??[],[infrastructure]);
 useEffect(()=>{
  let active=true;
  if(!citiesOn||!cityTileKey){
   setCityBoundaries(null);setCityBoundaryError("");return()=>{active=false};
  }
  loadAtlasOSMCoverage(externalBounds,"city-boundaries").then(data=>{if(active){
   setCityBoundaries(data);setCityBoundaryError("");
  }}).catch(()=>{if(active){setCityBoundaries(null);
   setCityBoundaryError("Данные городских границ OSM сейчас недоступны.");}});
  return()=>{active=false};
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[mode,cityTileKey,citiesOn]);
 const cityBoundaryPaths=useMemo(()=>cityBoundaries?.features.map((f,id)=>({
  id,feature:f,path:mapFeaturePath(f,Math.max(.0001,.32/Math.max(1,scale)),viewport)
 })).filter(f=>f.path)??[],[cityBoundaries,viewport,Math.floor(Math.log2(scale))]);
 useEffect(()=>{
  let active=true;
  if(mode!=="minerals"){
   setWorldMinerals(null);setWorldMineralsLoading(false);setWorldMineralError("");
   return()=>{active=false};
  }
  setWorldMineralsLoading(true);setWorldMineralError("");
  loadWorldMineralOverview().then(data=>{if(active){
   setWorldMinerals(data);setWorldMineralsLoading(false);
  }}).catch(()=>{if(active){
   setWorldMineralsLoading(false);setWorldMineralError("Обзорные данные USGS пока недоступны");
  }});
  return()=>{active=false};
 },[mode,refresh]);
 useEffect(()=>{
  let active=true;
  if(mode!=="minerals"){
   setMrdsWorld(null);setMrdsWorldError("");setMrdsWorldLoading(false);
   return()=>{active=false};
  }
  setMrdsWorldLoading(true);setMrdsWorldError("");
  loadMRDSWorldOverview()
   .then(data=>{if(active)setMrdsWorld(data)})
   .catch(()=>{if(active){setMrdsWorld(null);setMrdsWorldError("Дополнительный каталог MRDS недоступен.");}})
   .finally(()=>{if(active)setMrdsWorldLoading(false)});
  return()=>{active=false};
 },[mode,refresh]);
 const worldMineralPoints=useMemo(()=>[...(worldMinerals?.features??[]),...(mrdsWorld?.features??[])]
  .flatMap((feature,id)=>{
   const point=featureMapPoint(feature),commodity=mineralCommodity(feature)??mrdsMineralCommodity(feature);
   return point&&commodity?[{id,point,feature,commodity}]:[];
  }),[worldMinerals,mrdsWorld]);
 const mineralPoints=useMemo(()=>[...(minerals?.features??[]),...(mrdsRegion?.features??[])]
  .flatMap((feature,id)=>{
   const point=featureMapPoint(feature),commodity=mineralCommodity(feature)??mrdsMineralCommodity(feature);
   return point&&commodity?[{id,point,feature,commodity}]:[];
  }),[minerals,mrdsRegion]);
 const localMineralDetail=mineralsAvailable&&scale>=6&&mineralPoints.length>0;
 // Continuous wheel/pinch zoom previously regrouped thousands of deposits on
 // every animation frame. Grouping is screen-space approximate, so quarter-
 // octave levels preserve symbol density while avoiding redundant work.
 const mineralClusterScale=Math.pow(2,Math.floor(Math.log2(Math.max(1,scale))*4)/4);
 const mineralGroups=useMemo(()=>clusterMineralMapPoints(
  localMineralDetail?mineralPoints:worldMineralPoints,mineralClusterScale,mineralFilter,420
 ),[localMineralDetail,mineralPoints,worldMineralPoints,mineralClusterScale,mineralFilter]);
  const visibleMinerals=(localMineralDetail?mineralPoints:[]).filter(f=>
  (mineralFilter==="Все виды"||f.commodity.name===mineralFilter)&&
  f.point[0]>=visibleWorld.left&&f.point[0]<=visibleWorld.right&&
  f.point[1]>=visibleWorld.top&&f.point[1]<=visibleWorld.bottom).slice(0,750);
 const visiblePoint=(pt:readonly number[]|null|undefined)=>!!pt&&
  pt[0]>=visibleWorld.left-12/scale&&pt[0]<=visibleWorld.right+12/scale&&
  pt[1]>=visibleWorld.top-12/scale&&pt[1]<=visibleWorld.bottom+12/scale;
 // Only large, source-backed cities are orientation points on the minerals
 // layer. The density grows with zoom, but neither roads nor town boundaries
 // are loaded just to show these reference points.
 const mineralCityFloor=scale<2?2500000:scale<5?1000000:scale<14?350000:150000;
 const mineralLandmarkCities=useMemo(()=>mineralContext?
  limitCitySymbols(cityPoints.filter(f=>cityPopulation(f.feature)>=mineralCityFloor&&
   f.point&&visiblePoint(f.point)),scale,scale<2?95:scale<5?150:260):[],
  // Viewport is intentionally included: changing the camera changes its visible cities.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [mineralContext,cityPoints,mineralCityFloor,scale,position.x,position.y]);
 const mineralCityLabels=useMemo(()=>chooseCityLabels(mineralLandmarkCities,scale,
  scale<2?34:scale<5?60:120),[mineralLandmarkCities,scale]);
 const eligibleCities=cityPoints.filter(f=>visiblePoint(f.point)&&
  ((cityPopulation(f.feature)>=minCityPopulation&&matchesCityCategory(f.feature,cityCategory))||f.feature===selected));
 const visibleCitySymbols=limitCitySymbols(eligibleCities,scale,scale<1.6?75:scale<3?130:scale<8?240:scale<24?440:720);
 const focusCity=eligibleCities.find(f=>f.feature===selected);
 const shownCities=focusCity&&!visibleCitySymbols.some(f=>f.feature===selected)?
  [...visibleCitySymbols,focusCity]:visibleCitySymbols;
 const shownCapitals=cityPoints.filter(f=>visiblePoint(f.point)&&nationalCapital(f.feature));
 const totalCapitals=cityPoints.filter(f=>nationalCapital(f.feature)).length;
 const cityLabels=chooseCityLabels(shownCities,scale,scale>=20?145:scale>=7?75:scale>=3?40:15);
 const capitalLabels=chooseCityLabels(shownCapitals,scale,scale>=12?160:scale>=5?95:scale>=2?55:30);
 const contourCapitals=limitCitySymbols(shownCapitals,scale,scale<1.6?75:scale<3?130:scale<8?240:scale<24?440:720);
 const contourCities=limitCitySymbols(eligibleCities.filter(f=>!nationalCapital(f.feature)&&cityPopulation(f.feature)>=500000),scale,scale<1.6?75:scale<3?130:scale<8?240:scale<24?440:720);
 const shownPeaks=peakPoints.filter(f=>visiblePoint(f.point));
 const shownRiverNames=riverNames.filter(f=>visiblePoint(f.point));
 const shownLakeNames=lakeNames.filter(f=>visiblePoint(f.point));
 const shownMarineNames=marineNames.filter(f=>visiblePoint(f.point));
 const shownNatureNames=natureNames.filter(f=>visiblePoint(f.point));
 const provinceAnchorCache=useMemo(()=>administrative?.features.map(feature=>featureLabelAnchor(feature))??[],
  [administrative]);
 const provinceAnchors=useMemo(()=>provincePaths.map(f=>({...f,anchor:provinceAnchorCache[f.id]})),
  [provincePaths,provinceAnchorCache]);
 const provinceLabels=provinceAnchors.filter(f=>f.anchor&&f.anchor.area*scale*scale>160&&visiblePoint(f.anchor?[f.anchor.x,f.anchor.y]:null))
  .sort((a,b)=>(b.anchor?.area??0)-(a.anchor?.area??0)).slice(0,70);
 // Unified screen-space label placement. Shared occupancy prevents a city label
 // from covering another capital or state and avoids overlapping physical names.
 const placedMapLabels=useMemo(()=>{
  if(!d.showLabels||mode==="contour")return [] as AtlasLabelCandidate[];
  const candidates:AtlasLabelCandidate[]=[];
  const font=(base:number)=>Math.min(18,base+Math.log2(Math.max(1,scale))*.88);
  const add=(id:string,kind:AtlasLabelKind,text:string,x:number,y:number,
   priority:number,base:number,align:"middle"|"start"="middle",dx=0,dy=0)=>{
   if(text)candidates.push({id,kind,text,x,y,priority,fontSize:font(base),align,dx,dy});
  };
  if(mode==="political"||mode==="minerals"||historical){
   labels.forEach((f,i)=>add("country-"+f.i,"country",f.name,
    f.anchor!.x,f.anchor!.y,(historical?-1:mineralContext?1.7:0)+i/500,historical?9.3:8.2));
   if(mode==="political"){
    // State capitals take precedence over all other atlas labels.
    if(scale>=2.6)capitalLabels.forEach((f,i)=>add("capital-"+f.id,"capital",russianPlaceName(f.feature)??"",
     f.point![0],f.point![1],-10+i/10000,11,"start",8,-7));
    if(scale>=4)provinceLabels.forEach((f,i)=>add("province-"+f.id,"province",geoFeatureName(f.feature),
     f.anchor!.x,f.anchor!.y,2+i/500,7.1));
   }
  }
  if(citiesOn&&scale>=4.2)cityLabels.filter(f=>!nationalCapital(f.feature)).forEach((f,i)=>add("city-"+f.id,"city",
   russianPlaceName(f.feature)??"",f.point![0],f.point![1],i/500,9.5,"start",7,-5));
  if(mineralContext){
   mineralCityLabels.forEach((f,i)=>add("mineral-city-"+f.id,"city",
    russianPlaceName(f.feature)??"",f.point![0],f.point![1],-.8+i/500,7.4,"start",6,-4));
   shownRiverNames.slice(0,scale<2?20:scale<6?42:65).forEach((f,i)=>
    add("mineral-river-"+f.id,"river",geoFeatureName(f.feature),
     f.point![0],f.point![1],.4+i/500,7.1));
   if(scale>=2)shownNatureNames.slice(0,scale<6?18:32).forEach((f,i)=>
    add("mineral-relief-"+f.id,"nature",geoFeatureName(f.feature),
     f.point![0],f.point![1],1.2+i/500,7));
  }
  if(mode==="physical"){
   if(scale>=2){
    shownMarineNames.slice(0,52).forEach((f,i)=>add("sea-"+f.id,"sea",geoFeatureName(f.feature),
     f.point![0],f.point![1],i/500,7.3));
    shownLakeNames.slice(0,65).forEach((f,i)=>add("lake-"+f.id,"lake",geoFeatureName(f.feature),
     f.point![0],f.point![1],1+i/500,7));
    shownNatureNames.slice(0,85).forEach((f,i)=>add("nature-"+f.id,"nature",geoFeatureName(f.feature),
     f.point![0],f.point![1],2+i/500,7.1));
   }
   if(scale>=3)shownRiverNames.slice(0,70).forEach((f,i)=>
    add("river-"+f.id,"river",geoFeatureName(f.feature),f.point![0],f.point![1],3+i/500,7));
   if(scale>=16)shownPeaks.slice(0,50).forEach((f,i)=>
    add("peak-"+f.id,"peak",geoFeatureName(f.feature),f.point![0],f.point![1],4+i/500,7,"start",6,-5));
   if(scale>=64)auxiliaryRiverLabels.filter(f=>f.point&&visiblePoint(f.point))
    .slice(0,40).forEach((f,i)=>add("stream-"+f.id,"stream",geoFeatureName(f.feature),
     f.point![0],f.point![1],5+i/500,6.8));
  }
  return layoutAtlasLabels(candidates,scale,scale>=16?225:scale>=3?155:90);
 },[d.showLabels,mode,historical,citiesOn,mineralContext,labels,capitalLabels,cityLabels,mineralCityLabels,provinceLabels,
  shownMarineNames,shownLakeNames,shownRiverNames,shownNatureNames,shownPeaks,
  auxiliaryRiverLabels,scale,position.x,position.y]);
 const visibleMapLabels=useMemo(()=>new Set(placedMapLabels.map(v=>v.id)),[placedMapLabels]);
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
 useEffect(()=>{
  if(selected||selectedMineral||selectedMarker)setInspectorOpen(true)
 },[selected,selectedMineral,selectedMarker]);
 const selectedReferenceId=!historical&&selected?atlasFactEntityId(selected.properties):null;
 const [schoolReference,setSchoolReference]=useState<AtlasSchoolReference|null>(null);
 const [schoolReferenceLoading,setSchoolReferenceLoading]=useState(false);
 const [schoolReferenceError,setSchoolReferenceError]=useState("");
 useEffect(()=>{
  let active=true;setSchoolReference(null);setSchoolReferenceError("");
  if(!selectedReferenceId){setSchoolReferenceLoading(false);return()=>{active=false}}
  setSchoolReferenceLoading(true);
  fetchAtlasSchoolReference(selectedReferenceId)
   .then(value=>{if(active){setSchoolReference(value);setSchoolReferenceLoading(false)}})
   .catch(()=>{if(active){setSchoolReferenceError("Дополнительные сведения сейчас недоступны.");setSchoolReferenceLoading(false)}});
  return()=>{active=false};
 },[selectedReferenceId]);
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
  ((selectedArticle?.name??fallbackReference?.title??atlasDisplayName(selected,snapshot.year,historical&&!modernReference))||
   (historical?"Историческая территория":""))):"";
 const selectedCountrySymbol=selected&&!selectedIsCity&&(historical||mode==="political")&&
  (selected.geometry?.type==="Polygon"||selected.geometry?.type==="MultiPolygon")?
  atlasCountrySymbol(selected,selectedTitle,snapshot.year,historical&&!modernReference):null;
 const selectedYears=selectedRaw?historyIndex.filter(record=>record.countries.some(name=>
  normalizeHistoricalReferenceName(name)===normalizeHistoricalReferenceName(selectedRaw))).map(record=>record.year):[];
 const markerDetails=userMarkers.find(m=>m.id===selectedMarker)??null;
 const namedFeatures=mode==="physical"?[...landforms.map(f=>f.feature),...peakPoints.map(f=>f.feature),...natureNames.map(f=>f.feature),...ponds.map(f=>f.feature),...(rivers?.features.filter(hasAtlasName)??[]),...marineNames.map(f=>f.feature)]:
  mode==="hydrography"?[...ponds.map(f=>f.feature),...(rivers?.features.filter(hasAtlasName)??[]),...marineNames.map(f=>f.feature)]:
  mode==="political"?[...mapSourceFeatures,...(administrative?.features.filter(hasAtlasName)??[]),...cityPoints.filter(p=>russianPlaceName(p.feature)&&matchesCityCategory(p.feature,cityCategory)).map(p=>p.feature)]:
  mapSourceFeatures;
 const directoryEntries=useMemo(()=>historical?mapSourceFeatures.map(feature=>({
  name:atlasDisplayName(feature,snapshot.year,!modernReference),feature}))
  .filter(v=>isRussianAtlasName(v.name))
  .sort((a,b)=>a.name.localeCompare(b.name,"ru")):[],
  [historical,mapSourceFeatures,modernReference,snapshot.year]);
 const visibleDirectory=directoryEntries.filter(entry=>entry.name.toLocaleLowerCase("ru")
  .includes(directoryFilter.trim().toLocaleLowerCase("ru")));
 const referenceQuery=directoryFilter.trim().toLocaleLowerCase("ru");
 const visibleHistoricalReferences=historicalReferences.filter(entry=>(!referenceOnlyCurrentPeriod||modernReference||
   snapshot.year>=entry.from&&snapshot.year<=entry.to)&&(!referenceQuery||
   [entry.title,...entry.aliases].some(name=>name.toLocaleLowerCase("ru").includes(referenceQuery))))
  .sort((a,b)=>{
   // Keep the current epoch at the top without hiding research from other eras.
   const presentA=Number(snapshot.year>=a.from&&snapshot.year<=a.to);
   const presentB=Number(snapshot.year>=b.from&&snapshot.year<=b.to);
   return presentB-presentA||a.title.localeCompare(b.title,"ru");
  });
 // Index only *existing* named shapes in pinned historical snapshots. A reference
 // never creates geometry: the button is shown only if the source index has it.
 const indexedReferenceMaps=useMemo(()=>{
  const byAlias=new Map<string,Array<{year:number;raw:string}>>();
  for(const record of historyIndex)for(const raw of record.countries){
   const key=normalizeHistoricalReferenceName(raw);
   const matches=byAlias.get(key);
   if(matches)matches.push({year:record.year,raw});
   else byAlias.set(key,[{year:record.year,raw}]);
  }
  const links=new Map<string,{year:number;raw:string}>();
  for(const entry of historicalReferences){
   const matches=[entry.title,...entry.aliases].flatMap(alias=>byAlias.get(normalizeHistoricalReferenceName(alias))??[])
    .filter(hit=>hit.year>=entry.from&&hit.year<=entry.to)
    .sort((a,b)=>Math.abs(a.year-snapshot.year)-Math.abs(b.year-snapshot.year));
   if(matches.length)links.set(entry.id,matches[0]);
  }
  return links;
 },[historyIndex,snapshot.year]);
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
    const key=normalizeHistoricalReferenceName(raw);
    const old=found.get(key);
    if(old){if(!old.years.includes(record.year))old.years.push(record.year);}
    else found.set(key,{name:title,raw,years:[record.year]});
   }
  }
  return [...found.values()].map(item=>({...item,years:item.years.sort((a,b)=>a-b)}))
    .sort((a,b)=>a.name.localeCompare(b.name,"ru")).slice(0,60);
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
  x:450+(p.x-450-cameraRef.current.position.x)/cameraRef.current.scale,
  y:225+(p.y-225-cameraRef.current.position.y)/cameraRef.current.scale
 });
 const zoomAt=(next:number,point=lastPointer.current)=>{
  scheduleCamera(zoomAtlasCamera(cameraRef.current,next,point));
 };
 // All annotation pointer positions use the SVG root, never the label's
 // small bounding box. This keeps dragging correct at any atlas zoom and on
 // mobile viewBox letterboxing.
 const annotationWorld=(e:{clientX:number;clientY:number})=>{
  const rect=mapSvgRef.current?.getBoundingClientRect();
  if(!rect)return null;
  const factor=Math.min(rect.width/900,rect.height/450)||1;
  return worldPoint({x:(e.clientX-rect.left-(rect.width-900*factor)/2)/factor,
   y:(e.clientY-rect.top-(rect.height-450*factor)/2)/factor});
 };
 const brushContour=(e:ReactPointerEvent<SVGSVGElement>)=>{
  const gesture=eraserGesture.current,point=annotationWorld(e);
  if(!gesture||gesture.pointerId!==e.pointerId||!point)return;
  const hits=contourEraserHits(contourMarks,[],point,cameraRef.current.scale,Math.max(14,toolThickness*5));
  let changed=false;
  for(const id of hits.marks)if(!gesture.marks.has(id)){gesture.marks.add(id);changed=true}
  const last=gesture.path[gesture.path.length-1];
  if(!last||Math.hypot(point.x-last.x,point.y-last.y)>1.2/cameraRef.current.scale){
   if(gesture.path.length<700)gesture.path.push(point);
   // Recalculate cut segments during the gesture, not after pointer-up.
   setLiveErasedStrokes(eraseContourInkAlongPath(contourStrokes,gesture.path,
    (toolThickness*5+2)/cameraRef.current.scale));
  }
  // A filled polygon is also student work: erase its colour without panning.
  // elementFromPoint works after SVG pointer capture and supports swiping.
  const polygon=(e.target as Element).closest<SVGElement>("[data-contour-fill-key]")??
   document.elementFromPoint(e.clientX,e.clientY)?.closest<SVGElement>("[data-contour-fill-key]");
  const key=polygon?.getAttribute("data-contour-fill-key");
  if(key&&painted[key]&&!gesture.fills.has(key)){gesture.fills.add(key);changed=true}
  if(changed)setPendingErasure({marks:[...gesture.marks],fills:[...gesture.fills]});
 };
 const beginContourErase=(e:ReactPointerEvent<SVGSVGElement>)=>{
  if(e.pointerType==="mouse"&&e.button!==0)return;
  e.preventDefault();e.stopPropagation();
  if(eraserGesture.current)return;
  setLiveErasedStrokes(null);
  eraserGesture.current={pointerId:e.pointerId,marks:new Set(),fills:new Set(),path:[]};
  e.currentTarget.setPointerCapture(e.pointerId);
  brushContour(e);
 };
 const moveContourErase=(e:ReactPointerEvent<SVGSVGElement>)=>{
  e.stopPropagation();brushContour(e);
 };
 const endContourErase=(e:ReactPointerEvent<SVGSVGElement>)=>{
  e.stopPropagation();
  const gesture=eraserGesture.current;
  if(!gesture||gesture.pointerId!==e.pointerId)return;
  brushContour(e);
  if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);
  eraserGesture.current=null;
  setPendingErasure({marks:[],fills:[]});
  setLiveErasedStrokes(null);
  contourEraserPreview.current?.setAttribute("d","");
  const erasedStrokes=eraseContourInkAlongPath(contourStrokes,gesture.path,(toolThickness*5+2)/cameraRef.current.scale);
  if(!gesture.marks.size&&erasedStrokes===contourStrokes&&!gesture.fills.size)return;
  captureContour();
  onChange?.({...d,contourMarks:contourMarks.filter(mark=>!gesture.marks.has(mark.id)),
   contourStrokes:erasedStrokes,
   paintedCountries:Object.fromEntries(Object.entries(painted).filter(([key])=>!gesture.fills.has(key)))});
 };
 const cancelContourErase=(e:ReactPointerEvent<SVGSVGElement>)=>{
  if(eraserGesture.current?.pointerId!==e.pointerId)return;
  e.stopPropagation();
  if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);
  eraserGesture.current=null;contourEraserPreview.current?.setAttribute("d","");setPendingErasure({marks:[],fills:[]});setLiveErasedStrokes(null);
 };
 const startContourMarkDrag=(e:ReactPointerEvent<SVGGElement>,mark:ContourMark)=>{
  if(!worksheetEditor||contourAction!=="select"||!onChange||markerGesture.current)return;
  if(e.pointerType==="mouse"&&e.button!==0)return;
  const start=annotationWorld(e);if(!start)return;
  e.preventDefault();e.stopPropagation();
  markerGesture.current={pointerId:e.pointerId,mark,start,moved:false};
  setSelectedContourMarkId(mark.id);setPreviewContourMark(null);
  e.currentTarget.setPointerCapture(e.pointerId);
 };
 const moveContourMarkDrag=(e:ReactPointerEvent<SVGGElement>)=>{
  const gesture=markerGesture.current;
  if(!gesture||gesture.pointerId!==e.pointerId)return;
  e.preventDefault();e.stopPropagation();
  const point=annotationWorld(e);if(!point)return;
  if(!gesture.moved&&Math.hypot(point.x-gesture.start.x,point.y-gesture.start.y)<2/cameraRef.current.scale)return;
  gesture.moved=true;
  setPreviewContourMark(moveContourMark(gesture.mark,gesture.start,point));
 };
 const endContourMarkDrag=(e:ReactPointerEvent<SVGGElement>,cancelled=false)=>{
  const gesture=markerGesture.current;
  if(!gesture||gesture.pointerId!==e.pointerId)return;
  e.stopPropagation();
  if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);
  markerGesture.current=null;
  if(cancelled||!gesture.moved){setPreviewContourMark(null);return;}
  const point=annotationWorld(e);
  if(!point)return;
  const moved=moveContourMark(gesture.mark,gesture.start,point);
  if(moved.lon===gesture.mark.lon&&moved.lat===gesture.mark.lat){
   setPreviewContourMark(null);return;
  }
  // Keep this position visible across the async parent/board state update.
  // Avoid rendering a frame at the previously persisted coordinates.
  setPreviewContourMark(moved);
  captureContour();
  onChange?.({...d,contourMarks:contourMarks.map(mark=>mark.id===gesture.mark.id?moved:mark)});
 };
 const contourEraser=worksheetEditor&&contourAction==="erase"&&!!onChange;
 const contourFreehand=worksheetEditor&&contourAction==="pen"&&contourConfig.allowDrawing&&!!onChange;
 const contourPoint=(p:{x:number;y:number}):[number,number]=>[
  Math.max(-180,Math.min(180,p.x/2.5-180)),Math.max(-90,Math.min(90,90-p.y/2.5))];
 const beginContourStroke=(e:ReactPointerEvent<SVGSVGElement>)=>{
  if(e.pointerType==="mouse"&&e.button!==0)return;
  e.stopPropagation();
  // Allow two-finger navigation even if the student left the pencil selected.
  // The second touch cancels the provisional ink stroke and starts a map-only
  // pinch, never a board pinch or an accidentally persisted drawing.
  if(e.pointerType==="touch"){
   onPointerDown(e);
   if(pinch.current){
    contourDrawing.current=[];
    contourLivePath.current?.setAttribute("d","");
    e.currentTarget.setPointerCapture(e.pointerId);
    return;
   }
  }
  e.currentTarget.setPointerCapture(e.pointerId);
  contourDrawing.current=[contourPoint(worldPoint(localPoint(e)))];
  if(contourLivePath.current)contourLivePath.current.setAttribute("stroke",paintColor);
 };
 const moveContourStroke=(e:ReactPointerEvent<SVGSVGElement>)=>{
  if(e.pointerType==="touch"){
   if(pinch.current){onMove(e);return}
   // Keep the first touch current for a possible second-finger pinch.
   if(points.current.has(e.pointerId))points.current.set(e.pointerId,localPoint(e));
  }
  if(!contourDrawing.current.length)return;
  const point=contourPoint(worldPoint(localPoint(e)));
  const pts=contourDrawing.current,last=pts[pts.length-1];
  if(Math.hypot(last[0]-point[0],last[1]-point[1])<.6/cameraRef.current.scale)return;
  if(pts.length<2000)pts.push(point);
  const path=pts.map((p,i)=>{const [x,y]=projectGeography(p[0],p[1]);
   return (i?"L":"M")+x.toFixed(3)+" "+y.toFixed(3)}).join(" ");
  contourLivePath.current?.setAttribute("d",path);
 };
 const endContourStroke=(e:ReactPointerEvent<SVGSVGElement>)=>{
  const wasPinching=e.pointerType==="touch"&&(!!pinch.current||contourDrawing.current.length===0);
  if(e.pointerType==="touch")onPointerEnd(e);
  else if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);
  const points=contourDrawing.current;contourDrawing.current=[];
  contourLivePath.current?.setAttribute("d","");
  if(wasPinching||points.length<2||contourStrokes.length>=140)return;
  // Match the board's pencil: a stroke can continue as long as the user
  // draws. Split only at save time to respect the atlas' bounded format.
  const segments:ContourStroke[]=[];
  for(let offset=0;offset<points.length-1;offset+=249){
   const part=points.slice(offset,offset+250);
   if(part.length>=2)segments.push({
    id:globalThis.crypto?.randomUUID?.()??String(Date.now())+Math.random(),
    points:part,color:paintColor,width:toolThickness});
  }
  if(contourStrokes.length+segments.length>140)return;
  captureContour();
  onChange?.({...d,contourStrokes:[...contourStrokes,...segments]});
 };
 const cancelContourStroke=(e:ReactPointerEvent<SVGSVGElement>)=>{
  contourDrawing.current=[];
  contourLivePath.current?.setAttribute("d","");
  if(e.pointerType==="touch")onPointerEnd(e);
  else if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);
 };
 const onPointerDown=(e:ReactPointerEvent<SVGSVGElement>)=>{
  if(e.pointerType==="mouse"&&e.button!==0)return;
  const pt=localPoint(e);
  lastPointer.current=pt;
  points.current.set(e.pointerId,pt);
  if(points.current.size===1){
   dragged.current=false;
   pointer.current={id:e.pointerId,x:pt.x,y:pt.y,
    fromX:cameraRef.current.position.x,fromY:cameraRef.current.position.y};
  }else if(points.current.size===2){
   dragged.current=true;
   const [a,b]=[...points.current.values()];
   pinch.current={distance:Math.hypot(a.x-b.x,a.y-b.y)||1,scale:cameraRef.current.scale,
    position:cameraRef.current.position,mid:{x:(a.x+b.x)/2,y:(a.y+b.y)/2}};
  }
  // Capture only after dragging. Immediate capture would steal click/tap
  // events from countries, rivers, cities and historical markers.
 };
 const onMove=(e:ReactPointerEvent<SVGSVGElement>)=>{
  const pt=localPoint(e);
  lastPointer.current=pt;
  if(!points.current.has(e.pointerId))return;
  points.current.set(e.pointerId,pt);
  if(points.current.size===2&&pinch.current){
   const [a,b]=[...points.current.values()],g=pinch.current;
   const next=clamp(g.scale*Math.hypot(a.x-b.x,a.y-b.y)/g.distance,1,MAX_ATLAS_ZOOM);
   const mid={x:(a.x+b.x)/2,y:(a.y+b.y)/2};
   const focus={x:450+(g.mid.x-450-g.position.x)/g.scale,
    y:225+(g.mid.y-225-g.position.y)/g.scale};
   scheduleCamera({scale:next,position:normalizePosition({x:mid.x-450-(focus.x-450)*next,
    y:mid.y-225-(focus.y-225)*next},next)});
   return;
  }
  // The hand is the only tool that pans the map with one finger. Other
  // contour tools still permit a two-finger pinch in the block above.
  if(worksheetEditor&&contourAction!=="hand")return;
  const p=pointer.current;if(!p||p.id!==e.pointerId)return;
  if(Math.hypot(pt.x-p.x,pt.y-p.y)>3)dragged.current=true;
  if(dragged.current&&!e.currentTarget.hasPointerCapture(e.pointerId)){
   e.currentTarget.setPointerCapture(e.pointerId);
   e.currentTarget.classList.add("is-atlas-panning");
  }
  scheduleCamera({scale:cameraRef.current.scale,position:normalizePosition({x:p.fromX+pt.x-p.x,y:p.fromY+pt.y-p.y},cameraRef.current.scale)});
 };
 const onPointerEnd=(e:ReactPointerEvent<SVGSVGElement>)=>{
  if(cameraFrame.current!==null||cameraIdleRef.current!==null)commitCamera(cameraRef.current);
  points.current.delete(e.pointerId);pinch.current=null;
  if(!points.current.size)e.currentTarget.classList.remove("is-atlas-panning");
  if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);
  const next=[...points.current.entries()][0];
  pointer.current=next?{id:next[0],x:next[1].x,y:next[1].y,
   fromX:cameraRef.current.position.x,fromY:cameraRef.current.position.y}:null;
 };
 const reset=()=>{commitCamera(atlasRegionCamera(selectedRegion));setSelected(null);setCoord(null)};
 const changeRegion=(id:string)=>{setRegionId(id);setFocusedUnit("");onChange?.({...d,regionId:id})};
 const paintProvince=(feature:GeoFeature)=>{
  if(mode!=="contour"||!contourConfig.allowFill||contourAction!=="fill"||!paintRegions||dragged.current)return;
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
   if(!contourConfig.allowFill)return;
   if(dragged.current||paintRegions||contourAction!=="fill")return;
   const key=String(feature.properties?.ADM0_A3||feature.properties?.ISO_A3||geoFeatureName(feature));
   savePaint({...painted,[key]:paintColor});
   return;
  }
  selectFeature(feature,historical?"Историческая территория":"Государство");
 };
 const jumpToPeriod=(year:number,raw?:string)=>{
  const next=nearestSnapshotIndex(year);
  const followRaw=raw??(historical&&!modernReference&&selectedRaw?selectedRaw:undefined);
  pendingJump.current=followRaw?{year:historicalSnapshots[next].year,raw:followRaw}:null;
  if(index===next&&followRaw){
   const feature=source?.features.find(f=>normalizeHistoricalReferenceName(String(f.properties?.NAME??""))===
    normalizeHistoricalReferenceName(followRaw));
   if(feature){pendingJump.current=null;focusFeature(feature)}
   return;
  }
  setIndex(next);if(onChange)onChange({...d,year:historicalSnapshots[next].year});
  setSelected(null);setHistoryTab(followRaw?"article":"directory");
 };
 useEffect(()=>{
  const target=pendingJump.current;
  if(!target||!source||target.year!==snapshot.year||sourceYear!==snapshot.year)return;
  const match=source.features.find(f=>normalizeHistoricalReferenceName(String(f.properties?.NAME??""))===
   normalizeHistoricalReferenceName(target.raw));
  if(!match){pendingJump.current=null;setHistoryTab("directory");return;}
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
  if(dragged.current)return;
  if(mode==="contour"){
   if(contourAction==="label"&&!contourConfig.allowLabels||contourAction==="point"&&!contourConfig.allowPoints)return;
   if(!onChange||(contourAction!=="label"&&contourAction!=="point"))return;
   if(contourAction==="label"&&!contourText.trim())return;
   if(contourMarks.length>=150)return;
   const p=worldPoint(localPoint(e as unknown as ReactPointerEvent<SVGSVGElement>));
   if(p.x<0||p.x>900||p.y<0||p.y>450)return;
   captureContour();
   onChange({...d,contourMarks:[...contourMarks,{
    id:globalThis.crypto?.randomUUID?.()??String(Date.now())+Math.random(),
    lon:p.x/2.5-180,lat:90-p.y/2.5,
    text:contourText.trim().slice(0,80),color:paintColor,
    kind:contourAction==="label"?"label":"point"
   }]});return;
  }
  if(!coordinatesEnabled&&!terrainEnabled)return;
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
   selectedIsCity?48:4096;
  const s=clamp(Math.max(2,target),1,MAX_ATLAS_ZOOM);
  commitCamera({scale:s,position:normalizePosition({x:-(point[0]-450)*s,y:-(point[1]-225)*s},s)});setSelected(f);if(historical)setHistoryTab("article");setSelectedLayer(explicitLayer??(nationalCapital(f)?"Столица":
   String(f.properties?.FEATURECLA??"").includes("Populated place")?"Населённый пункт":
   mode==="relief"?"Форма рельефа":mode==="hydrography"?"Водный объект":"Государство"));
  setSelectedMarker(null);
 };
 return <div className={"lektrus-atlas "+(isWorksheet?"lektrus-atlas--worksheet ":"")+(isWorksheet&&objectMoveMode?"lektrus-atlas--board-selection ":"")+(isWorksheet&&!objectMoveMode&&contourAction==="erase"?"lektrus-atlas--erasing ":"")+(historical?"lektrus-atlas-history ":"")+(editorMode?"lektrus-atlas--editor ":"")+(inspectorOpen?"":"lektrus-atlas--inspector-hidden")} aria-label={d.title}
  onPointerDown={e=>{if(!objectMoveMode)e.stopPropagation()}}
  onPointerMove={e=>{if(!objectMoveMode)e.stopPropagation()}}
  onPointerUp={e=>{if(!objectMoveMode)e.stopPropagation()}}
  onPointerCancel={e=>{if(!objectMoveMode)e.stopPropagation()}}
  onClick={e=>{if(!objectMoveMode)e.stopPropagation()}}>
  {!isWorksheet&&<header className="lektrus-atlas-header">
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
   <div ref={territoryMenuRef} className="lektrus-atlas-territory-dropdown">
    <button type="button" className="lektrus-atlas-territory-trigger"
     title="Выбрать территорию карты" aria-expanded={territoryMenuOpen}
     aria-haspopup="listbox" onClick={()=>setTerritoryMenuOpen(o=>!o)}>
     <span className="lektrus-atlas-territory-trigger-icon">⌖</span>
     <span className="lektrus-atlas-territory-trigger-name">
      {atlasRegions.find(region=>region.id===regionId)?.title??"Весь мир"}
     </span><span aria-hidden="true">⌄</span>
    </button>
    {territoryMenuOpen&&<div role="listbox" aria-label="Территория карты"
     className="lektrus-atlas-territory-menu">
     {atlasRegionGroups.map(group=><div key={group} className="lektrus-atlas-territory-group">
      <strong>{group}</strong>
      {atlasRegions.filter(region=>region.group===group).map(region=>
       <button key={region.id} type="button" role="option"
        aria-selected={region.id===regionId} className={region.id===regionId?"active":""}
        onClick={()=>{changeRegion(region.id);setTerritoryMenuOpen(false)}}>
        <span>{region.title}</span>{region.id===regionId&&<span aria-hidden="true">✓</span>}
       </button>)}
     </div>)}
     {subregions.length>0&&!historical&&<div className="lektrus-atlas-territory-group">
      <strong>Административные единицы региона</strong>
      {subregions.map(unit=><button type="button" role="option" key={unit.key}
       aria-selected={focusedUnit===unit.key} className={focusedUnit===unit.key?"active":""}
       onClick={()=>{setFocusedUnit(unit.key);focusFeature(unit.feature,"Административная единица");
        setTerritoryMenuOpen(false)}}>{unit.name}</button>)}
     </div>}
    </div>}
   </div>
   <button type="button" className={"lektrus-atlas-coordinate-toggle"+(coordinatesEnabled?" active":"")}
    title="Определять широту и долготу на любой карте"
    aria-pressed={coordinatesEnabled}
    onClick={()=>{
     const enabled=!coordinatesEnabled;setCoordinatesEnabled(enabled);setCoord(null);
     onChange?.({...d,mode:normalizeAtlasMode(d.mode),showCoordinates:enabled});
    }}>⌖ Координаты</button>
   <button type="button" className="lektrus-atlas-inspector-toggle" aria-expanded={inspectorOpen}
    title={inspectorOpen?"Скрыть сведения и открыть карту во всю ширину":"Открыть сведения и поиск по карте"}
    onClick={()=>setInspectorOpen(open=>!open)}>{inspectorOpen?"Скрыть сведения":"☷ Сведения"}</button>
  </header>}
  <div className="lektrus-atlas-body">
   <div className="lektrus-atlas-map-box">
    {(loading||baseLoading)&&<div className="lektrus-atlas-overlay" role="status">Загружается общая подложка и слои карты…</div>}
    {!loading&&!baseLoading&&(error||baseError)&&<div className="lektrus-atlas-overlay lektrus-atlas-failure" role="alert">
     <strong>Карта недоступна</strong><span>{error||baseError}</span>
     <button type="button" onClick={()=>setRefresh(i=>i+1)}>Повторить загрузку</button>
     <small>Границы не заменяются вымышленными. Для доступа необходим интернет.</small>
    </div>}
    <svg ref={mapSvgRef} viewBox="0 0 900 450" className="lektrus-atlas-svg" role="img"
     onClick={objectMoveMode?undefined:pickCoordinates}
     aria-label={historical?"Историческая карта мира: "+yearLabel(snapshot.year):"Карта мира: "+mapModeTitle(mode)}
     onPointerDown={objectMoveMode?undefined:contourEraser?beginContourErase:contourFreehand?beginContourStroke:
      worksheetEditor&&contourAction==="select"?undefined:onPointerDown}
     onPointerMove={objectMoveMode?undefined:contourEraser?moveContourErase:contourFreehand?moveContourStroke:
      worksheetEditor&&contourAction==="select"?undefined:onMove}
     onPointerUp={objectMoveMode?undefined:contourEraser?endContourErase:contourFreehand?endContourStroke:onPointerEnd}
     onPointerCancel={objectMoveMode?undefined:contourEraser?cancelContourErase:contourFreehand?cancelContourStroke:onPointerEnd}
     onWheel={e=>{
      if(objectMoveMode)return;
      e.stopPropagation();e.preventDefault();
      const anchor=localPoint(e as unknown as ReactPointerEvent<SVGSVGElement>);
      lastPointer.current=anchor;
      zoomAt(cameraRef.current.scale*(e.deltaY<0?1.16:1/1.16),anchor);
     }}>
     <g ref={cameraLayerRef} className="lektrus-atlas-camera-layer" transform={cameraTransform({scale,position})}>
      <LektrusMapBase land={baseLand} coastline={isWorksheet&&!contourConfig.showCoastline?null:baseCoastline} theme={mode==="minerals"?"minerals":"default"}
       scale={scale} viewport={viewport}
        terrain={<LektrusAtlasTerrain enabled={terrainEnabled||mineralTerrainEnabled} scale={scale} position={position}
         onStatus={setTerrainStatus}/>}/>
      <g strokeLinejoin="round">
       {shapes.map(s=>{
        const precise=historical?borderPrecision(s.feature):3;
        const highlighted=!!search&&s.name.toLocaleLowerCase("ru-RU").includes(search.toLocaleLowerCase("ru-RU"));
        const fillKey=String(s.feature.properties?.ADM0_A3||s.feature.properties?.ISO_A3||s.name);
        const fill=mode==="contour"?(pendingErasure.fills.includes(fillKey)?"#fffdfa":painted[fillKey]||"#fffdfa"):mode==="physical"||mode==="relief"?"#d2e5c8":mode==="hydrography"?"#e6eee2":mode==="minerals"?"#f4ecd6":
         mode==="political"?politicalColors[s.i]??"#ecd9bf":historical?(modernReference?politicalColors[s.i]??"#ecd9bf":palettes[hash(s.name||String(s.feature.properties?.NAME??s.i))%palettes.length]):palettes[hash(s.name)%palettes.length];
        return <path key={s.i} d={s.path} fillRule="evenodd" fill={fill}
         data-contour-fill-key={isWorksheet&&painted[fillKey]?fillKey:undefined}
         fillOpacity={mineralTerrainEnabled?.56:1}
         stroke={isWorksheet&&!contourConfig.showBorders?"none":highlighted||s.feature===selected?"#df793e":mode==="minerals"?"#a4aea2":mode==="contour"?"#8c9eaa":"#819fb2"}
         strokeWidth={highlighted||s.feature===selected?1.9:mode==="minerals"?.4:historical?(precise===1?.8:.58):.65}
         vectorEffect="non-scaling-stroke"
         strokeDasharray={historical&&!modernReference&&precise===1?"3 2":undefined}
         onClick={()=>showCountry(s.feature)} className="lektrus-atlas-country">
         <title>{mode==="contour"?"Граница государства":s.name||"Историческая территория"}</title>
        </path>;
       })}
      </g>
      {citiesOn&&scale>=2.5&&worldAdminLinePaths.length>0&&
       <g className="lektrus-atlas-global-admin1" fill="none" pointerEvents="none"
        stroke="#84999e" strokeWidth=".58" strokeLinecap="round" strokeLinejoin="round"
        vectorEffect="non-scaling-stroke" opacity=".93">
        {worldAdminLinePaths.map(line=><path key={"world-admin-"+line.id}
         d={line.path} fill="none" vectorEffect="non-scaling-stroke"/>)}
       </g>}
      {provincePaths.length>0&&(isWorksheet&&(contourConfig.showRegions||paintRegions&&contourConfig.allowFill)||mode==="coordinates"||citiesOn&&scale>=2.5&&!worldAdminLinePaths.length)&&<g className="lektrus-atlas-admin1" stroke="#a0a7a5"
       strokeWidth=".48" vectorEffect="non-scaling-stroke"
       pointerEvents={mode==="contour"&&paintRegions||mode==="political"?"visiblePainted":"none"}>
       {provincePaths.map(f=>{
        const key="region:"+String(f.feature.properties?.adm1_code||f.feature.properties?.ADM1_CODE||f.feature.properties?.iso_3166_2||
         f.feature.properties?.name_ru||f.feature.properties?.name||geoFeatureName(f.feature));
        return <path key={"province-"+f.id} d={f.path} vectorEffect="non-scaling-stroke"
         fill={mode==="contour"&&paintRegions?(pendingErasure.fills.includes(key)?"#fafcfb":painted[key]??"#fafcfb"):mode==="political"?"transparent":"none"}
         data-contour-fill-key={isWorksheet&&painted[key]?key:undefined}
         onClick={e=>{e.stopPropagation();if(mode==="political")selectFeature(f.feature,"Административная единица");
          else paintProvince(f.feature)}}><title>{geoFeatureName(f.feature)}</title></path>;
       })}
      </g>}
      {citiesOn&&cityBoundaryPaths.length>0&&
       <g className="lektrus-atlas-city-boundaries" fill="none" stroke="#937b61"
        strokeWidth=".95" vectorEffect="non-scaling-stroke"
        pointerEvents="none" strokeLinejoin="round" opacity=".9">
        {cityBoundaryPaths.map(f=><path key={"city-outline-"+f.id} d={f.path}
         fill="none" vectorEffect="non-scaling-stroke"
         stroke={Number(f.feature.properties?.ADMIN_LEVEL)<=7?"#a5afa8":"#967858"}
         strokeWidth={Number(f.feature.properties?.ADMIN_LEVEL)<=7?.7:1}
         strokeDasharray={f.feature.properties?.OSM_ROLE==="inner"?"3 3":undefined}>
         <title>{String(f.feature.properties?.NAME_RU||"Городская или муниципальная граница OSM")}</title>
        </path>)}
       </g>}
      {reliefContext&&<g pointerEvents={mineralContext?"none":undefined}>
       {landforms.map(f=>{const style=landformColors[landformClass(f.feature)];
        return <path key={"landform-"+f.id} d={f.path}
         fill={style.fill} fillOpacity={mineralContext?style.opacity*.27:terrainEnabled?style.opacity*.20:style.opacity*.75} stroke="none"
         className="lektrus-atlas-landform" onClick={()=>selectFeature(f.feature,"Природная область")}>
         <title>{geoFeatureName(f.feature)}</title></path>})}
       {ice.map(f=><path key={"ice-"+f.id} d={f.path}
        fill="#f4faff" fillOpacity=".84" stroke="#a4c5d4" strokeWidth={atlasGlacierStroke()}
        vectorEffect="non-scaling-stroke" className="lektrus-atlas-landform" onClick={()=>selectFeature(f.feature,"Ледниковая область")}>
        <title>{geoFeatureName(f.feature)}</title></path>)}
      </g>}
      {(coordinatesEnabled||terrainEnabled)&&coord&&<g className="lektrus-atlas-coordinate-pin"
       transform={`translate(${projectGeography(coord.lon,coord.lat)[0]} ${projectGeography(coord.lon,coord.lat)[1]}) scale(${1/scale})`}
       onClick={e=>e.stopPropagation()}
       onDoubleClick={e=>{e.preventDefault();e.stopPropagation();setCoord(null);setTerrainPick(null)}}
       onContextMenu={e=>{e.preventDefault();e.stopPropagation();setCoord(null);setTerrainPick(null)}}
       role="button" aria-label="Удалить метку двойным нажатием или правой кнопкой мыши" tabIndex={0}
       onKeyDown={e=>{if(e.key==="Delete"||e.key==="Backspace"){e.preventDefault();setCoord(null);setTerrainPick(null)}}}>
       <circle r="12" fill="transparent" pointerEvents="all"/>
       <circle r="4.5" fill="#426fbd" stroke="#fff" strokeWidth="1.7"/>
       <circle r="1.25" fill="#fff" stroke="none"/>
       <title>Метка координат. Двойной щелчок или правая кнопка для удаления</title>
      </g>}
      {historical&&compare&&previous&&<g fill="none" stroke="#d64646"
       strokeWidth=".95" strokeDasharray="5 3" strokeOpacity=".85" pointerEvents="none">
       {previous.features.filter(f=>!!atlasDisplayName(f,historicalSnapshots[Math.max(0,index-1)].year,true)).map((f,i)=><path key={"prior-"+i} d={mapFeaturePath(f)} vectorEffect="non-scaling-stroke"/>)}
      </g>}
      {hydroContext&&<g pointerEvents={isWorksheet?"none":undefined}>
       {marineAreas.map(f=><path key={"marine-"+f.id} d={f.path} fill="transparent" stroke="none" vectorEffect="non-scaling-stroke"
        className="lektrus-atlas-water-feature" onClick={()=>selectFeature(f.feature,"Морская акватория")}>
        <title>{geoFeatureName(f.feature)}</title></path>)}
       {(!isWorksheet||contourConfig.showLakes)&&ponds.map(l=><path key={"lake-"+l.id} d={l.path} fill={mode==="contour"?"#f2faff":mineralContext?"#c4e5ed":"#a7d5ed"} fillRule="evenodd" stroke="#7bb5d1"
        strokeWidth={atlasLakeStroke()} strokeLinejoin="round" vectorEffect="non-scaling-stroke"
        onClick={()=>selectFeature(l.feature,"Озеро")} className="lektrus-atlas-water-feature lektrus-atlas-lake">
        <title>{geoFeatureName(l.feature)}</title></path>)}
       {(!isWorksheet||contourConfig.showRivers)&&streams.map(l=><g key={"river-"+l.id} role="button" tabIndex={0}
        className="lektrus-atlas-water-feature lektrus-atlas-river"
        onClick={e=>{e.stopPropagation();selectFeature(l.feature,"Река")}}
        onKeyDown={e=>{if(e.key==="Enter"){e.stopPropagation();selectFeature(l.feature,"Река")}}}>
        <path d={l.path} fill="none" stroke="transparent" strokeWidth="8"
         vectorEffect="non-scaling-stroke" pointerEvents="stroke"
         strokeLinecap="round" strokeLinejoin="round"/>
        <path d={l.path} fill="none" stroke={mode==="contour"?"#9bbdcd":mineralContext?"#64a5be":"#4c9bc8"} opacity={mode==="contour"?.72:mineralContext?.85:1}
         strokeWidth={mode==="contour"?.4:mineralContext?atlasRiverStroke(l.feature)*.85:atlasRiverStroke(l.feature,mode==="hydrography")}
         strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke"
         className="lektrus-atlas-river-ink" pointerEvents="none"/>
        <title>{geoFeatureName(l.feature)}</title></g>)}
      </g>}
      {(mode==="physical"||mode==="relief")&&<g>
       {shownPeaks.filter((_,i)=>scale>=4||i%5===0).map(f=><g key={"elevation-"+f.id}
        transform={`translate(${f.point![0]} ${f.point![1]}) scale(${1/scale})`}
        className="lektrus-atlas-event" onClick={()=>selectFeature(f.feature,"Высотная отметка")}>
        <path d="M0 -4L4 3H-4Z" fill="#816245" stroke="#fff" strokeWidth=".7"/>
        <title>{geoFeatureName(f.feature)}</title>
       </g>)}
      </g>}
      {mineralContext&&<g className="lektrus-atlas-mineral-landmarks">
       {mineralLandmarkCities.map(f=><g key={"mineral-city-"+f.id}
        transform={`translate(${f.point![0]} ${f.point![1]}) scale(${1/scale})`}
        role="button" tabIndex={0} className="lektrus-atlas-event"
        onClick={e=>{e.stopPropagation();selectFeature(f.feature,nationalCapital(f.feature)?"Столица":"Крупный город")}}
        onKeyDown={e=>{if(e.key==="Enter"){e.preventDefault();selectFeature(f.feature,"Крупный город")}}}>
        <circle r={selected===f.feature?4.4:2.5}
         fill={selected===f.feature?"#dc863b":"#355971"} stroke="#fff" strokeWidth="1.1"/>
        <title>{russianPlaceName(f.feature)} · ориентир, население по Natural Earth</title>
       </g>)}
      </g>}
      {/* Reference symbols follow the political map's zoom filtering and fixed screen size.
           They remain separate toggleable layers and never render names on worksheets. */}
      {isWorksheet&&(contourConfig.showCapitals||contourConfig.showMajorCities)&&<g className="lektrus-contour-reference-cities" pointerEvents="none">
       {contourConfig.showCapitals&&contourCapitals.filter(()=>scale>=2.6).map(f=><g key={"ref-capital-"+f.id}
        transform={`translate(${f.point![0]} ${f.point![1]}) scale(${1/scale})`}>
        <circle r="3.65" fill="#fff" stroke="#263c55" strokeWidth="1.5"/>
       </g>)}
       {contourConfig.showMajorCities&&scale>=4.2&&contourCities.map(f=><g key={"ref-city-"+f.id}
        transform={`translate(${f.point![0]} ${f.point![1]}) scale(${1/scale})`}>
        <circle r={Math.max(1.65,Math.min(3,1.6+Math.sqrt(cityPopulation(f.feature))/2400))}
         fill="#275a82" stroke="#fff" strokeWidth=".85"/>
       </g>)}
      </g>}
      {citiesOn&&<g className="lektrus-atlas-capitals">
       {contourCapitals.filter(()=>scale>=2.6).map(f=><g key={"capital-"+f.id}
        transform={`translate(${f.point![0]} ${f.point![1]}) scale(${1/scale})`}
        className="lektrus-atlas-event" role="button" tabIndex={0}
        onClick={e=>{e.stopPropagation();selectFeature(f.feature,alternateCapital(f.feature)?"Дополнительная столица по данным источника":"Столица государства")}}
        onKeyDown={e=>{if(e.key==="Enter"){e.preventDefault();selectFeature(f.feature,"Столица государства")}}}>
        <circle r="3.65" fill="#fff" stroke="#263c55" strokeWidth="1.5"/>
        <title>{russianPlaceName(f.feature)}: {alternateCapital(f.feature)?"дополнительная столица":"столица"}</title>
       </g>)}
      </g>}
      {(citiesOn||mode==="hydrography"||mode==="physical")&&
       <g className="lektrus-atlas-auxiliary-lines" pointerEvents="none">
        {auxiliaryLines.map(line=>{
         const cls=String(line.feature.properties?.ATLAS_CLASS??"");
         const road=line.feature.properties?.ATLAS_KIND==="road";
         const color=road?(cls==="motorway"?"#c58b5c":
          cls==="trunk"?"#d0a075":cls==="primary"?"#bfa388":"#b2a59a"):"#61a9cc";
         const width=road?(cls==="motorway"?1.65:cls==="trunk"?1.3:
          cls==="primary"?1.0:.65):.48;
         return <path key={"infra-"+line.id} d={line.path} fill="none"
          stroke={color} strokeWidth={width} opacity={road?.96:.88}
          strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke"/>;
        })}
       </g>}
      {citiesOn&&scale>=4.2&&<g className="lektrus-atlas-cities">
       {shownCities.filter(f=>!nationalCapital(f.feature)&&(visibleMapLabels.has("city-"+f.id)||scale>=16&&cityLabels.some(c=>c.feature===f.feature))).map(f=><g key={"city-"+f.id}
        transform={`translate(${f.point![0]} ${f.point![1]}) scale(${1/scale})`}
        className="lektrus-atlas-event" role="button" tabIndex={0}
        onClick={e=>{e.stopPropagation();selectFeature(f.feature,nationalCapital(f.feature)?"Столица":"Населённый пункт")}}
        onKeyDown={e=>{if(e.key==="Enter"){e.preventDefault();selectFeature(f.feature,"Населённый пункт")}}}>
        {selected===f.feature&&<circle r="7.5" fill="#fff5d8" fillOpacity=".92"
         stroke="#e77a24" strokeWidth="2.2" pointerEvents="none"/>}
        {nationalCapital(f.feature)?
         <path d="M0 -4.4L4.4 0L0 4.4L-4.4 0Z" fill="#263c55" stroke="#fff" strokeWidth="1"/>:
         <circle r={Math.max(1.65,Math.min(3,1.6+Math.sqrt(cityPopulation(f.feature))/2400))}
          fill={selected===f.feature?"#ed7e27":"#275a82"} stroke="#fff" strokeWidth={selected===f.feature?1.7:.85}/>}
        <title>{russianPlaceName(f.feature)}{cityPopulation(f.feature)>0?
         " · население (оценка): "+cityPopulation(f.feature).toLocaleString("ru-RU"):""}</title>
       </g>)}
      </g>}
      {placedMapLabels.length>0&&<g className="lektrus-atlas-map-labels" pointerEvents="none">
       {placedMapLabels.map(label=><text key={label.id}
        textAnchor={label.align??"middle"}
        x={label.x+(label.dx??0)/scale} y={label.y+(label.dy??0)/scale}
        fontSize={label.fontSize/scale}
        fill={label.kind==="river"||label.kind==="lake"||label.kind==="sea"||label.kind==="stream"?"#286c97":
         label.kind==="nature"||label.kind==="peak"?"#6b4f39":"#284765"}
        stroke="#fff" strokeWidth={1.5/scale} strokeLinejoin="round" paintOrder="stroke"
        fontWeight={label.kind==="capital"?"750":label.kind==="country"?"680":"650"}>{label.text}</text>)}
      </g>}
      {/* Draw deposit glyphs above geographic labels, never behind city names. */}
      {mode==="minerals"&&(!localMineralDetail||scale<12)&&<g className="lektrus-atlas-mineral-clusters">
       {mineralGroups.filter(group=>group.point[0]>=visibleWorld.left&&group.point[0]<=visibleWorld.right&&
        group.point[1]>=visibleWorld.top&&group.point[1]<=visibleWorld.bottom).map(group=>{
        const radius=9;
        const choose=()=>{
         if(group.count===1){setSelectedMineral(group.representative.feature);setSelected(null)}
         else {
          const next=Math.max(3.5,Math.min(128,scale*3));
          commitCamera({scale:next,position:normalizePosition({
           x:-(group.point[0]-450)*next,y:-(group.point[1]-225)*next},next)});
         }
        };
        return <g key={"mineral-group-"+group.id}
         transform={`translate(${group.point[0]} ${group.point[1]}) scale(${1/scale})`}
         className="lektrus-atlas-event lektrus-atlas-mineral-group"
         role="button" tabIndex={0}
         onClick={e=>{e.stopPropagation();choose()}}
         onKeyDown={e=>{if(e.key==="Enter"){e.stopPropagation();choose()}}}>
         <circle r={radius+1.3} fill="#fffdf5" fillOpacity=".73"
          stroke="#9a9585" strokeWidth=".65"/>
         <g transform="scale(.74)"><MineralAtlasGlyph name={group.dominant}/></g>
         <title>{group.count>1?
          group.count+" записей о месторождениях в обзорной выборке USGS. Нажмите для приближения.":
          group.dominant+" (USGS)"}</title>
        </g>;
       })}
      </g>}
      {mode==="minerals"&&localMineralDetail&&scale>=12&&<g className="lektrus-atlas-mineral-points">
       {visibleMinerals.map(item=><g key={"mineral-"+item.id}
        transform={`translate(${item.point[0]} ${item.point[1]}) scale(${1/scale})`}
        onClick={e=>{e.stopPropagation();setSelectedMineral(item.feature);setSelected(null)}}
        className="lektrus-atlas-event" role="button" tabIndex={0}
        onKeyDown={e=>{if(e.key==="Enter"){e.preventDefault();setSelectedMineral(item.feature);setSelected(null)}}}>
        {selectedMineral===item.feature&&<circle r="10" fill="none" stroke="#b25e2e"
         strokeWidth="2" pointerEvents="none"/>}
        <circle r="9.4" fill="#fffdf5" fillOpacity=".75" stroke="#9a9585" strokeWidth=".7"/>
        <g transform="scale(.78)"><MineralAtlasGlyph name={item.commodity.name}/></g>
        <title>{item.commodity.name}, источник USGS</title>
       </g>)}
      </g>}
      {(isWorksheet?contourConfig.showGrid:d.showGrid)&&<LektrusAtlasGraticule scale={scale} viewport={gridViewport}/>}
      {mode==="contour"&&<g className="lektrus-atlas-contour-work" pointerEvents={worksheetOnBoard?"none":undefined}>
       {(liveErasedStrokes??contourStrokes).map(line=><path key={line.id} fill="none" stroke={line.color}
        strokeWidth={(line.width??2)/scale} strokeLinecap="round" strokeLinejoin="round" pointerEvents="none"
        d={line.points.map((p,i)=>{const [x,y]=projectGeography(p[0],p[1]);
         return (i?"L":"M")+x.toFixed(3)+" "+y.toFixed(3)}).join(" ")}/>)}
       {contourMarks.map(stored=>{const mark=previewContourMark?.id===stored.id?previewContourMark:stored;
        const [x,y]=projectGeography(mark.lon,mark.lat);
        const width=Math.max(16,Math.min(80,mark.text.length)*4.8+12);
        const left=mark.kind==="point"?6:-width/2,selected=selectedContourMarkId===mark.id;
        return <g key={mark.id} transform={`translate(${x} ${y}) scale(${labelUiScale/scale})`}
         className={"lektrus-atlas-contour-mark lektrus-contour-label-object"+(selected?" selected":"")}
         role="button" tabIndex={0} aria-label={"Передвинуть обозначение: "+(mark.text||"Знак")}
         opacity={pendingErasure.marks.includes(mark.id)?.2:1}
         onPointerDown={e=>startContourMarkDrag(e,stored)}
         onPointerMove={moveContourMarkDrag}
         onPointerUp={e=>endContourMarkDrag(e)}
         onPointerCancel={e=>endContourMarkDrag(e,true)}
         onClick={e=>{e.stopPropagation();if(contourAction!=="erase")setSelectedContourMarkId(mark.id)}}
         onDoubleClick={e=>{e.stopPropagation();if(contourAction==="erase")return;
          captureContour();setSelectedContourMarkId(null);
          onChange?.({...d,contourMarks:contourMarks.filter(v=>v.id!==mark.id)})}}
         onContextMenu={e=>{e.preventDefault();e.stopPropagation();
          captureContour();setSelectedContourMarkId(null);
          onChange?.({...d,contourMarks:contourMarks.filter(v=>v.id!==mark.id)})}}
         onKeyDown={e=>{
          if(e.key==="Delete"||e.key==="Backspace"){
           e.preventDefault();e.stopPropagation();captureContour();setSelectedContourMarkId(null);
           onChange?.({...d,contourMarks:contourMarks.filter(v=>v.id!==mark.id)});
          }else if(["ArrowLeft","ArrowRight","ArrowUp","ArrowDown"].includes(e.key)&&onChange){
           e.preventDefault();e.stopPropagation();
           const step=(e.shiftKey?10:1)/Math.max(.1,cameraRef.current.scale);
           const dx=e.key==="ArrowLeft"?-step:e.key==="ArrowRight"?step:0;
           const dy=e.key==="ArrowUp"?-step:e.key==="ArrowDown"?step:0;
           captureContour();onChange({...d,contourMarks:contourMarks.map(v=>v.id===mark.id?
            moveContourMark(v,{x:0,y:0},{x:dx,y:dy}):v)});
          }
         }}>
         <rect className="lektrus-contour-label-background"
          x={left} y="-9" width={width} height="15" rx="3" strokeWidth=".8"
          aria-hidden="true"/>
         {mark.kind==="point"&&<circle r="2.6" fill={mark.color} stroke="#fff" strokeWidth="1"/>}
         {mark.text&&<text x={mark.kind==="point"?left+width/2:0} y="0"
          textAnchor="middle" fill={mark.color} fontSize="7.4" stroke="#fff"
          strokeWidth="1.5" strokeLinejoin="round" paintOrder="stroke"
          fontWeight="630">{mark.text}</text>}
         <title>{mark.text||"Условный знак"} · Перетащите для перемещения, стрелки для точной настройки, Delete для удаления</title>
        </g>})}

       <path ref={contourLivePath} fill="none" stroke={paintColor} strokeWidth={toolThickness/scale}
        strokeLinecap="round" strokeLinejoin="round" pointerEvents="none"/>
      </g>}
      {userMarkers.map(marker=>{
       const point=projectGeography(marker.lon,marker.lat);
       return <g key={marker.id} transform={`translate(${point[0]} ${point[1]}) scale(${1/scale})`}
        className="lektrus-atlas-event lektrus-atlas-user-pin" role="button" tabIndex={0}
        onClick={e=>{e.stopPropagation();if(dragged.current)return;setSelectedMarker(marker.id);setSelected(null)}}
        onDoubleClick={e=>{e.stopPropagation();onChange?.({...d,markers:d.markers.filter(m=>m.id!==marker.id)});
         setSelectedMarker(null)}}
        onContextMenu={e=>{e.preventDefault();e.stopPropagation();onChange?.({...d,markers:d.markers.filter(m=>m.id!==marker.id)});
         setSelectedMarker(null)}}
        onKeyDown={e=>{if(e.key==="Enter"){setSelectedMarker(marker.id);setSelected(null)}
         if(e.key==="Delete"||e.key==="Backspace"){e.preventDefault();
          onChange?.({...d,markers:d.markers.filter(m=>m.id!==marker.id)});setSelectedMarker(null)}}}>
        <circle r="4.5" fill="#426fbd" stroke="#fff" strokeWidth="1.7"/>
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
     <button type="button" title="Увеличить масштаб" onClick={()=>zoomAt(cameraRef.current.scale*1.5)}>+</button>
     <button type="button" onClick={reset} title="Вписать выбранный регион">⌖</button>
     <button type="button" title="Уменьшить масштаб" onClick={()=>zoomAt(cameraRef.current.scale/1.5)}>−</button>
     <button type="button" className={(isWorksheet?contourConfig.showGrid:d.showGrid)?"active":""}
      title="Меридианы и параллели поверх карты" aria-label="Меридианы и параллели"
      aria-pressed={isWorksheet?contourConfig.showGrid:d.showGrid}
      onClick={()=>onChange?.(isWorksheet?{...d,contourAssignment:{...contourConfig,showGrid:!contourConfig.showGrid}}:
       {...d,showGrid:!d.showGrid})}>▦</button>
     <label className="lektrus-atlas-zoom-slider">Масштаб
      <input type="range" min="0" max="14" step=".25"
       aria-label="Уровень детализации карты"
       value={Math.log2(scale)} onChange={e=>zoomAt(Math.pow(2,Number(e.target.value)))}/>
     </label>
    </div>}
    <div className="lektrus-atlas-precision">Увеличение ×{scale.toFixed(scale>=10?0:1)} · {highDetail?"геоданные 1:10 млн":modernBorders?"обзорный слой":"историческая реконструкция"} · {coord?
     `${coord.lat.toFixed(2)}°, ${coord.lon.toFixed(2)}°`:objectMoveMode?"режим перемещения объекта":"обзорные геоданные"}</div>
   </div>
   {!isWorksheet&&!historical&&<aside className="lektrus-atlas-sidebar lektrus-atlas-sidebar--selected-only">
    <div className="lektrus-atlas-info-heading">
     <strong>Сведения о выбранном объекте</strong>
     <button type="button" aria-label="Скрыть сведения" onClick={()=>setInspectorOpen(false)}>×</button>
    </div>
    <div className="lektrus-atlas-info-content lektrus-atlas-info-object">
     {markerDetails?<div className="lektrus-atlas-description">
     <strong>{markerDetails.title}</strong>
     <p>{markerDetails.description||"Маркер преподавателя"}</p>
     <p>Координаты: {markerDetails.lat.toFixed(3)}°, {markerDetails.lon.toFixed(3)}°</p>
     {historical&&<p>Дата: {yearLabel(markerDetails.year)}</p>}
    </div>:
    selectedMineral&&mode==="minerals"?<div className="lektrus-atlas-description">
     <strong>Запись о минеральном сырье: {(mineralCommodity(selectedMineral)??mrdsMineralCommodity(selectedMineral))?.name??"Полезное ископаемое"}</strong>
     <p>Источник: Геологическая служба США, {selectedMineral.properties?.ATLAS_DATASET==="MRDS"?
      "архивный каталог минеральных ресурсов MRDS":"каталог крупных месторождений"}.</p>
     {selectedMineral.properties?.ATLAS_DATASET==="MRDS"&&<>
      {typeof selectedMineral.properties.site_name==="string"&&
       <p><strong>Название в оригинальном каталоге:</strong> {selectedMineral.properties.site_name}</p>}
      {selectedMineral.properties.dep_id&&
       <p><strong>Номер записи MRDS:</strong> {String(selectedMineral.properties.dep_id)}</p>}
      {selectedMineral.properties.dev_stat&&
       <p><strong>Статус в архивной базе (не подтверждён на 2026 год):</strong> {String(selectedMineral.properties.dev_stat)}</p>}
     </>}
     {mineralDepositFacts(selectedMineral).map(f=><p key={f.label}><strong>{f.label}:</strong> {f.value}</p>)}
     {mineralGuide((mineralCommodity(selectedMineral)??mrdsMineralCommodity(selectedMineral))?.name??"")&&
      <div className="lektrus-atlas-city-data">
       <strong>Справка о минеральном сырье</strong>
       <p>{mineralGuide((mineralCommodity(selectedMineral)??mrdsMineralCommodity(selectedMineral))!.name)!.className}</p>
       <p><strong>Состав:</strong> {mineralGuide((mineralCommodity(selectedMineral)??mrdsMineralCommodity(selectedMineral))!.name)!.composition}</p>
       <p><strong>Использование:</strong> {mineralGuide((mineralCommodity(selectedMineral)??mrdsMineralCommodity(selectedMineral))!.name)!.uses}</p>
       <small>Генетический тип конкретного месторождения приводится отдельно, если он известен из USGS.</small>
      </div>}
     <p>Координаты: {(()=>{
      const c=selectedMineral.geometry?.coordinates;
      return Array.isArray(c)?Number(c[1]).toFixed(4)+"°, "+Number(c[0]).toFixed(4)+"°":"не приведены";
     })()}</p>
     <p>Идентификатор источника: {String(selectedMineral.properties?.OBJECTID??
      selectedMineral.properties?.objectid??selectedMineral.properties?.objectid_1??selectedMineral.properties?.gid??"не указан")}</p>
     <small>Название месторождения, разновидности минералов, геология, оценка запасов и статус добычи
      приводятся в исходной базе, если они опубликованы. Значения не вычисляются из точки карты.</small>
     {mineralDepositSource(selectedMineral)&&<a href={mineralDepositSource(selectedMineral)!}
      target="_blank" rel="noopener noreferrer">Исходная карточка месторождения USGS ↗</a>}
     <a href={selectedMineral.properties?.ATLAS_DATASET==="MRDS"?
      "https://energy.usgs.gov/arcgis/rest/services/Hosted/Mineral_Resource_Data_System/FeatureServer/0":
      "https://energy.usgs.gov/arcgis/rest/services/Hosted/Major_mineral_deposits/FeatureServer/0"}
      target="_blank" rel="noopener noreferrer">Открыть набор геологических данных USGS ↗</a>
    </div>:
    selected?<div className="lektrus-atlas-description">
     {selectedCountrySymbol?<div className="lektrus-atlas-selected-symbol-title">
      <LektrusAtlasCountrySymbol symbol={selectedCountrySymbol}/>
      <div><strong>{selectedTitle}</strong><small>{selectedLayer}</small>
       {historical&&selectedCountrySymbol.kind==="symbol"&&<small>Условный знак, не исторический герб</small>}
       {historical&&selectedCountrySymbol.kind==="historic"&&<small>{selectedCountrySymbol.label} · {selectedCountrySymbol.period}</small>}
      </div>
     </div>:<><strong>{selectedTitle}</strong><small>{selectedLayer}</small></>}
     {historical&&selectedCountrySymbol?.sourceUrl&&
      <a className="lektrus-history-symbol-source" href={selectedCountrySymbol.sourceUrl}
       target="_blank" rel="noopener noreferrer">Источник и описание исторического символа ↗</a>}
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
     {!historical&&<div className="lektrus-atlas-study-card lektrus-atlas-reference-card">
      <strong>Справка об объекте</strong>
      {schoolReferenceLoading&&<small>Загрузка дополнительных сведений…</small>}
      {schoolReference?.description&&<p>{schoolReference.description}</p>}
      {schoolReference?.facts.map(f=><p key={f.label}><strong>{f.label}:</strong> {f.value}</p>)}
      {schoolReference&&<a href={schoolReference.url} target="_blank" rel="noopener noreferrer">Данные Wikidata, открытая база ↗</a>}
      {schoolReferenceError&&<small>{schoolReferenceError}</small>}
      {!schoolReferenceLoading&&!schoolReferenceError&&!schoolReference&&
       <small>Для этого объекта дополнительные сведения в подключённом справочнике отсутствуют. Показаны атрибуты картографического источника.</small>}
      <small>Значения из открытого справочника могут быть разного года и не всегда актуальны. Для учебного использования проверяйте дату и первоисточник.</small>
     </div>}
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
      <div className="lektrus-atlas-description">
       <strong>Выберите объект на карте</strong>
       <p>Нажмите на страну, город, реку, озеро или месторождение для просмотра сведений.</p>
      </div>}
    </div>
   </aside>}
   {!isWorksheet&&historical&&<aside className="lektrus-atlas-sidebar">
    <div className="lektrus-atlas-info-heading">
     <strong>Сведения об объектах</strong>
     <button type="button" aria-label="Скрыть панель сведений" onClick={()=>setInspectorOpen(false)}>×</button>
    </div>
    <div className="lektrus-atlas-info-content lektrus-atlas-info-overview">
     <div className="lektrus-atlas-study-card"><strong>{mapModeTitle(mode)}</strong>
      <p>{mode==="political"?"На политической карте сначала показаны государства, затем столицы, регионы и населённые пункты. Приближайте карту для подробных границ городов и дополнительных названий.":
       mode==="physical"?"Изучайте материки, океаны, горные системы, реки, озёра и высоты. Приближайте территорию, чтобы увидеть больше подписей и водных объектов.":
       
       mode==="minerals"?"Условные знаки показывают документированные месторождения. Крупные города, реки и приглушённый рельеф помогают определить положение объектов; подложка не обозначает запасы сырья.":
       "Выберите период и территорию, чтобы изучить исторические изменения. Границы исторических эпох являются научными реконструкциями."}</p>
      {modernBorders&&mode==="political"&&<p className="lektrus-atlas-study-note">
       Государственные границы показаны по российскому варианту картографической базы Natural Earth RUS.
       Источник относится к архивной редакции, актуальность всех границ на 2026 год не подтверждена.
      </p>}
      <p className="lektrus-atlas-study-note">Перемещение: перетаскивание. Масштаб: колесо мыши или два пальца. Кнопка «Координаты» включает определение широты и долготы на любой карте.</p>
     </div>
    {(historical||d.markers.length>0)&&onChange&&<details className="lektrus-atlas-own-markers">
     <summary>Мои метки и события ({d.markers.length})</summary>
     <small>Метки с географическими координатами хранятся с доской. Их можно исправлять и удалять.</small>
     {d.markers.map(mark=><div key={mark.id} className="lektrus-atlas-own-marker">
      <label>Название <input maxLength={80} value={mark.title}
       onChange={e=>onChange({...d,markers:d.markers.map(m=>m.id===mark.id?{...m,title:e.target.value}:m)})}/></label>
      <div className="lektrus-atlas-marker-numbers">
       {(["lat","lon","year"] as const).map(key=><label key={key}>
        {key==="lat"?"Широта":key==="lon"?"Долгота":"Год"}
        <input type="number" step={key==="year"?1:.01} value={mark[key]}
         min={key==="lat"?-90:key==="lon"?-180:-123000}
         max={key==="lat"?90:key==="lon"?180:2100}
         onChange={e=>{const value=Number(e.target.value);if(!Number.isFinite(value))return;
          const limit=key==="lat"?90:key==="lon"?180:2100;
          const minimum=key==="lat"?-90:key==="lon"?-180:-123000;
          onChange({...d,markers:d.markers.map(m=>m.id===mark.id?{...m,[key]:
           Math.max(minimum,Math.min(limit,key==="year"?Math.round(value):value))}:m)})}}/>
       </label>)}
      </div>
      <label>Пояснение <textarea rows={2} maxLength={300} value={mark.description}
       onChange={e=>onChange({...d,markers:d.markers.map(m=>m.id===mark.id?{...m,description:e.target.value}:m)})}/></label>
      <button type="button" onClick={()=>onChange({...d,markers:d.markers.filter(m=>m.id!==mark.id)})}>Удалить метку</button>
     </div>)}
     <button type="button" disabled={d.markers.length>=40}
      onClick={()=>onChange({...d,markers:[...d.markers,{id:globalThis.crypto?.randomUUID?.()??String(Date.now()),
       title:"Новая метка",lat:0,lon:0,year:snapshot.year,description:""}]})}>+ Добавить метку</button>
    </details>}
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
     <label className="lektrus-atlas-compare"><input type="checkbox" checked={citiesOn}
      onChange={e=>onChange?.({...d,mode:"political",showCities:e.target.checked})}/>
      Города и административные границы</label>
     <div><span className="lektrus-atlas-legend-swatch lektrus-atlas-legend-capital"/>◆ Столица по данным Natural Earth</div>
     <small>Столиц в слое: {totalCapitals}. На карте они отмечены тёмными ромбами; это не маркеры маленьких государств.</small>
     <small>Столицы показаны по Natural Earth, кроме подтверждённых исправлений: Додома (Танзания) и Сьюдад-де-ла-Пас (Экваториальная Гвинея). Для остальных стран ещё требуется актуализация по официальным сведениям.</small>
     <a href="https://oagmis.oag.go.tz/portal/acts/52" target="_blank" rel="noopener noreferrer">Закон Танзании о столице ↗</a>
     <a href="https://www.guineaecuatorialpress.com/noticias/decreto_ley_por_el_que_se_declara_la_ciudad_de_la_paz_djibloho_capital_de_la_republica_de_guinea_ecuatorial"
      target="_blank" rel="noopener noreferrer">Декрет о столице Экваториальной Гвинеи, 2026 ↗</a>
    </div>}
    {mode==="minerals"&&<div className="lektrus-atlas-natural-legend">
     <strong>Карта полезных ископаемых</strong>
     <small>Географические ориентиры: крупные города (Natural Earth, {cityResolution}), реки и озёра ({hydroResolution}), высотная подложка и формы рельефа. Названия по-русски; при приближении появляется больше ориентиров.</small>
     <label className="lektrus-atlas-compare">
      <input type="checkbox" checked={d.hypsometry!==false}
       onChange={e=>onChange?.({...d,hypsometry:e.target.checked})}/>
      Показывать высотный рельеф
     </label>
     {mineralTerrainEnabled&&terrainStatus.failed>0&&
      <small>Часть высотных плиток не загрузилась. Реки, города и месторождения доступны без них.</small>}
      <small>Школьные картографические знаки из присланной легенды. Обозначения ставятся по опубликованным координатам USGS, а не по примерному размещению из рисунков.</small>
     <label className="lektrus-atlas-city-filter">Группа сырья
      <select aria-label="Фильтр полезных ископаемых" value={mineralFilter}
       onChange={e=>{setMineralFilter(e.target.value);setSelectedMineral(null)}}>
       <option>Все виды</option>
       {SCHOOL_ATLAS_MINERALS.map(name=><option key={name}>{name}</option>)}
      </select>
     </label>
     {SCHOOL_ATLAS_FUEL_MINERALS.some(name=>name===mineralFilter)&&
      <small>Этот вид сырья присутствует в школьном атласе, но текущие подключённые каталоги USGS не содержат его координат. Пустая карта не означает отсутствие месторождений.</small>}
     <small>{!localMineralDetail?
      worldMineralsLoading||mrdsWorldLoading?"Загрузка каталогов USGS, обзорных и MRDS…":
      mineralsAvailable&&mineralLoading?"Загрузка подробных месторождений выбранного региона…":
      (worldMineralError&&mrdsWorldError?worldMineralError+" "+mrdsWorldError:"")||"Обзорная выборка: "+worldMineralPoints.length+
       " записей, представленных "+mineralGroups.length+" знаками. Один знак соответствует одному виду сырья и может объединять несколько записей. Нажмите для приближения.":
      mineralError||"Подробные месторождения в выбранной области: "+visibleMinerals.length+
       (mrdsRegionLoading?" · обновление MRDS…":".")}</small>
     {mineralGuide(mineralFilter)&&<div className="lektrus-atlas-city-data">
      <strong>Справка: {mineralFilter}</strong>
      <p><b>Группа:</b> {mineralGuide(mineralFilter)!.className}</p>
      <p><b>Состав сырья:</b> {mineralGuide(mineralFilter)!.composition}</p>
      <p><b>Применение:</b> {mineralGuide(mineralFilter)!.uses}</p>
      <small>Общие школьные сведения о сырье, а не характеристика выбранного месторождения.</small>
     </div>}
     <div className="lektrus-atlas-mineral-legend school-mineral-reference">
      {SCHOOL_ATLAS_GROUPS.map(group=><div key={group.title} className="lektrus-mineral-reference-group">
       <strong>{group.title}</strong>
       {group.names.map(name=><div key={name} className="lektrus-mineral-reference-row">
        <LektrusMineralSymbol name={name} size={22}/><span>{name}</span>
       </div>)}
      </div>)}
     </div>
     <small>Условные знаки повторяют школьную легенду. Мировой обзор составлен из географических выборок двух каталогов USGS: «Крупные месторождения» и MRDS.
      На далёком масштабе один знак может представлять несколько записей одного вида сырья. Нажмите на него для приближения.
      База историческая и неполная, особенно за пределами США. Нефть, газ и уголь в этих каталогах не представлены.</small>
     <a href="https://special-edu.kz/TEXTBOOKS/1RAZDEL/book/pdf/geog9Methods.pdf"
      target="_blank" rel="noopener noreferrer">Примеры условных знаков из школьного учебного материала ↗</a>
     <small>Используются условные обозначения из присланной школьной легенды, сгруппированные по типу полезного ископаемого.
       Каталоги USGS: покрытие за пределами США неполное.
      Обзорные группы построены по выборке, а не по полному кадастру месторождений. Наличие точки не означает действующую добычу или подтверждённые запасы. Топливные ресурсы (нефть, газ, уголь) этим набором не покрываются. Основа каталога USGS включает исторические сведения и не является актуальным кадастром на 2026 год.
      Показываются только месторождения с распознаваемым типом сырья.</small>
     <a href="https://energy.usgs.gov/arcgis/rest/services/Hosted/Major_mineral_deposits/FeatureServer/0"
      target="_blank" rel="noopener noreferrer">Исходная база USGS и метаданные ↗</a>
    </div>}
    {citiesOn&&scale>=2.5&&<div className="lektrus-atlas-natural-legend">
     <strong>Обозначения населённых пунктов</strong>
     <small>Границы регионов мира: обзорные линии Natural Earth 1:50 млн и подробные 1:10 млн уже с увеличения ×3,5.
      Включаются с увеличения ×2,5. Для городских и муниципальных границ используются данные OpenStreetMap при более крупном масштабе. Дороги подгружаются участками, начиная со среднего увеличения.
      {worldAdminError?" "+worldAdminError:""}
      {cityBoundaryError?" "+cityBoundaryError:""}</small>
     <div><span className="lektrus-atlas-legend-swatch" style={{background:"#ead5b8",borderColor:"#937b61"}}/>Границы городов</div>
     <small>{!roadsAvailable?"Приблизьте карту примерно до ×5 для основных дорог и до ×8 для подробных улиц.":
      infrastructureError||"Основные дороги: OpenStreetMap (локальные данные, не навигационная карта)."}</small>
     <a href="https://www.openstreetmap.org/copyright" target="_blank"
      rel="noopener noreferrer">© участники OpenStreetMap, лицензия ODbL ↗</a>
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
    {!historical&&<label>Поиск объектов
     <input value={search} onChange={e=>setSearch(e.target.value)}
      placeholder={mode==="political"?"Страна, регион или город":mode==="hydrography"?"Река или озеро":
       mode==="relief"?"Горы, пустыня, вершина":"Страна или территория"}/>
     {search.trim()&&<small>Найдено: {filteredCount}</small>}
    </label>}
    {search.trim()&&!historical&&<div className="lektrus-atlas-search-results">
     {results.length?results.map((f,i)=><button key={i} type="button"
      onClick={()=>focusFeature(f)}>
       {mode==="political"&&(f.geometry?.type==="Polygon"||f.geometry?.type==="MultiPolygon")&&
        <LektrusAtlasCountrySymbol compact symbol={atlasCountrySymbol(f,atlasDisplayName(f,snapshot.year,false),snapshot.year,false)}/>}
       {atlasDisplayName(f,snapshot.year,historical&&!modernReference)}</button>):
      <small>Совпадений нет среди названий из картографической базы. Попробуйте уточнить запрос.</small>}
    </div>}
    {detailWarning&&<p className="lektrus-atlas-layer-warning" role="status">{detailWarning}</p>}
    {layerWarning&&<p className="lektrus-atlas-layer-warning" role="status">
     {layerWarning}. Доступные слои отображаются без подмены.</p>}
    {coordinatesEnabled&&<div className="lektrus-atlas-description">
     <strong>Географические координаты</strong>
     <p>Нажмите на карту: широта и долгота определяются с учётом масштаба и перемещения.</p>
     {coord?<p>{Math.abs(coord.lat).toFixed(2)}° {coord.lat>=0?"с. ш.":"ю. ш."},
      {" "}{Math.abs(coord.lon).toFixed(2)}° {coord.lon>=0?"в. д.":"з. д."}</p>:
      <p>Точка пока не выбрана.</p>}
    </div>}
    </div>
    <div className="lektrus-atlas-info-content lektrus-atlas-info-object">
     {!selected&&!selectedMineral&&!selectedMarker&&!historical&&<div className="lektrus-atlas-study-card">
      <strong>Выберите объект на карте</strong><p>Нажмите на страну, город, реку, озеро, гору или месторождение. Здесь появятся доступные сведения из базы и ссылки на источники.</p>
     </div>}
    {historical&&<div className="lektrus-atlas-year-header">
     <strong>{yearLabel(snapshot.year)}{modernReference?" · современный обзор":""}</strong>
     <small>{modernReference?"Современные границы, не историческая реконструкция":"Историческая реконструкция выбранной эпохи"}</small>
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
        <div className="lektrus-history-result-heading">
         <LektrusAtlasCountrySymbol compact symbol={atlasCountrySymbol({type:"Feature",
          properties:{NAME:item.raw},geometry:{type:"Polygon",coordinates:[]}},
          item.name,item.years[item.years.length-1],true)}/>
         <strong>{item.name}</strong>
        </div><small>{item.years.length} датированных карт</small>
        <div className="lektrus-history-result-periods" aria-label={"Выбор периода: "+item.name}>
         {item.years.map(year=><button type="button" key={year}
          onClick={()=>{jumpToPeriod(year,item.raw);setHistoryTab("article");}}>{yearLabel(year)}</button>)}
        </div>
       </div>):<small>Совпадений нет. Попробуйте исходное написание названия.</small>}
      </div>:<small>Введите минимум две буквы для поиска по всем эпохам.</small>}
      <small>Периоды присутствия названия не устанавливают даты существования государства.</small>
     </>:<>
      <div className="lektrus-atlas-directory-list" style={{maxHeight:230,overflowY:"auto"}}>
       {visibleDirectory.length?visibleDirectory.slice(0,120).map((entry,i)=><button type="button" key={i}
        onClick={()=>focusFeature(entry.feature)} title={"Показать на карте: "+entry.name}
        style={{display:"block",width:"100%",textAlign:"left",padding:"6px 8px",
         background:selected===entry.feature?"#e2edff":"transparent",border:0,cursor:"pointer"}}>
        <LektrusAtlasCountrySymbol compact symbol={atlasCountrySymbol(entry.feature,entry.name,snapshot.year,!modernReference)}/>
        <span>{entry.name}</span>
       </button>):<p>Нет названных территорий. Уточните запрос.</p>}
      </div>
      <small>Найдено: {visibleDirectory.length} из {directoryEntries.length}.
       {visibleDirectory.length>120?" Показаны первые 120. Уточните поиск.":""}</small>
     </>}
     <details className="lektrus-history-source-library">
      <summary>Исторические справки <small>{visibleHistoricalReferences.length} из {historicalReferences.length}</small></summary>
      <p className="lektrus-history-source-library-hint">Сведения о государствах разных эпох, в том числе без геометрии границ в текущем историческом слое.</p>
      {!modernReference&&<label className="lektrus-history-source-period-filter">
       <input type="checkbox" checked={referenceOnlyCurrentPeriod} onChange={e=>setReferenceOnlyCurrentPeriod(e.target.checked)}/>
       Только этот период ({yearLabel(snapshot.year)})
      </label>}
      <div className="lektrus-history-source-library-list">
       {visibleHistoricalReferences.length?visibleHistoricalReferences.map(entry=><details key={entry.id} className="lektrus-history-reference-entry">
        <summary><LektrusAtlasCountrySymbol compact symbol={atlasCountrySymbol(
         {type:"Feature",properties:{NAME:entry.aliases[0]??entry.title},
          geometry:{type:"Polygon",coordinates:[]}},entry.title,entry.to,true)}/>
         <strong>{entry.title}</strong><small>{yearLabel(entry.from)} – {yearLabel(entry.to)}</small></summary>
        {entry.capital&&<p><strong>Столица и центры:</strong> {entry.capital}</p>}
        <p>{entry.description}</p>
        <p><strong>Изменение:</strong> {entry.change}</p>
        {(()=>{const symbol=atlasCountrySymbol({type:"Feature",properties:{NAME:entry.aliases[0]??entry.title},
          geometry:{type:"Polygon",coordinates:[]}},entry.title,entry.to,true);
         return symbol.sourceUrl?<p className="lektrus-history-symbol-source-note">
          <strong>{symbol.label}</strong> · {symbol.period}.
          {symbol.reconstruction&&" Изображение является реконструкцией."}
          {" "}<a href={symbol.sourceUrl} target="_blank" rel="noopener noreferrer">Источник изображения ↗</a>
         </p>:<small>Подтверждённого изображения исторического флага или герба для этой карточки нет.</small>;
        })()}
        <div className="lektrus-history-reference-actions">
         {indexedReferenceMaps.get(entry.id)&&<button type="button"
          onClick={()=>{const link=indexedReferenceMaps.get(entry.id)!;jumpToPeriod(link.year,link.raw);setHistoryTab("article");}}
          title="Открыть существующий датированный картографический слой">
          Показать на карте · {yearLabel(indexedReferenceMaps.get(entry.id)!.year)}
         </button>}
         <a href={entry.sourceUrl} target="_blank" rel="noopener noreferrer">{entry.sourceTitle} ↗</a>
        </div>
        {!indexedReferenceMaps.get(entry.id)&&<small>Справка доступна; подтверждённый картографический объект в индексированных периодах не найден.</small>}
       </details>):<p>Совпадений в справочнике нет.</p>}
      </div>
      <small>Даты относятся к учебным справкам. Они не устанавливают точные границы для каждого года.</small>
     </details>
    </div>}
    {historical&&historyTab!=="article"?null:markerDetails?<div className="lektrus-atlas-description">
     <strong>{markerDetails.title}</strong>
     <p>{markerDetails.description||"Маркер преподавателя"}</p>
     <p>Координаты: {markerDetails.lat.toFixed(3)}°, {markerDetails.lon.toFixed(3)}°</p>
     {historical&&<p>Дата: {yearLabel(markerDetails.year)}</p>}
    </div>:
    selectedMineral&&mode==="minerals"?<div className="lektrus-atlas-description">
     <strong>Запись о минеральном сырье: {(mineralCommodity(selectedMineral)??mrdsMineralCommodity(selectedMineral))?.name??"Полезное ископаемое"}</strong>
     <p>Источник: Геологическая служба США, {selectedMineral.properties?.ATLAS_DATASET==="MRDS"?
      "архивный каталог минеральных ресурсов MRDS":"каталог крупных месторождений"}.</p>
     {selectedMineral.properties?.ATLAS_DATASET==="MRDS"&&<>
      {typeof selectedMineral.properties.site_name==="string"&&
       <p><strong>Название в оригинальном каталоге:</strong> {selectedMineral.properties.site_name}</p>}
      {selectedMineral.properties.dep_id&&
       <p><strong>Номер записи MRDS:</strong> {String(selectedMineral.properties.dep_id)}</p>}
      {selectedMineral.properties.dev_stat&&
       <p><strong>Статус в архивной базе (не подтверждён на 2026 год):</strong> {String(selectedMineral.properties.dev_stat)}</p>}
     </>}
     {mineralDepositFacts(selectedMineral).map(f=><p key={f.label}><strong>{f.label}:</strong> {f.value}</p>)}
     {mineralGuide((mineralCommodity(selectedMineral)??mrdsMineralCommodity(selectedMineral))?.name??"")&&
      <div className="lektrus-atlas-city-data">
       <strong>Справка о минеральном сырье</strong>
       <p>{mineralGuide((mineralCommodity(selectedMineral)??mrdsMineralCommodity(selectedMineral))!.name)!.className}</p>
       <p><strong>Состав:</strong> {mineralGuide((mineralCommodity(selectedMineral)??mrdsMineralCommodity(selectedMineral))!.name)!.composition}</p>
       <p><strong>Использование:</strong> {mineralGuide((mineralCommodity(selectedMineral)??mrdsMineralCommodity(selectedMineral))!.name)!.uses}</p>
       <small>Генетический тип конкретного месторождения приводится отдельно, если он известен из USGS.</small>
      </div>}
     <p>Координаты: {(()=>{
      const c=selectedMineral.geometry?.coordinates;
      return Array.isArray(c)?Number(c[1]).toFixed(4)+"°, "+Number(c[0]).toFixed(4)+"°":"не приведены";
     })()}</p>
     <p>Идентификатор источника: {String(selectedMineral.properties?.OBJECTID??
      selectedMineral.properties?.objectid??selectedMineral.properties?.objectid_1??selectedMineral.properties?.gid??"не указан")}</p>
     <small>Название месторождения, разновидности минералов, геология, оценка запасов и статус добычи
      приводятся в исходной базе, если они опубликованы. Значения не вычисляются из точки карты.</small>
     {mineralDepositSource(selectedMineral)&&<a href={mineralDepositSource(selectedMineral)!}
      target="_blank" rel="noopener noreferrer">Исходная карточка месторождения USGS ↗</a>}
     <a href={selectedMineral.properties?.ATLAS_DATASET==="MRDS"?
      "https://energy.usgs.gov/arcgis/rest/services/Hosted/Mineral_Resource_Data_System/FeatureServer/0":
      "https://energy.usgs.gov/arcgis/rest/services/Hosted/Major_mineral_deposits/FeatureServer/0"}
      target="_blank" rel="noopener noreferrer">Открыть набор геологических данных USGS ↗</a>
    </div>:
    selected?<div className="lektrus-atlas-description">
     {selectedCountrySymbol?<div className="lektrus-atlas-selected-symbol-title">
      <LektrusAtlasCountrySymbol symbol={selectedCountrySymbol}/>
      <div><strong>{selectedTitle}</strong><small>{selectedLayer}</small>
       {historical&&selectedCountrySymbol.kind==="symbol"&&<small>Условный знак, не исторический герб</small>}
       {historical&&selectedCountrySymbol.kind==="historic"&&<small>{selectedCountrySymbol.label} · {selectedCountrySymbol.period}</small>}
      </div>
     </div>:<><strong>{selectedTitle}</strong><small>{selectedLayer}</small></>}
     {historical&&selectedCountrySymbol?.sourceUrl&&
      <a className="lektrus-history-symbol-source" href={selectedCountrySymbol.sourceUrl}
       target="_blank" rel="noopener noreferrer">Источник и описание исторического символа ↗</a>}
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
     {!historical&&<div className="lektrus-atlas-study-card lektrus-atlas-reference-card">
      <strong>Справка об объекте</strong>
      {schoolReferenceLoading&&<small>Загрузка дополнительных сведений…</small>}
      {schoolReference?.description&&<p>{schoolReference.description}</p>}
      {schoolReference?.facts.map(f=><p key={f.label}><strong>{f.label}:</strong> {f.value}</p>)}
      {schoolReference&&<a href={schoolReference.url} target="_blank" rel="noopener noreferrer">Данные Wikidata, открытая база ↗</a>}
      {schoolReferenceError&&<small>{schoolReferenceError}</small>}
      {!schoolReferenceLoading&&!schoolReferenceError&&!schoolReference&&
       <small>Для этого объекта дополнительные сведения в подключённом справочнике отсутствуют. Показаны атрибуты картографического источника.</small>}
      <small>Значения из открытого справочника могут быть разного года и не всегда актуальны. Для учебного использования проверяйте дату и первоисточник.</small>
     </div>}
      {typeof selected.properties?.CAPITAL_CORRECTION_URL==="string"&&<a href={selected.properties.CAPITAL_CORRECTION_URL}
       target="_blank" rel="noopener noreferrer">Правовой источник уточнения столицы ↗</a>}
      {typeof selected.properties?.LOCATION_SOURCE_URL==="string"&&<a href={selected.properties.LOCATION_SOURCE_URL}
       target="_blank" rel="noopener noreferrer">Географический источник координат ↗</a>}
     {historical&&<div className="lektrus-history-compact-facts">
      <div className="lektrus-history-key-facts">
       <span><strong>Период карты</strong>{yearLabel(snapshot.year)}</span>
       {selectedArticle&&<span><strong>Время существования</strong>{yearLabel(selectedArticle.from)} – {yearLabel(selectedArticle.to)}</span>}
       {selectedArticle?.capital&&<span><strong>Столица и центры</strong>{selectedArticle.capital}</span>}
       {!selectedArticle&&fallbackReference?.capital&&<span><strong>Центры</strong>{fallbackReference.capital}</span>}
      </div>
      {selectedArticle?<div className="lektrus-history-article">
       <p>{selectedArticle.summary}</p>
       <p><strong>Ключевое изменение:</strong> {selectedArticle.turn}</p>
       <a href={historyArticleUrl(selectedArticle)} target="_blank" rel="noopener noreferrer">Подробнее об эпохе ↗</a>
      </div>:fallbackReference?<div className="lektrus-history-article">
       <p>{fallbackReference.description}</p>
       <p><strong>Ключевое изменение:</strong> {fallbackReference.change}</p>
       <a href={fallbackReference.sourceUrl} target="_blank" rel="noopener noreferrer">Историческая справка ↗</a>
      </div>:<p className="lektrus-history-missing-facts">Для этой территории пока нет отдельной проверенной исторической справки.</p>}
      <details className="lektrus-history-more">
       <summary>Источники и дополнительные сведения</summary>
       <p><strong>Точность границ:</strong> {precisions[borderPrecision(selected)]}</p>
       {fallbackReference?.formation&&<p><strong>Образование:</strong> {fallbackReference.formation}</p>}
       {historicalFeatureFacts(selected).map(f=><p key={f.label}><strong>{f.label}:</strong> {f.value}</p>)}
       {historicalSubject&&<p><strong>Принадлежность:</strong> {historicalSubject}</p>}
       {historicalPart&&historicalPart!==selectedTitle&&<p><strong>Регион:</strong> {historicalPart}</p>}
       {!modernReference&&selectedYears.length>0&&<div className="lektrus-history-observed">
        <strong>Объект показан на картах</strong>
        <div>{selectedYears.map(y=><button type="button" key={y} className={snapshot.year===y?"selected":""}
         onClick={()=>jumpToPeriod(y,selectedRaw)}>{yearLabel(y)}</button>)}</div>
        <small>Даты присутствия на картах не равны датам основания или распада.</small>
       </div>}
       <small>{modernReference?"Современный обзор по Natural Earth.":"Исторические границы являются реконструкцией и могут быть приблизительными."} Дата картографического слоя не устанавливает точные даты существования государства.</small>
      </details>
     </div>}
    </div>:
    historical?<div className="lektrus-atlas-description">
     <strong>Выберите территорию</strong>
     <p>Нажмите на историческое государство на карте, чтобы увидеть ключевые сведения. Другие эпохи доступны на временной шкале, а все территории в разделе «Территории».</p>
    </div>:
    <div className="lektrus-atlas-description"><strong>{mapModeTitle(mode)}</strong>
     <p>{atlasModes.find(m=>m.id===mode)?.hint}.</p>
     {mode==="physical"&&<p>Природные объекты, ледники, водная сеть и высотные отметки Natural Earth. Региональный масштаб использует подробнее проработанные реки, озёра и побережье. Для высотной подложки используется отдельная модель рельефа Mapzen (при включении и доступности).</p>}
     {mode==="hydrography"&&<p>Реки, озёра и морские акватории Natural Earth. При сильном приближении автоматически подключается детализация 1:10 млн; если источник недоступен, сохраняется слой 1:50 млн. Нажмите на объект или найдите его по названию.</p>}
     {mode==="relief"&&<p>При включённой гипсометрии цвета рассчитаны по высотам DEM; без неё заливка обозначает тип природной области. Подписи высот берутся из атрибутов Natural Earth.</p>}
     {citiesOn&&<p>На политической карте столицы появляются после стран, регионы и города постепенно показываются при приближении. Городские границы берутся из OSM там, где доступны геометрии.</p>}
    </div>}
    {historical&&historyTab==="changes"&&index>0&&<label className="lektrus-atlas-compare">
     <input type="checkbox" checked={compare} onChange={e=>setCompare(e.target.checked)}/>
     <span>Границы предыдущего снимка <small>(красный пунктир)</small></span>
    </label>}
    {historical&&historyTab==="changes"&&changes&&<div className="lektrus-atlas-changes">
     <strong>Отличия от предыдущего снимка</strong>
     <small>{yearLabel(historicalSnapshots[index-1].year)} → {yearLabel(snapshot.year)}</small>
     <div className="lektrus-history-change-counts"><span>Появились в данных: <strong>{changes.appeared.length}</strong></span><span>Отсутствуют в новом слое: <strong>{changes.disappeared.length}</strong></span></div>
     {changes.appeared.length>0&&<details><summary>Новые названия ({changes.appeared.length})</summary><p>{changes.appeared.join(", ")}</p></details>}
     {changes.disappeared.length>0&&<details><summary>Исчезнувшие названия ({changes.disappeared.length})</summary><p>{changes.disappeared.join(", ")}</p></details>}
     {!changes.appeared.length&&!changes.disappeared.length&&<p>Состав названий на соседних снимках совпадает.</p>}
     <small>Сравниваются названия в источнике, а не точная геометрия границ или причины исторических событий.</small>
    </div>}
    {d.markers.length>0&&<div className="lektrus-atlas-user-markers">
     <strong>Маркеры преподавателя</strong>
     {userMarkers.map(marker=><div key={marker.id} title={marker.description}>
      {marker.title} · {yearLabel(marker.year)}
     </div>)}
    </div>}
    </div>
    <details className="lektrus-atlas-source-details"><summary>Источники и точность данных</summary>
    <div className="lektrus-atlas-info-content">
     <div className="lektrus-atlas-study-card"><strong>Картографические источники</strong>
      <p>Данные разных масштабов и лет могут отличаться. Исторические границы основаны на реконструкциях, а современные границы нуждаются в проверке по официальным данным.</p>
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


    <div className="lektrus-atlas-source">
     <a href={(historical&&!modernReference?historicDataProvider:modernDataProvider).url}
      target="_blank" rel="noopener noreferrer">Источник: {(historical&&!modernReference?historicDataProvider:modernDataProvider).name} ↗</a>
     {historical&&<><small>Исторические реконструкции могут быть приблизительными; современный обзор отображён в версии RUS.</small>
      <a href={(modernReference?modernDataProvider:historicDataProvider).licenseUrl} target="_blank" rel="noopener noreferrer">Лицензия / условия использования ↗</a></>}
    </div>

    </div></details>
   </aside>}
  </div>
    {worksheetEditor&&<div className="lektrus-contour-workspace" role="toolbar"
     aria-label="Инструменты контурной карты" onPointerDown={e=>e.stopPropagation()}
     onClick={e=>e.stopPropagation()}>
     <div className="lektrus-contour-workspace-head">
      <strong title={d.title}>{d.title}</strong>
     </div>
     {d.contourTask&&<p className="lektrus-contour-task-label">{d.contourTask}</p>}
     <div className="lektrus-contour-workspace-tools">
      {([["select","Выбор",true],["hand","Рука",true],
       ["pen","Карандаш",contourConfig.allowDrawing],
       ["fill","Заливка",contourConfig.allowFill],
       ["erase","Ластик",true],
       ["label","Подпись / знак",contourConfig.allowLabels||contourConfig.allowPoints]] as const)
       .filter(([, ,allowed])=>allowed).map(([id,title])=><button
        type="button" key={id} title={title} aria-label={title}
        data-contour-hand={id==="hand"?"true":undefined}
        aria-pressed={id==="label"?contourAction==="label"||contourAction==="point":contourAction===id}
        className={"lektrus-contour-icon-button"+(
         (id==="label"?contourAction==="label"||contourAction==="point":contourAction===id)?" active":"")}
        onClick={()=>{setContourAction(id==="label"?
          (lastLabelKind==="point"&&contourConfig.allowPoints?"point":contourConfig.allowLabels?"label":"point"):id);
         setObjectMoveMode(false);points.current.clear();pointer.current=null;
         pinch.current=null;dragged.current=false}}>
        <ContourToolIcon name={id}/><span>{title}</span>
       </button>)}
      {contourAction!=="erase"&&<div className="lektrus-contour-dock-color"><LektrusColorPicker compact paletteInside userId={userId} label="Цвет" value={paintColor} onChange={setPaintColor}/></div>}
      <div className="lektrus-contour-dock-thickness" role="group" aria-label="Толщина инструмента"><span>Толщина</span><div className="lektrus-contour-width-presets">{(contourAction==="erase"?INK_WIDTHS.eraser:INK_WIDTHS.pen).map((size,i)=><button key={size} type="button" aria-label={["Очень тонко","Тонко","Средняя толщина","Толсто","Очень толсто"][i]+": "+size+" пикселей"} aria-pressed={toolThickness===(contourAction==="erase"?INK_WIDTHS.eraser:INK_WIDTHS.pen)[i]} className={toolThickness===size?"active":""} title={size+" px"} onClick={()=>setToolThickness(size)}><span className="lektrus-contour-width-line" style={{height:Math.max(1,Math.min(13,size/3))+"px",background:contourAction==="erase"?"#64748b":paintColor}}/></button>)}</div></div>
      <button type="button" className="lektrus-contour-icon-button" title="Отменить последнее действие"
       aria-label="Отменить" disabled={!contourHistory.length}
       onClick={contourUndo}>
       <svg className="lektrus-contour-tool-icon" width="23" height="23" viewBox="0 0 24 24"
        fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"
        aria-hidden="true"><path d="M9 14 4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/></svg><span>Отменить</span>
      </button>

     </div>
     {!objectMoveMode&&<div className="lektrus-contour-selected-mark"
      role="group" aria-label="Действия с выбранной подписью">
      {selectedContourMark?<>
       <span title={selectedContourMark.text||"Знак"}>Выбрано: <strong>{selectedContourMark.text||"Условный знак"}</strong></span>
       <button type="button" className="lektrus-contour-delete-mark"
        aria-label={"Удалить объект "+(selectedContourMark.text||"Условный знак")}
        onClick={()=>deleteContourMark(selectedContourMark.id)}>Удалить ×</button>
      </>:<span className="lektrus-contour-selection-hint">Нажмите на подпись, чтобы переместить или удалить её</span>}
     </div>}
     <div className="lektrus-contour-workspace-options">
      {(contourAction==="label"||contourAction==="point")&&<>
       <label className="lektrus-contour-label-type">Тип
        <select aria-label="Тип обозначения" value={contourAction}
         onChange={e=>{const kind=e.target.value as "label"|"point";
          setLastLabelKind(kind);setContourAction(kind)}}>
         {contourConfig.allowLabels&&<option value="label">Подпись</option>}
         {contourConfig.allowPoints&&<option value="point">Знак</option>}
        </select>
       </label>
       <input aria-label="Текст подписи или знака" value={contourText} maxLength={80}
        placeholder={contourAction==="label"?"Название объекта":"Знак или номер"}
        onChange={e=>setContourText(e.target.value)}/></>}
      {contourAction==="fill"&&contourConfig.showRegions&&<label>
       <input type="checkbox" checked={paintRegions} onChange={e=>setPaintRegions(e.target.checked)}/>
       Регионы</label>}

     </div>
    </div>}
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
export default function LektrusMapAtlas({diagram,onChange,editorMode,userId}:Props){return <AtlasMap diagram={diagram} onChange={onChange} editorMode={editorMode} userId={userId}/>};
