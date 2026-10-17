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
assert.match(workflow, /:app:assembleDebug/);
assert.match(workflow, /CODE_SIGNING_ALLOWED=NO build/);
assert.match(workflow, /upload-artifact@v4/);

const nativeSourcesExpected = process.env.CI === "true" || existsSync("android") || existsSync("ios");
if (nativeSourcesExpected) {
  assert.ok(existsSync("android/settings.gradle"), "Missing Android Gradle project");
  assert.ok(existsSync("ios/App/App.xcodeproj"), "Missing Xcode project");
}
console.log("Lektrus: Capacitor source projects, native packaging, and safe auth redirect verified.");
