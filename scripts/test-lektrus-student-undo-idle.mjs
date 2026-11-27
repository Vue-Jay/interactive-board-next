import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";
const source=fs.readFileSync("src/lektrusPersonalBoardHistory.ts","utf8");
const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const exports={};
new Function("exports",compiled)(exports);
const {personalBoardEdit,applyPersonalBoardEdit,reattributeRestoredSharedInk}=exports;
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
assert.match(board,/disabled=\{usePersonalUndo\?!personalUndoAvailable\(\):index\.current===0\}/);
assert.match(board,/disabled=\{usePersonalUndo\?!personalRedoAvailable\(\):index\.current===history\.current\.length-1\}/);
assert.match(board,/disabled=\{usePersonalUndo\?!personalUndoAvailable\(\):index\.current === 0\}/);
assert.match(board,/disabled=\{usePersonalUndo\?!personalRedoAvailable\(\):index\.current === history\.current\.length - 1\}/);
for(const socket of ["selfhostWatchDocument","subscribeBoardDocument","subscribeBoardPresence","connectBoardCursorChannel","connectBoardViewControl","connectBoardWorkChannel","connectAttachmentApprovalChannel","subscribeBoardComments"])
 assert.ok(board.includes(socket),"Board socket must be explicitly controlled: "+socket);
assert.match(board,/const \[boardRealtimeAwake,setBoardRealtimeAwake\]=useState\(true\)/);
assert.match(board,/boardResumePendingRef\.current=true/,"First interaction requires full reconnect");
assert.match(board,/if\(event\.cancelable\)event\.preventDefault\(\)/,"Block stale pointer/key before syncing");
assert.match(board,/await selfhostReadDocument\(boardSummary\.id\)/,"Reconnect must fetch current server document");
assert.match(board,/await getRemoteBoardDocument\(boardSummary\.id\)/);
assert.match(board,/remoteRetryTimer\.current/);
assert.match(board,/className="lektrus-board-idle-indicator"/);
assert.match(board,/await selfhostReadDocumentVersion\(boardSummary\.id,controller\.signal\)/,"Wake uses version-only probe");
assert.match(board,/realtimeStatus==="online"\?visiblePresenceUsers\.length:"…"/,"Connecting is not displayed as zero participants");
assert.match(board,/if\(boardResumePendingRef\.current\)\{setNotice/);

assert.doesNotMatch(board,/document\.addEventListener\("pointermove",userAction/);
const sentence=fs.readFileSync("src/LektrusLanguageSocialView.tsx","utf8");
assert.match(sentence,/data-board-interactive="true"/);
assert.match(sentence,/dropSlotRef\.current=slot/);
assert.match(sentence,/setOrder\(moveSentenceWord\(gesture\.origin,gesture\.id,slot\)\)/);
assert.doesNotMatch(sentence,/setOrder\(current=>moveSentenceWord\(current,gesture\.id,slot\)\)/);
assert.match(sentence,/window\.addEventListener\("pointermove",move/);
assert.match(sentence,/window\.addEventListener\("pointerup",finish,true\)/);
assert.match(sentence,/window\.addEventListener\("pointercancel",finish,true\)/);
console.log("Student-only undo/redo, peer conflict isolation, idle socket gating, tablet word capture: OK");

const policy={};new Function("exports",ts.transpileModule(fs.readFileSync("src/boardIdle.ts","utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(policy);
assert.equal(policy.BOARD_IDLE_MS,600000);
assert.equal(policy.boardIdleRemaining(1000,600999),1);
assert.equal(policy.boardIdleExpired(1000,601000),true);
assert.equal(policy.boardIdleRemaining(1000,1000000),0);
assert.equal(policy.boardIdleRemaining(1000,990),600000);
assert.doesNotMatch(board,/HIDDEN_IDLE_MS/);
assert.equal(policy.boardIdleExpired(null,Number.MAX_SAFE_INTEGER),false);
assert.equal(policy.boardIdleAge(null,Number.MAX_SAFE_INTEGER),0);
assert.doesNotMatch(board,/boardLastAction|noteVisiblePeerActivity/);
assert.match(board,/boardIdleRemaining\(boardBackgroundSince.current\)/);
assert.match(board,/selfhostSetBoardBackground\(boardSummary.id,null\)/);
assert.match(board,/if\(document.hidden\)\{/);
assert.match(board,/const mustResume=expired\|\|boardIdleSleeping.current\|\|!boardRealtimeAwake/);
assert.match(board,/document\.addEventListener\(type,userAction,\{capture:true,passive:false\}\)/);
assert.match(board,/event.type==="pointermove"&&/);
const colors={};new Function("exports",ts.transpileModule(fs.readFileSync("src/boardParticipantColors.ts","utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(colors);
const roster=Array.from({length:100},(_,i)=>({userId:"user-"+i}));
const assigned=colors.participantColors(roster);
assert.equal(new Set(assigned.values()).size,100);
assert.ok(![...assigned.values()].includes(colors.TEACHER_COLOR),"Learners cannot receive the owner's brand color");
assert.deepEqual([...colors.participantColors([...roster].reverse())],[...assigned]);
const authoritative=colors.participantColors([{userId:"a",color:"#123456"},{userId:"b",color:"#654321"}]);
assert.equal(authoritative.get("a"),"#123456");assert.equal(authoritative.get("b"),"#654321");
const ownerAndStudents=colors.participantColors([{userId:"student",color:colors.TEACHER_COLOR},{userId:"teacher",role:"owner",color:"#ff0000"},{userId:"guest"}],"teacher");
assert.equal(ownerAndStudents.get("teacher"),colors.TEACHER_COLOR);
assert.notEqual(ownerAndStudents.get("student"),colors.TEACHER_COLOR);
assert.notEqual(ownerAndStudents.get("guest"),colors.TEACHER_COLOR);
assert.notEqual(ownerAndStudents.get("student"),ownerAndStudents.get("guest"));
assert.equal(colors.participantColors([{userId:"someone"}]).get("someone"),colors.participantColors([{userId:"other"}]).get("other"),"An empty board resets the palette independent of prior account IDs");
const newVisit=colors.participantColors([{userId:"student",color:"#087f69"}]);
const reconnected=colors.participantColors([{userId:"student",color:"#b23a56"}]);
assert.notEqual(newVisit.get("student"),reconnected.get("student"),"Each session follows fresh server allocation");

console.log("10-minute wall-clock idle, foreground wake, unique participant colors: OK");

{
 const shared={...teacher,kind:"pen",points:[{x:0,y:0},{x:10,y:10}]};
 const op=choose([shared,peer],[peer]);
 const undo=applyPersonalBoardEdit([peer],op,"undo");
 const restored=reattributeRestoredSharedInk([peer],undo.items,op,"pupil");
 assert.equal(restored.items.find(i=>i.id===shared.id).createdBy,"pupil");
 assert.equal(restored.items.find(i=>i.id===peer.id).createdBy,"another");
 const redo=applyPersonalBoardEdit(restored.items,restored.edit,"redo");
 assert.deepEqual(redo.items,[peer]);
 const again=applyPersonalBoardEdit(redo.items,restored.edit,"undo");
 assert.equal(again.items.find(i=>i.id===shared.id).createdBy,"pupil");
}

// Layer-only actions have their own undo step. Preserve the slots occupied by
// unrelated peer additions, and do not overwrite a conflicting peer reorder.
{
 const a=object("a"),b=object("b"),c=object("c"),newPeer=object("new-peer");
 const op=choose([a,b,c],[c,a,b]);
 const undo=applyPersonalBoardEdit([c,newPeer,a,b],op,"undo");
 assert.deepEqual(undo.items,[a,newPeer,b,c]);
 assert.deepEqual(applyPersonalBoardEdit(undo.items,op,"redo").items,[c,newPeer,a,b]);
 const conflict=applyPersonalBoardEdit([b,a,c,newPeer],op,"undo");
 assert.equal(conflict.changed,false);
 assert.ok(conflict.conflicts);
}
// A partial inverse records only the applied fields, so a future redo never
// overwrites the field that belonged to another participant.
{
 const before=object("move"),after={...before,x:20,y:30},latest={...after,x:80};
 const undo=applyPersonalBoardEdit([latest],choose([before],[after]),"undo");
 assert.deepEqual(undo.items,[{...latest,y:0}]);
 const actual=choose(undo.items,[latest]);
 const redo=applyPersonalBoardEdit([{...undo.items[0],x:0}],actual,"redo");
 assert.deepEqual(redo.items,[{...latest,x:0}]);
}
assert.match(board,/const usePersonalUndo=documentSyncEnabled/);
assert.match(board,/if\(usePersonalUndo&&!isLabSimulation\)/);
assert.match(board,/if\(usePersonalUndo\)\{\s*const stack=personalHistory.current/);
assert.match(board,/stack.entries.splice\(step,1\)/);
assert.match(board,/const actual=direction<0\?personalBoardEdit\(restored.items,before\)/);
assert.match(board,/const baseline = options\?\.previousItems\?\?options\?\.objectBaseline/);
