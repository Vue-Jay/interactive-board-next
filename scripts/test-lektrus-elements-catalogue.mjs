import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import ts from "typescript";

const read=file=>readFileSync(new URL("../"+file,import.meta.url),"utf8");
for(const file of ["src/App.tsx","src/LektrusElementsCatalogue.tsx","src/LektrusDataChart.tsx"]){
 const source=read(file);
 const parsed=ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
 assert.equal(parsed.parseDiagnostics.length,0,
  file+" has invalid JSX or TypeScript: "+parsed.parseDiagnostics.map(d=>d.messageText).join(" | "));
}
const app=read("src/App.tsx");
const cat=read("src/LektrusElementsCatalogue.tsx");
const chart=read("src/LektrusDataChart.tsx");
const model=read("src/boardModel.ts");
const css=read("src/lektrusElementsCatalogue.css");
assert.ok(app.includes('label:"Текст"'));
assert.ok(app.includes('label:"Фигуры"'));
assert.ok(app.includes('label:"Таблицы и диаграммы"'));
assert.ok(app.includes('case "section-create": return <><path d="M3.5 19 8.5 5'));
assert.ok(app.includes('renderIcon:(id:"text"|"sticky"|"table"|"frame")'));
assert.ok(app.includes('label:"Задания"'),"Tasks remain a separate category");
for(const name of ["twoD","threeD","symbolGroups"]){
 assert.match(cat,new RegExp("const "+name+"(?::[^=\\n]+)?\\s*="),"Missing "+name+" catalogue");
}
for(const solid of ["cube","rectangular-prism","prism","pyramid","triangular-pyramid","sphere","cylinder","cone"]){
 assert.ok(cat.includes('"'+solid+'"'),"Missing 3D object "+solid);
}
assert.ok(cat.includes('onShape(id)'));
assert.ok(cat.includes('if(figuresOnly||mode==="shapes")return'),"2D/3D picker must be reusable in the standalone Shapes tab and tool");
assert.ok(cat.includes('if(mode==="data")return'),"Tables and diagrams must share a dedicated compact tab");
assert.ok(app.includes('className="lektrus-figures-floating"')&&app.includes("<LektrusElementsCatalogue {...elementCatalogueProps} figuresOnly/>"),"Shape tool must expose 2D and 3D");
assert.ok(css.includes("lektrus-figures-floating"),"Floating figure palette must be responsive");
assert.ok(css.includes("repeat(5,minmax(0,1fr))"),"The figure picker should be compact");
assert.ok(cat.includes('onSolid(id)'));
assert.ok(cat.includes('onSymbol(value)'));
assert.ok(cat.includes('onChart'));
assert.ok(app.includes('openGraphEditor(item)')&&app.includes('setPendingMathItem(item)'),
 "3D objects must reuse the existing rotatable model editor without committing before save");
assert.ok(app.includes('const insertSpecialSymbol='));
assert.ok(app.includes('text:glyph'));
assert.ok(app.includes('const createDataChart='));
assert.ok(app.includes('graphFigureId:"lektrus-chart"'));
assert.ok(app.includes('if(item.graphFigureId==="lektrus-chart")return <LektrusDataChartView item={item}/>'));
assert.ok(app.includes('chartEditorItem&&createPortal(<LektrusDataChartEditor'));
assert.ok(app.includes('chartEditorItem ||'),"Diagram editor should pause canvas controls");
assert.ok(chart.includes('type ChartStyle="bar"|"line"|"pie"'));
assert.ok(chart.includes('export const validChartData='));
assert.ok(chart.includes('Math.max(1,...entries.map(e=>e.value))'));
assert.ok(chart.includes('onSave({...item'));
assert.ok(chart.includes('type="number"'));
assert.ok(model.includes('chartStyle?: "bar" | "line" | "pie";'));
assert.ok(model.includes('"graphPurpose","graphFigureId","chartStyle","chartEntries"'),
 "Diagrams must be persisted in board documents");
assert.ok(model.includes('i.graphFigureId==="lektrus-chart"&&('),
 "Invalid persisted diagram data must be rejected");
assert.ok(css.includes('lektrus-mobile-elements-catalogue'));
assert.ok(app.includes('mode={group.label==="Текст"?"text":group.label==="Фигуры"?"shapes":"data"}'),"Mobile category mapping must match desktop");
assert.ok(app.includes('{tool === "shape" && shapeType===null && ('),"The quick picker must close after choosing a figure");
assert.ok(css.includes('grid-template-columns:repeat(4,minmax(0,1fr))'));
const src=read("src/lektrusDataChart.css");
assert.ok(src.includes('@media(max-width:700px)'));
console.log("Lektrus Text and Graphics catalog, 2D/3D figures, symbols, and editable persisted diagrams: source checks OK");
