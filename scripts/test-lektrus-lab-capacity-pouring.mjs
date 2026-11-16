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
const stoich=load("src/lektrusLabStoichiometry.ts");
const read=path=>fs.readFileSync(path,"utf8");
const vessel=(b,id)=>b.vessels.find(v=>v.id===id);
const approx=(value,expected,tol=.005)=>assert.ok(
 Math.abs(value-expected)<=tol,value+" !== "+expected);
const water=volume=>({unit:"ml",value:volume});
// Even a trace dose must remain measurable throughout a 20-step transfer.
// Rounding each delta to six decimal places previously created zero-valued
// doses, lost trace solids and accumulated concentration error.
for(const mass of [1e-7,.000003,.00123456789]){
 let trace=lab.putLabReagent(lab.defaultLabBench(),"v1","H2O",water(10));
 trace=lab.putLabReagent(trace,"v1","SiO2",{unit:"g",value:mass});
 trace=lab.addLabVessel(trace,"tube");
 const quick=lab.fastLabPour(trace,"v1","v2");
 let staged=lab.startLabPour(trace,"v1","v2","trace-"+mass);
 for(let i=1;i<=20;i++){
  staged=lab.advanceLabPour(staged);
  assert.equal(staged.pouring?.step,i);
  for(const v of staged.vessels)for(const d of Object.values(v.doses??{}))assert.ok(d.value>0,"No zero dose on the board");
  approx((vessel(staged,"v1").doses?.SiO2?.value??0)+(vessel(staged,"v2").doses?.SiO2?.value??0),mass,1e-15);
 }
 approx(vessel(staged,"v2").doses.SiO2.value,mass,1e-15);
 approx(vessel(quick,"v2").doses.SiO2.value,mass,1e-15);
}
{
 let mixture=lab.putLabReagent(lab.defaultLabBench(),"v1","NaCl",{unit:"ml",value:17.23,concentrationM:.137321});
 mixture=lab.addLabVessel(mixture,"tube");
 mixture=lab.putLabReagent(mixture,"v2","NaCl",{unit:"ml",value:10.17,concentrationM:.861237});
 const moles=b=>b.vessels.reduce((sum,v)=>sum+(v.doses?.NaCl?stoich.labDoseMoles("NaCl",v.doses.NaCl):0),0);
 const initial=moles(mixture),quick=lab.fastLabPour(mixture,"v1","v2");
 let staged=lab.startLabPour(mixture,"v1","v2","exact-molarity");
 for(let i=1;i<=20;i++){
  staged=lab.advanceLabPour(staged);
  assert.equal(staged.pouring?.step,i);
  approx(moles(staged),initial,1e-12);
 }
 approx(moles(quick),initial,1e-12);
 approx(vessel(staged,"v2").doses.NaCl.concentrationM,vessel(quick,"v2").doses.NaCl.concentrationM,1e-12);
}
// With the clock paused, moving a slurry cannot magically dissolve its
// visible crystals. Every portion moves the same fraction of each phase.
for(const formulas of [["NaCl"],["NaCl","KNO3"]]){
 let salt=lab.putLabReagent(lab.defaultLabBench(),"v1","H2O",water(20));
 for(const formula of formulas)salt=lab.putLabReagent(salt,"v1",formula,{unit:"g",value:2});
 salt=lab.addLabVessel(salt,"beaker");
 salt=lab.putLabReagent(salt,"v2","H2O",water(10));
 const solidMass=(b,id,formula)=>lab.labVesselContents(vessel(b,id)).solid.find(s=>s.formula===formula)?.massG??0;
 const initial=Object.fromEntries(formulas.map(f=>[f,solidMass(salt,"v1",f)]));
 assert.ok(formulas.every(f=>initial[f]>0));
 let staged=lab.startLabPour(salt,"v1","v2","salt-slurry");
 for(let i=1;i<=20;i++){
  staged=lab.advanceLabPour(staged);
  assert.equal(staged.pouring?.step,i);
  for(const f of formulas){
   approx(solidMass(staged,"v1",f),initial[f]*(1-i/20),1e-7);
   approx(solidMass(staged,"v2",f),initial[f]*i/20,1e-7);
  }
 }
 for(const method of [lab.fastLabPour,lab.pourLabVessel]){
  const moved=method(salt,"v1","v2");
  for(const f of formulas)approx(solidMass(moved,"v2",f),initial[f],1e-7);
  assert.equal(vessel(moved,"v1").binarySaltPhase,undefined);
  assert.equal(vessel(moved,"v1").mixedSaltPhase,undefined);
 }
 assert.equal(vessel(staged,"v1").physicalProcess,undefined);
 assert.equal(vessel(staged,"v2").physicalProcess,"dissolving");
}
// Measured gas samples reserve headspace as well as liquid/solid volume.
// Liquid dosing, pipetting and pouring must share the same capacity limit.
let gasCapacity=lab.putLabReagent(lab.defaultLabBench(),"v1","H2O",water(20));
gasCapacity=lab.addLabVessel(gasCapacity,"tube");
gasCapacity=lab.putLabReagent(gasCapacity,"v2","N2",{unit:"ml",value:20});
assert.equal(lab.labVesselQuantity(vessel(gasCapacity,"v2")).availableMl,5);
assert.equal(lab.labGasReceiverFreeMl(vessel(gasCapacity,"v2")),5);
assert.strictEqual(lab.putLabReagent(gasCapacity,"v2","H2O",water(6)),gasCapacity);
assert.strictEqual(lab.transferLabMeasuredLiquid(gasCapacity,"v1","v2",6),gasCapacity);
const gasFill=lab.fastLabPour(gasCapacity,"v1","v2");
approx(lab.labVesselQuantity(vessel(gasFill,"v2")).volumeMl,5);
approx(lab.labGasStoredMl(vessel(gasFill,"v2")),20);
assert.equal(lab.labVesselQuantity(vessel(gasFill,"v2")).availableMl,0);
assert.equal(lab.labGasReceiverFreeMl(vessel(gasFill,"v2")),0);
approx(vessel(gasFill,"v1").doses.H2O.value,15);
let setup=lab.setLabSimulationPaused(lab.defaultLabBench(),false,0);
setup=lab.putLabReagent(setup,"v1","H2O",water(100));
setup=lab.addLabVessel(setup,"tube");
setup=lab.putLabReagent(setup,"v2","H2O",water(10));
assert.equal(lab.labVesselQuantity(vessel(setup,"v2")).capacityMl,25);
assert.equal(lab.labVesselQuantity(vessel(setup,"v2")).availableMl,15);
const started=lab.startLabPour(setup,"v1","v2","cap-gradual");
assert.ok(started.pouring,"Must be able to begin even when source > free capacity");
approx(started.pouring.transferFraction,.15,1e-10);
// While an animated pour is pending, a second action can change the
// physical state. Stop rather than resurrect or overfill material.
const firstPortion=lab.advanceLabPour(started);
const filledWhilePouring=lab.putLabReagent(firstPortion,"v2","H2O",water(14.25));
const stoppedAtRim=lab.advanceLabPour(filledWhilePouring);
assert.equal(stoppedAtRim.pouring,undefined);
assert.deepEqual(stoppedAtRim.vessels,filledWhilePouring.vessels);
const newStock=lab.putLabReagent(firstPortion,"v1","NaCl",{unit:"g",value:1});
const interrupted=lab.advanceLabPour(newStock,19);
assert.equal(interrupted.pouring,undefined);
assert.deepEqual(interrupted.vessels,newStock.vessels,"Do not erase a new stock during an old pour");
let corkTest=lab.addLabVessel(setup,"flask");
corkTest=lab.startLabPour(corkTest,"v1","v3","corked-mid-pour");
corkTest=lab.setLabVesselStopper(corkTest,"v3",true);
assert.equal(lab.advanceLabPour(corkTest).pouring,undefined);
assert.deepEqual(lab.advanceLabPour(corkTest).vessels,corkTest.vessels);
const washed=lab.emptyLabVessel(firstPortion,"v2");
assert.equal(washed.pouring,undefined,"Washing receiver stops the old pour");
assert.equal(lab.advanceLabPour(washed),washed);
const stalePortion=lab.advanceLabPour(firstPortion);
for(const [local,remote] of [[washed,stalePortion],[stalePortion,washed]]){
 const merged=lab.mergeLabBench(firstPortion,local,remote);
 assert.equal(merged.pouring,undefined,"Stale peer tick cannot resume a cancelled pour");
 assert.equal(vessel(merged,"v1").doses.H2O.value,vessel(washed,"v1").doses.H2O.value);
 assert.deepEqual(vessel(merged,"v2").reagents,[]);
 assert.equal(vessel(merged,"v2").doses,undefined);
}
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
let mix=lab.setLabSimulationPaused(lab.defaultLabBench(),false,0);
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
 lab.setLabSimulationPaused(lab.defaultLabBench(),false,0),"v1","H2O",water(100)),"tube"),
 "v2","H2O",water(25));
assert.strictEqual(lab.startLabPour(full,"v1","v2","full"),full);
assert.strictEqual(lab.fastLabPour(full,"v1","v2"),full);
assert.strictEqual(lab.pourLabVessel(full,"v1","v2"),full);
let solid=lab.putLabReagent(lab.addLabVessel(
 lab.putLabReagent(lab.setLabSimulationPaused(lab.defaultLabBench(),false,0),"v1","H2O",water(100)),
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
