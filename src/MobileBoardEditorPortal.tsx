import { useLayoutEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";

/** Keep touch editors inside the visible viewport, even with a landscape IME. */
export default function MobileBoardEditorPortal({ children, active }: {children: ReactNode; active: boolean}) {
  const ref = useRef<HTMLDivElement>(null);
  // A touch opening an editor on board pointerdown can produce a legacy
  // synthetic click after the portal appears. That click belongs to the
  // board, not whichever editor control now occupies the same coordinates.
  const receivedPointerDown = useRef(false);
  useLayoutEffect(() => {
    if (!active || !ref.current) return;
    receivedPointerDown.current = false;
    const node = ref.current;
    const viewport = window.visualViewport;
    const update = () => {
      const visible = window.visualViewport;
      const height = visible?.height ?? window.innerHeight;
      Object.assign(node.style, {
        left: `${visible?.offsetLeft ?? 0}px`, top: `${visible?.offsetTop ?? 0}px`,
        width: `${visible?.width ?? window.innerWidth}px`, height: `${height}px`,
      });
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
    };
  }, [active]);
  if (!active) return <>{children}</>;
  return createPortal(<div ref={ref} className="lektrus-touch-editor-portal" onPointerDownCapture={event => {
    receivedPointerDown.current = true;
    // A tap outside the active input dismisses the keyboard, rather than
    // immediately discarding a draft (or committing a table).
    const target = event.target;
    const focused = document.activeElement;
    if (target instanceof HTMLElement && target.className.endsWith("-editor-backdrop") &&
      focused instanceof HTMLElement && focused.matches("textarea,input:not([type=checkbox]):not([type=radio]):not([type=range]),[contenteditable=true]")) {
      event.stopPropagation();
      focused.blur();
    }
  }} onClickCapture={event => {
    if (!receivedPointerDown.current && event.detail > 0) {
      event.preventDefault();
      event.stopPropagation();
    }
  }}>{children}</div>, document.body);
}
