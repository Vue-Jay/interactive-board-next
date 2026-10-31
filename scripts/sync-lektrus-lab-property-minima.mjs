/** Synchronize all monotone laboratory coverage floors from the REAL
 * source registries, not from a manually estimated percentage.
 *
 * Usage:
 *   node scripts/sync-lektrus-lab-property-minima.mjs          # preview
 *   node scripts/sync-lektrus-lab-property-minima.mjs --write  # update
 *   node scripts/sync-lektrus-lab-property-minima.mjs --check  # CI
 *
 * All scientific/source audits still run; this script ONLY tracks numeric
 * coverage. An existing floor can never silently decrease, and an unknown
 * metric may never be invented in JSON. To include a NEW metric first add
 * it explicitly to the audited minimum floor schema.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {execFileSync} from "node:child_process";

const project=path.resolve(import.meta.dirname,"..");
const minimumFile=path.join(project,"scripts","lektrus-lab-property-minima.json");
const auditFile=path.join(project,"scripts","audit-lektrus-lab-properties.mjs");
const current=JSON.parse(fs.readFileSync(minimumFile,"utf8"));
const report=JSON.parse(execFileSync(process.execPath,
 [auditFile,"--verify","--json"],{
  cwd:project,encoding:"utf8",maxBuffer:12*1024*1024
 }));
const actual=report.rawTotals;
assert.equal(actual.stock,180,"Unexpected catalog count");
const changes=[];
for(const [key,previous] of Object.entries(current.minimum)){
 assert.ok(Number.isInteger(previous)&&previous>=0,
  "Invalid stored minimum: "+key);
 assert.ok(Number.isInteger(actual[key])&&actual[key]>=0,
  "Unrecognized or invalid audited metric "+key);
 assert.ok(actual[key]>=previous,
  "Scientific coverage REGRESSED: "+key+" "+previous+" -> "+actual[key]);
 if(actual[key]!==previous){
  changes.push({metric:key,from:previous,to:actual[key]});
  current.minimum[key]=actual[key];
 }
}
if(process.argv.includes("--check")){
 if(changes.length){
  process.stderr.write("Coverage floors need sync (--write): "+
   JSON.stringify(changes)+"\n");
  process.exitCode=1;
 }else console.log("Coverage floors match all "+Object.keys(current.minimum).length+
  " measured registry metrics: PASS");
}else if(process.argv.includes("--write")){
 if(changes.length)fs.writeFileSync(minimumFile,JSON.stringify(current,null,2)+"\n");
 console.log("Updated "+changes.length+" measured coverage floors: "+
  JSON.stringify(changes));
}else{
 console.log("Preview: "+changes.length+" measured floors to update: "+
  JSON.stringify(changes));
}
