import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";

const cache=fs.readFileSync(new URL("../src/guestNameCache.ts",import.meta.url),"utf8");
const code=ts.transpileModule(cache,{compilerOptions:{
 target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS
}}).outputText;
const entries=new Map();
const storage={
 getItem:key=>entries.get(key)??null,
 setItem:(key,value)=>entries.set(key,value),
 removeItem:key=>entries.delete(key)
};
const exp={};
new Function("exports","localStorage",code)(exp,storage);
const key=exp.GUEST_NAME_CACHE_KEY;
assert.equal(key,"lektrus.guest.last-name.v1");
assert.equal(exp.getCachedGuestName(),"","First-time guests must get a blank field");
exp.rememberGuestName("  Анна   Иванова  ");
assert.equal(storage.getItem(key),"Анна Иванова","Only normalized display name stored locally");
assert.equal(exp.getCachedGuestName(),"Анна Иванова");
// A new component instance / new browser session reads the same local cache.
const reopened={};
new Function("exports","localStorage",code)(reopened,storage);
assert.equal(reopened.getCachedGuestName(),"Анна Иванова",
 "Name must prefill after leaving/reopening the guest join screen");
reopened.rememberGuestName("Новый гость");
assert.equal(exp.getCachedGuestName(),"Новый гость",
 "The most recently successful guest name replaces the old one");
const previous=storage.getItem(key);
exp.rememberGuestName("a");
exp.rememberGuestName(" ");
exp.rememberGuestName("X".repeat(61));
assert.equal(storage.getItem(key),previous,"Invalid guest names must never be cached");
for(const bad of ["a","   ","X".repeat(61)]) {
 storage.setItem(key,bad);
 assert.equal(exp.getCachedGuestName(),"","Bad cache values must not populate the form");
}
const blocked={getItem(){throw Error("Storage denied")},setItem(){throw Error("Storage denied")}};
const privateSession={};
new Function("exports","localStorage",code)(privateSession,blocked);
assert.doesNotThrow(()=>privateSession.rememberGuestName("Анна"));
assert.equal(privateSession.getCachedGuestName(),"",
 "Guest entry must work in private mode even when localStorage is unavailable");
const screen=fs.readFileSync(new URL("../src/AuthScreen.tsx",import.meta.url),"utf8");
const auth=fs.readFileSync(new URL("../src/authStore.ts",import.meta.url),"utf8");
assert.match(screen,/useState\(\(\)=>getCachedGuestName\(\)\)/,
 "The guest join form must prefill from local device storage");
assert.match(screen,/value=\{guestName\} onChange=\{e=>fieldEdited\(e.target.value,setGuestName\)\}/,
 "Guest name must remain editable");
const login=auth.slice(auth.indexOf("export const loginGuest="),auth.indexOf("export const getRememberedAccount="));
assert.match(login,/const user=selfhostUser\(await selfhostGuestLogin\(guestName,token,password\)\)!;\s*rememberGuestName\(guestName\)/,
 "Only successful self-hosted guest logins may update the cache");
assert.match(login,/const s=await signInAnonymousRemote\(guestName\);\s*const user=remoteUser\(s\)!;\s*rememberGuestName\(guestName\)/,
 "Only successful remote guest logins may update the cache");
assert.doesNotMatch(cache,/token|password|refresh|access_token|fetch\(/i,
 "The guest-name cache must not store credentials or talk to the server");
console.log("Guest name: saved after successful login, restored next session, editable, bad storage handled, no credentials PASS");
