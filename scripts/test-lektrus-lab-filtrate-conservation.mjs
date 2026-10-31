/** End-to-end conservation across two precipitation stages and separation. */
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
 const js=ts.transpileModule(source,{compilerOptions:{
  module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2023
 }}).outputText;
 const requireLocal=specifier=>{
  if(!specifier.startsWith("."))throw Error("Unexpected "+specifier);
  return load(path.resolve(path.dirname(resolved),specifier+".ts"));
 };
 new Function("require","module","exports",js)(requireLocal,mod,mod.exports);
 return mod.exports;
}
const lab=load("src/lektrusChemistryBenchModel.ts");
const chemistry=load("src/lektrusLabReactionNetwork.ts");
const stoich=load("src/lektrusLabStoichiometry.ts");
const dose=(value=10)=>({value,unit:"ml",concentrationM:.1});
const approx=(a,b,tolerance=1e-7)=>
 assert.ok(Math.abs(a-b)<tolerance,String(a)+" != "+String(b));
let bench=lab.defaultLabBench();
bench=lab.putLabReagent(bench,"v1","BaCl2",dose());
bench=lab.putLabReagent(bench,"v1","Na2SO4",dose());
const before=chemistry.simulateLabInventory(bench.vessels[0]);
assert.ok((before.solidMol.BaSO4??0)>0.00099);
assert.ok((before.speciesMol.NaCl??0)>0.00199);
const totalBefore=chemistry.labInventoryMassG(before);
bench=lab.addLabVessel(bench,"conical");
const receiver=bench.selectedId;
bench=lab.addPlacedLabDevice(bench,"filter");
bench=lab.advanceLabSimulation(bench,1000);
bench=lab.advanceLabSimulation(bench,1500);
bench=lab.advanceLabSimulation(bench,5500);
const filtered=lab.filterLabPrecipitate(bench,"v1",receiver);
assert.notEqual(filtered,bench,"Filtration must succeed after progress is complete");
const solid=filtered.vessels.find(v=>v.id==="v1");
const liquid=filtered.vessels.find(v=>v.id===receiver);
assert.equal(liquid.uncertain,false,"Measured filtrate must not be marked unknown");
assert.ok(liquid.chemicalInventory,"The receiver must carry real molecular counts");
assert.equal(liquid.filteredSolution.volumeMl,20);
assert.equal(liquid.doses,undefined,"The filtrate is not fictional pure water stock");
assert.equal(lab.labVesselQuantity(liquid).volumeMl,20);
const filtrateContents=lab.labVesselContents(liquid);
assert.ok(filtrateContents.solution.some(s=>s.formula==="NaCl"&&s.mmol>1.99));
assert.ok(filtrateContents.solid.length===0);
const massSolid=chemistry.labInventoryMassG(chemistry.simulateLabInventory(solid));
const massLiquid=chemistry.labInventoryMassG(chemistry.simulateLabInventory({
 ...liquid,volumeMl:lab.labVesselQuantity(liquid).volumeMl
}));
approx(massSolid+massLiquid,totalBefore,1e-7);
const afterAddition=lab.putLabReagent(filtered,receiver,"AgNO3",dose());
const after=afterAddition.vessels.find(v=>v.id===receiver);
assert.equal(after.uncertain,false,"New reaction should be calculable from the filtrate");
const contents=lab.labVesselContents(after);
assert.ok((contents.precipitateG??0)>.143,"AgCl must precipitate from retained NaCl");
const initialSoluteMol=liquid.chemicalInventory.speciesMol.NaCl;
assert.ok(initialSoluteMol>0.00199);
const newMass=totalBefore+.001*stoich.labMolarMass("AgNO3");
const totalAfter=chemistry.labInventoryMassG(chemistry.simulateLabInventory({
 ...after,volumeMl:lab.labVesselQuantity(after).volumeMl
}))+massSolid;
approx(totalAfter,newMass,1e-6);
assert.equal(lab.labVesselQuantity(after).volumeMl,30,
 "The original filtrate and new reagent carrier volumes must be added");
const secondChemistry=chemistry.simulateLabInventory({
 ...after,volumeMl:lab.labVesselQuantity(after).volumeMl
});
assert.ok((secondChemistry.solidMol.AgCl??0)>.00099);
assert.ok((secondChemistry.speciesMol.NaCl??0)>.00099,
 "The unconsumed salt must remain in the recipient");
// A full pour must carry the real product inventory, not only fresh stock
// labels. It should not produce an unexplained diluted H2O stock.
let decant=lab.addLabVessel(filtered,"beaker");
const cleanReceiver=decant.selectedId;
decant=lab.pourLabVessel(decant,receiver,cleanReceiver);
assert.equal(decant.vessels.find(v=>v.id===receiver).reagents.length,0);
const decanted=decant.vessels.find(v=>v.id===cleanReceiver);
assert.equal(decanted.filteredSolution?.volumeMl,20);
assert.equal(lab.labVesselQuantity(decanted).volumeMl,20);
assert.ok(lab.labVesselContents(decanted).solution.some(s=>
 s.formula==="NaCl"&&s.mmol>1.99));
approx(chemistry.labInventoryMassG(chemistry.simulateLabInventory({
 ...decanted,volumeMl:20}))+massSolid,totalBefore,1e-7);
const decantedAndReacted=lab.putLabReagent(decant,cleanReceiver,"AgNO3",dose());
assert.ok((lab.labVesselContents(decantedAndReacted.vessels.find(v=>v.id===cleanReceiver)).
 precipitateG??0)>.143);
// A graduated pipette samples the dissolved phase only. A measured 5 mL
// aliquot from 20 mL contains exactly one quarter of each dissolved species.
let sampling=lab.addLabVessel(filtered,"pipette");
const pipetteId=sampling.selectedId;
sampling=lab.transferLabMeasuredLiquid(sampling,receiver,pipetteId,5);
const donorAfter=sampling.vessels.find(v=>v.id===receiver);
const pipetteAfter=sampling.vessels.find(v=>v.id===pipetteId);
assert.equal(lab.labVesselQuantity(donorAfter).volumeMl,15);
assert.equal(lab.labVesselQuantity(pipetteAfter).volumeMl,5);
const totalNaCl=liquid.chemicalInventory.speciesMol.NaCl;
approx(pipetteAfter.chemicalInventory.speciesMol.NaCl,totalNaCl*.25,1e-12);
approx(donorAfter.chemicalInventory.speciesMol.NaCl,totalNaCl*.75,1e-12);
const sampledMass=chemistry.labInventoryMassG(chemistry.simulateLabInventory({
 ...pipetteAfter,volumeMl:5
}))+chemistry.labInventoryMassG(chemistry.simulateLabInventory({
 ...donorAfter,volumeMl:15
}))+massSolid;
approx(sampledMass,totalBefore,1e-7);
assert.equal(lab.labVesselContents(pipetteAfter).solid.length,0,
 "The pipette must not suction out settled particles");
// A second filtration must collect only the NEW precipitate, not the
// BaSO4 that was already removed during the first separation.
let twice=lab.addLabVessel(afterAddition,"beaker");
const twiceReceiver=twice.selectedId;
twice=lab.filterLabPrecipitate(twice,receiver,twiceReceiver);
assert.notEqual(twice,afterAddition,"The second independently formed solid can be filtered");
assert.equal(twice.vessels.find(v=>v.id===receiver).filteredResidue.formula,"AgCl");
const secondFiltrate=twice.vessels.find(v=>v.id===twiceReceiver);
assert.ok(secondFiltrate.chemicalInventory.speciesMol.NaNO3>.00099);
assert.ok(secondFiltrate.chemicalInventory.speciesMol.NaCl>.00099);
assert.equal(secondFiltrate.uncertain,false);
const sumSeparatedMass=massSolid+
 chemistry.labInventoryMassG(chemistry.simulateLabInventory(
  twice.vessels.find(v=>v.id===receiver)))+
 chemistry.labInventoryMassG(chemistry.simulateLabInventory({
  ...secondFiltrate,volumeMl:lab.labVesselQuantity(secondFiltrate).volumeMl
 }));
approx(sumSeparatedMass,newMass,1e-6);
const oldValidated=fs.readFileSync("src/boardModel.ts","utf8");
assert.match(oldValidated,/v\.chemicalInventory/);
console.log("Two sequential precipitation stages preserve soluble moles, real volume and molecular mass");


/* Physical displacement: a BaSO4 crystal occupies volume above the liquid
 * (density 4.5 g/cm³, ILO/WHO ICSC 0827) and reduces gas headspace.
 * Dissolved solute does NOT count as a separate crystalline solid. */
const physicalMass=stoich.labMolarMass("BaSO4")*.001;
const physicalVessel={id:"physical",kind:"conical",x:50,y:65,
 reagents:["BaSO4","H2O"],environment:"aqueous",observed:true,
 doses:{BaSO4:{unit:"g",value:physicalMass},
  H2O:{unit:"ml",value:20}},temperatureC:22,
 stoppered:true,stopperedAtC:22,
 chemicalInventory:{speciesMol:{BaSO4:.001,H2O:20*.997/18.015},
  solidMol:{BaSO4:.001},retainedGasMol:{CO2:.003}}
};
const physicalQuantity=lab.labVesselQuantity(physicalVessel);
approx(physicalQuantity.solidVolumeMl,physicalMass/4.5,1e-9);
approx(physicalQuantity.occupiedMl,20+physicalMass/4.5,1e-9);
approx(physicalQuantity.availableMl,200-20-physicalMass/4.5,1e-9);
assert.equal(physicalQuantity.solidVolumeComplete,true);
const noSolidPressure=lab.labVesselPressure({...physicalVessel,
 chemicalInventory:{...physicalVessel.chemicalInventory,solidMol:{}}});
const withSolidPressure=lab.labVesselPressure(physicalVessel);
assert.ok(withSolidPressure.reactionGasPressureKPa>
 noSolidPressure.reactionGasPressureKPa,
 "A known precipitate reduces the real closed gas headspace and raises CO2 pressure");
assert.equal(lab.labVesselQuantity({...physicalVessel,
 chemicalInventory:{speciesMol:{H2O:1,NaCl:.001},solidMol:{}}}).solidVolumeMl,0,
 "Dissolved salts must never be double counted as solid displacement");
const almostFull={...physicalVessel,kind:"beaker",stoppered:false,
 doses:{BaSO4:{unit:"g",value:physicalMass},
  H2O:{unit:"ml",value:149.96}},
 chemicalInventory:undefined};
const filledBench={...lab.defaultLabBench(),vessels:[almostFull]};
assert.ok(lab.labVesselQuantity(almostFull).occupiedMl>150,
 "The previous liquid-only model would miss overfilled precipitate vessels");
const validNearFull={...almostFull,doses:{...almostFull.doses,
 H2O:{unit:"ml",value:149.94}}};
const barelyFits={...filledBench,vessels:[validNearFull]};
const added=lab.putLabReagent(barelyFits,"physical","H2O",
 {unit:"ml",value:.03});
assert.equal(added,barelyFits,
 "An added liquid dose must be rejected if its known crystalline sediment would overflow the rim");
const incomplete=lab.labVesselQuantity({...physicalVessel,
 chemicalInventory:{speciesMol:{"Fe(OH)3":1},solidMol:{"Fe(OH)3":1}}});
assert.equal(incomplete.solidVolumeComplete,true,
 "School estimate still supplies finite precipitate displacement");
assert.equal(incomplete.solidVolumeEstimated,true,
 "Unknown crystal density must be clearly marked as a classroom estimate");
console.log("Curated precipitate density conserves occupied space and closed-flask gas headspace");


/** A finished precipitation is real matter, not a permanent textual label.
 * Acid is added to the SAME flask, after an observable four-second
 * reaction. The engine must then consume precisely the previous solid,
 * show its disappearance, and preserve the quantitative reaction ledger. */
const addSolution=(b,id,millilitres)=>lab.putLabReagent(b,"v1",id,
 {value:millilitres,unit:"ml",concentrationM:.1});
for(const [salt,base,baseMl,solidFormula,acidMl,chloride] of [
 ["CuSO4","NaOH",20,"Cu(OH)2",20,"CuCl2"],
 ["FeCl3","NaOH",30,"Fe(OH)3",30,"FeCl3"],
 ["AlCl3","NaOH",30,"Al(OH)3",30,"AlCl3"],
 ["ZnSO4","NaOH",20,"Zn(OH)2",20,"ZnCl2"]
]){
 let chain=lab.defaultLabBench();
 chain=addSolution(chain,salt,10);
 chain=addSolution(chain,base,baseMl);
 chain=lab.advanceLabSimulation({...chain,simulationAtMs:0},1000);
 chain=lab.advanceLabSimulation(chain,6000);
 const first=chain.vessels[0];
 assert.ok(first.reactionAmounts?.complete,
  "First reaction must have physically finished: "+solidFormula);
 const initial=chemistry.simulateLabInventory(first);
 const solidBefore=initial.solidMol[solidFormula]??0;
 assert.ok(solidBefore>.0009,
  "Previously formed hydroxide exists as conserved solid: "+solidFormula);
 const massBefore=chemistry.labInventoryMassG(initial);
 chain=addSolution(chain,"HCl",acidMl);
 const vessel=chain.vessels[0];
 assert.equal(vessel.uncertain,false,
  "A reviewed second reaction must not be marked uncertain: "+solidFormula);
 assert.ok(vessel.chemicalInventory,"Next stage uses a persistent species ledger");
 assert.equal(vessel.reactionAmounts,undefined,
  "The finished first-stage timer cannot be replayed");
 const next=chemistry.simulateLabInventory(vessel);
 assert.ok((next.solidMol[solidFormula]??0)<solidBefore*.02,
  "Dilute acid dissolves the accumulated solid: "+solidFormula);
 assert.ok((next.speciesMol[chloride]??0)>.0009,
  "Acid dissolution creates the verified chloride: "+chloride);
 const visible=lab.labVesselContents(vessel);
 assert.ok(!visible.solid.some(x=>x.formula===solidFormula&&
  (x.massG??0)>.005),"Old precipitate must disappear on the laboratory table");
 approx(chemistry.labInventoryMassG(next),
  massBefore+acidMl*.1/1000*stoich.labMolarMass("HCl"),5e-6);
 chain=addSolution(chain,"HCl",2);
 const redosed=chemistry.simulateLabInventory(chain.vessels[0]);
 assert.ok((redosed.solidMol[solidFormula]??0)<solidBefore*.02);
 approx(chemistry.labInventoryMassG(redosed),
  chemistry.labInventoryMassG(next)+.0002*stoich.labMolarMass("HCl"),5e-6);
}
// Gas formation must also use a solid that came from a previous
// precipitation, while unrelated salt stays in the original solution.
let carbonate=lab.defaultLabBench();
carbonate=addSolution(carbonate,"CaCl2",10);
carbonate=addSolution(carbonate,"Na2CO3",10);
carbonate=lab.advanceLabSimulation({...carbonate,simulationAtMs:0},1000);
carbonate=lab.advanceLabSimulation(carbonate,6000);
const carbonateBefore=chemistry.simulateLabInventory(carbonate.vessels[0]);
assert.ok(carbonateBefore.solidMol.CaCO3>.0009);
carbonate=addSolution(carbonate,"HCl",20);
const carbonateVessel=carbonate.vessels[0];
const carbonateResult=chemistry.simulateLabInventory(carbonateVessel);
assert.equal(carbonateVessel.uncertain,false);
assert.ok((carbonateResult.solidMol.CaCO3??0)<.00001);
assert.ok((carbonateVessel.chemicalInventory?.speciesMol.CaCl2??0)>.0009);
assert.ok((carbonateVessel.chemicalInventory?.speciesMol.NaCl??0)>.0019);
assert.ok((carbonateResult.releasedGasMol.CO2??0)>.0009,
 "Acid attacking a previously formed carbonate releases calculable CO2");
console.log("Second-stage acid addition consumes real previous solids and preserves masses: PASS");

/** Consecutive precipitations in ONE flask: BaSO4, then AgCl from
 * the chloride generated by the first reaction. A physical membrane
 * retains BOTH solids and transfers every dissolved species. */
function twoPrecipitateBench(){
 let b=lab.defaultLabBench();
 b=lab.putLabReagent(b,"v1","BaCl2",dose(10));
 b=lab.putLabReagent(b,"v1","Na2SO4",dose(10));
 b=lab.advanceLabSimulation({...b,simulationAtMs:0},1000);
 b=lab.advanceLabSimulation(b,6000);
 assert.equal(b.vessels[0].reactionAmounts?.complete,true);
 b=lab.putLabReagent(b,"v1","AgNO3",dose(20));
 const inv=chemistry.simulateLabInventory(b.vessels[0]);
 assert.ok((inv.solidMol.BaSO4??0)>.00099);
 assert.ok((inv.solidMol.AgCl??0)>.00199);
 assert.equal(b.vessels[0].uncertain,false);
 return b;
}
let multi=twoPrecipitateBench();
const priorMulti=chemistry.simulateLabInventory(multi.vessels[0]);
const priorMass=chemistry.labInventoryMassG(priorMulti);
multi=lab.addLabVessel(multi,"conical");
const multiReceiverId=multi.selectedId;
multi=lab.addPlacedLabDevice(multi,"filter");
const separatedMulti=lab.filterLabPrecipitate(multi,"v1",multiReceiverId);
assert.notEqual(separatedMulti,multi,"Mixed suspension must be filtered");
const mixedCake=separatedMulti.vessels.find(v=>v.id==="v1");
const mixedFiltrate=separatedMulti.vessels.find(v=>v.id===multiReceiverId);
assert.deepEqual(mixedCake.filteredResidue.components.map(x=>x.formula).sort(),
 ["AgCl","BaSO4"]);
assert.ok(mixedCake.chemicalInventory,"Mixed cake must retain exact species");
assert.equal(mixedFiltrate.chemicalInventory.solidMol.AgCl,undefined);
assert.equal(mixedFiltrate.chemicalInventory.solidMol.BaSO4,undefined);
assert.equal(mixedFiltrate.filteredSolution.volumeMl,40);
const cakeContents=lab.labVesselContents(mixedCake);
assert.deepEqual(cakeContents.solid.map(x=>x.formula).sort(),["AgCl","BaSO4"]);
assert.ok((cakeContents.precipitateG??0)>.42);
assert.equal(mixedFiltrate.chemicalInventory.settled,true,
 "Filtered liquid is an already-separated chemical snapshot");
const mixedReadback=chemistry.simulateLabInventory({
 ...mixedFiltrate,volumeMl:40});
assert.deepEqual(mixedReadback.solidMol,{},
 "Reopening a filtrate must not regenerate previously removed particles");
assert.equal(lab.labVesselContents(mixedFiltrate).solid.length,0);
// A settled filtrate may be diluted or sampled without recomputing a
// second, fictitious precipitation from historic counterion stocks.
const dilutedFiltrate=lab.putLabReagent(separatedMulti,
 multiReceiverId,"H2O",{unit:"ml",value:10});
assert.notEqual(dilutedFiltrate,separatedMulti);
const dilutedVessel=dilutedFiltrate.vessels.find(v=>v.id===multiReceiverId);
assert.equal(dilutedVessel.chemicalInventory.settled,true);
assert.deepEqual(chemistry.simulateLabInventory(dilutedVessel).solidMol,{});
let aliquot=lab.addLabVessel(separatedMulti,"pipette");
const aliquotId=aliquot.selectedId;
aliquot=lab.transferLabMeasuredLiquid(aliquot,multiReceiverId,aliquotId,5);
const aliquotVessel=aliquot.vessels.find(v=>v.id===aliquotId);
const aliquotDonor=aliquot.vessels.find(v=>v.id===multiReceiverId);
assert.equal(aliquotVessel.chemicalInventory?.settled,true);
assert.equal(aliquotDonor.chemicalInventory?.settled,true);
assert.deepEqual(chemistry.simulateLabInventory(aliquotVessel).solidMol,{});
assert.deepEqual(chemistry.simulateLabInventory(aliquotDonor).solidMol,{});
const retainedMass=chemistry.labInventoryMassG(
 chemistry.simulateLabInventory(mixedCake));
const filtrateMass=chemistry.labInventoryMassG(
 chemistry.simulateLabInventory({...mixedFiltrate,volumeMl:40}));
approx(retainedMass+filtrateMass,priorMass,1e-7);
approx(mixedCake.filteredResidue.components.reduce((n,c)=>n+c.massG,0),
 mixedCake.filteredResidue.massG,1e-10);
let filterDevice=twoPrecipitateBench();
filterDevice=lab.addPlacedLabDevice(filterDevice,"filter");
const filterId=lab.placedLabDevices(filterDevice).find(x=>x.kind==="filter").id;
const poured=lab.pourLabIntoFilter(filterDevice,"v1",filterId);
assert.notEqual(poured,filterDevice,"Filter device accepts two different precipitates");
assert.deepEqual(lab.placedLabDevices(poured).find(x=>x.id===filterId).
 collectedResidue.components.map(x=>x.formula).sort(),["AgCl","BaSO4"]);
console.log("Multiple precipitates: mixed filter cake, separated filtrate and exact mass balance PASS");

// The titration indicator must follow the current reagents, not the first
// acid sample, after multiple sequential additions to the SAME flask.
const acidPH=load("src/lektrusLabPH.ts");
let neutral=lab.defaultLabBench();
neutral=lab.putLabReagent(neutral,"v1","HCl",dose(10));
neutral=lab.putLabReagent(neutral,"v1","NaOH",dose(5));
const firstPH=acidPH.labVesselPH(neutral.vessels[0]);
assert.ok(firstPH&&firstPH.pH<3,"Half-equivalence remains acidic");
neutral=lab.advanceLabSimulation({...neutral,simulationAtMs:0},1000);
neutral=lab.advanceLabSimulation(neutral,6000);
neutral=lab.putLabReagent(neutral,"v1","NaOH",dose(5));
const eqPH=acidPH.labVesselPH(neutral.vessels[0]);
assert.ok(eqPH&&Math.abs(eqPH.pH-7)<.2,
 "Acid and base neutralize after separately recorded doses");
neutral=lab.putLabReagent(neutral,"v1","NaOH",dose(5));
const excessPH=acidPH.labVesselPH(neutral.vessels[0]);
assert.ok(excessPH&&excessPH.pH>11,
 "Excess base changes the indicator and pH on the next addition");
console.log("Sequential acid-base dosing: acidic, neutral, alkaline pH PASS");


/* Vessel-level dilution must use a verified old precipitation equation,
 * not reset the reaction clock, create products, or delete the solid.
 * A 1:2 lead chloride mixture starts partly precipitated near 25 C;
 * enough added water redissolves the material without mass loss. */
let reversible=lab.defaultLabBench();
reversible=lab.putLabReagent(reversible,"v1","Pb(NO3)2",dose(10));
reversible=lab.putLabReagent(reversible,"v1","NaCl",dose(20));
reversible=lab.advanceLabSimulation({...reversible,simulationAtMs:0},1000);
reversible=lab.advanceLabSimulation(reversible,6000);
const oldLead=chemistry.simulateLabInventory(reversible.vessels[0]);
assert.ok((oldLead.solidMol.PbCl2??0)>.0001);
assert.equal(reversible.vessels[0].reactionAmounts?.complete,true);
const oldMass=chemistry.labInventoryMassG(oldLead);
reversible=lab.putLabReagent(reversible,"v1","H2O",
 {value:100,unit:"ml"});
const revisedLead=reversible.vessels[0];
assert.equal(revisedLead.uncertain,false);
assert.ok(revisedLead.chemicalInventory?.equilibriumEquations?.
 some(equation=>equation.includes("PbCl2↓")));
const equilibratedLead=chemistry.simulateLabInventory({
 ...revisedLead,volumeMl:lab.labVesselQuantity(revisedLead).volumeMl
});
assert.ok((equilibratedLead.solidMol.PbCl2??0)<
 (oldLead.solidMol.PbCl2??0)*.01,
 "Dilution should dissolve previously formed PbCl2");
assert.equal(revisedLead.reactionAmounts,undefined,
 "Old reaction animation does not restart on dilution");
approx(chemistry.labInventoryMassG(equilibratedLead),
 oldMass+stoich.labDoseMoles("H2O",{unit:"ml",value:100})*
 stoich.labMolarMass("H2O"),1e-5);
console.log("Saved vessel reversible precipitation and quantitative dilution: PASS");


/** A formed hydroxide reacts with a NEW dilute acid by actual moles.
 * Use completed stage-one precipitates, not a fictional mixture of the
 * original metal salt + base after the first experiment has finished.
 */
const acidPrecipitateCases=[
 ["CuSO4","NaOH",20,"Cu(OH)2","HNO3",20,"Cu(NO3)2"],
 ["FeCl3","NaOH",30,"Fe(OH)3","HNO3",30,"Fe(NO3)3"],
 ["AlCl3","NaOH",30,"Al(OH)3","HNO3",30,"Al(NO3)3"],
 ["ZnSO4","NaOH",20,"Zn(OH)2","HNO3",20,"Zn(NO3)2"],
 ["MgSO4","NaOH",20,"Mg(OH)2","HNO3",20,"Mg(NO3)2"],
 ["MgSO4","NaOH",20,"Mg(OH)2","HCl",20,"MgCl2"],
 ["FeSO4","NaOH",20,"Fe(OH)2","HCl",20,"FeCl2"],
 ["CuSO4","NaOH",20,"Cu(OH)2","H2SO4",10,"CuSO4"],
 ["ZnSO4","NaOH",20,"Zn(OH)2","H2SO4",10,"ZnSO4"],
 ["MgSO4","NaOH",20,"Mg(OH)2","H2SO4",10,"MgSO4"]
];
for(const [metalSalt,alkali,alkaliMl,precipitate,acid,acidMl,salt] of acidPrecipitateCases){
 let state=lab.defaultLabBench();
 state=addSolution(state,metalSalt,10);
 state=addSolution(state,alkali,alkaliMl);
 state=lab.advanceLabSimulation({...state,simulationAtMs:0},1000);
 state=lab.advanceLabSimulation(state,6000);
 assert.equal(state.vessels[0].reactionAmounts?.complete,true,
  "Initial precipitation must complete: "+precipitate);
 const before=chemistry.simulateLabInventory(state.vessels[0]);
 assert.ok((before.solidMol[precipitate]??0)>.0009,
  "Reviewed precipitate must be measurable: "+precipitate);
 const massBefore=chemistry.labInventoryMassG(before);
 state=addSolution(state,acid,acidMl);
 const afterVessel=state.vessels[0];
 assert.equal(afterVessel.uncertain,false,
  "Reviewed acidic redissolution is not an unknown reaction: "+acid+"/"+precipitate);
 const after=chemistry.simulateLabInventory(afterVessel);
 assert.ok((after.solidMol[precipitate]??0)<.00003,
  "Complete dose dissolves the preformed solid: "+acid+"/"+precipitate);
 assert.ok((after.speciesMol[salt]??0)>.0009,
  "Dissolved metal salt survives: "+salt);
 approx(chemistry.labInventoryMassG(after),massBefore+
  acidMl*.1/1000*stoich.labMolarMass(acid),2e-6);
 assert.ok(!lab.labVesselContents(afterVessel).solid.some(x=>
  x.formula===precipitate&&(x.massG??0)>.01),
  "Inspector must not display vanished "+precipitate);
}
console.log("Ten sequential acid dissolutions of preformed hydroxides: PASS");

// A 0.001-mol Cu(OH)2 sample takes exactly 0.002 mol HNO3.
// Incremental acid produces a proportional decrease in solid mass.
// Only excess acid turns the full, previously alkaline mixture acidic.
let stagedAcid=lab.defaultLabBench();
stagedAcid=addSolution(stagedAcid,"CuSO4",10);
stagedAcid=addSolution(stagedAcid,"NaOH",20);
stagedAcid=lab.advanceLabSimulation({...stagedAcid,simulationAtMs:0},1000);
stagedAcid=lab.advanceLabSimulation(stagedAcid,6000);
stagedAcid=lab.setLabIndicator(stagedAcid,"v1","methyl-orange");
const initialStaged=chemistry.simulateLabInventory(stagedAcid.vessels[0]);
const beforeSolid=initialStaged.solidMol["Cu(OH)2"];
stagedAcid=addSolution(stagedAcid,"HNO3",5);
const afterQuarter=chemistry.simulateLabInventory(stagedAcid.vessels[0]);
assert.ok(afterQuarter.solidMol["Cu(OH)2"]<beforeSolid*.80&&
 afterQuarter.solidMol["Cu(OH)2"]>beforeSolid*.70,
 "5 ml of 0.1M HNO3 consumes one quarter of the hydroxide");
stagedAcid=addSolution(stagedAcid,"HNO3",5);
const afterHalf=chemistry.simulateLabInventory(stagedAcid.vessels[0]);
assert.ok(afterHalf.solidMol["Cu(OH)2"]<beforeSolid*.55&&
 afterHalf.solidMol["Cu(OH)2"]>beforeSolid*.45);
stagedAcid=addSolution(stagedAcid,"HNO3",10);
const atEquivalent=chemistry.simulateLabInventory(stagedAcid.vessels[0]);
assert.ok((atEquivalent.solidMol["Cu(OH)2"]??0)<1e-6);
stagedAcid=addSolution(stagedAcid,"HNO3",5);
const afterExcess=chemistry.simulateLabInventory(stagedAcid.vessels[0]);
const endPH=acidPH.labVesselPH(stagedAcid.vessels[0]);
const endIndicator=lab.labIndicatorResult(stagedAcid.vessels[0]);
assert.ok(endPH&&endPH.pH<3,
 "Excess strong acid after hydroxide consumption must control pH");
assert.equal(endIndicator.medium,"acid");
assert.ok((afterExcess.solidMol["Cu(OH)2"]??0)<1e-6);
approx(chemistry.labInventoryMassG(afterExcess),
 chemistry.labInventoryMassG(initialStaged)+.0025*stoich.labMolarMass("HNO3"),2e-6);
console.log("Sequential hydroxide titration: quarter, half, full, excess acid and indicator pH PASS");

// Acid consumption of a carbonate that was actually formed on the table.
// Carbonate + acetic acid is stoichiometric at the school level; dissolved
// CO2 and weak acid equilibria beyond the reviewed equation are not claimed.
for(const [carbonateSalt,carbonateName,acetate] of [
 ["CaCl2","CaCO3","Ca(CH3COO)2"]
]){
 let state=lab.defaultLabBench();
 state=addSolution(state,carbonateSalt,10);
 state=addSolution(state,"Na2CO3",10);
 state=lab.advanceLabSimulation({...state,simulationAtMs:0},1000);
 state=lab.advanceLabSimulation(state,6000);
 const first=chemistry.simulateLabInventory(state.vessels[0]);
 assert.ok((first.solidMol[carbonateName]??0)>.0009,
  "Precipitated solid "+carbonateName+" must be real");
 const mass=chemistry.labInventoryMassG(first);
 state=addSolution(state,"CH3COOH",20);
 const result=chemistry.simulateLabInventory(state.vessels[0]);
 assert.ok((result.solidMol[carbonateName]??0)<1e-6,
  "Weak acetic acid consumes carbonate solid: "+carbonateName);
 assert.ok((result.speciesMol[acetate]??0)>.0009,
  "A soluble acetate forms: "+acetate);
 assert.ok((result.releasedGasMol.CO2??0)>.0009,
  "Carbon dioxide is quantified from the balanced reaction");
 approx(chemistry.labInventoryMassG(result),
  mass+.002*stoich.labMolarMass("CH3COOH"),2e-6);
}
console.log("Acetic acid on previously formed carbonates: balanced gas and acetate PASS");

/** Magnesium carbonate is explicitly placed as a weighed solid here;
 * no unsupported aqueous MgCO3 precipitation is invented. */
let magnesium=lab.defaultLabBench();
// The editor stores weighed doses to 0.01 g; use an EXACT 0.10 g
// sample instead of asking the simulator to retain 0.08431 g precision.
const magnesiumMass=.10;
magnesium=lab.putLabReagent(magnesium,"v1","MgCO3",
 {unit:"g",value:magnesiumMass});
const magnesiumStart=chemistry.simulateLabInventory(magnesium.vessels[0]);
assert.ok((magnesiumStart.solidMol.MgCO3??0)>.0011);
magnesium=addSolution(magnesium,"CH3COOH",30);
const magnesiumEnd=chemistry.simulateLabInventory(magnesium.vessels[0]);
assert.ok((magnesiumEnd.solidMol.MgCO3??0)<1e-6);
assert.ok((magnesiumEnd.speciesMol["Mg(CH3COO)2"]??0)>.0011);
assert.ok((magnesiumEnd.releasedGasMol.CO2??0)>.0011);
approx(chemistry.labInventoryMassG(magnesiumEnd),
 chemistry.labInventoryMassG(magnesiumStart)+.003*stoich.labMolarMass("CH3COOH"),2e-6);
console.log("Weighed MgCO3 plus measured acetic acid: stoichiometric CO2 PASS");
