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
const prep=lab.putLabReagent(bench,start.id,"H2O",{value:20,unit:"ml"});
assert.equal(prep.vessels.find(v=>v.id===start.id).doses.H2O.value,20);
// The physical simulator must freeze only the selected pure liquid, not
// blindly freeze every aqueous salt solution at 0°C.
bench=lab.setLabCoolerTemperature(prep,cooler.id,-30);
bench={...bench,simulationPaused:false,simulationAtMs:0,
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
assert.match(css,/\.lektrus-lab-power-symbol\{/);
assert.match(css,/\.lektrus-lab-device-face-controls\.is-cooler \.lektrus-lab-device-face-temp/);
assert.match(css,/@media\(pointer:coarse\)/);
assert.match(art,/kind==="cooler"/);
console.log("Cooling and solids PASS: -100..20°C target, pure water physically freezes with conserved mass, tablet SVG power icon, aligned cold bath controls and settled solid artwork.");
