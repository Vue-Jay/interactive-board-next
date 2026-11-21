import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";
import { inflateSync } from "node:zlib";
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
assert.deepEqual(manifest.related_applications, [{platform: "webapp", url: "https://lektrus.ru/manifest.webmanifest"}]);
assert.equal(manifest.prefer_related_applications, false);
assert.equal(manifest.id, "/app");
assert.ok(manifest.icons.some(icon => icon.src === "/lektrus-pwa-maskable-512.png" && icon.purpose === "maskable"));
assert.ok(manifest.shortcuts.every(shortcut => shortcut.icons.every(icon => icon.src === "/lektrus-pwa-icon-192.png")));
for (const size of [192, 512]) {
  const entry = manifest.icons.find(icon => icon.src === "/lektrus-pwa-icon-" + size + ".png");
  assert.ok(entry && entry.sizes === size + "x" + size && entry.type === "image/png");
  const image = readFileSync(new URL("../public/lektrus-pwa-icon-" + size + ".png", import.meta.url));
  assert.equal(image.subarray(0, 8).toString("hex"), "89504e470d0a1a0a");
  assert.equal(image.readUInt32BE(16), size);
  assert.equal(image.readUInt32BE(20), size);
}
for (const filename of ["lektrus-pwa-icon-192.png", "lektrus-pwa-icon-512.png", "lektrus-pwa-maskable-512.png"]) {
  const png = readFileSync(new URL("../public/" + filename, import.meta.url));
  assert.equal(png[24], 8, "8-bit PNG");
  assert.equal(png[25], 2, "RGB without alpha: no black launcher background");
  assert.equal(png[28], 0, "non-interlaced PNG");
  const idat = [];
  for (let offset = 8; offset + 12 <= png.length;) {
    const size = png.readUInt32BE(offset);
    if (png.toString("ascii", offset + 4, offset + 8) === "IDAT") idat.push(png.subarray(offset + 8, offset + 8 + size));
    offset += size + 12;
  }
  assert.deepEqual([...inflateSync(Buffer.concat(idat)).subarray(1, 4)], [255, 255, 255], filename + " has a white top-left pixel");
  assert.ok(sw.includes("/" + filename), "cache dedicated launcher icons");
}
assert.match(html, /rel="apple-touch-icon"[^>]+href="\/lektrus-pwa-icon-192\.png"/);
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
function browser({ua = "Android Chrome/126.0.0.0", platform = "", touch = 0, standalone = false, native = false, frame = false, stored = new Map(), local = new Map(), relatedApps} = {}) {
  const win = new EventTarget();
  win.self = win;
  win.top = frame ? {} : win;
  win.matchMedia = () => ({matches: standalone});
  win.sessionStorage = {getItem: key => stored.get(key), setItem: (key, value) => stored.set(key, value)};
  win.localStorage = {getItem: key => local.get(key), setItem: (key, value) => local.set(key, value), removeItem: key => local.delete(key)};
  return {win, stored, local, install: createPwaInstallController(win, {userAgent: ua, platform, maxTouchPoints: touch, getInstalledRelatedApps: relatedApps}, native)};
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
assert.equal(mobile.install.getSnapshot().offerVisible, false, "Chromium must not guess installation status");
const early = prompt(mobile.win);
assert.equal(early.event.defaultPrevented, true);
assert.equal(mobile.install.getSnapshot().available, true);
assert.equal(mobile.install.getSnapshot().offerVisible, true);
let updates = 0;
const unsubscribe = mobile.install.subscribe(() => updates++);
const first = mobile.install.requestInstall();
assert.equal(early.calls(), 1, "prompt must run synchronously in the click");
assert.equal(await mobile.install.requestInstall(), "unavailable");
assert.equal(await first, "accepted");
assert.equal(mobile.install.getSnapshot().installed, true);
assert.equal(mobile.install.getSnapshot().installNotice, true);
assert.equal(mobile.install.getSnapshot().offerVisible, false);
assert.equal(mobile.install.getSnapshot().available, false);
assert.ok(updates > 0);
unsubscribe();
mobile.install.dismissInstallNotice();
assert.equal(mobile.install.getSnapshot().installNotice, false);
mobile.win.dispatchEvent(new Event("appinstalled"));
assert.equal(mobile.install.getSnapshot().installNotice, false, "do not duplicate success toast");
const reopened = browser({local: mobile.local});
assert.equal(reopened.install.getSnapshot().installed, true, "remember install in a new browser session");
assert.equal(reopened.install.getSnapshot().offerVisible, false);
assert.equal(reopened.install.getSnapshot().installNotice, false, "no false success toast on reload");
assert.equal(await reopened.install.requestInstall(), "unavailable");
const uninstallPrompt = prompt(reopened.win);
assert.equal(uninstallPrompt.event.defaultPrevented, true, "new browser prompt is evidence of reinstall eligibility");
assert.equal(reopened.install.getSnapshot().installed, false);
assert.equal(reopened.install.getSnapshot().offerVisible, true);
const dismissed = browser();
const declined = prompt(dismissed.win, "dismissed");
assert.equal(await dismissed.install.requestInstall(), "dismissed");
assert.equal(declined.calls(), 1);
assert.equal(dismissed.install.getSnapshot().dismissed, true);
assert.equal(dismissed.install.getSnapshot().installNotice, false);
assert.equal(browser({stored: dismissed.stored}).install.getSnapshot().dismissed, true);
assert.equal(browser().install.getSnapshot().dismissed, false, "new browser session can offer again");
const retry = prompt(dismissed.win);
assert.equal(await dismissed.install.requestInstall(), "accepted", "settings/site button still works after dismissing offer");
assert.equal(retry.calls(), 1);
const ipad = browser({ua: "Macintosh", platform: "MacIntel", touch: 5});
assert.equal(ipad.install.getSnapshot().mobile, true);
assert.equal(await ipad.install.requestInstall(), "manual");
assert.match(ipad.install.getSnapshot().manualHelp, /На экран Домой/);
assert.equal(ipad.install.getSnapshot().installNotice, false, "manual instructions do not mean installed");
ipad.install.noteOfferShown();
const nextIpad = browser({ua: "Macintosh", platform: "MacIntel", touch: 5, local: ipad.local});
assert.equal(nextIpad.install.getSnapshot().offerVisible, false, "manual-only offer is not repeated after visit");
assert.equal(await nextIpad.install.requestInstall(), "manual", "explicit Safari install help remains available");
const firstManual = browser({ua: "iPhone"});
assert.equal(firstManual.install.getSnapshot().offerVisible, true);
firstManual.install.noteOfferShown();
assert.equal(browser({ua: "iPhone", local: firstManual.local}).install.getSnapshot().offerVisible, false);
const desktop = browser({ua: "Windows"});
assert.equal(desktop.install.getSnapshot().mobile, false);
assert.equal(await desktop.install.requestInstall(), "manual");
const broken = browser();
prompt(broken.win, "accepted", true);
assert.equal(await broken.install.requestInstall(), "manual");
assert.equal(broken.install.getSnapshot().busy, false);
assert.equal(broken.install.getSnapshot().offerVisible, true, "prompt failure retains manual fallback");
assert.equal(broken.install.getSnapshot().installNotice, false);
const externalInstall = browser();
prompt(externalInstall.win);
externalInstall.win.dispatchEvent(new Event("appinstalled"));
assert.equal(externalInstall.install.getSnapshot().installed, true);
assert.equal(externalInstall.install.getSnapshot().available, false);
assert.equal(externalInstall.install.getSnapshot().installNotice, true);
assert.equal(browser({local: externalInstall.local}).install.getSnapshot().installed, true);
const shared = browser({local: externalInstall.local});
assert.equal(shared.install.getSnapshot().offerVisible, false);
const otherTab = browser();
otherTab.win.dispatchEvent(Object.assign(new Event("storage"), {key: "lektrus.pwa-installed.v1", newValue: "1"}));
assert.equal(otherTab.install.getSnapshot().installed, true);
assert.equal(otherTab.install.getSnapshot().offerVisible, false);
const flush = () => new Promise(resolve => setImmediate(resolve));
const existing = browser({relatedApps: async () => [{platform: "webapp", url: "https://lektrus.ru/manifest.webmanifest"}]});
assert.equal(existing.install.getSnapshot().checkingInstalled, true);
assert.equal(existing.install.getSnapshot().offerVisible, false, "never flash while checking");
await flush();
assert.equal(existing.install.getSnapshot().checkingInstalled, false);
assert.equal(existing.install.getSnapshot().installed, true, "discover PWA installed before this release");
assert.equal(existing.install.getSnapshot().offerVisible, false);
assert.equal(existing.install.getSnapshot().installNotice, false);
const fresh = browser({relatedApps: async () => []});
prompt(fresh.win);
assert.equal(fresh.install.getSnapshot().offerVisible, false, "wait for detection even if prompt arrived");
await flush();
assert.equal(fresh.install.getSnapshot().offerVisible, true, "offer after negative check and native event");
const failedCheck = browser({relatedApps: async () => {throw Error("unavailable");}});
await flush();
assert.equal(failedCheck.install.getSnapshot().checkingInstalled, false);
assert.equal(failedCheck.install.getSnapshot().offerVisible, false);
prompt(failedCheck.win);
assert.equal(failedCheck.install.getSnapshot().offerVisible, true);
assert.match(read("src/PwaInstallOffer.tsx"), /if \(!state\.offerVisible\) return null/);
assert.match(read("src/PwaInstallOffer.tsx"), /Приложение установлено/);
assert.match(read("src/appEntry.tsx"), /<PwaInstallFeedback\/>/);
assert.match(read("src/LektrusSiteEntry.tsx"), /<PwaInstallFeedback\/>/);
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
