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
const {resizeStickerInk,stickerVisualBounds}=stickerExports;
const enlarged=resizeStickerInk(annotated,{...annotated,width:400,height:200},true);
assert.equal(JSON.stringify(stickerInkPixels(enlarged,enlarged.stickerInk[0])),JSON.stringify(stickerInkPixels(card,ink)),"enlarging paper must not enlarge ink");
const expandedLeft=resizeStickerInk(annotated,{...annotated,x:50,width:250},true);
assert.ok(Math.abs(stickerInkPixels(expandedLeft,expandedLeft.stickerInk[0]).points[0].x-70)<1e-8,"expanding left preserves the world position of ink");
const overhang=makeStickerInk(card,{id:"overflow",kind:"pen",color:"#123456",weight:4},[{x:180,y:150},{x:380,y:150},{x:200,y:150}],1);
const overhanging={...card,stickerInk:[overhang]};
assert.ok(overhang.points.some(p=>p.x>1),"the complete stroke remains owned by the sticker");
assert.equal(stickerAt([overhanging],{x:380,y:150}),undefined,"new strokes started on the overhang belong to the board");
const extent=stickerVisualBounds(overhanging);
assert.ok(extent.x+extent.width>=382,"visual bounds include the entire outside stroke");
const enlargedOverhang=resizeStickerInk(overhanging,{...overhanging,width:400,height:200},true);
assert.equal(JSON.stringify(stickerInkPixels(enlargedOverhang,enlargedOverhang.stickerInk[0])),JSON.stringify(stickerInkPixels(overhanging,overhang)));
const cutOverhang=eraseStickerInk(overhanging,[{x:350,y:150}],5);
assert.notEqual(cutOverhang,overhanging,"eraser reaches ink beyond the paper");
assert.ok(cutOverhang.stickerInk.some(i=>i.points.some(p=>p.x>1)),"remaining outside ink is still attached");
assert.equal(eraseStickerInk(overhanging,[{x:350,y:150}],5,"stroke").stickerInk.length,0,"whole stroke eraser removes the complete attached line even outside the paper");
assert.equal(JSON.stringify(modelExports.parseDocument(JSON.stringify({version:1,title:"Test",view:{x:0,y:0,zoom:1},items:[overhanging]})).items[0].stickerInk),JSON.stringify([overhang]));
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
  assert.equal(eraseInkAlongPath([original],[point(2500,0)],10,()=>true,"stroke").length,0,"whole stroke erases the entire original");
  assert.equal(eraseInkAlongPath([original],[point(2500,-100),point(2500,100)],10,()=>true,"stroke").length,0,"fast crossing must catch the entire stroke");
  assert.equal(eraseInkAlongPath([original],[point(2500,100)],10,()=>true,"stroke")[0],original,"a miss must leave the stroke alone");
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
assert.equal(eraseInkAlongPath([untouched,nearby],[point(2500,0)],10,()=>true,"stroke")[0],nearby);
assert.equal(eraseInkAlongPath([locked],[point(2500,0)],10,()=>false,"stroke")[0],locked);
const rotatedLine={...stroke(),rotation:90};
assert.equal(eraseInkAlongPath([rotatedLine],[point(2500,1000)],5,()=>true,"stroke").length,0,"rotated strokes are hit in their displayed position");
assert.equal(eraseInkAlongPath([rotatedLine],[point(4000,0)],5,()=>true,"stroke")[0],rotatedLine);
const dot={...stroke(),x:8,y:8,width:4,height:4,points:[point(2,2)]};
assert.equal(eraseInkAlongPath([dot],[point(10,10)],5,()=>true,"stroke").length,0,"one-point marks can be removed");
const previewExports={};
runInNewContext(ts.transpileModule(readFileSync(new URL("../src/remoteEraserPreview.ts",import.meta.url),"utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{
  exports:previewExports,require:name=>name==="./boardModel"?modelExports:name==="./boardLiveInk"?{remoteInkRuns:p=>[{points:p.points}]}:exports,crypto:{randomUUID}
});
const preview={id:"erase",kind:"eraser",weight:20,points:[point(2500,0)],eraserMode:"stroke"};
const targets=new Map([[preview.id,new Set([untouched.id])]]);
assert.equal(previewExports.previewRemoteErasures([untouched,nearby],new Map([[preview.id,preview]]),targets)[0],nearby,"Peer must see the whole line disappear before eraser release");
assert.equal(previewExports.previewRemoteErasures([untouched],new Map([[preview.id,{...preview,eraserMode:"partial"}]]),targets).length,2,"Peer partial mode still shows both cut fragments");

const rotatedCut=eraseInkAlongPath([rotatedLine],[point(2500,1000)],5,()=>true,"partial");
assert.equal(rotatedCut.length,2,"Partial mode cuts rotated ink in world coordinates");
assert.ok(rotatedCut.every(x=>!x.rotation),"Rotated cut fragments are stored in world coordinates");
assert.equal(eraseInkAlongPath([rotatedLine],[point(4000,0)],5,()=>true,"partial")[0],rotatedLine);
const livePeer={id:"peer-live",kind:"pen",color:"#123456",weight:4,points:[point(10,50),point(110,50)]};
const liveMap=new Map([[livePeer.id,livePeer]]);
const peerPath=[point(60,50)];
const touched=previewExports.touchedPeerInk(liveMap,[],peerPath,8);
assert.equal(JSON.stringify(touched),JSON.stringify(["peer-live"]));
assert.equal(previewExports.touchedPeerInk(liveMap,[],[point(60,150)],8).length,0);
const actualPeer=modelExports.stroke("peer-live","pen",livePeer.points,"#123456",4);
assert.equal(previewExports.touchedPeerInk(liveMap,[actualPeer],peerPath,8).length,0,"Already saved ink is handled by normal eraser");
for(const mode of ["stroke","partial"]){
 const pending=new Map([["peer-live",[{path:peerPath,radius:8,mode,expiresAt:200}]]]);
 const unrelated={...actualPeer,id:"unrelated"};
 const initial=[unrelated];
 assert.equal(previewExports.applyPendingPeerErases(initial,pending,100),initial);
 assert.equal(pending.size,1,"Keep the intended ID until its saved stroke arrives");
 const saved=[unrelated,actualPeer];
 const result=previewExports.applyPendingPeerErases(saved,pending,101);
 assert.equal(result[0],unrelated,"Never erase unrelated later arrivals");
 assert.equal(result.length,mode==="stroke"?1:3);
 assert.equal(pending.size,0);
 assert.equal(previewExports.applyPendingPeerErases(result,pending,102),result);
}
const expired=new Map([["peer-live",[{path:peerPath,radius:8,mode:"stroke",expiresAt:100}]]]);
const late=[actualPeer];
assert.equal(previewExports.applyPendingPeerErases(late,expired,101),late);
assert.equal(expired.size,0);
console.log("Eraser regression tests passed: partial, crossed, long, full, repeated, non-lockable, rotated, and pending peer strokes.");


// The production renderer and persistence use the very same item identity.
const durableExports={};
const durableSource=readFileSync(new URL("../src/boardDurableInk.ts",import.meta.url),"utf8");
runInNewContext(ts.transpileModule(durableSource,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{
 exports:durableExports,require:name=>name==="./boardModel"?modelExports:stickerExports
});
const {writeDurableInk,hasDurableInk,removeDurableInk,peerRemovedDurableInk}=durableExports;
for(const kind of ["pen","marker"]){
 const style={id:"stable-"+kind,kind,color:"#123456",weight:4};
 const a=writeDurableInk([],style,[{x:0,y:0}],1,"pupil");
 const b=writeDurableInk(a,style,[{x:0,y:0},{x:100,y:0}],1,"pupil");
 assert.equal(b.length,1);
 assert.equal(b[0].id,a[0].id);
 assert.equal(b[0].createdBy,"pupil");
 assert.equal(b[0].points.length,2);
 assert.equal(a[0].points.length,1,"Previously sent snapshot must be immutable");
 const erased=eraseInkAlongPath(b,[{x:50,y:0}],7,()=>true,"stroke");
 assert.ok(peerRemovedDurableInk(b,erased,style),"Confirmed deletion retires the active stroke");
 assert.ok(!peerRemovedDurableInk([],[],style),"An unacknowledged new stroke is not falsely deleted");
 assert.ok(!hasDurableInk(removeDurableInk(b,style),style));
 const identity={id:style.id,stickerId:card.id};
 const first=writeDurableInk([card],style,[{x:150,y:150}],1,"pupil",card.id);
 const second=writeDurableInk(first,style,[{x:150,y:150},{x:350,y:150}],1,"pupil",card.id);
 assert.equal(second[0].stickerInk.length,1);
 assert.ok(second[0].stickerInk[0].points.some(p=>p.x>1));
 assert.ok(peerRemovedDurableInk(second,removeDurableInk(second,identity),identity));
 assert.ok(peerRemovedDurableInk(second,[],identity));
}
console.log("Permanent ink keeps one identity through drawing, attached ink, and peer deletion.");
