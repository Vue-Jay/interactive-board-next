import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";
const read=(file)=>fs.readFileSync(new URL("../src/"+file,import.meta.url),"utf8");
const mod={};
new Function("exports",ts.transpileModule(read("lektrusGeographyTrainingModel.ts"),{compilerOptions:{
 target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS
}}).outputText)(mod);
const {geoCountries,geoRegions,geoPair,getGeoCountry,makeGeoTraining,
 validGeoTraining,sampleGeoCountries}=mod;
assert.ok(geoCountries.length>=180,"Country catalogue should cover most school atlas nations");
assert.equal(new Set(geoCountries.map(c=>c.code)).size,geoCountries.length);
assert.equal(geoRegions.length,5);
for(const country of geoCountries){
 assert.match(country.code,/^[A-Z]{2}$/);
 assert.ok(country.name.length>1&&country.capital.length>2);
 assert.ok(geoRegions.includes(country.region));
}
for(const [code,capital] of [
 ["RU","Москва"],["KZ","Астана"],["TZ","Додома"],["BJ","Порто-Ново"],
 ["GQ","Сьюдад-де-ла-Пас"],["US","Вашингтон"],["FR","Париж"]
])assert.equal(getGeoCountry(code).capital,capital,code);
for(const exercise of ["matching","cards"]){
 const d=makeGeoTraining(exercise);
 assert.equal(validGeoTraining(d),true);
 assert.equal(d.reverse,false);
 assert.equal(d.relation,"flag-country");
 assert.equal(validGeoTraining({...d,relation:"country-capital",reverse:true}),true);
 assert.equal(validGeoTraining({...d,relation:"outline-country",reverse:true}),true);
 assert.equal(validGeoTraining({...d,countryCodes:["RU","RU"]}),false);
 assert.equal(validGeoTraining({...d,countryCodes:["XX","US"]}),false);
 assert.equal(validGeoTraining({...d,countryCodes:["RU"]}),false);
 assert.equal(validGeoTraining({...d,countryCodes:geoCountries.slice(0,13).map(c=>c.code)}),false);
}
assert.deepEqual(geoPair(getGeoCountry("FR"),"flag-country"),{left:"flag",right:"Франция"});
assert.deepEqual(geoPair(getGeoCountry("FR"),"country-capital"),{left:"Франция",right:"Париж"});
assert.deepEqual(geoPair(getGeoCountry("FR"),"outline-country"),{left:"outline",right:"Франция"});
for(const region of ["Все",...geoRegions])for(const count of [2,6,12]){
 const codes=sampleGeoCountries(region,count);
 assert.equal(codes.length,count);
 assert.equal(new Set(codes).size,count);
 if(region!=="Все")assert.ok(codes.every(code=>getGeoCountry(code).region===region));
}
const registry=read("lektrusSubjectToolRegistry.ts"),editor=read("LektrusSchoolDiagramEditor.tsx"),
 view=read("LektrusSchoolDiagramView.tsx"),board=read("boardModel.ts");
for(const id of ["geo-matching","geo-question-cards"]){
 assert.ok(registry.includes('id:"'+id+'"'),id+" in geography tools");
 assert.ok(editor.includes('"'+id+'"'),id+" in editor");
}
assert.ok(editor.includes("LektrusGeographyTrainingControls"));
assert.ok(view.includes("LektrusGeographyTrainingView"));
assert.ok(board.includes('if(d.kind==="geo-training")'),"save/load validator");
assert.ok(board.includes('d.relation==="outline-country"'),"outline mode survives persistence");
const control=read("LektrusGeographyTrainingControls.tsx");
assert.ok(control.includes("Object.entries(geoRelationNames)"),"new relation appears in both editors");
const exerciseView=read("LektrusGeographyTrainingView.tsx");
assert.ok(exerciseView.includes("LektrusGeoCountryOutline"),"outline renders for both exercises");
const outlineComponent=read("LektrusGeoCountryOutline.tsx");
assert.ok(outlineComponent.includes('loadAtlasLayer("countries-russian")'),"use political atlas polygons");
assert.ok(outlineComponent.includes("buildCountryOutline(features)"),"source-backed shape, no placeholder");
const geometryExports={};
new Function("exports",ts.transpileModule(read("lektrusGeoOutlineGeometry.ts"),{compilerOptions:{
 target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS
}}).outputText)(geometryExports);
const {outlineLongitudeOrigin,buildCountryOutline}=geometryExports;
const origin=outlineLongitudeOrigin([179,-179,178]);
assert.ok(origin>=178&&origin<=179,"dateline must not stretch countries worldwide");
const polygon=(coords)=>({type:"Feature",properties:{ISO_A2:"ZZ"},geometry:{type:"Polygon",coordinates:coords}});
const outline=buildCountryOutline([polygon([[[179,10],[-179,10],[-179,12],[179,12],[179,10]]])]);
assert.ok(outline&&outline.path.includes("M")&&outline.path.endsWith("Z"),"valid dateline outline");
assert.equal(outline.viewBox,"0 0 240 140");
assert.equal(buildCountryOutline([]),null,"never fabricate a country outline");
const multi=buildCountryOutline([{type:"Feature",properties:{},geometry:{type:"MultiPolygon",coordinates:[
 [[[10,10],[14,10],[14,14],[10,14],[10,10]]],
 [[[18,10],[20,10],[20,12],[18,12],[18,10]]]
]}}]);
assert.ok(multi&&multi.path.split("M").length>=3,"multi-island countries retain multiple polygons");
const hole=buildCountryOutline([polygon([
 [[0,0],[5,0],[5,5],[0,5],[0,0]],
 [[1,1],[1,2],[2,2],[2,1],[1,1]]
])]);
assert.ok(hole&&hole.path.split("M").length>=3,"lakes and holes remain in the silhouette");
console.log("Geography practice: country catalogue, flags, capitals, real atlas silhouettes, dateline handling and both exercise modes verified.");
