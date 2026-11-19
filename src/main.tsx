// Keep the public-site styles in the initial HTML stylesheet bundle.
// TatNet serves the landing page through a lazy route; CSS must not depend on that route loading.
import "./nativeCompatibility";
import "./lektrusMarketing.css";
import "./lektrusMarketingTypography.css";
// Download is a hash route, so its styles must also be in the initial CSS.
import "./lektrusMarketingDownload.css";

import { Capacitor } from "@capacitor/core";
import { pendingSharePath } from "./routes";
import { isChunkLoadError, recoverOutdatedChunk } from "./chunkRecovery";
import {installInterfacePreviewEnvironment} from "./lektrusInterfacePreview";
import { installMobileKeyboardDismissal } from "./dismissMobileKeyboard";
installInterfacePreviewEnvironment();
installMobileKeyboardDismissal(Capacitor.isNativePlatform());

// A native iOS app must retain the device viewport when the keyboard focuses
// a compact input. Board pinch gestures use the board camera, independently
// of WebKit's page zoom. Keep browser/PWA accessibility settings unchanged.
if (Capacitor.getPlatform() === "ios") {
  document.querySelector('meta[name="viewport"]')?.setAttribute("content", "width=device-width, initial-scale=1.0, maximum-scale=1.0, viewport-fit=cover");
}

const query=new URLSearchParams(window.location.search);
const pendingInvite=Boolean(pendingSharePath());
const appRoute=query.has("section")||query.has("email_confirmation")||query.has("join")||pendingInvite||query.get("source")==="pwa";
const isPublicSite=window.location.pathname==="/"&&!appRoute&&!Capacitor.isNativePlatform();
// One application entry for every authenticated route, including email confirmation.
// The public site and site builder remain separate public-facing entry points only.
void (window.location.pathname==="/site-builder"&&!Capacitor.isNativePlatform()?import("./LektrusSiteBuilderEntry"):
  isPublicSite?import("./LektrusSiteEntry"):import("./appEntry")).catch(async error=>{
  if (await recoverOutdatedChunk(error, !Capacitor.isNativePlatform())) return;
  const root=document.getElementById("root");
  if (!root) return;
  const message=document.createElement("p");
  message.textContent=isChunkLoadError(error)?"Не удалось загрузить приложение. Проверьте подключение и обновите страницу.":"Не удалось запустить приложение.";
  const retry=document.createElement("button");
  retry.textContent="Обновить страницу";
  retry.onclick=()=>window.location.reload();
  root.replaceChildren(message,retry);
  console.error("Lektrus startup failed",error);
});
