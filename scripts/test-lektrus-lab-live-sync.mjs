import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import ts from "typescript";

const read=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
const load=(path,resolve=()=>{throw Error("Unexpected import");})=>{
 const js=ts.transpileModule(read(path),{compilerOptions:{
  target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS
 }}).outputText;
 const exports={};
 new Function("require","exports",js)(resolve,exports);
 return exports;
};
const board=load("src/boardModel.ts");
const edits=load("src/lektrusLiveEditorMerge.ts");
const live=load("src/lektrusLabLiveSync.ts",key=>{
 if(key==="./boardModel")return board;
 if(key==="./lektrusLiveEditorMerge")return edits;
 throw Error("Unexpected "+key);
});

const start={id:"lab-live-1",kind:"graph",text:"Химический стол",x:20,y:30,
 width:550,height:360,graphFigureId:"chem-experiment-free",
 scienceLabBench:{event:0,selectedId:"v1",mode:"reactions",vessels:[
  {id:"v1",kind:"beaker",x:48,y:70,environment:"aqueous",observed:false,
   reagents:["H2O"],doses:{H2O:{value:25,unit:"ml"}}},
  {id:"v2",kind:"tube",x:60,y:73,environment:"aqueous",observed:false,
   reagents:[]}
 ]}};
const accepted=board.parseDocument(JSON.stringify({
 version:1,title:"Lab live test",view:{x:0,y:0,zoom:1},items:[start]
})).items[0];
assert.deepEqual(accepted.scienceLabBench.vessels.map(v=>v.id),["v1","v2"]);

const after={...start,scienceLabBench:{...start.scienceLabBench,event:1,
 simulationAtMs:123456,vessels:start.scienceLabBench.vessels.map(v=>v.id==="v1"?
 {...v,temperatureC:83.5}:v)}};
const ops=live.labLiveEditorDiff(start,after);
assert.ok(ops.length>0&&ops.every(op=>op.path[0]==="scienceLabBench"),
 "Only the measured laboratory state is sent over fast realtime");
assert.ok(ops.some(op=>op.kind==="upsert-id"&&
 op.path.join(".")==="scienceLabBench.vessels"&&op.id==="v1"),
 "Thermal changes address a specific vessel ID, never append duplicate index entries");
assert.ok(!ops.some(op=>op.kind==="append"&&op.path.includes("vessels")),
 "A liquid evaporation tick must not append an existing beaker");
assert.ok(JSON.stringify(ops).length<4000,
 "One heating step must not rebroadcast the whole tabletop");
assert.deepEqual(live.applyLabLivePreview(start,undefined,ops)?.scienceLabBench,
 after.scienceLabBench,"Remote participants see the exact current temperature");
const peer={...start,scienceLabBench:{...start.scienceLabBench,event:1,
 vessels:start.scienceLabBench.vessels.map(v=>v.id==="v2"?
 {...v,x:65}:v)}};
const merged=live.applyLabLivePreview(start,peer,ops);
assert.equal(merged?.scienceLabBench?.vessels[0].temperatureC,83.5);
assert.equal(merged?.scienceLabBench?.vessels[1].x,65,
 "Realtime preview preserves an independent peer vessel movement");
assert.equal(start.scienceLabBench.vessels[0].temperatureC,undefined,
 "Fast remote previews never mutate the saved board");

// A previously saved board can contain two V2 entries and two identical
// burner IDs after an older positional-array conflict. The reader must
// salvage that one affected laboratory without throwing away the lesson.
const burner={id:"heater-1",kind:"burner",x:48,y:70,active:false,powered:false,
 temperatureC:22};
const staleVessel=start.scienceLabBench.vessels[1];
const newestVessel={...staleVessel,temperatureC:36.4};
const duplicated={...start,scienceLabBench:{...start.scienceLabBench,
 vessels:[start.scienceLabBench.vessels[0],staleVessel,newestVessel],
 placedDevices:[burner,{...burner,temperatureC:36.3}]}};
const shape={id:"shape-1",kind:"shape",x:3,y:4,width:50,height:30,
 text:"",shapeType:"rectangle",color:"#445566"};
const recovered=board.parseDocument(JSON.stringify({version:1,title:"Science lesson",
 view:{x:0,y:0,zoom:1},items:[shape,duplicated]}));
assert.equal(recovered.items.length,2,"Unrelated objects must survive lab recovery");
const repairedBench=recovered.items[1].scienceLabBench;
assert.deepEqual(repairedBench.vessels.map(v=>v.id),["v1","v2"]);
assert.equal(repairedBench.vessels[1].temperatureC,36.4,
 "Duplicate snapshots retain the most recent observed temperature");
assert.equal(repairedBench.placedDevices.length,1);
assert.equal(repairedBench.placedDevices[0].temperatureC,36.3);
const repairedAgain=board.parseDocument(JSON.stringify(recovered));
assert.deepEqual(repairedAgain.items[1].scienceLabBench,
 JSON.parse(JSON.stringify(repairedBench)),
 "Reopening a repaired classroom lab is idempotent after JSON serialization");
// An actual different item with the same ID should survive under a new ID,
// rather than dropping its content when two edits collide.
const distinct={...duplicated,scienceLabBench:{...duplicated.scienceLabBench,
 vessels:[start.scienceLabBench.vessels[0],staleVessel,
  {...staleVessel,kind:"flask",reagents:["NaCl"],
   doses:{NaCl:{unit:"g",value:1}},environment:"dry"}],
 placedDevices:[burner,{...burner,kind:"tripod"}]}};
const distinctRecovered=board.parseDocument(JSON.stringify({
 version:1,title:"Another lab",view:{x:0,y:0,zoom:1},items:[distinct]
})).items[0].scienceLabBench;
assert.equal(distinctRecovered.vessels.length,3);
assert.equal(new Set(distinctRecovered.vessels.map(v=>v.id)).size,3);
assert.equal(distinctRecovered.vessels[2].doses.NaCl.value,1);
assert.equal(new Set(distinctRecovered.placedDevices.map(d=>d.id)).size,2);
// Concurrent apparatus updates use ID-based operations too.
const addedHeater={...start,scienceLabBench:{...start.scienceLabBench,
 placedDevices:[burner]}};
const addedOps=live.labLiveEditorDiff(start,addedHeater);
assert.ok(addedOps.some(op=>op.kind==="set"&&
 op.path.join(".")==="scienceLabBench.placedDevices"),
 "Adding the first heater initializes the absent apparatus array");
assert.equal(live.applyLabLivePreview(start,undefined,addedOps)?.
 scienceLabBench.placedDevices.length,1);
const heatedHeater={...addedHeater,scienceLabBench:{
 ...addedHeater.scienceLabBench,placedDevices:[{...burner,temperatureC:60}]}};
const deviceOps=live.labLiveEditorDiff(addedHeater,heatedHeater);
assert.ok(deviceOps.some(op=>op.kind==="upsert-id"&&
 op.path.join(".")==="scienceLabBench.placedDevices"&&op.id==="heater-1"),
 "Subsequent heater temperature updates target the same ID, never append");
const erased={...start,scienceLabBench:{...start.scienceLabBench,
 vessels:[start.scienceLabBench.vessels[0]]}};
const removedOps=live.labLiveEditorDiff(start,erased);
assert.ok(removedOps.some(op=>op.kind==="remove-id"&&op.id==="v2"),
 "Removing a vessel must broadcast a stable-ID deletion");
assert.deepEqual(live.applyLabLivePreview(start,undefined,removedOps)?.
 scienceLabBench.vessels.map(v=>v.id),["v1"]);

const noop=live.labLiveEditorDiff(start,{...start});
assert.deepEqual(noop,[]);
assert.deepEqual(live.labLiveEditorDiff(start,{...after,id:"other"}),[]);
const corruptDose=[{path:["scienceLabBench","vessels",0,"doses","H2O","value"],
 kind:"set",value:-2}];
assert.equal(live.applyLabLivePreview(start,undefined,corruptDose),null,
 "Negative inventory quantities are rejected before rendering");
const corruptOther=[{path:["x"],kind:"set",value:500}];
assert.equal(live.applyLabLivePreview(start,undefined,corruptOther),null,
 "Live lab messages cannot move or replace board objects");
const corruptKind=[{path:["scienceLabBench","vessels",0,"kind"],
 kind:"set",value:"not-a-vessel"}];
assert.equal(live.applyLabLivePreview(start,undefined,corruptKind),null);
const large=[{path:["scienceLabBench","vessels",0,"id"],kind:"set",value:"x".repeat(101000)}];
assert.equal(live.applyLabLivePreview(start,undefined,large),null,
 "Oversized realtime messages are rejected before document parsing");
assert.match(read("src/App.tsx"),/const liveLab=stored\?\.graphFigureId==="chem-experiment-free"/,
 "Receiver must route chemistry updates through the fast preview validator");
assert.match(read("src/App.tsx"),/labLiveEditorDiff\(latest,updated\)/,
 "Both board and fullscreen lab must publish minimal realtime deltas");
assert.match(read("src/App.tsx"),/applyLabLivePreview\(stored,base,mutation\.ops\)/,
 "Untrusted chemistry packets are sanitized before use");
console.log("Chemistry live-sync: compact ops, independent changes, validation and immutability OK");
