/** Verify transfer uses real reaction products, not original stock labels,
 * and fast pouring does not repeatedly recalculate an equilibrium. */
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
const chemical=load("src/lektrusLabReactionNetwork.ts");
const stoich=load("src/lektrusLabStoichiometry.ts");
const dose=(volume=10,molarity=.1)=>({unit:"ml",value:volume,concentrationM:molarity});
const approx=(a,b,tol=1e-6)=>assert.ok(Math.abs(a-b)<=tol,a+" != "+b);
const qty=(bench,id)=>bench.vessels.find(v=>v.id===id);
let transfer=lab.addLabVessel(lab.defaultLabBench(),"beaker");
transfer=lab.putLabReagent(transfer,"v1","NaCl",dose(10,.1));
const moved=lab.fastLabPour(transfer,"v1","v2");
assert.equal(moved.pouring,undefined);
assert.equal(qty(moved,"v1").reagents.length,0);
assert.equal(qty(moved,"v2").doses.NaCl.value,10);
// The hot source and cold receiver exchange sensible heat. Mixing 10 ml
// of the same pure liquid at 80C with 10 ml at 20C gives about 50C;
// no vessel is allowed to remain at the old 20C after a complete transfer.
let thermal=lab.defaultLabBench();
thermal=lab.putLabReagent(thermal,"v1","H2O",{value:10,unit:"ml"});
thermal=lab.addLabVessel(thermal,"beaker");
thermal=lab.putLabReagent(thermal,"v2","H2O",{value:10,unit:"ml"});
thermal={...thermal,vessels:thermal.vessels.map(v=>({
 ...v,temperatureC:v.id==="v1"?80:20
}))};
const thermalFast=lab.fastLabPour(thermal,"v1","v2");
approx(qty(thermalFast,"v2").temperatureC,50,.11);
const thermalDirect=lab.pourLabVessel(thermal,"v1","v2");
approx(qty(thermalDirect,"v2").temperatureC,50,.11);
let thermalGradual=lab.startLabPour(thermal,"v1","v2","gradual-heat");
for(let index=0;index<lab.LAB_POUR_STEPS;index++)
 thermalGradual=lab.advanceLabPour(thermalGradual);
approx(qty(thermalGradual,"v2").temperatureC,50,.31);
assert.ok(qty(thermalFast,"v2").temperatureC<80&&
 qty(thermalFast,"v2").temperatureC>20);

// A same-solute solution must be mixed using measured concentration and volume.
let mixed=lab.putLabReagent(transfer,"v2","NaCl",dose(8,.3));
mixed=lab.fastLabPour(mixed,"v1","v2");
approx(qty(mixed,"v2").doses.NaCl.value,18);
approx(qty(mixed,"v2").doses.NaCl.concentrationM,
 (10*.1+8*.3)/18,2e-6);
let gradual=lab.startLabPour(transfer,"v1","v2","gradual-accuracy");
assert.ok(gradual.pouring);
for(let index=0;index<lab.LAB_POUR_STEPS;index++)
 gradual=lab.advanceLabPour(gradual);
gradual=lab.stopLabPour(gradual);
approx(qty(gradual,"v2").doses.NaCl.value,qty(moved,"v2").doses.NaCl.value);
approx(qty(gradual,"v1").doses?.NaCl?.value??0,0);
assert.equal(lab.fastLabPour(moved,"v1","v2"),moved,
 "Transfer of an emptied source should preserve the unchanged board");

const reagents=["BaCl2","Na2SO4"];
let reacted=lab.defaultLabBench();
for(const id of reagents)reacted=lab.putLabReagent(reacted,"v1",id,dose(10,.1));
reacted=lab.addLabVessel(reacted,"beaker");
const sourceId="v1",targetId="v2";
// Before completion, sampling a partly-reacted vessel as if it were fully
// equilibrated would invent precipitate and gas yields.
const premature={...reacted,vessels:reacted.vessels.map(v=>v.id!==sourceId?v:{
 ...v,reactionAmounts:{equation:"BaCl2 + Na2SO4 → BaSO4↓ + 2 NaCl",
  complete:false,elapsedSeconds:1,productsMol:{},remainingMol:{}}
})};
assert.equal(lab.startLabPour(premature,sourceId,targetId,"in-progress"),premature);
assert.equal(lab.pourLabVessel(premature,sourceId,targetId),premature);
reacted=lab.advanceLabSimulation(reacted,1000);
for(let at=11000;at<=131000;at+=10000){
 if(qty(reacted,sourceId).reactionAmounts?.complete)break;
 reacted=lab.advanceLabSimulation(reacted,at);
}
assert.ok(qty(reacted,sourceId).reactionAmounts?.complete,
 "The reviewed precipitation must finish with measured quantities");
const before=chemical.simulateLabInventory(qty(reacted,sourceId));
const mass=chemical.labInventoryMassG(before);
assert.ok((before.solidMol.BaSO4??0)>0,"Barium sulfate is precipitated");
assert.ok((before.speciesMol.NaCl??0)>.0019,"Sodium chloride is formed");
const poured=lab.fastLabPour(reacted,sourceId,targetId);
assert.notEqual(poured,reacted);
assert.equal(poured.pouring,undefined);
assert.equal(qty(poured,sourceId).reagents.length,0);
const products=qty(poured,targetId);
assert.ok(products.chemicalInventory,
 "Finished reaction transfers an exact molecular ledger, not fresh stock history");
const after=chemical.simulateLabInventory({...products,
 volumeMl:lab.labVesselQuantity(products).volumeMl});
approx(chemical.labInventoryMassG(after),mass,1e-7);
approx(after.speciesMol.NaCl,before.speciesMol.NaCl,1e-9);
approx(after.solidMol.BaSO4,before.solidMol.BaSO4,1e-9);
// Subsequent chemistry consumes already formed NaCl; it must never reconstruct
// an original unreacted BaCl2/Na2SO4 mixture.
const second=lab.putLabReagent(poured,targetId,"AgNO3",dose(20,.1));
assert.notEqual(second,poured);
const secondState=chemical.simulateLabInventory({...qty(second,targetId),
 volumeMl:lab.labVesselQuantity(qty(second,targetId)).volumeMl});
assert.ok((secondState.solidMol.AgCl??0)>.0019,
 "Silver chloride forms from REAL retained chloride ions");
assert.ok((secondState.solidMol.BaSO4??0)>0,
 "Existing barium sulfate precipitate is not erased by a second reaction");
const receivedMass=mass+.002*stoich.labMolarMass("AgNO3");
approx(chemical.labInventoryMassG(secondState),receivedMass,1e-5);
// A second occupied recipient with completed chemistry also takes the
// conserved-ledger path instead of replaying both sets of starting stocks.
const another=lab.addLabVessel(second,"tube");
assert.ok(another.vessels.length>=3);
// The same immutable lab revision must normalize equipment exactly once,
// even when six simultaneous vessels ask for heating and stand placement.
const equipment=lab.addPlacedLabDevice(lab.defaultLabBench(),"hotplate");
assert.strictEqual(lab.placedLabDevices(equipment),lab.placedLabDevices(equipment));
const movedEquipment=lab.movePlacedLabDevice(equipment,equipment.placedDevices[0].id,45,70);
assert.notStrictEqual(lab.placedLabDevices(equipment),lab.placedLabDevices(movedEquipment));
assert.equal(lab.placedLabDevices(movedEquipment)[0].x,45);
// An endothermic demonstration can cool a solution to 10°C. Ambient air
// restores temperature gradually; there must be no instantaneous jump to 22°C
// and the adaptive clock must continue while the vessel is cold.
const coldStock=lab.putLabReagent(lab.defaultLabBench(),"v1","H2O",{value:20,unit:"ml"});
const coldBench={...coldStock,simulationAtMs:1000,vessels:coldStock.vessels.map(v=>({
 ...v,temperatureC:10
}))};
assert.equal(lab.labSimulationTickWaitMs(coldBench,1000),2600,
 "Simple mode uses a slower low-cost thermal tick");
assert.equal(lab.labSimulationTickWaitMs(
 lab.setLabBenchSettings(coldBench,{realism:"high"}),1000),1900,
 "High realism retains the detailed thermal cadence");
const recovering=lab.advanceLabSimulation(coldBench,2900);
assert.ok(recovering.vessels[0].temperatureC>=10&&
 recovering.vessels[0].temperatureC<22,
 "Endothermic cooling must recover through finite ambient heat exchange");
assert.ok(lab.labSimulationTickWaitMs(recovering,2900)>0,
 "A cooled solution must not lose its scheduled ambient thermal updates");

const dormant=lab.defaultLabBench().vessels[0];
assert.equal(lab.labReactionNeedsTick(dormant),false);
assert.equal(lab.labReactionNeedsTick(dormant),false);
console.log("Laboratory transfers: fast path, measured products, secondary reaction and conservation OK");
