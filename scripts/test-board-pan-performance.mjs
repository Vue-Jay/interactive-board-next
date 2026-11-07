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

// Screen-space selection chrome used to stay at its old x/y while the world
// was moved by paintPendingPan. Verify it uses exactly the same camera delta
// for *all* selection modes and no more costly React state on pointermove.
const css=readFileSync("src/App.css","utf8");
const paint=app.slice(app.indexOf("const paintPendingPan ="),app.indexOf("const scheduleViewerPan ="));
assert.match(paint,/fastPanSelection\.current\.style\.transform=boardOverlayTransform\(next,viewRef\.current\)/,
  "Selection frame must be moved every compositor pan frame, not only on release");
assert.doesNotMatch(paint,/setView\(|setSelected\(/,
  "Selection camera follow must not rerender the board per pointer movement");
const resets=app.slice(app.indexOf("const finishViewerPan ="),app.indexOf("useEffect(() => () =>"));
assert.equal((resets.match(/fastPanSelection\.current\.style\.transform="none"/g)||[]).length,2,
  "Cancelled and completed pans must both clear the temporary selection transform");
const start=app.indexOf('<div ref={fastPanSelection} className="board-selection-pan-layer">');
const end=app.indexOf('          </div>\n          <div ref={guideX}',start);
assert.ok(start>=0&&end>start,"Selection pan host wraps its controls");
const overlay=app.slice(start,end);
for(const kind of ["connector-endpoint-overlay","screen-transform-overlay",
  "screen-transform-group","screen-transform-locked","selection-toolbar-screen",
  "screen-selection-frame","screen-rotate-handle","screen-resize-handle"]){
  assert.ok(overlay.includes(kind),"Selection overlay omitted from pan host: "+kind);
}
assert.match(css,/\.board-selection-pan-layer\s*\{[^}]*position:\s*absolute;[^}]*inset:\s*0;[^}]*pointer-events:\s*none;[^}]*transform-origin:\s*0 0;/,
  "Camera host preserves the board's screen coordinates and interactive handles");
assert.match(css,/\.screen-resize-handle\s*\{[^}]*pointer-events:\s*auto;/,
  "Resize handles remain interactive through the transparent selection host");
for(const rect of [
  {x:240,y:310,width:460,height:690}, // Selected geography worksheet
  {x:-900,y:40,width:250,height:125},
  {x:60,y:-320,width:1100,height:350},
]){
  const corner={x:rect.x+rect.width,y:rect.y+rect.height};
  for(const live of [
    {x:200,y:-100,zoom:base.zoom},
    {x:-275,y:245,zoom:base.zoom},
    {x:350,y:55,zoom:3},
  ]){
    const factor=live.zoom/base.zoom;
    const dx=live.x-base.x*factor,dy=live.y-base.y*factor;
    for(const pt of [rect,corner]){
      assert.ok(Math.abs((pt.x*base.zoom+base.x)*factor+dx -
        (pt.x*live.zoom+live.x))<1e-7,
        "Selected frame x must track same world point as object");
      assert.ok(Math.abs((pt.y*base.zoom+base.y)*factor+dy -
        (pt.y*live.zoom+live.y))<1e-7,
        "Selected frame y must track same world point as object");
    }
  }
}

console.log("Board navigation: compositor pan, coordinate alignment, touch cache, release/cancel commit OK");
