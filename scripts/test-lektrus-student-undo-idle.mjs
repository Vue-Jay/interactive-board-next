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
assert.match(sentence,/updateAnswer\.current\(moveSentenceWord\(orderRef\.current,gesture\.id,slot\),false\)/);
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

// Nested independent operations must not be lost merely because the parent
// object/array was concurrently edited by another participant.
for(const field of ["stickerInk","contourMarks","contourStrokes","components","wires","rays","vessels","graphPoints"]){
 const own={id:"own",x:1,color:"red"},peer={id:"peer",x:2,color:"blue"};
 const before={...object("shared"),[field]:[]};
 const after={...before,[field]:[own]};
 const live={...before,[field]:[own,peer]};
 const op=choose([before],[after]);
 const undo=applyPersonalBoardEdit([live],op,"undo");
 assert.deepEqual(undo.items[0][field],[peer],field+" undo removes only local addition");
 assert.deepEqual(applyPersonalBoardEdit(undo.items,op,"redo").items[0][field],[peer,own],field+" redo preserves peer");
 const moved={...before,[field]:[{...own,x:5}]};
 const colored={...before,[field]:[{...own,x:5,color:"green"},peer]};
 const inverse=applyPersonalBoardEdit([colored],choose([{...before,[field]:[own]}],[moved]),"undo");
 assert.deepEqual(inverse.items[0][field],[{...own,color:"green"},peer],field+" independent nested fields");
}
{
 const original={...object("atlas"),schoolDiagram:{paintedCountries:{RU:"red"},title:"Map"}};
 const edited={...original,schoolDiagram:{...original.schoolDiagram,paintedCountries:{RU:"blue"}}};
 const peer={...edited,schoolDiagram:{...edited.schoolDiagram,paintedCountries:{RU:"blue",KZ:"green"}}};
 const undo=applyPersonalBoardEdit([peer],choose([original],[edited]),"undo");
 assert.deepEqual(undo.items[0].schoolDiagram.paintedCountries,{RU:"red",KZ:"green"});
}
for(const kind of ["sticky","text","shape","pen","marker","image","pdf","frame","connector","comment","table","formula","graph","fraction","checklist","quiz","flashcard","cover","linkmedia","instrument"]){
 const original={...object("object-"+kind),kind},moved={...original,x:99},peer=object("peer-"+kind);
 const op=choose([original],[moved]);
 const undo=applyPersonalBoardEdit([{...moved,text:"peer-edit"},peer],op,"undo");
 assert.deepEqual(undo.items,[{...original,text:"peer-edit"},peer],kind+" undo preserves peer field");
 const redo=applyPersonalBoardEdit(undo.items,op,"redo");
 assert.deepEqual(redo.items,[{...moved,text:"peer-edit"},peer],kind+" redo preserves peer field");
}

// Historical stickers may omit stickerInk before the first local stroke.
{
 const blank={...object("legacy-sticker"),kind:"sticky"};
 const a={id:"my-first",points:[{x:1,y:2}]},b={id:"peer-first",points:[{x:5,y:6}]};
 const op=choose([blank],[{...blank,stickerInk:[a]}]);
 const undo=applyPersonalBoardEdit([{...blank,stickerInk:[a,b]}],op,"undo");
 assert.deepEqual(undo.items,[{...blank,stickerInk:[b]}]);
 assert.deepEqual(applyPersonalBoardEdit(undo.items,op,"redo").items,[{...blank,stickerInk:[b,a]}]);
 assert.deepEqual(applyPersonalBoardEdit([{...blank,stickerInk:[a]}],op,"undo").items,[blank]);
}


// Round-trip through the real board parser, not a synthetic identical object.
const model={};
new Function("exports",ts.transpileModule(fs.readFileSync("src/boardModel.ts","utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(model);
const roundTrip=item=>model.parseDocument(JSON.stringify({version:1,title:"",view:{x:0,y:0,zoom:1},items:[item]})).items[0];
const canonical=item=>({...item,...roundTrip(item)});
{
 const ink={...model.stroke("roundtrip-ink","pen",[{x:0,y:0},{x:100,y:4}],"#123456",2),createdBy:"teacher"};
 const roundtrip=roundTrip(ink);
 assert.notEqual(JSON.stringify(ink),JSON.stringify(roundtrip),"Parser changes key order");
 const operation=choose([],[ink]);
 const undo=applyPersonalBoardEdit([roundtrip,peer],operation,"undo",canonical);
 assert.deepEqual(undo.items,[peer]);
 const redo=applyPersonalBoardEdit(undo.items,operation,"redo",canonical);
 assert.deepEqual(redo.items,[peer,ink]);
 const edited={...roundtrip,points:roundtrip.points.map((p,i)=>i===0?{...p,x:p.x+1}:p)};
 assert.equal(applyPersonalBoardEdit([edited,peer],operation,"undo",canonical).changed,false,"Peer geometry changes still prevent deletion");
}
const fixtures={
 table:{tableRows:1,tableCols:1,tableCells:["cell"]},
 checklist:{checklistItems:["task"],checklistDone:[false]},
 quiz:{quizOptions:["A","B"],quizCorrect:0},
 fraction:{fractionNumerator:1,fractionDenominator:2},
 connector:{connectorStart:{x:0,y:0},connectorEnd:{x:100,y:40}},
 image:{assetId:"photo",name:"photo.png",mime:"image/png"},
 pdf:{assetId:"pdf",name:"file.pdf",mime:"application/pdf"},
 instrument:{instrumentType:"ruler",instrumentScale:1},
 linkmedia:{mediaUrl:"https://example.test/video"},
 pen:{points:[{x:0,y:0},{x:10,y:1}],weight:2,color:"#123456"},
 marker:{points:[{x:0,y:0},{x:10,y:1}],weight:12,color:"#123456"},
};
for(const kind of ["text","sticky","shape","frame","table","checklist","quiz","flashcard","cover","comment","fraction","connector","image","pdf","instrument","linkmedia","graph","formula","pen","marker"]){
 const original={...object("canonical-"+kind),kind,...fixtures[kind]};
 const normalized=roundTrip(original);
 const operation=choose([],[original]);
 assert.deepEqual(applyPersonalBoardEdit([normalized,peer],operation,"undo",canonical).items,[peer],kind+" server defaults do not block undo");
 const moved={...original,x:24};
 const undo=applyPersonalBoardEdit([roundTrip(moved),peer],choose([original],[moved]),"undo",canonical);
 assert.equal(undo.items[0].x,original.x);
 assert.equal(undo.items[1],peer);
}
assert.match(board,/\(isStudent&&!isBoardOwner&&blockedStudentObjectEdits\(itemsRef\.current,restored\.items,authUser\.id\)\.length\)/,
 "Teacher inverse operations must not use the student-only gate");

// A text gesture must survive a checkpoint and an unrelated peer revision.
{
 const {beginTextEdit,updateTextEdit,rebaseTextEdit}=exports;
 let session=updateTextEdit(beginTextEdit("text","old"),"typed");
 session=rebaseTextEdit(session,"typed","typed","typed");
 assert.deepEqual(session,{id:"text",before:"old",draft:"typed",changed:true});
 // Peer overwrote an acknowledged edit: future typing must undo to peer.
 session=rebaseTextEdit(session,"typed","peer","peer");
 assert.deepEqual(session,{id:"text",before:"peer",draft:"peer",changed:false});
 session=updateTextEdit(session,"new local");
 session=rebaseTextEdit(session,"peer","second peer","new local");
 assert.deepEqual(session,{id:"text",before:"second peer",draft:"new local",changed:true});
 assert.match(board,/historyBaseline:undefined|\{historyBaseline\}/);
 assert.match(board,/rebaseTextEdit\(session,previousText,remoteEdited.text,edited.text\)/);
}

{
 const graph={...object("assignment"),kind:"graph",schoolDiagram:{kind:"sentence-builder",parts:[{id:"a",text:"I"},{id:"b",text:"read"}],answerOrder:["a","b"],answerChecked:true}};
 const edited={...graph,schoolDiagram:{...graph.schoolDiagram,answerOrder:["b","a"],answerChecked:false}};
 const operation=choose([graph],[edited]);
 const peerCheck={...edited,schoolDiagram:{...edited.schoolDiagram,answerChecked:true}};
 assert.equal(applyPersonalBoardEdit([peerCheck],operation,"undo").changed,false,"Undo cannot split a peer's checked answer and word order");
 const replacement={...edited,schoolDiagram:{...edited.schoolDiagram,parts:[{id:"a",text:"We"},{id:"b",text:"write"}]}};
 assert.equal(applyPersonalBoardEdit([replacement],operation,"undo").changed,false,"Undo cannot modify a replacement sentence");
 assert.deepEqual(applyPersonalBoardEdit([{...edited,x:30}],operation,"undo").items,[{...graph,x:30}]);
 const spelling={...graph,schoolDiagram:{kind:"orthography",questions:[{id:"a",prompt:"л□с"}],response:{index:0,picked:0,checked:false}}};
 const checked={...spelling,schoolDiagram:{...spelling.schoolDiagram,response:{index:0,picked:0,checked:true}}};
 const later={...checked,schoolDiagram:{...checked.schoolDiagram,response:{index:0,picked:1,checked:true}}};
 assert.equal(applyPersonalBoardEdit([later],choose([spelling],[checked]),"undo").changed,false,"Undo must not uncheck a peer's replacement answer");
 const number={...graph,schoolDiagram:{kind:"place-value",base:2,digits:""}};
 const answered={...number,schoolDiagram:{...number.schoolDiagram,digits:"101"}};
 const changedBase={...answered,schoolDiagram:{kind:"place-value",base:10,digits:"101"}};
 assert.equal(applyPersonalBoardEdit([changedBase],choose([number],[answered]),"undo").changed,false);
 const syntax={...graph,schoolDiagram:{kind:"syntax",words:[{id:"a",text:"Мама",role:"none"},{id:"b",text:"читает",role:"none"}]}};
 const marked={...syntax,schoolDiagram:{...syntax.schoolDiagram,words:[{...syntax.schoolDiagram.words[0],role:"subject"},syntax.schoolDiagram.words[1]]}};
 const peerMark={...marked,schoolDiagram:{...marked.schoolDiagram,words:[marked.schoolDiagram.words[0],{...marked.schoolDiagram.words[1],role:"predicate"}]}};
 const reverted=applyPersonalBoardEdit([peerMark],choose([syntax],[marked]),"undo");
 assert.equal(reverted.items[0].schoolDiagram.words[0].role,"none");
 assert.equal(reverted.items[0].schoolDiagram.words[1].role,"predicate");
 const newSentence={...marked,schoolDiagram:{...marked.schoolDiagram,words:[{id:"a",text:"Папа",role:"subject"},syntax.schoolDiagram.words[1]]}};
 assert.equal(applyPersonalBoardEdit([newSentence],choose([syntax],[marked]),"undo").changed,false);
}

{
 const task={id:"q",kind:"task",format:"interactive",activity:{mode:"choice",options:["one","two"]},activityResponse:{selected:0,checked:false}};
 const before={...object("worksheet"),kind:"graph",subjectBoardEntries:[task]};
 const after={...before,subjectBoardEntries:[{...task,activityResponse:{selected:1,checked:false}}]};
 const peerCheck={...after,subjectBoardEntries:[{...after.subjectBoardEntries[0],activityResponse:{selected:1,checked:true}}]};
 assert.equal(applyPersonalBoardEdit([peerCheck],choose([before],[after]),"undo").changed,false,"Undo cannot split a checked peer answer");
 const replacement={...after,subjectBoardEntries:[{...after.subjectBoardEntries[0],activity:{mode:"choice",options:["three","four"]}}]};
 assert.equal(applyPersonalBoardEdit([replacement],choose([before],[after]),"undo").changed,false,"Old answer cannot undo into new task");
}

{
 const task={id:"q",kind:"task",subject:"languages",format:"grammar",prompt:"Transform",details:{material:"I read"},answer:""};
 const before={...object("language"),kind:"graph",subjectBoardEntries:[task]};
 const after={...before,subjectBoardEntries:[{...task,answer:"I read yesterday"}]};
 const replacement={...after,subjectBoardEntries:[{...after.subjectBoardEntries[0],details:{material:"She writes"}}]};
 assert.equal(applyPersonalBoardEdit([replacement],choose([before],[after]),"undo").changed,false,"Written answer undo cannot cross replacement text");
 const withSolution={...after,subjectBoardEntries:[{...after.subjectBoardEntries[0],workedSolution:{given:"peer"}}]};
 const undo=applyPersonalBoardEdit([withSolution],choose([before],[after]),"undo");
 assert.equal(undo.items[0].subjectBoardEntries[0].answer,"");
 assert.deepEqual(undo.items[0].subjectBoardEntries[0].workedSolution,{given:"peer"});
}

{
 const undo=exports.undoCollaborativeValue;
 const before={contourMarks:[{id:"a",lon:10,lat:20}],contourStrokes:[],paintedCountries:{}};
 const after={...before,contourMarks:[{id:"a",lon:11,lat:20}]};
 const peer={...after,contourMarks:[{id:"a",lon:12,lat:25},{id:"b",lon:20,lat:30}]};
 assert.deepEqual(undo(after,before,peer),peer,"Contour undo must preserve peer's subsequent move");
 const independent={...after,contourMarks:[{id:"a",lon:11,lat:25},{id:"b",lon:20,lat:30}]};
 assert.deepEqual(undo(after,before,independent).contourMarks,[{id:"a",lon:10,lat:25},{id:"b",lon:20,lat:30}]);
 const erased={...after,contourMarks:[]};
 assert.deepEqual(undo(after,before,erased),erased,"Undo must not resurrect a deleted mark");
}
