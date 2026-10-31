/** Heating and boiling of REAL filtered chemistry, even without stock doses.
 * Filtered carrier volume must contribute its sensible-heat capacity and
 * alter the boiling point as solvent is lost over subsequent simulation ticks.
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
 const js=ts.transpileModule(fs.readFileSync(resolved,"utf8"),{
  compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2023}
 }).outputText;
 new Function("require","module","exports",js)(name=>{
  if(!name.startsWith("."))throw Error("Unexpected "+name);
  return load(path.resolve(path.dirname(resolved),name+".ts"));
 },mod,mod.exports);
 return mod.exports;
}
const heat=load("src/lektrusLabCalorimetry.ts");
const evaporation=load("src/lektrusLabEvaporation.ts");
const lab=load("src/lektrusChemistryBenchModel.ts");
const waterOnly={kind:"conical",doses:{H2O:{unit:"ml",value:20}}};
const measured={kind:"conical",doses:undefined,
 filteredSolution:{sourceEquation:"BaCl2 + Na2SO4 → BaSO4↓ + 2 NaCl",
  solutes:["NaCl"],volumeMl:20},
 chemicalInventory:{speciesMol:{NaCl:.002}}};
const empty=heat.labKnownHeatCapacityJPerK("conical");
assert.equal(empty,undefined);
const waterCapacity=heat.labKnownHeatCapacityJPerK("conical",waterOnly.doses);
const filtrateCapacity=heat.labKnownHeatCapacityJPerK("conical",undefined,20);
assert.ok(Math.abs(waterCapacity-filtrateCapacity)<1,
 "Measured filtrate has essentially the same water heat capacity as measured pure water");
const smallCapacity=heat.labKnownHeatCapacityJPerK("conical",undefined,5);
assert.ok(filtrateCapacity>smallCapacity+60);
const heater={kind:"hotplate",temperatureC:150,powerW:160};
const hotterSmall=heat.labSensibleHeatStep("conical",undefined,22,22,10,heater,5);
const coolerBig=heat.labSensibleHeatStep("conical",undefined,22,22,10,heater,20);
assert.ok(hotterSmall&&coolerBig);
assert.ok(hotterSmall.temperatureC>coolerBig.temperatureC,
 "5ml filtrate warms faster than 20ml under the same heater");
assert.ok(coolerBig.temperatureC>22);
assert.ok(coolerBig.capacityJPerK>100);
const cooling=heat.labSensibleHeatStep("conical",undefined,50,22,10,undefined,20);
assert.ok(cooling&&cooling.temperatureC<50&&cooling.temperatureC>22);
const pure=evaporation.labIdealBoilingC(waterOnly);
const initial=evaporation.labIdealBoilingC(measured);
const concentrated={...measured,filteredSolution:{
 ...measured.filteredSolution,volumeMl:.1}};
const concentratedBoil=evaporation.labIdealBoilingC(concentrated);
assert.ok(pure>99.5&&pure<100.5);
assert.ok(initial>pure,
 "Dissolved salt elevates the boiling point of a measured filtrate");
assert.ok(concentratedBoil>initial+.3,
 "Evaporation must elevate boiling point using the CURRENT filtered-solution volume");
assert.ok(evaporation.labVaporPressureKPa(concentrated,100)<
 evaporation.labVaporPressureKPa(measured,100));
const secondNeat=evaporation.labIdealBoilingC({
 kind:"conical",doses:undefined,
 filteredSolution:{...measured.filteredSolution,volumeMl:20},
 chemicalInventory:{speciesMol:{NaCl:.0001}}
});
assert.ok(secondNeat<initial,
 "Two independent filtrates without initial doses must NOT share stale boiling cache");
const dryMeasurement=heat.labKnownHeatCapacityJPerK("conical",undefined,0);
assert.equal(dryMeasurement,undefined);
const stockWater=heat.labKnownHeatCapacityJPerK("conical",
 {H2O:{unit:"ml",value:5}},20);
assert.ok(stockWater>filtrateCapacity,
 "Added stock water contributes extra thermal mass, not a replacement for the filtrate");
const fresh=lab.setLabBenchSettings(lab.defaultLabBench(),{realism:"high"});
const fixture={...fresh,simulationAtMs:1000,
 vessels:[{...fresh.vessels[0],kind:"conical",reagents:["NaCl"],
  doses:undefined,filteredSolution:measured.filteredSolution,
  chemicalInventory:{speciesMol:{NaCl:.002},solidMol:{},settled:true},
  environment:"aqueous",observed:true,temperatureC:22}],
 placedDevices:[{id:"hot",kind:"hotplate",x:50,y:70,
  powered:true,active:true,linkedVesselId:"v1",
  temperatureC:150,targetTemperatureC:150}]};
const warm=lab.advanceLabSimulation(fixture,11000);
const warmC=warm.vessels[0].temperatureC;
assert.ok(warmC>22&&warmC<60,
 "A heated 20ml separated solution must warm gradually, not as empty glass");
assert.ok(warm.vessels[0].filteredSolution.volumeMl<=20);
const smaller={...fixture,vessels:fixture.vessels.map(v=>({...v,
 filteredSolution:{...v.filteredSolution,volumeMl:5}}))};
const faster=lab.advanceLabSimulation(smaller,11000);
assert.ok(faster.vessels[0].temperatureC>warmC,
 "Full laboratory simulation also respects the smaller liquid's heat capacity");
const source=fs.readFileSync("src/lektrusChemistryBenchModel.ts","utf8");
assert.match(source,/v\.filteredSolution\?\.volumeMl\?\?0\):undefined;/,
 "The shared simulation calls calorimetry with current filtered carrier volume");
console.log("Filtrate heat capacity, gradual heating, Raoult concentration and boiling cache: OK");
