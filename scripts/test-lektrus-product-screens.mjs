import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createServer } from "vite";

const read=path=>readFileSync(new URL(`../${path}`,import.meta.url),"utf8");
const app=read("src/App.tsx");
const styles=read("src/lektrusProductScreens.css");
const templates=read("src/TemplatesScreen.tsx");

assert.ok(app.includes(">Управление и интерфейс</button>"),
  "the settings entry must show its full label");
assert.match(styles,/\.lectris-layout-menu \.lectris-panel-entry[\s\S]*?background:var\(--lt-selected\)/,
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
