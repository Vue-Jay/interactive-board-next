import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";
const model=fs.readFileSync(new URL("../src/lektrusFurtherSchoolModel.ts",import.meta.url),"utf8");
const js=ts.transpileModule(model,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const exports={};
new Function("exports",js)(exports);
const {defaultFurtherDiagram,isFurtherId,validFurtherDiagram,organOptions}=exports;
for(const id of ["bio-organ-systems","geo-relief-profile"]){
 assert.equal(isFurtherId(id),true);
 assert.equal(validFurtherDiagram(defaultFurtherDiagram(id)),true);
}
const anatomy=defaultFurtherDiagram("bio-organ-systems");
assert.equal(anatomy.labels.length,organOptions.digestive.length);
assert.equal(validFurtherDiagram({...anatomy,labels:[]}),true,"allow fully unlabeled exercise");
assert.equal(validFurtherDiagram({...anatomy,labels:["unknown"]}),false);
assert.equal(validFurtherDiagram({...anatomy,labels:["mouth","mouth"]}),false);
assert.equal(validFurtherDiagram({...anatomy,system:"respiratory",labels:["stomach"]}),false);
const geography=defaultFurtherDiagram("geo-relief-profile");
assert.equal(validFurtherDiagram({...geography,points:[{id:"a",distance:0,height:-300,label:""},
 {id:"b",distance:30,height:150,label:""}]}),true,"heights below sea level are allowed");
assert.equal(validFurtherDiagram({...geography,points:[{id:"a",distance:0,height:1,label:""},
 {id:"b",distance:0,height:2,label:""}]}),false,"same-distance points should be rejected");
assert.equal(validFurtherDiagram({...geography,points:[{id:"a",distance:0,height:1,label:""},
 {id:"a",distance:10,height:2,label:""}]}),false,"duplicate IDs should be rejected");
assert.equal(validFurtherDiagram({...geography,points:[{id:"a",distance:0,height:12000,label:""},
 {id:"b",distance:40,height:20,label:""}]}),false,"height beyond supported range rejected");
const registry=fs.readFileSync(new URL("../src/lektrusSubjectToolRegistry.ts",import.meta.url),"utf8");
assert.match(registry,/id:"bio-organ-systems"/);
assert.doesNotMatch(registry,/id:"geo-relief-profile"/,"retired relief tool hidden from picker");
console.log("Lektrus organs and geographic relief: validated default, hidden labels, negative heights and measurement limits.");
