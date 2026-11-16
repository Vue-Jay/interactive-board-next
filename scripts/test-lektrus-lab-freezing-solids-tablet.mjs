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
const frozenBench=lab.addLabVessel(bench,"beaker");
assert.strictEqual(lab.transferLabMeasuredLiquid(frozenBench,start.id,"v2",5),frozenBench,
 "A partially frozen sample cannot be measured as a homogeneous liquid");
assert.strictEqual(lab.fastLabPour(frozenBench,start.id,"v2"),frozenBench);
assert.strictEqual(lab.pourLabVessel(frozenBench,start.id,"v2"),frozenBench);
let thawed=lab.setLabCoolerTemperature(frozenBench,cooler.id,20);
const thawStart=thawed.simulationAtMs??0;
for(let n=1;n<=150&&lab.labHasFrozenLiquid(thawed.vessels[0]);n++)
 thawed=lab.advanceLabSimulation(thawed,thawStart+n*10000);
assert.equal(lab.labHasFrozenLiquid(thawed.vessels[0]),false,"A thawed sample is transferable again");
assert.notStrictEqual(lab.transferLabMeasuredLiquid(thawed,start.id,"v2",5),thawed);
const discarded=lab.emptyLabVessel(bench,start.id);
assert.equal(discarded.vessels[0].frozenFraction,undefined,
 "Emptying the glassware clears its former ice fraction");
const refilled=lab.putLabReagent(discarded,start.id,"H2O",{value:10,unit:"ml"});
assert.equal(refilled.vessels[0].frozenFraction,undefined,
 "New liquid must not inherit ice from a discarded experiment");
// A weighed soluble salt does NOT freeze at pure water's 0°C.
const freezing=load("src/lektrusLabFreezing.ts");
const salineDoses={H2O:{value:20,unit:"ml"},NaCl:{value:1,unit:"g"}};
const salineReference=freezing.labAqueousFreezeReference(salineDoses);
assert.ok(salineReference?.freezingPointC<-.1 &&
 salineReference.freezingPointC>-20,
 "School NaCl brine should freeze below 0°C by a bounded measured estimate");
assert.equal(freezing.labAqueousFreezeReference({C2H5OH:{value:20,unit:"ml"}}),undefined,
 "Pure ethanol cannot be depicted as water ice at 0°C");
const network=load("src/lektrusLabReactionNetwork.ts");
const dissolution=load("src/lektrusLabDissolution.ts");
const steam={value:20,unit:"ml",phase:"gas"};
const steamAndSalt={reagents:["H2O","NaCl"],environment:"aqueous",
 doses:{H2O:steam,NaCl:{value:1,unit:"g"}}};
assert.equal(freezing.labAqueousFreezeReference(steamAndSalt.doses),undefined,
 "Water vapor cannot create a liquid freezing plateau");
assert.equal(dissolution.labBinarySaltEquilibrium(steamAndSalt,22),undefined,
 "Gas-volume water must not dissolve weighed salt");
const steamAndSalts={...steamAndSalt,reagents:[...steamAndSalt.reagents,"KCl"],
 doses:{...steamAndSalt.doses,KCl:{value:1,unit:"g"}}};
assert.equal(dissolution.labSchoolMixedSaltEquilibrium(steamAndSalts,22),undefined);
for(const input of [steamAndSalt,steamAndSalts]){
 const inv=network.simulateLabInventory(input);
 for(const id of input.reagents.filter(id=>id!=="H2O")){
  assert.equal(inv.solidMol[id],inv.speciesMol[id],`${id}: all weighed salt stays solid without liquid water`);
 }
}
for(const id of ["N2","O2","H2","CH4"]){
 assert.deepEqual(freezing.labAqueousFreezeReference({...salineDoses,
  [id]:{value:5,unit:"ml"}}),salineReference,`${id}: headspace is not a solvent`);
}
// A stock labelled "liquid" does not automatically create an aqueous
// medium. Unreviewed solvent mixtures must not silently dissolve weighed
// salts using the water-only solubility registry.
const neatStocks=load("src/lektrusLabCatalog.ts").LAB_NEAT_STOCK;
for(const id of [...neatStocks].filter(id=>id!=="H2O")){
 for(const order of [[id,"NaCl"],["NaCl",id]]){
  const doses={[id]:{value:10,unit:"ml"},NaCl:{value:1,unit:"g"}};
  let mixture=lab.defaultLabBench();
  for(const formula of order)mixture=lab.putLabReagent(mixture,start.id,formula,doses[formula]);
  const v=mixture.vessels[0];
  assert.equal(v.environment,"dry",`${id}: a neat liquid is not water`);
  assert.ok(lab.labVesselContents(v).solid.some(row=>row.formula==="NaCl"&&row.massG>.99),
   `${id}: unreviewed dissolution should retain the weighed solid`);
 }
}
// Preserve the existing virtual organic bromine-addition demonstration.
let bromine=lab.putLabReagent(lab.defaultLabBench(),start.id,"Br2",{value:1,unit:"ml"});
bromine=lab.putLabReagent(bromine,start.id,"C2H4",{value:10,unit:"ml"});
assert.equal(lab.labObservation(bromine.vessels[0]).caseData?.family,"organic");
// Dry organic reactions must be reachable through the normal reagent
// cabinet instead of requiring a hidden environment switch.
for(const alcohol of ["C2H5OH","CH3OH"]){
 let mixture=lab.putLabReagent(lab.defaultLabBench(),start.id,alcohol,{value:10,unit:"ml"});
 mixture=lab.putLabReagent(mixture,start.id,"Na",{value:.05,unit:"g"});
 assert.equal(mixture.vessels[0].environment,"dry");
 assert.equal(lab.labObservation(mixture.vessels[0]).caseData?.family,"organic");
}
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
assert.match(ui,/Дождитесь оттаивания перед переливанием/);
assert.match(ui,/if\(next!==configured\)/,"Changing the pipette setting alone is not a successful transfer");
const css=fs.readFileSync("src/lektrusChemistryBench.css","utf8");
const art=fs.readFileSync("src/LektrusLabDeviceIcon.tsx","utf8");
assert.match(ui,/LAB_COOLER_MIN_C,LAB_COOLER_MAX_C/);
assert.match(ui,/value>=LAB_COOLER_MIN_C&&value<=LAB_COOLER_MAX_C/);
assert.match(ui,/inputMode="text"/,
 "Tablet cooler must offer a text keyboard that can enter a negative sign");
assert.match(ui,/replace\(\/−\/g,"-"\)/,
 "Cooler accepts both Unicode minus and ASCII minus");
assert.match(ui,/value>=LAB_COOLER_MIN_C&&value<=LAB_COOLER_MAX_C/);
assert.match(ui,/className="lektrus-lab-power-glyph"/,
 "Hotplate and cooler use an always-rendered CSS power icon");
assert.doesNotMatch(ui,/<svg className="lektrus-lab-power-symbol"/,
 "Tablet WebView must not render the broken inline power SVG");
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

assert.match(css,/\.lektrus-lab-power-glyph::before\{/);
assert.match(css,/\.lektrus-lab-power-glyph::after\{/);
assert.match(css,/Tablet face controls v4/);
assert.match(css,/aspect-ratio:110\/108/,
 "Temperature screen and power knob follow the SVG device aspect ratio");
assert.match(css,/\.lektrus-lab-device-face-controls\.is-cooler \.lektrus-lab-device-face-temp/);
assert.match(css,/@media\(pointer:coarse\)/);
assert.match(art,/kind==="cooler"/);
console.log("Cooling and solids PASS: −100°C cooler, mass-conserving pure water and saline freezing, dry CaCO3/NaCl settled, reliable tablet power and negative-input layout.");
