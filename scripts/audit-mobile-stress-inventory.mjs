#!/usr/bin/env node
/**
 * Independent contract audit for the new stress-test inventory.
 * This is a STATIC audit, not an app execution or a passing acceptance run.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {spawnSync} from 'node:child_process';
import {mkdtempSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
const dir=mkdtempSync(path.join(tmpdir(),'lektrus-stress-inventory-'));
try {
 const output=path.join(dir,'matrix.json');
 const command=spawnSync(process.execPath,['scripts/compile-mobile-stress-inventory.mjs',output],{encoding:'utf8'});
 assert.equal(command.status,0,command.stderr||command.stdout);
 const data=JSON.parse(readFileSync(output,'utf8'));
 assert.equal(data.baselineCases,data.cases.length);
 assert.ok(data.baselineCases>=231);
 assert.equal(new Set(data.cases.map(c=>c.id)).size,data.cases.length,'Duplicate scenario IDs');
 assert.ok(data.environmentCombinations>0);
 assert.equal(data.environmentCases.length,data.environmentCombinations);
 assert.ok(data.stressProfiles.length>=12,'Missing stress profiles');
 for(const profile of data.stressProfiles){
  assert.ok(profile.id&&profile.iterations>0&&profile.oracle,'Missing stress workload/oracle');
 }
 for(const item of data.cases){
  assert.ok(item.id&&item.area&&item.platforms.length&&item.action);
  assert.equal(item.implementation,'pending','No invented implemented cases');
 }
 // Verify the covering-array generator actually covers every pair of values.
 const axes=Object.entries(data.axes);
 const covered=new Set();
 for(const row of data.environmentCases){
  for(let i=0;i<axes.length;i++)for(let j=i+1;j<axes.length;j++)
   covered.add(JSON.stringify([axes[i][0],row[axes[i][0]],axes[j][0],row[axes[j][0]]]));
 }
 let required=0;
 for(let i=0;i<axes.length;i++)for(let j=i+1;j<axes.length;j++)
  for(const a of axes[i][1])for(const b of axes[j][1]){
   required++;
   assert.ok(covered.has(JSON.stringify([axes[i][0],a,axes[j][0],b])),'Missing pair '+axes[i][0]+'='+a+' / '+axes[j][0]+'='+b);
  }
 const blocked=spawnSync(process.execPath,['scripts/compile-mobile-stress-inventory.mjs',output,'--require-ready'],{encoding:'utf8'});
 assert.notEqual(blocked.status,0,'Unimplemented tests must block acceptance');
 console.log(JSON.stringify({audit:'PASS',staticOnly:true,scenarios:data.baselineCases,pairwiseRows:data.environmentCombinations,pairsCovered:required,stressProfiles:data.stressProfiles.length,acceptanceGate:'BLOCKED until executable'},null,2));
}finally{rmSync(dir,{recursive:true,force:true});}
