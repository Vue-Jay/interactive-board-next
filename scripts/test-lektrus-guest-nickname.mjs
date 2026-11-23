import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import ts from "typescript";
const source=readFileSync("src/guestNameCache.ts","utf8");
const code=ts.transpileModule(source,{compilerOptions:{
 target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS
}}).outputText;
const memory=new Map();
const localStorage={getItem:key=>memory.get(key)??null,setItem:(key,value)=>memory.set(key,value),removeItem:key=>memory.delete(key)};
const exports={};
new Function("exports","localStorage",code)(exports,localStorage);
const {rememberedGuestName,rememberGuestName}=exports;
assert.equal(rememberedGuestName(),"","First visitor has empty guest field");
rememberGuestName("  Анна  ");
assert.equal(rememberedGuestName(),"Анна","Nickname is saved, trimmed and prefilled");
rememberGuestName("Другой гость");
assert.equal(rememberedGuestName(),"Другой гость","Last successful guest name wins");
rememberGuestName("x");
assert.equal(rememberedGuestName(),"Другой гость","Invalid names do not override remembered name");
rememberGuestName("n".repeat(61));
assert.equal(rememberedGuestName(),"Другой гость","Long nicknames are rejected");
assert.equal(memory.size,1,"Store only nickname, not tokens or board IDs");
const store=readFileSync("src/authStore.ts","utf8");
const auth=readFileSync("src/AuthScreen.tsx","utf8");
assert.match(store,/rememberGuestName\(guestName\)/);
assert.match(auth,/useState\(rememberedGuestName\)/);
assert.match(auth,/onChange=\{e=>fieldEdited\(e\.target\.value,setGuestName\)\}/);
assert.match(store,/const result=selfhostUser\(await selfhostGuestLogin\(guestName,token,password\)\)!;/);
assert.ok(store.indexOf("rememberGuestName(guestName)")>store.indexOf("await selfhostGuestLogin(guestName,token,password)"),
"Must only remember successful guest authentication");
console.log("Guest nickname: local-only, user-editable, last successful login, bounded and no stored token: OK");
