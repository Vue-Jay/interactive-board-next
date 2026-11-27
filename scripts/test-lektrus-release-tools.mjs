/** Release 1.0: real tool registry, creation and saved-object compatibility smoke. */
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {createServer} from "vite";

const server=await createServer({configFile:"./vite.config.ts",server:{middlewareMode:true},appType:"custom"});
try{
  const {subjectToolsFor,releaseHiddenSubjectToolIds,makeSubjectToolItem}=
    await server.ssrLoadModule("/src/lektrusSubjectToolRegistry.ts");
  const {parseDocument,parseRealtimeDocument}=await server.ssrLoadModule("/src/boardModel.ts");
  const {diffSelfhostDocument,applySelfhostDocumentDelta,projectStudentDocument}=await server.ssrLoadModule("/src/selfhostApi.ts");
  const {mergeBoardDocumentEdits}=await server.ssrLoadModule("/src/lektrusBoardThreeWayMerge.ts");
  const {mergeEditedValue,editorDiff,applyEditorOps}=await server.ssrLoadModule("/src/lektrusLiveEditorMerge.ts");
  const {practiceKey,practiceFitsDiagram,validSchoolPractice}=await server.ssrLoadModule("/src/schoolPractice.ts");
  const {ids,makeSchoolDiagram,isSchoolDiagram}=await server.ssrLoadModule("/src/lektrusSchoolDiagramModel.ts");
  const {atlasModesFor,historicalSnapshots,legacyAtlasModes,createAtlasDocument}=await server.ssrLoadModule("/src/lektrusAtlasModel.ts");
  const roundTrip=(id,schoolDiagram)=>{
    assert.ok(isSchoolDiagram(schoolDiagram),id+" must be accepted by its editor");
    const item={id,kind:"graph",text:schoolDiagram.title,x:0,y:0,width:600,height:360,graphFigureId:id,schoolDiagram};
    const doc={version:1,title:"Round trip",view:{x:0,y:0,zoom:1},items:[item]};
    assert.deepEqual(parseDocument(JSON.stringify(doc)).items[0].schoolDiagram,schoolDiagram,id+" lost or rejected data");
  };
  for(const id of ids){
    let diagram=makeSchoolDiagram(id);
    if(id==="geo-matching"||id==="geo-question-cards")diagram={...diagram,countryCodes:["RU","FR"]};
    roundTrip(id,diagram);
  }
  for(const scope of ["geography","history"]){
    const modes=[...atlasModesFor(scope).map(m=>m.id),...(scope==="geography"?legacyAtlasModes:[])];
    for(const mode of modes)for(const {year} of historicalSnapshots)
      roundTrip(scope==="history"?"history-atlas":"maps-atlas",{...createAtlasDocument(scope),mode,year});
  }
  const chart={id:"temperature",kind:"graph",graphFigureId:"lektrus-chart",text:"Temperature",x:0,y:0,width:560,height:325,chartStyle:"line",chartEntries:[{label:"January",value:-10},{label:"March",value:0},{label:"June",value:20}]};
  const chartDoc={version:1,title:"Chart",view:{x:0,y:0,zoom:1},items:[chart]};
  assert.deepEqual(parseDocument(JSON.stringify(chartDoc)).items[0].chartEntries,chart.chartEntries);
  assert.throws(()=>parseDocument(JSON.stringify({...chartDoc,items:[{...chart,chartStyle:"pie"}]})),/диаграмм/i);

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
    }:id==="history-timeline"?{
      ...item,schoolDiagram:{...item.schoolDiagram,events:[
        {id:"event-1",year:1914,label:"Начало события"},
        {id:"event-2",year:1918,label:"Завершение события"}
      ]}
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

  // Every saved school-diagram kind follows the actual delta + cached peer
  // parser + conflict-rebase path, rather than merely reopening a file.
  let audited=0;
  const exercise=(item)=>{
    const base=parseDocument(JSON.stringify({version:1,title:"Sync audit",view:{x:0,y:0,zoom:1},items:[item]}));
    const changed={...base,items:[{...base.items[0],x:base.items[0].x+17,y:base.items[0].y+23}]};
    const remote={...base,items:[{...base.items[0],rotation:12}]};
    const wire=projectStudentDocument(base,base,changed);
    assert.ok(wire,item.id+" projection");
    const delta=diffSelfhostDocument(base,wire);
    const received=parseRealtimeDocument(applySelfhostDocumentDelta(base,delta),new WeakMap());
    assert.deepEqual(received,parseDocument(JSON.stringify(changed)),item.id+" peer convergence");
    const merged=mergeBoardDocumentEdits(base,changed,remote);
    assert.equal(merged.items[0].x,changed.items[0].x,item.id+" local position");
    assert.equal(merged.items[0].rotation,12,item.id+" independent remote rotation");
    const deleted={...base,items:[]};
    assert.deepEqual(mergeBoardDocumentEdits(base,changed,deleted).items,[],item.id+" deleted object resurrected");
    audited++;
  };
  for(const id of ids){
    let schoolDiagram=makeSchoolDiagram(id);
    if(id==="geo-matching"||id==="geo-question-cards")schoolDiagram={...schoolDiagram,countryCodes:["RU","FR"]};
    exercise({id,kind:"graph",text:schoolDiagram.title,x:0,y:0,width:600,height:360,graphFigureId:id,schoolDiagram});
  }
  const types=[
    {kind:"sticky",stickerInk:[]},{kind:"text"},{kind:"shape",shapeType:"rectangle"},
    {kind:"pen",points:[{x:0,y:0},{x:10,y:10}],color:"#202124",weight:3},
    {kind:"marker",points:[{x:0,y:0},{x:10,y:10}],color:"#202124",weight:5},
    {kind:"image",assetId:"image-asset",name:"test.png",mime:"image/png"},
    {kind:"pdf",assetId:"pdf-asset",name:"test.pdf",mime:"application/pdf",pdfPage:1},
    {kind:"frame"},{kind:"connector",connectorStart:{x:0,y:0},connectorEnd:{x:100,y:30},connectorStyle:"arrow"},
    {kind:"comment"},{kind:"table",tableRows:2,tableCols:2,tableCells:["a","b","c","d"]},
    {kind:"formula"},{kind:"graph",graphPurpose:"coordinates",graphPoints:[]},
    {kind:"fraction",fractionNumerator:1,fractionDenominator:2},
    {kind:"checklist",checklistItems:["Task"],checklistDone:[false]},
    {kind:"quiz",quizOptions:["A","B"],quizCorrect:0},
    {kind:"flashcard",flashcardBack:"Answer"},{kind:"cover"},
    {kind:"linkmedia",mediaUrl:"https://example.test/video"},{kind:"instrument",instrumentType:"ruler",instrumentScale:1}
  ];
  for(const fields of types)exercise({id:"kind-"+fields.kind,x:0,y:0,width:300,height:180,text:"Test",...fields});
  const diagram={kind:"sentence-builder",parts:[{id:"a",text:"I"},{id:"b",text:"read"}]};
  const practice={kind:"sentence",key:practiceKey(diagram.parts),order:["b","a"],checked:true};
  assert.ok(validSchoolPractice(practice)&&practiceFitsDiagram(practice,diagram));
  assert.equal(practiceFitsDiagram({...practice,order:["b","unknown"]},diagram),false);
  assert.equal(practiceFitsDiagram(practice,{...diagram,parts:[{id:"a",text:"We"},diagram.parts[1]]}),false);
  assert.equal(practiceKey({b:1,a:2}),practiceKey({a:2,b:1}));
  const pdoc={version:1,title:"Shared practice",view:{x:0,y:0,zoom:1},items:[{id:"practice",kind:"graph",x:0,y:0,width:500,height:300,text:"Sentence",graphFigureId:"language-sentence-builder",schoolDiagram:{...diagram,title:"Sentence",instructions:"Order",showKey:false,showHint:false,patternId:""},schoolPractice:practice}]};
  assert.deepEqual(parseRealtimeDocument(pdoc,new WeakMap()).items[0].schoolPractice,practice);
  // A student's stale response must stay attached to its exercise ID when
  // the teacher moves, inserts or deletes another exercise.
  const a={id:"a",answer:""},b={id:"b",answer:""},c={id:"c",answer:""};
  const start={subjectBoardEntries:[a,b]};
  const local={subjectBoardEntries:[{...a,answer:"student"},b]};
  const remote={subjectBoardEntries:[c,b,a]};
  assert.deepEqual(mergeEditedValue(start,local,remote).subjectBoardEntries,[c,b,{...a,answer:"student"}]);
  assert.deepEqual(mergeEditedValue(start,{subjectBoardEntries:[b,a]},{subjectBoardEntries:[{...a,answer:"remote"},b]}).subjectBoardEntries,[b,{...a,answer:"remote"}]);
  assert.deepEqual(mergeEditedValue(start,local,{subjectBoardEntries:[b]}).subjectBoardEntries,[b]);
  const ops=editorDiff(start,local);
  assert.deepEqual(applyEditorOps(remote,ops).subjectBoardEntries,[c,b,{...a,answer:"student"}]);
  assert.deepEqual(applyEditorOps({subjectBoardEntries:[b]},ops).subjectBoardEntries,[b]);
  console.log("Synchronization audit: "+audited+" universal and school-diagram kinds through projection, delta, actual peer parser, conflict and deletion; shared practice and worksheet ID merge.");
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
