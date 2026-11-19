import { useLayoutEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";

/** iOS can pan the layout viewport while its keyboard reduces the visual one. */
export function fitMobileEditorViewport(node: HTMLDivElement) {
  const viewport = window.visualViewport;
  const update = () => {
    const visible = window.visualViewport;
    const height = visible?.height ?? window.innerHeight;
    const bounds = {left: `${visible?.offsetLeft ?? 0}px`, top: `${visible?.offsetTop ?? 0}px`,
      width: `${visible?.width ?? window.innerWidth}px`, height: `${height}px`};
    Object.assign(node.style, bounds);
    for(const [key,value] of Object.entries(bounds)) node.style.setProperty(`--lektrus-editor-${key}`,value);
    node.dataset.compactHeight = String(height < 300);
  };
  update();
  window.addEventListener("resize", update);
  viewport?.addEventListener("resize", update);
  viewport?.addEventListener("scroll", update);
  return () => {
    window.removeEventListener("resize", update);
    viewport?.removeEventListener("resize", update);
    viewport?.removeEventListener("scroll", update);
    for(const key of ['left','top','width','height']) {node.style.removeProperty(key);node.style.removeProperty(`--lektrus-editor-${key}`);}
    delete node.dataset.compactHeight;
  };
}

export function dismissEditorBackdropInput(target: EventTarget | null) {
  const focused = document.activeElement;
  if (target instanceof HTMLElement && [...target.classList].some(name=>name.endsWith('-editor-backdrop'))) {
    if (focused instanceof HTMLElement && focused.matches('textarea,input:not([type=checkbox]):not([type=radio]):not([type=range]),[contenteditable=true]')) {
      focused.blur();return true;
    }
  }
  return false;
}

/** Keep touch editors inside the visible viewport, even with a landscape IME. */
export default function MobileBoardEditorPortal({ children, active }: {children: ReactNode; active: boolean}) {
  const ref = useRef<HTMLDivElement>(null);
  // A touch opening an editor on board pointerdown can produce a legacy
  // synthetic click after the portal appears. That click belongs to the
  // board, not whichever editor control now occupies the same coordinates.
  const receivedPointerDown = useRef(false);
  const openedAt = useRef(0);
  useLayoutEffect(() => {
    if (!active || !ref.current) return;
    receivedPointerDown.current = false;
    openedAt.current = performance.now();
    return fitMobileEditorViewport(ref.current);
  }, [active]);
  if (!active) return <>{children}</>;
  return createPortal(<div ref={ref} className="lektrus-touch-editor-portal" onPointerDownCapture={event => {
    receivedPointerDown.current = true;
    // A tap outside the active input dismisses the keyboard, rather than
    // immediately discarding a draft (or committing a table).
    if (dismissEditorBackdropInput(event.target)) {
      event.stopPropagation();
    }
  }} onTouchStartCapture={()=>{receivedPointerDown.current=true;}} onClickCapture={event => {
    // The placement compatibility click is brief; do not require a pointer
    // event forever on engines/assistive tech that deliver click-only input.
    if (!receivedPointerDown.current && event.detail > 0 && performance.now()-openedAt.current<500) {
      event.preventDefault();
      event.stopPropagation();
    }
  }}>{children}</div>, document.body);
}
