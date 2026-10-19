import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";

// Run the real TypeScript implementation with a minimal browser storage stub.
const filename = new URL("../src/inkPreferences.ts", import.meta.url);
const compiled = ts.transpileModule(readFileSync(filename, "utf8"), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
}).outputText;
const {
  readInkPreferences, writeInkPreferences, withInkSetting,
  inkPreferencesKey, normalizeInkPreferences,
} = await import("data:text/javascript;base64," + Buffer.from(compiled).toString("base64"));
const map = new Map();
globalThis.localStorage = {
  getItem: key => map.get(key) ?? null,
  setItem: (key, value) => { map.set(key, String(value)); },
  removeItem: key => { map.delete(key); },
};
const userA = "teacher-a";
const userB = "teacher-b";
const defaults = readInkPreferences(userA);
assert.equal(defaults.pen.color, "#5355c9");
assert.equal(defaults.pen.size, 3);
assert.equal(defaults.marker.size, 22);

// Changing pen must not change marker, and vice versa.
const penEdited = withInkSetting(defaults, "pen", { color: "#ff4400", size: 9 });
assert.equal(penEdited.marker.color, "#5355c9");
assert.equal(penEdited.marker.size, 22);
const bothEdited = withInkSetting(penEdited, "marker", { color: "#00aa77", size: 39 });
writeInkPreferences(userA, bothEdited);
assert.deepEqual(readInkPreferences(userA), bothEdited);
assert.deepEqual(readInkPreferences(userB), defaults, "user defaults must not leak to another login");

// A different board uses the same account preferences; there is no board id in the key.
assert.equal(inkPreferencesKey(userA), inkPreferencesKey(userA));
assert.notEqual(inkPreferencesKey(userA), inkPreferencesKey(userB));
const freshBoard = readInkPreferences(userA);
assert.equal(freshBoard.pen.size, 9);
assert.equal(freshBoard.pen.color, "#ff4400");
assert.equal(freshBoard.marker.size, 39);
assert.equal(freshBoard.marker.color, "#00aa77");

// Reject malformed or unbounded stored values, including malicious colors.
map.set(inkPreferencesKey(userA), JSON.stringify({
  pen: { color: "red;url(fake)", size: 9999 },
  marker: { color: "#123abc", size: -50 },
}));
const safe = readInkPreferences(userA);
assert.deepEqual(safe.pen, { color: "#5355c9", size: 16 });
assert.deepEqual(safe.marker, { color: "#123abc", size: 1 });
assert.equal(withInkSetting(defaults,"pen",{size:.5}).pen.size,.5);
assert.deepEqual(normalizeInkPreferences(null), defaults);
map.set(inkPreferencesKey(userA), "{bad JSON");
assert.deepEqual(readInkPreferences(userA), defaults);

// Storage restrictions must not crash drawing.
globalThis.localStorage.setItem = () => { throw new Error("QuotaExceeded"); };
assert.doesNotThrow(() => writeInkPreferences(userA, bothEdited));
console.log("Lectris ink preferences: independent tools, reload, boards, accounts and validation OK");
