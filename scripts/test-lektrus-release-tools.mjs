/** Release 1.0: real tool registry, creation and saved-object compatibility smoke. */
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {createServer} from "vite";

const server=await createServer({configFile:"./vite.config.ts",server:{middlewareMode:true},appType:"custom"});
try{
  const {subjectToolsFor,releaseHiddenSubjectToolIds,makeSubjectToolItem}=
    await server.ssrLoadModule("/src/lektrusSubjectToolRegistry.ts");
  const {parseDocument}=await server.ssrLoadModule("/src/boardModel.ts");

  const hidden=["bio-anatomy","bio-microscope","info-programming"];
  assert.deepEqual([...releaseHiddenSubjectToolIds].sort(),hidden.slice().sort(),
    "Only the explicitly postponed tools may be hidden from this release");
  for(const subject of ["Биология","Информатика","Математика","Химия","История","География"]){
    const list=subjectToolsFor(subject);
    assert.equal(new Set(list.map(tool=>tool.id)).size,list.length,subject+" duplicate tools");
    for(const id of hidden)assert.ok(!list.some(tool=>tool.id===id),subject+" must not offer "+id);
  }

  // Each subject retains the same "Задания на доске" option as other subjects.
  // No duplicate "+ Предметная доска" button is needed.
  for(const [subject,tone] of [
    ["Биология","biology"],["Информатика","informatics"],["Обществознание","social"],
    ["Литература","literature"]
  ]){
    const tools=subjectToolsFor(subject);
    assert.deepEqual(tools.map(tool=>tool.id),["subject-task-"+tone],
      subject+" must offer only the regular board assignments");
    assert.equal(tools[0].label,"Задания на доске");
    const item=makeSubjectToolItem(tools[0].id,600,400,()=>tone+"-task");
    assert.equal(item.graphFigureId,"subject-board-"+tone,
      "Board assignments must use the existing subject worksheet editor");
  }
  assert.deepEqual(subjectToolsFor("История").map(tool=>tool.id),
    ["subject-task-history","history-atlas"],
    "History must offer board assignments and the historical atlas only");
  assert.ok(!subjectToolsFor("Литература").some(tool=>tool.id==="literature-analysis"),
    "Literature analysis must not be available for new creation");

  const kept={
    "География":["geo-matching","maps-atlas","contour-atlas"],
    "Химия":["chem-experiments","chem-formulas","chem-periodic-table"],
    "Иностранный язык":["language-sentence-builder","language-flashcards"]
  };
  for(const [subject,ids] of Object.entries(kept)){
    const actual=new Set(subjectToolsFor(subject).map(tool=>tool.id));
    for(const id of ids)assert.ok(actual.has(id),subject+" must keep "+id);
  }

  // Hidden means 'cannot create from the catalogue', NOT 'erase existing lessons'.
  // The real item factory and actual document parser still understand old IDs.
  for(const id of [...hidden,"geo-matching","history-atlas","chem-experiments",
    "literature-analysis","civics-structure","history-timeline"]){
    const item=makeSubjectToolItem(id,600,400,()=>id+"-saved");
    assert.equal(item.id,id+"-saved");
    assert.ok(item.schoolDiagram||item.scienceLabBench,id+" must have saved model state");
    // Matching starts as an intentionally UNSAVED draft until the teacher picks countries.
    // A persisted classroom exercise must have at least two distinct countries.
    const savedItem=id==="geo-matching"?{
      ...item,schoolDiagram:{...item.schoolDiagram,countryCodes:["RU","FR"]}
    }:item;
    const doc={version:1,title:"Release compatibility",view:{x:0,y:0,zoom:1},items:[savedItem]};
    let recovered;
    try{recovered=parseDocument(JSON.stringify(doc));}
    catch(error){throw new Error(id+" saved document failed validation",{cause:error});}
    assert.equal(recovered.items.length,1,id+" document must remain readable");
    assert.equal(recovered.items[0].graphFigureId,item.graphFigureId,
      id+" must retain the original tool type");
  }

  // Do not widen document parsing to accept corrupt legacy payloads.
  for(const [id,damage] of [
    ["bio-anatomy",model=>({...model,system:"unknown-system"})],
    ["bio-microscope",model=>({...model,assignmentPath:["wrong-root","bad"]})],
    ["info-programming",model=>({...model,language:"html",code:"x".repeat(25000)})]
  ]){
    const item=makeSubjectToolItem(id,600,400,()=>id+"-corrupted");
    const damaged={...item,schoolDiagram:damage(item.schoolDiagram)};
    assert.throws(()=>parseDocument(JSON.stringify({
      version:1,title:"Rejected invalid document",view:{x:0,y:0,zoom:1},items:[damaged]
    })),/Повреждена предметная учебная схема/,id+" invalid legacy data must be rejected");
  }

  const panel=readFileSync(new URL("../src/LektrusSubjectToolsPanel.tsx",import.meta.url),"utf8");
  assert.ok(panel.includes('title:"Задания на предметной доске"'),
    "The subject panel must display the standard board-assignments item");
  assert.ok(!panel.includes("+ Предметная доска"),
    "The redundant subject-board button must be removed");
  assert.ok(!panel.includes("onCreateBoard")&&!panel.includes("canCreateBoard"),
    "Do not keep hidden duplicate board creation wiring");
  const boardApp=readFileSync(new URL("../src/BoardApp.tsx",import.meta.url),"utf8");
  assert.ok(!boardApp.includes("createUniversalSubjectBoard"),
    "Old independent board creation must not bypass the assignments flow");
  assert.ok(boardApp.includes("subjectToolsFor(lectrisBoardOrganization.subject)"),
    "Visible tool list must flow through the release-aware registry");
  assert.ok(boardApp.includes("mathematicalSubjectTools.some(entry=>entry.id===id)"),
    "Board creation must reject tools outside the visible subject list");
  assert.ok(boardApp.includes('aria-label="AI-помощник по доске"'),
    "The separate board AI assistant must remain available");
  console.log("Lektrus release 1.0: hidden tools removed only from new creation; geography, history, lab and AI kept; older board objects still read.");
}finally{
  await server.close();
}
