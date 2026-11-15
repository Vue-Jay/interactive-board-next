import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
const cache=new Map();
function load(file){
 const p=path.resolve(file);if(cache.has(p))return cache.get(p).exports;
 const m={exports:{}};cache.set(p,m);
 const js=ts.transpileModule(fs.readFileSync(p,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2023}}).outputText;
 new Function('require','module','exports',js)(id=>load(path.resolve(path.dirname(p),id+'.ts')),m,m.exports);return m.exports;
}
const lab=load('src/lektrusChemistryBenchModel.ts'),net=load('src/lektrusLabReactionNetwork.ts');
const db=load('src/lektrusReactionDatabase.ts'),st=load('src/lektrusLabStoichiometry.ts');
const gas=load('src/lektrusLabGasDynamics.ts'),appearance=load('src/lektrusLabAppearance.ts');
const near=(a,b,tol=1e-7)=>assert.ok(Number.isFinite(a)&&Math.abs(a-b)<tol,`${a} != ${b}`);
const dry={reagents:['NaHCO3','NaCl'],doses:{NaHCO3:{unit:'g',value:.3},NaCl:{unit:'g',value:.2}},environment:'dry',temperatureC:22};
const originalMass=.5;
const lower=net.simulateLabInventory({...dry,environment:'heated',temperatureC:84});
assert.equal(lower.steps.length,0,'Below activation temperature no thermal reaction');
assert.ok(net.simulateLabInventory({...dry,environment:'heated',temperatureC:85}).steps.length,'Database threshold and solver must agree');
const target=net.simulateLabInventory({...dry,environment:'heated',temperatureC:120});
assert.ok(target.releasedGasMol.CO2>0);near(net.labInventoryMassG(target),originalMass);
const base=lab.setLabBenchSettings(lab.defaultLabBench(),{realism:'high',evaporationEnabled:false});
const plate={id:'plate-1',kind:'hotplate',x:50,y:70,active:true,linkedVesselId:'v1',powered:true,temperatureC:150,targetTemperatureC:150,heatLevel:2};
let bench={...base,simulationPaused:false,simulationAtMs:1000,vessels:[{...base.vessels[0],...dry,kind:'crucible',temperatureC:120,observed:true}],placedDevices:[plate]};
bench=lab.advanceLabSimulation(bench,2000);
bench=lab.advanceLabSimulation(bench,3000);
assert.ok(bench.vessels[0].inventoryGasReaction,'Gas reaction is in progress');
const partiallyReacted=bench.vessels[0].chemicalInventory;
assert.ok(partiallyReacted.releasedGasMol.CO2>0);
const cooled={...bench,vessels:[{...bench.vessels[0],temperatureC:22}],placedDevices:[]};
assert.equal(lab.labReactionNeedsTick(cooled.vessels[0]),false,'Cold paused thermal chemistry does not request endless ticks');
assert.equal(lab.labFollowUpGasProgress(cooled.vessels[0]).rateMolPerSecond,0,'Cooling stops visible gas flow');
const coldTick=lab.advanceLabSimulation(cooled,4000);
assert.deepEqual(coldTick.vessels[0].chemicalInventory,partiallyReacted,'Cooling cannot reverse a measured gas yield');
bench={...coldTick,vessels:[{...coldTick.vessels[0],temperatureC:120}],placedDevices:[plate]};
for(let t=5000;t<=121000;t+=1000)bench=lab.advanceLabSimulation(bench,t);
const v=bench.vessels[0],contents=lab.labVesselContents(v);
assert.ok(bench.reactionLog?.some(eq=>eq.includes('NaHCO3')&&eq.includes('CO2')),'Heated mixture with spectator must finish and record its reaction');
assert.ok(contents.solid.some(x=>x.formula==='Na2CO3'),'Carbonate residue');
assert.ok(contents.solid.some(x=>x.formula==='NaCl'),'Unchanged spectator');
const final=net.simulateLabInventory({...v,volumeMl:lab.labVesselQuantity(v).volumeMl});
near(net.labInventoryMassG(final),originalMass);near(final.releasedGasMol.CO2,target.releasedGasMol.CO2);
console.log('Thermal decomposition with an inert spectator, gas and conserved residue: OK');

// A gas held in a dry flask is not solvent, even for catalog entries that
// were missing from the old hard-coded list of seven gases.
for(const stock of db.substances.filter(x=>x.kind==='газ')){
 const inventory=net.simulateLabInventory({reagents:['NaCl',stock.id],doses:{NaCl:{unit:'g',value:.1},[stock.id]:{unit:'ml',value:5}},environment:'aqueous',temperatureC:22},0);
 assert.ok(inventory.solidMol.NaCl>0,`${stock.id} must not dissolve dry salt`);
}
const kits=load('src/lektrusLabExperimentKits.ts');
let checked=0;
for(const row of db.reviewedReactionCases.filter(r=>r.status==='reaction'&&['heated','ignited'].includes(r.environment))){
 const products=st.labGasProductFormulas(row.equation);if(!products.size)continue;
 const doses=Object.fromEntries(row.reactants.map(id=>[id,kits.labExperimentDose(row,id)]));
 const amount=st.startQuantifiedLabReaction(row,row.reactants,doses);if(!amount)continue;
 const progress=st.advanceQuantifiedLabReaction(amount,amount.durationSeconds/2);
 const input={reagents:row.reactants,doses,environment:row.environment,temperatureC:row.minTemperatureC??150,reactionAmounts:progress};
 const inventory=net.simulateLabInventory(input),gases=gas.labReactionGasProgress(progress);
 for(const id of products){
  assert.ok((inventory.releasedGasMol[id]??0)>0,`${row.equation}: ${id} must be gas, not solid`);
  assert.equal(inventory.solidMol[id]??0,0);
  near(inventory.releasedGasMol[id],gases.producedMol[id]);
 }
 near(net.labInventoryMassG(inventory),Object.entries(doses).reduce((s,[id,dose])=>s+st.labDoseMoles(id,dose)*st.labMolarMass(id),0),1e-6);
 checked++;
}
assert.ok(checked>=20,`Thermal gas coverage: ${checked}`);
assert.equal(appearance.labGasTint({CO2:1,O2:1}),undefined);
assert.equal(appearance.labGasTint({NO2:.001,O2:.001}),'#b56c42');
assert.equal(appearance.labGasTint({Cl2:.001}),'#c5cc70');
console.log(`Thermal gas phase and intermediate mass balance: ${checked} reviewed rows; gas tint OK`);

// The actual collector is tested with every gas-producing reviewed row, at
// three doses. The gas volume is derived from the measured reaction extent,
// not from an independently hard-coded expected amount.
const pipeline=[];let pipelineCases=0;
for(const row of db.reviewedReactionCases.filter(r=>r.status==='reaction'&&st.labGasProductFormulas(r.equation).size)){
 for(const factor of [.25,1,2]){
  const doses=Object.fromEntries(row.reactants.map(id=>{const d=kits.labExperimentDose(row,id);return [id,{...d,value:d.value*factor}]}));
  let b={...lab.defaultLabBench(),settings:{...lab.labBenchSettings(lab.defaultLabBench()),evaporationEnabled:false},vessels:[{...lab.defaultLabBench().vessels[0],
   reagents:row.reactants,doses,observed:true,environment:row.environment,temperatureC:Math.max(22,row.minTemperatureC??22)}]};
  b=lab.attachLabGasCollector(b,'v1');
  b=lab.setLabSimulationPaused(b,false,1000);
  for(let t=2000;t<=37000;t+=1000)b=lab.advanceLabSimulation(b,t);
  const [source,receiver]=b.vessels;
  const output=lab.labFollowUpGasProgress(source)??gas.labReactionGasProgress(source.reactionAmounts);
  if(!output||output.rateMolPerSecond>1e-12){pipeline.push({equation:row.equation,factor,reason:'no completed gas output'});continue;}
  const expected=Math.min(lab.labVesselQuantity(receiver).capacityMl,output.totalMol*24465);
  const actual=lab.labGasStoredMl(receiver);
  if(Math.abs(actual-expected)>.035)pipeline.push({equation:row.equation,factor,expected,actual,products:output.producedMol});
  else if(actual>.1){
   const before=actual;b=lab.addLabVessel(b,'flask');
   b=lab.transferLabGasSample(b,'v2','v3',Math.min(5,actual));
   const remaining=lab.labGasStoredMl(b.vessels[1]),moved=lab.labGasStoredMl(b.vessels[2]);
   if(Math.abs(remaining+moved-before)>.011||moved<=0)pipeline.push({equation:row.equation,factor,reason:'sample transfer failed',before,remaining,moved});
  }
  pipelineCases++;
 }
}
console.log(`Gas collector pipeline: ${pipelineCases} measured cases, ${pipeline.length} failures`);
assert.deepEqual(pipeline,[]);
