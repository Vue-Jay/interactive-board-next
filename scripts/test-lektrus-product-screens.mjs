import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createServer } from "vite";

const read=path=>readFileSync(new URL(`../${path}`,import.meta.url),"utf8");
const app=read("src/App.tsx");
const styles=read("src/lektrusProductScreens.css");
const templates=read("src/TemplatesScreen.tsx");

assert.ok(app.includes("Управление и интерфейс"),"the settings entry must show its full label");
const menuStart=app.indexOf('<div className="lectris-layout-menu">');
const menuEnd=app.indexOf("</details>",menuStart);
const menu=app.slice(menuStart,menuEnd);
assert.ok(menu.indexOf("Рабочая раскладка")<menu.indexOf("Управление и интерфейс"),"the interface settings button must follow the layout options");
assert.match(styles,/\.lectris-layout-menu \.lectris-interface-settings-entry[\s\S]*?background:var\(--lt-selected/,
  "the settings entry must read as a Lektrus button");
assert.match(styles,/\.workspace \.board-controls \.snap-toggle\.active[\s\S]*?var\(--lt-selected\)/,
  "snap must use the selected Lektrus palette");
for(const selector of [".lectris-hub", ".lectris-hub-tile-icon", ".topbar-more-popover", ".notification-card", ".profile-identity-card", ".settings-row-card", ".admin-users-shell", ".template-card"]){
  assert.ok(styles.includes(selector),`${selector} must be covered by the shared product screen theme`);
}
for(const kind of ["kind:\"checklist\"","kind:\"quiz\"","kind:\"table\"","kind:\"graph\""]){
  assert.ok(templates.includes(kind),`starter templates must include an interactive ${kind.slice(6,-1)} object`);
}
assert.ok((templates.match(/id:"[^\"]+",title:/g)||[]).length>=9,
  "the starter library must include the expanded practical templates");
const layoutStore=read("src/lektrusInterfaceLayout.ts");
const globalMigration=read("supabase/v249_global_interface_layout.sql");
assert.ok(layoutStore.includes("admin_publish_interface_layout")&&layoutStore.includes("get_global_interface_layout"),"the interface design must publish and load from the shared server setting");
assert.ok(globalMigration.includes("public.is_app_admin(auth.uid())"),"only a verified application administrator may publish the shared design");
assert.ok(read("src/ProfileScreen.tsx").includes("Коротко о себе")&&read("src/profileDetailsStore.ts").includes("organization"),"the profile must include editable personal and work details");
assert.ok(read("src/AuthScreen.tsx").includes("Подтвердите email")&&read("src/backend.ts").includes("verifySignupOtpRemote"),"registration must use Lektrus code entry");

const vite=await createServer({configFile:false,server:{middlewareMode:true},appType:"custom"});
try{
  const [{starterTemplates,starterDocument},{parseDocument}]=await Promise.all([
    vite.ssrLoadModule("/src/TemplatesScreen.tsx"),
    vite.ssrLoadModule("/src/boardModel.ts"),
  ]);
  for(const template of starterTemplates){
    const document=starterDocument(template);
    assert.doesNotThrow(()=>parseDocument(JSON.stringify(document)),
      `${template.title} must create a valid editable board document`);
  }
}finally{await vite.close()}

console.log("Lektrus product screens: palette, controls, account pages and practical templates are connected.");
