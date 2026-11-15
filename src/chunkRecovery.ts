// A page opened before a deployment can still reference an old hashed chunk.
// Do not blindly reload (especially during an active lesson) or loop on a
// temporary network failure. First verify that the entry bundle has changed.
export function isChunkLoadError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /failed to fetch dynamically imported module|error loading dynamically imported module|importing a module script failed|loading chunk [\w-]+ failed|chunkloaderror|unable to preload css/i.test(message);
}

const RECOVERY_KEY = "lektrus.chunk-recovery.v1";

export async function recoverOutdatedChunk(error: unknown, allowReload: boolean): Promise<boolean> {
  if (!allowReload || !isChunkLoadError(error) || navigator.onLine === false) return false;
  try {
    const current = document.querySelector<HTMLScriptElement>('script[type="module"][src]')?.src;
    if (!current || !new URL(current).pathname.startsWith("/assets/")) return false;
    if (sessionStorage.getItem(RECOVERY_KEY) === current) return false;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    let response: Response;
    try {
      response = await fetch("/index.html", { cache: "no-store", signal: controller.signal });
    } finally {
      clearTimeout(timeout);
    }
    if (!response.ok) return false;
    const html = new DOMParser().parseFromString(await response.text(), "text/html");
    const next = html.querySelector<HTMLScriptElement>('script[type="module"][src]')?.getAttribute("src");
    if (!next) return false;
    const nextUrl = new URL(next, window.location.origin);
    if (nextUrl.origin !== window.location.origin || !nextUrl.pathname.startsWith("/assets/") || nextUrl.href === current) return false;
    if (sessionStorage.getItem(RECOVERY_KEY) === current) return false;
    // Guard before reloading. If storage is unavailable, leave manual recovery
    // available rather than risk an endless reload of an outdated app shell.
    sessionStorage.setItem(RECOVERY_KEY, current);
    window.location.reload();
    return true;
  } catch {
    return false;
  }
}
