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
        menu.style.setProperty("touch-action", "pan-y", "important");
        menu.style.setProperty("overscroll-behavior", "contain", "important");
        managed.add(menu);
      }
    };
    const schedule = () => {
      update();
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(update);
    };
    // Details toggles are deferred in some old WebViews. An attribute
    // observer corrects geometry before their first painted open frame.
    const observer = new MutationObserver(schedule);
    observer.observe(document.body, {attributes: true, subtree: true, attributeFilter: ["open"]});
    document.addEventListener("toggle", schedule, true);
    window.addEventListener("resize", schedule);
    viewport?.addEventListener("resize", schedule);
    viewport?.addEventListener("scroll", schedule);
    schedule();
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
      document.removeEventListener("toggle", schedule, true);
      window.removeEventListener("resize", schedule);
      viewport?.removeEventListener("resize", schedule);
      viewport?.removeEventListener("scroll", schedule);
      managed.forEach(clear);
    };
  }, [enabled]);
}
