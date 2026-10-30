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
assert.match(markup,/className="lektrus-lab-composition-action"/,
 "Full composition is accessible only from the selected-vessel control");
assert.doesNotMatch(markup,/ⓘ/,"No floating info badge near glassware");
assert.match(markup,/className=\{"lektrus-lab-stopper-action"/,
 "Stopper is a selected-vessel action, not an arbitrary decoration");
assert.match(markup,/lektrus-lab-physical-stopper/,
 "Sealed flask needs visible cork in the shared scene");
assert.match(markup,/lektrus-lab-vapor-plume/,
 "Open volatile liquids must display vapor");
const shelfLayouts=css.slice(css.indexOf("2026-10-30: real furniture shelves"));
assert.match(shelfLayouts,/grid-template-columns:repeat\(2,minmax\(0,1fr\)\)!important/,
 "Glassware has two wide columns, so long names do not break");
assert.match(shelfLayouts,/grid-template-columns:1fr!important/,
 "Equipment uses spacious single-column rows");
assert.match(shelfLayouts,/white-space:nowrap!important/,
 "Cabinets use no-wrap single-line text");
assert.match(shelfLayouts,/chalk-wipe[\s\S]*?right:8px!important/,
 "The cloth must remain on the right side of the blackboard");
assert.match(shelfLayouts,/board-write-toggle[\s\S]*?left:8px!important/,
 "Writing mode switch must remain on the opposite side");

assert.doesNotMatch(markup,/className="lektrus-lab-worktop-actions"/,
 "No floating toolbar above experiments");
assert.match(editor,/className="lektrus-lab-editor-exit"/);
assert.ok(editor.includes("onSave"),"Exit saves synchronized board");
console.log("Lab wall cabinets, indicator shelf, chalkboard, controls and fullscreen scene: OK");


/* The pictured broad empty apron occupied 12% of the stage. The final
 * layout must reserve at least 95% of the height for the rear wall and
 * tabletop together, both on the board and in fullscreen. */
const finalTable=css.slice(css.lastIndexOf("Full-height worktop, 2026-10-30"));
assert.ok(finalTable.length>300,"The latest laboratory tabletop override must exist");
const surface=finalTable.match(/\.lektrus-lab-bench \.lektrus-lab-worktop-zone\{([^}]*)\}/)?.[1];
const apron=finalTable.match(/\.lektrus-lab-bench \.lektrus-lab-counter-front\{([^}]*)\}/)?.[1];
assert.ok(surface&&apron);
const bottomSurface=Number(surface.match(/bottom:([\d.]+)%!important/)?.[1]);
const apronHeight=Number(apron.match(/height:([\d.]+)%!important/)?.[1]);
assert.ok(bottomSurface<=3&&apronHeight<=3,
 "The tabletop must fill the bottom of the stage, without a thick decorative apron");
assert.match(finalTable,/top:42%!important/,
 "The tabletop remains below wall cupboards and indicator shelf");
assert.match(finalTable,/left:\.8%!important;right:\.8%!important/,
 "The surface reaches both sides of the laboratory");
assert.match(markup,/Объём твёрдой фазы по справочной плотности/,
 "Vessel inspector exposes measured solid displacement");
console.log("Full-height worktop with narrow edge and physical vessel displacement: OK");


/* Unselected glassware keeps chemistry/particles but loses floating readouts. */
assert.ok(markup.includes('{details&&(volumeMl>1e-9||contents.solid.length>0)&&'),
 "Gauges and sediment amounts belong to selected vessels only");
assert.ok(markup.includes('{showLabels&&details&&(volumeMl>1e-9||contents.solid.length>0)&&'),
 "Floating composition badge belongs to selected vessels only");
assert.ok(markup.includes('interactive&&e.currentTarget.contains(interactive)'),
 "A surrounding interactive fullscreen viewport must not swallow worktop taps");
assert.ok(markup.includes('const tableTop=compactFullscreen?'),
 "Real-pixel mobile worktop must accept taps higher than the legacy 42 percent threshold");
assert.ok(markup.includes('if(p.y<tableTop||p.y>99)return;'),
 "Header and storage taps must never dismiss selected objects");
assert.ok(markup.includes('!bench.selectedId&&!vesselMenuId&&!activeDeviceId&&!compositionId'),
 "Empty-worktop selection reset covers all transient focus types");
assert.ok(markup.includes('setVesselMenuId(null);')&&
 markup.includes('setActiveDeviceId(null);')&&
 markup.includes('if(bench.selectedId)onSelect?.("");'),
 "Clear both focus types and persist vessel deselection only when needed");
const finalHeader=css.slice(css.lastIndexOf("Compact and safe laboratory header"));
assert.ok(finalHeader.includes('padding:7px 14px!important;'),
 "The laboratory toolbar needs clear padding from its enclosing frame");
assert.ok(finalHeader.includes('right:max(9%,82px)!important;'),
 "Fullscreen header must reserve a protected slot for the close control");
assert.ok(finalHeader.includes('right:16px!important;'),
 "Fullscreen close control must sit inside, not against, the window boundary");
console.log("Lab focus resets, selected-only readouts and header insets: OK");


/* Worktop expansion also moves the sink's physical drop zone. */
const lowerSink=css.slice(css.lastIndexOf("Align the washbasin with the NEW full-height countertop"));
assert.ok(lowerSink.includes("bottom:6.5%!important;"));
assert.ok(lowerSink.includes("right:2.5%!important;"));
assert.ok(lowerSink.includes("top:auto!important;"));
assert.ok(lowerSink.includes("height:30%!important;"));
const layout=readFileSync("src/lektrusLabLayout.ts","utf8");
assert.match(layout,/LAB_SINK_BOUNDS=\{left:74\.5,right:97\.5,top:63\.5,bottom:93\.5\}/);
assert.match(layout,/p\.x>=LAB_SINK_BOUNDS\.left/);
console.log("New bottom-right sink and drag-to-drain bounds agree");


// Fullscreen on Android must not cause the two bench surfaces to race a
// simulation tick, nor repaint the entire chemistry stage through a scaled
// GPU layer. These guards cover selection + heating in the same viewport.
const app=readFileSync("src/App.tsx","utf8");
assert.match(app,/scienceEditorItem\?\.id!==item\.id&&/,
 "Board bench must stop writing while its fullscreen editor owns simulation");
assert.match(editor,/document\.body\.classList\.add\("lektrus-lab-fullscreen-active"\)/);
assert.match(editor,/document\.body\.classList\.remove\("lektrus-lab-fullscreen-active"\)/);
assert.match(editor,/zoom:stage\.scale/,
 "Android fullscreen must scale in layout space instead of transformed paint layers");
assert.doesNotMatch(editor,/transform:"translate\(-50%, -50%\) scale\("/);
const stableFullscreen=css.slice(css.lastIndexOf("Android fullscreen laboratory paint stability"));
assert.ok(stableFullscreen.length>400);
assert.match(stableFullscreen,/body\.lektrus-lab-fullscreen-active \.workspace\{[\s\S]*?visibility:hidden!important/);
assert.match(stableFullscreen,/\.lektrus-lab-editor-overlay\.is-board-identical\{[\s\S]*?background:#d6e8df!important/);
assert.match(stableFullscreen,/\.lektrus-lab-editor\.is-board-identical \.lektrus-lab-fit-stage\{[\s\S]*?transform:none!important/);
assert.match(stableFullscreen,/contain:layout paint/);
console.log("Android fullscreen laboratory: isolated paint, single simulation writer, fluid viewport OK");


// Mobile fullscreen keeps a physical-size table with one expandable shelf,
// independently of the desktop laboratory scene.
assert.match(editor,/const compact=window\.matchMedia/);
assert.match(editor,/const scale=compact\?1:h\/1000/);
assert.match(editor,/const height=compact\?h:1000/);
assert.match(editor,/height:stage\.height,zoom:stage\.scale/);
assert.match(editor,/compactFullscreen=\{stage\.compact\}/);
assert.match(markup,/const \[mobileDrawer,setMobileDrawer\]=useState<MobileDrawer\|null>\(null\)/);
for(const label of ["Реактивы","Посуда","Приборы","Индикаторы","Уравнения","Ещё"])
 assert.ok(markup.includes('["'+({Реактивы:"reagents",Посуда:"glassware",Приборы:"equipment",Индикаторы:"indicators",Уравнения:"equations",Ещё:"settings"})[label]+'","'+label+'"]'),
  "Missing compact lab drawer "+label);
assert.match(markup,/aria-expanded=\{mobileDrawer===id\}/);
assert.match(markup,/setMobileDrawer\(previous=>previous===id\?null:id\)/);
assert.match(markup,/id=\{compactFullscreen\?"lektrus-lab-compact-glassware":undefined\}/);
assert.match(markup,/id=\{compactFullscreen\?"lektrus-lab-compact-reagents":undefined\}/);
assert.match(css,/\.lektrus-lab-bench\.is-compact-fullscreen\.is-drawer-reagents \.lektrus-lab-reagent-furniture/);
assert.match(css,/\.lektrus-lab-bench\.is-compact-fullscreen\.is-drawer-equations \.lektrus-lab-chalkboard/);
assert.match(css,/\.lektrus-lab-bench\.is-compact-fullscreen \.lektrus-lab-worktop-zone\{[\s\S]*?top:105px!important/);
console.log("Phone laboratory: actual viewport-size workbench and compact dropdown shelves OK");

assert.match(css,/\.lektrus-lab-bench\.is-compact-fullscreen \.lektrus-lab-selected-vessel-actions\{[\s\S]*?position:fixed!important/,
 "Phone vessel controls must escape the narrow fullscreen header");


// Action notice is not a permanent status bar: every action, including two
// identical consecutive messages, resets a strictly 1500 ms timeout.
assert.match(markup,/const \[noticeSerial,setNoticeSerial\]=useState\(0\)/);
assert.match(markup,/const setNotice=\(text:string\)=>\{setNoticeText\(text\);setNoticeSerial\(n=>n\+1\)\}/);
assert.match(markup,/window\.setTimeout\(\(\)=>setNoticeText\(""\),1500\)/);
assert.match(markup,/window\.clearTimeout\(timer\)/);
assert.match(markup,/setVesselMenuId\(null\);setActiveDeviceId\(null\);setCompositionId\(null\)/);
const latestMobileCss=css.slice(css.lastIndexOf("Mobile laboratory usability refinements"));
assert.ok(latestMobileCss.includes("safe-area-inset-bottom"));
assert.ok(latestMobileCss.includes("max-height:min(49%,280px)!important"));
assert.ok(latestMobileCss.includes("max-height:min(49%,205px)!important"));
assert.match(latestMobileCss,/\.is-compact-fullscreen\.has-selected-vessel \.lektrus-lab-pour-hint/);
assert.match(latestMobileCss,/@media\(max-width:650px\)/);
assert.match(latestMobileCss,/@media\(max-height:490px\)/);
console.log("Mobile worktop deselection, 1.5-second notices and safe responsive drawers: OK");
