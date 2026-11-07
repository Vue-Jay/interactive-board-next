import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const app=read("src/App.tsx"),model=read("src/boardModel.ts");
const util=read("src/boardBackground.ts"),css=read("src/lektrusBoardBackground.css"),main=read("src/main.tsx");
assert.match(model,/background:normalizeBoardBackground\(d\.background\)/);
assert.match(model,/export function normalizeBoardBackground/);
assert.doesNotMatch(model,/from "\.\/boardBackground"/);
assert.match(model,/background:normalizeBoardBackground\(data\.background\)/);
assert.match(app,/const canChangeBoardBackground=canEdit&&!isStudent/);
assert.match(app,/setBoardBackground\(normalizeBoardBackground\(data\.background\)\)/);
assert.match(app,/const onlyBackgroundChanged=/);
assert.match(app,/if\(onlyBackgroundChanged\)\{[\s\S]*?setBoardBackground\(normalizeBoardBackground\(data\.background\)\)/);

assert.match(app,/background:boardBackground/);
assert.match(app,/backgroundAppearance\.backgroundImage/);
// The brush is now a live overlay rather than a CSS-only background cursor.
assert.match(app,/className=\{`lektrus-ink-cursor/);
assert.match(app,/backgroundAppearance\.foreground/);
assert.match(app,/backgroundAppearance\.outline/);
assert.match(app,/role="group" aria-label="Настройки фона доски"/);
assert.match(app,/boardBackground,\s*editing,\s*draft,/);
const sync=read("src/boardSync.ts");
assert.match(sync,/background: document\.background/);

assert.match(css,/cursor:none!important/);
assert.match(css,/\.lektrus-ink-cursor-footprint/);
assert.match(css,/\.eraser-cursor/);
assert.match(util,/encodeURIComponent\(svg\)/);
assert.ok(main.indexOf("lektrusToolRefinements.css")<main.indexOf("lektrusBoardBackground.css"));
for(const v of [css,util])assert.equal((v.match(/{/g)||[]).length,(v.match(/}/g)||[]).length);
assert.doesNotMatch(app,/lesson-board\.grid-mode/);
console.log("Shared teacher-controlled background and contrast ink cursor contract OK.");
