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
assert.match(editor,/data-eraser-mode="partial" aria-pressed=\{value==="partial"\}/,
 "Partial eraser must be a directly selectable, clearly marked mode");
assert.match(editor,/data-eraser-mode="stroke" aria-pressed=\{value==="stroke"\}/,
 "Whole-stroke eraser must be a directly selectable, clearly marked mode");
assert.match(editor,/aria-label="Стирать участок линии"/);
assert.match(editor,/aria-label="Стирать весь штрих одним касанием"/);
assert.match(editor,/className="lektrus-eraser-mode-label" aria-hidden="true">Часть<\/span>/);
assert.match(editor,/className="lektrus-eraser-mode-label" aria-hidden="true">Штрих<\/span>/);
assert.match(editor,/viewBox="0 0 48 32"/, "Each eraser mode has an illustrative icon");

const inkCss=fs.readFileSync("src/lektrusSubjectPolish2026.css","utf8");
assert.match(inkCss,/Every pen-width preset, especially the fifth 22px button/,
 "The maximum pen preset must remain accessible in narrow toolbars");
assert.match(inkCss,/overflow-x:auto;overflow-y:hidden/,
 "A narrow viewport must scroll the whole five-width group, not clip the last choice");
assert.match(inkCss,/\.lektrus-ink-five-widths>\.lektrus-ink-width-button\{/);
assert.match(inkCss,/pointer-events:auto!important/,
 "All five ink thickness buttons must receive pointer and touch events");
const app=fs.readFileSync("src/BoardApp.tsx","utf8");
assert.match(app,/useState<Tool>\(\(\)=>readBoardSessionTool\(boardSummary\.id,authUser\.id\)\)/);
assert.match(app,/writeBoardSessionTool\(boardSummary\.id,authUser\.id,tool\)/);
assert.match(app,/const \[tool, setToolState\] = useState<Tool>/);
assert.match(app,/const setTool: typeof setToolState = useCallback/);
assert.match(app,/const viewerToolRef = useRef\(tool\)/);
assert.match(app,/viewerToolRef\.current=chosen;\s*writeBoardSessionTool\(boardSummary\.id,authUser\.id,chosen\);\s*setToolState\(chosen\)/,
 "The viewer's tool must be stored BEFORE React schedules a UI update");
assert.match(app,/useLayoutEffect\(\(\)=>\{\s*viewerToolRef\.current=tool;\s*writeBoardSessionTool\(boardSummary\.id,authUser\.id,tool\)/,
 "Keep individual tool selection intact on document re-render");
const dockCss=fs.readFileSync("src/lektrusMobileWorkspacePolish.css","utf8");
const style=fs.readFileSync("src/lektrusResponsive.css","utf8");
assert.match(style,/\.lektrus-eraser-mode-check/,"Active eraser must have a checkmark");
assert.match(style,/\.workspace \.lektrus-eraser-modes>button\[aria-pressed="true"\]/);
assert.match(editor,/data-eraser-mode="partial"/);
assert.match(editor,/data-eraser-mode="stroke"/);
assert.equal((app.match(/<LectrisQuickProperties/g)||[]).length,1,
 "There must only be one original bottom ink toolbar");
assert.doesNotMatch(app,/lektrus-ink-settings-direct/,
 "Never render an extra upper ink settings panel");
assert.match(app,/board-ink-dock-open/,"Reserve safe non-canvas footer");
assert.match(dockCss,/\.workspace\.board-ink-dock-open \.board\s*\{\s*bottom:96px!important/);
assert.match(dockCss,/\.workspace\.board-ink-dock-open:has\(\.is-ink-properties\[data-ink-upper-row="true"\]\) \.board/);
assert.match(dockCss,/\.workspace\.board-ink-dock-open \.board\s*\{\s*bottom:145px!important/);
assert.match(dockCss,/\.lectris-quick-properties\.is-ink-properties\s*\{/);
assert.match(editor,/viewBox="0 0 48 32"/);
assert.match(app,/className=\{`app \$\{presentation \? "presentation-mode" : ""\}/);
assert.match(app,/if \(gesture\.current \|\| eraserSession\.current\)/,
 "Remote document changes must defer while local ink is being drawn");
assert.match(app,/if \(decision === "conflict"\)/,
 "Independent remote drawing must merge, not replace local strokes");
console.log("Independent tools PASS: two collaborators and two browser tabs cannot disarm each other, all five pen widths including 22px persist.");
