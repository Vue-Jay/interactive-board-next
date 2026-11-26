import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import ts from "typescript";
const read=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
async function load(...paths){
 const combined=paths.map(path=>read(path).replace(/^import(?: type)?[^\n]*$/gm,"")).join("\n");
 const js=ts.transpileModule(combined,{compilerOptions:{
   target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022
 }}).outputText;
 return import("data:text/javascript;base64,"+Buffer.from(js).toString("base64"));
}
const {movePhysicalPart,physicalPartPivot,mechanicsValid,mechanicsForceOrigin,mechanicsReattachForce}=await load(
 "src/lektrusMechanicsModel.ts","src/lektrusCircuitModel.ts","src/lektrusPhysicalBoardMove.ts");
const {mergeEditedValue,editorDiff,applyEditorOps}=await load("src/lektrusLiveEditorMerge.ts");
const body={id:"body-a",kind:"block",x:200,y:240,width:90,height:60,mass:2,label:"m"};
const bodyB={...body,id:"body-b",x:450};
const force={id:"force-a",bodyId:"body-a",x:0,y:0,angle:0,length:100,magnitude:10,label:"F",showValue:true};
const mechanism={version:1,bodies:[body,bodyB],supports:[],forces:[force],grid:true,labels:true};
const shell={id:"physics",kind:"graph",x:0,y:0,width:840,height:530,scienceMechanics:mechanism};
const attached={...force,x:-35,y:-20};
const signed={...mechanism,forces:[attached]};
assert.equal(mechanicsValid(signed),true,"Forces can start left/above the body center");
assert.deepEqual(mechanicsForceOrigin(attached,signed),{x:165,y:220});
const reanchored={...attached,...mechanicsReattachForce(attached,signed,bodyB)};
assert.equal(mechanicsValid({...signed,forces:[reanchored]}),true);
assert.deepEqual(mechanicsForceOrigin(reanchored,signed),{x:165,y:220});
assert.equal(mechanicsValid({...signed,forces:[{...attached,bodyId:null}]}),false,"Free forces must remain on the sheet");
assert.equal(mechanicsValid({...signed,forces:[{...attached,x:-961}]}),false);
assert.equal(mechanicsValid({...signed,forces:[{...attached,bodyId:"missing"}]}),false);
const edgeDoc={...signed,bodies:[{...body,x:0,y:0},bodyB]};
assert.deepEqual(mechanicsReattachForce(attached,edgeDoc),{bodyId:null,x:0,y:0});
const boardSource=read("src/boardModel.ts").replace(/\bexport\s+(?=(?:type|interface|const|let|function|class)\b)/g,"");
const boardJS=ts.transpileModule(boardSource,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}}).outputText.replace(/^\s*export\s*\{.*\};?\s*$/gm,"");
const persisted=new Function(boardJS+"\nreturn validMechanicsPayload;")();
for(const doc of [signed,{...signed,forces:[reanchored]},{...signed,forces:[{...attached,bodyId:null}]},{...signed,forces:[{...attached,x:-961}]}])
 assert.equal(persisted(doc),mechanicsValid(doc),"Board persistence must agree with editor validation");
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
const code=read("src/BoardApp.tsx"),board=read("src/LektrusPhysicalBoardView.tsx");
assert.ok(code.includes("onPhysicalPartMove={!presentation&&!item.locked"),"Board edit requires writable state");
assert.ok(code.includes("!structurallyLockedForStudent(item)"),"Student permissions are enforced");
assert.match(code,/editable=\{!!onPhysicalPartMove\}/,"Physics objects must render read-only for viewers");
assert.match(code,/workChannel\.current\?\.publishEdit\(latest\.id,editorDiff\(latest,changed\)\)/);
assert.ok(code.includes("scienceOptics")&&code.includes("scienceCircuit")&&code.includes("scienceMechanics"));
assert.ok(code.includes("onLiveChange={(before,next)=>livePhysicalEditorUpdate"),"Fullscreen editors must publish their edits");
assert.ok(code.includes("onLiveChange={(before,next)=>liveMotionGraphUpdate"),"Motion graphs must publish independent edits");
// The receiver now validates all board object families through the durable
// parser, instead of accepting only the old hardcoded set of science editors.
const {boardObjectLiveOps,isLiveBoardObjectField}=await load("src/lektrusLiveEditorMerge.ts","src/boardLiveObjectEdits.ts");
const parseBoard=new Function(boardJS+"\nreturn parseDocument;")();
const motion={id:"motion",kind:"graph",graphFigureId:"physics-motion",graphPurpose:"coordinates",x:0,y:0,width:600,height:400,text:"График",graphPoints:[{id:"p1",x:1,y:2,label:"A"}]};
const nextMotion={...motion,graphPoints:[{id:"p1",x:3,y:4,label:"B"}]};
const packet=JSON.parse(JSON.stringify(boardObjectLiveOps(motion,nextMotion)));
assert.ok(packet.length&&packet.every(op=>isLiveBoardObjectField(op.path[0])));
const parsePreview=item=>parseBoard(JSON.stringify({version:1,title:"",view:{x:0,y:0,zoom:1},items:[item]})).items[0];
assert.deepEqual(parsePreview(applyEditorOps(motion,packet)).graphPoints,nextMotion.graphPoints);
assert.throws(()=>parsePreview({...motion,graphPoints:[{x:"invalid",y:2,label:"A"}]}));
assert.ok(code.includes("validated=parseDocument(JSON.stringify("),"Peer previews must pass durable validation");
assert.ok(code.includes("preview.graphFigureId!==stored.graphFigureId"),"Live mutations cannot change graph identity");
for(const source of ["src/LektrusMechanicsEditor.tsx","src/LektrusOpticsEditor.tsx",
 "src/LektrusCircuitEditor.tsx","src/LektrusPhysicsGraphEditor.tsx"]){
 const text=read(source);
 assert.match(text,/onLiveChange\?\./,"Existing editors must stream current document mutations");
 assert.match(text,/mergeEditedValue\(/,"Existing editors must rebase remote changes");
 assert.ok(text.includes('shared?"Готово":"Сохранить на доску"'),
   "Existing edited objects must not present a misleading discard button");
}
assert.ok(read("src/LektrusMechanicsEditor.tsx").includes("LektrusMechanicsToolIcon"),"Styled mechanics palette");
assert.ok(read("src/LektrusMechanicsView.tsx").includes("data-board-interactive"));
assert.match(read("src/LektrusMechanicsView.tsx"),/rotate\(\$\{-s.angle\}\)\`}\>\s*\{editable&&<rect className="mechanics-hit"/,
 "The support hit area must share its rotation transform");
assert.ok(read("src/LektrusOpticsView.tsx").includes("data-board-interactive"));
assert.ok(read("src/LektrusCircuitView.tsx").includes("data-board-interactive"));
console.log("Physics collaboration: direct component move, wires, attached forces, concurrent ID merges, live updates and read-only permissions OK.");
