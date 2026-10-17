import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

const read = name => readFileSync(new URL("../" + name, import.meta.url), "utf8");
const pkg = JSON.parse(read("package.json"));
const config = read("capacitor.config.ts");
const entry = read("src/main.tsx");
const backend = read("src/backend.ts");
const workflow = read(".github/workflows/native-build.yml");

for (const name of ["@capacitor/core","@capacitor/android","@capacitor/ios"]) {
  assert.ok(pkg.dependencies[name], "Missing mobile runtime: " + name);
}
assert.ok(pkg.devDependencies["@capacitor/cli"]);
assert.match(config, /appId:\s*"ru\.lektrus\.board"/);
assert.match(config, /webDir:\s*"dist"/);
assert.doesNotMatch(config, /server:\s*\{\s*url:/);
assert.match(entry, /!Capacitor\.isNativePlatform\(\)/);
assert.match(backend, /getEmailConfirmationRedirect/);
assert.match(backend, /VITE_AUTH_REDIRECT_URL/);
assert.match(backend, /saveNativeBackendConnection/);
assert.match(backend, /NATIVE_BACKEND_KEY/);
assert.match(entry, /NativeConnectionSetup/);
assert.match(read("src/SettingsScreen.tsx"), /clearNativeBackendConnection/);
assert.match(workflow, /:app:assembleDebug/);
assert.match(workflow, /CODE_SIGNING_ALLOWED=NO build/);
assert.match(workflow, /upload-artifact@v4/);
const app = read("src/App.tsx");
const settings = read("src/SettingsScreen.tsx");
const activity = read("android/app/src/main/java/ru/lektrus/board/MainActivity.java");
const androidManifest = read("android/app/src/main/AndroidManifest.xml");
const iosPlist = read("ios/App/App/Info.plist");
assert.ok(pkg.dependencies["@capacitor/screen-orientation"]);
assert.ok(app.includes('ScreenOrientation.lock({ orientation: "landscape-primary" })'));
assert.ok(app.includes("ScreenOrientation.unlock()"));
assert.ok(app.includes("[route.kind]"));
assert.ok(app.includes("!Capacitor.isNativePlatform()&&installPrompt"));
assert.ok(settings.includes('!Capacitor.isNativePlatform()&&<section className="settings-row-card lektrus-install-settings"'));
assert.ok(activity.includes("WindowInsetsCompat.Type.tappableElement()"));
assert.ok(activity.includes("WindowInsetsCompat.Type.navigationBars()"));
assert.ok(activity.includes("BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE"));
assert.ok(activity.includes("bars.hide(WindowInsetsCompat.Type.statusBars())"));
assert.ok(activity.includes("lektrus:native-back"));
assert.ok(app.includes('window.addEventListener("lektrus:native-back"'));
assert.ok(androidManifest.includes('android:enableOnBackInvokedCallback="false"'));
assert.ok(activity.includes("WindowInsetsCompat.Type.displayCutout()"));
assert.ok(activity.includes("view.setPadding(cutout.left, cutout.top,"));
assert.ok(read("src/lektrusPlatform.css").includes("html.lektrus-android-app"));
assert.ok(androidManifest.includes('android:windowSoftInputMode="adjustResize"'));
assert.ok(iosPlist.includes("UIRequiresFullScreen"));
const icon192 = readFileSync(new URL("../public/lektrus-icon-192.png", import.meta.url));
const sourceIcon = readFileSync(new URL("../assets/lektrus-brand-source.png", import.meta.url));
const icon512 = readFileSync(new URL("../public/lektrus-icon-512.png", import.meta.url));
const nativeSource = readFileSync(new URL("../assets/icon.png", import.meta.url));
assert.ok(icon192.equals(sourceIcon), "192px icon must use the supplied Lektrus artwork");
for (const [data, size] of [[icon192,192],[icon512,512],[nativeSource,1024]]) {
  assert.equal(data.subarray(0,8).toString("hex"),"89504e470d0a1a0a");
  assert.equal(data.readUInt32BE(16),size);
  assert.equal(data.readUInt32BE(20),size);
}
assert.ok(icon512.length>10000,"A real rendered icon must be committed");
assert.ok(read("src/LectrisWorkspaceShell.tsx").includes('src="/lektrus-icon-192.png"'));



const nativeSourcesExpected = process.env.CI === "true" || existsSync("android") || existsSync("ios");
if (nativeSourcesExpected) {
  assert.ok(existsSync("android/settings.gradle"), "Missing Android Gradle project");
  assert.ok(existsSync("ios/App/App.xcodeproj"), "Missing Xcode project");
}
console.log("Lektrus: Capacitor source projects, native packaging, and safe auth redirect verified.");
