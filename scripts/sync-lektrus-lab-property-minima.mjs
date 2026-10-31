/** Advance source-based coverage floors without manually counting data.
 * Usage:
 *   npm run lab:coverage-sync             # preview, read-only
 *   npm run lab:coverage-sync -- --write   # update only increasing floors
 * Fixing WRONG phase records can lower a historical count, in which case
 * require a reviewed commit documenting that correction. Never silently
 * lower the safety floor with this tool.
 */
import fs from "node:fs";
import path from "node:path";
import {execFileSync} from "node:child_process";
const root=path.resolve(import.meta.dirname,"..");
const minimaPath=path.join(root,"scripts/lektrus-lab-property-minima.json");
const saved=JSON.parse(fs.readFileSync(minimaPath,"utf8"));
const report=JSON.parse(execFileSync(process.execPath,[
 "scripts/audit-lektrus-lab-properties.mjs","--json"
],{cwd:root,encoding:"utf8",maxBuffer:8*1024*1024}));
const next=structuredClone(saved);
const increased=[],decreased=[],unchanged=[];
for(const [key,value] of Object.entries(saved.minimum)){
 const actual=report.rawTotals[key];
 if(!Number.isFinite(actual))throw Error("Missing raw total "+key);
 if(actual<value)decreased.push({key,was:value,now:actual});
 else if(actual>value){increased.push({key,was:value,now:actual});next.minimum[key]=actual}
 else unchanged.push(key);
}
if(decreased.length){
 console.error("Coverage decreased. Source/phase corrections require explicit review:");
 for(const row of decreased)console.error(row);
 process.exitCode=1;
}else{
 for(const row of increased)console.log(`+ ${row.key}: ${row.was} -> ${row.now}`);
 console.log("Unchanged safety floors:",unchanged.length);
 if(process.argv.includes("--write")){
  fs.writeFileSync(minimaPath,JSON.stringify(next,null,2)+"\n");
  console.log("Updated numeric monotone floors.");
 }else console.log("Preview only. Pass --write after reviewing source changes.");
}
