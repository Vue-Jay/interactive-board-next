import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";

const source=fs.readFileSync(new URL("../src/lektrusAtlasLabels.ts",import.meta.url),"utf8");
const moduleSource=ts.transpileModule(source,{compilerOptions:{
 module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const api={};
new Function("exports",moduleSource)(api);
const {schoolCountryName,layoutAtlasLabels}=api;
const aliases=[
 ["Китайская Народная Республика","Китай"],
 ["Демократическая Республика Конго","ДР Конго"],
 ["Республика Конго","Конго"],
 ["Российская Федерация","Россия"],
 ["Соединённые Штаты Америки","США"],
 ["Соединённое Королевство Великобритании и Северной Ирландии","Великобритания"],
 ["Корейская Народно-Демократическая Республика","КНДР"],
 ["Республика Корея","Южная Корея"],
 ["Объединённые Арабские Эмираты","ОАЭ"],
 ["Центральноафриканская Республика","ЦАР"]
];
for(const [full,short] of aliases)assert.equal(schoolCountryName(full),short);
assert.equal(schoolCountryName("Неизвестное историческое княжество"),"Неизвестное историческое княжество");
assert.equal(schoolCountryName("Доминиканская Республика"),"Доминиканская Республика");
assert.equal(schoolCountryName("Китай", "CN"),"Китай");
assert.equal(schoolCountryName("Конго", "CD"),"ДР Конго");
const label=(id,text,x,y,priority=0)=>({id,kind:"country",text,x,y,priority,fontSize:12,align:"middle"});
const pair=[
 label("china","Китай",200,200,0),
 label("other","ДР Конго",218,200,1),
 label("far","Россия",470,190,2)
];
const placed=layoutAtlasLabels(pair,1,10);
assert.deepEqual(placed.map(x=>x.id),["china","far"],
 "Closely placed geographic names must never overlap");
const zoomed=layoutAtlasLabels(pair,4,10);
assert.equal(zoomed.length,3,"Nearby labels become available as students zoom in");
const moved=[...pair].map(x=>({...x,x:x.x+20,y:x.y+20}));
assert.deepEqual(layoutAtlasLabels(moved,1,10).map(x=>x.id),placed.map(x=>x.id),
 "Simple panning must not reorder visible labels");
const mixed=[
 {...label("country","Китай",240,160,0),kind:"country"},
 {...label("capital","Пекин",243,159,1),kind:"capital",align:"start",dx:6,dy:-5}
];
assert.equal(layoutAtlasLabels(mixed,1).length,1,"Country and capital text share collision space");
const many=Array.from({length:8000},(_,i)=>
 label("place-"+i,"Тестовый объект "+i,40+(i%180)*4,40+Math.floor(i/180)*4,i));
const t=performance.now();
const selected=layoutAtlasLabels(many,1,130);
const elapsed=performance.now()-t;
assert.ok(selected.length<=130&&selected.length>0);
assert.ok(elapsed<4000,"Thousands of features should be laid out efficiently: "+elapsed.toFixed(1)+" ms");
const map=fs.readFileSync(new URL("../src/LektrusMapAtlas.tsx",import.meta.url),"utf8");
assert.match(map,/schoolCountryName\(direct/);
assert.match(map,/layoutAtlasLabels\(candidates,scale/);
assert.match(map,/className="lektrus-atlas-map-labels"/);
assert.match(map,/requestAnimationFrame/);
assert.match(map,/shapeAnchors=useMemo/);
assert.match(map,/auxiliaryDetailZoom/);
assert.doesNotMatch(map,/lake-label-/);
console.log("Atlas labels: compact Russian names, shared no-overlap layout, zoom density and optimized map rendering passed.");
