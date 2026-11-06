import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import ts from "typescript";

const read=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
const compile=path=>ts.transpileModule(read(path),{compilerOptions:{
 target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS
}}).outputText;
const roles={};
new Function("exports","require",compile("src/lektrusBoardRolePreview.ts"))(
 roles,()=>{throw Error("Unexpected runtime import in board roles")});
const policy={};
new Function("exports","require",compile("src/lektrusBoardObjectAuth.ts"))(
 policy,id=>{
  assert.equal(id,"./lektrusBoardRolePreview");
  return roles;
 });
const {stampNewBoardItemAuthors,canRemoveBoardItem,blockedBoardItemRemovals,isLockableBoardItem,withoutInkLock}=policy;
const item=(id,createdBy,kind="shape")=>({
 id,createdBy,kind,x:0,y:0,width:110,height:30,text:"test",
});
const teacher=item("teacher","teacher-A");
const student=item("student","student-A");
const guest=item("guest","guest-B");
const legacy=item("old",undefined);
const task=item("task","student-A","quiz");
const locked={...student,id:"locked",locked:true};

assert.equal(canRemoveBoardItem(student,"student-A",true),true);
for(const other of [teacher,guest,legacy,task,locked])
 assert.equal(canRemoveBoardItem(other,"student-A",true),false,
  "Student must never delete "+other.id);
assert.equal(canRemoveBoardItem(legacy,"teacher-A",false),true);
assert.deepEqual(blockedBoardItemRemovals(
 [teacher,student,legacy],[], "student-A",true).map(x=>x.id),["teacher","old"],
 "Central mutation gate catches foreign deletion and legacy loss");
assert.deepEqual(blockedBoardItemRemovals(
 [teacher,student,legacy],[teacher,legacy],"student-A",true),[],
 "Student removes only their own object");
assert.deepEqual(blockedBoardItemRemovals(
 [teacher,student],[], "teacher-A",false),[],"Teacher retains delete permissions");

// Existing IDs cannot change author after a move, resize, text edit or spoof.
// New IDs (including clones from the clipboard) always belong to the actor.
const copied={...teacher,id:"copy"};
const stamped=stampNewBoardItemAuthors(
 [teacher,legacy],[{...teacher,x:60,createdBy:"student-A"},
 {...legacy,x:20,createdBy:"student-A"},copied,
 {...student,id:"new-stroke",kind:"pen"}],"student-A");
assert.equal(stamped[0].createdBy,"teacher-A");
assert.equal(stamped[0].x,60,"Student may move an unlocked teacher object");
assert.equal(stamped[1].createdBy,undefined,"Legacy author remains unknown");
assert.equal(stamped[2].createdBy,"student-A","Cloning transfers creator to student");
assert.equal(stamped[3].createdBy,"student-A","Ink gets creator automatically");
assert.equal(teacher.createdBy,"teacher-A","Original item is immutable");

// Pen and marker strokes are not lockable, even if old board JSON or a
// malicious editor payload contains a legacy locked flag. Ownership still
// protects against removing another participant's marks.
assert.equal(isLockableBoardItem({kind:"pen"}),false);
assert.equal(isLockableBoardItem({kind:"marker"}),false);
assert.equal(isLockableBoardItem({kind:"shape"}),true);
const invalidLockedPen={...student,id:"old-pen",kind:"pen",locked:true};
const invalidLockedMarker={...student,id:"old-marker",kind:"marker",locked:true};
assert.equal(withoutInkLock(invalidLockedPen).locked,undefined);
assert.equal(withoutInkLock(invalidLockedMarker).locked,undefined);
assert.equal(withoutInkLock({...student,locked:true}).locked,true,
 "Placed shapes retain their explicit locks");
const sanitized=stampNewBoardItemAuthors(
 [invalidLockedPen,invalidLockedMarker],
 [invalidLockedPen,invalidLockedMarker,{...invalidLockedPen,id:"new-pen"}],
 "student-A");
assert.ok(sanitized.every(x=>x.locked!==true),
 "Existing and newly created ink is always unlocked");
assert.ok(sanitized.every(x=>x.createdBy==="student-A"),
 "Removing ink lock must not discard creator provenance");
assert.equal(canRemoveBoardItem({...invalidLockedPen,locked:undefined},
 "teacher-A",true),true,"Any editor may erase shared ink regardless of who drew it");

const ink={};
new Function("exports","require",compile("src/inkEraser.ts"))(
 ink,()=>{throw Error("Unexpected runtime import in ink eraser")});
const stroke=(id,author,y)=>({
 id,createdBy:author,kind:"pen",x:0,y,width:100,height:10,
 text:"",points:[{x:0,y:0},{x:100,y:0}],weight:3,color:"#111111"
});
const teacherInk=stroke("teacher-stroke","teacher-A",0);
const studentInk=stroke("student-stroke","student-A",0);
const legacyInk=stroke("legacy-stroke",undefined,0);
const canvas=[teacherInk,studentInk,legacyInk];
const result=ink.eraseInkAlongPath(canvas,[{x:50,y:0}],7,
 stroke=>canRemoveBoardItem(stroke,"student-A",true));
assert.equal(result.some(x=>x.id==="teacher-stroke"),false,
 "Shared ink can be erased even when the teacher drew it");
assert.equal(result.some(x=>x.id==="legacy-stroke"),false,
 "Unattributed legacy ink is not implicitly locked");
assert.equal(result.some(x=>x.id==="student-stroke"),false,
 "Student stroke was cut at the brush intersection");
assert.ok(result.some(x=>x.createdBy==="student-A"&&x.kind==="pen"),
 "Stroke fragments retain the original creator");

const app=read("src/App.tsx"),model=read("src/boardModel.ts");
assert.match(model,/createdBy\?: string;/);
assert.match(model,/i\.kind !== "pen" && i\.kind !== "marker" \? \{ locked: true \}/,
 "Persisted pen/marker cannot carry locked=true");
assert.match(app,/selected\.includes\(item\.id\)&&isLockableBoardItem\(item\)/,
 "Selection lock action skips ink even in mixed selections");
assert.match(app,/ids\.has\(candidate\.id\)&&isLockableBoardItem\(candidate\)/,
 "Layers-panel lock action skips ink");
assert.match(app,/disabled=\{!family\.some\(isLockableBoardItem\)\}/,
 "Layer lock control disabled for ink-only layer");
assert.match(app,/!selectedItems\.some\(isLockableBoardItem\)/,
 "Selection lock controls disabled for ink-only selections");
assert.match(model,/typeof i\.createdBy === "string"/,"Serialized item keeps author");
assert.match(model,/if \(i\.createdBy != null &&/,"Malformed authors are rejected");
assert.match(app,/blockedBoardItemRemovals\(current,next,authUser\.id,isStudent/,
 "Every commit guards deletions, not just Delete key");
assert.match(app,/stampNewBoardItemAuthors\(current,syncBoundConnectors\(next\),authUser\.id\)/,
 "Commit stamps objects in one place");
assert.match(app,/canRemoveBoardItem\(item,authUser\.id,true/,
 "Eraser uses the shared ink policy before cutting it");
assert.match(app,/const rebased=mergeBoardItems\(/,
 "Undo and redo rebase onto the present board");
assert.match(app,/if\(!fromRemote&&isStudent\)/,
 "Student cannot restore or import a whole old board");
assert.match(app,/const foreignIds = new Set\(/,
 "Delete keyboard and toolbar preserve foreign selected items");

console.log("Board object author persistence, student/guest deletion, eraser and undo policy: OK");
