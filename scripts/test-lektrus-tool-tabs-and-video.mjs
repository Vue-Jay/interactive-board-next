import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import ts from "typescript";

const read=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
const app=read("src/App.tsx");
const toolCss=read("src/lektrusToolLayout.css");
const cursorCss=read("src/lektrusObjectChrome2026.css");
const syntax=ts.createSourceFile("App.tsx",app,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
assert.equal(syntax.parseDiagnostics.length,0,"Board TSX must parse");

const section=app.match(/const desktopToolSections=([^;]+);/);
assert.ok(section,"Desktop tool sections must exist");
const groups=[...section[1].matchAll(/\{id:"([^"]+)",label:"([^"]+)",icon:"([^"]+)" as IconName,ids:\[([^\]]+)\] as Tool\[\]\}/g)]
 .map(([,id,label,icon,ids])=>({id,label,icon,ids:[...ids.matchAll(/"([^"]+)"/g)].map(m=>m[1])}));
assert.deepEqual(groups.map(g=>g.id),["create","assignments","media"],
 "Tool sections are text/figures/tables, assignments and media, without a separate arrow tab");
assert.equal(groups[0].label,"Текст и графика");
assert.equal(groups[1].label,"Задания");
for(const tool of ["text","sticky","shape","table","connector","frame"])
 assert.ok(groups[0].ids.includes(tool),tool+" must be in the text/figures/tables tab");
for(const tool of ["checklist","quiz","flashcard","cover"])
 assert.ok(groups[1].ids.includes(tool),tool+" must be in the assignments tab");
assert.deepEqual(groups[2].ids,["media","linkmedia"]);
assert.equal(new Set(groups.flatMap(g=>g.ids)).size,groups.flatMap(g=>g.ids).length,
 "No tool can occur in multiple categories");
assert.ok(app.includes('<LektrusElementsCatalogue {...elementCatalogueProps}/>'),
 "The combined tab uses a classified elements catalogue");
const elements=read("src/LektrusElementsCatalogue.tsx");
assert.ok(elements.includes('(["line","arrow","double"] as const)'),
 "The catalog supports all three line and arrow variants");
assert.ok(elements.includes('onConnector(type)'),"Connector style remains selectable");

assert.match(app,/case "section-create": return [^\n]*M3 8h13/);
assert.match(app,/case "section-assignments": return [^\n]*rect x="4" y="3"/);
assert.match(app,/case "linkmedia": return [^\n]*rect x="2\.5" y="5"/);
assert.doesNotMatch(app,/case "linkmedia": return [^\n]*M20\.5 5 17 8\.5/,
 "Video button must no longer depict a link");
assert.ok(app.includes('label: "Видео · L / Д"'));
assert.ok(app.includes('linkmedia:"Видео"'));
assert.ok(app.includes('title={id==="linkmedia"?undefined:t.label}'),"custom tooltip must not double with native title");
assert.ok(app.includes('title={id==="linkmedia"?"Видео прикрепляется по ссылке":t.label}'),"mobile tool receives a native link hint");
assert.ok(app.includes('lektrus-video-hover-hint'));
assert.ok(toolCss.includes('.lektrus-video-hover-hint'));
assert.ok(toolCss.includes('button:is(:hover,:focus-visible) .lektrus-video-hover-hint'));
assert.ok(toolCss.includes('.lektrus-tool-overflow-popover .lektrus-tool-overflow-grid .lektrus-video-hover-hint'),
 "Tool menu is a document.body portal, so tooltip selectors must not depend on .workspace ancestry");
assert.ok(read("src/lektrusElementsCatalogue.css").includes(".lektrus-elements-heading"));

const mobileGroups=app.match(/const mobileToolGroups:[\s\S]*?= \[([\s\S]*?)\];/);
assert.ok(mobileGroups);
for(const [label,names] of [
 ["Текст и графика",["text","shape","table","connector"]],
 ["Задания",["checklist","quiz","flashcard","cover"]],
 ["Фото, PDF и видео",["media","linkmedia"]]
]){
 const line=mobileGroups[1].split("\n").find(x=>x.includes('label:"'+label+'"'));
 assert.ok(line,"Mobile section missing "+label);
 for(const kind of names)assert.ok(line.includes('"'+kind+'"'),label+" must contain "+kind);
}
const match=cursorCss.match(/\.board\.board-tool-linkmedia:[\s\S]*?cursor:url\("([^"]+)"\)/);
assert.ok(match,"Video placement cursor must be present");
const decoded=decodeURIComponent(match[1]);
assert.ok(decoded.includes('<rect x="9" y="11" width="12" height="10"'),
 "Video placement cursor should depict a camera");
assert.ok(!decoded.includes('m-1 8 12-9'),"Video cursor must not use oversized link artwork");
console.log("Lektrus toolbar category regrouping, mobile parity, video icon, hover hint and cursor: OK");
