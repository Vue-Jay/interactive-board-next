import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const file=(path)=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
const editor=file("src/LectrisObjectEditor.tsx");
const app=file("src/App.tsx");
const css=file("src/lektrusResponsive.css");
const layout=file("src/lectrisPanelLayout.ts");
const workflow=file(".github/workflows/board-build.yml");

// UI controls must use shared saved colors and five immediate stroke widths.
assert.ok(editor.includes('const [locationOpen,setLocationOpen]=useState(false)'));
assert.ok(editor.includes('aria-expanded={locationOpen}'));
assert.ok(editor.includes('<LektrusColorPicker compact userId={props.userId} label="Цвет"'));
assert.ok(editor.includes('value={color} onChange={props.onColor}'));
assert.ok(editor.includes('onChange={value=>props.onPatch({color:value})}'));
assert.ok(editor.includes('onChange={color=>onPatch({color})}'));
assert.ok(editor.includes('export const INK_WIDTHS'));
assert.ok(editor.includes('props.onMarkerWeight(n)'));
assert.ok(editor.includes('props.onEraserSize(n)'));
assert.ok(editor.includes('props.onWeight(n)'));
assert.ok(editor.includes('lektrus-ink-five-widths'),'Width presets must be visible immediately');
assert.ok(editor.includes('aria-pressed={inkWidthIndex(inkTool,currentWidth)===i}'));
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

// Selection action popovers must escape toolbar overflow and float above objects.
const toolCss=file("src/lektrusToolLayout.css");
assert.ok(toolCss.includes('.selection-toolbar-screen:has(.selection-more[open])')&&
 toolCss.includes('overflow:visible!important'),"Expanded more menu must not be clipped");
assert.ok(toolCss.includes('z-index:2500!important'),"Menu must layer above all board objects");
assert.ok(app.includes('data-more-direction={selectionToolbarTop<440?"down":"up"}'),
 "Menu should open into visible board space");
assert.ok(!app.includes('aria-label="Настройки и свойства объекта"'),
 "The redundant little settings gear must not appear beside Configure");
assert.ok(app.includes('className="lektrus-graph-edit-secondary" aria-label="Настроить учебный объект"'),
 "The original Configure button must remain");
assert.ok(app.includes('onClick={()=>setLectrisInspectorOpen(true)}'),
 "Additional properties must remain reachable in the More menu");
assert.ok(app.includes('onClick={lectrisEditSelected}'),"Object toolbar should expose its editor");
assert.ok(app.includes('case "image": setImageCropEditorId(singleSelected.id)'),
 "Image editing must open the cropping editor");
assert.ok(editor.includes('"fraction","table"')&&editor.includes('"linkmedia","image"'),
 "Quick actions must cover fraction and image content editors");
assert.ok(!editor.includes('if(item?.kind==="graph"&&item.graphFigureId==="chem-periodic"'),
 "Periodic table must not lose quick properties");
for(const field of ['item.kind==="shape"','item.kind==="connector"','item.kind==="cover"','item.kind==="pdf"'])
 assert.ok(editor.includes(field),"Missing editable inspector fields for "+field);

const names=file("src/boardObjectNames.ts");
assert.ok(editor.includes('boardObjectTypeName(item)'),
 "Object inspector must use the true subject tool name rather than storage kind graph");
const subjectRegistry=file("src/lektrusSubjectToolRegistry.ts");
for(const id of ['"geo-matching"','"geo-question-cards"'])
 assert.ok(subjectRegistry.includes('id:'+id) && names.includes("subjectToolRegistry"),
  "Missing subject type mapping: "+id);
for(const id of ['"lektrus-chart"','"chem-periodic"'])
 assert.ok(names.includes(id), "Missing specialized type mapping: "+id);
assert.ok(app.includes('if (item.kind === "graph") return boardObjectTypeName(item)'),
 "Object type in layers must agree with the inspector");

// Selection must have exactly one context bar. The fixed quick bar is only for ink tools
// when nothing is selected, never another overlapping object action bar.
assert.ok(app.includes('selectedItems.length===0 && <LectrisQuickProperties'),
 "Selected objects must not mount a second fixed toolbar over their actions");
const graphEdit=app.match(/\(\["text","sticky","frame","comment","formula"[^\n]+\.includes\(singleSelected\.kind\)\)\&\&/);
assert.ok(graphEdit && !graphEdit[0].includes('"graph"'),
 "Graphs must have the original Configure action without duplicate Edit");
assert.ok(app.includes('className="lektrus-graph-edit-secondary" aria-label="Настроить учебный объект"'),
 "The original Configure button must remain intact");
const touchPolish=file("src/lektrusMathTouchPolish.css");
assert.ok(touchPolish.includes('selection-toolbar-screen > .selection-edit-action') &&
 touchPolish.includes('min-width:max-content!important'),
 "Action labels must never be squeezed into an icon-only width");

console.log("Lektrus editor UX: palette, five immediate ink widths, keyboard and inspector contracts OK");
