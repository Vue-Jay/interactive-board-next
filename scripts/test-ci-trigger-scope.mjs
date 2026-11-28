import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {matchesGlob} from "node:path";

// Check event routing without removing any release or manual test suite.
const directory=".github/workflows";
function triggers(name){
 const contents=readFileSync(directory+"/"+name+".yml","utf8");
 const start=contents.indexOf("\non:\n");
 assert.ok(start>=0,"Missing event block: "+name);
 const result={};let event,key;
 for(const line of contents.slice(start+5).split("\n")){
  if(/^\S/.test(line))break;
  let m=line.match(/^  ([a-z_]+):\s*$/);
  if(m){event=m[1];result[event]={};key=null;continue;}
  if(!event)continue;
  m=line.match(/^    (branches|paths):\s*(.*)$/);
  if(m){key=m[1];result[event][key]=m[2].startsWith("[")?m[2].slice(1,-1).split(",").map(s=>s.trim().replace(/^['"]|['"]$/g,"")):[];continue;}
  m=line.match(/^      - (.+)$/);
  if(m&&key)result[event][key].push(m[1].trim().replace(/^['"]|['"]$/g,""));
 }
 return result;
}
const selected=["verify","selfhost-frontend","board-build","lectris-check","selfhost-api","lab-reaction-audit","portable-windows","android-debug-apk","android-offline-test","native-build","native-mobile-server-qa","participant-roles"];
const scoped=Object.fromEntries(selected.map(name=>[name,triggers(name)]));
function matches(name,event,branch,changed){
 const t=scoped[name][event];if(!t)return false;
 if(t.branches&&!t.branches.some(pattern=>matchesGlob(branch,pattern)))return false;
 return !t.paths||changed.some(file=>t.paths.some(pattern=>matchesGlob(file,pattern)));
}
function runs(event,branch,changed){return selected.filter(name=>matches(name,event,branch,changed)).sort();}
const coordinate=["src/coordinatePlane.ts","scripts/test-lektrus-math-gesture.mjs","scripts/test-lektrus-release-browser-smoke.mjs"];
assert.deepEqual(runs("pull_request","main",coordinate),["verify"],"Routine math PR must use one verification workflow");
assert.deepEqual(runs("push","main",coordinate),["selfhost-frontend"],"Routine math merge must use one production-branch workflow");
assert.ok(runs("pull_request","main",["src/BoardApp.tsx"]).includes("verify"));
assert.ok(runs("pull_request","main",["server/app.py"]).includes("selfhost-api"));
const boardRelease=["src/BoardApp.tsx","src/boardIdle.ts","src/boardParticipantColors.ts","src/selfhostApi.ts","server/app.py","server/realtime_events.py","server/board_presence_policy.py"];
assert.deepEqual(runs("pull_request","main",boardRelease),["selfhost-api","verify"],"Routine board plus API PR must run exactly two combined workflows");
const roleBrowserTest="tests/participant-roles-browser.py";
assert.deepEqual(runs("pull_request","main",[roleBrowserTest]),["participant-roles","verify"],"Changes to role acceptance itself must exercise that suite");
assert.deepEqual(runs("pull_request","main",[...boardRelease,roleBrowserTest]),["participant-roles","selfhost-api","verify"],"Explicit role regression plus API changes require both specialized gates");
assert.ok(runs("pull_request","main",["src/lektrusLabCatalog.ts"]).includes("lab-reaction-audit"));
assert.ok(runs("pull_request","main",["android/app/build.gradle"]).includes("native-build"));
assert.ok(runs("push","main",["android/app/build.gradle"]).includes("native-build"),"Native changes retain the official Android release gate");
for(const file of ["src/BoardApp.tsx","src/boardDurableInk.ts","src/inkEraser.ts","src/boardSync.ts",".github/workflows/native-build.yml"]){assert.ok(runs("push","main",[file]).includes("native-build"),file+" must trigger signed APK release");}
for(const name of selected)assert.ok(scoped[name].workflow_dispatch,name+" lost manual coverage");
assert.match(readFileSync(directory+"/native-build.yml","utf8"),/inputs\.publish_android == true/);
console.log("CI routing: math PR 1 + main 1; full manual coverage retained.");
