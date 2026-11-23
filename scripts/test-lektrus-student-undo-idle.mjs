import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";
const source=fs.readFileSync("src/lektrusPersonalBoardHistory.ts","utf8");
const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const exports={};
new Function("exports",compiled)(exports);
const {personalBoardEdit,applyPersonalBoardEdit}=exports;
const object=(id,createdBy="teacher",x=0,text=id)=>({id,kind:"text",createdBy,x,y:0,width:100,height:40,text});
const owned=object("mine","pupil");
const teacher=object("teacher","teacher");
const peer=object("peer","another");
const choose=(before,after)=>{const op=personalBoardEdit(before,after);assert.ok(op);return op};
{
 const add=choose([teacher],[teacher,owned]);
 const latest=[teacher,peer,owned];
 const undone=applyPersonalBoardEdit(latest,add,"undo");
 assert.ok(undone.changed);
 assert.deepEqual(undone.items,[teacher,peer],"Undo of pupil insert preserves both teacher and other pupil");
 const redone=applyPersonalBoardEdit(undone.items,add,"redo");
 assert.ok(redone.changed);
 assert.ok(redone.items.some(x=>x.id==="mine"));
 assert.ok(redone.items.some(x=>x.id==="peer"));
}
{
 const before=[teacher,peer];
 const after=[{...teacher,x:50},peer];
 const operation=choose(before,after);
 const updatedByTeacher=[{...after[0],text:"Teacher edit"},peer,owned];
 const undo=applyPersonalBoardEdit(updatedByTeacher,operation,"undo");
 assert.equal(undo.items[0].x,0,"Undo only moves back pupil-edited coordinate");
 assert.equal(undo.items[0].text,"Teacher edit","A later teacher text edit must survive");
 assert.equal(undo.items[0].createdBy,"teacher","Pupil cannot rewrite original authorship");
 const redo=applyPersonalBoardEdit(undo.items,operation,"redo");
 assert.equal(redo.items[0].x,50);
 assert.equal(redo.items[0].text,"Teacher edit");
 const conflict=applyPersonalBoardEdit([{...after[0],x:200},peer],operation,"undo");
 assert.equal(conflict.changed,false,"A teacher's later coordinate edit is never rolled back");
 assert.ok(conflict.conflicts>=1);
}
{
 const stroke={...teacher,kind:"pen",text:"",points:[{x:0,y:0},{x:1,y:1}]};
 const erase=choose([stroke,peer],[peer]);
 const undo=applyPersonalBoardEdit([peer],erase,"undo");
 assert.ok(undo.items.some(x=>x.id==="teacher"),"Pupil may undo their own erasure of teacher's shared stroke");
 assert.ok(undo.items.some(x=>x.id==="peer"),"Other pupil's work preserved");
 const redo=applyPersonalBoardEdit(undo.items,erase,"redo");
 assert.deepEqual(redo.items,[peer]);
}
{
 const removal=choose([owned],[ ]);
 const later=[{...owned,x:45}];
 const attempt=applyPersonalBoardEdit(later,removal,"undo");
 assert.equal(attempt.changed,false,"Do not overwrite a peer's restored item");
}
const board=fs.readFileSync("src/BoardApp.tsx","utf8");
assert.match(board,/const personalHistory=useRef/);
assert.match(board,/personalBoardEdit\(current,normalized\)/);
assert.match(board,/applyPersonalBoardEdit\(itemsRef\.current,stack\.entries\[step\]/);
assert.match(board,/if\(isStudent&&!isBoardOwner\)/);
assert.match(board,/disabled=\{isStudent&&!isBoardOwner\?!personalUndoAvailable\(\):index\.current===0\}/);
assert.match(board,/disabled=\{isStudent&&!isBoardOwner\?!personalRedoAvailable\(\):index\.current===history\.current\.length-1\}/);
assert.match(board,/disabled=\{isStudent&&!isBoardOwner\?!personalUndoAvailable\(\):index\.current === 0\}/);
assert.match(board,/disabled=\{isStudent&&!isBoardOwner\?!personalRedoAvailable\(\):index\.current === history\.current\.length - 1\}/);
for(const socket of ["selfhostWatchDocument","subscribeBoardDocument","subscribeBoardPresence","connectBoardCursorChannel","connectBoardViewControl","connectBoardWorkChannel","connectAttachmentApprovalChannel","subscribeBoardComments"])
 assert.ok(board.includes(socket),"Board socket must be explicitly controlled: "+socket);
assert.match(board,/const \[boardRealtimeAwake,setBoardRealtimeAwake\]=useState\(true\)/);
assert.match(board,/ACTIVE_IDLE_MS=10\*60\*1000,HIDDEN_IDLE_MS=90\*1000/);
assert.match(board,/if\(boardIdleBusy\(\)\)/);
assert.match(board,/if\(!boardRealtimeAwake\)setBoardRealtimeAwake\(true\)/);
assert.match(board,/document\.addEventListener\(type,userAction,\{capture:true,passive:true\}\)/);
assert.doesNotMatch(board,/document\.addEventListener\("pointermove",userAction/);
const sentence=fs.readFileSync("src/LektrusLanguageSocialView.tsx","utf8");
assert.match(sentence,/data-board-interactive="true"/);
assert.match(sentence,/dropSlotRef\.current=slot/);
assert.match(sentence,/setOrder\(moveSentenceWord\(gesture\.origin,gesture\.id,slot\)\)/);
assert.doesNotMatch(sentence,/setOrder\(current=>moveSentenceWord\(current,gesture\.id,slot\)\)/);
console.log("Student-only undo/redo, peer conflict isolation, idle socket gating, tablet word capture: OK");
