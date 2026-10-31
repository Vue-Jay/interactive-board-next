import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";
const cache=new Map();
function load(file){
 const resolved=path.resolve(file);
 if(cache.has(resolved))return cache.get(resolved).exports;
 const mod={exports:{}};cache.set(resolved,mod);
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
const phase=load("src/lektrusLabEvaporation.ts");
const net=load("src/lektrusLabReactionNetwork.ts");
const heat=load("src/lektrusLabCalorimetry.ts");
const close=(a,b,tol=1e-8)=>assert.ok(Math.abs(a-b)<=tol,a+" != "+b);
// Persisted molecular composition is unchanged as its measured water volume
// evaporates. Cached precipitation MUST follow the actual remaining water.
const inventory={speciesMol:{NaCl:.002},solidMol:{},settled:true};
const base={reagents:["NaCl"],environment:"aqueous",temperatureC:25,
 chemicalInventory:inventory,filteredSolution:{volumeMl:20}};
const first=net.simulateLabInventory(base);
assert.equal(first.solidMol.NaCl??0,0);
const evaporated={...base,filteredSolution:{volumeMl:.1}};
const crystal=net.simulateLabInventory(evaporated);
assert.ok((crystal.solidMol.NaCl??0)>.0005,
 "Crystals must grow when solvent evaporates without an explicit volumeMl");
close(crystal.speciesMol.NaCl,.002);
assert.strictEqual(net.simulateLabInventory(base),first,
 "Same water volume and chemistry should reuse its cached calculation");
assert.notStrictEqual(crystal,first,
 "Evaporated volumes must have independent cached phase balances");
close(net.simulateLabInventory({...evaporated,volumeMl:.1}).solidMol.NaCl,
 crystal.solidMol.NaCl);
const warm=net.simulateLabInventory({...evaporated,temperatureC:60});
assert.ok(warm.solidMol.NaCl<crystal.solidMol.NaCl);
close(net.labInventoryMassG(crystal),net.labInventoryMassG(first));
// Passive evaporation must cool the liquid by the energy needed to form vapor,
// not silently lose mass while using only the glass/ambient heat equation.
const bare=lab.defaultLabBench();
const water={...bare.vessels[0],kind:"beaker",temperatureC:80,
 doses:{H2O:{unit:"ml",value:40}},reagents:["H2O"],environment:"aqueous"};
const idle={...bare,simulationAtMs:1000,vessels:[water],placedDevices:[]};
const noEvapHeat=heat.labSensibleHeatStep("beaker",water.doses,80,22,10);
const passive=lab.advanceLabSimulation(idle,11000).vessels[0];
assert.ok(passive.temperatureC<noEvapHeat.temperatureC);
assert.ok((passive.ventedVaporMl?.H2O??0)>0);
close(passive.doses.H2O.value+passive.ventedVaporMl.H2O,40,1e-6);
// Near boiling, the supplied heater watts cannot BOTH raise sensible
// temperature and become steam without decrementing the energy budget.
const hotplate={id:"plate-1",kind:"hotplate",x:50,y:70,active:true,
 linkedVesselId:"v1",powered:true,temperatureC:150,
 targetTemperatureC:150,heatLevel:2};
const boiling={...idle,vessels:[{...water,temperatureC:99.9}],
 placedDevices:[hotplate]};
const withoutLatent=heat.labSensibleHeatStep("beaker",water.doses,
 99.9,22,10,{kind:"hotplate",temperatureC:150,powerW:160});
assert.ok(withoutLatent.temperatureC>100);
const boilingV=lab.advanceLabSimulation(boiling,11000).vessels[0];
assert.ok(boilingV.temperatureC<=100.2&&boilingV.temperatureC>94,
 "Boiling must remain near a sensible/latent thermal plateau");
const boiledMl=40-boilingV.doses.H2O.value;
assert.ok(boiledMl>.01,"At boiling, a real fraction of water must vaporize");
close(boilingV.doses.H2O.value+boilingV.ventedVaporMl.H2O,40,1e-6);
const latentJ=boiledMl*.997*phase.LAB_LATENT_VAPORIZATION_J_PER_G.H2O;
assert.ok(latentJ<withoutLatent.heaterWattsToContents*10+
 withoutLatent.capacityJPerK*6,"No unlimited vaporization energy");
const closed=lab.advanceLabSimulation({...idle,vessels:[{...water,
 stoppered:true,stopperedAtC:80}]},11000).vessels[0];
assert.equal(closed.doses.H2O.value,40);
assert.equal(closed.ventedVaporMl?.H2O??0,0);
// An actual separated NaCl filtrate follows both parts of the model while
// retaining the exact measured NaCl moles and expelled-water ledger.
const filtered={...water,doses:undefined,reagents:["NaCl"],
 filteredSolution:{volumeMl:20,sourceEquation:"reviewed",solutes:["NaCl"]},
 chemicalInventory:{speciesMol:{NaCl:.002},solidMol:{},settled:true}};
const filteredV=lab.advanceLabSimulation({...idle,vessels:[filtered]},11000).vessels[0];
assert.ok(filteredV.filteredSolution.volumeMl<20);
assert.ok(filteredV.temperatureC<80);
close(filteredV.filteredSolution.volumeMl+
 (filteredV.ventedVaporMl?.H2O??0),20,1e-6);
close(net.simulateLabInventory(filteredV).speciesMol.NaCl,.002);
console.log("Lab coupled thermal-vapor energy, solvent-aware crystals and mass conservation: OK");
