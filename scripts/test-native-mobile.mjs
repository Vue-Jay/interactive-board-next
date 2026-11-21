import assert from "node:assert/strict";
import { X509Certificate } from "node:crypto";
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
const nativeQA = read("scripts/test-native-mobile-runtime.py");
assert.match(nativeQA,/def recover_android_system_anr\(\)/);
assert.match(nativeQA,/System UI\/Quickstep ANR/);
assert.match(nativeQA,/Retrying real native create tap after external Android System UI ANR/);
assert.match(nativeQA,/Retrying actual two-finger OS gesture/);
assert.match(nativeQA,/range\(2 if args\.platform=='android' else 1\)/);
assert.doesNotMatch(nativeQA,/dispatchEvent\(new (PointerEvent|TouchEvent)/);
const app = read("src/App.tsx");
const boardApp = read("src/BoardApp.tsx");
const settings = read("src/SettingsScreen.tsx");
const activity = read("android/app/src/main/java/ru/lektrus/board/MainActivity.java");
const androidManifest = read("android/app/src/main/AndroidManifest.xml");
const networkSecurity=read("android/app/src/main/res/xml/network_security_config.xml");
assert.match(androidManifest,/android:networkSecurityConfig="@xml\/network_security_config"/);
assert.match(networkSecurity,/<base-config cleartextTrafficPermitted="false">\s*<trust-anchors>\s*<certificates src="system"\s*\/>/);
assert.match(networkSecurity,/<domain-config cleartextTrafficPermitted="false">\s*<domain includeSubdomains="false">lektrus\.ru<\/domain>\s*<trust-anchors>\s*<certificates src="system"\s*\/>\s*<certificates src="@raw\/lektrus_isrg_roots"\s*\/>/);
assert.doesNotMatch(networkSecurity,/cleartextTrafficPermitted="true"|src="user"|debug-overrides|overridePins/);
const caRoots=read("android/app/src/main/res/raw/lektrus_isrg_roots.pem").match(/-----BEGIN CERTIFICATE-----[\s\S]+?-----END CERTIFICATE-----/g).map(pem=>new X509Certificate(pem));
assert.deepEqual(caRoots.map(c=>c.fingerprint256),[
  "96:BC:EC:06:26:49:76:F3:74:60:77:9A:CF:28:C5:A7:CF:E8:A3:C0:AA:E1:1A:8F:FC:EE:05:C0:BD:DF:08:C6",
  "69:72:9B:8E:15:A8:6E:FC:17:7A:57:AF:B7:17:1D:FC:64:AD:D2:8C:2F:CA:8C:F1:50:7E:34:45:3C:CB:14:70",
]);
assert.ok(caRoots.every(c=>c.ca&&c.subject===c.issuer&&c.verify(c.publicKey)),"Only the official self-signed public ISRG CA roots are allowed");
const iosPlist = read("ios/App/App/Info.plist");
assert.ok(pkg.dependencies["@capacitor/screen-orientation"]);
// The route policy applies even with device rotation enabled. A pending
// authenticated board URL must never turn the sign-in form sideways.
assert.ok(app.includes('ScreenOrientation.lock({ orientation: board ? "landscape-primary" : "portrait-primary" })'));
assert.doesNotMatch(app,/ScreenOrientation\.unlock\(/);
assert.match(app,/authenticatedBoardRoute = authReady && !!authUser && route.kind === "board"/);
assert.match(app,/void lockNativeOrientation\(false\)/);
assert.match(app,/void lockNativeOrientation\(true\)/);
assert.match(androidManifest,/android:screenOrientation="portrait"/);
assert.match(activity,/if \(!boardMode\) \{[\s\S]*setRequestedOrientation\(ActivityInfo\.SCREEN_ORIENTATION_PORTRAIT\)/);
assert.match(activity,/boardMode = enabled;[\s\S]*restoreRouteOrientation\(\)/);
assert.match(read("ios/App/App/LektrusFilesPlugin.swift"),/override func setScreenOrientationDefaults\(\) \{[\s\S]*supportedOrientations = \[UIInterfaceOrientation\.portrait\.rawValue\]/);
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
assert.ok(app.includes("LektrusSystemUi.setBoardMode({enabled: board})"));
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
// Standalone APK viewers may only decode raster application icons, while the
// installed launcher's activity continues to use the adaptive mipmap.
const apkIcon = readFileSync(new URL("../android/app/src/main/res/drawable-nodpi/lektrus_apk_icon.png", import.meta.url));
assert.ok(apkIcon.equals(sourceIcon), "APK file icon must be the original Lektrus artwork");
assert.match(androidManifest, /<application\b[^>]*android:icon="@drawable\/lektrus_apk_icon"[^>]*android:roundIcon="@drawable\/lektrus_apk_icon"/);
assert.match(androidManifest, /<activity\b[^>]*android:name="\.MainActivity"[^>]*android:icon="@mipmap\/ic_launcher"/);
assert.match(read("android/app/src/main/res/mipmap-anydpi-v26/ic_launcher.xml"), /<adaptive-icon\b/);
assert.match(read(".github/workflows/refresh-brand-icons.yml"), /cp assets\/lektrus-brand-source\.png android\/app\/src\/main\/res\/drawable-nodpi\/lektrus_apk_icon\.png/);
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
