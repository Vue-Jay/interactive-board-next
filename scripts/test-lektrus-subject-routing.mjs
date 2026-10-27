import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import ts from "typescript";

const read=name=>readFileSync(new URL("../"+name,import.meta.url),"utf8");
const registry=read("src/lektrusSubjectToolRegistry.ts");
const app=read("src/App.tsx");
const subjects=read("src/lektrusSchoolSubjects.ts");
const registryStart=registry.indexOf("export const subjectToolRegistry");
const registryEnd=registry.indexOf("export function subjectToolsFor",registryStart);
const entries=registry.slice(registryStart,registryEnd);
const rx=/\{id:"([a-z0-9-]+)",label:"[^"]+",description:"[^"]+",group:"[^"]+",subjects:\[([^\]]*)\]\}/g;
const definitions=[...entries.matchAll(rx)].map(([,id,raw])=>({id,subjects:[...raw.matchAll(/"([^"]+)"/g)].map(m=>m[1])}));
assert.equal(definitions.length,34,"Check all visible school tools; obsolete Russian sentence builder is hidden");
const humanities={
 "русский язык":["ru-syntax","ru-morphemes","ru-morphology","ru-phonetics" ,"ru-orthography"],
 "история":["history-timeline","history-family-tree","history-atlas"],
 "обществознание":["civics-structure"],
 "литература":["literature-analysis"],
 "иностранный язык":["language-sentence-builder","language-flashcards"]
};
for(const [subject,expected] of Object.entries(humanities)){
 const actual=definitions.filter(d=>d.subjects.includes(subject)).map(d=>d.id).sort();
 assert.deepEqual(actual,expected.slice().sort(),subject+": subject tool list must not contain foreign tools");
}
assert.deepEqual(definitions.find(d=>d.id==="info-flowchart")?.subjects,["информатика"],
 "Algorithm flowcharts belong only to informatics, never history or social studies");
const registered=new Set(definitions.map(d=>d.id));
assert.equal(registered.size,definitions.length);
for(const d of definitions){
 assert.ok(d.subjects.length>0,d.id+": a tool must have a subject");
 assert.equal(new Set(d.subjects).size,d.subjects.length,d.id+": duplicate subject registration");
 for(const s of d.subjects)assert.ok(subjects.toLocaleLowerCase("ru-RU").includes('"'+s.toLocaleLowerCase("ru-RU")+'"'),
  d.id+": unknown school subject "+s);
}
const appAst=ts.createSourceFile("src/App.tsx",app,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
assert.equal(appAst.parseDiagnostics.length,0,"Valid TSX after catalogue routing change");
assert.ok(!app.includes("const lectrisSubjectTools=useMemo"),
 "Generic board tools must not appear disguised as subject tools");
assert.ok(app.includes('tools={mathematicalSubjectTools.filter(entry=>canEdit&&toolAllowedForRole('),
 "Subject panel must use only the selected subject registry entries");
assert.ok(!app.includes("setTool(id as Tool);setSubjectToolsOpen(false)"),
 "A removed foreign tool must never activate a generic board tool");
console.log("Subject routing: Russian, history, social studies, literature and foreign languages are isolated: OK");
