/** Guards for the physically fixed chemistry classroom scene.
 * Screen rendering requires browser inspection as a separate check.
 */
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const css=readFileSync("src/lektrusLabSceneLayout.css","utf8");
const markup=readFileSync("src/LektrusChemistryBench.tsx","utf8");
const main=readFileSync("src/main.tsx","utf8");
const editor=readFileSync("src/LektrusChemistryBenchEditor.tsx","utf8");
assert.match(main,/import "\.\/lektrusChemistryBench\.css";\s*import "\.\/lektrusLabSceneLayout\.css";/,
 "One scene layout stylesheet must load after old patches");
const zones=[
 {name:"Реактивы",left:1.5,width:25},
 {name:"Доска",left:27.5,width:26.5},
 {name:"Посуда",left:55,width:26.5},
 {name:"Приборы",left:82.5,width:16}
];
for(let i=0;i<zones.length-1;i++){
 const a=zones[i],b=zones[i+1];
 assert.ok(a.left+a.width+0.7<=b.left,a.name+" overlaps "+b.name);
}
assert.ok(zones[3].left+zones[3].width<=100);
const styleFor=(key)=>new RegExp("\\.lektrus-lab-bench \\."+key+"\\{([\\s\\S]*?)\\}");
for(const [key,left,width,top,height] of [
 ["lektrus-lab-reagent-furniture",1.5,25,8,32],
 ["lektrus-lab-chalkboard",27.5,26.5,8,32],
 ["lektrus-lab-glass-cupboard",55,26.5,8,22.5],
 ["lektrus-lab-indicator-cupboard",55,26.5,30.9,9.1],
 ["lektrus-lab-device-cupboard",82.5,16,8,32]
]){
 const block=css.match(styleFor(key))?.[1];
 assert.ok(block,"No placement for "+key);
 for(const [property,value] of [["left",left],["width",width],["top",top],["height",height]]){
  assert.ok(block.includes(property+":"+value+"%!important"),key+" "+property+" misplaced");
 }
}
assert.ok(8+22.5<30.9&&30.9+9.1<43,
 "Indicator shelf must be strictly below dishes and above work surface");
assert.match(css,/grid-template-columns:repeat\(4,minmax\(0,1fr\)\)!important/,
 "Dishes and indicator bottles need four readable columns");
assert.match(css,/grid-template-columns:repeat\(3,minmax\(0,1fr\)\)!important/,
 "Five-to-six vessel sets should use three large columns");
assert.match(css,/touch-action:pan-y!important/,
 "Cabinets must scroll on touch");
assert.match(markup,/role="group" aria-label="Посуда на полках"/);
assert.match(markup,/lektrus-lab-indicator-cupboard[\s\S]*?labIndicators\.map/,
 "Indicators should be visible as their own physical cupboard");
assert.match(markup,/className="lektrus-lab-chalk-wipe"/,
 "The blackboard has an actual eraser");
assert.match(markup,/lektrus-lab-board-write-toggle/,
 "Reaction board has two live writing states");
assert.match(markup,/className=\{"lektrus-lab-quantity-meter"/,
 "Quantity details stay with vessel on the tabletop");
assert.match(markup,/title="Полный состав сосуда"/);
assert.doesNotMatch(markup,/className="lektrus-lab-worktop-actions"/,
 "No floating toolbar above experiments");
assert.match(editor,/className="lektrus-lab-editor-exit"/);
assert.ok(editor.includes("onSave"),"Exit saves synchronized board");
console.log("Lab wall cabinets, indicator shelf, chalkboard, controls and fullscreen scene: OK");
