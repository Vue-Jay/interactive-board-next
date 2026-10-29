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
const appearance=load("src/lektrusLabAppearance.ts",key=>{
 assert.equal(key,"./lektrusReactionDatabase");return reaction;
});
const catalog=load("src/lektrusLabCatalog.ts",key=>{
 if(key==="./lektrusLabAppearance")return appearance;
 assert.equal(key,"./lektrusReactionDatabase");return reaction;
});
const thermal=load("src/lektrusLabPhysicalProperties.ts");
const acidBase=load("src/lektrusLabPH.ts");
const lab=load("src/lektrusChemistryBenchModel.ts",key=>{
 if(key==="./lektrusLabTitration")return titration;
 if(key==="./lektrusLabLayout")return layout;
 if(key==="./lektrusLabStoichiometry")return chem;
 if(key==="./lektrusLabPhysicalProperties")return thermal;
 if(key==="./lektrusLabPH")return acidBase;
 if(key==="./lektrusLabCatalog")return catalog;
 assert.equal(key,"./lektrusReactionDatabase");return reaction;
});
let bench=lab.defaultLabBench();
assert.equal(bench.vessels.length,1,"New lab starts with a single empty beaker");
assert.equal(bench.selectedId,"v1");
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
let unknown=lab.putLabReagent(bench,"v1","HCl");
assert.equal(lab.labObservation(unknown.vessels[0]).status,"unknown",
 "Second-stage products cannot be predicted from original reactant IDs");
assert.equal(unknown.vessels[0].completedReaction?.observation,"precipitate",
 "Existing precipitate must stay visually represented even when later chemistry is unknown");
let heated=lab.defaultLabBench();
heated=lab.putLabReagent(heated,"v1","CaCO3");
assert.equal(lab.labObservation(heated.vessels[0]).status,"unknown");
heated=lab.setLabEnvironment(heated,"v1","heated");
assert.equal(lab.labObservation(heated.vessels[0]).status,"reaction",
 "Heating single validated reactant initiates decomposition");
assert.equal(lab.labObservation(heated.vessels[0]).caseData.observation,"gas");
let noReaction=lab.defaultLabBench();
noReaction=lab.putLabReagent(noReaction,"v1","NaCl");
noReaction=lab.putLabReagent(noReaction,"v1","KNO3");
assert.equal(lab.labObservation(noReaction.vessels[0]).status,"none");
let gas=lab.defaultLabBench();
gas=lab.putLabReagent(gas,"v1","NaHCO3");
gas=lab.putLabReagent(gas,"v1","HCl");
assert.equal(lab.labObservation(gas.vessels[0]).caseData.observation,"gas");
const invalidPour=lab.pourLabVessel(gas,"v1","v1");
assert.deepEqual(invalidPour,gas,"Cannot pour into the same container");
let full=lab.defaultLabBench();
for(let i=0;i<9;i++)full=lab.addLabVessel(full,"flask");
assert.equal(full.vessels.length,lab.MAX_BENCH_VESSELS,"Glassware is bounded");
assert.equal(new Set(full.vessels.map(v=>v.id)).size,full.vessels.length);
full=lab.positionLabVessel(full,"v1",-500,500);
assert.equal(full.vessels[0].x,10);assert.equal(full.vessels[0].y,90);
let indicatorBench=lab.defaultLabBench();
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
let neutral=lab.putLabReagent(lab.defaultLabBench(),"v1","H2O");
neutral=lab.setLabIndicator(neutral,"v1","universal");
assert.equal(lab.labIndicatorResult(neutral.vessels[0]).medium,"neutral");
let salt=lab.putLabReagent(lab.defaultLabBench(),"v1","NaCl");
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
let precip=lab.defaultLabBench();
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
assert.equal(lab.labObservation(postReaction.vessels[2]).status,"unknown",
 "Further transformation of spent mixture must not be invented");
assert.ok(postReaction.vessels[2].completedReaction,"Previously precipitated solid should remain visible as last known appearance");
const cleaned=lab.emptyLabVessel(postReaction,"v3");
assert.equal(cleaned.vessels[2].completedReaction,undefined,"Sink removes all products");
const stored=lab.removeLabVessel(cleaned,"v3");
assert.equal(stored.vessels.length,2,"Only cleaned glassware returns to cupboard");
assert.equal(lab.removeLabVessel(decanted,"v3"),decanted,"A filled flask cannot be stored before draining");
const settings=lab.setLabBenchSettings(lab.defaultLabBench(),{showEquationBoard:true,animateEffects:false});
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
let devices=lab.defaultLabBench();
for(const device of lab.labDevices)devices=lab.toggleLabDevice(devices,device.id);
assert.equal(devices.devices.length,5,"The lab provides five physical instruments without thermometer");
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
let extra=lab.defaultLabBench();
for(const kind of lab.labGlassware.slice(5)){
 extra=lab.addLabVessel(extra,kind);
}
assert.equal(extra.vessels.length,lab.MAX_BENCH_VESSELS);
assert.ok(lab.labGlassware.some(v=>v.id==="burette"));
assert.ok(lab.labGlassware.some(v=>v.id==="pipette"));
assert.ok(lab.labGlassware.some(v=>v.id==="conical"));
let titrationBench=lab.defaultLabBench();
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
 let arranged=lab.defaultLabBench();
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
let realBench=lab.defaultLabBench();
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
let equipment=lab.defaultLabBench();
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
let thermostat=lab.addPlacedLabDevice(lab.defaultLabBench(),"hotplate");
const thermostatId=lab.placedLabDevices(thermostat)[0].id;
thermostat=lab.setLabHotplateTemperature(thermostat,thermostatId,185);
assert.equal(lab.placedLabDevices(thermostat)[0].targetTemperatureC,185);
assert.equal(lab.setLabHotplateTemperature(thermostat,thermostatId,900).placedDevices[0].targetTemperatureC,350);
thermostat=lab.setPlacedDevicePower(thermostat,thermostatId,true);
thermostat=lab.movePlacedLabDevice(thermostat,thermostatId,50,66);
assert.equal(thermostat.placedDevices[0].powered,true,"Moving a heater must preserve its power");
let adjustable=lab.addPlacedLabDevice(lab.defaultLabBench(),"tripod");
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
let suspended=lab.addPlacedLabDevice(lab.defaultLabBench(),"tripod",{x:40,y:68});
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
let suspendedBurette=lab.addPlacedLabDevice(lab.defaultLabBench(),"tripod",{x:40,y:68});
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

const migrated=lab.placedLabDevices({...lab.defaultLabBench(),devices:["burner","stirrer"]});
assert.equal(migrated.length,2,"Previously saved laboratory devices must remain visible");
assert.notEqual(migrated[0].id,migrated[1].id);
const beforeConcurrent=lab.defaultLabBench();
const peerPlate=lab.addPlacedLabDevice(beforeConcurrent,"hotplate");
const peerMixer=lab.addPlacedLabDevice(beforeConcurrent,"stirrer");
const joined=lab.mergeLabBench(beforeConcurrent,peerPlate,peerMixer);
assert.equal(lab.placedLabDevices(joined).length,2,
 "Concurrent peers putting different devices on one table must both survive");
assert.equal(new Set(lab.placedLabDevices(joined).map(d=>d.id)).size,2);
let decant=lab.defaultLabBench();
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
assert.equal(lab.labDevices.length,5);
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
let combinedSupport=lab.defaultLabBench();
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
let freeMixer=lab.addPlacedLabDevice(lab.defaultLabBench(),"stirrer");
const freeMixerId=lab.placedLabDevices(freeMixer)[0].id;
freeMixer=lab.setPlacedDevicePower(freeMixer,freeMixerId,true);
assert.equal(lab.placedLabDevices(freeMixer)[0].powered,true,
 "A mixer may be switched on without a mounted vessel");
assert.equal(freeMixer.stirringVesselId,undefined);
assert.match(read("src/lektrusChemistryBench.css"),
 /\.lektrus-lab-placed-device\.is-selected>\.lektrus-lab-device-icon/,
 "Selection must outline the apparatus silhouette, not a rectangular tile");

let valve=lab.defaultLabBench();
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
let preheated=lab.defaultLabBench();
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
let carbonate=lab.defaultLabBench();
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
const base=lab.defaultLabBench();
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
 let b=lab.addLabVessel(lab.defaultLabBench(),glass.id);
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
let calibrated=lab.addLabVessel(lab.defaultLabBench(),"pipette");
const pipetteId=calibrated.vessels.find(v=>v.kind==="pipette").id;
calibrated=lab.putLabReagent(calibrated,"v1","HCl",{value:40,unit:"ml",concentrationM:.1});
assert.equal(lab.putLabReagent(calibrated,pipetteId,"HCl",
 {value:30,unit:"ml",concentrationM:.1}),calibrated,
 "A 25 ml pipette cannot hold 30 ml");
calibrated=lab.transferLabMeasuredLiquid(calibrated,"v1",pipetteId,10);
assert.equal(calibrated.vessels.find(v=>v.id===pipetteId).doses.HCl.value,10);
assert.equal(calibrated.vessels.find(v=>v.id==="v1").doses.HCl.value,30);
calibrated=lab.addLabVessel(calibrated,"cylinder");
const cylinderId=calibrated.vessels.find(v=>v.kind==="cylinder").id;
calibrated=lab.transferLabMeasuredLiquid(calibrated,pipetteId,cylinderId,4);
assert.equal(calibrated.vessels.find(v=>v.id===pipetteId).doses.HCl.value,6);
assert.equal(calibrated.vessels.find(v=>v.id===cylinderId).doses.HCl.value,4);
assert.equal(calibrated.vessels.find(v=>v.id===cylinderId).doses.HCl.concentrationM,.1);
assert.equal(lab.transferLabMeasuredLiquid(calibrated,pipetteId,cylinderId,50),calibrated);
let markFlask=lab.addLabVessel(lab.defaultLabBench(),"volumetric");
const markId=markFlask.vessels.find(v=>v.kind==="volumetric").id;
markFlask=lab.putLabReagent(markFlask,markId,"NaCl",{value:20,unit:"ml"});
markFlask=lab.fillLabVolumetricFlask(markFlask,markId);
assert.equal(markFlask.vessels.find(v=>v.id===markId).doses.H2O.value,80);
assert.equal(lab.fillLabVolumetricFlask(markFlask,markId),markFlask,
 "A volumetric flask must stop at the calibration mark");
// Retired funnel is no longer a supported lab object, including on old boards.
const legacyFunnel=lab.readLabBench({scienceLabBench:{
 ...lab.defaultLabBench(),vessels:[...lab.defaultLabBench().vessels,
 {id:"legacy-funnel",kind:"funnel",x:20,y:30,reagents:[],environment:"dry",observed:false}]
}});
assert.ok(!legacyFunnel.vessels.some(v=>v.kind==="funnel"));
assert.doesNotMatch(read("src/LektrusLabGlasswareIcon.tsx"),/funnel:/);
assert.doesNotMatch(read("src/LektrusChemistryBench.tsx"),/funnel:/);
assert.doesNotMatch(read("src/lektrusChemistryBenchModel.ts"),/pourThroughLabFunnel/);

// A pipette takes the EXACT requested portion, never an arbitrary 5 ml.
let measured=lab.addLabVessel(lab.defaultLabBench(),"pipette");
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
const solidSample=lab.putLabReagent(lab.defaultLabBench(),"v1","NaCl",{value:12,unit:"g"});
assert.equal(lab.labVesselQuantity(solidSample.vessels[0]).massG,12);
assert.equal(lab.labVesselQuantity(solidSample.vessels[0]).volumeMl,0);
assert.ok(lab.labVesselQuantity(solidSample.vessels[0]).solidFraction>0);
// Exact pipette sampling from multicomponent solutions is atomic. Rounding
// cannot create a negative aliquot or list a component that did not transfer.
let diluteSample=lab.defaultLabBench();
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
assert.match(scienceEditor,/onExperimentLiveChange\?\.\(draft,next\)/);

const savedQuick=lab.defaultLabQuickReagents();
assert.ok(savedQuick.length>=8&&savedQuick.length<=lab.MAX_QUICK_REAGENTS);
let quickBench=lab.defaultLabBench();
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
assert.match(surface,/fillLabVolumetricFlask/);
assert.doesNotMatch(surface,/onClick=\{e=>\{e\.stopPropagation\(\);if\(selected\?\.reagents\.length\)clean/,
 "The sink must never empty selected glassware merely because it was clicked");
assert.match(surface,/if\(inSink\(p\)\)clean\(g\.id\)/,
 "Only dropping an individual vessel into the sink triggers disposal");

// Stepwise pouring uses twenty fixed 5% portions, not exponential depletion.
assert.equal(lab.LAB_POUR_STEPS,20);
assert.equal(lab.LAB_POUR_INTERVAL_MS,150);
let gradual=lab.addLabVessel(lab.defaultLabBench(),"conical");
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
let unknownGradual=lab.addLabVessel(lab.defaultLabBench(),"tube");
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
assert.match(hoverSurface,/setTimeout\(perform,2000\)/,"Pouring and pipettes both require two seconds uninterrupted contact");
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
let onFoot=lab.addPlacedLabDevice(lab.defaultLabBench(),"tripod",{x:40,y:68});
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
const atClose=onFoot.vessels.find(v=>v.id==="v1").doses.HCl.value;
onFoot=lab.advanceLabSimulation(onFoot,6000);
assert.equal(onFoot.vessels.find(v=>v.id==="v1").doses.HCl.value,atClose,
 "Closing the valve instantly stops dosing");
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
assert.equal(chem.startQuantifiedLabReaction(neutralization,["HCl","NaOH"],{
 HCl:{value:10,unit:"ml"},NaOH:{value:5,unit:"ml",concentrationM:.1}
}),null,"Missing source molarity must not be guessed");
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
let liveReaction=lab.putLabReagent(lab.defaultLabBench(),"v1","HCl",
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
let accurateTitration=lab.putLabReagent(lab.defaultLabBench(),"v1","HCl",
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
assert.match(editorFixed,/const width=w\/scale/,
 "Fullscreen scales rather than scrolls a 1600 x 1000 stage");
assert.match(read("src/lektrusChemistryBench.css"),/lektrus-lab-fit-stage/);
const polishedSurface=read("src/LektrusChemistryBench.tsx");
assert.match(polishedSurface,/bench\.reactionLog/);
assert.match(polishedSurface,/current.vessels.some\(labReactionNeedsTick\)/);
assert.match(polishedSurface,/isQuantifiedSolution/);
assert.match(polishedSurface,/settings.showEquationBoard&&<div className="lektrus-lab-chalk-writing"/);
const standFoot=read("src/LektrusLabDeviceIcon.tsx");
assert.match(standFoot,/M22 96V3/);
assert.match(read("src/lektrusLabLayout.ts"),/77\/110/);

// Mode-specific apparatus must not remove any already placed work.
assert.deepEqual(lab.LAB_MODES.map(m=>m.id),
 ["reactions","titration","solutions","synthesis"]);
let modeBench=lab.defaultLabBench();
const previousPositions=JSON.stringify(modeBench.vessels);
modeBench=lab.setLabMode(modeBench,"titration");
assert.equal(lab.labMode(modeBench),"titration");
assert.equal(JSON.stringify(modeBench.vessels),previousPositions);
assert.ok(lab.glasswareForLabMode(modeBench).some(v=>v.id==="burette"));
assert.ok(lab.devicesForLabMode(modeBench).some(v=>v.id==="tripod"));
assert.ok(!lab.glasswareForLabMode(modeBench).some(v=>v.id==="crucible"));
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
assert.match(editorFixed,/const scale=h\/1000/);
const higherStand=lab.addPlacedLabDevice(lab.defaultLabBench(),"tripod");
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

const starterInput=lab.setLabMode(lab.defaultLabBench(),"titration");
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
const modeBaseline=lab.defaultLabBench();
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
assert.match(polishedLabSource,/contactTimer\.current=setTimeout\(perform,2000\)/);
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
assert.ok(lab.devicesForLabMode(lab.defaultLabBench()).some(v=>v.id==="filter"));

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
let filtered=lab.putLabReagent(lab.defaultLabBench(),"v1","AgNO3",
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
assert.ok(Math.abs(separated.vessels[0].filteredResidue.massG-.143318)<1e-5);
assert.equal(separated.vessels[0].doses.AgCl.unit,"g");
const filtrate=separated.vessels.find(v=>v.id===destination);
assert.equal(lab.labVesselQuantity(filtrate).volumeMl,20);
assert.ok(filtrate.filteredSolution?.solutes.includes("NaNO3"));
assert.ok(!filtrate.reagents.includes("AgCl"),
 "The insoluble salt cannot magically pass through a filter");
assert.equal(lab.labVesselQuantity(separated.vessels[0]).volumeMl,0);
assert.equal(lab.filterLabPrecipitate(separated,"v1",destination),separated,
 "The same collected residue cannot be filtered repeatedly");
const qualitative=lab.addPlacedLabDevice(lab.addLabVessel(lab.putLabReagent(
 lab.putLabReagent(lab.defaultLabBench(),"v1","AgNO3"),"v1","NaCl"),
 "conical"),"filter");
const qTarget=qualitative.vessels.find(v=>v.kind==="conical").id;
const qFiltered=lab.filterLabPrecipitate(qualitative,"v1",qTarget);
assert.equal(qFiltered.vessels[0].filteredResidue?.formula,"AgCl");
assert.equal(qFiltered.vessels[0].filteredResidue?.massG,undefined,
 "Unknown original amounts must not create a fictitious precipitate mass");

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
const pureWater=lab.putLabReagent(lab.defaultLabBench(),"v1","H2O",
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
assert.match(polishedLabSource,/lektrus-lab-steam-plumes/);
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
let boiling=lab.putLabReagent(lab.defaultLabBench(),"v1","H2O",
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

let melt=lab.putLabReagent(lab.defaultLabBench(),"v1","Na",{value:8,unit:"g"});
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

const alcohol=lab.putLabReagent(lab.defaultLabBench(),"v1","C2H5OH",{value:30,unit:"ml"});
let alcoholHeat=lab.addPlacedLabDevice(alcohol,"hotplate");
const alcoholHeater=lab.placedLabDevices(alcoholHeat)[0].id;
alcoholHeat=lab.applyPlacedLabDevice(alcoholHeat,alcoholHeater,"v1");
alcoholHeat=lab.setLabHotplateTemperature(alcoholHeat,alcoholHeater,160);
alcoholHeat=lab.setPlacedDevicePower(alcoholHeat,alcoholHeater,true);
alcoholHeat=lab.advanceLabSimulation(alcoholHeat,0);
for(let i=1;i<=130;i++)alcoholHeat=lab.advanceLabSimulation(alcoholHeat,i*2000);
assert.ok((alcoholHeat.vessels[0].temperatureC??0)<=78.37,
 "Ethanol cannot use the 100°C water boiling point");
assert.ok(lab.labVesselQuantity(alcoholHeat.vessels[0]).volumeMl<30);
const saline=lab.putLabReagent(lab.putLabReagent(lab.defaultLabBench(),"v1",
 "H2O",{value:30,unit:"ml"}),"v1","NaCl",{value:2,unit:"g"});
assert.equal(thermal.labVesselThermal(saline.vessels[0].reagents,saline.vessels[0].doses),
 null,"A solution has no invented exact boiling temperature");
assert.match(read("src/LektrusChemistryBench.tsx"),/lektrus-lab-molten-liquid/);
assert.match(read("src/LektrusChemistryBench.tsx"),/Плавление \/ кристаллизация/);
assert.match(read("src/LektrusChemistryBench.tsx"),/Порошок \/ кусочки/);
assert.match(read("src/lektrusChemistryBench.css"),/lektrus-lab-solid-charge/);
console.log("Thermal registry, boiling, melting and cooling verified");


let crucible=lab.addLabVessel(lab.defaultLabBench(),"crucible");
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

let sodiumVessel=lab.putLabReagent(lab.defaultLabBench(),"v1","Na",{value:1,unit:"g"});
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

let acidSodium=lab.putLabReagent(lab.defaultLabBench(),"v1","Na",{value:1,unit:"g"});
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

let neutralizationHeat=lab.putLabReagent(lab.defaultLabBench(),"v1","HCl",
 {value:20,unit:"ml",concentrationM:1});
neutralizationHeat=lab.putLabReagent(neutralizationHeat,"v1","NaOH",
 {value:20,unit:"ml",concentrationM:1});
neutralizationHeat=lab.advanceLabSimulation(neutralizationHeat,0);
neutralizationHeat=lab.advanceLabSimulation(neutralizationHeat,2000);
assert.equal(neutralizationHeat.vessels[0].reactionHeat.direction,"exothermic");
assert.ok(neutralizationHeat.vessels[0].reactionHeat.deltaC>0);
assert.ok(neutralizationHeat.vessels[0].temperatureC>22);
assert.equal(lab.labObservation(neutralizationHeat.vessels[0]).status,"reaction");

let calciteBench=lab.addLabVessel(lab.defaultLabBench(),"crucible");
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
let salineHeat=lab.putLabReagent(lab.defaultLabBench(),"v1","H2O",
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
 let gasHeated=lab.addLabVessel(lab.defaultLabBench(),"crucible");
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
const persistedLab=lab.defaultLabBench();
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
assert.equal(lab.labMode(lab.defaultLabBench()),"reactions");
assert.equal(lab.labMode({...lab.defaultLabBench(),mode:"qualitative"}),"reactions");
assert.equal(lab.labMode({...lab.defaultLabBench(),mode:"quantitative"}),"reactions");
const chalkSource=lab.putLabReagent(lab.defaultLabBench(),"v1","NaCl",
 {value:10,unit:"ml",concentrationM:.1});
const chalkReacted=lab.putLabReagent(chalkSource,"v1","AgNO3",
 {value:10,unit:"ml",concentrationM:.1});
let chalk=lab.recordLabReactions(chalkReacted);
assert.equal(chalk.reactionLog.length,1,"An identified reaction is added to the permanent wall");
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
assert.ok(Math.abs(physical.precipitateG-.143318)<1e-5,
 "Sediment mass must be based on actual produced moles, not a decorative fixed layer");
assert.ok(physical.precipitateFraction>0&&physical.precipitateFraction<.01);
assert.ok(physical.solution.some(v=>v.formula==="NaNO3"));
assert.ok(!physical.solution.some(v=>v.formula==="AgCl"),
 "Insoluble AgCl must not appear in the dissolved-products list");
assert.ok(physical.precipitateVolumeMl<physical.solutionMl);
const halfPrecipitation=lab.labVesselContents({...measuredSediment.vessels[0],
 reactionAmounts:{...measuredSediment.vessels[0].reactionAmounts,
  productsMol:Object.fromEntries(Object.entries(
   measuredSediment.vessels[0].reactionAmounts.productsMol).map(([id,m])=>[id,m/2]))}});
assert.ok(Math.abs(halfPrecipitation.precipitateG/physical.precipitateG-.5)<.001);
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

const originalShared=lab.recordLabReactions(chalkReacted);
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
 lab.putLabReagent(lab.defaultLabBench(),"v1","NaCl"),"v1","AgNO3");
const qualContents=lab.labVesselContents(plainQualitative.vessels[0]);
assert.deepEqual(qualContents.solid.map(v=>v.formula),["AgCl"],
 "Qualitative reaction must show the insoluble product, not the initial reagent list");
assert.ok(qualContents.solution.some(v=>v.formula==="NaNO3"));
assert.ok(!qualContents.solution.some(v=>v.formula==="AgNO3"));
assert.equal(qualContents.precipitateG,undefined,
 "With no quantified doses, mass of sediment must stay unknown");
assert.equal(qualContents.remainderUnknown,true,
 "Unmeasured initial reactant excess must be explicitly unknown");
console.log("Qualitative chemistry shows products, not fabricated residue masses");


/* An empty worktop click must deselect without moving/emptying any vessel. */
let pickedVessel=lab.addLabVessel(lab.defaultLabBench(),"tube");
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
 lab.putLabReagent(lab.defaultLabBench(),"v1","NaOH",
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
const emptyLiquid=lab.putLabReagent(lab.defaultLabBench(),"v1","Na",
 {value:2,unit:"g"});
assert.equal(lab.setLabIndicator(emptyLiquid,"v1","litmus"),emptyLiquid,
 "A liquid indicator cannot be added to a dry metal");
const rinsed=lab.emptyLabVessel(repeated,"v1").vessels[0];
assert.equal(rinsed.indicatorDrops,undefined);
assert.equal(rinsed.indicatorAddedAtMs,undefined);

let endpointBench=lab.putLabReagent(lab.defaultLabBench(),"v1","HCl",
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


let liquidTransfer=lab.putLabReagent(lab.defaultLabBench(),"v1","HCl",
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
 doses:{NaOH:{value:20,unit:"ml",concentrationM:.1}}}).pH,13);
const perfectNeutral={reagents:["HCl","NaOH"],environment:"aqueous",doses:{
 HCl:{value:20,unit:"ml",concentrationM:.1},
 NaOH:{value:20,unit:"ml",concentrationM:.1}}};
assert.equal(acidBase.labVesselPH(perfectNeutral).pH,7);
assert.ok(acidBase.labVesselPH({...perfectNeutral,doses:{...perfectNeutral.doses,
 NaOH:{value:10,unit:"ml",concentrationM:.1}}}).pH<2);
assert.ok(acidBase.labVesselPH({...perfectNeutral,doses:{...perfectNeutral.doses,
 NaOH:{value:30,unit:"ml",concentrationM:.1}}}).pH>12);
assert.equal(acidBase.labVesselPH({reagents:["HCl"],environment:"aqueous",
 doses:{HCl:{value:20,unit:"ml"}}}),null,
 "Missing molarity must not produce an invented pH");
assert.equal(acidBase.labVesselPH({reagents:["HCl","CuSO4"],environment:"aqueous",
 doses:{HCl:{value:20,unit:"ml",concentrationM:.1},CuSO4:{value:10,unit:"ml"}}}),null,
 "Unmodelled hydrolysis must not borrow pH from a strong acid");
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
let phBeaker=lab.putLabReagent(lab.defaultLabBench(),"v1","HCl",
 {value:20,unit:"ml",concentrationM:.1});
phBeaker=lab.setLabIndicator(phBeaker,"v1","phenolphthalein");
assert.equal(lab.labIndicatorResult(phBeaker.vessels[0]).pH,1);
phBeaker=lab.putLabReagent(phBeaker,"v1","NaOH",
 {value:20,unit:"ml",concentrationM:.1});
assert.equal(lab.labIndicatorResult(phBeaker.vessels[0]).pH,7);
assert.equal(lab.labIndicatorResult(phBeaker.vessels[0]).color,undefined,
 "Phenolphthalein is colorless at strong acid/base equivalence");
const phOther=lab.putLabReagent(lab.defaultLabBench(),"v1","HCl",
 {value:20,unit:"ml",concentrationM:.1});
assert.equal(acidBase.labVesselPH(phOther.vessels[0]).pH,1);
assert.match(read("src/LektrusChemistryBench.tsx"),/const ph=labVesselPH\(vessel\)/);
assert.match(read("src/LektrusChemistryBench.tsx"),/lektrus-lab-inline-ph/);
assert.match(read("src/lektrusChemistryBench.css"),/left:calc\(100% \+ 6px\)/);
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
let noDose=lab.putLabReagent(lab.defaultLabBench(),"v1","AgNO3");
assert.deepEqual(noDose.vessels[0].doses.AgNO3,
 {value:10,unit:"ml",concentrationM:.1});
const quicks=lab.labQuickReagents(lab.defaultLabBench());
assert.ok(quicks.every(q=>q.dose.value>0));
assert.ok(quicks.filter(q=>catalog.labIsPreparedStock(q.id)).every(q=>q.dose.concentrationM===.1));
let mixedConcentrations=lab.putLabReagent(lab.defaultLabBench(),"v1","HCl",
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
  10*.785/chem.labMolarMass("C2H5OH"))<1e-10);
assert.ok(chem.labDoseMoles("HCl",{value:10,unit:"ml"})===undefined,
 "An arbitrary no-concentration liquid dose must not silently become 0.1 M in the formula calculator");
assert.match(read("src/LektrusChemistryBench.tsx"),/labIsPreparedStock\(reagent\.id\)/);
assert.match(read("src/LektrusChemistryBench.tsx"),/labDefaultStockDose\(reagent/);
console.log("Quantified stocks, reproducible molarity and moles by known physical dose: OK");
