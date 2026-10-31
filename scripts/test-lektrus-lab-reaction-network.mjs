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


// The new reference constants must feed real displacement and phase data,
// not remain unreachable entries in a static text table.
for(const [formula,density] of Object.entries({
 "Ca(OH)2":2.24,MgCl2:2.325,NaF:2.78,Ag2CO3:6.077,
 AlCl3:2.44,FeS:4.75,SrCO3:3.5,PbO:9.53,
 MnO2:5.0,NaNO2:2.17,MgSO4:2.66,
 FeCl3:2.90,FeCl2:3.16,ZnCl2:2.907,LiCl:2.07,Na2S:1.856
})){
 approximately(physicalDensity.labCrystalDensityGml(formula),density,1e-12);
 const property=registryProps.labSubstanceProperties(formula);
 assert.equal(property.crystalDensityGPerMl,density);
 assert.ok(property.molarMassGPerMol>0);
 const dry=simulateLabInventory({reagents:[formula],environment:"aqueous",
  doses:{[formula]:{unit:"g",value:1}}});
 assert.ok((dry.solidMol[formula]??0)>0,
  "Measured anhydrous solid must stay dry without liquid: "+formula);
}
for(const [formula,check] of Object.entries({
 MgCl2:{meltingC:714},FeCl2:{meltingC:674},
 PbO:{meltingC:887,boilingC:1472},
 AlCl3:{sublimationC:178},
 FeS:{meltingC:1194},
 SrCO3:{decompositionC:1100},
 MnO2:{decompositionC:535}
})){
 const info=thermalProps.labThermalInfo(formula,"g");
 assert.equal(info.known,true);
 for(const [name,value] of Object.entries(check))
  assert.equal(info[name],value,formula+" "+name);
 assert.equal(thermalProps.labThermalInfo(formula,"ml").known,false,
  "A prepared solution must not borrow pure-solid phase transitions");
}
console.log("Eleven added densities + six phase records: pure-material and dry-phase guards passed");

// Pure MgO calorimetry must be quantitative and use J/g/K, with the
// configured vessel heat equivalent, not a fabricated aqueous mixture.
const testedMgOHeat=heatProps.labKnownHeatCapacityJPerK("beaker",{
 MgO:{unit:"g",value:10}
});
approximately(testedMgOHeat,
 heatProps.LAB_VESSEL_GLASS_EQUIVALENT_G.beaker*.84+10*.92885,1e-9);

for(const [formula,cp] of Object.entries({NaCl:.853,"(NH4)2SO4":1.423})){
 const known=heatProps.LAB_CALORIMETRY_REFERENCE[formula];
 approximately(known.specificJPerGK,cp);
 approximately(heatProps.labKnownHeatCapacityJPerK("beaker",{
  [formula]:{unit:"g",value:10}
 }),heatProps.LAB_VESSEL_GLASS_EQUIVALENT_G.beaker*.84+10*cp,1e-9);
}


// Additional phase references for catalog gas cylinders and dry crystals.
// Crucially these gas volumes do not become liquid in the thermal model.
for(const [formula,data] of Object.entries({
 CH4:{meltingC:-182.5,boilingC:-161.5},
 C2H6:{boilingC:-88.6},
 C2H4:{meltingC:-169.4,boilingC:-103.8},
 C3H8:{meltingC:-187.7,boilingC:-42.1},
 C4H10:{meltingC:-137.2,boilingC:-0.5},
 C3H6:{meltingC:-185.2,boilingC:-47.6},
 C2H2:{sublimationC:-84.05},
 SO2:{meltingC:-75.5,boilingC:-10},
 H2S:{meltingC:-82.3,boilingC:-60.3}
})){
 const result=thermalProps.labThermalInfo(formula,"ml");
 assert.equal(result.form,"gas",formula+" must remain a gas, never a volatile liquid dose");
 assert.equal(result.known,true);
 for(const [field,expected] of Object.entries(data))approximately(result[field],expected,1e-6);
 assert.equal(thermalProps.labVesselThermal([formula],{
  [formula]:{value:100,unit:"ml"}
 }),null,"Gas inventory cannot be heated as liquid");
 const stock=registryProps.labSubstanceProperties(formula);
 assert.equal(stock.physicalForm,"gas");
}
for(const formula of ["C2H2","CO2"]){
 assert.equal(thermalProps.labThermalInfo(formula,"ml").boilingC,undefined,
  "No invented atmospheric liquid boiling temperature for subliming gas");
}
for(const [formula,data] of Object.entries({
 LiCl:{meltingC:610},NaBr:{meltingC:755,boilingC:1390},
 AgI:{meltingC:552,boilingC:1506},
 "Ba(NO3)2":{meltingC:590,decompositionC:590}
})){
 const result=thermalProps.labThermalInfo(formula,"g");
 assert.equal(result.known,true);
 for(const [field,expected] of Object.entries(data))approximately(result[field],expected,1e-6);
 assert.equal(thermalProps.labThermalInfo(formula,"ml").known,false,
  "Salt solution cannot acquire dry salt melting point");
}
console.log("Nine measured pure-gas records, four dry salts, and no gas/solution confusion");


// Bulk-imported Merck measured water solubility (g/100 g H2O).
// Every isolated datum must be readable at its exact temperature but MUST NOT
// invent intermediate values when neighbouring knots are unknown.
const bulkBinary={
 K2CO3:[105.5,111.5,117,127,140,156],
 K2Cr2O7:[4.68,12.49,26.3,45.6,73,103],
 CuSO4:[25.5,36.2,48,60,70,83],
 Na2CO3:[7.1,21.4,48.5,46.5,45.8,45.5],
 Li2CO3:[null,1.33,null,null,null,null],
 NaF:[null,4.1,null,null,null,null],
 NaBr:[null,null,null,118,118.3,121.2],
 Na2SO3:[null,null,37,33.2,29,26.6],
 Na2SO4:[null,null,48.1,45.26,43.09,42.3],
 ZnCl2:[null,null,453,488,541,614],
 NaH2PO4:[null,null,null,179.3,207.3,284.4]
};
const temperatureKnots=[0,20,40,60,80,100];
let measuredNewCells=0;
for(const [formula,values] of Object.entries(bulkBinary)){
 assert.ok(labMolarMass(formula)>0,"Formula should parse: "+formula);
 for(let i=0;i<values.length;i++){
  const value=physicalDensity.labSingleSaltSolubilityGPer100gWater(
   formula,temperatureKnots[i]);
  if(values[i]===null)assert.equal(value,undefined,formula+" at "+temperatureKnots[i]);
  else {
   measuredNewCells++;
   approximately(value,values[i],1e-8);
  }
 }
 assert.equal(physicalDensity.labSingleSaltSolubilityGPer100gWater(formula,-1),undefined);
 assert.equal(physicalDensity.labSingleSaltSolubilityGPer100gWater(formula,101),undefined);
}
assert.equal(measuredNewCells,44);
// NaF remains an isolated 20 C measurement. Li2CO3 is now a fully
// independently tabulated retrograde solubility series, not isolated data.
assert.equal(physicalDensity.labSingleSaltSolubilityGPer100gWater("NaF",15),undefined);
assert.equal(physicalDensity.labSingleSaltSolubilityGPer100gWater("NaF",20.01),undefined);
const lithiumCarbonateKnot=[1.543,1.33,1.174,1.010,.847,.715];
for(let i=0;i<lithiumCarbonateKnot.length;i++)
 approximately(physicalDensity.labSingleSaltSolubilityGPer100gWater(
  "Li2CO3",[0,20,40,60,80,100][i]),lithiumCarbonateKnot[i],1e-10);
approximately(physicalDensity.labSingleSaltSolubilityGPer100gWater(
 "Li2CO3",30),(1.33+1.174)/2,1e-10);
assert.ok(lithiumCarbonateKnot.every((v,i,a)=>i===0||v<a[i-1]),
 "Lithium carbonate should become LESS soluble as water warms");
assert.equal(physicalDensity.labSingleSaltSolubilityGPer100gWater(
 "Li2CO3",101),undefined);
approximately(physicalDensity.labSingleSaltSolubilityGPer100gWater("K2Cr2O7",30),
 (12.49+26.3)/2,1e-9);
for(const id of ["CuSO4","Na2CO3","Na2SO4","K2CO3","NaBr","Na2SO3","ZnCl2","NaH2PO4"]){
 assert.ok(physicalDensity.LAB_HYDRATE_PHASE_REQUIRES_SPECIAL_MODEL.has(id));
 const sample=simulateLabInventory({
  reagents:[id,"H2O"],environment:"aqueous",temperatureC:20,
  doses:{[id]:{value:20,unit:"g"},H2O:{value:1,unit:"ml"}}
 });
 assert.ok(!(sample.solidMol[id]>0),
  "Must not invent anhydrous crystals for a hydration-dependent salt: "+id);
}
// Stable anhydrous crystals can still form from a measured single-salt,
// single-water mixture, conserving the complete molecular amount.
for(const id of ["Li2CO3","NaF","K2Cr2O7"]){
 const result=simulateLabInventory({
  reagents:[id,"H2O"],environment:"aqueous",temperatureC:20,
  doses:{[id]:{value:4,unit:"g"},H2O:{value:1,unit:"ml"}}
 });
 assert.ok((result.solidMol[id]??0)>0,id+" should crystallize in binary pure water");
}
const dataOnly=Object.values(bulkBinary).reduce((n,row)=>n+row.filter(v=>v!==null).length,0);
assert.equal(dataOnly,44);
console.log("Eleven new salt solubility datasets; 44 measured knots; hydrate-safe crystallization");

// Heat capacity of these exact dry compounds, not the unknown mixture Cp.
// Source entries are J/g/K, from University Medical Lublin and
// Advances in Solar Heating and Cooling, not solution guesses.
const bulkHeatCapacities={
 NH4Cl:1.57,NH4NO3:1.74,CaCl2:.657,Na2CO3:1.06,
 NaOH:1.49,Na2SO4:.903,KBr:.439,KNO3:.95,
 Al2O3:.840,Fe3O4:.752,KCl:.670,K2SO4:.920
};
for(const [id,cp] of Object.entries(bulkHeatCapacities)){
 assert.equal(heatProps.LAB_CALORIMETRY_REFERENCE[id].phase,"solid");
 approximately(heatProps.LAB_CALORIMETRY_REFERENCE[id].specificJPerGK,cp);
 approximately(heatProps.labKnownHeatCapacityJPerK("beaker",{
  [id]:{unit:"g",value:5}
 }),heatProps.LAB_VESSEL_GLASS_EQUIVALENT_G.beaker*.84+5*cp,1e-8);
 assert.equal(heatProps.labKnownHeatCapacityJPerK("beaker",{
  H2O:{unit:"ml",value:5},[id]:{unit:"g",value:5}
 }),undefined,"Mixing with water needs solution heat capacity: "+id);
}
for(const [id,d] of Object.entries({FeO:6,CuS:4.76,Na2O:2.27,NiSO4:4.01})){
 approximately(physicalDensity.labCrystalDensityGml(id),d,1e-12);
 assert.equal(registryProps.labSubstanceProperties(id).crystalDensityGPerMl,d);
}
for(const [id,record] of Object.entries({
 CuS:{decompositionC:220},FeO:{meltingC:1377},
 Fe2O3:{meltingC:1565},Na2SO4:{meltingC:884},K2CO3:{meltingC:891}
})){
 const t=thermalProps.labThermalInfo(id,"g");
 assert.equal(t.known,true);
 for(const [key,value] of Object.entries(record))approximately(t[key],value);
 assert.equal(thermalProps.labThermalInfo(id,"ml").known,false,
  "A prepared solution does not acquire solid phase transitions: "+id);
}
assert.equal(thermalProps.labThermalInfo("CuS","g").behavior,"decomposes");
console.log("Twelve dry specific heats, four crystal densities, five solid phase records verified");


// Hydrate references are an independent measurement series, NOT anhydrous
// binary saturation or a fictitious source of dry-crystal mass.
const hydrates=load("src/lektrusLabHydrateReferences.ts");
const rows=hydrates.LAB_HYDRATE_SOLUBILITY_REFERENCES;
assert.equal(rows.length,36);
assert.equal(new Set(rows.map(x=>x.baseFormula)).size,33);
assert.equal(new Set(rows.map(x=>x.hydrateFormula)).size,36);
let measured=0;
const waterKnots=hydrates.LAB_HYDRATE_KNOT_TEMPERATURES_C;
for(const row of rows){
 assert.equal(row.massGPer100gWater.length,waterKnots.length);
 assert.ok(row.waters>0&&Number.isInteger(row.waters));
 assert.ok(labMolarMass(row.baseFormula)>0,
  "Hydrate source needs a valid existing formula: "+row.baseFormula);
 for(let i=0;i<waterKnots.length;i++){
  const sample=hydrates.labHydrateSolubilityAtTemperature(
   row.hydrateFormula,waterKnots[i]);
  const expected=row.massGPer100gWater[i];
  if(expected===null){
   assert.equal(sample,undefined,
    "Missing experimental data must remain unknown, never zero");
  }else{
   measured++;
   approximately(sample.massGPer100gWater,expected);
   assert.equal(sample.temperatureC,waterKnots[i]);
   assert.equal(sample.waters,row.waters);
   assert.equal(sample.sourceUrl,hydrates.LAB_HYDRATE_REFERENCE_SOURCE);
  }
 }
 for(const extra of row.extra??[]){
  measured++;
  const sample=hydrates.labHydrateSolubilityAtTemperature(
   row.hydrateFormula,extra.temperatureC);
  assert.equal(sample.massGPer100gWater,extra.massGPer100gWater);
 }
}
assert.equal(measured,137);
assert.equal(hydrates.labHydrateSolubilityAtTemperature(
 "CuSO4·5H2O",22),undefined,
 "Unmeasured 22 °C must not be guessed from 20 and 40 °C");
assert.equal(hydrates.labHydrateSolubilityAtTemperature(
 "CuSO4·5H2O",20)?.massGPer100gWater,20.77);
assert.equal(hydrates.labHydrateSolubilityAtTemperature(
 "CuSO4·5H2O",40)?.massGPer100gWater,29);
assert.equal(hydrates.labHydrateSolubilityAtTemperature(
 "CuSO4·5H2O",101),undefined);
assert.equal(hydrates.labHydrateSolubilityAtTemperature(
 "CoCl2·6H2O",56)?.massGPer100gWater,169.5);
assert.equal(hydrates.labHydrateSolubilityAtTemperature(
 "FeSO4·7H2O",50)?.massGPer100gWater,47.6);
assert.equal(hydrates.labHydrateSolubilityAtTemperature(
 "MgSO4·7H2O",10)?.massGPer100gWater,30.05);
const cuHydrates=registryProps.labSubstanceProperties("CuSO4",22)
 .hydratedSolubilityReferences;
assert.equal(cuHydrates.length,1);
assert.equal(cuHydrates[0].hydrateFormula,"CuSO4·5H2O");
assert.equal(cuHydrates[0].temperatureC,20);
assert.equal(cuHydrates[0].massGPer100gWater,20.77);
assert.equal(registryProps.labSubstanceProperties("CuSO4",22)
 .solubilityGPer100gWater,physicalDensity.labSingleSaltSolubilityGPer100gWater("CuSO4",22));
const zinc=registryProps.labSubstanceProperties("ZnSO4",22)
 .hydratedSolubilityReferences;
assert.equal(zinc.length,2,
 "Zinc sulfate mono- and heptahydrate must remain different phases");
assert.deepEqual(zinc.map(x=>x.temperatureC),[20,60]);
assert.equal(registryProps.labSubstanceProperties("NaCl",22)
 .hydratedSolubilityReferences.length,0);
console.log("36 hydrate forms with 137 exact measured temperatures; no invented points");


const crystalHydrates=hydrates.LAB_HYDRATE_CRYSTAL_DENSITIES;
assert.equal(crystalHydrates.length,5);
for(const [hydrateFormula,baseFormula,density] of [
 ["CuSO4·5H2O","CuSO4",2.29],
 ["Na2CO3·10H2O","Na2CO3",1.46],
 ["Na2SO4·10H2O","Na2SO4",1.46],
 ["K2CO3·2H2O","K2CO3",2.04],
 ["2K2CO3·3H2O","K2CO3",2.13]
]){
 const item=crystalHydrates.find(x=>x.hydrateFormula===hydrateFormula);
 assert.equal(item?.baseFormula,baseFormula);
 approximately(item.densityGPerMl,density);
 const prop=registryProps.labSubstanceProperties(baseFormula);
 assert.ok(prop.hydratedCrystalDensityReferences.some(x=>
  x.hydrateFormula===hydrateFormula&&x.densityGPerMl===density));
 assert.notEqual(physicalDensity.labCrystalDensityGml(baseFormula),density,
  "A crystal hydrate may NOT overwrite true density of the anhydrous salt");
}
console.log("Five crystal hydrate true-density references remain distinct from pure anhydrous solids");


// Added second batch: identities that change their hydration phases as the
// water temperature changes. Treat each crystal form separately.
for(const [formula,t,expected] of [
 ["Na2CO3·10H2O",20,21.66],
 ["Na2CO3·H2O",40,48.9],
 ["Na2SO4·10H2O",0,4.56],
 ["Na3PO4·12H2O",100,108],
 ["KOH·H2O",80,160],
 ["NaOH·H2O",20,109.22],
 ["NaH2PO4·2H2O",40,138.2],
 ["CH3COONa·3H2O",58,138],
 ["FeSO4·H2O",80,43.8],
 ["Sr(OH)2·8H2O",100,24.2]
])approximately(hydrates.labHydrateSolubilityAtTemperature(
 formula,t)?.massGPer100gWater,expected);
for(const [formula,t] of [
 ["Na2CO3·10H2O",40],["Na2CO3·H2O",20],
 ["FeSO4·H2O",100],["NaH2PO4·2H2O",42],
 ["Sr(OH)2·8H2O",25]
])assert.equal(hydrates.labHydrateSolubilityAtTemperature(formula,t),undefined);
const carbonatePhases=registryProps.labSubstanceProperties("Na2CO3",22)
 .hydratedSolubilityReferences;
assert.equal(carbonatePhases.length,2);
assert.deepEqual(carbonatePhases.map(x=>x.hydrateFormula),
 ["Na2CO3·10H2O","Na2CO3·H2O"]);
assert.deepEqual(carbonatePhases.map(x=>x.temperatureC),[20,40]);

// Saturated aqueous solution has a separately MEASURED concentration and
// density; they cannot be borrowed for 0.1 mol/L prepared cabinet stock.
const saturation=load("src/lektrusLabSaturatedSolutionReferences.ts");
assert.equal(saturation.LAB_SATURATED_SOLUTION_REFERENCES.length,37);
assert.equal(new Set(saturation.LAB_SATURATED_SOLUTION_REFERENCES.map(x=>
 x.baseFormula+"|"+x.saturationSolidFormula)).size,37);
for(const [formula,solid,percent,density] of [
 ["NaCl","NaCl",26.4,1.201],
 ["KNO3","KNO3",24.1,1.16],
 ["AgNO3","AgNO3",68.6,2.18],
 ["CuSO4","CuSO4·5H2O",17.2,1.1965],
 ["Na2SO4","Na2SO4·10H2O",16.1,1.15],
 ["NaOH","NaOH·H2O",52.2,1.55],
 ["Ba(OH)2","Ba(OH)2·8H2O",3.36,1.04],
 ["CH3COONa","CH3COONa·3H2O",31.7,1.17]
]){
 const reference=saturation.labSaturatedSolutionReferences(formula).find(
  r=>r.saturationSolidFormula===solid);
 assert.ok(reference);
 approximately(reference.concentrationMassPercent,percent);
 approximately(reference.solutionDensityGPerMl,density);
 assert.equal(reference.temperatureC,20);
 assert.equal(reference.sourceUrl,saturation.LAB_SATURATED_SOLUTION_SOURCE);
 assert.deepEqual(registryProps.labSubstanceProperties(formula)
  .saturatedSolutionReferences.filter(x=>x.saturationSolidFormula===solid),
  [reference]);
}
assert.equal(saturation.labSaturatedSolutionReferences("HCl").length,0);
assert.equal(registryProps.labSubstanceProperties("NaCl")
 .liquidDensityGPerMl,undefined);
assert.equal(registryProps.labSubstanceProperties("CuSO4")
 .liquidDensityGPerMl,undefined);
console.log("37 validated saturated water-solution densities kept distinct from dilute stocks and pure substances");


// Additional mass-specific c_p values for dry crystals at ~298 K. The first
// nine are converted from Cp(298 K)/R (Smith/Van Ness/Abbott Appendix C,
// reference Kelley US Bureau of Mines); the last seven from room-temperature
// cal/(g K), AMCP 706-106 Appendix A, using 1 cal = 4.184 J.
const curatedRoomHeat={
 "CaO":.749943,"CaCO3":.818097,"Ca(OH)2":1.258738,
 "CuO":.531720,"FeS":.621705,"LiCl":1.133202,
 "NaHCO3":1.043086,"SiO2":.739641,"Fe2O3":.649799,
 "BaCO3":.430952,"BaCl2":.366100,"Ba(NO3)2":.637223,
 "CaSO4":.707096,"CuSO4":.656888,"PbCO3":.406266,
 "Pb(NO3)2":.490783
};
assert.equal(Object.keys(curatedRoomHeat).length,16);
for(const [formula,cp] of Object.entries(curatedRoomHeat)){
 const prop=heatProps.LAB_CALORIMETRY_REFERENCE[formula];
 assert.equal(prop?.phase,"solid",formula+" must be dry phase");
 approximately(prop.specificJPerGK,cp,1e-6);
 const known=heatProps.labKnownHeatCapacityJPerK("beaker",{
  [formula]:{unit:"g",value:5}
 });
 approximately(known,65*.84+5*cp,2e-5);
 // A dry salt's heat capacity is not that of its aqueous solution.
 assert.equal(heatProps.labKnownHeatCapacityJPerK("beaker",{
  [formula]:{unit:"g",value:5},H2O:{unit:"ml",value:5}
 }),undefined,"Cp must not be incorrectly transferred to a solution "+formula);
 assert.ok(registryProps.labSubstanceProperties(formula).specificHeatJPerGK>0);
}
const additionalDryDensities={
 ZnSO4:3.8,Li2CO3:2.11,Na3PO4:2.54,"Mg(NO3)2":2.3,
 Li2SO4:2.2,K3PO4:2.564
};
for(const [formula,density] of Object.entries(additionalDryDensities)){
 approximately(physicalDensity.labCrystalDensityGml(formula),density);
 assert.equal(registryProps.labSubstanceProperties(formula).crystalDensityGPerMl,density);
}
for(const [formula,data] of Object.entries({
 "Ca(OH)2":{decompositionC:580,behavior:"decomposes"},
 "BaCO3":{decompositionC:1380,behavior:"decomposes"},
 "ZnSO4":{decompositionC:680,behavior:"decomposes"},
 "Li2CO3":{meltingC:723,decompositionC:1310,behavior:"decomposes"},
 "Li2SO4":{meltingC:860},
 "K3PO4":{meltingC:1340},
 "Na3PO4":{meltingC:1583}
})){
 const t=thermalProps.labThermalInfo(formula,"g");
 assert.equal(t.known,true,formula+" thermal reference missing");
 for(const [key,value] of Object.entries(data)){
  if(typeof value==="number")approximately(t[key],value);
  else assert.equal(t[key],value);
 }
 assert.equal(thermalProps.labThermalInfo(formula,"ml").known,false,
  "Do not transfer dry-solid decomposition/melting data into aqueous stock");
}
for(const formula of ["Ca(OH)2","BaCO3","ZnSO4"]){
 const t=thermalProps.labThermalInfo(formula,"g");
 assert.equal(t.boilingC,undefined,"Decomposition cannot be modelled as boiling");
 assert.equal(t.meltingC,undefined,"Do not invent congruent melt before decomposition");
}
console.log("Six verified pure-solid densities, seven solid transitions and sixteen Cp values passed");
