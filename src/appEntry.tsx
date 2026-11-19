import "./cryptoUuidCompatibility";
import { Component, useState, type FormEvent, type ErrorInfo, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { Capacitor } from "@capacitor/core";
import "./index.css";
import "./nextTheme.css";
import App from "./App";
import {BrowserBoardFrameEntry,isBrowserBoardFrame} from "./BrowserBoardLandscape";
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
import "./lektrusPublicSite.css";
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
import "./lektrusMobileSafeControls.css";
import "./lektrusMobileDialogs.css";
import "./lektrusPortraitPages.css";
import "./lektrusCompactMobilePages.css";
import "./lektrusMobileUnifiedLayouts.css";
import "./lektrusAdaptiveSidebarAndToday.css";
import "./lektrusMoreTab.css";
import "./lektrusScienceEditor.css";
import "./lektrusCircuitEditor.css";
import "./lektrusScienceDiagramRefinement.css";
import "./lektrusEditorCursor.css";
import "./lektrusFormulaWindow.css";
import "./lektrusPeriodicTable.css";
import "./lektrusChemistryNext.css";
import "./lektrusScienceInteractionNext.css";
import "./lektrusSubjectPolish2026.css";
import "./lektrusInterfaceLayout.css";
import "./lektrusReactionVisuals.css";
import "./lektrusSchoolDiagrams.css";
import "./lektrusObjectChrome2026.css";
import "./lektrusAtlas.css";
import "./lektrusAtlasEditor.css";
import "./lektrusMathTouchPolish.css";
import "./lektrusPhysicsGraphEditor.css";
import "./lektrusCircuitButtons2026.css";
import "./lektrusOpticsEditor.css";
import "./lektrusMechanicsEditor.css";
import "./lektrusPhysicsPointers.css";
import "./lektrusBoardToolIcons.css";
import "./lektrusOrganicWorkspace.css";
import "./lektrusChemicalEquationWorkspace.css";
import "./lektrusEquationReview.css";
import "./lektrusChemicalBoardSurface.css";
import "./lektrusSubjectBoard.css";
import "./lektrusSubjectEditorThemes.css";
import "./lektrusReactionLabNext.css";
import "./lektrusChemistryBench.css";
import "./lektrusLabSceneLayout.css";
import "./lektrusProductScreens.css";
import "./lektrusBoardLoading.css";
// Import last so selection cursors win over legacy object/handle rules.
import "./lektrusSelectionCursor.css";
// Auth renders before lazy BoardApp, so its layout cannot depend on App.css.
import "./lektrusAuthLayout.css";
import "./lektrusMobileWorkspacePolish.css";
import "./lektrusLearningPages.css";
import {installInterfaceLayout} from "./lektrusInterfaceLayout";
import { isRemoteBackendEnabled, saveNativeBackendConnection } from "./backend";
import { isSelfhostBackendEnabled } from "./selfhostApi";
import { LEKTRUS_LOCAL_TEST_MODE } from "./lektrusLocalTestMode";
import { initLectrisPalette } from "./lectrisPalette";
import { initProfileAppearance } from "./profileStore";
import { recoverOutdatedChunk } from "./chunkRecovery";
import {AndroidUpdateGate} from "./AndroidUpdateGate";
import {ServiceUnavailableScreen} from "./ServiceUnavailableScreen";
import {registerLektrusServiceWorker} from "./registerServiceWorker";

installInterfaceLayout();

function NativeConnectionSetup() {
  const [endpoint, setEndpoint] = useState("");
  const [publishableKey, setPublishableKey] = useState("");
  const [error, setError] = useState("");
  const connect = (event: FormEvent) => {
    event.preventDefault();
    try {
      saveNativeBackendConnection(endpoint, publishableKey);
      window.location.reload();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Не удалось сохранить настройки.");
    }
  };
  return (
    <main style={{minHeight:"100dvh",padding:"max(24px, env(safe-area-inset-top, 0px)) 20px max(24px, env(safe-area-inset-bottom, 0px))",display:"grid",placeItems:"center",background:"#eef3fd",fontFamily:"system-ui,sans-serif",color:"#1d304b"}}>
      <form onSubmit={connect} style={{width:"min(100%,440px)",display:"grid",gap:14,background:"#fff",padding:24,borderRadius:20,boxShadow:"0 12px 42px #1b376521"}}>
        <img src="/lektrus-icon-192.png" width={68} height={68} alt="Lektrus" style={{margin:"auto"}} />
        <h1 style={{fontSize:24,textAlign:"center",margin:0}}>Подключить Lektrus</h1>
        <p style={{fontSize:14,lineHeight:1.55,margin:0}}>Для входа и совместных досок укажите публичные параметры вашего Supabase. Сделать это нужно один раз после установки приложения.</p>
        <label style={{display:"grid",gap:6,fontSize:13,fontWeight:700}}>Адрес Supabase
          <input required autoCapitalize="off" autoComplete="url" inputMode="url" placeholder="https://xxxxx.supabase.co" value={endpoint} onChange={e=>setEndpoint(e.target.value)} style={{width:"100%",fontSize:15,padding:"12px",border:"1px solid #bfcee6",borderRadius:10}}/>
        </label>
        <label style={{display:"grid",gap:6,fontSize:13,fontWeight:700}}>Публичный ключ anon / publishable
          <textarea required autoCapitalize="off" autoComplete="off" spellCheck={false} placeholder="sb_publishable_… или JWT anon" value={publishableKey} onChange={e=>setPublishableKey(e.target.value)} rows={3} style={{width:"100%",fontSize:13,padding:12,border:"1px solid #bfcee6",borderRadius:10,resize:"vertical"}}/>
        </label>
        {error&&<p role="alert" style={{color:"#b42318",fontSize:13,margin:0}}>{error}</p>}
        <button type="submit" style={{minHeight:45,background:"#365fd0",color:"#fff",fontSize:15,fontWeight:700,border:0,borderRadius:11}}>Подключиться</button>
        <p style={{fontSize:12,lineHeight:1.5,color:"#667994",margin:0}}>Параметры можно взять из файла .env.local проекта. Никогда не вводите service_role или секретный ключ. После подключения потребуется интернет.</p>
      </form>
    </main>
  );
}

type ErrorBoundaryState = { error: Error | null };

class ErrorBoundary extends Component<{ children: ReactNode }, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };
  static getDerivedStateFromError(error: Error): ErrorBoundaryState { return { error }; }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("InteractiveBoard render error", error, info);
    // Never refresh an active lesson automatically. Workspace navigation is
    // safe to restore at the exact same URL after a confirmed deployment.
    const path=window.location.pathname;
    void recoverOutdatedChunk(error, !Capacitor.isNativePlatform() && (path==="/app"||path==="/app/"||path==="/"));
  }
  render() {
    if (this.state.error) {
      return <ServiceUnavailableScreen reason={navigator.onLine===false?"offline":"startup"} onRetry={()=>window.location.reload()}/>;
    }
    return this.props.children;
  }
}

if (Capacitor.isNativePlatform()) {
  document.documentElement.classList.add("lektrus-native-app", "lektrus-" + Capacitor.getPlatform() + "-app");
}

initLectrisPalette();
initProfileAppearance();

const root = document.getElementById("root");
if (!root) {
  document.body.innerHTML = '<div style="padding:32px;font-family:system-ui">Ошибка: в index.html не найден элемент #root.</div>';
  throw new Error("Не найден корневой элемент #root");
}

createRoot(root).render(
  isBrowserBoardFrame()?<ErrorBoundary><BrowserBoardFrameEntry/></ErrorBoundary>:
  Capacitor.isNativePlatform() && !LEKTRUS_LOCAL_TEST_MODE && !isSelfhostBackendEnabled() && !isRemoteBackendEnabled()
    ? <NativeConnectionSetup />
    : <ErrorBoundary><AndroidUpdateGate><App /></AndroidUpdateGate></ErrorBoundary>
);

if(!isBrowserBoardFrame())registerLektrusServiceWorker();
