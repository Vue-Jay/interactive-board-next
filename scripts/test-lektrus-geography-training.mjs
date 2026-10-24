import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";
const read=(file)=>fs.readFileSync(new URL("../src/"+file,import.meta.url),"utf8");
const mod={};
new Function("exports",ts.transpileModule(read("lektrusGeographyTrainingModel.ts"),{compilerOptions:{
 target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS
}}).outputText)(mod);
const {geoCountries,geoRegions,geoPair,getGeoCountry,makeGeoTraining,
 validGeoTraining,sampleGeoCountries,geoCountryDifficulty,geoDifficultyNames}=mod;
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
 assert.deepEqual(d.countryCodes,[],"new exercise has no ready-made country set");
 assert.equal(validGeoTraining(d),false,"empty sets must not be saved on board");
 assert.equal(d.reverse,false);
 assert.equal(d.relation,"flag-country");
 assert.equal(validGeoTraining({...d,countryCodes:["RU","FR"]}),true,"manual selections remain valid");
 assert.equal(validGeoTraining({...d,countryCodes:["RU","FR"],difficulty:"easy"}),true);
 assert.equal(validGeoTraining({...d,countryCodes:["RU","FR"],difficulty:"custom"}),true);
 assert.equal(validGeoTraining({...d,countryCodes:["RU","FR"],difficulty:"unknown"}),false);
 assert.equal(validGeoTraining({...d,countryCodes:["RU","FR"],relation:"country-capital",reverse:true}),true);
 assert.equal(validGeoTraining({...d,countryCodes:["RU","FR"],relation:"outline-country",reverse:true}),true);
 assert.equal(validGeoTraining({...d,countryCodes:["RU","RU"]}),false);
 assert.equal(validGeoTraining({...d,countryCodes:["XX","US"]}),false);
 assert.equal(validGeoTraining({...d,countryCodes:["RU"]}),false);
 assert.equal(validGeoTraining({...d,countryCodes:geoCountries.slice(0,13).map(c=>c.code)}),false);
}
assert.deepEqual(geoPair(getGeoCountry("FR"),"flag-country"),{left:"flag",right:"Франция"});
assert.deepEqual(geoPair(getGeoCountry("FR"),"country-capital"),{left:"Франция",right:"Париж"});
assert.deepEqual(geoPair(getGeoCountry("FR"),"outline-country"),{left:"outline",right:"Франция"});
assert.deepEqual(Object.keys(geoDifficultyNames),["easy","medium","hard"]);
assert.equal(geoCountryDifficulty("RU"),"easy");
assert.equal(geoCountryDifficulty("AL"),"medium");
assert.equal(geoCountryDifficulty("TV"),"hard");
assert.equal(new Set(geoCountries.map(c=>c.difficulty)).size,3);
for(const region of ["Все",...geoRegions])for(const level of ["easy","medium","hard"])for(const count of [2,6,12]){
 const codes=sampleGeoCountries(region,count,level);
 assert.equal(codes.length,count,region+" "+level);
 assert.equal(new Set(codes).size,count,"no country is repeated");
 if(region!=="Все")assert.ok(codes.every(code=>getGeoCountry(code).region===region));
 const primary=geoCountries.filter(c=>(region==="Все"||c.region===region)&&c.difficulty===level).length;
 assert.equal(codes.slice(0,Math.min(primary,count)).every(code=>getGeoCountry(code).difficulty===level),
  true,"chosen level is used before falling back to neighbouring levels");
}
for(const level of ["easy","medium","hard"]){
 const all=sampleGeoCountries("Все",12,level);
 assert.ok(all.every(code=>getGeoCountry(code).difficulty===level),
  "whole-world exercises must honour their chosen difficulty");
}
const registry=read("lektrusSubjectToolRegistry.ts"),editor=read("LektrusSchoolDiagramEditor.tsx"),
 view=read("LektrusSchoolDiagramView.tsx"),board=read("boardModel.ts");
for(const id of ["geo-matching","geo-question-cards"]){
 assert.ok(registry.includes('id:"'+id+'"'),id+" in geography tools");
 assert.ok(editor.includes('"'+id+'"'),id+" in editor");
}
assert.ok(editor.includes("LektrusGeographyTrainingControls"));
assert.ok(editor.includes('draft.countryCodes.length<2'),"cannot save empty geography exercises");
assert.ok(editor.includes('isContour||draft.kind==="geo-training"'),"closing geography editor discards unsaved changes");
assert.ok(editor.includes('lektrus-school-editor--geo-training'),
 "geography practice gets an isolated, wider editor layout");
assert.ok(editor.includes("Компактный предпросмотр задания"),
 "matching and question cards share an explicitly compact preview");
const geoCss=read("lektrusGeographyTraining.css");
assert.ok(geoCss.includes(".lektrus-school-editor--geo-training .lektrus-school-body"),
 "editor column ratio changes only for geography exercises");
assert.match(geoCss,/grid-template-columns:minmax\(0,1\.95fr\) minmax\(280px,\.86fr\)/,
 "settings column must be much wider than preview");
assert.ok(geoCss.includes("height:min(440px,60dvh)"),"preview has bounded height");
assert.ok(geoCss.includes("lektrus-geo-generator-fields")&&
 geoCss.includes("lektrus-geo-manual-grid")&&
 geoCss.includes("lektrus-geo-selected-heading"),
 "compact generator, country list and manual entry sections are styled");
assert.ok(geoCss.includes("@container geoControls")&&
 geoCss.includes("(orientation:portrait)"),
 "exercise authoring remains responsive on narrow screens");
assert.ok(editor.includes('draft.kind==="geo-training"?"Закрыть без сохранения"'),"close label agrees with cancel behavior");
assert.ok(view.includes("LektrusGeographyTrainingView"));
assert.ok(board.includes('if(d.kind==="geo-training")'),"save/load validator");
assert.ok(board.includes('d.relation==="outline-country"'),"outline mode survives persistence");
const control=read("LektrusGeographyTrainingControls.tsx");
assert.ok(control.includes("Object.entries(geoRelationNames)"),"new relation appears in both editors");
assert.ok(control.includes("Сгенерировать задание"),"generation requires explicit teacher action");
assert.ok(control.includes("setDifficulty"),"difficulty is adjustable before generation");
assert.ok(control.includes("difficulty:\"custom\""),"manual edits clear generated-level label");
assert.ok(control.includes("setCount"),"count setting does not regenerate exercises");
assert.ok(read("LektrusGeographyTrainingView.tsx").includes("diagram.countryCodes.length<2"),"empty preview has a deliberate empty state");
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

// Overseas territories must not shrink a familiar mainland into a tiny dot.
// The main French landmass and nearby Corsica must stay, while French Guiana
// and remote ocean colonies may be hidden on a small matching-card outline.
const {selectReadableCountryPolygons}=geometryExports;
const rectangle=(west,south,east,north)=>[[
 [west,south],[east,south],[east,north],[west,north],[west,south]
]];
const franceMain=rectangle(-5,42,8,51);
const corsica=rectangle(8.6,41,9.6,43);
const frenchGuiana=rectangle(-54,3,-51,6);
const frenchCaribbean=rectangle(-63,16,-62,17);
const mainlandOnly=selectReadableCountryPolygons([franceMain,corsica,frenchGuiana,frenchCaribbean]);
assert.equal(mainlandOnly.length,2,"France should keep the mainland and Corsica, not distant overseas regions");
assert.ok(mainlandOnly.includes(franceMain)&&mainlandOnly.includes(corsica));
const readableFrance=buildCountryOutline([{
 type:"Feature",properties:{ISO_A2:"FR"},geometry:{type:"MultiPolygon",
  coordinates:[franceMain,corsica,frenchGuiana,frenchCaribbean]}
}]);
assert.ok(readableFrance&&readableFrance.path.split("M").length===3,
 "French geography cards must use a large readable mainland with nearby Corsica");
const nearbyIslands=selectReadableCountryPolygons([
 rectangle(0,0,12,10),rectangle(13,1,15,3)
]);
assert.equal(nearbyIslands.length,2,"nearby islands must not disappear");
const archipelago=selectReadableCountryPolygons([
 rectangle(101,-2,105,2),rectangle(122,-2,127,2),
 rectangle(135,-7,140,-3),rectangle(153,0,157,3)
]);
assert.equal(archipelago.length,4,
 "widely spaced genuine archipelagos like Indonesia must never be cropped to one island");
const tinyArchipelago=selectReadableCountryPolygons([
 rectangle(0,0,.2,.2),rectangle(1.1,.4,1.3,.6),rectangle(1.8,.4,2,.6)
]);
assert.equal(tinyArchipelago.length,3,
 "small island states must remain identifiable by all their islands");
const withHole=[franceMain[0],[[0,45],[1,45],[1,46],[0,46],[0,45]]];
const croppedWithHole=buildCountryOutline([{
 type:"Feature",properties:{ISO_A2:"FR"},geometry:{type:"MultiPolygon",
 coordinates:[withHole,corsica,frenchGuiana]}
}]);
assert.ok(croppedWithHole&&croppedWithHole.path.split("M").length===4,
 "interior rings/holes of the mainland must survive when overseas parts are dropped");
const datelineIslands=buildCountryOutline([{
 type:"Feature",properties:{},geometry:{type:"MultiPolygon",coordinates:[
 rectangle(178,-17,179.6,-15),rectangle(-179.4,-17,-178.2,-15)
 ]}
}]);
assert.ok(datelineIslands&&datelineIslands.path.split("M").length===3,
 "paired islands across the dateline remain visible together");

console.log("Geography practice: country catalogue, flags, capitals, real atlas silhouettes, dateline handling and both exercise modes verified.");
