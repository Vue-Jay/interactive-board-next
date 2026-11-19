#!/usr/bin/env node
/**
 * Fresh stress-test inventory compiler for Lektrus mobile QA.
 * This deliberately does NOT claim to execute a browser or native app.
 * Every generated case must be backed by an executable driver and an oracle
 * before the acceptance gate may be opened.
 */
import fs from 'node:fs';
import path from 'node:path';
const source=JSON.parse(fs.readFileSync(new URL('../qa/mobile-acceptance-v2.json',import.meta.url),'utf8'));
const axes={
  device:['android-api24','android-api27','android-api30','android-api33','android-api36','ios-simulator','mobile-chromium','mobile-webkit','tablet-chromium','tablet-webkit'],
  orientation:['portrait','landscape','rotate-during-operation'],
  network:['online','slow-3g','offline','disconnect-mid-action','reconnect'],
  documentSize:['empty','100-objects','1000-objects','10000-objects'],
  concurrency:['solo','two-users','five-users','twenty-users'],
  session:['fresh','restored','expired','relogin'],
  input:['finger','stylus','multitouch','rapid-repeat'],
  lifecycle:['foreground','background-resume','process-restart'],
};
const pairwise=(axes)=>{
  const keys=Object.keys(axes), all=[];
  // Deterministic IPO-like greedy covering array: cover every pair of axis values.
  const uncovered=new Set();
  for(let i=0;i<keys.length;i++)for(let j=i+1;j<keys.length;j++)
    for(const a of axes[keys[i]])for(const b of axes[keys[j]])
      uncovered.add(JSON.stringify([keys[i],a,keys[j],b]));
  let seed=0;
  while(uncovered.size){
    let best=null,bestHits=-1;
    for(let attempt=0;attempt<250;attempt++){
      const values={};
      for(let k=0;k<keys.length;k++){
        const key=keys[k], options=axes[key];
        values[key]=options[(seed*17+attempt*31+k*13+Math.floor(attempt/(k+1)))%options.length];
      }
      let hits=0;
      for(let i=0;i<keys.length;i++)for(let j=i+1;j<keys.length;j++)
        if(uncovered.has(JSON.stringify([keys[i],values[keys[i]],keys[j],values[keys[j]]])))hits++;
      if(hits>bestHits){bestHits=hits;best=values;}
    }
    if(bestHits===0){
      const [ka,a,kb,b]=JSON.parse(uncovered.values().next().value);
      best=Object.fromEntries(keys.map((k,i)=>[k,axes[k][(seed+i)%axes[k].length]]));
      best[ka]=a;best[kb]=b;
    }
    for(let i=0;i<keys.length;i++)for(let j=i+1;j<keys.length;j++)
      uncovered.delete(JSON.stringify([keys[i],best[keys[i]],keys[j],best[keys[j]]]));
    all.push(best);seed++;
    if(seed>5000)throw new Error('Pairwise generation failed to converge');
  }
  return all;
};
const environments=pairwise(axes);
const stressProfiles=[
  {id:'ink-burst',iterations:5000,oracle:'Every accepted stroke survives reopen; no lost or duplicated IDs'},
  {id:'object-mass',iterations:10000,oracle:'All objects survive export/import with identical geometry'},
  {id:'undo-redo-flood',iterations:2000,oracle:'Exact state matches before/after reversible operations'},
  {id:'simultaneous-edit',iterations:1000,oracle:'All clients converge to same board version and object set'},
  {id:'offline-reconnect',iterations:100,oracle:'Queued edits converge after repeated disconnect/reconnect'},
  {id:'keyboard-rotation',iterations:200,oracle:'Focus, keyboard and landscape bounds remain valid'},
  {id:'export-cancel',iterations:100,oracle:'No file created on cancel; board remains interactive and correctly oriented'},
  {id:'lab-combinations',iterations:10000,oracle:'Mass/charge balances, pH bounds and visual phase are chemically consistent'},
  {id:'atlas-year-sweep',iterations:6000,oracle:'Every year and territory matches a versioned authoritative reference'},
  {id:'role-access-matrix',iterations:1000,oracle:'No unauthorized read/write and every authorized action succeeds'},
  {id:'lifecycle-chaos',iterations:200,oracle:'No data loss or duplicate commits across kill/restart/background'},
  {id:'touch-chaos',iterations:10000,oracle:'No crash, stuck gesture, invisible controls or persistent overlay'},
];
const cases=source.cases.map(c=>({...c,driver:null,oracle:null,implementation:'pending'}));
const result={schema:1,description:'Unexecuted stress-test design. Counts are planned, not passed.',baselineCases:cases.length,environmentCombinations:environments.length,stressProfiles:stressProfiles.length,axes,environmentCases:environments,stressProfiles,cases};
const out=process.argv[2];
if(out){fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,JSON.stringify(result,null,2)+'\n');}
const missing=cases.filter(c=>!c.driver||!c.oracle);
console.log(JSON.stringify({baselineCases:cases.length,environmentCombinations:environments.length,stressProfiles:stressProfiles.length,unimplemented:missing.length},null,2));
if(process.argv.includes('--require-ready')&&missing.length)process.exitCode=1;
