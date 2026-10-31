import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import ts from "typescript";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const load=(path,requireFn=()=>{throw Error("Unexpected import")})=>{
 const js=ts.transpileModule(read(path),{compilerOptions:{
  target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS
 }}).outputText;
 const exports={};
 new Function("require","exports",js)(requireFn,exports);
 return exports;
};
const reaction=load("src/lektrusReactionDatabase.ts");
const titration=load("src/lektrusLabTitration.ts");
const layout=load("src/lektrusLabLayout.ts");
const chem=load("src/lektrusLabStoichiometry.ts",key=>{
 assert.equal(key,"./lektrusReactionDatabase");return reaction;
});
const gasDynamics=load("src/lektrusLabGasDynamics.ts",key=>{
 assert.equal(key,"./lektrusLabStoichiometry");return chem;
});
const appearance=load("src/lektrusLabAppearance.ts",key=>{
 assert.equal(key,"./lektrusReactionDatabase");return reaction;
});
const catalog=load("src/lektrusLabCatalog.ts",key=>{
 if(key==="./lektrusLabAppearance")return appearance;
 assert.equal(key,"./lektrusReactionDatabase");return reaction;
});
const curatedBatch=load("src/lektrusLabCuratedPropertyBatch.ts");
const thermal=load("src/lektrusLabPhysicalProperties.ts",key=>{
 assert.equal(key,"./lektrusLabCuratedPropertyBatch");return curatedBatch;
});
const calorimetry=load("src/lektrusLabCalorimetry.ts",key=>{
 assert.equal(key,"./lektrusLabCuratedPropertyBatch");return curatedBatch;
});
const solubilityMeasurements=load("src/lektrusLabSolubilityMeasurements.ts");
const constants=load("src/lektrusLabMaterialConstants.ts",key=>{
 if(key==="./lektrusLabCuratedPropertyBatch")return curatedBatch;
 if(key==="./lektrusReactionDatabase")return reaction;
 assert.equal(key,"./lektrusLabSolubilityMeasurements");return solubilityMeasurements;
});
const dissolution=load("src/lektrusLabDissolution.ts",key=>{
 if(key==="./lektrusLabMaterialConstants")return constants;
 assert.equal(key,"./lektrusLabStoichiometry");return chem;
});
const vapor=load("src/lektrusLabEvaporation.ts",key=>{
 assert.equal(key,"./lektrusLabMaterialConstants");return constants;
});
const network=load("src/lektrusLabReactionNetwork.ts",key=>{
 if(key==="./lektrusLabStoichiometry")return chem;
 if(key==="./lektrusLabMaterialConstants")return constants;
 if(key==="./lektrusLabDissolution")return dissolution;
 assert.equal(key,"./lektrusReactionDatabase");return reaction;
});
const hydratedReferences=load("src/lektrusLabHydrateReferences.ts");
const saturatedReferences=load("src/lektrusLabSaturatedSolutionReferences.ts");
const materialRegistry=load("src/lektrusLabPropertyRegistry.ts",key=>{
 if(key==="./lektrusLabHydrateReferences")return hydratedReferences;
 if(key==="./lektrusLabSaturatedSolutionReferences")return saturatedReferences;
 if(key==="./lektrusLabSolubilityMeasurements")return solubilityMeasurements;
 if(key==="./lektrusReactionDatabase")return reaction;
 if(key==="./lektrusLabStoichiometry")return chem;
 if(key==="./lektrusLabMaterialConstants")return constants;
 if(key==="./lektrusLabPhysicalProperties")return thermal;
 if(key==="./lektrusLabCalorimetry")return calorimetry;
 assert.equal(key,"./lektrusLabReactionNetwork");return network;
});
const waterIonization=load("src/lektrusLabWaterIonization.ts");
const acidBase=load("src/lektrusLabPH.ts",key=>{
 if(key==="./lektrusLabWaterIonization")return waterIonization;
 if(key==="./lektrusReactionDatabase")return reaction;
 assert.equal(key,"./lektrusLabReactionNetwork");return network;
});
const lab=load("src/lektrusChemistryBenchModel.ts",key=>{
 if(key==="./lektrusLabTitration")return titration;
 if(key==="./lektrusLabLayout")return layout;
 if(key==="./lektrusLabStoichiometry")return chem;
 if(key==="./lektrusLabPhysicalProperties")return thermal;
 if(key==="./lektrusLabCalorimetry")return calorimetry;
 if(key==="./lektrusLabDissolution")return dissolution;
 if(key==="./lektrusLabGasDynamics")return gasDynamics;
 if(key==="./lektrusLabEvaporation")return vapor;
 if(key==="./lektrusLabPH")return acidBase;
 if(key==="./lektrusLabReactionNetwork")return network;
 if(key==="./lektrusLabCatalog")return catalog;
 if(key==="./lektrusLabMaterialConstants")return constants;
 assert.equal(key,"./lektrusReactionDatabase");return reaction;
});
// Detailed legacy physics assertions explicitly opt into high realism.
const detailedBench=()=>{
 const bench=lab.defaultLabBench();
 return {...bench,settings:{...bench.settings,realism:"high"}};
};
assert.equal(lab.labBenchSettings(lab.defaultLabBench()).realism,"low",
 "New chemistry laboratories start in simple classroom mode");
{
const kits=load("src/lektrusLabExperimentKits.ts",key=>{
 if(key==="./lektrusLabCatalog")return catalog;
 if(key==="./lektrusChemistryBenchModel")return lab;
 assert.equal(key,"./lektrusReactionDatabase");return reaction;
});
assert.equal(lab.labBenchSettings(detailedBench()).pourMode,"gradual",
 "Existing classroom boards retain gradual pouring by default");
const fastSetting=lab.setLabBenchSettings(detailedBench(),{pourMode:"fast"});
assert.equal(lab.labBenchSettings(fastSetting).pourMode,"fast");
assert.equal(lab.labBenchSettings(lab.setLabBenchSettings(fastSetting,{pourMode:"gradual"})).pourMode,
 "gradual","Both pouring speeds can be selected and saved");
const pourSource=lab.putLabReagent(detailedBench(),"v1","NaCl",
 {value:10,unit:"ml",concentrationM:.1});
const pourPair=lab.addLabVessel(pourSource,"beaker");
const rapid=lab.fastLabPour(pourPair,"v1","v2");
const session=lab.startLabPour(pourPair,"v1","v2","test-gradual");
assert.ok(session.pouring,"Gradual mode starts a 20-step session");
let gradualComparison=session;
for(let tick=0;tick<lab.LAB_POUR_STEPS;tick++)
 gradualComparison=lab.advanceLabPour(gradualComparison);
gradualComparison=lab.stopLabPour(gradualComparison,"test-gradual");
assert.deepEqual(rapid.vessels.map(v=>({reagents:v.reagents,doses:v.doses})),
 gradualComparison.vessels.map(v=>({reagents:v.reagents,doses:v.doses})),
 "Fast transfer conserves precisely the same measured mass and concentration as gradual");
assert.equal(rapid.pouring,undefined,"Fast pouring completes without a dangling shared session");
assert.equal(rapid.vessels[1].doses.NaCl.value,10);
assert.equal(lab.fastLabPour(pourPair,"v1","v1"),pourPair,
 "Fast mode rejects transfers into the same vessel");

const precipitation=reaction.reviewedReactionCases.find(row=>
 row.environment==="aqueous"&&row.status==="reaction"&&
 row.reactants.includes("NaCl")&&row.reactants.includes("AgNO3"));
assert.ok(precipitation);
const kitBench=kits.prepareLabExperimentKit(detailedBench(),precipitation);
assert.deepEqual(kitBench.vessels.flatMap(v=>v.reagents),precipitation.reactants);
assert.equal(kitBench.vessels.length,precipitation.reactants.length,
 "Prepared experiments use only the vessels required by their reagents");
assert.ok(kitBench.vessels.every(v=>v.doses?.[v.reagents[0]]?.value>0));
assert.equal(kitBench.vessels[0].kind,"beaker");
assert.ok(kitBench.vessels.slice(1).every(v=>v.kind==="tube"),
 "Compact tubes replace unnecessary large glassware for small portions");
const ignition=reaction.reviewedReactionCases.find(row=>row.status==="reaction"&&
 row.environment==="ignited"&&row.reactants.includes("Mg")&&row.reactants.includes("O2"));
assert.ok(ignition);
const fireKit=kits.prepareLabExperimentKit(kitBench,ignition);
assert.equal(fireKit.vessels[0].kind,"crucible",
 "Dry heated demonstrations use a crucible instead of a liquid beaker");
assert.deepEqual((fireKit.placedDevices??[]).map(d=>d.kind),["burner","tripod"]);
assert.ok(fireKit.placedDevices.every(d=>d.powered===false),
 "Ready experiments never ignite a burner or turn on a hotplate automatically");
assert.ok(fireKit.placedDevices.every(d=>d.linkedVesselId===
 fireKit.vessels.find(v=>v.kind==="crucible").id),
 "Ready heating kits mount the reactant crucible instead of loose apparatus");
assert.equal(fireKit.placedDevices.find(d=>d.kind==="tripod").standHeight,.6,
 "Heating demonstrations keep the retort clamp within burner range");
assert.deepEqual(kits.labExperimentKitSummary(ignition).equipment,["Горелка","Штатив"]);
assert.equal(fireKit.pouring,undefined);
assert.equal(fireKit.titration,undefined);
const existingKit={...kitBench,quickReagents:[{id:"H2O",dose:{value:5,unit:"ml"}}],
 settings:{...lab.labBenchSettings(kitBench),pourMode:"fast"}};
const replacedKit=kits.prepareLabExperimentKit(existingKit,ignition);
assert.deepEqual(replacedKit.quickReagents,existingKit.quickReagents,
 "Changing a ready experiment retains quick shelf configuration");
assert.equal(replacedKit.settings.pourMode,"fast",
 "Experiment kits keep the teacher's chosen pouring speed");
const surfaceText=read("src/LektrusChemistryBench.tsx");
assert.match(surfaceText,/Переливание: по 5% каждые 0,15 секунды/);
assert.match(surfaceText,/fastLabPour\(bench,sourceId,targetId\)/);
assert.match(surfaceText,/fastLabPour\(latest,sourceId,targetId\)/);
assert.match(surfaceText,/setTimeout\(perform,1000\)/,
 "Both pour modes require one second of intentional contact");
assert.match(surfaceText,/Показать ещё 36 опытов/,
 "Ready experiments must avoid rendering the whole reaction catalogue at once");
assert.match(surfaceText,/Текущая посуда и содержимое будут заменены/,
 "A loaded tabletop must not be silently discarded by choosing a recipe");
const styleText=read("src/lektrusChemistryBench.css");
assert.match(styleText,/\.lektrus-lab-experiment-grid/);
assert.match(styleText,/\.lektrus-lab-pour-mode/);

}
/** Gas-stock baseline and exclusive apparatus heating regression.
 * A sample that was already a gas before sealing is not newly generated
 * reaction gas, and overlapping stands cannot borrow another flask's flame. */
{
 let stockGas=lab.addLabVessel(detailedBench(),"flask");
 const vesselId=stockGas.selectedId;
 stockGas=lab.putLabReagent(stockGas,vesselId,"H2",{value:10,unit:"ml"});
 assert.ok(stockGas.vessels.find(v=>v.id===vesselId)?.reagents.includes("H2"));
 const unsealedGas=stockGas.vessels.find(v=>v.id===vesselId);
 const oldMol=lab.labHeadspaceGasMoles(unsealedGas);
 assert.ok(oldMol>0,"Gas stock exists before sealing");
 stockGas=lab.setLabVesselStopper(stockGas,vesselId,true);
 const sealedStock=stockGas.vessels.find(v=>v.id===vesselId);
 assert.ok(Math.abs(sealedStock.sealedReactionGasBaselineMol-oldMol)<1e-12,
  "Cork records all pre-existing gas at sealing, not just reaction products");
 assert.ok(lab.labHeadspaceGasMoles(sealedStock)<1e-12,
  "A pre-existing gas stock must not create artificial positive headspace pressure");
 const initialPressure=lab.labVesselPressure(sealedStock);
 assert.ok(Math.abs((initialPressure.pressureKPa??101.325)-101.325)<1,
  "The newly sealed flask starts close to one atmosphere");
 const resealed=lab.setLabVesselStopper(
  lab.setLabVesselStopper(stockGas,vesselId,false),vesselId,true);
 assert.ok(lab.labHeadspaceGasMoles(resealed.vessels.find(v=>v.id===vesselId))<1e-12);
}
{
 let isolated=lab.addLabVessel(detailedBench(),"beaker");
 // A burner secured to v1 overlaps a different retort stand holding v2.
 // Nearby screen coordinates alone do not authorize heat transfer.
 isolated={...isolated,simulationAtMs:1000,placedDevices:[
  {id:"fireA",kind:"burner",x:48.5,y:74,powered:true,
   heatLevel:2,temperatureC:850,active:true,linkedVesselId:"v1"},
  {id:"standB",kind:"tripod",x:45,y:65,active:true,
   linkedVesselId:"v2",standHeight:.5}
 ]};
 isolated=lab.putLabReagent(isolated,"v1","H2O",{value:10,unit:"ml"});
 isolated=lab.putLabReagent(isolated,"v2","H2O",{value:10,unit:"ml"});
 assert.ok(!lab.labAppliancesBelowStand(isolated,"v2").some(d=>d.id==="fireA"),
  "An already-mounted burner cannot heat a second vessel through a neighbouring stand");
 const next=lab.advanceLabSimulation(isolated,2900);
 assert.ok(next.vessels.find(v=>v.id==="v1").temperatureC>22,
  "The actual flame's mounted vessel receives heat");
 assert.ok(next.vessels.find(v=>v.id==="v2").temperatureC<=22.1,
  "The unrelated vessel remains at ambient temperature");
 const available={...isolated,placedDevices:isolated.placedDevices.map(d=>
  d.id==="fireA"?{...d,active:false,linkedVesselId:undefined}:d)};
 assert.ok(lab.labAppliancesBelowStand(available,"v2").some(d=>d.id==="fireA"),
  "An unmounted burner can still heat a vessel physically above it");
 const heated=lab.advanceLabSimulation(available,2900);
 assert.ok(heated.vessels.find(v=>v.id==="v2").temperatureC>22,
  "Heat reaches the stand-mounted recipient when the burner is genuinely available");
}
console.log("Gas stock sealing baseline and exclusively mounted heater interactions: OK");

let bench=detailedBench();
assert.equal(bench.vessels.length,1,"New lab starts with a single empty beaker");
assert.equal(bench.selectedId,"v1");

/** A quiet tabletop does no background work, but titration remains fast. */
const idleClock=detailedBench();
assert.equal(lab.labSimulationTickWaitMs(idleClock,11000),null);
const waterClock=lab.putLabReagent(idleClock,"v1","H2O",{value:10,unit:"ml"});
const ambientClock={...waterClock,simulationAtMs:1000};
assert.equal(lab.labSimulationTickWaitMs(ambientClock,1000),9800);
assert.equal(lab.labSimulationTickWaitMs(ambientClock,10799),1);
assert.equal(lab.labSimulationTickWaitMs(ambientClock,10800),0);
const hotClock={...ambientClock,placedDevices:[{id:"heater-clock",kind:"hotplate",x:35,y:74,powered:true}]};
assert.equal(lab.labSimulationTickWaitMs(hotClock,1000),1900);
const buretteClock={...ambientClock,vessels:[{...ambientClock.vessels[0],kind:"burette",buretteOpen:true}]};
assert.equal(lab.labSimulationTickWaitMs(buretteClock,1000),500);
const stopperedClock={...ambientClock,vessels:[{...ambientClock.vessels[0],stoppered:true}]};
assert.equal(lab.labSimulationTickWaitMs(stopperedClock,1000),null);
const loadedClock=lab.readLabBench({scienceLabBench:ambientClock});
assert.strictEqual(loadedClock.vessels,ambientClock.vessels);

bench=lab.addLabVessel(bench,"tube");
assert.equal(bench.vessels.length,2,"Additional test tube sits on same bench");
assert.equal(bench.selectedId,"v2");
bench=lab.putLabReagent(bench,"v1","NaCl");
bench=lab.putLabReagent(bench,"v2","AgNO3");
assert.equal(lab.labObservation(bench.vessels[0]).status,"unknown","Unmixed solutions are not reacted");
assert.equal(lab.labObservation(bench.vessels[1]).status,"unknown");
bench=lab.pourLabVessel(bench,"v2","v1");
assert.equal(lab.labObservation(bench.vessels[0]).status,"reaction","Mixing triggers curated precipitation");
assert.equal(lab.labObservation(bench.vessels[0]).caseData.observation,"precipitate");
assert.equal(bench.vessels[1].reagents.length,0,"Transferred container is empty");
assert.deepEqual(bench.vessels[0].reagents,["NaCl","AgNO3"]);

/** Rendering must not rerun phase and density calculations for a vessel
 * whose measured inventory has not changed. A real simulation update creates
 * a new vessel reference, invalidating both memoized derived results. */
const measuredVessel=bench.vessels[0];
const measuredQuantity=lab.labVesselQuantity(measuredVessel);
const measuredContents=lab.labVesselContents(measuredVessel);
assert.strictEqual(lab.labVesselQuantity(measuredVessel),measuredQuantity,
 "An unchanged vessel reuses its measured volume and displacement");
assert.strictEqual(lab.labVesselContents(measuredVessel),measuredContents,
 "An unchanged vessel reuses its phase composition");
const heatedCopy={...measuredVessel,temperatureC:80};
assert.notStrictEqual(lab.labVesselQuantity(heatedCopy),measuredQuantity,
 "A different simulated temperature invalidates displacement memoization");
assert.notStrictEqual(lab.labVesselContents(heatedCopy),measuredContents,
 "A new chemical revision invalidates the phase readout");
assert.deepEqual(lab.labVesselQuantity(measuredVessel),measuredQuantity,
 "The previous vessel revision is not mutated by recalculating another");

let unknown=lab.putLabReagent(bench,"v1","HCl");
assert.equal(lab.labObservation(unknown.vessels[0]).status,"reaction",
 "Reviewed first-stage products remain recognised after additional reagent dosing");
assert.equal(unknown.vessels[0].completedReaction?.observation,"precipitate",
 "Existing precipitate must stay visually represented even when later chemistry is unknown");
let heated=detailedBench();
heated=lab.putLabReagent(heated,"v1","CaCO3");
assert.equal(lab.labObservation(heated.vessels[0]).status,"unknown");
heated=lab.setLabEnvironment(heated,"v1","heated");
assert.equal(lab.labObservation(heated.vessels[0]).status,"reaction",
 "Heating single validated reactant initiates decomposition");
assert.equal(lab.labObservation(heated.vessels[0]).caseData.observation,"gas");
let noReaction=detailedBench();
noReaction=lab.putLabReagent(noReaction,"v1","NaCl");
noReaction=lab.putLabReagent(noReaction,"v1","KNO3");
assert.equal(lab.labObservation(noReaction.vessels[0]).status,"none");
let gas=detailedBench();
gas=lab.putLabReagent(gas,"v1","NaHCO3");
gas=lab.putLabReagent(gas,"v1","HCl");
assert.equal(lab.labObservation(gas.vessels[0]).caseData.observation,"gas");
const invalidPour=lab.pourLabVessel(gas,"v1","v1");
assert.deepEqual(invalidPour,gas,"Cannot pour into the same container");
let full=detailedBench();
for(let i=0;i<9;i++)full=lab.addLabVessel(full,"flask");
assert.equal(full.vessels.length,lab.MAX_BENCH_VESSELS,"Glassware is bounded");
assert.equal(new Set(full.vessels.map(v=>v.id)).size,full.vessels.length);
full=lab.positionLabVessel(full,"v1",-500,500);
assert.equal(full.vessels[0].x,10);assert.equal(full.vessels[0].y,90);
let indicatorBench=detailedBench();
assert.equal(lab.setLabIndicator(indicatorBench,"v1","litmus"),indicatorBench,
 "Indicators cannot be inserted into empty glassware");
indicatorBench=lab.putLabReagent(indicatorBench,"v1","HCl",{value:10,unit:"ml",concentrationM:.1});
indicatorBench=lab.setLabIndicator(indicatorBench,"v1","litmus");
assert.equal(lab.labIndicatorResult(indicatorBench.vessels[0]).medium,"acid");
assert.equal(lab.labIndicatorResult(indicatorBench.vessels[0]).color,"#d85761");
indicatorBench=lab.emptyLabVessel(indicatorBench,"v1");
assert.equal(indicatorBench.vessels[0].indicator,undefined,"Cleaning also removes indicator");
indicatorBench=lab.putLabReagent(indicatorBench,"v1","NaOH",{value:10,unit:"ml",concentrationM:.1});
indicatorBench=lab.setLabIndicator(indicatorBench,"v1","phenolphthalein");
assert.equal(lab.labIndicatorResult(indicatorBench.vessels[0]).medium,"base");
assert.equal(lab.labIndicatorResult(indicatorBench.vessels[0]).color,"#d83a96");
let neutral=lab.putLabReagent(detailedBench(),"v1","H2O");
neutral=lab.setLabIndicator(neutral,"v1","universal");
assert.equal(lab.labIndicatorResult(neutral.vessels[0]).medium,"neutral");
let salt=lab.putLabReagent(detailedBench(),"v1","NaCl");
salt=lab.setLabIndicator(salt,"v1","universal");
assert.equal(lab.labIndicatorResult(salt.vessels[0]).medium,"neutral",
 "Measured 0.1 M NaCl is a neutral reference solution");
let transferred=lab.addLabVessel(neutral,"tube");
transferred=lab.pourLabVessel(transferred,"v1","v2");
assert.equal(transferred.vessels[0].indicator,undefined,"Empty source has no indicator");
assert.equal(transferred.vessels[1].indicator,undefined,"Universal indicator paper must not transfer with solution");
let mixed=lab.addLabVessel(indicatorBench,"flask");
mixed=lab.putLabReagent(mixed,mixed.selectedId,"HCl");
mixed=lab.pourLabVessel(mixed,mixed.selectedId,"v1");
assert.equal(lab.labIndicatorResult(mixed.vessels[0]).medium,"neutral",
 "Neutralisation of known 0.1 M stocks gives a calculable equilibrium pH");
let precip=detailedBench();
precip=lab.putLabReagent(precip,"v1","NaCl",{value:12,unit:"ml"});
precip=lab.addLabVessel(precip,"tube");
precip=lab.putLabReagent(precip,"v2","AgNO3",{value:7,unit:"ml"});
precip=lab.pourLabVessel(precip,"v2","v1");
assert.equal(lab.labObservation(precip.vessels[0]).caseData.observation,"precipitate");
precip=lab.addLabVessel(precip,"flask");
const decanted=lab.pourLabVessel(precip,"v1","v3");
assert.equal(lab.labObservation(decanted.vessels[2]).status,"reaction",
 "Previously reacted material stays visibly reacted after pouring into clean glassware");
assert.equal(lab.labObservation(decanted.vessels[2]).caseData.observation,"precipitate");
assert.ok(decanted.vessels[2].completedReaction,"The verified result is preserved separately from reactant IDs");
assert.equal(decanted.vessels[2].doses.NaCl.value,12);
assert.equal(decanted.vessels[2].doses.AgNO3.value,7);
assert.equal(decanted.vessels[0].completedReaction,undefined,"Emptied source loses its products");
const postReaction=lab.putLabReagent(decanted,"v3","HCl",{value:5,unit:"ml"});
assert.equal(lab.labObservation(postReaction.vessels[2]).status,"reaction",
 "Verified precipitate persists and additional measured reactants can participate");
assert.ok(postReaction.vessels[2].completedReaction,"Previously precipitated solid should remain visible as last known appearance");
const cleaned=lab.emptyLabVessel(postReaction,"v3");
assert.equal(cleaned.vessels[2].completedReaction,undefined,"Sink removes all products");
const stored=lab.removeLabVessel(cleaned,"v3");
assert.equal(stored.vessels.length,2,"Only cleaned glassware returns to cupboard");
assert.equal(stored.selectedId,"",
 "Shelving the selected flask must NOT select another vessel on the table");
const secondShelf=lab.removeLabVessel({...stored,selectedId:"v1"},"v2");
assert.equal(secondShelf.selectedId,"",
 "Shelving any glassware clears prior vessel selection, including other vessels");
assert.equal(secondShelf.vessels[0].id,"v1",
 "Unrelated glassware and its chemical data remain on the table");
const shelfUi=read("src/LektrusChemistryBench.tsx");
assert.match(shelfUi,/const returnGlass=\(id:string\)=>\{/);
assert.match(shelfUi,/setVesselMenuId\(null\);setCompositionId\(null\);setActiveDeviceId\(null\);/,
 "Returning glassware must close quantity panels and device focus");
assert.equal(lab.removeLabVessel(decanted,"v3"),decanted,"A filled flask cannot be stored before draining");
const settings=lab.setLabBenchSettings(detailedBench(),{showEquationBoard:true,animateEffects:false});
assert.equal(lab.labBenchSettings(settings).showEquationBoard,true);
assert.equal(lab.labBenchSettings(settings).animateEffects,false);
const palette=load("src/lektrusLabAppearance.ts",key=>{
 assert.equal(key,"./lektrusReactionDatabase");return reaction;
});
assert.equal(palette.reagentAppearance("CuSO4").color,"#61a9d3");
assert.equal(palette.reagentAppearance("FeCl3").color,"#e1b66d");
assert.equal(palette.reagentAppearance("NaCl").phase,"solution");
assert.equal(palette.reagentAppearance("CuO").phase,"solid");
for(const substance of reaction.substances)
 assert.ok(palette.reagentAppearance(substance.id).color,
  "Every catalogued reagent must have a representative appearance");
let devices=detailedBench();
for(const device of lab.labDevices)devices=lab.toggleLabDevice(devices,device.id);
assert.equal(devices.devices.length,6,"The lab provides six physical instruments including cooling bath, without thermometer");
devices=lab.putLabReagent(devices,"v1","CaCO3");
devices=lab.useLabDevice(devices,"hotplate","v1");
assert.equal(lab.labObservation(devices.vessels[0]).caseData.observation,"gas",
 "Hotplate applies validated heated conditions to the chosen vessel");
devices=lab.useLabDevice(devices,"tripod","v1");
assert.deepEqual(devices.instrumentTarget,{kind:"tripod",vesselId:"v1"});
devices=lab.useLabDevice(devices,"stirrer","v1");
assert.equal(devices.stirringVesselId,"v1","Mixer starts on the selected vessel");
devices=lab.useLabDevice(devices,"stirrer","v1");
assert.equal(devices.stirringVesselId,undefined,"Mixer can be stopped");
devices=lab.useLabDevice(devices,"stirrer","v1");
devices=lab.toggleLabDevice(devices,"stirrer");
assert.equal(devices.stirringVesselId,undefined,"Storing the mixer must stop stirring");
assert.equal(devices.devices.includes("stirrer"),false,"Devices can be returned to storage");
let extra=detailedBench();
for(const kind of lab.labGlassware.filter(v=>v.id!=="beaker").slice(0,5)){
 extra=lab.addLabVessel(extra,kind.id);
}
assert.equal(extra.vessels.length,lab.MAX_BENCH_VESSELS);
assert.ok(lab.labGlassware.some(v=>v.id==="burette"));
assert.ok(lab.labGlassware.some(v=>v.id==="pipette"));
assert.ok(lab.labGlassware.some(v=>v.id==="conical"));
let titrationBench=detailedBench();
titrationBench=lab.setLabTitration(titrationBench,titration.defaultTitration());
assert.equal(titration.titrationReading(titrationBench.titration).pH,1);
titrationBench=lab.dripLabTitration(titrationBench,24);
assert.ok(titration.titrationReading(titrationBench.titration).pH<7);
titrationBench=lab.dripLabTitration(titrationBench,1);
assert.equal(titration.titrationReading(titrationBench.titration).pH,7);
assert.equal(titration.titrationReading(titrationBench.titration).endPointMl,25);
titrationBench=lab.dripLabTitration(titrationBench,1);
assert.ok(titration.titrationReading(titrationBench.titration).pH>7);
titrationBench=lab.restartLabTitration(titrationBench);
assert.equal(titrationBench.titration.addedMl,0);
const reversed=titration.updateTitration(titration.defaultTitration(),{analyte:"base"});
assert.ok(titration.titrationReading(reversed).pH>12);
assert.equal(titration.titrationReading({...reversed,addedMl:25}).pH,7);
assert.equal(titration.updateTitration(reversed,{concentrationAnalyte:-2}),reversed,
 "Invalid concentration must not be accepted");
const paletteForCatalog=load("src/lektrusLabAppearance.ts",key=>{
 assert.equal(key,"./lektrusReactionDatabase");return reaction;
});
const labCatalog=load("src/lektrusLabCatalog.ts",key=>{
 if(key==="./lektrusReactionDatabase")return reaction;
 assert.equal(key,"./lektrusLabAppearance");return paletteForCatalog;
});
assert.equal(labCatalog.cabinetPhase(reaction.substances.find(x=>x.id==="NaCl")),"solid");
assert.equal(labCatalog.cabinetPhase(reaction.substances.find(x=>x.id==="HCl")),"liquid");
assert.equal(labCatalog.cabinetPhase(reaction.substances.find(x=>x.id==="CO2")),"gas");
const grouped=labCatalog.buildLabCatalog({group:"class",phase:"solid",sort:"formula"});
assert.ok(grouped.length>2,"Chemical groups must appear as separate catalogue sections");
assert.ok(grouped.flatMap(g=>g.items).every(v=>labCatalog.cabinetPhase(v)==="solid"));
assert.ok(grouped.some(g=>g.title==="Соли"),"Salt cabinet section exists");
const catalogSource=read("src/LektrusChemistryBench.tsx");
assert.match(catalogSource,/lektrus-lab-modal-sortbar/);
assert.match(catalogSource,/lektrus-lab-reagent-group-grid/);
assert.doesNotMatch(catalogSource,/openCabinet\("titration"\)/,
 "Titration runs between real vessels without an independent editor");
assert.match(catalogSource,/lektrus-lab-titration-on-table/);
assert.match(catalogSource,/lektrus-lab-class-tabs/);
assert.match(catalogSource,/devicesForLabMode\(bench\)/);
assert.match(catalogSource,/applyPlacedLabDevice\(/,
 "Apparatus must attach directly to physical vessels");
assert.match(catalogSource,/downDevice\(/,
 "Apparatus must be draggable as a tabletop object");
assert.match(catalogSource,/finishDeviceShelf/,
 "Cabinet items must be movable to the tabletop");
assert.match(read("src/lektrusChemistryBench.css"),/white-space:normal!important/,
 "Long glassware names should wrap naturally instead of ellipsizing");
const labLayout=load("src/lektrusLabLayout.ts");
for(const count of [1,2,3,4,5,6]){
 let arranged=detailedBench();
 for(let i=1;i<count;i++)arranged=lab.addLabVessel(arranged,"tube");
 arranged=lab.arrangeLabVessels(arranged);
 assert.equal(arranged.vessels.length,count);
 const projected=arranged.vessels.map(v=>labLayout.labDisplayPoint(v,count>3));
 const width=count>3?10:10.8, height=count>3?19:30;
 for(let i=0;i<projected.length;i++){
  const a=projected[i];
  assert.ok(a.x-width/2>8&&a.x+width/2<83,
   "Free vessels fit the expanded worktop without colliding with the sink");
  assert.ok(a.y-height*.56>42&&a.y+height*.44<94,
   "Placed vessels must stay inside the available work surface");
  for(let j=i+1;j<projected.length;j++){
   const b=projected[j];
   assert.ok(Math.abs(a.x-b.x)>=width||Math.abs(a.y-b.y)>=height,
    "Vessels should not overlap after auto arrangement: "+count+" vessels");
  }
  const roundtrip=labLayout.labLogicalPoint(a);
  assert.ok(Math.abs(roundtrip.x-arranged.vessels[i].x)<.0001);
  assert.ok(Math.abs(roundtrip.y-arranged.vessels[i].y)<.0001);
 }
}
const legacyVessel=labLayout.labDisplayPoint({x:10,y:90});
assert.ok(legacyVessel.x>=6&&legacyVessel.x<83,
 "Saved vessels at extreme old coordinates must not cover furniture");
for(const crowded of [false,true]){
 for(const y of [10,90]){
  const projectedEdge=labLayout.labDisplayPoint({x:50,y},crowded);
  const occupiedHeight=crowded?13.3:15.7;
  assert.ok(projectedEdge.y-occupiedHeight*.56>=42,
   "Glassware must never extend into the wall cabinets");
  assert.ok(projectedEdge.y+occupiedHeight*.44<=97,
   "Glassware must not cross the front of the bench");
 }
}
assert.equal(labLayout.isLabSink({x:85,y:70}),true);
assert.equal(labLayout.isLabCupboard({x:67,y:22}),true);
assert.equal(labLayout.isLabWorktop({x:50,y:73}),true);
assert.equal(labLayout.isLabWorktop({x:14,y:73}),true);
const redesignedLab=read("src/LektrusChemistryBench.tsx");
assert.match(redesignedLab,/lektrus-lab-scene-header/);
assert.match(redesignedLab,/lektrus-lab-worktop-zone/);
assert.match(redesignedLab,/preview\?\.id===v\.id\?preview:vesselPosition\(v\)/,
 "Dragged vessels should visually reach cabinets rather than stop at the worktop");
assert.match(redesignedLab,/arrangeLabVessels\(bench\)/);
assert.match(redesignedLab,/lektrus-lab-equation-history/);
const redesignedCss=read("src/lektrusChemistryBench.css");
assert.match(redesignedCss,/lektrus-lab-reagent-furniture[\s\S]*?lektrus-lab-glass-cupboard/);
assert.match(redesignedCss,/grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
assert.match(redesignedCss,/lektrus-lab-worktop-zone/);
let realBench=detailedBench();
realBench=lab.putLabReagent(realBench,"v1","HCl",
 {value:25,unit:"ml",concentrationM:.1});
realBench=lab.addLabVessel(realBench,"burette");
const burette=realBench.vessels.find(v=>v.kind==="burette");
assert.ok(burette);
realBench=lab.putLabReagent(realBench,burette.id,"NaOH",
 {value:30,unit:"ml",concentrationM:.1});
realBench=lab.setLabIndicator(realBench,"v1","phenolphthalein");
assert.equal(lab.labTitrationTargets(realBench,burette.id).length,1);
assert.equal(lab.dripLabVessel(realBench,"v1",burette.id,1),realBench,
 "Drops cannot flow backwards from the target flask");
realBench=lab.dripLabVessel(realBench,burette.id,"v1",1);
assert.equal(realBench.titration?.addedMl,1);
assert.equal(realBench.vessels.find(v=>v.id===burette.id)?.doses?.NaOH.value,29);
assert.equal(realBench.vessels.find(v=>v.id==="v1")?.doses?.NaOH.value,1);
assert.equal(realBench.titrationPair?.targetId,"v1");
realBench=lab.dripLabVessel(realBench,burette.id,"v1",24);
assert.equal(titration.titrationReading(realBench.titration).pH,7,
 "At 25 ml of 0.1 M NaOH the 25 ml of 0.1 M acid reaches equivalence");
assert.equal(realBench.vessels.find(v=>v.id===burette.id)?.doses?.NaOH.value,5);
realBench=lab.dripLabVessel(realBench,burette.id,"v1",.1);
assert.ok(titration.titrationReading(realBench.titration).pH>7);
const drainedTarget=lab.emptyLabVessel(realBench,"v1");
assert.equal(drainedTarget.titrationPair,undefined,
 "Pouring out a titrated sample ends the vessel-linked titration");
const icons=read("src/LektrusLabGlasswareIcon.tsx");
for(const kind of lab.labGlassware)assert.match(icons,new RegExp("^\\s*"+kind.id+":","m"),
 "Each glassware type has an independent vector pictogram");
assert.match(read("src/lektrusSciencePresets.ts"),/width:1660,height:1060/,
 "New chemistry benches must have sufficient tabletop space");
// Physical device inventory, duplicate tools, positions and cleanup.
let equipment=detailedBench();
equipment=lab.addPlacedLabDevice(equipment,"hotplate");
equipment=lab.addPlacedLabDevice(equipment,"stirrer");
equipment=lab.addPlacedLabDevice(equipment,"hotplate");
assert.equal(lab.placedLabDevices(equipment).length,3);
assert.equal(equipment.devices.length,2);
const firstDevice=lab.placedLabDevices(equipment)[0];
equipment=lab.movePlacedLabDevice(equipment,firstDevice.id,59,67);
assert.equal(equipment.placedDevices[0].x,59);
assert.equal(equipment.placedDevices[0].y,67);
equipment=lab.applyPlacedLabDevice(equipment,firstDevice.id,"v1");
assert.equal(equipment.placedDevices[0].active,true);
assert.equal(equipment.placedDevices[0].powered,false,
 "Mounting a flask must not start the hotplate automatically");
equipment=lab.setPlacedDevicePower(equipment,firstDevice.id,true);
assert.equal(equipment.placedDevices[0].powered,true,
 "A separate power switch turns on the hotplate");
equipment=lab.advanceLabSimulation(equipment,1000);
equipment=lab.advanceLabSimulation(equipment,5000);
assert.ok(equipment.placedDevices[0].temperatureC>22,
 "Hotplate temperature rises gradually when powered on");
assert.ok(equipment.vessels[0].temperatureC>22,
 "Mounted glassware warms according to modelled thermal transfer");
assert.equal(equipment.placedDevices[0].linkedVesselId,"v1");
equipment=lab.stopPlacedLabDevice(equipment,firstDevice.id);
assert.equal(equipment.placedDevices[0].active,false);
assert.equal(equipment.placedDevices[0].powered,true,
 "Removing a vessel must not turn off the heater");
equipment=lab.returnPlacedLabDevice(equipment,firstDevice.id);
assert.equal(equipment.placedDevices.length,2);
assert.equal(equipment.devices.includes("hotplate"),true,
 "Storing a plate must not remove its second copy");
equipment=lab.returnPlacedLabDevice(equipment,lab.placedLabDevices(equipment).find(d=>d.kind==="hotplate").id);
assert.equal(equipment.devices.includes("hotplate"),false);
let thermostat=lab.addPlacedLabDevice(detailedBench(),"hotplate");
const thermostatId=lab.placedLabDevices(thermostat)[0].id;
thermostat=lab.setLabHotplateTemperature(thermostat,thermostatId,185);
assert.equal(lab.placedLabDevices(thermostat)[0].targetTemperatureC,185);
assert.equal(lab.setLabHotplateTemperature(thermostat,thermostatId,900).placedDevices[0].targetTemperatureC,900);
thermostat=lab.setPlacedDevicePower(thermostat,thermostatId,true);
thermostat=lab.movePlacedLabDevice(thermostat,thermostatId,50,66);
assert.equal(thermostat.placedDevices[0].powered,true,"Moving a heater must preserve its power");
let adjustable=lab.addPlacedLabDevice(detailedBench(),"tripod");
const standForShelf=lab.placedLabDevices(adjustable)[0].id;
adjustable=lab.setLabStandHeight(adjustable,standForShelf,.8);
assert.equal(adjustable.placedDevices[0].standHeight,.8);
adjustable=lab.addLabVessel(adjustable,"conical");
adjustable=lab.applyPlacedLabDevice(adjustable,standForShelf,"v1");
const clampStand=lab.placedLabDevices(adjustable)[0];
const highGrip=labLayout.labMountedGlasswarePoint(clampStand,
 adjustable.vessels.find(v=>v.id==="v1"),1600,1000);
assert.ok(highGrip.y<clampStand.y,
 "Glassware must attach at the raised clamp instead of underneath the stand");
const loweredStand={...clampStand,standHeight:0};
const raisedStand={...clampStand,standHeight:1};
const lowGrip=labLayout.labMountedGlasswarePoint(loweredStand,
 adjustable.vessels.find(v=>v.id==="v1"),1600,1000);
const upperGrip=labLayout.labMountedGlasswarePoint(raisedStand,
 adjustable.vessels.find(v=>v.id==="v1"),1600,1000);
assert.ok(upperGrip.y<lowGrip.y-8,
 "The 0–100% clamp travel must lift glassware a visible distance");
assert.equal(labLayout.labStandClampSvgY(1),12);
assert.equal(labLayout.labStandClampSvgY(0),61);
assert.ok(highGrip.x>clampStand.x,
 "Held glassware must be located beside the rod at its clamp");
adjustable=lab.setLabStandShelf(adjustable,standForShelf,"v2");
assert.equal(adjustable.placedDevices[0].linkedVesselId,"v2",
 "Old shelf calls must use the only clamp rather than adding a second support");
assert.equal(adjustable.placedDevices[0].shelfVesselId,undefined);
assert.equal(lab.LAB_STAND_SHELF_TYPES.includes("tube"),false);
adjustable=lab.positionLabVessel(adjustable,"v2",45,75);
assert.equal(adjustable.placedDevices[0].linkedVesselId,undefined);
const dualHolder=lab.placedLabDevices({...adjustable,placedDevices:[
 {...adjustable.placedDevices[0],active:true,linkedVesselId:"v1",shelfVesselId:"v2"}]});
assert.equal(dualHolder[0].linkedVesselId,"v1");
assert.equal(dualHolder[0].shelfVesselId,undefined,
 "Old two-holder stands must normalize to a single retort clamp");
// Independently placed heater and mixer can occupy the tabletop directly
// under ONE suspended vessel without overwriting its stand attachment.
let suspended=lab.addPlacedLabDevice(detailedBench(),"tripod",{x:40,y:68});
const suspendedStand=lab.placedLabDevices(suspended)[0].id;
suspended=lab.setLabStandHeight(suspended,suspendedStand,.25);
suspended=lab.applyPlacedLabDevice(suspended,suspendedStand,"v1");
suspended=lab.putLabReagent(suspended,"v1","H2O",{value:40,unit:"ml"});
suspended=lab.addLabVessel(suspended,"conical",{x:48,y:69});
const lowerReceiver=suspended.vessels.find(v=>v.kind==="conical").id;
assert.equal(lab.labReceiverBelowStand(suspended,"v1")?.id,lowerReceiver,
 "Gravity transfer locates glassware on the tabletop below the upper clamp");
suspended=lab.addPlacedLabDevice(suspended,"hotplate",{x:43.5,y:78});
const underHeater=lab.placedLabDevices(suspended).find(d=>d.kind==="hotplate").id;
assert.equal(lab.placedLabDevices(suspended).find(d=>d.id===underHeater).linkedVesselId,undefined,
 "A heater may be placed freely below the stand, not physically in its clamp");
assert.ok(lab.labAppliancesBelowStand(suspended,"v1").some(d=>d.id===underHeater));
suspended=lab.setPlacedDevicePower(suspended,underHeater,true);
suspended=lab.advanceLabSimulation(suspended,1000);
suspended=lab.advanceLabSimulation(suspended,11000);
assert.ok(suspended.vessels.find(v=>v.id==="v1").temperatureC>22,
 "An energized heater beneath the low clamp warms the suspended glassware");
suspended=lab.setLabStandHeight(suspended,suspendedStand,.95);
assert.equal(lab.labAppliancesBelowStand(suspended,"v1").some(d=>d.id===underHeater),false,
 "Raising glassware high removes thermal contact with the heating plate");
suspended=lab.setLabStandHeight(suspended,suspendedStand,.25);
suspended=lab.addPlacedLabDevice(suspended,"stirrer",{x:43.5,y:78});
const underMixer=lab.placedLabDevices(suspended).find(d=>d.kind==="stirrer").id;
suspended=lab.setPlacedDevicePower(suspended,underMixer,true);
assert.ok(lab.labAppliancesBelowStand(suspended,"v1").some(d=>d.id===underMixer&&d.powered),
 "The magnetic stirrer beneath a lowered vessel has visual contact");
suspended=lab.startLabPour(suspended,"v1",lowerReceiver,"stand-gravity-flow");
assert.equal(suspended.pouring.sourceId,"v1");
assert.equal(suspended.pouring.targetId,lowerReceiver);
suspended=lab.advanceLabPour(suspended);
assert.ok(suspended.vessels.find(v=>v.id===lowerReceiver).doses.H2O.value>0,
 "Tipping suspended glassware transfers measured liquid in aliquots");
let suspendedBurette=lab.addPlacedLabDevice(detailedBench(),"tripod",{x:40,y:68});
const buretteStand=lab.placedLabDevices(suspendedBurette)[0].id;
suspendedBurette=lab.addLabVessel(suspendedBurette,"burette");
const upperBurette=suspendedBurette.vessels.find(v=>v.kind==="burette").id;
suspendedBurette=lab.applyPlacedLabDevice(suspendedBurette,buretteStand,upperBurette);
suspendedBurette=lab.positionLabVessel(suspendedBurette,"v1",48,69);
suspendedBurette=lab.putLabReagent(suspendedBurette,upperBurette,"HCl",{value:10,unit:"ml"});
assert.equal(lab.labReceiverBelowStand(suspendedBurette,upperBurette)?.id,"v1");
suspendedBurette=lab.setLabBuretteValve(suspendedBurette,upperBurette,true);
assert.equal(suspendedBurette.vessels.find(v=>v.id===upperBurette).buretteTargetId,"v1",
 "An opened burette above a vessel chooses its physical receiver");
suspendedBurette=lab.advanceLabSimulation(suspendedBurette,1000);
suspendedBurette=lab.advanceLabSimulation(suspendedBurette,5000);
assert.ok((suspendedBurette.vessels.find(v=>v.id==="v1").doses?.HCl?.value??0)>0,
 "The lower vessel accumulates burette drops through live simulation");

const migrated=lab.placedLabDevices({...detailedBench(),devices:["burner","stirrer"]});
assert.equal(migrated.length,2,"Previously saved laboratory devices must remain visible");
assert.notEqual(migrated[0].id,migrated[1].id);
const beforeConcurrent=detailedBench();
const peerPlate=lab.addPlacedLabDevice(beforeConcurrent,"hotplate");
const peerMixer=lab.addPlacedLabDevice(beforeConcurrent,"stirrer");
const joined=lab.mergeLabBench(beforeConcurrent,peerPlate,peerMixer);
assert.equal(lab.placedLabDevices(joined).length,2,
 "Concurrent peers putting different devices on one table must both survive");
assert.equal(new Set(lab.placedLabDevices(joined).map(d=>d.id)).size,2);
let decant=detailedBench();
decant=lab.putLabReagent(decant,"v1","HCl",
 {value:10,unit:"ml",concentrationM:.1});
decant=lab.addLabVessel(decant,"beaker");
decant=lab.putLabReagent(decant,"v2","HCl",
 {value:20,unit:"ml",concentrationM:.3});
decant=lab.pourLabVessel(decant,"v1","v2");
assert.equal(decant.vessels.find(v=>v.id==="v2").doses.HCl.value,30);
assert.ok(Math.abs(decant.vessels.find(v=>v.id==="v2").doses.HCl.concentrationM-
 (10*.1+20*.3)/30)<.00001,
 "Same-solute concentrations must be volume-weighted during decanting");
assert.equal(decant.vessels.find(v=>v.id==="v1").reagents.length,0);
assert.equal(lab.labDevices.length,6);
assert.ok(lab.labDevices.some(d=>d.id==="filter"),"Filtration uses a physical membrane-filter cartridge");
assert.ok(!lab.labDevices.some(d=>d.id==="thermometer"));
assert.equal(lab.canMountLabVessel("hotplate","beaker"),true);
assert.equal(lab.canMountLabVessel("hotplate","tube"),false);
assert.equal(lab.canMountLabVessel("hotplate","flask"),false,
 "A round-bottom flask needs support instead of a flat heater");
assert.equal(lab.canMountLabVessel("stirrer","flask"),false);
assert.equal(lab.canMountLabVessel("burner","tube"),true);
assert.equal(lab.canMountLabVessel("stirrer","conical"),true);
assert.equal(lab.canMountLabVessel("tripod","burette"),true);
assert.equal(lab.canMountLabVessel("tripod","cylinder"),false);
assert.equal(lab.canMountLabVessel("hotplate","beaker"),true,
 "A flat-bottom beaker must sit on the hotplate");
assert.equal(lab.canMountLabVessel("hotplate","conical"),true);
assert.equal(lab.canMountLabVessel("hotplate","cylinder"),false);
assert.equal(lab.canMountLabVessel("hotplate","volumetric"),false);
assert.equal(lab.canMountLabVessel("hotplate","burette"),false);
assert.equal(lab.canMountLabVessel("stirrer","beaker"),true);
assert.equal(lab.canMountLabVessel("stirrer","dish"),false);
assert.equal(lab.canMountLabVessel("stirrer","tube"),false);
assert.equal(lab.labGlassware.some(v=>v.id==="funnel"),false);
assert.equal(lab.canMountLabVessel("tripod","pipette"),true);
assert.equal(lab.canMountLabVessel("tripod","crucible"),true);
assert.equal(lab.canMountLabVessel("burner","dish"),true);
for(const device of lab.labDevices)
 assert.equal(lab.canMountLabVessel(device.id,"cylinder"),false);
let combinedSupport=detailedBench();
combinedSupport=lab.addPlacedLabDevice(combinedSupport,"tripod");
combinedSupport=lab.addPlacedLabDevice(combinedSupport,"burner");
const standId=lab.placedLabDevices(combinedSupport).find(d=>d.kind==="tripod").id;
const flameId=lab.placedLabDevices(combinedSupport).find(d=>d.kind==="burner").id;
combinedSupport=lab.applyPlacedLabDevice(combinedSupport,standId,"v1");
combinedSupport=lab.applyPlacedLabDevice(combinedSupport,flameId,"v1");
assert.equal(lab.placedLabDevices(combinedSupport)
 .filter(d=>d.linkedVesselId==="v1").length,2,
 "The retort stand and burner must work with the same vessel");
const supportPlate=lab.placedLabDevices(combinedSupport).find(d=>d.id===standId);
const supportFlame=lab.placedLabDevices(combinedSupport).find(d=>d.id===flameId);
assert.ok(supportFlame.y>supportPlate.y&&Math.abs(supportFlame.x-supportPlate.x)<5,
 "Burner must sit below the stand clamp, not heat glassware from across the table");

combinedSupport=lab.setPlacedDevicePower(combinedSupport,flameId,true);
combinedSupport=lab.positionLabVessel(combinedSupport,"v1",64,72);
assert.equal(lab.placedLabDevices(combinedSupport)
 .filter(d=>d.linkedVesselId==="v1").length,0,
 "Moving a vessel disconnects support and heater");
assert.equal(lab.placedLabDevices(combinedSupport)
 .find(d=>d.id===flameId).powered,true,
 "Removing glassware does not magically extinguish a burner");
let freeMixer=lab.addPlacedLabDevice(detailedBench(),"stirrer");
const freeMixerId=lab.placedLabDevices(freeMixer)[0].id;
freeMixer=lab.setPlacedDevicePower(freeMixer,freeMixerId,true);
assert.equal(lab.placedLabDevices(freeMixer)[0].powered,true,
 "A mixer may be switched on without a mounted vessel");
assert.equal(freeMixer.stirringVesselId,undefined);
assert.match(read("src/lektrusChemistryBench.css"),
 /\.lektrus-lab-placed-device\.is-selected>\.lektrus-lab-device-icon/,
 "Selection must outline the apparatus silhouette, not a rectangular tile");

let valve=detailedBench();
valve=lab.addLabVessel(valve,"burette");
const valveSource=valve.vessels.find(v=>v.kind==="burette");
valve=lab.putLabReagent(valve,valveSource.id,"NaOH",
 {unit:"ml",value:30,concentrationM:.1});
valve=lab.putLabReagent(valve,"v1","HCl",
 {unit:"ml",value:25,concentrationM:.1});
valve=lab.setLabBuretteValve(valve,valveSource.id,true,"v1",.2);
assert.equal(valve.vessels.find(v=>v.id===valveSource.id).buretteOpen,true);
valve=lab.advanceLabSimulation(valve,1000);
valve=lab.advanceLabSimulation(valve,6000);
assert.ok(valve.titration?.addedMl>=.9&&valve.titration?.addedMl<=1.1);
assert.ok(valve.vessels.find(v=>v.id===valveSource.id).doses.NaOH.value<30);
valve=lab.setLabBuretteValve(valve,valveSource.id,false);
assert.equal(valve.vessels.find(v=>v.id===valveSource.id).buretteOpen,false);
assert.equal(lab.setLabBuretteValve(valve,valveSource.id,true,"v1",44),valve,
 "Unsupported flow rates cannot be selected");
let preheated=detailedBench();
preheated=lab.addPlacedLabDevice(preheated,"hotplate");
const heaterId=lab.placedLabDevices(preheated)[0].id;
preheated=lab.setPlacedDevicePower(preheated,heaterId,true);
assert.equal(preheated.placedDevices[0].powered,true);
preheated=lab.applyPlacedLabDevice(preheated,heaterId,"v1");
assert.equal(preheated.placedDevices[0].powered,true,
 "Putting a beaker onto a powered heater must keep the heater on");
preheated=lab.advanceLabSimulation(preheated,1000);
preheated=lab.advanceLabSimulation(preheated,8000);
assert.ok(preheated.vessels[0].temperatureC>22);
preheated=lab.setPlacedDevicePower(preheated,heaterId,false);
const beforeCool=preheated.vessels[0].temperatureC;
preheated=lab.advanceLabSimulation(preheated,18000);
assert.ok(preheated.vessels[0].temperatureC<beforeCool,
 "Vessel temperature should cool gradually after the appliance is switched off");
let carbonate=detailedBench();
carbonate=lab.putLabReagent(carbonate,"v1","CaCO3",{value:5,unit:"g"});
carbonate=lab.setLabEnvironment(carbonate,"v1","dry");
carbonate=lab.addPlacedLabDevice(carbonate,"hotplate");
const calcinerId=lab.placedLabDevices(carbonate)[0].id;
carbonate=lab.applyPlacedLabDevice(carbonate,calcinerId,"v1");
carbonate=lab.setPlacedDevicePower(carbonate,calcinerId,true);
carbonate=lab.advanceLabSimulation(carbonate,1000);
for(let i=1;i<=80;i++)carbonate=lab.advanceLabSimulation(carbonate,1000+i*10000);
assert.notEqual(lab.labObservation(carbonate.vessels[0]).status,"reaction",
 "Carbonate calcination should not be faked on a low-temperature hotplate");
assert.match(read("src/LektrusChemistryBench.tsx"),/setPlacedDevicePower/);
assert.match(read("src/LektrusChemistryBench.tsx"),/setLabBuretteValve/);
assert.match(read("src/LektrusChemistryBench.tsx"),/lektrus-lab-ware-engraving/);
const base=detailedBench();
const left=lab.putLabReagent(base,"v1","HCl");
const right=lab.addLabVessel(base,"flask");
const merged=lab.mergeLabBench(base,left,right);
assert.ok(merged.vessels.some(v=>v.kind==="flask"),"Peer added glassware survives");
assert.ok(merged.vessels.some(v=>v.reagents.includes("HCl")),"Local reagent addition survives");
assert.deepEqual(lab.readLabBench({scienceReagents:["NaCl"],scienceEnvironment:"aqueous",
 scienceExperimentStage:0}).vessels[0].reagents,["NaCl"],"Older experiment data migrate");
for(const p of ["src/LektrusChemistryBench.tsx","src/LektrusChemistryBenchEditor.tsx",
 "src/LektrusScienceEditor.tsx","src/LektrusChemistryIllustration.tsx",
  "src/LektrusLabGlasswareIcon.tsx"]){
 const source=ts.createSourceFile(p,read(p),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
 assert.equal(source.parseDiagnostics.length,0,p+" has invalid TSX");
}
const editor=read("src/LektrusChemistryBenchEditor.tsx");
assert.match(editor,/onPour=\{pour\}/);
assert.match(editor,/onDropReagent=\{addReagent\}/);
assert.match(read("src/LektrusChemistryBench.tsx"),/addLabVessel/);
assert.match(editor,/is-board-identical/,"Fullscreen is the actual board-stage surface");
assert.match(read("src/LektrusChemistryBench.tsx"),/lektrus-lab-modal-reagents/);
assert.match(read("src/LektrusChemistryBench.tsx"),/lektrus-lab-glass-cupboard/);
assert.match(read("src/LektrusChemistryBench.tsx"),/lektrus-lab-sink/);
assert.match(read("src/LektrusChemistryBench.tsx"),/lektrus-lab-chalkboard/);
assert.doesNotMatch(read("src/LektrusChemistryBench.tsx"),/lektrus-lab-modal-settings/);
assert.doesNotMatch(editor,/lektrus-lab-inspector/,"No separate observation/sidebar in fullscreen");
assert.doesNotMatch(editor,/lektrus-lab-editor-head/,"No additional lab header");
assert.match(editor,/lektrus-lab-editor-exit/,"Only a compact close control remains");
const app=read("src/App.tsx");
assert.match(app,/liveChemistryBenchUpdate/);
assert.match(app,/mergeLabBench\(/);
assert.match(app,/onExperimentLiveChange=\{/);
assert.match(app,/onLabBenchChange=\{/,"On-board glassware can be moved without reopening the editor");
assert.match(read("src/LektrusChemistryIllustration.tsx"),/editable=\{!!onBenchChange\}/,
 "On-board chemistry table enables direct vessel interaction when permitted");
assert.match(read("src/LektrusChemistryBench.tsx"),/targetAt\(/,
 "Dragging a filled vessel over another triggers the transfer target");
assert.match(read("src/LektrusChemistryIllustration.tsx"),/onPour=\{onBenchChange\?pour:undefined\}/,
 "On-board laboratory can pour mixtures without opening an editor");
assert.doesNotMatch(read("src/LektrusChemistryIllustration.tsx"),/lektrus-lab-board-controls/,
 "The old bottom toolbar must not overlay the interactive bench");
assert.match(read("src/LektrusChemistryBench.tsx"),/data-board-interactive="true"/,
 "Glassware gestures do not drag the surrounding board object");
assert.match(read("src/lektrusSciencePresets.ts"),/x:x-830,y:y-530,text:""/,
 "Bench must be centered under the insertion cursor");

// The visual stage is scrollable for old boards without clipping apparatus.
const subjectInsertion=read("src/App.tsx");
assert.match(subjectInsertion,/if\(id==="chem-experiments"\)\{/,
 "The subject tool should create a laboratory directly on the board");
assert.match(subjectInsertion,/commit\(\[\.\.\.itemsRef\.current,item\]\)/,
 "The new laboratory must be saved as a board object");
assert.match(subjectInsertion,/setSelected\(\[item\.id\]\)/,
 "Newly created laboratory must be selected for resize and movement");
assert.match(subjectInsertion,/if\(item\.graphFigureId==="chem-experiment-free"\)/,
 "The object edit command opens the shared fullscreen laboratory");
assert.match(read("src/LektrusScienceEditor.tsx"),/import LektrusChemistryBenchEditor/,
 "The shared fullscreen laboratory editor is now connected");
assert.doesNotMatch(read("src/LektrusChemistryBench.tsx"),/lektrus-lab-journal-trigger/,
 "There must be no button reopening the obsolete dialog");
const boardLaboratory=read("src/LektrusChemistryIllustration.tsx");
const editorLaboratory=read("src/LektrusChemistryBenchEditor.tsx");
assert.doesNotMatch(boardLaboratory,/>Химический стол\s*<\/div>/,
 "The chemical lab no longer shows a protruding title strip");
assert.doesNotMatch(boardLaboratory,/className="lektrus-chemistry-bench-on-board"[^>]*data-board-interactive/,
 "The object wrapper must not suppress the board's normal transform gestures");

const hugeLabCss=read("src/lektrusChemistryBench.css");
assert.match(boardLaboratory,/className="lektrus-chemistry-bench-on-board"[\s\S]*?onWheel=\{e=>e\.stopPropagation\(\)\}/,
 "Scrolling inside the board lab must not zoom the board");
assert.match(editorLaboratory,/ref=\{viewport\} className="lektrus-lab-editor-bench-viewport"/,
 "The fullscreen editing viewport fills the window with no vertical scroll");
assert.match(hugeLabCss,/lektrus-chemistry-bench-on-board\{[\s\S]*?overflow:auto!important/,
 "The board lab viewport must allow scrolling");
assert.match(hugeLabCss,/lektrus-lab-fit-stage>\.lektrus-lab-bench/,
 "The laboratory stage uses its computed width rather than fixed side gutters");
assert.match(hugeLabCss,/grid-template-columns:repeat\(4,minmax\(0,1fr\)\)!important/,
 "All 11 vessel cards must fit in a four-column shelf");
assert.match(hugeLabCss,/grid-template-rows:repeat\(3,minmax\(0,1fr\)\)!important/,
 "The vessel shelf must display all glassware in three rows");
assert.match(hugeLabCss,/overflow:visible!important;touch-action:manipulation!important/,
 "Glassware cupboard must not rely on scrollbars");
const deviceIcons=read("src/LektrusLabDeviceIcon.tsx");
for(const device of lab.labDevices){
 assert.match(deviceIcons,new RegExp('kind==="'+device.id+'"'),
  "Each lab device requires a distinct SVG icon: "+device.name);
}
assert.match(read("src/LektrusChemistryBench.tsx"),/LektrusLabDeviceIcon/);
assert.doesNotMatch(deviceIcons,/>LEKTRUS<\//,
 "Physical SVG model must contain the heater and mixer switch");
assert.doesNotMatch(deviceIcons,/lektrus-lab-device-integrated-controls/,
 "Attachment controls must be embedded in the SVG model");
assert.doesNotMatch(read("src/LektrusChemistryBench.tsx"),
 /\{editable&&activeDevice&&<div className="lektrus-lab-device-actions"/,
 "Blocking top equipment panel must be removed from the DOM");
assert.match(read("src/LektrusChemistryBench.tsx"),/lektrus-lab-ware-engraving/,
 "Container contents and observation must be printed into the glassware");
assert.match(read("src/LektrusChemistryBench.tsx"),/lektrus-lab-retort-jaws/,
 "Physical clamps must appear over the mounted glassware");
assert.match(read("src/lektrusLabLayout.ts"),/labMountedGlasswarePoint/,
 "Responsive appliance anchors must be shared with both models and rendering");

assert.doesNotMatch(read("src/LektrusChemistryBench.tsx"),
 /className=\{"lektrus-lab-device-art/,
 "The installed tools must no longer render placeholder text glyphs");
const fixedLayout=read("src/lektrusChemistryBench.css");
assert.match(fixedLayout,/\.lektrus-lab-bench \.lektrus-lab-placed-device\{/,
 "Each tool must be an individually positioned tabletop object");
assert.match(fixedLayout,/\.lektrus-lab-bench \.lektrus-lab-installed-devices\{display:none!important\}/,
 "Old overlay device dock must be permanently removed");
assert.match(fixedLayout,/\.lektrus-lab-bench \.lektrus-lab-worktop-zone\{pointer-events:none!important\}/,
 "Decorative worktop must never intercept vessel touches");
assert.match(fixedLayout,/\.lektrus-lab-bench \.lektrus-lab-pour-hint\{[\s\S]*?bottom:10\.5%!important/,
 "Pour hint must stay on the tabletop and not hide under the front edge");
assert.match(read("src/LektrusChemistryBench.tsx"),/canMountLabVessel\(v\.device\.kind,vessel\.kind\)/,
 "Mounting is restricted to compatible vessel types at the point of contact");
const cabinetSurface=read("src/LektrusChemistryBench.tsx");
const cabinetCss=read("src/lektrusChemistryBench.css");
assert.match(cabinetSurface,/createPortal\(<div className=\{"lektrus-lab-furniture-modal is-"/,
 "Cabinet must be portalled above the board, independent of canvas scale");
assert.match(cabinetSurface,/document\.body\)\}/,
 "The cabinet portal must attach to document.body");
assert.match(cabinetSurface,/onWheel=\{e=>e\.stopPropagation\(\)\}/,
 "Wheel input inside the cabinet must not zoom the surrounding board");
assert.match(cabinetSurface,/onTouchMove=\{e=>e\.stopPropagation\(\)\}/,
 "Finger scrolling must stay within the cabinet");
assert.match(cabinetSurface,/scrollRef\.current\?\.scrollBy/,
 "Mouse users need scroll controls in addition to the scrollbar");
assert.match(cabinetSurface,/role="region" tabIndex=\{0\}/,
 "Scrollable catalogue must support keyboard navigation");
assert.match(cabinetSurface,/lektrus-lab-modal-results-head/,
 "Cabinet shows filtered result count and scroll help");
assert.match(cabinetSurface,/lektrus-lab-sink-art/,
 "A real faucet and washbasin replace the circular placeholder");
assert.doesNotMatch(cabinetSurface,/lektrus-lab-sink-basin"[^\n]*>◉/,
 "Old circular sink glyph must not return");
assert.match(cabinetCss,/\.lektrus-lab-furniture-modal\{\s*position:fixed!important/,
 "Catalog must have full-viewport positioning");
assert.match(cabinetCss,/overflow-y:auto!important/,
 "Substance grid must have native wheel/touch scrolling");
assert.match(cabinetCss,/touch-action:pan-y/,
 "Touch users must be able to drag-scroll through substances");
assert.match(cabinetCss,/@container\(max-width:380px\)/,
 "Furniture must adapt to the actual board-object width");
const model=read("src/boardModel.ts");
assert.match(model,/"scienceLabBench"/);
assert.match(model,/Повреждено состояние химического стола/);
assert.match(read("src/main.tsx"),/lektrusChemistryBench\.css/);
assert.match(read("src/lektrusChemistryBench.css"),/prefers-reduced-motion:reduce/);
// Every glassware silhouette must be an actionable shared bench object,
// and special calibrated instruments have bounded physical behaviour.
for(const glass of lab.labGlassware){
 let b=lab.addLabVessel(detailedBench(),glass.id);
 const vessel=b.vessels.find(v=>v.kind===glass.id);
 assert.ok(vessel,"Can add "+glass.name);
 const dry=glass.id==="crucible";
 const reagent=dry?"NaCl":"H2O";
 b=lab.putLabReagent(b,vessel.id,reagent,
  {value:5,unit:dry?"g":"ml"});
 assert.ok(b.vessels.find(v=>v.id===vessel.id).reagents.includes(reagent),
  glass.name+" must accept material appropriate to its lab function");
 assert.ok(lab.labObservation(b.vessels.find(v=>v.id===vessel.id)).message);
}
let calibrated=lab.addLabVessel(detailedBench(),"pipette");
const pipetteId=calibrated.vessels.find(v=>v.kind==="pipette").id;
calibrated=lab.putLabReagent(calibrated,"v1","HCl",{value:40,unit:"ml",concentrationM:.1});
assert.equal(lab.putLabReagent(calibrated,pipetteId,"HCl",
 {value:30,unit:"ml",concentrationM:.1}),calibrated,
 "A 25 ml pipette cannot hold 30 ml");
calibrated=lab.transferLabMeasuredLiquid(calibrated,"v1",pipetteId,10);
assert.equal(calibrated.vessels.find(v=>v.id===pipetteId).doses.HCl.value,10);
assert.equal(calibrated.vessels.find(v=>v.id==="v1").doses.HCl.value,30);
calibrated=lab.addLabVessel(calibrated,"beaker");
const receivingBeakerId=calibrated.vessels.filter(v=>v.kind==="beaker").at(-1).id;
calibrated=lab.transferLabMeasuredLiquid(calibrated,pipetteId,receivingBeakerId,4);
assert.equal(calibrated.vessels.find(v=>v.id===pipetteId).doses.HCl.value,6);
assert.equal(calibrated.vessels.find(v=>v.id===receivingBeakerId).doses.HCl.value,4);
assert.equal(calibrated.vessels.find(v=>v.id===receivingBeakerId).doses.HCl.concentrationM,.1);
assert.equal(lab.transferLabMeasuredLiquid(calibrated,pipetteId,receivingBeakerId,50),calibrated);
assert.equal(lab.addLabVessel(calibrated,"cylinder"),calibrated);
assert.equal(lab.addLabVessel(calibrated,"volumetric"),calibrated);
// Retired funnel is no longer a supported lab object, including on old boards.
const legacyMeasured=lab.readLabBench({scienceLabBench:{
 ...detailedBench(),vessels:[...detailedBench().vessels,
 {id:"old-cylinder",kind:"cylinder",x:20,y:30,reagents:[],environment:"aqueous",observed:false},
 {id:"old-volumetric",kind:"volumetric",x:30,y:30,reagents:[],environment:"aqueous",observed:false}]
}});
assert.equal(legacyMeasured.vessels.filter(v=>["cylinder","volumetric"].includes(v.kind)).length,2,
 "Older saved boards must preserve retired vessel objects without data loss");
const legacyFunnel=lab.readLabBench({scienceLabBench:{
 ...detailedBench(),vessels:[...detailedBench().vessels,
 {id:"legacy-funnel",kind:"funnel",x:20,y:30,reagents:[],environment:"dry",observed:false}]
}});
assert.ok(!legacyFunnel.vessels.some(v=>v.kind==="funnel"));
assert.doesNotMatch(read("src/LektrusLabGlasswareIcon.tsx"),/funnel:/);
assert.doesNotMatch(read("src/LektrusChemistryBench.tsx"),/funnel:/);
assert.doesNotMatch(read("src/lektrusChemistryBenchModel.ts"),/pourThroughLabFunnel/);

// A pipette takes the EXACT requested portion, never an arbitrary 5 ml.
let measured=lab.addLabVessel(detailedBench(),"pipette");
const precisePipette=measured.vessels.find(v=>v.kind==="pipette").id;
measured=lab.setLabPipetteTarget(measured,precisePipette,7.5);
assert.equal(measured.vessels.find(v=>v.id===precisePipette).pipetteTargetMl,7.5);
measured=lab.putLabReagent(measured,"v1","HCl",{value:11,unit:"ml"});
assert.equal(lab.transferLabMeasuredLiquid(measured,"v1",precisePipette,12),measured);
measured=lab.transferLabMeasuredLiquid(measured,"v1",precisePipette,7.5);
assert.equal(measured.vessels.find(v=>v.id===precisePipette).doses.HCl.value,7.5);
assert.equal(measured.vessels.find(v=>v.id==="v1").doses.HCl.value,3.5);
assert.equal(lab.labVesselQuantity(measured.vessels.find(v=>v.id===precisePipette)).volumeMl,7.5);
assert.ok(lab.labVesselQuantity(measured.vessels.find(v=>v.id===precisePipette)).liquidFraction>0);
const solidSample=lab.putLabReagent(detailedBench(),"v1","NaCl",{value:12,unit:"g"});
assert.equal(lab.labVesselQuantity(solidSample.vessels[0]).massG,12);
assert.equal(lab.labVesselQuantity(solidSample.vessels[0]).volumeMl,0);
assert.ok(lab.labVesselQuantity(solidSample.vessels[0]).solidFraction>0);
// Exact pipette sampling from multicomponent solutions is atomic. Rounding
// cannot create a negative aliquot or list a component that did not transfer.
let diluteSample=detailedBench();
for(const id of ["NaCl","KCl","NaNO3"])
 diluteSample=lab.putLabReagent(diluteSample,"v1",id,{value:10,unit:"ml"});
diluteSample=lab.addLabVessel(diluteSample,"pipette");
const samplePipette=diluteSample.vessels.find(v=>v.kind==="pipette").id;
const sampleBefore=lab.labVesselQuantity(diluteSample.vessels.find(v=>v.id==="v1"));
diluteSample=lab.transferLabMeasuredLiquid(diluteSample,"v1",samplePipette,.01);
const sampled=diluteSample.vessels.find(v=>v.id===samplePipette);
assert.equal(lab.labVesselQuantity(sampled).volumeMl,.01);
assert.equal(sampled.reagents.length,1,
 "A trace rounded to zero must not materialize as an extra solute");
assert.ok(Object.values(sampled.doses).every(d=>d.value>0));
assert.equal(lab.labVesselQuantity(diluteSample.vessels.find(v=>v.id==="v1")).volumeMl,
 sampleBefore.volumeMl-.01);
assert.equal(lab.transferLabMeasuredLiquid(diluteSample,"v1",samplePipette,.005),diluteSample,
 "Sub-centimilliliter volumes cannot be sampled");
assert.equal(lab.transferLabMeasuredLiquid(diluteSample,"v1",samplePipette,50),diluteSample,
 "More than the donor has must never be withdrawn");
// Remote updates to the same shared laboratory must merge by stable IDs,
// not as position-based arrays.
const scienceEditor=read("src/LektrusScienceEditor.tsx");
assert.match(scienceEditor,/mergeLabBench\(/);
assert.match(scienceEditor,/onExperimentLiveChange\?\.\(draft,next,simulationOnly\)/,
 "The fullscreen chemistry editor forwards automatic simulation provenance");

const savedQuick=lab.defaultLabQuickReagents();
assert.ok(savedQuick.length>=8&&savedQuick.length<=lab.MAX_QUICK_REAGENTS);
let quickBench=detailedBench();
quickBench=lab.setLabQuickReagent(quickBench,"HCl",{value:25,unit:"ml",concentrationM:.5});
assert.equal(lab.labQuickReagents(quickBench).find(v=>v.id==="HCl").dose.value,25);
quickBench=lab.setLabQuickReagent(quickBench,"NaCl");
assert.ok(!lab.labQuickReagents(quickBench).some(v=>v.id==="NaCl"));
quickBench=lab.setLabBenchSettings(quickBench,{showTemperatures:false});
assert.equal(lab.labBenchSettings(quickBench).showTemperatures,false);
quickBench=lab.addPlacedLabDevice(quickBench,"hotplate");
quickBench=lab.clearLabTable(quickBench);
assert.equal(quickBench.vessels.length,0,"Clear table removes every vessel");
assert.equal(lab.placedLabDevices(quickBench).length,0,"Clear table removes equipment");
assert.equal(lab.labQuickReagents(quickBench).find(v=>v.id==="HCl").dose.value,25,
 "Clear table preserves custom quick bottles and their dosages");
assert.equal(lab.labBenchSettings(quickBench).showTemperatures,false);
assert.ok(lab.addLabVessel(quickBench,"tube").vessels.some(v=>v.kind==="tube"),
 "After a full clear the table accepts fresh glassware again");
const surface=read("src/LektrusChemistryBench.tsx");
assert.match(surface,/lektrus-lab-content-tag/);
assert.match(surface,/lektrus-lab-content-quantity/);
assert.match(surface,/lektrus-lab-temperature-toggle/);
assert.match(surface,/lektrus-lab-clear-worktop/);
assert.match(surface,/clearLabTable\(bench\)/);
assert.match(surface,/lektrus-lab-quick-editor/);
assert.match(surface,/setLabQuickReagent\(bench/);
assert.match(surface,/addQuick\(v\.id\)/);
assert.match(read("src/lektrusChemistryBenchModel.ts"),/labMeasuredCapacityMl/);
assert.match(surface,/transferLabMeasuredLiquid/);
assert.match(surface,/lektrus-lab-quantity-meter/);
assert.match(surface,/labReceiverBelowStand/);
assert.match(surface,/labAppliancesBelowStand/);
assert.match(read("src/LektrusChemistryIllustration.tsx"),/lektrus-lab-open-editor/);
assert.match(read("src/lektrusChemistryBench.css"),/width:100vw!important/);
assert.doesNotMatch(surface,/pourThroughLabFunnel/);
assert.ok(!lab.labGlassware.some(v=>v.id==="funnel"),"Funnel is no longer offered in inventory");
assert.doesNotMatch(surface,/fillLabVolumetricFlask/);
assert.doesNotMatch(surface,/onClick=\{e=>\{e\.stopPropagation\(\);if\(selected\?\.reagents\.length\)clean/,
 "The sink must never empty selected glassware merely because it was clicked");
assert.match(surface,/if\(inSink\(p\)\)clean\(g\.id\)/,
 "Only dropping an individual vessel into the sink triggers disposal");

// Stepwise pouring uses twenty fixed 5% portions, not exponential depletion.
assert.equal(lab.LAB_POUR_STEPS,20);
assert.equal(lab.LAB_POUR_INTERVAL_MS,150);
let gradual=lab.addLabVessel(detailedBench(),"conical");
gradual=lab.putLabReagent(gradual,"v1","HCl",{value:100,unit:"ml",concentrationM:.2});
gradual=lab.startLabPour(gradual,"v1","v2","gradual-pour-1");
assert.equal(gradual.pouring.step,0);
assert.equal(lab.startLabPour(gradual,"v1","v2","duplicate"),gradual,
 "One concurrent pour per laboratory table");
gradual=lab.advanceLabPour(gradual);
assert.equal(gradual.pouring.step,1);
assert.equal(gradual.vessels.find(v=>v.id==="v1").doses.HCl.value,95);
assert.equal(gradual.vessels.find(v=>v.id==="v2").doses.HCl.value,5);
assert.equal(gradual.vessels.find(v=>v.id==="v2").doses.HCl.concentrationM,.2);
assert.equal(lab.labPourPercent(gradual.pouring),5);
assert.equal(lab.labPourAmounts(gradual.pouring)[0].remaining,95);
for(let tick=2;tick<=10;tick++)gradual=lab.advanceLabPour(gradual);
assert.equal(gradual.vessels.find(v=>v.id==="v1").doses.HCl.value,50);
assert.equal(gradual.vessels.find(v=>v.id==="v2").doses.HCl.value,50);
assert.equal(lab.labPourPercent(gradual.pouring),50);
let interrupted=lab.stopLabPour(gradual,"gradual-pour-1");
assert.equal(interrupted.pouring,undefined,"Stop pouring must not discard the partially transferred liquid");
assert.equal(interrupted.vessels.find(v=>v.id==="v1").doses.HCl.value,50);
assert.equal(interrupted.vessels.find(v=>v.id==="v2").doses.HCl.value,50);
for(let tick=11;tick<=20;tick++)gradual=lab.advanceLabPour(gradual);
assert.equal(gradual.pouring.step,20);
assert.equal(gradual.vessels.find(v=>v.id==="v1").reagents.length,0);
assert.equal(gradual.vessels.find(v=>v.id==="v2").doses.HCl.value,100);
assert.equal(lab.advanceLabPour(gradual),gradual);
assert.equal(lab.labPourPercent(gradual.pouring),100);
gradual=lab.stopLabPour(gradual,"gradual-pour-1");
assert.equal(gradual.pouring,undefined);
let unknownGradual=lab.addLabVessel(detailedBench(),"tube");
unknownGradual=lab.putLabReagent(unknownGradual,"v1","H2O");
unknownGradual=lab.startLabPour(unknownGradual,"v1","v2","pour-without-fabricated-volume");
for(let tick=0;tick<10;tick++)unknownGradual=lab.advanceLabPour(unknownGradual);
assert.equal(unknownGradual.pouring.step,10);
assert.ok(unknownGradual.vessels.find(v=>v.id==="v1").reagents.includes("H2O"));
assert.equal(unknownGradual.vessels.find(v=>v.id==="v1").doses.H2O.value,5);
assert.equal(unknownGradual.vessels.find(v=>v.id==="v2").doses.H2O.value,5);
assert.deepEqual(lab.labPourAmounts(unknownGradual.pouring),
 [{id:"H2O",unit:"ml",transferred:5,remaining:5}],
 "The default measured water portion transfers exactly 5 of 10 ml");
assert.equal(unknownGradual.pouring.unmeasured,false);
let clearedMidPour=lab.clearLabTable(unknownGradual);
assert.equal(clearedMidPour.pouring,undefined);
const standIcon=read("src/LektrusLabDeviceIcon.tsx");
assert.match(standIcon,/V3/,"The rod must reach almost to the top of its SVG");
assert.match(standIcon,/labStandClampSvgY\(standHeight\)/);
assert.doesNotMatch(standIcon,/M49 65H70/,
 "The obsolete second lower holder must be absent");
const standUi=read("src/LektrusChemistryBench.tsx");
assert.match(standUi,/labStandClampSvgY\(p\.standHeight\)/,
 "Front jaws follow the same height as the rear clamp");
assert.match(standUi,/applyPlacedLabDevice\(bench,appliance\.device\.id,g\.id,"clamp"\)/,
 "Glassware drop must mount on the sole clamp");
assert.match(standUi,/lektrus-lab-burner-valve/);
assert.match(standUi,/Открыть газ и зажечь горелку/);
assert.match(standUi,/Перекрыть газ горелки/);
assert.doesNotMatch(standUi,/device\.kind==="burner"&&focused&&<button type="button"\s+className="lektrus-lab-device-power"/);
const heightCss=read("src/lektrusChemistryBench.css");
assert.match(heightCss,/height:clamp\(228px,19cqw,280px\)/);
assert.match(heightCss,/lektrus-lab-device-face-temp:focus-visible/);
assert.match(heightCss,/outline:none!important;outline-width:0!important/);
assert.match(heightCss,/lektrus-lab-burner-valve-lever/);
const gradualUi=read("src/LektrusChemistryBench.tsx");
assert.match(gradualUi,/startLabPour\(bench,sourceId,targetId,id\)/);
assert.match(gradualUi,/advanceLabPour\(current\)/);
assert.match(gradualUi,/LAB_POUR_INTERVAL_MS/);
assert.match(gradualUi,/lektrus-lab-pour-progress-amounts/);
assert.match(gradualUi,/Перелилось/);
assert.match(gradualUi,/Осталось/);
assert.match(gradualUi,/stopLabPour\(bench,p\.id\)/);

// Laboratory v10: hover triggers are timed and apparatus controls live on their bodies.
const hoverSurface=read("src/LektrusChemistryBench.tsx");
assert.match(hoverSurface,/contactTimer\.current=setTimeout/);
assert.match(hoverSurface,/const drawing=pipette\.reagents\.length===0/,"Empty pipette draws after the contact delay");
assert.match(hoverSurface,/setTimeout\(perform,1000\)/,"Pouring and pipettes require one second uninterrupted contact");
assert.match(hoverSurface,/endContact\(\)/,"Release cancels the active pour");
assert.match(hoverSurface,/beginContact\(g\.id,pouring\)/);
assert.match(hoverSurface,/const drawing=pipette\.reagents\.length===0/);
assert.match(hoverSurface,/transferLabMeasuredLiquid\(latest,donor\.id,receiver\.id,requested\)/);
assert.match(hoverSurface,/lektrus-lab-device-face-controls/);
assert.match(hoverSurface,/lektrus-lab-device-power/);
assert.match(hoverSurface,/setPlacedDevicePower\(\{\.\.\.bench,simulationAtMs:Date\.now\(\)\}/);
assert.match(hoverSurface,/lektrus-lab-stand-raise/);
assert.match(hoverSurface,/setLabStandHeight\(bench,device\.id/);
assert.match(hoverSurface,/LabTemperatureInput/);
assert.match(hoverSurface,/g\.x\+p\.x-g\.startX/);
assert.match(hoverSurface,/p\.y-g\.startY/);
assert.doesNotMatch(hoverSurface,/lektrus-lab-ware-brand"/);
assert.doesNotMatch(read("src/LektrusLabDeviceIcon.tsx"),/>LEKTRUS<\/text>/);
assert.doesNotMatch(hoverSurface,/selected\.kind==="funnel"/);
assert.ok(!lab.labGlassware.some(v=>v.id==="funnel"),"Funnel is absent from available cabinet glassware");
const stock=load("src/lektrusLabCatalog.ts",key=>{
 if(key==="./lektrusReactionDatabase")return reaction;
 assert.equal(key,"./lektrusLabAppearance");
 return load("src/lektrusLabAppearance.ts",k=>{
  assert.equal(k,"./lektrusReactionDatabase");return reaction;
 });
});
const item=id=>reaction.substances.find(v=>v.id===id);
assert.deepEqual(stock.labReagentForms(item("HCl")),["ml"]);
assert.deepEqual(stock.labReagentForms(item("Cu")),["g"]);
assert.deepEqual(stock.labReagentForms(item("NaCl")),["g","ml"]);
assert.deepEqual(stock.labReagentForms(item("AgCl")),["g"]);
assert.equal(stock.labReagentPhaseLabel(item("CuSO4"),"ml"),"Раствор / жидкость");
assert.equal(stock.labReagentPhaseLabel(item("CaCO3"),"g"),"Твёрдое вещество");
assert.match(hoverSurface,/labVesselQuantity\(vessel\)/);
assert.match(hoverSurface,/totalLabel\|\|\"Осадок\"/);

/* Realistic receiving glassware snaps to the retort stand foot, whereas
 * clamp-held glassware remains attached independently above it. */
let onFoot=lab.addPlacedLabDevice(detailedBench(),"tripod",{x:40,y:68});
const onFootStand=lab.placedLabDevices(onFoot)[0].id;
onFoot=lab.addLabVessel(onFoot,"burette");
const onFootBurette=onFoot.vessels.find(v=>v.kind==="burette").id;
onFoot=lab.applyPlacedLabDevice(onFoot,onFootStand,onFootBurette);
onFoot=lab.placeLabVesselOnStandBase(onFoot,"v1",onFootStand);
assert.equal(lab.labReceiverBelowStand(onFoot,onFootBurette)?.id,"v1",
 "Receiver on metal foot is aligned beneath the mounted burette");
assert.equal(lab.placedLabDevices(onFoot)[0].linkedVesselId,onFootBurette,
 "Putting another vessel on the base cannot displace the upper clamp");
assert.ok(layout.labStandBaseVesselPoint(
 lab.placedLabDevices(onFoot)[0],onFoot.vessels[0],1600,1000).y>68,
 "Receiving flask must stand lower than the clamp on the base");
onFoot=lab.putLabReagent(onFoot,onFootBurette,"HCl",{value:5,unit:"ml"});
assert.equal(lab.setLabBuretteValve(onFoot,onFootBurette,true,"v1",.05)
 .vessels.find(v=>v.id===onFootBurette).buretteOpen,true);
onFoot=lab.setLabBuretteValve({...onFoot,simulationAtMs:0},onFootBurette,true,"v1",.05);
for(let i=1;i<=10;i++)onFoot=lab.advanceLabSimulation(onFoot,i*500);
assert.equal(onFoot.vessels.find(v=>v.id==="v1").doses?.HCl?.value,.25,
 "Ten half-second slow-drip ticks must deliver exactly 0.25 ml");
onFoot=lab.setLabBuretteValve(onFoot,onFootBurette,false);
const atCloseDose=onFoot.vessels.find(v=>v.id==="v1").doses.HCl;
const atCloseMoles=chem.labDoseMoles("HCl",atCloseDose);
onFoot=lab.advanceLabSimulation(onFoot,6000);
const afterCloseDose=onFoot.vessels.find(v=>v.id==="v1").doses.HCl;
assert.ok(Math.abs(chem.labDoseMoles("HCl",afterCloseDose)-atCloseMoles)<1e-12,
 "Closing the burette valve stops dosing; ambient water loss conserves acid moles");
assert.ok(afterCloseDose.value<=atCloseDose.value,
 "A stopped burette cannot add acid, though open receiver water may evaporate");
const geometricalSurface=read("src/LektrusChemistryBench.tsx");
assert.match(geometricalSurface,/placeLabVesselOnStandBase\(bench,g\.id,beneath\.d\.id\)/,
 "Stand-foot drop must snap to metal base");
assert.match(geometricalSurface,/lektrus-lab-valve-toggle/,
 "Burette stopcock must be directly clickable on the tabletop");
assert.match(geometricalSurface,/className="lektrus-lab-titration-drops"/,
 "A real titration stream is drawn beneath the open stopcock");
assert.match(geometricalSurface,/const flowPath=/,
 "Pour rendering must follow the moving vessel's lip");
assert.doesNotMatch(editor,/lektrus-lab-observation/,
 "Fullscreen editor adds no separate content fields");

// Verified reactions advance by the exact balanced coefficients, not by
// changing the carrier-solution volume or inventing concentration.
assert.equal(Math.round(chem.labMolarMass("NaCl")*100)/100,58.44);
assert.ok(Math.abs(chem.labMolarMass("Ca(OH)2")-74.092)<.02);
assert.ok(chem.parseBalancedLabEquation("HCl + NaOH → NaCl + H2O"));
assert.ok(chem.parseBalancedLabEquation("2HCl + Ca(OH)2 → CaCl2 + 2H2O"));
assert.equal(chem.parseBalancedLabEquation("HCl + NaOH → 2NaCl + H2O"),null,
 "A false/unbalanced source equation must never be used for calculations");
const neutralization=reaction.identifyReaction(["HCl","NaOH"],"aqueous").caseData;
assert.ok(neutralization);
const measuredReaction=chem.startQuantifiedLabReaction(neutralization,["HCl","NaOH"],{
 HCl:{value:10,unit:"ml",concentrationM:.1},
 NaOH:{value:5,unit:"ml",concentrationM:.1}
});
assert.ok(measuredReaction);
assert.ok(Math.abs(chem.startQuantifiedLabReaction(neutralization,["HCl","NaOH"],{
 HCl:{value:10,unit:"ml"},NaOH:{value:5,unit:"ml",concentrationM:.1}
}).maxExtentMol-.0005)<1e-12,
 "Legacy prepared school stock receives the catalogue default 0.1 M");
assert.ok(Math.abs(measuredReaction.maxExtentMol-.0005)<1e-12);
const halfway=chem.advanceQuantifiedLabReaction(measuredReaction,2);
assert.ok(Math.abs(halfway.remainingMol.HCl-.00075)<1e-12);
assert.ok(Math.abs(halfway.productsMol.NaCl-.00025)<1e-12);
const reacted=chem.advanceQuantifiedLabReaction(halfway,2);
assert.ok(reacted.complete);
assert.equal(reacted.remainingMol.NaOH,0);
assert.ok(Math.abs(reacted.remainingMol.HCl-.0005)<1e-12);
assert.ok(Math.abs(reacted.productsMol.NaCl-.0005)<1e-12);
assert.ok(Math.abs(reacted.productsMol.H2O-.0005)<1e-12);
const precipitateCase=reaction.identifyReaction(["AgNO3","NaCl"],"aqueous").caseData;
const precipitation=chem.startQuantifiedLabReaction(precipitateCase,["AgNO3","NaCl"],{
 AgNO3:{value:8,unit:"ml",concentrationM:.1},
 NaCl:{value:10,unit:"ml",concentrationM:.2}
});
assert.ok(precipitation);
const precipitated=chem.advanceQuantifiedLabReaction(precipitation,4);
assert.ok(Math.abs(precipitated.productsMol.AgCl-.0008)<1e-12);
assert.ok(Math.abs(precipitated.remainingMol.NaCl-.0012)<1e-12);
let liveReaction=lab.putLabReagent(detailedBench(),"v1","HCl",
 {value:10,unit:"ml",concentrationM:.1});
liveReaction=lab.putLabReagent(liveReaction,"v1","NaOH",
 {value:5,unit:"ml",concentrationM:.1});
assert.equal(lab.labReactionNeedsTick(liveReaction.vessels[0]),true);
liveReaction=lab.advanceLabSimulation(liveReaction,1000);
liveReaction=lab.advanceLabSimulation(liveReaction,1500);
assert.equal(liveReaction.vessels[0].reactionAmounts.elapsedSeconds,0);
liveReaction=lab.advanceLabSimulation(liveReaction,3500);
assert.ok(Math.abs(liveReaction.vessels[0].reactionAmounts.productsMol.NaCl-.00025)<1e-12);
liveReaction=lab.advanceLabSimulation(liveReaction,5500);
assert.equal(liveReaction.vessels[0].reactionAmounts.complete,true);
assert.equal(lab.labReactionNeedsTick(liveReaction.vessels[0]),false);
assert.equal(lab.labVesselQuantity(liveReaction.vessels[0]).volumeMl,15,
 "Solute reaction must not incorrectly subtract the carrier liquids");
// Every new burette drop re-equilibrates the measured acid/base inventory.
let accurateTitration=lab.putLabReagent(detailedBench(),"v1","HCl",
 {value:10,unit:"ml",concentrationM:.1});
accurateTitration=lab.addLabVessel(accurateTitration,"burette");
const titrationBurette=accurateTitration.vessels.find(v=>v.kind==="burette").id;
accurateTitration=lab.putLabReagent(accurateTitration,titrationBurette,"NaOH",
 {value:10,unit:"ml",concentrationM:.1});
accurateTitration=lab.dripLabVessel(accurateTitration,titrationBurette,"v1",1);
const firstDrop=accurateTitration.vessels.find(v=>v.id==="v1").reactionAmounts;
assert.ok(firstDrop);
assert.equal(firstDrop.complete,true,"Acid/base neutralisation is fast between titration drops");
assert.ok(Math.abs(firstDrop.productsMol.NaCl-.0001)<1e-12);
assert.ok(Math.abs(firstDrop.remainingMol.HCl-.0009)<1e-12);
accurateTitration=lab.dripLabVessel(accurateTitration,titrationBurette,"v1",2);
const nextDrop=accurateTitration.vessels.find(v=>v.id==="v1").reactionAmounts;
assert.ok(Math.abs(nextDrop.productsMol.NaCl-.0003)<1e-12,
 "The newly added 2 ml must grow the product total from 0.1 to 0.3 mmol");
assert.ok(Math.abs(nextDrop.remainingMol.HCl-.0007)<1e-12);
const editorFixed=read("src/LektrusChemistryBenchEditor.tsx");
assert.match(editorFixed,/setStage/);
assert.match(editorFixed,/zoom:stage\.scale/,"Fullscreen must use layout zoom to avoid Android GPU repaint artifacts");
assert.match(editorFixed,/const width=compact\?w:w\/scale/,
 "Phones use native pixels while desktop continues fitted layout zoom");
assert.match(read("src/lektrusChemistryBench.css"),/lektrus-lab-fit-stage/);
const polishedSurface=read("src/LektrusChemistryBench.tsx");
assert.ok(polishedSurface.includes('window.addEventListener("lektrus-lab-fullscreen-change",resume)'),
 "The embedded laboratory resumes its clock after fullscreen closes");
assert.ok(editorFixed.includes('window.dispatchEvent(new Event("lektrus-lab-fullscreen-change"))'),
 "The fullscreen editor notifies the underlying laboratory on open and exit");
assert.match(polishedSurface,/bench\.reactionLog/);
assert.match(polishedSurface,/labSimulationTickWaitMs\(current,now\)/,
 "The surface follows the adaptive laboratory clock");
assert.match(read("src/lektrusChemistryBenchModel.ts"),/vessels\.some\(labReactionNeedsTick\)/,
 "The adaptive clock must preserve quantified reaction ticking");
assert.match(polishedSurface,/isQuantifiedSolution/);
assert.match(polishedSurface,/settings.showEquationBoard&&<div className="lektrus-lab-chalk-writing"/);
const standFoot=read("src/LektrusLabDeviceIcon.tsx");
assert.match(standFoot,/M22 96V3/);
assert.match(read("src/lektrusLabLayout.ts"),/77\/110/);

// Mode-specific apparatus must not remove any already placed work.
assert.deepEqual(lab.LAB_MODES.map(m=>m.id),
 ["reactions","titration","solutions","evaporation","synthesis"]);
let modeBench=detailedBench();
const previousPositions=JSON.stringify(modeBench.vessels);
modeBench=lab.setLabMode(modeBench,"titration");
assert.equal(lab.labMode(modeBench),"titration");
assert.equal(JSON.stringify(modeBench.vessels),previousPositions);
assert.ok(lab.glasswareForLabMode(modeBench).some(v=>v.id==="burette"));
assert.ok(lab.devicesForLabMode(modeBench).some(v=>v.id==="tripod"));
assert.ok(!lab.glasswareForLabMode(modeBench).some(v=>v.id==="crucible"));
modeBench=lab.setLabMode(modeBench,"evaporation");
assert.ok(lab.glasswareForLabMode(modeBench).some(v=>v.id==="dish"));
assert.ok(lab.devicesForLabMode(modeBench).some(v=>v.id==="hotplate"));
assert.ok(lab.labModeInfo(modeBench).description.includes("кристаллов"));
modeBench=lab.setLabMode(modeBench,"synthesis");
assert.ok(lab.glasswareForLabMode(modeBench).some(v=>v.id==="crucible"));
assert.ok(lab.devicesForLabMode(modeBench).some(v=>v.id==="burner"));
const firstCoordinates=modeBench.vessels.map(v=>[v.id,v.x,v.y]);
modeBench=lab.addLabVessel(modeBench,"tube",{x:66,y:75});
assert.deepEqual(modeBench.vessels.slice(0,-1).map(v=>[v.id,v.x,v.y]),firstCoordinates,
 "Inserting glassware at a pointer must never move existing vessels");
assert.equal(modeBench.vessels.at(-1).x,66);
assert.equal(modeBench.vessels.at(-1).y,75);
const fallbackInserted=lab.addLabVessel(modeBench,"flask");
assert.deepEqual(fallbackInserted.vessels.slice(0,-1),modeBench.vessels,
 "Keyboard insertion uses an empty position, not a forced rearrangement");
assert.equal(layout.labDisplayPoint(fallbackInserted.vessels[0],true).y,
 layout.labDisplayPoint(fallbackInserted.vessels[0],false).y,
 "Crossing the fourth vessel cannot change earlier screen positions");
const writtenWall=read("src/LektrusChemistryBench.tsx");
assert.match(writtenWall,/settings.showEquationBoard&&<div className="lektrus-lab-chalk-writing"/);
assert.doesNotMatch(writtenWall,/lektrus-lab-wall-guide/,
 "Equation mode must only write to the integrated backboard");
assert.match(writtenWall,/chooseGlassware\(kind\.id\)/);
assert.match(writtenWall,/pendingGlassware/);
assert.match(writtenWall,/glasswareForLabMode\(bench\)/);
assert.match(writtenWall,/devicesForLabMode\(bench\)/);
assert.match(read("src/lektrusChemistryBench.css"),/lektrus-lab-bench-backdrop::before/);
assert.match(editorFixed,/const scale=compact\?1:h\/1000/);
const higherStand=lab.addPlacedLabDevice(detailedBench(),"tripod");
assert.equal(higherStand.placedDevices[0].standHeight,.88);
const stand=higherStand.placedDevices[0];
const receiving=layout.labStandBaseVesselPoint(stand,{kind:"conical"},1600,1000);
const mountedBurettePoint=layout.labMountedGlasswarePoint(stand,{kind:"burette"},1600,1000);
assert.ok(receiving.y-mountedBurettePoint.y>12,
 "A taller stand must leave a visible gap for titrant drops");
for(const width of [400,450,690,700,900,1200,1600,2600]){
 const jar=layout.labStandBaseVesselPoint(stand,{kind:"conical"},width,1000);
 const source=layout.labMountedGlasswarePoint(stand,{kind:"burette"},width,1000);
 assert.ok(jar.y-7-(source.y+8.1)>3,
  "Titration drops should fall visibly between burette and flask at "+width+"px");
}

const starterInput=lab.setLabMode(detailedBench(),"titration");
const starterOriginal={...starterInput.vessels[0]};
const preparedKit=lab.prepareLabModeSetup(starterInput);
const kitStand=lab.placedLabDevices(preparedKit).find(d=>d.kind==="tripod");
const kitBurette=preparedKit.vessels.find(v=>v.kind==="burette");
const kitFlask=preparedKit.vessels.find(v=>v.kind==="conical");
assert.ok(kitStand&&kitBurette&&kitFlask,"Titration kit includes its stand, burette and receiving flask");
assert.equal(kitStand.linkedVesselId,kitBurette.id,
 "A freshly prepared titration kit suspends its burette in the clamp");
assert.equal(kitFlask.restingOnStandId,kitStand.id,
 "Titration receiver is tied to the metal foot, not the vertical rod");
assert.equal(lab.labReceiverBelowStand(preparedKit,kitBurette.id)?.id,kitFlask.id);
assert.deepEqual(preparedKit.vessels[0],starterOriginal,
 "Preparing a kit must leave previously placed glassware untouched");
const movedKit=lab.movePlacedLabDevice(preparedKit,kitStand.id,58,68);
assert.equal(movedKit.vessels.find(v=>v.id===kitFlask.id).restingOnStandId,kitStand.id,
 "The flask stays on the metal foot when the stand moves");
const storedKit=lab.returnPlacedLabDevice(movedKit,kitStand.id);
assert.equal(storedKit.vessels.find(v=>v.id===kitFlask.id).restingOnStandId,undefined,
 "Storing the stand leaves its receiver as free tabletop glassware");

assert.deepEqual(lab.prepareLabModeSetup(preparedKit),preparedKit,
 "Preparing the same laboratory kit twice must not duplicate apparatus");
const modeBaseline=detailedBench();
const modeLocal=lab.setLabMode(modeBaseline,"titration");
const glassRemote=lab.addLabVessel(modeBaseline,"flask",{x:65,y:70});
const modeMerged=lab.mergeLabBench(modeBaseline,modeLocal,glassRemote);
assert.equal(lab.labMode(modeMerged),"titration",
 "Concurrent glassware additions must not silently reset selected mode");
assert.equal(modeMerged.vessels.length,2);
assert.equal(lab.labMode(lab.mergeLabBench(modeBaseline,glassRemote,modeLocal)),"titration");

assert.match(writtenWall,/prepareLabModeSetup\(bench\)/);

// Burette is a graduated dosing instrument, not a temperature probe.
const visualLab=read("src/LektrusChemistryBench.tsx");
const visualStyles=read("src/lektrusChemistryBench.css");
assert.match(visualLab,/temperatureVisible&&vessel.kind!=="burette"/,
 "The glassware graphic must not show a temperature sticker on burettes");
assert.match(visualLab,/temperatureVisible=\{settings.showTemperatures&&v.kind!=="burette"\}/,
 "The worktop ignores the general temperature toggle for burettes");
assert.doesNotMatch(visualLab,/className="lektrus-lab-burette-drop"/,
 "Remove the disconnected static nozzle droplet");
assert.doesNotMatch(visualLab,/lektrus-lab-titration-flow-drops/,
 "A dashed line is not a realistic liquid titration");
assert.match(visualLab,/className="lektrus-lab-droplet"/,
 "Render individually formed falling drops");
assert.match(visualLab,/className="lektrus-lab-titration-ripple"/,
 "A receiving solution should show a small impact ripple");
assert.match(visualLab,/labTitrationDropEndpoints\(from,to,destination.kind,width,height\)/,
 "Droplet paths must connect the actual glassware landmarks");
assert.match(visualLab,/viewBox=\{`0 0 \$\{width\} \$\{height\}`\}/,
 "Stage-pixel SVG prevents wide-screen distortion of droplets");
assert.match(visualStyles,/@keyframes lektrus-lab-gravity-drop/);
assert.match(visualStyles,/@keyframes lektrus-lab-titration-impact/);
for(const rate of lab.LAB_DRIP_RATES){
 const interval=.05/rate;
 const count=rate>=1?12:rate>=.2?5:1;
 assert.ok(Math.abs(count/(interval*count)-rate/.05)<1e-8,
  "The animation cadence follows actual valve flow rate "+rate+" ml/s");
}
for(const width of [400,690,700,900,1200,1600,2600]){
 const stand={x:42,y:62,kind:"tripod",standHeight:.88};
 const upper=layout.labMountedGlasswarePoint(stand,{kind:"burette"},width,1000);
 const lower=layout.labStandBaseVesselPoint(stand,{kind:"conical"},width,1000);
 const drops=layout.labTitrationDropEndpoints(upper,lower,"conical",width,1000);
 assert.ok(drops&&drops.targetY>drops.y+4,
  "The droplet travels DOWN into the real receiving flask at "+width+"px");
 assert.ok(Math.abs(drops.targetX-drops.x)<width*.12,
  "The receiving flask must be aligned with the burette nozzle");
}

// Real-time pipette dwell: a contact must survive a full second.
const polishedLabSource=read("src/LektrusChemistryBench.tsx");
assert.match(polishedLabSource,/contactTimer\.current=setTimeout\(perform,1000\)/);
assert.match(polishedLabSource,/if\(contactRef\.current\)endContact\(\)/);
assert.match(polishedLabSource,/endContact\(\);\s*event\.preventDefault\(\)/);
assert.doesNotMatch(polishedLabSource,/className="lektrus-lab-svg-ware-control"/);
assert.doesNotMatch(polishedLabSource,/className="lektrus-lab-settings-trigger"/);
assert.doesNotMatch(polishedLabSource,/openCabinet\("settings"\)/);
assert.match(polishedLabSource,/className="lektrus-lab-burette-rate-buttons"/);
assert.match(polishedLabSource,/aria-pressed=\{\(selectedBurette\.buretteRateMlS\?\?\.2\)===rate\}/);
assert.doesNotMatch(polishedLabSource,/<label>Скорость\s*<select/);
assert.match(polishedLabSource,/className=\{"lektrus-lab-board-write-toggle"/);
assert.match(polishedLabSource,/pourLabIntoFilter\(bench,g\.id,filter\.d\.id\)/);
assert.match(polishedLabSource,/d\.kind==="filter"/,
 "The real filter must be recognized as an interactive tabletop appliance");
assert.match(polishedLabSource,/setNotice\("Перетащите сосуд с готовым осадком непосредственно на фильтр"\)/,
 "The device asks for direct pouring, never an extra selection dialog");
assert.ok(lab.devicesForLabMode(detailedBench()).some(v=>v.id==="filter"));

assert.match(read("src/LektrusChemistryIllustration.tsx"),/className="lektrus-lab-open-editor"/);
assert.doesNotMatch(read("src/LektrusChemistryIllustration.tsx"),/>⤢ Открыть лабораторию<\/button>/);
const uiCss=read("src/lektrusChemistryBench.css");
assert.match(uiCss,/lektrus-lab-burette-rate-buttons/);
assert.match(uiCss,/lektrus-chemistry-bench-on-board>\.lektrus-lab-open-editor/);
assert.match(uiCss,/lektrus-lab-editor\.is-board-identical \.lektrus-lab-scene-header/);
assert.match(uiCss,/lektrus-lab-bench \.lektrus-lab-chalkboard/);
assert.match(read("src/LektrusLabDeviceIcon.tsx"),/M27 40H76/,
 "Retort clamp is physically thinner than its previous full-width arm");

// Filtration physically separates a reviewed precipitate, keeps measured
// solid mass and transfers the carrier solution without duplication.
let filtered=lab.putLabReagent(detailedBench(),"v1","AgNO3",
 {value:10,unit:"ml",concentrationM:.1});
filtered=lab.putLabReagent(filtered,"v1","NaCl",
 {value:10,unit:"ml",concentrationM:.1});
filtered=lab.addLabVessel(filtered,"conical",{x:72,y:73});
const destination=filtered.vessels.find(v=>v.kind==="conical").id;
assert.equal(lab.filterLabPrecipitate(filtered,"v1",destination),filtered,
 "Filtration cannot run without membrane-filter equipment");
filtered=lab.addPlacedLabDevice(filtered,"filter");
assert.equal(lab.filterLabPrecipitate(filtered,"v1",destination),filtered,
 "A measured reaction cannot be filtered before it has finished");
filtered=lab.advanceLabSimulation(filtered,1000);
filtered=lab.advanceLabSimulation(filtered,1500);
filtered=lab.advanceLabSimulation(filtered,5500);
assert.equal(filtered.vessels[0].reactionAmounts?.complete,true);
const separated=lab.filterLabPrecipitate(filtered,"v1",destination);
assert.notEqual(separated,filtered);
assert.equal(separated.vessels[0].filteredResidue?.formula,"AgCl");
assert.ok(Math.abs(separated.vessels[0].filteredResidue.massG-.143318)<.001);
assert.equal(separated.vessels[0].doses.AgCl.unit,"g");
const filtrate=separated.vessels.find(v=>v.id===destination);
assert.equal(lab.labVesselQuantity(filtrate).volumeMl,20);
assert.ok(filtrate.filteredSolution?.solutes.includes("NaNO3"));
assert.ok(!filtrate.reagents.includes("AgCl"),
 "The insoluble salt cannot magically pass through a filter");
assert.equal(lab.labVesselQuantity(separated.vessels[0]).volumeMl,0);
assert.equal(lab.filterLabPrecipitate(separated,"v1",destination),separated,
 "The same collected residue cannot be filtered repeatedly");
let qualitative=lab.addPlacedLabDevice(lab.addLabVessel(lab.putLabReagent(
 lab.putLabReagent(detailedBench(),"v1","AgNO3"),"v1","NaCl"),
 "conical"),"filter");
const qTarget=qualitative.vessels.find(v=>v.kind==="conical").id;
qualitative=lab.advanceLabSimulation(qualitative,0);
qualitative=lab.advanceLabSimulation(qualitative,1000);
qualitative=lab.advanceLabSimulation(qualitative,6000);
const qFiltered=lab.filterLabPrecipitate(qualitative,"v1",qTarget);
assert.equal(qFiltered.vessels[0].filteredResidue?.formula,"AgCl");
assert.ok(Math.abs(qFiltered.vessels[0].filteredResidue.massG-.143318)<.001,
 "Even default stock volumes generate a calculated mass of AgCl");

// New education modes, physical dissolution, direct cartridge filtration,
 // and solution-first catalog behavior.
assert.deepEqual(stock.labReagentForms(item("NH4OH")),["ml"]);
const wateryCatalog=labCatalog.buildLabCatalog({phase:"liquid",group:"phase"});
assert.ok(wateryCatalog.flatMap(g=>g.items).some(v=>v.id==="NaCl"));
assert.ok(!wateryCatalog.flatMap(g=>g.items).some(v=>v.id==="CO2"),
 "Liquid-first catalogue must not accidentally show compressed gases");
assert.equal(wateryCatalog[0].title,"Растворы и жидкости");
assert.ok(reaction.substances.length>=180,"Expanded catalog contains all reviewed chemical products");
for(const ids of [["AgNO3","NaBr"],["SrCl2","Na2SO4"],["NiSO4","NaOH"],
 ["HCl","LiOH"],["C3H8","O2"]]){
 const medium=ids[0]==="C3H8"?"ignited":"aqueous";
 const result=reaction.identifyReaction(ids,medium);
 assert.equal(result.status,"reaction","Verified new chemical pair "+ids.join("+"));
 assert.ok(chem.parseBalancedLabEquation(result.caseData.equation),
  "Each new chemical equation must conserve every element");
}
const pureWater=lab.putLabReagent(detailedBench(),"v1","H2O",
 {value:60,unit:"ml"});
const dissolving=lab.putLabReagent(pureWater,"v1","NaCl",{value:3,unit:"g"});
assert.equal(dissolving.vessels[0].physicalProcess,"dissolving");
assert.equal(dissolving.vessels[0].doses.H2O.value,60);
assert.equal(dissolving.vessels[0].doses.NaCl.value,3);
assert.notEqual(lab.labObservation(dissolving.vessels[0]).status,"reaction",
 "Dissolving a solid in water must not create invented reaction products");
let directly=lab.pourLabIntoFilter(filtered,"v1",
 lab.placedLabDevices(filtered).find(d=>d.kind==="filter").id);
assert.notEqual(directly,filtered);
assert.equal(directly.vessels.find(v=>v.id==="v1").reagents.length,0);
assert.equal(lab.placedLabDevices(directly).find(d=>d.kind==="filter").collectedResidue.formula,"AgCl");
assert.equal(directly.vessels.find(v=>v.id===destination).filteredSolution.solutes[0],"NaNO3");
assert.ok(lab.placedLabDevices(directly).find(d=>d.kind==="filter").filterStartedAtMs>0,
 "Successful pouring records a shared event time for drain animation");
assert.match(read("src/LektrusLabDeviceIcon.tsx"),/lektrus-lab-filter-drain-drop/,
 "Membrane shows actual draining droplets after pouring");
assert.match(read("src/lektrusChemistryBench.css"),/lektrus-lab-membrane-drain/,
 "The drain animation must be styled and short-lived");
assert.match(read("src/LektrusChemistryBench.tsx"),/collectedResidue=\{device\.collectedResidue\}/,
 "Solid left by the filter must be drawn on its real membrane");

assert.equal(lab.pourLabIntoFilter(directly,"v1",
 lab.placedLabDevices(directly).find(d=>d.kind==="filter").id),directly,
 "A loaded cartridge cannot silently duplicate a precipitate");
assert.doesNotMatch(polishedLabSource,/lektrus-lab-filter-actions/,
 "Direct filtration must not reopen the previous receiver selection panel");
assert.match(polishedLabSource,/lektrus-lab-dissolving-particles/);
assert.match(polishedLabSource,/lektrus-lab-boiling-particles/);
assert.match(polishedLabSource,/lektrus-lab-vapor-plume/);
assert.doesNotMatch(polishedLabSource,/className="lektrus-lab-steam-plumes"/,
 "Steam must rise from the actual glass mouth, without double and clipped SVG paths");
assert.match(read("src/lektrusChemistryBench.css"),/lektrus-lab-reagent-form-tabs/);
assert.match(read("src/LektrusChemistryBench.tsx"),/lektrus-lab-catalog-extra/,
 "Less-used filters stay collapsed to enlarge the reactant catalogue");
assert.match(read("src/lektrusChemistryBench.css"),/max-width:425px!important/,
 "Mode names have a wider adaptive menu on desktop");

assert.match(read("src/lektrusChemistryBench.css"),/lektrus-lab-board-write-toggle/);
// Chemistry-wide audit: verify all available reactants, products and visuals.
// An explosion-like flash is exclusive to explicitly reviewed energetic systems.
assert.ok(chem.parseBalancedLabEquation("BaCl2 + (NH4)2SO4 → BaSO4↓ + 2NH4Cl"),
 "Balanced ammonium salts must be accepted, not skipped by the parser");
assert.ok(chem.parseBalancedLabEquation("2NH3 + H2SO4 → (NH4)2SO4"),
 "Parenthesized products must also be quantified");
const indexedReagents=new Set(reaction.substances.map(v=>v.id));
const allowedEffects=new Set(["flame","flash","sparks","smoke","glow",
 "steam","fizz","crystals","thermal","colorShift"]);
const reviewedFlashes=new Set(["H2+O2","Na+Cl2","K+Cl2","Al+Cl2",
 "H2+Cl2","K+H2O"]);
assert.ok(reaction.reviewedReactionCases.length>=300,
 "School laboratory must cover diverse exchange, redox and combustion chemistry");
for(const row of reaction.reviewedReactionCases.filter(v=>v.status==="reaction")){
 assert.ok(row.reactants.every(id=>indexedReagents.has(id)),
  "Cannot initiate a reaction from a missing reagent: "+row.equation);
 const products=reaction.reactionProducts(row.equation).map(x=>
  x.replace(/^\d+\s*/,"").replace(/[↑↓]/g,"").trim());
 assert.ok(products.every(id=>indexedReagents.has(id)),
  "All products must have substance records for display: "+row.equation);
 assert.ok(row.visual&&allowedEffects.has(row.visual),
  "All verified reactions need a supported effect: "+row.equation);
 if(row.visual==="flash")
  assert.ok(reviewedFlashes.has(row.reactants.slice().sort().join("+"))||
    reviewedFlashes.has(row.reactants.join("+")),
   "A bright flash must not be invented for ordinary chemistry: "+row.equation);
 if(row.observation==="precipitate")
  assert.ok(row.equation.includes("↓"),"Precipitate must match actual solid product");
 if(row.observation==="gas")
  assert.ok(row.equation.includes("↑"),"Gas animation must correspond to gas product");
}
assert.match(read("src/LektrusChemistryBench.tsx"),/pourLabIntoFilter\(bench,effectivePouringId,g\.id\)/,
 "A user can click the physical membrane filter after selecting pour");
assert.doesNotMatch(read("src/LektrusChemistryBench.tsx"),/substanceState/,
 "Above-glassware labels must not show the reaction family or process status");
// Entire reviewed inventory: only atom-balanced equations should be presented.
for(const row of reaction.reviewedReactionCases.filter(v=>v.status==="reaction")){
 assert.ok(chem.parseBalancedLabEquation(row.equation),
  "Every presented equation must balance: "+row.equation);
}
const noReceiver={...filtered,vessels:filtered.vessels.filter(v=>v.id==="v1"),selectedId:"v1"};
const automaticReceiver=lab.pourLabIntoFilter(noReceiver,"v1",
 lab.placedLabDevices(noReceiver).find(d=>d.kind==="filter").id);
assert.equal(automaticReceiver.vessels.length,2,
 "A clean beaker is prepared when none is available; no chooser is opened");
assert.equal(automaticReceiver.vessels[0].reagents.length,0);
assert.equal(lab.placedLabDevices(automaticReceiver).find(d=>d.kind==="filter").
 collectedResidue.formula,"AgCl");
let boiling=lab.putLabReagent(detailedBench(),"v1","H2O",
 {value:20,unit:"ml"});
boiling=lab.addPlacedLabDevice(boiling,"hotplate");
const heater=lab.placedLabDevices(boiling).find(d=>d.kind==="hotplate").id;
boiling=lab.applyPlacedLabDevice(boiling,heater,"v1");
boiling=lab.setLabHotplateTemperature(boiling,heater,185);
boiling=lab.setPlacedDevicePower(boiling,heater,true);
boiling=lab.advanceLabSimulation(boiling,0);
for(let i=1;i<=130;i++)boiling=lab.advanceLabSimulation(boiling,i*2000);
assert.ok((boiling.vessels[0].temperatureC??22)>=99,
 "Heating explicit water must eventually bring it to the boiling range");
assert.ok(lab.labVesselQuantity(boiling.vessels[0]).volumeMl<20,
 "Only explicitly measured pure water evaporates when boiling");
assert.ok(lab.labVesselQuantity(boiling.vessels[0]).volumeMl>=0,
 "Water must not evaporate to a negative quantity");
console.log("Virtual chemistry bench: glassware, mixing, curated results, heating, persistence and peer merge passed");


/* Thermal safety audit: a reference for every reagent is either explicitly
 * curated or explicitly unknown, never fabricated from a chemical class. */
for(const substance of reaction.substances){
 const forms=stock.labReagentForms(substance);
 for(const unit of forms){
  const row=thermal.labThermalInfo(substance.id,unit);
  assert.equal(typeof row.description,"string");
  assert.ok(row.description.length>15);
  if(row.form==="solution")assert.equal(row.boilingC,undefined,
   "Do not assign pure boiling point to a stock solution: "+substance.id);
  if(row.behavior==="decomposes")assert.equal(row.boilingC,undefined,
   "Decomposing "+substance.id+" must not appear to boil");
  if(row.meltingC!==undefined&&row.boilingC!==undefined)
   assert.ok(row.meltingC<row.boilingC, "Physical phase order for "+substance.id);
 }
}
assert.equal(thermal.labThermalInfo("H2O","ml").boilingC,100);
assert.equal(thermal.labThermalInfo("C2H5OH","ml").boilingC,78.37);
assert.equal(thermal.labThermalInfo("CH3OH","ml").boilingC,64.7);
assert.equal(thermal.labThermalInfo("NaCl","g").meltingC,800.7);
assert.equal(thermal.labThermalInfo("Na","g").meltingC,97.79);
assert.equal(thermal.labThermalInfo("KNO3","g").decompositionC,400);
assert.equal(thermal.labThermalInfo("HCl","ml").boilingC,undefined);
assert.equal(thermal.labThermalInfo("CuSO4","ml").meltingC,undefined);
assert.equal(thermal.labThermalInfo("C12H22O11","g").meltingC,undefined,
 "Decomposition of sugar cannot be mistaken for a reversible melt");
assert.equal(thermal.labThermalInfo("C12H22O11","g").boilingC,undefined);

let melt=lab.putLabReagent(detailedBench(),"v1","Na",{value:8,unit:"g"});
melt=lab.addPlacedLabDevice(melt,"hotplate");
const meltingHeater=lab.placedLabDevices(melt).find(d=>d.kind==="hotplate").id;
melt=lab.applyPlacedLabDevice(melt,meltingHeater,"v1");
melt=lab.setLabHotplateTemperature(melt,meltingHeater,180);
melt=lab.setPlacedDevicePower(melt,meltingHeater,true);
melt=lab.advanceLabSimulation(melt,0);
let hadPartialMelt=false;
for(let i=1;i<=190;i++){
 melt=lab.advanceLabSimulation(melt,i*2000);
 if((melt.vessels[0].meltFraction??0)>0&&(melt.vessels[0].meltFraction??0)<1)
  hadPartialMelt=true;
}
assert.ok(hadPartialMelt,"Reversible melting must show a partial phase rather than jump");
assert.equal(melt.vessels[0].meltFraction,1,"Heated sodium reaches full melt");
assert.ok((melt.vessels[0].temperatureC??0)>97.79);
assert.equal(lab.labVesselQuantity(melt.vessels[0]).massG,8,
 "Melting does not convert grams to invented millilitres");
assert.equal(thermal.labThermalState(melt.vessels[0].reagents,
 melt.vessels[0].doses,melt.vessels[0].temperatureC,melt.vessels[0].meltFraction).label,"Расплав");
melt=lab.setPlacedDevicePower(melt,meltingHeater,false);
let hadPartialCrystal=false;
for(let i=191;i<=530;i++){
 melt=lab.advanceLabSimulation(melt,i*2000);
 if((melt.vessels[0].meltFraction??0)>0&&(melt.vessels[0].meltFraction??0)<1)
  hadPartialCrystal=true;
}
assert.ok(hadPartialCrystal,"Cooling must pass through crystallisation");
assert.equal(melt.vessels[0].meltFraction,0);
assert.ok((melt.vessels[0].temperatureC??500)<97.79);
assert.equal(lab.labVesselQuantity(melt.vessels[0]).massG,8,
 "Crystallisation preserves solid material");

const alcohol=lab.putLabReagent(detailedBench(),"v1","C2H5OH",{value:30,unit:"ml"});
let alcoholHeat=lab.addPlacedLabDevice(alcohol,"hotplate");
const alcoholHeater=lab.placedLabDevices(alcoholHeat)[0].id;
alcoholHeat=lab.applyPlacedLabDevice(alcoholHeat,alcoholHeater,"v1");
alcoholHeat=lab.setLabHotplateTemperature(alcoholHeat,alcoholHeater,160);
alcoholHeat=lab.setPlacedDevicePower(alcoholHeat,alcoholHeater,true);
alcoholHeat=lab.advanceLabSimulation(alcoholHeat,0);
let observedAlcoholBoiling=false;
for(let i=1;i<=130;i++){
 alcoholHeat=lab.advanceLabSimulation(alcoholHeat,i*2000);
 const volume=lab.labVesselQuantity(alcoholHeat.vessels[0]).volumeMl;
 const temp=alcoholHeat.vessels[0].temperatureC??0;
 if(volume>0.01&&volume<29&&temp>=76){
  assert.ok(temp<=78.6,
   "Liquid ethanol must stay near its measured boiling point while present");
  observedAlcoholBoiling=true;
 }
}
assert.ok(observedAlcoholBoiling,"Ethanol must visibly pass through boiling");
assert.ok(lab.labVesselQuantity(alcoholHeat.vessels[0]).volumeMl<30,
 "Ethanol boils away under sustained heat");
// Once every drop is gone, the dry vessel can heat ABOVE the boiling point.
if(lab.labVesselQuantity(alcoholHeat.vessels[0]).volumeMl<.01)
 assert.ok((alcoholHeat.vessels[0].temperatureC??0)>78.37,
  "A dry vessel must not remain stuck at ethanol's boiling plateau");
const saline=lab.putLabReagent(lab.putLabReagent(detailedBench(),"v1",
 "H2O",{value:30,unit:"ml"}),"v1","NaCl",{value:2,unit:"g"});
assert.equal(thermal.labVesselThermal(saline.vessels[0].reagents,saline.vessels[0].doses),
 null,"A solution has no invented exact boiling temperature");
assert.match(read("src/LektrusChemistryBench.tsx"),/lektrus-lab-molten-liquid/);
assert.match(read("src/LektrusChemistryBench.tsx"),/Плавление \/ кристаллизация/);
assert.match(read("src/LektrusChemistryBench.tsx"),/Порошок \/ кусочки/);
assert.match(read("src/lektrusChemistryBench.css"),/lektrus-lab-solid-charge/);
console.log("Thermal registry, boiling, melting and cooling verified");


let crucible=lab.addLabVessel(detailedBench(),"crucible");
const crucibleId=crucible.vessels.find(v=>v.kind==="crucible").id;
crucible=lab.putLabReagent(crucible,crucibleId,"NaCl",{value:5,unit:"g"});
crucible=lab.addPlacedLabDevice(crucible,"burner");
const crucibleBurner=lab.placedLabDevices(crucible).find(d=>d.kind==="burner").id;
crucible=lab.applyPlacedLabDevice(crucible,crucibleBurner,crucibleId);
crucible=lab.setPlacedDeviceLevel(crucible,crucibleBurner,3);
crucible=lab.setPlacedDevicePower(crucible,crucibleBurner,true);
crucible=lab.advanceLabSimulation(crucible,0);
for(let i=1;i<=210;i++)crucible=lab.advanceLabSimulation(crucible,i*2000);
const moltenSalt=crucible.vessels.find(v=>v.id===crucibleId);
assert.equal(moltenSalt.meltFraction,1,
 "High setting of simulated burner melts pure NaCl inside a crucible");
assert.ok(moltenSalt.temperatureC>=800.7);
assert.equal(moltenSalt.doses.NaCl.value,5);
assert.ok((crucible.vessels.find(v=>v.id==="v1").temperatureC??22)<500,
 "Ordinary glassware does not inherit the crucible's high-temperature limit");


/** Reaction activation and energy regression: only verified records produce
 * effects. Previously a dry solid poured into water was marked "uncertain". */
for(const row of reaction.reviewedReactionCases.filter(v=>v.status==="reaction")){
 assert.equal(reaction.identifyReaction(row.reactants,row.environment).status,"reaction",
  "Every curated mixture is discoverable in its documented environment: "+row.equation);
 assert.ok(["flame","flash","sparks","smoke","glow","steam","fizz",
  "crystals","thermal","colorShift"].includes(row.visual),
  "Every reviewed reaction can be visualised: "+row.equation);
 if(row.thermalEffect){
  assert.ok(["exothermic","endothermic"].includes(row.thermalEffect));
  assert.equal(row.thermalEffect==="exothermic"?
   (row.enthalpyKJPerMol??-1)<0:(row.enthalpyKJPerMol??1)>0,true,
   "Declared energy direction must match enthalpy: "+row.equation);
 }
}
assert.match(read("src/LektrusChemistryIllustration.tsx"),/lektrus-chemistry-bench-on-board/);
assert.doesNotMatch(read("src/LektrusChemistryIllustration.tsx"),/lektrus-lab-object-grip/,
 "Remove the unwanted nine-dot moving button");
const sodiumInWater=reaction.identifyReaction(["Na","H2O"],"aqueous");
assert.equal(sodiumInWater.status,"reaction");
assert.equal(sodiumInWater.caseData.visual,"fizz",
 "Sodium-water reaction emits hydrogen without an unconditional explosion");
assert.equal(sodiumInWater.caseData.thermalEffect,"exothermic");
for(const acid of ["HCl","H2SO4"]){
 const caseData=reaction.identifyReaction(["Na",acid],"aqueous");
 assert.equal(caseData.status,"reaction","Sodium in "+acid+" must react");
 assert.equal(caseData.caseData.thermalEffect,"exothermic");
 assert.equal(caseData.caseData.observation,"gas");
 assert.ok(chem.parseBalancedLabEquation(caseData.caseData.equation));
}
assert.equal(reaction.identifyReaction(["CaCO3"],"heated").caseData.thermalEffect,"endothermic");
assert.equal(reaction.identifyReaction(["AgNO3","NaCl"],"aqueous").caseData.thermalEffect,undefined,
 "Ordinary precipitation cannot heat the glass just because particles appear");

let sodiumVessel=lab.putLabReagent(detailedBench(),"v1","Na",{value:1,unit:"g"});
sodiumVessel=lab.setLabEnvironment(sodiumVessel,"v1","dry");
sodiumVessel=lab.addLabVessel(sodiumVessel,"beaker");
const receiverWaterId=sodiumVessel.vessels.find(v=>v.id!=="v1").id;
sodiumVessel=lab.putLabReagent(sodiumVessel,receiverWaterId,"H2O",
 {value:30,unit:"ml"});
sodiumVessel=lab.pourLabVessel(sodiumVessel,"v1",receiverWaterId);
assert.equal(sodiumVessel.vessels.find(v=>v.id===receiverWaterId).environment,"aqueous");
assert.equal(sodiumVessel.vessels.find(v=>v.id===receiverWaterId).uncertain,false,
 "Dry sodium into water is a known transformation, not an unknown mixture");
assert.equal(lab.labObservation(sodiumVessel.vessels.find(v=>v.id===receiverWaterId)).status,"reaction");
assert.ok(lab.labReactionNeedsTick(sodiumVessel.vessels.find(v=>v.id===receiverWaterId)));
sodiumVessel=lab.advanceLabSimulation(sodiumVessel,0);
sodiumVessel=lab.advanceLabSimulation(sodiumVessel,2000);
const warmSodium=sodiumVessel.vessels.find(v=>v.id===receiverWaterId);
assert.equal(warmSodium.reactionHeat.direction,"exothermic");
assert.ok(warmSodium.temperatureC>22,"Sodium-water reaction really heats the vessel");
assert.ok(warmSodium.reactionHeat.deltaC>0);
sodiumVessel=lab.advanceLabSimulation(sodiumVessel,6000);
assert.equal(sodiumVessel.vessels.find(v=>v.id===receiverWaterId).reactionHeat.complete,true);

let acidSodium=lab.putLabReagent(detailedBench(),"v1","Na",{value:1,unit:"g"});
acidSodium=lab.setLabEnvironment(acidSodium,"v1","dry");
acidSodium=lab.putLabReagent(acidSodium,"v1","HCl",
 {value:20,unit:"ml",concentrationM:.1});
assert.equal(acidSodium.vessels[0].environment,"aqueous",
 "Acid solution added to a dry metal automatically establishes aqueous conditions");
assert.equal(lab.labObservation(acidSodium.vessels[0]).status,"reaction");
acidSodium=lab.advanceLabSimulation(acidSodium,0);
acidSodium=lab.advanceLabSimulation(acidSodium,2000);
assert.ok(acidSodium.vessels[0].temperatureC>22);
assert.equal(acidSodium.vessels[0].reactionHeat.direction,"exothermic");

let neutralizationHeat=lab.putLabReagent(detailedBench(),"v1","HCl",
 {value:20,unit:"ml",concentrationM:1});
neutralizationHeat=lab.putLabReagent(neutralizationHeat,"v1","NaOH",
 {value:20,unit:"ml",concentrationM:1});
neutralizationHeat=lab.advanceLabSimulation(neutralizationHeat,0);
neutralizationHeat=lab.advanceLabSimulation(neutralizationHeat,2000);
assert.equal(neutralizationHeat.vessels[0].reactionHeat.direction,"exothermic");
assert.ok(neutralizationHeat.vessels[0].reactionHeat.deltaC>0);
assert.ok(neutralizationHeat.vessels[0].temperatureC>22);
assert.equal(lab.labObservation(neutralizationHeat.vessels[0]).status,"reaction");

let calciteBench=lab.addLabVessel(detailedBench(),"crucible");
const calciteId=calciteBench.vessels.find(v=>v.kind==="crucible").id;
calciteBench=lab.putLabReagent(calciteBench,calciteId,"CaCO3",{value:5,unit:"g"});
calciteBench=lab.setLabEnvironment(calciteBench,calciteId,"dry");
calciteBench=lab.addPlacedLabDevice(calciteBench,"burner");
const calciteBurner=lab.placedLabDevices(calciteBench).find(d=>d.kind==="burner").id;
calciteBench=lab.applyPlacedLabDevice(calciteBench,calciteBurner,calciteId);
calciteBench=lab.setPlacedDeviceLevel(calciteBench,calciteBurner,3);
calciteBench=lab.setPlacedDevicePower(calciteBench,calciteBurner,true);
calciteBench=lab.advanceLabSimulation(calciteBench,0);
for(let i=1;i<=220;i++)calciteBench=lab.advanceLabSimulation(calciteBench,i*2000);
const decomposedCalcite=calciteBench.vessels.find(v=>v.id===calciteId);
assert.equal(lab.labObservation(decomposedCalcite).status,"reaction",
 "Heated calcium carbonate must decompose inside a sufficiently hot crucible");
assert.ok(decomposedCalcite.temperatureC>=reaction.identifyReaction(["CaCO3"],"heated").caseData.minTemperatureC-30);
assert.equal(decomposedCalcite.reactionHeat.direction,"endothermic");
assert.ok(decomposedCalcite.reactionHeat.deltaC<0,
 "Thermal decomposition draws heat from the crucible instead of heating it");
assert.equal(decomposedCalcite.reactionHeat.complete,true);
assert.match(read("src/LektrusChemistryBench.tsx"),/Нагрев|Охлаждение/);
assert.match(read("src/LektrusChemistryBench.tsx"),/gasEventActive/);
console.log("Reaction visualizations, sodium with water and acids, calcination and real temperature response passed");

/** Gas volumes are not liquid volumes, and undefined boiling temperatures
 * never impose a fictitious 100°C plateau on an aqueous stock solution. */
let salineHeat=lab.putLabReagent(detailedBench(),"v1","H2O",
 {value:20,unit:"ml"});
salineHeat=lab.putLabReagent(salineHeat,"v1","NaCl",{value:2,unit:"g"});
salineHeat=lab.addPlacedLabDevice(salineHeat,"hotplate");
const salineHeater=lab.placedLabDevices(salineHeat).find(d=>d.kind==="hotplate").id;
salineHeat=lab.applyPlacedLabDevice(salineHeat,salineHeater,"v1");
salineHeat=lab.setLabHotplateTemperature(salineHeat,salineHeater,160);
salineHeat=lab.setPlacedDevicePower(salineHeat,salineHeater,true);
salineHeat=lab.advanceLabSimulation(salineHeat,0);
for(let i=1;i<=130;i++)salineHeat=lab.advanceLabSimulation(salineHeat,i*2000);
assert.ok(salineHeat.vessels[0].temperatureC>100,
 "Mixed salt solution has an unknown boiling point, not a hard-coded 100°C ceiling");
assert.equal(thermal.labVesselThermal(salineHeat.vessels[0].reagents,
 salineHeat.vessels[0].doses),null);
assert.match(read("src/LektrusChemistryBench.tsx"),/const gasOnly=/,
 "Gas-only stock must render as gas rather than an imaginary liquid");
assert.match(read("src/LektrusChemistryBench.tsx"),/gasEventActive/,
 "Bubbles must stop after the documented reaction finishes");
const coReduction=reaction.identifyReaction(["Fe2O3","CO"],"heated");
if(coReduction.status==="reaction"){
 let gasHeated=lab.addLabVessel(detailedBench(),"crucible");
 const id=gasHeated.vessels.find(v=>v.kind==="crucible").id;
 gasHeated=lab.putLabReagent(gasHeated,id,"Fe2O3",{value:5,unit:"g"});
 gasHeated=lab.putLabReagent(gasHeated,id,"CO",{value:10,unit:"ml"});
 gasHeated=lab.addPlacedLabDevice(gasHeated,"burner");
 const heater=lab.placedLabDevices(gasHeated).find(d=>d.kind==="burner").id;
 gasHeated=lab.applyPlacedLabDevice(gasHeated,heater,id);
 gasHeated=lab.setPlacedDeviceLevel(gasHeated,heater,3);
 gasHeated=lab.setPlacedDevicePower(gasHeated,heater,true);
 gasHeated=lab.advanceLabSimulation(gasHeated,0);
 for(let i=1;i<=220;i++)gasHeated=lab.advanceLabSimulation(gasHeated,i*2000);
 assert.equal(lab.labObservation(gasHeated.vessels.find(v=>v.id===id)).status,"reaction",
  "Gas CO must not cap the heated crucible at the boiling point of water");
}
console.log("No fictitious boiling point for solutions or gas mixtures: OK");


/* Persisted high-temperature laboratory regression.
 * A real classroom board with a powered burner at 1333°C was rejected by
 * the old 700°C device limit. This must never make the entire board unreadable.
 * Testing the real document parser, not just a regex on the validator. */
const docModel=load("src/boardModel.ts");
const persistedLab=detailedBench();
persistedLab.vessels=[
 {id:"v1",kind:"tube",x:84.3,y:37.6,reagents:[],environment:"aqueous",observed:false},
 {id:"v2",kind:"beaker",x:18,y:47.7,reagents:[],environment:"aqueous",observed:false},
 {id:"v3",kind:"dish",x:53.3,y:29.4,reagents:["CaCO3"],
  environment:"heated",observed:true,temperatureC:220.1,
  doses:{CaCO3:{value:5,unit:"g"}}}
];
persistedLab.selectedId="v1";
persistedLab.event=3308;
persistedLab.placedDevices=[{id:"dev1",kind:"burner",x:62.4,y:68.2,
 temperatureC:1333,heatLevel:3,powered:true,active:false,targetTemperatureC:150}];
persistedLab.devices=["burner"];
const persistedItem={
 id:"chemical-experiment",kind:"graph",x:20,y:30,width:1660,height:1060,
 text:"",graphFigureId:"chem-experiment-free",scienceLabBench:persistedLab
};
const savedDocument={version:1,title:"Восстановление учебной доски",
 view:{x:0,y:0,zoom:1},items:[persistedItem,
 {id:"keep-user-text",kind:"text",x:30,y:40,width:180,height:70,text:"Работа ученика"}]};
const parseLab=bench=>docModel.parseDocument(JSON.stringify({...savedDocument,
 items:[{...persistedItem,scienceLabBench:bench},savedDocument.items[1]]}));
const reopened=parseLab(persistedLab);
assert.equal(reopened.items.length,2,"Opening a hot laboratory must preserve other board items");
const deselectedBeforeSave=lab.selectLabVessel(persistedLab,"");
assert.equal(deselectedBeforeSave.selectedId,"",
 "Clicking the bare worktop may leave no vessel selected");
const reopenedUnselected=parseLab(deselectedBeforeSave);
assert.equal(reopenedUnselected.items[0].scienceLabBench.selectedId,"",
 "A board with nonempty glassware but no selection must reopen");
assert.deepEqual(reopenedUnselected.items[0].scienceLabBench.vessels,persistedLab.vessels,
 "Reopening an unselected laboratory preserves every saved vessel");
assert.equal(reopenedUnselected.items[1].text,"Работа ученика",
 "An unselected lab cannot block unrelated work on the board");
const corruptSelection=structuredClone(persistedLab);
corruptSelection.selectedId="missing-vessel";
// Real-world regression: an evaporating CuSO4 dish can carry measured
// water independently of the named solute. The previous validator called
// the entire 134-object board corrupt rather than reopening its lesson.
const solventCarrier=structuredClone(persistedLab);
solventCarrier.vessels[0]={...solventCarrier.vessels[0],
 kind:"dish",reagents:["CuSO4"],doses:{H2O:{unit:"ml",value:10.58959}},
 ventedVaporMl:{H2O:5.88041},temperatureC:26,observed:false};
const restoredCarrier=parseLab(solventCarrier);
assert.deepEqual(restoredCarrier.items[0].scienceLabBench.vessels[0].doses,
 {H2O:{unit:"ml",value:10.58959}},
 "Pure water remains a measured carrier even without an explicit reagent row");
assert.deepEqual(restoredCarrier.items[0].scienceLabBench.vessels[0].reagents,["CuSO4"],
 "Solute identity must not be replaced or fabricated during recovery");
assert.equal(restoredCarrier.items[1].text,"Работа ученика",
 "The rest of the document must reopen unchanged");
const invalidUnlistedDose=structuredClone(solventCarrier);
invalidUnlistedDose.vessels[0].doses.NaOH={value:4,unit:"ml",concentrationM:.1};
assert.throws(()=>parseLab(invalidUnlistedDose),
 /Повреждено состояние химического стола/,
 "Unlisted chemical stocks must still fail strict validation");
const invalidWaterConcentration=structuredClone(solventCarrier);
invalidWaterConcentration.vessels[0].doses.H2O.concentrationM=1;
assert.throws(()=>parseLab(invalidWaterConcentration),
 /Повреждено состояние химического стола/,
 "The extra carrier exception only accepts measured pure water");
const healedSelection=parseLab(corruptSelection);
assert.equal(healedSelection.items[0].scienceLabBench.selectedId,"",
 "A stale selected vessel is just UI state; it must not damage the entire lesson");
assert.equal(healedSelection.items[1].text,"Работа ученика");
const legacyBoard=structuredClone(persistedLab);
legacyBoard.vessels.push({id:"old-funnel",kind:"funnel",x:30,y:65,
 reagents:["NaCl"],doses:{NaCl:{value:2,unit:"g"}},
 environment:"aqueous",observed:false});
legacyBoard.selectedId="old-funnel";
const openedLegacy=parseLab(legacyBoard);
const rescued=openedLegacy.items[0].scienceLabBench.vessels.find(v=>v.id==="old-funnel");
assert.equal(rescued.kind,"beaker");
assert.deepEqual(rescued.reagents,["NaCl"]);
assert.deepEqual(rescued.doses.NaCl,{value:2,unit:"g"});
assert.equal(openedLegacy.items[0].scienceLabBench.selectedId,"old-funnel");
assert.equal(openedLegacy.items[1].text,"Работа ученика");
const staleLinks=structuredClone(persistedLab);
staleLinks.placedDevices[0].linkedVesselId="stored-vessel";
staleLinks.placedDevices[0].active=true;
staleLinks.stirringVesselId="stored-vessel";
staleLinks.instrumentTarget={kind:"tripod",vesselId:"stored-vessel"};
staleLinks.titrationPair={sourceId:"stored-vessel",targetId:"v1"};
staleLinks.vessels[0].buretteTargetId="stored-vessel";
const restoredLinks=parseLab(staleLinks).items[0].scienceLabBench;
assert.equal(restoredLinks.placedDevices[0].linkedVesselId,undefined);
assert.equal(restoredLinks.placedDevices[0].active,false);
assert.equal(restoredLinks.stirringVesselId,undefined);
assert.equal(restoredLinks.instrumentTarget,undefined);
assert.equal(restoredLinks.titrationPair,undefined);
assert.equal(restoredLinks.vessels[0].buretteTargetId,undefined);
const fortyComponents=structuredClone(persistedLab);
fortyComponents.vessels[0].reactionAmounts={
 equation:"NaCl → NaCl",elapsedSeconds:1,durationSeconds:2,
 extentMol:1,maxExtentMol:1,complete:false,
 initialMol:Object.fromEntries(Array.from({length:36},(_,n)=>["S"+n,.001])),
 remainingMol:Object.fromEntries(Array.from({length:36},(_,n)=>["S"+n,.001])),
 productsMol:{}
};
assert.equal(Object.keys(parseLab(fortyComponents).items[0].scienceLabBench
 .vessels[0].reactionAmounts.initialMol).length,36,
 "Reaction inventories within the 48-substance engine limit must reopen");
/* The chemistry engine allows 48 distinct reagents, but the old board
 * validator accepted only six reagents/dose keys. A correct saved 7-component
 * mixture made the whole collaborative board appear damaged and unreadable. */
const compoundIds=["NaCl","AgNO3","HCl","NaOH","CuSO4","BaCl2","Na2SO4"];
const complexSaved=structuredClone(persistedLab);
complexSaved.vessels[0].reagents=[...compoundIds];
complexSaved.vessels[0].doses=Object.fromEntries(
 compoundIds.map(id=>[id,{value:2,unit:"ml",concentrationM:.1}]));
const restoredComplex=parseLab(complexSaved);
assert.deepEqual(restoredComplex.items[0].scienceLabBench.vessels[0].reagents,compoundIds,
 "Previously rejected 7-reagent mixtures must reopen without losing a reagent");
assert.equal(Object.keys(restoredComplex.items[0].scienceLabBench.vessels[0].doses).length,7,
 "All saved reagent volumes and concentrations must survive loading");
assert.equal(restoredComplex.items[1].text,"Работа ученика",
 "The whole board, including unrelated student work, must remain available");
const maxLabReagents=lab.MAX_VESSEL_REAGENTS;
const maxSaved=structuredClone(persistedLab);
const fullIds=reaction.substances.slice(0,maxLabReagents).map(s=>s.id);
assert.equal(fullIds.length,48,"Vetted substance catalog must cover the bounded lab");
maxSaved.vessels[0].reagents=fullIds;
maxSaved.vessels[0].doses=Object.fromEntries(
 fullIds.map(id=>[id,{value:.1,unit:"g"}]));
assert.doesNotThrow(()=>parseLab(maxSaved),
 "All 48 supported reagents and measured dose records must be loadable");
const overLimit=structuredClone(maxSaved);
overLimit.vessels[0].reagents.push("unsupported-forty-ninth");
assert.throws(()=>parseLab(overLimit),/Повреждено состояние химического стола/,
 "Reject samples beyond the supported maximum, not legitimate multi-stage mixtures");
const invalidMass=structuredClone(complexSaved);
invalidMass.vessels[0].doses.NaCl.value=-4;
assert.throws(()=>parseLab(invalidMass),/Повреждено состояние химического стола/,
 "Negative amounts remain forbidden even in old saved boards");
const validatorText=read("src/boardModel.ts");
assert.match(validatorText,/const maxSavedLabReagents=48/);
assert.equal(maxLabReagents,Number(validatorText.match(/const maxSavedLabReagents=(\d+)/)?.[1]),
 "Persisted lab and runtime chemistry must agree on their compound limit");
console.log("Seven- and forty-eight-reagent boards reopen with all quantities intact");
assert.equal(reopened.items[0].scienceLabBench.placedDevices[0].temperatureC,1333,
 "Restoring a hot burner must never silently reset the apparatus");
assert.equal(reopened.items[0].scienceLabBench.vessels[2].temperatureC,220.1);
assert.equal(reopened.items[1].text,"Работа ученика");
const burnerNearPeak=structuredClone(persistedLab);
burnerNearPeak.placedDevices[0].temperatureC=1350;
burnerNearPeak.vessels[2].temperatureC=1250;
assert.doesNotThrow(()=>parseLab(burnerNearPeak),
 "The maximum reachable virtual burner and crucible temperature must be accepted");
const badBurner=structuredClone(persistedLab);
badBurner.placedDevices[0].temperatureC=2000;
assert.throws(()=>parseLab(badBurner),/Повреждено состояние химического стола/,
 "Implausible temperatures must still be rejected");
const badVessel=structuredClone(persistedLab);
badVessel.vessels[2].temperatureC=1400;
assert.doesNotThrow(()=>parseLab(badVessel),
 "High virtual heating above the previous vessel cap is valid");
badVessel.vessels[2].temperatureC=2000;
assert.throws(()=>parseLab(badVessel),/Повреждено состояние химического стола/);
const safeThermo=structuredClone(persistedLab);
safeThermo.vessels[2].meltFraction=.5;
safeThermo.vessels[2].phaseTransition="melting";
safeThermo.vessels[2].reactionHeat={equation:"HCl + NaOH → NaCl + H2O",
 direction:"exothermic",elapsedSeconds:2,durationSeconds:4,deltaC:5,complete:false};
assert.doesNotThrow(()=>parseLab(safeThermo),
 "Persisted molten fraction and reaction heat must survive board reopening");
const brokenThermo=structuredClone(safeThermo);
brokenThermo.vessels[2].meltFraction=2;
assert.throws(()=>parseLab(brokenThermo),/Повреждено состояние химического стола/);
brokenThermo.vessels[2].meltFraction=.5;
brokenThermo.vessels[2].reactionHeat.deltaC=-5;
assert.throws(()=>parseLab(brokenThermo),/Повреждено состояние химического стола/);
console.log("Persisted high-temperature laboratory reopened without losing other objects");


/* Reaction chalkboard remains persistent between collaborators and saves. */
assert.equal(lab.labMode(detailedBench()),"reactions");
assert.equal(lab.labMode({...detailedBench(),mode:"qualitative"}),"reactions");
assert.equal(lab.labMode({...detailedBench(),mode:"quantitative"}),"reactions");
const chalkSource=lab.putLabReagent(detailedBench(),"v1","NaCl",
 {value:10,unit:"ml",concentrationM:.1});
const chalkReacted=lab.putLabReagent(chalkSource,"v1","AgNO3",
 {value:10,unit:"ml",concentrationM:.1});
// The wall records observed progress, never a merely predicted
// reaction or a paused preparation. This follows the live simulator's
// "reaction first, chalk later" contract.
assert.equal(lab.recordLabReactions(chalkReacted),chalkReacted,
 "Mixing before a simulation tick must not write a predicted equation");
const pausedChalk=lab.setLabSimulationPaused(chalkReacted,true,0);
assert.equal(lab.recordLabReactions(pausedChalk),pausedChalk,
 "A paused preparation cannot write a predicted equation");
const chalkReactedProgressed=lab.advanceLabSimulation(
 lab.advanceLabSimulation(chalkReacted,0),6000);
let chalk=lab.recordLabReactions(chalkReactedProgressed);
assert.equal(chalk.reactionLog.length,1,
 "An actually progressed reaction is added to the permanent wall");
assert.match(chalk.reactionLog[0],/AgCl↓/);
assert.equal(lab.recordLabReactions(chalk),chalk,
 "Simulation ticks must not duplicate previously recorded equations");
chalk=lab.wipeLabChalkboard(chalk);
assert.deepEqual(chalk.reactionLog,[]);
assert.equal(lab.recordLabReactions(chalk),chalk,
 "A wiped but ongoing reaction must not magically reappear");
let nextReaction=lab.emptyLabVessel(chalk,"v1");
nextReaction=lab.putLabReagent(nextReaction,"v1","HCl",
 {value:20,unit:"ml",concentrationM:.1});
nextReaction=lab.putLabReagent(nextReaction,"v1","NaOH",
 {value:20,unit:"ml",concentrationM:.1});
assert.equal(lab.recordLabReactions(nextReaction),nextReaction,
 "Unstarted neutralization must not appear on the chalkboard");
nextReaction=lab.advanceLabSimulation(
 lab.advanceLabSimulation(nextReaction,10000),16000);
nextReaction=lab.recordLabReactions(nextReaction);
assert.equal(nextReaction.reactionLog.length,1);
assert.match(nextReaction.reactionLog[0],/NaCl \+ H2O/);
let measuredSediment=lab.advanceLabSimulation(chalkReacted,0);
measuredSediment=lab.advanceLabSimulation(measuredSediment,1000);
measuredSediment=lab.advanceLabSimulation(measuredSediment,6000);
const physical=lab.labVesselContents(measuredSediment.vessels[0]);
assert.ok(physical.solutionMl>=19.9&&physical.solutionMl<=20.1);
assert.equal(physical.solid.length,1);
assert.equal(physical.solid[0].formula,"AgCl");
assert.ok(physical.precipitateG>.1432&&physical.precipitateG<.14332,
 "Actual precipitate mass must respect remaining soluble material at Ksp equilibrium");
assert.ok(physical.precipitateFraction>0&&physical.precipitateFraction<.01);
assert.ok(physical.solution.some(v=>v.formula==="NaNO3"));
assert.ok(!physical.solution.some(v=>v.formula==="AgCl"),
 "Insoluble AgCl must not appear in the dissolved-products list");
assert.ok(physical.precipitateVolumeMl<physical.solutionMl);
const halfPrecipitation=lab.labVesselContents({...measuredSediment.vessels[0],
 reactionAmounts:{...measuredSediment.vessels[0].reactionAmounts,
  productsMol:Object.fromEntries(Object.entries(
   measuredSediment.vessels[0].reactionAmounts.productsMol).map(([id,m])=>[id,m/2]))}});
assert.ok(Math.abs(halfPrecipitation.precipitateG/physical.precipitateG-1)<1e-8,
 "Legacy animation progress must not override the conserved equilibrium inventory");
const labUi=read("src/LektrusChemistryBench.tsx");
assert.doesNotMatch(labUi,/className="lektrus-lab-worktop-actions"/,
 "Floating indicator/environment/pour toolbar must be removed");
assert.match(labUi,/lektrus-lab-indicator-cupboard/);
assert.match(labUi,/wipeLabChalkboard\(bench\)/);
assert.match(labUi,/recordLabReactions\(current\)/);
assert.match(labUi,/lektrus-lab-quantity-info/);
assert.doesNotMatch(labUi,/className="lektrus-lab-vessel-composition"/,
 "No composition popup separate from volume/mass gauges");
assert.match(labUi,/contents\.precipitateFraction/);
assert.match(read("src/lektrusChemistryBench.css"),/lektrus-lab-indicator-shelf/);
const labWithBoard={
 ...persistedLab,mode:"reactions",reactionLog:[nextReaction.reactionLog[0]],
 seenReactionKeys:nextReaction.seenReactionKeys
};
assert.doesNotThrow(()=>parseLab(labWithBoard),
 "Persistent equations and the unified reaction mode are valid save data");
console.log("Cabinets, reaction history, and proportional precipitate regression passed");

const originalShared=lab.recordLabReactions(chalkReactedProgressed);
const localShared={...originalShared,reactionLog:[...originalShared.reactionLog,
 "CaCO3 → CaO + CO2↑"],event:originalShared.event+1};
const remoteShared={...originalShared,reactionLog:[...originalShared.reactionLog,
 "HCl + NaOH → NaCl + H2O"],event:originalShared.event+1};
const mergedEquations=lab.mergeLabBench(originalShared,localShared,remoteShared);
assert.equal(mergedEquations.reactionLog.length,3,
 "Concurrent participants cannot erase each other's written equations");
const erasedShared=lab.wipeLabChalkboard(originalShared);
const mergedAfterWipe=lab.mergeLabBench(originalShared,erasedShared,originalShared);
assert.deepEqual(mergedAfterWipe.reactionLog,[],
 "A wipe must survive a concurrent stale write without restoring erased equations");
const mergedWithPeer=lab.mergeLabBench(originalShared,erasedShared,remoteShared);
assert.deepEqual(mergedWithPeer.reactionLog,["HCl + NaOH → NaCl + H2O"],
 "A later new peer equation may survive a wipe without resurrecting old equations");
assert.ok(mergedWithPeer.seenReactionKeys.length>0,
 "Wiped recorded keys stay in sync so old reactions do not reappear");
console.log("Shared chalkboard: concurrent writes and explicit erasing passed");


const plainQualitative=lab.putLabReagent(
 lab.putLabReagent(detailedBench(),"v1","NaCl"),"v1","AgNO3");
const qualContents=lab.labVesselContents(plainQualitative.vessels[0]);
assert.deepEqual(qualContents.solid.map(v=>v.formula),["AgCl"],
 "Qualitative reaction must show the insoluble product, not the initial reagent list");
assert.ok(qualContents.solution.some(v=>v.formula==="NaNO3"));
assert.ok((qualContents.solution.find(v=>v.formula==="AgNO3")?.mmol??0)<.001,
 "Ksp equilibrium allows a trace of dissolved silver nitrate rather than zero");
assert.ok(qualContents.precipitateG>0,
 "Default reagent stocks have known concentrations and must yield real mass");
const trulyUnmeasured=lab.labVesselContents({...plainQualitative.vessels[0],doses:undefined});
assert.equal(trulyUnmeasured.precipitateG,undefined,
 "Legacy samples without measured doses must never invent mass");
assert.equal(trulyUnmeasured.remainderUnknown,true);
console.log("Qualitative chemistry shows products, not fabricated residue masses");


/* An empty worktop click must deselect without moving/emptying any vessel. */
let pickedVessel=lab.addLabVessel(detailedBench(),"tube");
const pickedId=pickedVessel.selectedId;
const beforeDeselect=JSON.stringify(pickedVessel.vessels);
pickedVessel=lab.selectLabVessel(pickedVessel,"");
assert.equal(pickedVessel.selectedId,"");
assert.equal(JSON.stringify(pickedVessel.vessels),beforeDeselect,
 "Clearing selection cannot change the chemistry or locations of glassware");
assert.equal(lab.selectLabVessel(pickedVessel,""),pickedVessel,
 "A second click on the empty worktop is a no-op");
const reselected=lab.selectLabVessel(pickedVessel,pickedId);
assert.equal(reselected.selectedId,pickedId);
assert.equal(lab.selectLabVessel(reselected,"missing"),reselected,
 "An invalid vessel ID must not clear the current selection");
const removedSelection=lab.mergeLabBench(reselected,
 lab.selectLabVessel(reselected,""),reselected);
assert.equal(removedSelection.selectedId,"",
 "Peer merge must not silently reselect the first glassware");
assert.match(labUi,/onSelect\?\.\(""\)/);
assert.match(labUi,/closest\("\[data-board-interactive\]"\)/,
 "Clicks on a vessel or interactive cabinet must not trigger deselection");
assert.match(labUi,/lektrus-lab-quantity-meter/);
assert.match(labUi,/lektrus-lab-quantity-info is-solution/);
assert.match(labUi,/lektrus-lab-quantity-info is-residue/);
assert.match(labUi,/readoutLeft=\{p\.x>62\}/,
 "Right-edge vessels must show readout toward the middle of the worktop");
assert.doesNotMatch(labUi,/details&&<div className="lektrus-lab-vessel-composition"/);
console.log("Lab selection, inline blue/brown contents, and spatial readouts passed");


const sideReadoutCss=read("src/lektrusChemistryBench.css");
assert.match(sideReadoutCss,/left:calc\(100% \+ 8px\)!important;right:auto!important/,
 "Selected vessel composition must sit completely to its side");
assert.match(sideReadoutCss,/right:calc\(100% \+ 8px\)!important/,
 "Right-hand glassware needs an inward-facing side readout");
assert.match(sideReadoutCss,/max-width:154px!important/,
 "Readout must remain compact");
assert.match(sideReadoutCss,/pointer-events:none!important/,
 "Side contents must not block picking or dragging glassware");
console.log("Compact side composition labels do not overlay the vessel");

const sideGaugeLayout=read("src/lektrusChemistryBench.css");
assert.match(sideGaugeLayout,/left:calc\(100% \+ 23px\)!important/,
 "Side gauges must clear the right vessel edge");
assert.match(sideGaugeLayout,/right:calc\(100% \+ 23px\)!important/,
 "Right-edge vessels must keep gauges outside their left edge");
assert.match(sideGaugeLayout,/grid-template-columns:6px 27px minmax\(0,1fr\)/,
 "Mass, volume and composition need separate nonoverlapping columns");
assert.match(sideGaugeLayout,/width:152px!important/,
 "Compact badge should have a bounded but legible width");
console.log("Side gauges are separated from vessel and use nonoverlapping columns");


/* Solution indicators are liquids added to the sample, not test paper.
 * They change the actual liquid tint as titration crosses the endpoint.
 * The universal indicator remains a separate strip and does not dye it. */
const labAfterIndicator=lab.setLabIndicator(
 lab.putLabReagent(detailedBench(),"v1","NaOH",
  {value:25,unit:"ml",concentrationM:.1}),"v1","phenolphthalein");
assert.equal(labAfterIndicator.vessels[0].indicatorDrops,1);
assert.equal(lab.labIndicatorResult(labAfterIndicator.vessels[0]).color,"#d83a96");
assert.equal(labAfterIndicator.vessels[0].doses.NaOH.value,25,
 "Adding trace indicator must not alter stoichiometric analyte concentration");
const repeated=lab.setLabIndicator(labAfterIndicator,"v1","phenolphthalein");
assert.equal(repeated.vessels[0].indicatorDrops,2,
 "A second click adds another indicator drop rather than removing indicator");
assert.ok(repeated.vessels[0].indicatorAddedAtMs>0);
const paper=lab.setLabIndicator(repeated,"v1","universal");
assert.equal(paper.vessels[0].indicator,"universal");
assert.equal(paper.vessels[0].indicatorDrops,undefined,
 "Universal indicator is a paper strip, not a liquid added to the flask");
assert.equal(lab.setLabIndicator(paper,"v1","universal"),paper,
 "Pressing the same universal strip twice must not create extra reagent");
const emptyLiquid=lab.putLabReagent(detailedBench(),"v1","Na",
 {value:2,unit:"g"});
assert.equal(lab.setLabIndicator(emptyLiquid,"v1","litmus"),emptyLiquid,
 "A liquid indicator cannot be added to a dry metal");
const rinsed=lab.emptyLabVessel(repeated,"v1").vessels[0];
assert.equal(rinsed.indicatorDrops,undefined);
assert.equal(rinsed.indicatorAddedAtMs,undefined);

let endpointBench=lab.putLabReagent(detailedBench(),"v1","HCl",
 {value:25,unit:"ml",concentrationM:.1});
endpointBench=lab.setLabIndicator(endpointBench,"v1","phenolphthalein");
endpointBench=lab.addLabVessel(endpointBench,"burette");
const endpointBurette=endpointBench.vessels.find(v=>v.kind==="burette").id;
endpointBench=lab.putLabReagent(endpointBench,endpointBurette,"NaOH",
 {value:30,unit:"ml",concentrationM:.1});
endpointBench=lab.dripLabVessel(endpointBench,endpointBurette,"v1",24);
let endpointReading=titration.titrationReading(endpointBench.titration);
assert.ok(endpointReading.pH<7);
assert.equal(endpointReading.tint,"#dcecef","Phenolphthalein is colorless before endpoint");
endpointBench=lab.dripLabVessel(endpointBench,endpointBurette,"v1",1);
endpointReading=titration.titrationReading(endpointBench.titration);
assert.equal(endpointReading.pH,7);
assert.equal(endpointReading.tint,"#dcecef","Phenolphthalein remains colorless at pH 7");
endpointBench=lab.dripLabVessel(endpointBench,endpointBurette,"v1",.1);
endpointReading=titration.titrationReading(endpointBench.titration);
assert.ok(endpointReading.pH>8.2,"Slight excess base changes the indicator");
assert.notEqual(endpointReading.tint,"#dcecef");
assert.equal(endpointBench.vessels[0].indicator,"phenolphthalein");
assert.equal(endpointBench.vessels[0].indicatorDrops,1);
const storedDrops={...persistedLab,vessels:[{...persistedLab.vessels[0],
 indicator:"litmus",reagents:["H2O"],indicatorDrops:3,indicatorAddedAtMs:Date.now()},
 ...persistedLab.vessels.slice(1)]};
assert.doesNotThrow(()=>parseLab(storedDrops),
 "Indicator drops and their timestamp must persist with shared board document");
const corruptDrops={...storedDrops,vessels:[{...storedDrops.vessels[0],indicatorDrops:30},
 ...storedDrops.vessels.slice(1)]};
assert.throws(()=>parseLab(corruptDrops),/Повреждено состояние химического стола/);
const uiIndicators=read("src/LektrusChemistryBench.tsx");
assert.match(uiIndicators,/indicator\.form==="solution"/);
assert.match(uiIndicators,/lektrus-lab-indicator-bottle/);
assert.match(uiIndicators,/lektrus-lab-indicator-paper/);
assert.match(uiIndicators,/vessel\.indicator==="universal"/);
assert.match(uiIndicators,/isLiquidIndicator\?/);
assert.match(uiIndicators,/titrationReading\(\{\.\.\.bench\.titration,indicator:v\.indicator/);
const indicatorCss=read("src/lektrusChemistryBench.css");
assert.match(indicatorCss,/left:calc\(100% \+ 11px\)!important/,
 "Composition plaque should return close to the vessel");
assert.match(indicatorCss,/right:calc\(100% \+ 11px\)!important/);
console.log("Indicator solution dosing, universal paper, pH-titration color transitions and readout spacing passed");


let liquidTransfer=lab.putLabReagent(detailedBench(),"v1","HCl",
 {value:12,unit:"ml",concentrationM:.1});
liquidTransfer=lab.setLabIndicator(liquidTransfer,"v1","methyl-orange");
liquidTransfer=lab.addLabVessel(liquidTransfer,"tube");
const liquidReceiverId=liquidTransfer.vessels.find(v=>v.id!=="v1").id;
liquidTransfer=lab.pourLabVessel(liquidTransfer,"v1",liquidReceiverId);
assert.equal(liquidTransfer.vessels.find(v=>v.id===liquidReceiverId).indicator,"methyl-orange",
 "Indicator solution must travel with poured liquid");
assert.equal(liquidTransfer.vessels.find(v=>v.id===liquidReceiverId).indicatorDrops,1);
assert.equal(liquidTransfer.vessels.find(v=>v.id==="v1").indicatorDrops,undefined,
 "The emptied source cannot keep liquid indicator");


/* pH must follow measured species and volumes, not the old acid/base label. */
const idealAcid={reagents:["HCl"],environment:"aqueous",doses:{
 HCl:{value:20,unit:"ml",concentrationM:.1}}};
assert.equal(acidBase.labVesselPH(idealAcid).pH,1);
const dilution={reagents:["HCl","H2O"],environment:"aqueous",doses:{
 HCl:{value:20,unit:"ml",concentrationM:.1},H2O:{value:20,unit:"ml"}}};
assert.ok(Math.abs(acidBase.labVesselPH(dilution).pH-1.30)<.02);
assert.equal(acidBase.labVesselPH({reagents:["NaOH"],environment:"aqueous",
 doses:{NaOH:{value:20,unit:"ml",concentrationM:.1}}}).pH,12.99);
const perfectNeutral={reagents:["HCl","NaOH"],environment:"aqueous",doses:{
 HCl:{value:20,unit:"ml",concentrationM:.1},
 NaOH:{value:20,unit:"ml",concentrationM:.1}}};
assert.equal(acidBase.labVesselPH(perfectNeutral).pH,7);
assert.ok(acidBase.labVesselPH({...perfectNeutral,doses:{...perfectNeutral.doses,
 NaOH:{value:10,unit:"ml",concentrationM:.1}}}).pH<2);
assert.ok(acidBase.labVesselPH({...perfectNeutral,doses:{...perfectNeutral.doses,
 NaOH:{value:30,unit:"ml",concentrationM:.1}}}).pH>12);
assert.equal(acidBase.labVesselPH({reagents:["HCl"],environment:"aqueous",
 doses:{HCl:{value:20,unit:"ml"}}}).pH,1,
 "Legacy school stock uses the same 0.1 M default for pH and stoichiometry");
assert.ok(acidBase.labVesselPH({reagents:["HCl","CuSO4"],environment:"aqueous",
 doses:{HCl:{value:20,unit:"ml",concentrationM:.1},CuSO4:{value:10,unit:"ml"}}}).pH<2,
 "Mixed copper salt must preserve strong-acid direction");
assert.ok(Math.abs(acidBase.labVesselPH({reagents:["CH3COOH"],environment:"aqueous",
 doses:{CH3COOH:{value:20,unit:"ml",concentrationM:.1}}}).pH-2.88)<.04);
assert.ok(Math.abs(acidBase.labVesselPH({reagents:["CH3COOH","NaOH"],environment:"aqueous",
 doses:{CH3COOH:{value:20,unit:"ml",concentrationM:.1},
 NaOH:{value:10,unit:"ml",concentrationM:.1}}}).pH-4.74)<.04);
assert.equal(acidBase.labIndicatorTint("phenolphthalein",7),undefined);
assert.equal(acidBase.labIndicatorTint("phenolphthalein",13),"#d83a96");
assert.equal(acidBase.labIndicatorTint("methyl-orange",2),"#db4444");
assert.equal(acidBase.labIndicatorTint("methyl-orange",6),"#efc94b");
assert.equal(acidBase.labIndicatorTint("litmus",1),"#d85761");
assert.equal(acidBase.labIndicatorTint("litmus",13),"#426cce");
let phBeaker=lab.putLabReagent(detailedBench(),"v1","HCl",
 {value:20,unit:"ml",concentrationM:.1});
phBeaker=lab.setLabIndicator(phBeaker,"v1","phenolphthalein");
assert.equal(lab.labIndicatorResult(phBeaker.vessels[0]).pH,1);
phBeaker=lab.putLabReagent(phBeaker,"v1","NaOH",
 {value:20,unit:"ml",concentrationM:.1});
assert.ok(Math.abs(lab.labIndicatorResult(phBeaker.vessels[0]).pH-
 waterIonization.labNeutralWaterPH(phBeaker.vessels[0].temperatureC??25))<.015,
 "Equivalence point follows neutral-water pH at actual vessel temperature");
assert.equal(lab.labIndicatorResult(phBeaker.vessels[0]).color,undefined,
 "Phenolphthalein is colorless at strong acid/base equivalence");
const phOther=lab.putLabReagent(detailedBench(),"v1","HCl",
 {value:20,unit:"ml",concentrationM:.1});
assert.equal(acidBase.labVesselPH(phOther.vessels[0]).pH,1);
assert.match(read("src/LektrusChemistryBench.tsx"),/const ph=labVesselPH\(vessel\)/);
assert.match(read("src/LektrusChemistryBench.tsx"),/lektrus-lab-inline-ph/);
assert.match(read("src/lektrusChemistryBench.css"),/left:calc\(100% \+ 6px\)/);
/* Temperature-dependent ionization from IAPWS pKw (liquid water). */
for(const [t,pKw] of [[0,14.95],[25,13.99],[50,13.26],
 [75,12.70],[100,12.25]]){
 assert.ok(Math.abs(waterIonization.labWaterPKw(t)-pKw)<1e-9);
 const neutralPH=waterIonization.labNeutralWaterPH(t);
 assert.ok(Math.abs(neutralPH-pKw/2)<1e-9);
 const pure=acidBase.labVesselPH({reagents:["H2O"],environment:"aqueous",
  temperatureC:t,doses:{H2O:{value:20,unit:"ml"}}});
 assert.ok(Math.abs(pure.pH-neutralPH)<.008,
  "Neutral-water pH must track temperature; neutral does not mean pH 7");
}
assert.equal(waterIonization.labWaterPKw(-1),undefined);
assert.equal(waterIonization.labWaterPKw(110),undefined);
const strongAt50=acidBase.labVesselPH({...perfectNeutral,temperatureC:50});
assert.ok(Math.abs(strongAt50.pH-6.63)<.02,
 "Strong acid/base equivalence at 50C reflects water Kw, not pH 7");
const baseAt50=acidBase.labVesselPH({reagents:["NaOH"],
 environment:"aqueous",temperatureC:50,
 doses:{NaOH:{value:20,unit:"ml",concentrationM:.1}}});
assert.ok(Math.abs(baseAt50.pH-12.26)<.02,
 "Known strong hydroxide pH must use pKw(T)");
assert.ok(acidBase.labVesselPH({reagents:["CH3COOH"],environment:"aqueous",
 temperatureC:60,doses:{CH3COOH:{value:20,unit:"ml",concentrationM:.1}}}).pH>2,
 "Weak-acid Ka at 60C is an explicitly labelled school approximation");
assert.equal(acidBase.labVesselPH({...perfectNeutral,temperatureC:110}),null);
console.log("Measured strong/weak acid-base equilibrium and indicator colours passed");


/* Every catalog stock, including previous quick-slot presets, has a measured
 * amount and a known prepared-solution molarity before it enters glassware. */
const stockIds=reaction.substances;
for(const item of stockIds){
 const stock=catalog.labDefaultStockDose(item.id);
 assert.ok(stock&&Number.isFinite(stock.value)&&stock.value>0,
  "No stock recipe for "+item.id);
 if(catalog.labIsPreparedStock(item.id)){
  assert.equal(stock.concentrationM,.1,"Missing 0.1M stock for "+item.id);
  assert.ok(Math.abs(chem.labDoseMoles(item.id,stock)-.001)<1e-9,
   "Moles of "+item.id+" should be measurable");
 }else{
  assert.equal(stock.concentrationM,undefined,
   "Neat liquid, gas or solid "+item.id+" cannot be assigned fake molarity");
 }
}
let noDose=lab.putLabReagent(detailedBench(),"v1","AgNO3");
assert.deepEqual(noDose.vessels[0].doses.AgNO3,
 {value:10,unit:"ml",concentrationM:.1});
const quicks=lab.labQuickReagents(detailedBench());
assert.ok(quicks.every(q=>q.dose.value>0));
assert.ok(quicks.filter(q=>q.dose.unit==="ml"&&catalog.labIsPreparedStock(q.id))
 .every(q=>q.dose.concentrationM===.1),
 "Only prepared liquid stock requires molarity; dry NaCl is measured by mass");
let mixedConcentrations=lab.putLabReagent(detailedBench(),"v1","HCl",
 {value:10,unit:"ml",concentrationM:.1});
mixedConcentrations=lab.putLabReagent(mixedConcentrations,"v1","HCl",
 {value:10,unit:"ml",concentrationM:.3});
assert.equal(mixedConcentrations.vessels[0].doses.HCl.value,20);
assert.ok(Math.abs(mixedConcentrations.vessels[0].doses.HCl.concentrationM-.2)<1e-10);
assert.ok(Math.abs(chem.labDoseMoles("HCl",mixedConcentrations.vessels[0].doses.HCl)-.004)<1e-10);
assert.ok(Math.abs(chem.labDoseMoles("H2O",{value:18,unit:"g"})-1)<.02);
assert.ok(Math.abs(chem.labDoseMoles("CO2",{value:24.465,unit:"ml"})-.001)<1e-9,
 "Gas volumes use a documented 25C/1atm reference");
assert.ok(Math.abs(chem.labDoseMoles("C2H5OH",{value:10,unit:"ml"})-
  10*calorimetry.LAB_CALORIMETRY_REFERENCE.C2H5OH.densityGPerMl/
   chem.labMolarMass("C2H5OH"))<1e-10,
 "A pure ethanol portion must use the same measured density in thermodynamics and mole inventory");
assert.ok(Math.abs(chem.labDoseMoles("HCl",{value:10,unit:"ml"})-.001)<1e-12,
 "Legacy prepared acid stock uses the school's default 0.1 M");
assert.match(read("src/LektrusChemistryBench.tsx"),/labIsPreparedStock\(reagent\.id\)/);
assert.match(read("src/lektrusLabExperimentKits.ts"),/labDefaultStockDose\(id,unit\)/,
 "Ready experiments must use measured catalogue stock doses in their own kit module");
console.log("Quantified stocks, reproducible molarity and moles by known physical dose: OK");


/** Every published balanced reaction must have a computable extent with the
 * catalogue's internally defined doses, including gas and neat-liquid stock. */
let allQuantified=0;
for(const row of reaction.reviewedReactionCases.filter(r=>r.status==="reaction")){
 const doses=Object.fromEntries(row.reactants.map(id=>[id,catalog.labDefaultStockDose(id)]));
 assert.ok(Object.values(doses).every(Boolean),"Missing input stock for "+row.equation);
 const state=chem.startQuantifiedLabReaction(row,row.reactants,doses);
 assert.ok(state&&Number.isFinite(state.maxExtentMol)&&state.maxExtentMol>0,
  "No mathematical reaction extent for "+row.equation);
 const result=chem.advanceQuantifiedLabReaction(state,state.durationSeconds);
 assert.equal(result.complete,true);
 const sum=(entries)=>Object.entries(entries).reduce((acc,[id,mol])=>
  acc+mol*chem.labMolarMass(id),0);
 const reactantsMass=sum(state.initialMol);
 const productsMass=sum(result.productsMol)+sum(result.remainingMol);
 assert.ok(Math.abs(reactantsMass-productsMass)<1e-5*Math.max(1,reactantsMass),
  "Mass conservation violation for "+row.equation);
 allQuantified++;
}
assert.ok(allQuantified>=300);
console.log("All "+allQuantified+" reviewed reaction equations quantified and mass-conserving");


/* Regression: NaCl + H2O + AgNO3 is not a list of unchanged inputs.
 * AgCl sediment must survive indicator, dilution and extra additions. */
let preserved=detailedBench();
preserved=lab.putLabReagent(preserved,"v1","NaCl",
 {unit:"ml",value:10,concentrationM:.1});
preserved=lab.putLabReagent(preserved,"v1","H2O",{unit:"ml",value:70});
preserved=lab.putLabReagent(preserved,"v1","AgNO3",
 {unit:"ml",value:10,concentrationM:.1});
assert.equal(lab.labObservation(preserved.vessels[0]).status,"reaction");
preserved=lab.advanceLabSimulation(preserved,0);
preserved=lab.advanceLabSimulation(preserved,1000);
preserved=lab.advanceLabSimulation(preserved,6500);
assert.equal(preserved.vessels[0].reactionAmounts?.complete,true);
const beforeDye=lab.labVesselContents(preserved.vessels[0]);
assert.equal(beforeDye.solutionMl,90);
assert.equal(beforeDye.solid[0].formula,"AgCl");
assert.ok(beforeDye.precipitateG>.143&&beforeDye.precipitateG<.14332,
 "Precipitate mass includes the dilute equilibrium dissolved residue");
assert.ok(beforeDye.solution.some(x=>x.formula==="NaNO3"));
assert.ok((beforeDye.solution.find(x=>x.formula==="AgNO3")?.mmol??0)<.002,
 "Dissolved silver remains at the small equilibrium concentration");
const traceSilverPH=acidBase.labVesselPH(preserved.vessels[0]);
assert.ok(traceSilverPH&&traceSilverPH.pH>=4&&traceSilverPH.pH<=9,
 "Trace AgNO3 hydrolysis is bounded by the remaining dissolved silver");
assert.match(traceSilverPH.note,/Школьная приближённая/,
 "The pH of dilute transition-metal salts is labelled approximate");
const measuredBefore=JSON.stringify(preserved.vessels[0].reactionAmounts);
preserved=lab.setLabIndicator(preserved,"v1","litmus");
assert.equal(JSON.stringify(preserved.vessels[0].reactionAmounts),measuredBefore,
 "Indicator drops must not destroy the reaction mass ledger");
assert.equal(lab.labVesselContents(preserved.vessels[0]).solid[0].formula,"AgCl");
assert.ok(lab.labVesselContents(preserved.vessels[0]).precipitateG>.143,
 "Indicator addition cannot remove previously precipitated AgCl");
preserved=lab.putLabReagent(preserved,"v1","H2O",{unit:"ml",value:10});
assert.equal(preserved.vessels[0].uncertain,false);
assert.equal(lab.labVesselContents(preserved.vessels[0]).solutionMl,100);
assert.equal(lab.labVesselContents(preserved.vessels[0]).solid[0].formula,"AgCl");
assert.ok(lab.labVesselContents(preserved.vessels[0]).precipitateG>.143,
 "Dilution slightly changes AgCl equilibrium but does not erase the solid");
preserved=lab.putLabReagent(preserved,"v1","AgNO3",
 {unit:"ml",value:10,concentrationM:.1});
assert.equal(lab.labVesselContents(preserved.vessels[0]).solid[0].formula,"AgCl",
 "Re-dosing an original reactant must keep the old precipitate");
assert.ok(lab.labVesselContents(preserved.vessels[0]).precipitateG>.143,
 "Adding more silver nitrate changes equilibrium without removing the formed AgCl");
preserved=lab.putLabReagent(preserved,"v1","CuSO4",
 {unit:"ml",value:10,concentrationM:.1});
assert.equal(lab.labVesselContents(preserved.vessels[0]).solid[0].formula,"AgCl",
 "Even unsupported next-stage chemistry must not delete a known solid");
assert.ok(lab.labVesselContents(preserved.vessels[0]).precipitateG>.143,
 "Additional neutral solute must not make a known solid disappear");
assert.ok(lab.labVesselContents(preserved.vessels[0]).solution.some(v=>
 v.formula==="CuSO4"&&Math.abs(v.mmol-1)<1e-6),
 "New measured stock must remain visible beside pre-existing AgCl");
assert.match(read("src/LektrusChemistryBench.tsx"),
 /measuredPrecipitateG>1e-10/,
 "The renderer must show measured solid rather than an equilibrium deposit prematurely");
assert.match(read("src/LektrusChemistryBench.tsx"),
 /!vessel.chemicalInventory&&!vessel.filteredResidue/,
 "An existing persistent precipitate must not fade while another reaction starts");
const essentialIds=lab.defaultLabQuickReagents().map(v=>v.id);
assert.equal(essentialIds.length,12);
assert.equal(new Set(essentialIds).size,12);
for(const required of ["H2O","HCl","H2SO4","NaOH","AgNO3","NaCl",
 "BaCl2","CuSO4","Na2CO3","KI","CaCO3","Na"]){
 assert.ok(essentialIds.includes(required),"Missing high-utility quick reagent "+required);
}
assert.ok(lab.defaultLabQuickReagents().every(x=>x.dose.value>0));
console.log("AgCl survives dye, dilution, repeat dosing and further chemistry; essentials shelf OK");

/* The precise physical vapor model integrates with the shared bench and
 * every participant sees a conserved ventilated loss, not local-only FX. */
const neatBeaker=lab.putLabReagent(detailedBench(),"v1","C2H5OH",
 {unit:"ml",value:20});
const roomEvap=lab.advanceLabSimulation(
 lab.advanceLabSimulation(neatBeaker,100000),110000);
const afterRoom=roomEvap.vessels[0];
assert.ok(lab.labVesselQuantity(afterRoom).volumeMl<20,
 "Ethanol evaporates before boiling at room temperature");
assert.ok((afterRoom.ventedVaporMl?.C2H5OH??0)>0,
 "Escaped vapor volume is conserved as a persisted ledger");
const sealed=lab.addLabVessel(neatBeaker,"conical");
const conical=sealed.vessels.find(v=>v.kind==="conical");
let corked=lab.putLabReagent(sealed,conical.id,"CH3OH",{unit:"ml",value:10});
corked=lab.setLabVesselStopper(corked,conical.id,true);
assert.equal(corked.vessels.find(v=>v.id===conical.id).stoppered,true);
const sealedBefore=lab.labVesselQuantity(corked.vessels.find(v=>v.id===conical.id)).volumeMl;
const sealedAfter=lab.advanceLabSimulation(lab.advanceLabSimulation(corked,100000),110000);
assert.equal(lab.labVesselQuantity(sealedAfter.vessels.find(v=>v.id===conical.id)).volumeMl,sealedBefore,
 "Cork keeps volatile pure liquid inside at room temperature");
assert.equal(lab.putLabReagent(corked,conical.id,"H2O"),corked,
 "Cork prevents dosing through sealed glassware");
assert.equal(lab.setLabVesselStopper(corked,conical.id,false).vessels.find(v=>v.id===conical.id).stoppered,false);
const unsupported=lab.putLabReagent(detailedBench(),"v1","HCl",
 {unit:"ml",value:10,concentrationM:.1});
const unsupportedNext=lab.advanceLabSimulation(lab.advanceLabSimulation(unsupported,100000),110000);
assert.ok(unsupportedNext.vessels[0].doses.HCl.value<10,
 "Open aqueous stock loses water, not neat acid");
assert.ok(Math.abs(chem.labDoseMoles("HCl",unsupportedNext.vessels[0].doses.HCl)-
 chem.labDoseMoles("HCl",unsupported.vessels[0].doses.HCl))<1e-12,
 "Aqueous stock evaporation must preserve the solute's measured moles");
const nearBoil=vapor.labSaturationPressureKPa("H2O",100);
assert.ok(nearBoil>95&&nearBoil<110,"Water vapor pressure reaches 1 atm at boiling");
const atRoom=vapor.labSaturationPressureKPa("H2O",22);
assert.ok(atRoom>2&&atRoom<4);
assert.ok(vapor.labSaturationPressureKPa("CH3OH",40)>
 vapor.labSaturationPressureKPa("CH3OH",22),"Hot alcohol evaporates more readily");
assert.ok(vapor.labSaturationPressureKPa("Br2",22)>atRoom,
 "Bromine is much more volatile than water at room temperature");
assert.ok(vapor.labEvaporate({...corked.vessels.find(v=>v.id===conical.id),
 temperatureC:90},10,90,180).popped,
 "Hot sealed alcohol with high vapor pressure releases the rubber cork");
const savedStopper=structuredClone(persistedLab);
savedStopper.vessels[0].stoppered=true;
savedStopper.vessels[0].ventedVaporMl={H2O:.0023,CH3OH:.014};
assert.equal(parseLab(savedStopper).items[0].scienceLabBench.vessels[0].stoppered,true);
assert.equal(parseLab(savedStopper).items[0].scienceLabBench.vessels[0].ventedVaporMl.CH3OH,.014);
console.log("Measured vapor pressure, open evaporation, stoppers and saved gas loss: OK");


/** Final simplified glassware wall: no graduated cylinder/volumetric flask,
 * no scrolling, and no accidental removal of old experiment contents. */
assert.deepEqual(lab.labGlassware.map(v=>v.id),[
 "beaker","tube","flask","dish","conical","crucible","pipette","burette"
]);
assert.equal(lab.labGlassware.find(v=>v.id==="pipette").name,"Пипетка");
assert.ok(!lab.labGlassware.some(v=>/мерн/i.test(v.name)));
for(const mode of lab.LAB_MODES){
 const emptyMode=lab.setLabMode(detailedBench(),mode.id);
 const offered=lab.glasswareForLabMode(emptyMode);
 assert.ok(offered.length<=6&&offered.length>0,
  "The wall must display every "+mode.name+" glassware item without scrolling");
 assert.ok(offered.every(v=>!["volumetric","cylinder"].includes(v.id)));
 const prepared=lab.prepareLabModeSetup(emptyMode);
 assert.ok(prepared.vessels.every(v=>!["volumetric","cylinder"].includes(v.kind)),
  "Mode starter kits cannot silently add retired instruments");
}
const retiredBefore=detailedBench();
assert.equal(lab.addLabVessel(retiredBefore,"volumetric"),retiredBefore);
assert.equal(lab.addLabVessel(retiredBefore,"cylinder"),retiredBefore);
const glassWall=read("src/lektrusLabSceneLayout.css");
const lastLayout=glassWall.slice(glassWall.lastIndexOf("Final compact glassware wall"));
assert.ok(lastLayout.length>1000);
assert.match(lastLayout,/grid-template-rows:repeat\(3,minmax\(0,1fr\)\)!important/);
assert.match(lastLayout,/grid-template-columns:repeat\(2,minmax\(0,1fr\)\)!important/);
assert.match(lastLayout,/overflow-y:hidden!important/);
assert.match(lastLayout,/scrollbar-width:none!important/);
assert.match(lastLayout,/@container\(max-width:650px\)/);
const glassUI=read("src/LektrusChemistryBench.tsx");
assert.doesNotMatch(glassUI,/setShowAllGlassware|showAllGlassware|fillLabVolumetricFlask/);
assert.match(glassUI,/selected\?\.kind==="pipette"/);
assert.match(glassUI,/>\{kind\.name\}<\/small>/);
assert.ok(!lab.labModeInfo(lab.setLabMode(detailedBench(),"solutions"))
 .description.includes("доведение до метки"));
console.log("Simplified eight-type catalog, six-slot no-scroll wall and legacy glassware preservation: OK");


// No scaled-down desktop laboratory on phones: preserve a full-size table
// and route all physical cupboards through one selectable dropdown shelf.
assert.match(editorFixed,/const scale=compact\?1:h\/1000/);
assert.match(editorFixed,/height:stage\.height,zoom:stage\.scale/);
assert.match(polishedSurface,/compactFullscreen\?:boolean/);
assert.ok(polishedSurface.includes('(compactFullscreen&&mobileDrawer?" is-drawer-"+mobileDrawer:"")'),
 "Fullscreen mobile drawer state must be reflected in the bench class");


// Mounted glassware follows the actual shorter, native-size phone stand.
// The desktop stage keeps its original physical anchoring unchanged.
const compactStand=lab.addPlacedLabDevice(detailedBench(),"tripod").placedDevices[0];
const desktopMount=layout.labMountedGlasswarePoint(compactStand,{kind:"tube"},900,420);
const phoneMount=layout.labMountedGlasswarePoint(compactStand,{kind:"tube"},900,420,false,true);
assert.ok(Math.abs(phoneMount.y-desktopMount.y)>1,
 "Compact lab must calculate against the shorter physical phone stand");
const compactFoot=layout.labStandBaseVesselPoint(compactStand,{kind:"beaker"},900,420,false,true);
assert.ok(Number.isFinite(compactFoot.x)&&Number.isFinite(compactFoot.y));
assert.match(polishedSurface,/false,compactFullscreen/);
console.log("Mounted laboratory glassware aligns with short-screen apparatus");


// Pushing a vessel upward is instantaneous when empty. For a filled one,
// removal requires confirmation before deleting measured chemical quantities.
const storedFilled=detailedBench();
const fullReturnSource=lab.putLabReagent(storedFilled,"v1","NaCl",{value:2,unit:"g"});
assert.equal(lab.removeLabVessel(fullReturnSource,"v1"),fullReturnSource);
const confirmedReturn=lab.removeLabVessel(fullReturnSource,"v1",true);
assert.ok(!confirmedReturn.vessels.some(v=>v.id==="v1"));
assert.ok(!confirmedReturn.placedDevices?.some(d=>d.linkedVesselId==="v1"));
const emptyReturnSource=detailedBench();
assert.equal(lab.removeLabVessel(emptyReturnSource,"v1").vessels.some(v=>v.id==="v1"),false);
assert.equal(layout.isLabReturnDrop({x:18,y:22},68,390,true),true);
assert.equal(layout.isLabReturnDrop({x:80,y:22},68,390,true),true,
 "Returning an instrument must not require the formerly visible right cupboard");
assert.equal(layout.isLabReturnDrop({x:18,y:22},26,390,true),false,
 "A minor tap near the top cannot remove glassware");
assert.equal(layout.isLabReturnDrop({x:18,y:63},68,390,true),false,
 "The ordinary worktop remains a safe movement area");
assert.equal(layout.isLabReturnDrop({x:80,y:23},65,1000,false),true);
console.log("Return by upward drag: glassware confirmation, instrument top zone and safe movement");


/* School calorimetry: pure reference Cp first, bounded teaching estimates
 * for prepared solutions and dissolved solids, without altering Cp maps. */
assert.equal(calorimetry.LAB_CALORIMETRY_REFERENCE.H2O.specificJPerGK,4.184);
assert.equal(calorimetry.LAB_CALORIMETRY_REFERENCE.C2H5OH.specificJPerGK,2.376);
assert.equal(calorimetry.LAB_CALORIMETRY_REFERENCE.CH3OH.specificJPerGK,2.53);
const heat20=calorimetry.labKnownHeatCapacityJPerK("beaker",{H2O:{unit:"ml",value:20}});
const heat80=calorimetry.labKnownHeatCapacityJPerK("beaker",{H2O:{unit:"ml",value:80}});
assert.ok(heat20>50&&heat80>heat20*2,"Water quantity must affect heat capacity");
assert.ok(calorimetry.labKnownHeatCapacityJPerK("beaker",
 {HCl:{unit:"ml",value:20,concentrationM:.1}})>130,
 "Prepared aqueous stock must use waterlike Cp");
assert.ok(calorimetry.labKnownHeatCapacityJPerK("beaker",
 {H2O:{unit:"ml",value:20},NaCl:{unit:"g",value:2}})>135,
 "Salt and water share finite classroom heat capacity");
assert.equal(calorimetry.labSchoolSpecificHeatJPerGK("NaCl","g").estimated,false);
assert.equal(calorimetry.labSchoolSpecificHeatJPerGK("HCl","ml",.1).estimated,true);
const source={kind:"hotplate",temperatureC:150,powerW:160};
const warm20=calorimetry.labSensibleHeatStep("beaker",
 {H2O:{unit:"ml",value:20}},22,22,10,source);
const warm80=calorimetry.labSensibleHeatStep("beaker",
 {H2O:{unit:"ml",value:80}},22,22,10,source);
assert.ok(warm20.temperatureC>warm80.temperatureC+2,
 "The same plate must warm a smaller sample faster");
const cooled=calorimetry.labSensibleHeatStep("beaker",
 {H2O:{unit:"ml",value:20}},50,22,10);
assert.ok(cooled.temperatureC<50&&cooled.temperatureC>22,
 "After switch-off a measured sample cools without overshooting ambient");
assert.ok(warm20.heaterWattsToContents<=source.powerW);
let smallCup=lab.putLabReagent(detailedBench(),"v1","H2O",{value:20,unit:"ml"});
let largeCup=lab.putLabReagent(detailedBench(),"v1","H2O",{value:80,unit:"ml"});
const heatCup=(sample)=>{
 let out=lab.addPlacedLabDevice(sample,"hotplate");
 const h=lab.placedLabDevices(out)[0].id;
 out=lab.applyPlacedLabDevice(out,h,"v1");
 out=lab.setLabHotplateTemperature(out,h,180);
 out=lab.setPlacedDevicePower(out,h,true);
 return lab.advanceLabSimulation(lab.advanceLabSimulation(out,0),10000);
};
smallCup=heatCup(smallCup);largeCup=heatCup(largeCup);
assert.ok(smallCup.vessels[0].temperatureC>largeCup.vessels[0].temperatureC,
 "End-to-end: 20 ml must be hotter than 80 ml after the same heating period");
assert.match(read("src/LektrusChemistryBench.tsx"),
 /Расчётная теплоёмкость содержимого и посуды/);
console.log("Thermal mass, measured calorimetry, cooling and inspector: OK");


// Each volatile liquid's boiling loss has an energy budget, not an empirical
// temperature-only speed multiplier. Diffusion is independently bounded.
for(const [id,reference] of Object.entries(vapor.LAB_LATENT_VAPORIZATION_J_PER_G)){
 assert.ok(reference>160&&reference<3000,"Plausible reviewed latent heat: "+id);
 const sample={kind:"dish",doses:{[id]:{value:100,unit:"ml"}}};
 // Br2's published Antoine fit reaches 1 atm at ~59.1°C; use 60°C.
 const referenceBoilingC=thermal.labThermalInfo(id,"ml").boilingC;
assert.ok(Number.isFinite(referenceBoilingC),
 "All pure volatile stock has an audited boiling point: "+id);
// Br2 has a small source/model Antoine mismatch at 58.8 C; testing at
// 60 C (still within NIST's fitted range) verifies actual P >= 1 atm.
const boilingC=id==="Br2"?Math.max(60,referenceBoilingC):referenceBoilingC;
 const watts=120,seconds=5;
 const withHeater=vapor.labEvaporate(sample,seconds,boilingC,boilingC+60,watts);
 const without=vapor.labEvaporate(sample,seconds,boilingC,boilingC+60,0);
 const density=vapor.LAB_VAPOR_REFERENCE[id].densityGml;
 const extra=Math.max(0,withHeater.evaporatedMl-without.evaporatedMl);
 assert.ok(extra>0,"Heater drives reviewed latent vaporization of "+id);
 assert.ok(extra*density*reference<=watts*seconds+2,
  "Vaporized enthalpy must not exceed power x time for "+id);
 assert.ok(withHeater.doses[id].value>=0&&withHeater.doses[id].value<=100);
}
const ethanolPlateau=vapor.labEvaporate({kind:"beaker",
 doses:{C2H5OH:{value:15,unit:"ml"}}},10,78.37,190,90);
assert.ok(ethanolPlateau.evaporatedMl>0,"A heated boiling ethanol sample loses liquid");
const coolAlcohol=vapor.labEvaporate({kind:"beaker",
 doses:{C2H5OH:{value:15,unit:"ml"}}},10,25,180,90);
const noHeaterAlcohol=vapor.labEvaporate({kind:"beaker",
 doses:{C2H5OH:{value:15,unit:"ml"}}},10,25,180,0);
assert.equal(coolAlcohol.evaporatedMl,noHeaterAlcohol.evaporatedMl,
 "Heat cannot be used for latent boiling before the boiling point");
console.log("Evaporation: all six reviewed pure-liquid latent heats obey the shared power budget");


/* Kinetic phase regression: reference saturation controls only the target.
 * Both visible phases must conserve weighed material, including after save.
 * The rate factors are explicitly classroom assumptions, not measurements. */
const saltInput=(water,salt)=>({reagents:["H2O","KNO3"],environment:"aqueous",
 doses:{H2O:{value:water,unit:"ml"},KNO3:{value:salt,unit:"g"}}});
const hotTarget=dissolution.labBinarySaltEquilibrium(saltInput(10,4),60);
const coldTarget=dissolution.labBinarySaltEquilibrium(saltInput(10,4),20);
assert.ok(hotTarget.equilibriumSolidMol<coldTarget.equilibriumSolidMol,
 "Cooling reduces the soluble KNO3 fraction");
const powdered=dissolution.labAdvanceBinarySaltPhase(saltInput(10,4),
 60,0,false,undefined,true);
assert.ok(Math.abs(powdered.state.solidMol-powdered.totalMol)<1e-12);
const slow=dissolution.labAdvanceBinarySaltPhase(saltInput(10,4),60,5,false,powdered.state);
const stirred=dissolution.labAdvanceBinarySaltPhase(saltInput(10,4),60,5,true,powdered.state);
assert.ok(stirred.state.solidMol<slow.state.solidMol,
 "Powered stirring must accelerate the same equilibrium approach");
assert.ok(slow.state.solidMol>=hotTarget.equilibriumSolidMol);
const coolingCrystals=dissolution.labAdvanceBinarySaltPhase(saltInput(10,4),
 20,5,false,{formula:"KNO3",solidMol:hotTarget.equilibriumSolidMol});
assert.ok(coolingCrystals.state.solidMol>hotTarget.equilibriumSolidMol);
assert.ok(coolingCrystals.state.solidMol<coldTarget.equilibriumSolidMol,
 "Crystals must form gradually instead of appearing in one tick");
const dryingCrystals=dissolution.labAdvanceBinarySaltPhase(saltInput(3,4),
 60,5,false,{formula:"KNO3",solidMol:hotTarget.equilibriumSolidMol});
assert.ok(dryingCrystals.state.solidMol>hotTarget.equilibriumSolidMol,
 "Reducing water volume raises the crystalline fraction");
assert.equal(dissolution.labBinarySaltEquilibrium({environment:"aqueous",
 reagents:["NaCl","KNO3","H2O"],doses:{
 NaCl:{unit:"g",value:1},KNO3:{unit:"g",value:4},
 H2O:{unit:"ml",value:10}}},25),undefined,
 "Binary solution constants cannot be applied to two-salt mixtures");
let progressive=lab.putLabReagent(detailedBench(),"v1","H2O",{unit:"ml",value:10});
progressive=lab.putLabReagent(progressive,"v1","KNO3",{unit:"g",value:4});
assert.ok(progressive.vessels[0].binarySaltPhase);
assert.equal(progressive.vessels[0].physicalProcess,"dissolving");
progressive=lab.advanceLabSimulation(lab.advanceLabSimulation(progressive,0),5000);
const kinVessel=progressive.vessels[0],kinContents=lab.labVesselContents(kinVessel);
assert.ok(kinContents.solid.some(v=>v.formula==="KNO3"&&v.massG>0));
assert.ok(kinContents.solution.some(v=>v.formula==="KNO3"&&v.mmol>0));
const crystalG=kinContents.solid.find(v=>v.formula==="KNO3").massG;
const dissolvedG=kinContents.solution.find(v=>v.formula==="KNO3").mmol*
 chem.labMolarMass("KNO3")/1000;
assert.ok(Math.abs(crystalG+dissolvedG-4)<.002,
 "Dissolved plus crystalline phases must conserve the full weighed salt");
const savedPhase=structuredClone(progressive);
assert.deepEqual(savedPhase.vessels[0].binarySaltPhase,progressive.vessels[0].binarySaltPhase);
assert.match(read("src/boardModel.ts"),/v\.binarySaltPhase\.solidMol<=10000/);
assert.match(read("src/LektrusChemistryBench.tsx"),
 /Время растворения и кристаллизации рассчитано по учебной кинетической модели/);
console.log("Measured binary dissolution, stirring, cooling and crystallisation: OK");

const chemicalPhaseInventory=network.simulateLabInventory(kinVessel);
assert.ok(Math.abs(chemicalPhaseInventory.solidMol.KNO3-
 kinVessel.binarySaltPhase.solidMol)<1e-9,
 "Filtering must use the actual kinetic solid fraction, not instant equilibrium");
assert.ok(Math.abs(chemicalPhaseInventory.speciesMol.KNO3-
 4/chem.labMolarMass("KNO3"))<1e-10,
 "Phase movement must never change the total molecules of weighed salt");
const roundTripPhase=structuredClone(persistedLab);
roundTripPhase.vessels[0]={...kinVessel,id:"v1",x:48,y:70};
assert.equal(parseLab(roundTripPhase).items[0].scienceLabBench.vessels[0]
 .binarySaltPhase.solidMol,kinVessel.binarySaltPhase.solidMol,
 "Opening a shared saved experiment must preserve ongoing crystallisation");
const badPhase=structuredClone(roundTripPhase);
badPhase.vessels[0].binarySaltPhase.solidMol=-1;
assert.throws(()=>parseLab(badPhase),/Повреждено состояние химического стола/,
 "A negative persisted crystalline phase must be rejected");
const badPhaseName=structuredClone(roundTripPhase);
badPhaseName.vessels[0].binarySaltPhase.formula="MadeUpSalt";
assert.throws(()=>parseLab(badPhaseName),/Повреждено состояние химического стола/,
 "Unsupported kinetic phase identities cannot damage shared board state");

let transferredPhase=lab.addLabVessel(progressive,"beaker");
const transferId=transferredPhase.selectedId;
transferredPhase=lab.pourLabVessel(transferredPhase,"v1",transferId);
assert.equal(transferredPhase.vessels.find(v=>v.id==="v1").binarySaltPhase,undefined,
 "The empty donor must not retain crystals after transferring all contents");
assert.ok(transferredPhase.vessels.find(v=>v.id===transferId).binarySaltPhase,
 "The receiver inherits real crystalline mass when the full sample is moved");
assert.ok(Math.abs(transferredPhase.vessels.find(v=>v.id===transferId)
 .binarySaltPhase.solidMol-kinVessel.binarySaltPhase.solidMol)<1e-9);


/* Measured gas test suite: same stoichiometric extent controls pressure,
 * bubble rate, gas volume, and the persisted instrument inspection.
 * No premature ideal-gas jump to the final equilibrium reaction yield. */
const carbAcid=reaction.reviewedReactionCases.find(r=>
 r.equation==="NaHCO3 + HCl → NaCl + CO2↑ + H2O");
assert.ok(carbAcid,"Vetted acid-carbonate reaction required");
const gasInitial=chem.startQuantifiedLabReaction(carbAcid,
 ["NaHCO3","HCl"],{NaHCO3:{unit:"g",value:2},
 HCl:{unit:"ml",value:5,concentrationM:.1}},1000);
assert.ok(gasInitial,"Measured acid carbonate reaction starts quantitatively");
const gasZero=gasDynamics.labReactionGasProgress(gasInitial,25);
assert.equal(gasZero.totalMol,0);
assert.equal(gasZero.volumeMl,0);
assert.ok(gasZero.rateMolPerSecond>0,"New reaction has a nonzero measured gas rate");
const gasHalf=gasDynamics.labReactionGasProgress(
 chem.advanceQuantifiedLabReaction(gasInitial,2),25);
const gasFull=gasDynamics.labReactionGasProgress(
 chem.advanceQuantifiedLabReaction(gasInitial,4),25);
assert.ok(gasHalf.totalMol>0&&gasHalf.totalMol<gasFull.totalMol);
assert.ok(Math.abs(gasHalf.totalMol-gasFull.totalMol/2)<1e-10);
assert.ok(Math.abs(gasFull.totalMol-.0005)<1e-10,
 "5 ml of 0.1M HCl gives 0.5 mmol CO2 on limiting reaction");
assert.ok(gasFull.volumeMl>12&&gasFull.volumeMl<13,
 "Gas volume follows PV=nRT at 25C and one atmosphere");
assert.equal(gasFull.rateMolPerSecond,0,"Bubbles stop at completion");
const malformedGas={...gasInitial,extentMol:gasInitial.maxExtentMol*2};
assert.equal(gasDynamics.labReactionGasProgress(malformedGas),undefined);
assert.equal(gasDynamics.labIdealGasVolumeMl(.001,-273.15),undefined);
assert.equal(gasDynamics.labIdealGasVolumeMl(-.001,25),undefined);
let sealedGas=lab.addLabVessel(detailedBench(),"flask");
const sealedId=sealedGas.selectedId;
sealedGas=lab.putLabReagent(sealedGas,sealedId,"NaHCO3",{unit:"g",value:2});
sealedGas=lab.putLabReagent(sealedGas,sealedId,"HCl",{
 unit:"ml",value:5,concentrationM:.1});
sealedGas=lab.setLabVesselStopper(sealedGas,sealedId,true);
assert.equal(lab.labHeadspaceGasMoles(sealedGas.vessels.find(v=>v.id===sealedId)),0,
 "Sealed headspace must not contain the entire future reaction yield");
const beforeReactionGas=lab.labVesselPressure(sealedGas.vessels.find(v=>v.id===sealedId));
assert.equal(beforeReactionGas.reactionGasPressureKPa,0);
sealedGas=lab.advanceLabSimulation(sealedGas,1000);
sealedGas=lab.advanceLabSimulation(sealedGas,2000);
sealedGas=lab.advanceLabSimulation(sealedGas,3000);
const midwaySealed=sealedGas.vessels.find(v=>v.id===sealedId);
assert.ok(midwaySealed.reactionAmounts?.extentMol>0,
 "Reaction gases progress while the vessel is closed");
const midSealedPressure=lab.labVesselPressure(midwaySealed);
assert.ok(midSealedPressure.reactionGasPressureKPa>0);
assert.ok(midSealedPressure.reactionGasPressureKPa<30,
 "Measured dilute experiment remains below stopper pop threshold");
assert.ok(Math.abs(lab.labHeadspaceGasMoles(midwaySealed)-
 gasDynamics.labReactionGasProgress(midwaySealed.reactionAmounts).totalMol)<1e-10);
const openedGas=lab.setLabVesselStopper(sealedGas,sealedId,false);
assert.equal(openedGas.vessels.find(v=>v.id===sealedId).stoppered,false);
assert.equal(lab.labVesselPressure(openedGas.vessels.find(v=>v.id===sealedId)).reactionGasPressureKPa,0,
 "Opening the vessel releases the pressure of the produced gas");
const labGasMarkup=read("src/LektrusChemistryBench.tsx");
assert.match(labGasMarkup,/const gasBubbleCount=gasProgress\?/);
assert.match(labGasMarkup,/gasFoaming&&<g className="lektrus-lab-gas-foam"/);
assert.match(labGasMarkup,/Образование газа по ходу реакции/);
console.log("Live gas pressure, rate-based bubbles, gas volume and venting: OK");


// The actual chemistry ledger follows the same fractional extent as gas
// pressure, not instantaneous end-of-reaction products.
const gasDoseBook={NaHCO3:{unit:"g",value:2},
 HCl:{unit:"ml",value:5,concentrationM:.1}};
const makeGasLedger=(amounts,stoppered)=>network.simulateLabInventory({
 reagents:["NaHCO3","HCl"],doses:gasDoseBook,
 environment:"aqueous",reactionAmounts:amounts,stoppered
});
const gasBeforeLedger=makeGasLedger(gasInitial,true);
const gasHalfLedger=makeGasLedger(chem.advanceQuantifiedLabReaction(gasInitial,2),true);
const gasFullLedger=makeGasLedger(chem.advanceQuantifiedLabReaction(gasInitial,4),true);
assert.equal(gasBeforeLedger.retainedGasMol.CO2??0,0,
 "No gaseous products before chemical conversion");
assert.ok(Math.abs(gasHalfLedger.retainedGasMol.CO2-.00025)<1e-10);
assert.ok(Math.abs(gasFullLedger.retainedGasMol.CO2-.0005)<1e-10);
assert.ok(Math.abs(gasHalfLedger.speciesMol.HCl-.00025)<1e-10,
 "Unreacted acid must decrease in proportion to the same extent");
assert.ok(Math.abs(gasHalfLedger.speciesMol.NaCl-.00025)<1e-10,
 "Salt products appear progressively, not at the final yield immediately");
const gasOpenLedger=makeGasLedger(
 chem.advanceQuantifiedLabReaction(gasInitial,2),false);
assert.ok(Math.abs(gasOpenLedger.releasedGasMol.CO2-.00025)<1e-10);
assert.equal(gasOpenLedger.retainedGasMol.CO2??0,0);
assert.ok(gasHalfLedger.steps[0].extentMol>0);
const gasHalfMass=network.labInventoryMassG(gasHalfLedger);
const gasInitialMass=network.labInventoryMassG(gasBeforeLedger);
assert.ok(Math.abs(gasHalfMass-gasInitialMass)<1e-7,
 "All quantified species mass, including evolved gas, is conserved");
console.log("Gas reaction inventory, closed/open gas partitions and atom-mass balance OK");


// The model also covers other reviewed gas species, with gas coefficients
// taken exclusively from balanced equations and the marked gaseous products.
let supportedGasCases=0;
for(const row of reaction.reviewedReactionCases.filter(row=>
 row.status==="reaction"&&row.observation==="gas"&&row.equation.includes("↑"))){
 const eq=chem.parseBalancedLabEquation(row.equation);
 if(!eq)continue;
 const productGases=eq.products.filter(t=>(row.equation.split("→")[1]??"").
  split(/\s+\+\s+/).some(raw=>raw.includes("↑")&&
   raw.replace(/^\d+\s*/,"").replace(/[↑↓]/g,"").trim()===t.formula));
 if(!productGases.length)continue;
 const synthetic={
  equation:row.equation,elapsedSeconds:2,durationSeconds:4,
  extentMol:.0002,maxExtentMol:.0004,complete:false,
  initialMol:{},remainingMol:{},productsMol:{}};
 const measured=gasDynamics.labReactionGasProgress(synthetic,30);
 assert.ok(measured,"Missing quantitative gas progress: "+row.equation);
 const gasCoefficients=productGases.reduce((n,t)=>n+t.coefficient,0);
 assert.ok(Math.abs(measured.totalMol-gasCoefficients*.0002)<1e-12);
 assert.equal(measured.producedMol[productGases[0].formula],
  productGases[0].coefficient*.0002);
 assert.ok(measured.volumeMl>0);
 supportedGasCases++;
}
assert.ok(supportedGasCases>=10,"Review the gas catalogue for complete visual coverage");
let pressurePop=lab.addLabVessel(detailedBench(),"flask");
const pressurePopId=pressurePop.selectedId;
pressurePop=lab.putLabReagent(pressurePop,pressurePopId,"NaHCO3",
 {unit:"g",value:5});
pressurePop=lab.putLabReagent(pressurePop,pressurePopId,"HCl",
 {unit:"ml",value:30,concentrationM:2});
pressurePop=lab.setLabVesselStopper(pressurePop,pressurePopId,true);
assert.equal(pressurePop.vessels.find(v=>v.id===pressurePopId).stoppered,true);
pressurePop=lab.advanceLabSimulation(pressurePop,0);
pressurePop=lab.advanceLabSimulation(pressurePop,1000);
pressurePop=lab.advanceLabSimulation(pressurePop,2000);
const pressureBeforePop=pressurePop.vessels.find(v=>v.id===pressurePopId);
assert.ok(pressureBeforePop.reactionAmounts?.extentMol>0);
if(pressureBeforePop.stoppered)
 assert.equal(lab.labVesselPressure(pressureBeforePop).popped,false,
  "Slower 24 s gas kinetics must not pop the stopper before pressure reaches its limit");
for(let t=3000;t<=32000&&pressurePop.vessels.find(v=>v.id===pressurePopId)?.stoppered;t+=1000)
 pressurePop=lab.advanceLabSimulation(pressurePop,t);
const poppedVessel=pressurePop.vessels.find(v=>v.id===pressurePopId);
assert.equal(poppedVessel.stoppered,false,
 "Cork must release as soon as slower measured gas generation exceeds the pressure limit");
assert.match(read("src/lektrusChemistryBenchModel.ts"),
 /A rapid measured gas reaction can release the stopper immediately/);
console.log("Reviewed gas cases and immediate pressure-driven cork release: OK");


// Once a reaction has vented gas into the room, closing the vessel does not
// magically recover the gas formed before the cork was reinserted.
let resealedGas=lab.setLabVesselStopper(openedGas,sealedId,true);
const resealedState=resealedGas.vessels.find(v=>v.id===sealedId);
assert.ok((resealedState.sealedReactionGasBaselineMol??0)>0);
assert.ok(lab.labHeadspaceGasMoles(resealedState)<1e-10,
 "Re-sealing must baseline the gas that already escaped");
resealedGas=lab.advanceLabSimulation(resealedGas,4000);
assert.ok(lab.labHeadspaceGasMoles(resealedGas.vessels.find(v=>v.id===sealedId))>0,
 "Only subsequent gas production accumulates in the new headspace");
const storedResealed=structuredClone(persistedLab);
storedResealed.vessels[0]={...resealedGas.vessels.find(v=>v.id===sealedId),
 id:"v1",kind:"flask",x:40,y:70};
const reopenedResealed=parseLab(storedResealed);
assert.equal(reopenedResealed.items[0].scienceLabBench.vessels[0]
 .sealedReactionGasBaselineMol,
 storedResealed.vessels[0].sealedReactionGasBaselineMol);
const invalidGasBaseline=structuredClone(storedResealed);
invalidGasBaseline.vessels[0].sealedReactionGasBaselineMol=-.1;
assert.throws(()=>parseLab(invalidGasBaseline),
 /Повреждено состояние химического стола/);
console.log("Re-sealing conserves prior venting, gas pressure and saved baseline");


/* Complete property index covers every curated reagent AND product formula,
 * without assigning invented density/phase values to unreviewed materials. */
assert.equal(materialRegistry.labSubstanceProperties("NaCl").inCabinet,true);
assert.equal(materialRegistry.labSubstanceProperties("MadeUpFormula").densityKnown,false);
assert.equal(materialRegistry.labSubstanceProperties("MadeUpFormula").thermalKnown,false);
assert.equal(materialRegistry.labSubstanceProperties("MadeUpFormula").solubilityKnown,false);
let reviewedProductsCovered=new Set();
let reviewedEquationsCovered=0;
for(const row of reaction.reviewedReactionCases){
 if(row.status!=="reaction")continue;
 const equation=chem.parseBalancedLabEquation(row.equation);
 if(!equation)continue;
 reviewedEquationsCovered++;
 const products=materialRegistry.labProductIdentities(row.equation);
 assert.equal(products.length,equation.products.length);
 for(const product of products){
  reviewedProductsCovered.add(product.formula);
  assert.equal(product.coeff,equation.products.find(x=>
   x.formula===product.formula).coefficient);
  const info=materialRegistry.labSubstanceProperties(product.formula,25);
  assert.equal(info.formula,product.formula);
  assert.ok(info.name.length>0);
  assert.equal(typeof info.molarMassGPerMol,"number",
   "Every balanced reviewed reaction product needs a known molecular mass: "+product.formula);
  assert.ok(info.molarMassGPerMol>0);
 }
}
assert.ok(reviewedEquationsCovered>100);
assert.equal(materialRegistry.LAB_REVIEWED_PRODUCT_IDENTITIES.size,
 reviewedProductsCovered.size);
for(const [formula,density] of Object.entries({
 Na2CO3:2.54,CaO:3.34,MgO:3.58,MgCO3:3.05,CaSO4:2.96,
 BaCO3:4.275,PbCl2:5.85,PbBr2:6.66,
 "Cu(OH)2":3.37,"Al(OH)3":2.42,ZnO:5.61
})){
 assert.equal(constants.labCrystalDensityGml(formula),density);
 const info=materialRegistry.labSubstanceProperties(formula);
 assert.equal(info.crystalDensityGPerMl,density);
 assert.ok(info.molarMassGPerMol>0);
}
for(const formula of ["Na2CO3","CaO","MgO","BaCO3","PbCl2","PbBr2"]){
 const weighed=lab.putLabReagent(detailedBench(),"v1",formula,
  {value:1,unit:"g"});
 const volume=lab.labVesselQuantity(weighed.vessels[0]);
 assert.ok(volume.solidVolumeComplete);
 assert.ok(Math.abs(volume.solidVolumeMl-
  1/constants.labCrystalDensityGml(formula))<1e-6,
  "One gram of "+formula+" occupies the published true-crystal volume");
}
assert.equal(constants.labSingleSaltSolubilityGPer100gWater("PbCl2",-1),undefined);
assert.equal(constants.labSingleSaltSolubilityGPer100gWater("PbCl2",101),undefined);
assert.ok(Math.abs(constants.labSingleSaltSolubilityGPer100gWater("PbCl2",20)-
  .99/.9982)<1e-10);
assert.ok(constants.labSingleSaltSolubilityGPer100gWater("PbCl2",100)>
 constants.labSingleSaltSolubilityGPer100gWater("PbCl2",20));
const leadWater={reagents:["H2O","PbCl2"],environment:"aqueous",
 doses:{H2O:{value:100,unit:"ml"},PbCl2:{value:4,unit:"g"}}};
const leadCold=dissolution.labBinarySaltEquilibrium(leadWater,20);
const leadHot=dissolution.labBinarySaltEquilibrium(leadWater,100);
assert.ok(leadCold.equilibriumSolidMol>leadHot.equilibriumSolidMol);
let leadDissolution=lab.putLabReagent(detailedBench(),"v1","H2O",
 {value:100,unit:"ml"});
leadDissolution=lab.putLabReagent(leadDissolution,"v1","PbCl2",
 {value:4,unit:"g"});
assert.equal(leadDissolution.vessels[0].physicalProcess,"dissolving");
assert.ok(leadDissolution.vessels[0].binarySaltPhase.solidMol>0);
const leadFirstMol=leadDissolution.vessels[0].binarySaltPhase.solidMol;
leadDissolution=lab.advanceLabSimulation(
 lab.advanceLabSimulation(leadDissolution,0),5000);
assert.ok(leadDissolution.vessels[0].binarySaltPhase.solidMol<leadFirstMol);
assert.ok(leadDissolution.vessels[0].binarySaltPhase.solidMol>=
 leadCold.equilibriumSolidMol-1e-6);
assert.match(read("src/LektrusChemistryBench.tsx"),
 /Физико-химические свойства реагентов и продуктов/);
assert.match(read("src/boardModel.ts"),/NaNO3","PbCl2/);
console.log("Reviewed reactants/products, curated densities and PbCl2 kinetics: OK");


// The second reviewed lead halide follows its OWN measured binary water
// saturation curve, not PbCl2's Ksp or a fabricated temperature multiplier.
const bromideCold=constants.labSingleSaltSolubilityGPer100gWater("PbBr2",20);
const bromideHot=constants.labSingleSaltSolubilityGPer100gWater("PbBr2",100);
assert.ok(Math.abs(bromideCold-.844/.9982)<1e-10);
assert.ok(Math.abs(bromideHot-4.41/.9584)<1e-10);
assert.equal(constants.labSingleSaltSolubilityGPer100gWater("PbBr2",101),undefined);
const bromideWater={reagents:["H2O","PbBr2"],environment:"aqueous",
 doses:{H2O:{value:100,unit:"ml"},PbBr2:{value:5,unit:"g"}}};
const bromideEqCold=dissolution.labBinarySaltEquilibrium(bromideWater,20);
const bromideEqHot=dissolution.labBinarySaltEquilibrium(bromideWater,100);
assert.ok(bromideEqCold.equilibriumSolidMol>bromideEqHot.equilibriumSolidMol);
let bromideBench=lab.putLabReagent(detailedBench(),"v1","H2O",
 {unit:"ml",value:100});
bromideBench=lab.putLabReagent(bromideBench,"v1","PbBr2",
 {unit:"g",value:5});
assert.equal(bromideBench.vessels[0].physicalProcess,"dissolving");
const bromideInitial=bromideBench.vessels[0].binarySaltPhase.solidMol;
bromideBench=lab.advanceLabSimulation(lab.advanceLabSimulation(bromideBench,0),5000);
const bromideNow=bromideBench.vessels[0].binarySaltPhase.solidMol;
assert.ok(bromideNow<bromideInitial&&bromideNow>bromideEqCold.equilibriumSolidMol);
const bromideStock=materialRegistry.labSubstanceProperties("PbBr2",20);
assert.ok(bromideStock.solubilityKnown);
assert.equal(bromideStock.crystalDensityGPerMl,6.66);
console.log("PbBr2 phase equilibrium, gradual dissolution and reference density: OK");


// Elemental metal lumps have a real displacement volume at ambient temp.
// A metal crystal's density is unrelated to a metal-salt solution density.
const ambientElementDensities={
 Li:.534,Na:.97,K:.89,Ca:1.54,Mg:1.74,Al:2.70,
 Zn:7.134,Fe:7.87,Cu:8.96,Ag:10.5,Au:19.3,Pb:11.3
};
for(const [formula,density] of Object.entries(ambientElementDensities)){
 assert.equal(constants.labCrystalDensityGml(formula),density);
 const weighed=lab.putLabReagent(detailedBench(),"v1",formula,
  {unit:"g",value:1});
 const solid=lab.labVesselQuantity(weighed.vessels[0]);
 assert.ok(solid.solidVolumeComplete,"Density known for "+formula);
 assert.ok(Math.abs(solid.solidVolumeMl-1/density)<1e-6,
  "Mass/density displacement for "+formula);
}
const lumpOfLi=lab.putLabReagent(detailedBench(),"v1","Li",
 {unit:"g",value:10});
assert.ok(lab.labVesselQuantity(lumpOfLi.vessels[0]).occupiedMl>18,
 "Lightweight lithium takes significantly more glassware space than copper");
const lumpOfCu=lab.putLabReagent(detailedBench(),"v1","Cu",
 {unit:"g",value:10});
assert.ok(lab.labVesselQuantity(lumpOfCu.vessels[0]).occupiedMl<2);
console.log("RSC metal densities and weighed solid displacement: OK");


// Every supported dilute-water classification is explicitly scoped;
// no unsupported salt may become dissolved merely from setting "aqueous".
assert.equal(network.labIsTypicallyWaterSoluble("Zn(NO3)2"),true);
assert.equal(network.labIsTypicallyWaterSoluble("CH3COOK"),true);
assert.equal(network.labIsTypicallyWaterSoluble("FeCl3"),true);
assert.equal(network.labIsTypicallyWaterSoluble("(NH4)2SO4"),true);
assert.equal(network.labIsTypicallyWaterSoluble("AgCl"),false);
assert.equal(network.labIsTypicallyWaterSoluble("BaSO4"),false);
assert.equal(network.labIsTypicallyWaterSoluble("CaCO3"),false);
assert.equal(network.labIsTypicallyWaterSoluble("PbI2"),false);
for(const formula of ["NaCl","KNO3","MgCl2","Cu(NO3)2","(NH4)2SO4",
 "CH3COONa","K2CO3","CaCl2","KOH","BaCl2"]){
 const dry=network.simulateLabInventory({reagents:[formula],
  doses:{[formula]:{value:1,unit:"g"}},environment:"aqueous"});
 assert.ok((dry.solidMol[formula]??0)>0,
  "Aqueous UI mode may not turn an undiluted dry powder into a solution: "+formula);
 const wetted=network.simulateLabInventory({
  reagents:["H2O",formula],
  doses:{H2O:{value:100,unit:"ml"},[formula]:{value:.01,unit:"g"}},
  environment:"aqueous"});
 assert.equal(wetted.solidMol[formula]??0,0,
  "Dilute, reviewed soluble salt must be classified as dissolved: "+formula);
 const material=materialRegistry.labSubstanceProperties(formula);
 assert.equal(material.typicallySolubleInDiluteWater,true);
}
for(const formula of ["AgCl","BaSO4","CaCO3","Cu(OH)2",
 "PbSO4","Fe(OH)3"]){
 const mixture=network.simulateLabInventory({
  reagents:["H2O",formula],
  doses:{H2O:{value:100,unit:"ml"},[formula]:{value:1,unit:"g"}},
  environment:"aqueous"});
 assert.ok(mixture.solidMol[formula]>0,
  "Verified low-solubility precipitate remains a solid: "+formula);
}
console.log("All catalog dilute aqueous classifications and dry solids: OK");


// The already-existing melting/decomposition process now uses individually
// reviewed reference data for these current-catalog reactants and products.
// A prepared solution must never borrow the neat solid's melting point.
const addedThermalProperties={
 PbCl2:{m:501,b:950},PbBr2:{m:371,b:892},
 BaCl2:{m:962,b:1560},CaCl2:{m:772},
 PbSO4:{m:1170},CuO:{decomposes:1026}
};
for(const [formula,expected] of Object.entries(addedThermalProperties)){
 const pure=thermal.labThermalInfo(formula,"g");
 assert.equal(pure.known,true,formula+" has reviewed solid properties");
 assert.equal(pure.meltingC,expected.m);
 assert.equal(pure.boilingC,expected.b);
 assert.equal(pure.decompositionC,expected.decomposes);
 const solution=thermal.labThermalInfo(formula,"ml");
 assert.equal(solution.known,false,
  formula+" prepared solution cannot inherit neat-solid transition temperatures");
 const property=materialRegistry.labSubstanceProperties(formula);
 assert.equal(property.thermalKnown,true);
}
const newReferenceDensities={
 NH4Cl:1.53,"(NH4)2SO4":1.77,CaCl2:2.10,K2CO3:2.29,
 K2SO4:2.66,Na2SO4:2.70,Na2SO3:2.66,Al2O3:4.00,
 NaOH:2.13,KOH:2.044,"Mg(OH)2":2.36,
 PbSO4:6.20,CuO:6.315,BaCl2:3.856
};
for(const [formula,density] of Object.entries(newReferenceDensities)){
 assert.equal(constants.labCrystalDensityGml(formula),density);
 const sample=lab.putLabReagent(detailedBench(),"v1",formula,
  {unit:"g",value:1});
 const result=lab.labVesselQuantity(sample.vessels[0]);
 assert.equal(result.solidVolumeComplete,true,formula+" true density known");
 assert.ok(Math.abs(result.solidVolumeMl-1/density)<1e-6,
  "Solid volume must use verified anhydrous crystal density: "+formula);
}
assert.match(read("src/lektrusLabReactionNetwork.ts"),
 /An aqueous reaction MODE does not conjure any actual solvent/);
console.log("Existing phase-change temperatures and 14 new solid densities: OK");


// Exhaustive coverage audit for the EXISTING reagent cabinet, not a new
// reaction family: every gram-dosed stock without measured solvent is solid,
// and every stock has a usable formula and an explicit property record.
// Unsupported numeric properties remain absent rather than made up.
const allCabinetEntries=catalog.buildLabCatalog({group:"none"})
 .flatMap(section=>section.items);
assert.equal(allCabinetEntries.length,reaction.substances.length,
 "Audit must not omit substances when cabinet grouping changes");
let dryStockCount=0,knownCrystalDensityCount=0;
for(const stock of allCabinetEntries){
 const property=materialRegistry.labSubstanceProperties(stock.id);
 assert.equal(property.inCabinet,true);
 assert.ok(property.molarMassGPerMol>0,
  "Every existing catalog substance must have its molecular mass: "+stock.id);
 if(!catalog.labReagentForms(stock).includes("g"))continue;
 dryStockCount++;
 const sample={reagents:[stock.id],environment:"aqueous",
  doses:{[stock.id]:{value:1,unit:"g"}}};
 const dryInventory=network.simulateLabInventory(sample);
 assert.ok((dryInventory.solidMol[stock.id]??0)>0,
  "Dry stored material cannot become a solution before a solvent is added: "+stock.id);
 assert.ok((dryInventory.speciesMol[stock.id]??0)>0,
  "The dry material's chemical inventory must preserve its mass: "+stock.id);
 if(property.crystalDensityGPerMl!==undefined){
  knownCrystalDensityCount++;
  const testedVessel={...detailedBench().vessels[0],
   reagents:[stock.id],doses:sample.doses};
  const displacement=lab.labVesselSolidDisplacement(testedVessel);
  assert.ok(displacement.complete,
   "A reviewed true-solid density should yield complete displacement: "+stock.id);
  assert.ok(Math.abs(displacement.volumeMl-
   1/property.crystalDensityGPerMl)<1e-6);
 }
}
assert.ok(dryStockCount>100);
assert.ok(knownCrystalDensityCount>=45);
console.log("Complete current reagent cabinet audit: "+allCabinetEntries.length+
 " substances, "+dryStockCount+" dry stocks, "+
 knownCrystalDensityCount+" reviewed solid densities: OK");
