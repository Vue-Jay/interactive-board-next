import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";
import {un2025CapitalReference,modernCapitalOverrides,normalizeCapital,capitalInsideCountry} from "./atlas-2026-capitals.mjs";
const schoolAtlasSrc=fs.readFileSync(new URL("../src/lektrusSchoolAtlasMinerals.ts",import.meta.url),"utf8");
const schoolAtlasExports={};
new Function("exports",ts.transpileModule(schoolAtlasSrc,{compilerOptions:{
 module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022
}}).outputText)(schoolAtlasExports);
const schoolRequire=(path)=>{
 if(path==="./lektrusSchoolAtlasMinerals")return schoolAtlasExports;
 throw new Error("Unexpected import in atlas regression: "+path);
};

const source=fs.readFileSync(new URL("../src/lektrusAtlasModel.ts",import.meta.url),"utf8");
const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const exports={};
new Function("exports",js)(exports);
const {
 atlasModes,atlasModesFor,normalizeAtlasMode,normalizeAtlasDocument,historicalSnapshots,nearestSnapshotIndex,eventsNearYear,
 createAtlasDocument,validAtlasDocument,yearLabel
}=exports;
assert.deepEqual(atlasModes.map(m=>m.id),["political","contour","physical","minerals","historical","events"]);
assert.deepEqual(atlasModesFor("geography").map(m=>m.id),["political","contour","physical","minerals"]);
assert.deepEqual(atlasModesFor("history").map(m=>m.id),["historical","events"]);
assert.ok(historicalSnapshots.length>=50,"historical atlas should have broad real snapshot coverage");
assert.equal(new Set(historicalSnapshots.map(v=>v.year)).size,historicalSnapshots.length);
assert.ok(historicalSnapshots.every((v,i)=>i===0||v.year>historicalSnapshots[i-1].year));
assert.equal(historicalSnapshots.find(v=>v.year===1914)?.file,"world_1914.geojson");
assert.equal(historicalSnapshots.find(v=>v.year===1945)?.file,"world_1945.geojson");
assert.equal(historicalSnapshots.find(v=>v.year===-323)?.file,"world_bc323.geojson");
assert.equal(yearLabel(-323),"323 г. до н. э.");
assert.equal(yearLabel(1914),"1914 г.");
assert.equal(historicalSnapshots[nearestSnapshotIndex(1916)].year,1914);
assert.ok(eventsNearYear(1914).some(v=>v.year===1914));
assert.ok(eventsNearYear(1920).some(v=>v.year===1922));
assert.ok(eventsNearYear(2000).some(v=>v.year===2004));
const endWWII=eventsNearYear(1945).find(v=>v.title==="Окончание Второй мировой войны");
assert.ok(endWWII.lon>139&&endWWII.lon<140&&endWWII.lat>35&&endWWII.lat<36);
assert.match(endWWII.description,/2 сентября 1945/);
assert.ok(eventsNearYear(1945).some(v=>v.title.includes("Капитуляция Германии")));
assert.ok(eventsNearYear(500).some(v=>v.year===476&&v.lat>44&&v.lat<45));
assert.ok(exports.schoolHistoryEvents.some(v=>v.year===1347&&v.lat>38&&v.lat<39&&v.lon>15&&v.lon<16&&v.description.includes("Мессина")));
assert.ok(exports.schoolHistoryEvents.some(v=>v.year===800&&v.lon>12.44&&v.lon<12.46));
assert.ok(exports.schoolHistoryEvents.some(v=>v.year===1871&&v.description.includes("до завершения")));
const atlas=createAtlasDocument();
assert.equal(validAtlasDocument(atlas),true);
assert.equal(atlas.cityMinPopulation,0);
assert.equal(atlas.showCoordinates,false);
assert.equal(validAtlasDocument({...atlas,showCoordinates:true}),true);
assert.equal(validAtlasDocument({...atlas,showCoordinates:"yes"}),false);
for(const oldMode of ["hydrography","relief","coordinates","cities"]){
 const legacy={...atlas,mode:oldMode};
 assert.equal(validAtlasDocument(legacy),true,"old saved atlas must load: "+oldMode);
 const migrated=normalizeAtlasDocument(legacy);
 assert.equal(migrated.mode,oldMode==="coordinates"||oldMode==="cities"?"political":"physical");
 assert.equal(migrated.showCoordinates,oldMode==="coordinates");
}
assert.equal(normalizeAtlasMode("historical"),"historical");
assert.equal(normalizeAtlasMode("cities"),"political");
assert.equal(normalizeAtlasDocument({...atlas,mode:"cities"}).mode,"political");
assert.equal(normalizeAtlasDocument({...atlas,mode:"cities"}).showCities,true);
assert.equal(validAtlasDocument({...atlas,cityMinPopulation:50000}),true);
assert.equal(validAtlasDocument({...atlas,cityMinPopulation:17}),false);
assert.equal(atlas.scope,"geography");
assert.equal(validAtlasDocument({...atlas,scope:"history",mode:"historical"}),true);
assert.equal(validAtlasDocument({...atlas,scope:"geography",mode:"historical"}),false);
for(const mode of atlasModesFor("geography").map(v=>v.id))
 assert.equal(validAtlasDocument({...atlas,mode}),true);
for(const mode of atlasModesFor("history").map(v=>v.id))
 assert.equal(validAtlasDocument({...atlas,scope:"history",mode}),true);
// Older boards omitted the scope: keep their stored mode and contents readable.
assert.equal(validAtlasDocument({...atlas,scope:undefined,mode:"historical"}),true);
assert.equal(validAtlasDocument({...atlas,year:1917}),false,"no fictitious 1917 border state");
assert.equal(validAtlasDocument({...atlas,mode:"fictitious"}),false);
const externalSource=fs.readFileSync(new URL("../src/lektrusAtlasExternal.ts",import.meta.url),"utf8");
assert.match(externalSource,/OpenStreetMap|overpass/gi);
assert.match(externalSource,/Major_mineral_deposits/);
assert.match(externalSource,/esriGeometryEnvelope/);
assert.match(externalSource,/resultRecordCount:"350"/);
assert.match(externalSource,/MAX_EXTERNAL_FEATURES/);
const externalExports={};
new Function("exports","require",ts.transpileModule(externalSource,{compilerOptions:{
 module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(externalExports,schoolRequire);
assert.equal(externalExports.canLoadLocalRoads({west:30,east:32,south:54,north:56}),true);
assert.equal(externalExports.canLoadLocalRoads({west:10,east:100,south:40,north:56}),false);
assert.equal(externalExports.canLoadMinerals({west:30,east:55,south:40,north:60}),true);
assert.equal(externalExports.canLoadMinerals({west:-180,east:180,south:-85,north:85}),false);
const copperDeposit={properties:{commodity:"Copper",dep_type:"Hydrothermal",rec_id:12,model_code:"22c"},geometry:null};
assert.equal(externalExports.mineralCommodity(copperDeposit)?.name,"Медные руды");
const schoolSymbols=schoolAtlasExports.SCHOOL_ATLAS_MINERALS;
const schoolDeposits=schoolAtlasExports.SCHOOL_ATLAS_USGS_MINERALS;
assert.equal(schoolSymbols.length,26,"Legend includes exactly 26 pictograms from the supplied school atlas");
assert.equal(schoolDeposits.length,21,"USGS atlas legend excludes the five unsupported fuel-resource types");
assert.deepEqual(externalExports.mineralTypes.map(v=>v.name),schoolDeposits,
 "map dropdown uses exactly the school resource names and order");
for(const specialized of ["Литий","Уран","Редкоземельные элементы","Кобальт","Бериллий",
 "Титан","Барит","Гипс","Флюорит","Каолин","Борные минералы","Платина","Серебро"]){
 assert.equal(schoolSymbols.includes(specialized),false,specialized+" is not part of selected school symbols");
 assert.equal(externalExports.mineralCommodity({properties:{commodity:specialized},geometry:null}),null,
  specialized+" must not appear on the mineral map");
}
for(const [raw,schoolName] of [
 ["Lead, Zinc","Полиметаллические руды"],
 ["Apatite","Апатиты"],["Phosphate","Фосфориты"],
 ["Gold","Золото"],["Iron","Железные руды"],["Bauxite","Алюминиевые руды"],
 ["Copper","Медные руды"],["Mercury","Ртутные руды"],["Graphite","Графит"]
]){
 assert.equal(externalExports.mineralCommodity({properties:{commodity:raw},geometry:null})?.name,
  schoolName,raw+" should receive the appropriate school-atlas glyph");
}
assert.equal(externalExports.mineralDepositFacts(copperDeposit).find(x=>x.label==="Генетический тип")?.value,"Гидротермальное");
for(const commodity of ["Lead","Zinc","Nonferrous metals","Chemical grade"])assert.equal(externalExports.mineralCommodity({properties:{commodity}}),null);
assert.equal(externalExports.mineralCommodity({properties:{dep_type:"Gold"}}),null,"The genetic type is not a commodity");
assert.equal(externalExports.mineralCommodity({properties:{commodity:"Copper-molybdenum-gold"}},"Золото")?.name,"Золото");
assert.equal(externalExports.mineralCommodity({properties:{commodity:"Copper-molybdenum-gold"}},"Алмазы"),null);
assert.equal(externalExports.mineralDepositSource({properties:{url:"http://unknown.example/"} ,geometry:null}),null);
const guideSource=fs.readFileSync(new URL("../src/lektrusAtlasMineralGuide.ts",import.meta.url),"utf8");
const mineralGuides={};
new Function("exports",ts.transpileModule(guideSource,{compilerOptions:{
 module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(mineralGuides);
assert.ok(mineralGuides.mineralGuides.length>=14);
assert.equal(mineralGuides.mineralGuide("Железные руды")?.uses,"Получение железа и стали");
const areaSource=fs.readFileSync(new URL("../src/lektrusAtlasCityArea.ts",import.meta.url),"utf8");
const cityAreaExports={};
const areaFactsExports={};
new Function("exports",ts.transpileModule(fs.readFileSync(new URL("../src/lektrusAtlasSchoolFacts.ts",import.meta.url),"utf8"),{compilerOptions:{
 module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(areaFactsExports);
new Function("exports","require",ts.transpileModule(areaSource,{compilerOptions:{
 module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(cityAreaExports,()=>areaFactsExports);
assert.equal(cityAreaExports.cityAreaId({WIKIDATAID:"Q649"}),"Q649");
assert.equal(cityAreaExports.cityAreaId({WIKIDATAID:"invalid"}),null);

assert.match(fs.readFileSync(new URL("../src/LektrusMapAtlas.tsx",import.meta.url),"utf8"),/Фильтр полезных ископаемых/);
assert.match(fs.readFileSync(new URL("../src/LektrusMapAtlas.tsx",import.meta.url),"utf8"),/onDoubleClick/);
assert.match(fs.readFileSync(new URL("../src/LektrusMapAtlas.tsx",import.meta.url),"utf8"),/placedMapLabels/);
assert.match(fs.readFileSync(new URL("../src/LektrusMapAtlas.tsx",import.meta.url),"utf8"),/selected===f\.feature/);
assert.match(fs.readFileSync(new URL("../src/LektrusMapAtlas.tsx",import.meta.url),"utf8"),/cityAreaLoading/);
assert.match(fs.readFileSync(new URL("../src/lektrusAtlas.css",import.meta.url),"utf8"),/user-select:none!important/);

assert.equal(validAtlasDocument({...atlas,markers:[{id:"a",title:"Точка",lat:55.7,lon:37.6,
 year:1914,description:"Пояснение"}]}),true);
assert.equal(validAtlasDocument({...atlas,markers:[{id:"a",title:"Точка",lat:180,lon:37.6,
 year:1914,description:""}]}),false);
assert.equal(validAtlasDocument({...atlas,markers:Array.from({length:41},(_,i)=>({
 id:String(i),title:"Метка",lat:0,lon:0,year:1914,description:""
}))}),false);
const map=fs.readFileSync(new URL("../src/LektrusMapAtlas.tsx",import.meta.url),"utf8");
const regions=fs.readFileSync(new URL("../src/lektrusAtlasRegions.ts",import.meta.url),"utf8");
assert.match(regions,/atlasDistanceScale/);
assert.match(map,/lektrus-atlas-linear-scale/);
assert.match(map,/regions-regional/);
assert.match(map,/elevation-regional/);
assert.match(map,/glaciers-regional/);
const regionalExports={};
new Function("exports",ts.transpileModule(regions,{compilerOptions:{
 module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(regionalExports);
assert.equal(regionalExports.atlasRegions.length>=50,true);
assert.equal(regionalExports.atlasRegionCamera(regionalExports.findAtlasRegion("world")).scale,1);
for(const start of [{scale:1,position:{x:0,y:0}},{scale:5,position:{x:-780,y:120}}]){
 for(const anchor of [{x:450,y:225},{x:250,y:175},{x:720,y:330}]){
  const before={x:450+(anchor.x-450-start.position.x)/start.scale,y:225+(anchor.y-225-start.position.y)/start.scale};
  const next=regionalExports.zoomAtlasCamera(start,start.scale*1.3,anchor);
  const after={x:450+(anchor.x-450-next.position.x)/next.scale,y:225+(anchor.y-225-next.position.y)/next.scale};
  assert.ok(Math.abs(after.x-before.x)<1e-8&&Math.abs(after.y-before.y)<1e-8,"zoom must preserve cursor location");
 }
}
const wholeWorldCamera=regionalExports.atlasRegionCamera(regionalExports.findAtlasRegion("world"));
assert.deepEqual(wholeWorldCamera.position,{x:0,y:0},
 "Full-world atlas must open centred, without losing the western hemisphere");
for(const region of regionalExports.atlasRegions){
 const camera=regionalExports.atlasRegionCamera(region);
 const [west,south,east,north]=region.bounds;
 const centreX=(west+east+360)/720*900;
 const centreY=(90-(south+north)/2)/180*450;
 assert.ok(Math.abs(camera.position.x+(centreX-450)*camera.scale)<1e-7,
  region.id+" has a horizontally centred camera");
 assert.ok(Math.abs(camera.position.y+(centreY-225)*camera.scale)<1e-7,
  region.id+" has a vertically centred camera");
}
const atlasEditor=fs.readFileSync(new URL("../src/LektrusSchoolDiagramEditor.tsx",import.meta.url),"utf8");
const atlasView=fs.readFileSync(new URL("../src/LektrusSchoolDiagramView.tsx",import.meta.url),"utf8");
const atlasUi=fs.readFileSync(new URL("../src/LektrusMapAtlas.tsx",import.meta.url),"utf8");
const atlasEditorCss=fs.readFileSync(new URL("../src/lektrusAtlasEditor.css",import.meta.url),"utf8");
const appBootstrap=fs.readFileSync(new URL("../src/appEntry.tsx",import.meta.url),"utf8");
assert.match(atlasEditor,/onChange=\{isAtlas\?set:undefined\} editorMode=\{isAtlas\}/,
 "Selections in atlas preview should persist when added to board");
assert.match(atlasView,/editorMode=\{editorMode\}/,
 "School diagram view must forward atlas mode");
assert.match(atlasUi,/editorMode=\{editorMode\}/,
 "Map view must forward immersive editor mode to the atlas");
assert.match(atlasUi,/lektrus-atlas--inspector-hidden/,
 "Map inspector must be collapsible");
assert.match(atlasEditorCss,/lektrus-school-editor--atlas .lektrus-school-preview .lektrus-atlas-svg/,
 "The atlas SVG must not inherit 9\/5 school diagram preview sizing");
assert.match(atlasEditorCss,/height:100%;max-height:none;min-height:0;aspect-ratio:auto/,
 "Atlas should occupy the entire preview canvas");
assert.match(appBootstrap,/import "\.\/lektrusAtlasEditor\.css";/,
 "Atlas editor visual styles should load");

assert.ok(regionalExports.atlasRegionCamera(regionalExports.findAtlasRegion("rf-siberia")).scale>1);
const distance=regionalExports.atlasDistanceScale(3,0);
assert.ok(distance.width>0&&distance.width<=115&&distance.label.includes("км"));
assert.match(regions,/Сибирский федеральный округ/);
assert.match(regions,/Чукотка: западное полушарие/);
assert.match(map,/atlasRegionCamera/);
assert.match(map,/www.nspd.gov.ru/);
assert.match(map,/Единая электронная картографическая основа/);
assert.match(map,/НЕ подтверждена/);
assert.match(map,/shownRiverNames/);
assert.match(map,/shownLakeNames/);
assert.ok(map.includes('add("lake-"+f.id'));
assert.match(map,/Административные единицы региона/);
assert.ok(map.includes("onChange?.({...d,mode:value})"));
assert.match(map,/paintRegions/);
assert.match(map,/Условные обозначения/);
assert.match(map,/landformClass/);
assert.match(map,/shownMarineNames/);
assert.match(map,/shownCities/);
assert.match(map,/admin-regional/);
assert.match(map,/rivers-regional/);
assert.match(map,/Территория карты/);
assert.doesNotMatch(map,/Базовая версия Natural Earth/);
assert.equal(createAtlasDocument().borderView,"russian");
assert.equal(createAtlasDocument().regionId,"world");
assert.equal(validAtlasDocument({...atlas,regionId:"rf-siberia"}),true);
assert.equal(validAtlasDocument({...atlas,regionId:"..wrong"}),false);
assert.equal(createAtlasDocument().hypsometry,true);
assert.equal(validAtlasDocument({...atlas,hypsometry:false}),true);
assert.equal(validAtlasDocument({...atlas,hypsometry:"no"}),false);
const terrainSource=fs.readFileSync(new URL("../src/lektrusAtlasTerrainMath.ts",import.meta.url),"utf8");
const terrainCode=ts.transpileModule(terrainSource,{compilerOptions:{
 module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const terrain={};new Function("exports",terrainCode)(terrain);
assert.equal(terrain.decodeTerrarium(128,0,0),0,"Mapzen Terrarium sea-level decoding");
assert.equal(terrain.decodeTerrarium(127,255,0),-1);
assert.equal(terrain.decodeTerrarium(128,0,128),.5);
assert.ok(Math.abs(terrain.terrainLatitude(2,2))<1e-9);
assert.ok(Math.abs(terrain.terrainMercatorY(0,2)-2)<1e-9);
assert.deepEqual(terrain.atlasTerrainTiles(1,{x:0,y:0}).length,16);
const detailedTiles=terrain.atlasTerrainTiles(60,{x:-12000,y:-3800});
assert.ok(detailedTiles.length<=24,"DEM must load only bounded visible tiles");
assert.ok(detailedTiles.every(t=>t.width>0&&t.height>0&&t.x>=0&&t.y>=0));
assert.ok(terrain.hypsometricRGB(2000)[0]>terrain.hypsometricRGB(-2000)[0]);
const equator=terrain.terrainPixelAddress(0,0,9);
assert.equal(equator.x,256);
assert.equal(equator.y,256);
assert.equal(equator.px,0);
assert.equal(equator.py,0);
assert.equal(terrain.terrainPixelAddress(34,89,9),null);
assert.equal(terrain.terrainPixelAddress(181,40,9),null);
const terrainRenderer=fs.readFileSync(new URL("../src/LektrusAtlasTerrain.tsx",import.meta.url),"utf8");
assert.match(terrainRenderer,/getElevationPixels/);
assert.match(terrainRenderer,/sampleTerrainElevation/);
assert.match(map,/Высота выбранной точки/);
assert.match(map,/LektrusAtlasTerrain/);
assert.match(map,/Гипсометрическая карта/);
assert.match(fs.readFileSync(new URL("../src/LektrusMapBase.tsx",import.meta.url),"utf8"),/\{terrain\}/);

const data=fs.readFileSync(new URL("../src/lektrusAtlasData.ts",import.meta.url),"utf8");
const sourceLoader={};
const regionDisplayNamesSource=fs.readFileSync(new URL("../src/regionDisplayNames.ts",import.meta.url),"utf8");
const regionDisplayNamesExports={};
new Function("exports",ts.transpileModule(regionDisplayNamesSource,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(regionDisplayNamesExports);
assert.equal(typeof regionDisplayNamesExports.regionDisplayNames,"function","Atlas region display name helper must export a function");
const atlasDataRequire=(path)=>{
 if(path==="./regionDisplayNames")return regionDisplayNamesExports;
 if(path==="./lektrusAtlasModel")return exports;
 throw new Error("Unexpected atlas dependency: "+path);
};
const sourceBoundaryLine={type:"Feature",properties:{NAME:"Verified boundary"},geometry:{type:"LineString",coordinates:[[0,0],[1,1]]}};
const noGeometry={type:"Feature",properties:{NAME:"Hawke's Bay - Waikato"},geometry:null};
new Function("exports","require","fetch",ts.transpileModule(data,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(sourceLoader,atlasDataRequire,async()=>({ok:true,json:async()=>({type:"FeatureCollection",features:[sourceBoundaryLine,noGeometry]})}));
assert.deepEqual((await sourceLoader.loadAtlasLayer("admin-world-lines")).features,[sourceBoundaryLine],"A published geometry-less record must not suppress the entire detailed map");

// A nation/realm is not synonymous with the metropolitan country polygon.
const realmModule={};
new Function("exports",ts.transpileModule(fs.readFileSync(
 new URL("../src/lektrusHistoricalRealmContext.ts",import.meta.url),"utf8"),
 {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}
).outputText)(realmModule);
assert.equal(realmModule.historicalRealmContext("Denmark",1947),null);
for(const year of [1948,1950,1979,1994,2000,2009,2010,2024]){
 const entry=realmModule.historicalRealmContext("Denmark",year);
 assert.ok(entry&&entry.sources.length===2);
 assert.match(entry.description,/Фарерские острова/);
 if(year<1979)assert.match(entry.description,/позднее, в 1979/);
 else if(year<2009)assert.match(entry.description,/в 1979 году/);
 else assert.match(entry.description,/в 2009 году/);
}
assert.equal(realmModule.historicalRealmContext("Norway",2010),null);
assert.match(map,/data-atlas-realm-context/);
const spatialReview=JSON.parse(fs.readFileSync(new URL("../docs/historical-atlas-spatial-adjudications-20261126.json",import.meta.url),"utf8"));
const originalSpatial=JSON.parse(fs.readFileSync(new URL("../docs/historical-atlas-spatial-findings-20261124.json",import.meta.url),"utf8"));
assert.equal(spatialReview.cases.length,5);
assert.equal(spatialReview.counts.remainingUnverifiedGeometries,476);
for(const c of spatialReview.cases){
 const original=originalSpatial.findings.find(x=>x.id===c.id);
 assert.equal(original?.archiveName,c.archiveName??"Denmark");
 assert.equal(original.candidates[0].geometryId,c.sourceCandidateGeometryId);
 assert.equal(original.candidates[0].iou,c.iou);
}
// Dated control reports do not establish the sovereign border geometry.
const conflictModule={};
new Function("exports",ts.transpileModule(fs.readFileSync(
 new URL("../src/lektrusHistoricalConflictContext.ts",import.meta.url),"utf8"),
 {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}
).outputText)(conflictModule);
for(const year of [1992,1993,1994,1995]){
 const x=conflictModule.historicalConflictContext("Bosnia and Herzegovina",year);
 assert.ok(x&&x.sources.length===2&&x.description.includes("государственными границами"));
}
for(const year of [1996,1997,1998,1999,2000,2001]){
 const x=conflictModule.historicalConflictContext("Afghanistan",year);
 assert.ok(x&&x.sources.length===2&&x.description.includes("Северный альянс"));
}
assert.equal(conflictModule.historicalConflictContext("Afghanistan",2002),null);
assert.equal(conflictModule.historicalConflictContext("Bosnia and Herzegovina",1996),null);
assert.match(map,/data-atlas-conflict-context/);
const historicalInsigniaSource=fs.readFileSync(new URL("../src/lektrusHistoricalInsignia.ts",import.meta.url),"utf8");
const historicalReferenceSource=fs.readFileSync(new URL("../src/lektrusHistoricalReferences.ts",import.meta.url),"utf8");
const insigniaSource=fs.readFileSync(new URL("../src/lektrusAtlasCountrySymbols.ts",import.meta.url),"utf8");
const insigniaUI=fs.readFileSync(new URL("../src/LektrusAtlasCountrySymbol.tsx",import.meta.url),"utf8");
for(const [filename,source,kind] of [
 ["lektrusHistoricalInsignia.ts",historicalInsigniaSource,ts.ScriptKind.TS],
 ["lektrusHistoricalReferences.ts",historicalReferenceSource,ts.ScriptKind.TS],
 ["lektrusAtlasCountrySymbols.ts",insigniaSource,ts.ScriptKind.TS],
 ["LektrusAtlasCountrySymbol.tsx",insigniaUI,ts.ScriptKind.TSX]
]){
 const parse=ts.createSourceFile(filename,source,ts.ScriptTarget.Latest,true,kind);
 assert.equal(parse.parseDiagnostics.length,0,filename+" must parse: "+
  parse.parseDiagnostics.map(d=>ts.flattenDiagnosticMessageText(d.messageText," ")).join("; "));
}
const symbols={},historicalSymbols={},historicalReferences={},regionLabels={};
const regionLabelsSource=fs.readFileSync(new URL("../src/regionDisplayNames.ts",import.meta.url),"utf8");
new Function("exports",ts.transpileModule(regionLabelsSource,{compilerOptions:{
 module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022
}}).outputText)(regionLabels);
for(const [src,out] of [[historicalInsigniaSource,historicalSymbols],
 [historicalReferenceSource,historicalReferences]]){
 new Function("exports",ts.transpileModule(src,{compilerOptions:{
  module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022
 }}).outputText)(out);
}
new Function("exports","require",ts.transpileModule(insigniaSource,{compilerOptions:{
 module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022
}}).outputText)(symbols,id=>{
 if(id.includes("lektrusHistoricalInsignia"))return historicalSymbols;
 if(id.includes("lektrusHistoricalReferences"))return historicalReferences;
 if(id.includes("regionDisplayNames"))return regionLabels;
 throw Error("Unexpected atlas symbol import: "+id);
});
const symbolCountry=(name,code)=>({type:"Feature",properties:{NAME:name,...(code?{ISO_A2:code}:{})},
 geometry:{type:"Polygon",coordinates:[]}});
assert.equal(symbols.atlasCountrySymbol(symbolCountry("Russia","RU"),2026+"",2026,false).code,"RU");
assert.equal(symbols.atlasCountrySymbol(symbolCountry("United States of America","US"),"США",1994,true).kind,"historic");
assert.match(symbols.atlasCountrySymbol(symbolCountry("United States of America","US"),"США",1950,true).imageUrl??"",
 /1912-1959/,"Use the dated US flag rather than the 1960 design");
assert.equal(symbols.atlasCountrySymbol(symbolCountry("Russia","RU"),"Россия",1990,true).kind,"symbol",
 "Do not show post-1993 Russian flag before adoption");
assert.match(symbols.atlasCountrySymbol(symbolCountry("Russian Empire","RU"),"Российская империя",1914,true).imageUrl??"",
 /1896/,"Russia in 1914 should use the imperial-era flag, not a modern flag");
// Unverified images must not be used as a historical state's official symbol.
for(const [name,year] of [
 ["Roman Empire",100],["Byzantine Empire",1400],["Kingdom of Jerusalem",1200],
 ["Teutonic State",1400],["Majapahit",1400],["Inca Empire",1500],
 ["Crimean Khanate",1550],["Mughal Empire",1700],["Safavid Empire",1600],
 ["Goryeo",1200],["Aksumite Empire",345],["Baekje",510],
 ["Mongol Empire",1280],["Kingdom of Hawaii",1830],["Republic of Venice",1600]
]){
 const icon=symbols.atlasCountrySymbol(symbolCountry(name),name,year,true);
 assert.equal(icon.kind,"symbol",name+"/"+year);
 assert.equal(icon.imageUrl,undefined,name+"/"+year);
 assert.equal(icon.monogram,"?",name+"/"+year);
}
for(const id of ["rome","byzantium","maurya","hittite-empire","benin","mongols","goryeo",
 "ilkhanate","aztec","inca","venice","safavid","mughal","kingdom-hawaii"])
 assert.deepEqual(historicalSymbols.listHistoricalStateInsignia(id),[],"No unreliable heraldry for "+id);
assert.equal(historicalSymbols.findHistoricalStateInsignia("maurya",-245),undefined);
assert.equal(historicalSymbols.historicalReferenceSymbolYear({id:"rome",from:-27,to:476}),476);
assert.ok(insigniaUI.includes("lektrus-country-symbol-unknown"));
assert.ok(map.includes("Документированные государственные флаги"));
assert.ok(map.includes("listHistoricalStateInsignia(entry.id)"));
assert.equal(historicalSymbols.historicallyAttestedStateFlag(
 historicalSymbols.historicalStateInsignia.find(x=>x.id==="ussr"&&x.from===1955)),true);
for(const [name,year,pattern] of [
 ["Ottoman Empire",1900,/Ottoman/],["Qing dynasty",1900,/China/],
 ["German Democratic Republic",1980,/German%20Democratic%20Republic/],
 ["Soviet Union",1940,/1936/],["Soviet Union",1980,/Soviet%20Union/]
])assert.match(symbols.atlasCountrySymbol(symbolCountry(name),name,year,true).imageUrl??"",pattern);
assert.match(symbols.atlasCountrySymbol(symbolCountry("United States","US"),"США",1908,true).imageUrl??"",/1908/);
assert.equal(symbols.atlasCountrySymbol(symbolCountry("France","FR"),"Франция",1200,true).kind,"symbol");
assert.equal(symbols.atlasCountrySymbol(symbolCountry("Spain","ES"),"Испания",1800,true).kind,"symbol");
assert.equal(symbols.atlasCountrySymbol(symbolCountry("Spain","ES"),"Испания",1900,true).kind,"historic");
for(const row of [...historicalSymbols.historicalStateInsignia,...historicalSymbols.historicalDatedNationalFlags]){
 assert.ok(row.from<=row.to&&/\.(?:svg|png|jpe?g|gif)$/i.test(row.file));
 assert.ok(historicalSymbols.historicalInsigniaSourceUrl(row.file).startsWith("https://commons.wikimedia.org/wiki/File:"));
}
// Recently attested flags must not be assigned to a broader ambiguous country.
assert.equal(symbols.atlasCountrySymbol(symbolCountry("Germany","DE"),"Германия",1980,true).kind,"symbol",
 "Divided Germany has no single country-wide FRG flag in 1980");
assert.equal(symbols.atlasCountrySymbol(symbolCountry("Federal Republic of Germany","DE"),"ФРГ",1980,true).kind,"historic",
 "Specifically identified FRG may carry its documented flag");
assert.equal(symbols.atlasCountrySymbol(symbolCountry("Germany","DE"),"Германия",1994,true).kind,"historic");
assert.equal(symbols.atlasCountrySymbol(symbolCountry("China","CN"),"Китай",1955,true).kind,"symbol",
 "Unqualified China is not the same as the People's Republic in 1955");
assert.equal(symbols.atlasCountrySymbol(symbolCountry("People's Republic of China","CN"),"КНР",1955,true).kind,"historic");
assert.equal(symbols.atlasCountrySymbol(symbolCountry("France","FR"),"Франция",1942,true).kind,"symbol",
 "Do not merge Vichy and Free French administrations into one emblem");
assert.equal(symbols.atlasCountrySymbol(symbolCountry("France","FR"),"Франция",1960,true).kind,"historic");
assert.equal(symbols.atlasCountrySymbol(symbolCountry("West Germany","DE"),"ФРГ",1994,true).kind,"symbol",
 "Do not assign a modern flag to a defunct German state");
assert.equal(symbols.atlasCountryIso({type:"Feature",properties:{ISO_A2:"RU",NAME:"Perm Krai",adm1_code:"RU-PER"},
 geometry:{type:"Polygon",coordinates:[]}}),null,
 "An administrative province is not a sovereign country flag");
assert.equal(symbols.atlasCountryIso({type:"Feature",properties:{ISO_A2:"FR",NAME:"Paris"},
 geometry:{type:"Point",coordinates:[0,0]}}),null,
 "Place labels never inherit national flag badges");
assert.match(symbols.atlasCountrySymbol(symbolCountry("Canada","CA"),"Канада",1994,true).imageUrl??"",
 /Canada/,"Use the dated Canadian design");
assert.equal(symbols.atlasCountrySymbol(symbolCountry("Unknown Country"),"Неизвестная территория",2026,false).kind,"symbol");
assert.equal(symbols.atlasCountrySymbol(symbolCountry("Brazil","BR"),"Бразилия",2026,false).code,"BR");
assert.ok(symbols.atlasCountryFlagUrl("GB").endsWith("/gb.png"));
assert.ok(!map.includes("lektrus-atlas-map-country-symbols"),"Country insignia must not appear on the map canvas");
assert.ok(!map.includes("showCountrySymbols"),"Remove the unused map symbol toggle");
assert.ok(map.includes("lektrus-atlas-selected-symbol-title"),"Country cards must show flags and dated shields");
assert.ok(map.includes("LektrusAtlasCountrySymbol"),"Country lists use the shared symbol component");
assert.ok(map.includes("listHistoricalStateInsignia(entry.id)"),
 "Historical library must expose every dated emblem instead of just the latest");
assert.ok(map.includes("historicalReferenceSymbolYear(entry)"),
 "Reference thumbnails must use an image's own period, not the polity's last year");
assert.ok(!map.includes("lektrus-atlas-map-country-symbols"),
 "Symbols must stay in reference information, never the map canvas");

for(const [filename,source,kind] of [
 ["LektrusMapAtlas.tsx",map,ts.ScriptKind.TSX],
 ["lektrusAtlasData.ts",data,ts.ScriptKind.TS]
]){
 const parsed=ts.createSourceFile(filename,source,ts.ScriptTarget.Latest,true,kind);
 assert.equal(parsed.parseDiagnostics.length,0,
  filename+" must parse without errors: "+parsed.parseDiagnostics.map(d=>
   ts.flattenDiagnosticMessageText(d.messageText," ")).join("; "));
}

assert.match(data,/ne_50m_geography_marine_polys/);
const reg=fs.readFileSync(new URL("../src/lektrusSubjectToolRegistry.ts",import.meta.url),"utf8");
assert.match(map,/loadHistoricalSnapshot/);
assert.match(map,/input aria-label="Исторический период"/);
assert.match(map,/summariseNamedChanges/);
assert.match(map,/Исторические справки/);
assert.match(map,/могут быть приблизительными/);
assert.match(map,/Карта недоступна/);
assert.match(map,/licenseUrl/);
assert.match(data,/raw\.githubusercontent\.com/);
assert.match(data,/BORDERPRECISION/);
for(const name of ["countries-detail","cities","elevation","regions","glaciers","land","coastline"])
 assert.ok(data.includes(name),"real map dataset "+name);
for(const mode of ["hydrography","relief","cities","coordinates"])
 assert.equal(validAtlasDocument({...atlas,mode}),true);
assert.ok(map.includes('onPointerDownCapture={contourEraser?beginContourErase:contourFreehand?beginContourStroke:undefined}'));
assert.ok(map.includes('onClickCapture={contourEraser||contourFreehand?e=>'));
assert.ok(map.includes('vectorEffect="non-scaling-stroke" strokeLinecap="round"'),"Pen ink is kept in device-independent screen pixels");
assert.ok(map.includes('onPointerUp={objectMoveMode?undefined:contourEraser?endContourErase:contourFreehand?endContourStroke:onPointerEnd}'));
assert.ok(map.includes('const cameraLayerRef=useRef<SVGGElement|null>(null)'));
assert.ok(map.includes('cameraLayerRef.current?.setAttribute("transform"'));
assert.ok(map.includes('cameraIdleRef.current=setTimeout('));
assert.ok(map.includes('LektrusAtlasGraticule scale={scale} viewport={gridViewport}'));
assert.ok(!map.includes('grid={d.showGrid||coordinatesEnabled'));
assert.ok(map.includes('aria-label="Меридианы и параллели"'));
assert.match(map,/featureSourceFacts/);
assert.match(map,/setCompare/);
assert.match(map,/pickCoordinates/);
assert.match(map,/setSelectedMarker/);
assert.match(reg,/id:"maps-atlas"/);
assert.match(reg,/id:"history-atlas"/);
assert.match(reg,/subjects:\["география"\]/);
assert.match(reg,/subjects:\["история"\]/);

assert.match(data,/ne_10m_admin_0_countries\.geojson/);
assert.match(data,/ne_10m_admin_0_countries_rus\.geojson/);
assert.match(data,/ne_50m_admin_0_tiny_countries\.geojson/);
assert.ok(data.includes('"admin-world-overview":"ne_50m_admin_1_states_provinces_lines.geojson"'),
 "world regional overview must cover countries on every continent");
assert.ok(data.includes('"admin-world-lines":"ne_10m_admin_1_states_provinces_lines.geojson"'),
 "detailed regional atlas requires global 10m line coverage");
assert.ok(map.includes('loadAtlasLayer(selectedLayer)'),"atlas must actually load the selected global administrative lines");
assert.ok(map.includes('loadAtlasLayer("admin-world-overview")'),"detailed boundary source needs a 50m fallback");
assert.ok(map.includes("worldAdminLinePaths.map"),"world admin-1 polylines are rendered");
assert.match(map,/selectedLayer=scale>=3\.5\?"admin-world-lines":"admin-world-overview"/,
 "region boundaries should use global overview first and 10m linework after zoom");
assert.ok(map.includes('loadAtlasLayer("admin-world-overview")'),
 "a failed detailed boundary fetch must fall back to the global overview");
const mineralGlyphSource=fs.readFileSync(new URL("../src/LektrusMineralSymbol.tsx",import.meta.url),"utf8");
for(const schoolGlyph of ["coal","brown","shale","oil","gas","iron","manganese","copper","gold",
 "aluminium","nickel","chromium","tungsten","molybdenum","tin","polymetal",
 "mercury","asbestos","graphite","mica","apatite","phosphate","potash","salt","glauber","diamonds"]){
 assert.ok(mineralGlyphSource.includes('case "'+schoolGlyph+'":'),
  schoolGlyph+" should have an explicit pictogram matching the school atlas legend");
}
assert.ok(map.includes("SCHOOL_ATLAS_GROUPS.map"),
 "fuel signs are available for education without fabricated mine locations");
assert.match(map,/MAX_ATLAS_ZOOM=16384/);
assert.match(map,/featureFocusBounds/);
assert.ok(!map.includes("tinyPoints.map"),"tiny country pins must not be drawn");
assert.ok(!map.includes("historicalSmallStates.map"),"historical small-state pins must not be drawn");
assert.match(map,/lektrus-atlas-capitals/);
assert.match(map,/Столицы государств/);
assert.match(map,/Фильтр городов по численности населения/);
assert.ok(data.includes("ne_10m_populated_places.geojson"));
const geoJs=ts.transpileModule(data,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const geoExports={};
new Function("exports","require",geoJs)(geoExports,atlasDataRequire);
const placeSource=fs.readFileSync(new URL("../src/lektrusAtlasPlaces.ts",import.meta.url),"utf8");
const places={};
new Function("exports","require",ts.transpileModule(placeSource,{compilerOptions:{
 module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(places,
 id=>{if(id.includes("lektrusAtlasData"))return geoExports;throw Error("Unexpected import: "+id)});
const place=(name,cap,role="Populated place",pop=100000)=>({type:"Feature",
 properties:{NAME:name,NAME_RU:name,ADM0CAP:cap,FEATURECLA:role,POP_MAX:pop,LABELRANK:3},
 geometry:{type:"Point",coordinates:[30,55]}});
const moscow=place("Москва",1,"Admin-0 capital",13000000);
const kazan=place("Казань",0,"Admin-1 capital",1300000);
const small=place("Димитровград",0,"Populated place",105000);
assert.equal(places.nationalCapital(moscow),true);
assert.equal(places.nationalCapital(kazan),false,"regional centre is not a national capital");
assert.equal(places.nationalCapital(small),false,"ordinary town is not a capital");
assert.equal(places.russianPlaceName(small),"Димитровград");
assert.equal(places.russianPlaceName({...small,properties:{NAME:"Unknown"}}),null);
const named=(p,geometry={type:"Point",coordinates:[0,0]})=>
 ({type:"Feature",properties:p,geometry});
assert.equal(geoExports.geoFeatureName(named({NAME_RU:"Озеро Байкал",NAME:"Baikal"})),"Озеро Байкал");
assert.equal(geoExports.geoFeatureName(named({NAME:"Black Sea"})),"Чёрное море");

// Regression: the dated 1994 layer must draw every source polygon, not just
// countries present in the short Russian-language article catalogue.
const historicalSample={type:"FeatureCollection",features:[
 named({NAME:"France"},{type:"Polygon",coordinates:[]}),
 named({NAME:"Japan"},{type:"MultiPolygon",coordinates:[]}),
 named({NAME:"Untranslated but real polity"},{type:"Polygon",coordinates:[]}),
 named({NAME:"Source point"},{type:"Point",coordinates:[0,0]})
]};
assert.equal(geoExports.historicalMapFeatures(historicalSample).length,3,
 "Unnamed historical countries must not disappear from the rendered layer");
assert.ok(map.includes("historicalMapFeatures(mapSource)"),
 "Historical rendering must select all source polygons regardless of translation");
assert.ok(map.includes("historical&&!modernReference||!!f.name"),
 "Historical paths must not require Russian names");
assert.equal(geoExports.historicalCountryName("France"),"Франция");
assert.equal(geoExports.historicalCountryName("Germany"),"Германия");
assert.equal(geoExports.historicalCountryName("India"),"Индия");
assert.equal(geoExports.historicalSourceName("  Untranslated real polity  "),"Untranslated real polity");
assert.equal(geoExports.historicalSourceName("Unknown"),"");
assert.match(map,/visibleDirectory\.slice\(currentDirectoryPage\*120,\(currentDirectoryPage\+1\)\*120\)/);
assert.ok(map.includes("data-atlas-selected-index"),"browser tests must be able to verify precise selected identity");
const anachronistic={type:"FeatureCollection",features:[named({NAME:"Azerbaijan",SUBJECTO:"Azerbaijan"}),named({NAME:"Israel"}),named({NAME:"Bangladesh"}),named({NAME:"United Arab Emirates"})]};
assert.equal(geoExports.correctHistoricalLabels(anachronistic,1914).features[0].properties.ATLAS_HISTORICAL_AFFILIATION,"Российская империя");
assert.equal(geoExports.correctHistoricalLabels(anachronistic,1945).features[1].properties.ATLAS_HISTORICAL_LABEL,"Подмандатная Палестина (условный контур)");
assert.equal(geoExports.correctHistoricalLabels(anachronistic,1945).features[2].properties.ATLAS_HISTORICAL_LABEL,"Британская Индия (условный контур)");
assert.equal(geoExports.correctHistoricalLabels(anachronistic,1960).features[3].properties.ATLAS_HISTORICAL_LABEL,"Договорный Оман");
assert.equal(geoExports.correctedHistoricalIndexLabel("Israel",1945),"Подмандатная Палестина (условный контур)");
assert.equal(geoExports.correctedHistoricalIndexLabel("Israel",1960),undefined);
assert.equal(geoExports.borderPrecision(geoExports.correctHistoricalLabels(anachronistic,1914).features[0]),1);
assert.equal(geoExports.correctHistoricalLabels(anachronistic,1994),anachronistic);
for(const [name,year,label,affiliation] of [
 ["United States Virgin Islands",1914,"Датская Вест-Индия","Дания"],
 ["Kingdom of Hawaii",1900,"Гавайские острова","США"],
 ["Hong Kong",2000,"Гонконг","КНР"],
 ["Zaire",2010,"Демократическая Республика Конго","Демократическая Республика Конго"],
 ["Montenegro",1994,"Черногория","Союзная Республика Югославия"],
 ["Algeria",1960,"Алжир","Французская администрация"],
 ["Vietnam",1960,"Северный и Южный Вьетнам (общий условный контур)","линия разделения"],
 ["Egypt",1960,"Объединённая Арабская Республика (Египет)","1958–1961"],
 ["Yemen",1960,"Йеменское королевство и британские владения (условный контур)","1990"],
 ["Malaysia",1960,"Малайская Федерация и британские территории (условный контур)","1963"],
 ["Indonesia",1960,"Индонезия (условный контур)","1963"],
 ["Pakistan",1960,"Пакистан (Западный и Восточный)","1971"],
 ["Cameroon",1960,"Республика Камерун (условный контур)","1961"],
 ["Mali",1960,"Республика Мали (условный контур)","22 сентября 1960"],
 ["Senegal",1960,"Республика Сенегал (условный контур)","20 августа 1960"],
 ["China",1960,"Китайская Народная Республика","Китайской Республики"],
 ["Taiwan",1960,"Китайская Республика (Тайвань)","1971"],
 ["Tibet",1960,"Тибет (условный контур)","1959"],
 ["Samoa",1960,"Западное Самоа","1962"],
 ["Niue",1960,"Ниуэ","1974"],
 ["Suriname",1960,"Суринам","1975"],
 ["Hong Kong",1960,"Гонконг","Британская администрация"],
 ["South Africa",1960,"Южно-Африканский Союз","1961"],
 ["Congo",1960,"Республика Конго (Браззавиль)","1960"],
 ["Zaire",1960,"Республика Конго (Леопольдвиль)","1971"],
 ["Philippines",1945,"Филиппины (Содружество)","1946"],
 ["White Russia",1930,"СССР (условный контур)","исходная подпись"],
 ["Far Eastern SSR",1920,"Дальневосточная республика (с апреля 1920 г.)","6 апреля 1920"],
 ["Georgia",1930,"Грузинская ССР","Закавказская СФСР"],
 ["Saint Martin",2000,"Сен-Мартен (французская часть)","2007"],
 ["Saint Barthelemy",2010,"Сен-Бартелеми","Франции"],
 ["Hejaz",1930,"Хиджаз (условный контур)","1932"],
 ["United Kingdom of Great Britain and Ireland",1930,"Соединённое Королевство Великобритании и Северной Ирландии","1927"],
 ["Mauryan Empire",-100,"Бывшие земли империи Маурьев (условный контур)","185 г. до н. э."],
 ["Sasanian Empire",700,"Бывшие земли Сасанидов (условный контур)","651 г."],
 ["Mongol Empire",1200,"Монгольские земли (условный контур)","1206 г."]
]){
 const result=geoExports.correctHistoricalLabels({type:"FeatureCollection",features:[named({NAME:name,SUBJECTO:name})]},year).features[0];
 assert.equal(result.properties.ATLAS_HISTORICAL_LABEL,label,name+" "+year);
 assert.ok(result.properties.ATLAS_HISTORICAL_AFFILIATION.includes(affiliation));
 assert.equal(geoExports.correctedHistoricalIndexLabel(name,year),label);
 assert.equal(geoExports.borderPrecision(result),1);
 assert.ok(result.properties.ATLAS_HISTORICAL_SOURCE.startsWith("https://"));
}
// Optional exhaustive pass over the *actual* pinned source files. Download
// them first; CI's offline fixture assertions above remain deterministic.
if(process.env.LEKTRUS_ANNUAL_TIMELINE_DIR){
 const root=process.env.LEKTRUS_ANNUAL_TIMELINE_DIR;
 const manifest=JSON.parse(fs.readFileSync(`${root}/manifest.json`,"utf8"));
 const seen=new Set();
 for(const block of manifest.blocks){
  const pack=JSON.parse(fs.readFileSync(`${root}/${block.file}`,"utf8"));
  for(const [id,geometry] of Object.entries(pack.geometries)){
   if(seen.has(id))continue;seen.add(id);
   const path=geoExports.mapFeaturePath({type:"Feature",properties:{},geometry},.10);
   assert.ok(path&&!/NaN|Infinity/.test(path),`Historical SVG contour ${id} missing or invalid`);
  }
 }
 assert.equal(seen.size,manifest.counts.uniqueGeometries);
 console.log(`Annual atlas: ${seen.size} unique geometries render at overview resolution.`);
}
if(process.env.LEKTRUS_ATLAS_DATA_DIR){
 // 193 UN members (UNCHARTER list) and the two observer states are a
 // coverage check, not a determination of the sovereignty of all map areas.
 const unMembers="AFG ALB DZA AND AGO ATG ARG ARM AUS AUT AZE BHS BHR BGD BRB BLR BEL BLZ BEN BTN BOL BIH BWA BRA BRN BGR BFA BDI CPV KHM CMR CAN CAF TCD CHL CHN COL COM COG COD CRI CIV HRV CUB CYP CZE DNK DJI DMA DOM ECU EGY SLV GNQ ERI EST SWZ ETH FJI FIN FRA GAB GMB GEO DEU GHA GRC GRD GTM GIN GNB GUY HTI HND HUN ISL IND IDN IRN IRQ IRL ISR ITA JAM JPN JOR KAZ KEN KIR PRK KOR KWT KGZ LAO LVA LBN LSO LBR LBY LIE LTU LUX MDG MWI MYS MDV MLI MLT MHL MRT MUS MEX FSM MDA MCO MNG MNE MAR MOZ MMR NAM NRU NPL NLD NZL NIC NER NGA MKD NOR OMN PAK PLW PAN PNG PRY PER PHL POL PRT QAT ROU RUS RWA KNA LCA VCT WSM SMR STP SAU SEN SRB SYC SLE SGP SVK SVN SLB SOM ZAF SSD ESP LKA SDN SUR SWE CHE SYR TJK TZA THA TLS TGO TON TTO TUN TUR TKM TUV UGA UKR ARE GBR USA URY UZB VUT VEN VNM YEM ZMB ZWE".split(" ");
 assert.equal(new Set(unMembers).size,193);
 const modern=JSON.parse(fs.readFileSync(process.env.LEKTRUS_ATLAS_DATA_DIR+"/ne_10m_admin_0_countries_rus.geojson","utf8"));
 const correctedModern=geoExports.correctModernTerritoryLabels(modern);
 assert.equal(correctedModern.features.length,257);
 assert.equal(correctedModern.features.filter(geoExports.hasAtlasName).length,257,"every geographic source record must be visible");
 const correctedTerritories=correctedModern.features.filter(f=>f.properties.ATLAS_MODERN_TERRITORY_LABEL);
 assert.equal(correctedTerritories.length,9);
 for(const [i,f] of correctedModern.features.entries()){
  assert.equal(f.geometry,modern.features[i].geometry,"source boundary must not change while correcting names");
  if(f.properties.ATLAS_MODERN_TERRITORY_LABEL){
   assert.ok(geoExports.modernAtlasTerritoryUpdate(f)?.url.startsWith("https://"));
   assert.ok(geoExports.mapFeaturePath(f,.62),"corrected feature must be drawable");
  }
 }
 const spratly=correctedTerritories.find(f=>f.properties.ADM0_A3==="PGA");
 assert.equal(geoExports.geoFeatureName(spratly),"Острова Спратли");
 assert.equal(spratly.properties.WIKIDATAID,null,"prevent unrelated Wake Island encyclopedia card");
 assert.equal(spratly.properties.ATLAS_ORIGINAL_NAME_RU,"Уэйк");
 for(const i of [24,57,59,73,137,140,141,171,172,173,174,226,227,239,240,247,249,250,254,255,256]){
  const update=geoExports.modernAtlasTerritoryUpdate(correctedModern.features[i]);
  assert.ok(update?.note&&update.url.startsWith("https://"),`archive territory ${i}: missing reviewed context`);
 }
 for(const iso of ["FRA","NOR","SRB","GEO"]){
  const update=geoExports.modernAtlasTerritoryUpdate(correctedModern.features.find(f=>f.properties.ADM0_A3===iso));
  assert.ok(update?.note&&update.url.startsWith("https://"),`${iso}: comparable territorial extent note missing`);
 }
 const unrelated={...modern.features[171],bbox:[0,0,1,1]};
 assert.equal(geoExports.correctModernTerritoryLabels({type:"FeatureCollection",features:[unrelated]}).features[0],unrelated,"generic -99 code must not rename unrelated geometry");
 const coverageSource=fs.readFileSync(new URL("../src/lektrusAtlasHistoricalCoverage.ts",import.meta.url),"utf8");
 const coverageExports={};
 new Function("exports",ts.transpileModule(coverageSource,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(coverageExports);
 // A/RES/1514(XV), 14 December 1960: 99 voting members, including the
 // Ukrainian and Byelorussian SSR seats that are not independent map polities.
 // The China seat was represented by the Republic of China; Egypt and Syria
 // were one UN member (UAR). Never compare this period against today's ISO list.
 const un1960="Afghanistan|Albania|Argentina|Australia|Austria|Belgium|Bolivia|Brazil|Bulgaria|Burma|Cambodia|Cameroon|Canada|Central African Republic|Sri Lanka|Chad|Chile|Taiwan|Colombia|Congo|Zaire|Costa Rica|Cuba|Cyprus|Czechoslovakia|Benin|Denmark|Dominican Republic|Ecuador|El Salvador|Ethiopia|Malaysia|Finland|France|Gabon|Ghana|Greece|Guatemala|Guinea|Haiti|Honduras|Hungary|Iceland|India|Indonesia|Iran|Iraq|Ireland|Israel|Italy|Ivory Coast|Japan|Jordan|Laos|Lebanon|Liberia|Libya|Luxembourg|Madagascar|Mali|Mexico|Morocco|Nepal|Netherlands|New Zealand|Nicaragua|Niger|Nigeria|Norway|Pakistan|Panama|Paraguay|Peru|Philippines|Poland|Portugal|Romania|Saudi Arabia|Senegal|Somalia|Spain|Sudan|Sweden|Thailand|Togo|Tunisia|Turkey|South Africa|USSR|Egypt|United Kingdom|United States|Burkina Faso|Uruguay|Venezuela|Yemen|Yugoslavia".split("|");
 assert.equal(new Set(un1960).size+2,99);
 const raw1960=JSON.parse(fs.readFileSync(`${process.env.LEKTRUS_ATLAS_DATA_DIR}/world_1960.geojson`,"utf8"));
 const named1960=new Set(raw1960.features.filter(f=>["MultiPolygon","Polygon"].includes(f.geometry?.type)).map(f=>f.properties?.NAME?.trim()));
 assert.deepEqual(un1960.filter(n=>!named1960.has(n)),[]);
 // Interior points demonstrate actual anachronistic coverage, not just a
 // mismatch of labels. All points are well inland, away from the coastline
 // simplification. Retain the original geometry, but mark it conditional.
 for(const [name,point] of [["Yemen",[48.8,15.5]],["Malaysia",[112.5,2.7]],["Malaysia",[117,5]],["Indonesia",[138,-4]],["Cameroon",[9.4,5.6]]]){
  const original=raw1960.features.find(f=>f.properties?.NAME===name&&capitalInsideCountry(point,f.geometry));
  assert.ok(original,`1960: expected known composite outline for ${name}`);
  const corrected=geoExports.correctHistoricalLabels(raw1960,1960).features.find(f=>f.geometry===original.geometry);
  assert.match(corrected.properties.ATLAS_HISTORICAL_LABEL,/условный контур/);
  assert.equal(geoExports.borderPrecision(corrected),1);
 }
 console.log("1960: 97/97 named outlines corresponding to 99 UN seats (two SSRs included in USSR); geometry acceptance remains open.");
 // Verify minimum named coverage against all 193 present-day members, with
 // the UN roster's actual year-end totals and explicit historical aliases.
 const oldAliases={BLR:"Byelarus",COG:"Congo",COD:"Zaire",SWZ:"Swaziland",GMB:"Gambia, The",PRK:"Korea, Democratic People's Republic of",KOR:"Korea, Republic of",MMR:"Burma",MKD:"Macedonia",TZA:"Tanzania, United Republic of",TTO:"Trinidad",CPV:"Cape Verde"};
 const admittedLater={SSD:2011,TLS:2002,MNE:2006,CHE:2002,KIR:1999,NRU:1999,TON:1999,TUV:2000};
 for(const [year,expected,missingCount] of [[2010,192,19],[2000,189,18],[1994,185,15]]){
  const raw=JSON.parse(fs.readFileSync(`${process.env.LEKTRUS_ATLAS_DATA_DIR}/world_${year}.geojson`,"utf8"));
  const roster=unMembers.filter(iso=>(admittedLater[iso]??0)<=year);
  assert.equal(roster.length,expected);
  const named=new Set(raw.features.map(f=>String(f.properties?.NAME??"").trim().toLowerCase()).filter(Boolean));
  const missing=roster.filter(iso=>{
   const p=modern.features.find(f=>f.properties?.ADM0_A3===iso).properties;
   return ![p.NAME,p.ADMIN,p.NAME_LONG,p.FORMAL_EN,p.BRK_NAME,oldAliases[iso]].filter(Boolean).some(n=>named.has(n.toLowerCase()));
  }).sort();
  const coverage=coverageExports.historicalMemberCoverage(year);
  assert.equal(coverage.expected,expected);
  assert.equal(missing.length,missingCount);
  assert.deepEqual(coverage.missing.map(m=>m.iso).sort(),missing);
  const restored=geoExports.correctHistoricalLabels(raw,year).features.filter(f=>f.properties?.NAME==="Switzerland"&&Object.hasOwn(f.properties,"ATLAS_ORIGINAL_NAME"));
  assert.equal(restored.length,1,`${year}: missing main Swiss contour`);
  assert.ok(raw.features.some(f=>!f.properties.NAME?.trim()&&f.geometry===restored[0].geometry),"Swiss geometry must be original, not recreated");
  assert.equal(restored[0].geometry.coordinates[0][0].length,2857);
  console.log(`${year}: ${expected-missingCount}/${expected} UN roster entries have named outlines; ${missingCount} missing; main Swiss contour identified.`);
 }
 for(const iso of [...unMembers,"PSE","VAT"]){
  const adm={SSD:"SDS",PSE:"PSX"}[iso]??iso;
  const feature=modern.features.find(f=>f.properties?.ADM0_A3===adm);
  assert.ok(feature,`2026 overview missing ${iso}`);
  assert.ok(geoExports.geoFeatureName(feature),`2026 overview missing Russian name for ${iso}`);
  assert.ok(geoExports.mapFeaturePath(feature,.62),`2026 overview missing outline for ${iso}`);
 }
 for(const adm of ["KGZ","TJK","MUS","IOT","ARM","AZE","RUS","UKR"]){
  const feature=modern.features.find(f=>f.properties?.ADM0_A3===adm);
  const update=geoExports.modernAtlasTerritoryUpdate(feature);
  const date=["ARM","AZE"].includes(adm)?"2024":["RUS","UKR"].includes(adm)?"2022":"2025";
  assert.ok(update?.note.includes(date)&&update.url.startsWith("https://"),`dated note missing for ${adm}`);
 }
 console.log("2026 overview: 193/193 UN member states and 2/2 observer states present, named and drawable. Geometry is the archived 2022 layer, not a certified 2026 border survey.");
 const roster=[...unMembers,"PSE","VAT"];
 const statsExports={};
 new Function("exports",ts.transpileModule(fs.readFileSync(new URL("../src/lektrusAtlasModernStats.ts",import.meta.url),"utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(statsExports);
 assert.deepEqual(Object.keys(statsExports.modernCountryStats).sort(),roster.slice().sort());
 for(const iso of roster){
  const feature=modern.features.find(f=>f.properties.ADM0_A3===({SSD:"SDS",PSE:"PSX"}[iso]??iso));
  const s=statsExports.countryStatistics(feature);
  assert.ok(s,`${iso}: missing modern statistical profile`);
  assert.ok(iso==="VAT"?s.populationThousands===null:Number.isInteger(s.populationThousands)&&s.populationThousands>0);
  assert.ok(["VAT","SSD","SDN"].includes(iso)?s.areaKm2===null:Number.isInteger(s.areaKm2)&&s.areaKm2>0);
  assert.ok(statsExports.countryStatisticsFacts(s).every(f=>f.sourceUrl?f.sourceUrl.startsWith("https://")&&f.value:f.label.includes("2025")&&f.value));
 }
 assert.deepEqual(statsExports.modernCountryStats.RUS,{populationThousands:143997,areaKm2:17098246});
 assert.deepEqual(statsExports.modernCountryStats.CHN,{populationThousands:1416096,areaKm2:9600000});
 assert.deepEqual(statsExports.modernCountryStats.PSE,{populationThousands:5590,areaKm2:6025});
 for(const [iso,area] of Object.entries({VAT:.44,MCO:2.08,SGP:745.1,LIE:160,SMR:61.2})){
  const f=modern.features.find(f=>f.properties.ADM0_A3===iso);
  assert.equal(statsExports.countryStatistics(f).nationalArea.areaKm2,area);
  assert.ok(statsExports.countryStatisticsFacts(statsExports.countryStatistics(f)).some(f=>f.sourceUrl&&f.value.includes("км²")));
 }
 for(const iso of ["VAT","MCO","SGP"]){
  const note=geoExports.modernAtlasTerritoryUpdate(modern.features.find(f=>f.properties.ADM0_A3===iso));
  assert.ok(note?.note.includes("2022")||note?.note.includes("архивный")||note?.note.includes("Архивный"),`${iso}: geometry warning missing`);
 }
 console.log("2026 overview: 195/195 country statistics compared to UN's dated 2025 reference; 192 surface areas available, 3 not supplied.");
 assert.deepEqual(Object.keys(un2025CapitalReference).sort(),roster.slice().sort(),"independent capital roster must cover all 195 entries");
 for(const scale of [110,50,10]){
  const layer=JSON.parse(fs.readFileSync(`${process.env.LEKTRUS_ATLAS_DATA_DIR}/ne_${scale}m_populated_places.geojson`,"utf8"));
  const points=places.applyVerifiedCapitalUpdates2026(layer).features;
  let spatialChecks=0;
  for(const iso of roster){
   const adm={SSD:"SDS",PSE:"PSX"}[iso]??iso;
   const country=modern.features.find(f=>f.properties?.ADM0_A3===adm);
   const actual=places.capitalsForCountry(country,points);
   const wanted=modernCapitalOverrides[iso]??[un2025CapitalReference[iso]];
   const found=actual.map(p=>normalizeCapital(p.properties.NAME));
   if(iso==="KIR"){
    assert.equal(found.length,1);
    assert.ok(wanted.map(normalizeCapital).includes(found[0]));
   }else assert.deepEqual(found.sort(),wanted.map(normalizeCapital).sort(),`2026 capital, 1:${scale}m, ${iso}`);
   for(const capital of actual){
    assert.ok(places.russianPlaceName(capital),`${iso}: untranslated capital`);
    assert.ok(capital.geometry.coordinates.every(Number.isFinite),`${iso}: invalid capital coordinates`);
    assert.ok(capitalInsideCountry(capital.geometry.coordinates,country.geometry),`${iso}: capital outside its source country`);
    spatialChecks++;
   }
   if(!wanted.length)assert.ok(places.modernCapitalContext(country)?.url.startsWith("https://"),`${iso}: missing source-backed capital context`);
  }
  assert.equal(spatialChecks,197);
  console.log(`2026 capital crosswalk: ${roster.length}/${roster.length} states checked at 1:${scale}m, ${spatialChecks} capital points inside corresponding source polygons.`);
 }
 for(const adm of ["NRU","PSX","ISR","BOL","NLD","MYS","IDN","SDN","YEM"]){
  const feature=modern.features.find(f=>f.properties.ADM0_A3===adm);
  const context=places.modernCapitalContext(feature);
  assert.ok(context?.text&&context.url.startsWith("https://"),`${adm}: capital context missing`);
 }
 let featureCount=0,namedPairs=0,correctedCount=0,emptyPaths=0;
 for(const snapshot of historicalSnapshots.filter(s=>s.year!==2026).slice().reverse()){
  const actual=JSON.parse(fs.readFileSync(process.env.LEKTRUS_ATLAS_DATA_DIR+"/"+snapshot.file,"utf8"));
  const result=geoExports.correctHistoricalLabels(actual,snapshot.year);
  assert.equal(result.features.length,actual.features.length);
  const drawable=geoExports.historicalMapFeatures(result);
  const names=new Set();
  for(const feature of drawable){
   featureCount++;
   const name=String(feature.properties?.NAME??"").trim();
   if(name)names.add(name);
   const rawPath=geoExports.mapFeaturePath(feature,.62);
   if(!rawPath)emptyPaths++;
   else assert.ok(!/NaN|Infinity/.test(rawPath),`${snapshot.year} ${name}: invalid map geometry`);
   const facts=geoExports.historicalFeatureFacts(feature);
   assert.ok(facts.every(f=>f.label&&f.value),`${snapshot.year} ${name}: empty card field`);
   const corrected=feature.properties?.ATLAS_HISTORICAL_LABEL;
   if(corrected){
    correctedCount++;
    assert.equal(geoExports.correctedHistoricalIndexLabel(name,snapshot.year),corrected);
    assert.equal(geoExports.borderPrecision(feature),1);
    assert.ok(feature.properties.ATLAS_HISTORICAL_SOURCE);
    assert.ok(!facts.some(f=>f.label==="Подчинение / принадлежность в базе"));
   }
  }
  namedPairs+=names.size;
 }
 assert.equal(emptyPaths,0,"every historical polygon must render at overview scale");
 assert.equal(featureCount,17769,"actual pinned source polygon coverage changed");
 console.log(`Actual historical dataset: ${featureCount} polygons, ${namedPairs} distinct name/year pairs, ${correctedCount} corrected polygons, ${emptyPaths} empty paths at overview scale.`);
}
assert.equal(geoExports.historicalCountryName("Japan"),"Япония");
assert.equal(geoExports.historicalCountryName("United States of America"),"Соединённые Штаты Америки");
assert.equal(geoExports.historicalCountryName("Czechoslovakia"),"Чехословакия");
assert.equal(geoExports.historicalCountryName("Bosnia and Herzegovina"),"Босния и Герцеговина");
assert.equal(geoExports.historicalCountryName("Byelarus"),"Беларусь");
assert.equal(geoExports.historicalCountryName("Congo"),"Республика Конго");
assert.equal(geoExports.historicalCountryName("Netherlands Antilles"),"Нидерландские Антильские острова");
assert.equal(geoExports.historicalCountryName("Antigua and Barbuda"),"Антигуа и Барбуда");
assert.equal(geoExports.historicalCountryName("Turkish Cypriot-administered area"),
 "Территория под управлением турок-киприотов");
assert.equal(geoExports.historicalCountryName("United States Virgin Islands"),"Американские Виргинские острова");
assert.equal(geoExports.historicalCountryName("West Germany"),"Федеративная Республика Германия");
assert.equal(geoExports.historicalCountryName("Nonexistent Historical Polity"),"",
 "Unknown source names must not receive invented translations");

assert.equal(geoExports.geoFeatureName(named({name_ru:"река Кама",NAME:"Kama"})),"река Кама");
assert.equal(geoExports.geoFeatureName(named({NAME:"Unknown"})),"");
assert.equal(geoExports.geoFeatureName(named({NAME:"Unnamed"})),"");
assert.equal(geoExports.geoFeatureName(named({NAME:"No name"})),"");
assert.equal(geoExports.geoFeatureName(named({NAME_RU:"Объект без названия"})),"");
assert.equal(geoExports.geoFeatureName(named({ISO_A2:"RU"})),"",
 "Unnamed city cannot become a country just because it has an ISO code");
assert.equal(geoExports.geoFeatureName(named({ISO_A2:"RU",adm1_code:"RU-PER",ADMIN:"Russia"},
 {type:"Polygon",coordinates:[]})),"",
 "Unnamed province cannot be labelled with the country name");
assert.equal(geoExports.geoFeatureName(named({ISO_A2:"RU",ADMIN:"Russia",SOVEREIGNT:"Russia"},
 {type:"Polygon",coordinates:[]})),"Россия","A real country may use the official ISO Russian name");
const schoolCountryFacts=geoExports.featureSourceFacts(named({
 NAME_RU:"Тестовая страна",CONTINENT:"Asia",SUBREGION:"Central Asia",
 POP_EST:1200000,POP_YEAR:2024,GDP_MD:15000,GDP_YEAR:2022
},{type:"Polygon",coordinates:[]}));
assert.equal(schoolCountryFacts.find(f=>f.label==="Часть света")?.value,"Азия");
assert.equal(schoolCountryFacts.find(f=>f.label==="Регион мира")?.value,"Центральная Азия");
assert.match(schoolCountryFacts.find(f=>f.label==="Население (оценка картографического источника)")?.value??"",/2024/);
assert.match(schoolCountryFacts.find(f=>f.label==="ВВП (оценка источника)")?.value??"",/2022/);
const sentinelFacts=geoExports.featureSourceFacts(named({ELEVATION:-9999,ELEV:-430,POP_MAX:-99,POP_MIN:"нет данных"}));
assert.equal(sentinelFacts.find(f=>f.label==="Высота, м")?.value,"-430");
assert.ok(!sentinelFacts.some(f=>f.label.startsWith("Население")));
assert.equal(geoExports.featureSourceFacts(named({name:"Gora Elbrus",elevation:5642,featurecla:"mountain"})).find(f=>f.label==="Высота, м")?.value,"5642");
assert.equal(geoExports.featureSourceFacts(named({name:"Mount Everest",elevation:8848,featurecla:"mountain"})).find(f=>f.label==="Высота, м")?.value,"8848,86");
assert.equal(geoExports.featureSourceFacts(named({name:"Cerro Aconcagua",elevation:6959,featurecla:"mountain"})).find(f=>f.label==="Высота, м")?.value,"6960,8");
assert.equal(geoExports.hasAtlasName(named({NAME:"Unknown"})),false);
assert.equal(places.russianPlaceName(named({NAME_RU:"Неизвестно"})),null);
assert.ok(!map.includes('!=="Объект без названия"'),"the UI must not use placeholder text");
for(const dataset of ["administrative","regions","glaciers","marine","physicalLabels","elevations"])
 assert.ok(map.includes(dataset+"?.features.filter(hasAtlasName)"),
  "the "+dataset+" named labels must omit unnamed entries");
assert.ok(map.includes("rivers?.features.map((f,i)=>("),
 "unnamed small rivers must retain their visible line geometry");
assert.ok(map.includes("lakes?.features.map((f,i)=>("),
 "small lakes must remain visible when there is no label");
assert.ok(map.includes("veryDetailedHydro=(mode===")||map.includes("veryDetailedHydro=(mode"),
 "zoom-dependent small river layer must remain available");
assert.ok(map.includes("loadAtlasOSMCoverage(externalBounds,\"waterways\""),
 "small OSM tributaries are available on the physical map");
assert.match(map,/atlasDisplayName/);
assert.match(map,/historicalRussianName/);
assert.equal(places.cityPopulation(small),105000);
assert.equal(places.nationalCapital(place("Тест",1,"Populated place")),false);
const worldPlaces={type:"FeatureCollection",features:[
 {...place("Malabo",1,"Admin-0 capital"),properties:{
  ...place("Malabo",1,"Admin-0 capital").properties,NAME:"Malabo",NAME_RU:"Малабо",ISO_A2:"GQ"}},
 {...place("Dar es Salaam",1,"Admin-0 capital"),properties:{
  ...place("Dar es Salaam",1,"Admin-0 capital").properties,NAME:"Dar es Salaam",NAME_RU:"Дар-эс-Салам",ISO_A2:"TZ"}},
 {...place("Dodoma",0,"Admin-0 capital alt"),properties:{
  ...place("Dodoma",0,"Admin-0 capital alt").properties,NAME:"Dodoma",NAME_RU:"Додома",ISO_A2:"TZ"}}
]};
const updatedPlaces=places.applyVerifiedCapitalUpdates2026(worldPlaces);
const southAfrica=places.applyVerifiedCapitalUpdates2026({type:"FeatureCollection",features:[]});
const saCapitals=places.capitalsForCountry({type:"Feature",geometry:null,properties:{ISO_A2:"ZA"}},southAfrica.features);
assert.deepEqual(saCapitals.map(places.russianPlaceName).sort(),["Блумфонтейн","Кейптаун","Претория"]);
assert.ok(saCapitals.every(c=>c.properties.CAPITAL_CORRECTION_URL.startsWith("https://www.gov.za/")));
for(const [iso,name] of [["SS","Джуба"],["LK","Шри-Джаяварденепура-Котте"],["NG","Абуджа"]])
 assert.equal(places.russianPlaceName(places.capitalsForCountry({type:"Feature",geometry:null,properties:{ISO_A2:iso}},southAfrica.features)[0]),name);
assert.equal(places.russianPlaceName(places.capitalsForCountry({type:"Feature",geometry:null,properties:{ISO_A2:"BI"}},southAfrica.features)[0]),"Гитега");
assert.deepEqual(places.capitalsForCountry({type:"Feature",geometry:null,properties:{ISO_A2:"SZ"}},southAfrica.features).map(places.russianPlaceName).sort(),["Лобамба","Мбабане"]);
assert.equal(places.capitalsForCountry({type:"Feature",geometry:null,properties:{ISO_A2:"NR"}},southAfrica.features).length,0);
assert.match(places.NAURU_CAPITAL_NOTE.text,/нет официальной столицы/);
assert.equal(geoExports.featureSourceFacts(named({FEATURECLA:"Admin-0 capital",ADM0CAP:0,CAPALT:0})).find(x=>x.label==="Категория")?.value,"Населённый пункт");
const legacyKazakhstan={type:"Feature",geometry:{type:"Point",coordinates:[71.43,51.13]},
 properties:{NAME:"Nur-Sultan",NAME_RU:"Нур-Султан",ISO_A2:"KZ",
 FEATURECLA:"Admin-0 capital",ADM0CAP:1}};
const astana=places.applyVerifiedCapitalUpdates2026({
 type:"FeatureCollection",features:[legacyKazakhstan]
}).features[0];
assert.equal(astana.properties.NAME_RU,"Астана");
assert.equal(astana.properties.NAME,"Astana");
assert.equal(places.nationalCapital(astana),true);
assert.ok(String(astana.properties.CAPITAL_CORRECTION_URL).includes("akorda.kz"));
const isoMissingCapital={...legacyKazakhstan,properties:{
 ...legacyKazakhstan.properties,ISO_A2:"-99",ADM0_A3:"-99",
 NAME:"Nur Sultan",NAME_RU:"Нур-Султан"}};
assert.equal(places.russianPlaceName(isoMissingCapital),"Астана",
 "old Kazakhstan capital must be correct even when Natural Earth omits the country ISO code");
assert.equal(places.applyVerifiedCapitalUpdates2026({type:"FeatureCollection",
 features:[isoMissingCapital]}).features[0].properties.NAME_RU,"Астана");
const fixed=(name)=>updatedPlaces.features.find(f=>f.properties?.NAME===name);
assert.equal(places.nationalCapital(fixed("Malabo")),false,"new Equatorial Guinea capital in 2026");
assert.equal(places.nationalCapital(fixed("Ciudad de la Paz")),true);
assert.equal(places.russianPlaceName(fixed("Ciudad de la Paz")),"Сьюдад-де-ла-Пас");
assert.equal(places.nationalCapital(fixed("Dar es Salaam")),false,"Tanzania law declares Dodoma capital");
assert.equal(places.nationalCapital(fixed("Dodoma")),true);
assert.equal(fixed("Dodoma").properties.LOCATION_SOURCE_URL,undefined,"Never link a Tanzanian city's coordinates to Equatorial Guinea");
assert.equal(places.applyVerifiedCapitalUpdates2026(updatedPlaces).features.length,updatedPlaces.features.length,
 "corrections must not duplicate a capital");
assert.equal(places.nationalCapital(worldPlaces.features[0]),true,"source must not be mutated");
assert.equal(places.matchesCityCategory(kazan,"regional"),true);
assert.equal(places.matchesCityCategory(small,"ordinary"),true);
assert.equal(places.matchesCityCategory(moscow,"capitals"),true);
assert.equal(places.matchesCityCategory(small,"regional"),false);
assert.equal(places.matchesCityCategory(kazan,"ordinary"),false);
assert.equal(validAtlasDocument({...atlas,cityCategory:"ordinary"}),true);
assert.equal(validAtlasDocument({...atlas,cityCategory:"wrong"}),false);
assert.match(map,/Категория городов/);
assert.match(map,/applyVerifiedCapitalUpdates2026/);
assert.match(map,/scale>=4/);
const benin=places.applyVerifiedCapitalUpdates2026({type:"FeatureCollection",features:[
 {...place("Cotonou",1,"Admin-0 capital"),properties:{
  ...place("Cotonou",1,"Admin-0 capital").properties,NAME:"Cotonou",ISO_A2:"BJ"}},
 {...place("Porto-Novo",0,"Admin-0 capital alt"),properties:{
  ...place("Porto-Novo",0,"Admin-0 capital alt").properties,NAME:"Porto-Novo",NAME_RU:"Порто-Ново",ISO_A2:"BJ"}}
]});
assert.equal(places.nationalCapital(benin.features[0]),false);
assert.equal(places.nationalCapital(benin.features[1]),true);
const eguinea={type:"Feature",properties:{ISO_A2:"GQ",ADM0_A3:"GNQ"},geometry:null};
assert.equal(places.capitalsForCountry(eguinea,updatedPlaces.features).length,1);
assert.equal(places.russianPlaceName(places.capitalsForCountry(eguinea,updatedPlaces.features)[0]),"Сьюдад-де-ла-Пас");
assert.match(map,/Столицы государства/);

const testCities=[{id:0,point:[100,100],feature:kazan},{id:1,point:[102,101],feature:small},
 {id:2,point:[400,100],feature:moscow}];
assert.equal(places.chooseCityLabels(testCities,1,20).length,2,
 "city labels should avoid overlaps without inventing coordinates");
assert.ok(places.limitCitySymbols(testCities,1,2).length<=2);
const nearbyCities=[
 {id:1,point:[200,200],feature:moscow},
 {id:2,point:[204,203],feature:kazan},
 {id:3,point:[310,200],feature:small}
];
const decluttered=places.limitCitySymbols(nearbyCities,1,10);
assert.equal(decluttered.length,2,"Nearby city symbols must not overlap at overview scale");
assert.deepEqual(decluttered.map(c=>c.id),[1,3],"Major cities take visual priority");
assert.equal(places.limitCitySymbols(nearbyCities,8,10).length,3,
 "Close cities return as students zoom in");

assert.match(map,/Math\.log2\(Math\.max\(1,scale\)\)/);
assert.match(map,/lektrus-atlas-coordinate-toggle/);
assert.match(map,/mode:normalizeAtlasMode\(d\.mode\),showCoordinates:enabled/,"legacy coordinate overlay can be disabled");
assert.match(map,/lektrus-atlas-source-details/);
assert.doesNotMatch(map,/lektrus-atlas-info-tabs/,"Information is a single unified panel");
assert.match(map,/fetchAtlasSchoolReference/);
assert.match(map,/scale>=2\.6\)capitalLabels/,"Country names appear before capital labels");
assert.match(map,/zoomAtlasCamera\(cameraRef\.current,next,point\)/);
assert.match(map,/scale<1\.6\?75/,"world overview should not render hundreds of city markers");
assert.equal(validAtlasDocument({...atlas,borderView:"source"}),true);
assert.equal(validAtlasDocument({...atlas,borderView:"russian"}),true);
assert.equal(validAtlasDocument({...atlas,borderView:"invalid"}),false);
assert.equal(geoExports.featureSourceFacts(moscow).find(f=>f.label==="Категория")?.value,"Столица государства");
assert.equal(geoExports.featureSourceFacts(kazan).find(f=>f.label==="Категория")?.value,"Административный центр региона");
const geographyWithEnglishMetadata={...moscow,properties:{...moscow.properties,
 SOVEREIGNT:"Imaginary state name",ADM0NAME:"Imaginary state name",FEATURECLA:"untranslated-map-code"}};
assert.equal(geoExports.featureSourceFacts(geographyWithEnglishMetadata).some(f=>
 /Imaginary|untranslated-map-code/.test(f.value)),false,
 "no untranslated English metadata may appear in a place card");
const historicalEnglish={type:"Feature",properties:{
 NAME:"Imaginary empire",SUBJECTO:"An English subject",PARTOF:"Foreign Region",
 SOURCE:"Some old source",NOTES:"Not translated notes",START:1914},geometry:null};
assert.ok(geoExports.historicalFeatureFacts(historicalEnglish).every(f=>
 !/[A-Za-z]/.test(f.value)),"historical metadata must be Russian or numeric");
assert.equal(geoExports.summariseNamedChanges(
 {type:"FeatureCollection",features:[{type:"Feature",properties:{NAME:"Unknown"},geometry:null}]},
 {type:"FeatureCollection",features:[{type:"Feature",properties:{NAME:"Unnamed"},geometry:null}]}
).after,0);
const hydroSource=fs.readFileSync(new URL("../src/lektrusAtlasHydro.ts",import.meta.url),"utf8");
const hydroExports={};
new Function("exports",ts.transpileModule(hydroSource,{compilerOptions:{
 module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(hydroExports);
assert.ok(hydroExports.atlasRiverStroke({properties:{scalerank:1}},false)<1.2);
assert.ok(hydroExports.atlasRiverStroke({properties:{scalerank:7}},true)<
 hydroExports.atlasRiverStroke({properties:{scalerank:1}},true));
assert.ok(hydroExports.atlasRiverStroke({properties:{scalerank:1}},true)<=1.2);
assert.equal(hydroExports.atlasLakeStroke(),.38);
assert.ok(hydroExports.atlasWaterGeometryTolerance(32,true)<
 hydroExports.atlasWaterGeometryTolerance(1,true));
assert.ok(map.includes('mineralContext?atlasRiverStroke(l.feature)*.85:atlasRiverStroke(l.feature,mode==="hydrography")'),
 "Physical river widths are retained; mineral context makes water lines subtler");
assert.ok(map.includes('className="lektrus-atlas-water-feature lektrus-atlas-river"'));
assert.ok(map.includes('strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke"'));
assert.ok(map.includes('strokeWidth="8"'),"thin rivers need an invisible mobile-friendly hit area");
assert.ok(map.includes('className="lektrus-atlas-river-ink" pointerEvents="none"'));
assert.match(map,/stroke="none"\s*className="lektrus-atlas-landform"/);
assert.ok(map.includes("rivers-ultra")&&map.includes("lakes-ultra"));
assert.ok(data.includes("ne_10m_rivers_lake_centerlines.geojson"));
assert.ok(data.includes("ne_10m_lakes.geojson"));
assert.ok(!map.includes('strokeWidth={mode==="hydrography"?1.4:.9}'));
const mapBase=fs.readFileSync(new URL("../src/LektrusMapBase.tsx",import.meta.url),"utf8");
assert.ok(mapBase.includes('d={f.d} vectorEffect="non-scaling-stroke"'),
 "coastline must not grow into a thick stroke as the teacher zooms");
assert.ok(map.includes('key={"province-"+f.id} d={f.path} vectorEffect="non-scaling-stroke"'));
const river={type:"Feature",properties:{NAME:"Sample river"},geometry:{
 type:"LineString",coordinates:[[30,60],[40,60]]
}};
const riverCenter=geoExports.featureLineMidpoint(river);
assert.ok(riverCenter&&Math.abs(riverCenter[0]-537.5)<.01&&Math.abs(riverCenter[1]-75)<.01,
 "river labels should derive from actual line geometry");
const tiny={type:"Feature",properties:{NAME:"Microstate"},geometry:{
 type:"Polygon",coordinates:[[[7.41,43.73],[7.42,43.73],[7.42,43.74],[7.41,43.74],[7.41,43.73]]]
}};
const fit=geoExports.featureFocusBounds(tiny);
assert.ok(fit&&fit.width<0.1&&fit.height<0.1&&fit.x>0&&fit.y>0,
 "microstate bounds support deep focused zoom");
assert.ok(geoExports.mapFeaturePath(tiny,.001).includes("L"),
 "deep-resolution geometry keeps the small boundary");
const monacoPoint=geoExports.featureFocusBounds(tiny);
assert.equal(geoExports.mapFeaturePath(tiny,.00015,{
 left:monacoPoint.x-.15,right:monacoPoint.x+.15,
 top:monacoPoint.y-.15,bottom:monacoPoint.y+.15}).length>0,true);
assert.equal(geoExports.mapFeaturePath(tiny,.00015,{
 left:0,right:20,top:0,bottom:20}),"",
 "distant microstate polygons are skipped by viewport clipping");
assert.equal(geoExports.borderPrecision(tiny),0,"missing precision is unknown, not approximate");
assert.equal(geoExports.borderPrecision({...tiny,properties:{
 NAME:"Historical candidate",historicalRole:"polity",geometryStatus:"candidate"
}}),1,"A provisional annual historical border must be displayed dashed and marked approximate");
assert.equal(geoExports.borderPrecision({...tiny,properties:{
 NAME:"Approved label, unverified border",historicalRole:"polity",geometryStatus:"candidate",
 ATLAS_HISTORICAL_LABEL:"Историческое название подтверждено"
}}),1,"A reviewed label does not verify geometric precision");
assert.equal(geoExports.borderPrecision({...tiny,properties:{
 NAME:"Modern point",geometryStatus:"candidate"
}}),0,"Only historical annual candidates are marked approximate by default");
const islandPoint={type:"Feature",properties:{NAME:"Island"},geometry:{
 type:"Point",coordinates:[180,0]
}};
assert.equal(geoExports.isTinyMapFeature(islandPoint),true);
assert.ok(geoExports.featureFocusBounds(islandPoint)?.x===900);
const crossing={type:"Feature",properties:{NAME:"Crossing"},geometry:{
 type:"LineString",coordinates:[[179,10],[-179,11]]
}};
const crossingPath=geoExports.mapFeaturePath(crossing);
assert.match(crossingPath,/M/);
assert.equal((crossingPath.match(/M/g)||[]).length,2,
 "antimeridian line must be split at both map edges");
const polygon={type:"Feature",properties:{NAME:"Dateline island"},geometry:{
 type:"Polygon",coordinates:[[[179,-10],[-179,-10],[-179,10],[179,10],[179,-10]]]
}};
const polygonPath=geoExports.mapFeaturePath(polygon);
assert.ok((polygonPath.match(/M/g)||[]).length>=2,
 "dateline polygons must not stretch across the entire world");
const common=fs.readFileSync(new URL("../src/LektrusMapBase.tsx",import.meta.url),"utf8");
assert.match(common,/lektrus-atlas-base-land/);
assert.match(common,/lektrus-atlas-base-coast/);
assert.ok(map.includes("LektrusMapBase land={baseLand}"));
assert.ok(map.includes('loadAtlasLayer(detailedGeography?"land-detail":"land")'));
assert.ok(map.includes('loadAtlasLayer(detailedGeography?"coastline-detail":"coastline")'));
assert.match(map,/pickCoordinates/);
assert.match(data,/ne_110m_land.geojson/);
assert.match(data,/ne_110m_coastline.geojson/);

// Explicit app navigation must never globally hijack every "Настройки"
// button in an atlas, notifications dialog, or other subject tool.
const application=fs.readFileSync(new URL("../src/BoardApp.tsx",import.meta.url),"utf8");
const workspace=fs.readFileSync(new URL("../src/LectrisWorkspaceShell.tsx",import.meta.url),"utf8");
const notificationPage=fs.readFileSync(new URL("../src/NotificationsScreen.tsx",import.meta.url),"utf8");
assert.ok(!application.includes('textContent?.trim().includes("Настройки")'));
assert.ok(!application.includes('document.addEventListener("click",onDashboardClick,true)'));
assert.ok(workspace.includes('onClick={()=>move(entry.id)}'));
assert.ok(workspace.includes('id:"settings", label:"Настройки"'));
assert.ok(notificationPage.includes('onClick={()=>setSettingsOpen(true)}'));
assert.ok(map.includes('const mineralClusterScale=Math.pow(2'));
assert.ok(map.includes('mineralClusterScale,mineralFilter,420'));
assert.ok(map.includes('const countryAnchorCache=useMemo'));
assert.ok(map.includes('const provinceAnchorCache=useMemo'));
assert.ok(common.includes('const LandGeometry=memo('));
assert.ok(common.includes('const CoastGeometry=memo('));
assert.ok(common.includes('d={f.d} vectorEffect="non-scaling-stroke"'));
const terrainPerf=fs.readFileSync(new URL("../src/LektrusAtlasTerrain.tsx",import.meta.url),"utf8");
assert.ok(terrainPerf.includes('const palette=terrainPalette()'));
assert.ok(terrainPerf.includes('Math.min(4,tiles.length)'),"Terrain decoding must be concurrency-limited");
assert.ok(terrainPerf.includes('while(active&&next<tiles.length)'),"Discarded camera views must stop queueing new tile work");

// Student work is local to the geographic map, source-based and persisted.
const validWork={...atlas,mode:"contour",contourTask:"Обозначьте Волгу и Урал",
 contourMarks:[{id:"mark-1",kind:"label",text:"Волга",lon:43,lat:56,color:"#286baf"}],
 contourStrokes:[{id:"stroke-1",points:[[30,56],[33,58]],color:"#286baf"}],
 contourLegend:[{id:"legend-1",symbol:"●",meaning:"Город"}]};
assert.equal(validAtlasDocument(validWork),true);
assert.equal(validAtlasDocument({...validWork,contourMarks:[{...validWork.contourMarks[0],lat:180}]}),false);
assert.equal(validAtlasDocument({...validWork,contourStrokes:[{...validWork.contourStrokes[0],points:[[30,56],[360,60]]}]}),false);
assert.equal(validAtlasDocument({...validWork,contourLegend:[{id:"x",symbol:"1",meaning:"".padEnd(100,"s")}]}),false);
const atlasEditorNoSettings=fs.readFileSync(new URL("../src/LektrusSchoolDiagramEditor.tsx",import.meta.url),"utf8");
assert.ok(!atlasEditorNoSettings.includes('lektrus-atlas-settings-toggle'));
assert.ok(!atlasEditorNoSettings.includes('atlasSettingsOpen'));
assert.ok(map.includes('contourMarks:contourMarks.filter'));
assert.ok(map.includes('setContourAction(id==="label"?'),
 "Choosing Eraser / Label / Pencil must switch from object movement to map editing");
assert.ok(map.includes('Контурная карта')||map.includes('контурной карты'));
assert.ok(common.includes('export function LektrusAtlasGraticule'));
assert.ok(common.indexOf('export function LektrusAtlasGraticule')<
 common.indexOf('export default function LektrusMapBase'));

// Teacher and student create content in the same immersive atlas editor,
 // while the board never shows any editing tools.
assert.ok(atlasEditorNoSettings.includes('lektrus-contour-editor-fullscreen'));
assert.ok(atlasEditorNoSettings.includes('lektrus-contour-editor-options'));
assert.ok(atlasEditorNoSettings.includes('!draft.contourTask?.trim()'));
assert.ok(atlasEditorNoSettings.includes('onClick={onCancel}>Отмена'));
assert.ok(atlasEditorNoSettings.includes('Сохранить на доску'));
const contourFormBranch=atlasEditorNoSettings.slice(
 atlasEditorNoSettings.indexOf('if(isContour&&draft.kind==="atlas")return createPortal('),
 atlasEditorNoSettings.indexOf(' const title=<label className="lektrus-school-field">')
);
assert.ok(contourFormBranch.includes('<LektrusSchoolDiagramView diagram={draft} onChange={set} editorMode userId={userId}/>'));
assert.ok(contourFormBranch.includes('aria-expanded={contourSettingsOpen}'));
assert.ok(contourFormBranch.includes('⚙ Задание и подложка'));
const contourStyles=fs.readFileSync(new URL("../src/lektrusAtlasEditor.css",import.meta.url),"utf8");
assert.ok(contourStyles.includes('.lektrus-contour-editor-main'));
assert.ok(contourStyles.includes('.lektrus-contour-editor-map'));
assert.ok(contourStyles.includes('.lektrus-contour-editor-footer-actions'));
assert.ok(contourStyles.includes('overflow-y:auto'));
assert.ok(contourStyles.includes('@media(max-width:680px)'));
assert.ok(contourStyles.includes('height:100dvh'));
assert.ok(contourStyles.includes('env(safe-area-inset-bottom)'));

const teacher=fs.readFileSync(new URL("../src/LektrusContourAssignmentSetup.tsx",import.meta.url),"utf8");
assert.ok(teacher.includes('lektrus-contour-task-fields'));
assert.ok(teacher.includes("Задание"));
assert.ok(teacher.includes("Подложка карты"));
assert.ok(teacher.includes("Инструменты ученика"));
assert.ok(teacher.includes('<details className="lektrus-contour-task-section">'));
assert.ok(!teacher.includes("Настройте подложку"));
assert.ok(!teacher.includes("Шаблон по программе"));
assert.ok(teacher.includes("atlasRegions.filter"));
assert.ok(atlasEditorNoSettings.includes("LektrusContourAssignmentSetup value={draft}"));
assert.ok(map.includes('lektrus-atlas--worksheet'));
assert.ok(map.includes('worksheetEditor&&<div className="lektrus-contour-workspace"'));
assert.ok(!map.includes('isWorksheet&&!editorMode&&<div className="lektrus-contour-workspace"'));
assert.ok(map.includes('pointerEvents={worksheetOnBoard?"none":undefined}'));
const worksheetCss=fs.readFileSync(new URL("../src/lektrusAtlas.css",import.meta.url),"utf8");
assert.ok(worksheetCss.includes('.lektrus-atlas--board-selection .lektrus-atlas-contour-work *'));
assert.ok(worksheetCss.includes('pointer-events:none!important;'));

assert.ok(map.includes('!isWorksheet&&!historical&&<aside className="lektrus-atlas-sidebar lektrus-atlas-sidebar--selected-only"'));
assert.ok(map.includes('!isWorksheet&&<header className="lektrus-atlas-header"'));
assert.ok(map.includes('contourConfig.showRivers')&&map.includes('contourConfig.showLakes'));
assert.ok(map.includes('if(points.current.size===0)cameraIdleRef.current=setTimeout('));
assert.ok(map.includes('Math.max(.00015,.4/scale)'));
const modelContents=fs.readFileSync(new URL("../src/lektrusAtlasModel.ts",import.meta.url),"utf8");
assert.ok(modelContents.includes('export const defaultContourAssignment'));
assert.ok(data.includes('export function featureIntersectsViewport'));
assert.ok(common.includes('const target=10/Math.max(1,scale)'));
const boardSettings=fs.readFileSync(new URL("../src/BoardApp.tsx",import.meta.url),"utf8");
assert.ok(boardSettings.includes("Управление и интерфейс"));
assert.ok(boardSettings.includes("Настроить расположение панелей"));
assert.ok(boardSettings.includes("Колесо мыши и тачпад"));
const modelOptions={...validWork,contourAssignment:{showBorders:false,showRivers:true,allowFill:false}};
assert.equal(validAtlasDocument(modelOptions),true);
assert.equal(validAtlasDocument({...modelOptions,contourAssignment:{showRivers:"off"}}),false);

// A contour worksheet has a docked tool strip below the map, never over it,
// and defaults to the regular board interaction path so transform handles work.
const contourToolbarStart=map.indexOf('worksheetEditor&&<div className="lektrus-contour-workspace"');
const atlasSvgClose=map.indexOf('    </svg>');
const mapBodyClose=map.lastIndexOf('   </aside>}');
assert.ok(contourToolbarStart>mapBodyClose,
 "Editing toolbar must be below the map, outside the board version");
assert.ok(mapBodyClose>atlasSvgClose);
assert.ok(map.includes('useState(isWorksheet&&!editorMode)'),
 "Worksheets must start in board selection and resize mode");
assert.ok(map.includes('const mapConsumesPointer=')&&map.includes('if(mapConsumesPointer(e.target))e.stopPropagation()'),
 "Only intentional map-edit mode stops board pointer events");
assert.ok(map.includes('onPointerDownCapture={contourEraser?beginContourErase:contourFreehand?beginContourStroke:undefined}'));
assert.ok(map.includes('const worksheetEditor=isWorksheet&&editorMode'));
assert.ok(map.includes('const worksheetOnBoard=isWorksheet&&!editorMode'));
assert.ok(application.includes('data-object={item.id}'));
assert.ok(application.includes('data-transform-handle="rotate"'));
assert.ok(application.includes('className={`screen-resize-handle screen-handle-${h}`}'));
const atlasDockCss=fs.readFileSync(new URL("../src/lektrusAtlas.css",import.meta.url),"utf8");
assert.ok(atlasDockCss.includes('.lektrus-atlas--worksheet .lektrus-contour-workspace{'));
assert.ok(atlasDockCss.includes('position:relative;left:auto;right:auto;top:auto;bottom:auto;'));
assert.ok(atlasDockCss.includes('flex:1 1 0;min-height:0;min-width:0;'));
assert.ok(atlasDockCss.includes('overflow-x:auto;'),"Narrow map objects must scroll their tools, not obscure the map");


// The teacher's task must always be readable, not hidden in a disclosure.
const worksheetHead=map.slice(map.indexOf('className="lektrus-contour-workspace-head"'),
 map.indexOf('className="lektrus-contour-workspace-tools"'));
assert.ok(worksheetHead.includes('className="lektrus-contour-task-label"'));
assert.ok(worksheetHead.includes('{d.contourTask}'));
assert.ok(!worksheetHead.includes('<details>'));
assert.ok(!worksheetHead.includes('lektrus-contour-workspace-mode'),
 "Map editor needs tools only; moving and resizing the board object belongs on the board");
// Native board listeners fire earlier than React's nested bubble handler.
// Both native wheel and capture-phase touch must exit for an editing atlas.
assert.ok(application.includes('target.closest(".lektrus-atlas-map-box")'),
 "Native board wheel handler must not zoom/pan when zooming the map");
const wheelGuard=application.slice(
 application.indexOf('if(target.closest(".lektrus-atlas-map-box")'),
 application.indexOf('if (target.closest("textarea"))'));
assert.ok(wheelGuard.includes('e.preventDefault();')&&wheelGuard.includes('return;'));
const boardCapture=application.slice(application.indexOf('onPointerDownCapture={(e) => {'),
 application.indexOf('onPointerMoveCapture={(e) => {'));
assert.ok(boardCapture.includes('.lektrus-atlas:not(.lektrus-atlas--board-selection)'));
assert.ok(boardCapture.indexOf('.lektrus-atlas:not(.lektrus-atlas--board-selection)')<
 boardCapture.indexOf('touchStart(e)'),
 "Atlas touch guard must run before the board records any touchpoints");
assert.ok(map.includes('onPointerMove={e=>{if(mapConsumesPointer(e.target))e.stopPropagation()}'));
assert.ok(map.includes('onPointerCancel={e=>{if(mapConsumesPointer(e.target))e.stopPropagation()}'));
assert.ok(map.includes('onWheel={e=>{')&&map.includes('<div className="lektrus-atlas-map-box"'),
 "The atlas viewport, rather than the entire object, handles wheel zoom");
assert.ok(boardCapture.includes('if(atlas&&!atlasControl&&!presentation&&!space&&'),
 "Board pan must work on unoccupied atlas header and sidebar");
assert.ok(boardCapture.includes('gesture.current={pointer:e.pointerId,mode:"pan"'));
assert.ok(boardCapture.includes('const mapSurface=target.closest(".lektrus-atlas-map-box")'));
assert.ok(boardCapture.includes('setSelected([])'),"An empty press releases object selection");
assert.ok(boardCapture.includes('gesture.current.pointer===e.pointerId'),
 "Pointer IDs reused after lost release must retire stale captures");
const bottomStyles=fs.readFileSync(new URL("../src/lektrusAtlas.css",import.meta.url),"utf8");
assert.ok(bottomStyles.includes('.lektrus-atlas--worksheet .lektrus-contour-task-label{'));
assert.ok(contourStyles.includes('width:100vw;height:100dvh'));
assert.ok(contourStyles.includes('safe-area-inset-bottom'));

assert.ok(map.includes('if(pinch.current){onMove(e);return}'),
 "Two-touch pencil interaction should navigate map instead of the whiteboard");
assert.ok(map.includes('if(pinch.current){')&&map.includes('contourDrawing.current=[];'),
 "Second finger must cancel provisional pencil drawing");
assert.ok(map.includes('onPointerCancel={objectMoveMode?undefined:contourEraser?cancelContourErase:contourFreehand?cancelContourStroke:onPointerEnd}'),
 "Cancelled touch must not save an unfinished stroke");
assert.ok(map.includes('const wasPinching=e.pointerType==="touch"'),
 "Finishing a pinch must never persist a pencil stroke");
assert.ok(map.includes('contourLivePath.current.setAttribute("d",'),
 "The pencil must show an ink dot immediately on first contact");
assert.ok(map.includes('contourDrawing.current.push([last[0],last[1]])'),
 "A pencil tap without pointer movement must be saved as a round dot");
assert.ok(map.includes('const end=contourPoint(worldPoint(localPoint(e)))'),
 "The last pointer-up coordinate must be retained in the finished line");


// Real, persisted annotations; eraser gestures must NOT use the map pan path.
assert.ok(map.includes('const [paintColor,setPaintColor]=useState("#000000")'));
assert.ok(map.includes('const contourEraser=worksheetEditor&&contourAction==="erase"'));
assert.ok(map.includes('onPointerMove={objectMoveMode?undefined:contourEraser?moveContourErase:contourFreehand?moveContourStroke:'));
const eraserCode=map.slice(map.indexOf('const beginContourErase='),map.indexOf('const startContourMarkDrag='));
assert.ok(eraserCode.includes('setPointerCapture(e.pointerId)'));
assert.ok(eraserCode.includes('brushContour(e)'));
const penMove=map.slice(map.indexOf('const moveContourStroke='),map.indexOf('const endContourStroke='));
assert.ok(map.includes('className="lektrus-contour-ink-preview"'),
 "Contour editor must render a separate, non-interactive canvas ink preview");
assert.ok(map.includes('startContourCanvas("erase")')&&map.includes('startContourCanvas("pen")'),
 "Both pencil and eraser must use the fast preview surface");
assert.ok(map.includes('ctx.globalCompositeOperation=mode==="erase"?"destination-out":"source-over"'),
 "Eraser must cut the cached ink image without re-rendering the map");
assert.ok(penMove.includes('if(contourCanvasMode.current==="pen")')&&penMove.includes('paintContourPixel(e,"pen")'),
 "Pencil must update the new local segment rather than repeatedly reconstruct all points");
assert.ok(map.includes('const rect=contourCanvasBounds.current??mapSvgRef.current?.getBoundingClientRect()'),
 "Ink gesture coordinates must reuse cached bounds instead of forcing layout every event");
assert.ok(map.includes('setPendingInk(segments)')&&map.includes('if(pendingInk&&contourCanvasMode.current==="pen"'),
 "Canvas stays visible until optimistic pencil ink appears in SVG");
assert.ok(map.includes('if(liveErasedStrokes&&contourCanvasMode.current==="erase"'),
 "Canvas erasure stays visible until the persisted stroke preview is ready");
assert.ok(eraserCode.includes('eraseContourInkAlongPath(source,gesture.path,gesture.radius,'),
 "Eraser must cut drawn ink once, when the gesture finishes");
assert.ok(eraserCode.includes('contourPixelScale()*cameraRef.current.scale'),
 "Eraser stroke width must match the selected screen-pixel size at every zoom");
assert.ok(map.includes('mask={`url(#${contourInkMaskId})`}'),
 "Stroke-only live mask must avoid rerendering the full atlas for every eraser move");
assert.ok(map.includes('preview.setAttribute("d",'),
 "Eraser preview is updated directly via SVG, not React on every frame");
assert.ok(!map.includes('setLiveErasedStrokes(eraseContourInkAlongPath('),
 "Never recalculate complete stroke fragments for every pointer sample");
assert.ok(eraserCode.includes('setLiveErasedStrokes(erased)'),
 "Keep local optimistic ink visible until the realtime save is acknowledged");
assert.ok(!eraserCode.includes('contourMarks:')&&!eraserCode.includes('paintedCountries:'),
 "Eraser must not delete map marks or territory fills");
assert.ok(!eraserCode.includes('scheduleCamera('),"Eraser must not start ordinary map panning");
assert.ok(map.includes('if(pinch.current){clearErasePreview();stopContourCanvas();onMove(e);return}'),
 "Two fingers must navigate map without erasing ink");
assert.ok(map.includes('data-contour-fill-key={isWorksheet&&painted[fillKey]?fillKey:undefined}'));
assert.ok(map.includes('data-contour-fill-key={isWorksheet&&painted[key]?key:undefined}'));

assert.ok(map.includes('onPointerDown={e=>startContourMarkDrag(e,stored)}'));
assert.ok(map.includes('onPointerMove={moveContourMarkDrag}'));
assert.ok(map.includes('onPointerUp={e=>endContourMarkDrag(e)}'));
assert.ok(map.includes('moveContourMark(gesture.mark,gesture.start,point)'));
assert.ok(map.includes('lektrus-contour-label-background'));
const hitHelpers=fs.readFileSync(new URL("../src/lektrusContourInteractions.ts",import.meta.url),"utf8");
const helperJs=ts.transpileModule(hitHelpers,{compilerOptions:{
 module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022
}}).outputText;
const hitLib={};
new Function("exports",helperJs)(hitLib);
const movable={id:"city-label",kind:"label",text:"Пермь",lat:58,lon:56,color:"#000000"};
const line={id:"route-line",points:[[50,58],[60,58]],color:"#000000"};
const pt=(lon,lat)=>({x:(lon+180)*2.5,y:(90-lat)*2.5});
assert.deepEqual(hitLib.contourEraserHits([movable],[line],pt(56,58),1).marks,["city-label"]);
assert.deepEqual(hitLib.contourEraserHits([movable],[line],pt(55,58),5).strokes,["route-line"]);
assert.deepEqual(hitLib.contourEraserHits([movable],[line],pt(120,-30),5),
 {marks:[],strokes:[]});
const moved=hitLib.moveContourMark(movable,pt(56,58),pt(57,59));
assert.equal(moved.lon,57);
assert.equal(moved.lat,59);
assert.equal(movable.lon,56,"Dragging must not mutate persisted data");
assert.equal(hitLib.moveContourMark(movable,{x:0,y:0},{x:10000,y:10000}).lon,180);
const contourCss=fs.readFileSync(new URL("../src/lektrusAtlas.css",import.meta.url),"utf8");
assert.ok(!contourCss.includes('cursor:crosshair!important;'),
 "The selected eraser size must not be overridden with a generic crosshair");
assert.ok(map.includes('cursor:contourBrushCursor(contourAction,toolThickness,paintColor)'),
 "Ink tools use a real-size cursor like the main board");
assert.ok(contourCss.includes('.lektrus-contour-label-object.selected'));


// A dragged annotation stays at its final preview coordinates while the board
// persists the update. Reverting to its old saved position even for one frame
// causes a visible snap/blink during mouse and touch drags.
const markDragLogic=map.slice(map.indexOf('const startContourMarkDrag='),
 map.indexOf('const contourEraser='));
assert.ok(markDragLogic.includes('setPreviewContourMark(moved);'));
assert.ok(!markDragLogic.includes('markerGesture.current=null;setPreviewContourMark(null);'));
assert.ok(map.includes('persisted.lon===previewContourMark.lon&&persisted.lat===previewContourMark.lat'));
assert.ok(map.includes('const labelUiScale=1;'));
assert.ok(!map.includes('new ResizeObserver(measure)'),"User labels should follow the political atlas zoom, not board-object pixels");
assert.ok(map.includes('scale(${labelUiScale/scale})'));
assert.ok(map.includes('fontSize="7.4" stroke="#fff"'));
assert.ok(map.includes('strokeWidth="1.5"'),"Use political atlas font halo");
assert.ok(contourCss.includes('fill:transparent;fill-opacity:0;stroke:transparent'));
assert.ok(contourCss.includes('height:56px;min-height:56px'),
 "Selected label actions must occupy a stable height so touch selection does not shift the map");
assert.ok(map.includes('className="lektrus-contour-delete-mark"'));
assert.ok(map.includes('onClick={()=>deleteContourMark(selectedContourMark.id)}'));
assert.ok(map.includes('Нажмите на подпись, чтобы переместить или удалить её'));
assert.ok(contourCss.includes('min-height:44px'),"Mobile deletion must have a touch-sized button");
const labelHitPoint={...pt(56,58),x:pt(56,58).x+13};
assert.deepEqual(hitLib.contourEraserHits([movable],[],labelHitPoint,1,2).marks,["city-label"]);
assert.deepEqual(hitLib.contourEraserHits([movable],[],{...labelHitPoint,x:labelHitPoint.x+50},1,2).marks,[],
 "Eraser must follow compact political map label hit geometry");

// Editing markers are ordinary buttons, but resizing must never be treated
// as a click on the control strip. This previously disabled *all* handles.
assert.ok(application.includes('const transformHandle=target.closest("[data-transform-handle],[data-group-transform-handle],[data-connector-endpoint],[data-group-selection-drag],[data-board-selection-grip]")'));
assert.ok(application.includes('if(!transformHandle&&target.closest("button,input,select,textarea'));
assert.match(application,/gesture\.current\s*=\s*\{\s*pointer:\s*e\.pointerId,\s*mode:\s*transformHandle\s*===\s*"rotate"\s*\?\s*"rotate"\s*:\s*"resize"/);
const contourInkTs=fs.readFileSync(new URL("../src/lektrusContourInk.ts",import.meta.url),"utf8");
const inkEraserTs=fs.readFileSync(new URL("../src/inkEraser.ts",import.meta.url),"utf8");
const inkExports={};
new Function("exports",ts.transpileModule(inkEraserTs,{compilerOptions:{
 module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022
}}).outputText)(inkExports);
const contourInkExports={};
new Function("exports","require",ts.transpileModule(contourInkTs,{compilerOptions:{
 module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022
}}).outputText)(contourInkExports,()=>inkExports);
const testStroke={id:"line",color:"#000000",points:[[0,0],[10,0]]};
const worldPoint=(lon,lat)=>({x:(lon+180)*2.5,y:(90-lat)*2.5});
const split=contourInkExports.eraseContourInkAlongPath([testStroke],
 [worldPoint(5,-1),worldPoint(5,1)],3);
assert.ok(split.length>=2,"Partial eraser must retain segments on both sides");
assert.ok(split.some(stroke=>stroke.points.some(p=>p[0]<3)));
assert.ok(split.some(stroke=>stroke.points.some(p=>p[0]>7)));
assert.equal(contourInkExports.eraseContourInkAlongPath([testStroke],[worldPoint(40,40)],3)[0],testStroke,
 "Unbrushed strokes must retain their original data");
const screenSizedStroke={...testStroke,width:8};
const zoomAdjusted=contourInkExports.eraseContourInkAlongPath(
 [screenSizedStroke],[worldPoint(5,0)],.75,4);
assert.ok(zoomAdjusted.length>=2,"Eraser at atlas zoom cuts a local portion, not the whole line");
assert.ok(zoomAdjusted.every(line=>Math.abs(line.width-8)<.0001),
 "Clipped lines must preserve their original screen-pixel width");
assert.equal(contourInkExports.eraseContourInkAlongPath(
 [screenSizedStroke],[worldPoint(5,7)],.75,4)[0],screenSizedStroke,
 "A screen-sized eraser never erases remote ink due to a coordinate-scale mismatch");
assert.ok(map.includes('for(let offset=0;offset<points.length-1;offset+=249)'),
 "Long pencil strokes must be persisted in bounded segments");

const savedCamera={regionId:"world",scale:2.5,position:{x:150,y:-50}};
assert.equal(validAtlasDocument({...validWork,contourCamera:savedCamera}),true);
assert.equal(validAtlasDocument({...validWork,contourCamera:{...savedCamera,scale:-1}}),false);
assert.equal(validAtlasDocument({...validWork,contourCamera:{...savedCamera,position:{x:Infinity,y:0}}}),false);
assert.ok(map.includes('const stored=d.contourCamera'));
assert.ok(map.includes('stored?.regionId===regionId'));
assert.ok(map.includes('onChange({...d,contourCamera:{regionId,scale:camera.scale,position:{...camera.position}}})'));
assert.ok(map.includes('const worksheetEditor=isWorksheet&&editorMode'));
assert.ok(map.includes('const worksheetOnBoard=isWorksheet&&!editorMode'));
assert.ok(map.includes('const contourEraser=worksheetEditor&&contourAction==="erase"'));
const schoolEditor=fs.readFileSync(new URL("../src/LektrusSchoolDiagramEditor.tsx",import.meta.url),"utf8");
assert.ok(schoolEditor.includes('onSave({...item,schoolDiagram:structuredClone(draft),text:draft.title})'));
const app=fs.readFileSync(new URL("../src/BoardApp.tsx",import.meta.url),"utf8");
assert.ok(app.includes('if(isSchoolDiagramId(item.graphFigureId)){setSchoolEditorItem(item);return;}'));
assert.ok(app.includes('className="screen-transform-overlay"'));
assert.ok(app.includes('data-transform-handle={h}'));


// The compact teacher creation form shows a clean live map preview.
// Editing an existing worksheet is a fullscreen map, including for students.
assert.ok(schoolEditor.includes('if(isContour&&!existing&&draft.kind==="atlas")return createPortal('));
assert.ok(schoolEditor.includes('lektrus-contour-create-preview-map'));
assert.ok(schoolEditor.includes('<LektrusSchoolDiagramView diagram={draft}/>'));
assert.ok(schoolEditor.includes('studentMode?:boolean'));
assert.ok(schoolEditor.includes('!studentMode&&contourSettingsOpen&&<aside'));
assert.ok(schoolEditor.includes('if(isContour&&!existing&&draft.kind==="atlas")'));
assert.ok(schoolEditor.includes('if(isContour&&draft.kind==="atlas")return createPortal('));
assert.ok(application.includes('studentMode={isStudent&&schoolEditorItem.graphFigureId==="contour-atlas"}'));
assert.ok(application.includes('item.graphFigureId!=="contour-atlas"'));
assert.ok(application.includes('paintedCountries:next.schoolDiagram.paintedCountries'));
assert.ok(map.includes('function ContourToolIcon('));
assert.ok(map.includes('["select","Выбор",true]'));
assert.ok(map.includes('["hand","Рука",true]'));
assert.ok(map.includes('["pen","Карандаш",contourConfig.allowDrawing]'));
assert.ok(map.includes('["fill","Заливка",contourConfig.allowFill]'));
assert.ok(map.includes('["erase","Ластик",true]'));
assert.ok(map.includes('["label","Подпись / знак"'));
assert.ok(map.includes('aria-label="Тип обозначения"'));
assert.ok(map.includes('className="lektrus-atlas-territory-menu"'));
assert.ok(map.includes('onClick={()=>{changeRegion(region.id);setTerritoryMenuOpen(false)}'));
assert.ok(map.includes('lektrus-atlas-sidebar--selected-only'));
// The geographic atlas has a separate selected-object sidebar. Do not put
// geography-only settings inside the historical-only inspector again.
const geoInspectorStart=map.indexOf('!isWorksheet&&!historical&&<aside');
const historyInspectorStart=map.indexOf('!isWorksheet&&historical&&<aside',geoInspectorStart);
const geoInspector=map.slice(geoInspectorStart,historyInspectorStart);
assert.ok(geoInspector.includes('aria-label="Фильтр полезных ископаемых"'));
assert.ok(geoInspector.includes('school-mineral-reference'));
assert.ok(geoInspector.includes('role="status"'));
assert.ok(geoInspector.includes('Повторить загрузку каталогов'));
assert.ok(!map.slice(historyInspectorStart).includes('aria-label="Фильтр полезных ископаемых"'));
assert.ok(map.includes('if(value==="minerals")setInspectorOpen(true)'));
// A pupil cannot open teacher settings. Assignment text must be present in
// the shared fullscreen editor header, independently of that settings gate.
const contourEditorStart=schoolEditor.indexOf('if(isContour&&draft.kind==="atlas")return createPortal(');
const contourHeader=schoolEditor.slice(contourEditorStart,schoolEditor.indexOf('</header>',contourEditorStart));
assert.ok(contourHeader.includes('className="lektrus-contour-editor-task"'));
assert.ok(contourHeader.indexOf('{draft.contourTask?.trim()&&')<contourHeader.indexOf('{!studentMode&&'));
const atlasCss=fs.readFileSync(new URL("../src/lektrusAtlas.css",import.meta.url),"utf8");
assert.ok(atlasCss.includes('.lektrus-contour-icon-button'));
assert.ok(atlasCss.includes('.lektrus-atlas-territory-dropdown'));
const editorCss=fs.readFileSync(new URL("../src/lektrusAtlasEditor.css",import.meta.url),"utf8");
assert.ok(editorCss.includes('.lektrus-contour-create-preview-map'));

const studentBoard=fs.readFileSync(new URL("../src/BoardApp.tsx",import.meta.url),"utf8");
assert.ok(studentBoard.includes('(singleSelected.locked&&!contourWorksheet)'));
assert.ok(studentBoard.includes('item.locked&&item.graphFigureId!=="contour-atlas"'));
assert.ok(studentBoard.includes('studentMode={isStudent&&schoolEditorItem.graphFigureId==="contour-atlas"}'));
assert.ok(studentBoard.includes('contourMarks:next.schoolDiagram.contourMarks'));
assert.ok(studentBoard.includes('contourStrokes:next.schoolDiagram.contourStrokes'));
assert.ok(map.includes('aria-label="Инструменты контурной карты"'));
assert.ok(map.includes('<ContourToolIcon name={id}/>'));
assert.ok(map.includes('lektrus-atlas-territory-dropdown'));
assert.ok(map.includes('lektrus-atlas-sidebar--selected-only'));

// Date-precise flag audit: prevent unauthorised Red Ensign national flags and
// annual all-year claims for documented transitions or disputed colour variants.
const historicalInsigniaRaw=fs.readFileSync(new URL("../src/lektrusHistoricalInsignia.ts",import.meta.url),"utf8");
const historicalFlagModule={};
new Function("exports",ts.transpileModule(historicalInsigniaRaw,{compilerOptions:{
 module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022
}}).outputText)(historicalFlagModule);
for(const row of historicalFlagModule.historicalDatedNationalFlags.filter(row=>row.code==="CA"&&row.from<1965))
 assert.equal(historicalFlagModule.historicallyAttestedNationalFlag(row),false,"Red Ensign was not adopted as Canada's national flag");
assert.equal(historicalFlagModule.findHistoricalCountryFlag("CA",1964),undefined);
assert.ok(historicalFlagModule.findHistoricalCountryFlag("CA",1966));
for(const [code,year] of [["US",1959],["US",1960],["CA",1960],["CA",1965],
 ["CN",1949],["RO",1989],["BY",1995],["MK",1995],["BA",1998],
 ["GE",2004],["FR",1974],["FR",1975],["FR",1976]]){
 const review=historicalFlagModule.findHistoricalFlagReview(code,year);
 assert.ok(review&&review.note&&review.sourceUrl.startsWith("https://"),code+" "+year);
}
for(const [code,year] of [["US",1961],["CA",1966],["MK",1996],["BA",1999],
 ["GE",2005],["RO",1990],["FR",1977]]){
 assert.equal(historicalFlagModule.findHistoricalFlagReview(code,year),undefined);
}
for(const [id,year] of [["goryeo",1100],["safavid",1600],["rome",150],
 ["aztec",1500],["mali-empire",1325]]){
 assert.equal(historicalFlagModule.findHistoricalStateInsignia(id,year),undefined,"Do not show unverified historical picture as a state flag: "+id);
}
const countrySymbolsRaw=fs.readFileSync(new URL("../src/lektrusAtlasCountrySymbols.ts",import.meta.url),"utf8");
const countrySymbolModule={};
const knownCountryLabels={
 US:["United States","США"],CA:["Canada","Канада"],
 CN:["China","Китай"],RO:["Romania","Румыния"],
 BY:["Belarus","Беларусь"],MK:["North Macedonia","Северная Македония"],
 BA:["Bosnia and Herzegovina","Босния и Герцеговина"],
 GE:["Georgia","Грузия"],FR:["France","Франция"]
};
new Function("exports","require",ts.transpileModule(countrySymbolsRaw,{compilerOptions:{
 module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022
}}).outputText)(countrySymbolModule,(name)=>{
 if(name==="./regionDisplayNames")return {regionDisplayNames:(lang)=>({
  of:(code)=>knownCountryLabels[code]?.[lang==="ru"?1:0]??code
 })};
 if(name==="./lektrusHistoricalReferences")return {findHistoricalReference:()=>undefined};
 if(name==="./lektrusHistoricalInsignia")return historicalFlagModule;
 throw new Error("Unexpected country-symbol import: "+name);
});
for(const [code,raw,year] of [
 ["US","United States",1959],["US","United States",1960],
 ["CA","Canada",1960],["CA","Canada",1965],
 ["CN","People's Republic of China",1949],
 ["RO","Romania",1989],["BY","Belarus",1995],
 ["MK","North Macedonia",1995],["BA","Bosnia and Herzegovina",1998],
 ["GE","Georgia",2004],["FR","France",1975]
]){
 const feature={geometry:{type:"Polygon",coordinates:[]},
  properties:{NAME:raw,ISO_A2:code}};
 const symbol=countrySymbolModule.atlasCountrySymbol(feature,raw,year,true);
 assert.equal(symbol.kind,"symbol","Historical transition must not show single official flag: "+raw+" "+year);
 assert.ok(symbol.note.includes("Источник: https://"));
}
assert.equal(countrySymbolModule.atlasCountrySymbol({
 geometry:{type:"Polygon",coordinates:[]},properties:{NAME:"Canada",ISO_A2:"CA"}
},"Canada",1966,true).kind,"historic");

console.log("Lektrus atlas: consolidated map modes, universal coordinates, stable zoom, legacy map migration, and geodata tests passed.");
