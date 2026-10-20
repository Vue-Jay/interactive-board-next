import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";

const modelText=fs.readFileSync(new URL("../src/lektrusNextSchoolModel.ts",import.meta.url),"utf8");
const js=ts.transpileModule(modelText,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const exported={};
new Function("exports",js)(exported);
const {isNextSchoolId,defaultNextSchoolDiagram,validNextSchoolDiagram,validPlaceDigit}=exported;
for(const id of ["ru-syntax","info-flowchart","info-place-value"]){
 assert.equal(isNextSchoolId(id),true,id+" should have a registered editor");
 const d=defaultNextSchoolDiagram(id);
 assert.equal(validNextSchoolDiagram(d),true,id+" default should be valid");
 assert.equal(validNextSchoolDiagram(structuredClone(d)),true);
}
const sentence=defaultNextSchoolDiagram("ru-syntax");
assert.equal(sentence.words.every(w=>w.role==="none"),true,"never assign pupil's grammar answers automatically");
assert.equal(validNextSchoolDiagram({...sentence,words:[...sentence.words,{...sentence.words[0]}]}),false,"no repeated token ids");
assert.equal(validNextSchoolDiagram({...sentence,words:[{id:"a",text:"",role:"none"}]}),false,"empty words rejected");
assert.equal(validNextSchoolDiagram({...sentence,words:[{id:"a",text:"Кот",role:"unknown"}]}),false,"unknown grammatical roles rejected");

const digits=defaultNextSchoolDiagram("info-place-value");
assert.equal(validPlaceDigit("10101",2),true);
assert.equal(validPlaceDigit("12001",2),false);
assert.equal(validPlaceDigit("7A",8),false);
assert.equal(validPlaceDigit("2AF",16),true);
assert.equal(validPlaceDigit("g",16),false);
assert.equal(validNextSchoolDiagram({...digits,base:16,digits:"2AF"}),true);
assert.equal(validNextSchoolDiagram({...digits,base:2,digits:"102"}),false);
assert.equal(validNextSchoolDiagram({...digits,base:10,digits:"0000"}),true);

const flow=defaultNextSchoolDiagram("info-flowchart");
assert.equal(flow.nodes.find(n=>n.kind==="decision"),undefined,"new flowcharts start without a solved example");
const example={...flow,nodes:[
 {id:"n1",kind:"start",label:"Начало",lane:0},
 {id:"n2",kind:"process",label:"Действие",lane:0},
 {id:"n3",kind:"decision",label:"Условие",lane:0},
 {id:"n4",kind:"end",label:"Конец",lane:0}],
 edges:[
 {id:"e1",from:"n1",to:"n2",label:""},
 {id:"e2",from:"n2",to:"n3",label:""},
 {id:"e3",from:"n3",to:"n4",label:"да"},
 {id:"e4",from:"n3",to:"n2",label:"нет"}]};
assert.equal(validNextSchoolDiagram(example),true);
assert.equal(validNextSchoolDiagram({...example,edges:example.edges.filter(e=>e.label!=="нет")}),false,
 "decisions must have both outgoing labels");
assert.equal(validNextSchoolDiagram({...example,edges:example.edges.map(e=>({...e,to:"n1"}))}),false,
 "must reach the end");
assert.equal(validNextSchoolDiagram({...example,nodes:[...example.nodes,{id:"extra",kind:"process",label:"Лишнее",lane:0}]}),false,
 "disconnected blocks rejected");
assert.equal(validNextSchoolDiagram({...flow,edges:[...flow.edges,{...flow.edges[0],id:"duplicate"}]}),false,
 "parallel duplicate arrows rejected");
assert.equal(validNextSchoolDiagram({...flow,edges:[...flow.edges,{id:"bad",from:"n4",to:"n1",label:""}]}),false,
 "end blocks may not emit arrows");
const board=fs.readFileSync(new URL("../src/App.tsx",import.meta.url),"utf8");
const registry=fs.readFileSync(new URL("../src/lektrusSubjectToolRegistry.ts",import.meta.url),"utf8");
for(const id of ["ru-syntax","info-flowchart","info-place-value"]){
 assert.ok(registry.includes('id:"'+id+'"'),id+" should be in subject tools menu");
}
assert.ok(board.includes("isSchoolDiagramId(item.graphFigureId)"),"new diagrams should open their editor when double-clicked");
console.log("Lektrus Russian/informatics diagrams: strict grammar roles, branching, reachability, numeral digits and UI wiring verified.");
