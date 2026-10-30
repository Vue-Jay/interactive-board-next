/** Executable checks of the reviewed sequential mass-balance engine.
 * Transpile TypeScript in-memory to avoid a separate test runner dependency. */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";
const modules=new Map();
function load(file){
 const resolved=path.resolve(file);
 if(modules.has(resolved))return modules.get(resolved).exports;
 const mod={exports:{}};modules.set(resolved,mod);
 const source=fs.readFileSync(resolved,"utf8");
 const transpiled=ts.transpileModule(source,{compilerOptions:{
  module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2023
 }}).outputText;
 const requireLocal=(specifier)=>{
  if(!specifier.startsWith("."))throw new Error("Unexpected dependency "+specifier);
  return load(path.resolve(path.dirname(resolved),specifier+".ts"));
 };
 new Function("require","module","exports",transpiled)(requireLocal,mod,mod.exports);
 return mod.exports;
}
const {simulateLabInventory,labInventoryMassG}=load("src/lektrusLabReactionNetwork.ts");
const {labMolarMass}=load("src/lektrusLabStoichiometry.ts");
const solution=(value,concentrationM=.1)=>({value,unit:"ml",concentrationM});
const approximately=(actual,expected,tolerance=1e-9)=>
 assert.ok(Math.abs(actual-expected)<tolerance,`Expected ${actual} ≈ ${expected}`);
const mixtures=[
 ["AgNO3","NaCl"],["BaCl2","Na2SO4"],["HCl","NaOH"]
];
for(const ids of mixtures){
 const doses=Object.fromEntries(ids.map(id=>[id,solution(10)]));
 const result=simulateLabInventory({reagents:ids,doses,environment:"aqueous"});
 assert.ok(result.steps.length>0,"No product for "+ids.join("+"));
 const expected=ids.reduce((sum,id)=>sum+0.001*labMolarMass(id),0);
 approximately(labInventoryMassG(result),expected,1e-7);
 assert.equal(result.unmeasured.length,0);
}
const sample=simulateLabInventory({
 reagents:["AgNO3","NaCl"],environment:"aqueous",
 doses:{AgNO3:solution(10),NaCl:solution(10)}
});
assert.ok((sample.solidMol.AgCl??0)>0.00099);
assert.ok((sample.solidMol.AgCl??0)<0.001);
assert.ok((sample.speciesMol.NaNO3??0)>0.00099);
const diluted=simulateLabInventory({
 reagents:["AgNO3","NaCl","H2O"],environment:"aqueous",
 doses:{AgNO3:solution(10),NaCl:solution(10),H2O:{value:20,unit:"ml"}}
});
assert.ok((diluted.solidMol.AgCl??0)>0.00099,"Water must not erase precipitate");
const two=simulateLabInventory({
 reagents:["AgNO3","NaCl","BaCl2","Na2SO4"],
 environment:"aqueous",
 doses:{AgNO3:solution(10),NaCl:solution(10),BaCl2:solution(10),Na2SO4:solution(10)}
});
assert.ok((two.solidMol.AgCl??0)>0.0009);
assert.ok((two.solidMol.BaSO4??0)>0.0009);
assert.ok(two.steps.length>=2);
const inactive=simulateLabInventory({
 reagents:["NaCl","KNO3"],environment:"aqueous",
 doses:{NaCl:solution(10),KNO3:solution(10)}
});
assert.equal(inactive.steps.length,0,"Inert salts must not invent a reaction");
const unknown=simulateLabInventory({reagents:["NaCl"],environment:"aqueous"});
assert.deepEqual(unknown.unmeasured,["NaCl"]);
const diluteBelowKsp=simulateLabInventory({
 reagents:["AgNO3","NaCl"],environment:"aqueous",
 doses:{AgNO3:solution(10,1e-6),NaCl:solution(10,1e-6)}
});
assert.ok(!diluteBelowKsp.solidMol.AgCl,"Below Ksp: no visible precipitate");
console.log("Sequential lab chemistry checks passed");
