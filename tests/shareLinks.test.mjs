import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
function load(name, globals) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(read('src/' + name + '.ts'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, { exports, URL, URLSearchParams, ...globals });
  return exports;
}
function browser(href) {
  let address = new URL(href);
  const history = {
    replaceState(_data, _title, path) { address = new URL(path, address.origin); },
  };
  const window = {
    history,
    location: {
      get href() { return address.href; },
      get pathname() { return address.pathname; },
      get search() { return address.search; },
      get hash() { return address.hash; },
      get origin() { return address.origin; },
    },
  };
  return { window, getHref: () => address.href };
}
const token = 'a'.repeat(64);
const boardId = 'a1000000-1234-4567-89ab-1234567890ab';

test('share creation, redemption and password use exactly the deployed RPC arguments', async () => {
  const calls = [];
  const api = load('shareLinks', {
    require: () => ({
      isRemoteBackendEnabled: () => true,
      remoteRequest: async (path, request) => {
        calls.push([path, JSON.parse(request.body)]);
        return path.includes('create_board_share_link')
          ? { id: 'link-1', board_id: boardId, role: 'viewer', token, created_at: '2026-11-13T00:00:00Z',
              expires_at: null, revoked_at: null, max_uses: 2, use_count: 0, protected: true }
          : { board_id: boardId, id: boardId, title: 'Общая доска',
              owner_id: 'owner', role: 'viewer', created_at: '', updated_at: '' };
      },
    }),
  });
  const link = await api.createShareLink(boardId, 'viewer',
    { expiresAt: '2026-12-01T00:00:00Z', maxUses: 2, password: ' pass123 ' });
  assert.equal(link.protected, true);
  assert.equal(link.token, token);
  await api.redeemShareLink(token, 'pass123');
  await api.redeemShareLink(token);
  assert.deepEqual(calls, [
    ['/rest/v1/rpc/create_board_share_link', {
      p_board_id: boardId, p_role: 'viewer', p_expires_at: '2026-12-01T00:00:00Z',
      p_max_uses: 2, p_password: 'pass123',
    }],
    ['/rest/v1/rpc/redeem_board_share_link', { p_token: token, p_password: 'pass123' }],
    ['/rest/v1/rpc/redeem_board_share_link', { p_token: token, p_password: null }],
  ]);
});

test('invitation URL grants an entry route; direct board URL requires membership', () => {
  const { window } = browser('https://lektrus.example/app');
  const api = load('shareLinks', { window, require: () => ({}) });
  assert.equal(api.boardShareUrl(token), 'https://lektrus.example/join/' + token);
  assert.equal(api.boardDirectUrl(boardId), 'https://lektrus.example/board/' + boardId);
  assert.throws(() => api.boardShareUrl('bad'), /токен/);
  assert.throws(() => api.boardDirectUrl('../other'), /идентификатор/);
});

test('legacy query links preserve /app and unrelated query/hash when cleared', () => {
  const browserSession = browser('https://lektrus.example/app?section=boards&join=' + token + '#saved');
  const api = load('shareLinks', { window: browserSession.window, require: () => ({}) });
  assert.equal(api.pendingShareToken(), token);
  api.clearPendingShareToken();
  assert.equal(browserSession.getHref(), 'https://lektrus.example/app?section=boards#saved');
  const direct = browser('https://lektrus.example/join/' + token);
  const directApi = load('shareLinks', { window: direct.window, require: () => ({}) });
  assert.equal(directApi.pendingShareToken(), token);
  directApi.clearPendingShareToken();
  assert.equal(direct.getHref(), 'https://lektrus.example/app');
});

test('canonical and legacy join routes survive a reload and are cleared only after redemption', () => {
  const session = new Map();
  const storage = {
    getItem: key => session.get(key) ?? null,
    setItem: (key, value) => session.set(key, value),
    removeItem: key => session.delete(key),
  };
  const browserSession = browser('https://lektrus.example/?join=' + token);
  const globals = { window: browserSession.window, sessionStorage: storage };
  const routes = load('routes', globals);
  assert.equal(routes.initialRoute().kind, 'join');
  assert.equal(browserSession.getHref(), 'https://lektrus.example/join/' + token);
  assert.equal(routes.pendingSharePath(), '/join/' + token);
  const followup = browser('https://lektrus.example/app?email_confirmation=1');
  const onConfirmation = load('routes', { window: followup.window, sessionStorage: storage });
  assert.equal(onConfirmation.initialRoute().kind, 'join');
  assert.equal(onConfirmation.pendingSharePath(), '/join/' + token);
  onConfirmation.clearPendingShare();
  assert.equal(onConfirmation.pendingSharePath(), null);
  assert.equal(onConfirmation.parseRoute('/board/' + boardId).kind, 'board');
  assert.equal(onConfirmation.parseRoute('/board/../../bad').kind, 'invalid');
  assert.equal(onConfirmation.parseRoute('/join/invalid').kind, 'invalid');
  const invalid = browser('https://lektrus.example/?join=bad');
  assert.equal(load('routes', { window: invalid.window, sessionStorage: storage }).initialRoute().kind, 'invalid');
});

test('pending invitation survives confirmation in a second tab and expires cleanly', () => {
  const persistent = new Map();
  const localStorage = {
    getItem: key => persistent.get(key) ?? null,
    setItem: (key, value) => persistent.set(key, value),
    removeItem: key => persistent.delete(key),
  };
  const firstTabStorage = new Map();
  const firstTab = load('routes', {
    window: browser('https://lektrus.example/join/' + token).window,
    sessionStorage: {
      getItem: key => firstTabStorage.get(key) ?? null,
      setItem: (key, value) => firstTabStorage.set(key, value),
      removeItem: key => firstTabStorage.delete(key),
    },
    localStorage,
  });
  assert.equal(firstTab.initialRoute().kind, 'join');
  const secondTab = load('routes', {
    window: browser('https://lektrus.example/app?email_confirmation=1').window,
    sessionStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
    localStorage,
  });
  assert.equal(secondTab.pendingSharePath(), '/join/' + token);
  assert.equal(secondTab.initialRoute().kind, 'join');
  secondTab.clearPendingShare();
  assert.equal(secondTab.pendingSharePath(), null);
  firstTab.rememberShareToken(token);
  persistent.set('lesson-board.pending-share.v2', JSON.stringify({ token, until: Date.now() - 1000 }));
  assert.equal(secondTab.pendingSharePath(), null, 'expired cross-tab token must not be reused');
});

test('email confirmation keeps the invite; legacy query starts the app, not the public site', () => {
  const app = read('src/App.tsx');
  const entry = read('src/main.tsx');
  const auth = read('src/AuthScreen.tsx');
  const boards = read('src/BoardsScreen.tsx');
  assert.match(app, /navigate\(pendingSharePath\(\)\?\?"\/",true\)/);
  assert.doesNotMatch(app, /callback\.pathname\+callback\.search/);
  assert.match(app, /navigate\(\x60\/board\/\$\{redeemed\.board_id\}\x60, true\)/);
  assert.match(entry, /query\.has\("join"\)/);
  assert.match(auth, /onAuthenticated\(await loginGuest\(guestName\)\)/);
  assert.match(boards, /window\.dispatchEvent\(new PopStateEvent\("popstate"\)\)/);
  assert.match(boards, /boardDirectUrl\(manage\.id\)/);
  assert.doesNotMatch(boards, /await redeemBoardShareLink\(token\)/);
});

test('link management hides revoked, expired or exhausted invitations and does not invent a presentation mode', () => {
  const dialog = read('src/ShareDialog.tsx');
  assert.match(dialog, /link\.max_uses===null\|\|link\.use_count<link\.max_uses/);
  assert.match(dialog, /createdIsActive&&created/);
  assert.match(dialog, /boardDirectUrl\(board\.id\)/);
  assert.match(dialog, /setLinks\(rows=>\[link,/);
  assert.doesNotMatch(dialog, /presentationUrl|present=1/);
});

test('ordinary board deep links read fresh RLS-authorized boards and member roles', async () => {
  const user = { id: 'member-1', name: 'Tester', email: 'user@example.org' };
  const row = { id: boardId, owner_id: 'teacher-1', title: 'Общая доска',
    created_at: '2026-11-01T10:00:00Z', updated_at: '2026-11-13T10:00:00Z' };
  let boardRows = [row], memberRows = [];
  const requests = [];
  const api = load('boardStore', {
    require: name => {
      if (name === './backend') return {
        isRemoteBackendEnabled: () => true,
        remoteRequest: async path => {
          requests.push(path);
          if (path.startsWith('/rest/v1/boards?')) return boardRows;
          if (path.startsWith('/rest/v1/board_members?')) return memberRows;
          throw Error('Unexpected endpoint ' + path);
        },
      };
      if (name === './boardModel') return { STORAGE_KEY: 'test-board' };
      if (name === './lektrusLocalTestMode') return { LEKTRUS_LOCAL_TEST_MODE: false };
      if (name === './authStore') return {};
      throw Error('Unexpected import ' + name);
    },
  });
  assert.equal(await api.getBoardForUser(user, boardId), null, 'stranger denied');
  memberRows = [{ role: 'viewer' }];
  assert.equal((await api.getBoardForUser(user, boardId)).role, 'viewer');
  memberRows = [{ role: 'editor' }];
  assert.equal((await api.getBoardForUser(user, boardId)).role, 'editor');
  memberRows = [];
  boardRows = [{ ...row, owner_id: user.id }];
  assert.equal((await api.getBoardForUser(user, boardId)).role, 'owner');
  boardRows = [];
  assert.equal(await api.getBoardForUser(user, boardId), null, 'deleted/inaccessible board denied');
  assert.ok(requests.every(path => path.includes('board') && !path.includes('cache')));
  assert.ok(requests.some(path => path.includes('deleted_at=is.null')));
});

test('links remain gated by server mode and database enforces expiry, password and access', async () => {
  const api = load('shareLinks', { require: () => ({
    isRemoteBackendEnabled: () => false,
    remoteRequest: () => assert.fail('remote call not allowed'),
  }) });
  await assert.rejects(api.createShareLink(boardId, 'viewer'), /серверной синхронизации/);
  await assert.rejects(api.redeemShareLink(token), /серверной синхронизации/);
  const sql = read('supabase/v66_share_link_password.sql');
  for (const guard of ['p_max_uses', 'password_hash', 'for update', 'v_effective_role', 'auth.uid()']) {
    assert.ok(sql.includes(guard), 'share RPC missing: ' + guard);
  }
  // This deployment uses Nginx, not the historical Vercel configuration.
  const nginx = read('deploy/nginx.conf');
  assert.match(nginx, /try_files \$uri \$uri\/ \/index\.html/);
  assert.match(nginx, /Referrer-Policy "no-referrer"/);
});
