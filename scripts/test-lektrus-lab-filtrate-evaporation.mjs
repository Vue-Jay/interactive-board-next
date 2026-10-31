/** Measured filtrate evaporation, crystallization and re-dissolution.
 * A separated product is not a replay of its historical reaction stocks.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";
const cache=new Map();
function load(file){
 const resolved=path.resolve(file);
 if(cache.has(resolved))return cache.get(resolved).exports;
 const mod={exports:{}};cache.set(resolved,mod);
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
const physical=load("src/lektrusLabEvaporation.ts");
const network=load("src/lektrusLabReactionNetwork.ts");
const eq=(a,b,tol=1e-6)=>assert.ok(Math.abs(a-b)<=tol,a+" vs "+b);
const dose=(value=10)=>({value,unit:"ml",concentrationM:.1});
let bench=lab.defaultLabBench();
bench=lab.putLabReagent(bench,"v1","BaCl2",dose());
bench=lab.putLabReagent(bench,"v1","Na2SO4",dose());
bench=lab.addLabVessel(bench,"conical");
const receiverId=bench.selectedId;
bench=lab.addPlacedLabDevice(bench,"filter");
bench=lab.advanceLabSimulation(bench,1000);
bench=lab.advanceLabSimulation(bench,1500);
bench=lab.advanceLabSimulation(bench,5500);
const separated=lab.filterLabPrecipitate(bench,"v1",receiverId);
assert.notEqual(separated,bench);
const fil=separated.vessels.find(v=>v.id===receiverId);
assert.equal(fil.doses,undefined);
eq(fil.filteredSolution.volumeMl,20);
const mol=fil.chemicalInventory.speciesMol.NaCl;
assert.ok(mol>.00199);
const totalMass=network.labInventoryMassG(network.simulateLabInventory({
 ...fil,volumeMl:lab.labVesselQuantity(fil).volumeMl
}));
console.log("Filtrate species:",JSON.stringify(fil.chemicalInventory.speciesMol));
assert.ok(physical.labVaporPressureKPa(fil,120)>0,
 "Measured NaCl filtrate must expose water vapor without reverting to stock BaCl2");
const first=physical.labEvaporate(fil,10,120,200,160);
assert.ok(first.evaporatedMl>.01,
 "Filtered product solvent, not only starting stock doses, must evaporate");
assert.ok(first.filteredSolution.volumeMl<20);
eq(first.filteredSolution.volumeMl+first.ventedVaporMl.H2O,20,1e-6);
assert.ok(!Object.keys(first.doses).includes("BaCl2")&&
 !Object.keys(first.doses).includes("Na2SO4"),
 "Evaporation cannot recreate original reagents");
const afterFirst={...fil,filteredSolution:first.filteredSolution,
 ventedVaporMl:first.ventedVaporMl};
eq(lab.labVesselQuantity(afterFirst).volumeMl,
 Math.round(first.filteredSolution.volumeMl*100)/100,.01);
eq(afterFirst.chemicalInventory.speciesMol.NaCl,mol,1e-12);

// Carry out 40 school-scale virtual boiling intervals, retaining all emitted
// water in the vented-vapor ledger and every mole of dissolved salt.
let phase=fil,evaporated=0;
for(let i=0;i<50;i++){
 const next=physical.labEvaporate(phase,10,120,200,160);
 if(next.evaporatedMl<=0)break;
 evaporated+=next.evaporatedMl;
 phase={...phase,filteredSolution:next.filteredSolution,
  ventedVaporMl:next.ventedVaporMl,doses:next.doses};
}
assert.ok(evaporated>10,"A sustained heating demonstration removes measurable water");
eq(phase.filteredSolution.volumeMl+(phase.ventedVaporMl.H2O??0),20,.0001);
assert.ok(phase.filteredSolution.volumeMl<20);
const current=network.simulateLabInventory({
 ...phase,volumeMl:lab.labVesselQuantity(phase).volumeMl});
eq(current.speciesMol.NaCl,mol,1e-12);
eq(network.labInventoryMassG(current),totalMass,1e-7);
assert.equal(current.unmeasured.length,0);
assert.deepEqual(current.steps,[],
 "A filtered solution must never spontaneously re-run the original precipitation");
// A concentrated sample with 0.1ml of water cannot dissolve 2mmol of NaCl;
// it should show crystals with exactly the missing solute moles.
const concentrated={...phase,filteredSolution:{
 ...phase.filteredSolution,volumeMl:.1
}};
const crystal=network.simulateLabInventory({...concentrated,volumeMl:.1});
assert.ok((crystal.solidMol.NaCl??0)>0,
 "Salt crystals appear as a decreasing solvent approaches saturation");
assert.ok(crystal.solidMol.NaCl<mol);
eq(crystal.speciesMol.NaCl,mol,1e-12);
eq(network.labInventoryMassG(crystal),totalMass,1e-7);
assert.ok(lab.labVesselContents(concentrated).solid.some(v=>
 v.formula==="NaCl"&&v.massG>0),
 "Visible vessel contents must show the actual crystallized solute");
// Adding a small measured amount of water dissolves the same crystals,
// without resetting or fabricating any NaCl inventory.
const rehydrated=lab.putLabReagent({...separated,
 vessels:separated.vessels.map(v=>v.id===receiverId?concentrated:v)},
 receiverId,"H2O",{unit:"ml",value:20});
const hydrated=rehydrated.vessels.find(v=>v.id===receiverId);
assert.notEqual(rehydrated,separated);
const hydratedInventory=network.simulateLabInventory({
 ...hydrated,volumeMl:lab.labVesselQuantity(hydrated).volumeMl});
eq(hydratedInventory.speciesMol.NaCl,mol,1e-12);
assert.ok((hydratedInventory.solidMol.NaCl??0)<1e-10,
 "Dissolution after adding water is reversible for measured soluble salt");
// A closed flask retains its carrier even when heated.
const corked=physical.labEvaporate({...fil,stoppered:true,
 stopperedAtC:22},10,40,40,0);
assert.equal(corked.evaporatedMl,0);
eq(corked.filteredSolution.volumeMl,20);
// Unknown solute properties do NOT unlock fictitious pure-water evaporation.
const unsupported={...fil,chemicalInventory:{
 ...fil.chemicalInventory,speciesMol:{UnverifiedCompound:.002}
},filteredSolution:{...fil.filteredSolution,solutes:["UnverifiedCompound"]}};
assert.equal(physical.labEvaporate(unsupported,10,80,120,160).evaporatedMl,0,
 "Unverified chemical composition must not be assumed to behave like water");
console.log("Filtrate evaporation: conserved water, dissolved products, salt crystals, rehydration and stopper OK");
