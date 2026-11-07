/* Lektrus selection pointer family. All assets are inline SVG, so the
   design is crisp at the actual cursor hotspot and works offline in APK/PWA. */
export type BoardSelectionCursorState =
  "idle"|"hover"|"grab"|"grabbing"|"marquee"|
  "resize-ew"|"resize-ns"|"resize-nwse"|"resize-nesw"|"rotate";

const svg=(body:string,size=32)=>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 32 32">${body}</svg>`;

const cursor=(body:string,hotspotX:number,hotspotY:number,fallback:string="default")=>
  `url("data:image/svg+xml,${encodeURIComponent(svg(body))}") ${hotspotX} ${hotspotY}, ${fallback}`;

const arrowShape="M3.8 3.2v21.3l6.1-6 5 9.1 4.3-2.3-5-8.8 8.6-.3Z";
const arrow=(hover:boolean)=>{
  const halo=hover
    ?`<path d="${arrowShape}" fill="none" stroke="#c8dcff" stroke-width="4.3" stroke-linejoin="round"/>`
    :"";
  return cursor(`${halo}<path d="${arrowShape}" fill="#fff" stroke="${hover?"#2563dc":"#396bd1"}" stroke-width="1.75" stroke-linejoin="round"/>`,3,3);
};
const hand=(closed:boolean)=>cursor(closed
  ? `<path d="M8.6 16.3V12a2.15 2.15 0 0 1 4.3 0v2.9-5.1a2.1 2.1 0 0 1 4.2 0v5.2-3.1a2 2 0 0 1 4 0v3.4a2.1 2.1 0 0 1 3.8 1.3v5.1c0 5.8-3.3 8.6-8.4 8.6h-2.1c-3.9 0-6.4-2.1-8.3-6.1l-2.4-5a2.1 2.1 0 0 1 3.3-2.4l1.6 1.5Z" fill="#eaf2ff" stroke="#285cce" stroke-width="1.7" stroke-linejoin="round"/>`
  : `<path d="M8.2 17.9V9.4a2.1 2.1 0 0 1 4.2 0v5.4-8.4a2.1 2.1 0 0 1 4.2 0v8.3-6.3a2.1 2.1 0 0 1 4.2 0v7.1-4.4a2 2 0 0 1 4 0v9.3c0 5.8-3.5 8.5-8.5 8.5h-2.2c-3.5 0-5.6-1.8-7.4-5.3l-3-5a2.15 2.15 0 0 1 3.5-2.5l1 1.8Z" fill="#fff" stroke="#396bd1" stroke-width="1.65" stroke-linejoin="round"/>`,
  12,12,closed?"grabbing":"grab");
const marquee=cursor(
  `<path d="M16 3v9m0 8v9M3 16h9m8 0h9" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round"/>`+
  `<path d="M16 3v9m0 8v9M3 16h9m8 0h9" fill="none" stroke="#396bd1" stroke-width="1.7" stroke-linecap="round"/>`+
  `<circle cx="16" cy="16" r="2.2" fill="#fff" stroke="#396bd1" stroke-width="1.4"/>`,
  16,16,"crosshair");
const resizing=(angle:number,fallback:string)=>{
  const path="M7 16h18m-13-6-6 6 6 6m8-12 6 6-6 6";
  return cursor(
    `<g transform="rotate(${angle} 16 16)" fill="none" stroke-linecap="round" stroke-linejoin="round">`+
    `<path d="${path}" stroke="#fff" stroke-width="4.4"/>`+
    `<path d="${path}" stroke="#396bd1" stroke-width="1.8"/></g>`,16,16,fallback);
};
const rotate=cursor(
  `<path d="M8.5 10.5a10 10 0 1 1-2.3 13" fill="none" stroke="#fff" stroke-width="4.6" stroke-linecap="round"/>`+
  `<path d="M8.5 10.5a10 10 0 1 1-2.3 13m-1.3-6.1 1.3 6.1 6-1.4" fill="none" stroke="#396bd1" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/>`,
  16,16,"crosshair");

export const BOARD_SELECTION_CURSORS:Readonly<Record<BoardSelectionCursorState,string>>={
  idle:arrow(false),
  hover:arrow(true),
  grab:hand(false),
  grabbing:hand(true),
  marquee,
  "resize-ew":resizing(0,"ew-resize"),
  "resize-ns":resizing(90,"ns-resize"),
  "resize-nwse":resizing(45,"nwse-resize"),
  "resize-nesw":resizing(-45,"nesw-resize"),
  rotate,
};

export function selectionCursorForHandle(handle:string|undefined|null):BoardSelectionCursorState{
  if(handle==="rotate")return "rotate";
  if(handle==="n"||handle==="s")return "resize-ns";
  if(handle==="w"||handle==="e")return "resize-ew";
  if(handle==="nw"||handle==="se")return "resize-nwse";
  if(handle==="ne"||handle==="sw")return "resize-nesw";
  return "hover";
}

export function selectionCursorForGesture(mode:string|undefined,dragging=false,handle?:string):BoardSelectionCursorState|null{
  if(mode==="drag"||mode==="hand-smart")return dragging?"grabbing":"grab";
  if(mode==="marquee")return "marquee";
  if(mode==="resize")return selectionCursorForHandle(handle);
  if(mode==="rotate")return "rotate";
  if(mode==="connector-end")return "hover";
  // Pan, pencil, lasso etc have their own tool-specific cursor semantics.
  return null;
}

export function selectionCursorForTarget(target:Element|null):BoardSelectionCursorState{
  if(!target)return "idle";
  const handle=target.closest<HTMLElement>("[data-transform-handle],[data-group-transform-handle]");
  if(handle)return selectionCursorForHandle(handle.dataset.transformHandle??handle.dataset.groupTransformHandle);
  if(target.closest("[data-group-selection-drag],[data-board-selection-grip]"))return "grab";
  if(target.closest("[data-connector-endpoint]"))return "hover";
  // A selected object's edit buttons and embedded inputs keep their native
  // control cursors. They must not look like they move the whole object.
  if(target.closest("button,input,textarea,select,a,[role='button'],[role='slider'],[contenteditable='true'],[data-board-interactive]"))return "idle";
  return target.closest("[data-object]")?"hover":"idle";
}

export function applyBoardSelectionCursor(board:HTMLElement|null,state:BoardSelectionCursorState):void{
  if(!board||board.dataset.selectionCursor===state)return;
  board.dataset.selectionCursor=state;
  board.style.setProperty("--lektrus-selection-cursor",BOARD_SELECTION_CURSORS[state]);
}

export function clearBoardSelectionCursor(board:HTMLElement|null):void{
  if(!board)return;
  delete board.dataset.selectionCursor;
  board.style.removeProperty("--lektrus-selection-cursor");
}
