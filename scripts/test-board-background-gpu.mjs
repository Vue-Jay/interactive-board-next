import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";

const source=readFileSync("src/boardBackgroundPan.ts","utf8");
const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const mod={exports:{}};
new Function("require","module","exports",js)(()=>{throw Error("Unexpected dependency")},mod,mod.exports);
const {boardGridTransform}=mod.exports;

// Verify the background repeat is mathematically identical to full
// background-position repaints, including negative offsets and zoom.
for(const base of [{x:0,y:0,zoom:1},{x:-555,y:238,zoom:1.75},{x:400,y:-700,zoom:.4}]){
 for(const delta of [-1400,-241,-70,-24,-1,0,1,24,101,1300]){
  for(const zoom of [base.zoom,base.zoom*.75,base.zoom*1.4]){
   const next={x:base.x+delta,y:base.y-delta/3,zoom};
   const result=boardGridTransform(next,base);
   const match=/^translate3d\\((-?[\\d.e+-]+)px,(-?[\\d.e+-]+)px,0\\) scale\\((-?[\\d.e+-]+)\\)$/.exec(result);
   assert.ok(match,"Expected a GPU-only transform: "+result);
   const [,tx,ty,k]=match.map(Number);
   const period=24*next.zoom;
   for(const boardPoint of [-240,-40,0,24,200,900]){
    // A board pattern dot at base.x+boardPoint*base.zoom moves
    // to next.x+boardPoint*next.zoom, up to an integer number of cells.
    const screenBefore=boardPoint*base.zoom+base.x;
    const screenAfter=screenBefore*k+tx;
    const desired=boardPoint*next.zoom+next.x;
    const difference=(screenAfter-desired)/period;
    assert.ok(Math.abs(difference-Math.round(difference))<1e-6,
      "Grid phase shifted "+JSON.stringify({base,next,result,difference}));
    const screenBeforeY=boardPoint*base.zoom+base.y;
    const screenAfterY=screenBeforeY*k+ty;
    const desiredY=boardPoint*next.zoom+next.y;
    const differenceY=(screenAfterY-desiredY)/period;
    assert.ok(Math.abs(differenceY-Math.round(differenceY))<1e-6);
   }
  }
 }
}
const app=readFileSync("src/App.tsx","utf8");
const styles=readFileSync("src/App.css","utf8");
const paint=app.slice(app.indexOf("const paintPendingPan ="),app.indexOf("const scheduleViewerPan ="));
assert.match(paint,/fastPanBackground\.current\.style\.transform=boardGridTransform/);
assert.doesNotMatch(paint,/backgroundPosition|backgroundSize|setView\(/,
 "Never repaint the CSS gradient or rerender React in pointermove");
assert.match(app,/ref=\{fastPanBackground\}/);
assert.match(app,/backgroundPosition:\x60\$\{view\.x\+256\}px/);
assert.match(app,/backgroundImage:"none"/);
assert.match(app,/fastPanBackground\.current\.style\.transform="none"/);
assert.match(styles,/\.board \.board-background-pattern-layer\{/);
assert.match(styles,/transform-origin:256px 256px/);
console.log("Board background: correct dot/grid phase across pan and zoom without per-frame painting");
