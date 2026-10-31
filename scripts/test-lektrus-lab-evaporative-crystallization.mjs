/** Conservation of measured salt and solvent through a real heating cycle. */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";
const modules=new Map();
function load(file){
 const resolved=path.resolve(file);
 if(modules.has(resolved))return modules.get(resolved).exports;
 const mod={exports:{}};modules.set(resolved,mod);
 const src=fs.readFileSync(resolved,"utf8");
 const js=ts.transpileModule(src,{compilerOptions:{
  module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2023
 }}).outputText;
 const requireLocal=id=>{
  if(!id.startsWith("."))throw Error("Unexpected import "+id);
  return load(path.resolve(path.dirname(resolved),id+".ts"));
 };
 new Function("require","module","exports",js)(requireLocal,mod,mod.exports);
 return mod.exports;
}
const mat=load("src/lektrusLabMaterialConstants.ts");
const vapor=load("src/lektrusLabEvaporation.ts");
const reaction=load("src/lektrusLabReactionNetwork.ts");
const lab=load("src/lektrusChemistryBenchModel.ts");
const stoich=load("src/lektrusLabStoichiometry.ts");
const approx=(actual,expected,tol=1e-6)=>
 assert.ok(Math.abs(actual-expected)<=tol,actual+" != "+expected);
assert.ok(Object.keys(mat.LAB_CRYSTAL_DENSITY_G_ML).length>=14);
for(const [id,density] of Object.entries(mat.LAB_CRYSTAL_DENSITY_G_ML))
 assert.ok(density>0&&density<25&&Number.isFinite(density),id);
 // Real elemental solids span .534 g/cm³ (Li) to 19.3 g/cm³ (Au).
 // Bound checks must not accidentally prohibit verified low/high densities.
approx(mat.labCrystalDensityGml("NaCl"),2.16);
approx(mat.labCrystalDensityGml("AgCl"),5.56);
approx(mat.labCrystalDensityGml("KCl"),1.984);
approx(mat.labCrystalDensityGml("CuSO4"),3.6);
assert.equal(mat.labCrystalDensityGml("CuSO4.5H2O"),undefined,
 "Hydrates must never borrow an anhydrous crystal density");
assert.equal(mat.labCrystalDensityGml("Fe(OH)3"),undefined,
 "Hydrated gelatinous precipitates lack a defined true density in the model");
assert.equal(mat.labNaClSolubilityGPer100gWater(-1),undefined);
assert.equal(mat.labNaClSolubilityGPer100gWater(126),undefined);
const boilingBrine=mat.labNaClSolubilityGPer100gWater(108);
assert.ok(boilingBrine>39&&boilingBrine<40,
 "Use USGS experimental elevated-temperature correlation for boiling brine");
for(const [t,fraction] of [[0,.2634],[20,.2643],[40,.2671],
 [60,.2709],[80,.2753],[100,.2812]]){
 const sol=mat.labNaClSolubilityGPer100gWater(t);
 approx(sol,100*fraction/(1-fraction),1e-8);
}
const g=x=>({value:x,unit:"g"});
const ml=x=>({value:x,unit:"ml"});
const make=(waterMl,saltG=1)=>({
 id:"evaporation-test",kind:"dish",reagents:["NaCl","H2O"],
 environment:"aqueous",observed:true,temperatureC:108,
 doses:{NaCl:g(saltG),H2O:ml(waterMl)}
});
const initial=make(4);
let drySource=make(.5);
const supersaturated=reaction.simulateLabInventory(drySource);
assert.ok(supersaturated.solidMol.NaCl>0,
 "NaCl crystallises when dissolved mass exceeds verified solubility");
const supContents=lab.labVesselContents(drySource);
assert.ok(supContents.solid.some(x=>x.formula==="NaCl"&&x.massG>0));
approx(lab.labVesselQuantity(drySource).solidVolumeMl,
 supersaturated.solidMol.NaCl*stoich.labMolarMass("NaCl")/2.16,1e-9);
const mild=reaction.simulateLabInventory(make(4));
assert.equal(mild.solidMol.NaCl??0,0,
 "The same one gram must dissolve into sufficient water");
const notBinary=reaction.simulateLabInventory({
 reagents:["NaCl","H2O","KNO3"],environment:"aqueous",temperatureC:25,
 doses:{NaCl:g(1),H2O:ml(.5),KNO3:g(.1)}
});
assert.ok((notBinary.solidMol.NaCl??0)>0,
 "In mixed weighed salts, an explicit school estimate conserves the shared solvent");
assert.equal(notBinary.solidMol.KNO3??0,0,
 "A sufficiently dilute second salt must dissolve even while NaCl remains supersaturated");

const stock=reaction.simulateLabInventory({
 reagents:["NaCl"],environment:"aqueous",temperatureC:25,
 doses:{NaCl:{value:10,unit:"ml",concentrationM:.1}}
});
assert.equal(stock.solidMol.NaCl??0,0,
 "Do not crystallize a prepared salt stock whose solvent volume is untracked");
let doses=initial.doses,vented=0,formed=false;
const baselineMass=reaction.labInventoryMassG(reaction.simulateLabInventory(initial));
const waterMassPerMl=stoich.labDoseMoles("H2O",ml(1))*stoich.labMolarMass("H2O");
for(let n=0;n<20;n++){
 const prior=doses.H2O?.value??0;
 const state=vapor.labEvaporate({kind:"dish",doses},10,108,185,200);
 doses=state.doses;
 vented+=(prior-(doses.H2O?.value??0));
 const updated=reaction.simulateLabInventory({
  ...initial,reagents:Object.keys(doses),doses
 });
 const remainingMass=reaction.labInventoryMassG(updated);
 approx(remainingMass+vented*waterMassPerMl,baselineMass,.001);
 approx(updated.speciesMol.NaCl*stoich.labMolarMass("NaCl"),1,.0001);
 if((updated.solidMol.NaCl??0)>0)formed=true;
 if(!doses.H2O)break;
}
assert.ok(vented>3,"Powered open evaporation removes physically significant solvent");
assert.ok(formed,"NaCl eventually crystallises as the water level falls");
const end=reaction.simulateLabInventory({
 ...initial,reagents:Object.keys(doses),doses
});
assert.ok((end.solidMol.NaCl??0)>0);
const endMass=lab.labVesselQuantity({...initial,reagents:Object.keys(doses),doses});
assert.ok(endMass.solidVolumeMl>0);
const heated=vapor.labEvaporate({kind:"dish",doses:{H2O:ml(20)}},10,100,180,200);
const unheated=vapor.labEvaporate({kind:"dish",doses:{H2O:ml(20)}},10,100,180,0);
assert.ok(heated.evaporatedMl>unheated.evaporatedMl+.5,
 "Latent heat and actual input heater power must control boiling-water loss");
assert.equal(vapor.labEvaporate({...initial,stoppered:true,stopperedAtC:100},10,100,180,200).evaporatedMl,0);
const css=fs.readFileSync("src/lektrusLabSceneLayout.css","utf8");
const component=fs.readFileSync("src/LektrusChemistryBench.tsx","utf8");
assert.match(css,/lektrus-lab-evaporation-crystals/);
assert.match(component,/growingSaltCrystals/);
assert.match(component,/Выпаривание: удалено/);
console.log("Measured NaCl saturation, true crystal volume, boiling energy and conserved evaporative mass passed");

/** Extend binary water/salt phase consistency to all catalogued salts
 * with a measured temperature curve. Unsupported mixtures stay unsupported. */
for(const [formula,at20,at100] of [
 ["KNO3",31.6,246],["KCl",34,56.7],["NaNO3",88,180]
]){
 approx(mat.labSingleSaltSolubilityGPer100gWater(formula,20),at20,1e-9);
 approx(mat.labSingleSaltSolubilityGPer100gWater(formula,100),at100,1e-9);
 assert.equal(mat.labSingleSaltSolubilityGPer100gWater(formula,115),undefined);
 const before={reagents:[formula,"H2O"],environment:"aqueous",
  temperatureC:20,doses:{[formula]:g(1),H2O:ml(.5)}};
 const concentrated=reaction.simulateLabInventory(before);
 assert.ok((concentrated.solidMol[formula]??0)>0,
  formula+" must crystallise beyond its experimental water saturation");
 const dissolved=reaction.simulateLabInventory({...before,
  doses:{[formula]:g(1),H2O:ml(15)}});
 assert.ok((dissolved.solidMol[formula]??0)<1e-12,
  formula+" must redissolve below its solubility limit");
 approx(concentrated.speciesMol[formula],dissolved.speciesMol[formula],1e-12);
 const reducedWater=vapor.labEvaporate({
  kind:"dish",doses:{[formula]:g(1),H2O:ml(.5)}
 },10,75,120,180);
 assert.ok(reducedWater.evaporatedMl>0,
  "Saturated "+formula+" must not stop solvent evaporation");
 const residual=reaction.simulateLabInventory({...before,
  reagents:Object.keys(reducedWater.doses),doses:reducedWater.doses});
 approx(residual.speciesMol[formula],concentrated.speciesMol[formula],1e-12);
 const sumMass=reaction.labInventoryMassG(residual)+
  (reducedWater.ventedVaporMl?.H2O??0)*waterMassPerMl;
 approx(sumMass,reaction.labInventoryMassG(concentrated),.001);
 assert.ok(lab.labVesselQuantity({...before}).solidVolumeMl>0);
 const completelyDry=reaction.simulateLabInventory({
  reagents:[formula],environment:"aqueous",temperatureC:20,
  doses:{[formula]:g(1)}
 });
 approx(completelyDry.solidMol[formula],
  completelyDry.speciesMol[formula],1e-12);
}
const coolingKNO3=reaction.simulateLabInventory({
 reagents:["KNO3","H2O"],environment:"aqueous",temperatureC:20,
 doses:{KNO3:g(2),H2O:ml(5)}
});
const warmingKNO3=reaction.simulateLabInventory({
 reagents:["KNO3","H2O"],environment:"aqueous",temperatureC:90,
 doses:{KNO3:g(2),H2O:ml(5)}
});
assert.ok((coolingKNO3.solidMol.KNO3??0)>.3/
 stoich.labMolarMass("KNO3"));
assert.equal(warmingKNO3.solidMol.KNO3??0,0,
 "Heating KNO3 increases its measured solubility without changing total moles");
approx(coolingKNO3.speciesMol.KNO3,warmingKNO3.speciesMol.KNO3);
const multicomponent=reaction.simulateLabInventory({
 reagents:["KNO3","KCl","H2O"],environment:"aqueous",temperatureC:20,
 doses:{KNO3:g(1),KCl:g(1),H2O:ml(.5)}
});
assert.ok((multicomponent.solidMol.KNO3??0)>0&&
 (multicomponent.solidMol.KCl??0)>0,
 "School mixed-solute equilibrium computes two independent saturation targets");
approx(multicomponent.speciesMol.KNO3,1/stoich.labMolarMass("KNO3"));
approx(multicomponent.speciesMol.KCl,1/stoich.labMolarMass("KCl"));
const stockKNO3=reaction.simulateLabInventory({
 reagents:["KNO3"],environment:"aqueous",temperatureC:20,
 doses:{KNO3:{unit:"ml",value:10,concentrationM:.1}}
});
assert.equal(stockKNO3.solidMol.KNO3??0,0);
const ui=fs.readFileSync("src/LektrusChemistryBench.tsx","utf8");
assert.match(ui,/labSingleSaltSolubilityGPer100gWater/);
assert.match(ui,/Кристаллы соли образуются при выпаривании воды/);
console.log("KNO3, KCl, NaNO3: binary solubility, cold crystallization, redissolution and evaporation mass conservation OK");
