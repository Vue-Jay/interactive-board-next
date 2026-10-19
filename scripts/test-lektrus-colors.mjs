import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import ts from "typescript";
const source=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
const script=ts.transpileModule(source("src/lektrusSavedColors.ts"),{
  compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext},
}).outputText;
const {DEFAULT_COLORS,MAX_SAVED_COLORS,colorLibraryKey,addSavedColor,removeSavedColor,
  decodeSavedColors,sanitizeSavedColors,validHexColor}=
  await import("data:text/javascript;base64,"+Buffer.from(script).toString("base64"));
assert.equal(DEFAULT_COLORS.length,8);
assert.equal(validHexColor("#ab00Ff"),true);
assert.equal(validHexColor("#ff0000;url()"),false);
assert.notEqual(colorLibraryKey("teacher1"),colorLibraryKey("teacher2"),
  "Favorites must be isolated per user");
assert.deepEqual(decodeSavedColors("{bad"),[]);
assert.deepEqual(decodeSavedColors(JSON.stringify(["#123ABC","#123abc","red","#365fd0"])),["#123abc"]);
let colors=addSavedColor([],"#abc123");
assert.deepEqual(colors,["#abc123"]);
assert.deepEqual(addSavedColor(colors,"#AbC123"),colors);
assert.deepEqual(addSavedColor(colors,"#365fd0"),colors);
assert.deepEqual(removeSavedColor(colors,"#ABC123"),[]);
assert.equal(sanitizeSavedColors(Array.from({length:70},(_,i)=>"#"+i.toString(16).padStart(6,"0"))).length,MAX_SAVED_COLORS);

const picker=source("src/LektrusColorPicker.tsx");
const quick=source("src/LectrisObjectEditor.tsx");
const app=source("src/App.tsx");
const css=source("src/lektrusColors.css");
const entry=source("src/main.tsx");
assert.ok(picker.includes('aria-label="Избранные цвета"'));
assert.ok(picker.includes('aria-label="Смешанная палитра: выбрать произвольный цвет"'));
assert.ok(picker.includes('aria-label="Новый цвет для избранного"'));
assert.ok(picker.includes('☆ Сохранить текущий'));
assert.ok(picker.includes('removeSavedColor(custom,color)'));
assert.ok(picker.includes('createPortal('));
assert.ok(picker.includes('useSyncExternalStore('));
assert.ok(picker.includes('localStorage.setItem('));
assert.ok(quick.includes('userId={props.userId}'));
assert.ok(quick.includes('userId={userId}'));
assert.ok(quick.includes("lektrus-ink-five-widths"),"Ink presets should be visible without opening another settings menu");
assert.ok(quick.includes("INK_WIDTHS"),"Pen, marker and eraser have five thicknesses");
assert.ok(!quick.includes('type="color"'),"Colors should use the shared pair of buttons");
assert.ok(!app.includes('type="color"'),"No old color controls should remain in board/editors");
assert.ok(app.includes('userId={authUser.id}'));
const graphEditor=source("src/LektrusGraphEditor.tsx");
assert.ok(graphEditor.includes('<LektrusColorPicker userId={userId}') && graphEditor.includes('value={p.color??"#111111"}'),
  "Graph editor must use the common picker");
for(const name of ["checklistDraft","flashcardDraft","quizDraft"]){
 assert.ok(app.includes('value={'+name+'.color}'),"Editor "+name+" must use the common picker");
}
assert.ok(css.includes('grid-template-columns:minmax(44px,1fr)'));
assert.ok(css.includes('flex-wrap:wrap!important'));
assert.ok(entry.includes('import "./lektrusColors.css";'));
assert.ok(app.includes('saveRemoteBoardDocument'),"Board persistence is untouched");
console.log("Lektrus color palette: favorites, user isolation, all editor controls, five ink widths and responsive layout OK");
