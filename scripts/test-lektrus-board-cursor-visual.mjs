import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import ts from "typescript";

const read=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
const app=read("src/BoardApp.tsx");
const css=read("src/lektrusBoardBackground.css");
const legacy=read("src/App.css");
const entry=read("src/appEntry.tsx");

assert.equal(ts.createSourceFile("App.tsx",app,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX).parseDiagnostics.length,0,
 "Board cursor changes must leave App.tsx syntactically valid");
assert.ok(entry.indexOf('import "./lektrusBoardBackground.css"')>entry.indexOf('import "./lektrusToolRefinements.css"'),
 "Cursor styling must override earlier board CSS");
assert.match(app,/className=\{`lektrus-ink-cursor/);
assert.ok(app.includes('className="lektrus-ink-cursor-footprint"'));
assert.ok(app.includes('className="lektrus-ink-cursor-guide"'));
assert.ok(app.includes('className="lektrus-ink-cursor-center"'));
assert.ok(app.includes('"--cursor-size":Math.max(1,(tool==="marker"?markerWeight:weight)*view.zoom)+"px"'),
 "The cursor footprint must show the actual on-screen stroke width, including zoom");
assert.ok(app.includes('"--cursor-ink":tool==="marker"?markerColor:penColor'),
 "Pen and marker cursors use their selected ink colors, not one static black circle");
assert.ok(app.includes('"--cursor-contrast":backgroundAppearance.foreground'));
assert.ok(app.includes('"--cursor-outline":backgroundAppearance.outline'));
assert.ok(app.includes('moveInkCursor(e.clientX,e.clientY,e.pointerType,e.target)'),
 "Mouse and hovering pen follow board pointer position without component state");
assert.ok(app.includes('target instanceof Element&&target.closest('),
 "The cursor should not obscure board buttons, input fields or edit controls");
assert.ok(app.includes('if(pointerType==="touch"&&!pressed)'),
 "Ordinary touch motion must not leave a floating eraser cursor");
assert.ok(app.includes('setLiveEraserCursor(screen.x,screen.y,e.pointerType,true)'),
 "A finger should still see the eraser footprint while actively erasing");
assert.ok(app.includes('if(e.pointerType==="touch"&&eraserCursorElement.current)eraserCursorElement.current.style.visibility="hidden"'),
 "Touch eraser feedback must retire on release or lost pointer capture");
assert.ok(css.includes('@media (any-pointer:fine)'),
 "Tablets with a stylus need the fine-pointer cursor as well");
assert.ok(!css.includes('.workspace .lektrus-ink-cursor{display:none}'),
 "Do not hide a hovering stylus only because a tablet is touch-first");
assert.ok(css.includes('width:var(--cursor-size,3px)'));
assert.ok(css.includes('.lektrus-ink-cursor.is-fine .lektrus-ink-cursor-guide{display:block}'),
 "A tiny pen needs a precise locating reticle, not a giant false footprint");
assert.ok(css.includes('.lektrus-ink-cursor.is-marker .lektrus-ink-cursor-footprint'),
 "Highlight marker cursor must be visually distinct from the pen");
assert.ok(css.includes('.workspace .board.eraser-live .eraser-cursor'),
 "The eraser must show distinct active feedback");
assert.ok(css.includes('pointer-events:none!important'),
 "Cursor overlays must never intercept drawing");
assert.ok(!legacy.includes('.eraser-cursor {'),
 "No competing stale eraser style should remain");
assert.equal((css.match(/{/g)||[]).length,(css.match(/}/g)||[]).length,
 "Board cursor CSS blocks must stay balanced");
console.log("Board cursor: accurate stroke sizes, marker/pen contrast, precision reticle, touch-safe eraser and stylus hover OK");
