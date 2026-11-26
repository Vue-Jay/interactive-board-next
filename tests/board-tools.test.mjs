import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import ts from "typescript";

const source=readFileSync(new URL("../src/boardModel.ts",import.meta.url),"utf8");
const js=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText;
const {stroke,eraseInk}=await import("data:text/javascript;base64,"+Buffer.from(js).toString("base64"));
const cutter=readFileSync(new URL("../src/inkEraser.ts",import.meta.url),"utf8");
const cutterJS=ts.transpileModule(cutter,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText;
const {eraseInkAt}=await import("data:text/javascript;base64,"+Buffer.from(cutterJS).toString("base64"));

test("restored eraser removes pencil ink under a click",()=>{
  const ink=stroke("ink","pen",[{x:0,y:0},{x:8,y:0},{x:16,y:0},{x:24,y:0},{x:32,y:0}],"#000",3);
  const result=eraseInk([ink],[{x:16,y:0}],3);
  assert.ok(result.length < 5);
  assert.ok(result.every(i=>i.kind==="pen"));
  assert.ok(!result.some(i=>i.points?.some(p=>Math.abs(i.x+p.x-16)<0.5)));
});

test("restored eraser changes marker and keeps non-ink objects",()=>{
  const marker=stroke("marker","marker",[{x:0,y:0},{x:5,y:0},{x:10,y:0},{x:15,y:0},{x:20,y:0}],"#aaf",8);
  const shape={id:"shape",kind:"shape",x:0,y:0,width:30,height:30,text:""};
  const result=eraseInk([marker,shape],[{x:10,y:0}],3);
  assert.equal(result.find(i=>i.id==="shape"),shape);
  assert.ok(result.filter(i=>i.kind==="marker").length<=2);
});

test("restored eraser does not affect distant strokes",()=>{
  const ink=stroke("distant","pen",[{x:0,y:0},{x:10,y:10}],"#000",2);
  const result=eraseInk([ink],[{x:200,y:200}],4);
  assert.equal(result.length,1);
  assert.equal(result[0].kind,"pen");
});

test("restored eraser uses board-coordinate radius at zoom",()=>{
  const ink=stroke("zoom","pen",[{x:0,y:0},{x:10,y:0},{x:20,y:0}],"#000",3);
  assert.ok(eraseInk([ink],[{x:10,y:0}],6).length<=2);
});

test("new live eraser cuts only the middle of a long two-point stroke",()=>{
 const item=stroke("line","pen",[{x:0,y:0},{x:300,y:0}],"#000",3);
 const pieces=eraseInkAt([item],{x:150,y:0},{x:150,y:0},10);
 assert.equal(pieces.length,2);
 assert.ok(Math.max(...pieces[0].points.map(p=>p.x+pieces[0].x))<150);
 assert.ok(Math.min(...pieces[1].points.map(p=>p.x+pieces[1].x))>150);
});
test("new live eraser preserves other shapes and distant marker",()=>{
 const label={id:"text",kind:"text",x:0,y:0,width:30,height:30,text:"keep"};
 const ink=stroke("mark","marker",[{x:0,y:100},{x:300,y:100}],"#aaf",18);
 const pieces=eraseInkAt([label,ink],{x:150,y:100},{x:150,y:100},10);
 assert.equal(pieces[0],label);
 assert.equal(pieces.length,3);
});
test("new live eraser does not rerender unrelated items",()=>{
 const ink=stroke("line","pen",[{x:0,y:0},{x:300,y:0}],"#000",3);
 const original=[ink];
 assert.equal(eraseInkAt(original,{x:500,y:500},{x:500,y:501},8),original);
});
test("incremental brush movement retains both halves of a stroke",()=>{
 let current=[stroke("line","pen",[{x:0,y:0},{x:300,y:0}],"#000",3)];
 for(let y=-20;y<20;y+=4)current=eraseInkAt(current,{x:150,y},{x:150,y:y+4},8);
 assert.equal(current.length,2);
 assert.ok(current[0].x<10 && current[1].x>140);
});
test("eraser has dedicated capture listeners and keeps tool registry",()=>{
 const app=readFileSync(new URL("../src/BoardApp.tsx",import.meta.url),"utf8");
 const registered=[...app.matchAll(/\{ id: "(select|hand|lasso|pen|marker|eraser|connector|frame|comment|table|formula|graph|checklist|quiz|flashcard|cover|sticky|text|shape|media|linkmedia)", icon:/g)].map(m=>m[1]);
 assert.equal(new Set(registered).size,21);
 assert.ok(app.includes('onPointerDownCapture='));
 assert.ok(app.includes('onPointerMoveCapture='));
 assert.ok(app.includes('onPointerUpCapture='));
 assert.ok(app.includes('paintDurableEraser();'));
 assert.ok(app.includes('recordEraserPoint(p)'));
});

test("eraser edits the permanent document during pointer movement",()=>{
 const app=readFileSync(new URL("../src/BoardApp.tsx",import.meta.url),"utf8");
 const paint=app.slice(app.indexOf("const paintDurableEraser="),app.indexOf("const settleEraserRemote="));
 assert.match(paint,/eraseInkAlongPath\(before,path,g\.weight\/2,\s*item=>canRemoveBoardItem\(item,authUser\.id,isStudent,isBoardOwner\),g\.mode\)/);
 assert.match(paint,/display\(next,true\)[\s\S]*?scheduleInkCheckpoint\(\)/);
 assert.ok(app.includes("const recordEraserPoint=(point:Point)=>"));
 assert.doesNotMatch(app,/eraserPreviewCanvas|previewEraserSegment/);
});

test("eraser hover and active strokes publish world-space cursors without rerender or interfering with pan",()=>{
 const app=readFileSync(new URL("../src/BoardApp.tsx",import.meta.url),"utf8");
 const hover='if(tool==="eraser")return; // hover/erase presence is handled in capture';
 assert.ok(app.includes(hover));
 const handler=app.slice(app.lastIndexOf('onPointerMove={(e) => {',app.indexOf(hover)),app.indexOf(hover));
 assert.ok(handler.includes('if(eraserSession.current||pinchState.current||consumedTouchIds.current.has(e.pointerId))return;'));
 assert.match(handler,/activeGesture\?\.mode==="pan"[\s\S]*?move\(e\);\s*return;/);
 const start='onPointerMoveCapture={(e) => {';
 const capture=app.slice(app.indexOf(start)+start.length,app.indexOf('          }}\n          onPointerUpCapture=',app.indexOf(start)));
 assert.ok(capture.length>0);
 const sent=[],painted=[],recorded=[];
 const ref=current=>({current});
 const state={
  touchPoints:ref(new Map([[1,{}]])),touchMove:()=>false,inertSurfaceDragPointer:ref(null),
  gesture:ref(null),tool:"eraser",rightPress:ref(null),eraserSession:ref(null),
  pinchState:ref(null),consumedTouchIds:ref(new Set()),adminHidden:false,
  view:{x:20,y:30,zoom:2},local:(x,y)=>({x:x-100,y:y-50}),
  world:({x,y})=>({x:(x-20)/2,y:(y-30)/2}),
  cursorChannel:ref({sendCursor:(x,y)=>sent.push({x,y})}),
  setLiveEraserCursor:(...a)=>painted.push(a),previewEraserSegment:()=>{},
  recordEraserPoint:p=>recorded.push(p),
 };
 const run=new Function(...Object.keys(state),"e",capture);
 const move=(overrides={})=>run(...Object.values(state),{pointerId:1,pointerType:"mouse",clientX:160,clientY:120,preventDefault(){},stopPropagation(){},...overrides});
 move();
 assert.deepEqual(sent,[{x:20,y:20}],"Hover reaches the other participant even above a widget");
 assert.deepEqual(painted,[[60,70,"mouse"]]);
 state.eraserSession.current={pointer:1,last:{x:20,y:20},zoom:2};
 move({clientX:180});
 assert.deepEqual(sent.at(-1),{x:30,y:20},"Cursor tracks an active erase before pointerup");
 assert.deepEqual(recorded,[{x:30,y:20}]);
 assert.deepEqual(painted.at(-1),[80,70,"mouse",true]);
 move({pointerId:2});
 assert.equal(sent.length,2,"A second pointer cannot hijack the current eraser cursor");
 state.adminHidden=true;move({clientX:190});
 assert.equal(sent.length,2,"Hidden administrators do not reveal their presence through the eraser");
 state.adminHidden=false;state.eraserSession.current=null;state.gesture.current={mode:"pan"};
 move();assert.equal(sent.length,2,"Camera navigation keeps its fast path");
 state.gesture.current=null;move({pointerType:"touch"});
 assert.equal(sent.length,2,"Touch without an active erase should not broadcast a hover");
 state.pinchState.current={};move();assert.equal(sent.length,2,"Pinch does not leak cursor samples");
 for(const [from,to] of [['onPointerDownCapture={(e) => {','onPointerMoveCapture='],['onPointerUpCapture={(e) => {','onPointerCancelCapture=']]){
  const part=app.slice(app.indexOf(from),app.indexOf(to,app.indexOf(from)));
  assert.match(part,/if\(!adminHidden\)cursorChannel\.current\?\.sendCursor\(p\.x,p\.y\)/,"Start and finish publish the cursor even without pointermove");
 }
 assert.ok(!app.includes("setEraserCursor("));
 assert.ok(!app.includes("eraserCursor &&"));
 assert.ok(app.includes('el.style.visibility="visible"'));
});

test("eraser checkpoints during gesture and makes one local undo step",()=>{
 const app=readFileSync(new URL("../src/BoardApp.tsx",import.meta.url),"utf8");
 assert.ok(app.includes("if (saveBlocked || gesture.current || eraserSession.current) return;"));
 const finish=app.slice(app.indexOf("const finishEraser="),app.indexOf("const currentDocument ="));
 assert.equal([...finish.matchAll(/commit\(itemsRef\.current,\{immediatePaint:true,previousItems:g\.before\}\)/g)].length,1);
 assert.match(finish,/commit\(itemsRef\.current,\{immediatePaint:true,previousItems:g\.before\}\)[\s\S]*?flushSave\(\)/);
 assert.ok(app.includes("eraserSession.current=null;"));
});

