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
  if(id==="./boardModel")
   return {isInkItem:item=>item.kind==="pen"||item.kind==="marker"};
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

// Pen/marker ink belongs to the shared drawing layer. It cannot be locked;
// even legacy locked strokes remain erasable by every editor.
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
for(const inkItem of [invalidLockedPen,invalidLockedMarker]){
 for(const actor of ["student-A","other-student","guest-123"])
  assert.equal(canRemoveBoardItem(inkItem,actor,true),true,
   "All editors may erase pen/marker ink, even from someone else");
}
assert.equal(canRemoveBoardItem({...task,locked:true},"student-A",true,true),true,
 "The real board owner can delete a locked assignment");
assert.deepEqual(blockedBoardItemRemovals([invalidLockedPen,teacher],[],
 "student-A",true).map(x=>x.id),["teacher"],
 "Only protected ordinary objects block student deletion");

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
assert.ok(!result.some(x=>canvas.some(original=>original.id===x.id)),
 "Shared eraser cuts teacher, student and unattributed strokes together");
for(const author of ["teacher-A","student-A",undefined])
 assert.ok(result.some(x=>x.createdBy===author&&x.kind==="pen"),
  "Eraser fragments preserve origin author: "+author);
const lockedPeerInk={...teacherInk,id:"locked-peer",locked:true};
const fragments=ink.eraseInkAlongPath([lockedPeerInk],[{x:50,y:0}],7);
assert.ok(fragments.length>0&&fragments.every(x=>x.locked===undefined),
 "An old locked stroke must be erasable and fragments must not inherit locks");

const app=read("src/BoardApp.tsx"),model=read("src/boardModel.ts");
assert.match(model,/createdBy\?: string;/);
assert.match(model,/i\.kind !== "pen" && i\.kind !== "marker" \? \{ locked: true \}/,
 "Persisted pen/marker cannot carry locked=true");
assert.match(app,/selected\.includes\(item\.id\)&&isLockableBoardItem\(item\)/,
 "Selection lock action skips ink even in mixed selections");
assert.match(app,/ids\.has\(candidate\.id\)&&isLockableBoardItem\(candidate\)/,
 "Layers-panel lock action skips ink");
assert.match(app,/\{family\.some\(isLockableBoardItem\)&&<button/,
 "Layer lock command is not shown for ink-only layer");
assert.match(app,/\{selectedItems\.some\(isLockableBoardItem\)&&<button/,
 "Selection lock command is hidden for ink-only selections");
assert.match(model,/typeof i\.createdBy === "string"/,"Serialized item keeps author");
assert.match(model,/if \(i\.createdBy != null &&/,"Malformed authors are rejected");
assert.match(app,/blockedBoardItemRemovals\(current,next,authUser\.id,isStudent/,
 "Every commit guards deletions, not just Delete key");
assert.match(app,/stampNewBoardItemAuthors\(current,syncBoundConnectors\(next\),authUser\.id\)/,
 "Commit stamps objects in one place");
assert.match(app,/item=>canRemoveBoardItem\(item,authUser\.id,isStudent,isBoardOwner\)/,
 "Eraser applies shared-ink policy, not ownership restriction");
assert.match(app,/const rebased=mergeBoardItems\(/,
 "Undo and redo rebase onto the present board");
assert.match(app,/if\(!fromRemote&&isStudent&&!isBoardOwner\)/,
 "Student cannot restore entire board; actual owner can");
assert.match(app,/const foreignIds = new Set\(/,
 "Delete keyboard and toolbar preserve foreign selected items");

console.log("Board owner privileges and shared un-lockable pen/marker eraser: OK");
