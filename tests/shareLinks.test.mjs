import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

const read = path => readFileSync(new URL('../'+path,import.meta.url),'utf8');
function load(name, globals={}) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(read('src/'+name+'.ts'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, { exports, URL, URLSearchParams, ...globals });
  return exports;
}
const BOARD_ID='10000000-0000-0000-0000-000000000001';
const TOKEN='a'.repeat(64);

test('share creation, password redemption and invalid tokens use the correct RPC contract', async () => {
  const calls=[];
  const api=load('shareLinks',{require:()=>({
    isRemoteBackendEnabled:()=>true,
    remoteRequest:async(path,request)=>{calls.push([path,JSON.parse(request.body)]);return {board_id:BOARD_ID,id:BOARD_ID};},
  })});
  await api.createShareLink(BOARD_ID,'viewer');
  await api.createShareLink(BOARD_ID,'editor',{maxUses:3,expiresAt:'2027-01-01T00:00:00.000Z',password:'secret'});
  await api.redeemShareLink(TOKEN);
  await api.redeemShareLink(TOKEN,'secret');
  assert.deepEqual(calls[0],['/rest/v1/rpc/create_board_share_link',{p_board_id:BOARD_ID,p_role:'viewer',p_expires_at:null,p_max_uses:null,p_password:null}]);
  assert.deepEqual(calls[1],['/rest/v1/rpc/create_board_share_link',{p_board_id:BOARD_ID,p_role:'editor',p_expires_at:'2027-01-01T00:00:00.000Z',p_max_uses:3,p_password:'secret'}]);
  assert.deepEqual(calls[2],['/rest/v1/rpc/redeem_board_share_link',{p_token:TOKEN,p_password:null}]);
  assert.deepEqual(calls[3],['/rest/v1/rpc/redeem_board_share_link',{p_token:TOKEN,p_password:'secret'}]);
  await assert.rejects(api.redeemShareLink('../invalid'),/Некорректная ссылка/);
  assert.equal(calls.length,4,'invalid tokens must never reach the backend');
});

test('local mode cannot create or redeem remote invitations', async()=>{
  const api=load('shareLinks',{require:()=>({
    isRemoteBackendEnabled:()=>false,remoteRequest:()=>assert.fail('unexpected network request'),
  })});
  await assert.rejects(api.createShareLink(BOARD_ID,'viewer'),/серверной синхронизации/);
  await assert.rejects(api.redeemShareLink(TOKEN),/серверной синхронизации/);
});

test('invitation routes survive login and are removed after redemption',()=>{
  const memory=new Map();
  const win={location:{pathname:'/join/'+TOKEN,search:'',hash:''},history:{replaceState(){}}};
  const routes=load('routes',{window:win,sessionStorage:{
    getItem:key=>memory.get(key)??null,setItem:(key,v)=>memory.set(key,v),removeItem:key=>memory.delete(key),
  }});
  assert.equal(routes.initialRoute().token,TOKEN);
  win.location.pathname='/app';
  assert.equal(routes.initialRoute().token,TOKEN);
  assert.equal(routes.pendingAuthenticatedRoute().kind,'join');
  routes.clearPendingShare();
  assert.equal(routes.pendingAuthenticatedRoute(),null);
  assert.equal(routes.initialRoute().kind,'home');
  assert.equal(routes.parseRoute('/join/invalid').kind,'invalid');
});

test('direct board URLs survive email-confirmation redirects, then clear safely',()=>{
  const memory=new Map();
  const win={location:{pathname:'/board/'+BOARD_ID,search:'',hash:''},history:{replaceState(){}}};
  const routes=load('routes',{window:win,sessionStorage:{
    getItem:key=>memory.get(key)??null,setItem:(key,v)=>memory.set(key,v),removeItem:key=>memory.delete(key),
  }});
  assert.equal(routes.initialRoute().boardId,BOARD_ID);
  win.location.pathname='/app';
  assert.equal(routes.pendingAuthenticatedRoute().boardId,BOARD_ID);
  routes.rememberShareToken(TOKEN);
  assert.equal(routes.pendingAuthenticatedRoute().kind,'join','invitations take precedence over older board destinations');
  routes.clearPendingShare();
  assert.equal(routes.pendingAuthenticatedRoute().boardId,BOARD_ID);
  routes.clearPendingBoardRoute();
  assert.equal(routes.pendingAuthenticatedRoute(),null);
  assert.equal(routes.parseRoute('/board/'+BOARD_ID).kind,'board');
  assert.equal(routes.parseRoute('/board/../../bad').kind,'invalid');
  routes.rememberBoardRoute('../bad');
  assert.equal(routes.pendingAuthenticatedRoute(),null);
});

test('App performs both board and invitation restoration and checks returned board ids',()=>{
  const app=read('src/App.tsx');
  assert.match(app,/pendingAuthenticatedRoute\(\)/);
  assert.match(app,/target\?\.kind==="join"/);
  assert.match(app,/target\?\.kind==="board"/);
  assert.match(app,/redeemed\.board_id\|\|redeemed\.id/);
  assert.match(app,/parseRoute\(`\/board\/\$\{boardId\}\`\)/);
  assert.match(app,/clearPendingBoardRoute\(\)/);
});

test('production nginx serves deep links through the SPA and hides invite tokens from referrers',()=>{
  const nginx=read('deploy/nginx.conf');
  assert.match(nginx,/location \/ \{ try_files \$uri \$uri\/ \/index\.html;/);
  assert.match(nginx,/Referrer-Policy "no-referrer"/);
});

test('server SQL defines the current password-protected redemption contract',()=>{
  const sql=read('supabase/v66_share_link_password.sql');
  assert.match(sql,/create function public\.redeem_board_share_link\(p_token text,p_password text default null\)/);
  assert.match(sql,/'board_id',v_board\.id/);
  assert.match(sql,/use_count<max_uses/);
  assert.match(sql,/revoked_at is null/);
  assert.match(sql,/password_hash/);
});
