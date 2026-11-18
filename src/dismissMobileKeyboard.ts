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
  let pending: { field: HTMLElement; id: number; x: number; y: number } | null = null;
  const targetOf = (event: PointerEvent) => event.composedPath().find((node): node is Element => node instanceof Element) ?? null;
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
    win.setTimeout(() => {
      if (editable(doc.activeElement) === tap.field) tap.field.blur();
    }, 0);
  };
  doc.addEventListener('pointerdown', down, true);
  doc.addEventListener('pointermove', move, true);
  doc.addEventListener('pointerup', up, true);
  doc.addEventListener('pointercancel', cancel, true);
  return () => {
    pending = null;
    doc.removeEventListener('pointerdown', down, true);
    doc.removeEventListener('pointermove', move, true);
    doc.removeEventListener('pointerup', up, true);
    doc.removeEventListener('pointercancel', cancel, true);
  };
}
