/** Executable checks of the reviewed sequential mass-balance engine.
 * Transpile TypeScript in-memory to avoid a separate test runner dependency. */
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
 const transpiled=ts.transpileModule(source,{compilerOptions:{
  module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2023
 }}).outputText;
 const requireLocal=(specifier)=>{
  if(!specifier.startsWith("."))throw new Error("Unexpected dependency "+specifier);
  return load(path.resolve(path.dirname(resolved),specifier+".ts"));
 };
 new Function("require","module","exports",transpiled)(requireLocal,mod,mod.exports);
 return mod.exports;
}
const {simulateLabInventory,labInventoryMassG}=load("src/lektrusLabReactionNetwork.ts");
const {labMolarMass}=load("src/lektrusLabStoichiometry.ts");
const solution=(value,concentrationM=.1)=>({value,unit:"ml",concentrationM});
const approximately=(actual,expected,tolerance=1e-9)=>
 assert.ok(Math.abs(actual-expected)<tolerance,`Expected ${actual} ≈ ${expected}`);
const mixtures=[
 ["AgNO3","NaCl"],["BaCl2","Na2SO4"],["HCl","NaOH"]
];
for(const ids of mixtures){
 const doses=Object.fromEntries(ids.map(id=>[id,solution(10)]));
 const result=simulateLabInventory({reagents:ids,doses,environment:"aqueous"});
 assert.ok(result.steps.length>0,"No product for "+ids.join("+"));
 const expected=ids.reduce((sum,id)=>sum+0.001*labMolarMass(id),0);
 approximately(labInventoryMassG(result),expected,1e-7);
 assert.equal(result.unmeasured.length,0);
}
const sample=simulateLabInventory({
 reagents:["AgNO3","NaCl"],environment:"aqueous",
 doses:{AgNO3:solution(10),NaCl:solution(10)}
});
assert.ok((sample.solidMol.AgCl??0)>0.00099);
assert.ok((sample.solidMol.AgCl??0)<0.001);
assert.ok((sample.speciesMol.NaNO3??0)>0.00099);
const diluted=simulateLabInventory({
 reagents:["AgNO3","NaCl","H2O"],environment:"aqueous",
 doses:{AgNO3:solution(10),NaCl:solution(10),H2O:{value:20,unit:"ml"}}
});
assert.ok((diluted.solidMol.AgCl??0)>0.00099,"Water must not erase precipitate");
const two=simulateLabInventory({
 reagents:["AgNO3","NaCl","BaCl2","Na2SO4"],
 environment:"aqueous",
 doses:{AgNO3:solution(10),NaCl:solution(10),BaCl2:solution(10),Na2SO4:solution(10)}
});
assert.ok((two.solidMol.AgCl??0)>0.0009);
assert.ok((two.solidMol.BaSO4??0)>0.0009);
assert.ok(two.steps.length>=2);
const inactive=simulateLabInventory({
 reagents:["NaCl","KNO3"],environment:"aqueous",
 doses:{NaCl:solution(10),KNO3:solution(10)}
});
assert.equal(inactive.steps.length,0,"Inert salts must not invent a reaction");
const unknown=simulateLabInventory({reagents:["NaCl"],environment:"aqueous"});
assert.deepEqual(unknown.unmeasured,["NaCl"]);
const diluteBelowKsp=simulateLabInventory({
 reagents:["AgNO3","NaCl"],environment:"aqueous",
 doses:{AgNO3:solution(10,1e-6),NaCl:solution(10,1e-6)}
});
assert.ok(!diluteBelowKsp.solidMol.AgCl,"Below Ksp: no visible precipitate");
console.log("Sequential lab chemistry checks passed");


const lead=simulateLabInventory({
 reagents:["Pb(NO3)2","KI"],environment:"aqueous",
 temperatureC:25,
 doses:{"Pb(NO3)2":solution(10),KI:solution(20)}
});
assert.ok(lead.steps.some(s=>s.equation.includes("PbI2↓")),
 "A 1:2 lead iodide reaction must be included");
assert.ok((lead.solidMol.PbI2??0)>0.0009&&lead.solidMol.PbI2<0.001,
 "PbI2 precipitation must retain a calculable dissolved remainder");
approximately(labInventoryMassG(lead),
 .001*labMolarMass("Pb(NO3)2")+.002*labMolarMass("KI"),1e-7);
const weakLead=simulateLabInventory({
 reagents:["Pb(NO3)2","KI"],environment:"aqueous",
 temperatureC:25,
 doses:{"Pb(NO3)2":solution(10,.0001),KI:solution(10,.0001)}
});
assert.ok(!(weakLead.solidMol.PbI2>0),
 "Undersaturated lead iodide must not precipitate");
const iron=simulateLabInventory({
 reagents:["FeCl3","NaOH"],environment:"aqueous",
 temperatureC:25,
 doses:{FeCl3:solution(10),NaOH:solution(30)}
});
assert.ok((iron.solidMol["Fe(OH)3"]??0)>.00099,
 "1:3 hydroxide precipitation uses the Fe3+/OH- mass-action powers");
const neutralization=simulateLabInventory({
 reagents:["HCl","NaOH"],environment:"aqueous",
 doses:{HCl:solution(10),NaOH:solution(10)}
});
assert.ok(neutralization.heatEstimateComplete);
approximately(neutralization.knownHeatKJ,-.0573,1e-7);
assert.equal(sample.heatEstimateComplete,false,
 "Do not invent an enthalpy for a reaction lacking vetted thermodynamics");
assert.ok(sample.knownHeatKJ===undefined);
console.log("Expanded Ksp, 1:2 and 1:3 precipitation and audited heat effects passed");


const cupboardCss=fs.readFileSync("src/lektrusChemistryBench.css","utf8");
assert.match(cupboardCss,/grid-template-rows:repeat\(2,minmax\(0,1fr\)\)!important/,
 "Bench cupboard tiles must have two rows with enough height for labels");
assert.match(cupboardCss,/grid-auto-rows:minmax\(50px,auto\)!important/,
 "Narrow cupboard must scroll through legible glassware rows");
assert.match(cupboardCss,/is-glassware \.lektrus-lab-modal-ware button:has\(\.lektrus-lab-ware-icon\)/,
 "Expanded cupboard must reserve icon and title slots");
const cabinetView=fs.readFileSync("src/LektrusChemistryBench.tsx","utf8");
assert.match(cabinetView,/<small>\{kind\.name\}<\/small>/,
 "Every compact icon must retain its visible full-name label");
console.log("Glassware cupboard compact and expanded layout guards passed");


const openGas=simulateLabInventory({
 reagents:["HCl","NaHCO3"],environment:"aqueous",
 doses:{HCl:solution(30),NaHCO3:{unit:"g",value:.3}}
});
const closedGas=simulateLabInventory({
 reagents:["HCl","NaHCO3"],environment:"aqueous",stoppered:true,
 doses:{HCl:solution(30),NaHCO3:{unit:"g",value:.3}}
});
assert.ok((openGas.releasedGasMol.CO2??0)>0,
 "Gas from a reviewed reaction escapes an open flask");
assert.ok((closedGas.retainedGasMol.CO2??0)>0,
 "Gas from the SAME balanced reaction stays inside a corked flask");
assert.equal(closedGas.releasedGasMol.CO2??0,0,
 "Closed flask must not simultaneously vent reaction gas");
assert.equal(openGas.retainedGasMol.CO2??0,0);
approximately(openGas.releasedGasMol.CO2,closedGas.retainedGasMol.CO2,1e-12);
approximately(labInventoryMassG(openGas),labInventoryMassG(closedGas),1e-8);
approximately(labInventoryMassG(closedGas),
 .003*labMolarMass("HCl")+.3,1e-7);
console.log("Open-vessel CO2 escapes; corked CO2 remains, fully mass-balanced");


const catalogue=load("src/lektrusLabCatalog.ts");
const {substances:allStockReagents}=load("src/lektrusReactionDatabase.ts");
const {labDoseMoles}=load("src/lektrusLabStoichiometry.ts");
const unquantifiable=[];
for(const substance of allStockReagents){
 const dose=catalogue.labDefaultStockDose(substance.id);
 const moles=dose?labDoseMoles(substance.id,dose):undefined;
 if(!dose||!Number.isFinite(moles)||!(moles>0))
  unquantifiable.push(substance.id);
}
assert.deepEqual(unquantifiable,[],
 "Every reagent offered by the virtual catalog must have an explicit measurable stock quantity");
console.log("Every catalog stock has measurable material amount, including neat liquids and gases");


// Conditions are physical, not just a UI mode: two dry powders cannot
// precipitate before solvent is supplied, even in "aqueous" mode.
const dryPowders={AgNO3:{value:1,unit:"g"},NaCl:{value:1,unit:"g"}};
const dryReaction=simulateLabInventory({
 reagents:["AgNO3","NaCl"],environment:"aqueous",doses:dryPowders
});
assert.equal(dryReaction.steps.length,0,
 "Aqueous mode alone must not react two dry crystals");
assert.ok((dryReaction.solidMol.NaCl??0)>0);
assert.ok((dryReaction.solidMol.AgNO3??0)>0);
const wettedReaction=simulateLabInventory({
 reagents:["AgNO3","NaCl","H2O"],environment:"aqueous",
 doses:{...dryPowders,H2O:{value:50,unit:"ml"}}
});
assert.ok((wettedReaction.solidMol.AgCl??0)>0,
 "The same existing precipitation must become possible with water");

// Gases are NEVER poured or heated as neat liquid stocks. CO2 has a
// normal-pressure sublimation point, not a normal boiling point.
const thermalProps=load("src/lektrusLabPhysicalProperties.ts");
const registryProps=load("src/lektrusLabPropertyRegistry.ts");
const physicalDensity=load("src/lektrusLabMaterialConstants.ts");
assert.equal(thermalProps.labThermalInfo("CO2","ml").form,"gas");
assert.equal(thermalProps.labThermalInfo("CO2","ml").boilingC,undefined);
assert.equal(thermalProps.labThermalInfo("CO2","ml").sublimationC,-78.5);
assert.equal(thermalProps.labThermalInfo("O2","ml").boilingC,-183);
assert.equal(thermalProps.labVesselThermal(["O2"],{
 O2:{value:10,unit:"ml"}
}),null,"Gas bottles do not count as boiling liquid");
assert.equal(registryProps.labSubstanceProperties("CO2").physicalForm,"gas");
assert.equal(registryProps.labSubstanceProperties("CO2").sublimationC,-78.5);
for(const [formula,expected] of Object.entries({
 Si:2.3296,S:2.067,I2:4.93,Fe2O3:5.24,Fe3O4:5.175,
 SiO2:2.65,ZnS:4.04,PbS:7.60
})){
 approximately(physicalDensity.labCrystalDensityGml(formula),expected);
 const props=registryProps.labSubstanceProperties(formula);
 assert.ok(props.densityKnown,"Current stock or reviewed product has checked density: "+formula);
}
console.log("Dry/aqueous reaction isolation, gas transitions, and curated crystal densities passed");


// Every new Merck pure-water entry participates in the SAME binary
// dissolution/evaporation engine. This guards units, molar mass, interpolation,
// cooling and mass conservation, not just property-data presence.
const newBinarySolubilities={
 NH4Cl:[29.7,37.56,46,55.3,65.6,77.3],
 NH4NO3:[118.5,187.7,283,415,610,1000],
 "(NH4)2SO4":[70.4,75.44,81.2,87.4,94.1,102],
 "Ba(NO3)2":[4.95,9.06,14.4,20.3,27.2,34.2],
 "Pb(NO3)2":[36.4,52.22,69.4,88,107.5,127.3],
 KBr:[54,65.85,76.1,85.9,95.3,104.9],
 KI:[127.8,144.51,161,176.2,191.5,208],
 K2SO4:[7.33,11.11,14.79,18.2,21.29,24.1],
 AgNO3:[115,219.2,334.8,471,652,1024],
 NaNO2:[73,84.52,95.7,112.3,135.5,163],
 NaHCO3:[6.89,9.6,12.7,16,null,null],
 KMnO4:[2.83,6.43,12.56,22.4,null,null]
};
const referenceTemperatures=[0,20,40,60,80,100];
for(const [formula,data] of Object.entries(newBinarySolubilities)){
 const amount=labMolarMass(formula);
 assert.ok(amount>0,formula+" must have a supported formula mass");
 for(let i=0;i<data.length;i++){
  const measured=physicalDensity.labSingleSaltSolubilityGPer100gWater(
   formula,referenceTemperatures[i]);
  if(data[i]===null)assert.equal(measured,undefined,
   formula+" must NOT extrapolate into an undocumented range");
  else approximately(measured,data[i],1e-8);
 }
 assert.equal(physicalDensity.labSingleSaltSolubilityGPer100gWater(formula,101),undefined);
 assert.equal(physicalDensity.labSingleSaltSolubilityGPer100gWater(formula,-1),undefined);
 const dilute={reagents:[formula,"H2O"],environment:"aqueous",
  temperatureC:20,doses:{[formula]:{unit:"g",value:1},H2O:{unit:"ml",value:100}}};
 const saturated={...dilute,
  doses:{[formula]:{unit:"g",value:1},H2O:{unit:"ml",value:.1}}};
 const inWater=simulateLabInventory(dilute);
 const asCrystals=simulateLabInventory(saturated);
 assert.ok((asCrystals.solidMol[formula]??0)>0,
  formula+" supersaturated binary water mixture should form crystals");
 assert.ok(!(inWater.solidMol[formula]>1e-10),
  formula+" sufficiently dilute mixture must dissolve");
 approximately(inWater.speciesMol[formula],asCrystals.speciesMol[formula],1e-12);
 approximately(labInventoryMassG(inWater),labInventoryMassG(asCrystals)+
  (100-.1)*.997,1e-4);
}
assert.equal(physicalDensity.labSingleSaltSolubilityGPer100gWater("NaHCO3",65),
 undefined,"Never interpolate beyond the documented bicarbonate range");
assert.equal(physicalDensity.labSingleSaltSolubilityGPer100gWater("KMnO4",90),
 undefined,"No extrapolated permanganate solubility");
console.log("12 additional measured binary salt curves: 72 temperature cells and conserved crystallization");

// Reference properties are consistent across the previously existing quantity,
// phase, calorimetry and vapor simulation paths.
const heatProps=load("src/lektrusLabCalorimetry.ts");
const vaporProps=load("src/lektrusLabEvaporation.ts");
const neatLiquids=["H2O","C2H5OH","CH3OH","C3H8O","Br2","CH3CHO"];
for(const formula of neatLiquids){
 const heat=heatProps.LAB_CALORIMETRY_REFERENCE[formula];
 const vapor=vaporProps.LAB_VAPOR_REFERENCE[formula];
 assert.ok(heat?.densityGPerMl>0&&heat.specificJPerGK>0);
 assert.ok(vapor?.densityGml>0);
 approximately(heat.densityGPerMl,vapor.densityGml,1e-12);
 approximately(labDoseMoles(formula,{unit:"ml",value:10}),
  10*heat.densityGPerMl/labMolarMass(formula),1e-8);
 assert.ok(heatProps.labKnownHeatCapacityJPerK("beaker",{
  [formula]:{unit:"ml",value:10}
 })>0);
}
const aldehyde=thermalProps.labThermalInfo("CH3CHO","ml");
assert.equal(aldehyde.form,"pure");
assert.ok(Math.abs(aldehyde.boilingC-20.8)<1);
const acetaldehydeVapor=vaporProps.labSaturationPressureKPa("CH3CHO",20.8);
assert.ok(acetaldehydeVapor>90&&acetaldehydeVapor<115,
 "NIST acetaldehyde Antoine must give near-atmospheric vapor pressure at its boiling point");
const evaporatingAldehyde=vaporProps.labEvaporate({
 kind:"dish",doses:{CH3CHO:{value:10,unit:"ml"}}
},10,22,100,200);
assert.ok(evaporatingAldehyde.evaporatedMl>0,
 "Pure acetaldehyde must use the existing evaporation process");
assert.ok(evaporatingAldehyde.doses.CH3CHO?.value<10);
const aqueousAldehyde=vaporProps.labEvaporate({
 kind:"dish",doses:{CH3CHO:{value:10,unit:"ml",concentrationM:.1}}
},10,22,100,200);
assert.equal(aqueousAldehyde.evaporatedMl,0,
 "Prepared stocks must never inherit neat acetaldehyde vapor constants");
for(const [formula,density] of Object.entries({
 K2Cr2O7:2.676,KMnO4:2.70,KI:3.13,NaBr:3.21,SrSO4:3.96,
 "Ba(NO3)2":3.24,"Pb(NO3)2":4.53,KNO2:1.915,
 NH4NO3:1.72,C12H22O11:1.59,C6H12O6:1.562
})){
 approximately(physicalDensity.labCrystalDensityGml(formula),density);
 assert.ok(registryProps.labSubstanceProperties(formula).densityKnown);
}
console.log("Neat liquid mass/heat/vapor references and 11 solid densities agree across subsystems");
