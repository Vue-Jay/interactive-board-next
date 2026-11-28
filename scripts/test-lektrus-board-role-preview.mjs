import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import ts from "typescript";

const read=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
const source=read("src/lektrusBoardRolePreview.ts");
const compiled=ts.transpileModule(source,{
 compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}
}).outputText;
const api={};
new Function("exports","require",compiled)(api,()=>({}));
const {
 boardRoleCapabilities,restrictStudentDiagramChange,canUseBoardCreationTool,
 isStudentProtectedBoardObject,canTransformStudentBoardObject,STUDENT_BLOCKED_CREATE_TOOLS,
 STUDENT_PROTECTED_OBJECT_KINDS
}=api;

const metadata=api.canEditBoardMetadata;
assert.equal(metadata("owner","owner"),true);
assert.equal(metadata("editor","co_teacher"),true);
assert.equal(metadata("editor","student"),false);
assert.equal(metadata("editor",undefined),false);
assert.equal(metadata("viewer","observer"),false);
assert.equal(metadata("viewer","observer",true),true);
const boardRoles=["owner","editor","viewer"];
const accountRoles=["teacher","student"];
const previews=["actual","teacher","student","guest"];
const creations=["select","hand","lasso","pen","marker","eraser","text","sticky","shape",
 "connector","comment","image","pdf","frame","table","formula","graph","checklist",
 "quiz","flashcard","cover","linkmedia"];
const protectedKinds=["frame","checklist","quiz","flashcard","cover","linkmedia"];
const {resolveToolbarPins,toolbarPreferenceKey,TOOLBAR_DEFAULT_DESKTOP,TOOLBAR_DEFAULT_TOUCH}=api;
const pinnable=creations.filter(id=>!["select","hand","lasso","formula","graph","comment","image","pdf"].includes(id));
for(const role of ["teacher","student"]){
 const allowed=pinnable.filter(id=>role==="teacher"||!STUDENT_BLOCKED_CREATE_TOOLS.includes(id));
 for(const defaults of [TOOLBAR_DEFAULT_DESKTOP,TOOLBAR_DEFAULT_TOUCH]){
  assert.deepEqual(resolveToolbarPins(null,[],defaults,allowed),[...defaults],"Recover old empty toolbar");
  assert.deepEqual(resolveToolbarPins({version:3,pinned:[]},null,defaults,allowed),[],"Preserve explicitly emptied toolbar");
  assert.deepEqual(resolveToolbarPins({version:3,pinned:["eraser","pen","eraser","invalid"]},null,defaults,allowed),["eraser","pen"],"Preserve custom order");
  assert.deepEqual(resolveToolbarPins({version:3,pinned:["pen","table","checklist"]},null,defaults,allowed),role==="teacher"?["pen","table","checklist"]:["pen"]);
 }
}
assert.deepEqual(resolveToolbarPins(null,["pen","eraser","sticky","text","shape"],TOOLBAR_DEFAULT_TOUCH,pinnable),[...TOOLBAR_DEFAULT_TOUCH]);
const keys=new Set();
for(const role of ["teacher","student"])for(const device of ["touch","desktop"])for(const preview of previews)keys.add(toolbarPreferenceKey("u",role,device,preview));
assert.equal(keys.size,16,"Preview, device and effective role must never share preference keys");
let cases=0;
for(const boardRole of boardRoles){
 for(const accountRole of accountRoles){
  for(const guest of [false,true]){
   for(const adminMaintenance of [false,true]){
    for(const preview of previews){
     const input={preview,boardRole,accountRole,isGuest:guest,
       isAppAdmin:true,adminMaintenance};
     const caps=boardRoleCapabilities(input);
     const expectedCanEdit=boardRole!=="viewer"||adminMaintenance;
     const student=preview==="student"||preview==="guest"||
       preview==="actual"&&boardRole!=="owner"&&
        (guest||accountRole==="student"&&!adminMaintenance);
     assert.equal(caps.canEdit,expectedCanEdit,JSON.stringify(input)+" board membership stays authoritative");
     assert.equal(caps.isStudent,student,JSON.stringify(input)+" effective role");
     assert.equal(caps.effectiveRole,student?"student":"teacher");
     assert.equal(caps.canAnswerContour,expectedCanEdit);
     assert.equal(caps.canAddStudentMedia,expectedCanEdit&&student);
     assert.equal(caps.canCreateAssignments,expectedCanEdit&&!student);
     assert.equal(caps.canUseStudentTools,expectedCanEdit&&student);
     assert.equal(caps.canUseTeacherTools,expectedCanEdit&&!student);
     assert.equal(caps.canManageBoard,expectedCanEdit&&!student&&boardRole==="owner");
     for(const tool of creations){
      const denied=STUDENT_BLOCKED_CREATE_TOOLS.includes(tool);
      const navigation=["select","hand","lasso"].includes(tool);
      assert.equal(canUseBoardCreationTool(tool,caps),
        navigation||expectedCanEdit&&(!student||!denied),
        JSON.stringify(input)+" "+tool);
     }
     for(const kind of [...creations,"fraction","instrument"]){
      assert.equal(isStudentProtectedBoardObject(kind,caps),
        student&&protectedKinds.includes(kind),JSON.stringify(input)+" "+kind);
     }
     cases++;
    }
   }
  }
 }
}
assert.ok(STUDENT_PROTECTED_OBJECT_KINDS.every(kind=>STUDENT_BLOCKED_CREATE_TOOLS.includes(kind)),
 "protected objects must also be unavailable to pupil creation");
assert.ok(["table","formula","graph"].every(kind=>STUDENT_BLOCKED_CREATE_TOOLS.includes(kind)&&!STUDENT_PROTECTED_OBJECT_KINDS.includes(kind)),
 "pupils cannot create structural objects but may reposition existing lesson content");

// Real board ownership outranks the signup category and grants full tools.
for(const accountRole of ["teacher","student"])for(const isGuest of [false,true]){
 const owner=boardRoleCapabilities({preview:"actual",boardRole:"owner",
  accountRole,isGuest,isAppAdmin:false,adminMaintenance:false});
 assert.ok(owner.canManageBoard&&owner.canCreateAssignments&&owner.canUseTeacherTools);
 assert.equal(owner.isStudent,false);
}
// A simulated guest must have exactly the same functionality as a student.
for(const boardRole of boardRoles)for(const accountRole of accountRoles){
 const common={boardRole,accountRole,isAppAdmin:true,adminMaintenance:false,isGuest:false};
 const student=boardRoleCapabilities({...common,preview:"student"});
 const guest=boardRoleCapabilities({...common,preview:"guest"});
 const {isGuestPreview:_g,...guestRights}=guest;
 const {isGuestPreview:_s,...studentRights}=student;
 assert.deepEqual(guestRights,studentRights,
  "guest and student have identical board permissions at "+boardRole);
 for(const tool of creations){
  assert.equal(canUseBoardCreationTool(tool,guest),canUseBoardCreationTool(tool,student));
 }
 for(const kind of protectedKinds){
  assert.equal(isStudentProtectedBoardObject(kind,guest),isStudentProtectedBoardObject(kind,student));
 }
 const realGuest=boardRoleCapabilities({...common,preview:"actual",accountRole:"teacher",isGuest:true});
 const realStudent=boardRoleCapabilities({...common,preview:"actual",accountRole:"student",isGuest:false});
 const {isGuestPreview:__g,...actualGuestRights}=realGuest;
 const {isGuestPreview:__s,...actualStudentRights}=realStudent;
 assert.deepEqual(actualGuestRights,actualStudentRights,
  "anonymous account and registered student receive the same rights on "+boardRole);
}
// Developer tools may not grant extra permissions to ordinary board members.
for(const boardRole of boardRoles)for(const accountRole of accountRoles)
 for(const preview of previews)for(const isGuest of [false,true]){
  const common={boardRole,accountRole,isAppAdmin:false,adminMaintenance:false,isGuest};
  assert.deepEqual(boardRoleCapabilities({...common,preview}),
    boardRoleCapabilities({...common,preview:"actual"}),
    "non-admin cannot spoof a role");
 }
// A normal viewer may never write, even when developer UI selects teacher.
for(const preview of previews){
 const caps=boardRoleCapabilities({
  preview,boardRole:"viewer",accountRole:"teacher",
  isAppAdmin:true,adminMaintenance:false});
 assert.equal(caps.canEdit,false);
 assert.equal(caps.canManageBoard,false);
 for(const tool of creations)assert.equal(canUseBoardCreationTool(tool,caps),
  ["select","hand","lasso"].includes(tool),
  "viewers can navigate but cannot create "+tool);
}
const maintenance=boardRoleCapabilities({
 preview:"actual",boardRole:"viewer",accountRole:"student",
 isAppAdmin:true,adminMaintenance:true
});
assert.equal(maintenance.canEdit,true,"authorized admin maintenance stays functional");
assert.equal(maintenance.canManageBoard,false,"maintenance cannot fake owner");
const noGuestPromotion=boardRoleCapabilities({
 preview:"actual",boardRole:"viewer",accountRole:"teacher",isGuest:true,
 isAppAdmin:false,adminMaintenance:false
});
assert.equal(noGuestPromotion.isStudent,true,"real guest is always a student");
assert.equal(noGuestPromotion.canEdit,false,"viewer remains read-only");

const contour={kind:"atlas",title:"Контурная карта",regionId:"world",
 contourTask:"Задание преподавателя",
 contourAssignment:{allowDrawing:true,showGrid:false},
 contourMarks:[],contourStrokes:[],contourLegend:[],paintedCountries:{}};
const changed={...contour,title:"Чужая запись",regionId:"nowhere",
 contourTask:"Заменено",contourAssignment:{allowDrawing:false,showGrid:true},
 contourMarks:[{id:"m",lon:2,lat:4}],paintedCountries:{FR:"#ffeebb"}};
const guarded=restrictStudentDiagramChange(contour,changed);
assert.equal(guarded.title,contour.title);
assert.equal(guarded.contourTask,contour.contourTask);
assert.equal(guarded.regionId,contour.regionId);
assert.deepEqual(guarded.contourAssignment,contour.contourAssignment);
assert.deepEqual(guarded.contourMarks,changed.contourMarks);
assert.deepEqual(guarded.paintedCountries,changed.paintedCountries);
assert.equal(restrictStudentDiagramChange({...contour,title:"Географические карты"},changed),null);
assert.equal(restrictStudentDiagramChange({kind:"flowchart"},{kind:"flowchart"}),null);
const syntax={kind:"syntax",title:"Найдите подлежащее",showMarks:true,words:[
 {id:"w1",text:"Мама",role:"none"},{id:"w2",text:"читает",role:"none"}]};
const annotated={...syntax,words:[
 {...syntax.words[0],role:"subject"},{...syntax.words[1],role:"predicate"}]};
assert.deepEqual(restrictStudentDiagramChange(syntax,annotated),annotated,
 "students must still annotate teacher sentences");
assert.equal(restrictStudentDiagramChange(syntax,
 {...annotated,words:[{...annotated.words[0],text:"Подмена"},annotated.words[1]]}),null,
 "students cannot replace words in teacher's exercise");
assert.equal(restrictStudentDiagramChange(syntax,
 {...annotated,words:[annotated.words[1],annotated.words[0]]}),null,
 "students cannot reorder or relabel teacher's word IDs");
assert.equal(restrictStudentDiagramChange(syntax,
 {...annotated,words:[...annotated.words,{id:"extra",text:"слово",role:"none"}]}),null,
 "students cannot add teacher words");
assert.equal(restrictStudentDiagramChange(syntax,
 {...annotated,words:[{...annotated.words[0],role:"invented"},annotated.words[1]]}),null,
 "students cannot forge role IDs");
const falseTitle=restrictStudentDiagramChange(syntax,
 {...annotated,title:"Исправленный мною заголовок",showMarks:false});
assert.equal(falseTitle.title,syntax.title);
assert.equal(falseTitle.showMarks,syntax.showMarks);
const digits={kind:"place-value",title:"Разрядная таблица",base:2,digits:"",showPowers:true};
assert.deepEqual(restrictStudentDiagramChange(digits,
 {...digits,digits:"101",base:16,title:"Новый заголовок",showPowers:false}),
 {...digits,digits:"101"},"pupil may type valid digits, not change number base");
assert.equal(restrictStudentDiagramChange(digits,{...digits,digits:"102"}),null,
 "invalid base-2 digits must be rejected");
assert.equal(restrictStudentDiagramChange(digits,{...digits,digits:"1".repeat(11)}),null,
 "pupil answer has a hard length limit");
assert.equal(restrictStudentDiagramChange({kind:"morphology",title:"Имя",rows:[]},
 {kind:"morphology",title:"Подмена",rows:[]}),null,
 "teacher morphology definition cannot be modified as pupil response");
assert.equal(restrictStudentDiagramChange({kind:"phonetics",title:"Звуки",letters:[]},
 {kind:"phonetics",title:"Подмена",letters:[]}),null);
assert.equal(restrictStudentDiagramChange({kind:"orthography",title:"Правило",questions:[]},
 {kind:"orthography",title:"Подмена",questions:[]}),null);
assert.equal(restrictStudentDiagramChange({kind:"sentence-builder",title:"Phrase",parts:[]},
 {kind:"sentence-builder",title:"Подмена",parts:[]}),null,
 "foreign language source is immutable; pupil sorting is local state");

const app=read("src/BoardApp.tsx"),css=read("src/App.css"),model=read("src/boardStore.ts");
for(const [path,code] of [["src/BoardApp.tsx",app],["src/lektrusBoardRolePreview.ts",source]]){
 const parsed=ts.createSourceFile(path,code,ts.ScriptTarget.Latest,true,
  path.endsWith(".tsx")?ts.ScriptKind.TSX:ts.ScriptKind.TS);
 assert.equal(parsed.parseDiagnostics.length,0,path+" syntax parses");
}
assert.match(app,/showAdminControls && developerSettingsOpen/,"developer dialog is admin-only and hidden while simulating another role");
assert.match(app,/id="lektrus-developer-role-preview"/,"developer role buttons are on the board");
assert.match(app,/\(\["teacher","student","guest"\] as const\)\.map/,"quick switching among three roles");
assert.ok(app.includes("aria-pressed={(rolePreview as BoardRolePreview)===role}"),"active role is accessible");
assert.ok(app.includes('changeRolePreview("actual")'),"real-role reset is accessible");
assert.ok(app.includes("useState<BoardRolePreview>(globalRolePreview)")&&
 app.includes("useEffect(()=>setRolePreview(globalRolePreview),[boardSummary.id,globalRolePreview])"),
 "board role follows app-scoped preview state and is not saved to the board");
assert.ok(read("src/App.tsx").includes('useState<"actual"|AccountRole>("actual")'),
 "role preview is transient for the current app session");
assert.doesNotMatch(read("src/developerPreferences.ts"),/rolePreview/,
 "simulation never enters persisted developer preferences");
assert.match(app,/isGuest:authUser\.isGuest===true/,"real guest identity maps to student");
assert.match(app,/canUseBoardCreationTool\(id,roleCapabilities\)/,"single creation policy");
assert.match(app,/isStudentProtectedBoardObject\(item.kind,roleCapabilities\)/,
 "single protected-object policy");
assert.match(app,/onSchoolDiagramChange=\{canEdit/,"on-board teaching answers gated");

const graphView=read("src/LektrusSchoolDiagramView.tsx");
const nextView=read("src/LektrusNextSchoolView.tsx");
const russianView=read("src/LektrusRussianSchoolView.tsx");
const foreignView=read("src/LektrusLanguageSocialView.tsx");
assert.match(app,/<GraphView item=\{item\} studentMode=\{isStudent\}/,
 "actual board role is passed into on-board school diagram controls");
assert.match(graphView,/<LektrusNextSchoolView diagram=\{diagram\} onChange=\{onChange\} studentMode=\{studentMode\}/,
 "syntax and numeric practice receive pupil mode");
assert.match(graphView,/<LektrusRussianSchoolView diagram=\{diagram\} onChange=\{onChange\} studentMode=\{studentMode\}/,
 "Russian school controls receive pupil mode");
assert.match(nextView,/\{!studentMode&&<label>Предложение/,
 "a pupil can annotate but cannot rewrite the sentence input");
assert.match(nextView,/\{studentMode\?<span>Основание:/,
 "a pupil cannot change a teacher's number base");
assert.match(russianView,/const inline=onChange&&!studentMode&&/,
 "teacher source-word and phonetic editor does not appear to pupil");
assert.match(foreignView,/onChange\?\.\(\{\.\.\.d,answerOrder:next,answerChecked:complete\}\)/,
 "foreign-language rearrangement publishes a shared answer");
const sharedSentence={kind:"sentence-builder",title:"Phrase",parts:[{id:"a",text:"I"},{id:"b",text:"read"}]};
assert.deepEqual(restrictStudentDiagramChange(sharedSentence,{...sharedSentence,title:"forged",answerOrder:["b","a"],answerChecked:true}),
 {...sharedSentence,answerOrder:["b","a"],answerChecked:true});
assert.equal(restrictStudentDiagramChange(sharedSentence,{...sharedSentence,answerOrder:["a","a"],answerChecked:true}),null);
const approvedView=read("src/LektrusApprovedSchoolView.tsx");
assert.match(approvedView,/onChange\?\.\(\{\.\.\.d,response:next\}\)/,"Vocabulary publishes only its response");
assert.match(russianView,/onChange\?\.\(\{\.\.\.d,response:next\}\)/,"Orthography publishes only its response");
const vocab={kind:"flashcards",title:"Cards",direction:"foreign-first",cards:[{id:"a",term:"Hello",translation:"Привет",transcription:""}]};
assert.deepEqual(restrictStudentDiagramChange(vocab,{...vocab,title:"forged",response:{index:0,revealed:true}}),{...vocab,response:{index:0,revealed:true}});
assert.equal(restrictStudentDiagramChange(vocab,{...vocab,response:{index:1,revealed:true}}),null);
const spelling={kind:"orthography",title:"Spell",questions:[{id:"a",prompt:"л□с",options:["е","и"],correct:0,explanation:""}]};
assert.deepEqual(restrictStudentDiagramChange(spelling,{...spelling,title:"forged",response:{index:0,picked:0,checked:true}}),{...spelling,response:{index:0,picked:0,checked:true}});
assert.equal(restrictStudentDiagramChange(spelling,{...spelling,response:{index:0,picked:null,checked:true}}),null);
assert.equal(restrictStudentDiagramChange(spelling,{...spelling,response:{index:0,picked:2,checked:false}}),null);
assert.match(app,/const merged=mergeEditedValue\(base,diagram,before.schoolDiagram\);\s*const allowed=isStudent\?restrictStudentDiagramChange\(before.schoolDiagram,merged\):merged;\s*if\(!allowed\|\|!isSchoolDiagram\(allowed\)\)return;/,
 "student edits are merged against the current assignment, restricted and validated before commit");
assert.match(app,/const canChangeBoardMetadata=canEdit&&!isStudent&&!boardSummary.planReadOnly&&canEditBoardMetadata\(/,
 "shared metadata permission must be independent of assignment authoring and ownership-only membership management");
assert.match(app,/const changeBoardSubject=\(subject:string\)=>\{\s*if\(!canChangeBoardMetadata\)return;/);
assert.match(app,/\{canChangeBoardMetadata\?<input\s+aria-label="Название доски"/);
assert.match(app,/<h1 className="lektrus-board-title-static" title=\{title\}>\{title\}<\/h1>/);
assert.match(app,/\{canChangeBoardMetadata&&<LektrusSubjectPicker/);
assert.match(app,/<div className="lektrus-board-identity">\s*<h1 className="lektrus-board-title-static"[^\n]+\n\s*<div className="lektrus-board-subject-static"/);
assert.doesNotMatch(app,/readOnly=\{!canChangeBoardMetadata\}|disabled=\{!canChangeBoardMetadata\}/);
assert.match(app,/canChangeSubject=\{canChangeBoardMetadata\}/);
assert.match(app,/if\(!canCreateAssignments\)\{setNotice\("Создавать задания может только преподаватель/,
 "students cannot generate assignments");
for(const trigger of ["lektrus-mobile-subject-trigger","lektrus-desktop-subject-trigger"]){
 assert.match(app,new RegExp('\\{canCreateAssignments&&<button[^\\n]*'+trigger),
  "only editable teachers see the subject tools trigger: "+trigger);
}
assert.match(app,/\{canCreateAssignments&&subjectToolsOpen&&<LektrusSubjectToolsPanel/,
 "a role change cannot leave the subject tools panel available to students");
assert.match(app,/if \(!canEdit\) \{ setNotice\("У вас доступ только для просмотра"\); return; \}/,
 "write guard remains at board commit");
assert.match(app,/end\(true\);setEditing\(null\);/,
 "switch cancels active interactions");
assert.match(app,/:selectedIds\.has\(item.id\).*?!structurallyLockedForStudent\(item\).*?item.graphPurpose==="geometry"/,
 "students cannot remove vertices from teacher's geometry");
assert.match(app,/onRemovePoint=\{isCoordinatePointGraph\(item\).*?!structurallyLockedForStudent\(item\)/,
 "students cannot remove points from protected coordinate graphs");
assert.match(app,/onGridChange=\{!item.locked&&canEdit&&!structurallyLockedForStudent\(item\)/,
 "students cannot edit protected graph structure");
assert.match(app,/if\(tool!=="select"&&tool!=="hand"&&tool!=="lasso"&&!toolAllowedForRole\(tool\)\)/,
 "role switch invalidates disallowed drawing tools at pointer event boundary");
assert.match(app,/connector && canEdit && !connector.locked && canTransformBoardObject\(connector\)/,
 "viewer cannot drag connector endpoints, while editable pupils can manipulate unlocked lesson connections");
assert.equal(canTransformStudentBoardObject("connector",boardRoleCapabilities({
 preview:"student",boardRole:"owner",accountRole:"student",isAppAdmin:true,adminMaintenance:false
})),true,"students can reposition unlocked lesson connections");
assert.equal(canTransformStudentBoardObject("connector",boardRoleCapabilities({
 preview:"actual",boardRole:"viewer",accountRole:"teacher",isAppAdmin:false,adminMaintenance:false
})),false,"viewers cannot manipulate lesson connections");
assert.match(app,/transformHandle && hit && canEdit && !hit.locked/,
 "viewer cannot resize objects even while holding a stale transform handle");
assert.match(app,/const movableIds = canEdit\?/,
 "viewer cannot move board objects using the hand tool");
assert.match(app,/if \(!canTransformBoardObject\(hit\)\) return;/,
 "viewer selection never starts an object drag and student transforms use the shared policy");
assert.match(app,/&& !space && canCropImage\(hit\)/,
 "viewer cannot open crop editor on a touch double tap");
assert.match(app,/canEdit&&canCropBoardImage\(item,authUser.id,isStudent,isBoardOwner\)/,
 "Viewer and student permissions are enforced by the crop action");
assert.match(app,/notes: isStudent \? `student-media-request:/,
 "guest and student image/PDF uploads both use the teacher approval path");
assert.match(css,/\.lektrus-developer-role-options/,"responsive role buttons styled");
assert.match(css,/\.lektrus-developer-role-banner/,"active simulation visibly indicated");
assert.match(model,/role:BoardRole/,"real board membership is separate");
console.log(`Lektrus: ${cases} role scenarios, tool/object matrix, real guests and permissions checks passed.`);

// Explicit participant roles are independent from the account category.
for(const accountRole of ["student","teacher"]){
 const pupil=boardRoleCapabilities({preview:"actual",boardRole:"editor",participantRole:"student",accountRole,isAppAdmin:false,adminMaintenance:false});
 assert.ok(pupil.canEdit&&pupil.isStudent&&!pupil.canCreateAssignments&&!pupil.canManageBoard);
 assert.ok(canUseBoardCreationTool("pen",pupil));assert.ok(!canUseBoardCreationTool("quiz",pupil));
 const observer=boardRoleCapabilities({preview:"actual",boardRole:"viewer",participantRole:"observer",accountRole,isAppAdmin:false,adminMaintenance:false});
 assert.ok(!observer.canEdit&&!observer.canCreateAssignments&&!observer.canManageBoard);
 const colleague=boardRoleCapabilities({preview:"actual",boardRole:"editor",participantRole:"co_teacher",accountRole,isAppAdmin:false,adminMaintenance:false});
 assert.equal(colleague.canCreateAssignments,accountRole==="teacher");assert.equal(colleague.canManageBoard,false);
}
const guestColleague=boardRoleCapabilities({preview:"actual",boardRole:"editor",participantRole:"co_teacher",accountRole:"teacher",isAppAdmin:false,adminMaintenance:false,isGuest:true});
assert.ok(guestColleague.isStudent&&!guestColleague.canCreateAssignments);
console.log("Board-local participant roles: explicit role matrix passed");

{
 const objectPolicy={};
 const compiled=ts.transpileModule(read("src/lektrusBoardObjectAuth.ts"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 new Function("exports","require",compiled)(objectPolicy,name=>name==="./boardModel"?{isInkItem:i=>i.kind==="pen"||i.kind==="marker"}:api);
 const allowed=objectPolicy.blockedStudentObjectEdits;
 const teacher={id:"t",createdBy:"teacher",kind:"sticky",x:0,text:"Task"};
 assert.equal(allowed([teacher],[{...teacher,stickerInk:[{id:"p"}]}],"student").length,0);
 assert.equal(allowed([teacher],[{...teacher,text:"changed"}],"student").length,1);
 assert.equal(allowed([teacher],[{...teacher,x:20}],"student").length,0);
 assert.equal(allowed([{...teacher,locked:true}],[{...teacher,locked:true,x:20}],"student").length,1);
 assert.equal(allowed([],[{id:"s",kind:"quiz",createdBy:"student"}],"student").length,1);
 assert.equal(allowed([],[{id:"s",kind:"text",createdBy:"student"}],"student").length,0);
 const graph={...teacher,kind:"graph",graphPurpose:"coordinates"};
 assert.equal(allowed([graph],[{...graph,graphPoints:[{x:1,y:2}]}],"student").length,0);
 assert.equal(allowed([{...graph,subjectBoardEntries:[]}],[{...graph,subjectBoardEntries:[],graphPoints:[{x:1,y:2}]}],"student").length,1);
}

// Open contour editors must recheck current permission and validate the merged map.
assert.match(app,/if\(!canEdit\|\|!latest\|\|latest.graphFigureId!=="contour-atlas"\|\|/);
assert.match(app,/const allowed=isStudent\?restrictStudentDiagramChange\(latest.schoolDiagram,merged\):merged;\s*if\(!allowed\|\|allowed.kind!=="atlas"\|\|!isSchoolDiagram\(allowed\)\)return;/);
assert.match(app,/if\(!canEdit\|\|!current\|\|current.locked\|\|current.graphFigureId!=="geo-matching"/);
