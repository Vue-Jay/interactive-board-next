import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import ts from "typescript";

const read=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
const source=read("src/boardObjectDragSurface.ts");
const js=ts.transpileModule(source,{fileName:"boardObjectDragSurface.ts",compilerOptions:{
 module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {boardObjectAtInertPointerTarget:pickup,BOARD_OBJECT_CONTROL_SELECTOR:controls,
 BOARD_OBJECT_GESTURE_SELECTOR:gestures}=
 await import("data:text/javascript;base64,"+Buffer.from(js).toString("base64"));

class FixtureElement {
 constructor(tag="div",parent=null,{classes=[],attrs={}}={}){
  this.tag=tag.toLowerCase();this.parent=parent;
  this.classes=new Set(classes);this.attrs=attrs;
  this.dataset=Object.fromEntries(Object.entries(attrs).filter(([k])=>k.startsWith("data-"))
   .map(([k,v])=>[k.slice(5).replace(/-([a-z])/g,(_,c)=>c.toUpperCase()),v]));
 }
 matches(selector){
  const attr=selector.match(/\[([\w-]+)(?:=['"]([^'"]+)['"])?\]/);
  const className=selector.match(/\.([\w-]+)/);
  const tag=selector.match(/^[a-z][\w-]*/);
  if(tag&&tag[0]!==this.tag)return false;
  if(className&&!this.classes.has(className[1]))return false;
  if(attr){
   if(!Object.hasOwn(this.attrs,attr[1]))return false;
   if(attr[2]!=null&&String(this.attrs[attr[1]])!==attr[2])return false;
  }
  return !!(tag||className||attr);
 }
 closest(selectors){
  const choices=selectors.split(",").map(s=>s.trim());
  for(let node=this;node;node=node.parent)
   if(choices.some(selector=>node.matches(selector)))return node;
  return null;
 }
 contains(other){
  for(let node=other;node;node=node.parent)if(node===this)return true;
  return false;
 }
}

const object=kind=>new FixtureElement("div",null,{classes:["board-object","object-"+kind],attrs:{"data-object":kind}});
const child=(parent,tag="div",classes=[],attrs={})=>new FixtureElement(tag,parent,{classes,attrs});
const boardTypes=["pen","marker","shape","text","sticky","image","pdf","frame","comment",
 "formula","fraction","table","graph","connector","checklist","quiz","flashcard",
 "cover","linkmedia"];
for(const kind of boardTypes){
 const root=object(kind);
 const inert=child(child(root,"div",["graph-view"]),"span",["description"]);
 assert.equal(pickup(root),root,kind+" root should be draggable");
 assert.equal(pickup(inert),root,kind+" must drag from nested inert heading/label");
 // All real controls remain local to the nested teaching widget.
 for(const tag of ["button","input","textarea","select","a","summary","iframe","video"]){
  assert.equal(pickup(child(inert,tag)),null,kind+" "+tag+" must retain its native action");
 }
 for(const role of ["button","slider","switch","checkbox","tab","textbox"]){
  assert.equal(pickup(child(inert,"g",[],{role})),null,kind+" SVG "+role+" remains interactive");
 }
 assert.equal(pickup(child(inert,"div",[],{"data-board-interactive":"true"})),null,
  kind+" dedicated data-board-interactive node cannot become a drag area");
}
assert.equal(pickup(new FixtureElement("h3")),null,"Plain canvas has no board object");
assert.ok(controls.includes("[data-board-interactive]"));
assert.ok(gestures.includes("[data-board-gesture-owner]"));

// A geography matching container stops pointerdown bubbling on ALL of its
// pixels. Its header, progress labels and blank column space still pick up
// the board object, but answer/reset buttons keep their separate behavior.
const geo=object("graph");
const game=child(geo,"div",["lektrus-geo-game"]);
const heading=child(child(game,"header",["lektrus-geo-game-header"]),"strong");
const progress=child(child(game,"div",["lektrus-geo-game-progress"]),"span");
const column=child(child(game,"section",["lektrus-geo-match-grid"]),"h3");
assert.equal(pickup(heading),geo);
assert.equal(pickup(progress),geo);
assert.equal(pickup(column),geo);
assert.equal(pickup(child(game,"button",["lektrus-geo-match-item"])),null);
assert.equal(pickup(child(game,"button",["lektrus-geo-reset"])),null);
assert.equal(pickup(child(game,"button",["lektrus-geo-flashcard"])),null);

// A worksheet's activity root cannot mark all its plain content interactive.
const worksheet=object("graph");
const activity=child(worksheet,"div",["lektrus-activity-runner"]);
assert.equal(pickup(child(activity,"p",["lektrus-activity-result"])),worksheet);
assert.equal(pickup(child(activity,"h3")),worksheet);
assert.equal(pickup(child(activity,"button")),null);
assert.equal(pickup(child(activity,"input")),null);

// These independently pan / zoom / gesture within the object, regardless of
// board role and tool. Their inert outside frame still moves as one object.
for(const gestureClass of ["lektrus-atlas-map-box","lektrus-lab-bench",
 "lektrus-bio-unified-viewport","lek-anatomy-stage","lektrus-human-stage",
 "graph-point","lektrus-orbit-control","lektrus-ray-control"]){
 const root=object("graph");
 const inner=child(root,"div",[gestureClass]);
 assert.equal(pickup(child(inner,"span")),null,gestureClass+" owns its pointer stream");
 assert.equal(pickup(child(root,"header")),root,gestureClass+" parent header remains movable");
}
const graph=object("graph");
const svg=child(graph,"svg",[],{"data-board-gesture-owner":"true"});
assert.equal(pickup(child(svg,"circle")),null,"Active geometric canvas keeps its own drawing gesture");
const lab=object("graph");
const bench=child(lab,"div",["lektrus-lab-bench"]);
const chalk=child(bench,"div",["lektrus-lab-chalkboard"],{"data-board-drag-surface":"true"});
assert.equal(pickup(child(chalk,"span")),lab,"Inert chemistry chalkboard moves the whole laboratory");
assert.equal(pickup(child(chalk,"button")),null,"Chalkboard controls keep their own actions");

// A control outside the object is irrelevant when a nested board object is
// reached, and a nested editing control inside it must always win.
const outer=new FixtureElement("div",null,{classes:["selection-toolbar-screen"]});
const innerObject=new FixtureElement("div",outer,{classes:["board-object"],attrs:{"data-object":"x"}});
assert.equal(pickup(child(innerObject,"h3")),innerObject);
assert.equal(pickup(child(innerObject,"button")),null);

const app=read("src/App.tsx"),geoSource=read("src/LektrusGeographyTrainingView.tsx");
const subject=read("src/LektrusSubjectActivity.tsx");
const scene=read("src/LektrusChemistryBench.tsx");
const css=read("src/lektrusGeographyTraining.css");
assert.equal(ts.createSourceFile("App.tsx",app,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX).parseDiagnostics.length,0);
assert.ok(app.includes('boardObjectAtInertPointerTarget(target)'));
assert.ok(app.includes('inertSurfaceDragPointer.current=e.pointerId'));
assert.ok(app.includes('gesture.current.mode==="drag"'));
assert.ok(app.includes('if(gesture.current?.pointer===e.pointerId)move(e)'),
 "Bubbling-stopping widgets still advance the drag in capture phase");
assert.ok(app.includes('if(gesture.current?.pointer===e.pointerId){move(e);end();}'),
 "Pointerup must finalize even when the widget swallows bubble events");
assert.ok(app.includes('if(gesture.current?.pointer===e.pointerId)end(true)'),
 "Cancelled drags must roll back object changes");
assert.ok(app.includes('if(inertSurfaceDragPointer.current===e.pointerId)return;'),
 "A bubble pointermove must never double-apply a capture-phase movement");
assert.ok(app.includes('dragItem&&!dragItem.hidden&&canTransformBoardObject(dragItem)'),
 "Locked and student-protected objects must never be moved");
assert.ok(app.includes('tool==="hand"&&e.button===0'),
 "Atlas header pans with hand, but moves its object with selection tool");
assert.ok(app.includes('data-board-gesture-owner={onPickPoint||onAddPoint?"true":undefined}'),
 "Freehand/geometry point editing must retain nested gesture ownership");
assert.ok(app.includes('data-board-interactive="true"\n              stroke="transparent"'),
 "Moving a physics ray must not turn into moving the whole graph object");
assert.match(geoSource,/onPointerDown=\{stop\} onPointerUp=\{stop\}/,
 "Geography must work even with its own bubbling cancellation");
assert.match(css,/\.lektrus-school-on-board \.lektrus-geo-game :is\(/);
assert.match(scene,/data-board-drag-surface="true" aria-live="polite"/);
assert.doesNotMatch(subject,/data-board-interactive="true" onPointerDown=\{stop\} onClick=\{stop\}/,
 "Subject worksheet should not mark all nonclickable whitespace interactive");
for(const path of ["src/LektrusBioMicroscope.tsx","src/LektrusProgrammingView.tsx",
 "src/LektrusRussianSchoolView.tsx","src/LektrusLogicCircuitView.tsx",
 "src/LektrusNextSchoolView.tsx"]){
 assert.match(read(path),/onPointerDown=\{[^}]*stop[^}]*\}/,
  path+" must work even if an embedded lesson stops event bubbling");
}
console.log("Universal board-object capture drag: all 19 ordinary kinds, geography matching, worksheet blanks, 8 nested gestures, real controls and release/cancel semantics PASS.");
