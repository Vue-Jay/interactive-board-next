/** Regression checks for signed offline Android builds.
 * Runs real auth/backend/board modules with the compile-time flag enabled
 * while imitating stored credentials from an existing production install.
 */
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import path from "node:path";
import ts from "typescript";

const db=new Map([
 ["lektrus.native.supabase.config.v1",JSON.stringify({
  url:"https://existing.example.supabase.co",anonKey:"existing-anon-key"})],
 ["lesson-board.supabase.session.v1",JSON.stringify({
  access_token:"previous-token",refresh_token:"previous-refresh",
  expires_at:9999999999,user:{id:"previous-remote-user",email:"teacher@example.org"}
 })],
 ["onlinerepetitor.account-role.v81","student"],
 ["lesson-board.boards.v1",JSON.stringify([{id:"production-board",ownerId:"previous-remote-user"}])]
]);
globalThis.localStorage={
 getItem:k=>db.has(k)?db.get(k):null,
 setItem:(k,v)=>db.set(k,String(v)),
 removeItem:k=>db.delete(k)
};
globalThis.window={setTimeout,clearTimeout};
let networkCalls=0;
globalThis.fetch=async()=>{networkCalls++;throw Error("Offline test must not use network")};
const modules=new Map();
function load(filename){
 const key=path.resolve(filename);
 if(modules.has(key))return modules.get(key).exports;
 const mod={exports:{}};modules.set(key,mod);
 let source=readFileSync(key,"utf8");
 // The test is evaluated with the same Vite define values as the offline
 // workflow, and DELIBERATELY includes stale embedded remote credentials.
 source=source.replaceAll("import.meta.env",JSON.stringify({
  VITE_LEKTRUS_LOCAL_TEST:"true",VITE_SUPABASE_URL:"https://old.supabase.co",
  VITE_SUPABASE_ANON_KEY:"old-publishable-key"
 }));
 const js=ts.transpileModule(source,{compilerOptions:{
  module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022
 }}).outputText;
 new Function("require","module","exports",js)(id=>{
  if(id==="@capacitor/core")return {Capacitor:{isNativePlatform:()=>true}};
  if(id==="./boardModel")return {STORAGE_KEY:"lesson-board.document.v1"};
  assert.ok(id.startsWith("."),"Unexpected dependency "+id);
  return load(path.resolve(path.dirname(key),id+".ts"));
 },mod,mod.exports);
 return mod.exports;
}
const mode=load("src/lektrusLocalTestMode.ts");
const backend=load("src/backend.ts");
const auth=load("src/authStore.ts");
const roles=load("src/accountRoleStore.ts");
const boards=load("src/boardStore.ts");
assert.equal(mode.LEKTRUS_LOCAL_TEST_MODE,true);
assert.equal(backend.isRemoteBackendEnabled(),false);
assert.equal(backend.nativeBackendIsBundled(),false);
assert.equal(backend.getCachedRemoteSession(),null);
assert.equal(await backend.getRemoteSession(),null);
assert.equal(backend.isCachedRemoteSessionUsable(),false);
assert.equal(auth.getCachedCurrentUser()?.id,mode.LEKTRUS_LOCAL_TEST_USER.id);
assert.equal((await auth.getCurrentUser())?.id,mode.LEKTRUS_LOCAL_TEST_USER.id);
assert.equal((await roles.getAccountAccess()).role,"teacher");
const before=Object.fromEntries(db);
backend.clearNativeBackendConnection();
await auth.logoutUser();
assert.equal(db.get("lektrus.native.supabase.config.v1"),before["lektrus.native.supabase.config.v1"]);
assert.equal(db.get("lesson-board.supabase.session.v1"),before["lesson-board.supabase.session.v1"]);
const user=await auth.getCurrentUser();
const mine=await boards.ensureUserBoards(user);
assert.equal(mine.length,1);
assert.equal(mine[0].role,"owner");
assert.notEqual(mine[0].id,"production-board");
assert.ok(boards.boardStorageKey(mine[0].id).includes(".local-test.board."));
assert.equal(db.get("lesson-board.boards.v1"),before["lesson-board.boards.v1"],
 "A test must not mutate saved production boards");
assert.ok(db.has("lesson-board.local-test.boards.v1"),
 "Test boards should be persisted locally in isolated storage");
assert.equal(networkCalls,0);
const entry=readFileSync("src/main.tsx","utf8");
assert.match(entry,/!LEKTRUS_LOCAL_TEST_MODE && !isRemoteBackendEnabled\(\)/);
const app=readFileSync("src/App.tsx","utf8");
assert.match(app,/if \(LEKTRUS_LOCAL_TEST_MODE\) \{/);
console.log("Offline local test: no Supabase prompt, teacher without login, isolated boards, old sessions preserved: OK");
