import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";
const read = path => readFileSync(new URL("../" + path, import.meta.url), "utf8");
const sw = read("public/sw.js");
const main = read("src/registerServiceWorker.ts");
assert.match(read("src/appEntry.tsx"),/registerLektrusServiceWorker\(\)/);
assert.match(read("src/LektrusSiteEntry.tsx"),/registerLektrusServiceWorker\(\)/);
const app = read("src/App.tsx")+"\n"+read("src/appEntry.tsx")+"\n"+main;
const settings = read("src/SettingsScreen.tsx");
const manifest = JSON.parse(read("public/manifest.webmanifest"));
const html = read("index.html");
assert.equal(manifest.name, "Lektrus — интерактивная доска");
assert.equal(manifest.display, "standalone");
assert.equal(manifest.scope, "/");
assert.equal(manifest.start_url.startsWith("/"), true);
assert.ok(manifest.icons.some(icon => icon.purpose.includes("maskable")));
for (const size of [192, 512]) {
  const entry = manifest.icons.find(icon => icon.src === "/lektrus-icon-" + size + ".png");
  assert.ok(entry && entry.sizes === size + "x" + size && entry.type === "image/png");
  const image = readFileSync(new URL("../public/lektrus-icon-" + size + ".png", import.meta.url));
  assert.equal(image.subarray(0, 8).toString("hex"), "89504e470d0a1a0a");
  assert.equal(image.readUInt32BE(16), size);
  assert.equal(image.readUInt32BE(20), size);
}
assert.match(html, /viewport-fit=cover/);
assert.match(main, /import.meta.env.PROD/);
assert.match(main, /serviceWorker.register\("\/sw.js"/);
assert.match(main, /or-sw-update/);
assert.doesNotMatch(main, /clearLegacyAppShell|registrations\.map\(.*unregister/);
assert.match(app, /lektrus:apply-update/);
assert.match(read("src/main.tsx"), /import "\.\/pwaInstall"/);
assert.match(app, /route\.kind\s*===\s*"home"[^\n]*<PwaInstallOffer\/>/);
assert.match(settings, /<PwaInstallButton label="Установить"\/>/);
assert.match(read("src/LektrusPublicSite.tsx"), /<PwaInstallButton[^>]*label="Установить веб-приложение"/);
assert.doesNotMatch(app + read("src/BoardApp.tsx"), /addEventListener\("beforeinstallprompt"/);
const compiled = ts.transpileModule(read("src/pwaInstallController.ts"), {
  compilerOptions: {module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022}
}).outputText;
const {createPwaInstallController} = await import("data:text/javascript;base64," + Buffer.from(compiled).toString("base64"));
function browser({ua = "Android", platform = "", touch = 0, standalone = false, native = false, frame = false, stored = new Map()} = {}) {
  const win = new EventTarget();
  win.self = win;
  win.top = frame ? {} : win;
  win.matchMedia = () => ({matches: standalone});
  win.sessionStorage = {getItem: key => stored.get(key), setItem: (key, value) => stored.set(key, value)};
  return {win, stored, install: createPwaInstallController(win, {userAgent: ua, platform, maxTouchPoints: touch}, native)};
}
function prompt(win, outcome = "accepted", fail = false) {
  let calls = 0;
  const event = Object.assign(new Event("beforeinstallprompt", {cancelable: true}), {
    prompt: async () => {calls++; if (fail) throw Error("prompt unavailable");},
    userChoice: Promise.resolve({outcome})
  });
  win.dispatchEvent(event);
  return {event, calls: () => calls};
}
// Early delivery before React subscribes; every surface sees one shared event.
const mobile = browser();
assert.equal(mobile.install.getSnapshot().mobile, true);
assert.equal(mobile.install.getSnapshot().dismissed, false);
const early = prompt(mobile.win);
assert.equal(early.event.defaultPrevented, true);
assert.equal(mobile.install.getSnapshot().available, true);
let updates = 0;
const unsubscribe = mobile.install.subscribe(() => updates++);
const first = mobile.install.requestInstall();
assert.equal(early.calls(), 1, "prompt must run synchronously in the click");
assert.equal(await mobile.install.requestInstall(), "unavailable");
assert.equal(await first, "accepted");
assert.equal(mobile.install.getSnapshot().installed, true);
assert.equal(mobile.install.getSnapshot().available, false);
assert.ok(updates > 0);
unsubscribe();
const dismissed = browser();
const declined = prompt(dismissed.win, "dismissed");
assert.equal(await dismissed.install.requestInstall(), "dismissed");
assert.equal(declined.calls(), 1);
assert.equal(dismissed.install.getSnapshot().dismissed, true);
assert.equal(browser({stored: dismissed.stored}).install.getSnapshot().dismissed, true);
assert.equal(browser().install.getSnapshot().dismissed, false, "new browser session can offer again");
const retry = prompt(dismissed.win);
assert.equal(await dismissed.install.requestInstall(), "accepted", "settings/site button still works after dismissing offer");
assert.equal(retry.calls(), 1);
const ipad = browser({ua: "Macintosh", platform: "MacIntel", touch: 5});
assert.equal(ipad.install.getSnapshot().mobile, true);
assert.equal(await ipad.install.requestInstall(), "manual");
assert.match(ipad.install.getSnapshot().manualHelp, /На экран Домой/);
const desktop = browser({ua: "Windows"});
assert.equal(desktop.install.getSnapshot().mobile, false);
assert.equal(await desktop.install.requestInstall(), "manual");
const broken = browser();
prompt(broken.win, "accepted", true);
assert.equal(await broken.install.requestInstall(), "manual");
assert.equal(broken.install.getSnapshot().busy, false);
const externalInstall = browser();
prompt(externalInstall.win);
externalInstall.win.dispatchEvent(new Event("appinstalled"));
assert.equal(externalInstall.install.getSnapshot().installed, true);
assert.equal(externalInstall.install.getSnapshot().available, false);
for (const excluded of [browser({native: true}), browser({standalone: true}), browser({frame: true})]) {
  assert.equal(prompt(excluded.win).event.defaultPrevented, false);
  assert.equal(await excluded.install.requestInstall(), "unavailable");
}
assert.match(sw, /request\.method !== "GET"/);
assert.match(sw, /url\.origin !== self\.location\.origin/);
assert.match(sw, /request\.mode === "navigate"/);
assert.match(sw, /url\.pathname\.startsWith\("\/assets\/"/);
assert.match(sw, /SKIP_WAITING/);
assert.doesNotMatch(sw, /\.unregister\(/);
// Realtime, Supabase, private board/media endpoints must remain network-only.
assert.doesNotMatch(sw, /supabase|board_documents|\/rest\/v1|\/auth\/v1|cache\.put\(request.*navigate/);
console.log("Lektrus PWA: safe app-shell caching, platform installation and update handshake OK.");
