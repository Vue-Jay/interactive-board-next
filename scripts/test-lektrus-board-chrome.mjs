import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const app=read("src/App.tsx");
const css=read("src/lektrusCanvasChrome.css");
const hook=read("src/useAdaptiveBoardToolbar.ts");
const capacity=read("src/toolbarCapacity.ts");
const entry=read("src/main.tsx");
assert.match(entry,/import "\.\/lektrusPolish\.css";\s*import "\.\/lektrusCanvasChrome\.css";/);
assert.match(app,/ref=\{adaptiveToolbarRef\}/);
assert.match(app,/useAdaptiveBoardToolbar\(desktopToolsExpanded,lectrisPinned\.join\("\|"\)\)/);
// Regression: referencing a let/const state before its initialization causes
// a runtime ReferenceError and renders the entire board unusable.
const desktopStatePos=app.indexOf("const [desktopToolsExpanded,setDesktopToolsExpanded]=useState(");
const adaptiveCallPos=app.indexOf("const adaptiveToolbarRef=useAdaptiveBoardToolbar(");
const pinnedStatePos=app.indexOf("const [lectrisPinned,setLectrisPinned]=useState");
assert.ok(desktopStatePos>=0 && pinnedStatePos>=0 && adaptiveCallPos>desktopStatePos && adaptiveCallPos>pinnedStatePos,
  "Adaptive toolbar hook must be called AFTER all state arguments are initialized");
assert.match(app,/setDesktopToolsExpanded\(v=>!v\)/);
assert.match(app,/GeometryInstruments view=\{view\} boardRef=\{board\}/);
assert.match(hook,/ResizeObserver/);
assert.match(hook,/window\.visualViewport\?\.addEventListener\("resize"/);
assert.match(hook,/aria-hidden/);
assert.match(hook,/tabIndex=-1/);
assert.match(css,/\.lektrus-auto-overflow/);
assert.match(css,/\.lektrus-overflowing/);
assert.match(css,/@media \(pointer:fine\)/);
assert.match(css,/prefers-reduced-motion:reduce/);
assert.match(capacity,/Math\.floor/);
assert.equal((css.match(/{/g)||[]).length,(css.match(/}/g)||[]).length);
for (const name of ["select","lasso","pen","marker","eraser","sticky","shape","formula","graph","table"]){
 assert.match(app,new RegExp('case "'+name+'": return '),"Missing custom icon "+name);
}
assert.doesNotMatch(css, /\.board-object\b|\.viewer-ink-canvas\b|\.canvas\b|\.board\.eraser-live\b/);
console.log("Lektrus board chrome and adaptive toolbar source contracts pass.");
