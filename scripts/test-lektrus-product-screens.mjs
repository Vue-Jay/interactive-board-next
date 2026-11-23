import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read=path=>readFileSync(new URL(`../${path}`,import.meta.url),"utf8");
const app=read("src/App.tsx")+"\n"+read("src/BoardApp.tsx");
const shell=read("src/LectrisWorkspaceShell.tsx");
const styles=read("src/lektrusProductScreens.css");
const templates=read("src/TemplatesScreen.tsx");
const demo=read("src/PublicDemoBoard.tsx");
const board=read("src/BoardApp.tsx"), assets=read("src/assetStore.ts"), themes=read("src/lektrusThemes.css");
assert.match(demo,/items:\[\]/,"Every demo starts with an empty document");
assert.match(demo,/const \[session\]=useState\(/,"Demo identity is stable only for this mount");
assert.doesNotMatch(demo,/localStorage|sessionStorage|URLSearchParams/,"No seeded or saved public demo");
assert.match(demo,/clearDemoBoardAssets\(session\.board\.id\)/);
assert.match(board,/if \(!canEdit \|\| layoutEditing \|\| demoMode\) return;/,"No demo autosave");
assert.match(board,/if \(!canEdit\|\|demoMode\) return;/,"No demo save scheduling");
assert.match(board,/!demoMode\|\|id!=="linkmedia"/,"Video unavailable in demo");
assert.match(board,/!demoMode\|\|entry\.id\.startsWith\("subject-task-"\)/,"Only subject board tasks are offered");
for(const connection of ["connectAttachmentApprovalChannel","subscribeBoardDocument","connectBoardCursorChannel","connectBoardViewControl","connectBoardWorkChannel"]){
 const call=board.lastIndexOf(connection+"(");
 const effect=board.lastIndexOf("useEffect(",call);
 assert.ok(call>effect&&board.slice(effect,call).includes("if(demoMode||layoutEditing||!boardRealtimeAwake)return;"),connection+" must never start in demo");
}
assert.match(board,/demoMode\|\|layoutEditing\|\|!boardRealtimeAwake\?\(\)=>\{\}:subscribeBoardPresence/);
assert.match(board,/if\(!demoMode\)queueLectrisBoardOrganization/);
assert.match(assets,/if\(isDemoBoard\(boardId\)\)return demoAssets\.get\(path\)\?\?null/);
assert.match(assets,/if\(isDemoBoard\(boardId\)\)return;\s*const selfhost/);
assert.match(themes,/textarea,select\):focus\s*\{\s*outline:none!important;\s*box-shadow:none!important;/,"Focused fields must not have a duplicate outer ring");

assert.ok(app.includes("Управление и интерфейс"),"the settings entry must show its full label");
assert.ok(app.includes('const effectiveAccountRole=appRolePreview==="actual"?accountRole:appRolePreview')&&app.includes("changeAppRolePreview"),"administrator role preview must affect app-wide menus");
assert.ok(!shell.includes("Проверка интерфейса")&&!shell.includes("Вернуться к администратору"),"role preview controls must not occupy the persistent workspace header");
const menuStart=app.indexOf('<div className="lectris-layout-menu">');
const menuEnd=app.indexOf("</details>",menuStart);
const menu=app.slice(menuStart,menuEnd);
assert.ok(menu.indexOf("Рабочая раскладка")<menu.indexOf("Управление и интерфейс"),"the interface settings button must follow the layout options");
assert.match(styles,/\.lectris-layout-menu \.lectris-interface-settings-entry[\s\S]*?background:var\(--lt-selected/,
  "the settings entry must read as a Lektrus button");
assert.match(styles,/\.workspace \.board-controls \.snap-toggle\.active[\s\S]*?var\(--lt-selected\)/,
  "snap must use the selected Lektrus palette");
assert.match(styles,/\.admin-users-shell \.admin-user-grant\{background:transparent!important\}/,
  "tariff controls must not sit on an extra colored panel");
for(const selector of [".lectris-hub", ".lectris-hub-tile-icon", ".topbar-more-popover", ".notification-card", ".profile-identity-card", ".settings-row-card", ".admin-users-shell", ".template-card"]){
  assert.ok(styles.includes(selector),`${selector} must be covered by the shared product screen theme`);
}
const createDialog=read("src/LektrusCreateBoardDialog.tsx");
assert.ok(shell.includes('id:"templates"')&&templates.includes("Шаблонов пока нет")&&templates.includes("Сохранить как шаблон"),
 "The personal templates section and empty-state guidance must remain");
assert.doesNotMatch(templates+createDialog,/starterTemplates|starterDocument|builtin:/);
assert.doesNotMatch(app,/insertTemplate\(/);
assert.ok(app.includes("savePersonalBoardTemplate(")&&app.includes("canSaveTemplate&&<button"));
assert.ok(templates.includes("copyTemplateAssets(t,b.id)")&&read("src/BoardsScreen.tsx").includes("copyTemplateAssets(options.template,b.id)"));
const layoutStore=read("src/lektrusInterfaceLayout.ts");
const globalMigration=read("supabase/v249_global_interface_layout.sql");
assert.ok(layoutStore.includes("admin_publish_interface_layout")&&layoutStore.includes("get_global_interface_layout"),"the interface design must publish and load from the shared server setting");
assert.ok(globalMigration.includes("public.is_app_admin(auth.uid())"),"only a verified application administrator may publish the shared design");
const profile=read("src/ProfileScreen.tsx");
const settings=read("src/SettingsScreen.tsx");
const previewRequests=read("src/previewTeacherRequestsStore.ts");
const adminScreen=read("src/AdminScreen.tsx");
assert.ok(adminScreen.includes("Просмотр приложения по ролям")&&adminScreen.includes("onRolePreviewChange(value)")&&adminScreen.includes('"Администратор"')&&adminScreen.includes('"Преподаватель"')&&adminScreen.includes('"Ученик"')&&read("src/SettingsScreen.tsx").includes("Завершить проверку роли"),"administrators must be able to switch app-wide role menus in Administration and switch back in Settings");
assert.ok(settings.includes("addPreviewTeacherRequest(user,cleaned)")&&previewRequests.includes("localStorage.setItem(KEY")&&adminScreen.includes("Удалить тестовую заявку"),"role preview teacher applications must stay local and be removable from administrator review");
const applicationMigration=read("supabase/v251_teacher_application_details.sql");
assert.ok(!profile.includes("Коротко о себе")&&!profile.includes("О вас и вашей работе"),"the profile must not include the biography or teacher application section heading");
assert.ok(!profile.includes("Преподавание")&&!profile.includes("teacherFields")&&profile.includes("Личные данные")&&profile.includes("Учётная запись"),"unified account profiles must show personal data without the obsolete teaching application fields");
assert.ok(settings.includes("Заявка преподавателя")&&settings.includes("experience"),"legacy administrator role-preview applications remain available");
assert.ok(shell.includes('workspaceMode&&section===""&&!morePage&&'),"the workspace switch belongs only on the home screen");
const schedule=read("src/ScheduleScreen.tsx"),assignments=read("src/AssignmentsScreen.tsx"),learningStyles=read("src/lektrusLearningPages.css");
assert.ok(schedule.includes('schedule-summary-learner')&&schedule.includes('!teacher||studentFilter')&&schedule.includes('schedule-day-agenda'),"learners must have appropriate schedule controls and a day agenda");
assert.ok(learningStyles.includes('grid-template-columns:repeat(7,minmax(0,1fr))'),"all seven dates must fit within narrow screens");
assert.ok(!assignments.includes('Создание и проверка заданий ученику недоступны')&&assignments.includes('Заданий пока нет'),"learner assignments must have clear, nonduplicated text");
assert.ok(applicationMigration.includes("teacher_application")&&applicationMigration.includes("is_app_admin(auth.uid())"),"the application details must be stored securely for administrator review");
const authScreen=read("src/AuthScreen.tsx");
const signupEmail=read("supabase/email-templates/confirm-signup.html");
assert.ok(authScreen.includes("Проверьте почту")&&signupEmail.includes("{{ .ConfirmationURL }}")&&!authScreen.includes("verifySignupOtpRemote"),"registration must use the branded email confirmation link");
assert.ok(authScreen.includes("Демо-ссылка подтверждения готова")&&authScreen.includes("Открыть ссылку подтверждения")&&authScreen.includes("Демо не отправляет письма и не создаёт аккаунты")&&app.includes('previewMode onPreviewClose'),"administrators must be able to simulate confirming the local fake registration without creating an account");

console.log("Lektrus product screens: palette, controls, account pages and personal templates are connected.");
