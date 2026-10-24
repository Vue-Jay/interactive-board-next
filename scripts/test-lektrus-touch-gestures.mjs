import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import ts from "typescript";

const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const app=read("src/App.tsx");
const interaction=read("src/lektrusBoardInteraction.css");
const layout=read("src/lektrusToolLayout.css");
const eraser=read("src/inkEraser.ts");
const parsed=ts.createSourceFile("App.tsx",app,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
assert.equal(parsed.parseDiagnostics.length,0,
 "Board TSX has syntax errors: "+parsed.parseDiagnostics.map(d=>d.messageText).join(" | "));
const slice=(first,last)=>{
 const start=app.indexOf(first);
 const end=app.indexOf(last,start+first.length);
 assert.ok(start>=0&&end>start,"Missing source interval "+first+" to "+last);
 return app.slice(start,end);
};
const touchStart=slice("  const touchStart=","  const touchMove=");
const touchEnd=slice("  const touchEnd=","  const end = ");
const toolChange=slice("  // Switching tools invalidates","  const openBoardContextMenu =");
const down=slice('onPointerDownCapture={(e) => {','onPointerMoveCapture={(e) => {');
const up=slice('onPointerUpCapture={(e) => {','onPointerCancelCapture={(e) => {');
const cancel=slice('onPointerCancelCapture={(e) => {','onClickCapture={(e)=>{');
const lost=slice('onLostPointerCapture={(e) => {','          {isAppAdmin &&');
assert.ok(touchStart.includes('if(e.isPrimary && touchPoints.current.size)'),
 "Recover orphaned touches when a primary touch begins");
assert.ok(touchStart.indexOf('consumedTouchIds.current.add(id)')<
 touchStart.indexOf('end(gesture.current?.mode!=="pan")'),
 "Mark pinch fingers before ending the first gesture and releasing its capture");
assert.match(touchStart,/eraserSession\.current=null;\s*stopEraserPreview\(\)/,
 "Pinch must cancel the uncommitted eraser session");
assert.match(touchStart,/pinchState\.current=\{distance:/);
assert.match(touchEnd,/touchPoints\.current\.delete\(e\.pointerId\)/);
assert.ok(up.includes('const consumed=touchEnd(e)'),
 "Capture-phase release must retire a touch even when embedded widgets swallow pointerup");
assert.ok(up.includes('if(e.pointerType==="touch"&&gesture.current?.pointer===e.pointerId)'),
 "Finish object move, transform, or hand pan in capture phase");
assert.ok(cancel.includes('const consumed=touchEnd(e)'));
assert.ok(cancel.includes('if(gesture.current?.pointer===e.pointerId){end(true);return;}'));
assert.match(down,/if\(eraserSession\.current\|\|pinchState\.current\|\|touchPoints\.current\.size>1\|\|/);
assert.ok(down.includes('setSelected([])'));
assert.ok(app.includes('const next=eraseInkAlongPath(before,g.path,eraserSize/2/g.zoom)'));
assert.ok(eraser.includes('item.kind!=="pen"&&item.kind!=="marker"'),
 "Brush must only erase ink strokes and marker strokes");
assert.ok(interaction.includes('.board.board-tool-eraser [data-object] *'));
assert.ok(interaction.includes('pointer-events:none!important'));
assert.ok(app.includes('if(tool==="eraser"){e.preventDefault();e.stopPropagation();return;}'),
 "Eraser must not activate object click handlers");
assert.ok(lost.includes('eraserSession.current?.pointer===e.pointerId'));
assert.ok(lost.includes('gesture.current?.pointer===e.pointerId'));
assert.ok(!lost.includes('else end(true)'),
 "A late capture-loss from one finger must not cancel a different gesture");
assert.ok(toolChange.includes('if(previousInteractionTool.current===tool)return;'));
for(const key of ['end(true)','eraserSession.current=null','stopEraserPreview()',
 'touchPoints.current.clear()','consumedTouchIds.current.clear()','pinchState.current=null',
 'rightPress.current=null','setMarqueeRect(null)'])assert.ok(toolChange.includes(key),"Tool switch must reset "+key);
assert.ok(toolChange.includes('window.addEventListener("pointerup",release)'));
assert.ok(toolChange.includes('window.addEventListener("pointercancel",release)'));
assert.ok(toolChange.includes('window.addEventListener("blur",blur)'));
assert.ok(app.includes('data-lektrus-hand-tool="true"'),
 "Every touch dock must contain a hand button");
assert.ok(app.includes('...(isCoarsePointer?["hand"]:[])'),
 "Wide tablets with coarse pointers must have a desktop-rail hand too");
assert.ok(app.includes('{ label:"Навигация", tools:["select","hand","lasso"] }'),
 "Hand must remain available in the tablet's More menu");
assert.ok(layout.includes('button[data-lektrus-hand-tool="true"]'));
for(const css of [interaction,layout])
 assert.equal((css.match(/{/g)||[]).length,(css.match(/}/g)||[]).length,
  "Unbalanced CSS brackets");
console.log("Touch release, object drag recovery, single-finger ink eraser, pinch navigation, and tablet Hand: source checks OK");
