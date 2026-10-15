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

const overflow=read("src/LektrusToolOverflow.tsx");
assert.match(app,/lectrisPinned\.map\(id=>tools\.find\(t=>t\.id===id\)!\)/,
  "Only pinned tools belong in the narrow rail");
assert.match(app,/desktopToolsExpanded&&<LektrusToolOverflow/,
  "Extra tools must appear in the floating dialog");
assert.match(app,/setTool\(id\);setMobileToolsOpen\(false\);setDesktopToolsExpanded\(false\)/,
  "Overflow items must retain click actions and close the dialog");
assert.match(app,/const \[desktopToolsExpanded,setDesktopToolsExpanded\]=useState\(false\)/,
  "The More dialog should not unexpectedly open when a board is reopened");
assert.match(overflow,/maxHeight|Math\.min\(586,viewportHeight-24\)/,
  "Floating dialog should fit into the viewport");
assert.match(overflow,/dialogRef\.current\?\.contains\(target\)/);
assert.match(overflow,/Escape/);
assert.match(css,/\.lektrus-tool-overflow-popover/);
assert.match(css,/max-height:min\(586px,calc\(100dvh - 24px\)\)/);
assert.match(hook,/const hidden=index>=count;/);
console.log("Lektrus board chrome and adaptive toolbar source contracts pass.");
