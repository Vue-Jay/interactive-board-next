import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";
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
 ["Lead","Полиметаллические руды"],["Zinc","Полиметаллические руды"],
 ["Apatite","Апатиты"],["Phosphate","Фосфориты"],
 ["Gold","Золото"],["Iron","Железные руды"],["Bauxite","Алюминиевые руды"],
 ["Copper","Медные руды"],["Mercury","Ртутные руды"],["Graphite","Графит"]
]){
 assert.equal(externalExports.mineralCommodity({properties:{commodity:raw},geometry:null})?.name,
  schoolName,raw+" should receive the appropriate school-atlas glyph");
}
assert.equal(externalExports.mineralDepositFacts(copperDeposit).find(x=>x.label==="Генетический тип")?.value,"Гидротермальное");
assert.equal(externalExports.mineralDepositSource({properties:{url:"http://unknown.example/"} ,geometry:null}),null);
const guideSource=fs.readFileSync(new URL("../src/lektrusAtlasMineralGuide.ts",import.meta.url),"utf8");
const mineralGuides={};
new Function("exports",ts.transpileModule(guideSource,{compilerOptions:{
 module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(mineralGuides);
assert.ok(mineralGuides.mineralGuides.length>=14);
assert.equal(mineralGuides.mineralGuide("Железные руды")?.uses,"Получение железа и стали");
const areaSource=fs.readFileSync(new URL("../src/lektrusAtlasCityArea.ts",import.meta.url),"utf8");
const cityAreaExports={};
new Function("exports",ts.transpileModule(areaSource,{compilerOptions:{
 module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(cityAreaExports);
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
const appBootstrap=fs.readFileSync(new URL("../src/main.tsx",import.meta.url),"utf8");
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
const symbols={},historicalSymbols={},historicalReferences={};
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
assert.equal(symbols.atlasCountrySymbol(symbolCountry("Roman Empire"),"Римская империя",100,true).kind,"symbol");
assert.match(symbols.atlasCountrySymbol(symbolCountry("Ottoman Empire"),"Османская империя",1900,true).imageUrl??"",
 /Ottoman/,"Use the attested Ottoman flag only for the late period");
assert.equal(symbols.atlasCountrySymbol(symbolCountry("Ottoman Empire"),"Османская империя",1600,true).kind,"symbol",
 "Do not assign the 1844 Ottoman flag to the sixteenth century");
assert.match(symbols.atlasCountrySymbol(symbolCountry("Qing dynasty"),"Империя Цин",1900,true).imageUrl??"",
 /China/,"Late Qing dragon flag should appear in relevant year");
assert.equal(symbols.atlasCountrySymbol(symbolCountry("Qing dynasty"),"Империя Цин",1700,true).kind,"symbol",
 "Do not assign a late Qing flag to 1700");
assert.match(symbols.atlasCountrySymbol(symbolCountry("German Democratic Republic"),"ГДР",1980,true).imageUrl??"",
 /German%20Democratic%20Republic/,"Historic GDR flag should be used for 1980");
assert.match(symbols.atlasCountrySymbol(symbolCountry("Soviet Union"),"СССР",1940,true).imageUrl??"",
 /1924/,"Use the documented early USSR flag for the 1940 period");
assert.match(symbols.atlasCountrySymbol(symbolCountry("Soviet Union"),"СССР",1980,true).imageUrl??"",
 /Soviet%20Union/,"Flag of the USSR must be visible for 1980");
assert.match(symbols.atlasCountrySymbol(symbolCountry("Soviet Union"),"СССР",1965,true).imageUrl??"",
 /dark%20version/,"Use the dated 1955-1980 USSR flag");
assert.match(symbols.atlasCountrySymbol(symbolCountry("Republic of Venice"),"Венеция",1600,true).imageUrl??"",
 /Republic%20of%20Venice/,"Include reconstructed heraldic imagery only for the attested polity");
assert.match(symbols.atlasCountrySymbol(symbolCountry("Safavid Empire"),"Держава Сефевидов",1600,true).imageUrl??"",
 /Safavid%20Flag/,"Safavid-era banner is documented");
assert.equal(symbols.atlasCountrySymbol(symbolCountry("Mughal Empire"),"Империя Великих Моголов",1700,true).reconstruction,
 true,"Reconstructed Mughal banner must be described as a reconstruction");

assert.equal(symbols.atlasCountrySymbol(symbolCountry("Kingdom of Venice"),"Венеция",1600,true).kind,"symbol",
 "Never infer the Venetian symbol from an unrelated unknown name");
assert.ok(historicalSymbols.historicalStateInsignia.length>=30,"Curated historical emblems remain available");
assert.ok(historicalSymbols.historicalDatedNationalFlags.length>=95,
 "Dated flags must cover more than one recent atlas period");
for(const row of [...historicalSymbols.historicalStateInsignia,...historicalSymbols.historicalDatedNationalFlags]){
 assert.ok(row.from<=row.to&&(row.file.endsWith(".svg")||row.file.endsWith(".png")),
  "Historical source image requires a valid period and file: "+row.file);
 assert.ok(historicalSymbols.historicalInsigniaSourceUrl(row.file).startsWith("https://commons.wikimedia.org/wiki/File:"));
}

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
assert.match(map,/Исторический справочник/);
assert.match(map,/могут быть приблизительными/);
assert.match(map,/Карта недоступна/);
assert.match(map,/licenseUrl/);
assert.match(data,/raw\.githubusercontent\.com/);
assert.match(data,/BORDERPRECISION/);
for(const name of ["countries-detail","cities","elevation","regions","glaciers","land","coastline"])
 assert.ok(data.includes(name),"real map dataset "+name);
for(const mode of ["hydrography","relief","cities","coordinates"])
 assert.equal(validAtlasDocument({...atlas,mode}),true);
assert.ok(map.includes('onPointerDown={objectMoveMode?undefined:contourEraser?beginContourErase:contourFreehand?beginContourStroke:'));
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
new Function("exports","require",geoJs)(geoExports,()=>({historicalSnapshots}));
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
const application=fs.readFileSync(new URL("../src/App.tsx",import.meta.url),"utf8");
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
assert.ok(contourFormBranch.includes('<LektrusSchoolDiagramView diagram={draft} onChange={set} editorMode/>'));
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
const boardSettings=fs.readFileSync(new URL("../src/App.tsx",import.meta.url),"utf8");
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
assert.ok(map.includes('if(!objectMoveMode)e.stopPropagation()'),
 "Only intentional map-edit mode stops board pointer events");
assert.ok(map.includes('onPointerDown={objectMoveMode?undefined:contourEraser?beginContourErase:contourFreehand?beginContourStroke:'));
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
assert.ok(application.includes('target.closest(".lektrus-atlas:not(.lektrus-atlas--board-selection)")'),
 "Native board wheel handler must not zoom/pan when zooming the map");
const wheelGuard=application.slice(
 application.indexOf('if(target.closest(".lektrus-atlas:not(.lektrus-atlas--board-selection)"))'),
 application.indexOf('if (target.closest("textarea"))'));
assert.ok(wheelGuard.includes('e.preventDefault();')&&wheelGuard.includes('return;'));
const boardCapture=application.slice(application.indexOf('onPointerDownCapture={(e) => {'),
 application.indexOf('onPointerMoveCapture={(e) => {'));
assert.ok(boardCapture.includes('.lektrus-atlas:not(.lektrus-atlas--board-selection)'));
assert.ok(boardCapture.indexOf('.lektrus-atlas:not(.lektrus-atlas--board-selection)')<
 boardCapture.indexOf('touchStart(e)'),
 "Atlas touch guard must run before the board records any touchpoints");
assert.ok(map.includes('onPointerMove={e=>{if(!objectMoveMode)e.stopPropagation()}'));
assert.ok(map.includes('onPointerCancel={e=>{if(!objectMoveMode)e.stopPropagation()}'));
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


// Real, persisted annotations; eraser gestures must NOT use the map pan path.
assert.ok(map.includes('const [paintColor,setPaintColor]=useState("#000000")'));
assert.ok(map.includes('const contourEraser=worksheetEditor&&contourAction==="erase"'));
assert.ok(map.includes('onPointerMove={objectMoveMode?undefined:contourEraser?moveContourErase:contourFreehand?moveContourStroke:'));
const eraserCode=map.slice(map.indexOf('const beginContourErase='),map.indexOf('const startContourMarkDrag='));
assert.ok(eraserCode.includes('setPointerCapture(e.pointerId)'));
assert.ok(map.includes('contourEraserHits('));
assert.ok(eraserCode.includes('brushContour(e)'));

assert.ok(eraserCode.includes('onChange?.({...d,contourMarks:'));
assert.ok(eraserCode.includes('eraseContourInkAlongPath(contourStrokes,gesture.path,12/cameraRef.current.scale)'));
assert.ok(map.includes('contourEraserPreview.current?.setAttribute("d",gesture.path.map('));
assert.ok(!eraserCode.includes('scheduleCamera('),"Eraser must never pan or zoom");
assert.ok(eraserCode.includes('gesture.fills.size'),"Eraser must remove territory colour");
assert.ok(eraserCode.includes('paintedCountries:Object.fromEntries'));
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
assert.ok(contourCss.includes('.lektrus-atlas--erasing .lektrus-atlas-svg'));
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
assert.ok(application.includes('const transformHandle=target.closest("[data-transform-handle],[data-group-transform-handle],[data-connector-endpoint]")'));
assert.ok(application.includes('if(!transformHandle&&target.closest("button,input,select,textarea'));
assert.ok(application.includes('gesture.current = {\n        pointer: e.pointerId,\n        mode: transformHandle === "rotate" ? "rotate" : "resize"'));
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
const app=fs.readFileSync(new URL("../src/App.tsx",import.meta.url),"utf8");
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
const atlasCss=fs.readFileSync(new URL("../src/lektrusAtlas.css",import.meta.url),"utf8");
assert.ok(atlasCss.includes('.lektrus-contour-icon-button'));
assert.ok(atlasCss.includes('.lektrus-atlas-territory-dropdown'));
const editorCss=fs.readFileSync(new URL("../src/lektrusAtlasEditor.css",import.meta.url),"utf8");
assert.ok(editorCss.includes('.lektrus-contour-create-preview-map'));

const studentBoard=fs.readFileSync(new URL("../src/App.tsx",import.meta.url),"utf8");
assert.ok(studentBoard.includes('(singleSelected.locked&&!contourWorksheet)'));
assert.ok(studentBoard.includes('item.locked&&item.graphFigureId!=="contour-atlas"'));
assert.ok(studentBoard.includes('studentMode={isStudent&&schoolEditorItem.graphFigureId==="contour-atlas"}'));
assert.ok(studentBoard.includes('contourMarks:next.schoolDiagram.contourMarks'));
assert.ok(studentBoard.includes('contourStrokes:next.schoolDiagram.contourStrokes'));
assert.ok(map.includes('aria-label="Инструменты контурной карты"'));
assert.ok(map.includes('<ContourToolIcon name={id}/>'));
assert.ok(map.includes('lektrus-atlas-territory-dropdown'));
assert.ok(map.includes('lektrus-atlas-sidebar--selected-only'));
console.log("Lektrus atlas: consolidated map modes, universal coordinates, stable zoom, legacy map migration, and geodata tests passed.");
