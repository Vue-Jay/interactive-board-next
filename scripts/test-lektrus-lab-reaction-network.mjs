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


const lead=simulateLabInventory({
 reagents:["Pb(NO3)2","KI"],environment:"aqueous",
 temperatureC:25,
 doses:{"Pb(NO3)2":solution(10),KI:solution(20)}
});
assert.ok(lead.steps.some(s=>s.equation.includes("PbI2↓")),
 "A 1:2 lead iodide reaction must be included");
assert.ok((lead.solidMol.PbI2??0)>0.0009&&lead.solidMol.PbI2<0.001,
 "PbI2 precipitation must retain a calculable dissolved remainder");
approximately(labInventoryMassG(lead),
 .001*labMolarMass("Pb(NO3)2")+.002*labMolarMass("KI"),1e-7);
const weakLead=simulateLabInventory({
 reagents:["Pb(NO3)2","KI"],environment:"aqueous",
 temperatureC:25,
 doses:{"Pb(NO3)2":solution(10,.0001),KI:solution(10,.0001)}
});
assert.ok(!(weakLead.solidMol.PbI2>0),
 "Undersaturated lead iodide must not precipitate");
const iron=simulateLabInventory({
 reagents:["FeCl3","NaOH"],environment:"aqueous",
 temperatureC:25,
 doses:{FeCl3:solution(10),NaOH:solution(30)}
});
assert.ok((iron.solidMol["Fe(OH)3"]??0)>.00099,
 "1:3 hydroxide precipitation uses the Fe3+/OH- mass-action powers");
const neutralization=simulateLabInventory({
 reagents:["HCl","NaOH"],environment:"aqueous",
 doses:{HCl:solution(10),NaOH:solution(10)}
});
assert.ok(neutralization.heatEstimateComplete);
approximately(neutralization.knownHeatKJ,-.0573,1e-7);
assert.equal(sample.heatEstimateComplete,false,
 "Do not invent an enthalpy for a reaction lacking vetted thermodynamics");
assert.ok(sample.knownHeatKJ===undefined);
console.log("Expanded Ksp, 1:2 and 1:3 precipitation and audited heat effects passed");


const cupboardCss=fs.readFileSync("src/lektrusChemistryBench.css","utf8");
assert.match(cupboardCss,/grid-template-rows:repeat\(2,minmax\(0,1fr\)\)!important/,
 "Bench cupboard tiles must have two rows with enough height for labels");
assert.match(cupboardCss,/grid-auto-rows:minmax\(50px,auto\)!important/,
 "Narrow cupboard must scroll through legible glassware rows");
assert.match(cupboardCss,/is-glassware \.lektrus-lab-modal-ware button:has\(\.lektrus-lab-ware-icon\)/,
 "Expanded cupboard must reserve icon and title slots");
const cabinetView=fs.readFileSync("src/LektrusChemistryBench.tsx","utf8");
assert.match(cabinetView,/<small>\{kind\.name\}<\/small>/,
 "Every compact icon must retain its visible full-name label");
console.log("Glassware cupboard compact and expanded layout guards passed");


const openGas=simulateLabInventory({
 reagents:["HCl","NaHCO3"],environment:"aqueous",
 doses:{HCl:solution(30),NaHCO3:{unit:"g",value:.3}}
});
const closedGas=simulateLabInventory({
 reagents:["HCl","NaHCO3"],environment:"aqueous",stoppered:true,
 doses:{HCl:solution(30),NaHCO3:{unit:"g",value:.3}}
});
assert.ok((openGas.releasedGasMol.CO2??0)>0,
 "Gas from a reviewed reaction escapes an open flask");
assert.ok((closedGas.retainedGasMol.CO2??0)>0,
 "Gas from the SAME balanced reaction stays inside a corked flask");
assert.equal(closedGas.releasedGasMol.CO2??0,0,
 "Closed flask must not simultaneously vent reaction gas");
assert.equal(openGas.retainedGasMol.CO2??0,0);
approximately(openGas.releasedGasMol.CO2,closedGas.retainedGasMol.CO2,1e-12);
approximately(labInventoryMassG(openGas),labInventoryMassG(closedGas),1e-8);
approximately(labInventoryMassG(closedGas),
 .003*labMolarMass("HCl")+.3,1e-7);
console.log("Open-vessel CO2 escapes; corked CO2 remains, fully mass-balanced");
