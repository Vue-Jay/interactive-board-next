import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import ts from "typescript";
const read=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
const compiled=ts.transpileModule(read("src/lektrusLabPersistence.ts"),{
 compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}
}).outputText;
const policy={};
new Function("exports",compiled)(policy);
const {LAB_SIMULATION_CHECKPOINT_MAX_MS,LAB_SIMULATION_LOCAL_QUIET_MS,
 labSimulationCheckpointDelayMs}=policy;
assert.equal(LAB_SIMULATION_CHECKPOINT_MAX_MS,2200);
assert.equal(LAB_SIMULATION_LOCAL_QUIET_MS,900);
assert.equal(labSimulationCheckpointDelayMs(1000,1000),900);
assert.equal(labSimulationCheckpointDelayMs(1800,1000),900);
assert.equal(labSimulationCheckpointDelayMs(2500,1000),700);
assert.equal(labSimulationCheckpointDelayMs(3200,1000),0);
assert.equal(labSimulationCheckpointDelayMs(6200,1000),0);
// With ticks arriving every 500 ms, the quiet debounce never completes,
// but the absolute deadline must still force a full checkpoint.
const tickTimes=[0,500,1000,1500,2000,2500,3000,3500];
assert.deepEqual(tickTimes.map(at=>labSimulationCheckpointDelayMs(at,0)),
 [900,900,900,700,200,0,0,0]);
assert.equal(labSimulationCheckpointDelayMs(NaN,1000),0);

const source=read("src/App.tsx");
const surface=read("src/LektrusChemistryBench.tsx");
const illustration=read("src/LektrusChemistryIllustration.tsx");
const editor=read("src/LektrusChemistryBenchEditor.tsx");
const science=read("src/LektrusScienceEditor.tsx");
for(const [name,body] of [["App.tsx",source],["LektrusChemistryBench.tsx",surface],
 ["LektrusChemistryIllustration.tsx",illustration],
 ["LektrusChemistryBenchEditor.tsx",editor],["LektrusScienceEditor.tsx",science]]){
 const parsed=ts.createSourceFile(name,body,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
 assert.equal(parsed.parseDiagnostics.length,0,name+" syntax must remain valid");
}
assert.match(surface,/changeRef\.current\?\.\(next,true\)/,
 "Only automatic simulation ticking sends the checkpoint hint");
assert.match(illustration,/onBenchChange\?\.\(next,simulationOnly\)/);
assert.match(editor,/onChange\(\{\.\.\.item,scienceLabBench:updated,[\s\S]*?\},simulationOnly\)/);
assert.match(science,/onExperimentLiveChange\?\.\(draft,next,simulationOnly\)/);
assert.match(source,/labSimulationCheckpointDelayMs\(now,labCheckpointStartedAt\.current!\)/);
assert.match(source,/const automatic = labSimulationOnly\.current && !editing/);
assert.match(source,/history\.current\[index\.current\]=normalized/,
 "A physical tick updates the visible snapshot without consuming undo history");
assert.match(source,/history\.current\.push\(normalized\)/,
 "Explicit user operations continue producing distinct undoable edits");
assert.match(source,/labSimulationOnly\.current=isLabSimulation/);
assert.match(source,/if\(!isLabSimulation\)labCheckpointStartedAt\.current=null/,
 "A teacher action resets the deferred simulation checkpoint");
assert.match(source,/window\.addEventListener\("pagehide", flushSave\)/,
 "Leaving the app forces the latest pending laboratory state to local persistence");
assert.match(source,/if \(document\.visibilityState === "hidden"\) flushSave\(\)/,
 "Backgrounding a phone immediately flushes the latest laboratory state");
assert.match(source,/const latest=currentDocument\(\);[\s\S]*?snapshot\.current=latest;\s*flushSave\(\)/,
 "Explicit leave does not rely on a potentially stale React frame");
assert.equal((source.match(/labSimulation:simulationOnly/g)??[]).length,2,
 "Both fullscreen and embedded chemistry paths distinguish automatic ticks");
console.log("Lab checkpoint scheduling, bounded deadline, teacher undo and leave safety: OK");
