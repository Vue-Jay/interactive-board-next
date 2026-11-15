import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
const cache=new Map();
function load(file){const p=path.resolve(file);if(cache.has(p))return cache.get(p).exports;const m={exports:{}};cache.set(p,m);const js=ts.transpileModule(fs.readFileSync(p,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2023}}).outputText;new Function('require','module','exports',js)(id=>load(path.resolve(path.dirname(p),id+'.ts')),m,m.exports);return m.exports;}
const db=load('src/lektrusReactionDatabase.ts'), st=load('src/lektrusLabStoichiometry.ts'), cat=load('src/lektrusLabCatalog.ts'), net=load('src/lektrusLabReactionNetwork.ts'), lab=load('src/lektrusChemistryBenchModel.ts'), kits=load('src/lektrusLabExperimentKits.ts'), ph=load('src/lektrusLabPH.ts');
const counts={},issues={};
const bump=k=>counts[k]=(counts[k]||0)+1;
const fail=(k,id,detail)=>{const a=issues[k]??={count:0,examples:[]};a.count++;if(a.examples.length<15)a.examples.push({id,detail});};
const close=(a,b,t=1e-8)=>Number.isFinite(a)&&Number.isFinite(b)&&Math.abs(a-b)<Math.max(t,Math.abs(b)*1e-7);
const measured=(formula,d)=>d.unit==='ml'&&d.concentrationM!==undefined?d.value*d.concentrationM/1000:d.unit==='g'?d.value/st.labMolarMass(formula):st.labDoseMoles(formula,d);
function checkInventory(id,v,expected){
 const q=lab.labVesselQuantity(v), inv=net.simulateLabInventory({...v,volumeMl:q.volumeMl}), c=lab.labVesselContents(v);
 const mass=net.labInventoryMassG(inv);
 if(!close(mass,expected,1e-6))fail('inventory mass',id,{mass,expected});
 if(inv.unmeasured.length||inv.limited)fail('unmeasured or limited',id,{unmeasured:inv.unmeasured,limited:inv.limited});
 for(const [f,m] of Object.entries(inv.solidMol))if(m<0||m>(inv.speciesMol[f]??0)+1e-9)fail('invalid solid partition',id,{f,m,species:inv.speciesMol[f]});
 if(!Number.isFinite(q.volumeMl)||q.volumeMl<0||q.occupiedMl>q.capacityMl+1e-7)fail('vessel quantity',id,q);
 for(const s of c.solid)if(!Number.isFinite(s.massG)||s.massG<0)fail('invalid visible solid',id,s);
 for(const s of c.solution)if(!Number.isFinite(s.mmol)||s.mmol<0)fail('invalid visible solute',id,s);
 return {inv,c,q};
}
function run(bench){bench=lab.setLabBenchSettings(bench,{realism:'high',evaporationEnabled:false});bench=lab.setLabSimulationPaused(bench,false,1000);for(const t of [6000,16000,26000,36000,46000,56000])bench=lab.advanceLabSimulation(bench,t);return lab.recordLabReactions(bench);}
for(const s of db.substances)for(const unit of cat.labReagentForms(s))for(const v of [.25,1,3]){
 const stock=cat.labDefaultStockDose(s.id,unit),d={...stock,value:unit==='g'?v:10*v,...(stock.concentrationM!==undefined?{concentrationM:[.01,.2,1][[.25,1,3].indexOf(v)]}:{})};
 const id=`${s.id}/${unit}/${v}`;bump('single dose');const n=measured(s.id,d);
 if(!close(st.labDoseMoles(s.id,d),n)||!(n>0)){fail('dose calculation',id,{n,d});continue;}
 let b=lab.defaultLabBench();b=lab.putLabReagent(b,'v1',s.id,d);const vessel=b.vessels[0];
 if(!vessel.doses?.[s.id]){fail('cabinet rejected',id,d);continue;}
 checkInventory(id,vessel,n*st.labMolarMass(s.id));
}
const involved=new Set();
for(const row of db.reviewedReactionCases.filter(x=>x.status==='reaction')){
 const eq=st.parseBalancedLabEquation(row.equation);row.reactants.forEach(x=>involved.add(x));
 for(let k=0;k<5;k++){
  bump('reaction dose variants');const d=Object.fromEntries(row.reactants.map((f,i)=>{const base=kits.labExperimentDose(row,f);return [f,{...base,value:base.unit==='g'?[.1,.5,1.5,2,.25][(k+i)%5]:[2,5,10,20,30][(k+i)%5],...(base.concentrationM!==undefined?{concentrationM:[.01,.1,.3,1,2][(k+i*2)%5]}:{})}]}));
  const id=`${row.equation} / ${k}`,n=Object.fromEntries(row.reactants.map(f=>[f,measured(f,d[f])]));
  const extent=Math.min(...eq.reactants.map(t=>n[t.formula]/t.coefficient));
  const ss=st.startQuantifiedLabReaction(row,row.reactants,d);
  if(!ss||!close(ss.maxExtentMol,extent)){fail('extent',id,{actual:ss?.maxExtentMol,extent});continue;}
  const final=st.advanceQuantifiedLabReaction(ss,5);
  for(const t of eq.products)if(!close(final.productsMol[t.formula],extent*t.coefficient))fail('product arithmetic',id,t);
  for(const t of eq.reactants)if(!close(final.remainingMol[t.formula],n[t.formula]-extent*t.coefficient))fail('remainder arithmetic',id,t);
  const b0=lab.defaultLabBench();const b=run({...b0,vessels:[{...b0.vessels[0],reagents:row.reactants,doses:d,observed:true,temperatureC:Math.max(22,row.minTemperatureC??22),environment:row.environment}]});
  const vessel=b.vessels[0];const m=Object.entries(n).reduce((a,[f,x])=>a+x*st.labMolarMass(f),0);
  const {inv,c}=checkInventory(id,vessel,m);
  if(!vessel.reactionAmounts?.complete&&!vessel.completedReaction)fail('not completed',id,{observation:lab.labObservation(vessel).message});
  if(row.observation==='precipitate'&&!c.solid.length&&inv.steps.some(x=>x.equation===row.equation))fail('precipitate missing',id,{species:inv.speciesMol,solid:inv.solidMol});
  if(!b.reactionLog?.includes(row.equation))fail('equation absent',id,{log:b.reactionLog});
 }
}
for(const s of db.substances)for(let k=0;k<2;k++){
 const id=`multi ${s.id}/${k}`;bump('catalog 3-4 component mixtures');const stock=cat.labDefaultStockDose(s.id);let b=lab.defaultLabBench();let mass=0;
 const list=[[s.id,{...stock,value:stock.unit==='g'?.3:10,...(stock.concentrationM!==undefined?{concentrationM:k?.3:.05}:{})}],...((k?[['H2O',{value:30,unit:'ml'}],['NaCl',{value:7,unit:'ml',concentrationM:.2}],['KNO3',{value:11,unit:'ml',concentrationM:.1}]]:[['H2O',{value:15,unit:'ml'}],['NaOH',{value:8,unit:'ml',concentrationM:.1}],['NaCl',{value:7,unit:'ml',concentrationM:.1}]]).filter(([f])=>f!==s.id))];
 for(const [f,d] of list){const old=b;b=lab.putLabReagent(b,'v1',f,d);if(b===old){fail('multi addition rejected',id,{f,d});break;}mass+=measured(f,d)*st.labMolarMass(f);b=run(b);b=lab.setLabSimulationPaused(b,true,57000);}
 checkInventory(id,b.vessels[0],mass);
}
for(const [av,ac,bv,bc,w] of [[20,.2,10,.1,30],[10,.1,20,.2,30],[10,.1,10,.1,30],[15,.01,10,.01,50],[5,.4,5,.1,40]]){
 let b=lab.defaultLabBench();const doses=[['HCl',{value:av,unit:'ml',concentrationM:ac}],['NaOH',{value:bv,unit:'ml',concentrationM:bc}],['H2O',{value:w,unit:'ml'}]];
 for(const [f,d] of doses)b=lab.putLabReagent(b,'v1',f,d);
 b=run(b);const v=b.vessels[0],p=ph.labVesselPH(v),excess=(av*ac-bv*bc)/(av+bv+w),target=excess>0?-Math.log10(excess):excess<0?14+Math.log10(-excess):7;
 bump('independent pH');if(!p||Math.abs(p.pH-target)>.12)fail('strong acid/base pH',JSON.stringify(doses),{actual:p?.pH,target,temperature:v.temperatureC});
 const maxHeat=57.3*Math.min(av*ac,bv*bc)/(4.18*(av+bv+w));if(v.reactionHeat?.deltaC>maxHeat+0.2)fail('neutralization heat',JSON.stringify(doses),{actual:v.reactionHeat.deltaC,maxHeat});
}
const result={counts,involved:involved.size,catalog:db.substances.length,notInRegisteredReactions:db.substances.filter(s=>!involved.has(s.id)).map(s=>s.id),issues};console.log(JSON.stringify(result,null,2));
if(Object.keys(issues).length) process.exitCode=1;
