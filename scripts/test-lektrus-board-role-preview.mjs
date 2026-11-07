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
 isStudentProtectedBoardObject,STUDENT_BLOCKED_CREATE_TOOLS,
 STUDENT_PROTECTED_OBJECT_KINDS
}=api;

const boardRoles=["owner","editor","viewer"];
const accountRoles=["teacher","student"];
const previews=["actual","teacher","student","guest"];
const creations=["select","hand","lasso","pen","marker","eraser","text","sticky","shape",
 "connector","comment","image","pdf","frame","table","formula","graph","checklist",
 "quiz","flashcard","cover","linkmedia"];
const protectedKinds=["frame","table","formula","graph","checklist","quiz",
 "flashcard","cover","linkmedia"];
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
assert.deepEqual(STUDENT_BLOCKED_CREATE_TOOLS,STUDENT_PROTECTED_OBJECT_KINDS,
 "teacher-only creation and protected structure use one matrix");

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
assert.match(app,/isAppAdmin && developerSettingsOpen/,"developer dialog is admin-only");
assert.match(app,/id="lektrus-developer-role-preview"/,"developer role buttons are on the board");
assert.match(app,/(["teacher","student","guest"] as const).map/,"quick switching among three roles");
assert.match(app,/aria-pressed={rolePreview===role}/,"active role is accessible");
assert.match(app,/changeRolePreview("actual")/,"real-role reset is accessible");
assert.match(app,/const \[rolePreview,setRolePreview\]=useState<BoardRolePreview>\("actual"\)/,
 "role preview is not persisted");
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
assert.match(foreignView,/const \[order,setOrder\]=useState<string\[\]>\(initial\)/,
 "foreign-language rearrangement uses local answer state");
assert.doesNotMatch(foreignView,/onChange\s*\(/,
 "foreign-language puzzle cannot rewrite teacher's board JSON");
const approvedView=read("src/LektrusApprovedSchoolView.tsx");
assert.match(approvedView,/const \[index,setIndex\]=useState\(0\),\[revealed,setRevealed\]=useState\(false\)/,
 "foreign vocabulary flashcards flip locally without overwriting teacher data");
assert.doesNotMatch(approvedView,/onChange\s*\(/,
 "foreign flashcard interactions must not save over a teacher's cards");
assert.match(russianView,/const \[picked,setPicked\]=useState/,
 "spelling puzzle answers remain local to the learner");
assert.match(app,/restrictStudentDiagramChange\(before.schoolDiagram,diagram\)/,
 "students cannot rewrite a teacher's assignment");
assert.match(app,/if\(!canManageBoard\|\|boardSummary.ownerId!==authUser.id\)return;/,
 "only actual board owner can change the subject");
assert.match(app,/if\(!canCreateAssignments\)\{setNotice\("Создавать задания может только преподаватель/,
 "students cannot generate assignments");
assert.match(app,/if \(!canEdit\) \{ setNotice\("У вас доступ только для просмотра"\); return; \}/,
 "write guard remains at board commit");
assert.match(app,/end\(true\);setEditing\(null\);/,
 "switch cancels active interactions");
assert.match(app,/onRemovePoint=\{selectedIds\.has\(item.id\).*?!structurallyLockedForStudent\(item\)/,
 "students cannot remove vertices from teacher's geometry");
assert.match(app,/onGridChange=\{!item.locked&&canEdit&&!structurallyLockedForStudent\(item\)/,
 "students cannot edit protected graph structure");
assert.match(app,/if\(tool!=="select"&&tool!=="hand"&&tool!=="lasso"&&!toolAllowedForRole\(tool\)\)/,
 "role switch invalidates disallowed drawing tools at pointer event boundary");
assert.match(app,/connector && canEdit && !connector.locked && !structurallyLockedForStudent\(connector\)/,
 "viewer cannot drag connector endpoints, and students cannot change teacher-protected connections");
assert.match(app,/transformHandle && hit && canEdit && !hit.locked/,
 "viewer cannot resize objects even while holding a stale transform handle");
assert.match(app,/const movableIds = canEdit\?/,
 "viewer cannot move board objects using the hand tool");
assert.match(app,/if \(!canEdit \|\| structurallyLockedForStudent\(hit\)\) return;/,
 "viewer selection never starts an object drag");
assert.match(app,/&& !space && canEdit && !hit.locked/,
 "viewer cannot open crop editor on a touch double tap");
assert.match(app,/notes: isStudent \? `student-media-request:/,
 "guest and student image/PDF uploads both use the teacher approval path");
assert.match(css,/\.lektrus-developer-role-options/,"responsive role buttons styled");
assert.match(css,/\.lektrus-developer-role-banner/,"active simulation visibly indicated");
assert.match(model,/role:BoardRole/,"real board membership is separate");
console.log(`Lektrus: ${cases} role scenarios, tool/object matrix, real guests and permissions checks passed.`);
