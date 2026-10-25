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

const app=read("src/App.tsx");
const school=read("src/LektrusSchoolDiagramEditor.tsx");
const ws=read("src/boardWorkSync.ts");
for(const [path,body] of [["src/App.tsx",app],["src/LektrusSchoolDiagramEditor.tsx",school],["src/boardWorkSync.ts",ws]]){
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
assert.match(app,/pendingEditorBases\.current\.get\(item.id\)/,"server version conflicts rebase field changes");
assert.match(app,/remoteEditor&&!\(\(item.kind==="graph"/,"common editors do not acquire exclusive UI locks");
console.log("Lektrus collaborative editor merges, previews, and event wiring: checks passed.");
