import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import ts from "typescript";

const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const source=read("src/lektrusSelectionCursor.ts");
const compiled=ts.transpileModule(source,{fileName:"lektrusSelectionCursor.ts",
 compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
const pointer=await import("data:text/javascript;base64,"+Buffer.from(compiled).toString("base64"));
const states=["idle","hover","grab","grabbing","marquee",
 "resize-ew","resize-ns","resize-nwse","resize-nesw","rotate"];
assert.deepEqual(Object.keys(pointer.BOARD_SELECTION_CURSORS),states);
assert.equal(pointer.BOARD_SELECTION_CURSOR_SIZE,22,
 "Selection cursors must remain compact, comparable to a native pointer");
const decodeCursor=style=>{
 const match=style.match(/^url\("data:image\/svg\+xml,([^"]+)"\) (\d+) (\d+), /);
 assert.ok(match,"Each cursor must expose an SVG URL and explicit hotspot");
 return {svg:decodeURIComponent(match[1]),x:Number(match[2]),y:Number(match[3])};
};
for(const state of states){
 const {svg,x,y}=decodeCursor(pointer.BOARD_SELECTION_CURSORS[state]);
 assert.match(svg,/<svg [^>]*width="22" height="22" viewBox="0 0 32 32"/);
 assert.doesNotMatch(svg,/stroke="#(?:fff|ffffff|c8dcff)"/i,
  "No white outline should surround the compact "+state+" cursor");
 assert.ok(x>=0&&x<22&&y>=0&&y<22,"Hotspot must fit the compact raster");
}
for(const state of ["idle","hover"]){
 const {svg,x,y}=decodeCursor(pointer.BOARD_SELECTION_CURSORS[state]);
 assert.match(svg,/fill="#ffffff" stroke="#3262c1"/,
  "Both selection arrow states must have white fill and a fine blue border");
 assert.equal((svg.match(/fill="#ffffff"/g)||[]).length,1,
  "The white arrow fill must stay identical in normal and hover states");
 assert.doesNotMatch(svg,/fill="#(?:ccddfa|85a9ed)"/i,
  "Hover must never recolor the arrow body blue");
 if(state==="hover"){
  assert.equal((svg.match(/<path /g)||[]).length,2,
   "Hover adds exactly one outer glow behind the white arrow");
  assert.match(svg,/<path [^>]*fill="none" stroke="#73a6ff" stroke-width="4\.4" stroke-opacity="\.67"/,
   "Hover glow must be blue, semi-transparent and outside the arrow contour");
  assert.ok(svg.indexOf('fill="none"')<svg.indexOf('fill="#ffffff"'),
   "Glow must be behind, not on top of, the white arrow");
 }else{
  assert.equal((svg.match(/<path /g)||[]).length,1,
   "Default arrow must have no outer glow");
  assert.ok(!svg.includes('stroke="#73a6ff"'));
 }
 assert.equal(x,2,"Arrow's pointed hotspot scales with the 22px image");
 assert.equal(y,2);
}
for(const state of ["marquee","rotate","resize-ew","resize-ns","resize-nwse","resize-nesw"]){
 const {x,y}=decodeCursor(pointer.BOARD_SELECTION_CURSORS[state]);
 assert.equal(x,11,"Centered gesture hotspot stays centered when shrinking");
 assert.equal(y,11);
}
for(const state of states){
 const style=pointer.BOARD_SELECTION_CURSORS[state];
 assert.match(style,/^url\("data:image\/svg\+xml,/);
 assert.match(style,/%3Csvg/,"cursor should embed a valid SVG image URL");
 assert.ok(style.includes(")")&&style.includes(", "),"cursor needs a hotspot and native fallback");
}
assert.notEqual(pointer.BOARD_SELECTION_CURSORS.idle,pointer.BOARD_SELECTION_CURSORS.hover,
 "Hover must use a separate accent, without switching to a different pointer silhouette");
assert.notEqual(pointer.BOARD_SELECTION_CURSORS.grab,pointer.BOARD_SELECTION_CURSORS.grabbing);
const handles={n:"resize-ns",s:"resize-ns",e:"resize-ew",w:"resize-ew",
 nw:"resize-nwse",se:"resize-nwse",ne:"resize-nesw",sw:"resize-nesw",rotate:"rotate"};
for(const [handle,state] of Object.entries(handles)){
 assert.equal(pointer.selectionCursorForHandle(handle),state);
 assert.equal(pointer.selectionCursorForGesture(handle==="rotate"?"rotate":"resize",false,handle),state);
}
assert.equal(pointer.selectionCursorForGesture("drag"),"grab");
assert.equal(pointer.selectionCursorForGesture("drag",true),"grabbing");
assert.equal(pointer.selectionCursorForGesture("marquee"),"marquee");
assert.equal(pointer.selectionCursorForGesture("hand-smart",true),"grabbing");
assert.equal(pointer.selectionCursorForGesture("pan"),null);

const dom=(kind,value="")=>({closest(selector){
 if(kind==="handle"&&selector.includes("[data-transform-handle]"))return {dataset:{transformHandle:value}};
 if(kind==="group"&&selector.includes("[data-group-selection-drag]"))return {};
 if(kind==="object"&&selector.includes("[data-object]"))return {};
 if(kind==="button"&&selector.includes("button,input,textarea"))return {};
 return null;
}});
assert.equal(pointer.selectionCursorForTarget(dom("object")),"hover");
assert.equal(pointer.selectionCursorForTarget(dom("handle","rotate")),"rotate");
assert.equal(pointer.selectionCursorForTarget(dom("handle","ne")),"resize-nesw");
assert.equal(pointer.selectionCursorForTarget(dom("group")),"grab");
assert.equal(pointer.selectionCursorForTarget(dom("button")),"idle");
assert.equal(pointer.selectionCursorForTarget(null),"idle");

let sets=0,removes=0;
const style={setProperty(name,value){sets++;this[name]=value;},
 removeProperty(name){removes++;delete this[name];}};
const board={dataset:{},style};
pointer.applyBoardSelectionCursor(board,"idle");
pointer.applyBoardSelectionCursor(board,"idle");
assert.equal(sets,1,"Pointer motion must not continually mutate the DOM or React state");
pointer.applyBoardSelectionCursor(board,"marquee");
assert.equal(sets,2);
assert.equal(board.dataset.selectionCursor,"marquee");
pointer.clearBoardSelectionCursor(board);
assert.equal(removes,1);
assert.equal(board.dataset.selectionCursor,undefined);

const app=read("src/App.tsx"), css=read("src/lektrusSelectionCursor.css");
const entry=read("src/main.tsx");
assert.equal(ts.createSourceFile("App.tsx",app,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX).parseDiagnostics.length,0);
assert.ok(app.includes('if(tool==="select")syncSelectionCursor(e.target,e.pointerType);'));
assert.ok(app.includes('down(e); if(tool==="select")syncSelectionCursor(e.target,e.pointerType);'),
 "Select state changes after actual board gesture setup, not on guesses");
assert.ok(app.includes('selectionCursorForGesture(active.mode,Boolean(active.dragging),active.handle)'));
assert.ok(app.includes('applyBoardSelectionCursor(board.current,"idle")'));
assert.ok(app.includes('clearBoardSelectionCursor(board.current)'));
assert.ok(css.includes('@media (any-pointer:fine)'));
assert.ok(css.includes('.board.board-tool-select'));
assert.ok(css.includes('--lektrus-selection-cursor'));
assert.ok(css.includes(':not(.board-panning)'));
assert.ok(css.includes('cursor:pointer!important'),"Embedded controls must retain native button cursors");
assert.ok(css.includes('cursor:text!important'),"Embedded text inputs must retain their I-beam");
assert.equal((css.match(/{/g)||[]).length,(css.match(/}/g)||[]).length);
assert.ok(entry.indexOf('import "./lektrusSelectionCursor.css"')>entry.indexOf('import "./lektrusLabSceneLayout.css"'),
 "Selection cursors must come last to override legacy transform handle styles");
console.log("Lektrus selection cursor contract: ten distinct SVG states, gesture transitions, handles, hover, controls and low-cost DOM updates OK.");
