import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=name=>readFileSync(new URL("../"+name,import.meta.url),"utf8");
const app=read("src/App.tsx");
const quick=read("src/LectrisObjectEditor.tsx");
const responsive=read("src/lektrusResponsive.css");
const catalog=read("src/lektrusScienceCatalog.ts");
const atom=read("src/LektrusAtomView.tsx");
const organic=read("src/LektrusOrganicCanvas.tsx");
const chemistry=read("src/LektrusChemistryIllustration.tsx");

assert.doesNotMatch(catalog,/id:"chem-atoms"/,"do not show a second atom model tool");
assert.doesNotMatch(atom,/спины · сначала один электрон/,"remove clipping orbital explanation");
// Section routing belongs to the sidebar; modal buttons need no global guard.
assert.doesNotMatch(app,/onDashboardClick/);
assert.doesNotMatch(app,/textContent\?\.trim\(\)\.includes\("Настройки"\)/,
 "Local tool-settings buttons must never be hijacked by the application");
assert.match(app,/touchAction:"none",\s*overscrollBehavior:"none"/,"touch board owns its pan and pinch");
assert.match(app,/onPointerCancelCapture/,"touch cancellation must be handled");
assert.match(app,/pinchState\.current/,"two-finger zoom remains active");
assert.match(app,/data-board-interactive/,"embedded board controls keep receiving clicks");
assert.match(app,/suppressTouchClickUntil\.current/,"block accidental click after pinch");
assert.match(app,/lektrus-ink-settings-direct/,"show direct brush controls");
assert.match(app,/INK_WIDTHS\.eraser/);
assert.match(app,/INK_WIDTHS\.marker/);
assert.match(app,/INK_WIDTHS\.pen/);
assert.match(quick,/pen:\[1,3,6,12,22\]/);
assert.match(quick,/marker:\[2,7,14,28,48\]/);
assert.match(quick,/eraser:\[6,16,32,55,90\]/);
assert.match(responsive,/\.lectris-quick-properties\.is-ink-properties\{display:none!important\}/,
 "mobile should not have a duplicate collapsed brush toolbar");
assert.match(organic,/onPointerCancel=\{e=>/, "cancelled touch must not insert a bond");
assert.match(organic,/attachFunctionalGroup/);
assert.match(organic,/onPointerDown=\{e=>handleAtom/);
assert.match(organic,/window\.addEventListener\("keydown",key\)/);
assert.match(chemistry,/ObservationIcon/);
assert.match(chemistry,/aria-label="Условные обозначения"/);
console.log("Mobile gesture, direct ink controls, organic and chemistry regression checks passed");
