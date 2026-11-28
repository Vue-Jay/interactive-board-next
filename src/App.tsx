import { lazy, Suspense, useCallback, useEffect, useLayoutEffect, useState } from "react";
import {PwaInstallOffer} from "./PwaInstallOffer";
import { LEKTRUS_LOCAL_TEST_MODE } from "./lektrusLocalTestMode";
import AuthScreen from "./AuthScreen";
import { loadGlobalInterfaceLayout, saveInterfaceLayout } from "./lektrusInterfaceLayout";
import BoardsScreen from "./BoardsScreen";
import LectrisWorkspaceShell from "./LectrisWorkspaceShell";
import { clearNotificationCache } from "./notificationsStore";
import { clearAiBoardTransfer } from "./aiLocalStore";
import { clearAccountAccessCache, enableTeacherRole, getAccountAccess, getCachedAccountAccess, type AccountRole } from "./accountRoleStore";
import { clearPendingBoardPath, clearPendingShare, initialRoute, nativeBoardPath, nativeBoardUrl, parseRoute, pendingBoardPath, pendingSharePath, rememberBoardPath, rememberShareToken, type AppRoute } from "./routes";
import { redeemShareLink } from "./shareLinks";
import { Capacitor, registerPlugin } from "@capacitor/core";
import { App as CapacitorApp } from "@capacitor/app";
import { ScreenOrientation } from "@capacitor/screen-orientation";
import { completeEmailConfirmation, getCachedCurrentUser, getCurrentUser, logoutUser, type AuthUser } from "./authStore";
import { boardStorageKey, getBoardForUser, type BoardSummary } from "./boardStore";
import { getRemoteBoardDocument, isRemoteBackendEnabled, saveRemoteBoardDocument } from "./backend";
import { isSelfhostBackendEnabled, selfhostReadDocument, selfhostSaveDocument, SelfhostHttpError } from "./selfhostApi";
import { documentFingerprint } from "./boardSync";
import { mergeBoardDocumentEdits } from "./lektrusBoardThreeWayMerge";
import { parseDocument, type DocumentData } from "./boardModel";
import {canEditBoardMetadata} from "./lektrusBoardRolePreview";
import { ensureBoardAssets } from "./assetStore";
import { cacheBoardPreview, cachedBoardPreview, previewFromRemoteDocument, scheduleBackgroundBoardPreview } from "./boardPreview";
import {ServiceUnavailableScreen} from "./ServiceUnavailableScreen";
import {useServiceAvailability} from "./useServiceAvailability";
import {BoardLoadingScreen,BrowserBoardLandscape,wantsBrowserBoardLandscape,requestBrowserBoardLandscape,releaseBrowserBoardLandscape} from "./BrowserBoardLandscape";

const INTERFACE_STUDIO_BOARD_ID="00000000-0000-4000-8000-00000000a11a";
const LektrusSystemUi = registerPlugin<{setBoardMode(options:{enabled:boolean}):Promise<void> }>("LektrusSystemUi");

const StudentsScreen = lazy(() => import("./StudentsScreen"));

const AssignmentsScreen = lazy(() => import("./AssignmentsScreen"));
const TeachersScreen = lazy(() => import("./TeachersScreen"));

const ProgressScreen = lazy(() => import("./ProgressScreen"));

const ScheduleScreen = lazy(() => import("./ScheduleScreen"));

const MaterialsScreen = lazy(() => import("./MaterialsScreen"));

const NotificationsScreen = lazy(() => import("./NotificationsScreen"));

const ProfileScreen = lazy(() => import("./ProfileScreen"));

const SettingsScreen = lazy(() => import("./SettingsScreen"));

const BillingScreen = lazy(() => import("./BillingScreen"));

const AdminScreen = lazy(() => import("./AdminScreen"));

const TemplatesScreen = lazy(() => import("./TemplatesScreen"));

const LektrusPublicSite = lazy(() => import("./LektrusPublicSite"));

const PublicToolScreen = lazy(() => import("./PublicToolScreen"));

const PublicDemoBoard = lazy(() => import("./PublicDemoBoard"));

const FeedbackScreen = lazy(() => import("./FeedbackScreen"));

const BoardApp = lazy(() => import("./BoardApp"));

type BoardLoadFailure = {message:string;reauth:boolean};
function isTransientBoardRead(error:unknown):boolean{
  if(error instanceof SelfhostHttpError)return [502,503,504].includes(error.status);
  return error instanceof Error && /failed to fetch|networkerror|network error|network request failed|load failed|timeout|timed out|время ожидания|не ответил на запрос|не удалось установить соединение/i.test(error.message);
}
function describeBoardLoadFailure(error:unknown):BoardLoadFailure{
  if(error instanceof SelfhostHttpError){
    if(error.status===401)return {message:"Сессия завершена. Войдите снова, чтобы открыть эту доску.",reauth:true};
    if(error.status===403||error.status===404)return {message:"Доска недоступна. Попросите владельца прислать действующую ссылку.",reauth:false};
    if(error.status===429)return {message:"Слишком много запросов. Подождите немного и повторите попытку.",reauth:false};
    if(error.status>=500)return {message:"Сервер Lektrus временно недоступен. Нажмите «Повторить» чуть позже.",reauth:false};
  }
  if(isTransientBoardRead(error))return {message:"Не удалось связаться с сервером Lektrus. Проверьте интернет-соединение и повторите попытку.",reauth:false};
  return {message:error instanceof Error&&error.message?error.message:"Не удалось загрузить доску с сервера.",reauth:false};
}
// Only reads: never retry acceptance of invitations, writes or login requests.
// A superseded navigation must not issue the second request.
async function readBoardWithRetry<T>(read:()=>Promise<T>,isCurrent:()=>boolean):Promise<T>{
  try{return await read()}
  catch(error){
    if(!isCurrent()||!isTransientBoardRead(error))throw error;
    await new Promise<void>(resolve=>window.setTimeout(resolve,450));
    if(!isCurrent())throw error;
    return await read();
  }
}

export default function App() {
  const [route, setRoute] = useState<AppRoute>(() => {
    const initial=initialRoute();
    return Capacitor.isNativePlatform()&&initial.kind==="site"?{kind:"home"}:initial;
  });
  // Android owns the orientation request and system bars in one native call.
  // iOS uses the Capacitor orientation plugin.
  const lockNativeOrientation = useCallback((board: boolean) => {
    if(Capacitor.getPlatform()==="android")return LektrusSystemUi.setBoardMode({enabled: board});
    // Screen dimensions stay device-sized when the iPad viewport changes
    // (including Split View). Only phones require a portrait workspace.
    if(!board&&Math.min(window.screen.width,window.screen.height)>=600)return ScreenOrientation.unlock();
    return ScreenOrientation.lock({ orientation: board ? "landscape-primary" : "portrait-primary" });
  }, []);
  const [authUser, setAuthUser] = useState<AuthUser | null>(() =>
    new URLSearchParams(window.location.search).has("password-reset") ? null : getCachedCurrentUser()
  );
  const [authReady, setAuthReady] = useState(() =>
    !new URLSearchParams(window.location.search).has("password-reset") && Boolean(getCachedCurrentUser())
  );
  const authenticatedBoardRoute = authReady && !!authUser && route.kind === "board";
  // Android system back should behave like Lektrus navigation, not dismiss the app.
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    const goBackInsideLektrus = () => {
      if(!window.dispatchEvent(new Event("lektrus:board-native-back",{cancelable:true})))return;
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

  const navigate = useCallback((path: string, replace = false) => {
    const appPath=path==="/"?"/app":path.startsWith("/?")?`/app${path.slice(1)}`:path;
    window.history[replace ? "replaceState" : "pushState"](null, "", appPath);
    const url = new URL(appPath, window.location.href);
    const next=parseRoute(url.pathname);
    if(next.kind==="board"||next.kind==="demo")requestBrowserBoardLandscape(true);
    else releaseBrowserBoardLandscape();
    if(next.kind==="join")rememberShareToken(next.token);
    if(next.kind==="board")rememberBoardPath(next.boardId);
    setRoute(Capacitor.isNativePlatform()&&next.kind==="site"?{kind:"home"}:next);
    window.dispatchEvent(new Event("lektrus:workspace-route"));
  }, []);
  useEffect(() => {
    if (route.kind==="home" && new URLSearchParams(window.location.search).get("section")==="ai") {
      navigate("/app?section=settings", true);
    }
  }, [route, navigate]);
  useEffect(() => {
    const changed = () => {
      const parsed = parseRoute(window.location.pathname);
      const next=Capacitor.isNativePlatform()&&parsed.kind==="site"?{kind:"home" as const}:parsed;
      if(next.kind!=="board"&&next.kind!=="demo")releaseBrowserBoardLandscape();
      if (next.kind === "join") rememberShareToken(next.token);
      if (next.kind === "board") rememberBoardPath(next.boardId);
      setRoute(next);
    };
    window.addEventListener("popstate", changed);
    return () => window.removeEventListener("popstate", changed);
  }, []);
  const [authCallbackError,setAuthCallbackError]=useState("");
  const [accountRole,setAccountRoleState]=useState<AccountRole>(()=>getCachedAccountAccess()?.role??"student");
  const [isAppAdmin,setIsAppAdmin]=useState(()=>getCachedAccountAccess()?.isAdmin??false);
  const [appRolePreview,setAppRolePreview]=useState<"actual"|AccountRole>("actual");
  const effectiveAccountRole=appRolePreview==="actual"?accountRole:appRolePreview;
  const [workspacePreference,setWorkspacePreference]=useState<"teaching"|"learning">("teaching");
  const [workspaceModeBusy,setWorkspaceModeBusy]=useState(false);
  const [workspaceModeNotice,setWorkspaceModeNotice]=useState("");
  const modeEnabled=isSelfhostBackendEnabled()&&!authUser?.isGuest&&appRolePreview==="actual";
  const workspaceMode=effectiveAccountRole==="teacher"&&workspacePreference==="teaching"?"teaching":"learning";
  const workspaceRole:AccountRole=modeEnabled?(workspaceMode==="teaching"?"teacher":"student"):effectiveAccountRole;
  useEffect(()=>{
    if(!authUser)return;
    try{setWorkspacePreference(localStorage.getItem("lektrus.workspace-mode."+authUser.id)==="learning"?"learning":"teaching")}catch{setWorkspacePreference("teaching")}
    setWorkspaceModeNotice("");
  },[authUser?.id]);
  const chooseWorkspaceMode=async(next:"teaching"|"learning")=>{
    if(!authUser||workspaceModeBusy||!modeEnabled)return;
    setWorkspaceModeNotice("");
    if(next==="teaching"&&accountRole!=="teacher"){
      if(!window.confirm("Подключить преподавательские функции? Вы по-прежнему сможете учиться на чужих досках."))return;
      setWorkspaceModeBusy(true);
      try{const result=await enableTeacherRole();setAccountRoleState(result.role);setIsAppAdmin(result.isAdmin);window.dispatchEvent(new Event("onlinerepetitor:account-access"))}
      catch(error){setWorkspaceModeNotice(error instanceof Error?error.message:"Не удалось подключить режим преподавателя.");return}
      finally{setWorkspaceModeBusy(false)}
    }
    setWorkspacePreference(next);
    try{localStorage.setItem("lektrus.workspace-mode."+authUser.id,next)}catch{}
  };
  const [adminInspecting,setAdminInspecting]=useState(false);
  const [adminEdit,setAdminEdit]=useState(()=>{try{return localStorage.getItem("onlinerepetitor.adminEdit")==="1"}catch{return false}});
  const changeAdminEdit=useCallback((value:boolean)=>{setAdminEdit(value);try{localStorage.setItem("onlinerepetitor.adminEdit",value?"1":"0")}catch{}},[]);
  const [adminInvisible,setAdminInvisible]=useState(()=>{try{return localStorage.getItem("onlinerepetitor.adminInvisible")==="1"}catch{return false}});
  const changeAdminInvisible=useCallback((value:boolean)=>{setAdminInvisible(value);try{localStorage.setItem("onlinerepetitor.adminInvisible",value?"1":"0")}catch{}},[]);
  const [activeBoard, setActiveBoard] = useState<BoardSummary | null>(null);
  // Native authentication is local UI: a failed background health probe must
  // not replace the form or discard credentials while a user is typing.
  const preserveNativeAuth=Capacitor.getPlatform()==="android"&&!authUser;
  const serviceAvailability=useServiceAvailability(isSelfhostBackendEnabled()&&!LEKTRUS_LOCAL_TEST_MODE&&!activeBoard&&
    (route.kind==="home"||route.kind==="join"||route.kind==="board"),preserveNativeAuth);
  const boardChanged = useCallback((updated: BoardSummary) => {
    setActiveBoard(current => current?.id === updated.id ? updated : current);
  }, []);
  const [boardLoading, setBoardLoading] = useState(false);
  // A pending board link must NOT rotate the login or registration screen.
  const nativeBoardOpening = Capacitor.isNativePlatform() && (route.kind === "demo" ||
    authenticatedBoardRoute || Boolean(authReady && authUser && adminInspecting && (activeBoard || boardLoading)));
  useLayoutEffect(() => {
    if (!Capacitor.isNativePlatform() || !nativeBoardOpening) return;
    const page = document.documentElement;
    page.classList.add("lektrus-native-board");
    let frame = 0;
    let settle: ReturnType<typeof setTimeout> | undefined;
    const resetOuterScroll = () => {
      const focus = document.activeElement;
      if (focus?.matches('input:not([type="button"]):not([type="checkbox"]):not([type="range"]),textarea,[contenteditable="true"]')) return;
      // Older WebViews can scroll an overflow:hidden ancestor on focus. Do
      // not reset the editor's own scroller or the infinite canvas camera.
      window.scrollTo(0, 0);
      for (const element of [page, document.body, document.getElementById("root"), document.querySelector("#root > .app")]) {
        if (element) { element.scrollTop = 0; element.scrollLeft = 0; }
      }
    };
    const afterKeyboard = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(resetOuterScroll);
      clearTimeout(settle);
      settle = setTimeout(resetOuterScroll, 360);
    };
    resetOuterScroll();
    window.addEventListener("resize", afterKeyboard);
    window.visualViewport?.addEventListener("resize", afterKeyboard);
    document.addEventListener("focusout", afterKeyboard);
    return () => {
      page.classList.remove("lektrus-native-board");
      window.removeEventListener("resize", afterKeyboard);
      window.visualViewport?.removeEventListener("resize", afterKeyboard);
      document.removeEventListener("focusout", afterKeyboard);
      cancelAnimationFrame(frame);
      clearTimeout(settle);
    };
  }, [nativeBoardOpening]);

  const [nativeLandscapeReady, setNativeLandscapeReady] = useState(false);
  useLayoutEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    if (!nativeBoardOpening) {
      setNativeLandscapeReady(false);
      void lockNativeOrientation(false).catch(error => console.warn("Unable to restore Lektrus workspace orientation", error));
      return;
    }
    // Start rotation before the first loader paint, not when BoardApp mounts.
    // A portrait keyboard can shrink the WebView into a landscape-shaped box.
    // Check the display width as well, and never dismiss an already-open editor.
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    const root = document.documentElement;
    root.classList.add("lektrus-native-rotating");
    let alive = true;
    const ready = () => {
      if (!alive) return;
      // The OS may briefly report a landscape-sized viewport and then
      // return to portrait during rotation, or the readiness timeout may
      // elapse while the board chunk is still loading. Keep the loader's
      // portrait fallback until navigation actually leaves the board.
      setNativeLandscapeReady(true);
    };
    const check = () => {
      if (innerWidth > innerHeight && innerWidth >= Math.max(screen.width, screen.height) - 100) ready();
    };
    // Returning from a system file picker can leave older Android WebViews
    // in portrait despite the original landscape request. Reassert it only
    // when this still-mounted board becomes visible/focused again.
    let lastRestore = 0;
    const restoreOnReturn = () => {
      if(alive && document.visibilityState === "visible" && innerWidth < innerHeight &&
          Date.now() - lastRestore > 300) {
        lastRestore = Date.now();
        void lockNativeOrientation(true).then(check).catch(()=>undefined);
      }
    };
    const resize = () => {
      check();
      // The system picker can deliver focus before a late portrait resize.
      if (Capacitor.getPlatform() === "android") restoreOnReturn();
    };
    check();
    window.addEventListener("resize", resize);
    window.addEventListener("focus", restoreOnReturn);
    document.addEventListener("visibilitychange", restoreOnReturn);
    // Native file pickers can return without a WebView focus/visibility event.
    // Retry on the Capacitor foreground event and after the picker animation.
    let resumeRetry: ReturnType<typeof setTimeout> | undefined;
    const onAppState = ({ isActive }: { isActive: boolean }) => {
      if (!isActive || !alive) return;
      restoreOnReturn();
      if (resumeRetry) window.clearTimeout(resumeRetry);
      resumeRetry = window.setTimeout(restoreOnReturn, 700);
    };
    const appStateListener = CapacitorApp.addListener("appStateChange", onAppState);
    window.visualViewport?.addEventListener("resize", check);
    void lockNativeOrientation(true).then(check).catch(error => console.warn("Unable to change Lektrus orientation", error));
    // Large-screen OS modes can refuse an orientation lock; do not strand users.
    const timeout = window.setTimeout(ready, 4000);
    return () => {
      alive = false;
      root.classList.remove("lektrus-native-rotating");
      window.clearTimeout(timeout);
      window.removeEventListener("resize", resize);
      window.removeEventListener("focus", restoreOnReturn);
      document.removeEventListener("visibilitychange", restoreOnReturn);
      if (resumeRetry) window.clearTimeout(resumeRetry);
      void appStateListener.then(listener => listener.remove());
      window.visualViewport?.removeEventListener("resize", check);
    };
  }, [nativeBoardOpening, lockNativeOrientation]);
  const [boardLoadError, setBoardLoadError] = useState<BoardLoadFailure|null>(null);
  const [sharePassword, setSharePassword] = useState("");
  const [submittedSharePassword, setSubmittedSharePassword] = useState<{token:string;value:string}|null>(null);
  const [sharePasswordRequired, setSharePasswordRequired] = useState(false);
  const [browserJoinToken,setBrowserJoinToken]=useState("");
  const mobileJoinUrl=route.kind==="join"&&browserJoinToken!==route.token&&!Capacitor.isNativePlatform()&&
    /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)?nativeBoardUrl(`/join/${route.token}`):null;
  const [remoteVersion, setRemoteVersion] = useState<number | null>(null);
  const [boardMountKey, setBoardMountKey] = useState(0);
  const changeAppRolePreview=useCallback((role:"actual"|AccountRole)=>{
    if(!isAppAdmin)return;
    setAppRolePreview(role);
    if(role!=="actual"&&!activeBoard)navigate("/?section=boards");
  },[isAppAdmin,activeBoard,navigate]);
  // Installation state is shared by the early browser listener and every installation button.

  useEffect(() => {
    let alive = true;
    let authRetryTimer:number|undefined;
    let confirmationListener:{remove:()=>Promise<void>}|null=null;
    const acceptBoardUrl=(url:string)=>{
      const path=nativeBoardPath(url);
      if(!path)return false;
      if(alive&&window.location.pathname!==path)navigate(path,true);
      return true;
    };
    const retrySession=(userId:string,attempt=0)=>{
      authRetryTimer=window.setTimeout(async()=>{
        if(!alive)return;
        const cached=getCachedCurrentUser();
        if(cached?.id!==userId){
          if(!cached)setAuthUser(current=>current?.id===userId?null:current);
          return;
        }
        try{
          const user=await getCurrentUser();
          // Do not remount a board that may already have recovered meanwhile.
          if(alive&&!user)setAuthUser(current=>current?.id===userId?null:current);
        }catch{
          if(alive&&attempt<4&&getCachedCurrentUser()?.id===userId)retrySession(userId,attempt+1);
        }
      },Math.min(1000*2**attempt,15000));
    };
    const processConfirmation=async(callbackUrl:string)=>{
      try{
        const confirmedUser=await completeEmailConfirmation(callbackUrl);
        if(!alive||!confirmedUser)return false;
        setAuthUser(confirmedUser);
        setActiveBoard(null);
        // The confirmation callback must not reset an invitation to /app.
        // Keep the pending /join/:token until redemption, then the token is
        // replaced with /board/:id. Never put auth fragments back in history.
        navigate(pendingSharePath()??pendingBoardPath()??"/",true);
        return true;
      }catch(error){const message=error instanceof Error?error.message:"Не удалось подтвердить email";console.warn("Lektrus email confirmation could not be completed",error);if(alive)setAuthCallbackError(message);return false}
    };
    const initialize=async()=>{
      if(route.kind==="demo"){if(alive)setAuthReady(true);return;}
      if(new URLSearchParams(window.location.search).has("password-reset")){
        await logoutUser({forget:true});
        if(alive){setAuthUser(null);setAuthReady(true)}
        return;
      }
      if(route.kind==="site"){
        if(alive)setAuthReady(true);
        return;
      }
      if(Capacitor.isNativePlatform()){
        const processNativeUrl=async(url:string)=>{
          if(acceptBoardUrl(url))return false;
          // A board invitation is not an authentication callback.
          try {const parsed=new URL(url);if(parsed.protocol!=="ru.lektrus.board:"||parsed.hostname!=="auth"||parsed.pathname!=="/confirmed")return false;}
          catch{return false;}
          return processConfirmation(url);
        };
        confirmationListener=await CapacitorApp.addListener("appUrlOpen",({url})=>{void processNativeUrl(url).then(done=>{if(done&&alive)setAuthReady(true)})});
        const launch=await CapacitorApp.getLaunchUrl();
        if(launch?.url&&await processNativeUrl(launch.url)){if(alive)setAuthReady(true);return}
      }
      await processConfirmation(window.location.href);
      const user=await getCurrentUser();
      if(alive)setAuthUser(user);
      if(alive)setAuthReady(true);
    };
    void initialize().catch(error=>{
      console.warn("Lektrus authentication initialization failed",error);
      if(!alive)return;
      // A network/5xx error is not the same as an expired or revoked session.
      // Keep the existing identity; protected API calls still require a valid token.
      const cached=isSelfhostBackendEnabled()?getCachedCurrentUser():null;
      setAuthUser(cached);setAuthReady(true);
      if(cached)retrySession(cached.id);
    });
    return () => {alive=false;if(authRetryTimer!==undefined)window.clearTimeout(authRetryTimer);void confirmationListener?.remove()};
  }, [navigate]);

  // Load the administrator-published interface design for every signed-in
  // account. Refresh on return to the app so other devices pick up updates.
  useEffect(()=>{
    if(route.kind==="demo"||!authReady||!authUser||!(isRemoteBackendEnabled()||isSelfhostBackendEnabled()))return;
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
    const interval=window.setInterval(()=>{if(document.visibilityState==="visible")void refresh()},15_000);
    window.addEventListener("focus",refresh);
    return()=>{alive=false;window.clearInterval(interval);window.removeEventListener("focus",refresh)};
  },[authReady,authUser?.id,route.kind]);

  const logout = () => {
    // Local test APK is deliberately passwordless. "Exit" returns home
    // without deleting the isolated demo identity or asking for a server.
    if (LEKTRUS_LOCAL_TEST_MODE) {
      clearPendingShare();
      clearPendingBoardPath();
      setActiveBoard(null);
      navigate("/", true);
      return;
    }
    clearPendingShare();
    clearPendingBoardPath();
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
    setBoardLoadError(null);
    setBoardLoading(true);
    try {
      if (isRemoteBackendEnabled() || isSelfhostBackendEnabled()) {
        const selfhost=isSelfhostBackendEnabled();
        const remote = selfhost ? await readBoardWithRetry(()=>selfhostReadDocument(board.id),isCurrent) : await readBoardWithRetry(()=>getRemoteBoardDocument(board.id),isCurrent);
        const saveBoardDocument=async(document:DocumentData,expectedVersion:number|null)=>{
          if(!selfhost)return saveRemoteBoardDocument(board.id,document,expectedVersion);
          try{
            const saved=await selfhostSaveDocument(board.id,expectedVersion??0,document as unknown as Record<string,unknown>);
            return {ok:true,conflict:false,version:saved.version};
          }catch(error){
            if(error instanceof SelfhostHttpError&&error.status===409)
              return {ok:false,conflict:true,version:null};
            throw error;
          }
        };
        if (!isCurrent()) return;
        if(selfhost&&remote?.version===0&&"initial_subject" in remote&&typeof remote.initial_subject==="string")board={...board,initialSubject:remote.initial_subject};
        const mayEditMetadata=canEditBoardMetadata(board.role,board.participantRole,false);
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
              const saved = await saveBoardDocument(document,remote?.version ?? 0);
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
          // Older server placeholders used a hard-coded title even for named boards.
          if(parsed.title==="Новая доска"&&board.title!=="Новая доска"&&parsed.items.length===0&&remote.version<=1)
            parsed={...parsed,title:board.title};
          // A pending local snapshot must be rebased from the last confirmed
          // version, never unioned with the server's current object list.
          try{
            const pending=localStorage.getItem(key+".pending-sync")==="1";
            const savedRaw=pending?localStorage.getItem(key):null;
            if(savedRaw&&board.role!=="viewer"){
              const local=parseDocument(savedRaw);
              const serverFingerprint=documentFingerprint(parsed);
              if(documentFingerprint(local)!==serverFingerprint){
                const baseRaw=localStorage.getItem(key+".pending-base");
                if(baseRaw){
                  const base=parseDocument(baseRaw);
                  const server=parsed;
                  parsed=mergeBoardDocumentEdits(base,local,server);
                  if(selfhost&&!mayEditMetadata)parsed={...parsed,title:server.title,subject:server.subject};
                  localStorage.setItem(key+".pending-base",JSON.stringify(server));
                }else{
                  // Older versions did not save a base. Preserve the local
                  // recovery copy without guessing which IDs were deleted.
                  localStorage.setItem(key+".recovery-backup",savedRaw);
                  localStorage.removeItem(key+".pending-sync");
                }
                if(documentFingerprint(parsed)===serverFingerprint){
                  localStorage.removeItem(key+".pending-sync");
                  localStorage.removeItem(key+".pending-base");
                }
              }else{
                localStorage.removeItem(key+".pending-sync");
                localStorage.removeItem(key+".pending-base");
              }
            }
          }catch(error){
            // Do not overwrite the only local recovery copy if saving a
            // backup or rebased baseline failed (e.g. storage quota).
            throw error;
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
            let localDocument = parseDocument(raw);
            if(selfhost&&!mayEditMetadata){
              localDocument={...localDocument,title:board.title,subject:board.initialSubject??""};
              localStorage.setItem(key,JSON.stringify(localDocument));
            }
            try {
              await ensureBoardAssets(board.id, localDocument);
              const saved = await saveBoardDocument(localDocument, 0);
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
      clearPendingBoardPath();
      setBoardMountKey((value) => value + 1);
    } catch (error) {
      if (isCurrent()) setBoardLoadError(describeBoardLoadFailure(error));
    } finally {
      if (isCurrent()) setBoardLoading(false);
    }
  }, []);

  // Refreshing the same cached identity must not remount an already opening
  // board or spend the retry budget again. A genuine user/permission change
  // still reloads with the fresh server-authorized board role.
  const studioAdminAccess=route.kind==="board"&&route.boardId===INTERFACE_STUDIO_BOARD_ID&&isAppAdmin;
  useEffect(() => {
    if (!authReady || !authUser) return;
    let alive = true;
    setActiveBoard(null);
    setBoardLoadError(null);
    setSharePasswordRequired(false);
    if (route.kind === "site") { setBoardLoading(false); return; }
    if (route.kind === "tool") { setBoardLoading(false); return; }
    if (route.kind === "demo") { setBoardLoading(false); return; }
    if (authUser.guestBoardId && route.kind === "home") { navigate(`/board/${authUser.guestBoardId}`,true);return; }
    if (route.kind === "home") { setBoardLoading(false); return; }
    // Don't redeem in the browser before the participant can choose the app.
    if (mobileJoinUrl) {setBoardLoading(false);return;}
    setBoardLoading(true);
    void (async () => {
      try {
        if (route.kind === "invalid") throw new Error("Ссылка недействительна");
        if (route.kind === "join") {
          rememberShareToken(route.token);
          if(authUser.guestBoardId){await logoutUser();if(alive)setAuthUser(null);return;}
          const redeemed = await redeemShareLink(route.token, submittedSharePassword?.token===route.token?submittedSharePassword.value:undefined);
          if (!alive) return;
          clearPendingShare();
          navigate(`/board/${redeemed.board_id}`, true);
          return;
        }
        setAdminInspecting(false);
        if(route.boardId===INTERFACE_STUDIO_BOARD_ID){
          if(!studioAdminAccess||new URLSearchParams(window.location.search).get("layout-editor")!=="1")
           throw new Error("Редактор интерфейса доступен только администратору.");
          const board:BoardSummary={id:INTERFACE_STUDIO_BOARD_ID,title:"Новая доска",
           ownerId:authUser.id,role:"owner",createdAt:new Date().toISOString(),
           updatedAt:new Date().toISOString()};
          setRemoteVersion(null);setActiveBoard(board);setBoardMountKey(key=>key+1);
          setBoardLoading(false);return;
        }
        const boardId=route.boardId;
        const board = await readBoardWithRetry(()=>getBoardForUser(authUser,boardId),()=>alive);
        if (!alive) return;
        if (!board) throw new Error("Доска недоступна. Попросите владельца прислать ссылку для доступа.");
        await openBoard(board, () => alive);
      } catch (error) {
        if (!alive) return;
        setBoardLoading(false);
        const message=error instanceof Error ? error.message : "Не удалось открыть доску";
        if(route.kind==="join" && /парол/i.test(message)){
          setSharePasswordRequired(true);
          setBoardLoadError(null);
        }else{
          setSharePasswordRequired(false);
          setBoardLoadError(describeBoardLoadFailure(error));
        }
      }
    })();
    return () => { alive = false; };
  }, [route, authReady, authUser?.id, authUser?.email, authUser?.guestBoardId, authUser?.accountRole,
      authUser?.teacherStatus, authUser?.isAdmin, studioAdminAccess, navigate, openBoard, submittedSharePassword, mobileJoinUrl]);

  useEffect(()=>{
    if(route.kind==="demo"||!authUser)return;
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
  },[authUser?.id,route.kind]);

  useEffect(()=>{if(!isAppAdmin)setAppRolePreview("actual")},[isAppAdmin]);

  // Navigation is owned by LectrisWorkspaceShell (explicit section IDs).
  // Do not intercept page clicks by their Russian button labels: "Настройки"
  // also occurs inside atlas, notifications and local tool dialogs.

  if(route.kind==="site")return <Suspense fallback={<div className="lektrus-site-loading"/>}><LektrusPublicSite/></Suspense>;

  if(route.kind==="tool")return <Suspense fallback={<BoardLoadingScreen nativeRotate={false}/>}><PublicToolScreen tool={route.tool} onBack={()=>window.location.assign("/")}/></Suspense>;

  if(route.kind==="demo"){
    if(nativeBoardOpening && !nativeLandscapeReady)return <BoardLoadingScreen/>;
    if(wantsBrowserBoardLandscape())return <BrowserBoardLandscape key={window.location.pathname+window.location.search} path={window.location.pathname+window.location.search} demo onBack={()=>window.location.assign("/")} onLogout={()=>window.location.assign("/")}/>;
    return <Suspense fallback={<BoardLoadingScreen/>}><PublicDemoBoard/></Suspense>;
  }

  if(serviceAvailability.reason&&!activeBoard&&!preserveNativeAuth)return <ServiceUnavailableScreen reason={serviceAvailability.reason} checking={serviceAvailability.checking} automatic onRetry={serviceAvailability.check}/>;

  if (!authReady) {
    if (nativeBoardOpening) return <BoardLoadingScreen/>;
    if(route.kind==="board"&&wantsBrowserBoardLandscape())return <BoardLoadingScreen browserRotate/>;
    return <main className="auth-shell"><section className="auth-card"><div className="auth-brand-row"><div className="auth-logo">B</div><div><div className="auth-brand">Учебная доска</div><div className="auth-subtitle">Проверяем сессию…</div></div></div></section></main>;
  }



  if (!authUser) {
    return <><AuthScreen initialError={authCallbackError} connectionIssue={preserveNativeAuth&&serviceAvailability.reason?{reason:serviceAvailability.reason,checking:serviceAvailability.checking,onRetry:serviceAvailability.check}:undefined} onAuthenticated={(user) => { clearAccountAccessCache(); clearNotificationCache(); if(user.guestBoardId){clearPendingShare();navigate(`/board/${user.guestBoardId}`,true);}setAuthUser(user); setActiveBoard(null); }} />{route.kind==="home"&&<PwaInstallOffer/>}</>;
  }

  if(mobileJoinUrl&&route.kind==="join")return <main className="auth-shell"><section className="auth-card"><strong>Приглашение на доску Lektrus</strong><p>Где открыть доску?</p><div className="share-password-actions"><a className="primary" href={mobileJoinUrl}>Открыть в приложении</a><button type="button" onClick={()=>setBrowserJoinToken(route.token)}>Продолжить в браузере</button></div><button type="button" onClick={()=>{clearPendingShare();navigate("/app",true)}}>Отмена</button></section></main>;

  if (nativeBoardOpening && !nativeLandscapeReady) return <BoardLoadingScreen/>;

  const returnFromBoard=()=>{if(authUser.guestBoardId){logout();return;}setActiveBoard(null);if(adminInspecting||new URLSearchParams(window.location.search).get("layout-editor")==="1"){setAdminInspecting(false);navigate("/?section=admin");}else navigate("/")};
  if(wantsBrowserBoardLandscape()&&!boardLoadError&&(route.kind==="board"||(adminInspecting&&activeBoard))){
    const id=route.kind==="board"?route.boardId:activeBoard!.id;
    // Keep this iframe mounted throughout the loading -> interactive transition
    // and subsequent real screen rotations. The parent alone loads the board.
    const payload=activeBoard?.id.toLowerCase()===id.toLowerCase()?{authUser,boardSummary:activeBoard.planReadOnly?{...activeBoard,role:"viewer" as const,participantRole:"observer" as const}:activeBoard,accountRole,isAppAdmin,
      globalRolePreview:appRolePreview,adminMaintenance:adminInspecting&&isAppAdmin&&adminEdit,
      adminInvisible,initialRemoteVersion:remoteVersion,selfhostMode:isSelfhostBackendEnabled(),mountKey:boardMountKey}:undefined;
    const path=route.kind==="board"?window.location.pathname+window.location.search+window.location.hash:`/board/${id}`;
    return <BrowserBoardLandscape key={path} path={path} payload={payload} onBack={returnFromBoard} onLogout={logout} onChanged={boardChanged} onRoleChange={changeAppRolePreview}/>;
  }

  if (!activeBoard) {
    return (
      <>
        {route.kind === "home" && <LectrisWorkspaceShell section={new URLSearchParams(window.location.search).get("section")||""} role={workspaceRole} isAdmin={isAppAdmin} name={authUser.name} rolePreview={appRolePreview} workspaceMode={modeEnabled?workspaceMode:undefined} onWorkspaceMode={chooseWorkspaceMode} modeBusy={workspaceModeBusy} modeNotice={workspaceModeNotice}><Suspense fallback={<div className="lectris-section-loading" role="status"><strong>Открываем раздел…</strong><span>Загружаем только нужный модуль.</span></div>}>{(()=>{const section=new URLSearchParams(window.location.search).get("section");return section==="registration-preview"&&isAppAdmin&&appRolePreview==="actual"
          ? <AuthScreen onAuthenticated={()=>{}} previewMode onPreviewClose={()=>{window.history.pushState({}, "", "/app?section=boards");window.dispatchEvent(new PopStateEvent("popstate"))}} />
          : section==="admin" && isAppAdmin && appRolePreview==="actual"
          ? <AdminScreen user={authUser} invisible={adminInvisible} onInvisibleChange={changeAdminInvisible} adminEdit={adminEdit} onAdminEditChange={changeAdminEdit} rolePreview={appRolePreview} onRolePreviewChange={changeAppRolePreview} onCheckRegistration={()=>navigate("/?section=registration-preview")} onOpenBoard={(board)=>{setAdminInspecting(true);void openBoard(board,()=>true)}} onOpenLayout={async()=>{navigate(`/board/${INTERFACE_STUDIO_BOARD_ID}?layout-editor=1`)}} onBack={()=>navigate("/app?section=boards")} />
          : section==="students" && workspaceRole==="teacher"
          ? <StudentsScreen user={authUser} onBack={()=>navigate("/app?section=boards")} onOpenBoard={(board)=>navigate(`/board/${board.id}`)} />
          : section==="teachers" && workspaceRole==="student"
          ? <TeachersScreen key={authUser.id} user={authUser} onOpenBoard={id=>navigate(`/board/${id}`)} />
          : section==="assignments"
          ? <AssignmentsScreen key={`${authUser.id}:${workspaceRole}`} user={authUser} accountRole={workspaceRole} onBack={()=>navigate("/app?section=boards")} onOpenBoard={(board)=>navigate(`/board/${board.id}`)} />
          : section==="progress" && workspaceRole==="teacher"
          ? <ProgressScreen user={authUser} onBack={()=>navigate("/app?section=boards")} />
          : section==="schedule"
          ? <ScheduleScreen key={workspaceRole} user={authUser} accountRole={workspaceRole} onBack={()=>navigate("/app?section=boards")} onOpenBoard={(board)=>navigate(`/board/${board.id}`)} />
          : section==="materials" && workspaceRole==="teacher"
          ? <MaterialsScreen user={authUser} onBack={()=>navigate("/app?section=boards")} />
          : section==="notifications"
          ? <NotificationsScreen user={authUser} onBack={()=>navigate("/app?section=boards")} />
          : section==="feedback"
          ? <FeedbackScreen />
          : section==="profile"
          ? <ProfileScreen user={authUser} accountRole={effectiveAccountRole} isAppAdmin={isAppAdmin&&appRolePreview==="actual"} previewMode={appRolePreview!=="actual"} onLogout={()=>appRolePreview==="actual"?logout():changeAppRolePreview("actual")} onBack={()=>navigate("/app?section=boards")} />
          : section==="settings"
          ? <SettingsScreen user={authUser} onWorkspaceMode={modeEnabled?chooseWorkspaceMode:undefined} previewRole={appRolePreview==="actual"?null:effectiveAccountRole} onPreviewRoleChange={changeAppRolePreview} onBack={()=>navigate("/app?section=boards")} onLogout={()=>appRolePreview==="actual"?logout():changeAppRolePreview("actual")} onBilling={()=>{window.history.pushState({}, "", "/app?section=billing");window.dispatchEvent(new PopStateEvent("popstate"))}} />
          : section==="billing"
          ? <BillingScreen onBack={()=>{window.history.pushState({}, "", "/app?section=settings");window.dispatchEvent(new PopStateEvent("popstate"))}} />
          : section==="templates" && workspaceRole==="teacher"
          ? <TemplatesScreen user={authUser} onBack={()=>navigate("/app?section=boards")} onOpenBoard={(board)=>navigate(`/board/${board.id}`)} />
          : <BoardsScreen user={authUser} accountRole={workspaceRole} workspaceMode={modeEnabled?workspaceMode:undefined} isAppAdmin={isAppAdmin&&appRolePreview==="actual"} onOpenBoard={(board) => navigate(`/board/${board.id}`)} onLogout={()=>appRolePreview==="actual"?logout():changeAppRolePreview("actual")} />})()}</Suspense></LectrisWorkspaceShell>}
        {route.kind === "home" && !boardLoading && !boardLoadError && <PwaInstallOffer/>}
        {sharePasswordRequired && route.kind==="join" && <div className="board-server-overlay"><form className="board-server-card share-password-card" onSubmit={e=>{e.preventDefault();if(!sharePassword.trim())return;setSharePasswordRequired(false);setSubmittedSharePassword({token:route.token,value:sharePassword});}}><strong>Ссылка защищена паролем</strong><span>Введите пароль, который сообщил владелец доски.</span><input type="password" value={sharePassword} onChange={e=>setSharePassword(e.target.value)} placeholder="Пароль ссылки" autoComplete="off"/><div className="share-password-actions"><button className="primary" type="submit" disabled={!sharePassword.trim()}>Открыть доску</button><button type="button" onClick={()=>{setSharePassword("");clearPendingShare();navigate("/",true)}}>Отмена</button></div></form></div>}
        {boardLoading && <BoardLoadingScreen browserRotate={adminInspecting&&wantsBrowserBoardLandscape()}/>}
        {boardLoadError && <div className="board-server-overlay board-recovery-overlay"><section className="board-server-card board-recovery-card" role="alertdialog" aria-modal="true" aria-labelledby="board-recovery-title" aria-describedby="board-recovery-description">
          <div className="board-recovery-mark" aria-hidden="true"><img src="/lektrus-icon-192.png" alt=""/></div>
          <span className="board-recovery-kicker">LEKTRUS · ДОСКА</span><h1 id="board-recovery-title">Не удалось открыть доску</h1><p id="board-recovery-description">{boardLoadError.message}</p>
          <div className="board-recovery-actions">
            {boardLoadError.reauth?<button className="primary" type="button" autoFocus onClick={()=>{
              if(route.kind==="board")rememberBoardPath(route.boardId);
              if(route.kind==="join")rememberShareToken(route.token);
              void logoutUser().catch(()=>{});
              clearAccountAccessCache();clearNotificationCache();setActiveBoard(null);setAuthUser(null);setBoardLoadError(null);
            }}>Войти заново</button>:<button type="button" className="primary" autoFocus onClick={()=>setRoute({...route})}>Повторить</button>}
            <button type="button" onClick={()=>{if(authUser.guestBoardId){logout();return}clearPendingShare();clearPendingBoardPath();navigate("/app?section=boards",true)}}>{authUser.guestBoardId?"Выйти":"К моим доскам"}</button>
          </div></section></div>}
      </>
    );
  }

  return (
    <Suspense fallback={<BoardLoadingScreen/>}><BoardApp
      key={`${activeBoard.id}:${boardMountKey}`}
      authUser={authUser}
      boardSummary={activeBoard.planReadOnly?{...activeBoard,role:"viewer",participantRole:"observer"}:activeBoard}
      accountRole={accountRole}
      isAppAdmin={isAppAdmin}
      globalRolePreview={appRolePreview}
      onGlobalRolePreviewChange={changeAppRolePreview}
      adminMaintenance={adminInspecting && isAppAdmin && adminEdit}
      adminInvisible={adminInvisible}
      initialRemoteVersion={remoteVersion}
      selfhostMode={isSelfhostBackendEnabled()}
      onBoardChanged={boardChanged}
      onBackToBoards={returnFromBoard}
      onLogout={logout}
    /></Suspense>
  );
}
