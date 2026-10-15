import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source=(path)=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
const styles=source("src/lektrusResponsive.css");
const base=source("src/lektrusRefresh.css");
const entry=source("src/main.tsx");
const board=source("src/App.tsx");
const shell=source("src/LectrisWorkspaceShell.tsx");
const manifest=JSON.parse(source("public/manifest.webmanifest"));

assert.ok(entry.includes('import "./lektrusRefresh.css";\nimport "./lektrusResponsive.css";'),
  "responsive overrides must load last");
for(const width of ["max-width:1199px","max-width:1023px","max-width:850px","max-width:700px","max-width:380px"]){
  assert.ok(styles.includes(width),"missing responsive breakpoint: "+width);
}
assert.ok(styles.includes("max-height:calc(100dvh - 30px)"),"dialogs must fit viewport");
assert.ok(styles.includes("overflow-wrap:anywhere"),"long names must wrap");
assert.ok(styles.includes("flex-wrap:wrap"),"toolbar controls must wrap");
assert.ok(styles.includes("grid-template-columns:repeat(2,minmax(0,1fr))"),"compact cards need two columns");
assert.ok(styles.includes("grid-template-columns:1fr"),"narrow viewport needs one-column layouts");
assert.ok(styles.includes("env(safe-area-inset-bottom)"),"mobile toolbar must respect safe area");
assert.ok(styles.includes(".workspace.lectris-editor-side")&&styles.includes(".workspace.lectris-editor-bottom"),
  "both supported editor docking modes must fit");
assert.ok(styles.includes("calc(100vw - 156px)"),"bottom dock must reserve room for primary tools");
assert.ok(styles.includes(".lectris-object-inspector,.lectris-quick-properties,.minimap,.coordinates"),
  "overlay collisions must be prevented while editing");
assert.ok(styles.includes("pointer:coarse")&&styles.includes("orientation:landscape"),
  "touch landscape layout must have its own bounds");
assert.ok(shell.includes("Lektrus"));
assert.ok(base.includes(".lektrus-category-strip"));
assert.equal(manifest.short_name,"Lektrus");
// Display styles must not introduce network changes or touch the document save path.
assert.equal(/fetch\s*\(|supabase\.from\(/.test(styles),false);
assert.ok(board.includes("saveRemoteBoardDocument"));
console.log("Lektrus responsive contract: dialogs, lists, header, tablet, phone, touch landscape, editor docks OK.");
