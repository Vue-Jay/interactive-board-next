import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import ts from "typescript";
const read=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
const source=read("src/lektrusSentenceDrag.ts");
const js=ts.transpileModule(source,{compilerOptions:{
 target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS
}}).outputText;
const exports={};
new Function("exports",js)(exports);
const {moveSentenceWord:move,sentenceWordDropSlot:slot}=exports;

assert.deepEqual(move(["a","b","c","d"],"c",0),["c","a","b","d"]);
assert.deepEqual(move(["a","b","c","d"],"a",3),["b","c","d","a"]);
assert.deepEqual(move(["a","b","c","d"],"b",2),["a","c","b","d"]);
assert.deepEqual(move(["a","b","c","d"],"b",1),["a","b","c","d"]);
assert.deepEqual(move(["a","b","c","d"],"b",-100),["b","a","c","d"]);
assert.deepEqual(move(["a","b","c","d"],"b",100),["a","c","d","b"]);
assert.deepEqual(move(["a","b","c","d"],"absent",1),["a","b","c","d"]);
// Two identical words with different IDs stay separate throughout reordering.
assert.deepEqual(move(["the-1","cat","the-2"],"the-2",0),["the-2","the-1","cat"]);
const rects=[
 {left:10,top:10,width:60,height:35},
 {left:80,top:10,width:60,height:35},
 {left:10,top:55,width:60,height:35},
 {left:80,top:55,width:60,height:35}
];
assert.equal(slot(10,20,rects),0,"Insert before first word");
assert.equal(slot(78,20,rects),1,"Insert between first two words");
assert.equal(slot(155,20,rects),2,"Insert at end of first wrapped row");
assert.equal(slot(10,63,rects),2,"Insert at start of wrapped row");
assert.equal(slot(150,80,rects),4,"Insert at end of sentence");
assert.equal(slot(200,120,rects),4,"Drop below all rows");
assert.equal(slot(20,20,[]),0,"Single movable chip has no other targets");
const view=read("src/LektrusLanguageSocialView.tsx");
const ast=ts.createSourceFile("LektrusLanguageSocialView.tsx",view,
 ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
assert.equal(ast.parseDiagnostics.length,0,"Sentence editor TSX must parse");
for(const marker of [
 "onPointerDown={event=>beginDrag(event,id)}","onPointerMove={dragWord}",
 "onPointerCancel={event=>endDrag(event,true)}",
 "onLostPointerCapture={releaseLostCapture}","setPointerCapture(event.pointerId)",
 "onKeyDown={event=>reorderWithKeyboard(event,id)}",
 "sentenceWordDropSlot(event.clientX,event.clientY,",
 'aria-label="Соберите предложение, перетаскивая слова в правильном порядке"',
 "lektrus-sentence-drag-preview"
])assert.ok(view.includes(marker),"Sentence drag UI is missing "+marker);
assert.ok(!view.includes("onClick={()=>swap(id)}"),"Remove two-click swap behavior");
assert.ok(!view.includes("Нажмите два элемента"),"Remove obsolete two-click guidance");
const styles=read("src/lektrusSchoolDiagrams.css");
assert.ok(styles.includes(".lektrus-sentence-parts button.is-dragging"));
assert.ok(styles.includes(".lektrus-sentence-drag-preview"));
assert.match(styles,/touch-action:none/,"Touch dragging must not turn into page scrolling");
assert.match(styles,/cursor:grab/,"Use a drag affordance");
console.log("Sentence reorder: mouse/touch pointer insertion slots, wrapped rows, duplicated labels, keyboard controls and drag styles: OK");
