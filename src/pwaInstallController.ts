type InstallEvent = Event & {
  prompt: () => Promise<unknown>;
  userChoice: Promise<{outcome: "accepted" | "dismissed"}>;
};
type RelatedAppsNavigator = Navigator & {
  getInstalledRelatedApps?: () => Promise<Array<{platform: string; url?: string; id?: string}>>;
};

export type InstallResult = "accepted" | "dismissed" | "manual" | "unavailable";
const DISMISSED_KEY = "lektrus.pwa-install-dismissed.v1";
const INSTALLED_KEY = "lektrus.pwa-installed.v1";
const MANUAL_OFFER_SEEN_KEY = "lektrus.pwa-manual-offer-seen.v1";

export function createPwaInstallController(win: Window, nav: Navigator, native: boolean) {
  const eligible = !native && win.top === win.self;
  const ua = nav.userAgent;
  const ios = /iPhone|iPad|iPod/i.test(ua) || (nav.platform === "MacIntel" && nav.maxTouchPoints > 1);
  const android = /Android/i.test(ua);
  const mobile = ios || android;
  const relatedApps = (nav as RelatedAppsNavigator).getInstalledRelatedApps;
  // Chromium does not offer beforeinstallprompt when its PWA is already
  // installed. Never guess from "not standalone" and flash a redundant banner.
  const requiresPrompt = android && (typeof relatedApps === "function" || /Chrome|Chromium|EdgA|SamsungBrowser/i.test(ua));
  const manualHelp = ios
    ? "Откройте Lektrus в Safari, нажмите «Поделиться» → «На экран Домой» и подтвердите добавление."
    : android
      ? "В меню браузера выберите «Установить приложение» или «Добавить на главный экран»."
      : /Macintosh|Mac OS X/i.test(ua)
        ? "В Safari выберите «Файл» → «Добавить в Dock»; в Chrome — установку приложения в меню."
        : "В меню браузера выберите «Установить Lektrus» (если браузер поддерживает установку).";
  const media = win.matchMedia?.("(display-mode: standalone)");
  const standalone = () => media?.matches === true || (nav as Navigator & {standalone?: boolean}).standalone === true;
  const hasLocal = (key: string) => {
    try { return win.localStorage.getItem(key) === "1"; } catch { return false; }
  };
  const saveLocal = (key: string, value: boolean) => {
    try { if (value) win.localStorage.setItem(key, "1"); else win.localStorage.removeItem(key); }
    catch { /* storage may be unavailable in private mode */ }
  };
  let dismissed = false;
  try { dismissed = win.sessionStorage.getItem(DISMISSED_KEY) === "1"; } catch { /* private mode */ }
  const manualOfferSeen = mobile && !requiresPrompt && hasLocal(MANUAL_OFFER_SEEN_KEY);
  let deferred: InstallEvent | null = null;
  let confirmedThisPage = standalone();
  let installed = confirmedThisPage || (eligible && hasLocal(INSTALLED_KEY));
  if (eligible && confirmedThisPage) saveLocal(INSTALLED_KEY, true);
  let checkingInstalled = eligible && !confirmedThisPage && typeof relatedApps === "function";
  let busy = false;
  let manualFallback = false;
  let installNotice = false;
  let noticeIssued = false;
  const listeners = new Set<() => void>();
  const read = () => ({
    eligible, mobile, installed, dismissed, busy, checkingInstalled, installNotice, available: Boolean(deferred), manualHelp,
    offerVisible: eligible && mobile && !installed && !dismissed && !checkingInstalled &&
      (Boolean(deferred) || busy || manualFallback || (!requiresPrompt && !manualOfferSeen)),
  });
  let snapshot = read();
  const publish = () => {
    snapshot = read();
    listeners.forEach(listener => listener());
  };
  const markInstalled = (notify = false) => {
    confirmedThisPage = true;
    installed = true;
    deferred = null;
    manualFallback = false;
    saveLocal(INSTALLED_KEY, true);
    if (notify && !noticeIssued) {
      installNotice = true;
      noticeIssued = true;
    }
    publish();
  };
  const dismissInstallNotice = () => { installNotice = false; publish(); };
  const dismiss = () => {
    dismissed = true;
    try { win.sessionStorage.setItem(DISMISSED_KEY, "1"); } catch { /* memory fallback */ }
    if (mobile && !requiresPrompt) saveLocal(MANUAL_OFFER_SEEN_KEY, true);
    publish();
  };
  const noteOfferShown = () => {
    // Safari and other manual-only browsers cannot inspect home-screen apps.
    // Offer once per browser profile; keep the explicit installation buttons.
    if (snapshot.offerVisible && !requiresPrompt && !deferred) saveLocal(MANUAL_OFFER_SEEN_KEY, true);
  };
  if (eligible) {
    win.addEventListener("beforeinstallprompt", event => {
      if (confirmedThisPage || standalone() || busy) return;
      const prompt = event as InstallEvent;
      if (typeof prompt.prompt !== "function") return;
      event.preventDefault();
      // A fresh genuine prompt means the browser considers this PWA
      // installable again (for example after uninstalling it).
      installed = false;
      manualFallback = false;
      saveLocal(INSTALLED_KEY, false);
      deferred = prompt;
      publish();
    });
    win.addEventListener("appinstalled", () => markInstalled(true));
    media?.addEventListener?.("change", () => {
      if (standalone()) markInstalled();
    });
    win.addEventListener("storage", event => {
      if (event.key !== INSTALLED_KEY) return;
      if (event.newValue === "1") {
        installed = true;
        deferred = null;
      } else if (!confirmedThisPage && !standalone()) {
        installed = false;
      }
      publish();
    });
    if (checkingInstalled && relatedApps) {
      // Bound the initial check; a slow API must not block explicit install.
      // A positive late result still suppresses the offer.
      const finishCheck = () => { checkingInstalled = false; publish(); };
      const timer = setTimeout(finishCheck, 2000);
      void Promise.resolve().then(() => relatedApps.call(nav)).then(apps => {
        // The manifest lists only Lektrus itself as a related webapp.
        if (apps.some(app => app.platform === "webapp")) markInstalled();
      }).catch(() => { /* unsupported manifest or browser */ }).finally(() => {
        clearTimeout(timer);
        finishCheck();
      });
    }
  }
  const requestInstall = async (): Promise<InstallResult> => {
    if (!eligible || installed || busy) return "unavailable";
    if (!deferred) {
      if (mobile && !requiresPrompt) saveLocal(MANUAL_OFFER_SEEN_KEY, true);
      return "manual";
    }
    const prompt = deferred;
    deferred = null;
    busy = true;
    publish();
    try {
      // Called directly from the user's click, retaining browser activation.
      await prompt.prompt();
      const {outcome} = await prompt.userChoice;
      if (outcome === "accepted") markInstalled(true);
      else dismiss();
      return outcome;
    } catch {
      if (!installed) manualFallback = true;
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
    noteOfferShown,
    dismissInstallNotice,
  };
}
