/** Sequential school lab: two solid phases, a common ion, acid dissolution
 * and repeated measurements. Every stage must use the conserved mole ledger,
 * not replay the original source bottles after the first reaction. */
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
 new Function("require","module","exports",js)(name=>{
  if(!name.startsWith("."))throw Error("Unexpected "+name);
  return load(path.resolve(path.dirname(resolved),name+".ts"));
 },mod,mod.exports);
 return mod.exports;
}
const lab=load("src/lektrusChemistryBenchModel.ts");
const chemistry=load("src/lektrusLabReactionNetwork.ts");
const ph=load("src/lektrusLabPH.ts");
const stoich=load("src/lektrusLabStoichiometry.ts");
const dose=(volume=10,molarity=.1)=>({value:volume,unit:"ml",concentrationM:molarity});
const near=(a,b,tol=1e-7)=>assert.ok(Number.isFinite(a)&&Math.abs(a-b)<=tol,a+" vs "+b);
const state=b=>b.vessels.find(v=>v.id==="v1");
const measured=b=>chemistry.simulateLabInventory({...state(b),
 volumeMl:lab.labVesselQuantity(state(b)).volumeMl});
let bench=lab.defaultLabBench();
bench=lab.putLabReagent(bench,"v1","CaCl2",dose());
bench=lab.putLabReagent(bench,"v1","Na2CO3",dose());
let created=measured(bench);
assert.ok((created.solidMol.CaCO3??0)>.0009,
 "Mixing calcium chloride and carbonate precipitates calcium carbonate");
near(created.speciesMol.NaCl,.002,.0001);
const originalMass=chemistry.labInventoryMassG(created);
bench=lab.advanceLabSimulation(bench,1000);
for(let ms=11000;ms<=131000;ms+=10000){
 if(state(bench).reactionAmounts?.complete)break;
 bench=lab.advanceLabSimulation(bench,ms);
}
assert.ok(state(bench).reactionAmounts?.complete,
 "Precipitation is completed before the next stock is added");
bench=lab.putLabReagent(bench,"v1","AgNO3",dose());
created=measured(bench);
assert.ok((created.solidMol.AgCl??0)>.00095,
 "Next silver nitrate aliquot precipitates chloride from measured NaCl");
assert.ok((created.solidMol.CaCO3??0)>.0009,
 "Existing calcium carbonate cannot disappear in a second precipitation");
const knownAfterSilver=chemistry.labInventoryMassG(created);
near(knownAfterSilver,originalMass+.001*stoich.labMolarMass("AgNO3"),1e-6);
assert.equal(created.unmeasured.length,0);
assert.ok(ph.labVesselPH(state(bench))?.pH!==undefined);
const snapshot=chemistry.labInventorySnapshot(created);
const rediluted=chemistry.simulateLabInventory({
 reagents:Object.keys(snapshot.speciesMol),environment:"aqueous",
 chemicalInventory:snapshot,temperatureC:25,volumeMl:200
});
near(chemistry.labInventoryMassG(rediluted),knownAfterSilver,1e-7);
assert.ok((rediluted.solidMol.AgCl??0)>0,
 "The very insoluble AgCl survives classroom dilution");
const twoSolids=Object.entries(created.solidMol).filter(([,n])=>n>1e-9);
assert.ok(twoSolids.length>=2);

bench=lab.putLabReagent(bench,"v1","HCl",dose(20,.1));
const afterAcid=measured(bench);
assert.ok((afterAcid.solidMol.CaCO3??0)<(created.solidMol.CaCO3??0)*.02,
 "Hydrochloric acid dissolves the old carbonate with CO2 release");
assert.ok((afterAcid.solidMol.AgCl??0)>.0009,
 "Hydrochloric acid must not dissolve unrelated silver chloride");
assert.ok((afterAcid.releasedGasMol.CO2??0)>.0009,
 "CaCO3 + 2HCl -> CaCl2 + CO2 + H2O evolves measured carbon dioxide");
near(chemistry.labInventoryMassG(afterAcid),knownAfterSilver+
 .002*stoich.labMolarMass("HCl"),1e-5);
assert.ok(!afterAcid.unmeasured.length);
assert.ok(state(bench).chemicalInventory,
 "All subsequent reactions persist measured products instead of stock labels");
assert.ok(lab.labVesselContents(state(bench)).solid.some(s=>s.formula==="AgCl"),
 "Visible precipitate must correspond to the actual conserved solids");
const acidResult=lab.labIndicatorResult({...state(bench),indicator:"methyl-orange"});
assert.ok(acidResult&&Number.isFinite(acidResult.pH),
 "Indicators continue to read real aqueous composition after multiple reactions");
const massBeforeWater=chemistry.labInventoryMassG(afterAcid);
bench=lab.putLabReagent(bench,"v1","H2O",{unit:"ml",value:40});
const diluted=measured(bench);
// Water added to the flask is real physical mass in the molecular ledger:
 // the old solutes are conserved, while 40 ml of H2O add ~39.88 g.
const waterMoles=stoich.labDoseMoles("H2O",{unit:"ml",value:40});
assert.ok(waterMoles>0);
near(chemistry.labInventoryMassG(diluted),
 massBeforeWater+waterMoles*stoich.labMolarMass("H2O"),1e-6);
assert.ok((diluted.solidMol.AgCl??0)>.0009);
assert.ok((diluted.solidMol.CaCO3??0)<.0001);
assert.ok(lab.labVesselQuantity(state(bench)).volumeMl>60);
console.log("Sequential carbonate/chloride precipitates, acid dissolution, CO2, pH, dilution and conservation OK");
