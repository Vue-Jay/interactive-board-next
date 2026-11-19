import {Capacitor} from "@capacitor/core";
// Register only in production so dev/HMR never reuses a cached app shell.
export function registerLektrusServiceWorker(){
  if(!import.meta.env.PROD||Capacitor.isNativePlatform()||!("serviceWorker" in navigator))return;
  let reloadAfterConfirmedUpdate = false;
  window.addEventListener("lektrus:apply-update", () => { reloadAfterConfirmedUpdate = true; });
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    // Never reload an active lesson merely because a new version was downloaded.
    if (reloadAfterConfirmedUpdate) window.location.reload();
  });
  const registerServiceWorker = () => {
    if (!window.isSecureContext) return; // Production PWA requires HTTPS.
    void navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" })
      .then(registration => {
        const notify = () => {
          if (registration.waiting && navigator.serviceWorker.controller) {
            window.dispatchEvent(new CustomEvent("or-sw-update", { detail: { registration } }));
          }
        };
        if (registration.waiting) notify();
        registration.addEventListener("updatefound", () => {
          const installing = registration.installing;
          if (!installing) return;
          installing.addEventListener("statechange", () => {
            if (installing.state === "installed") notify();
          });
        });
        const refresh = () => { if (document.visibilityState === "visible") void registration.update().catch(() => {}); };
        window.addEventListener("focus", refresh);
        document.addEventListener("visibilitychange", refresh);
      })
      .catch(error => console.warn("Lektrus PWA registration failed", error));
  };
  if (document.readyState === "complete") registerServiceWorker();
  else window.addEventListener("load", registerServiceWorker, { once: true });
}
