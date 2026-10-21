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
new Function("exports","require","fetch","AbortController","setTimeout","clearTimeout",
 "URLSearchParams",compile("lektrusAtlasExternal.ts"))(
 external,schoolRequire,mockFetch,AbortController,setTimeout,clearTimeout,URLSearchParams);
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

// Different types in the same map cell must remain different school-atlas signs.
const adjacent=[
 {id:1,point:[100,100],commodity:{name:"Золото",color:"#222"},feature:{}},
 {id:2,point:[101,101],commodity:{name:"Медные руды",color:"#222"},feature:{}}
];
assert.equal(clustered.clusterMineralMapPoints(adjacent,1,"Все виды").length,2);
const dense=Array.from({length:12},(_,i)=>({
 id:i,point:[20+i*20,50],commodity:{name:"Золото",color:"#222"},feature:{}
}));
const sparse={id:999,point:[850,400],commodity:{name:"Золото",color:"#222"},feature:{}};
const fair=clustered.clusterMineralMapPoints([...dense,sparse],1,"Все виды",2);
assert.ok(fair.some(g=>g.point[0]===850),"Sparse continents must keep overview glyphs");

const mrds={};const mrdsNetwork=[];
const fakeMrdsFetch=async(url)=>{
 mrdsNetwork.push(url);
 const params=new URL(url).searchParams;
 const [west,south,east,north]=params.get("geometry").split(",").map(Number);
 assert.equal(params.get("outSR"),"4326");
 assert.ok(Number(params.get("resultRecordCount"))<=1200);
 return {ok:true,json:async()=>({features:[
  {attributes:{objectid_1:mrdsNetwork.length,dep_id:"D"+mrdsNetwork.length,
   code_list:"AU, FE",site_name:"Verified point"},
   geometry:{x:(west+east)/2,y:(south+north)/2}},
  {attributes:{objectid_1:-1,code_list:"LI"},geometry:{x:1,y:1}}
 ]})};
};
new Function("exports","fetch","AbortController","setTimeout","clearTimeout",
 "URLSearchParams",compile("lektrusAtlasMRDS.ts"))(
 mrds,fakeMrdsFetch,AbortController,setTimeout,clearTimeout,URLSearchParams);
const goldPoint={type:"Feature",geometry:null,properties:{ATLAS_DATASET:"MRDS",code_list:"AU, AG"}};
assert.equal(mrds.mrdsMineralCommodity(goldPoint)?.name,"Золото");
assert.equal(mrds.mrdsMineralCommodity({...goldPoint,properties:{ATLAS_DATASET:"MRDS",code_list:"AG"}}),null);
assert.equal(mrds.mrdsMineralCommodity({...goldPoint,properties:{ATLAS_DATASET:"MRDS",code_list:"PB, ZN"}})?.name,"Полиметаллические руды");
assert.equal(mrds.mrdsMineralCommodity({...goldPoint,properties:{ATLAS_DATASET:"MRDS",code_list:"CU2"}}),null);
const mrdsOverview=await mrds.loadMRDSWorldOverview();
assert.equal(mrdsNetwork.length,12,"MRDS must query all 12 world sectors");
assert.equal(mrdsOverview.features.length,12,"Each valid sector is retained");
assert.ok(mrdsOverview.features.every(f=>f.properties.ATLAS_DATASET==="MRDS"));
await mrds.loadMRDSWorldOverview();
assert.equal(mrdsNetwork.length,12,"World MRDS sample is cached");
const region=await mrds.loadMRDSRegionalDeposits({west:30,east:35,south:40,north:45});
assert.equal(region.features.length,1,"Non-school commodities never enter the mineral layer");
assert.equal(mrdsNetwork.length,13);
assert.equal((await mrds.loadMRDSRegionalDeposits({west:30,east:35,south:40,north:45})).features.length,1);
assert.equal(mrdsNetwork.length,13);
const stylesheet=fs.readFileSync(new URL("../src/lektrusAtlas.css",import.meta.url),"utf8");
assert.match(stylesheet,/g\\[role="button"\\]:focus\\{outline:none\\}/);
assert.match(map,/lektrus-atlas-user-pin/);
assert.match(map,/loadMRDSWorldOverview\\(/);

console.log("Atlas overview: six-world-zone USGS sampling, genuine mineral groups and city-political merger passed.");
