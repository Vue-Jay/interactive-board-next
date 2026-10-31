/** A classroom pH meter follows CURRENT liquid moles and composition,
 * not gas headspace millilitres or a stale display-only "H2O" label.
 * Consecutive acid/base and precipitation steps must preserve chemistry.
 */
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
const ph=load("src/lektrusLabPH.ts");
const network=load("src/lektrusLabReactionNetwork.ts");
const dose=(ml=10,m=.1)=>({unit:"ml",value:ml,concentrationM:m});
const near=(v,goal,tolerance=.06,note="")=>{
 const toleranceValue=typeof tolerance==="number"?tolerance:.06;
 const description=typeof tolerance==="string"?tolerance:note;
 assert.ok(Math.abs(v-goal)<=toleranceValue,
  "pH "+v+" expected "+goal+" "+description);
};
const acid={reagents:["HCl"],environment:"aqueous",doses:{HCl:dose()}};
near(ph.labVesselPH(acid).pH,1);
const withHeadspace={...acid,reagents:["HCl","H2"],
 doses:{...acid.doses,H2:{unit:"ml",value:200}}};
near(ph.labVesselPH(withHeadspace).pH,1,
 "Gas millilitres must not dilute an aqueous strong acid");
assert.equal(ph.labVesselPH({...acid,reagents:["H2"],
 doses:{H2:{unit:"ml",value:200}}}),null,
 "Gas-only container must not have a fictitious aqueous pH");
const withCarbonDioxide={...acid,reagents:["HCl","CO2"],
 doses:{...acid.doses,CO2:{unit:"ml",value:150}}};
near(ph.labVesselPH(withCarbonDioxide).pH,1,
 "Headspace CO2 volume must not change liquid acid molarity");
const withWater={...acid,reagents:["HCl","H2","H2O"],
 doses:{...withHeadspace.doses,H2O:{unit:"ml",value:10}}};
near(ph.labVesselPH(withWater).pH,1.30,.03,
 "Only real water addition dilutes the measured acid");
// Current measured molecular products override a historic display label.
const persisted={reagents:["H2O"],environment:"aqueous",
 filteredSolution:{volumeMl:20},
 chemicalInventory:{speciesMol:{HCl:.001,H2O:0},solidMol:{},
  settled:true}};
near(ph.labVesselPH(persisted).pH,1.30,.03,
 "A historic H2O label must not mask measured HCl already in the vessel");
near(ph.labVesselPH({...persisted,reagents:[]}).pH,1.30,.03,
 "A valid measured molecular ledger remains readable when old reagent labels are missing");
assert.equal(ph.labVesselPH({...persisted,filteredSolution:{volumeMl:0}}),null,
 "Dry inventory must not be interpreted as liquid pH");
const neutral={...persisted,
 chemicalInventory:{speciesMol:{NaCl:.001,H2O:.001},solidMol:{},settled:true}};
near(ph.labVesselPH(neutral).pH,7,.025);
let current=lab.putLabReagent(lab.defaultLabBench(),"v1","HCl",dose(10,.1));
current=lab.putLabReagent(current,"v1","NaOH",dose(10,.1));
let v=current.vessels[0];
near(ph.labVesselPH(v).pH,7,.04);
current=lab.advanceLabSimulation(current,1000);
for(let ms=11000;ms<=131000;ms+=10000){
 if(current.vessels[0].reactionAmounts?.complete)break;
 current=lab.advanceLabSimulation(current,ms);
}
assert.ok(current.vessels[0].reactionAmounts?.complete,
 "Initial measured neutralization completes before adding a second reagent");
const salt=network.simulateLabInventory(current.vessels[0]);
assert.ok((salt.speciesMol.NaCl??0)>.00099);
const beforeMass=network.labInventoryMassG(salt);
current=lab.putLabReagent(current,"v1","AgNO3",dose(10,.1));
assert.notEqual(current.vessels[0].reagents.length,0);
v=current.vessels[0];
const precipitated=network.simulateLabInventory({
 ...v,volumeMl:lab.labVesselQuantity(v).volumeMl});
assert.ok((precipitated.solidMol.AgCl??0)>.00098,
 "Nitrate reacts with the REAL NaCl product, producing AgCl");
near(ph.labVesselPH(v).pH,7,.6,
 "Separating chloride into AgCl does not invent free HCl/NaOH");
const precipMol=precipitated.solidMol.AgCl;
current=lab.putLabReagent(current,"v1","HCl",dose(10,.1));
v=current.vessels[0];
const acidReading=lab.labIndicatorResult({...v,indicator:"methyl-orange"});
assert.ok(acidReading&&acidReading.pH<3,
 "New strong acid controls the indicator AFTER previous precipitation");
assert.ok(network.simulateLabInventory({...v,
 volumeMl:lab.labVesselQuantity(v).volumeMl}).solidMol.AgCl>precipMol*.99,
 "Acid titration must not erase prior precipitate");
current=lab.putLabReagent(current,"v1","NaOH",dose(10,.1));
v=current.vessels[0];
const restoredPH=ph.labVesselPH(v);
assert.ok(restoredPH&&restoredPH.pH>6&&restoredPH.pH<8,
 "A new measured base restores a neutral solution after the acid stage");
const final=network.simulateLabInventory({...v,
 volumeMl:lab.labVesselQuantity(v).volumeMl});
assert.ok((final.solidMol.AgCl??0)>precipMol*.99);
assert.ok(network.labInventoryMassG(final)>beforeMass,
 "Added measured reagent mass must remain accounted for");
const ui=fs.readFileSync("src/lektrusLabPH.ts","utf8");
assert.match(ui,/!GAS_REAGENTS\.has\(id\)/);
assert.match(ui,/!v\.chemicalInventory&&v\.reagents\.length===1/);
console.log("Lab pH: gas-headspace exclusion, pure water, historical ledgers, consecutive precipitate/acid/base reactions OK");
