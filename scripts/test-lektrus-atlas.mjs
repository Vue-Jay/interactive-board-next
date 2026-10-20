import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";
const source=fs.readFileSync(new URL("../src/lektrusAtlasModel.ts",import.meta.url),"utf8");
const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const exports={};
new Function("exports",js)(exports);
const {
 atlasModes,atlasModesFor,historicalSnapshots,nearestSnapshotIndex,eventsNearYear,
 createAtlasDocument,validAtlasDocument,yearLabel
}=exports;
assert.deepEqual(atlasModes.map(m=>m.id),["political","contour","physical","hydrography","relief","cities","coordinates","historical","events"]);
assert.deepEqual(atlasModesFor("geography").map(m=>m.id),["political","contour","physical","hydrography","relief","cities","coordinates"]);
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
assert.match(map,/Административные единицы региона/);
assert.ok(map.includes("onChange?.({...d,mode:value})"));
assert.match(map,/paintRegions/);
assert.match(map,/Условные обозначения/);
assert.match(map,/landformClass/);
assert.match(map,/shownMarineNames/);
assert.match(map,/shownCities/);
assert.match(map,/admin-regional/);
assert.match(map,/rivers-regional/);
assert.match(map,/Регион школьного атласа/);
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
assert.match(map,/onPointerDown=\{objectMoveMode\?undefined:onPointerDown\}/);
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
assert.equal(geoExports.hasAtlasName(named({NAME:"Unknown"})),false);
assert.equal(places.russianPlaceName(named({NAME_RU:"Неизвестно"})),null);
assert.ok(!map.includes('!=="Объект без названия"'),"the UI must not use placeholder text");
for(const dataset of ["rivers","lakes","administrative","regions","glaciers","marine","physicalLabels","elevations"])
 assert.ok(map.includes(dataset+"?.features.filter(hasAtlasName)"),
  "the "+dataset+" map layer must omit every unnamed feature");
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

assert.match(map,/Math\.log2\(scale\)/);
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
assert.ok(map.includes('strokeWidth={atlasRiverStroke(l.feature,mode==="hydrography")}'));
assert.ok(map.includes('className="lektrus-atlas-water-feature lektrus-atlas-river"'));
assert.ok(map.includes('strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke"'));
assert.ok(map.includes('strokeWidth="8"'),"thin rivers need an invisible mobile-friendly hit area");
assert.ok(map.includes('className="lektrus-atlas-river-ink" pointerEvents="none"'));
assert.match(map,/stroke="none"\s*className="lektrus-atlas-landform"/);
assert.ok(map.includes("rivers-ultra")&&map.includes("lakes-ultra"));
assert.ok(data.includes("ne_10m_rivers_lake_centerlines.geojson"));
assert.ok(data.includes("ne_10m_lakes.geojson"));
assert.ok(!map.includes('strokeWidth={mode==="hydrography"?1.4:.9}'));
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
console.log("Lektrus atlas: five geography modes and two historical modes on one land/coastline foundation, with coordinates, persistence, and antimeridian tests.");
