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
assert.match(hub,/changeCollectionMode\("tiles"\)/);
assert.match(hub,/changeCollectionMode\("list"\)/);
assert.match(hub,/collectionBoards\.map\(boardTile\)/);
assert.match(styles,/\.lektrus-collection-gallery\.is-list/);
assert.match(styles,/@media\(max-width:700px\)/);
assert.match(styles,/\.lectris-hub-hero-compact/,"compact home must remain");
assert.match(app,/saveRemoteBoardDocument/,"board save must remain present");
console.log("Lektrus UI: correct visible brand, searchable categories, gallery modes and responsive styles.");
