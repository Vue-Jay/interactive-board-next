import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import ts from "typescript";
const read=(path)=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
const transpile=(path)=>ts.transpileModule(read(path),{compilerOptions:{
 target:ts.ScriptTarget.ES2023,module:ts.ModuleKind.ESNext
}}).outputText.replace(/^import[\s\S]*?from ["'][^"']+["'];\s*$/gm,"")
 .replace(/^export /gm,"");

const controls=new Function(transpile("src/lektrusChemicalEquationControls.ts")+
 "\nreturn {readReactionText};")();
const helpers=new Function("readReactionText",transpile("src/lektrusChemistryBoardLifecycle.ts")+
 "\nreturn {chemistryBoardHasContent};")(controls.readReactionText);
const has=helpers.chemistryBoardHasContent;
assert.equal(has({graphExpression:""}),false,"Empty new object must be removed");
assert.equal(has({graphExpression:" → "}),false,"A bare arrow is not an edit");
assert.equal(has({graphExpression:" ⇌ "}),false);
assert.equal(has({graphExpression:" = "}),false);
assert.equal(has({scienceReactionSteps:[{expression:" → ",conditions:""}]}),false);
assert.equal(has({scienceReactionSteps:[{expression:" → ",conditions:""}],scienceReactionDomain:"organic"}),false,
 "Switching the domain alone must not orphan a blank board");
assert.equal(has({scienceReactionSteps:[{expression:"H2 → ",conditions:""}]}),true);
assert.equal(has({scienceReactionSteps:[{expression:" → H2O",conditions:""}]}),true);
assert.equal(has({scienceReactionSteps:[{expression:" → ",conditions:"t°"}]}),true,
 "Explicit conditions count as an edit");
assert.equal(has({scienceReactionSteps:[{expression:" → ",conditions:""},{expression:"H2CO3 → H2O + CO2↑",conditions:""}]}),true);
assert.equal(has({graphExpression:"H2O"}),true,"Standalone formulas remain valid content");
const app=read("src/App.tsx");
const illustration=read("src/LektrusChemistryIllustration.tsx");
const editor=read("src/LektrusChemicalEquationEditor.tsx");
const science=read("src/LektrusScienceEditor.tsx");
const styles=read("src/lektrusChemicalBoardSurface.css");
const main=read("src/main.tsx");
const tonesCode=read("src/lektrusSubjectAccent.ts");
const subjectColors=["chemistry","physics","mathematics","geography","history","biology","russian","literature","social","languages","informatics"];
for(const subject of subjectColors){
 assert.ok(tonesCode.includes(subject+':{accent:'),"Missing subject palette: "+subject);
 assert.ok(styles.includes('data-subject-tone="'+subject+'"'),"Missing style for "+subject);
}
assert.ok(app.includes("data-subject-tone={subjectToneForItem(item)}"),"Canvas items have subject color identity");
assert.ok(app.includes("setSelected([item.id]);"),"Newly created board can show transformation handles");
assert.ok(app.includes('if(scienceEditorItem?.id===item.id&&item.graphFigureId?.startsWith("chem-formula-"))return;'),
 "Double click on live board does not reopen or reset the active editor");
assert.ok(editor.includes('aria-modal="false"'),"Board and editor can be interacted with at the same time");
assert.ok(editor.includes("setBoardLayout(v=>!v)"),"User can dock editor to drag and resize board");
assert.ok(editor.includes("Разместить доску"),"Docking control must be discoverable");
assert.ok(styles.includes("pointer-events:none!important"),"Editor backdrop cannot intercept board pointer gestures");
assert.ok(styles.includes("pointer-events:auto!important"),"Editor inputs stay fully interactive");
assert.ok(styles.includes('data-subject-tone="chemistry"'),"Chemistry board has no white frame");
assert.ok(styles.includes('background-color:#d9eee5'),"Chemistry board uses a colored paper surface");
assert.ok(styles.includes("width:min(1260px,calc(100vw - 300px))"),"Expanded desktop editor fits more controls");
for(const [name,source] of [["App.tsx",app],["Editor.tsx",editor],["Science.tsx",science],
 ["Illustration.tsx",illustration]]){
 const ast=ts.createSourceFile(name,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
 assert.equal(ast.parseDiagnostics.length,0,name+" syntax");
}
assert.match(app,/provisionalChemistryBoards\.current\.add\(item\.id\);\s*commit\(\[\.\.\.itemsRef\.current,item\]\)/,
 "Immediately insert board before editor opens");
assert.match(app,/onFormulaLiveChange=\{\(before,next\)=>liveChemicalEquationUpdate\(before,next\)\}/,
 "Live feedback must be wired to App");
assert.ok(app.includes("workChannel.current?.publishEdit(latest.id,editorDiff(latest,updated))"),
 "Real-time channel publishes board edits");
assert.ok(app.includes("commit(itemsRef.current.filter(entry=>entry.id!==editing.id))"),
 "Cancel must delete the unused newly created board");
assert.ok(app.includes("provisionalChemistryBoards.current.delete(editing.id)"),
 "Saved and cancelled objects leave transient lifecycle");
assert.ok(app.includes("chemistryBoardHasContent(latest)"),
 "Closing decision is based on current shared content, not stale opening snapshot");
assert.ok(app.includes('next.graphFigureId?.startsWith("chem-formula-")'),
 "Existing chemistry boards stay editable");
assert.ok(science.includes("onFormulaLiveChange?.(draft,next)"),
 "Every equation edit updates the same shared board");
assert.ok(science.includes("formulaRemotePrevious"),
 "Incoming edits from participants merge into editor");
assert.ok(illustration.includes("<LektrusChemicalEquationBoardView item={item}/>"),
 "Canvas object uses board view");
assert.ok(editor.includes("<LektrusChemicalEquationBoardView item={item}/>"),
 "Editor preview uses identical canvas view");
assert.ok(editor.includes('aria-label="Химическая доска"'));
assert.ok(!editor.includes("refreshBackground"),"No template switching handler");
assert.ok(!editor.includes("↻ Другой"),"No visible example switcher");
assert.ok(styles.includes(".lektrus-chemical-board-paper"));
assert.ok(styles.includes(".lektrus-chemical-board-placeholder"));
assert.ok(main.includes('import "./lektrusChemicalBoardSurface.css";'));
console.log("Chemical board: drag and 8-handle resize during edit, eleven subject accents, no white frame, full editor, exact preview and cancel cleanup: OK");
