import { useEffect, useState } from "react";
import { pwaInstall, usePwaInstall } from "./pwaInstall";
import "./pwaInstallOffer.css";

export function PwaInstallButton({className = "", label = "Установить приложение"}: {className?: string; label?: string}) {
  const state = usePwaInstall();
  const [manual, setManual] = useState(false);
  if (!state.eligible || state.installed || state.checkingInstalled) return null;
  const install = async () => {
    setManual(false);
    if (await pwaInstall.requestInstall() === "manual") setManual(true);
  };
  return <div className="lektrus-pwa-button-wrap">
    <button type="button" className={className} disabled={state.busy} onClick={() => void install()}>{state.busy ? "Установка…" : label}</button>
    {manual && !state.available && <p className="lektrus-pwa-manual" role="status">{state.manualHelp}</p>}
  </div>;
}

export function PwaInstallOffer() {
  const state = usePwaInstall();
  useEffect(() => { if (state.offerVisible) pwaInstall.noteOfferShown(); }, [state.offerVisible]);
  if (!state.offerVisible) return null;
  return <aside className="lektrus-pwa-offer" aria-label="Установка Lektrus">
    <img src="/lektrus-pwa-icon-192.png" alt="" width={46} height={46}/>
    <div className="lektrus-pwa-offer-copy">
      <strong>Установите Lektrus</strong>
      <p>Добавьте приложение на главный экран — открывайте без вкладки браузера.</p>
      <PwaInstallButton className="lektrus-pwa-install-action" label="Установить"/>
    </div>
    <button type="button" className="lektrus-pwa-offer-close" aria-label="Закрыть предложение установки" onClick={pwaInstall.dismiss}>×</button>
  </aside>;
}

// Kept at the root, outside buttons/offers that disappear after installation.
export function PwaInstallFeedback() {
  const {eligible, installNotice} = usePwaInstall();
  useEffect(() => {
    if (!installNotice) return;
    const timer = window.setTimeout(pwaInstall.dismissInstallNotice, 3000);
    return () => window.clearTimeout(timer);
  }, [installNotice]);
  if (!eligible || !installNotice) return null;
  return <aside className="lektrus-pwa-feedback" role="status" aria-live="polite">
    <span className="lektrus-pwa-feedback-check" aria-hidden="true">✓</span>
    <div><strong>Приложение установлено</strong><small>Lektrus доступен на главном экране или рабочем столе.</small></div>
  </aside>;
}
