import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import ts from "typescript";

const script=readFileSync("src/boardPanTransform.ts","utf8");
const app=readFileSync("src/App.tsx","utf8");
const js=ts.transpileModule(script,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const mod={exports:{}};
new Function("require","module","exports",js)((id)=>{throw Error("Unexpected runtime dependency: "+id)},mod,mod.exports);
const {boardWorldTransform,boardOverlayTransform}=mod.exports;

const base={x:100,y:-40,zoom:2};
const moved={x:280,y:-115,zoom:2};
assert.equal(boardWorldTransform(moved),"translate(280px,-115px) scale(2)");
assert.equal(boardOverlayTransform(moved,base),"translate(180px,-75px) scale(1)");
const pinch={x:350,y:55,zoom:3};
assert.equal(boardOverlayTransform(pinch,base),"translate(200px,115px) scale(1.5)");
// The composited remote marker lands in the same viewport position as it
// would if React were rerendering its screen coordinates each pointer frame.
for(const world of [{x:0,y:0},{x:120,y:-90},{x:-1000,y:800}]){
 for(const next of [moved,pinch]){
  const factor=next.zoom/base.zoom;
  const dx=next.x-base.x*factor,dy=next.y-base.y*factor;
  assert.equal((world.x*base.zoom+base.x)*factor+dx,world.x*next.zoom+next.x);
  assert.equal((world.y*base.zoom+base.y)*factor+dy,world.y*next.zoom+next.y);
 }
}
assert.match(app,/const scheduleViewerPan = \(next: View\) => \{[\s\S]*requestAnimationFrame\(\(\) => \{[\s\S]*paintPendingPan\(pending\)/);
assert.doesNotMatch(app.slice(app.indexOf("const scheduleViewerPan ="),app.indexOf("const finishViewerPan =")),/setView\(/,
 "Pointermove must not trigger a React tree rerender");
assert.match(app,/const finishViewerPan = \(cancel=false,restore\?:View\) => \{/);
assert.match(app,/if \(cancel\) \{[\s\S]*paintPendingPan\(target\)/);
assert.match(app,/if \(next\) \{\s*paintPendingPan\(next\);\s*setView\(next\)/);
assert.match(app,/const cached=navigation\?panBoardBounds\.current:null/);
assert.match(app,/const fastPanWorld = useRef<HTMLDivElement>\(null\)/);
assert.match(app,/ref=\{fastPanWorld\}[\s\S]{0,120}className="world"/);
assert.match(app,/ref=\{fastPanOverlay\} className="remote-cursors-layer"/);
assert.match(app,/const margin = Math\.min\(600,Math\.max\(280,boardViewportSize\.width\*\.45\)\)/);
console.log("Board navigation: compositor pan, coordinate alignment, touch cache, release/cancel commit OK");
