import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";
const compile=(file)=>ts.transpileModule(
 fs.readFileSync(new URL("../src/"+file,import.meta.url),"utf8"),
 {compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}
).outputText;
const clustered={};
new Function("exports",compile("lektrusAtlasMineralClusters.ts"))(clustered);
const example=[
 {id:1,point:[210,160],commodity:{name:"Золото",color:"#aa7"},feature:{id:1}},
 {id:2,point:[214,163],commodity:{name:"Золото",color:"#aa7"},feature:{id:2}},
 {id:3,point:[700,180],commodity:{name:"Медь",color:"#abc"},feature:{id:3}}
];
const overview=clustered.clusterMineralMapPoints(example,1,"Все виды");
assert.equal(overview.length,2);
assert.equal(overview[0].count,2);
assert.equal(overview[0].dominant,"Золото");
assert.equal(overview[0].representative.feature.id,1);
assert.equal(clustered.clusterMineralMapPoints(example,1,"Медь").length,1);
assert.equal(clustered.clusterMineralMapPoints(example,100,"Все виды").length,3);
const network=[];
const mockFetch=async(url)=>{
 network.push(url);
 const params=new URL(url).searchParams;
 assert.equal(params.get("resultRecordCount"),"350");
 assert.equal(params.get("outFields").includes("commodity"),true);
 assert.equal(params.get("outFields").includes("commod1"),false);
 const rect=params.get("geometry").split(",").map(Number);
 const [west,south,east,north]=rect;
 const x=(west+east)/2,y=(south+north)/2;
 return {ok:true,json:async()=>({features:[
  {attributes:{gid:network.length,commodity:"Gold",dep_name:"Sample from USGS"},
   geometry:{x,y}}]})};
};
const external={};
new Function("exports","fetch","AbortController","setTimeout","clearTimeout",
 "URLSearchParams",compile("lektrusAtlasExternal.ts"))(
 external,mockFetch,AbortController,setTimeout,clearTimeout,URLSearchParams);
const world=await external.loadWorldMineralOverview();
assert.equal(network.length,6,"World mineral samples should cover six actual source regions");
assert.equal(world.features.length,6);
assert.deepEqual(world.features.map(f=>f.geometry.type),Array(6).fill("Point"));
assert.equal((await external.loadWorldMineralOverview()).features.length,6);
assert.equal(network.length,6,"World overview must be cached");
const map=fs.readFileSync(new URL("../src/LektrusMapAtlas.tsx",import.meta.url),"utf8");
const model=fs.readFileSync(new URL("../src/lektrusAtlasModel.ts",import.meta.url),"utf8");
assert.match(map,/loadWorldMineralOverview\(/);
assert.match(map,/lektrus-atlas-mineral-clusters/);
assert.match(map,/localMineralDetail/);
assert.match(map,/citiesOn&&scale>=4\.2/);
assert.match(map,/citiesOn&&scale>=2\.5/);
assert.match(model,/mode==="coordinates"\|\|mode==="cities"\?"political"/);
assert.doesNotMatch(model,/\{id:"cities",title:"Города"/);
console.log("Atlas overview: six-world-zone USGS sampling, genuine mineral groups and city-political merger passed.");
