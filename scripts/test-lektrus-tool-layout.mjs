import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const entry=read("src/main.tsx");
const css=read("src/lektrusToolLayout.css");
const app=read("src/App.tsx");
assert.ok(entry.indexOf("lektrusCanvasChrome.css")<entry.indexOf("lektrusToolLayout.css"));
assert.equal((css.match(/{/g)||[]).length,(css.match(/}/g)||[]).length);
for(const term of ["min-width:1101px","max-width:1100px","orientation:landscape",
  "min-width:701px","max-width:700px","max-height:450px",
  "prefers-reduced-motion:reduce","justify-content:flex-start!important",
  "overflow-y:auto!important","left:calc(70px + env(safe-area-inset-left",
  "right:max(9px,env(safe-area-inset-right",
  "body .workspace nav.mobile-board-tools",
  "body .workspace .toolbar.compact-toolbar",
  "body .workspace section.mobile-tools-sheet"])assert.ok(css.includes(term),"Missing "+term);
for(const term of ['<nav className="mobile-board-tools"',
  'className="mobile-tools-sheet"','ref={adaptiveToolbarRef}',
  'onClick={()=>setMobileToolsOpen(v=>!v)}'])assert.ok(app.includes(term),"Lost existing behavior "+term);
assert.doesNotMatch(css,/\.board-object\b|\.viewer-ink-canvas\b|\.object-pen\b/);
console.log("Lektrus board layouts: desktop / landscape / tablet / portrait OK");
