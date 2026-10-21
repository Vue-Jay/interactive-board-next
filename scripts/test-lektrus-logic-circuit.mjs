import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";
const source=fs.readFileSync(new URL("../src/lektrusLogicCircuitModel.ts",import.meta.url),"utf8");
const compiled=ts.transpileModule(source,{compilerOptions:{
 module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const api={};
new Function("exports",compiled)(api);
const {defaultLogicCircuit,validateLogicCircuit,evaluateLogicGate,
 evaluateLogicCircuit,logicCircuitRows,logicGateNames,logicSecondNames,circuitUsesThirdInput}=api;

const circuit=defaultLogicCircuit();
assert.equal(validateLogicCircuit(circuit),true);
assert.equal(circuitUsesThirdInput(circuit),true);
assert.equal(logicCircuitRows(circuit).length,8);
assert.deepEqual(logicCircuitRows({...circuit,secondGate:"none"}).map(r=>r.output),[0,0,0,1]);
assert.deepEqual(logicCircuitRows({...circuit,secondGate:"not"}).map(r=>r.output),[1,1,1,0]);
const expected={
 and:[0,0,0,1],or:[0,1,1,1],xor:[0,1,1,0],
 nand:[1,1,1,0],nor:[1,0,0,0],xnor:[1,0,0,1]
};
for(const [gate,outputs] of Object.entries(expected)){
 const actual=[];
 for(const a of [0,1])for(const b of [0,1]){
  actual.push(evaluateLogicGate(gate,a,b));
 }
 assert.deepEqual(actual,outputs,gate+" truth table");
}
for(const firstGate of Object.keys(logicGateNames)){
 for(const secondGate of Object.keys(logicSecondNames)){
  const d={...circuit,firstGate,secondGate};
  assert.equal(validateLogicCircuit(d),true,firstGate+" -> "+secondGate);
  const rows=logicCircuitRows(d);
  assert.equal(rows.length,circuitUsesThirdInput(d)?8:4);
  for(const row of rows){
   const f=evaluateLogicGate(firstGate,row.a,row.b);
   const expectedSecond=secondGate==="none"?f:secondGate==="not"?1-f:
    evaluateLogicGate(secondGate,f,row.c);
   assert.equal(row.intermediate,f);
   assert.equal(row.output,expectedSecond,firstGate+" -> "+secondGate);
   assert.equal(evaluateLogicCircuit(d,row).output,expectedSecond);
  }
 }
}
for(const malformed of [
 {...circuit,firstGate:"invalid"}, {...circuit,secondGate:"unknown"},
 {...circuit,initialSignals:{a:2,b:0,c:1}},
 {...circuit,initialSignals:{a:"0",b:0,c:1}},
 {...circuit,showTruthTable:0}, {...circuit,showResults:null},
 {...circuit,title:""}, {...circuit,title:"X".repeat(121)}
])assert.equal(validateLogicCircuit(malformed),false);

const registry=fs.readFileSync(new URL("../src/lektrusSubjectToolRegistry.ts",import.meta.url),"utf8");
assert.match(registry,/id:"info-circuit"/);
assert.match(registry,/id==="info-circuit"/);
const model=fs.readFileSync(new URL("../src/lektrusSchoolDiagramModel.ts",import.meta.url),"utf8");
assert.match(model,/defaultLogicCircuit/);
assert.match(model,/validateLogicCircuit/);
const editor=fs.readFileSync(new URL("../src/LektrusSchoolDiagramEditor.tsx",import.meta.url),"utf8");
assert.match(editor,/LektrusLogicCircuitControls/);
const boardView=fs.readFileSync(new URL("../src/LektrusSchoolDiagramView.tsx",import.meta.url),"utf8");
assert.match(boardView,/LektrusLogicCircuitView/);
const view=fs.readFileSync(new URL("../src/LektrusLogicCircuitView.tsx",import.meta.url),"utf8");
assert.match(view,/setSignals/);
assert.match(view,/onPointerDown=\{stop\}/);
console.log("Logic circuits: all 6 first gates and 8 output modes, exhaustive truth tables, validation and board wiring passed.");
