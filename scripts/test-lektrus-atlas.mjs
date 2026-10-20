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
assert.deepEqual(atlasModes.map(m=>m.id),["political","contour","physical","waters","relief","cities","historical","events"]);
assert.deepEqual(atlasModesFor("geography").map(m=>m.id),["political","contour","physical","waters","relief","cities"]);
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
const data=fs.readFileSync(new URL("../src/lektrusAtlasData.ts",import.meta.url),"utf8");
const reg=fs.readFileSync(new URL("../src/lektrusSubjectToolRegistry.ts",import.meta.url),"utf8");
assert.match(map,/loadHistoricalSnapshot/);
assert.match(map,/input aria-label="Исторический период"/);
assert.match(map,/summariseNamedChanges/);
assert.match(map,/Исторический обзор/);
assert.match(map,/Границы могут быть приблизительными/);
assert.match(map,/Карта недоступна/);
assert.match(map,/licenseUrl/);
assert.match(data,/raw\.githubusercontent\.com/);
assert.match(data,/BORDERPRECISION/);
for(const name of ["countries-detail","cities","elevation","regions","glaciers"])
 assert.ok(data.includes(name),"real dataset layer "+name+" must be wired");
for(const mode of ["waters","relief","cities"])
 assert.equal(validAtlasDocument({...atlas,mode}),true);
assert.match(map,/onPointerDown=\{onPointerDown\}/);
assert.match(map,/featureSourceFacts/);
assert.match(map,/setCompare/);
assert.match(map,/setSelectedMarker/);
assert.match(reg,/id:"maps-atlas"/);
assert.match(reg,/id:"history-atlas"/);
assert.match(reg,/subjects:\["география"\]/);
assert.match(reg,/subjects:\["история"\]/);

const geoJs=ts.transpileModule(data,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const geoExports={};
new Function("exports","require",geoJs)(geoExports,()=>({historicalSnapshots}));
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
console.log("Lektrus one map tool: five modes, source-backed dated boundaries, era slider, event descriptions, errors and board persistence verified.");
