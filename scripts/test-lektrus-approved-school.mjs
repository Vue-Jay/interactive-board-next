import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";
const source=fs.readFileSync(new URL("../src/lektrusApprovedSchoolModel.ts",import.meta.url),"utf8");
const output=ts.transpileModule(source,{compilerOptions:{
 target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS
}}).outputText;
const exports={};
new Function("exports",output)(exports);
const {createApprovedSchoolDiagram,validateApprovedSchoolDiagram,familyGenerations,isApprovedSchoolId}=exports;
for(const id of ["ru-morphemes","history-family-tree","language-flashcards"]){
 assert.equal(isApprovedSchoolId(id),true,id+" must be a selectable subject tool");
 assert.equal(validateApprovedSchoolDiagram(createApprovedSchoolDiagram(id)),true,id+" default must pass");
}
const morphemes=createApprovedSchoolDiagram("ru-morphemes");
assert.equal(morphemes.segments.map(m=>m.text).join(""),"Слово");
assert.equal(morphemes.zeroEnding,false);
assert.equal(validateApprovedSchoolDiagram({...morphemes,segments:[
 {id:"a",text:"дом",role:"root"},{id:"b",text:"а",role:"ending"}],zeroEnding:true}),false);
assert.equal(validateApprovedSchoolDiagram({...morphemes,segments:[
 {id:"a",text:"дом",role:"root"},{id:"b",text:"а",role:"ending"}],zeroEnding:false}),true);
assert.equal(validateApprovedSchoolDiagram({...morphemes,segments:[
 {id:"a",text:"дом",role:"root"},{id:"b",text:"по",role:"prefix"}]}),false);
assert.equal(validateApprovedSchoolDiagram({...morphemes,segments:[
 {id:"a",text:"дом",role:"root"},{id:"a",text:"а",role:"suffix"}]}),false);
const family=createApprovedSchoolDiagram("history-family-tree");
assert.equal(familyGenerations(family.people).size,0,"no fabricated relatives");
assert.equal(validateApprovedSchoolDiagram({...family,people:[
 {id:"p1",name:"A",parents:["p3"]},
 {id:"p2",name:"B",parents:[]},
 {id:"p3",name:"C",parents:["p1"]}]}),false,"cycles must fail validation");
assert.equal(validateApprovedSchoolDiagram({...family,people:[
 {id:"p1",name:"A",parents:[]},
 {id:"p2",name:"B",parents:[]},
 {id:"p3",name:"C",parents:["p1","p2","p1"]}]}),false,"more than two parents fail");
assert.equal(validateApprovedSchoolDiagram({...family,people:[
 {id:"p1",name:"A",parents:["unknown"]}]}),false,"orphan parent reference fails");
const cards=createApprovedSchoolDiagram("language-flashcards");
assert.equal(cards.showTranslation,false,"answers should initially remain hidden");
assert.equal(validateApprovedSchoolDiagram({...cards,cards:[
 {id:"a",term:"cat",translation:"кот",transcription:""},
 {id:"a",term:"dog",translation:"собака",transcription:""}]}),false);
assert.equal(validateApprovedSchoolDiagram({...cards,cards:[
 {id:"a",term:"",translation:"кот",transcription:""}]}),false);
const registry=fs.readFileSync(new URL("../src/lektrusSubjectToolRegistry.ts",import.meta.url),"utf8");
for(const id of ["ru-morphemes","history-family-tree","language-flashcards"])
 assert.ok(registry.includes('id:"'+id+'"'),id+" available in subject menu");
assert.match(registry,/subjects:\["история","обществознание"\]/);
assert.match(registry,/subjects:\["иностранный язык"\]/);
assert.doesNotMatch(registry,/subjects:\["английский язык"/);
console.log("Approved school tools: morpheme order and zero endings, family acyclicity and foreign vocabulary answer hiding verified.");
