import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const source=readFileSync("src/App.tsx","utf8");
const fragment=(from,to)=>{
 const start=source.indexOf(from);
 const end=source.indexOf(to,start+from.length);
 assert.ok(start>=0&&end>start,"Missing source block: "+from);
 return source.slice(start,end);
};

// The prior compositor optimization was accidentally undone because a fresh
// {} guide object was passed to React on EVERY pointermove. On large boards
// this rerendered all object and ink layers despite the direct CSS transform.
const clear=fragment("const [guides, setGuides]","const [contextMenu,");
assert.match(clear,/const clearGuides = \(\) => setGuides\(current =>\s*current\.x == null && current\.y == null \? current : \{\}\)/);
const moves=fragment("const move = (e: PE<HTMLElement>) => {","  useEffect(() => {");
const pan=moves.slice(moves.indexOf('if (g.mode === "hand-smart")'),moves.indexOf('} else if (g.mode === "drag")'));
assert.doesNotMatch(pan,/setGuides\(|clearGuides\(|setItems\(|setView\(/,
 "Pan and hand-navigation pointer samples must not enqueue React updates");
assert.match(pan,/scheduleViewerPan\(/);
assert.match(moves,/const snapped = snapDraggedBounds\(cache\.moving, cache\.others/);
assert.match(source,/const dragSnapCache = useRef\(new WeakMap<Gesture/);
assert.match(moves,/cache\.selected\.has\(item\.id\)/);

// Attached arrows used to perform two O(board-size) linear searches per
// connector during EVERY object-move preview. A single indexed lookup keeps
// interactive movement linear even with many diagram connections.
const anchors=fragment("const bindingPoint =","const connectorAnchor =");
assert.match(anchors,/byId\.get\(binding\.itemId\)/);
assert.doesNotMatch(anchors,/items\.find\(/);
const synced=fragment("const syncBoundConnectors =","function Connector(");
assert.match(synced,/const byId=new Map\(source\.map\(/);
assert.match(synced,/bindingPoint\(item\.connectorStartBinding, byId\)/);
assert.match(synced,/bindingPoint\(item\.connectorEndBinding, byId\)/);

// The desktop wheel/trackpad path must use the same cheap compositor as
// touch/hand, rather than scheduling a React update per wheel event.
const wheel=fragment("const wheel = (e: WheelEvent) => {","element.addEventListener(\"wheel\"");
assert.match(wheel,/viewerPendingPan\.current\?\?viewRef\.current/);
assert.match(wheel,/scheduleViewerPan\(next\)/);
assert.match(wheel,/viewerWheelTimer\.current=window\.setTimeout\(\(\)=>finishViewerPan\(\),90\)/);
assert.doesNotMatch(wheel,/setView\(|zoom\(Math\.exp|backgroundPosition/);
assert.match(source,/const finishViewerPan = \(cancel=false,restore\?:View\) => \{\s*if\(viewerWheelTimer\.current!==null\)/);
assert.match(source,/if \(viewerWheelTimer\.current !== null\) clearTimeout\(viewerWheelTimer\.current\)/);

// Skip expensive viewport math and cursor broadcasts while moving the board.
// The final viewport still goes through a regular state commit on release.
const pointer=fragment("onPointerMove={(e) => {","onContextMenu={(e) => {");
assert.match(pointer,/activeGesture\?\.mode==="pan"/);
assert.match(pointer,/if\(activeGesture\?\.mode==="pan"[\s\S]*?move\(e\);\s*return;/);
assert.match(pointer,/cursorChannel\.current\?\.sendCursor/);
assert.match(source,/const diagnosticFps = useRef<HTMLSpanElement>\(null\)/);
assert.match(source,/rAF FPS: <span ref=\{diagnosticFps\}>/);
console.log("Board FPS: pan/hand/wheel avoid React updates, snapping cached, on-demand rAF diagnostics OK");
