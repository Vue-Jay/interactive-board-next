import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {createServer} from "vite";

const read=path=>readFileSync(new URL(`../${path}`,import.meta.url),"utf8");
const vite=await createServer({configFile:false,server:{middlewareMode:true},appType:"custom"});
try{
 const {parseRoute}=await vite.ssrLoadModule("/src/routes.ts");
 assert.deepEqual(parseRoute("/tools/atlas"),{kind:"tool",tool:"atlas"});
 assert.deepEqual(parseRoute("/tools/laboratory"),{kind:"tool",tool:"laboratory"});
 assert.deepEqual(parseRoute("/tools/atlas/"),{kind:"tool",tool:"atlas"});
 assert.deepEqual(parseRoute("/"),{kind:"site"});
}finally{await vite.close()}

const app=read("src/App.tsx");
const site=read("src/LektrusPublicSite.tsx");
const tools=read("src/PublicToolScreen.tsx");
assert.match(app,/const PublicToolScreen = lazy\(\(\) => import\("\.\/PublicToolScreen"\)\)/,
 "standalone tools should remain outside the initial public-site bundle");
assert.match(app,/if\(route\.kind==="tool"\)[\s\S]*?<PublicToolScreen/,
 "the standalone tool route must render before account authentication");
assert.match(app,/if \(route\.kind === "tool"\) \{ setBoardLoading\(false\); return; \}/,
 "opening a standalone tool must not trigger board loading");
assert.match(tools,/lazy\(\(\)=>import\("\.\/LektrusMapAtlas"\)\)/);
assert.match(tools,/lazy\(\(\)=>import\("\.\/LektrusChemistryBenchEditor"\)\)/);
assert.match(site,/href:"\/tools\/atlas"/);
assert.match(site,/href:"\/tools\/laboratory"/);
assert.match(site,/page==="tools"&&!copy\?\.replaceDefault/,"standalone tools require their own public site tab");
assert.match(site,/Создавать доску не требуется/,"standalone tools should be clearly explained as board-free");
assert.match(site,/marketing-standalone-tool/,"standalone catalog should offer direct links without screenshot galleries");
assert.doesNotMatch(site,/lektrus-ad-scene|lektrus-ad-draw-path|CSS animation/i,
 "the site must not advertise fabricated board activity");
console.log("Lektrus public tools: direct routes, lazy tools, standalone board-free use and no fabricated animation verified.");
