import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const app=read("src/BoardApp.tsx");
const css=read("src/lektrusCanvasChrome.css");
const hook=read("src/useAdaptiveBoardToolbar.ts");
const capacity=read("src/toolbarCapacity.ts");
const entry=read("src/appEntry.tsx");
assert.match(entry,/import "\.\/lektrusPolish\.css";\s*import "\.\/lektrusCanvasChrome\.css";/);
assert.match(app,/ref=\{adaptiveToolbarRef\}/);
assert.match(app,/useAdaptiveBoardToolbar\(desktopToolsExpanded,desktopToolSection\)/);
// Regression: referencing a let/const state before its initialization causes
// a runtime ReferenceError and renders the entire board unusable.
const desktopStatePos=app.indexOf("const [desktopToolsExpanded,setDesktopToolsExpanded]=useState(");
const adaptiveCallPos=app.indexOf("const adaptiveToolbarRef=useAdaptiveBoardToolbar(");
const sectionStatePos=app.indexOf("const [desktopToolSection,setDesktopToolSection]=useState(");
assert.ok(desktopStatePos>=0 && sectionStatePos>=0 && adaptiveCallPos>desktopStatePos && adaptiveCallPos>sectionStatePos,
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
assert.ok(app.includes('className="toolbar-pinned" aria-label="Основные инструменты"')
  &&app.includes('(["select","lasso",...(isCoarsePointer?["hand"]:[]),"pen","marker","eraser"] as Tool[]).map(id=>'),
  "The compact desktop rail must keep the core board tools available");
assert.match(app,/desktopToolsExpanded&&<LektrusToolOverflow/,
  "Extra tools must appear in the floating dialog");
assert.match(app,/setTool\(id\);setDesktopToolsExpanded\(false\)/,
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

// Phone portrait regression: the "+" catalogue must not expose the desktop rail.
const legacyBoardCss=read("src/App.css");
assert.doesNotMatch(app,/className=\{[^\n]*mobileToolsOpen\?"mobile-open"/,
  "The mobile menu must not toggle the legacy desktop rail");
assert.match(app,/<nav className="mobile-board-tools"/);
assert.match(app,/\{mobileToolsOpen&&<section className="mobile-tools-sheet"/);
assert.match(css,/@media screen and \(max-width:700px\) and \(orientation:portrait\)/);
assert.match(css,/html body \.workspace \.toolbar\.compact-toolbar\.mobile-open/);
assert.match(css,/display:none!important/);
// The current compact top bar keeps its participant action as a real control.
assert.match(app,/aria-label="Добавить участника"/);

console.log("Lektrus board chrome and adaptive toolbar source contracts pass.");
