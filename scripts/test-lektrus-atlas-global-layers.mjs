import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";

const load=(filename,globals={})=>{
 const source=fs.readFileSync(new URL("../src/"+filename,import.meta.url),"utf8");
 const transpiled=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,
  module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;
 const exports={};
 new Function("exports",...Object.keys(globals),transpiled)(exports,...Object.values(globals));
 return exports;
};
const {politicalAtlasPalette,colorPoliticalCountries}=load("lektrusAtlasPoliticalColors.ts");
const square=(id,x,y)=>({type:"Feature",properties:{ADM0_A3:id},
 geometry:{type:"Polygon",coordinates:[[[x,y],[x+1,y],[x+1,y+1],[x,y+1],[x,y]]]}});
const countries=[square("AAA",0,0),square("BBB",1,0),square("CCC",2,0),square("DDD",7,6)];
const colors=colorPoliticalCountries(countries);
assert.equal(colors.length,4);
assert.ok(politicalAtlasPalette.includes(colors[0]));
assert.notEqual(colors[0],colors[1],"countries sharing a border need different colors");
assert.notEqual(colors[1],colors[2],"second adjacent border must differ");
assert.deepEqual(colorPoliticalCountries(countries),colors,"colors are stable across redraws");
const bounds={west:30,south:55,east:31,north:56};
let queried="";
const fetch=async(url)=>{
 queried=url;
 return {ok:true,json:async()=>({elements:[
  {type:"relation",id:23,tags:{"boundary":"administrative",admin_level:"8","name:ru":"Тестовый город"},
   members:[{type:"way",role:"outer",geometry:[{lon:30.1,lat:55.1},
    {lon:30.4,lat:55.1},{lon:30.4,lat:55.4},{lon:30.1,lat:55.1}]}]},
  {type:"way",id:24,tags:{place:"town",name:"Test town"},
   geometry:[{lon:30.5,lat:55.4},{lon:30.8,lat:55.4},{lon:30.8,lat:55.6},{lon:30.5,lat:55.4}]}
 ]})};
};
const external=load("lektrusAtlasExternal.ts",{fetch,AbortController,setTimeout,clearTimeout,URLSearchParams});
assert.equal(external.canLoadCityBoundaries(bounds),true);
assert.equal(external.canLoadCityBoundaries({west:-180,east:180,south:-85,north:85}),false);
const worldwideSample={west:-15,east:12,south:39,north:54};
const tiles=external.atlasOSMCoverageTiles(worldwideSample,"city-boundaries");
assert.ok(tiles.length>=2&&tiles.length<=12,"city boundaries should load in bounded viewport tiles");
assert.ok(tiles.every(tile=>tile.east>tile.west&&tile.north>tile.south));
assert.equal(external.atlasOSMCoverageTiles({west:-180,east:180,south:-85,north:85},"roads").length,0,
 "do not query worldwide geometry in a single Overpass call");
assert.ok(external.atlasOSMCoverageTiles({west:1,east:35,south:38,north:59},"roads").length>0);
const shiftedA=external.atlasOSMCoverageTiles({west:30.2,east:31.1,south:55.1,north:55.8},"city-boundaries");
const shiftedB=external.atlasOSMCoverageTiles({west:30.3,east:31.2,south:55.2,north:55.9},"city-boundaries");
assert.deepEqual(shiftedA,shiftedB,"small map drags within one OSM tile must reuse its cached data");
const collection=await external.loadCityBoundaries(bounds);
assert.equal(collection.features.length,2);
assert.equal(collection.features[0].properties.NAME_RU,"Тестовый город");
assert.equal(collection.features[0].geometry.type,"LineString");
assert.equal(collection.features[1].properties.NAME_RU,"");
assert.match(queried,/relation/);
assert.equal((await external.loadCityBoundaries(bounds)).features.length,2,"viewport queries are cached");
const map=fs.readFileSync(new URL("../src/LektrusMapAtlas.tsx",import.meta.url),"utf8");
assert.match(map,/politicalColors\[s\.i\]/);
assert.match(map,/cityBoundaryPaths\.map/);
assert.match(map,/loadAtlasOSMCoverage\(externalBounds,"roads"\)/);
assert.match(map,/loadAtlasOSMCoverage\(externalBounds,"city-boundaries"\)/);
assert.match(map,/cityBoundaryError/);
assert.match(map,/LektrusMineralSymbol name=/);
assert.match(map,/mineralMapSymbol\(item\.commodity\.name\)/);
const basemap=fs.readFileSync(new URL("../src/LektrusMapBase.tsx",import.meta.url),"utf8");
assert.match(basemap,/theme==="minerals"/);
assert.match(map,/citiesOn&&scale>=2\.5/);
assert.match(map,/rivers-ultra/);
assert.match(map,/cls==="motorway"\?1\.65/,"motorways must stand out against ordinary roads");
const legend=fs.readFileSync(new URL("../src/lektrusAtlas.css",import.meta.url),"utf8");
assert.match(legend,/\.lektrus-atlas-natural-legend>\.lektrus-atlas-mineral-legend/);
assert.match(legend,/grid-template-columns:minmax\(0,1fr\)/,"mineral names must not become vertical letters");
assert.match(map,/lektrus-atlas-mineral-clusters/);
console.log("Atlas improvements: neighboring country colors, worldwide OSM city boundaries, mineral signs and map layers passed.");
