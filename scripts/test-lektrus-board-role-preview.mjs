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
       preview==="actual"&&(guest||accountRole==="student"&&!adminMaintenance);
     assert.equal(caps.canEdit,expectedCanEdit,JSON.stringify(input)+" board membership stays authoritative");
     assert.equal(caps.isStudent,student,JSON.stringify(input)+" effective role");
     assert.equal(caps.effectiveRole,student?"student":"teacher");
     assert.equal(caps.canAnswerContour,expectedCanEdit);
     assert.equal(caps.canAddStudentMedia,expectedCanEdit&&student);
     assert.equal(caps.canCreateAssignments,expectedCanEdit&&!student);
     assert.equal(caps.canUseStudentTools,expectedCanEdit&&student);
     assert.equal(caps.canUseTeacherTools,expectedCanEdit&&!student);
     assert.equal(caps.canManageBoard,expectedCanEdit&&!student&&boardRole==="owner"&&!guest);
     for(const tool of creations){
      const denied=STUDENT_BLOCKED_CREATE_TOOLS.includes(tool);
      assert.equal(canUseBoardCreationTool(tool,caps),
        expectedCanEdit&&!(student&&denied),JSON.stringify(input)+" "+tool);
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
 for(const tool of creations)assert.equal(canUseBoardCreationTool(tool,caps),false);
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
assert.deepEqual(restrictStudentDiagramChange({kind:"syntax",words:[]},
 {kind:"syntax",words:[{id:"1"}]}),{kind:"syntax",words:[{id:"1"}]});

const app=read("src/App.tsx"),css=read("src/App.css"),model=read("src/boardStore.ts");
for(const [path,code] of [["src/App.tsx",app],["src/lektrusBoardRolePreview.ts",source]]){
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
assert.match(app,/notes: isStudent \? `student-media-request:/,
 "guest and student image/PDF uploads both use the teacher approval path");
assert.match(css,/\.lektrus-developer-role-options/,"responsive role buttons styled");
assert.match(css,/\.lektrus-developer-role-banner/,"active simulation visibly indicated");
assert.match(model,/role:BoardRole/,"real board membership is separate");
console.log(`Lektrus: ${cases} role scenarios, tool/object matrix, real guests and permissions checks passed.`);
