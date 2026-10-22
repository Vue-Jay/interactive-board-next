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
 assert.equal(validGeoTraining({...d,countryCodes:["RU","RU"]}),false);
 assert.equal(validGeoTraining({...d,countryCodes:["XX","US"]}),false);
 assert.equal(validGeoTraining({...d,countryCodes:["RU"]}),false);
 assert.equal(validGeoTraining({...d,countryCodes:geoCountries.slice(0,13).map(c=>c.code)}),false);
}
assert.deepEqual(geoPair(getGeoCountry("FR"),"flag-country"),{left:"flag",right:"Франция"});
assert.deepEqual(geoPair(getGeoCountry("FR"),"country-capital"),{left:"Франция",right:"Париж"});
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
console.log("Geography practice: country catalogue, capitals, flag pairs, reverse roles, validation and both subject tools verified.");
