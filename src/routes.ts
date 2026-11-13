export type AppRoute = { kind: "site" } | { kind: "tool"; tool: "atlas" | "laboratory" } | { kind: "demo" } | { kind: "home" } | { kind: "board"; boardId: string } | { kind: "join"; token: string } | { kind: "invalid" };
const PENDING_KEY = "lesson-board.pending-share.v1";
const PENDING_CROSS_TAB_KEY = "lesson-board.pending-share.v2";
const PENDING_BOARD_KEY = "lektrus.pending-board-route.v1";
const PENDING_BOARD_CROSS_TAB_KEY = "lektrus.pending-board-route.v2";
const PENDING_TTL_MS = 2 * 60 * 60 * 1000;
const TOKEN = /^[a-f0-9]{64}$/;
export function parseRoute(path: string): AppRoute {
  if (path === "/") return { kind: "site" };
  if (path === "/app" || path === "/app/") return { kind: "home" };
  if (path === "/tools/atlas" || path === "/tools/atlas/") return {kind:"tool",tool:"atlas"};
  if (path === "/tools/laboratory" || path === "/tools/laboratory/") return {kind:"tool",tool:"laboratory"};
  if (path === "/demo/board" || path === "/demo/board/") return {kind:"demo"};
  const join = path.match(/^\/join\/([a-f0-9]{64})\/?$/);
  if (join) return { kind: "join", token: join[1] };
  const board = path.match(/^\/board\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\/?$/i);
  return board ? { kind: "board", boardId: board[1] } : { kind: "invalid" };
}
export function rememberShareToken(token: string) {
  if (!TOKEN.test(token)) return;
  try { sessionStorage.setItem(PENDING_KEY, token); } catch { /* storage unavailable */ }
  // Email confirmation commonly opens a NEW tab. SessionStorage is scoped
  // to the original tab, so retain an expiring cross-tab handoff as well.
  try { localStorage.setItem(PENDING_CROSS_TAB_KEY, JSON.stringify({ token, until: Date.now() + PENDING_TTL_MS })); }
  catch { /* the original invitation URL still works */ }
}
export function pendingSharePath(): string | null {
  try {
    const token = sessionStorage.getItem(PENDING_KEY);
    if (token && TOKEN.test(token)) return `/join/${token}`;
  } catch { /* tab storage unavailable */ }
  try {
    const record = JSON.parse(localStorage.getItem(PENDING_CROSS_TAB_KEY) || "null");
    if (record && TOKEN.test(record.token) && Number.isFinite(record.until) && record.until > Date.now())
      return `/join/${record.token}`;
    localStorage.removeItem(PENDING_CROSS_TAB_KEY);
  } catch { /* corrupted or unavailable storage */ }
  return null;
}
/** Remember a direct board route until email confirmation completes, including in a new tab. */
export function rememberBoardPath(boardId: string) {
  const path="/board/"+boardId;
  if (parseRoute(path).kind !== "board") return;
  try { sessionStorage.setItem(PENDING_BOARD_KEY,path); } catch { /* storage unavailable */ }
  try { localStorage.setItem(PENDING_BOARD_CROSS_TAB_KEY,JSON.stringify({path,until:Date.now()+PENDING_TTL_MS})); }
  catch { /* local navigation remains valid */ }
}
export function pendingBoardPath(): string | null {
  try {
    const path=sessionStorage.getItem(PENDING_BOARD_KEY);
    if(path && parseRoute(path).kind==="board") return path;
  } catch { /* storage unavailable */ }
  try {
    const record=JSON.parse(localStorage.getItem(PENDING_BOARD_CROSS_TAB_KEY)||"null");
    if(record && typeof record.path==="string" && parseRoute(record.path).kind==="board" &&
       Number.isFinite(record.until) && record.until>Date.now()) return record.path;
    localStorage.removeItem(PENDING_BOARD_CROSS_TAB_KEY);
  } catch { /* malformed or inaccessible storage */ }
  return null;
}
export function clearPendingBoardPath() {
  try { sessionStorage.removeItem(PENDING_BOARD_KEY); } catch { /* storage unavailable */ }
  try { localStorage.removeItem(PENDING_BOARD_CROSS_TAB_KEY); } catch { /* storage unavailable */ }
}
export function clearPendingShare() {
  try { sessionStorage.removeItem(PENDING_KEY); } catch { /* storage unavailable */ }
  try { localStorage.removeItem(PENDING_CROSS_TAB_KEY); } catch { /* storage unavailable */ }
}
export function initialRoute(): AppRoute {
  let route = parseRoute(window.location.pathname);
  const query = new URLSearchParams(window.location.search);
  // Older invitations used ?join=TOKEN. Route them through the same password
  // prompt and authorization checks as the canonical /join/TOKEN links.
  if ((route.kind === "site" || route.kind === "home") && query.has("join")) {
    const token = query.get("join")?.trim() ?? "";
    if (!TOKEN.test(token)) return { kind: "invalid" };
    window.history.replaceState({}, "", `/join/${token}`);
    route = { kind: "join", token };
  }
  if (route.kind === "site" && (query.has("section") || query.has("email_confirmation") || query.get("source") === "pwa")) {
    window.history.replaceState({}, "", "/app" + window.location.search + window.location.hash);
    route = { kind: "home" };
  }
  if (route.kind === "join") rememberShareToken(route.token);
  if (route.kind === "board") rememberBoardPath(route.boardId);
  if (route.kind === "site" || route.kind === "home") {
    const pending = pendingSharePath();
    if (pending) return { kind: "join", token: pending.slice("/join/".length) };
  }
  return route;
}
