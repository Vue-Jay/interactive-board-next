import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";

const read=path=>fs.readFileSync(path,"utf8");
const editor=read("src/lektrusSchoolDiagrams.css");
const human=read("src/lektrusBioContinuousHuman.css");
const scene=read("src/LektrusBioHumanSystemOverlay.tsx");
const mannequin=read("src/LektrusBioMannequin.tsx");
const atlas=read("src/LektrusBioContinuousHuman.tsx");
const schoolView=read("src/LektrusSchoolDiagramView.tsx");
const schoolEditor=read("src/LektrusSchoolDiagramEditor.tsx");
const microscope=read("src/lektrusBioMicroscope.css");
const microscopeComponent=read("src/LektrusBioMicroscope.tsx");

// Regression against the user screenshot showing the organism displaced
// completely to the right, with a huge blank section to the left.
assert.match(schoolEditor,/draft\.kind==="bio-microscope"\?" lektrus-school-preview--bio"/,
 "Only biology microscope previews get the special shrink-safe layout class");
assert.match(human,/\.lektrus-school-preview--bio\{[\s\S]*?display:block!important/,
 "Editor must not use flex centering for a min-content-wide atlas");
assert.match(human,/\.lektrus-school-preview--bio>\.lektrus-bio-microscope\{[\s\S]*?min-width:0!important/,
 "Microscope must be allowed to shrink within its editor column");
assert.match(human,/\.lektrus-school-preview--bio \.lektrus-human\{[\s\S]*?grid-template-columns:minmax\(0,1fr\)/,
 "The atlas grid needs a zero-minimum track instead of intrinsic width");
assert.match(human,/\.lektrus-school-preview--bio \.lektrus-human-stage\{[\s\S]*?justify-self:center/,
 "The complete body must stay centred in the visible preview column");
assert.match(human,/\.lektrus-school-preview--bio \.lektrus-human-stage\{[\s\S]*?max-width:520px/,
 "The preview stage must not grow wider than the compact centre region");
const gridChildren=human.match(/\.lektrus-school-preview--bio \.lektrus-human>div,[\s\S]*?\}/)?.[0]??"";
assert.ok(gridChildren.includes("min-width:0"),
 "Grid children must be shrinkable");
assert.ok(!gridChildren.includes("max-width:100%"),
 "A broad max-width rule overrides the fixed stage cap and forces overflow");

assert.match(human,/\.lektrus-school-preview--bio \.lektrus-human-system-options\{[\s\S]*?overflow-x:auto/,
 "System choices must scroll INSIDE their own bar, not grow the entire atlas");
assert.match(human,/\.lektrus-school-preview--bio \.lektrus-bio-class-focus\{[\s\S]*?display:none/,
 "Redundant class information must not consume the limited editor preview height");
assert.match(microscope,/\.lektrus-bio-microscope\{[\s\S]*?display:flex/,
 "The biology root is a flex item and needs the shrink override");
assert.match(microscopeComponent,/<LektrusBioContinuousHuman\/>/,
 "Editor and board must still use the same continuous human atlas");
const uncommented=editor.replace(/\/\*[\s\S]*?\*\//g,"");
assert.doesNotMatch(uncommented,/\.lektrus-school-preview\s+svg\s*\{/,
 "A descendant SVG selector breaks every portrait organ and system icon");
assert.match(uncommented,/\.lektrus-school-preview\s*>\s*svg\s*\{/,
 "Only the DIRECT school diagram SVG may inherit the landscape ratio");
assert.match(schoolView,/return <svg viewBox="0 0 900 500"/,
 "Standalone school diagrams continue using a 9:5 SVG");
assert.match(schoolEditor,/lektrus-school-preview--bio/,
 "Human microscope has a dedicated preview container class");
assert.match(schoolEditor,/<LektrusSchoolDiagramView diagram=\{draft\}/,
 "Human atlas continues rendering inside the editor preview");

const webp=fs.readFileSync("src/assets/bio-atlas/human-biomodel.webp");
assert.equal(webp.toString("ascii",0,4),"RIFF");
assert.equal(webp.toString("ascii",8,12),"WEBP");
assert.equal(webp.toString("ascii",12,16),"VP8X");
const imageWidth=1+webp.readUIntLE(24,3);
const imageHeight=1+webp.readUIntLE(27,3);
assert.deepEqual([imageWidth,imageHeight],[360,840],
 "Do not alter the approved 360x840 gender-neutral anatomical source");
// Existing organism overview still has the same 360x840 source figure;
 // a selected system now paints a complete, independent medical-style bitmap.
assert.doesNotMatch(mannequin,/LektrusBioHumanSystemOverlay/,
 "A selected system must not draw an oversimplified vector overlay");
assert.match(mannequin,/data-anatomy=\{system\}/);
assert.match(mannequin,/data-image-kind="medical-raster"/);
const sprite=fs.readFileSync("src/assets/bio-atlas/human-seven-systems.webp");
assert.equal(sprite.toString("ascii",0,4),"RIFF");
assert.equal(sprite.toString("ascii",8,12),"WEBP");
assert.equal(sprite.toString("ascii",12,16),"VP8 ");
const spriteWidth=sprite.readUInt16LE(26)&0x3fff;
const spriteHeight=sprite.readUInt16LE(28)&0x3fff;
assert.deepEqual([spriteWidth,spriteHeight],[410*7,444],
 "Exactly seven independent full-colour anatomical panels must be packed into the asset");
assert.ok(sprite.length>35000&&sprite.length<200000,
 "Seven offline illustrations must be real raster data, reasonably compressed");

const bodyWidth=/\.lektrus-human-body\{width:([\d.]+)%;height:97%;mask-image:none\}/
 .exec(human);
assert.ok(bodyWidth,"Body width/height must be declared together");
const fractionalWidth=Number(bodyWidth[1])/100;
const fractionalHeight=.97;
const stageWidth=960,stageHeight=640;
const bodyRatio=(fractionalWidth*stageWidth)/(fractionalHeight*stageHeight);
assert.ok(Math.abs(bodyRatio-imageWidth/imageHeight)<.0001,
 "Portrait bitmap and transparent anatomy overlay must never distort");
assert.doesNotMatch(human,/@media\(max-width:650px\)\{[\s\S]*?\.lektrus-human-body\{width:29%\}/,
 "Mobile width override must not stretch the body differently");

assert.match(human,/\.lektrus-school-preview \.lektrus-human-stage\{[\s\S]*?aspect-ratio:960\/640/,
 "Editor preview must preserve original human camera proportions");
assert.match(human,/\.lektrus-human-raster-plate\{/,
 "Focused systems must render a raster plate with its own intrinsic proportions");
const rasterBody=/\.lektrus-human-body\.is-raster-focus\{\s*width:([\d.]+)%;height:97%/.exec(human);
assert.ok(rasterBody);
const plateRatio=(Number(rasterBody[1])/100*960)/(.97*640);
assert.ok(Math.abs(plateRatio-(410/444))<.003,
 "System panels must fit the stage without stretching medical illustrations");
assert.match(human,/\.lektrus-school-preview \.lektrus-human-system-icon\{[\s\S]*?height:23px/,
 "System icons must not stretch to fill the entire editor");
assert.match(human,/\.lektrus-school-preview \.lektrus-human-study-svg\{/);
assert.match(atlas,/additional=\{additional\} showSkin=\{isSkin&&system==="all"\}/,
 "Zoom must never substitute generic skin for selected organs");

for(const path of [
 "src/LektrusBioHumanSystemOverlay.tsx",
 "src/LektrusBioHumanAdditionalSystems.tsx",
 "src/LektrusBioContinuousHuman.tsx"]){
 const src=read(path);
 const parsed=ts.createSourceFile(path,src,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
 assert.equal(parsed.parseDiagnostics.length,0,path+" is not valid TSX");
}
console.log("Seven medical raster plates and editor geometry PASS: original overview, 2870x444 sprite, preserved aspect ratios and no SVG leak.");
