import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";

// Load the real TypeScript implementation without introducing another test dependency.
const source = readFileSync(new URL("../src/inkEraser.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const exports = {};
runInNewContext(compiled, { exports, crypto: { randomUUID } }, { filename: "inkEraser.js" });
const { eraseInkAlongPath } = exports;
// Sticker-local ink must survive parsing and use the same partial eraser.
const modelExports={};
const modelSource=readFileSync(new URL("../src/boardModel.ts",import.meta.url),"utf8");
runInNewContext(ts.transpileModule(modelSource,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports:modelExports,crypto:{randomUUID}});
const stickerExports={};
const stickerSource=readFileSync(new URL("../src/stickerInk.ts",import.meta.url),"utf8");
runInNewContext(ts.transpileModule(stickerSource,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{
  exports:stickerExports,require:name=>name==="./boardModel"?modelExports:exports,crypto:{randomUUID}
});
const {stickerAt,makeStickerInk,stickerInkPixels,eraseStickerInk}=stickerExports;
const card={id:"card",kind:"sticky",x:100,y:100,width:200,height:100,text:"",color:"#fff3a6"};
assert.equal(stickerAt([card],{x:150,y:120}),card);
assert.equal(stickerAt([card],{x:400,y:120}),undefined);
const ink=makeStickerInk(card,{id:"attached",kind:"pen",color:"#123456",weight:4},[{x:120,y:150},{x:280,y:150}],1);
const annotated={...card,stickerInk:[ink]};
const {resizeStickerInk,splitStickerPath}=stickerExports;
const enlarged=resizeStickerInk(annotated,{...annotated,width:400,height:200},true);
assert.equal(JSON.stringify(stickerInkPixels(enlarged,enlarged.stickerInk[0])),JSON.stringify(stickerInkPixels(card,ink)),"enlarging paper must not enlarge ink");
const expandedLeft=resizeStickerInk(annotated,{...annotated,x:50,width:250},true);
assert.ok(Math.abs(stickerInkPixels(expandedLeft,expandedLeft.stickerInk[0]).points[0].x-70)<1e-8,"expanding left preserves the world position of ink");
const pieces=splitStickerPath(card,[{x:180,y:150},{x:350,y:150},{x:200,y:150}]);
assert.equal(JSON.stringify(pieces.map(p=>[p.inside,p.points[0].x,p.points.at(-1).x])),JSON.stringify([[true,180,300],[false,300,300],[true,300,200]]),"continuous ink crosses the paper edge and can return");
const recovered=modelExports.parseDocument(JSON.stringify({version:1,title:"Test",view:{x:0,y:0,zoom:1},items:[annotated]})).items[0];
assert.equal(JSON.stringify(recovered.stickerInk),JSON.stringify([ink]));
assert.equal(JSON.stringify(stickerInkPixels({...card,x:500,y:600},ink)),JSON.stringify(stickerInkPixels(card,ink)));
assert.equal(stickerInkPixels({...card,width:400,height:200},ink).points[0].x,40);
const rotated={...card,rotation:90};
const rotatedInk=makeStickerInk(rotated,{id:"rotated",kind:"marker",color:"#123456",weight:8},[{x:200,y:75},{x:200,y:225}],1);
assert.ok(Math.abs(rotatedInk.points[0].x-.125)<1e-8);
assert.equal(eraseStickerInk(annotated,[{x:200,y:150}],5).stickerInk.length,2);
assert.equal(eraseStickerInk(annotated,[{x:200,y:350}],5),annotated);
assert.throws(()=>modelExports.parseDocument(JSON.stringify({version:1,title:"Test",view:{x:0,y:0,zoom:1},items:[{...annotated,stickerInk:[{...ink,weight:-1}]}]})),/рисунок стикера/);
const mergeExports={};
runInNewContext(ts.transpileModule(readFileSync(new URL("../src/lektrusLiveEditorMerge.ts",import.meta.url),"utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports:mergeExports});
const concurrent=mergeExports.mergeEditedValue(card,annotated,{...card,stickerInk:[rotatedInk]});
assert.equal(concurrent.stickerInk.length,2,"Concurrent first strokes must both survive");
assert.equal(typeof eraseInkAlongPath, "function");

const point = (x, y) => ({ x, y });
const stroke = (kind = "pen") => ({
  id: randomUUID(), kind, x: -2, y: -2, width: 5004, height: 4,
  text: "", color: "#000000", weight: 4,
  points: [point(2, 2), point(5002, 2)],
});
const spans = (pieces) => pieces.map((i) => {
  const values = i.points.map((p) => p.x + i.x);
  return [Math.min(...values), Math.max(...values)];
}).sort((a, b) => a[0] - b[0]);

for (const kind of ["pen", "marker"]) {
  const original = stroke(kind);
  // One click near the middle MUST make a gap, even in a 5,000px two-point stroke.
  const cut = eraseInkAlongPath([original], [point(2500, 0)], 10);
  assert.equal(cut.length, 2, kind + ": partial erasure must leave two pieces");
  const ends = spans(cut);
  assert.ok(ends[0][1] < 2500 && ends[1][0] > 2500, kind + ": the gap must be visible");
  assert.ok(ends[0][0] <= 0.01 && ends[1][1] >= 4999.99, kind + ": both ends remain");
  const cross = eraseInkAlongPath([original], [point(2500, -100), point(2500, 100)], 10);
  assert.equal(cross.length, 2, kind + ": a perpendicular sweep cuts the line");
  const missed = eraseInkAlongPath([original], [point(2500, 100)], 10);
  assert.equal(missed[0], original);
  assert.equal(eraseInkAlongPath([original], [point(0, 0), point(5000, 0)], 10).length, 0,
    kind + ": covering the full stroke removes it");
  assert.equal(eraseInkAlongPath(cut, [point(2500, 0)], 10).length, 2,
    kind + ": erasing the gap again must not remove the remaining halves");
}
// An obsolete locked flag in old ink must not make a stroke unerasable.
const locked = { ...stroke(), locked: true };
assert.equal(eraseInkAlongPath([locked], [point(2500, 0)], 10).length, 2,
  "pen/marker strokes cannot be locked, even in older documents");
assert.equal(eraseInkAlongPath([locked], [point(2500, 0)], 10,
  () => false)[0], locked,"role-based eraser permission still preserves foreign ink");
const untouched = stroke();
const nearby = stroke();
nearby.y = 100;
const cutWithUntouched = eraseInkAlongPath([untouched, nearby], [point(2500, 0)], 10);
assert.equal(cutWithUntouched.length, 3);
assert.equal(cutWithUntouched[2], nearby, "other strokes must be preserved");

console.log("Eraser regression tests passed: partial, crossed, long, full, repeated, non-lockable and protected strokes.");
