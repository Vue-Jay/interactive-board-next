import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const app = readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8");
const preview = readFileSync(new URL("../src/boardPreview.ts", import.meta.url), "utf8");
const saveStart = app.indexOf("const pushRemoteSnapshot = useCallback(");
const saveEnd = app.indexOf("const flushSave = useCallback(", saveStart);
assert.ok(saveStart >= 0 && saveEnd > saveStart);
const save = app.slice(saveStart, saveEnd);

// The board RPC must happen BEFORE the preview is queued, with no rendering await.
assert.equal(save.includes("await renderBoardPreview("), false);
assert.ok(save.includes("await ensureBoardAssets("));
assert.ok(save.includes("saveRemoteBoardDocument)("));
assert.ok(save.indexOf("setSaveStatus(\"Сохранено на сервере\")") <
  save.indexOf("scheduleBackgroundBoardPreview("));
assert.ok(save.indexOf("const payload = {...data, preview: previousPreview??\"\"}") <
  save.indexOf("await (adminMaintenance"));
assert.ok(app.includes('setSaveStatus(localBackupValid.current?"Сохранено в браузере":"Недостаточно места для локальной копии");'));
assert.ok(app.includes('if(localBackupValid.current)scheduleBackgroundBoardPreview(boardSummary.id,data,null);'));
assert.ok(app.includes('try {\n          localStorage.setItem(storageKey,serialized);'), "local storage failure must be isolated");
assert.ok(app.includes('localBackupValid.current=false;'), "quota error should be tracked");
assert.ok(app.includes('await ensureBoardAssets(boardSummary.id,{...data,items:unsyncedAssets});'),
  "only newly added assets should be verified, not downloaded on every stroke");

// Update only the JSON document metadata after rendering; preserve version and audit history.
assert.match(preview, /method:"PATCH"/);
assert.ok(preview.includes('"&version=eq."+encodeURIComponent(String(savedServerVersion))'),"thumbnail update must match the saved revision");
assert.ok(preview.includes('JSON.stringify({document:payload})'));
assert.equal(preview.includes('JSON.stringify({document:payload,version:'), false);
assert.ok(preview.includes("requestIdleCallback"));
assert.ok(preview.includes("previewTasks.get(boardId)?.token!==token"));
assert.ok(preview.includes("cacheBoardPreview(boardId,image)"));
assert.ok(app.includes("scheduleBackgroundBoardPreview(board.id,parsed,null)"),
  "opening a migrated board must not render the screenshot synchronously");
console.log("Background preview autosave regression: board save first, version-guarded idle preview and clean history OK");
