/**
 * Select-mode board object pickup.
 *
 * Third-party teaching widgets frequently stop pointerdown bubbling on
 * their entire root (matching exercises, phonetics, biology, code editors).
 * The board must start its own drag in CAPTURE phase from inert pixels, but
 * never steal a real control, SVG hotspot or independently panning canvas.
 *
 * The decision is based on the pointer's DOM ancestry, NOT the type of
 * subject tool. This also covers future school objects without another
 * per-tool event handler.
 */
export const BOARD_OBJECT_INTERACTIVE_SELECTOR=[
  "button","input","textarea","select","option","a","summary",
  "label[for]","iframe","video","audio","embed","object",
  "[contenteditable]","[draggable='true']",
  "[role='button']","[role='slider']","[role='link']",
  "[role='checkbox']","[role='switch']","[role='tab']",
  "[role='menuitem']","[role='textbox']","[role='combobox']",
  "[role='log']",
  "[data-board-interactive]","[data-board-gesture-owner]",
  "[data-transform-handle]","[data-group-transform-handle]",
  "[data-connector-endpoint]","[data-group-selection-drag]",
  "[data-board-selection-grip]",
  ".selection-toolbar-screen",
  // These surfaces pan/zoom/select their OWN content. Their headers and
  // other inert pixels can still be used to reposition the whole object.
  ".lektrus-atlas-map-box",
  ".lektrus-lab-bench",
  ".lektrus-bio-unified-viewport",
  ".lek-anatomy-scene",
  ".graph-point",
  ".lektrus-orbit-control",
  ".lektrus-ray-control",
].join(",");

export function boardObjectAtInertPointerTarget(target:Element|null):HTMLElement|null{
  if(!target)return null;
  const object=target.closest<HTMLElement>(".board-object[data-object]");
  if(!object)return null;
  const control=target.closest(BOARD_OBJECT_INTERACTIVE_SELECTOR);
  return control&&object.contains(control)?null:object;
}
