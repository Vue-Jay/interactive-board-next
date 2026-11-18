import { useLayoutEffect } from "react";

const MENU_SELECTOR = ".topbar .topbar-right details > .topbar-more-popover," +
  ".topbar .topbar-right details > .lektrus-board-actions-popover," +
  ".topbar .topbar-right details > .presence-popover," +
  ".topbar .topbar-right details > .lectris-layout-menu";

/** Older Android WebViews can retain portrait CSS vh after native rotation.
 * Measure the available space beneath each actual menu anchor instead. */
export function useTouchBoardMenuViewport(enabled: boolean) {
  useLayoutEffect(() => {
    if (!enabled) return;
    const managed = new Set<HTMLElement>();
    const viewport = window.visualViewport;
    let frame = 0;
    let gesture: {menu: HTMLElement; id: number; x: number; y: number; scroll: number; moved: boolean} | null = null;
    let cancelClick: HTMLElement | null = null;
    const clear = (menu: HTMLElement) => {
      menu.style.removeProperty("max-height");
      menu.style.removeProperty("overflow-y");
      menu.style.removeProperty("overflow-x");
      menu.style.removeProperty("box-sizing");
      menu.style.removeProperty("touch-action");
      menu.style.removeProperty("overscroll-behavior");
    };
    const update = () => {
      const current = window.visualViewport;
      const bottom = Math.min(window.innerHeight, current ? current.offsetTop + current.height : window.innerHeight);
      for (const menu of document.querySelectorAll<HTMLElement>(MENU_SELECTOR)) {
        if (!menu.parentElement?.hasAttribute("open")) {
          if (managed.delete(menu)) clear(menu);
          continue;
        }
        const top = menu.getBoundingClientRect().top;
        menu.style.setProperty("max-height", `${Math.max(0, Math.floor(bottom - top - 8))}px`, "important");
        menu.style.setProperty("box-sizing", "border-box", "important");
        menu.style.setProperty("overflow-y", "auto", "important");
        menu.style.setProperty("overflow-x", "hidden", "important");
        // A portrait browser's rotated board iframe can transpose native
        // scrolling axes. Track logical pointer coordinates in the menu.
        menu.style.setProperty("touch-action", "none", "important");
        menu.style.setProperty("overscroll-behavior", "contain", "important");
        managed.add(menu);
      }
    };
    const schedule = () => {
      update();
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(update);
    };
    const pointerDown = (event: PointerEvent) => {
      cancelClick = null;
      if (event.pointerType !== "touch" || !event.isPrimary || !(event.target instanceof Element)) return;
      const menu = event.target.closest<HTMLElement>(MENU_SELECTOR);
      if (!menu || !managed.has(menu) || menu.scrollHeight <= menu.clientHeight) return;
      gesture = {menu, id: event.pointerId, x: event.clientX, y: event.clientY, scroll: menu.scrollTop, moved: false};
    };
    const pointerMove = (event: PointerEvent) => {
      const drag = gesture;
      if (!drag || drag.id !== event.pointerId) return;
      if (!drag.moved && Math.hypot(event.clientX-drag.x, event.clientY-drag.y) < 8) return;
      if (!drag.moved) {
        drag.moved = true;
        try { drag.menu.setPointerCapture(event.pointerId); } catch { /* pointer may already have ended */ }
      }
      event.preventDefault();
      drag.menu.scrollTop = drag.scroll + drag.y - event.clientY;
    };
    const pointerEnd = (event: PointerEvent) => {
      if (!gesture || gesture.id !== event.pointerId) return;
      if (gesture.moved) cancelClick = gesture.menu;
      gesture = null;
    };
    const click = (event: MouseEvent) => {
      if (cancelClick && event.target instanceof Node && cancelClick.contains(event.target)) {
        // A swipe can otherwise activate the button that started the drag.
        event.preventDefault();
        event.stopImmediatePropagation();
      }
      cancelClick = null;
    };
    // Details toggles are deferred in some old WebViews. An attribute
    // observer corrects geometry before their first painted open frame.
    const observer = new MutationObserver(schedule);
    observer.observe(document.body, {attributes: true, subtree: true, attributeFilter: ["open"]});
    document.addEventListener("toggle", schedule, true);
    document.addEventListener("pointerdown", pointerDown, true);
    document.addEventListener("pointermove", pointerMove, {capture: true, passive: false});
    document.addEventListener("pointerup", pointerEnd, true);
    document.addEventListener("pointercancel", pointerEnd, true);
    document.addEventListener("click", click, true);
    window.addEventListener("resize", schedule);
    viewport?.addEventListener("resize", schedule);
    viewport?.addEventListener("scroll", schedule);
    schedule();
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
      document.removeEventListener("toggle", schedule, true);
      document.removeEventListener("pointerdown", pointerDown, true);
      document.removeEventListener("pointermove", pointerMove, true);
      document.removeEventListener("pointerup", pointerEnd, true);
      document.removeEventListener("pointercancel", pointerEnd, true);
      document.removeEventListener("click", click, true);
      window.removeEventListener("resize", schedule);
      viewport?.removeEventListener("resize", schedule);
      viewport?.removeEventListener("scroll", schedule);
      managed.forEach(clear);
    };
  }, [enabled]);
}
