import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";

const source=fs.readFileSync(new URL("../src/lektrusAtlasModel.ts",import.meta.url),"utf8");
const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const model={};
new Function("exports",js)(model);
const {atlasModes,geographyMapModes,historyMapModes,atlasModesForScope,getAtlasScope,
 historicalSnapshots,nearestSnapshotIndex,eventsNearYear,
 createAtlasDocument,validAtlasDocument,yearLabel}=model;

assert.deepEqual(geographyMapModes.map(m=>m.id),
 ["political","physical","hydrography","coordinates","contour"]);
assert.deepEqual(historyMapModes.map(m=>m.id),["historical","events"]);
assert.equal(atlasModes.length,7);
assert.deepEqual(atlasModesForScope("history"),historyMapModes);
assert.ok(!geographyMapModes.some(m=>m.id==="historical"||m.id==="events"));
assert.ok(!historyMapModes.some(m=>m.id==="political"));

assert.ok(historicalSnapshots.length>=50,"historical atlas should have dated source coverage");
assert.equal(new Set(historicalSnapshots.map(v=>v.year)).size,historicalSnapshots.length);
assert.ok(historicalSnapshots.every((v,i)=>i===0||v.year>historicalSnapshots[i-1].year));
assert.equal(historicalSnapshots.find(v=>v.year===1914)?.file,"world_1914.geojson");
assert.equal(historicalSnapshots.find(v=>v.year===1945)?.file,"world_1945.geojson");
assert.equal(historicalSnapshots.find(v=>v.year===-323)?.file,"world_bc323.geojson");
assert.equal(yearLabel(-323),"323 г. до н. э.");
assert.equal(yearLabel(1914),"1914 г.");
assert.equal(historicalSnapshots[nearestSnapshotIndex(1916)].year,1914);
assert.ok(eventsNearYear(1914).some(v=>v.year===1914));

const geo=createAtlasDocument();
const hist=createAtlasDocument("history");
assert.equal(geo.scope,"geography");
assert.equal(hist.scope,"history");
assert.equal(getAtlasScope(hist),"history");
assert.equal(getAtlasScope(geo),"geography");
assert.equal(validAtlasDocument(geo),true);
assert.equal(validAtlasDocument(hist),true);
for(const mode of geographyMapModes.map(v=>v.id))
 assert.equal(validAtlasDocument({...geo,mode}),true);
for(const mode of historyMapModes.map(v=>v.id))
 assert.equal(validAtlasDocument({...hist,mode}),true);
assert.equal(validAtlasDocument({...geo,mode:"historical"}),false);
assert.equal(validAtlasDocument({...hist,mode:"political"}),false);
assert.equal(validAtlasDocument({...geo,scope:undefined,mode:"historical"}),true,
 "legacy maps must keep historic mode");
assert.equal(validAtlasDocument({...hist,scope:undefined,mode:"political"}),true,
 "legacy maps must keep modern mode");
assert.equal(getAtlasScope({...hist,scope:undefined}),"history");

assert.equal(validAtlasDocument({...hist,year:1917}),false,"no fictional intermediate borders");
assert.equal(validAtlasDocument({...geo,mode:"fictitious"}),false);
assert.equal(validAtlasDocument({...geo,markers:[{id:"a",title:"Точка",lat:55.7,lon:37.6,
 year:1914,description:"Пояснение"}]}),true);
assert.equal(validAtlasDocument({...geo,markers:[{id:"a",title:"Ошибка",lat:180,lon:37.6,
 year:1914,description:""}]}),false);
assert.equal(validAtlasDocument({...geo,markers:Array.from({length:41},(_,i)=>({
 id:String(i),title:"Метка",lat:0,lon:0,year:1914,description:""
}))}),false);

const map=fs.readFileSync(new URL("../src/LektrusMapAtlas.tsx",import.meta.url),"utf8");
const base=fs.readFileSync(new URL("../src/LektrusMapBase.tsx",import.meta.url),"utf8");
const data=fs.readFileSync(new URL("../src/lektrusAtlasData.ts",import.meta.url),"utf8");
const reg=fs.readFileSync(new URL("../src/lektrusSubjectToolRegistry.ts",import.meta.url),"utf8");
const editor=fs.readFileSync(new URL("../src/LektrusMapAtlasControls.tsx",import.meta.url),"utf8");
for(const marker of [/loadHistoricalSnapshot/,/input aria-label="Исторический период"/,
 /summariseNamedChanges/,/Исторический обзор/,/приблизительными/,/Карта недоступна/,/licenseUrl/,
 /LektrusMapBase land=\{baseLand\}/,/atlasModesForScope/,/loadAtlasLayer\("land"\)/,
 /loadAtlasLayer\("coastline"\)/,/pickCoordinates/]){
 assert.match(map,marker);
}
assert.match(base,/className="lektrus-atlas-base-land"/);
assert.match(base,/className="lektrus-atlas-base-coast"/);
assert.match(base,/mapFeaturePath/);
assert.match(data,/ne_110m_land.geojson/);
assert.match(data,/ne_110m_coastline.geojson/);
assert.match(data,/raw\.githubusercontent\.com/);
assert.match(data,/BORDERPRECISION/);
assert.match(editor,/atlasModesForScope/);
assert.match(reg,/id:"geo-atlas"/);
assert.match(reg,/id:"history-atlas"/);
assert.match(reg,/subjects:\["география"\]/);
assert.match(reg,/subjects:\["история"\]/);
assert.ok(!reg.includes('id:"maps-atlas",label:'),"old atlas must not clutter subject menus");
console.log("Shared map foundation: one coast and land substrate, 5 geography modes, 2 history modes, 54 snapshots, backward compatible.");
