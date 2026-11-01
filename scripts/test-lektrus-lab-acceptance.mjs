/** Release-gate school experiments. Run actual lab models, not mock chemistry.
 * Each check has a stable ID and fails the build independently.
 * This is computational acceptance; touch usability is a separate release gate.
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
 const source=fs.readFileSync(resolved,"utf8");
 const js=ts.transpileModule(source,{compilerOptions:{
  module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2023
 }}).outputText;
 new Function("require","module","exports",js)(id=>{
  assert.ok(id.startsWith("."),"Unexpected import "+id);
  return load(path.resolve(path.dirname(resolved),id+".ts"));
 },mod,mod.exports);
 return mod.exports;
}
const lab=load("src/lektrusChemistryBenchModel.ts");
const reaction=load("src/lektrusReactionDatabase.ts");
const stoich=load("src/lektrusLabStoichiometry.ts");
const network=load("src/lektrusLabReactionNetwork.ts");
const titration=load("src/lektrusLabTitration.ts");
const boardModel=load("src/boardModel.ts");
const dose=(value=10,concentrationM=.1)=>({unit:"ml",value,concentrationM});
const high=()=>{
 const bench=lab.defaultLabBench();
 return {...bench,simulationPaused:false,
  settings:{...bench.settings,realism:"high"}};
};
const results=[];
function check(id,name,fn){
 try{
  fn();
  results.push({id,name,ok:true});
  console.log("PASS "+id+" "+name);
 }catch(error){
  results.push({id,name,ok:false});
  console.error("FAIL "+id+" "+name);
  console.error(error?.stack??error);
 }
}
function makePrecipitate(){
 let bench=lab.putLabReagent(high(),"v1","AgNO3",dose());
 bench=lab.putLabReagent(bench,"v1","NaCl",dose());
 bench=lab.advanceLabSimulation(bench,0);
 bench=lab.advanceLabSimulation(bench,1000);
 bench=lab.advanceLabSimulation(bench,6000);
 return bench;
}
const approx=(actual,expected,tolerance,why)=>{
 assert.ok(Number.isFinite(actual)&&Math.abs(actual-expected)<=tolerance,
  why+": "+actual+" != "+expected);
};

check("LAB-01","Каталог и сбалансированные школьные реакции",()=>{
 assert.equal(reaction.substances.length,180);
 const reviewed=reaction.reviewedReactionCases.filter(v=>v.status==="reaction");
 assert.ok(reviewed.length>=300);
 const ids=new Set(reaction.substances.map(s=>s.id));
 assert.equal(ids.size,180);
 for(const row of reviewed){
  const equation=stoich.parseBalancedLabEquation(row.equation);
  assert.ok(equation,row.equation);
  assert.ok(row.reactants.every(id=>ids.has(id)),row.equation);
  assert.ok([...equation.reactants,...equation.products].every(
   term=>stoich.labMolarMass(term.formula)>0),row.equation);
 }
 assert.equal(lab.labBenchSettings(lab.defaultLabBench()).realism,"low");
 assert.equal(lab.defaultLabBench().simulationPaused,true,
  "Every new school experiment must start on pause");
 assert.equal(lab.LAB_MODES.length,5);
});

check("LAB-02","Осадок остаётся на дне и уравнение пишется после реакции",()=>{
 let b=lab.putLabReagent(high(),"v1","AgNO3",dose());
 b=lab.putLabReagent(b,"v1","NaCl",dose());
 assert.equal(lab.recordLabReactions(b),b);
 b=lab.advanceLabSimulation(b,0);
 b=lab.advanceLabSimulation(b,1000);
 assert.equal(lab.recordLabReactions(b).reactionLog?.length??0,0);
 b=lab.advanceLabSimulation(b,6000);
 assert.equal(b.vessels[0].reactionAmounts?.complete,true);
 const contents=lab.labVesselContents(b.vessels[0]);
 assert.ok(contents.solid.some(s=>s.formula==="AgCl"));
 assert.ok(contents.precipitateG>.143&&contents.precipitateG<.144);
 const layer=lab.labVesselSolidDisplacement(b.vessels[0]);
 assert.ok(layer.volumeMl>0);
 const recorded=lab.recordLabReactions(b);
 assert.equal(recorded.reactionLog.length,1);
 assert.equal(lab.recordLabReactions(recorded).reactionLog.length,1);
 const indicator=lab.setLabIndicator(recorded,"v1","litmus");
 assert.ok(lab.labVesselContents(indicator.vessels[0]).precipitateG>.143,
  "Adding an indicator cannot remove solid already on the bottom");
});

check("LAB-03","Фильтрация разделяет массу твёрдого и раствора",()=>{
 let b=makePrecipitate();
 b=lab.addLabVessel(b,"conical");
 const receiver=b.selectedId;
 b=lab.addPlacedLabDevice(b,"filter");
 const inputMass=network.labInventoryMassG(network.simulateLabInventory(b.vessels[0]));
 const separated=lab.filterLabPrecipitate(b,"v1",receiver);
 assert.notEqual(separated,b);
 const source=separated.vessels.find(v=>v.id==="v1");
 const filtrate=separated.vessels.find(v=>v.id===receiver);
 assert.equal(source.filteredResidue?.formula,"AgCl");
 assert.ok(filtrate.filteredSolution?.solutes.includes("NaNO3"));
 assert.equal(lab.labVesselQuantity(filtrate).volumeMl,20);
 assert.ok(!filtrate.reagents.includes("AgCl"));
 const massSource=network.labInventoryMassG(network.simulateLabInventory(source));
 const massFiltrate=network.labInventoryMassG(network.simulateLabInventory({
  ...filtrate,volumeMl:lab.labVesselQuantity(filtrate).volumeMl
 }));
 approx(massSource+massFiltrate,inputMass,1e-6,"Mass after filtration");
});

check("LAB-04","Титрование: рассчитанная точка эквивалентности",()=>{
 let b=lab.putLabReagent(high(),"v1","HCl",dose(25));
 b=lab.addLabVessel(b,"burette");
 const id=b.selectedId;
 b=lab.putLabReagent(b,id,"NaOH",dose(30));
 b=lab.setLabIndicator(b,"v1","phenolphthalein");
 b=lab.dripLabVessel(b,id,"v1",24);
 assert.ok(titration.titrationReading(b.titration).pH<7);
 b=lab.dripLabVessel(b,id,"v1",1);
 approx(titration.titrationReading(b.titration).pH,7,.001,"Equivalence pH");
 approx(b.vessels.find(v=>v.id===id).doses.NaOH.value,5,.001,"Burette remainder");
 b=lab.dripLabVessel(b,id,"v1",.1);
 assert.ok(titration.titrationReading(b.titration).pH>7);
});

check("LAB-05","Пауза и постепенное выпадение осадка после переливания",()=>{
 let b=lab.putLabReagent(high(),"v1","NaCl",dose());
 b=lab.addLabVessel(b,"beaker");
 b=lab.putLabReagent(b,"v2","AgNO3",dose());
 b={...b,vessels:b.vessels.map(v=>v.id!=="v1"?v:{
  ...v,chemicalInventory:{speciesMol:{NaCl:.001},solidMol:{},
   retainedGasMol:{},releasedGasMol:{}}
 })};
 b=lab.setLabSimulationPaused(b,true,1000);
 b=lab.pourLabVessel(b,"v1","v2");
 assert.equal(b.vessels[1].pendingInventoryReaction,true);
 assert.equal(b.vessels[1].chemicalInventory.solidMol.AgCl??0,0);
 assert.equal(lab.advanceLabSimulation(b,1500),b);
 assert.equal(lab.recordLabReactions(b).reactionLog?.length??0,0);
 b=lab.setLabSimulationPaused(b,false,2000);
 b=lab.advanceLabSimulation(b,3000);
 const growing=b.vessels[1].chemicalInventory.solidMol.AgCl??0;
 assert.ok(growing>0&&growing<.0009);
 assert.equal(lab.recordLabReactions(b).reactionLog?.length??0,0);
 b=lab.advanceLabSimulation(b,9000);
 assert.ok((b.vessels[1].chemicalInventory.solidMol.AgCl??0)>.0009);
 assert.equal(lab.recordLabReactions(b).reactionLog.length,1);
});

check("LAB-06","Газ выделяется постепенно и собирается без удвоения",()=>{
 let b=lab.putLabReagent(high(),"v1","Na2CO3",dose());
 b=lab.addLabVessel(b,"beaker");
 b={...b,vessels:b.vessels.map(v=>v.id!=="v1"?v:{
  ...v,chemicalInventory:{speciesMol:{Na2CO3:.001},solidMol:{},
   releasedGasMol:{},retainedGasMol:{}}
 })};
 b=lab.setLabSimulationPaused(b,true,1000);
 b=lab.putLabReagent(b,"v1","HCl",dose(20));
 assert.equal(b.vessels[0].pendingInventoryReaction,true);
 b=lab.setLabGasCollection(b,"v1","v2");
 b=lab.setLabSimulationPaused(b,false,2000);
 b=lab.advanceLabSimulation(b,3000);
 const partial=b.vessels[1].doses?.CO2?.value??0;
 assert.ok(partial>0&&partial<5,"Only gas actually produced is collected");
 assert.equal(lab.recordLabReactions(b).reactionLog?.length??0,0);
 for(const at of [13000,23000,33000])
  b=lab.advanceLabSimulation(b,at);
 const source=b.vessels[0],receiver=b.vessels[1];
 assert.equal(source.pendingInventoryReaction,undefined);
 assert.ok((source.chemicalInventory.releasedGasMol.CO2??0)>.00099);
 assert.ok((receiver.doses?.CO2?.value??0)>24);
 assert.ok((receiver.doses?.CO2?.value??0)<=24.47);
 assert.equal(lab.recordLabReactions(b).reactionLog.length,1);
 const detached=lab.setLabGasCollection(b,"v1",undefined);
 const reattached=lab.setLabGasCollection(detached,"v1","v2");
 assert.equal(reattached.vessels[1].doses.CO2.value,receiver.doses.CO2.value);
});

check("LAB-07","Нагрев при измеренной нейтрализации",()=>{
 let b=lab.putLabReagent(high(),"v1","HCl",dose(20,1));
 b=lab.putLabReagent(b,"v1","NaOH",dose(20,1));
 b=lab.advanceLabSimulation(b,0);
 b=lab.advanceLabSimulation(b,2000);
 assert.equal(b.vessels[0].reactionHeat?.direction,"exothermic");
 assert.ok(b.vessels[0].reactionHeat.deltaC>0);
 assert.ok((b.vessels[0].temperatureC??22)>22);
});

check("LAB-08","Нагрев и выпаривание сохраняют положительный объём",()=>{
 let b=lab.putLabReagent(high(),"v1","H2O",{unit:"ml",value:20});
 b=lab.addPlacedLabDevice(b,"hotplate");
 const heater=lab.placedLabDevices(b).find(d=>d.kind==="hotplate").id;
 b=lab.applyPlacedLabDevice(b,heater,"v1");
 b=lab.setLabHotplateTemperature(b,heater,185);
 b=lab.setPlacedDevicePower(b,heater,true);
 b=lab.advanceLabSimulation(b,0);
 for(let i=1;i<=130;i++)b=lab.advanceLabSimulation(b,i*2000);
 assert.ok((b.vessels[0].temperatureC??22)>=99);
 const volume=lab.labVesselQuantity(b.vessels[0]).volumeMl;
 assert.ok(volume>=0&&volume<20,"Evaporation conserves solvent bounds");
});

check("LAB-09","Растворение и кристаллизация сохраняют массу соли",()=>{
 let b=lab.putLabReagent(high(),"v1","H2O",{unit:"ml",value:10});
 b=lab.putLabReagent(b,"v1","KNO3",{unit:"g",value:4});
 assert.equal(b.vessels[0].physicalProcess,"dissolving");
 b=lab.advanceLabSimulation(b,0);
 b=lab.advanceLabSimulation(b,5000);
 const contents=lab.labVesselContents(b.vessels[0]);
 const solid=contents.solid.find(v=>v.formula==="KNO3");
 const dissolved=contents.solution.find(v=>v.formula==="KNO3");
 assert.ok(solid?.massG>0&&dissolved?.mmol>0);
 approx(solid.massG+dissolved.mmol*stoich.labMolarMass("KNO3")/1000,
  4,.002,"Dissolved and solid salt mass");
});

check("LAB-10","Синхронизация и очистка исключают возврат старого опыта",()=>{
 const previous=lab.addLabVessel(lab.defaultLabBench(),"beaker");
 const mine=lab.putLabReagent(previous,"v1","NaCl",dose());
 const remote={...previous,vessels:previous.vessels.map(v=>
  v.id==="v2"?{...v,x:72}:v),event:previous.event+1};
 const merged=lab.mergeLabBench(previous,mine,remote);
 assert.ok(merged.vessels.find(v=>v.id==="v1").reagents.includes("NaCl"));
 assert.equal(merged.vessels.find(v=>v.id==="v2").x,72);
 const cleared=lab.clearLabTable(merged);
 assert.equal(cleared.vessels.length,0);
 const final=lab.mergeLabBench(previous,merged,cleared);
 assert.equal(final.vessels.length,0,"Stale peer must not resurrect cleaned table");

 // Two teachers can receive different ticks of the SAME reaction. Its
 // molecule ledger, temperature and progress must never be stitched from
 // incompatible snapshots, even if one peer also moves the vessel.
 const originalInventory={speciesMol:{Na2CO3:.001,HCl:.002},
  solidMol:{},retainedGasMol:{},releasedGasMol:{}};
 const base={...previous,simulationAtMs:1000,vessels:previous.vessels.map(v=>
  v.id!=="v1"?v:{...v,observed:true,environment:"aqueous",
   reagents:["Na2CO3","HCl"],doses:{Na2CO3:dose(),HCl:dose(20)},
   chemicalInventory:originalInventory,pendingInventoryReaction:true})};
 const initial=base.vessels[0];
 const ticking=(seconds,temperatureC)=>({
  ...initial,reagents:["Na2CO3","HCl","CO2"],
  chemicalInventory:{
   speciesMol:{Na2CO3:.001*(1-seconds/24),
    HCl:.002*(1-seconds/24),NaCl:.002*seconds/24},
   solidMol:{},retainedGasMol:{},
   releasedGasMol:{CO2:.001*seconds/24}
  },
  inventoryGasReaction:{equation:"Na2CO3 + 2HCl → 2NaCl + H2O + CO2↑",
   initial:originalInventory,elapsedSeconds:seconds,durationSeconds:24},
  temperatureC
 });
 const localTick={...base,simulationAtMs:2000,vessels:base.vessels.map(v=>
  v.id==="v1"?{...ticking(1,23),x:44}:v)};
 const remoteTick={...base,simulationAtMs:4000,vessels:base.vessels.map(v=>
  v.id==="v1"?ticking(3,25):v)};
 const joined=lab.mergeLabBench(base,localTick,remoteTick).vessels[0];
 assert.equal(joined.x,44,"Independent vessel position must still merge");
 assert.equal(joined.inventoryGasReaction.elapsedSeconds,3,
  "Newer tick's kinetic state must survive");
 approx(joined.chemicalInventory.releasedGasMol.CO2,.000125,1e-12,
  "Gas moles must come from the SAME newer tick");
 assert.equal(joined.temperatureC,25,
  "Temperature must not come from a stale kinetic step");
 const reverse=lab.mergeLabBench(base,remoteTick,localTick).vessels[0];
 assert.equal(reverse.inventoryGasReaction.elapsedSeconds,3);
 approx(reverse.chemicalInventory.releasedGasMol.CO2,.000125,1e-12,
  "Reversing peer order cannot roll back chemistry");
 assert.equal(reverse.x,44);

 // Explicit addition of fresh acid must win over a concurrent, older-state
 // solver tick, never silently lose the learner's measured new reagent.
 const newInput={...base,vessels:base.vessels.map(v=>v.id!=="v1"?v:{
  ...v,doses:{...initial.doses,HCl:dose(25)},
  chemicalInventory:{...originalInventory,
   speciesMol:{...originalInventory.speciesMol,HCl:.0025}}})};
 const inputWins=lab.mergeLabBench(base,newInput,remoteTick).vessels[0];
 assert.equal(inputWins.doses.HCl.value,25);
 assert.equal(inputWins.chemicalInventory.speciesMol.HCl,.0025);
 assert.equal(inputWins.inventoryGasReaction,undefined);
 const inputWinsAsPeer=lab.mergeLabBench(base,remoteTick,newInput).vessels[0];
 assert.equal(inputWinsAsPeer.doses.HCl.value,25);
 assert.equal(inputWinsAsPeer.chemicalInventory.speciesMol.HCl,.0025);
});

check("LAB-11","Сохранение опыта не повреждает другие объекты доски",()=>{
 const b=makePrecipitate();
 const document={version:1,title:"Acceptance",view:{x:0,y:0,zoom:1},
  items:[
   {id:"chemical-lab",kind:"graph",x:20,y:30,width:1660,height:1060,
    graphFigureId:"chem-experiment-free",text:"",scienceLabBench:b},
   {id:"lesson-text",kind:"text",x:30,y:40,width:180,height:70,
    text:"Работа ученика"}
  ]};
 const parsed=boardModel.parseDocument(JSON.stringify(document));
 assert.equal(parsed.items.length,2);
 assert.equal(parsed.items[1].text,"Работа ученика");
 assert.deepEqual(parsed.items[0].scienceLabBench.vessels,
  JSON.parse(JSON.stringify(b.vessels)),
  "JSON roundtrip preserves all serializable material, progress and doses");
});

const passed=results.filter(r=>r.ok).length;
const markdown=[
 "### Chemistry lab acceptance gate",
 "",
 "| ID | Mandatory school scenario | Result |",
 "| --- | --- | --- |",
 ...results.map(r=>"| "+r.id+" | "+r.name+" | "+(r.ok?"PASS":"FAIL")+" |"),
 "",
 "**Result: "+passed+"/"+results.length+" passed.**",
 "",
 "This is automated model acceptance, not hands-on mobile usability or live multi-device sign-off.",
 ""
].join("\n");
if(process.env.GITHUB_STEP_SUMMARY)
 fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY,markdown);
console.log("Laboratory release gate: "+passed+"/"+results.length+" passed");
if(passed!==results.length)process.exitCode=1;
