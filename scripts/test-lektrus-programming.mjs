import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";
function load(filename){
 const source=fs.readFileSync(new URL("../src/"+filename,import.meta.url),"utf8");
 const javascript=ts.transpileModule(source,{compilerOptions:{
  module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const exports={};
 new Function("exports",javascript)(exports);
 return exports;
}
const model=load("lektrusProgrammingModel.ts");
const {defaultProgrammingDiagram,validateProgrammingDiagram,programmingPresets}=model;
const original=defaultProgrammingDiagram();
assert.equal(validateProgrammingDiagram(original),true);
assert.equal(original.kind,"programming");
assert.equal(original.tests?.length,2,"initial lesson contains two teacher test cases");
assert.equal(validateProgrammingDiagram({...original,tests:[]}),true);
assert.equal(validateProgrammingDiagram({...original,tests:[...original.tests,{...original.tests[0],id:"repeat"}]}),true);
assert.equal(validateProgrammingDiagram({...original,tests:[...original.tests,original.tests[0]]}),false);
assert.equal(validateProgrammingDiagram({...original,tests:[{id:"bad",name:"",stdin:"",expected:""}]}),false);
assert.equal(validateProgrammingDiagram({...original,tests:[{id:"bad",name:"test",stdin:"",expected:"x".repeat(4001)}]}),false);
assert.equal(model.normalizeProgramOutput("A\r\nB\r\n"),"A\nB");
assert.match(original.code,/const name/,"Default JS program must not contain Python");
assert.equal(new Set(programmingPresets.map(v=>v.id)).size,programmingPresets.length);
for(const lang of ["python","javascript","typescript"]){
 const examples=programmingPresets.filter(v=>v.language===lang);
 assert.ok(examples.length>=2,lang+" has examples");
 for(const example of examples){
  assert.equal(validateProgrammingDiagram({...original,language:lang,
   code:example.code,stdin:example.stdin}),true,example.id);
 }
}
for(const wrong of [
 {...original,language:"c++"}, {...original,stdin:"a".repeat(2001)},
 {...original,code:"x".repeat(20001)}, {...original,title:""},
 {...original,title:"a".repeat(121)}, {...original,showCode:null}
])assert.equal(validateProgrammingDiagram(wrong),false);

const runner=load("lektrusProgrammingSandbox.ts").PROGRAM_SANDBOX_HTML;
assert.match(runner,/sandbox|workerText/);
assert.match(runner,/connect-src https:\/\/cdn\.jsdelivr\.net/);
assert.match(runner,/worker-src blob:/);
assert.match(runner,/const workerText=/);
const matched=runner.match(/const workerText=("(?:\\.|[^"\\])*");/);
assert.ok(matched,"worker executable embedded as a serialized literal");
const code=JSON.parse(matched[1]);
assert.match(code,/AsyncFunction/);
assert.match(code,/import\("https:\/\/cdn\.jsdelivr\.net\/pyodide\/v314\.0\.7\/full\/pyodide\.mjs"\)/);
assert.match(runner,/type:"module"/);
const run=async(source,stdin)=>{
 const messages=[];
 const self={postMessage:m=>messages.push(m)};
 const context=vm.createContext({self});
 vm.runInContext(code,context,{timeout:1500});
 await self.onmessage({data:{kind:"execute",language:"javascript",code:source,stdin}});
 return messages;
};
let messages=await run('console.log("Ответ:",Number(readLine())*2)',"21");
assert.equal(messages.find(v=>v.kind==="line").text,"Ответ: 42");
assert.equal(messages.at(-1).status,"success");
messages=await run('print(input.trim().split(" ").map(Number).reduce((a,b)=>a+b,0))',"2 3 5");
assert.equal(messages.find(v=>v.kind==="line").text,"10");
assert.equal(messages.at(-1).status,"success");
messages=await run('throw new Error("Проверка ошибки");',"");
assert.equal(messages.at(-1).status,"error");
assert.ok(messages.some(v=>v.kind==="line"&&v.level==="error"));
const transpiled=ts.transpileModule(
 'const value: number = Number(readLine()); console.log(value*value);',
 {reportDiagnostics:true,compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
messages=await run(transpiled,"7");
assert.equal(messages.find(v=>v.kind==="line").text,"49");
assert.equal(messages.at(-1).status,"success");

const registry=fs.readFileSync(new URL("../src/lektrusSubjectToolRegistry.ts",import.meta.url),"utf8");
assert.match(registry,/id:"info-programming"/);
assert.match(registry,/id==="info-programming"/);
const boardModel=fs.readFileSync(new URL("../src/lektrusSchoolDiagramModel.ts",import.meta.url),"utf8");
assert.match(boardModel,/validateProgrammingDiagram/);
assert.match(boardModel,/defaultProgrammingDiagram/);
const editor=fs.readFileSync(new URL("../src/LektrusSchoolDiagramEditor.tsx",import.meta.url),"utf8");
assert.match(editor,/Lektor|LektrusProgrammingControls/);
const view=fs.readFileSync(new URL("../src/LektrusSchoolDiagramView.tsx",import.meta.url),"utf8");
assert.match(view,/LektrusProgrammingView/);
const component=fs.readFileSync(new URL("../src/LektrusProgrammingView.tsx",import.meta.url),"utf8");
assert.match(component,/sandbox="allow-scripts"/);
assert.match(component,/setSource/,"students can edit their own code");
assert.match(component,/setStdin/,"students can try their own inputs");
assert.match(component,/normalizeProgramOutput/,"compare normalized output for test cases");
assert.match(component,/Проверить тесты/);
assert.match(component,/batch\.current/);
assert.doesNotMatch(component,/allow-same-origin/);
console.log("Programming tools: three languages, validated model, JS/TS execution, console errors, and sandbox wiring passed.");
