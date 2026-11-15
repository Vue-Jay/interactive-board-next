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
const db=load('src/lektrusReactionDatabase.ts'), st=load('src/lektrusLabStoichiometry.ts');
const cat=load('src/lektrusLabCatalog.ts'), net=load('src/lektrusLabReactionNetwork.ts');
const lab=load('src/lektrusChemistryBenchModel.ts'),ph=load('src/lektrusLabPH.ts');
const ids=db.substances.map(s=>s.id), stats={pairs:0,mixtures:0,accepted:0,rejected:0,reacted:0,solid:0,gas:0,unchanged:0,logged:0};
const findings={},missing=[],positive=[],unpredicted=[];
function fail(kind,detail){const entry=findings[kind]??={count:0,samples:[]};entry.count++;if(entry.samples.length<15)entry.samples.push(detail);}
function dose(id,scale){const d=cat.labDefaultStockDose(id);return {...d,value:d.unit==='g'?.05:5,...(d.concentrationM===undefined?{}:{concentrationM:d.concentrationM*scale})};}
function mass(doses){return Object.entries(doses).reduce((n,[id,d])=>n+st.labDoseMoles(id,d)*st.labMolarMass(id),0);}
function check(a,b,scale){
 const key=[a,b],doses={[a]:dose(a,scale),[b]:dose(b,scale)};
 let bench=lab.setLabBenchSettings(lab.defaultLabBench(),{realism:'high',evaporationEnabled:false});
 for(const id of key){const next=lab.putLabReagent(bench,'v1',id,doses[id]);if(next===bench){stats.rejected++;return;}bench=next;}stats.accepted++;
 const starting=bench.vessels[0], q0=lab.labVesselQuantity(starting);
 const forecast=net.simulateLabInventory({reagents:key,doses,environment:starting.environment,temperatureC:starting.temperatureC,volumeMl:q0.volumeMl});
 bench=lab.setLabSimulationPaused(bench,false,1000);
 for(let t=11000;t<=61000&&lab.labSimulationTickWaitMs(bench,t)!==null;t+=10000)bench=lab.advanceLabSimulation(bench,t);
 bench=lab.recordLabReactions(bench);const v=bench.vessels[0],q=lab.labVesselQuantity(v),c=lab.labVesselContents(v),p=ph.labVesselPH(v),obs=lab.labObservation(v);
 const inv=net.simulateLabInventory({...v,volumeMl:q.volumeMl}),expect=mass(doses);
 const vented=Object.entries(v.ventedVaporMl??{}).reduce((n,[id,ml])=>n+(st.labDoseMoles(id,{value:ml,unit:'ml'})??0)*(st.labMolarMass(id)??0),0);
 const actual=net.labInventoryMassG(inv)+vented;
 if(!Number.isFinite(actual)||Math.abs(actual-expect)>Math.max(1e-6,expect*1e-7))fail('mass',{key,scale,actual,expect});
 if(!Number.isFinite(q.occupiedMl)||q.occupiedMl>q.capacityMl+1e-7||q.volumeMl<0)fail('capacity',{key,scale,q});
 if(p&&(!Number.isFinite(p.pH)||p.pH<0||p.pH>14))fail('ph',{key,scale,p});
 if(c.solid.some(s=>!Number.isFinite(s.massG)||s.massG<0)||c.solution.some(s=>!Number.isFinite(s.mmol)||s.mmol<0))fail('display',{key,scale,c});
 if(Object.values(inv.speciesMol).some(n=>!Number.isFinite(n)||n<0)||Object.entries(inv.solidMol).some(([id,n])=>n<0||n>(inv.speciesMol[id]??0)+1e-9))fail('phase',{key,scale});
 if(forecast.steps.length){stats.reacted++;if(positive.length<5000)positive.push({key,scale,equations:forecast.steps.map(s=>s.equation),log:bench.reactionLog,observation:obs.status,solid:c.solid.map(s=>s.formula??s.id)});if(!bench.reactionLog?.length&&missing.length<1000)missing.push({key,scale,steps:forecast.steps.map(s=>s.equation),observation:obs.message,pending:lab.labReactionNeedsTick(v)});}
 else {stats.unchanged++;if(bench.reactionLog?.length&&unpredicted.length<1000)unpredicted.push({key,scale,log:bench.reactionLog,observation:obs.message});}
 if(c.solid.length)stats.solid++;if(Object.keys(inv.releasedGasMol).length||Object.keys(inv.retainedGasMol).length)stats.gas++;
 stats.logged+=(bench.reactionLog??[]).length;
}
for(let i=0;i<ids.length;i++)for(let j=i+1;j<ids.length;j++){
 stats.pairs++;
 if(stats.pairs%2000===0)console.error('Pair matrix:',stats.pairs,'/',ids.length*(ids.length-1)/2);
 // Opposite order and a separate dilute level, same measured dose per stock.
 for(const [a,b,scale] of [[ids[i],ids[j],1],[ids[j],ids[i],.1]]){
  stats.mixtures++;try{check(a,b,scale);}catch(e){fail('throw',{a,b,scale,error:String(e)});}
 }
}
console.log(JSON.stringify({stats,findings,missing,unpredicted,...(process.argv.includes('--details')?{positive}:{})},null,2));
if(Object.keys(findings).length||missing.length||unpredicted.length||stats.rejected)process.exitCode=1;
