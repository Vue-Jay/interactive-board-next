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
// Real liquid-only sampling: measured solid phase stays in the donor,
// including powder suspended in plain water, visible crystals and gas.
{
 let suspension=lab.putLabReagent(lab.defaultLabBench(),"v1","H2O",{unit:"ml",value:20});
 suspension=lab.putLabReagent(suspension,"v1","SiO2",{unit:"g",value:3});
 suspension=lab.putLabReagent(suspension,"v1","N2",stoich.labGasDose("N2",10));
 suspension=lab.addLabVessel(suspension,"pipette");
 const sampled=lab.transferLabMeasuredLiquid(suspension,"v1","v2",20);
 assert.notEqual(sampled,suspension,"A pipette can collect liquid above settled powder");
 const donor=qty(sampled,"v1"),recipient=qty(sampled,"v2");
 approx(lab.labVesselQuantity(donor).volumeMl,0);
 approx(lab.labVesselQuantity(recipient).volumeMl,20);
 approx(lab.labGasStoredMl(donor),10);
 approx(lab.labGasStoredMl(recipient),0);
 assert.equal(donor.environment,"dry");
 assert.ok(lab.labVesselContents(donor).solid.some(s=>s.formula==="SiO2"&&Math.abs(s.massG-3)<1e-7));
 assert.ok(!recipient.reagents.includes("SiO2")&&!recipient.reagents.includes("N2"));
}
{
 // Persisted product ledger with a consumed gaseous stock left in the dose
 // history. Emptying its liquid phase must not resurrect that stock.
 let reacted=lab.putLabReagent(lab.defaultLabBench(),"v1","H2O",{unit:"ml",value:20});
 const v=qty(reacted,"v1");
 reacted={...reacted,vessels:[{...v,reagents:["H2O","NaCl"],
  doses:{...v.doses,HCl:stoich.labGasDose("HCl",5)},
  chemicalInventory:{speciesMol:{H2O:stoich.labDoseMoles("H2O",v.doses.H2O),NaCl:.001},
   solidMol:{},settled:true}}]};
 approx(lab.labGasStoredMl(qty(reacted,"v1")),0);
 reacted=lab.addLabVessel(reacted,"pipette");
 const sampled=lab.transferLabMeasuredLiquid(reacted,"v1","v2",20);
 assert.notEqual(sampled,reacted);
 const donor=qty(sampled,"v1");
 assert.equal(donor.doses?.HCl,undefined,"Consumed gas must not be resurrected by sampling");
 approx(lab.labGasStoredMl(donor),0);
 approx(chemical.simulateLabInventory(qty(sampled,"v2")).speciesMol.NaCl,.001);
}
{
 let precipitated=lab.putLabReagent(lab.defaultLabBench(),"v1","HCl",dose());
 precipitated=lab.putLabReagent(precipitated,"v1","AgNO3",dose());
 precipitated=lab.setLabSimulationPaused(precipitated,false,1000);
 for(let t=2000;t<=15000;t+=1000)precipitated=lab.advanceLabSimulation(precipitated,t);
 const before=qty(precipitated,"v1"),precipitate=lab.labVesselContents(before).solid.find(s=>s.formula==="AgCl");
 assert.ok(precipitate?.massG>0);
 precipitated=lab.addLabVessel(precipitated,"pipette");
 const sampled=lab.transferLabMeasuredLiquid(precipitated,"v1","v2",20);
 assert.notEqual(sampled,precipitated);
 const residue=qty(sampled,"v1");
 approx(lab.labVesselQuantity(residue).volumeMl,0);
 approx(lab.labVesselQuantity(residue).massG,0); // no historical weighed stock
 approx(lab.labVesselContents(residue).solid.find(s=>s.formula==="AgCl").massG,precipitate.massG,1e-9);
 approx(lab.labVesselQuantity(qty(sampled,"v2")).volumeMl,20);
 assert.equal(lab.labVesselContents(qty(sampled,"v2")).solid.length,0);
}
for(const formulas of [["NaCl"],["NaCl","KNO3"],["CuSO4"]]){
 let salt=lab.putLabReagent(lab.defaultLabBench(),"v1","H2O",{unit:"ml",value:20});
 for(const formula of formulas)salt=lab.putLabReagent(salt,"v1",formula,{unit:"g",value:2});
 salt=lab.setLabSimulationPaused(salt,false,1000);
 for(let t=2000;t<=6000;t+=1000)salt=lab.advanceLabSimulation(salt,t);
 const before=qty(salt,"v1"),contents=lab.labVesselContents(before);
 const currentSolid=Object.fromEntries(formulas.map(formula=>[formula,
  (contents.solid.find(s=>s.formula===formula)?.massG??0)/stoich.labMolarMass(formula)]));
 assert.ok(formulas.some(formula=>currentSolid[formula]<2/stoich.labMolarMass(formula)),"Default realism must actually dissolve salts: "+formulas.join(","));
 const split=lab.addLabVessel(salt,"pipette");
 const sampled=lab.transferLabMeasuredLiquid(split,"v1","v2",5);
 assert.notEqual(sampled,split,"Soluble fraction can be sampled independently");
 for(const formula of formulas){
  const total=2/stoich.labMolarMass(formula),taken=(total-currentSolid[formula])*.25;
  const donor=chemical.simulateLabInventory(qty(sampled,"v1"));
  const recipient=chemical.simulateLabInventory(qty(sampled,"v2"));
  approx(recipient.speciesMol[formula]??0,taken,1e-9);
  approx((donor.speciesMol[formula]??0)+(recipient.speciesMol[formula]??0),total,1e-9);
  approx(donor.solidMol[formula]??0,currentSolid[formula],1e-9);
  approx(recipient.solidMol[formula]??0,0,1e-9);
 }
 let advanced=sampled;
 for(let t=7000;t<=186000;t+=1000)advanced=lab.advanceLabSimulation(advanced,t);
 const v=qty(advanced,"v1");
 assert.ok(!v.physicalProcess,"Dissolution must finish after sampling");
 for(const formula of formulas)assert.ok((chemical.simulateLabInventory(v).speciesMol[formula]??0)>0);
}
{
 let dissolved=lab.putLabReagent(lab.defaultLabBench(),"v1","H2O",{unit:"ml",value:20});
 dissolved=lab.putLabReagent(dissolved,"v1","NaCl",{unit:"g",value:1});
 dissolved=lab.setLabSimulationPaused(dissolved,false,1000);
 for(let t=2000;t<=181000;t+=1000)dissolved=lab.advanceLabSimulation(dissolved,t);
 assert.equal(qty(dissolved,"v1").binarySaltPhase.solidMol,0,"No permanent phantom microcrystals");
 dissolved=lab.setLabIndicator(dissolved,"v1","phenolphthalein");
 dissolved=lab.addLabVessel(dissolved,"pipette");
 const moved=lab.transferLabMeasuredLiquid(dissolved,"v1","v2",20);
 const empty=qty(moved,"v1");
 assert.deepEqual(empty.reagents,[]);
 assert.equal(empty.doses,undefined,"Empty donor cannot keep historical dry mass");
 assert.equal(empty.binarySaltPhase,undefined);
 assert.equal(empty.indicator,undefined);
 approx(chemical.simulateLabInventory(qty(moved,"v2")).speciesMol.NaCl,1/stoich.labMolarMass("NaCl"),1e-9);
}
// The school cabinet offers both weighed and prepared forms for many salts.
// Combining them must preserve moles, solvent volume and actual crystal mass.
const drySalt={unit:"g",value:5};
const aqueousSalt=dose(10,.1);
const expectedSaltMol=5/stoich.labMolarMass("NaCl")+.001;
for(const [a,b] of [[drySalt,aqueousSalt],[aqueousSalt,drySalt]]){
 let mix=lab.putLabReagent(lab.defaultLabBench(),"v1","NaCl",a);
 mix=lab.putLabReagent(mix,"v1","NaCl",b);
 let v=qty(mix,"v1");
 approx(lab.labVesselQuantity(v).volumeMl,10);
 approx(v.chemicalInventory.speciesMol.NaCl,expectedSaltMol,1e-10);
 approx(v.binarySaltPhase.solidMol,5/stoich.labMolarMass("NaCl"),1e-10);
 assert.equal(v.physicalProcess,"dissolving");
 mix=lab.setLabSimulationPaused(mix,false,1000);
 for(let t=2000;t<=181000;t+=1000)mix=lab.advanceLabSimulation(mix,t);
 v=qty(mix,"v1");
 const phase=chemical.simulateLabInventory(v);
 approx(phase.speciesMol.NaCl,expectedSaltMol,1e-10);
 assert.ok(phase.solidMol.NaCl>0&&phase.solidMol.NaCl<5/stoich.labMolarMass("NaCl"),"Excess salt remains as real crystals");
 assert.ok(lab.labVesselContents(v).solid.some(s=>s.formula==="NaCl"&&s.massG>0));
 mix=lab.putLabReagent(mix,"v1","H2O",{unit:"ml",value:30});
 for(let t=182000;t<=361000;t+=1000)mix=lab.advanceLabSimulation(mix,t);
 v=qty(mix,"v1");
 approx(chemical.simulateLabInventory(v).speciesMol.NaCl,expectedSaltMol,1e-10);
 assert.ok((chemical.simulateLabInventory(v).solidMol.NaCl??0)<1e-4,"Dilution dissolves remaining crystals");
}
{
let concentrated=lab.putLabReagent(lab.defaultLabBench(),"v1","NaCl",drySalt);
concentrated=lab.putLabReagent(concentrated,"v1","NaCl",aqueousSalt);
const originalMixed=qty(concentrated,"v1");
const evaporation=load("src/lektrusLabEvaporation.ts");
const evaporated=evaporation.labEvaporate(originalMixed,10,100,150,150);
assert.ok(evaporated.evaporatedMl>0,"Mixed stock carrier can evaporate");
approx(evaporated.filteredSolution.volumeMl+evaporated.ventedVaporMl.H2O,10,1e-7);
const dryReadback={...originalMixed,environment:"dry",filteredSolution:{...originalMixed.filteredSolution,volumeMl:0},
 binarySaltPhase:{formula:"NaCl",solidMol:0}};
approx(chemical.simulateLabInventory(dryReadback).solidMol.NaCl,expectedSaltMol,1e-10);
// A later reagent must react with the real accumulated salt, not merely the
// original dilute stock concentration or the most recent powder dose.
const reacting=lab.putLabReagent(concentrated,"v1","AgNO3",dose(10,.1));
assert.ok(qty(reacting,"v1").pendingInventoryReaction);
let progressed=lab.setLabSimulationPaused(reacting,false,1000);
for(let t=2000;t<=25000;t+=1000)progressed=lab.advanceLabSimulation(progressed,t);
const products=chemical.simulateLabInventory(qty(progressed,"v1"));
assert.ok(products.solidMol.AgCl>.00099);
approx(chemical.labInventoryMassG(products),expectedSaltMol*stoich.labMolarMass("NaCl")+
 .001*stoich.labMolarMass("AgNO3"),1e-7);
}
let transfer=lab.addLabVessel(lab.setLabSimulationPaused(lab.defaultLabBench(),false,0),"beaker");
transfer=lab.putLabReagent(transfer,"v1","NaCl",dose(10,.1));
const moved=lab.fastLabPour(transfer,"v1","v2");
assert.equal(moved.pouring,undefined);
assert.equal(qty(moved,"v1").reagents.length,0);
assert.equal(qty(moved,"v2").doses.NaCl.value,10);
// The hot source and cold receiver exchange sensible heat. Mixing 10 ml
// of the same pure liquid at 80C with 10 ml at 20C gives about 50C;
// no vessel is allowed to remain at the old 20C after a complete transfer.
let thermal=lab.setLabSimulationPaused(lab.defaultLabBench(),false,0);
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
// A pipette or cylinder sample is a real thermal transfer too, including
// when either vessel has a persistent measured reaction inventory.
const thermalSample=lab.transferLabMeasuredLiquid(thermal,"v1","v2",5);
approx(qty(thermalSample,"v2").temperatureC,40,.11);
approx(qty(thermalSample,"v1").temperatureC,80,.11);
const snapshotThermal={...thermal,vessels:thermal.vessels.map(v=>v.id!=="v1"?v:{
 ...v,chemicalInventory:chemical.labInventorySnapshot(chemical.simulateLabInventory(v))})};
const snapshotSample=lab.transferLabMeasuredLiquid(snapshotThermal,"v1","v2",5);
approx(qty(snapshotSample,"v2").temperatureC,40,.11);
approx(qty(snapshotSample,"v1").temperatureC,80,.11);

// A measured liquid sample must respect solid displacement and must not
// silently turn a pre-existing same-formula gas sample into liquid.
let solidReceiver=lab.addLabVessel(thermal,"tube");
solidReceiver=lab.putLabReagent(solidReceiver,"v3","NaCl",{value:5,unit:"g"});
solidReceiver=lab.putLabReagent(solidReceiver,"v3","H2O",{value:21,unit:"ml"});
const free=lab.labVesselQuantity(qty(solidReceiver,"v3")).availableMl;
assert.ok(free<4);
assert.strictEqual(lab.transferLabMeasuredLiquid(solidReceiver,"v1","v3",4),solidReceiver);
const gasReceiver=lab.putLabReagent(lab.addLabVessel(thermal,"flask"),"v3","H2O",stoich.labGasDose("H2O",5));
assert.strictEqual(lab.transferLabMeasuredLiquid(gasReceiver,"v1","v3",5),gasReceiver);

// Aqueous sample added to a dry receiver should select the actual solvent
// medium so the reviewed chemical reaction is not lost by pipetting.
let medium=lab.addLabVessel(lab.defaultLabBench(),"beaker");
medium=lab.putLabReagent(medium,"v1","HCl",dose(10,.1));
medium=lab.putLabReagent(medium,"v2","NaHCO3",{value:.1,unit:"g"});
medium=lab.transferLabMeasuredLiquid(medium,"v1","v2",5);
assert.equal(qty(medium,"v2").environment,"aqueous");
assert.equal(lab.labObservation(qty(medium,"v2")).caseData?.observation,"gas");

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
let reacted=lab.setLabSimulationPaused(lab.defaultLabBench(),false,0);
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
const equipment=lab.addPlacedLabDevice(lab.setLabSimulationPaused(lab.defaultLabBench(),false,0),"hotplate");
assert.strictEqual(lab.placedLabDevices(equipment),lab.placedLabDevices(equipment));
const movedEquipment=lab.movePlacedLabDevice(equipment,equipment.placedDevices[0].id,45,70);
assert.notStrictEqual(lab.placedLabDevices(equipment),lab.placedLabDevices(movedEquipment));
assert.equal(lab.placedLabDevices(movedEquipment)[0].x,45);
// An endothermic demonstration can cool a solution to 10°C. Ambient air
// restores temperature gradually; there must be no instantaneous jump to 22°C
// and the adaptive clock must continue while the vessel is cold.
const coldStock=lab.putLabReagent(lab.setLabSimulationPaused(lab.defaultLabBench(),false,0),"v1","H2O",{value:20,unit:"ml"});
const coldBench={...coldStock,simulationAtMs:1000,vessels:coldStock.vessels.map(v=>({
 ...v,temperatureC:10
}))};
assert.equal(lab.labSimulationTickWaitMs(coldBench,1000),2600,
 "Simple realism uses a lower-cost thermal update interval");
assert.equal(lab.labSimulationTickWaitMs(
 lab.setLabBenchSettings(coldBench,{realism:"high"}),1000),1900,
 "High realism retains the more detailed thermal cadence");
const recovering=lab.advanceLabSimulation(coldBench,2900);
assert.ok(recovering.vessels[0].temperatureC>=10&&
 recovering.vessels[0].temperatureC<22,
 "Endothermic cooling must recover through finite ambient heat exchange");
assert.ok(lab.labSimulationTickWaitMs(recovering,2900)>0,
 "A cooled solution must not lose its scheduled ambient thermal updates");

const dormant=lab.setLabSimulationPaused(lab.defaultLabBench(),false,0).vessels[0];
assert.equal(lab.labReactionNeedsTick(dormant),false);
assert.equal(lab.labReactionNeedsTick(dormant),false);
console.log("Laboratory transfers: fast path, measured products, secondary reaction and conservation OK");

// A measured sample must behave like the same reagent portion added from
// the cabinet, across all supported liquid stocks and receiver stock forms.
// An already running single-stock demonstration is tested separately.
const database=load("src/lektrusReactionDatabase.ts");
const cabinet=load("src/lektrusLabCatalog.ts");
const stocks=database.substances.flatMap(s=>cabinet.labReagentForms(s).map(unit=>
 [s.id,cabinet.labDefaultStockDose(s.id,unit)]));
const liquids=stocks.filter(([id,d])=>d.unit==="ml"&&!stoich.labIsGasDose(id,d));
let suspensionCases=0;
for(const [id,powder] of stocks.filter(([,d])=>d.unit==="g")){
 let source=lab.putLabReagent(lab.defaultLabBench(),"v1","H2O",{unit:"ml",value:20});
 source=lab.putLabReagent(source,"v1",id,powder);
 const before=qty(source,"v1");
 // Still-reacting substances require the separate reaction/pause fixtures.
 if(lab.labObservation(before).status==="reaction"||before.pendingInventoryReaction)continue;
 const total=stoich.labDoseMoles(id,powder);
 const solid=(lab.labVesselContents(before).solid.find(s=>s.formula===id)?.massG??0)/stoich.labMolarMass(id);
 source=lab.addLabVessel(source,"pipette");
 const moved=lab.transferLabMeasuredLiquid(source,"v1","v2",5);
 assert.notEqual(moved,source,id+": liquid-only sample from measured suspension");
 const from=chemical.simulateLabInventory(qty(moved,"v1"));
 const into=chemical.simulateLabInventory(qty(moved,"v2"));
 approx((from.speciesMol[id]??0)+(into.speciesMol[id]??0),total,1e-9);
 approx(into.speciesMol[id]??0,(total-solid)*.25,1e-9);
 approx(into.solidMol[id]??0,0,1e-9);
 suspensionCases++;
}
console.log(`Nonreacting powder/water sampling matrix: ${suspensionCases} cabinet stocks`);
const dualStocks=database.substances.filter(s=>cabinet.labReagentForms(s).length===2);
let stockCases=0;
for(const stock of dualStocks){
 const id=stock.id,solid=cabinet.labDefaultStockDose(id,"g"),liquid=cabinet.labDefaultStockDose(id,"ml");
 const expected=stoich.labDoseMoles(id,solid)+stoich.labDoseMoles(id,liquid);
 for(const [a,b] of [[solid,liquid],[liquid,solid]]){
  const base=lab.putLabReagent(lab.defaultLabBench(),"v1",id,a);
  const mixed=lab.putLabReagent(base,"v1",id,b);
  assert.notEqual(mixed,base,id+": mixed stock must be accepted");
  approx(chemical.simulateLabInventory(qty(mixed,"v1")).speciesMol[id],expected,1e-10);
  approx(lab.labVesselQuantity(qty(mixed,"v1")).volumeMl,liquid.value);
  let split=lab.addLabVessel(base,"beaker");
  split=lab.putLabReagent(split,"v2",id,b);
  for(const move of [lab.pourLabVessel,lab.fastLabPour]){
   const joined=move(split,"v1","v2");
   assert.notEqual(joined,split,id+": mixed stock pour must be accepted");
   approx(chemical.simulateLabInventory(qty(joined,"v2")).speciesMol[id],expected,1e-10);
   approx(lab.labVesselQuantity(qty(joined,"v2")).volumeMl,liquid.value);
   stockCases++;
  }
  if(a.unit==="ml"){
   const sampled=lab.transferLabMeasuredLiquid(split,"v1","v2",5);
   assert.notEqual(sampled,split,id+": solution to weighed stock sample");
   const total=sampled.vessels.reduce((sum,v)=>sum+(chemical.simulateLabInventory(v).speciesMol[id]??0),0);
   approx(total,expected,1e-10);
   approx(lab.labVesselQuantity(qty(sampled,"v2")).volumeMl,5);
   stockCases++;
  }
  stockCases++;
 }
}
console.log(`Solid + prepared solution matrix: ${dualStocks.length} compounds, ${stockCases} scenarios`);
let sampled=0;const sampleIssues=[];
for(const [sourceId,stock] of liquids){
 const sourceDose={...stock,value:10};
 const seed=lab.putLabReagent(lab.addLabVessel(lab.defaultLabBench(),"beaker"),"v1",sourceId,sourceDose);
 if(lab.labReactionNeedsTick(qty(seed,"v1")))continue;
 for(const [targetId,targetStock] of stocks){
  const ready=lab.putLabReagent(seed,"v2",targetId,targetStock);
  if(lab.labReactionNeedsTick(qty(ready,"v2")))continue;
  const direct=lab.putLabReagent(ready,"v2",sourceId,{...sourceDose,value:5});
  const moved=lab.transferLabMeasuredLiquid(ready,"v1","v2",5);
  if(direct===ready)continue;
  const a=qty(direct,"v2"),b=qty(moved,"v2");sampled++;
  const actual=chemical.simulateLabInventory(b),expected=chemical.simulateLabInventory(a);
  if(moved===ready||a.environment!==b.environment||
   Math.abs(chemical.labInventoryMassG(actual)-chemical.labInventoryMassG(expected))>1e-7||
   lab.labReactionNeedsTick(a)!==lab.labReactionNeedsTick(b)){
   if(sampleIssues.length<20)sampleIssues.push({sourceId,targetId,targetForm:targetStock.unit,
    directMedium:a.environment,transferMedium:b.environment,
    directTick:lab.labReactionNeedsTick(a),transferTick:lab.labReactionNeedsTick(b)});
  }
 }
}
console.log(`Measured liquid transfer matrix: ${sampled} cases, findings: ${sampleIssues.length}`);
assert.deepEqual(sampleIssues,[]);
