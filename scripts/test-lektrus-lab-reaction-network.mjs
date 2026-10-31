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
 Li2CO3:[1.543,1.33,1.174,1.010,.847,.715],
 NaF:[null,4.1,null,null,null,null],
 NaBr:[null,null,null,118,118.3,121.2],
 Na2SO3:[null,22/.9982,37,33.2,29,26.6],
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
assert.equal(measuredNewCells,50);
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
assert.equal(dataOnly,50);
console.log("Eleven salt solubility datasets; 50 measured knots; hydrate-safe crystallization");

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
assert.equal(rows.length,41);
assert.equal(new Set(rows.map(x=>x.baseFormula)).size,37);
assert.equal(new Set(rows.map(x=>x.hydrateFormula)).size,41);
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
   assert.equal(sample.sourceUrl,row.sourceUrl??hydrates.LAB_HYDRATE_REFERENCE_SOURCE);
  }
 }
 for(const extra of row.extra??[]){
  measured++;
  const sample=hydrates.labHydrateSolubilityAtTemperature(
   row.hydrateFormula,extra.temperatureC);
  assert.equal(sample.massGPer100gWater,extra.massGPer100gWater);
 }
}
assert.equal(measured,147);
 // Standalone hydrate identities must keep the source crystal water: a
 // nitrate hexahydrate is NEVER an anhydrous nitrate saturation reading.
 const newlySourcedHydrates=[
  ["Fe(NO3)2·6H2O",19.85,140],
  ["Fe(NO3)3·9H2O",19.85,138],
  ["Zn(NO3)2·6H2O",20,184.3/.9982],
  ["Zn(CH3COO)2·2H2O",20,30],
  ["Zn(CH3COO)2·2H2O",25,40],
  ["Zn(CH3COO)2·2H2O",100,67],
  ["FeCl3·6H2O",19.85,91.8],
  ["BaCl2·2H2O",19.85,35.8],
  ["Ca(NO3)2·4H2O",19.85,129]
 ];
 for(const [formula,temperature,expected] of newlySourcedHydrates){
  const sample=hydrates.labHydrateSolubilityAtTemperature(formula,temperature);
  assert.ok(sample,"Missing exact measured hydrate "+formula+" at "+temperature);
  approximately(sample.massGPer100gWater,expected,1e-10);
  assert.ok(sample.sourceUrl.startsWith("https://"));
  assert.equal(sample.temperatureC,temperature);
 }
 for(const formula of ["Fe(NO3)2·6H2O","Fe(NO3)3·9H2O"]){
  assert.equal(hydrates.labHydrateSolubilityAtTemperature(formula,20),
   undefined,"293 K is not 20°C; do not mislabel a hydrated nitrate");
 }
 for(const formula of ["Zn(NO3)2·6H2O","Zn(CH3COO)2·2H2O"]){
  assert.equal(hydrates.labHydrateSolubilityAtTemperature(formula,30),
   undefined,"Unknown hydrate phase must not be interpolated");
 }
 // Hydrate crystal density belongs to the SPECIFIC crystal-water count.
 // A tetranitrate hydrate cannot assume its hexahydrate's true density,
 // and no hydrated measurement may overwrite the anhydrous solid.
 const nitrateDensity=hydrates.labHydrateCrystalDensityReferences("Zn(NO3)2");
 assert.equal(nitrateDensity.length,1);
 assert.equal(nitrateDensity[0].hydrateFormula,"Zn(NO3)2·6H2O");
 assert.equal(nitrateDensity[0].densityGPerMl,2.065);
 assert.ok(nitrateDensity.every(x=>x.hydrateFormula!=="Zn(NO3)2·4H2O"));
 const lithiumHydrateDensity=hydrates.labHydrateCrystalDensityReferences("LiOH");
 assert.equal(lithiumHydrateDensity.length,1);
 assert.equal(lithiumHydrateDensity[0].hydrateFormula,"LiOH·H2O");
 assert.equal(lithiumHydrateDensity[0].densityGPerMl,1.51);
 // The existing 4-hydrate reference for zinc nitrate is distinct from the
 // new hexahydrate; do not conflate these in the laboratory inspector.
 assert.equal(hydrates.labHydrateSolubilityAtTemperature(
  "Zn(NO3)2·4H2O",20),undefined);
 assert.equal(hydrates.labHydrateSolubilityAtTemperature(
  "Zn(NO3)2·6H2O",20)?.hydrateFormula,"Zn(NO3)2·6H2O");

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
console.log("41 hydrate forms with 147 source-specific measured temperatures; no invented points");


const crystalHydrates=hydrates.LAB_HYDRATE_CRYSTAL_DENSITIES;
assert.equal(crystalHydrates.length,11);
for(const [hydrateFormula,baseFormula,density] of [
 ["CuSO4·5H2O","CuSO4",2.29],
 ["Na2CO3·10H2O","Na2CO3",1.46],
 ["Na2SO4·10H2O","Na2SO4",1.46],
 ["K2CO3·2H2O","K2CO3",2.04],
 ["2K2CO3·3H2O","K2CO3",2.13],
 ["LiOH·H2O","LiOH",1.51],
 ["BaCl2·2H2O","BaCl2",3.86],
 ["MnSO4·H2O","MnSO4",2.95],
 ["Zn(NO3)2·6H2O","Zn(NO3)2",2.065],
 ["CoCl2·6H2O","CoCl2",1.924],
 ["Zn(CH3COO)2·2H2O","Zn(CH3COO)2",1.735]
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
// Correct two historical PHASE MISASSIGNMENTS in the dry density data.
// The true 1.735 g/cm3 zinc acetate value is from the DIHYDRATE, while
// GESTIS reports 1.84 g/cm3 for pure anhydrous Zn(CH3COO)2.
// LiOH ICSC 0913: pure anhydrous LiOH 2.54, its MONOHYDRATE 1.51.
approximately(physicalDensity.labCrystalDensityGml("Zn(CH3COO)2"),1.84,1e-12);
approximately(physicalDensity.labCrystalDensityGml("LiOH"),2.54,1e-12);
assert.equal(registryProps.labSubstanceProperties("Zn(CH3COO)2")
 .crystalDensityGPerMl,1.84);
assert.equal(registryProps.labSubstanceProperties("LiOH")
 .crystalDensityGPerMl,2.54);
assert.ok(crystalHydrates.some(r=>r.hydrateFormula==="Zn(CH3COO)2·2H2O"&&
 r.densityGPerMl===1.735),"Zinc acetate dihydrate density lost");
assert.ok(!crystalHydrates.some(r=>r.hydrateFormula==="Zn(CH3COO)2"||
 r.hydrateFormula==="LiOH"),"Pure crystalline solids must not be hydrate rows");
console.log("Eleven hydrate densities and two corrected anhydrous crystal densities: PASS");


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


// Bulk provenance: 114 independently sourced properties, checked both in
// source tables and through the same registry used to render lab state.
const validated=load("src/lektrusLabPropertyProvenance.ts");
assert.equal(validated.LAB_REVIEWED_PROPERTY_DATUMS.length,114);
const sourceIds=new Set();
const fields={crystalDensityGPerMl:0,specificHeatJPerGK:0,thermal:0};
for(const row of validated.LAB_REVIEWED_PROPERTY_DATUMS){
 assert.ok(row.sourceUrl.startsWith("https://"));
 assert.ok(labMolarMass(row.formula)>0);
 const key=row.formula+"."+row.property;
 assert.ok(!sourceIds.has(key),"Duplicate laboratory reference property "+key);
 sourceIds.add(key);
 const property=registryProps.labSubstanceProperties(row.formula);
 let value;
 if(row.property==="crystalDensityGPerMl"){
  fields.crystalDensityGPerMl++;
  value=property.crystalDensityGPerMl;
 }else if(row.property==="specificHeatJPerGK"){
  fields.specificHeatJPerGK++;
  value=property.specificHeatJPerGK;
  assert.equal(heatProps.LAB_CALORIMETRY_REFERENCE[row.formula]?.phase,"solid");
  const expected=heatProps.LAB_VESSEL_GLASS_EQUIVALENT_G.beaker*.84+
   row.value*3;
  approximately(heatProps.labKnownHeatCapacityJPerK("beaker",{
   [row.formula]:{value:3,unit:"g"}
  }),expected,5e-6);
  assert.equal(heatProps.labKnownHeatCapacityJPerK("beaker",{
   [row.formula]:{value:3,unit:"g"},H2O:{value:3,unit:"ml"}
  }),undefined,"Do not substitute pure solid Cp for aqueous heat capacity");
 }else{
  fields.thermal++;
  value=thermalProps.labThermalInfo(row.formula,"g")[row.property];
  assert.equal(thermalProps.labThermalInfo(row.formula,"ml").known,false,
   "Dry thermal data must not apply to solution: "+row.formula);
  if(row.property==="decompositionC"||row.property==="sublimationC"){
   const expectedBehavior=row.property==="decompositionC"?
    "decomposes":"sublimes";
   assert.equal(thermalProps.labThermalInfo(row.formula,"g").behavior,
    expectedBehavior);
  }
 }
 approximately(value,row.value,1e-6);
}
assert.deepEqual(fields,{
 crystalDensityGPerMl:36,specificHeatJPerGK:29,thermal:49
});
console.log("114 source-checked property references: 36 crystal densities, 29 dry-solid Cp, 49 individual phase boundaries");
// Canonical ONE-ROW-ONE-SOURCE importer: one source entry must update
// (1) the active physical value and (2) the provenance catalogue.
// No more copy-pasting each new physical measurement into 3 TS files.
const ingestion=load("src/lektrusLabCuratedPropertyBatch.ts");
const batchRows=ingestion.LAB_CURATED_PROPERTY_BATCH;
assert.ok(batchRows.length>=10,"Curated property coverage regressed");
const unique=new Set();
for(const item of batchRows){
 const key=item.formula+"."+item.property;
 assert.ok(!unique.has(key),"Duplicate measured property "+key);
 unique.add(key);
 assert.equal(item.phase,"anhydrous-solid");
 assert.ok(labMolarMass(item.formula)>0,"Wrong chemical formula: "+key);
 assert.ok(item.value>0&&Number.isFinite(item.value));
 assert.ok(item.sourceUrl.startsWith("https://"));
 assert.ok(item.sourceCondition.length>=12);
 assert.ok(validated.LAB_REVIEWED_PROPERTY_DATUMS.some(p=>
  p.formula===item.formula&&p.property===item.property&&
  p.value===item.value&&p.sourceUrl===item.sourceUrl),
  "Batch source did not enter provenance: "+key);
 if(item.property==="crystalDensityGPerMl"){
  approximately(ingestion.LAB_BATCH_CRYSTAL_DENSITIES[item.formula],
   item.value,1e-12);
  approximately(physicalDensity.labCrystalDensityGml(item.formula),
   item.value,1e-12);
  approximately(registryProps.labSubstanceProperties(item.formula)
   .crystalDensityGPerMl,item.value,1e-12);
  if(!batchRows.some(row=>row.formula===item.formula&&
   ["meltingC","boilingC","decompositionC","sublimationC"].includes(row.property)))
   assert.ok(!Object.hasOwn(ingestion.LAB_BATCH_THERMAL_PROPERTIES,item.formula),
    "Do not fabricate thermal boundary for density-only sample");
 }else {
  const thermal=ingestion.LAB_BATCH_THERMAL_PROPERTIES[item.formula];
  assert.ok(thermal,"Missing generated thermal record "+key);
  const pure=thermalProps.labThermalInfo(item.formula,"g");
  assert.equal(pure.known,true);
  approximately(pure[item.property],item.value,1e-12);
  assert.equal(thermalProps.labThermalInfo(item.formula,"ml").known,false,
   "Dry crystal transition cannot be assigned to a liquid mixture");
  if(item.property==="decompositionC"){
   assert.equal(pure.behavior,"decomposes");
   assert.equal(pure.boilingC,undefined);
   assert.equal(pure.meltingC,undefined,
    "Decomposition must not be stored as normal fusion");
  }
 }
}
assert.equal(ingestion.LAB_BATCH_PROPERTY_PROVENANCE.length,batchRows.length);
assert.equal(ingestion.LAB_BATCH_CRYSTAL_DENSITIES.CH3ONa,1.3);
assert.equal(ingestion.LAB_BATCH_CRYSTAL_DENSITIES.C2H5ONa,.87);
assert.equal(ingestion.LAB_BATCH_THERMAL_PROPERTIES["Fe(OH)2"].decompositionC,150);
assert.equal(ingestion.LAB_BATCH_THERMAL_PROPERTIES["Ni(OH)2"].decompositionC,230);
assert.equal(ingestion.LAB_BATCH_THERMAL_PROPERTIES["Pb(NO3)2"].decompositionC,470);
assert.equal(ingestion.LAB_BATCH_THERMAL_PROPERTIES.FeCl3.meltingC,304);
assert.notEqual(thermalProps.labThermalInfo("FeCl3","g").meltingC,37,
 "Hydrated FeCl3 is not the anhydrous crystal phase");
for(const [formula,density,key,transition] of [
 ["Ba3(PO4)2",5.25,"meltingC",1605],["Mg(CH3COO)2",1.42,"decompositionC",323]
]){
 const live=registryProps.labSubstanceProperties(formula);
 approximately(physicalDensity.labCrystalDensityGml(formula),density,1e-12);
 approximately(live.crystalDensityGPerMl,density,1e-12);
 approximately(live[key],transition,1e-12);
}
console.log("One-file physical constants plus exact provenance: PASS");

// Direct NIST-JANAF (cr) 298.15 K molar values must be recalculated
// with the real lab formula parser. No hydrate/solution substitution.
const jan=load("src/lektrusLabJanafSolidHeatReferences.ts");
assert.equal(jan.LAB_JANAF_SOLID_HEAT_REFERENCES.length,14);
const phosphorusOxideSource=jan.LAB_JANAF_SOLID_HEAT_REFERENCES
 .find(row=>row.formula==="P2O5");
assert.ok(phosphorusOxideSource);
assert.equal(phosphorusOxideSource.sourceFormulaUnits,2);
assert.ok(phosphorusOxideSource.crystalForm.includes("P4O10"));
assert.equal(phosphorusOxideSource.molarHeatJPerMolK,211.710);
// If the source P4O10 molar Cp is divided by the EMPIRICAL P2O5 mass
// without doubling it, reported specific Cp is incorrectly 2x too high.
approximately(phosphorusOxideSource.molarHeatJPerMolK/
 (2*labMolarMass("P2O5")),phosphorusOxideSource.roomHeatJPerGK,1e-6);
assert.ok(phosphorusOxideSource.roomHeatJPerGK<1.0);

for(const row of jan.LAB_JANAF_SOLID_HEAT_REFERENCES){
 assert.equal(row.phase,"solid");
 assert.equal(row.temperatureKelvin,298.15);
 assert.equal(row.pressureMPa,.1);
 assert.ok(row.crystalForm);
 const sourceFormulaUnits=row.sourceFormulaUnits??1;
 assert.ok(Number.isInteger(sourceFormulaUnits)&&sourceFormulaUnits>=1&&
  sourceFormulaUnits<=2);
 if(sourceFormulaUnits===2)assert.equal(row.formula,"P2O5");
 assert.ok(row.sourceUrl.startsWith("https://janaf.nist.gov/"));
 const mm=labMolarMass(row.formula);
 assert.ok(mm>0);
 approximately(row.molarHeatJPerMolK/(mm*(row.sourceFormulaUnits??1)),
  row.roomHeatJPerGK,1e-6);
 const registry=registryProps.labSubstanceProperties(row.formula);
 approximately(registry.specificHeatJPerGK,row.roomHeatJPerGK,1e-12);
 assert.equal(heatProps.LAB_CALORIMETRY_REFERENCE[row.formula]?.phase,"solid");
 const expected=heatProps.LAB_VESSEL_GLASS_EQUIVALENT_G.beaker*.84+
  5*row.roomHeatJPerGK;
 approximately(heatProps.labKnownHeatCapacityJPerK("beaker",{
  [row.formula]:{value:5,unit:"g"}
 }),expected,5e-6);
 assert.equal(heatProps.labKnownHeatCapacityJPerK("beaker",{
  [row.formula]:{value:5,unit:"g"},H2O:{value:5,unit:"ml"}
 }),undefined,"Never assign crystalline Cp to prepared aqueous stock");
}
console.log("Fourteen NIST-JANAF crystal specific heats audited from source molar measurements");

 
// Precise pure-phase source constants from ICSC / OECD / ATSDR.
// An ammonium sulfate decomposition ONSET does not imply melting at
// 150°C. P2O5 is the school formula UNIT for molecular P4O10.
const reviewedThermalAdditions={
 MgSO4:{decompositionC:1124,behavior:"decomposes"},
 CH3COOK:{meltingC:292},
 "(NH4)2SO4":{decompositionC:150,behavior:"decomposes"},
 P2O5:{meltingC:340}
};
for(const [formula,properties] of Object.entries(reviewedThermalAdditions)){
 const dry=thermalProps.labThermalInfo(formula,"g");
 assert.equal(dry.known,true,"Missing reviewed thermal solid "+formula);
 for(const [field,value] of Object.entries(properties)){
  if(typeof value==="number")approximately(dry[field],value,1e-9);
  else assert.equal(dry[field],value);
 }
 assert.equal(thermalProps.labThermalInfo(formula,"ml").known,false,
  "Dry phase data must NOT apply to prepared liquid "+formula);
}
for(const formula of ["MgSO4","(NH4)2SO4"]){
 const data=thermalProps.labThermalInfo(formula,"g");
 assert.equal(data.meltingC,undefined);
 assert.equal(data.boilingC,undefined);
}
approximately(physicalDensity.labCrystalDensityGml("P2O5"),2.39,1e-9);
assert.equal(registryProps.labSubstanceProperties("P2O5").crystalDensityGPerMl,2.39);
console.log("Four pure crystal transitions and P4O10 structural density: PASS");

 
// Independently recompute NIST solid Shomate / measured Cp and verify the
// EXACT value used by calorimetry, including 3 g weighed dry-solid samples.
// A dry crystalline heat is never substituted for an aqueous preparation.
const nist=load("src/lektrusLabNistHeatReferences.ts");
assert.equal(nist.LAB_NIST_ROOM_HEAT_REFERENCES.length,7);
for(const row of nist.LAB_NIST_ROOM_HEAT_REFERENCES){
 const mm=labMolarMass(row.formula);
 assert.ok(Number.isFinite(mm)&&mm>0);
 assert.ok(Math.abs(nist.labNistMolarHeatAt298K(row)/mm-
  row.roomHeatJPerGK)<1e-6);
 assert.equal(heatProps.LAB_CALORIMETRY_REFERENCE[row.formula]?.phase,"solid");
 approximately(registryProps.labSubstanceProperties(row.formula).specificHeatJPerGK,
  row.roomHeatJPerGK,1e-8);
 const solidHeat=heatProps.labKnownHeatCapacityJPerK("beaker",{
  [row.formula]:{value:3,unit:"g"}
 });
 const expected=heatProps.LAB_VESSEL_GLASS_EQUIVALENT_G.beaker*.84+
  3*row.roomHeatJPerGK;
 approximately(solidHeat,expected,5e-6);
 assert.equal(heatProps.labKnownHeatCapacityJPerK("beaker",{
  [row.formula]:{value:3,unit:"g"},H2O:{value:3,unit:"ml"}
 }),undefined,"Never assign dry Cp to an aqueous stock");
}
console.log("NIST seven measured dry-crystal Cp values reach simulator and keep phase guards");

 
// Phase-aware density and heating regression for the newest actual cabinet
// materials. In particular an aqueous nitrate is not an anhydrous crystal.
for(const [formula,density] of Object.entries({
 "Co(OH)2":3.597,Ag3PO4:6.37,"Ca(NO3)2":2.5,
 "Cu(NO3)2":3.05,NiS:5.5,K2MnO4:2.78
})){
 assert.equal(registryProps.labSubstanceProperties(formula,20).crystalDensityGPerMl,
  density,formula+" reference density absent from actual simulator");
}
for(const [formula,kind,temperature] of [
 ["Ag3PO4","meltingC",849],
 ["Ca(NO3)2","meltingC",560],
 ["Cu(NO3)2","decompositionC",256]
]){
 const dry=thermalProps.labThermalInfo(formula,"g");
 assert.equal(dry.known,true,"No verified phase data for "+formula);
 assert.equal(dry[kind],temperature);
 assert.equal(thermalProps.labThermalInfo(formula,"ml").known,false,
  "Do not transfer a pure-solid phase to an aqueous stock");
}
assert.equal(thermalProps.labThermalInfo("Cu(NO3)2","g").boilingC,undefined);
assert.equal(thermalProps.labThermalInfo("Cu(NO3)2","g").meltingC,undefined);
console.log("New six crystal densities and three dry-only phase events: PASS");



// Perry's Chemical Engineers' Handbook, Table 2-194. These 34 documented
// crystalline Cp(T) correlations each include 298.15 K, and heat capacity
// is converted cal/mol/K -> J/g/K via the REAL stoichiometry parser.
const perry=load("src/lektrusLabPerryHeatReferences.ts");
assert.equal(perry.LAB_PERRY_SOLID_HEAT_REFERENCES.length,34);
const perryKeys=new Set();
for(const item of perry.LAB_PERRY_SOLID_HEAT_REFERENCES){
 assert.ok(!perryKeys.has(item.formula),"Handbook duplicate "+item.formula);
 perryKeys.add(item.formula);
 assert.equal(item.phase,"solid");
 assert.equal(item.sourceUrl,perry.LAB_PERRY_HANDBOOK_SOURCE);
 assert.ok(item.minKelvin<=298.15&&298.15<=item.maxKelvin);
 const molarCal=perry.labPerryMolarHeatCalPerMolK(item,298.15);
 assert.ok(molarCal>0);
 const expected=molarCal*4.184/labMolarMass(item.formula);
 approximately(expected,item.roomHeatJPerGK,1e-6);
 const actual=registryProps.labSubstanceProperties(item.formula);
 approximately(actual.specificHeatJPerGK,item.roomHeatJPerGK,1e-12);
 const glass=heatProps.LAB_VESSEL_GLASS_EQUIVALENT_G.beaker*.84;
 approximately(heatProps.labKnownHeatCapacityJPerK("beaker",{
  [item.formula]:{value:5,unit:"g"}
 }),glass+5*expected,1e-5);
 assert.equal(heatProps.labKnownHeatCapacityJPerK("beaker",{
  H2O:{value:5,unit:"ml"},
  [item.formula]:{value:5,unit:"g"}
 }),undefined,"Perry solid Cp must not be applied to aqueous mixtures");
 assert.equal(perry.labPerryMolarHeatCalPerMolK(item,item.minKelvin-1),undefined);
 assert.equal(perry.labPerryMolarHeatCalPerMolK(item,item.maxKelvin+1),undefined);
}
for(const [formula,cp] of Object.entries({
 AlCl3:.677761,AgBr:.284855,AgI:.227828,AgNO3:.581284,
 Ag3PO4:.374844,NiSO4:.903045,ZnSO4:.725687,MgSO4:.928148
})){
 const row=perry.LAB_PERRY_SOLID_HEAT_REFERENCES.find(x=>x.formula===formula);
 approximately(row.roomHeatJPerGK,cp,1e-12);
}
console.log("34 exact crystalline Perry Handbook Cp correlations: molar-to-mass, temperature range, and laboratory heat transfer verified");


// PubChem/CRC/ICSC/Ullmann/Merck exact-temperature measurements, with
// their original source units, are converted without inventing missing
// 20°C rows from measurements at 18°C or 25°C.
const literature=load("src/lektrusLabSolubilityMeasurements.ts");
const pureWaterMeasurements=literature.LAB_MEASURED_PURE_WATER_SOLUBILITIES;
assert.ok(pureWaterMeasurements.length>=97);
assert.ok(new Set(pureWaterMeasurements.map(x=>x.formula)).size>=51);
assert.ok(pureWaterMeasurements.filter(x=>x.temperatureC===20).length>=31);
const measuredTemperatures=new Set([0,20,40,60,80,100]);
assert.ok(pureWaterMeasurements.filter(
 x=>!measuredTemperatures.has(x.temperatureC)).length>=48);
const literatureKeys=new Set();
for(const x of pureWaterMeasurements){
 const key=x.formula+"|"+x.temperatureC;
 assert.ok(!literatureKeys.has(key),"Duplicate experimental solvent record "+key);
 literatureKeys.add(key);
 assert.ok(x.sourceUrl.startsWith("https://"));
 assert.ok(labMolarMass(x.formula)>0);
 if(x.sourceTemperatureKelvin!==undefined){
  assert.equal(x.sourceTemperatureKelvin,293);
  assert.equal(x.temperatureC,19.85,
   "293 K is 19.85°C, not an exact 20°C point");
  approximately(x.temperatureC+273.15,x.sourceTemperatureKelvin,1e-9);
  assert.equal(x.originalUnit,"g/100g-water");
 }
 const normalized=literature.labMeasuredSolubilityGPer100gWater(x);
 assert.ok(Number.isFinite(normalized)&&normalized>0);
 approximately(
  physicalDensity.labSingleSaltSolubilityGPer100gWater(
   x.formula,x.temperatureC),normalized,1e-9);
 const existingGrid=physicalDensity.LAB_SALT_BINARY_SOLUBILITY_G_PER_100G_WATER[x.formula];
 assert.ok(physicalDensity.LAB_SOLUBILITY_REFERENCE_ONLY_BINARY_PHASES.has(x.formula)||
  physicalDensity.LAB_HYDRATE_PHASE_REQUIRES_SPECIAL_MODEL.has(x.formula)||
  existingGrid?.every(value=>Number.isFinite(value))||x.formula==="NaCl",
  "Do not infer unverified solid phase from "+key);
 const near=literature.labNearestMeasuredSolubilityReference(
  x.formula,x.temperatureC);
 assert.equal(near.temperatureC,x.temperatureC);
 approximately(near.gPer100gWater,normalized,1e-9);
}
for(const [formula,t,expected] of [
 ["LiCl",20,83.2],["LiCl",40,89.8],["LiCl",60,98.4],
 ["LiCl",80,111.9],["LiCl",100,128.3],
 ["Na2S",0,12.4],["Na2S",20,18.6],["Na2S",40,29],
 ["Na2S",48,35.7],["Na2S",50,39],
 ["KNO2",20,306],["KNO2",25,312],
 ["BaSO4",20,.00031],["CaCO3",20,.00066],
 ["BaCO3",20,.0014],
 ["MgCO3",20,.01/.9982],["CaSO4",20,.2/.9982],
 ["PbI2",20,.076/.9982],["PbCO3",20,.00011/.9982],
 ["PbSO4",25,.0404/.997],
 ["SrCO3",18,11/10000/.9986],
 ["FeS",18,.00062/.9986],
 ["ZnS",18,.00069/.9986],
 ["Ca3(PO4)2",25,.0025]
])approximately(physicalDensity.labSingleSaltSolubilityGPer100gWater(
 formula,t),expected,1e-9);
// Five exact 20°C published g/100 mL-WATER measurements become
// g/100 g of PURE solvent using rho_water(20°C) = 0.9982 g/mL.
const newExactAt20={
 FeCl2:62.5,CoCl2:53,MgCl2:54.3,MgSO4:30,NiCl2:64.2
};
for(const [formula,original] of Object.entries(newExactAt20)){
 const expected=original/.9982;
 const row=pureWaterMeasurements.find(x=>
  x.formula===formula&&x.temperatureC===20);
 assert.ok(row);
 assert.equal(row.originalUnit,"g/100ml-water");
 approximately(row.sourceValue,original,1e-12);
 approximately(physicalDensity.labSingleSaltSolubilityGPer100gWater(
  formula,20),expected,1e-9);
 const registry=registryProps.labSubstanceProperties(formula,20);
 approximately(registry.solubilityGPer100gWater,expected,1e-9);
 assert.equal(registry.binaryCrystallizationUnsupported,true);
 // One point never permits a smooth fake curve or a fabricated crystal.
 assert.equal(physicalDensity.labSingleSaltSolubilityGPer100gWater(
  formula,21),undefined);
 const inventory={speciesMol:{H2O:.5,[formula]:.05},solidMol:{}};
 assert.equal(physicalDensity.labEquilibrateSingleSaltCrystals(
  inventory,20,true,labMolarMass),undefined);
 assert.deepEqual(inventory.solidMol,{});
}
for(const [formula,sourceValue] of Object.entries({
 AlCl3:45.8,CuCl2:73,LiNO3:70.1,"Cu(NO3)2":125,
 "Al2(SO4)3":36.4,Li2SO4:34.8,ZnSO4:53.8
})){
 const row=pureWaterMeasurements.find(x=>
  x.formula===formula&&x.sourceTemperatureKelvin===293);
 assert.ok(row,"Missing 293K source "+formula);
 assert.equal(row.temperatureC,19.85);
 approximately(row.sourceValue,sourceValue,1e-12);
 approximately(physicalDensity.labSingleSaltSolubilityGPer100gWater(
  formula,19.85),sourceValue,1e-9);
 assert.equal(physicalDensity.labSingleSaltSolubilityGPer100gWater(
  formula,20),undefined,
  "The 293 K value MUST NOT impersonate a measured 20.00°C point");
 const prop=registryProps.labSubstanceProperties(formula,20);
 assert.equal(prop.solubilityKnown,false);
 assert.equal(prop.literatureSolubilityReference.temperatureC,19.85);
 assert.equal(prop.binaryCrystallizationUnsupported,true);
}
// Verify independently sourced 293 K points, without changing 20 C grid.
for(const [formula,reference] of [["NH4Cl",37.2],["KCl",34.2],["NaCl",35.9],["NH4NO3",192],["Ba(NO3)2",9],["Pb(NO3)2",54.3],["KNO3",31.6],["AgNO3",216],["NaNO3",87.6],["(NH4)2SO4",75.4],["MgSO4",33.7],["K2SO4",11.1],["Na2SO4",19.5],["Li2CO3",1.33],["K2CO3",111],["Na2CO3",21.5]]){
 const row=pureWaterMeasurements.find(x=>x.formula===formula&&
  x.sourceTemperatureKelvin===293);
 assert.ok(row,"Missing handbook datum "+formula);
 approximately(row.sourceValue,reference,1e-12);
 approximately(literature.labExactMeasuredSolubility(formula,19.85),reference,1e-12);
 if(formula==="Na2SO4")assert.equal(
  physicalDensity.labSingleSaltSolubilityGPer100gWater(formula,20),undefined);
 else assert.ok(Number.isFinite(
  physicalDensity.labSingleSaltSolubilityGPer100gWater(formula,20)));
}
console.log("16 independent 293 K source readings, unchanged 20 C grid: PASS");
// Independently verify six new exact 20°C readings, always against the
// ORIGINAL published units, and without converting 0.14 mg/L to 0.14 g/L.
for(const [formula,value,unit,expected] of [
 ["CH3COONa",46.5,"g/100ml-water",46.5/.9982],
 ["CH3COOK",256,"g/100ml-water",256/.9982],
 ["AgCl",1.93,"mg/l-water",1.93/10000/.9982],
 ["AgBr",.14,"mg/l-water",.14/10000/.9982],
 ["SrCl2",538,"g/l-water",538/10/.9982],
 ["K3PO4",51,"g/100g-water",51]
]){
 const original=pureWaterMeasurements.find(x=>x.formula===formula&&x.temperatureC===20);
 assert.ok(original,"Source row not found: "+formula);
 assert.equal(original.sourceValue,value);
 assert.equal(original.originalUnit,unit);
 approximately(literature.labMeasuredSolubilityGPer100gWater(original),expected,1e-11);
 approximately(physicalDensity.labSingleSaltSolubilityGPer100gWater(
  formula,20),expected,1e-11);
 const live=registryProps.labSubstanceProperties(formula,20);
 assert.equal(live.solubilityKnown,true,formula+" not reported by active registry");
 approximately(live.solubilityGPer100gWater,expected,1e-11);
 assert.equal(live.binaryCrystallizationUnsupported,true);
 assert.equal(physicalDensity.labSingleSaltSolubilityGPer100gWater(
  formula,21),undefined,"Isolated exact measurement invented 21°C value");
 const inventory={speciesMol:{H2O:.5,[formula]:.05},solidMol:{}};
 assert.equal(physicalDensity.labEquilibrateSingleSaltCrystals(
  inventory,20,true,labMolarMass),undefined);
 assert.deepEqual(inventory.solidMol,{},"Reference cannot create solid phase");
}
// The historical CRC calcium-acetate data provide only two end points,
// not 20°C or a valid smooth curve across changing hydrate equilibria.
for(const [temp,raw,waterDensity] of [
 [0,37.4,.99984],[100,29.7,.9584]
]){
 const id="Ca(CH3COO)2";
 const row=pureWaterMeasurements.find(x=>x.formula===id&&x.temperatureC===temp);
 assert.ok(row&&row.originalUnit==="g/100ml-water");
 assert.equal(row.sourceValue,raw);
 approximately(physicalDensity.labSingleSaltSolubilityGPer100gWater(
  id,temp),raw/waterDensity,1e-10);
 assert.equal(registryProps.labSubstanceProperties(id,temp)
  .binaryCrystallizationUnsupported,true);
}
for(const temp of [1,20,50,99]){
 assert.equal(physicalDensity.labSingleSaltSolubilityGPer100gWater(
  "Ca(CH3COO)2",temp),undefined,"Calcium acetate interpolated through missing data");
}
assert.equal(registryProps.labSubstanceProperties("Ca(CH3COO)2",20).solubilityKnown,false);
console.log("Six traceable 20C water solubilities plus isolated 0/100C calcium acetate points passed");

// International Chemical Safety Cards and the Colorado DOT published
// exact-temperature measurements. Original units are never g/100g WATER
// unless the source actually reported them (kilogram-solvent is divided 10).
for(const [formula,temp,sourceValue,unit,normalized] of [
 ["CaCl2",20,74.5,"g/100ml-water",74.5/.9982],
 ["Na3PO4",20,121,"g/l-water",121/10/.9982],
 ["Mg(CH3COO)2",20,53.4,"g/100g-water",53.4],
 ["BaCl2",25,37,"g/100g-water",37],
 ["ZnCl2",25,432,"g/100ml-water",432/.997]
]){
 const row=pureWaterMeasurements.find(x=>
  x.formula===formula&&x.temperatureC===temp);
 assert.ok(row,"Missing individually sourced reference "+formula+" at "+temp+"°C");
 assert.equal(row.sourceValue,sourceValue);
 assert.equal(row.originalUnit,unit);
 approximately(literature.labMeasuredSolubilityGPer100gWater(row),
  normalized,1e-10);
 approximately(physicalDensity.labSingleSaltSolubilityGPer100gWater(
  formula,temp),normalized,1e-10);
 const prop=registryProps.labSubstanceProperties(formula,temp);
 assert.equal(prop.solubilityKnown,true);
 approximately(prop.solubilityGPer100gWater,normalized,1e-10);
 assert.equal(prop.binaryCrystallizationUnsupported,true,
  "Single-salt solver must never invent hydrate equilibrium for "+formula);
 const inventory={speciesMol:{H2O:1,[formula]:.2},solidMol:{}};
 assert.equal(physicalDensity.labEquilibrateSingleSaltCrystals(
  inventory,temp,true,labMolarMass),undefined);
 assert.deepEqual(inventory.solidMol,{});
}
const alNitrateGPerKg={
 0:587.3,10:618.1,20:663.9,25:689.2,30:724.1,
 40:801.8,50:897.5,60:1016.1,70:1164.5,100:1597.4
};
for(const [tempText,raw] of Object.entries(alNitrateGPerKg)){
 const temp=Number(tempText),formula="Al(NO3)3";
 const row=pureWaterMeasurements.find(x=>
  x.formula===formula&&x.temperatureC===temp);
 assert.ok(row,"Missing Al(NO3)3 reference at "+temp+"°C");
 assert.equal(row.sourceValue,raw);
 assert.equal(row.originalUnit,"g/kg-water");
 approximately(literature.labMeasuredSolubilityGPer100gWater(row),
  raw/10,1e-10);
 approximately(physicalDensity.labSingleSaltSolubilityGPer100gWater(
  formula,temp),raw/10,1e-10);
 const prop=registryProps.labSubstanceProperties(formula,temp);
 assert.equal(prop.solubilityKnown,true);
 assert.equal(prop.binaryCrystallizationUnsupported,true);
 const inventory={speciesMol:{H2O:1,[formula]:.2},solidMol:{}};
 assert.equal(physicalDensity.labEquilibrateSingleSaltCrystals(
  inventory,temp,true,labMolarMass),undefined);
 assert.deepEqual(inventory.solidMol,{});
}
// The published aluminum-nitrate table explicitly switches hydrated
// equilibrium solids. Only EXACT measured temperature points are exposed.
for(const temp of [5,15,35,55,65,75,80,90]){
 assert.equal(physicalDensity.labSingleSaltSolubilityGPer100gWater(
  "Al(NO3)3",temp),undefined,
  "Hydrate-phase transition must not be interpolated at "+temp+"°C");
}
assert.equal(physicalDensity.labSingleSaltSolubilityGPer100gWater(
 "BaCl2",20),undefined,"A 25°C BaCl2 point cannot fill 20°C");
assert.equal(physicalDensity.labSingleSaltSolubilityGPer100gWater(
 "ZnCl2",20),undefined,"A 25°C ZnCl2 point cannot fill 20°C");
console.log("15 new source-traced solubilities: 10-point nitrate series, five chloride/phosphate/acetate references, source units and phase guards verified");

// Thirteen individually sourced measurements: original temperature and
// units survive all the way through the real lab property registry.
// Hydrated salts are NOT a single-phase solubility function; direct
// measurements are available, but we do not interpolate or crystallise.
const newMeasuredSourceRows=[
 ["NiSO4",0,29.3,"g/100ml-water",29.3/.99984],
 ["NiSO4",20,29.3,"g/100ml-water",29.3/.9982],
 ["NiSO4",100,83.7,"g/100ml-water",83.7/.9584],
 ["CH3COOLi",20,40.8,"g/100g-water",40.8],
 ["CH3COOLi",40,66.7,"g/100g-water",66.7],
 ["CH3COOLi",50,93.8,"g/100g-water",93.8],
 ["FeSO4",0,15.65,"g/100g-water",15.65],
 ["FeSO4",20.13,26.56,"g/100g-water",26.56],
 ["FeSO4",70.04,56.08,"g/100g-water",56.08],
 ["FeSO4",90.13,37.27,"g/100g-water",37.27],
 ["Mg(NO3)2",20,420,"g/l-water",420/10/.9982],
 ["Mg(NO3)2",25,71.2,"g/100g-water",71.2],
 ["AgI",25,.0028,"mg/l-water",.0028/10000/.997]
];
for(const [formula,temp,sourceValue,unit,expected] of newMeasuredSourceRows){
 const sample=pureWaterMeasurements.find(x=>
  x.formula===formula&&x.temperatureC===temp);
 assert.ok(sample,"Missing original measured source for "+formula+" "+temp);
 assert.equal(sample.sourceValue,sourceValue);
 assert.equal(sample.originalUnit,unit);
 const standardized=literature.labMeasuredSolubilityGPer100gWater(sample);
 approximately(standardized,expected,1e-12);
 approximately(physicalDensity.labSingleSaltSolubilityGPer100gWater(
  formula,temp),expected,1e-12);
 const prop=registryProps.labSubstanceProperties(formula,temp);
 assert.equal(prop.solubilityKnown,true,
  "Exact source value did not reach active lab for "+formula+" "+temp);
 approximately(prop.solubilityGPer100gWater,expected,1e-12);
 assert.equal(prop.binaryCrystallizationUnsupported,true,
  "Measured saturation is not a validated phase model for "+formula);
 const inventory={speciesMol:{H2O:1,[formula]:.25},solidMol:{}};
 assert.equal(physicalDensity.labEquilibrateSingleSaltCrystals(
  inventory,temp,true,labMolarMass),undefined,
  "Reference-only formula cannot create dry crystals: "+formula);
 assert.deepEqual(inventory.solidMol,{});
}
// Even adjacent tabulated NiSO4/Li-acetate measurements do not justify a
// single dry-crystal equilibrium when the stable hydrate is unspecified.
for(const [formula,unmeasured] of [
 ["NiSO4",10],["NiSO4",70],
 ["CH3COOLi",30],["CH3COOLi",45],
 ["FeSO4",20],["FeSO4",60],
 ["Mg(NO3)2",22],["Mg(NO3)2",24],
 ["AgI",20]
]){
 assert.equal(physicalDensity.labSingleSaltSolubilityGPer100gWater(
  formula,unmeasured),undefined,
  "Unknown/phase-changing solubility temperature was invented: "+
   formula+" at "+unmeasured);
}
// This is an EXACT 20.13 °C source, not a reported 20 °C knot.
assert.equal(registryProps.labSubstanceProperties("FeSO4",20).solubilityKnown,false);
// The AgI environmental water reference is truly small, never 0.0028 g/L.
assert.ok(physicalDensity.labSingleSaltSolubilityGPer100gWater("AgI",25)<.000001);
console.log("13 phase-guarded source solubility points: original units, exact temperatures, no inventing crystals or curves");

// Five independent exact-temperature source rows, none extrapolated.
for(const [formula,temp,raw,unit,expected] of [
 ["K2SO3",25,1060,"g/l-water",106/.997],
 ["Li2SO4",25,342,"g/l-water",34.2/.997],
 ["CuS",18,.000033,"g/100ml-water",.000033/.9986],
 ["SrSO4",20,.0138,"g/100ml-water",.0138/.9982],
 ["(NH4)2CO3",15,100,"g/100g-water",100]
]){
 const item=pureWaterMeasurements.find(x=>
  x.formula===formula&&x.temperatureC===temp);
 assert.ok(item,"Missing exact publication value: "+formula+" at "+temp);
 assert.equal(item.sourceValue,raw);
 assert.equal(item.originalUnit,unit);
 approximately(literature.labMeasuredSolubilityGPer100gWater(item),
  expected,1e-11);
 approximately(physicalDensity.labSingleSaltSolubilityGPer100gWater(
  formula,temp),expected,1e-11);
 const prop=registryProps.labSubstanceProperties(formula,temp);
 assert.equal(prop.solubilityKnown,true,"New source not wired to registry");
 assert.equal(prop.binaryCrystallizationUnsupported,true,
  "Dissolution is not a validated crystal phase equilibrium");
 const inventory={speciesMol:{H2O:.5,[formula]:.08},solidMol:{}};
 assert.equal(physicalDensity.labEquilibrateSingleSaltCrystals(
  inventory,temp,true,labMolarMass),undefined);
 assert.deepEqual(inventory.solidMol,{});
}
for(const [id,temp] of [["K2SO3",20],["Li2SO4",20],["CuS",20],
 ["(NH4)2CO3",20],["SrSO4",21]]){
 // Li2SO4 has an INDEPENDENT 293 K value, but not an exact 20.00 C
 // datum; other salts have similarly isolated source temperatures.
 assert.equal(physicalDensity.labSingleSaltSolubilityGPer100gWater(id,temp),
  undefined,"Exact source must not be smoothed into unknown temperatures");
}
approximately(physicalDensity.labCrystalDensityGml("K2SO3"),2.35);
for(const [id,limits] of Object.entries({
 MnSO4:{meltingC:700,decompositionC:850,behavior:"decomposes"},
 CH3COOLi:{meltingC:280},
 "(NH4)2CO3":{decompositionC:58,behavior:"decomposes"}
})){
 const dry=thermalProps.labThermalInfo(id,"g");
 assert.equal(dry.known,true);
 for(const [k,v] of Object.entries(limits)){
  if(typeof v==="number")approximately(dry[k],v,1e-9);
  else assert.equal(dry[k],v);
 }
 assert.equal(thermalProps.labThermalInfo(id,"ml").known,false);
}
assert.equal(thermalProps.labThermalInfo("(NH4)2CO3","g").meltingC,undefined);
assert.equal(thermalProps.labThermalInfo("MnSO4","g").boilingC,undefined);
console.log("New water and thermal source values: exact-only with conservative phase guards");

// LiOH: anhydrous powder and its stoichiometric monohydrate are
// DISTINCT independently measured solids (ILO/WHO ICSC 0913/0914).
// Both say "g/100 mL WATER", not hydrated-equivalent "g/100g solution".
const liDry=pureWaterMeasurements.find(x=>x.formula==="LiOH"&&x.temperatureC===20);
assert.ok(liDry);
assert.equal(liDry.originalUnit,"g/100ml-water");
assert.equal(liDry.sourceValue,12.8);
approximately(literature.labMeasuredSolubilityGPer100gWater(liDry),12.8/.9982,1e-11);
approximately(physicalDensity.labSingleSaltSolubilityGPer100gWater(
 "LiOH",20),12.8/.9982,1e-11);
const liProp=registryProps.labSubstanceProperties("LiOH",20);
assert.equal(liProp.solubilityKnown,true);
assert.equal(liProp.binaryCrystallizationUnsupported,true);
approximately(liProp.solubilityGPer100gWater,12.8/.9982,1e-11);
const lithiumHydrate=hydrates.labHydrateSolubilityAtTemperature("LiOH·H2O",20);
assert.ok(lithiumHydrate);
assert.equal(lithiumHydrate.baseFormula,"LiOH");
assert.equal(lithiumHydrate.waters,1);
assert.equal(lithiumHydrate.sourceUrl,
 "https://inchem.org/documents/icsc/icsc/eics0914.htm");
approximately(lithiumHydrate.massGPer100gWater,19.1/.9982,1e-11);
assert.equal(hydrates.labHydrateSolubilityAtTemperature("LiOH·H2O",22),
 undefined,"A hydrate cannot invent 22°C solubility from an isolated point");
assert.equal(physicalDensity.labSingleSaltSolubilityGPer100gWater("LiOH",22),
 undefined,"A dry LiOH point cannot invent a solubility curve");
const dryLiOH=thermalProps.labThermalInfo("LiOH","g");
assert.equal(dryLiOH.known,true);
approximately(dryLiOH.meltingC,471.15,1e-10);
assert.equal(dryLiOH.decompositionC,924);
assert.equal(dryLiOH.boilingC,undefined,
 "924°C is documented decomposition, never ordinary boiling");
assert.equal(dryLiOH.behavior,"decomposes");
assert.equal(thermalProps.labThermalInfo("LiOH","ml").known,false);
const liInventory={speciesMol:{LiOH:.1,H2O:1},solidMol:{}};
assert.equal(physicalDensity.labEquilibrateSingleSaltCrystals(
 liInventory,20,true,labMolarMass),undefined);
assert.deepEqual(liInventory.solidMol,{});
console.log("LiOH dry/monohydrate separate, exact 20C solubilities, corrected decomposition: PASS");

// Original ILO/WHO ICSC 1200 Na2SO3 is 22 g per 100 mL PURE WATER
// at exactly 20°C. Its decomposition at 600°C is NOT ordinary melting.
// UCT Prague independently provides true crystal density 2.66 g/cm3;
// ICSC quotes 2.63: preserve the declared chosen UCT source, not a
// fabricated average of these distinct published measurements.
const sulfiteLiterature=pureWaterMeasurements.find(x=>
 x.formula==="Na2SO3"&&x.temperatureC===20);
assert.ok(sulfiteLiterature);
assert.equal(sulfiteLiterature.originalUnit,"g/100ml-water");
assert.equal(sulfiteLiterature.sourceValue,22);
assert.equal(sulfiteLiterature.sourceUrl,
 "https://inchem.org/documents/icsc/icsc/eics1200.htm");
approximately(literature.labMeasuredSolubilityGPer100gWater(
 sulfiteLiterature),22/.9982,1e-12);
approximately(physicalDensity.labSingleSaltSolubilityGPer100gWater(
 "Na2SO3",20),22/.9982,1e-12);
const sulfiteProps=registryProps.labSubstanceProperties("Na2SO3",20);
assert.equal(sulfiteProps.solubilityKnown,true);
approximately(sulfiteProps.solubilityGPer100gWater,22/.9982,1e-12);
assert.equal(sulfiteProps.binaryCrystallizationUnsupported,true);
approximately(physicalDensity.labCrystalDensityGml("Na2SO3"),2.66,1e-12);
approximately(physicalDensity.labCrystalDensityGml("FeCl3"),2.9,1e-12);
assert.equal(registryProps.labSubstanceProperties("FeCl3").crystalDensityGPerMl,2.9);
const sulfiteThermal=thermalProps.labThermalInfo("Na2SO3","g");
assert.equal(sulfiteThermal.known,true);
assert.equal(sulfiteThermal.decompositionC,600);
assert.equal(sulfiteThermal.behavior,"decomposes");
assert.equal(sulfiteThermal.meltingC,undefined);
assert.equal(sulfiteThermal.boilingC,undefined);
assert.equal(thermalProps.labThermalInfo("Na2SO3","ml").known,false);
const sulfiteInventory={speciesMol:{H2O:.5,Na2SO3:.1},solidMol:{}};
assert.equal(physicalDensity.labEquilibrateSingleSaltCrystals(
 sulfiteInventory,20,true,labMolarMass),undefined);
assert.deepEqual(sulfiteInventory.solidMol,{});
// FeCl3 is explicitly denoted "reaction" upon contact with water
// (ICSC 1499). Never assign its 92 g/100mL hydrolysis data as
// a simple anhydrous binary dissolution equilibrium.
assert.equal(registryProps.labSubstanceProperties("FeCl3",20).solubilityKnown,
 false,"Reactive ferric chloride must not be marked pure-water soluble");
assert.equal(physicalDensity.labSingleSaltSolubilityGPer100gWater(
 "FeCl3",20),undefined);
console.log("Sulfite crystal/solubility/thermal references and ferric hydrolysis guard: PASS");

// Invalid extrapolation: a 25°C measurement does NOT define the
// solubility at 20°C, and an isolated 20°C record does not define 21°C.
for(const formula of ["PbSO4","SrCO3","ZnS","FeS","Ca3(PO4)2"])
 assert.equal(physicalDensity.labSingleSaltSolubilityGPer100gWater(
  formula,20),undefined,"Never mislabel an 18/25°C reading as 20°C");
for(const formula of ["CaCO3","BaCO3","BaSO4","MgCO3","PbI2","PbCO3"]){
 assert.equal(physicalDensity.labSingleSaltSolubilityGPer100gWater(
  formula,22),undefined,"One measured knot does not define a curve");
 const p=registryProps.labSubstanceProperties(formula,22);
 assert.equal(p.literatureSolubilityReference.temperatureC,20);
 assert.equal(p.binaryCrystallizationUnsupported,true);
}
const sr=registryProps.labSubstanceProperties("SrCO3",22);
assert.equal(sr.literatureSolubilityReference.temperatureC,18);
assert.equal(sr.solubilityKnown,false,
 "18°C evidence alone cannot claim a numerical 22°C solubility");
for(const formula of ["Na2S","KNO2","BaSO4","CaCO3","CaSO4","LiCl"]){
 const inventory={speciesMol:{[formula]:.05,H2O:.5},solidMol:{}};
 const result=physicalDensity.labEquilibrateSingleSaltCrystals(
  inventory,20,true,labMolarMass);
 assert.equal(result,undefined,
  "Reference-only values must not invoke extra approximate binary-crystal equilibrium: "+formula);
 assert.deepEqual(inventory.solidMol,{},
  "The reference-only single-salt solver must not assign new dry crystals");
 // The independent ion-speciation / Ksp engine may STILL legitimately
 // predict precipitation. Its settled solid is not a result of this solver.
}
console.log("81 sourced measurements across 51 stock formulas: 31 exact 20°C and 32 off-grid points");


// Individual source-linked normal-pressure phase boundaries. Avoid
// mistaking dry-solid melting/sublimation/decomposition for the behavior
// of an aqueous stock solution or of a hydrated crystal.
const phaseBatch={
 NH4Cl:{sublimationC:338,behavior:"sublimes"},
 CaSO4:{decompositionC:1450,behavior:"decomposes"},
 MgCO3:{decompositionC:350,behavior:"decomposes"},
 PbI2:{meltingC:410,decompositionC:872,behavior:"decomposes"},
 CH3COONa:{meltingC:324},
 Na2CO3:{meltingC:851},
 CuSO4:{decompositionC:650,behavior:"decomposes"},
 ZnS:{meltingC:1700},
 Fe3O4:{meltingC:1597},
 SiO2:{meltingC:1713}
};
assert.equal(Object.keys(phaseBatch).length,10);
for(const [formula,expected] of Object.entries(phaseBatch)){
 const dry=thermalProps.labThermalInfo(formula,"g");
 assert.equal(dry.known,true,formula+" experimental dry reference unavailable");
 for(const [key,value] of Object.entries(expected)){
  if(typeof value==="number")approximately(dry[key],value);
  else assert.equal(dry[key],value);
 }
 assert.equal(thermalProps.labThermalInfo(formula,"ml").known,false,
  "Pure-solid phase change should not be used as aqueous boiling point: "+formula);
 if(expected.behavior==="decomposes")assert.equal(dry.boilingC,undefined,
  "A decomposing material has no normal-pressure boiling model");
}
console.log("Ten reviewed dry-solid thermal materials, eleven individually sourced boundaries checked");
