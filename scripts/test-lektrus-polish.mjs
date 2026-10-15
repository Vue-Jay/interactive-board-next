import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const read = path => readFileSync(new URL("../" + path, import.meta.url), "utf8");
const entry = read("src/main.tsx");
const polish = read("src/lektrusPolish.css");
const contrast = read("src/lektrusContrast.css");
const hub = read("src/LectrisHub.tsx");
const shell = read("src/LectrisWorkspaceShell.tsx");

assert.match(entry, /import "\.\/lektrusContrast\.css";\s*import "\.\/lektrusPolish\.css";/);
assert.match(contrast, /data-theme="dark"/);
assert.match(polish, /@media\(max-width:760px\)/);
assert.match(polish, /prefers-reduced-motion:reduce/);
for (const [name, selector] of Object.entries({
  shell:".lectris-workspace-header",
  footer:".lectris-sidebar-footer",
  hero:".lectris-hub-hero-compact",
  tile:".lectris-hub-tile-copy",
  board:".lectris-hub-board-cover",
  shortcuts:".lectris-hub-shortcuts",
  inspector:".lectris-object-inspector",
})) assert.ok(polish.includes(selector), "Missing styling for " + name);
for (const cls of ["lectris-sidebar-footer","lectris-hub-hero-compact","lectris-hub-tile","lectris-hub-shortcuts"]) {
  assert.ok((hub + shell).includes(cls), "Missing real UI selector " + cls);
}
assert.equal((polish.match(/{/g) ?? []).length,(polish.match(/}/g) ?? []).length,"Unbalanced CSS blocks");
assert.doesNotMatch(polish, /(\.canvas\b|\.drawing-layer\b|\.board-object\b|canvas\.width|canvas\.height|pointer-events\s*:\s*none\s*!important)/);
console.log("Lektrus polish: responsive, readable dashboard and board chrome contracts OK.");
