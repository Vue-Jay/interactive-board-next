import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import ts from "typescript";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const panel=read("src/LektrusSubjectToolsPanel.tsx");
const app=read("src/App.tsx");
const panelCss=read("src/lektrusSubjectTools.css");
const paletteCss=read("src/App.css");
for(const [name,source] of [["panel",panel],["app",app]]){
 const ast=ts.createSourceFile(name+".tsx",source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
 assert.equal(ast.parseDiagnostics.length,0,name+" TSX must parse");
}
for(const [subject,ids] of Object.entries({
 "математика":["math-formula","math-fractions","math-geometry","math-coordinate"],
 "физика":["physics-mechanics","physics-graphs","physics-optics","physics-circuits"],
 "химия":["chem-periodic-table","chem-organic","chem-formulas","chem-experiments"],
 "биология":["bio-cell","bio-division","bio-dna","bio-genetics","bio-taxonomy","bio-food-chain","bio-organ-systems"],
 "география":["maps-atlas","contour-atlas","geo-matching","geo-question-cards"],
 "история":["history-atlas","history-timeline","history-family-tree"],
 "информатика":["info-encoding","info-place-value","info-programming","info-flowchart","info-circuit","info-logic"],
 "русский язык":["ru-syntax","ru-morphemes","ru-morphology","ru-phonetics","ru-orthography","ru-sentence-builder"],
 "иностранный язык":["language-sentence-builder","language-flashcards"],
 "литература":["literature-analysis"],
 "обществознание":["civics-structure"]
})){
 const start=panel.indexOf('"'+subject+'":[');
 assert.ok(start>=0,"Missing subject grouping "+subject);
 const following=panel.indexOf(String.fromCharCode(10)+'  "',start+1);
 const closing=panel.indexOf(String.fromCharCode(10)+'};',start+1);
 const end=following>=0?following:closing;
 assert.ok(end>start,"Missing subject group terminator "+subject);
 const section=panel.slice(start,end);
 for(const id of ids)assert.ok(section.includes('"'+id+'"'),"Missing "+id+" under "+subject);
}
assert.ok(panel.includes("const remaining=tools.filter(tool=>!used.has(tool.id))"),
 "Newly registered subject tools must stay discoverable");
assert.ok(!panel.includes('type="search"'),"Subject popup must contain no search input");
assert.ok(!panelCss.includes(".lektrus-subject-tool-search"),"Remove obsolete subject search styles");
assert.ok(panelCss.includes("min-height:63px!important"),"Compact cards, not tall search cards");
assert.ok(app.includes('aria-label="Закрыть поиск инструментов"')&&
 app.includes('onClick={closeCommandPalette}')&&
 app.includes('className="command-palette-close"'),"Palette must have an actual button to close");
assert.ok(app.includes('if (e.key === "Escape")'),"Escape key must still close the command search");
assert.ok(paletteCss.includes(".command-palette-search .command-palette-close"),
 "Add visible and keyboard-accessible search close styling");
console.log("Subject catalogue: compact, search-free, semantic by subject; command search close button: OK");
