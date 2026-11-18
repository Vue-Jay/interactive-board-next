// Installed once at startup, including public forms and all workspace routes.
const editableSelector = 'textarea:not([readonly]):not([disabled]),input:not([readonly]):not([disabled]):not([type="hidden"]):not([type="button"]):not([type="submit"]):not([type="reset"]):not([type="checkbox"]):not([type="radio"]):not([type="range"]):not([type="color"]):not([type="file"]):not([type="image"]),[contenteditable]:not([contenteditable="false"])';

function editable(element: Element | null): HTMLElement | null {
  return element?.closest<HTMLElement>(editableSelector) ?? null;
}

function isFieldTarget(target: Element | null): boolean {
  const label = target?.closest<HTMLLabelElement>('label');
  return Boolean(editable(target) || editable(label?.control ?? null) || target?.closest('select'));
}

export function installMobileKeyboardDismissal(native: boolean, doc = document, win = window): () => void {
  const mobile = win.matchMedia('(max-width: 1100px), (any-pointer: coarse)');
  type Tap = { field: HTMLElement; id: number; x: number; y: number };
  let pending: Tap | null = null;
  let touchPending: Tap | null = null;
  const targetOf = (event: Event) => event.composedPath().find((node): node is Element => node instanceof Element) ?? null;
  const dismiss = (field: HTMLElement) => win.setTimeout(() => {
    if (editable(doc.activeElement) === field) field.blur();
  }, 0);
  const moved = (event: PointerEvent) => pending && Math.hypot(event.clientX - pending.x, event.clientY - pending.y) > 10;
  const down = (event: PointerEvent) => {
    pending = null;
    if (!event.isPrimary || event.button !== 0 || !(native || mobile.matches || event.pointerType === 'touch')) return;
    const field = editable(doc.activeElement);
    const target = targetOf(event);
    if (!field || !target || field.contains(target) || isFieldTarget(target)) return;
    pending = { field, id: event.pointerId, x: event.clientX, y: event.clientY };
  };
  const move = (event: PointerEvent) => { if (pending?.id === event.pointerId && moved(event)) pending = null; };
  const cancel = () => { pending = null; };
  const up = (event: PointerEvent) => {
    if (pending?.id !== event.pointerId) return;
    const tap = pending;
    const wasMoved = moved(event);
    pending = null;
    if (wasMoved || isFieldTarget(targetOf(event))) return;
    // Do not intercept clicks or steal focus from a newly opened editor.
    dismiss(tap.field);
  };
  // WKWebView may cancel a pointer sequence while moving the visual viewport
  // around a focused input. Keep the independent real touch sequence as a
  // fallback, never treating a scroll or multi-finger gesture as a tap.
  const touchStart = (event: TouchEvent) => {
    touchPending = null;
    if (event.touches.length !== 1) return;
    const field = editable(doc.activeElement), target=targetOf(event), touch=event.changedTouches[0];
    if (!field || !touch || !target || field.contains(target) || isFieldTarget(target)) return;
    touchPending={field,id:touch.identifier,x:touch.clientX,y:touch.clientY};
  };
  const touchMove = (event: TouchEvent) => {
    const p=touchPending;
    if (!p) return;
    const touch=Array.from(event.changedTouches).find(t=>t.identifier===p.id);
    if (event.touches.length!==1 || touch&&Math.hypot(touch.clientX-p.x,touch.clientY-p.y)>10) touchPending=null;
  };
  const touchEnd = (event: TouchEvent) => {
    const p=touchPending;touchPending=null;
    if (!p || event.touches.length || isFieldTarget(targetOf(event))) return;
    const touch=Array.from(event.changedTouches).find(t=>t.identifier===p.id);
    if (touch&&Math.hypot(touch.clientX-p.x,touch.clientY-p.y)<=10) dismiss(p.field);
  };
  const touchCancel = () => {touchPending=null;};
  doc.addEventListener('pointerdown', down, true);
  doc.addEventListener('pointermove', move, true);
  doc.addEventListener('pointerup', up, true);
  doc.addEventListener('pointercancel', cancel, true);
  doc.addEventListener('touchstart',touchStart,{capture:true,passive:true});
  doc.addEventListener('touchmove',touchMove,{capture:true,passive:true});
  doc.addEventListener('touchend',touchEnd,{capture:true,passive:true});
  doc.addEventListener('touchcancel',touchCancel,{capture:true,passive:true});
  return () => {
    pending = null;touchPending=null;
    doc.removeEventListener('pointerdown', down, true);
    doc.removeEventListener('pointermove', move, true);
    doc.removeEventListener('pointerup', up, true);
    doc.removeEventListener('pointercancel', cancel, true);
    doc.removeEventListener('touchstart',touchStart,true);
    doc.removeEventListener('touchmove',touchMove,true);
    doc.removeEventListener('touchend',touchEnd,true);
    doc.removeEventListener('touchcancel',touchCancel,true);
  };
}
