import { lazy, Suspense, useCallback, useEffect, useState } from "react";
import { LEKTRUS_LOCAL_TEST_MODE } from "./lektrusLocalTestMode";
import AuthScreen from "./AuthScreen";
import { loadGlobalInterfaceLayout, saveInterfaceLayout } from "./lektrusInterfaceLayout";
import BoardsScreen from "./BoardsScreen";
import LectrisWorkspaceShell from "./LectrisWorkspaceShell";
import { clearNotificationCache } from "./notificationsStore";
import { clearAiBoardTransfer } from "./aiLocalStore";
import { clearAccountAccessCache, getAccountAccess, getCachedAccountAccess, type AccountRole } from "./accountRoleStore";
import { clearPendingShare, initialRoute, parseRoute, pendingSharePath, rememberShareToken, type AppRoute } from "./routes";
import { redeemShareLink } from "./shareLinks";
import { Capacitor, registerPlugin } from "@capacitor/core";
import { App as CapacitorApp } from "@capacitor/app";
import { ScreenOrientation } from "@capacitor/screen-orientation";
import { completeEmailConfirmation, getCachedCurrentUser, getCurrentUser, logoutUser, type AuthUser } from "./authStore";
import { boardStorageKey, getBoardForUser, type BoardSummary } from "./boardStore";
import { getRemoteBoardDocument, isRemoteBackendEnabled, saveRemoteBoardDocument } from "./backend";
import { documentFingerprint } from "./boardSync";
import { parseDocument, type DocumentData } from "./boardModel";
import { ensureBoardAssets } from "./assetStore";
import { cacheBoardPreview, cachedBoardPreview, previewFromRemoteDocument, scheduleBackgroundBoardPreview } from "./boardPreview";

const INTERFACE_STUDIO_BOARD_ID="00000000-0000-4000-8000-00000000a11a";

const StudentsScreen = lazy(() => import("./StudentsScreen"));

const AssignmentsScreen = lazy(() => import("./AssignmentsScreen"));

const ProgressScreen = lazy(() => import("./ProgressScreen"));

const ScheduleScreen = lazy(() => import("./ScheduleScreen"));

const MaterialsScreen = lazy(() => import("./MaterialsScreen"));

const NotificationsScreen = lazy(() => import("./NotificationsScreen"));

const ProfileScreen = lazy(() => import("./ProfileScreen"));

const SettingsScreen = lazy(() => import("./SettingsScreen"));

const BillingScreen = lazy(() => import("./BillingScreen"));

const AiStudioScreen = lazy(() => import("./AiStudioScreen"));

const AdminScreen = lazy(() => import("./AdminScreen"));

const TemplatesScreen = lazy(() => import("./TemplatesScreen"));

const LektrusPublicSite = lazy(() => import("./LektrusPublicSite"));

const PublicToolScreen = lazy(() => import("./PublicToolScreen"));

const PublicDemoBoard = lazy(() => import("./PublicDemoBoard"));

const FeedbackScreen = lazy(() => import("./FeedbackScreen"));

const BoardApp = lazy(() => import("./BoardApp"));

function BoardLoadingScreen(){
  return <main className="lektrus-board-loading" role="status" aria-live="polite"><section className="lektrus-board-loading-card"><div className="lektrus-board-loading-mark"><img src="/lektrus-icon-192.png" alt=""/><i/></div><span className="lektrus-board-loading-kicker">LEKTRUS · РАБОЧЕЕ ПРОСТРАНСТВО</span><h1>Готовим доску</h1><p>Подключаем материалы и инструменты для занятия.</p><div className="lektrus-board-loading-progress" aria-hidden="true"><i/><i/><i/><i/><i/><i/><i/><i/><i/><i/><i/><i/></div></section></main>;
}

export default function App() {
  const [route, setRoute] = useState<AppRoute>(() => {
    const initial=initialRoute();
    return Capacitor.isNativePlatform()&&initial.kind==="site"?{kind:"home"}:initial;
  });
  useEffect(() => {
    if (Capacitor.getPlatform() !== "android") return;
    void registerPlugin<{setBoardMode(options:{enabled:boolean}):Promise<void>}>("LektrusSystemUi")
      .setBoardMode({ enabled: route.kind === "board" })
      .catch(error => console.warn("Lektrus Android status bar update failed", error));
  }, [route.kind]);

  // Android system back should behave like Lektrus navigation, not dismiss the app.
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    const goBackInsideLektrus = () => {
      const current = new URL(window.location.href);
      if (current.pathname !== "/" && current.pathname !== "/app") {
        window.history.pushState({}, "", "/app");
        window.dispatchEvent(new PopStateEvent("popstate"));
      } else if (current.searchParams.has("section")) {
        window.history.pushState({}, "", "/app");
        window.dispatchEvent(new PopStateEvent("popstate"));
      } else {
        // Root stays in Lektrus. Android's home gesture can minimize normally.
        window.dispatchEvent(new CustomEvent("lektrus:root-back"));
      }
    };
    window.addEventListener("lektrus:native-back", goBackInsideLektrus);
    return () => window.removeEventListener("lektrus:native-back", goBackInsideLektrus);
  }, []);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    const apply = async () => {
      try {
        if (route.kind === "board") {
          await ScreenOrientation.lock({ orientation: "landscape-primary" });
        } else {
          await ScreenOrientation.unlock();
        }
      } catch (error) {
        console.warn("Unable to change Lektrus orientation", error);
      }
    };
    void apply();
  }, [route.kind]);

  const navigate = useCallback((path: string, replace = false) => {
    const appPath=path==="/"?"/app":path.startsWith("/?")?`/app${path.slice(1)}`:path;
    window.history[replace ? "replaceState" : "pushState"](null, "", appPath);
    const url = new URL(appPath, window.location.href);
    const next=parseRoute(url.pathname);
    setRoute(Capacitor.isNativePlatform()&&next.kind==="site"?{kind:"home"}:next);
  }, []);
  useEffect(() => {
    const changed = () => {
      const parsed = parseRoute(window.location.pathname);
      const next=Capacitor.isNativePlatform()&&parsed.kind==="site"?{kind:"home" as const}:parsed;
      if (next.kind === "join") rememberShareToken(next.token);
      setRoute(next);
    };
    window.addEventListener("popstate", changed);
    return () => window.removeEventListener("popstate", changed);
  }, []);
  const [authUser, setAuthUser] = useState<AuthUser | null>(() => getCachedCurrentUser());
  const [authCallbackError,setAuthCallbackError]=useState("");
  const [accountRole,setAccountRoleState]=useState<AccountRole>(()=>getCachedAccountAccess()?.role??"student");
  const [isAppAdmin,setIsAppAdmin]=useState(()=>getCachedAccountAccess()?.isAdmin??false);
  const [appRolePreview,setAppRolePreview]=useState<"actual"|AccountRole>("actual");
  const effectiveAccountRole=appRolePreview==="actual"?accountRole:appRolePreview;
  const [adminInspecting,setAdminInspecting]=useState(false);
  const [adminEdit,setAdminEdit]=useState(()=>{try{return localStorage.getItem("onlinerepetitor.adminEdit")==="1"}catch{return false}});
  const changeAdminEdit=useCallback((value:boolean)=>{setAdminEdit(value);try{localStorage.setItem("onlinerepetitor.adminEdit",value?"1":"0")}catch{}},[]);
  const [adminInvisible,setAdminInvisible]=useState(()=>{try{return localStorage.getItem("onlinerepetitor.adminInvisible")==="1"}catch{return false}});
  const changeAdminInvisible=useCallback((value:boolean)=>{setAdminInvisible(value);try{localStorage.setItem("onlinerepetitor.adminInvisible",value?"1":"0")}catch{}},[]);
  const [authReady, setAuthReady] = useState(() => Boolean(getCachedCurrentUser()));
  const [activeBoard, setActiveBoard] = useState<BoardSummary | null>(null);
  const boardChanged = useCallback((updated: BoardSummary) => {
    setActiveBoard(current => current?.id === updated.id ? updated : current);
  }, []);
  const [boardLoading, setBoardLoading] = useState(false);
  const [boardLoadError, setBoardLoadError] = useState("");
  const [sharePassword, setSharePassword] = useState("");
  const [submittedSharePassword, setSubmittedSharePassword] = useState<{token:string;value:string}|null>(null);
  const [sharePasswordRequired, setSharePasswordRequired] = useState(false);
  const [remoteVersion, setRemoteVersion] = useState<number | null>(null);
  const [boardMountKey, setBoardMountKey] = useState(0);
  const changeAppRolePreview=useCallback((role:"actual"|AccountRole)=>{
    if(!isAppAdmin)return;
    setAppRolePreview(role);
    if(role!=="actual"&&!activeBoard)navigate("/?section=boards");
  },[isAppAdmin,activeBoard,navigate]);
  const [globalInstallPrompt,setGlobalInstallPrompt]=useState<Event|null>(null);
  const [globalStandalone,setGlobalStandalone]=useState(()=>(window.matchMedia?.("(display-mode: standalone)").matches===true || (navigator as Navigator & {standalone?:boolean}).standalone===true));
  useEffect(()=>{
    const ready=(e:Event)=>{e.preventDefault();setGlobalInstallPrompt(e)};
    const installed=()=>{setGlobalInstallPrompt(null);setGlobalStandalone(true)};
    window.addEventListener("beforeinstallprompt",ready);
    window.addEventListener("appinstalled",installed);
    return()=>{window.removeEventListener("beforeinstallprompt",ready);window.removeEventListener("appinstalled",installed)};
  },[]);
  const installGlobalApp=async()=>{
    const prompt=globalInstallPrompt as (Event&{prompt:()=>Promise<void>;userChoice:Promise<{outcome:string}>})|null;
    if(!prompt)return;
    await prompt.prompt();
    await prompt.userChoice;
    setGlobalInstallPrompt(null);
  };

  useEffect(() => {
    let alive = true;
    let confirmationListener:{remove:()=>Promise<void>}|null=null;
    const processConfirmation=async(callbackUrl:string)=>{
      try{
        const confirmedUser=await completeEmailConfirmation(callbackUrl);
        if(!alive||!confirmedUser)return false;
        setAuthUser(confirmedUser);
        setActiveBoard(null);
        // The confirmation callback must not reset an invitation to /app.
        // Keep the pending /join/:token until redemption, then the token is
        // replaced with /board/:id. Never put auth fragments back in history.
        navigate(pendingSharePath()??"/",true);
        return true;
      }catch(error){const message=error instanceof Error?error.message:"Не удалось подтвердить email";console.warn("Lektrus email confirmation could not be completed",error);if(alive)setAuthCallbackError(message);return false}
    };
    const initialize=async()=>{
      if(route.kind==="site"||route.kind==="demo"){
        if(alive)setAuthReady(true);
        return;
      }
      if(Capacitor.isNativePlatform()){
        confirmationListener=await CapacitorApp.addListener("appUrlOpen",({url})=>{void processConfirmation(url).then(done=>{if(done&&alive)setAuthReady(true)})});
        const launch=await CapacitorApp.getLaunchUrl();
        if(launch?.url&&await processConfirmation(launch.url)){if(alive)setAuthReady(true);return}
      }
      await processConfirmation(window.location.href);
      const user=await getCurrentUser();
      if(alive)setAuthUser(user);
      if(alive)setAuthReady(true);
    };
    void initialize().catch(error=>{console.warn("Lektrus authentication initialization failed",error);if(alive){setAuthUser(null);setAuthReady(true)}});
    return () => {alive=false;void confirmationListener?.remove()};
  }, [navigate]);

  // Load the administrator-published interface design for every signed-in
  // account. Refresh on return to the app so other devices pick up updates.
  useEffect(()=>{
    if(!authReady||!authUser||!isRemoteBackendEnabled())return;
    if(new URLSearchParams(window.location.search).get("layout-editor")==="1")return;
    let alive=true;
    let pending=false;
    const refresh=async()=>{
      if(pending)return;
      pending=true;
      try{const layout=await loadGlobalInterfaceLayout();if(alive&&layout)saveInterfaceLayout(layout)}
      catch{/* Keep the last published design cached on this device. */}
      finally{pending=false}
    };
    void refresh();
    const interval=window.setInterval(()=>{if(document.visibilityState==="visible")void refresh()},60_000);
    window.addEventListener("focus",refresh);
    return()=>{alive=false;window.clearInterval(interval);window.removeEventListener("focus",refresh)};
  },[authReady,authUser?.id]);

  const logout = () => {
    // Local test APK is deliberately passwordless. "Exit" returns home
    // without deleting the isolated demo identity or asking for a server.
    if (LEKTRUS_LOCAL_TEST_MODE) {
      clearPendingShare();
      setActiveBoard(null);
      navigate("/", true);
      return;
    }
    clearPendingShare();
    clearAccountAccessCache();
    clearNotificationCache();
    clearAiBoardTransfer();
    navigate("/", true);
    setAuthUser(null);
    setActiveBoard(null);
    void logoutUser().finally(() => {
      clearAccountAccessCache();
      clearNotificationCache();
      setActiveBoard(null);
      setAuthUser(null);
    });
  };

  const openBoard = useCallback(async (board: BoardSummary, isCurrent: () => boolean) => {
    // Interface editing is a read-only view of the REAL board, not a new
    // board session: never initialize templates or upload unsaved snapshots.
    const editingLayout=new URLSearchParams(window.location.search).get("layout-editor")==="1";
    setBoardLoadError("");
    setBoardLoading(true);
    try {
      if (isRemoteBackendEnabled()) {
        const remote = await getRemoteBoardDocument(board.id);
        if (!isCurrent()) return;
        const key = boardStorageKey(board.id);
        // A newly created board can carry a template. Apply it BEFORE the normal
        // remote-cache branch, which would otherwise replace it with an empty doc.
        let appliedTemplate = false;
        try {
          const pendingRaw = sessionStorage.getItem("onlinerepetitor.template.apply");
          if (!editingLayout && pendingRaw && board.role === "owner") {
            const pending = JSON.parse(pendingRaw) as {boardId?:string;document?:DocumentData};
            if (pending.boardId === board.id && pending.document) {
              const document = parseDocument(JSON.stringify({...pending.document,title:board.title}));
              localStorage.setItem(key,JSON.stringify(document));
              const saved = await saveRemoteBoardDocument(board.id,document,remote?.version ?? 0);
              if (!isCurrent()) return;
              if (!saved.conflict) {
                setRemoteVersion(saved.version);
                sessionStorage.removeItem("onlinerepetitor.template.apply");
                appliedTemplate = true;
              }
            }
          }
        } catch (error) {
          // Do not silently discard the template; leave it pending for a retry.
          console.warn("Template initialization was not saved yet",error);
        }
        if (appliedTemplate) {
          // Already persisted as the board's initial document.
        } else if (remote?.document) {
          // Cache preview before parsing: strict document parsing strips UI metadata.
          const preview=previewFromRemoteDocument(remote.document);
          if(preview)cacheBoardPreview(board.id,preview);
          let parsed = parseDocument(JSON.stringify(remote.document));
          // If the board was closed before its last upload finished, the local
          // snapshot is newer than the server revision. Recover it instead of
          // overwriting newly created subject tools with stale remote objects.
          try{
            const pending=localStorage.getItem(key+".pending-sync")==="1";
            const savedRaw=pending?localStorage.getItem(key):null;
            if(savedRaw&&board.role!=="viewer"){
              const local=parseDocument(savedRaw);
              if(documentFingerprint(local)!==documentFingerprint(parsed)){
                parsed={...parsed,
                  subject:local.subject||parsed.subject,
                  items:[...local.items,...parsed.items.filter(item=>!local.items.some(own=>own.id===item.id))]};
                // Keep the pending flag. Board mount will retry the remote save
                // using the actual remote version and an unacknowledged fingerprint.
              }else{
                localStorage.removeItem(key+".pending-sync");
              }
            }
          }catch(error){
            console.warn("Unable to recover pending Lektrus board snapshot",error);
          }
          localStorage.setItem(key, JSON.stringify(parsed));
          // Backfill a preview of migrated boards on first open, without
          // creating a remote revision or a conflict with other participants.
          if(!editingLayout && !cachedBoardPreview(board.id)){
            // Old boards also get their first preview in browser idle time.
            // Do not block opening a board to paint a thumbnail.
            scheduleBackgroundBoardPreview(board.id,parsed,null);
          }
          setRemoteVersion(remote.version);
        } else {
          const raw = localStorage.getItem(key);
          if (!editingLayout && raw && board.role !== "viewer") {
            const localDocument = parseDocument(raw);
            try {
              await ensureBoardAssets(board.id, localDocument);
              const saved = await saveRemoteBoardDocument(board.id, localDocument, 0);
              if (!isCurrent()) return;
              // Keep local data; the mounted subscription will offer conflict resolution.
              setRemoteVersion(saved.conflict ? null : saved.version);
            } catch {
              // A missing v19 attachment or unavailable Storage must not prevent
              // opening the local document. Autosave will retry synchronization.
              if (isCurrent()) setRemoteVersion(null);
            }
          } else {
            setRemoteVersion(null);
          }
        }
      } else {
        setRemoteVersion(null);
      }
      if (!isCurrent()) return;
      setActiveBoard(board);
      setBoardMountKey((value) => value + 1);
    } catch (error) {
      if (isCurrent()) setBoardLoadError(error instanceof Error ? error.message : "Не удалось загрузить доску с сервера");
    } finally {
      if (isCurrent()) setBoardLoading(false);
    }
  }, [isAppAdmin]);

  useEffect(() => {
    if (!authReady || !authUser) return;
    let alive = true;
    setActiveBoard(null);
    setBoardLoadError("");
    setSharePasswordRequired(false);
    if (route.kind === "site") { setBoardLoading(false); return; }
    if (route.kind === "tool") { setBoardLoading(false); return; }
    if (route.kind === "demo") { setBoardLoading(false); return; }
    if (route.kind === "home") { setBoardLoading(false); return; }
    setBoardLoading(true);
    void (async () => {
      try {
        if (route.kind === "invalid") throw new Error("Ссылка недействительна");
        if (route.kind === "join") {
          rememberShareToken(route.token);
          const redeemed = await redeemShareLink(route.token, submittedSharePassword?.token===route.token?submittedSharePassword.value:undefined);
          if (!alive) return;
          clearPendingShare();
          navigate(`/board/${redeemed.board_id}`, true);
          return;
        }
        setAdminInspecting(false);
        if(route.boardId===INTERFACE_STUDIO_BOARD_ID){
          if(!isAppAdmin||new URLSearchParams(window.location.search).get("layout-editor")!=="1")
           throw new Error("Редактор интерфейса доступен только администратору.");
          const board:BoardSummary={id:INTERFACE_STUDIO_BOARD_ID,title:"Новая доска",
           ownerId:authUser.id,role:"owner",createdAt:new Date().toISOString(),
           updatedAt:new Date().toISOString()};
          setRemoteVersion(null);setActiveBoard(board);setBoardMountKey(key=>key+1);
          setBoardLoading(false);return;
        }
        const board = await getBoardForUser(authUser, route.boardId);
        if (!alive) return;
        if (!board) throw new Error("Доска недоступна. Попросите владельца прислать ссылку для доступа.");
        await openBoard(board, () => alive);
      } catch (error) {
        if (!alive) return;
        setBoardLoading(false);
        const message=error instanceof Error ? error.message : "Не удалось открыть доску";
        if(route.kind==="join" && /парол/i.test(message)){
          setSharePasswordRequired(true);
          setBoardLoadError("");
        }else{
          setSharePasswordRequired(false);
          setBoardLoadError(route.kind === "join"
            ? message || "Не удалось принять ссылку. Возможно, она отозвана, истекла или сервер недоступен."
            : message);
        }
      }
    })();
    return () => { alive = false; };
  }, [route, authReady, authUser, navigate, openBoard, submittedSharePassword]);

  useEffect(()=>{
    if(!authUser)return;
    let alive=true,lastRefresh=0,inFlight=false;
    const apply=(x:Awaited<ReturnType<typeof getAccountAccess>>)=>{if(alive){setAccountRoleState(x.role);setIsAppAdmin(x.isAdmin)}};
    const cached=getCachedAccountAccess();if(cached)apply(cached);
    const refresh=()=>{
      if(!alive||inFlight||document.visibilityState==="hidden"||Date.now()-lastRefresh<5000)return;
      lastRefresh=Date.now();inFlight=true;
      void getAccountAccess().then(apply).catch(()=>{}).finally(()=>{inFlight=false});
    };
    refresh();
    const listener=()=>refresh();
    const onVisibility=()=>{if(document.visibilityState==="visible")refresh()};
    window.addEventListener("onlinerepetitor:account-access",listener);
    window.addEventListener("focus",refresh);
    window.addEventListener("online",refresh);
    document.addEventListener("visibilitychange",onVisibility);
    return()=>{alive=false;window.removeEventListener("onlinerepetitor:account-access",listener);window.removeEventListener("focus",refresh);window.removeEventListener("online",refresh);document.removeEventListener("visibilitychange",onVisibility)}
  },[authUser?.id]);

  useEffect(()=>{if(!isAppAdmin)setAppRolePreview("actual")},[isAppAdmin]);

  // Navigation is owned by LectrisWorkspaceShell (explicit section IDs).
  // Do not intercept page clicks by their Russian button labels: "Настройки"
  // also occurs inside atlas, notifications and local tool dialogs.

  if(route.kind==="site")return <Suspense fallback={<div className="lektrus-site-loading"/>}><LektrusPublicSite/></Suspense>;

  if(route.kind==="tool")return <Suspense fallback={<BoardLoadingScreen/>}><PublicToolScreen tool={route.tool} onBack={()=>navigate("/")}/></Suspense>;

  if(route.kind==="demo"){
    return <Suspense fallback={<BoardLoadingScreen/>}><PublicDemoBoard/></Suspense>;
  }

  if (!authReady) {
    return <main className="auth-shell"><section className="auth-card"><div className="auth-brand-row"><div className="auth-logo">B</div><div><div className="auth-brand">Учебная доска</div><div className="auth-subtitle">Проверяем сессию…</div></div></div></section></main>;
  }



  if (!authUser) {
    return <AuthScreen initialError={authCallbackError} onAuthenticated={(user) => { clearAccountAccessCache(); clearNotificationCache(); setAuthUser(user); setActiveBoard(null); }} />;
  }

  if (!activeBoard) {
    return (
      <>
        <Suspense fallback={<div className="board-server-overlay"><div className="board-server-card"><strong>Открываем раздел…</strong><span>Загружаем только нужный модуль.</span></div></div>}>
        {route.kind === "home" && <LectrisWorkspaceShell section={new URLSearchParams(window.location.search).get("section")||""} role={effectiveAccountRole} isAdmin={isAppAdmin} name={authUser.name} rolePreview={appRolePreview}>{(()=>{const section=new URLSearchParams(window.location.search).get("section");return section==="registration-preview"&&isAppAdmin&&appRolePreview==="actual"
          ? <AuthScreen onAuthenticated={()=>{}} previewMode onPreviewClose={()=>{window.history.pushState({}, "", "/app?section=boards");window.dispatchEvent(new PopStateEvent("popstate"))}} />
          : section==="admin" && isAppAdmin && appRolePreview==="actual"
          ? <AdminScreen user={authUser} invisible={adminInvisible} onInvisibleChange={changeAdminInvisible} adminEdit={adminEdit} onAdminEditChange={changeAdminEdit} rolePreview={appRolePreview} onRolePreviewChange={changeAppRolePreview} onCheckRegistration={()=>navigate("/?section=registration-preview")} onOpenBoard={(board)=>{setAdminInspecting(true);void openBoard(board,()=>true)}} onOpenLayout={async()=>{navigate(`/board/${INTERFACE_STUDIO_BOARD_ID}?layout-editor=1`)}} onBack={()=>{window.history.pushState({}, "", "/app");window.dispatchEvent(new PopStateEvent("popstate"))}} />
          : section==="students" && effectiveAccountRole==="teacher"
          ? <StudentsScreen user={authUser} onBack={()=>{window.history.pushState({}, "", "/app");window.dispatchEvent(new PopStateEvent("popstate"))}} onOpenBoard={(board)=>navigate(`/board/${board.id}`)} />
          : section==="assignments"
          ? <AssignmentsScreen user={authUser} accountRole={effectiveAccountRole} onBack={()=>{window.history.pushState({}, "", "/app");window.dispatchEvent(new PopStateEvent("popstate"))}} onOpenBoard={(board)=>navigate(`/board/${board.id}`)} />
          : section==="progress" && effectiveAccountRole==="teacher"
          ? <ProgressScreen user={authUser} onBack={()=>{window.history.pushState({}, "", "/app");window.dispatchEvent(new PopStateEvent("popstate"))}} />
          : section==="schedule"
          ? <ScheduleScreen user={authUser} accountRole={effectiveAccountRole} onBack={()=>{window.history.pushState({}, "", "/app");window.dispatchEvent(new PopStateEvent("popstate"))}} onOpenBoard={(board)=>navigate(`/board/${board.id}`)} />
          : section==="materials" && effectiveAccountRole==="teacher"
          ? <MaterialsScreen user={authUser} onBack={()=>{window.history.pushState({}, "", "/app");window.dispatchEvent(new PopStateEvent("popstate"))}} />
          : section==="notifications"
          ? <NotificationsScreen user={authUser} onBack={()=>{window.history.pushState({}, "", "/app");window.dispatchEvent(new PopStateEvent("popstate"))}} />
          : section==="feedback"
          ? <FeedbackScreen />
          : section==="profile"
          ? <ProfileScreen user={authUser} accountRole={effectiveAccountRole} isAppAdmin={isAppAdmin&&appRolePreview==="actual"} previewMode={appRolePreview!=="actual"} onLogout={()=>appRolePreview==="actual"?logout():changeAppRolePreview("actual")} onBack={()=>{window.history.pushState({}, "", "/app");window.dispatchEvent(new PopStateEvent("popstate"))}} />
          : section==="settings"
          ? <SettingsScreen user={authUser} previewRole={appRolePreview==="actual"?null:effectiveAccountRole} onPreviewRoleChange={changeAppRolePreview} onBack={()=>{window.history.pushState({}, "", "/app");window.dispatchEvent(new PopStateEvent("popstate"))}} onLogout={()=>appRolePreview==="actual"?logout():changeAppRolePreview("actual")} installAvailable={Boolean(globalInstallPrompt)} isInstalled={globalStandalone} onInstall={()=>void installGlobalApp()} onBilling={()=>{window.history.pushState({}, "", "/app?section=billing");window.dispatchEvent(new PopStateEvent("popstate"))}} />
          : section==="billing"
          ? <BillingScreen onBack={()=>{window.history.pushState({}, "", "/app?section=settings");window.dispatchEvent(new PopStateEvent("popstate"))}} />
          : section==="ai"
          ? <AiStudioScreen onBack={()=>{window.history.pushState({}, "", "/app?section=settings");window.dispatchEvent(new PopStateEvent("popstate"))}} />
          : section==="templates" && effectiveAccountRole==="teacher"
          ? <TemplatesScreen user={authUser} onBack={()=>{window.history.pushState({}, "", "/app");window.dispatchEvent(new PopStateEvent("popstate"))}} onOpenBoard={(board)=>navigate(`/board/${board.id}`)} />
          : <BoardsScreen user={authUser} accountRole={effectiveAccountRole} isAppAdmin={isAppAdmin&&appRolePreview==="actual"} onOpenBoard={(board) => navigate(`/board/${board.id}`)} onLogout={()=>appRolePreview==="actual"?logout():changeAppRolePreview("actual")} />})()}</LectrisWorkspaceShell>}
        </Suspense>
        {sharePasswordRequired && route.kind==="join" && <div className="board-server-overlay"><form className="board-server-card share-password-card" onSubmit={e=>{e.preventDefault();if(!sharePassword.trim())return;setSharePasswordRequired(false);setSubmittedSharePassword({token:route.token,value:sharePassword});}}><strong>Ссылка защищена паролем</strong><span>Введите пароль, который сообщил владелец доски.</span><input type="password" value={sharePassword} onChange={e=>setSharePassword(e.target.value)} placeholder="Пароль ссылки" autoComplete="off"/><div className="share-password-actions"><button className="primary" type="submit" disabled={!sharePassword.trim()}>Открыть доску</button><button type="button" onClick={()=>{setSharePassword("");clearPendingShare();navigate("/",true)}}>Отмена</button></div></form></div>}
        {boardLoading && <BoardLoadingScreen/>}
        {boardLoadError && <div className="board-server-overlay"><div className="board-server-card"><strong>Не удалось открыть доску</strong><span>{boardLoadError}</span><button className="primary" onClick={() => setRoute({ ...route })}>Повторить</button><button onClick={() => { clearPendingShare(); navigate("/", true); }}>К моим доскам</button></div></div>}
      </>
    );
  }

  return (
    <Suspense fallback={<BoardLoadingScreen/>}><BoardApp
      key={`${activeBoard.id}:${boardMountKey}`}
      authUser={authUser}
      boardSummary={activeBoard}
      accountRole={accountRole}
      isAppAdmin={isAppAdmin}
      globalRolePreview={appRolePreview}
      onGlobalRolePreviewChange={changeAppRolePreview}
      adminMaintenance={adminInspecting && isAppAdmin && adminEdit}
      adminInvisible={adminInvisible}
      initialRemoteVersion={remoteVersion}
      onBoardChanged={boardChanged}
      onBackToBoards={() => { setActiveBoard(null); if(adminInspecting||new URLSearchParams(window.location.search).get("layout-editor")==="1"){setAdminInspecting(false);navigate("/?section=admin");}else navigate("/"); }}
      onLogout={logout}
    /></Suspense>
  );
}
