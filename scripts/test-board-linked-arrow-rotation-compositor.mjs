import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import ts from "typescript";

const app=readFileSync("src/App.tsx","utf8");
const drag=readFileSync("src/boardDragCompositor.ts","utf8");
const compile=(source)=>ts.transpileModule(source,{compilerOptions:{
 module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022
}}).outputText;

const connectBegin=app.indexOf("const connectorItemFromPoints =");
const connectEnd=app.indexOf("const snappedConnectorEnd =",connectBegin);
const bindBegin=app.indexOf("const bindingPoint =");
const bindEnd=app.indexOf("const connectorAnchor =",bindBegin);
const syncBegin=app.indexOf("const syncBoundConnectors =");
const syncEnd=app.indexOf("function Connector(",syncBegin);
assert.ok(connectBegin>0&&connectEnd>connectBegin&&bindBegin>0&&bindEnd>bindBegin);
assert.ok(syncBegin>0&&syncEnd>syncBegin);
let factory=app.slice(connectBegin,connectEnd);
assert.ok(factory.includes("const pad = Math.max(12, weight * 3);"));
factory=factory.replace("const pad = Math.max(12, weight * 3);",
 "rebuilds++;const pad = Math.max(12, weight * 3);");
const runtime=[
 "let rebuilds=0;",
 factory,app.slice(bindBegin,bindEnd),app.slice(syncBegin,syncEnd),
 "exports.connectorItemFromPoints=connectorItemFromPoints;",
 "exports.syncBoundConnectors=syncBoundConnectors;",
 "exports.rebuilds=()=>rebuilds;"
].join("\n");
const model={};
new Function("exports","createId",compile(runtime))(model,()=>"generated");
const helper={};
new Function("exports",compile(drag))(helper);

const many=Array.from({length:10000},(_,i)=>({
 id:"object-"+i,kind:i%7?"text":"graph",
 x:i*6,y:i%71*10,width:120,height:90
}));
const standalone=Array.from({length:600},(_,i)=>model.connectorItemFromPoints(
 {x:i*12,y:60},{x:i*12+130,y:100},
 "arrow","#567",3,"unbound-"+i,"straight",undefined,undefined,
 "", "diamond",14
));
const noAttachments=[...many,...standalone];
const before=model.rebuilds();
for(let n=0;n<120;n++)
 assert.strictEqual(model.syncBoundConnectors(noAttachments),noAttachments,
  "A connector without bindings must not be rebuilt during unrelated edits");
const actualStandaloneRebuilds=model.rebuilds()-before;
assert.equal(actualStandaloneRebuilds,0,
 "No unnecessary connector reconstruction on 120 visual frames");
// Previous implementation rebuilt all 600 standalone connectors per frame.
const oldStandaloneRebuilds=standalone.length*120;

const a={id:"a",kind:"graph",x:100,y:200,width:200,height:100};
const b={id:"b",kind:"text",x:500,y:250,width:130,height:100};
const startBinding={itemId:"a",nx:1,ny:.5};
const endBinding={itemId:"b",nx:0,ny:.5};
const start={x:a.x+a.width,y:a.y+a.height*.5};
const end={x:b.x,y:b.y+b.height*.5};
const original=model.connectorItemFromPoints(start,end,"double","#339",3,
 "link","elbow",startBinding,endBinding,"word","diamond",17);
original.createdBy="teacher";
const doc=[a,b,original];
assert.strictEqual(model.syncBoundConnectors(doc),doc,
 "Attached but unmoved endpoints must preserve connector and array identity");
assert.ok(helper.canCompositeBoardDrag(doc,new Set(["a","b"])));
assert.deepEqual(Array.from(helper.compositeLinkedConnectorIds(doc,new Set(["a","b"]))),
 ["link"],"Both endpoints translating together must make the arrow eligible");
assert.equal(helper.canCompositeBoardDrag(doc,new Set(["a"])),true,
 "One moving endpoint stays on a constant-cost SVG preview");
const partialPlan=helper.planCompositeBoardDrag(doc,new Set(["a"]));
assert.deepEqual([...partialPlan.deformed],["link"]);
assert.equal(partialPlan.linked.size,0);
assert.equal(helper.compositeLinkedConnectorIds(doc,new Set(["a"])),null);
assert.equal(helper.canCompositeBoardRotation(doc,"a"),false,
 "Rotation with bound endpoints retains the safe full geometry path");

const dx=47,dy=-31;
const translated=helper.translatedBoardDragItems(doc,new Set(["a","b"]),dx,dy);
const finalized=model.syncBoundConnectors(translated);
const link=finalized[2];
assert.equal(link.x,original.x+dx);
assert.equal(link.y,original.y+dy);
assert.equal(link.width,original.width);
assert.equal(link.height,original.height);
assert.deepEqual(link.connectorStart,original.connectorStart);
assert.deepEqual(link.connectorEnd,original.connectorEnd);
assert.equal(link.arrowHeadStyle,"diamond");
assert.equal(link.arrowHeadSize,17);
assert.equal(link.createdBy,"teacher","Connector creator must not be lost");
const stable=model.syncBoundConnectors(finalized);
assert.strictEqual(stable,finalized,"Repeated final synchronization must be idempotent");
const partial=model.syncBoundConnectors(helper.translatedBoardDragItems(
 doc,new Set(["a"]),dx,dy));
assert.equal(partial[2].x+partial[2].connectorStart.x,start.x+dx,
 "Moving just one endpoint must update its absolute world coordinate");
assert.equal(partial[2].y+partial[2].connectorStart.y,start.y+dy,
 "The moving endpoint follows the selected object");
assert.equal(partial[2].connectorEnd.y+partial[2].y,end.y,
 "The unmoved connector endpoint must stay anchored");


const fakeAttr=()=>({attrs:{},setAttribute(k,v){this.attrs[k]=v}});
const elbowPath=fakeAttr(),elbowLabel=fakeAttr(),straightLine=fakeAttr();
const movingOnly=new Set(["a"]);
for(let frame=1;frame<=240;frame++)
 helper.paintBoardDeformedConnector(
  {item:original,path:elbowPath,label:elbowLabel},
  movingOnly,dx*frame/240,dy*frame/240);
const endCoords=helper.connectorDragEndpoints(original,movingOnly,dx,dy);
assert.deepEqual(endCoords.start,
 {x:original.connectorStart.x+dx,y:original.connectorStart.y+dy});
assert.deepEqual(endCoords.end,original.connectorEnd);
assert.equal(elbowPath.attrs.d,
 `M ${endCoords.start.x} ${endCoords.start.y} H ${(endCoords.start.x+endCoords.end.x)/2} V ${endCoords.end.y} H ${endCoords.end.x}`);
assert.equal(elbowLabel.attrs.transform,
 `translate(${(endCoords.start.x+endCoords.end.x)/2} ${(endCoords.start.y+endCoords.end.y)/2})`);
const normalized=model.connectorItemFromPoints(
 {x:original.x+endCoords.start.x,y:original.y+endCoords.start.y},
 {x:original.x+endCoords.end.x,y:original.y+endCoords.end.y},
 original.connectorStyle,original.color,original.weight,original.id,
 original.connectorRouting,original.connectorStartBinding,original.connectorEndBinding,
 original.text,original.arrowHeadStyle,original.arrowHeadSize);
for(const key of ["x","y","width","height","connectorStart","connectorEnd"])
 assert.deepEqual(normalized[key],partial[2][key],
  "Live peer geometry must exactly match durable geometry: "+key);
helper.paintBoardDeformedConnector(
 {item:original,path:elbowPath,label:elbowLabel},movingOnly,0,0);
assert.equal(elbowPath.attrs.d,
 `M ${original.connectorStart.x} ${original.connectorStart.y} H ${(original.connectorStart.x+original.connectorEnd.x)/2} V ${original.connectorEnd.y} H ${original.connectorEnd.x}`,
 "Cancel restores the original elbow connector");
helper.paintBoardDeformedConnector(
 {item:{...original,connectorRouting:"straight"},line:straightLine},
 movingOnly,dx,dy);
assert.equal(straightLine.attrs.x1,String(original.connectorStart.x+dx));
assert.equal(straightLine.attrs.y1,String(original.connectorStart.y+dy));
assert.equal(straightLine.attrs.x2,String(original.connectorEnd.x));
assert.equal(straightLine.attrs.y2,String(original.connectorEnd.y));

// A delayed/missing binding must be removed, while the user's arrowhead and
// authorship stay intact.
const lost=model.syncBoundConnectors([a,{...original,connectorEndBinding:{
 itemId:"missing",nx:0,ny:0
}}]);
assert.equal(lost[1].connectorEndBinding,undefined);
assert.equal(lost[1].createdBy,"teacher");
assert.equal(lost[1].arrowHeadStyle,"diamond");

assert.equal(helper.canCompositeBoardRotation([a],"a"),true);
assert.equal(helper.canCompositeBoardRotation([{...a,kind:"pen"}],"a"),false);
const visual={style:{rotate:"",transform:"rotate(15deg)"}};
const outline={style:{rotate:"",transform:"rotate(15deg)"}};
for(let frame=0;frame<240;frame++){
 helper.paintBoardRotationPreview(visual,outline,frame*.5);
 assert.equal(visual.style.transform,"rotate(15deg)");
 assert.equal(outline.style.rotate,visual.style.rotate);
}
assert.equal(visual.style.rotate,"119.5deg");
helper.clearBoardRotationPreview(visual,outline);
assert.equal(visual.style.rotate,"");
assert.equal(outline.style.rotate,"");

assert.match(app,/const paintCompositorRotation=\(g:Gesture,base:Item,rotation:number\):boolean=>\{/);
assert.match(app,/paintBoardRotationPreview\(preview\.element,preview\.outline,delta\)/);
assert.match(app,/publishTransform\(\[\s*toBoardObjectPose\(\{\.\.\.preview\.base,rotation\},preview\.origin\)/);
assert.match(app,/if\(!paintCompositorRotation\(g,base,rotation\)\)/);
assert.match(app,/const rotatePreview=compositorRotation\.current\?\.gesture===g/);
assert.match(app,/syncBoundConnectors\(\s*translatedBoardDragItems\(/);
assert.match(app,/if\(dragPreview\|\|rotatePreview\)flushSync/);
assert.match(app,/clearBoardRotationPreview\(rotatePreview\.element,rotatePreview\.outline\)/);
assert.match(app,/const plan=planCompositeBoardDrag\\(g\\.before,selected\\)/);
assert.match(app,/paintBoardDeformedConnector\\(target,preview\\.selected,dx,dy\\)/);
assert.match(app,/connectorDragEndpoints\\(attached,preview\\.selected,dx,dy\\)/);
console.log(JSON.stringify({
 test:"linked arrow + single rotation compositor",
 objects:many.length,unboundConnectors:standalone.length,frames:120,
 oldEstimatedUnboundArrowRebuilds:oldStandaloneRebuilds,
 actualUnboundArrowRebuilds:actualStandaloneRebuilds,
 linkedRigidTranslation:"preserves endpoint offsets and arrowhead",
 partialLink:"exact 240-frame SVG path and label, normalized peer coordinates",rotationFrames:240,
 note:"Deterministic operation counts, not measured real-device FPS."
}));
