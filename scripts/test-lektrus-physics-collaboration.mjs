import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {build} from "esbuild";
const read=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
async function load(path){
 const compiled=await build({entryPoints:[path],bundle:true,platform:"node",format:"esm",write:false,
   target:"es2022",logLevel:"silent"});
 return import("data:text/javascript;base64,"+Buffer.from(compiled.outputFiles[0].text).toString("base64"));
}
const {movePhysicalPart,physicalPartPivot}=await load("src/lektrusPhysicalBoardMove.ts");
const {mergeEditedValue,editorDiff,applyEditorOps}=await load("src/lektrusLiveEditorMerge.ts");
const body={id:"body-a",kind:"block",x:200,y:240,width:90,height:60,mass:2,label:"m"};
const bodyB={...body,id:"body-b",x:450};
const force={id:"force-a",bodyId:"body-a",x:0,y:0,angle:0,length:100,magnitude:10,label:"F",showValue:true};
const mechanism={version:1,bodies:[body,bodyB],supports:[],forces:[force],grid:true,labels:true};
const shell={id:"physics",kind:"graph",x:0,y:0,width:840,height:530,scienceMechanics:mechanism};
const moved=movePhysicalPart(shell,{kind:"body",id:"body-a"},250,270);
assert.equal(moved.scienceMechanics.bodies[0].x,250);
assert.equal(moved.scienceMechanics.bodies[1].x,450);
assert.deepEqual(physicalPartPivot(moved,{kind:"force",id:"force-a"}),{x:350,y:270},
 "Force must stay attached to body when body moves on the board");
const adjusted=movePhysicalPart(moved,{kind:"force",id:"force-a"},250,160);
assert.ok(Math.abs(adjusted.scienceMechanics.forces[0].angle-90)<1);
assert.equal(adjusted.scienceMechanics.forces[0].length,110);
const peer=movePhysicalPart(shell,{kind:"body",id:"body-b"},515,270);
const combined=mergeEditedValue(shell,moved,peer);
assert.equal(combined.scienceMechanics.bodies[0].x,250);
assert.equal(combined.scienceMechanics.bodies[1].x,515);
const streamed=applyEditorOps(peer,editorDiff(shell,moved));
assert.equal(streamed.scienceMechanics.bodies[0].x,250,
 "Live mutation must update the intended body by ID");
assert.equal(streamed.scienceMechanics.bodies[1].x,515,
 "Live mutation must not reset a concurrently edited body");
const optic={version:1,grid:true,labels:true,normals:true,rays:[],
  elements:[{id:"lens1",kind:"converging-lens",x:260,y:250,label:"",focalLength:150,length:210,n1:1,n2:1.5},
  {id:"mirror1",kind:"mirror",x:660,y:250,label:"",focalLength:150,length:210,n1:1,n2:1.5}]};
const optics={...shell,scienceMechanics:undefined,scienceOptics:optic};
const movedLens=movePhysicalPart(optics,{kind:"optical",id:"lens1"},320,275);
const movedMirror=movePhysicalPart(optics,{kind:"optical",id:"mirror1"},640,250);
const combinedOptics=mergeEditedValue(optics,movedLens,movedMirror);
assert.equal(combinedOptics.scienceOptics.elements[0].x,320);
assert.equal(combinedOptics.scienceOptics.elements[1].x,640);
const resistor={id:"r",type:"resistor",x:250,y:250,rotation:0,label:"R",value:"10 Ом"};
const lamp={id:"l",type:"lamp",x:500,y:250,rotation:0,label:"L",value:""};
const circuit={version:1,components:[resistor,lamp],junctions:[],
  wires:[{id:"w",from:{kind:"terminal",componentId:"r",side:"b"},
    to:{kind:"terminal",componentId:"l",side:"a"},route:"straight"}],
  showGrid:true,snap:true};
const cItem={...shell,scienceMechanics:undefined,scienceCircuit:circuit};
const movedCircuit=movePhysicalPart(cItem,{kind:"component",id:"r"},347,323);
assert.equal(movedCircuit.scienceCircuit.components[0].x,340,"Snap must work on board");
assert.equal(movedCircuit.scienceCircuit.components[0].y,320);
assert.equal(movedCircuit.scienceCircuit.wires[0].from.componentId,"r","Wires preserve terminal anchors");
const code=read("src/App.tsx"),board=read("src/LektrusPhysicalBoardView.tsx");
assert.ok(code.includes("onPhysicalPartMove={!presentation&&!item.locked"),"Board edit requires writable state");
assert.ok(code.includes("!structurallyLockedForStudent(item)"),"Student permissions are enforced");
assert.match(code,/editable=\{!!onPhysicalPartMove\}/,"Physics objects must render read-only for viewers");
assert.match(code,/workChannel\.current\?\.publishEdit\(latest\.id,editorDiff\(latest,changed\)\)/);
assert.ok(code.includes("scienceOptics")&&code.includes("scienceCircuit")&&code.includes("scienceMechanics"));
assert.ok(code.includes("onLiveChange={(before,next)=>livePhysicalEditorUpdate"),"Fullscreen editors must publish their edits");
assert.ok(read("src/LektrusMechanicsEditor.tsx").includes("LektrusMechanicsToolIcon"),"Styled mechanics palette");
assert.ok(read("src/LektrusMechanicsView.tsx").includes("data-board-interactive"));
assert.ok(read("src/LektrusOpticsView.tsx").includes("data-board-interactive"));
assert.ok(read("src/LektrusCircuitView.tsx").includes("data-board-interactive"));
console.log("Physics collaboration: direct component move, wires, attached forces, concurrent ID merges, live updates and read-only permissions OK.");
