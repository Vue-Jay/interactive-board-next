import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const app=read("src/App.tsx");
const hook=read("src/useAdaptiveBoardToolbar.ts");
const css=read("src/lektrusToolRefinements.css");
const entry=read("src/main.tsx");
assert.ok(entry.indexOf("lektrusToolLayout.css")<entry.indexOf("lektrusToolRefinements.css"));
assert.equal((css.match(/{/g)||[]).length,(css.match(/}/g)||[]).length);
assert.match(app,/case "select": return <path d="M4\.5 3\.5/);
assert.doesNotMatch(app,/case "select": return [^\n]*strokeDasharray/);
assert.match(app,/case "connector": return <><path d="M3\.5 12h17"/);
assert.doesNotMatch(app,/case "connector": return [^\n]*<rect/);
assert.match(hook,/const itemHeight=\(sample\?\.getBoundingClientRect\(\)\.height\|\|40\)\+3/);
assert.doesNotMatch(hook,/!finePointer\|\|style\.display/);
for(const token of ["grid-auto-rows:54px!important","height:54px!important",
  "gap:11px!important","top:112px!important","max-width:calc(100vw - 84px)",
  "flex:0 0 96px!important","white-space:normal!important",
  "opacity:0!important","height:0!important","transition:opacity .13s ease",
  "body .workspace .toolbar.compact-toolbar .toolbar-list>.tool-wrap.lektrus-auto-overflow"])
 assert.ok(css.includes(token),"Missing "+token);
assert.match(css,/@media \(prefers-reduced-motion:reduce\)/);
assert.doesNotMatch(css,/\.board-object\b|\.viewer-ink-canvas\b|\.object-pen\b/);
console.log("Lektrus compact tool tiles, simple arrows, shape labels and fade-out contracts OK");
