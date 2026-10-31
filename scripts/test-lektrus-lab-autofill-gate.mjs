import assert from "node:assert/strict";
import { test } from "node:test";
import { dispatchDecision } from "./lektrus-lab-autofill-gate.mjs";
const now=Date.parse("2026-10-31T08:00:00Z");
function run(minutesAgo,status="completed") {
 return {id:minutesAgo,status,
   created_at:new Date(now-minutesAgo*60000).toISOString(),
   run_started_at:new Date(now-minutesAgo*60000).toISOString()};
}
test("new project starts a worker",()=>{
 assert.equal(dispatchDecision([],now).launch,true);
});
test("a worker still running blocks even when it started long ago",()=>{
 assert.equal(dispatchDecision([run(35,"in_progress")],now).reason,"worker-active");
});
test("the 20-minute cooldown applies to completed work only",()=>{
 assert.equal(dispatchDecision([run(19)],now).reason,"cooldown");
 assert.equal(dispatchDecision([run(20)],now).launch,true);
});
test("five-minute polls do not reset the work cooldown",()=>{
 assert.equal(dispatchDecision([run(27),run(5,"completed")],now).reason,"cooldown");
});
test("the most recent start controls the cooldown",()=>{
 assert.equal(dispatchDecision([run(45),run(12)],now).reason,"cooldown");
});
test("queued work blocks a second dispatch",()=>{
 assert.equal(dispatchDecision([run(23,"queued")],now).reason,"worker-active");
});
test("unknown run times fail closed",()=>{
 assert.equal(dispatchDecision([{status:"completed",created_at:"invalid"}],now).launch,false);
});
