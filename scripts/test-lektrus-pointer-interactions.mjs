import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import ts from "typescript";
const read=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
const source=read("src/rectSelection.ts");
const js=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
const {normalizeSelectionRect,itemIntersectsSelection,itemsInsideRect}=
  await import("data:text/javascript;base64,"+Buffer.from(js).toString("base64"));
const rect=normalizeSelectionRect({x:250,y:210},{x:100,y:70});
assert.deepEqual(rect,{x:100,y:70,width:150,height:140});
const base=(id,x,y,w=50,h=50)=>({id,kind:"shape",x,y,width:w,height:h,text:""});
const a=base("inside",110,90),b=base("outside",350,380);
const stroke={id:"ink",kind:"pen",x:0,y:0,width:201,height:201,text:"",weight:3,
  points:[{x:90,y:100},{x:300,y:100}]};
const nearMiss={id:"miss",kind:"marker",x:0,y:0,width:400,height:400,text:"",weight:8,
  points:[{x:50,y:50},{x:50,y:320},{x:390,y:320}]};
const groupA={...base("groupA",100,100),groupId:"related"};
const groupB={...base("groupB",450,450),groupId:"related"};
assert.equal(itemIntersectsSelection(stroke,rect),true,"a crossing stroke is selected");
assert.equal(itemIntersectsSelection(nearMiss,rect),false,"stroke bounding box alone is insufficient");
assert.equal(itemIntersectsSelection({...a,hidden:true},rect),false);
assert.equal(itemIntersectsSelection({...a,rotation:45},rect),true);
assert.deepEqual(itemsInsideRect([a,b,stroke,nearMiss,groupA,groupB],{x:100,y:70},{x:250,y:210}).sort(),
 ["inside","ink","groupA","groupB"].sort());
assert.deepEqual(itemsInsideRect([a],{x:10,y:10},{x:10,y:10}),[]);
const app=read("src/App.tsx");
const css=read("src/lektrusBoardInteraction.css");
assert.ok(app.includes('useState<Tool>("select")'),"selection must be default");
assert.ok(!app.includes('{ id: "hand", icon: "hand"'),"no hand in tools");
assert.ok(!app.includes('KeyH: "hand"'),"no hand shortcut");
assert.ok(!app.includes('setTool("hand")'),"no hand command");
assert.ok(app.includes('["select","lasso"] as Tool[]'));
assert.ok(app.includes('mode="marquee";'));
assert.ok(app.includes('itemsInsideRect(itemsRef.current,startWorld,last)'));
assert.ok(app.includes('e.button===2 && e.pointerType==="mouse"'));
assert.ok(app.includes('const dragged=right.dragged'));
assert.ok(app.includes('if(!dragged)openBoardContextMenu'));
assert.ok(app.includes('if(e.nativeEvent.button!==2)'));
assert.ok(app.includes('createPortal('));
assert.ok(css.includes('z-index:2147482400!important'));
assert.ok(css.includes('cursor:grabbing!important'));
assert.ok(css.includes('pointer-events:none'));
assert.ok(read("src/main.tsx").includes('import "./lektrusBoardInteraction.css";'));
assert.ok(app.includes('saveRemoteBoardDocument'),"core persistence is unchanged");
console.log("Lektrus pointers: marquee geometry and strokes, hand pan, context portal, default arrow passed.");
