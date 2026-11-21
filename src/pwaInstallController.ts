type InstallEvent = Event & {
  prompt: () => Promise<unknown>;
  userChoice: Promise<{outcome: "accepted" | "dismissed"}>;
};

export type InstallResult = "accepted" | "dismissed" | "manual" | "unavailable";
const DISMISSED_KEY = "lektrus.pwa-install-dismissed.v1";

export function createPwaInstallController(win: Window, nav: Navigator, native: boolean) {
  const eligible = !native && win.top === win.self;
  const ua = nav.userAgent;
  const ios = /iPhone|iPad|iPod/i.test(ua) || (nav.platform === "MacIntel" && nav.maxTouchPoints > 1);
  const android = /Android/i.test(ua);
  const mobile = ios || android;
  const manualHelp = ios
    ? "Откройте Lektrus в Safari, нажмите «Поделиться» → «На экран Домой» и подтвердите добавление."
    : android
      ? "В меню браузера выберите «Установить приложение» или «Добавить на главный экран»."
      : /Macintosh|Mac OS X/i.test(ua)
        ? "В Safari выберите «Файл» → «Добавить в Dock»; в Chrome — установку приложения в меню."
        : "В меню браузера выберите «Установить Lektrus» (если браузер поддерживает установку).";
  const media = win.matchMedia?.("(display-mode: standalone)");
  const standalone = () => media?.matches === true || (nav as Navigator & {standalone?: boolean}).standalone === true;
  let dismissed = false;
  try { dismissed = win.sessionStorage.getItem(DISMISSED_KEY) === "1"; } catch { /* private mode */ }
  let deferred: InstallEvent | null = null;
  let installed = standalone();
  let busy = false;
  const listeners = new Set<() => void>();
  const read = () => ({eligible, mobile, installed, dismissed, busy, available: Boolean(deferred), manualHelp});
  let snapshot = read();
  const publish = () => {
    snapshot = read();
    listeners.forEach(listener => listener());
  };
  const dismiss = () => {
    dismissed = true;
    try { win.sessionStorage.setItem(DISMISSED_KEY, "1"); } catch { /* memory fallback */ }
    publish();
  };
  if (eligible && !installed) {
    // Register before the lazy app/site bundles or React mount. One browser
    // event can be consumed only once, regardless of which button uses it.
    win.addEventListener("beforeinstallprompt", event => {
      if (installed) return;
      const prompt = event as InstallEvent;
      if (typeof prompt.prompt !== "function") return;
      event.preventDefault();
      deferred = prompt;
      publish();
    });
    win.addEventListener("appinstalled", () => {
      installed = true;
      deferred = null;
      publish();
    });
    media?.addEventListener?.("change", () => {
      if (standalone()) { installed = true; deferred = null; publish(); }
    });
  }
  const requestInstall = async (): Promise<InstallResult> => {
    if (!eligible || installed || busy) return "unavailable";
    if (!deferred) return "manual";
    const prompt = deferred;
    deferred = null;
    busy = true;
    publish();
    try {
      // Called directly from the user's click, retaining browser activation.
      await prompt.prompt();
      const {outcome} = await prompt.userChoice;
      if (outcome === "accepted") { installed = true; deferred = null; }
      else dismiss();
      return outcome;
    } catch {
      return installed ? "accepted" : "manual";
    } finally {
      busy = false;
      publish();
    }
  };
  return {
    getSnapshot: () => snapshot,
    subscribe: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; },
    requestInstall,
    dismiss,
  };
}
