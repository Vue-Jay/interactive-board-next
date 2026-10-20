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
assert.match(map,/shownRiverNames/);
assert.match(map,/Административные единицы региона/);
assert.match(map,/onChange\\?\\.\\(\\{\\.\\.\\.d,mode:value\\}\\)/);
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
assert.match(map,/tinyPoints\.map/);
assert.match(map,/Math\.log2\(scale\)/);
assert.equal(validAtlasDocument({...atlas,borderView:"source"}),true);
assert.equal(validAtlasDocument({...atlas,borderView:"russian"}),true);
assert.equal(validAtlasDocument({...atlas,borderView:"invalid"}),false);
const geoJs=ts.transpileModule(data,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const geoExports={};
new Function("exports","require",geoJs)(geoExports,()=>({historicalSnapshots}));
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
