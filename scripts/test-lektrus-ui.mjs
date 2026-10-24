import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read=(name)=>readFileSync(new URL("../"+name,import.meta.url),"utf8");
const shell=read("src/LectrisWorkspaceShell.tsx");
const hub=read("src/LectrisHub.tsx");
const styles=read("src/lektrusRefresh.css");
const html=read("index.html");
const auth=read("src/AuthScreen.tsx");
const app=read("src/App.tsx");
const settings=read("src/SettingsScreen.tsx");
const manifest=JSON.parse(read("public/manifest.webmanifest"));

assert.match(shell, />Lektrus<\/strong>/);
assert.match(auth, />Lektrus<\/div>/);
assert.match(html, /<title>Lektrus/);
assert.equal(manifest.short_name,"Lektrus");
for(const [name,body] of Object.entries({shell,hub,auth,app,settings,html})){
  assert.equal(/Lectris(?![A-Za-z0-9_])/.test(body),false,name+" includes old user-facing name");
}
assert.match(hub,/aria-label="Поиск по разделам"/);
assert.match(hub,/className="lektrus-category-strip"/);
assert.match(hub,/collectionSearch/);
assert.match(hub,/collectionMode/);
assert.match(hub,/visibleHomeBoards\.map\(boardTile\)/);
assert.match(hub,/lektrus-calendar-grid/);
assert.match(hub,/lektrus-group-list/);
assert.match(styles,/\.lektrus-collection-gallery\.is-list/);
assert.match(styles,/@media\(max-width:700px\)/);
assert.match(read("src/lectrisV3.css"),/\.lectris-hub-hero-compact/,"compact home must remain");
assert.match(app,/saveRemoteBoardDocument/,"board save must remain present");
// A mobile soft keyboard must not move/remount or blur login inputs when the
// user clears their email/password or touches a field for the first time.
const mobileAuth=read("src/lektrusMobileDialogs.css");
assert.match(mobileAuth,/\.auth-shell\s*\{\s*display:flex;/,
  "On mobile the auth form must be top-anchored, not centered in a resizing 100dvh grid");
assert.match(mobileAuth,/min-height:100svh/,
  "Authentication screen must not rely on the keyboard-driven dynamic viewport height");
assert.match(mobileAuth,/\.auth-field input\s*\{\s*font-size:16px;/,
  "16px inputs prevent mobile Safari from zooming on initial keyboard focus");
assert.match(auth,/onFocus=\{fieldFocused\} onBlur=\{fieldBlurred\}/);
assert.match(auth,/onChange=\{e=>fieldEdited\(e\.target\.value,setEmail\)\}/);
assert.match(auth,/onChange=\{e=>fieldEdited\(e\.target\.value,setPassword\)\}/);
assert.match(auth,/if\(event\.relatedTarget\)return;/,
  "Moving intentionally between fields must never steal back focus");
assert.match(auth,/active!==target/,
  "Touching a different login field is not accidental blur");
assert.match(auth,/document\.activeElement!==document\.body/,
  "Only restore focus when another control has not taken it");
assert.match(auth,/input\.focus\(\{preventScroll:true\}\)/);
assert.ok(!auth.includes('key={email}')&&!auth.includes('key={password}'),
  "Field DOM nodes must stay mounted when their values are cleared");

console.log("Lektrus UI: correct visible brand, searchable categories, gallery modes and responsive styles.");
