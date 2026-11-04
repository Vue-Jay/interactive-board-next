/** Acceptance of school cooling, actual pure-water freeze and settled
 * solid rendering. This loads real simulation modules, no chemistry mocks.
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
 const js=ts.transpileModule(fs.readFileSync(resolved,"utf8"),{compilerOptions:{
  module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2023}}).outputText;
 new Function("require","module","exports",js)(id=>{
  assert.ok(id.startsWith("."),"Only relative modules: "+id);
  return load(path.resolve(path.dirname(resolved),id+".ts"));
 },mod,mod.exports);
 return mod.exports;
}
const lab=load("src/lektrusChemistryBenchModel.ts");
assert.equal(lab.LAB_COOLER_MIN_C,-100);
assert.equal(lab.LAB_COOLER_MAX_C,20);
assert.equal(lab.LAB_HOTPLATE_MAX_C,1000);
let bench=lab.defaultLabBench();
bench=lab.addPlacedLabDevice(bench,"cooler",{x:50,y:72});
const cooler=lab.placedLabDevices(bench).find(d=>d.kind==="cooler");
assert.ok(cooler&&cooler.id);
bench=lab.setLabCoolerTemperature(bench,cooler.id,-40);
assert.equal(lab.placedLabDevices(bench).find(d=>d.id===cooler.id).targetTemperatureC,-40);
bench=lab.setLabCoolerTemperature(bench,cooler.id,-150);
assert.equal(lab.placedLabDevices(bench).find(d=>d.id===cooler.id).targetTemperatureC,-100);
bench=lab.setLabCoolerTemperature(bench,cooler.id,30);
assert.equal(lab.placedLabDevices(bench).find(d=>d.id===cooler.id).targetTemperatureC,20);
const start=bench.vessels[0];
assert.ok(start&&start.id);
// Weighed solid must be an actual bottom-settled phase even before
// any reaction starts: insoluble carbonate AND initially dry soluble salt.
for(const [formula,massG] of [["CaCO3",5],["NaCl",4]]){
 const dry=lab.putLabReagent(lab.defaultLabBench(),start.id,formula,
  {value:massG,unit:"g"});
 const vessel=dry.vessels.find(v=>v.id===start.id);
 assert.ok(vessel?.doses?.[formula],
  "Weighed "+formula+" must be accepted by a clean beaker");
 const contents=lab.labVesselContents(vessel);
 assert.ok(contents.solid.some(row=>row.formula===formula&&row.massG>0),
  "Directly added "+formula+" must have a visible settled solid phase");
 assert.equal(contents.solutionMl,0,
  "Dry weighed substance must not invent water in the container");
}
const prep=lab.putLabReagent(bench,start.id,"H2O",{value:20,unit:"ml"});
assert.equal(prep.vessels.find(v=>v.id===start.id).doses.H2O.value,20);
// The physical simulator must freeze only the selected pure liquid, not
// blindly freeze every aqueous salt solution at 0°C.
bench=lab.setLabCoolerTemperature(prep,cooler.id,-30);
bench={...bench,simulationPaused:false,simulationAtMs:0,
 settings:{...bench.settings,evaporationEnabled:false},
 placedDevices:lab.placedLabDevices(bench).map(d=>d.id===cooler.id?
  {...d,active:true,linkedVesselId:start.id,powered:true}:d)};
let frozen=0;
for(let n=1;n<=120;n++){
 bench=lab.advanceLabSimulation(bench,n*10000);
 frozen=bench.vessels.find(v=>v.id===start.id).frozenFraction??0;
 if(frozen>.2)break;
}
assert.ok(frozen>.2,"Pure water must progressively freeze in a powered subzero bath");
assert.ok(bench.vessels.find(v=>v.id===start.id).temperatureC<=.5,
 "Water freezes around 0°C before its solid temperature drops");
assert.equal(bench.vessels.find(v=>v.id===start.id).doses.H2O.value,20,
 "Freezing does not destroy water mass");
// A weighed soluble salt does NOT freeze at pure water's 0°C.
const freezing=load("src/lektrusLabFreezing.ts");
const salineDoses={H2O:{value:20,unit:"ml"},NaCl:{value:1,unit:"g"}};
const salineReference=freezing.labAqueousFreezeReference(salineDoses);
assert.ok(salineReference?.freezingPointC<-.1 &&
 salineReference.freezingPointC>-20,
 "School NaCl brine should freeze below 0°C by a bounded measured estimate");
assert.equal(freezing.labAqueousFreezeReference({C2H5OH:{value:20,unit:"ml"}}),undefined,
 "Pure ethanol cannot be depicted as water ice at 0°C");
const salinePrepared=lab.putLabReagent(
 lab.putLabReagent(lab.defaultLabBench(),start.id,"H2O",salineDoses.H2O),
 start.id,"NaCl",salineDoses.NaCl);
let saltBench=lab.addPlacedLabDevice(salinePrepared,"cooler",{x:48,y:72});
const saltCooler=lab.placedLabDevices(saltBench).find(d=>d.kind==="cooler");
assert.ok(saltCooler);
saltBench=lab.setLabCoolerTemperature(saltBench,saltCooler.id,-45);
saltBench={...saltBench,simulationPaused:false,simulationAtMs:0,
 settings:{...saltBench.settings,evaporationEnabled:false},
 placedDevices:lab.placedLabDevices(saltBench).map(d=>d.id===saltCooler.id?
  {...d,active:true,linkedVesselId:start.id,powered:true}:d)};
for(let n=1;n<=150;n++){
 saltBench=lab.advanceLabSimulation(saltBench,n*10000);
 if((saltBench.vessels.find(v=>v.id===start.id).frozenFraction??0)>.15)break;
}
const saltVessel=saltBench.vessels.find(v=>v.id===start.id);
assert.ok((saltVessel.frozenFraction??0)>.15,
 "Measured NaCl solution must gradually freeze in a sufficiently cold bath");
assert.ok(saltVessel.temperatureC<=salineReference.freezingPointC+.6);
assert.equal(saltVessel.doses.H2O.value,20,
 "Ice formation conserves solvent mass");
assert.equal(saltVessel.doses.NaCl.value,1,
 "Freezing does not erase dissolved salt");
const ui=fs.readFileSync("src/LektrusChemistryBench.tsx","utf8");
const css=fs.readFileSync("src/lektrusChemistryBench.css","utf8");
const art=fs.readFileSync("src/LektrusLabDeviceIcon.tsx","utf8");
assert.match(ui,/LAB_COOLER_MIN_C,LAB_COOLER_MAX_C/);
assert.match(ui,/value>=LAB_COOLER_MIN_C&&value<=LAB_COOLER_MAX_C/);
assert.match(ui,/min=\{LAB_COOLER_MIN_C\} max=\{LAB_COOLER_MAX_C\}/);
assert.match(ui,/className="lektrus-lab-power-symbol"/);
assert.doesNotMatch(ui,/>⏻<\/button>/,"No missing platform power font glyph");
assert.match(ui,/className="lektrus-lab-added-solid"/);
assert.match(ui,/contents\.solid\.length>0&&visiblePowderH>0/);
assert.match(ui,/solidVolumeMl\/capacityMl/);
assert.match(ui,/className="lektrus-lab-frozen-liquid"/);
assert.match(ui,/vessel\.frozenFraction/);
assert.match(css,/Tablet\/cooling bath v3/);
const faceCss=css.slice(css.lastIndexOf("/* Tablet/cooling bath v3"));
assert.match(faceCss,/left:42\.7%!important;top:69\.4%!important;width:38%!important/,
 "Cooler field must sit on its engraved SVG temperature screen");
assert.match(faceCss,/left:79\.1%!important;top:70\.4%!important/,
 "Cooler power button must sit over the actual SVG knob");
// Real tablet and compact widths: the input box and 27-34px power
// target cannot overlap even after touch-target enlargement.
for(const width of [101,119,138,175]){
 const fieldRight=width*(.427+.38/2);
 const buttonWidth=Math.min(34,Math.max(27,width*.25));
 const buttonLeft=width*.791-buttonWidth/2;
 assert.ok(buttonLeft-fieldRight>=2,
  "Tablet cooler power/temperature touch targets overlap at "+width+"px");
}

assert.match(css,/\.lektrus-lab-power-symbol\{/);
assert.match(css,/\.lektrus-lab-device-face-controls\.is-cooler \.lektrus-lab-device-face-temp/);
assert.match(css,/@media\(pointer:coarse\)/);
assert.match(art,/kind==="cooler"/);
console.log("Cooling and solids PASS: −100°C cooler, mass-conserving pure water and saline freezing below colligative point, settled CaCO3/NaCl, tablet power icons and separated cooler controls.");
