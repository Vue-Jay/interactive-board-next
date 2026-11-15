import fs from 'node:fs';import path from 'node:path';import ts from 'typescript';
const cache=new Map();function load(file){const p=path.resolve(file);if(cache.has(p))return cache.get(p).exports;const m={exports:{}};cache.set(p,m);const js=ts.transpileModule(fs.readFileSync(p,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2023}}).outputText;new Function('require','module','exports',js)(id=>load(path.resolve(path.dirname(p),id+'.ts')),m,m.exports);return m.exports;}
const db=load('src/lektrusReactionDatabase.ts'),st=load('src/lektrusLabStoichiometry.ts'),cat=load('src/lektrusLabCatalog.ts'),net=load('src/lektrusLabReactionNetwork.ts'),lab=load('src/lektrusChemistryBenchModel.ts'),ph=load('src/lektrusLabPH.ts');
let seed=123456789;const random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);const pick=a=>a[Math.floor(random()*a.length)];
const stats={mixtures:0,attempts:0,accepted:0,rejected:0,checked:0,throws:0,massErrors:0,invalidPhase:0,invalidQuantity:0,invalidPH:0,unsupported:0,missingDisplay:0,loggedReactions:0,devices:0,modes:0,invalidInputs:0};const findings={};const error=(k,detail)=>{stats[k]++; const a=findings[k]??=[];if(a.length<12)a.push(detail)};
const close=(a,b)=>Number.isFinite(a)&&Number.isFinite(b)&&Math.abs(a-b)<Math.max(1e-6,Math.abs(b)*1e-7);
const common=['H2O','HCl','NaOH','NaCl','Na2CO3','AgNO3','CaCl2','CuSO4','KNO3','KI','BaCl2','H2SO4','NH4Cl','FeCl3'];
const seen=new Set();
for(const origin of db.substances){stats.mixtures++;let b=lab.setLabBenchSettings(lab.defaultLabBench(),{realism:'high',evaporationEnabled:false}),mass=0,t=1000,trace=[];const count=5+Math.floor(random()*8);
 for(let i=0;i<count;i++)try{
  const f=i===0?origin.id:i%3===0?pick(db.substances).id:pick(common);seen.add(f);const s=db.substances.find(x=>x.id===f),unit=pick(cat.labReagentForms(s)),base=cat.labDefaultStockDose(f,unit);
  const d={...base,value:unit==='g'?pick([.01,.1,.3,1,3]):pick([.5,2,5,9,15,30]),...(base.concentrationM===undefined?{}:{concentrationM:pick([.001,.01,.05,.1,.3,1,2])})};
  stats.attempts++;const before=b;const next=lab.putLabReagent(b,'v1',f,d);trace.push({f,d,accepted:next!==before});if(next===before){stats.rejected++;continue}stats.accepted++;b=next;mass+=st.labDoseMoles(f,d)*st.labMolarMass(f);
  b=lab.setLabSimulationPaused(b,false,t);for(let k=0;k<3;k++){t+=10000;b=lab.advanceLabSimulation(b,t)}b=lab.recordLabReactions(b);b=lab.setLabSimulationPaused(b,true,t);
  const v=b.vessels[0],q=lab.labVesselQuantity(v),inv=net.simulateLabInventory({...v,volumeMl:q.volumeMl}),c=lab.labVesselContents(v),p=ph.labVesselPH(v);stats.checked++;
  // Vapor leaving the vessel is accounted for separately from the molecular ledger.
  const vented=Object.entries(v.ventedVaporMl??{}).reduce((a,[f,ml])=>a+(st.labDoseMoles(f,{value:ml,unit:'ml'})??0)*(st.labMolarMass(f)??0),0);
  const actual=net.labInventoryMassG(inv)+vented;
  if(!close(actual,mass))error('massErrors',{origin:origin.id,i,actual,mass,trace:[...trace],inventory:inv.speciesMol,released:inv.releasedGasMol});
  if(Object.entries(inv.solidMol).some(([f,n])=>!Number.isFinite(n)||n<0||n>(inv.speciesMol[f]??0)+1e-9))error('invalidPhase',{origin:origin.id,i,trace:[...trace],solid:inv.solidMol,species:inv.speciesMol});
  if(!Number.isFinite(q.occupiedMl)||q.occupiedMl>q.capacityMl+1e-7||q.volumeMl<0)error('invalidQuantity',{origin:origin.id,i,q,trace:[...trace]});
  if(p&&(!Number.isFinite(p.pH)||p.pH<0||p.pH>14))error('invalidPH',{origin:origin.id,i,p});
  if(!p&&q.volumeMl>0)stats.unsupported++;
  if(c.solid.some(x=>!Number.isFinite(x.massG)||x.massG<0)||c.solution.some(x=>!Number.isFinite(x.mmol)||x.mmol<0))error('missingDisplay',{origin:origin.id,i,c,trace:[...trace]});
 }catch(e){error('throws',{origin:origin.id,i,message:String(e),trace:[...trace]});break;}
 stats.loggedReactions+=(b.reactionLog??[]).length;
}
// Device operations in every available mode, including repeated power and placement/removal.
for(const mode of lab.LAB_MODES)try{let b=lab.setLabMode(lab.defaultLabBench(),mode.id);b=lab.prepareLabModeSetup(b);stats.modes++;
 for(const device of lab.labDevices){b=lab.addPlacedLabDevice(b,device.id);const placed=b.placedDevices?.at(-1);if(!placed)continue;stats.devices++;b=lab.setPlacedDevicePower(b,placed.id,true);b=lab.setPlacedDeviceLevel(b,placed.id,3);b=lab.setPlacedDevicePower(b,placed.id,false);b=lab.movePlacedLabDevice(b,placed.id,30,70);b=lab.returnPlacedLabDevice(b,placed.id);}
}catch(e){error('throws',{mode:mode.id,message:String(e)})}
for(const d of [{value:-1,unit:'ml'},{value:0,unit:'ml'},{value:Infinity,unit:'ml'},{value:1,unit:'ml',concentrationM:NaN},{value:1,unit:'ml',concentrationM:99},{value:1000,unit:'ml'}]){const b=lab.defaultLabBench();if(lab.putLabReagent(b,'v1','HCl',d)!==b)error('invalidInputs',d);}
console.log(JSON.stringify({stats,distinctReagents:seen.size,findings},null,2));
if(Object.keys(findings).length || seen.size!==db.substances.length || stats.modes!==lab.LAB_MODES.length) process.exitCode=1;
