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
