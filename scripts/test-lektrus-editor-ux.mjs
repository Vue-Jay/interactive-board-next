import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const file=(path)=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
const editor=file("src/LectrisObjectEditor.tsx");
const app=file("src/App.tsx");
const css=file("src/lektrusResponsive.css");
const layout=file("src/lectrisPanelLayout.ts");
const workflow=file(".github/workflows/board-build.yml");

// UI controls must use shared saved colors; stroke width stays on sliders only.
assert.ok(editor.includes('const [locationOpen,setLocationOpen]=useState(false)'));
assert.ok(editor.includes('aria-expanded={locationOpen}'));
assert.ok(editor.includes('<LektrusColorPicker compact userId={props.userId} label="Цвет"'));
assert.ok(editor.includes('value={color} onChange={props.onColor}'));
assert.ok(editor.includes('onChange={value=>props.onPatch({color:value})}'));
assert.ok(editor.includes('onChange={color=>onPatch({color})}'));
assert.ok(editor.includes('type="range"'));
assert.ok(editor.includes('props.onMarkerWeight(n)'));
assert.ok(editor.includes('props.onEraserSize(n)'));
assert.ok(editor.includes('props.onWeight(n)'));
assert.ok(!editor.includes('sizeOptions'),'No width preset buttons for pens or markers');
assert.ok(!editor.includes('presetsOpen'),'Old size presets should be removed');
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
const colorCss=file("src/lektrusColors.css");
assert.ok(colorCss.includes('.lektrus-colors-popup'));
assert.ok(colorCss.includes('.lektrus-color-wheel'));
assert.ok(colorCss.includes('z-index:2147482000'));
assert.ok(css.includes('.lektrus-inspector-position-content'));
assert.ok(css.includes('max-height:calc(100dvh - 112px)'),"Short touch landscape must scroll safely");
assert.ok(workflow.includes("test-lektrus-editor-ux.mjs"));
console.log("Lektrus editor UX: shared two-button colors, slider-only stroke widths, keyboard and inspector contracts OK");
