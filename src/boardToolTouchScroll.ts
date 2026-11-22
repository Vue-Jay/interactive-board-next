/** Keep tablet tool chrome touch-first at every board viewport width.
 * Scroll the controls, never the canvas, even inside a rotated browser frame. */
export function installBoardToolTouchScroll() {
  const html = document.documentElement;
  const railSelector = "nav.mobile-board-tools";
  const groupsSelector = ".mobile-tools-groups";
  const rootSelector = railSelector + "," + groupsSelector;
  html.dataset.toolTouchScroll = "true";
  const sync = () => {
    const tablet = window.innerWidth >= 580 &&
      (Math.min(screen.width, screen.height) >= 580 || window.innerHeight >= 580);
    if (tablet) html.setAttribute("data-tablet-tool-dock", "true");
    else html.removeAttribute("data-tablet-tool-dock");
  };
  type Gesture = { root: HTMLElement; scroll: HTMLElement; axis: "x" | "y"; id: number; start: number; cross: number; offset: number; moved: boolean; samples: { time: number; position: number }[] };
  let touch: Gesture | null = null, pointer: Gesture | null = null;
  let inertiaFrame = 0;
  const stopInertia = () => {
    if (inertiaFrame) cancelAnimationFrame(inertiaFrame);
    inertiaFrame = 0;
  };
  const positionOf = (g: Gesture) => g.axis === "y" ? g.scroll.scrollTop : g.scroll.scrollLeft;
  const setPosition = (g: Gesture, position: number) => {
    if (g.axis === "y") g.scroll.scrollTop = position;
    else g.scroll.scrollLeft = position;
  };
  const startInertia = (g: Gesture) => {
    // The catalogue is manually scrolled so rotated WebViews cannot transpose
    // its axes. Recreate natural deceleration after the finger is lifted.
    if (!g.root.matches(groupsSelector) || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const last = g.samples[g.samples.length - 1];
    const first = g.samples[0];
    if (!first || !last || performance.now() - last.time > 100 || last.time <= first.time) return;
    let velocity = Math.max(-2.8, Math.min(2.8, (last.position - first.position) / (last.time - first.time)));
    if (Math.abs(velocity) < .12) return;
    stopInertia();
    let position = positionOf(g);
    let previous = performance.now();
    const frame = (now: number) => {
      inertiaFrame = 0;
      if (!g.scroll.isConnected || !g.scroll.clientHeight || !g.scroll.clientWidth) return;
      const dt = Math.max(0, Math.min(50, now - previous));
      previous = now;
      // Exponential friction is independent of display refresh rate.
      const decay = Math.exp(-dt / 210);
      position += velocity * 210 * (1 - decay);
      velocity *= decay;
      const max = g.axis === "y" ? g.scroll.scrollHeight - g.scroll.clientHeight : g.scroll.scrollWidth - g.scroll.clientWidth;
      setPosition(g, Math.max(0, Math.min(max, position)));
      if (position <= 0 || position >= max || Math.abs(velocity) < .035) return;
      inertiaFrame = requestAnimationFrame(frame);
    };
    inertiaFrame = requestAnimationFrame(frame);
  };
  let suppressed: { root: HTMLElement; until: number } | null = null;
  const begin = (target: EventTarget | null, id: number, x: number, y: number): Gesture | null => {
    if (!(target instanceof Element)) return null;
    const root = target.closest<HTMLElement>(rootSelector);
    if (!root) return null;
    const middle = root.querySelector<HTMLElement>(".mobile-tool-cluster-create");
    const candidates = [middle, root];
    for (const scroll of candidates) {
      if (!scroll || !scroll.clientWidth || !scroll.clientHeight) continue;
      const css = getComputedStyle(scroll);
      const vertical = /auto|scroll/.test(css.overflowY) && scroll.scrollHeight > scroll.clientHeight + 1;
      const horizontal = /auto|scroll/.test(css.overflowX) && scroll.scrollWidth > scroll.clientWidth + 1;
      if (!vertical && !horizontal) continue;
      const axis = vertical ? "y" : "x";
      return { root, scroll, axis, id, start: vertical ? y : x, cross: vertical ? x : y, offset: vertical ? scroll.scrollTop : scroll.scrollLeft, moved: false, samples: [{ time: performance.now(), position: vertical ? scroll.scrollTop : scroll.scrollLeft }] };
    }
    return null;
  };
  const move = (g: Gesture, x: number, y: number, event: Event) => {
    const delta = g.start - (g.axis === "y" ? y : x);
    const cross = g.cross - (g.axis === "y" ? x : y);
    if (!g.moved && (Math.abs(delta) < 8 || Math.abs(delta) < Math.abs(cross))) return;
    g.moved = true;
    if (event.cancelable) event.preventDefault();
    setPosition(g, g.offset + delta);
    const time = performance.now();
    g.samples.push({ time, position: positionOf(g) });
    // Only recent movement determines the release velocity, so pauses and
    // direction changes do not launch the list unexpectedly.
    while (g.samples.length > 1 && time - g.samples[0].time > 120) g.samples.shift();
  };
  const end = (g: Gesture | null, cancelled = false) => {
    if (g?.moved) {
      suppressed = { root: g.root, until: Date.now() + 650 };
      if (!cancelled) startInertia(g);
    }
  };
  const touchStart = (e: TouchEvent) => {
    stopInertia();
    pointer = null;
    suppressed = null;
    const t = e.changedTouches[0];
    touch = e.touches.length === 1 && t ? begin(e.target, t.identifier, t.clientX, t.clientY) : null;
  };
  const touchMove = (e: TouchEvent) => {
    if (!touch || e.touches.length !== 1) return;
    const t = Array.from(e.touches).find(t => t.identifier === touch?.id);
    if (t) move(touch, t.clientX, t.clientY, e);
  };
  const touchEnd = (e: TouchEvent) => { end(touch, e.type === "touchcancel"); touch = null; };
  const pointerDown = (e: PointerEvent) => {
    stopInertia();
    if(e.pointerType !== "touch" || !e.isPrimary || touch) return;
    suppressed = null;
    pointer = begin(e.target, e.pointerId, e.clientX, e.clientY);
  };
  const pointerMove = (e: PointerEvent) => {
    if (!touch && pointer?.id === e.pointerId) move(pointer, e.clientX, e.clientY, e);
  };
  const pointerEnd = (e: PointerEvent) => {
    if (pointer?.id === e.pointerId) { end(pointer, e.type === "pointercancel"); pointer = null; }
  };
  const click = (e: MouseEvent) => {
    if (suppressed && Date.now() < suppressed.until && e.target instanceof Node && suppressed.root.contains(e.target)) {
      e.preventDefault();
      e.stopImmediatePropagation();
    }
    suppressed = null;
  };
  sync();
  window.addEventListener("resize", sync);
  window.addEventListener("resize", stopInertia);
  document.addEventListener("wheel", stopInertia, {capture:true, passive:true});
  document.addEventListener("touchstart", touchStart, {capture:true, passive:true});
  document.addEventListener("touchmove", touchMove, {capture:true, passive:false});
  document.addEventListener("touchend", touchEnd, true);
  document.addEventListener("touchcancel", touchEnd, true);
  document.addEventListener("pointerdown", pointerDown, true);
  document.addEventListener("pointermove", pointerMove, {capture:true, passive:false});
  document.addEventListener("pointerup", pointerEnd, true);
  document.addEventListener("pointercancel", pointerEnd, true);
  document.addEventListener("click", click, true);
  return () => {
    stopInertia();
    delete html.dataset.toolTouchScroll;
    html.removeAttribute("data-tablet-tool-dock");
    window.removeEventListener("resize", sync);
    window.removeEventListener("resize", stopInertia);
    document.removeEventListener("wheel", stopInertia, true);
    document.removeEventListener("touchstart", touchStart, true);
    document.removeEventListener("touchmove", touchMove, true);
    document.removeEventListener("touchend", touchEnd, true);
    document.removeEventListener("touchcancel", touchEnd, true);
    document.removeEventListener("pointerdown", pointerDown, true);
    document.removeEventListener("pointermove", pointerMove, true);
    document.removeEventListener("pointerup", pointerEnd, true);
    document.removeEventListener("pointercancel", pointerEnd, true);
    document.removeEventListener("click", click, true);
  };
}
