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
assert.equal(lab.labBenchSettings(lab.defaultLabBench()).realism,"low",
 "Every new school experiment must begin in simple mode");
const bare=lab.setLabBenchSettings(lab.defaultLabBench(),{realism:"high"});
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


// Experiment controls are shared state, not local UI preferences.
// Legacy boards default to evaporation on and normal time.
assert.equal(lab.labBenchSettings(bare).evaporationEnabled,true);
assert.equal(lab.labBenchSettings(bare).timeScale,1);
const configured=lab.setLabBenchSettings(idle,{
 evaporationEnabled:false,timeScale:5,pourMode:"fast"});
assert.equal(lab.labBenchSettings(configured).pourMode,"fast");
assert.equal(lab.labBenchSettings(configured).timeScale,5);
const disabled=lab.advanceLabSimulation(configured,3000).vessels[0];
assert.equal(disabled.doses.H2O.value,40,
 "Disabling evaporation must preserve the existing solvent");
assert.equal(disabled.ventedVaporMl?.H2O??0,0,
 "Disabling evaporation must not add vapor to the inventory");
assert.ok(disabled.temperatureC>passive.temperatureC,
 "Without evaporative latent-heat losses, the sample cools less");
const normalTwoSeconds=lab.advanceLabSimulation(idle,3000).vessels[0];
const acceleratedTenSeconds=lab.advanceLabSimulation(
 lab.setLabBenchSettings(idle,{timeScale:5}),3000).vessels[0];
assert.ok((acceleratedTenSeconds.ventedVaporMl?.H2O??0)>
 (normalTwoSeconds.ventedVaporMl?.H2O??0),
 "A faster educational clock must advance the physical evaporation");
close(acceleratedTenSeconds.doses.H2O.value,passive.doses.H2O.value,1e-6);
assert.equal(lab.labSimulationTickWaitMs(configured,1000)<lab.labSimulationTickWaitMs(idle,1000),true,
 "The accelerated clock should schedule smoother simulation ticks");
let highPlate=lab.addPlacedLabDevice(bare,"hotplate");
const plateId=highPlate.placedDevices[0].id;
highPlate=lab.setLabHotplateTemperature(highPlate,plateId,950);
assert.equal(highPlate.placedDevices[0].targetTemperatureC,950);
highPlate=lab.setLabHotplateTemperature(highPlate,plateId,1600);
assert.equal(highPlate.placedDevices[0].targetTemperatureC,lab.LAB_HOTPLATE_MAX_C);
assert.equal(lab.canMountLabVessel("hotplate","crucible"),true,
 "A high-temperature demonstration requires an appropriate crucible");
console.log("Lab experiment settings, accelerated clock and virtual high heat: OK");


// Realism changes the actual engine work, not only presentation.
assert.equal(lab.labBenchSettings(bare).realism,"high",
 "Advanced thermal regression explicitly selects high realism");
const classroom=lab.setLabBenchSettings(idle,{realism:"low"});
const standard=lab.setLabBenchSettings(idle,{realism:"medium"});
const detailed=lab.setLabBenchSettings(idle,{realism:"high"});
assert.strictEqual(classroom.vessels,idle.vessels,
 "Changing realism must not recreate or remove a vessel");
assert.equal(classroom.settings.realism,"low");
assert.equal(lab.LAB_REALISM_PROFILES.low.calorimetry,false);
assert.equal(lab.LAB_REALISM_PROFILES.low.melting,false);
assert.equal(lab.LAB_REALISM_PROFILES.low.mixedSaltKinetics,false);
assert.equal(lab.LAB_REALISM_PROFILES.medium.calorimetry,true);
assert.equal(lab.LAB_REALISM_PROFILES.medium.binarySaltKinetics,true);
assert.equal(lab.LAB_REALISM_PROFILES.medium.mixedSaltKinetics,false);
assert.equal(lab.LAB_REALISM_PROFILES.high.mixedSaltKinetics,true);
const lowAmbient=lab.advanceLabSimulation(classroom,11000).vessels[0];
const mediumAmbient=lab.advanceLabSimulation(standard,11000).vessels[0];
const highAmbient=lab.advanceLabSimulation(detailed,11000).vessels[0];
assert.equal(lowAmbient.doses.H2O.value,40,
 "Low realism skips slow background evaporation");
assert.ok(mediumAmbient.doses.H2O.value<40,
 "Warm measured water still evaporates on medium realism");
assert.ok(highAmbient.doses.H2O.value<40);
const roomWater={...water,temperatureC:22};
const atRoom={...idle,vessels:[roomWater]};
const slowLow=lab.labSimulationTickWaitMs(
 lab.setLabBenchSettings(atRoom,{realism:"low"}),11000);
const slowHigh=lab.labSimulationTickWaitMs(atRoom,11000);
assert.equal(slowLow,null,"Low realism skips the ambient VLE clock");
assert.ok(slowHigh!==null,"High realism retains ambient VLE simulation");
assert.equal(lab.labDisplayNumber(38.2,"low","temperature"),"40");
assert.equal(lab.labDisplayNumber(38.2,"medium","temperature"),"38");
assert.equal(lab.labDisplayNumber(38.2,"high","temperature"),"38,2");
assert.equal(lab.labDisplayNumber(12.57,"low"),"13");
assert.equal(lab.labDisplayNumber(12.57,"medium"),"12,6");
assert.equal(lab.labDisplayNumber(12.57,"high"),"12,57");
assert.notEqual(lab.labDisplayNumber(.003,"low"),"0",
 "Trace amounts must remain visible even under coarse rounding");
assert.match(lab.formatLabDose({value:12.57,unit:"ml"},"low"),/^13 мл$/);
const phaseState={formula:"NaCl",solidMol:.01};
const switching={...classroom,vessels:[{...roomWater,
 physicalProcess:"crystallizing",binarySaltPhase:phaseState}]};
const lowPhase=lab.advanceLabSimulation(switching,11000).vessels[0];
assert.deepEqual(lowPhase.binarySaltPhase,phaseState,
 "Simplified mode may skip crystallization kinetics but cannot erase existing solids");
console.log("Lab low/medium/high fidelity engine, conservative switching and coarse readings: OK");

// Cooling bath is an actual apparatus with persisted temperature and contact.
let chilled=lab.addPlacedLabDevice(lab.defaultLabBench(),"cooler");
const coolerId=chilled.placedDevices[0].id;
assert.ok(lab.labDevices.some(d=>d.id==="cooler"),"Cooling bath must be offered in cabinet");
assert.equal(lab.canMountLabVessel("cooler","beaker"),true);
assert.equal(lab.canMountLabVessel("cooler","burette"),false);
chilled=lab.setLabCoolerTemperature(chilled,coolerId,-14);
assert.equal(chilled.placedDevices[0].targetTemperatureC,-14);
chilled=lab.setLabCoolerTemperature(chilled,coolerId,-200);
assert.equal(chilled.placedDevices[0].targetTemperatureC,-20);
chilled=lab.setLabCoolerTemperature(chilled,coolerId,100);
assert.equal(chilled.placedDevices[0].targetTemperatureC,20);
chilled=lab.setLabCoolerTemperature(chilled,coolerId,0);
const coldSample={...chilled.vessels[0],reagents:["NaCl"],
 doses:{NaCl:{value:1,unit:"g"}},temperatureC:90};
chilled={...chilled,vessels:[coldSample],simulationAtMs:1000};
chilled=lab.applyPlacedLabDevice(chilled,coolerId,"v1");
chilled=lab.setPlacedDevicePower(chilled,coolerId,true);
const cooled=lab.advanceLabSimulation(chilled,11000);
assert.ok(cooled.vessels[0].temperatureC<90&&cooled.vessels[0].temperatureC>0,
 "Cooling should be gradual with no sudden jump to bath temperature");
assert.ok(cooled.placedDevices[0].temperatureC<22);
const released=lab.stopPlacedLabDevice(chilled,coolerId);
const detached=lab.advanceLabSimulation(released,11000);
assert.ok(detached.vessels[0].temperatureC>cooled.vessels[0].temperatureC,
 "A cooling bath must not cool a disconnected vessel");
// The formerly hard-coded 450/550 °C glassware cap must never discard
// the thermal simulation's energy after a measured solid has warmed.
const solid={...coldSample,kind:"dish",temperatureC:545};
let high={...chilled,vessels:[solid],placedDevices:[{
 id:"high-plate",kind:"hotplate",x:50,y:70,active:true,linkedVesselId:"v1",
 powered:true,temperatureC:900,targetTemperatureC:900,heatLevel:2
}]};
const aboveCeiling=lab.advanceLabSimulation(high,11000).vessels[0];
assert.ok(aboveCeiling.temperatureC>550,
 "Vessel must not stop artificially at old 550 °C limit");
const ui=fs.readFileSync("src/LektrusChemistryBench.tsx","utf8");
assert.match(ui,/experimentSettingsRef\.current\.open=false/,
 "Desktop settings must have an explicit and outside-dismiss close path");
assert.match(ui,/compactSettingsRef\.current\?\.contains/,
 "Mobile settings must close when tapping outside");
assert.match(ui,/aria-label="Закрыть настройки опыта"/);
assert.match(ui,/clipPath=\{"url\(#"\+id\+"clip\)"\}/,
 "Glass reflection must be clipped to the vessel geometry");
console.log("Cooling bath, unbounded vessel heating, settings dismissal and glass glare: OK");


// Vaporization and visible boiling use the same measured equilibrium point.
const pureWater={kind:"beaker",reagents:["H2O"],
 doses:{H2O:{value:20,unit:"ml"}},stoppered:false,temperatureC:100};
const waterBubblePoint=phase.labIdealBoilingC(pureWater);
assert.ok(waterBubblePoint>99&&waterBubblePoint<101,
 "Only the measured boiling point of water may trigger steam");
assert.equal(phase.labIsBoiling(pureWater,waterBubblePoint-2),false);
assert.equal(phase.labIsBoiling(pureWater,waterBubblePoint),true);
assert.equal(phase.labIsBoiling({...pureWater,stoppered:true},waterBubblePoint),false);
const atBoil=phase.labEvaporate(pureWater,10,waterBubblePoint,150,160);
assert.ok(atBoil.evaporatedMl>.01,"Boiling must consume measured water");
const beforeBoil=phase.labEvaporate(pureWater,10,waterBubblePoint-2,150,160);
assert.ok(atBoil.evaporatedMl>beforeBoil.evaporatedMl,
 "Sub-boiling diffusion must not get the boiling heater's latent budget");
const slightlyHot=lab.advanceLabSimulation({
 ...bare,simulationAtMs:1000,vessels:[{...water,temperatureC:99.9}],
 placedDevices:[hotplate]
},11000).vessels[0];
assert.ok(slightlyHot.temperatureC>=99.5&&slightlyHot.temperatureC<=100.2,
 "An actively boiling sample should not be artificially cooled a second time");
const appSource=fs.readFileSync("src/App.tsx","utf8");
const surfaceSource=fs.readFileSync("src/LektrusChemistryBench.tsx","utf8");
assert.match(appSource,/containsLab=.*itemsRef\.current/);
assert.match(surfaceSource,/document\.addEventListener\("keydown",onDelete,true\)/);
assert.match(surfaceSource,/returnPlacedLabDevice\(bench,deviceId\)/);
assert.match(surfaceSource,/if\(vesselId\)returnGlass\(vesselId\)/);
assert.match(surfaceSource,/setPendingReturnId\(id\)/);
console.log("Boiling onset, latent heat and safe Delete focus regression: OK");


// Time acceleration must integrate the SAME measured energy and solvent mass.
// The evaporation backend intentionally caps one call to 10 seconds. A ×10
// laboratory therefore uses ten 10-second integrations, NOT one 100-second
// heat jump with only 10 seconds of vaporization.
const acceleratedSeed={...bare,simulationAtMs:1000,
 vessels:[{...water,temperatureC:99.9}],
 placedDevices:[{...hotplate,temperatureC:150,targetTemperatureC:150}]};
const checkAccelerated=(scale)=>{
 const boosted=lab.advanceLabSimulation(
  lab.setLabBenchSettings(acceleratedSeed,{timeScale:scale}),11000);
 let reference=acceleratedSeed;
 for(let step=1;step<=scale;step++)
  reference=lab.advanceLabSimulation(reference,1000+step*10000);
 const measured=boosted.vessels[0],expected=reference.vessels[0];
 close(measured.doses.H2O.value,expected.doses.H2O.value,1e-5);
 close(measured.ventedVaporMl.H2O,expected.ventedVaporMl.H2O,1e-5);
 close(measured.doses.H2O.value+measured.ventedVaporMl.H2O,40,1e-5);
 close(measured.temperatureC,expected.temperatureC,.15);
 close(boosted.placedDevices[0].temperatureC,
  reference.placedDevices[0].temperatureC,.15);
 assert.ok(measured.temperatureC<=100.2,
  "Even under ×"+scale+" a boiling liquid cannot overheat past its plateau");
 assert.ok(measured.doses.H2O.value>0);
 assert.ok(boosted.event>acceleratedSeed.event);
 assert.equal(boosted.simulationAtMs,11000);
};
for(const scale of [2,5,10])checkAccelerated(scale);
assert.ok(lab.advanceLabSimulation(acceleratedSeed,1000)===acceleratedSeed,
 "A nonadvancing simulation must not manufacture a board revision");
const unaffected=lab.advanceLabSimulation({
 ...acceleratedSeed,settings:{...acceleratedSeed.settings,timeScale:10,
 evaporationEnabled:false}},11000);
assert.equal(unaffected.vessels[0].doses.H2O.value,40,
 "Acceleration cannot bypass the evaporation-off switch");
console.log("×2/×5/×10 substepping: heat, boiling, vapor mass and cooling stay synchronized");


// The teacher's stopwatch is a shared control, not a per-frame DB counter.
const clockSeed=lab.defaultLabBench();
assert.equal(lab.labExperimentClockSeconds(clockSeed,1000),0);
assert.equal(lab.formatLabClock(3661.9),"01:01:01");
const started=lab.setLabExperimentClock(clockSeed,"start",1000);
assert.equal(started.experimentClock.running,true);
close(lab.labExperimentClockSeconds(started,3500),2.5);
assert.equal(lab.labSimulationTickWaitMs(started,3500),null,
 "An idle stopwatch must never schedule a network simulation tick");
assert.strictEqual(lab.setLabExperimentClock(started,"start",2000),started,
 "Repeating Start must not reset or duplicate the timer");
const fastClock=lab.setLabBenchSettings(started,{timeScale:5},3500);
close(lab.labExperimentClockSeconds(fastClock,3500),2.5);
close(lab.labExperimentClockSeconds(fastClock,5500),12.5);
const paused=lab.setLabExperimentClock(fastClock,"pause",5500);
close(lab.labExperimentClockSeconds(paused,99999),12.5);
const resumed=lab.setLabExperimentClock(paused,"start",100000);
close(lab.labExperimentClockSeconds(resumed,101000),17.5);
const resetClock=lab.setLabExperimentClock(resumed,"reset",101000);
assert.equal(resetClock.experimentClock.running,false);
assert.equal(lab.labExperimentClockSeconds(resetClock,110000),0);
const clearedClock=lab.clearLabTable(started);
assert.equal(clearedClock.experimentClock,undefined,
 "Cleaning the tabletop starts a fresh experiment clock");
const peerClock=lab.mergeLabBench(clockSeed,started,
 lab.setLabBenchSettings(clockSeed,{realism:"high"}));
assert.equal(peerClock.experimentClock.running,true,
 "Concurrent realism changes must not discard another peer's stopwatch");
const idleFast=lab.setLabBenchSettings(started,{timeScale:10},1000);
assert.equal(lab.advanceLabSimulation({
 ...idleFast,simulationAtMs:1000},11000).experimentClock.running,true);
assert.equal(lab.labExperimentClockSeconds(idleFast,11000),100,
 "Time acceleration applies to experiment seconds, not wall seconds");
// Measured solid fusion uses Q=mL and the same heat capacity as sensible heat.
const solidNa={...bare.vessels[0],reagents:["Na"],
 doses:{Na:{value:8,unit:"g"}},temperatureC:97.79,meltFraction:.2,
 environment:"dry"};
const sodiumSample={...bare,simulationAtMs:1000,
 vessels:[solidNa],placedDevices:[{...hotplate,temperatureC:180,
 targetTemperatureC:180,active:true,powered:true}]};
const heatedNa=lab.advanceLabSimulation(sodiumSample,3000).vessels[0];
const sensibleNa=heat.labSensibleHeatStep("beaker",solidNa.doses,97.79,22,2,
 {kind:"hotplate",temperatureC:180,powerW:160});
const capacityNa=heat.labKnownHeatCapacityJPerK("beaker",solidNa.doses);
const expectedFusion=Math.max(0,(sensibleNa.temperatureC-97.79)*capacityNa)/(8*115);
assert.ok(expectedFusion>0,"Heater energy must enter melting plateau");
close(heatedNa.meltFraction,.2+expectedFusion,1e-6);
assert.ok(Math.abs(heatedNa.temperatureC-97.79)<.12,
 "Sample must not rise above melting point before latent heat is supplied");
const chilledNa={...sodiumSample,vessels:[{...solidNa,meltFraction:.8}],
 placedDevices:[{id:"coldbath",kind:"cooler",x:50,y:70,active:true,
 linkedVesselId:"v1",powered:true,temperatureC:0,targetTemperatureC:0}]};
const coolingNa=lab.advanceLabSimulation(chilledNa,2000).vessels[0];
assert.ok(coolingNa.meltFraction<.8&&coolingNa.meltFraction>0,
 "Cooling a partial melt must crystallize gradually using latent heat");
assert.ok(Math.abs(coolingNa.temperatureC-97.79)<.12);
const layoutSource=fs.readFileSync("src/LektrusChemistryBench.tsx","utf8");
const clockStyles=fs.readFileSync("src/lektrusLabSceneLayout.css","utf8");
assert.match(layoutSource,/aria-label="Часы времени опыта"/);
assert.match(layoutSource,/setLabExperimentClock\(bench/);
assert.match(clockStyles,/\.lektrus-lab-experiment-clock\{/);
console.log("Shared stopwatch, ×5/×10 elapsed time, latent fusion and cooled sodium: OK");
