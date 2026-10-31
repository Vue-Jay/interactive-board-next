/** Full cabinet and major-process smoke audit for the Lektrus school lab.
 * Reuses the real in-app source modules, never parallel hand-built data.
 * Measured science and illustrative approximations remain separate.
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
 const source=fs.readFileSync(resolved,"utf8");
 const js=ts.transpileModule(source,{compilerOptions:{
  module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2023
 }}).outputText;
 new Function("require","module","exports",js)(id=>{
  assert.ok(id.startsWith("."),"Unexpected import "+id);
  return load(path.resolve(path.dirname(resolved),id+".ts"));
 },mod,mod.exports);
 return mod.exports;
}
const reaction=load("src/lektrusReactionDatabase.ts");
const catalog=load("src/lektrusLabCatalog.ts");
const material=load("src/lektrusLabMaterialConstants.ts");
const heat=load("src/lektrusLabCalorimetry.ts");
const stoich=load("src/lektrusLabStoichiometry.ts");
const reg=load("src/lektrusLabPropertyRegistry.ts");
const ph=load("src/lektrusLabPH.ts");
const bench=load("src/lektrusChemistryBenchModel.ts");
const vapor=load("src/lektrusLabEvaporation.ts");
const inv=load("src/lektrusLabReactionNetwork.ts");
assert.equal(reaction.substances.length,180,"All catalog stocks must be audited");
const unique=new Set();
let weighed=0,liquid=0,gases=0,estimated=0,solidReference=0;
for(const stock of reaction.substances){
 assert.ok(!unique.has(stock.id),"Duplicate cabinet formula "+stock.id);
 unique.add(stock.id);
 const mass=stoich.labMolarMass(stock.id);
 assert.ok(Number.isFinite(mass)&&mass>0,"Invalid formula "+stock.id);
 const properties=reg.labSubstanceProperties(stock.id);
 assert.equal(properties.inCabinet,true);
 assert.ok(properties.teachingEstimate.solidDensityGPerMl>0);
 assert.ok(properties.teachingEstimate.solidSpecificHeatJPerGK>0);
 if(properties.crystalDensityGPerMl!==undefined){
  solidReference++;
  assert.equal(properties.crystalDensityGPerMl,
   material.labCrystalDensityGml(stock.id));
 }
 if(material.labCrystalDensityGml(stock.id)===undefined)estimated++;
 const forms=catalog.labReagentForms(stock);
 assert.ok(forms.length>0,"No usable form "+stock.id);
 for(const unit of forms){
  const dose=catalog.labDefaultStockDose(stock.id,unit);
  assert.ok(dose&&dose.value>0,"No school dose "+stock.id+" "+unit);
  const moles=stoich.labDoseMoles(stock.id,dose);
  assert.ok(Number.isFinite(moles)&&moles>0,
   "Stock lacks numeric moles "+stock.id+" "+unit);
  if(unit==="g"){
   weighed++;
   const c=heat.labKnownHeatCapacityJPerK("beaker",
    {[stock.id]:{unit:"g",value:1}});
   assert.ok(c>0&&Number.isFinite(c),"Dry sample cannot heat "+stock.id);
  }else if(catalog.cabinetPhase(stock)==="gas")gases++;
  else{
   liquid++;
   assert.ok(heat.labKnownHeatCapacityJPerK("beaker",
    {[stock.id]:dose})>0,"Aqueous or neat stock cannot heat "+stock.id);
  }
 }
 if(["соль","основание","органика"].includes(stock.kind)){
  const sat=material.labSchoolSolubilityGPer100gWater(stock.id,22);
  assert.ok(sat&&Number.isFinite(sat.value)&&sat.value>=0,
   "No school solubility estimate "+stock.id);
 }
}
assert.ok(weighed>100&&liquid>50&&gases>10);
assert.ok(solidReference>=131&&estimated>10);
let balanced=0;
for(const row of reaction.reviewedReactionCases){
 if(row.status!=="reaction")continue;
 const equation=stoich.parseBalancedLabEquation(row.equation);
 assert.ok(equation,"Unbalanced curated equation "+row.equation);
 for(const term of [...equation.reactants,...equation.products])
  assert.ok(stoich.labMolarMass(term.formula)>0,
   "Unknown atomic formula in product "+term.formula);
 balanced++;
}
assert.ok(balanced>=300,"Reviewed chemistry pathways unexpectedly missing");
const solution=(id,concentrationM=.1)=>({
 reagents:[id],environment:"aqueous",
 doses:{[id]:{value:20,unit:"ml",concentrationM}}
});
const acid=ph.labVesselPH(solution("HCl"));
assert.ok(acid&&Math.abs(acid.pH-1)<.02);
const ranges=[
 ["H2SO4",.5,1.7],["H3PO4",1,3],["HBr",.5,1.5],
 ["HI",.5,1.5],["HF",1.5,3.5],["CH3COOH",2,4],
 ["Na2CO3",10,13],["K2CO3",10,13],["NaHCO3",7.5,9.5],
 ["Na3PO4",10,14],["K3PO4",10,14],["NaH2PO4",3,6],
 ["NH4Cl",4,7],["NH4NO3",4,7],["CH3COONa",7.5,11],
 ["Na2SO4",5,9],["LiOH",12,14],["AgNO3",4,9],
 ["CuCl2",3,8],["FeCl3",1,6]
];
for(const [id,minimum,maximum] of ranges){
 const result=ph.labVesselPH(solution(id));
 assert.ok(result&&result.pH>=minimum&&result.pH<=maximum,
  "Unexpected school pH "+id+": "+JSON.stringify(result));
 assert.ok(result.note.length>20);
}
const neutral=ph.labVesselPH({reagents:["HCl","NaOH"],
 environment:"aqueous",doses:{
 HCl:{value:20,unit:"ml",concentrationM:.1},
 NaOH:{value:20,unit:"ml",concentrationM:.1}
 }});
assert.ok(neutral&&Math.abs(neutral.pH-7)<.05);
const precip=inv.simulateLabInventory({
 reagents:["AgNO3","NaCl"],environment:"aqueous",
 doses:{AgNO3:{value:10,unit:"ml",concentrationM:.1},
 NaCl:{value:10,unit:"ml",concentrationM:.1}}
});
assert.ok((precip.solidMol.AgCl??0)>0.0009);
assert.equal(precip.unmeasured.length,0);
const water=bench.putLabReagent(bench.defaultLabBench(),"v1","H2O",
 {value:20,unit:"ml"});
assert.ok(bench.labVesselQuantity(water.vessels[0]).occupiedMl>=20);
for(const mode of bench.LAB_MODES){
 const setup=bench.prepareLabModeSetup(bench.setLabMode(bench.defaultLabBench(),mode.id));
 assert.ok(setup.vessels.length>0,"No vessels for mode "+mode.id);
 assert.ok(setup.vessels.every(v=>Number.isFinite(
  bench.labVesselQuantity(v).occupiedMl)),"Invalid vessel volume "+mode.id);
}
assert.ok(vapor.labVaporPressureKPa({kind:"beaker",
 doses:{H2O:{value:20,unit:"ml"}}},22)>2);
console.log("School laboratory end-to-end audit:",reaction.substances.length,
 "reagents,",balanced,"balanced reactions,",weighed,
 "solid stock modes,",liquid,"liquid stock modes,",gases,
 "gas stock modes,",ranges.length,"acid-base systems,",
 solidReference,"measured crystal densities and",estimated,
 "estimated crystal densities. PASS");
