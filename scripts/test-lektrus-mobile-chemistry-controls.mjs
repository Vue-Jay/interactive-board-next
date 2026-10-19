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
assert.match(app,/onDashboardClick/);
assert.match(app,/target\.closest\("\.board, \.ink-settings, \.lectris-quick-properties/,
 "dashboard must not intercept tool-settings taps");
assert.match(app,/touchAction:"none",\s*overscrollBehavior:"none"/,"touch board owns its pan and pinch");
assert.match(app,/onPointerCancelCapture/,"touch cancellation must be handled");
assert.match(app,/pinchState\.current/,"two-finger zoom remains active");
assert.match(app,/data-board-interactive/,"embedded board controls keep receiving clicks");
assert.match(app,/suppressTouchClickUntil\.current/,"block accidental click after pinch");
assert.match(app,/lektrus-ink-settings-direct/,"show direct brush controls");
assert.match(app,/INK_WIDTHS\.eraser/);
assert.match(app,/INK_WIDTHS\.marker/);
assert.match(app,/INK_WIDTHS\.pen/);
assert.match(quick,/pen:\[0\.5,1\.5,3,7,14\]/);
assert.match(quick,/marker:\[1,4,10,22,44\]/);
assert.match(quick,/eraser:\[4,10,22,44,86\]/);
assert.match(responsive,/\.lectris-quick-properties\.is-ink-properties\{display:none!important\}/,
 "mobile should not have a duplicate collapsed brush toolbar");
assert.match(organic,/onPointerCancel=\{e=>/, "cancelled touch must not insert a bond");
assert.match(organic,/attachFunctionalGroup/);
assert.match(organic,/onPointerDown=\{e=>handleAtom/);
assert.match(organic,/window\.addEventListener\("keydown",key\)/);
assert.match(chemistry,/ObservationIcon/);
assert.match(chemistry,/aria-label="Условные обозначения"/);
console.log("Mobile gesture, direct ink controls, organic and chemistry regression checks passed");
