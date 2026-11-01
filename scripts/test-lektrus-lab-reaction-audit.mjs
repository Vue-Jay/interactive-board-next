/** Exhaustive regression for every registered school chemistry case.
 * Checks catalog -> measured ready kit -> scheduler -> completed products.
 * Not a claim of experimental validation outside reviewed school models.
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
  module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2023
 }}).outputText;
 new Function("require","module","exports",js)(id=>{
  assert.ok(id.startsWith("."),"Unexpected module "+id);
  return load(path.resolve(path.dirname(resolved),id+".ts"));
 },mod,mod.exports);
 return mod.exports;
}
const database=load("src/lektrusReactionDatabase.ts");
const stoich=load("src/lektrusLabStoichiometry.ts");
const lab=load("src/lektrusChemistryBenchModel.ts");
const kits=load("src/lektrusLabExperimentKits.ts");
const substances=new Set(database.substances.map(s=>s.id));
const failures=[],statistics={cases:0,reactions:0,nonReactions:0,aqueous:0,heated:0,dry:0,ignited:0,
 kits:0,scheduled:0,completed:0,mixed:0,mixedCompleted:0,precipitates:0,gases:0,products:0};
const reportFailure=(row,stage,error)=>{
 const message=String(error?.message??error);
 failures.push({equation:row.equation||row.reactants.join(" + "),
  medium:row.environment,stage,message});
};
const verify=(row,stage,fn)=>{
 try{fn();return true}catch(error){reportFailure(row,stage,error);return false}
};
const signature=row=>row.environment+"|"+row.reactants.slice().sort().join("|");
const signatures=new Map();
const reactions=database.reviewedReactionCases.filter(r=>r.status==="reaction");
assert.ok(reactions.length>=300,"School reactions unexpectedly missing");
for(const row of database.reviewedReactionCases){
 statistics.cases++;
 statistics[row.environment]++;
 verify(row,"catalog",()=>{
  const key=signature(row);
  assert.ok(!signatures.has(key),"Duplicate / shadowed case: "+key);
  signatures.set(key,row);
  assert.ok(row.reactants.length>=1&&row.reactants.length<=3,"Ready kit supports at most 3 reactants");
  assert.equal(new Set(row.reactants).size,row.reactants.length,"Repeated reactant");
  for(const id of row.reactants)assert.ok(substances.has(id),"Missing reagent "+id);
  assert.equal(database.identifyReaction([...row.reactants].reverse(),row.environment).caseData,row,
   "Case cannot be selected by its reagents");
  if(row.status==="none"){
   statistics.nonReactions++;
   assert.equal(row.equation,"");
  }else{
   statistics.reactions++;
   const parsed=stoich.parseBalancedLabEquation(row.equation);
   assert.ok(parsed,"Equation is not atom-balanced or not parseable");
   assert.deepEqual(parsed.reactants.map(t=>t.formula).slice().sort(),
    row.reactants.filter(id=>parsed.reactants.some(t=>t.formula===id)).slice().sort(),
    "Undeclared reagents in balanced equation");
   const marker=(row.equation.split("→")[1]??"");
   if(row.observation==="precipitate")assert.ok(marker.includes("↓"),"No marked solid");
   if(row.observation==="gas")assert.ok(marker.includes("↑"),"No marked gas");
   for(const product of parsed.products){
    assert.ok(substances.has(product.formula),"Product missing from catalog: "+product.formula);
    statistics.products++;
   }
  }
 });
 if(row.status!=="reaction")continue;
 let doses;
 if(!verify(row,"stock-and-kit",()=>{
  doses=Object.fromEntries(row.reactants.map(id=>[id,kits.labExperimentDose(row,id)]));
  for(const id of row.reactants){
   assert.ok(doses[id]&&doses[id].value>0,"Missing measured stock: "+id);
   assert.ok(stoich.labDoseMoles(id,doses[id])>0,"Non-quantifiable stock: "+id);
  }
  const state=stoich.startQuantifiedLabReaction(row,row.reactants,doses);
  assert.ok(state?.maxExtentMol>0,"No quantified reaction extent");
  const prepared=kits.prepareLabExperimentKit(lab.defaultLabBench(),row);
  assert.equal(prepared.simulationPaused,true,"Prepared experiment must start paused");
  assert.deepEqual(prepared.vessels.flatMap(v=>v.reagents),row.reactants);
  assert.ok(prepared.vessels.every(v=>v.doses?.[v.reagents[0]]?.value>0));
  assert.ok((prepared.placedDevices??[]).every(d=>!d.powered),
   "The kit must not switch heaters on automatically");
  statistics.kits++;
 }))continue;
 // The real cabinet path can differ from a mathematically valid ready
 // mixture. Verify actual dosing while paused for every 1-2 reagent
 // aqueous case that includes a liquid stock.
 if(row.environment==="aqueous"&&row.reactants.length<=2&&
  row.reactants.some(id=>doses[id].unit==="ml")){
  verify(row,"cabinet-mixing",()=>{
   let mixed=lab.defaultLabBench();
   for(const id of row.reactants){
    const updated=lab.putLabReagent(mixed,"v1",id,doses[id]);
    assert.notStrictEqual(updated,mixed,"Cabinet dose was rejected: "+id);
    mixed=updated;
   }
   assert.ok(row.reactants.every(id=>mixed.vessels[0].doses?.[id]?.value>0),
    "A reactant disappeared while filling the vessel");
   assert.equal(mixed.vessels[0].environment,"aqueous",
    "Stock mixing selected the wrong reaction environment");
   assert.equal(mixed.simulationPaused,true);
   assert.equal(lab.labReactionNeedsTick(mixed.vessels[0]),true,
    "The actual mixed vessel is not scheduled for reaction");
   statistics.mixed++;
   mixed=lab.setLabSimulationPaused(mixed,false,1000);
   for(const t of [6000,16000,26000,36000])
    mixed=lab.advanceLabSimulation(mixed,t);
   assert.ok(mixed.vessels[0].reactionAmounts?.complete||
    mixed.vessels[0].completedReaction,
    "The actual cabinet mixture did not complete the reaction");
   assert.ok((lab.recordLabReactions(mixed).reactionLog??[]).includes(row.equation),
    "The actual reaction was not entered in the equation board");
   statistics.mixedCompleted++;
  });
 }
 // A ready mixture with all measured reagents is the unit underneath
 // both cabinet addition and vessel-to-vessel pouring. Check all four modes:
 // heated/ignited scenarios are placed in their explicitly selected conditions.
 let bench={...lab.defaultLabBench(),vessels:[{
  ...lab.defaultLabBench().vessels[0],
  reagents:[...row.reactants],doses,observed:true,
  environment:row.environment,
  temperatureC:Math.max(22,row.minTemperatureC??22)
 }]};
 if(!verify(row,"scheduler",()=>{
  assert.equal(lab.labReactionNeedsTick(bench.vessels[0]),true,
   "Verified mixture cannot start a simulation tick");
  assert.strictEqual(lab.recordLabReactions(bench),bench,
   "On pause the chalkboard must stay unchanged");
  assert.strictEqual(lab.advanceLabSimulation(bench,1000),bench,
   "On pause measured chemistry must not advance");
  statistics.scheduled++;
 }))continue;
 verify(row,"progress-and-products",()=>{
  bench=lab.setLabSimulationPaused(bench,false,1000);
  for(const t of [6000,16000,26000,36000]){
   bench=lab.advanceLabSimulation(bench,t);
  }
  const vessel=bench.vessels[0];
  assert.ok(vessel.reactionAmounts?.complete||vessel.completedReaction,
   "Reaction did not finish within 35 seconds of simulated time");
  const state=vessel.reactionAmounts;
  if(state){
   const eq=stoich.parseBalancedLabEquation(row.equation);
   for(const term of eq.products){
    assert.ok((state.productsMol[term.formula]??0)>0,
     "Missing product amount: "+term.formula);
   }
  }
  if(row.observation==="precipitate"){
   const contents=lab.labVesselContents(vessel);
   assert.ok(contents.solid.some(s=>s.massG>0),
    "Solid product is absent from the vessel's physical inventory");
   statistics.precipitates++;
  }
  if(row.observation==="gas"){
   const eq=stoich.parseBalancedLabEquation(row.equation);
   const marked=(row.equation.split("→")[1]??"").split(/\s+\+\s+/)
    .filter(x=>x.includes("↑")).map(x=>x.replace(/^\d+\s*/,"").replace(/[↑↓]/g,"").trim());
   assert.ok(eq.products.some(t=>marked.includes(t.formula)),
    "Gas observation has no tracked gas product");
   statistics.gases++;
  }
  const recorded=lab.recordLabReactions(bench);
  assert.ok((recorded.reactionLog??[]).includes(row.equation),
   "Completed reaction is not written on the chalkboard");
  statistics.completed++;
 });
}
const result={statistics,failures,passed:statistics.reactions-failures.length,
 total:database.reviewedReactionCases.length};
fs.writeFileSync("reaction-audit-report.json",JSON.stringify(result,null,2)+"\n");
const header="### Exhaustive Lektrus chemistry catalog reaction audit\n\n"+
 "Checked "+statistics.cases+" registered cases ("+statistics.reactions+
 " reactions, "+statistics.nonReactions+" no-reaction cases). "+
 statistics.kits+" prepared kits, "+statistics.scheduled+" scheduled, "+
 statistics.completed+" completed.\n\n";
const details=failures.length?"| Reaction | Stage | Failure |\n| --- | --- | --- |\n"+
 failures.slice(0,80).map(f=>"| "+f.equation+" | "+f.stage+" | "+
 f.message.replace(/[|]/g,"/").replace(/\n/g," ")+" |").join("\n"):
 "All audited checks passed.";
const markdown=header+details+"\n\n";
if(process.env.GITHUB_STEP_SUMMARY)fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY,markdown);
console.log(JSON.stringify(statistics));
console.log("AUDIT failures: "+failures.length);
for(const failure of failures.slice(0,120))
 console.error("AUDIT FAIL "+failure.medium+" "+failure.equation+" ["+failure.stage+"]: "+failure.message);
if(failures.length)process.exitCode=1;
