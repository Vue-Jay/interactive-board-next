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

// Menu organization and tile geometry regressions.
const newMobileActionMenu=app.indexOf('<details className="lektrus-board-actions-menu">');
const oldActionsSection=app.indexOf('<div className="mobile-tools-group"><span>Действия с доской</span>');
const toolSheetPos=app.indexOf('className="mobile-tools-sheet"');
assert.ok(newMobileActionMenu>=0 && newMobileActionMenu<toolSheetPos,
  "Board actions must be in a separate top bar menu");
assert.equal(oldActionsSection,-1,"Board actions should not be in the tool catalogue");
for(const text of ["Начать урок","Участники","История изменений","Презентация","Скачать копию","Чат"]){
  assert.ok(app.slice(newMobileActionMenu,newMobileActionMenu+3500).includes(text),
    "Missing board action "+text);
}
assert.match(css,/\.mobile-tools-sheet \.mobile-tools-groups\{[\s\S]*?grid-template-columns:minmax\(0,1fr\)!important/);
assert.match(css,/\.mobile-tools-sheet \.mobile-tools-group>div\{[\s\S]*?grid-auto-rows:66px!important/);
assert.match(css,/\.mobile-tools-sheet \.mobile-tools-group button\{[\s\S]*?height:66px!important/);
assert.match(css,/\.lektrus-board-actions-popover\{/);
assert.match(css,/\.lektrus-board-actions-menu\{display:none!important\}/);

// A large touch tablet can report 1194-1366 CSS px in landscape. Width
// alone must never remove the one-finger Hand tool and replace its 42px
// touch dock with the mouse-only desktop rail.
const wideTouch="screen and (min-width:1101px) and (pointer:coarse)";
const wideMouse="screen and (min-width:1101px) and (pointer:fine)";
assert.ok(css.includes("@media "+wideMouse+",\n       screen and (min-width:1101px) and (pointer:none) {"),
 "Wide mouse and keyboard-only viewports keep the desktop rail");
const startMobile=css.indexOf("@media screen and (max-width:1100px),\n       "+wideTouch+" {");
assert.ok(startMobile>=0,
 "Both narrow viewports and wide coarse-pointer tablets must use the touch UI");
const mobileChunk=css.slice(startMobile,startMobile+1200);
assert.match(mobileChunk,/\.toolbar\.compact-toolbar[\s\S]*?display:none!important;visibility:hidden!important/);
assert.match(mobileChunk,/nav\.mobile-board-tools[\s\S]*?display:flex!important/);
const sideDock=css.indexOf("screen and (min-width:701px) and (max-width:1100px) and (orientation:portrait),\n       "+wideTouch+" {");
assert.ok(sideDock>=0,"Wide touch tablets must receive the scrollable vertical rail");
assert.match(css.slice(sideDock,sideDock+1800),
 /nav\.mobile-board-tools[\s\S]*?flex-direction:column!important/);
assert.match(css,/screen and \(min-width:1101px\) and \(pointer:coarse\)\{[\s\S]*?data-lektrus-hand-tool=/,
 "Wide touch tablets must retain the one-finger Hand control");
assert.match(css,/max-height:calc\(100dvh - 122px - env\(safe-area-inset-top/,
 "Side rail must stay within the dynamic viewport and device insets");
assert.match(css,/mobile-tool-cluster-create[\s\S]*?overflow-y:auto!important/,
 "Long tool sets need a separately scrollable section");
assert.match(app,/data-lektrus-hand-tool="true"[\s\S]*?onClick=\{\(\)=>\{finishEdit\(\);setTool\("hand"\)/,
 "Touch Hand control must remain wired to an actual tool action");

console.log("Lektrus board layouts: desktop / landscape / tablet / portrait OK");
