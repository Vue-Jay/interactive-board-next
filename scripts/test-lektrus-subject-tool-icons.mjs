import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import ts from "typescript";

const read=file=>readFileSync(new URL("../"+file,import.meta.url),"utf8");
const app=read("src/App.tsx");
const registry=read("src/lektrusSubjectToolRegistry.ts");
const science=read("src/lektrusScienceCatalog.ts");
const icons=read("src/LektrusSubjectToolIcons.tsx");
const panel=read("src/LektrusSubjectToolsPanel.tsx");
const styles=read("src/lektrusSubjectTools.css");

for(const [file,source] of [
 ["src/App.tsx",app],
 ["src/LektrusSubjectToolIcons.tsx",icons],
 ["src/LektrusSubjectToolsPanel.tsx",panel]
]){
 const parsed=ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
 assert.equal(parsed.parseDiagnostics.length,0,
  file+" contains invalid TSX: "+parsed.parseDiagnostics.map(d=>d.messageText).join("; "));
}
const registryBlock=registry.slice(registry.indexOf("export const subjectToolRegistry"),
 registry.indexOf("export function subjectToolsFor"));
const ids=[...registryBlock.matchAll(/\{id:"([^"]+)"/g)].map(m=>m[1]);
const scienceBlock=science.slice(science.indexOf("export const scienceToolGroups"),
 science.indexOf("export function scienceToolGroupForId"));
const scienceIds=[...scienceBlock.matchAll(/\{id:"([^"]+)",subject:/g)].map(m=>m[1]);
const expected=[...new Set([...ids,...scienceIds])];
const iconDefs=[...icons.matchAll(/^\s+"([a-z0-9-]+)":<>([^\n]+)<\/>[,]?$/gm)]
 .map(([,id,body])=>({id,body}));
const iconIds=iconDefs.map(x=>x.id);
assert.equal(ids.length,35,"Registry scanner must cover explicit classroom tools");
assert.equal(scienceIds.length,8,"Registry scanner must cover physics and chemistry");
assert.equal(new Set(iconIds).size,iconIds.length,"Each icon ID is declared once");
for(const id of expected){
 assert.ok(iconIds.includes(id),"Missing dedicated subject icon: "+id);
 const icon=iconDefs.find(x=>x.id===id);
 assert.ok(icon?.body && /<path\b|<rect\b|<circle\b|<ellipse\b/.test(icon.body),
  "Missing vector artwork for "+id);
}
assert.ok(expected.length>=43,"Cover the full subject-tool catalogue");
assert.ok(iconIds.includes("geo-climate"),"Prepare the available geographic climate module icon");
assert.ok(new Set(iconDefs.filter(x=>expected.includes(x.id)).map(x=>x.body)).size===expected.length,
 "No two registered classroom tools should share exactly the same pictogram");
assert.ok(app.includes('import LektrusSubjectToolIcon from "./LektrusSubjectToolIcons";'),
 "Board must import the dedicated icon system");
assert.ok(app.includes('icon:<LektrusSubjectToolIcon id={entry.id} size={24}/>'),
 "Each registered subject tool should display its own icon rather than generic shape/text");
assert.ok(!app.includes('entry.id==="math-coordinate"||entry.id==="physics-graphs"'),
 "Generic graph/shape/text icon switching must be removed");
assert.ok(panel.includes('className="lektrus-subject-tools-icon"'));
assert.ok(panel.includes('const shownTools=searchTerm?tools.filter('),
 "Subject tools must be searchable by name, purpose, and group");
assert.ok(panel.includes('tools.length>4&&<div className="lektrus-subject-tool-search"'),
 "Do not display a full search bar for short subject catalogues");
assert.ok(panel.includes('shownTools.filter(t=>(t.group||"Инструменты")===group)'),
 "Search must filter rendered instrument cards");
assert.ok(panel.includes('setSearch("");onSubjectChange(e.target.value)'),
 "Switching school subjects must clear an old query");
assert.ok(panel.includes('Ничего не найдено'),
 "Empty search results must be clear to the user");
assert.ok(styles.includes('.lektrus-subject-tools-panel .lektrus-subject-tool-search>div:focus-within'),
 "Search input must have a visible keyboard focus indicator");
assert.ok(styles.includes('body>.lektrus-subject-tools-panel .lektrus-subject-tools-icon>svg'),
 "Portal-mounted panels must receive consistent icon sizing");
assert.ok(styles.includes("prefers-reduced-motion:reduce"));
console.log("Unique subject tool pictograms:",expected.length,"registered icons +",iconIds.length-expected.length,"additional icons, all connected and responsive: OK");
