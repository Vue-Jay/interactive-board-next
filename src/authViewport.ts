// Keep the centered form's geometry stable while the IME reduces the available
// viewport. Only the scrollport shrinks; a long registration form remains scrollable.
export function installAuthViewport(shell: HTMLElement, native: boolean, win = window, doc = document): () => void {
  const mobile = win.matchMedia('(max-width:700px), (any-pointer:coarse)');
  let lastWidth = 0, stableHeight = 0, lastEditBlur = -Infinity;
  const editing = () => {
    const active = doc.activeElement;
    return !!active && shell.contains(active) && active.matches('input:not([type="radio"]):not([type="checkbox"]):not([readonly]),textarea');
  };
  const sync = () => {
    const enabled = native || mobile.matches;
    if (!enabled) { shell.removeAttribute('data-auth-mobile'); lastWidth = stableHeight = 0; return; }
    shell.setAttribute('data-auth-mobile', '');
    const width = win.innerWidth;
    const viewport = win.visualViewport;
    // Pinch zoom is an accessibility feature on the web, not a keyboard resize.
    const visible = Math.round(Math.min(win.innerHeight, viewport && Math.abs(viewport.scale - 1) < .02 ? viewport.height : win.innerHeight));
    if (width !== lastWidth || !stableHeight || visible >= stableHeight || (!editing() && win.performance.now() - lastEditBlur > 500)) {
      stableHeight = visible;
    }
    lastWidth = width;
    shell.style.setProperty('--auth-visible-height', `${visible}px`);
    shell.style.setProperty('--auth-stable-height', `${stableHeight}px`);
  };
  const onFocusOut = (event: FocusEvent) => {
    const target = event.target;
    if (target instanceof Element && target.matches('input:not([type="radio"]):not([type="checkbox"]),textarea')) lastEditBlur = win.performance.now();
  };
  sync();
  win.addEventListener('resize', sync);
  win.visualViewport?.addEventListener('resize', sync);
  shell.addEventListener('focusout', onFocusOut);
  return () => {
    win.removeEventListener('resize', sync);
    win.visualViewport?.removeEventListener('resize', sync);
    shell.removeEventListener('focusout', onFocusOut);
    shell.removeAttribute('data-auth-mobile');
    shell.style.removeProperty('--auth-visible-height');
    shell.style.removeProperty('--auth-stable-height');
  };
}
