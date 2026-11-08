export type AppRoute = { kind: "site" } | { kind: "tool"; tool: "atlas" | "laboratory" } | { kind: "demo" } | { kind: "home" } | { kind: "board"; boardId: string } | { kind: "join"; token: string } | { kind: "invalid" };
const PENDING_KEY = "lesson-board.pending-share.v1";
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
  try { sessionStorage.setItem(PENDING_KEY, token); } catch { /* route still contains it */ }
}
export function clearPendingShare() {
  try { sessionStorage.removeItem(PENDING_KEY); } catch { /* storage unavailable */ }
}
export function initialRoute(): AppRoute {
  let route = parseRoute(window.location.pathname);
  if(route.kind==="site"){
    const query=new URLSearchParams(window.location.search);
    if(query.has("section")||query.has("email_confirmation")||query.get("source")==="pwa"){
      window.history.replaceState({},"","/app"+window.location.search+window.location.hash);
      route={kind:"home"};
    }
  }
  if (route.kind === "join") rememberShareToken(route.token);
  if(route.kind==="site"){
    try{
      const token=sessionStorage.getItem(PENDING_KEY);
      if(token&&TOKEN.test(token))return {kind:"join",token};
    }catch{/* no pending token */}
  }
  if (route.kind === "home") {
    try {
      const token = sessionStorage.getItem(PENDING_KEY);
      if (token && TOKEN.test(token)) return { kind: "join", token };
    } catch { /* no pending token */ }
  }
  return route;
}
