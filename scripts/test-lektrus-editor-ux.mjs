import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const file=(path)=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
const editor=file("src/LectrisObjectEditor.tsx");
const app=file("src/App.tsx");
const css=file("src/lektrusResponsive.css");
const layout=file("src/lectrisPanelLayout.ts");
const workflow=file(".github/workflows/board-build.yml");

// UI controls must operate on existing callbacks and must not change documents.
assert.ok(editor.includes('const [presetsOpen,setPresetsOpen]=useState(false)'));
assert.ok(editor.includes('const [locationOpen,setLocationOpen]=useState(false)'));
assert.ok(editor.includes('aria-expanded={presetsOpen}'));
assert.ok(editor.includes('aria-expanded={locationOpen}'));
assert.ok(editor.includes('aria-label="Готовые цвета"'));
assert.ok(editor.includes('aria-label="Готовые размеры"'));
assert.ok(editor.includes('onClick={()=>props.onColor(value)}'));
assert.ok(editor.includes('props.onMarkerWeight(value)'));
assert.ok(editor.includes('props.onEraserSize(value)'));
assert.ok(editor.includes('props.onWeight(value)'));
assert.ok(editor.includes("sizeOptions[erasing?"));
assert.ok(editor.includes('setPresetsOpen(false)'),"Switching tools must dismiss the popover");
assert.ok(editor.includes('item.locked?"Объект заблокирован"'));
// Previous editing actions, properties and access checks remain intact.
assert.ok(editor.includes('onClick={props.onPatch')===false);
assert.ok(editor.includes('onPatch({rotation:0})'));
assert.ok(editor.includes('disabled={!canModify}'));
assert.ok(editor.includes('aria-label="Свойства объекта"'));
assert.ok(editor.includes('item.kind==="frame"?textDraft.replace'));
assert.ok(editor.includes("onKeyDown={e=>{if(e.key===\"Escape\"&&!advancedOpen)"));
assert.ok(editor.includes("LEKTRUS · ДОПОЛНИТЕЛЬНО"));
assert.ok(app.includes('onColor={tool === "marker" ? setMarkerColor : tool === "pen" ? setPenColor : setColor}'));
assert.ok(app.includes("saveRemoteBoardDocument"),"Persistence must remain unchanged");
assert.ok(layout.includes('editorPosition:"bottom"|"side"'));
assert.ok(css.includes('.lectris-quick-properties:has(.lektrus-brush-presets)'));
assert.ok(css.includes('bottom:calc(100% + 9px)'),"Popover must open above the quick toolbar");
assert.ok(css.includes('.lektrus-inspector-position-content'));
assert.ok(css.includes('max-height:calc(100dvh - 112px)'),"Short touch landscape must scroll safely");
assert.ok(workflow.includes("test-lektrus-editor-ux.mjs"));
console.log("Lektrus editor UX: color/size presets, keyboard, inspector density and existing save callbacks OK");
