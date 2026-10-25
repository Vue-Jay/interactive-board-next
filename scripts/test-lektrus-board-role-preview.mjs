import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import ts from "typescript";

const read=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
const roleSource=read("src/lektrusBoardRolePreview.ts");
const compiled=ts.transpileModule(roleSource,{compilerOptions:{
  module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022
}}).outputText;
const api={};
new Function("exports","require",compiled)(api,()=>({}));
const {boardRoleCapabilities,restrictStudentDiagramChange}=api;

for(const boardRole of ["owner","editor","viewer"]){
 for(const accountRole of ["teacher","student"]){
  for(const preview of ["actual","teacher","student","guest"]){
   const input={preview,boardRole,accountRole,isAppAdmin:true,adminMaintenance:false};
   const caps=boardRoleCapabilities(input);
   assert.equal(caps.canEdit,boardRole!=="viewer"&&preview!=="guest",
    JSON.stringify(input)+" never elevates viewer or guest");
   assert.equal(caps.isStudent,accountRole==="student"||preview==="student",
    JSON.stringify(input)+" preserves student restrictions");
   assert.equal(caps.canCreateAssignments,caps.canEdit&&!caps.isStudent,
    JSON.stringify(input)+" teacher-only creation");
   assert.equal(caps.canManageBoard,boardRole==="owner"&&!caps.isStudent&&caps.canEdit,
    JSON.stringify(input)+" owner-only administration");
  }
 }
}
for(const boardRole of ["owner","editor","viewer"]){
 const normal=boardRoleCapabilities({
  preview:"actual",boardRole,accountRole:"student",
  isAppAdmin:false,adminMaintenance:false
 });
 const attempted=boardRoleCapabilities({
  preview:"teacher",boardRole,accountRole:"student",
  isAppAdmin:false,adminMaintenance:false
 });
 assert.deepEqual(attempted,normal,"non-admin cannot simulate elevated role");
}
const maintenance=boardRoleCapabilities({
 preview:"actual",boardRole:"viewer",accountRole:"student",
 isAppAdmin:true,adminMaintenance:true
});
assert.equal(maintenance.canEdit,true,"existing authorized admin maintenance remains supported");
assert.equal(maintenance.canManageBoard,false,"maintenance does not forge board ownership");
const maintenanceGuest=boardRoleCapabilities({
 preview:"guest",boardRole:"viewer",accountRole:"student",
 isAppAdmin:true,adminMaintenance:true
});
assert.equal(maintenanceGuest.canEdit,false,"guest preview restricts even the admin");

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
assert.deepEqual(restrictStudentDiagramChange({kind:"syntax",words:[]},{kind:"syntax",words:[{id:"1"}]}),
 {kind:"syntax",words:[{id:"1"}]});

const app=read("src/App.tsx"),css=read("src/App.css"),model=read("src/boardStore.ts");
for(const [path,code] of [["src/App.tsx",app],["src/lektrusBoardRolePreview.ts",roleSource]]){
 const source=ts.createSourceFile(path,code,ts.ScriptTarget.Latest,true,
  path.endsWith(".tsx")?ts.ScriptKind.TSX:ts.ScriptKind.TS);
 assert.equal(source.parseDiagnostics.length,0,path+" should parse");
}
assert.match(app,/isAppAdmin && developerSettingsOpen/,"developer dialog restricted to admin");
assert.match(app,/id="lektrus-developer-role-preview"/,"role selector exists");
assert.match(app,/changeRolePreview\("actual"\)/,"reset to real role always accessible");
assert.match(app,/const \[rolePreview,setRolePreview\]=useState<BoardRolePreview>\("actual"\)/,
 "role test starts with real permissions and does not survive remount");
assert.doesNotMatch(read("src/developerPreferences.ts"),/rolePreview/,
 "test role is not persisted across sessions");
assert.match(app,/const \{canEdit,isStudent,canManageBoard,canCreateAssignments\}=roleCapabilities/,
 "centralized policy feeds board interactions");
assert.match(app,/if \(!canEdit\) \{ setNotice\("У вас доступ только для просмотра"\); return; \}/,
 "every board model commit is guarded");
assert.match(app,/onSchoolDiagramChange=\{canEdit/,"on-board teaching edits remain permission checked");
assert.match(app,/restrictStudentDiagramChange\(before.schoolDiagram,diagram\)/,
 "student editor permissions also checked for on-board teaching objects");
assert.match(app,/if\(!canManageBoard\|\|boardSummary.ownerId!==authUser.id\)return;/,
 "subject switching requires real ownership");
assert.match(app,/\{canManageBoard && <button className="lesson-button board-invite-button/,
 "sharing management hidden in student/guest simulation");
assert.match(app,/if\(!canCreateAssignments\)\{setNotice\("Создавать задания может только преподаватель/,
 "AI creation denied for student/guest");
assert.match(app,/const toolAllowedForRole = \(id:Tool\) => canEdit&&/,
 "read-only users cannot activate creating tools");
assert.match(app,/end\(true\);setEditing\(null\);/,
 "active pointer gestures cancelled on role switch");
assert.match(css,/\.lektrus-developer-role-banner/,"persistent visual indication of simulation");
assert.match(model,/role:BoardRole/,"membership role is still separate from test role");
console.log("Lektrus role matrix: 24 previews + nonadmin/admin + student assignments + UI guards passed.");
