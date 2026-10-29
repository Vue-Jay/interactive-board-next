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
const lab=load("src/lektrusChemistryBenchModel.ts",key=>{
 if(key==="./lektrusLabTitration")return titration;
 if(key==="./lektrusLabLayout")return layout;
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
indicatorBench=lab.putLabReagent(indicatorBench,"v1","HCl");
indicatorBench=lab.setLabIndicator(indicatorBench,"v1","litmus");
assert.equal(lab.labIndicatorResult(indicatorBench.vessels[0]).medium,"acid");
assert.equal(lab.labIndicatorResult(indicatorBench.vessels[0]).color,"#d85761");
indicatorBench=lab.emptyLabVessel(indicatorBench,"v1");
assert.equal(indicatorBench.vessels[0].indicator,undefined,"Cleaning also removes indicator");
indicatorBench=lab.putLabReagent(indicatorBench,"v1","NaOH");
indicatorBench=lab.setLabIndicator(indicatorBench,"v1","phenolphthalein");
assert.equal(lab.labIndicatorResult(indicatorBench.vessels[0]).medium,"base");
assert.equal(lab.labIndicatorResult(indicatorBench.vessels[0]).color,"#d83a96");
let neutral=lab.putLabReagent(lab.defaultLabBench(),"v1","H2O");
neutral=lab.setLabIndicator(neutral,"v1","universal");
assert.equal(lab.labIndicatorResult(neutral.vessels[0]).medium,"neutral");
let salt=lab.putLabReagent(lab.defaultLabBench(),"v1","NaCl");
salt=lab.setLabIndicator(salt,"v1","universal");
assert.equal(lab.labIndicatorResult(salt.vessels[0]).medium,"unknown",
 "The model must not infer pH from an unspecified salt solution");
let transferred=lab.addLabVessel(neutral,"tube");
transferred=lab.pourLabVessel(transferred,"v1","v2");
assert.equal(transferred.vessels[0].indicator,undefined,"Empty source has no indicator");
assert.equal(transferred.vessels[1].indicator,"universal","Indicator travels with solution");
let mixed=lab.addLabVessel(indicatorBench,"flask");
mixed=lab.putLabReagent(mixed,mixed.selectedId,"HCl");
mixed=lab.pourLabVessel(mixed,mixed.selectedId,"v1");
assert.equal(lab.labIndicatorResult(mixed.vessels[0]).medium,"unknown",
 "Neutralisation cannot give an exact indicator colour without quantities");
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
assert.equal(devices.devices.length,4,"The lab provides four physical instruments without thermometer");
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
assert.match(catalogSource,/labDevices\.map/);
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
assert.match(redesignedLab,/lektrus-lab-chalk-steps/);
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
assert.equal(labLayout.labStandClampSvgY(0),64);
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
assert.equal(lab.labDevices.length,4);
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
assert.match(read("src/LektrusChemistryBench.tsx"),/lektrus-lab-modal-settings/);
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
assert.match(read("src/lektrusSciencePresets.ts"),/x:x-830,y:y-530,text:"Химический стол"/,
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
assert.match(boardLaboratory,/lektrus-lab-object-grip/,
 "Lab object must have an unobstructed whole-object drag handle");
assert.doesNotMatch(boardLaboratory,/className="lektrus-chemistry-bench-on-board"[^>]*data-board-interactive/,
 "The object wrapper must not suppress the board's normal transform gestures");

const hugeLabCss=read("src/lektrusChemistryBench.css");
assert.match(boardLaboratory,/className="lektrus-chemistry-bench-on-board"[\s\S]*?onWheel=\{e=>e\.stopPropagation\(\)\}/,
 "Scrolling inside the board lab must not zoom the board");
assert.match(editorLaboratory,/className="lektrus-lab-editor-bench-viewport"/,
 "All lab content must scroll even in the smaller editing modal");
assert.match(hugeLabCss,/lektrus-chemistry-bench-on-board\{[\s\S]*?overflow:auto!important/,
 "The board lab viewport must allow scrolling");
assert.match(hugeLabCss,/min-width:1600px!important/,
 "The laboratory must have a full-size unclipped stage at any object size");
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
assert.match(surface,/labMeasuredCapacityMl/);
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
assert.equal(unknownGradual.vessels.find(v=>v.id==="v1").pourFraction,.25);
assert.equal(unknownGradual.vessels.find(v=>v.id==="v2").pourFraction,.25);
assert.deepEqual(lab.labPourAmounts(unknownGradual.pouring),[],
 "Unknown quantities display percentages, not invented ml");
assert.ok(unknownGradual.pouring.unmeasured);
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
assert.match(hoverSurface,/if\(isPipette\)perform\(\)/,"Pipette draws at contact without any wait");
assert.match(hoverSurface,/setTimeout\(perform,120\)/,"Brief dwell prevents accidental spills");
assert.match(hoverSurface,/endContact\(\)/,"Release cancels the active pour");
assert.match(hoverSurface,/beginContact\(g\.id,pouring\)/);
assert.match(hoverSurface,/const drawing=pipette\.reagents\.length===0/);
assert.match(hoverSurface,/transferLabMeasuredLiquid\(current,donor\.id,receiver\.id,requested\)/);
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
assert.match(hoverSurface,/totalLabel\|\|substanceState/);

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

console.log("Virtual chemistry bench: glassware, mixing, curated results, heating, persistence and peer merge passed");
