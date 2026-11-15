import { isRemoteBackendEnabled, remoteRequest } from "./backend";
import { isSelfhostBackendEnabled, selfhostRequest } from "./selfhostApi";
import type { BoardSummary } from "./boardStore";
import type { BoardRole } from "./authStore";

export type ShareRole = Exclude<BoardRole, "owner">;

/** Server-shaped link used by the existing ShareDialog. */
export type ShareLink = {
  id: string;
  board_id: string;
  role: ShareRole;
  created_at: string;
  expires_at: string | null;
  revoked_at: string | null;
  max_uses: number | null;
  use_count: number;
  protected: boolean;
};

export type CreatedShareLink = ShareLink & { token: string };

/** Camel-cased compatibility shape used by BoardsScreen from the archive workflow. */
export type BoardShareLink = {
  id: string;
  boardId: string;
  role: ShareRole;
  createdAt: string;
  expiresAt: string | null;
  revokedAt: string | null;
  maxUses: number | null;
  useCount: number;
  protected: boolean;
};

export const shareLinksEnabled = () => isSelfhostBackendEnabled() || isRemoteBackendEnabled();

const requireRemote = () => {
  if (!shareLinksEnabled()) {
    throw new Error("Ссылки доступа работают только при включённой серверной синхронизации.");
  }
};

const normalizeServerLink = (row: any): ShareLink => ({
  id: String(row.id),
  board_id: String(row.board_id),
  role: row.role as ShareRole,
  created_at: String(row.created_at),
  expires_at: row.expires_at ?? null,
  revoked_at: row.revoked_at ?? null,
  max_uses: row.max_uses == null ? null : Number(row.max_uses),
  use_count: Number(row.use_count || 0),
  protected: Boolean(row.protected),
});

/* API expected by the current Codex-created App.tsx / ShareDialog.tsx. */
export async function createShareLink(boardId: string, role: ShareRole, options?: { expiresAt?: string | null; maxUses?: number | null; password?: string | null }): Promise<CreatedShareLink> {
  requireRemote();
  if (isSelfhostBackendEnabled()) {
    return selfhostRequest<CreatedShareLink>(`/api/v1/boards/${encodeURIComponent(boardId)}/share-links`, {
      method: "POST",
      body: JSON.stringify({ role, expires_at: options?.expiresAt, max_uses: options?.maxUses || null, password: options?.password }),
    });
  }
  const row = await remoteRequest<any>("/rest/v1/rpc/create_board_share_link", {
    method: "POST",
    body: JSON.stringify({ p_board_id: boardId, p_role: role, p_expires_at: options?.expiresAt || null, p_max_uses: options?.maxUses || null, p_password: options?.password?.trim() || null }),
  });
  return {
    ...normalizeServerLink({ ...row, revoked_at: null }),
    token: String(row.token),
  };
}

export async function listShareLinks(boardId: string): Promise<ShareLink[]> {
  requireRemote();
  if (isSelfhostBackendEnabled()) {
    return selfhostRequest<ShareLink[]>(`/api/v1/boards/${encodeURIComponent(boardId)}/share-links`);
  }
  const rows = await remoteRequest<any[]>("/rest/v1/rpc/list_board_share_links", {
    method: "POST",
    body: JSON.stringify({ p_board_id: boardId }),
  });
  return (rows || []).map(normalizeServerLink);
}

export async function revokeShareLink(linkId: string): Promise<void> {
  requireRemote();
  if (isSelfhostBackendEnabled()) {
    return selfhostRequest<void>(`/api/v1/share-links/${encodeURIComponent(linkId)}`, { method: "DELETE" });
  }
  await remoteRequest("/rest/v1/rpc/revoke_board_share_link", {
    method: "POST",
    body: JSON.stringify({ p_link_id: linkId }),
  });
}

/**
 * Returns the server-shaped RPC response because the existing App.tsx
 * navigates with redeemed.board_id after accepting /join/<token>.
 */
export async function redeemShareLink(token: string, password?: string): Promise<{
  id: string;
  board_id: string;
  title: string;
  owner_id: string;
  role: BoardRole;
  created_at: string;
  updated_at: string;
}> {
  requireRemote();
  if (isSelfhostBackendEnabled()) {
    return selfhostRequest("/api/v1/share-links/redeem", {
      method: "POST",
      body: JSON.stringify({ token, password }),
    });
  }
  return remoteRequest("/rest/v1/rpc/redeem_board_share_link", {
    method: "POST",
    body: JSON.stringify({ p_token: token, p_password: password || null }),
  });
}

/* Compatibility aliases for BoardsScreen used in the archive patches. */
export async function createBoardShareLink(
  boardId: string,
  role: ShareRole,
): Promise<BoardShareLink & { token: string }> {
  const row = await createShareLink(boardId, role);
  return {
    id: row.id,
    boardId: row.board_id,
    role: row.role,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    revokedAt: row.revoked_at,
    maxUses: row.max_uses,
    useCount: row.use_count,
    protected: row.protected,
    token: row.token,
  };
}

export async function listBoardShareLinks(boardId: string): Promise<BoardShareLink[]> {
  const rows = await listShareLinks(boardId);
  return rows.map((row) => ({
    id: row.id,
    boardId: row.board_id,
    role: row.role,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    revokedAt: row.revoked_at,
    maxUses: row.max_uses,
    useCount: row.use_count,
    protected: row.protected,
  }));
}

export const revokeBoardShareLink = revokeShareLink;

export async function redeemBoardShareLink(token: string): Promise<BoardSummary> {
  const row = await redeemShareLink(token);
  return {
    id: row.board_id || row.id,
    title: row.title,
    ownerId: row.owner_id,
    role: row.role,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const JOIN_PREFIX = "/join/";
const SHARE_TOKEN = /^[a-f0-9]{64}$/;
const BOARD_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Share public production links on the main HTTPS domain, even if an older
// tab remains open on an alias. Preserve local/test and independent installs.
function boardLinkOrigin() {
  const origin = window.location.origin;
  return /^https?:\/\/(?:lektrus\.ru|www\.lektrus\.ru|lectrus\.ru|www\.lectrus\.ru|lektrus-vuejay\.msk1\.amvera\.tech)$/i.test(origin)
    ? "https://lektrus.ru" : origin;
}

export function boardShareUrl(token: string) {
  if (!SHARE_TOKEN.test(token)) throw new Error("Некорректный токен приглашения");
  return `${boardLinkOrigin()}${JOIN_PREFIX}${token}`;
}

/** A direct board URL does not grant permissions; a member or owner must sign in. */
export function boardDirectUrl(boardId: string) {
  if (!BOARD_ID.test(boardId)) throw new Error("Некорректный идентификатор доски");
  return `${boardLinkOrigin()}/board/${boardId}`;
}

export function pendingShareToken(): string | null {
  const path = window.location.pathname;
  if (path.startsWith(JOIN_PREFIX)) {
    const token = path.slice(JOIN_PREFIX.length).split("/")[0];
    return SHARE_TOKEN.test(token) ? token : null;
  }
  const token = new URL(window.location.href).searchParams.get("join")?.trim() || "";
  return SHARE_TOKEN.test(token) ? token : null;
}

export function clearPendingShareToken() {
  const url = new URL(window.location.href);
  url.searchParams.delete("join");
  // Do not turn /app into /: that would make a reload show the public site.
  const path = url.pathname.startsWith(JOIN_PREFIX) ? "/app" : url.pathname;
  window.history.replaceState({}, "", `${path}${url.search}${url.hash}`);
}
/** Copy also on a local HTTP network origin where Clipboard API is unavailable. */
export async function copyBoardLink(value: string): Promise<boolean> {
  if (navigator.clipboard?.writeText) {
    try { await navigator.clipboard.writeText(value); return true; }
    catch { /* Fallback for blocked clipboard permissions. */ }
  }
  const previous=document.activeElement instanceof HTMLElement?document.activeElement:null;
  const field=document.createElement("textarea");
  field.value=value;
  field.readOnly=true;
  field.style.position="fixed";
  field.style.top="0";
  field.style.opacity="0";
  field.style.pointerEvents="none";
  document.body.appendChild(field);
  try {
    field.focus({preventScroll:true});
    field.select();
    return document.execCommand("copy");
  } catch { return false; }
  finally {
    field.remove();
    previous?.focus({preventScroll:true});
  }
}

