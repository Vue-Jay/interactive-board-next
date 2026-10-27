import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import ts from "typescript";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const js=ts.transpileModule(read("src/lektrusSubjectBoardSizing.ts"),{
 compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}
}).outputText.replace(/^export /gm,"");
const sizing=new Function(js+"\nreturn {nextSubjectBoardHeight,SUBJECT_BOARD_BOTTOM_WARNING,SUBJECT_BOARD_BOTTOM_RESERVE};")();
const {nextSubjectBoardHeight,SUBJECT_BOARD_BOTTOM_WARNING,SUBJECT_BOARD_BOTTOM_RESERVE}=sizing;
assert.equal(SUBJECT_BOARD_BOTTOM_WARNING,120);
assert.equal(SUBJECT_BOARD_BOTTOM_RESERVE,200);
for(const [height,used] of [[470,240],[800,620],[1000,500]]){
 assert.equal(nextSubjectBoardHeight(height,used),null,"Do not resize with comfortable spare space");
}
for(const [height,used] of [[470,351],[470,510],[800,790],[1200,1450],[900,781]]){
 const next=nextSubjectBoardHeight(height,used);
 assert.ok(next>height,"Worksheet must grow, never shrink");
 assert.ok(next-used>=200,"Keep bottom spare room before the last written line");
 assert.equal(next%40,0,"Round to stable steps without resize jitter");
}
assert.equal(nextSubjectBoardHeight(0,10),null);
assert.equal(nextSubjectBoardHeight(100,Number.NaN),null);
const board=read("src/LektrusSubjectBoard.tsx");
const app=read("src/App.tsx");
const solution=read("src/LektrusSubjectBoardSolution.tsx");
const style=read("src/lektrusSubjectBoard.css");
assert.match(board,/const contentRef=useRef<HTMLDivElement>\(null\)/);
assert.match(board,/new ResizeObserver\(measure\)/);
assert.match(board,/content\.scrollHeight\+\(headerRef\.current\?\.offsetHeight/);
assert.match(board,/nextSubjectBoardHeight\(current,used\)/);
assert.match(board,/className="lektrus-subject-board-content" ref=\{contentRef\}/);
assert.match(board,/onRequestHeight\?:\(height:number\)=>void/);
assert.match(app,/height=>growSubjectBoard\(item.id,height\)/);
assert.match(app,/workChannel\.current\?\.publishEdit\(latest.id,editorDiff\(latest,updated\)\)/);
assert.match(solution,/lektrus-school-notebook-left/);
assert.match(solution,/lektrus-school-notebook-right/);
assert.match(solution,/lektrus-school-notebook-given/);
assert.match(solution,/lektrus-school-notebook-working/);
assert.match(solution,/lektrus-school-notebook-find/);
assert.match(solution,/lektrus-school-notebook-result/);
assert.match(solution,/onChange\?text=>patch\("given",text\)/);
assert.match(solution,/onChange\?text=>patch\("work",text\)/);
assert.match(solution,/onChange\?text=>patch\("answer",text\)/);
assert.match(solution,/useLayoutEffect\(\(\)=>/);
assert.match(solution,/el\.style\.height=Math\.max\(el\.scrollHeight/);
assert.match(style,/\.lektrus-school-notebook-left\{border-right:/);
assert.match(style,/\.lektrus-school-notebook-given\{flex:1 0 auto;min-height:175px;\s*border-bottom:/);
assert.match(style,/\.lektrus-subject-board-content\{/);
assert.match(style,/overflow:auto;padding:0!important/);
console.log("School notebook + worksheet growth: correct quadrants, inline writing, live measured content and 200px reserve OK");
