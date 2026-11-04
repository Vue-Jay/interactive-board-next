import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";

function load(path,mocks={}){
 const src=fs.readFileSync(path,"utf8");
 const js=ts.transpileModule(src,{fileName:path,compilerOptions:{
  module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const result={};
 new Function("exports","require",js)(result,name=>{
  assert.ok(Object.hasOwn(mocks,name),"Unexpected module "+name);
  return mocks[name];
 });
 return result;
}
const storage=()=>{const map=new Map();return {
 getItem:key=>map.get(key)??null,
 setItem:(key,value)=>map.set(key,value),
 removeItem:key=>map.delete(key)}};
globalThis.sessionStorage=storage();
globalThis.localStorage=storage();
const tool=load("src/boardToolSession.ts");
assert.equal(tool.readBoardSessionTool("board-1","teacher"),"select");
tool.writeBoardSessionTool("board-1","teacher","pen");
assert.equal(tool.readBoardSessionTool("board-1","teacher"),"pen");
tool.writeBoardSessionTool("board-1","student","pen");
assert.equal(tool.readBoardSessionTool("board-1","student"),"pen");
tool.writeBoardSessionTool("board-1","student","eraser");
assert.equal(tool.readBoardSessionTool("board-1","teacher"),"pen",
 "Another participant selecting or changing a tool must not disarm teacher ink");
assert.equal(tool.readBoardSessionTool("board-1","student"),"eraser");
assert.equal(tool.readBoardSessionTool("board-2","teacher"),"select");
tool.writeBoardSessionTool("board-1","teacher","marker");
assert.equal(tool.readBoardSessionTool("board-1","student"),"eraser");
assert.equal(tool.normalizeBoardSessionTool("malicious"),"select");
// Session storage is tab-local: another browser does not inherit tool state.
const firstTab=globalThis.sessionStorage;
globalThis.sessionStorage=storage();
assert.equal(tool.readBoardSessionTool("board-1","teacher"),"select");
globalThis.sessionStorage=firstTab;
assert.equal(tool.readBoardSessionTool("board-1","teacher"),"marker");
// Persisted pencil pressure must allow the actual fifth preset: 22px.
const ink=load("src/inkPreferences.ts");
const defaults=ink.DEFAULT_INK_PREFERENCES;
const widths=[1,3,6,12,22];
for(const width of widths){
 const next=ink.withInkSetting(defaults,"pen",{size:width});
 assert.equal(next.pen.size,width,"Pen preset "+width+" must not be clamped");
 ink.writeInkPreferences("teacher",next);
 assert.equal(ink.readInkPreferences("teacher").pen.size,width);
}
assert.equal(ink.normalizeInkPreferences({pen:{color:"#000000",size:100}}).pen.size,22);
assert.equal(ink.normalizeInkPreferences({marker:{color:"#000000",size:100}}).marker.size,48);
const editor=fs.readFileSync("src/LectrisObjectEditor.tsx","utf8");
assert.match(editor,/pen:\[1,3,6,12,22\]/);
assert.match(editor,/onClick=\{\(\)=>updateWidth\(size\)\}/);
const app=fs.readFileSync("src/App.tsx","utf8");
assert.match(app,/useState<Tool>\(\(\)=>readBoardSessionTool\(boardSummary\.id,authUser\.id\)\)/);
assert.match(app,/writeBoardSessionTool\(boardSummary\.id,authUser\.id,tool\)/);
assert.match(app,/const \[tool, setTool\] = useState<Tool>/);
assert.match(app,/if \(gesture\.current \|\| eraserSession\.current\)/,
 "Remote document changes must defer while local ink is being drawn");
assert.match(app,/if \(decision === "conflict"\)/,
 "Independent remote drawing must merge, not replace local strokes");
console.log("Independent tools PASS: two collaborators and two browser tabs cannot disarm each other, all five pen widths including 22px persist.");
