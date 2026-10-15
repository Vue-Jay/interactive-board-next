import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const app=read("src/App.tsx");
const css=read("src/lektrusBoardInteraction.css");

// Capture starts ink before any photo, iframe, embedded widget or handle
// receives a pointerdown, preventing selection and drag while painting.
const capture=app.indexOf('onPointerDownCapture={(e) => {');
const captureEnd=app.indexOf('onPointerMoveCapture={(e) => {',capture);
const captureBody=app.slice(capture,captureEnd);
assert.ok(capture>=0&&captureEnd>capture);
assert.match(captureBody,/if\(\(tool==="pen"\|\|tool==="marker"\) && !presentation && !space && e\.button===0\)/);
assert.match(captureBody,/touchStart\(e\);[\s\S]*?touchPoints\.current\.size<2\)down\(e\);[\s\S]*?e\.stopPropagation\(\)/);
assert.ok(captureBody.indexOf('if(e.button===2')<captureBody.indexOf('if((tool==="pen"'),"Right-button pan should take priority");
assert.ok(captureBody.indexOf('if((tool==="pen"')<captureBody.indexOf('if(tool!=="eraser"'),"Preserve eraser handler");

// Object manipulation is reserved for the selecting/hand tools, not ink.
for(const pattern of [
  /if \(\(tool === "select" \|\| tool === "hand"\) && connectorEndpoint/,
  /if \(\(tool === "select" \|\| tool === "hand"\) && groupHandle/,
  /if \(\(tool === "select" \|\| tool === "hand"\) && transformHandle/,
]) assert.match(app,pattern);
assert.match(app,/else if \(tool === "pen" \|\| tool === "marker"\) \{\s*mode = "draw";/);
assert.match(app,/setPreview\(liveStroke\(ink\.id, ink\.kind, \[p\]/);
assert.match(app,/board\.current!\.setPointerCapture\(e\.pointerId\)/);
assert.match(app,/onPointerMove=\{\(e\) => \{/);
assert.match(app,/onPointerUp=\{\(e\) => \{/);

// All objects AND their descendants are inert only when painting.
assert.match(css,/\.board:is\(\.board-tool-pen,\.board-tool-marker,\.board-tool-eraser\) \.world \.board-object \*/);
assert.match(css,/\.connector-endpoint-overlay \*/);
assert.match(css,/\.selection-toolbar-screen \*/);
assert.match(css,/pointer-events:none!important/);
assert.match(css,/-webkit-user-drag:none!important/);
assert.doesNotMatch(css,/\.board-tool-select\)\s+\.world\s+\.board-object/);
assert.equal((css.match(/{/g)||[]).length,(css.match(/}/g)||[]).length);
console.log("Ink over objects: pen/marker/eraser are inert on objects, selection remains separate.");
