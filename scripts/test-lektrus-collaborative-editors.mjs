import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import ts from "typescript";

const read=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
const helperSource=read("src/lektrusLiveEditorMerge.ts");
const compiled=ts.transpileModule(helperSource,{compilerOptions:{
 target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS
}});
const exports={};
new Function("exports","require",compiled.outputText)(exports,()=>({}));
const {mergeEditedValue,editorDiff,applyEditorOps}=exports;

// A live edit may come back from the board while a second point is being
// added. Same-coordinate points from different authors remain distinct.
{
const p1={id:"point-1",x:1,y:2,label:""};
const p2={id:"point-2",x:1,y:2,label:""};
const p3={id:"point-3",x:0,y:4,label:""};
const blank={figureId:"physics-motion",points:[],title:"График"};
const first={...blank,points:[p1]};
assert.deepEqual(mergeEditedValue(blank,first,{...first,title:"Другой заголовок"}).points,[p1]);
assert.deepEqual(mergeEditedValue(blank,{...first,points:[p3,p1]},first).points,[p1,p3]);
const peers=mergeEditedValue(blank,first,{...blank,points:[p2]});
assert.equal(peers.points.length,2);
assert.deepEqual(mergeEditedValue(first,blank,peers).points,[p2]);
const oldGraph={id:"graph",graphPoints:[{x:1,y:2,label:""}]};
const upgraded=exports.withMotionPointIds(oldGraph);
const nextGraph={...upgraded,graphPoints:[p3,...upgraded.graphPoints]};
assert.deepEqual(applyEditorOps(oldGraph,editorDiff(oldGraph,nextGraph)),nextGraph);
const update={...nextGraph,graphPoints:[...nextGraph.graphPoints,p2]};
const packet=editorDiff(nextGraph,update);
assert.deepEqual(applyEditorOps(applyEditorOps(nextGraph,packet),packet),update);
}

const graph={graphPurpose:"geometry",
 graphPoints:[{x:0,y:0,label:"A"},{x:3,y:4,label:"B"}],
 graphSegments:[],graphPolygons:[],graphGrid:true};
const teacher={...graph,graphPoints:[{...graph.graphPoints[0],x:9},graph.graphPoints[1]]};
const student={...graph,graphPoints:[graph.graphPoints[0],{...graph.graphPoints[1],y:8}]};
const merged=mergeEditedValue(graph,teacher,student);
assert.equal(merged.graphPoints[0].x,9,"one editor's point A move retained");
assert.equal(merged.graphPoints[1].y,8,"other editor's point B move retained");

// If two users add a vertex at the same time, rebase any new
// segment/polygon references to the vertex's final merged index.
const original={...graph,graphPoints:[...graph.graphPoints],graphSegments:[]};
const localAdd={...original,
 graphPoints:[...original.graphPoints,{x:5,y:6,label:"C"}],
 graphSegments:[{a:0,b:2,kind:"segment",label:"AC"}]};
const remoteAdd={...original,
 graphPoints:[...original.graphPoints,{x:7,y:8,label:"C"}],
 graphSegments:[{a:1,b:2,kind:"segment",label:"BC"}]};
const combined=mergeEditedValue(original,localAdd,remoteAdd);
assert.equal(combined.graphPoints.length,4,"both appended vertices survive");
assert.equal(new Set(combined.graphPoints.map(p=>p.label)).size,4,"vertex names stay unique");
assert.deepEqual(combined.graphSegments.map(s=>[s.a,s.b]),[[1,2],[0,3]],
 "new vertex references are rebased instead of attaching to the wrong point");

// A received checkpoint can already contain one of our newly appended
// points. Rebase the remaining references to their actual merged indices.
{
 const shared={x:5,y:6,label:"C"};
 const remoteOnly={x:7,y:8,label:"D"};
 const localOnly={x:9,y:10,label:"E"};
 const local={...original,graphPoints:[...original.graphPoints,shared,localOnly],
  graphSegments:[{a:2,b:3,kind:"segment"}]};
 const remote={...original,graphPoints:[...original.graphPoints,shared,remoteOnly]};
 const result=mergeEditedValue(original,local,remote);
 assert.deepEqual(result.graphPoints,[...original.graphPoints,shared,remoteOnly,localOnly]);
 assert.deepEqual(result.graphSegments.map(s=>[s.a,s.b]),[[2,4]]);
 // Also reserve labels assigned to earlier local vertices while rebasing.
 const duplicateLabels={...original,graphPoints:[...original.graphPoints,
  {x:11,y:12,label:"D"},{x:13,y:14,label:"E"}]};
 const labels=mergeEditedValue(original,duplicateLabels,remote).graphPoints.map(p=>p.label);
 assert.equal(new Set(labels).size,labels.length);
}

const atlas={schoolDiagram:{kind:"atlas",contourMarks:[{id:"one",lon:1,lat:2,label:"Старая"}],
 contourStrokes:[],paintedCountries:{"RU":"#eeeeee"},contourTask:"Задание"}};
const first={schoolDiagram:{...atlas.schoolDiagram,
 contourMarks:[...atlas.schoolDiagram.contourMarks,{id:"two",lon:4,lat:5,label:"A"}],
 paintedCountries:{"RU":"#eeeeee","KZ":"#cccccc"}}};
const second={schoolDiagram:{...atlas.schoolDiagram,
 contourMarks:[...atlas.schoolDiagram.contourMarks,{id:"three",lon:8,lat:9,label:"B"}],
 paintedCountries:{"RU":"#aaaaaa"}}};
const both=mergeEditedValue(atlas,first,second);
assert.deepEqual(both.schoolDiagram.contourMarks.map(mark=>mark.id),["one","three","two"]);
assert.equal(both.schoolDiagram.paintedCountries.RU,"#aaaaaa");
assert.equal(both.schoolDiagram.paintedCountries.KZ,"#cccccc");
assert.equal(both.schoolDiagram.contourTask,"Задание");

const diff=editorDiff(atlas,first);
assert.ok(diff.some(op=>op.kind==="upsert-id"&&op.id==="two"));
const preview=applyEditorOps(second,diff);
assert.deepEqual(preview.schoolDiagram.contourMarks.map(m=>m.id),["one","three","two"]);
assert.equal(preview.schoolDiagram.paintedCountries.KZ,"#cccccc");

// Contour Undo uses the real AtlasDocument field names. An old wrapper
// named marks/strokes/fills reverted entire arrays and deleted peer edits.
const actionBefore={contourMarks:[{id:"old",lon:1,lat:2,text:"old"}],
 contourStrokes:[],paintedCountries:{RU:"#aaaaaa"}};
const actionAfter={...actionBefore,contourMarks:[
 ...actionBefore.contourMarks,{id:"mine",lon:3,lat:4,text:"mine"}]};
const withPeer={...actionAfter,contourMarks:[
 ...actionAfter.contourMarks,{id:"peer",lon:5,lat:6,text:"peer"}],
 paintedCountries:{RU:"#aaaaaa",KZ:"#bbbbbb"}};
const undone=mergeEditedValue(actionAfter,actionBefore,withPeer);
assert.deepEqual(undone.contourMarks.map(mark=>mark.id),["old","peer"],
 "undo removes only the locally added mark, leaving a newer peer mark intact");
assert.equal(undone.paintedCountries.KZ,"#bbbbbb","peer fill is not reverted");

// Undo a local stroke erasure while a remote student draws another stroke.
const savedStroke={id:"saved",points:[[0,0],[1,1]],color:"#123456"};
const myStroke={id:"mine",points:[[2,2],[3,3]],color:"#111111"};
const peerStroke={id:"peer",points:[[4,4],[5,5]],color:"#222222"};
const eraseBefore={contourMarks:[],contourStrokes:[savedStroke,myStroke],
 paintedCountries:{}};
const eraseAfter={...eraseBefore,contourStrokes:[savedStroke]};
const remoteStrokes={...eraseAfter,contourStrokes:[savedStroke,peerStroke]};
const undoErasure=mergeEditedValue(eraseAfter,eraseBefore,remoteStrokes);
assert.deepEqual(new Set(undoErasure.contourStrokes.map(s=>s.id)),
 new Set(["saved","mine","peer"]),"undo restores erased stroke without wiping peer stroke");

// Remote changes to another property of the same mark survive a local undo.
const moveBefore={contourMarks:[{id:"one",lon:1,lat:2,text:"old"}]};
const moveAfter={contourMarks:[{id:"one",lon:10,lat:2,text:"old"}]};
const remoteLabel={contourMarks:[{id:"one",lon:10,lat:2,text:"updated by peer"}]};
const undoMove=mergeEditedValue(moveAfter,moveBefore,remoteLabel);
assert.equal(undoMove.contourMarks[0].lon,1);
assert.equal(undoMove.contourMarks[0].text,"updated by peer");

// Independent fill changes rebase by country, not by whole map snapshots.
const paintBefore={paintedCountries:{RU:"#aaaaaa"}};
const paintAfter={paintedCountries:{RU:"#222222"}};
const peerPaint={paintedCountries:{RU:"#222222",KZ:"#bbbbbb"}};
assert.deepEqual(mergeEditedValue(paintAfter,paintBefore,peerPaint),{
 paintedCountries:{RU:"#aaaaaa",KZ:"#bbbbbb"}
});

const editMarker={schoolDiagram:{...atlas.schoolDiagram,
 contourMarks:[{...atlas.schoolDiagram.contourMarks[0],lon:20}]}};
const otherMarker={schoolDiagram:{...atlas.schoolDiagram,
 contourMarks:[{...atlas.schoolDiagram.contourMarks[0],label:"Новое"}]}};
const mergedMark=mergeEditedValue(atlas,editMarker,otherMarker);
assert.equal(mergedMark.schoolDiagram.contourMarks[0].lon,20);
assert.equal(mergedMark.schoolDiagram.contourMarks[0].label,"Новое");
const patchedMark=applyEditorOps(otherMarker,editorDiff(atlas,editMarker));
assert.equal(patchedMark.schoolDiagram.contourMarks[0].lon,20);
assert.equal(patchedMark.schoolDiagram.contourMarks[0].label,"Новое");

const app=read("src/BoardApp.tsx");
const school=read("src/LektrusSchoolDiagramEditor.tsx");
const ws=read("src/boardWorkSync.ts");
const atlasMap=read("src/LektrusMapAtlas.tsx");
assert.match(atlasMap,/mergeEditedValue\(after,last.before,currentContour\(\)\)/,
 "contour undo rebases its inverse on the latest shared markings");
assert.match(atlasMap,/contourMarks:typeof contourMarks;contourStrokes:typeof contourStrokes/,
 "undo wrapper must preserve canonical ID-collection names");
assert.match(atlasMap,/contourMarks:restored\.contourMarks/,
 "undo publishes the ID-preserving merged contour marks");
assert.match(atlasMap,/contourStrokes:restored\.contourStrokes/,
 "undo publishes the ID-preserving merged contour strokes");
for(const [path,body] of [["src/BoardApp.tsx",app],["src/LektrusSchoolDiagramEditor.tsx",school],["src/boardWorkSync.ts",ws]]){
 const parsed=ts.createSourceFile(path,body,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
 assert.equal(parsed.parseDiagnostics.length,0,path+" parses as TSX");
}
assert.match(app,/onChange=\{changeLiveGraphDraft\}/,"geometry editor publishes edits live");
assert.match(app,/onLiveChange=\{\(before,next\)=>\{/,"contour editor publishes edits live");
assert.match(school,/const live=existing&&isContour/,"existing contour editor uses shared model");
assert.match(app,/item=\{remoteLiveItems\[schoolEditorItem.id\]/,"contour editor receives optimistic updates");
assert.match(app,/workChannel\.current\?\.publishEdit/,"live mutations broadcast without waiting for full save");
assert.match(ws,/message\.payload\?\.event === "editor_mutation"/,"editor mutations received");
assert.match(app,/remoteLiveBases/,"untrusted fast previews are kept separate from durable state");
assert.match(app,/const merged=mergeBoardDocumentEdits\(acknowledgedBoardData\.current,local,remote\)/,
 "server conflicts rebase unsaved local changes against the last acknowledged version");
assert.match(app,/if\(pendingEditorBases\.current\.has\(item\.id\)\)pendingEditorBases\.current\.set\(item\.id,item\)/,
 "server conflict refreshes pending editor bases from the latest remote item");
assert.match(app,/remoteEditor&&!\(\(item.kind==="graph"/,"common editors do not acquire exclusive UI locks");
console.log("Lektrus collaborative editor merges, previews, and event wiring: checks passed.");

// Undefined values must serialize as valid remove operations; otherwise the
// server rejects the entire batch, including unrelated changed labels.
{
 const changes=editorDiff({text:"old",quizSelected:1},{text:"new",quizSelected:undefined});
 const wire=JSON.parse(JSON.stringify(changes));
 assert.ok(wire.some(op=>op.kind==="remove"&&op.path[0]==="quizSelected"));
 assert.equal(applyEditorOps({text:"old",quizSelected:1},wire).text,"new");
 assert.equal(applyEditorOps({text:"old",quizSelected:1},wire).quizSelected,undefined);
}

// Verify ordinary content, labels, settings and subject data use the same delta path.
{
 const compiled=ts.transpileModule(read("src/boardLiveObjectEdits.ts"),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}});
 const live={};new Function("exports","require",compiled.outputText)(live,()=>exports);
 const samples=[["text","text","hello"],["sticky","text","note"],["shape","color","#ff0000"],["frame","text","frame"],["connector","text","label"],["comment","text","comment"],["table","tableCells",["a","b"]],["formula","text","x+1"],["graph","graphPoints",[{id:"p",x:1,y:2,label:"A"}]],["fraction","fractionNumerator",2],["checklist","checklistItems",["task"]],["quiz","quizExplanation","answer"],["flashcard","flashcardBack","back"],["cover","coverOpacity",0.4],["linkmedia","mediaTitle","video"],["image","imageCrop",{x:0,y:0,width:1,height:1}],["pdf","pdfPage",2],["instrument","rotation",35]];
 for(const [kind,key,value] of samples){const before={id:"item",kind,x:0,y:0,width:100,height:100,text:""};const after={...before,[key]:value};for(const fn of [live.boardObjectLiveOps,live.boardDraftLiveOps]){const ops=JSON.parse(JSON.stringify(fn(before,after)));assert.deepEqual(applyEditorOps(before,ops)[key],value,kind+" "+key);}}
 assert.equal(live.boardObjectLiveOps({id:"p",kind:"pen",x:0},{id:"p",kind:"pen",x:1}).length,0);
 assert.equal(live.isLiveBoardObjectField("ownerId"),false);
 console.log("Live object field coverage: "+samples.length+" object families");
}

{
 const compiled=ts.transpileModule(read("src/boardLiveObjectEdits.ts"),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}});
 const live={};new Function("exports","require",compiled.outputText)(live,()=>exports);
 const stored={id:"text",kind:"text",x:120,y:80,width:240,height:90,rotation:45,text:"original"};
 const delayed={...stored,x:0,y:0,width:100,height:20,rotation:0,text:"new text"};
 assert.deepEqual(live.boardLiveContent(stored,delayed),{...stored,text:"new text",connectorStart:undefined,connectorEnd:undefined});
}

// Delayed edits cannot resurrect deleted ID-based editor elements.
for(const key of ["contourMarks","contourStrokes","bodies","supports","forces",
 "components","junctions","wires","elements","rays","vessels","placedDevices","graphPoints","stickerInk"]){
 const old={id:"old",x:1},changed={...old,x:2},fresh={id:"fresh",x:3};
 const original={[key]:[old]};
 const ops=JSON.parse(JSON.stringify(editorDiff(original,{[key]:[changed,fresh]})));
 assert.deepEqual(applyEditorOps({[key]:[]},ops),{[key]:[fresh]},key+" stale update versus genuine creation");
}
{
 const before={tableCells:Array.from({length:301},()=>0)};
 const after={tableCells:Array.from({length:301},()=>1)};
 assert.deepEqual(editorDiff(before,after),[],"Never send only the first 300 cells of an atomic edit");
 assert.equal(editorDiff({tableCells:[0]},{tableCells:[1]}).length,1);
 let a=0,b=1;for(let i=0;i<20;i++){a={nested:a};b={nested:b};}
 assert.deepEqual(editorDiff({deep:a,text:"old"},{deep:b,text:"new"}),[],
  "A deep partial edit must fall back to the complete durable revision");
}


// Execute the self-hosted work-channel batching logic with a controlled socket.
{
 const work={};
 let status,receive,revision=7;
 const frames=[],received=[];
 const channel=Object.assign(()=>{}, {sendEvent:frame=>{frames.push(frame);return true}});
 const mock={isSelfhostBackendEnabled:()=>true,selfhostSubscribeBoard:(_board,_revision,onStatus,onEvent)=>{
  status=onStatus;receive=onEvent;return channel;
 }};
 const compiled=ts.transpileModule(ws,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}});
 new Function("exports","require",compiled.outputText)(work,name=>name==="./selfhostApi"?mock:{});
 const connection=work.connectBoardWorkChannel("board",{userId:"me",name:"Me",role:"owner"},()=>{},()=>{},true,m=>received.push(m),undefined,()=>revision);
 try{
  status("online");
  const ops=(n,start)=>Array.from({length:n},(_,i)=>({path:["tableCells",start+i],kind:"set",value:"cell-"+i}));
  connection.publishEdit("table",ops(1,0));
  connection.publishEdit("table",ops(180,1));
  connection.publishEdit("table",ops(150,181));
  revision=8;
  connection.publishEdit("table",ops(2,400));
  await new Promise(resolve=>setTimeout(resolve,220));
  const edits=frames.filter(f=>f.type==="editor_mutation");
  assert.deepEqual(edits.map(f=>[f.base_version,f.ops.length]),[[7,1],[7,180],[7,150],[8,2]],
   "Complete editor packets must never be split at 300 operations or combined across revisions");
  receive({type:"editor_mutation",id:"peer:1",item_id:"table",client_id:"peer",user_id:"other",base_version:7,ops:ops(1,0)});
  assert.equal(received[0].baseVersion,7);
  assert.match(app,/mutation\.baseVersion!==undefined&&mutation\.baseVersion!==\(remoteVersion\.current\?\?0\)/);
 }finally{connection.close()}
}

{
 const compiled=ts.transpileModule(read("src/boardLiveObjectEdits.ts"),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}});
 const live={};new Function("exports","require",compiled.outputText)(live,()=>exports);
 const base={id:"table",kind:"table",x:1,y:2,width:100,height:50,text:"",tableCells:["old","B"],tableHeader:true};
 const draft={...base,tableCells:["edited","B"],tableHeader:false};
 const peer={...base,x:99};
 const next={...peer,tableCells:["edited","second"],tableHeader:false};
 const ops=live.boardModalDraftOps(peer,draft,next,["tableCells","tableHeader"]);
 assert.deepEqual(applyEditorOps(peer,ops),next,"New revision receives every unsaved field, not only latest input");
 assert.deepEqual(applyEditorOps(next,ops),next,"Repeating draft is idempotent");
 const reset={...next,tableHeader:true};
 assert.deepEqual(applyEditorOps(next,live.boardModalDraftOps(peer,next,reset,["tableCells","tableHeader"])),reset,"Reverted fields reset preview");
 // The receiver missed the reset packet while another field remained dirty.
 const refresh=live.boardModalDraftOps(peer,undefined,reset,["tableCells","tableHeader","fontSize"],["tableCells","tableHeader"]);
 assert.deepEqual(applyEditorOps(next,refresh),reset,"Periodic refresh repairs a lost reset even when it equals the committed value");
 assert.ok(!refresh.some(op=>op.path[0]==="fontSize"),"Never reset untouched modal fields");
 const rollback=live.boardModalDraftOps(peer,reset,peer,["tableCells","tableHeader"],["tableCells","tableHeader"]);
 assert.deepEqual(applyEditorOps(next,rollback),peer,"Closing a modal repairs a previously missed reset");
 const withOptional={...peer,fontSize:18};
 const remove=live.boardModalDraftOps(peer,undefined,peer,["fontSize"],["fontSize"]);
 const cleared=applyEditorOps(withOptional,remove);
 assert.equal(cleared.fontSize,undefined,"Previously published optional fields can be explicitly cleared");
 assert.deepEqual(JSON.parse(JSON.stringify(cleared)),peer,"A cleared optional field is absent on the document wire");
 assert.match(app,/boardModalDraftOps\(stored,undefined,mergeModalPatch\(stored,patch\),fields,\[\.\.\.lastModalLiveTouched\.current\]\)/);
}
{
 const work={};let status,failures=2;const frames=[];
 const channel=Object.assign(()=>{},{sendEvent:frame=>{
  if(failures>0){failures--;return false;}
  frames.push(frame);return true;
 }});
 const mock={isSelfhostBackendEnabled:()=>true,selfhostSubscribeBoard:(_b,_r,onStatus)=>{status=onStatus;return channel;}};
 const compiled=ts.transpileModule(ws,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}});
 new Function("exports","require",compiled.outputText)(work,name=>name==="./selfhostApi"?mock:{});
 const connection=work.connectBoardWorkChannel("board",{userId:"me",name:"Me",role:"owner"},()=>{},()=>{},true,undefined,undefined,()=>8);
 try{
  status("online");
  connection.publishEdit("item",[{path:["text"],kind:"set",value:"new"}]);
  await new Promise(resolve=>setTimeout(resolve,650));
  assert.equal(frames.filter(f=>f.type==="editor_mutation").length,1,"Failed transport send retries whole edit packet");
  assert.equal(frames.filter(f=>f.type==="work_state").length,1,"Failed transport send retries work state");
 }finally{connection.close()}
}

// Stale toolbar props cannot clone deleted, locked or replaced PDF assets.
{
 const pdf={};
 new Function("exports",ts.transpileModule(read("src/boardPdfActions.ts"),{
  compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}
 }).outputText)(pdf);
 const item={id:"pdf",kind:"pdf",assetId:"asset",pdfPage:1,x:0,y:0};
 const latest={...item,pdfPage:3,x:25};
 assert.equal(pdf.resolvePdfAction([latest],item,true,8),latest);
 assert.equal(pdf.nextPdfPage(latest.pdfPage+1,8),4);
 assert.equal(pdf.resolvePdfAction([],item,true,8),undefined);
 assert.equal(pdf.resolvePdfAction([{...latest,locked:true}],item,true,8),undefined);
 assert.equal(pdf.resolvePdfAction([{...latest,assetId:"replacement"}],item,true,8),undefined);
 assert.equal(pdf.resolvePdfAction([latest],item,false,8),undefined);
 assert.equal(pdf.resolvePdfAction([latest],item,true,null),undefined);
 assert.equal(pdf.resolvePdfAction([latest],item,true,0),undefined);
}

// Durable rebase of a queued answer must not attach it to a new assignment.
{
 const base={kind:"sentence-builder",title:"Sentence",parts:[{id:"a",text:"I"},{id:"b",text:"read"}],answerOrder:["a","b"],answerChecked:true};
 const local={...base,answerOrder:["b","a"],answerChecked:false};
 const replacement={kind:"sentence-builder",title:"New",parts:[{id:"a",text:"We"},{id:"b",text:"write"}]};
 assert.deepEqual(mergeEditedValue(base,local,replacement),replacement,"Stale sentence answer cannot cross source changes");
 assert.deepEqual(mergeEditedValue(base,replacement,local),replacement,"Teacher source replacement clears concurrent old answers");
 const check={...base,answerChecked:false};
 const reorder={...base,answerOrder:["b","a"]};
 assert.deepEqual(mergeEditedValue(base,check,reorder),check,"Check state and order are an atomic pair");
 const whole={id:"graph",x:1,schoolDiagram:base};
 assert.deepEqual(mergeEditedValue(whole,{...whole,schoolDiagram:local},{...whole,x:99,schoolDiagram:replacement}),
  {...whole,x:99,schoolDiagram:replacement},"Board rebase preserves peer placement and replacement source");
 const practice={order:["RU","FR"],matched:["FR"],wrong:0,index:0,revealed:false,known:[],selected:null,feedback:"correct"};
 const geo={kind:"geo-training",title:"Geo",exercise:"matching",relation:"country-capital",reverse:false,countryCodes:["FR","RU"]};
 const answered={...geo,practice};
 for(const newer of [{...geo,reverse:true},{...geo,relation:"flag-country"},{...geo,exercise:"cards"},{...geo,countryCodes:["DE","RU"]}]){
  assert.deepEqual(mergeEditedValue(geo,answered,newer),newer,"Old geography answers never cross replacement assignment");
  assert.deepEqual(mergeEditedValue(geo,newer,answered),newer,"New geography source clears concurrent old response");
 }
 assert.deepEqual(mergeEditedValue(geo,answered,{...geo,title:"Renamed"}),{...answered,title:"Renamed"},"Unrelated rename does not erase responses");
}

for(const [base,source,response] of [
 [{kind:"flashcards",cards:[{id:"a",term:"Hello"}],direction:"foreign-first"},{direction:"russian-first"},{index:0,revealed:true}],
 [{kind:"orthography",questions:[{id:"a",prompt:"л□с",options:["е","и"]}]},{questions:[{id:"a",prompt:"м□р",options:["и","е"]}]},{index:0,picked:0,checked:true}]
]){
 const answered={...base,response},updated={...base,...source};
 assert.deepEqual(mergeEditedValue(base,answered,updated),updated);
 assert.deepEqual(mergeEditedValue(base,updated,answered),updated);
 assert.deepEqual(mergeEditedValue(base,answered,{...base,title:"Rename"}),{...answered,title:"Rename"});
}

{
 const syntax={kind:"syntax",title:"Sentence",showMarks:true,words:[{id:"a",text:"Мама",role:"none"},{id:"b",text:"читает",role:"none"}]};
 const local={...syntax,words:[{...syntax.words[0],role:"subject"},syntax.words[1]]};
 const remote={...syntax,words:[syntax.words[0],{...syntax.words[1],role:"predicate"}]};
 assert.deepEqual(mergeEditedValue(syntax,local,remote).words,[local.words[0],remote.words[1]]);
 const replacement={...syntax,words:[{id:"a",text:"Папа",role:"none"},syntax.words[1]]};
 assert.deepEqual(mergeEditedValue(syntax,local,replacement),replacement,"Stale marks must not annotate a replacement word");
 assert.deepEqual(mergeEditedValue(syntax,replacement,remote).words,[replacement.words[0],remote.words[1]],"Teacher change preserves independent marking of an unchanged word");
 const place={kind:"place-value",title:"Number",base:2,digits:"",showPowers:true};
 const answer={...place,digits:"101"},newBase={...place,base:10,digits:""};
 assert.deepEqual(mergeEditedValue(place,answer,newBase),newBase);
 assert.deepEqual(mergeEditedValue(place,newBase,answer),newBase);
 assert.deepEqual(mergeEditedValue(place,answer,{...place,title:"Rename"}),{...answer,title:"Rename"});
}

{
 const a={id:"a",kind:"task",format:"interactive",activity:{mode:"choice",options:["one","two"],correctIndex:0},answer:""};
 const b={...a,id:"b",title:"B"},c={...a,id:"c",title:"C"};
 const base={subjectBoardEntries:[a,b]},answer={...a,activityResponse:{selected:1,checked:true}};
 const local={subjectBoardEntries:[answer,b]},remote={subjectBoardEntries:[b,c]};
 assert.deepEqual(mergeEditedValue(base,local,remote),remote,"Deleted task cannot be revived by an answer");
 const reordered={subjectBoardEntries:[b,a,c]};
 assert.deepEqual(mergeEditedValue(base,local,reordered),{subjectBoardEntries:[b,answer,c]},"Answer follows stable ID across reorder");
 assert.deepEqual(mergeEditedValue(base,{subjectBoardEntries:[b,a]},local),{subjectBoardEntries:[b,answer]},"Reorder preserves concurrent answers");
 const replacement={...a,activity:{mode:"choice",options:["three","four"],correctIndex:1}};
 assert.deepEqual(mergeEditedValue(base,local,{subjectBoardEntries:[replacement,b]}),{subjectBoardEntries:[replacement,b]});
 assert.deepEqual(mergeEditedValue(base,{subjectBoardEntries:[replacement,b]},local),{subjectBoardEntries:[replacement,b]});
 assert.deepEqual(applyEditorOps({subjectBoardEntries:[replacement,b]},editorDiff(base,local)),{subjectBoardEntries:[replacement,b]},"Delayed preview cannot answer replaced task");
 assert.deepEqual(applyEditorOps(remote,editorDiff(base,local)),remote,"Delayed preview cannot recreate deleted task");
 assert.deepEqual(editorDiff(base,{subjectBoardEntries:[b,a]}),[],"Reorder uses durable revision");
}

{
 const task={id:"language",kind:"task",subject:"languages",format:"grammar",prompt:"Transform",details:{material:"I read.\nWe write.",instruction:"Past"},answer:""};
 const first={...task,answer:"I read yesterday.\n"},second={...task,answer:"\nWe wrote."};
 const combined=mergeEditedValue(task,first,second,"subjectBoardEntries");
 assert.equal(combined.answer,"I read yesterday.\nWe wrote.","Independent written rows survive");
 const revised={...task,details:{...task.details,material:"They play.\nShe walks."}};
 assert.deepEqual(mergeEditedValue(task,first,revised,"subjectBoardEntries"),revised,"Old written response cannot cross changed source");
 assert.deepEqual(mergeEditedValue(task,revised,first,"subjectBoardEntries"),revised,"Teacher replacement clears stale response");
 const renamed={...task,title:"Renamed"};
 assert.equal(mergeEditedValue(task,first,renamed,"subjectBoardEntries").answer,first.answer);
 const reorderedKeys={...task,details:{instruction:"Past",material:task.details.material}};
 assert.equal(mergeEditedValue(task,first,reorderedKeys,"subjectBoardEntries").answer,first.answer,"JSONB key order is not source replacement");
 const ru={id:"r",kind:"task",subject:"russian",format:"syntax",prompt:"Mark",details:{material:"Мама читает"},answer:""};
 const marked={...ru,russianWork:{source:"Мама читает",syntaxRoles:["subject","none"]}};
 const changed={...ru,details:{material:"Папа пишет"}};
 assert.deepEqual(mergeEditedValue(ru,marked,changed,"subjectBoardEntries"),changed);
 assert.deepEqual(mergeEditedValue(ru,changed,marked,"subjectBoardEntries"),changed);
 const math={id:"m",kind:"task",format:"problem",prompt:"2+3",details:{},answer:""};
 const given={...math,workedSolution:{given:"2 and 3"}},work={...math,workedSolution:{work:"2+3=5"}};
 assert.deepEqual(mergeEditedValue(math,given,work,"subjectBoardEntries").workedSolution,{work:"2+3=5",given:"2 and 3"});
 assert.equal(mergeEditedValue(math,{...math,prompt:"3+4"},work,"subjectBoardEntries").workedSolution,undefined);
}
