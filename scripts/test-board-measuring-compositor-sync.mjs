import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import ts from "typescript";

const app=readFileSync("src/App.tsx","utf8");
const instrument=readFileSync("src/GeometryInstruments.tsx","utf8");
const css=readFileSync("src/lektrusMeasurementInstruments.css","utf8");
const source=readFileSync("src/boardPanTransform.ts","utf8");
const js=ts.transpileModule(source,{compilerOptions:{
 module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022
}}).outputText;
const mod={exports:{}};
new Function("require","module","exports",js)((id)=>{throw Error("Unexpected dependency: "+id)},mod,mod.exports);
const {boardOverlayTransform}=mod.exports;

// A ruler's screen position must track the world point at every intermediate
// touch/trackpad camera frame, not jump only at React's final view commit.
const base={x:140,y:-35,zoom:1.4};
const liveViews=[
 {x:200,y:10,zoom:1.4},
 {x:340,y:-120,zoom:1.4},
 {x:-280,y:190,zoom:.7},
 {x:520,y:120,zoom:2.8},
];
for(const point of [{x:0,y:0},{x:180,y:145},{x:-420,y:100}])
 for(const live of liveViews){
  const transform=boardOverlayTransform(live,base);
  const match=/^translate\((-?[\d.e+-]+)px,(-?[\d.e+-]+)px\) scale\((-?[\d.e+-]+)\)$/.exec(transform);
  assert.ok(match,"Expected composited camera delta");
  const dx=Number(match[1]),dy=Number(match[2]),scale=Number(match[3]);
  const displayedX=(base.x+point.x*base.zoom)*scale+dx;
  const displayedY=(base.y+point.y*base.zoom)*scale+dy;
  assert.ok(Math.abs(displayedX-(live.x+point.x*live.zoom))<1e-6);
  assert.ok(Math.abs(displayedY-(live.y+point.y*live.zoom))<1e-6);
 }

// All three instrument types use the same portal host and transform.
// The toolbar stays in the original position outside this animated host.
assert.match(instrument,/const host=portalContainer===undefined\?boardRef\.current:portalContainer/);
assert.match(instrument,/createPortal\([\s\S]*?<InstrumentGraphic type=\{type\}\/>[\s\S]*?,host\)/);
assert.match(instrument,/renderOverlays&&instruments\.filter\(i=>!i\.hidden\)\.map/);
assert.match(instrument,/portalContainer=\{portalContainer\}/);
assert.match(app,/className="geometry-instrument-viewport-layer"/);
assert.match(app,/ref=\{setInstrumentViewportHost\}/);
assert.match(app,/portalContainer=\{instrumentViewportHost\}/);
const paint=app.slice(app.indexOf("const paintPendingPan ="),app.indexOf("const scheduleViewerPan ="));
assert.match(paint,/instrumentViewportHost\.style\.transform=boardOverlayTransform\(next,viewRef\.current\)/);
assert.doesNotMatch(paint,/setView\(/,
 "A live pan should never force a React render of rulers");
const finish=app.slice(app.indexOf("const finishViewerPan ="),app.indexOf("useEffect(() => () =>"));
assert.ok((finish.match(/instrumentViewportHost\.style\.transform="none"/g)||[]).length>=2,
 "Both cancelled and committed navigation must clear the temporary offset");
assert.match(css,/\.board \.geometry-instrument-viewport-layer\{/);
assert.match(css,/pointer-events:none/);
assert.match(css,/\.geometry-instrument-body,[\s\S]*?\.geometry-instrument-actions\{\s*pointer-events:auto;/);
console.log("Measuring tools: ruler, square and protractor follow pan/pinch continuously; interactive handles remain enabled");
