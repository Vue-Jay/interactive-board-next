/** Regression: a smaller receiver fills to the brim; no liquid is invented
 * and the surplus must remain in the sending beaker (both pour modes).
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";
const modules=new Map();
function load(file){
 const resolved=path.resolve(file);
 if(modules.has(resolved))return modules.get(resolved).exports;
 const mod={exports:{}};modules.set(resolved,mod);
 const js=ts.transpileModule(fs.readFileSync(resolved,"utf8"),{
  compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2023}
 }).outputText;
 new Function("require","module","exports",js)(key=>{
  if(!key.startsWith("."))throw Error("Unexpected "+key);
  return load(path.resolve(path.dirname(resolved),key+".ts"));
 },mod,mod.exports);
 return mod.exports;
}
const lab=load("src/lektrusChemistryBenchModel.ts");
const read=path=>fs.readFileSync(path,"utf8");
const vessel=(b,id)=>b.vessels.find(v=>v.id===id);
const approx=(value,expected,tol=.005)=>assert.ok(
 Math.abs(value-expected)<=tol,value+" !== "+expected);
const water=volume=>({unit:"ml",value:volume});
let setup=lab.defaultLabBench();
setup=lab.putLabReagent(setup,"v1","H2O",water(100));
setup=lab.addLabVessel(setup,"tube");
setup=lab.putLabReagent(setup,"v2","H2O",water(10));
assert.equal(lab.labVesselQuantity(vessel(setup,"v2")).capacityMl,25);
assert.equal(lab.labVesselQuantity(vessel(setup,"v2")).availableMl,15);
const started=lab.startLabPour(setup,"v1","v2","cap-gradual");
assert.ok(started.pouring,"Must be able to begin even when source > free capacity");
approx(started.pouring.transferFraction,.15,1e-10);
let staged=lab.advanceLabPour(started);
approx(vessel(staged,"v1").doses.H2O.value,99.25);
approx(vessel(staged,"v2").doses.H2O.value,10.75);
assert.equal(lab.labPourPercent(staged.pouring),5);
approx(lab.labPourAmounts(staged.pouring)[0].transferred,.75);
approx(lab.labPourAmounts(staged.pouring)[0].remaining,99.25);
for(let i=1;i<lab.LAB_POUR_STEPS;i++)
 staged=lab.advanceLabPour(staged);
assert.equal(staged.pouring.step,lab.LAB_POUR_STEPS);
const done=lab.stopLabPour(staged,"cap-gradual");
approx(vessel(done,"v1").doses.H2O.value,85);
approx(vessel(done,"v2").doses.H2O.value,25);
assert.ok(vessel(done,"v1").reagents.includes("H2O"),
 "Partially emptied source keeps its original reagents");
approx(lab.labVesselQuantity(vessel(done,"v2")).availableMl,0);
approx(vessel(done,"v1").doses.H2O.value+
 vessel(done,"v2").doses.H2O.value,110,1e-7);
assert.strictEqual(lab.startLabPour(done,"v1","v2","no-space"),done);
assert.strictEqual(lab.fastLabPour(done,"v1","v2"),done);
const fast=lab.fastLabPour(setup,"v1","v2");
assert.equal(fast.pouring,undefined);
approx(vessel(fast,"v1").doses.H2O.value,85);
approx(vessel(fast,"v2").doses.H2O.value,25);
assert.deepEqual(fast.vessels.map(v=>v.doses),
 done.vessels.map(v=>v.doses),
 "Fast and gradual must result in exactly the same physical quantities");
const direct=lab.pourLabVessel(setup,"v1","v2");
approx(vessel(direct,"v1").doses.H2O.value,85);
approx(vessel(direct,"v2").doses.H2O.value,25);
let mix=lab.defaultLabBench();
mix=lab.putLabReagent(mix,"v1","NaCl",
 {unit:"ml",value:100,concentrationM:.2});
mix=lab.addLabVessel(mix,"tube");
mix=lab.putLabReagent(mix,"v2","NaCl",
 {unit:"ml",value:10,concentrationM:.5});
mix=lab.fastLabPour(mix,"v1","v2");
approx(vessel(mix,"v1").doses.NaCl.value,85);
approx(vessel(mix,"v2").doses.NaCl.value,25);
approx(vessel(mix,"v2").doses.NaCl.concentrationM,
 (10*.5+15*.2)/25,1e-6);
approx(vessel(mix,"v1").doses.NaCl.concentrationM,.2,1e-10);
let stopped=lab.startLabPour(setup,"v1","v2","partial-stop");
for(let i=0;i<4;i++)stopped=lab.advanceLabPour(stopped);
stopped=lab.stopLabPour(stopped);
approx(vessel(stopped,"v1").doses.H2O.value,97);
approx(vessel(stopped,"v2").doses.H2O.value,13);
assert.equal(stopped.pouring,undefined);
const full=lab.putLabReagent(lab.addLabVessel(lab.putLabReagent(
 lab.defaultLabBench(),"v1","H2O",water(100)),"tube"),
 "v2","H2O",water(25));
assert.strictEqual(lab.startLabPour(full,"v1","v2","full"),full);
assert.strictEqual(lab.fastLabPour(full,"v1","v2"),full);
assert.strictEqual(lab.pourLabVessel(full,"v1","v2"),full);
let solid=lab.putLabReagent(lab.addLabVessel(
 lab.putLabReagent(lab.defaultLabBench(),"v1","H2O",water(100)),
 "tube"),"v2","H2O",water(20));
solid=lab.putLabReagent(solid,"v2","NaCl",{unit:"g",value:2});
const free=lab.labVesselQuantity(vessel(solid,"v2")).availableMl;
assert.ok(free>0&&free<5,"Salt displacement reduces free volume");
const solidFill=lab.fastLabPour(solid,"v1","v2");
assert.notStrictEqual(solidFill,solid);
assert.ok(lab.labVesselQuantity(vessel(solidFill,"v2")).occupiedMl<=25.02,
 "The new liquid must not displace beyond the vessel's capacity");
approx(vessel(solidFill,"v1").doses.H2O.value,100-free,.02);
const ui=read("src/LektrusChemistryBench.tsx");
assert.match(ui,/contactTimer\.current=setTimeout\(perform,1000\)/);
assert.doesNotMatch(ui,/setTimeout\(perform,2000\)/);
const model=read("src/lektrusChemistryBenchModel.ts");
assert.match(model,/transferFraction:\s*Math\.round\(transferFraction\*1e12\)\/1e12/);
console.log("Lab limited-capacity pouring: 1s contact, partial/fast/gradual, solids, conservation OK");
