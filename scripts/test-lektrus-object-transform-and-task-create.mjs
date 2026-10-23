import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";
const read=(name)=>fs.readFileSync(new URL("../src/"+name,import.meta.url),"utf8");
const app=read("App.tsx"),chrome=read("lektrusObjectChrome2026.css"),
 interactions=read("lektrusBoardInteraction.css"),main=read("main.tsx");
const syntax=ts.createSourceFile("App.tsx",app,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
assert.equal(syntax.parseDiagnostics.length,0,
 "App board JSX/TypeScript must remain parsable after selection and creation changes");
const captureCount=app.match(/onPointerDownCapture=/g)?.length??0;
assert.equal(captureCount,1,"only one board capture handler must exist");
assert.match(app,/Select at capture time because school widgets/);
assert.match(app,/setSelected\(e.shiftKey\?\[\.\.\.new Set\(\[\.\.\.selected,\.\.\.family\]\)\]:family\)/);
assert.match(app,/data-group-selection-drag="true"/);
assert.match(app,/data-board-selection-grip="true"/);
assert.match(app,/mode:"drag",start,view/);
assert.match(app,/data-transform-handle=\{h\}/);
assert.match(app,/data-group-transform-handle=\{h\}/);
assert.match(app,/selectedItems.length > 1 && selectionScreenBounds/);
assert.match(app,/singleSelected && singleSelected.kind !== "connector"/);
assert.match(app,/const beginStudyCreation=\(kind:"checklist"\|"quiz"\|"flashcard"/);
assert.match(app,/setPendingStudyItem\(item\);setSelected\(\[\]\);setTool\("select"\)/);
assert.match(app,/beginStudyCreation\(tool,p\)/);
for(const [kind,name] of [["checklist","Checklist"],["quiz","Quiz"],["flashcard","Flashcard"]]){
 assert.ok(app.includes(`const original=pendingStudyItem?.id===${kind}EditorId?pendingStudyItem:null;`),
  kind+" is pending until explicitly saved");
 assert.ok(app.includes(`const source=original?[...itemsRef.current,original]:itemsRef.current;`),
  kind+" only appends a new board object on Save");
 assert.ok(app.includes(`cancelStudyEditor("${kind}")`),
  kind+" closes without leaving a board object");
 assert.ok(app.includes(`if(original){setSelected([original.id]);setPendingStudyItem(null)}`),
  kind+" selects newly saved board object");
}
assert.ok(!app.includes('window.setTimeout(() => openChecklistEditor(item), 0)'),"no auto-placement for checklist");
assert.ok(!app.includes('window.setTimeout(() => openQuizEditor(item), 0)'),"no auto-placement for quiz");
assert.ok(!app.includes('window.setTimeout(() => openFlashcardEditor(item), 0)'),"no auto-placement for flashcard");
assert.match(chrome,/screen-selection-frame/);
assert.match(chrome,/screen-resize-handle/);
assert.match(chrome,/screen-rotate-handle/);
assert.match(chrome,/lektrus-selection-move-grip/);
assert.match(chrome,/object-pdf,.object-linkmedia/);
assert.match(chrome,/pointer-events:none!important/);
for(const tool of ["sticky","text","shape","connector","frame","comment","table",
 "formula","graph","checklist","quiz","flashcard","cover","media","linkmedia"]){
 assert.ok(chrome.includes(".board.board-tool-"+tool+":not("),
  "missing placement cursor for "+tool);
}
assert.match(main,/lektrusObjectChrome2026\.css/);
assert.match(interactions,/board-tool-pen,.board-tool-marker,.board-tool-eraser/);
const model=read("boardModel.ts");
for(const kind of ["sticky","text","shape","pen","marker","image","pdf","frame",
 "connector","comment","table","formula","graph","fraction","checklist","quiz",
 "flashcard","cover","linkmedia"]){
 assert.ok(model.includes('"'+kind+'"'),"object kind must remain supported: "+kind);
}
console.log("Lektrus universal selection grips, object cursors, and save-before-placement assignments: checks passed.");
