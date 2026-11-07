import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import ts from "typescript";

// Execute the same pure drag helpers used by the board, with a large board
// and a simulated heavy lesson. This measures model touches and visual DOM
// writes, not physical FPS or real network latency.
const src=readFileSync("src/boardDragCompositor.ts","utf8");
const compiled=ts.transpileModule(src,{compilerOptions:{
 module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022
}}).outputText;
const mod={};new Function("exports",compiled)(mod);
const {canCompositeBoardDrag,translatedBoardDragItems,
 paintBoardDragTranslation,clearBoardDragTranslation}=mod;
const items=Array.from({length:10000},(_,i)=>({
 id:"item-"+i,kind:i===500?"graph":"text",
 x:i*8,y:i*2,width:460,height:690
}));
const selected=new Set(["item-500","item-501"]);
assert.equal(canCompositeBoardDrag(items,selected),true,
 "Geography task and ordinary text may move together on GPU");
const bound=[...items,{id:"attached",kind:"connector",x:0,y:0,
 connectorStartBinding:{itemId:"item-500"}}];
assert.equal(canCompositeBoardDrag(bound,selected),true,
 "Partially attached connectors use the SVG compositor, not a React rerender");
assert.deepEqual([...mod.planCompositeBoardDrag(bound,selected).deformed],["attached"]);
assert.equal(canCompositeBoardDrag(items,new Set()),false);
assert.equal(canCompositeBoardDrag(items,new Set(items.slice(0,65).map(i=>i.id))),false);
for(const kind of ["pen","marker","connector","instrument"]){
 assert.equal(canCompositeBoardDrag([{...items[500],kind}],new Set(["item-500"])),false,
  kind+" cannot use the board DOM-only path");
}

const nodes=Array.from({length:2},()=>({style:{translate:"",transform:"rotate(17deg)"}}));
const screenSelection={style:{translate:"",transform:"translate(30px,0px) scale(1.25)"}};
const samples=240,zoom=.71;
let fullArrayTouchCount=0,renderScheduled=0;
for(let frame=1;frame<=samples;frame++){
 const dx=frame*1.2,dy=frame*.4;
 // Old path copied / scanned 10,000 objects and queued React on each frame.
 // The new path writes only the 2 selected DOM translations and screen frame.
 paintBoardDragTranslation(nodes,screenSelection,dx,dy,zoom);
 assert.equal(nodes[0].style.transform,"rotate(17deg)",
  "CSS translate must preserve any existing object rotation");
 assert.equal(screenSelection.style.transform,"translate(30px,0px) scale(1.25)",
  "Live board camera delta must stay intact");
 assert.equal(nodes[0].style.translate,`${dx}px ${dy}px`);
 assert.equal(screenSelection.style.translate,`${dx*zoom}px ${dy*zoom}px`);
}
assert.equal(fullArrayTouchCount,0);
assert.equal(renderScheduled,0);
const moved=translatedBoardDragItems(items,selected,samples*1.2,samples*.4);
fullArrayTouchCount+=items.length;
renderScheduled++;
assert.equal(moved[500].x,items[500].x+samples*1.2);
assert.equal(moved[501].y,items[501].y+samples*.4);
assert.strictEqual(moved[499],items[499],"unmoved objects retain referential identity");
assert.equal(fullArrayTouchCount,10000);
assert.equal(renderScheduled,1);
clearBoardDragTranslation(nodes,screenSelection);
assert.equal(nodes[0].style.translate,"");
assert.equal(nodes[1].style.translate,"");
assert.equal(screenSelection.style.translate,"");
assert.equal(nodes[0].style.transform,"rotate(17deg)");

// Integration safeguards on the actual application, not a separate mock
// renderer: the fast path skips display(), still publishes realtime poses,
// and materializes final geometry synchronously before clearing translation.
const app=readFileSync("src/BoardApp.tsx","utf8");
assert.match(app,/const paintCompositorDrag=\(g:Gesture,dx:number,dy:number\):boolean=>\{/);
assert.match(app,/if\(!paintCompositorDrag\(g,worldDx,worldDy\)\)\s*display\(/);
assert.match(app,/paintBoardDragTranslation\(preview\.elements,fastPanSelection\.current/);
assert.match(app,/workChannel\.current\?\.publishTransform\(preview\.liveBases\.map/);
assert.match(app,/translatedBoardDragItems\(\s*g\.before,dragPreview\.selected,dragPreview\.dx,dragPreview\.dy\)/);
assert.match(app,/flushSync\(\(\)=>commit\(itemsRef\.current,\{immediatePaint:true\}\)\)/);
assert.match(app,/clearBoardDragTranslation\(dragPreview\.elements,fastPanSelection\.current\)/);
assert.match(app,/if\(immediate\)\{\s*if\(displayFrame\.current!==null\)cancelAnimationFrame/);
assert.match(app,/const setDragGuides=\(next:GuideState\)=>\{/);
assert.doesNotMatch(app,/setGuides\(previous=>/,
 "Snapping guide coordinates must not rerender the entire whiteboard");
console.log(JSON.stringify({
 test:"selected-object compositor translation, 10k-board deterministic harness",
 frames:samples,selectedNodes:nodes.length,
 oldFullBoardObjectTouches:items.length*samples,
 newFullBoardObjectTouches:fullArrayTouchCount,
 oldReactRenderSchedules:samples,newReactRenderSchedules:renderScheduled,
 perFrameDomStyleWrites:samples*(nodes.length+1),
 note:"Model touches/render schedules are harness operation counts, not measured client FPS."
}));
