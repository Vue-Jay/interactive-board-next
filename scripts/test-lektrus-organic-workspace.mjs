import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import ts from "typescript";
const read=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
const canvas=read("src/LektrusOrganicCanvas.tsx");
const editor=read("src/LektrusOrganicEditorPanel.tsx");
const scienceEditor=read("src/LektrusScienceEditor.tsx");
const science=read("src/lektrusScienceCatalog.ts");
const registry=read("src/lektrusSubjectToolRegistry.ts");
const panel=read("src/LektrusSubjectToolsPanel.tsx");
const app=read("src/App.tsx");
const css=read("src/lektrusOrganicWorkspace.css");
const main=read("src/main.tsx");
for(const [name,source] of [["organic canvas",canvas],["organic panel",editor],["science editor",scienceEditor],["board",app]]){
 const ast=ts.createSourceFile(name+".tsx",source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
 assert.equal(ast.parseDiagnostics.length,0,name+": TSX syntax must be valid");
}
const active=science.slice(science.indexOf("export const scienceToolGroups"),science.indexOf("const legacyMolecules"));
assert.ok(active.includes('id:"chem-organic"'),"Organic editor stays available in chemistry");
assert.ok(!active.includes('id:"chem-molecules"'),"Remove the redundant molecules and bonds tool completely from the active catalogue");
assert.ok(science.includes('const legacyMolecules:ScienceToolGroup='),"Existing molecular diagrams must remain readable");
assert.ok(science.includes('legacyMolecules.templates.some('),"Open previously saved molecule graphs");
assert.ok(science.includes('if(id==="chem-molecules")return undefined;'),"Never create an object using the retired tool");
assert.ok(!panel.includes('"chem-molecules"'),"The chemistry tool picker cannot show retired molecules");
assert.ok(registry.includes("...scienceToolGroups.map"),"Active chemistry tools must be derived from visible science groups");
for(const title of ["Управление","Связи","Атомы","Циклы","Группы"])
 assert.ok(canvas.includes('title:"'+title+'"'),"Group the organic editing tools: "+title);
for(const feature of ["const beginGesture=","const endGesture=","const setZoom=","const fit=",
 "const redo=","const viewport=","setPointerCapture(e.pointerId)","getScreenCTM()","ctm.inverse()",
 'onPointerCancel={e=>','onPointerDown={e=>handleAtom','attachFunctionalGroup',
 'const addRing=','touches.current.size===2','onWheel']){
 // Wheel is handled with a non-passive native listener, so it is not a React prop.
 if(feature==="onWheel")assert.ok(canvas.includes('addEventListener("wheel",wheel,{passive:false})'));
 else assert.ok(canvas.includes(feature),"Organic editor interaction missing: "+feature);
}
assert.ok(canvas.includes('className="lektrus-organic-tools-grid"'),"Use a compact tool rail instead of a wrapping strip");
assert.ok(canvas.includes('className="lektrus-organic-stage-actions"'),"Expose undo, redo, zoom and fit");
assert.ok(canvas.includes('tool==="hand"'),"Allow panning with the hand tool");
assert.ok(canvas.includes("pendingBlankTouch.current")&&canvas.includes('e.pointerType==="touch"'),
 "Two-finger zoom must not leave an accidental atom at the first touch");
assert.ok(!canvas.includes("clamp(origin.x+2.15")&&!canvas.includes("clamp(pos.x+2.15"),
 "Organic structures must not be cut off by the old fixed canvas boundaries");
assert.ok(editor.includes('className="lektrus-organic-panel"'),"Use a dedicated full workspace modal");
assert.ok(editor.includes('Сохранить на доску'),"The editor saves into the existing board");
assert.ok(css.includes('height:calc(100dvh - 12px)')&&css.includes('grid-template-columns:226px minmax(0,1fr)'),
 "Full-height editor with a persistent sidebar");
assert.ok(css.includes('@media(max-width:840px)')&&css.includes('overflow-x:auto!important'),
 "Mobile tool rail scrolls without covering the canvas");
assert.ok(main.includes('import "./lektrusOrganicWorkspace.css";'),"Load workspace styles after old organic overrides");
assert.ok(scienceEditor.includes("onOrganicLiveChange")&&scienceEditor.includes("mergeEditedValue"),
 "Organic editor must merge concurrent edits");
assert.ok(app.includes("liveOrganicEditorUpdate(")&&app.includes("editorDiff(latest,updated)"),
 "Publish realtime graph updates to other board participants");
assert.ok(app.includes("finalizePhysicalEditor(next,true)"),
 "Only save a new organic object after explicit confirmation");
console.log("Organic workspace: responsive full-screen canvas, gestures, history, subject cleanup, realtime editing: OK");
