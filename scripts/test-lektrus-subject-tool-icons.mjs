import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import ts from "typescript";
import "./test-lektrus-illustration-layout.mjs";
import "./test-lektrus-subject-routing.mjs";
import "./test-lektrus-subject-catalogue-ui.mjs";

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
const ids=[...registryBlock.matchAll(/\{id:"([^"]+)"/g)].map(m=>m[1]).filter(id=>id!=="chem-assignments");
const scienceBlock=science.slice(science.indexOf("export const scienceToolGroups"),
 science.indexOf("const legacyMolecules"));
const scienceIds=[...scienceBlock.matchAll(/\{id:"([^"]+)",subject:/g)].map(m=>m[1]);
const expected=[...new Set([...ids,...scienceIds])];
const iconDefs=[...icons.matchAll(/^\s+"([a-z0-9-]+)":<>([^\n]+)<\/>[,]?$/gm)]
 .map(([,id,body])=>({id,body}));
const iconIds=iconDefs.map(x=>x.id);
assert.equal(ids.length,35,"Registry scanner must cover explicit classroom tools");
assert.ok(registryBlock.includes('id:"chem-assignments"'),
 "Chemical task authoring must be registered separately from the legacy subject icon atlas");
assert.ok(!registryBlock.includes('label:palette.label+" · учебная доска"'),
 "Subject worksheets must not appear as eleven separate subject tools");
assert.ok(registry.includes('id.startsWith("subject-board-")'),
 "Existing worksheets must stay available through the shared item factory");
assert.ok(app.includes('aria-label="Предметная доска"'),
 "The universal worksheet must be accessible from the main toolbar");
assert.ok(icons.includes('if(id.startsWith("subject-board-")||id==="chem-assignments")'),
 "New worksheet and task tools must render dedicated vector symbols");
assert.equal(scienceIds.length,7,"Registry scanner must cover four physics and three chemistry editors");
assert.equal(new Set(iconIds).size,iconIds.length,"Each icon ID is declared once");
for(const id of expected){
 assert.ok(iconIds.includes(id),"Missing dedicated subject icon: "+id);
 const icon=iconDefs.find(x=>x.id===id);
 assert.ok(icon?.body && /<path\b|<rect\b|<circle\b|<ellipse\b/.test(icon.body),
  "Missing vector artwork for "+id);
}
assert.equal(expected.length,42,"Redundant molecules tool must be absent from the active catalogue");
assert.ok(!expected.includes("chem-molecules"),"Molecules and bonds must not be selectable");
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
assert.ok(panel.includes("const subjectToolSections:Record<string,"),
 "Use a curated semantic layout for every classroom subject");
for(const name of ["Разбор","Практика","Карты и хронология","Информация","Программирование и алгоритмы","Логика"]){
 assert.ok(panel.includes(name),"Missing compact subject section: "+name);
}
assert.ok(panel.includes('section.items.map(t=>'),"Render tightly grouped subject tool cards");
assert.ok(panel.includes('title={t.description??t.label}'),"Preserve tool details in hover tooltips");
assert.ok(!panel.includes("lektrus-subject-tool-search")&&!panel.includes("searchTerm"),
 "Remove the inconsistent embedded search from all subject menus");
assert.ok(!styles.includes(".lektrus-subject-tool-search"),
 "Remove dead subject-search CSS");
assert.ok(styles.includes("grid-template-columns:repeat(2,minmax(0,1fr))"),
 "Use a compact two-column subject catalogue");
assert.ok(styles.includes('body>.lektrus-subject-tools-panel .lektrus-subject-tools-icon>svg'),
 "Portal-mounted panels must receive consistent icon sizing");
assert.ok(styles.includes("prefers-reduced-motion:reduce"));
// The visual language is shared with the ordinary pencil/select/eraser icons.
const inkStyles=read("src/lektrusBoardToolIcons.css");
const entry=read("src/main.tsx");
const appIconBody=app.slice(app.indexOf("const iconBody ="),app.indexOf("function Icon("));
const appSvg=app.slice(app.indexOf("function Icon("),app.indexOf("function loadInitial("));
assert.ok(appSvg.includes('strokeWidth={compactCategory?1.9:name==="section-arrows"?2.4:1.9}'),
 "The regular board toolbar must retain its 1.9px stroke system");
for(const name of ["select","hand","pen","marker","eraser","shape","table","graph"]){
 assert.ok(appIconBody.includes('case "'+name+'"'),"Regular board tool icon missing: "+name);
}
assert.ok(icons.includes('strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"'),
 "Subject glyphs must use the same 1.9px round-line geometry as the board");
assert.equal(iconIds.length,new Set(iconIds).size,"Icon names must stay unique");
assert.ok(iconIds.length>=43,"Icon inventory must cover every school subject");
assert.ok(!/stroke="#[0-9a-f]{3,8}"/i.test(icons),"All subject glyphs must inherit monochrome ink");
for(const token of ["--lektrus-tool-ink:#3b424b","--lektrus-tool-tile:#f5f6f8",
 ":root[data-theme=\"dark\"]",".lektrus-subject-tools-icon>svg",
 ".lektrus-elements-catalogue .lektrus-elements-shape-grid",
 ".toolbar.compact-toolbar .tool-button", ".mobile-board-tools button"]){
 assert.ok(inkStyles.includes(token),"Board-wide icon style missing: "+token);
}
assert.ok(entry.includes('import "./lektrusBoardToolIcons.css";'),"Load icon styles after existing themes");


// Original illustration samples approved in the subject-tool visual review must
// be displayed as image atlas artwork, not reduced to stand-in line glyphs.
const start=icons.indexOf("const illustrationIds:SubjectToolId[]=[");
const end=icons.indexOf("const illustrationIndexes=",start);
assert.ok(start>=0&&end>start,"All subject illustration IDs must be registered");
const illustrationIds=[...icons.slice(start,end).matchAll(/"([a-z0-9-]+)"/g)].map(m=>m[1]);
assert.equal(illustrationIds.length,43,"Keep one legacy molecules illustration for existing boards");
assert.equal(new Set(illustrationIds).size,43,"Artwork may not duplicate subject IDs");
for(const id of expected)assert.ok(illustrationIds.includes(id),"Missing subject image: "+id);
assert.ok(icons.includes('const illustrationIndex=illustrationIndexes.get(id)'),
 "Show artwork from the actual selected image atlas rather than simple paths");
assert.ok(icons.includes("<image href={illustrationHref}"),
 "Render an image from the atlas inside the square SVG viewport");
assert.ok(icons.includes('style={{overflow:"hidden"}}'),
 "Keep neighboring illustrations clipped outside their tile");
const artwork=readFileSync(new URL("../public/lektrus-subject-illustrations.png",import.meta.url));
assert.deepEqual([...artwork.subarray(0,8)],[137,80,78,71,13,10,26,10],
 "Subject artwork atlas must be a genuine PNG");
assert.equal(artwork.readUInt32BE(16),672,"Seven 96px atlas columns");
assert.equal(artwork.readUInt32BE(20),672,"Seven 96px atlas rows");
assert.ok(artwork.byteLength>30000,"The subject artwork atlas must retain detailed selected illustrations");
assert.ok(inkStyles.includes("width:34px!important")&&inkStyles.includes("overflow:hidden!important"),
 "Square subject image tiles must be readable without bleeding into neighbors");

console.log("Unique subject tool pictograms:",expected.length,"registered icons +",iconIds.length-expected.length,"additional icons, all connected and responsive: OK");
