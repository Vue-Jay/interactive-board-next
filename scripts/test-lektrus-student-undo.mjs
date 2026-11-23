import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import ts from "typescript";
const source=readFileSync(new URL("../src/studentBoardUndo.ts",import.meta.url),"utf8");
const transpiled=ts.transpileModule(source,{compilerOptions:{
 target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS
}}).outputText;
const moduleExports={};
new Function("exports",transpiled)(moduleExports);
const {captureStudentBoardAction:capture,replayStudentBoardAction:replay}=moduleExports;
const item=(id,createdBy,text="mark")=>({id,createdBy,kind:"text",x:1,y:2,width:100,height:70,text});
const teacher=item("teacher","teacher","Teacher's question");
const alice=item("alice","student-a","First answer");
const bob=item("bob","student-b","Second answer");
const teacherLatest=item("teacher-later","teacher","Lesson continuation");
// The student draws between unrelated edits by the teacher and another pupil.
const first=capture([teacher],[teacher,alice],"student-a");
assert.equal(first.changes.length,1);
assert.equal(first.actorId,"student-a");
assert.deepEqual(first.changes.map(x=>x.id),["alice"]);
const collaborative=[teacher,bob,alice,teacherLatest];
assert.equal(replay(collaborative,first,"student-b","undo").reason,"wrong-user");
const undone=replay(collaborative,first,"student-a","undo");
assert.equal(undone.ok,true);
assert.deepEqual(undone.items.map(x=>x.id),["teacher","bob","teacher-later"],
 "Undo must remove ONLY this student's added item");
const redone=replay(undone.items,first,"student-a","redo");
assert.equal(redone.ok,true);
assert.deepEqual(new Set(redone.items.map(x=>x.id)),new Set(["teacher","bob","teacher-later","alice"]));
assert.deepEqual(redone.items.find(x=>x.id==="teacher"),teacher);
assert.deepEqual(redone.items.find(x=>x.id==="bob"),bob);
assert.equal(replay([...undone.items,{...alice,text:"Someone else used the ID"}],first,"student-a","redo").ok,false,
 "Redo may never overwrite a newly inserted item with the same ID");
// Pupil moves an unlocked teacher-created object (allowed editing policy).
// Undo is of this PUPIL'S move, not of teacher's entire object history.
const moved={...teacher,x:70};
const movement=capture([teacher,bob],[moved,bob],"student-a");
assert.deepEqual(movement.changes.map(x=>x.id),["teacher"]);
const movedLive=[moved,bob,teacherLatest];
const unmove=replay(movedLive,movement,"student-a","undo");
assert.equal(unmove.ok,true);
assert.deepEqual(unmove.items,[teacher,bob,teacherLatest]);
assert.deepEqual(replay(unmove.items,movement,"student-a","redo").items,movedLive);
// If teacher modified the SAME object after the pupil's action, never revert it.
const teacherRevised={...moved,text:"Teacher updated this after student's move"};
assert.deepEqual(replay([teacherRevised,bob],movement,"student-a","undo"),
 {ok:false,reason:"changed-by-another-user"});
// Students are allowed to erase one another's ink. Undo of THEIR erase must
// restore that stroke, rather than accidentally removing someone else's work.
const originalStroke={...bob,kind:"pen",points:[{x:2,y:2},{x:7,y:7}]};
const erasure=capture([teacher,originalStroke],[teacher],"student-a");
const restored=replay([teacher,teacherLatest],erasure,"student-a","undo");
assert.equal(restored.ok,true);
assert.deepEqual(restored.items.map(x=>x.id),["teacher","bob","teacher-later"]);
assert.equal(replay(restored.items,erasure,"student-a","redo").items.some(i=>i.id==="bob"),false);
// Multi-object edits must be atomic. If one item has changed in the meantime,
// NONE of the others may be rolled back.
const combo=capture([teacher,bob],[moved,{...bob,x:45}],"student-a");
assert.equal(combo.changes.length,2);
assert.equal(replay([{...moved,text:"teacher changed"}, {...bob,x:45}],combo,"student-a","undo").ok,false);
assert.equal(capture([teacher,bob],[teacher,bob],"student-a"),null);
assert.equal(capture([teacher,bob],[teacher,bob],""),null);
const board=readFileSync(new URL("../src/BoardApp.tsx",import.meta.url),"utf8");
assert.match(board,/const studentUndoPast=useRef<StudentBoardAction\[\]>\(\[\]\)/);
assert.match(board,/const studentUndoFuture=useRef<StudentBoardAction\[\]>\(\[\]\)/);
assert.match(board,/captureStudentBoardAction\(current,normalized,authUser\.id\)/);
assert.match(board,/replayStudentBoardAction\(itemsRef\.current,action,authUser\.id,type\)/);
assert.match(board,/if\(isStudent\)\{\s*const source=direction<0/);
assert.match(board,/disabled=\{isStudent\?studentUndoPast\.current\.length===0:index\.current===0\}/);
assert.match(board,/disabled=\{isStudent\?studentUndoFuture\.current\.length===0:index\.current===history\.current\.length-1\}/);
assert.match(board,/className="mobile-undo-redo"/,"Students must use teacher's EXISTING undo/redo UI");
console.log("Student selective undo/redo: author isolation, concurrency, conflict safety and identical controls PASS");
