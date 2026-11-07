/**
 * Universal whiteboard object pickup boundary.
 *
 * School widgets may stop pointerdown bubbling on their root. The board picks
 * up ordinary object surfaces during CAPTURE, but only when the original
 * pointer target is NOT an embedded control or a nested gesture canvas.
 *
 * Drag eligibility is based on ancestry, never on subject/tool kind.
 */
export const BOARD_OBJECT_CONTROL_SELECTOR=[
  "button","input","textarea","select","option","a","summary",
  "label[for]","iframe","video","audio","embed","object",
  "[contenteditable]","[draggable='true']",
  "[role='button']","[role='slider']","[role='link']",
  "[role='checkbox']","[role='switch']","[role='tab']",
  "[role='menuitem']","[role='textbox']","[role='combobox']",
  "[role='log']",
  "[data-board-interactive]",
  "[data-transform-handle]","[data-group-transform-handle]",
  "[data-connector-endpoint]","[data-group-selection-drag]",
  "[data-board-selection-grip]",
  ".selection-toolbar-screen",
].join(",");

export const BOARD_OBJECT_GESTURE_SELECTOR=[
  "[data-board-gesture-owner]",
  // Panning, zooming, laboratory experiments and graph vertices belong
  // to the nested widget, not to the whiteboard object.
  ".lektrus-atlas-map-box",
  ".lektrus-lab-bench",
  ".lektrus-bio-unified-viewport",
  ".lek-anatomy-stage",
  ".lektrus-human-stage",
  ".graph-point",
  ".lektrus-orbit-control",
  ".lektrus-ray-control",
].join(",");

export function boardObjectAtInertPointerTarget(target:Element|null):HTMLElement|null{
  if(!target)return null;
  const object=target.closest<HTMLElement>(".board-object[data-object]");
  if(!object)return null;
  const activeControl=target.closest(BOARD_OBJECT_CONTROL_SELECTOR);
  if(activeControl&&object.contains(activeControl))return null;
  // A decorative header or a chemistry blackboard can opt in as a safe
  // handle even when nested in a larger pan/zoom/lab surface. Real controls
  // within that header were already excluded above.
  const explicitHandle=target.closest("[data-board-drag-surface]");
  if(explicitHandle&&object.contains(explicitHandle))return object;
  const gestureOwner=target.closest(BOARD_OBJECT_GESTURE_SELECTOR);
  return gestureOwner&&object.contains(gestureOwner)?null:object;
}
