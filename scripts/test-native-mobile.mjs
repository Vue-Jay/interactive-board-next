import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { regionDisplayNames } from "../src/regionDisplayNames.ts";

const read = name => readFileSync(new URL("../" + name, import.meta.url), "utf8");
const pkg = JSON.parse(read("package.json"));
const config = read("capacitor.config.ts");
const entry = read("src/main.tsx");
const appEntry = read("src/appEntry.tsx");
const backend = read("src/backend.ts");
const workflow = read(".github/workflows/native-build.yml");
const runtimeWorkflow = read(".github/workflows/mobile-native-runtime-qa.yml");
const androidVersions = read("android/variables.gradle");
const minApi = Number(androidVersions.match(/minSdkVersion\s*=\s*(\d+)/)?.[1]);
const targetApi = Number(androidVersions.match(/targetSdkVersion\s*=\s*(\d+)/)?.[1]);
const fullApiMatrix = runtimeWorkflow.match(/api:\s*[^\n]+\|\|\s*'(\[\d+(?:,\d+)*\])'/)?.[1];
assert.ok(Number.isInteger(minApi)&&Number.isInteger(targetApi)&&fullApiMatrix,"Missing full Android QA compatibility matrix");
assert.deepEqual(JSON.parse(fullApiMatrix),Array.from({length:targetApi-minApi+1},(_,i)=>minApi+i),"QA must exercise every supported Android API");
assert.match(runtimeWorkflow,/needs: android-build/);
assert.match(runtimeWorkflow,/sha256sum -c app-debug\.apk\.sha256/);

for (const name of ["@capacitor/core","@capacitor/android","@capacitor/ios"]) {
  assert.ok(pkg.dependencies[name], "Missing mobile runtime: " + name);
}
assert.ok(pkg.devDependencies["@capacitor/cli"]);
assert.match(config, /appId:\s*"ru\.lektrus\.board"/);
assert.match(config, /webDir:\s*"dist"/);
assert.match(config, /SystemBars:\s*\{\s*insetsHandling:\s*"disable"/);
assert.doesNotMatch(config, /server:\s*\{\s*url:/);
assert.match(entry, /!Capacitor\.isNativePlatform\(\)/);
assert.match(backend, /getEmailConfirmationRedirect/);
assert.match(backend, /VITE_AUTH_REDIRECT_URL/);
assert.match(backend, /saveNativeBackendConnection/);
assert.match(backend, /NATIVE_BACKEND_KEY/);
assert.match(appEntry, /NativeConnectionSetup/);
assert.match(read("src/SettingsScreen.tsx"), /clearNativeBackendConnection/);
assert.doesNotMatch(workflow, /:app:assembleDebug/);
assert.match(workflow, /:app:assembleRelease/);
assert.match(workflow, /LEKTRUS_SIGNING_STORE_BASE64/);
assert.match(workflow, /LEKTRUS_ANDROID_VERSION_CODE/);
assert.match(workflow, /npm run native:build/);
assert.match(read("scripts/build-native.mjs"), /VITE_LEKTRUS_BACKEND: offline \? '' : 'selfhost'/);
assert.match(read("vite.config.ts"), /'chrome69', 'safari15'/);
assert.match(entry, /import "\.\/nativeCompatibility"/);
// The atlas must load on stock Android 7–10 engines without Intl.DisplayNames.
const displayNames=Intl.DisplayNames;
try {
  Intl.DisplayNames=undefined;
  for(const locale of ['ru','en']){
    const expected=new displayNames([locale],{type:'region'}),actual=regionDisplayNames(locale);
    // Compare stable labels; newer ICU/CLDR releases may rename regions.
    for(const code of ['RU','JP','DE','FR','BR','CN','IN','AQ','AA']){
      assert.equal(actual.of(code),expected.of(code),`${locale}:${code}`);
    }
  }
} finally { Intl.DisplayNames=displayNames; }
const gradle = read("android/app/build.gradle");
assert.match(gradle,/LEKTRUS_ANDROID_VERSION_CODE/);
assert.match(gradle,/hasReleaseSigning/);
assert.doesNotMatch(gradle,/lektrusSideInstall/);
assert.doesNotMatch(gradle,/ru\.lektrus\.board\.fresh/);
assert.doesNotMatch(workflow,/Lektrus-Android-Fresh-Install/);
assert.doesNotMatch(workflow,/-PlektrusSideInstall/);
assert.match(workflow, /CODE_SIGNING_ALLOWED=NO build/);
assert.match(workflow, /upload-artifact@v4/);
const app = read("src/App.tsx");
const boardApp = read("src/BoardApp.tsx");
const settings = read("src/SettingsScreen.tsx");
const activity = read("android/app/src/main/java/ru/lektrus/board/MainActivity.java");
const androidManifest = read("android/app/src/main/AndroidManifest.xml");
const iosPlist = read("ios/App/App/Info.plist");
assert.ok(pkg.dependencies["@capacitor/screen-orientation"]);
assert.ok(app.includes('ScreenOrientation.lock({ orientation: "landscape-primary" })'));
assert.ok(app.includes("ScreenOrientation.unlock()"));
assert.ok(app.includes("[route.kind]"));
assert.match(app,/useLayoutEffect\(\(\) => \{[\s\S]*ScreenOrientation\.lock/);
assert.match(app,/nativeBoardOpening && !nativeLandscapeReady\) return <BoardLoadingScreen/);
const loading = read("src/BrowserBoardLandscape.tsx");
const loadingCss = read("src/lektrusBoardLoading.css");
assert.match(loading,/nativePortrait=nativeRotate&&viewport\.height>viewport\.width/);
assert.match(loading,/data-native-portrait=\{nativePortrait\|\|undefined\}/);
assert.match(loading,/style=\{nativePortrait\?\{width:viewport\.height,height:viewport\.width\}:undefined\}/);
assert.match(loading,/window\.visualViewport\?\.addEventListener\("resize",update\)/);
assert.match(loadingCss,/\.lektrus-board-loading\[data-native-portrait=true\]\{[^}]*rotate\(90deg\)/);
assert.doesNotMatch(loadingCss,/\.lektrus-board-loading\[data-native-rotate=true\]/);
assert.match(loadingCss,/\.lektrus-board-loading\[data-browser-rotate=true\]/);
assert.ok(boardApp.includes("!Capacitor.isNativePlatform()&&installPrompt"));
assert.ok(settings.includes('!Capacitor.isNativePlatform()&&<section className="settings-row-card lektrus-install-settings"'));
assert.ok(activity.includes("WindowInsetsCompat.Type.tappableElement()"));
assert.ok(activity.includes("WindowInsetsCompat.Type.ime()"));
assert.ok(activity.includes("Math.max(bottom, ime.bottom)"));
assert.ok(activity.includes("WindowInsetsCompat.Type.navigationBars()"));
assert.ok(activity.includes("BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE"));
assert.ok(activity.includes("if (boardMode) controller.hide(WindowInsetsCompat.Type.statusBars())"));
assert.ok(activity.includes("else controller.show(WindowInsetsCompat.Type.statusBars())"));
assert.ok(activity.includes("Math.max(status.top, cutout.top)"));
assert.ok(activity.includes("getInsetsIgnoringVisibility(WindowInsetsCompat.Type.statusBars())"));
assert.ok(activity.includes("ViewGroup.MarginLayoutParams"));
assert.ok(activity.includes("margins.setMargins(horizontalLeft, top, horizontalRight, bottom)"));
assert.ok(activity.includes("boardMode ? 0 : Math.max(cutout.left, systemLeft)"));
assert.ok(activity.includes("boardMode ? 0 : Math.max(cutout.right, systemRight)"));
assert.ok(activity.includes("Math.max(navigation.left, tappable.left)"));
assert.ok(activity.includes("Math.max(navigation.right, tappable.right)"));
for (const edge of ["left", "right", "top"]) assert.ok(activity.includes(`--lektrus-system-${edge}`));
assert.ok(boardApp.includes('aria-label="Рука — перемещать доску одним пальцем"'));
assert.ok(boardApp.includes('e.pointerType==="touch" && tool==="hand"'));
assert.ok(boardApp.includes('mode:"pan",start,view'));
assert.ok(read("src/lectrisBoard.css").includes("left:max(16px, env(safe-area-inset-left"));
assert.ok(app.includes("enabled: route.kind === \"board\""));
assert.ok(read("android/app/src/main/java/ru/lektrus/board/LektrusSystemUiPlugin.java").includes('name = "LektrusSystemUi"'));
assert.ok(activity.includes("lektrus:native-back"));
assert.ok(app.includes('window.addEventListener("lektrus:native-back"'));
assert.ok(androidManifest.includes('android:enableOnBackInvokedCallback="false"'));
assert.ok(androidManifest.includes('android:host="join"'));
assert.ok(androidManifest.includes('android:host="board"'));
assert.match(boardApp,/lektrus:board-native-back/);
assert.ok(activity.includes("WindowInsetsCompat.Type.displayCutout()"));
assert.ok(activity.includes("view.setPadding(0, 0, 0, 0)"));
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

assert.match(workflow,/Require persistent Android signing credentials/);
assert.match(workflow,/APK_SIGNER/);
assert.match(workflow,/verify --verbose --print-certs/);
assert.match(workflow,/Lektrus-Android-Update-APK/);
assert.match(gradle,/A stable keystore is required for APK updates/);
