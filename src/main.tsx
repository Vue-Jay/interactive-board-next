import { Component, type ErrorInfo, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { Capacitor } from "@capacitor/core";
import "./index.css";
import "./nextTheme.css";
import App from "./App";
import "./interactiveCursor.css";
import "./settingsCursorFix.css";
import "./lectrisLayout.css";
import "./lectrisWorkspace.css";
import "./lectrisBoard.css";
import "./lectrisEditor.css";
import "./lectrisHub.css";
import "./lectrisDock.css";
import "./lectrisCustomize.css";
import "./lectrisPanelSettings.css";
import "./lectrisRedesign.css";
import "./lectrisV3.css";
import "./lektrusRefresh.css";
import "./lektrusResponsive.css";
import "./lektrusColors.css";
import "./lektrusBoardInteraction.css";
import "./lektrusThemes.css";
import "./lektrusContrast.css";
import "./lektrusPolish.css";
import "./lektrusCanvasChrome.css";
import "./lektrusToolLayout.css";
import "./lektrusToolRefinements.css";
import "./lektrusBoardBackground.css";
import "./lektrusSubjectPicker.css";
import "./lektrusSubjectTools.css";
import "./lektrusPlatform.css";
import { initLectrisPalette } from "./lectrisPalette";
import { initProfileAppearance } from "./profileStore";

type ErrorBoundaryState = { error: Error | null };

class ErrorBoundary extends Component<{ children: ReactNode }, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };
  static getDerivedStateFromError(error: Error): ErrorBoundaryState { return { error }; }
  componentDidCatch(error: Error, info: ErrorInfo) { console.error("InteractiveBoard render error", error, info); }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 32, fontFamily: "system-ui, sans-serif", color: "#202331" }}>
          <h1 style={{ marginTop: 0 }}>Не удалось запустить интерфейс</h1>
          <p>Приложение поймало ошибку вместо пустого белого экрана.</p>
          <pre style={{ whiteSpace: "pre-wrap", padding: 16, borderRadius: 12, background: "#f3f4f8" }}>
            {this.state.error.message || String(this.state.error)}
          </pre>
          <button type="button" onClick={() => window.location.reload()} style={{ padding: "10px 14px", cursor: "pointer" }}>
            Перезагрузить страницу
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

initLectrisPalette();
initProfileAppearance();

const root = document.getElementById("root");
if (!root) {
  document.body.innerHTML = '<div style="padding:32px;font-family:system-ui">Ошибка: в index.html не найден элемент #root.</div>';
  throw new Error("Не найден корневой элемент #root");
}

const isConfirmationPage = window.location.pathname === "/auth/confirmed" || new URLSearchParams(window.location.search).get("email_confirmation") === "1";
const confirmParams = new URLSearchParams(window.location.search);
const confirmHash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
const confirmationError = confirmParams.get("error_description") || confirmHash.get("error_description");
createRoot(root).render(
  isConfirmationPage
    ? <main style={{minHeight:"100dvh",display:"grid",placeItems:"center",background:"#f5f7fc",fontFamily:"system-ui,sans-serif",padding:24}}>
        <section style={{maxWidth:460,padding:36,borderRadius:20,background:"white",boxShadow:"0 8px 40px #14234d18",textAlign:"center"}}>
          <h1>{confirmationError ? "Не удалось подтвердить почту" : "Почта подтверждена"}</h1>
          <p>{confirmationError || "Адрес электронной почты подтверждён. Теперь можно закрыть эту вкладку и войти в Lektrus."}</p>
        </section>
      </main>
    : <ErrorBoundary><App /></ErrorBoundary>
);

// Register only in production so dev/HMR never reuses a cached app shell.
if (import.meta.env.PROD && !Capacitor.isNativePlatform() && "serviceWorker" in navigator) {
  let reloadAfterConfirmedUpdate = false;
  window.addEventListener("lektrus:apply-update", () => { reloadAfterConfirmedUpdate = true; });
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    // Never reload an active lesson merely because a new version was downloaded.
    if (reloadAfterConfirmedUpdate) window.location.reload();
  });
  window.addEventListener("load", () => {
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
  }, { once: true });
}
