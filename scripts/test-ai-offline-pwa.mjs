import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import net from "node:net";
import { setTimeout as delay } from "node:timers/promises";

const chromePath = process.env.CHROME_PATH ?? [
  process.env.PROGRAMFILES && path.join(process.env.PROGRAMFILES, "Google/Chrome/Application/chrome.exe"),
  process.env["PROGRAMFILES(X86)"] && path.join(process.env["PROGRAMFILES(X86)"], "Google/Chrome/Application/chrome.exe"),
  process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, "Google/Chrome/Application/chrome.exe"),
].filter(Boolean).find(candidate => process.platform === "win32");
if (!chromePath) throw new Error("Не найден Chrome. Укажите путь через CHROME_PATH.");

const vite = path.resolve("node_modules/vite/bin/vite.js");
const preview = spawn(process.execPath, [vite, "preview", "--host", "127.0.0.1", "--port", "0"], {
  stdio: ["ignore", "pipe", "pipe"], windowsHide: true,
});
let previewOutput = "";
preview.stdout.on("data", chunk => { previewOutput += chunk.toString(); });
preview.stderr.on("data", chunk => { previewOutput += chunk.toString(); });
const previewExited = new Promise(resolve => preview.once("exit", resolve));
let baseUrl;
const previewDeadline = Date.now() + 20_000;
while (!baseUrl && Date.now() < previewDeadline) {
  const match = previewOutput.match(/Local:\s+(https?:\/\/[^\s]+)/);
  if (match) baseUrl = match[1].replace(/\/$/, "");
  else await delay(100);
}
if (!baseUrl) {
  preview.kill();
  await Promise.race([previewExited, delay(2_000)]);
  throw new Error(`Vite preview не запустился: ${previewOutput}`);
}

const portServer = net.createServer();
await new Promise((resolve, reject) => portServer.once("error", reject).listen(0, "127.0.0.1", resolve));
const debugPort = portServer.address().port;
await new Promise(resolve => portServer.close(resolve));
const profile = await mkdtemp(path.join(tmpdir(), "lektrus-ai-offline-pwa-"));
const boardUrl = `${baseUrl}/demo/board`;
const chrome = spawn(chromePath, [
  "--headless=new", "--disable-gpu", "--no-first-run", "--no-default-browser-check",
  "--disable-extensions", "--remote-allow-origins=*", `--remote-debugging-port=${debugPort}`,
  `--user-data-dir=${profile}`, "--window-size=1440,1000", boardUrl,
], { stdio: "ignore", windowsHide: true });
const chromeExited = new Promise(resolve => chrome.once("exit", resolve));

class DevTools {
  nextId = 0;
  pending = new Map();
  constructor(url) {
    this.socket = new WebSocket(url);
    this.socket.addEventListener("message", event => {
      const message = JSON.parse(event.data);
      if (!message.id) return;
      const callbacks = this.pending.get(message.id);
      if (!callbacks) return;
      this.pending.delete(message.id);
      if (message.error) callbacks.reject(new Error(message.error.message));
      else callbacks.resolve(message.result);
    });
  }
  ready() {
    return new Promise((resolve, reject) => {
      this.socket.addEventListener("open", resolve, { once: true });
      this.socket.addEventListener("error", reject, { once: true });
    });
  }
  call(method, params = {}) {
    const id = ++this.nextId;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }
  async evaluate(expression) {
    const result = await this.call("Runtime.evaluate", {
      expression, awaitPromise: true, returnByValue: true, userGesture: true,
    });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.text ?? "Browser evaluation failed");
    return result.result?.value;
  }
  close() { this.socket.close(); }
}

let devtools;
try {
  let page;
  const deadline = Date.now() + 30_000;
  while (!page && Date.now() < deadline) {
    try {
      const targets = await fetch(`http://127.0.0.1:${debugPort}/json/list`).then(result => result.json());
      page = targets.find(target => target.type === "page" && target.url.startsWith(baseUrl));
    } catch { /* Chrome is still starting. */ }
    if (!page) await delay(150);
  }
  assert.ok(page, "Chrome не открыл гостевую доску");
  devtools = new DevTools(page.webSocketDebuggerUrl);
  await devtools.ready();
  await devtools.call("Page.enable");
  await devtools.call("Runtime.enable");
  await devtools.call("Network.enable");

  const waitFor = async (expression, message, timeout = 20_000) => {
    const until = Date.now() + timeout;
    while (Date.now() < until) {
      const result = await devtools.evaluate(expression);
      if (result) return result;
      await delay(100);
    }
    const diagnostics = await devtools.evaluate(`(async () => ({ secure: window.isSecureContext, sw: 'serviceWorker' in navigator, url: location.href, registrations: await navigator.serviceWorker.getRegistrations().then(registrations => registrations.map(registration => ({ scope: registration.scope, active: registration.active?.state, installing: registration.installing?.state, waiting: registration.waiting?.state }))) }))()`).catch(error => ({ error: String(error) }));
    throw new Error(`${message}: ${JSON.stringify(diagnostics)}`);
  };
  const waitForBoard = () => waitFor(
    `document.readyState === "complete" && !!document.querySelector('button[aria-label="AI-помощник по доске"]')`,
    "Гостевая доска не загрузилась",
  );
  await waitForBoard();
  await waitFor(
    `navigator.serviceWorker?.getRegistrations().then(registrations => registrations.some(registration => registration.active?.state === 'activated'))`,
    "Service worker не активировался",
  );

  // Reload once online so the active worker caches all versioned application assets.
  const warmedUrl = `${boardUrl}?offlinePwa=online-warm`;
  await devtools.call("Page.navigate", { url: warmedUrl });
  await waitFor(`location.href === ${JSON.stringify(warmedUrl)} && document.readyState === 'complete' && !!document.querySelector('button[aria-label="AI-помощник по доске"]')`, "Доска не завершила контрольную онлайн-навигацию");
  await waitFor(`!!navigator.serviceWorker?.controller`, "Доска после онлайн-перезагрузки не контролируется service worker");

  await devtools.evaluate(`document.querySelector('button[aria-label="AI-помощник по доске"]').click()`);
  await waitFor(`!!document.querySelector('.board-ai-panel input[aria-label="Команда для помощника"]')`, "Панель ИИ не открылась онлайн");
  const prompt = "Создай 1 задание по математике на тему площадь круга";
  await devtools.evaluate(`(() => {
    const input = document.querySelector('.board-ai-panel input[aria-label="Команда для помощника"]');
    const value = ${JSON.stringify(prompt)};
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, value);
    input.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: value }));
    input.closest('form').requestSubmit();
  })()`);
  await waitFor(
    `(() => { const messages = [...document.querySelectorAll('.board-ai-chat-message.assistant p')]; return messages.at(-1)?.textContent?.includes('Создал на доске 1') && !document.querySelector('.board-ai-chat-pending'); })()`,
    "ИИ не завершил контрольную генерацию при подключённой сети",
    30_000,
  );
  const modelCached = await devtools.evaluate(`Object.keys(localStorage).some(key => key.startsWith('lectrus.ai.subject-model.'))`);
  assert.equal(modelCached, true, "Модель предметов не сохранилась в локальном кэше");

  await devtools.call("Network.emulateNetworkConditions", {
    offline: true, latency: 0, downloadThroughput: 0, uploadThroughput: 0,
  });
  const offlineUrl = `${boardUrl}?offlinePwa=offline-reopen`;
  await devtools.call("Page.navigate", { url: offlineUrl });
  await waitFor(`location.href === ${JSON.stringify(offlineUrl)} && document.readyState === 'complete' && !!document.querySelector('button[aria-label="AI-помощник по доске"]')`, "Доска не завершила офлайн-навигацию");
  await waitFor(`navigator.onLine === false && !!navigator.serviceWorker?.controller`, "Страница не открылась под офлайн-контролем service worker");
  const offlineAppState = await devtools.evaluate(`({
    online: navigator.onLine,
    serviceWorkerControlled: !!navigator.serviceWorker?.controller,
    boardVisible: !!document.querySelector('[data-board-canvas], .board-canvas, canvas'),
    assistantAvailable: !!document.querySelector('button[aria-label="AI-помощник по доске"]'),
    cachedModel: Object.keys(localStorage).some(key => key.startsWith('lectrus.ai.subject-model.'))
  })`);
  assert.equal(offlineAppState.online, false);
  assert.equal(offlineAppState.serviceWorkerControlled, true);
  assert.equal(offlineAppState.assistantAvailable, true);
  assert.equal(offlineAppState.cachedModel, true);

  await devtools.call("Emulation.setDeviceMetricsOverride", {
    width: 390, height: 844, deviceScaleFactor: 2, mobile: true,
  });
  await devtools.call("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 1 });
  const mobileState = await devtools.evaluate("({ width: window.innerWidth, height: window.innerHeight, dpr: window.devicePixelRatio, online: navigator.onLine, assistantAvailable: !!document.querySelector('button[aria-label=\"AI-помощник по доске\"]') })");
  assert.equal(mobileState.width, 390, "Mobile emulation must use a 390px viewport");
  assert.equal(mobileState.height, 844, "Mobile emulation must use an 844px viewport");
  assert.equal(mobileState.dpr, 2);
  assert.equal(mobileState.online, false, "Mobile emulation must remain offline");
  assert.equal(mobileState.assistantAvailable, true, "The assistant entry point must remain available on mobile");

  await devtools.evaluate(`document.querySelector('button[aria-label="AI-помощник по доске"]').click()`);
  await waitFor(`!!document.querySelector('.board-ai-panel input[aria-label="Команда для помощника"]')`, "Панель ИИ не открылась без сети");
  const mobileAssistantBounds = await devtools.evaluate(`(() => { const panel = document.querySelector('.board-ai-panel'); const rect = panel.getBoundingClientRect(); return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, width: rect.width, height: rect.height, inputVisible: !!panel.querySelector('input[aria-label="Команда для помощника"]') }; })()`);
  assert.ok(mobileAssistantBounds.left >= 0 && mobileAssistantBounds.right <= 390, `AI panel must fit the mobile viewport: ${JSON.stringify(mobileAssistantBounds)}`);
  assert.ok(mobileAssistantBounds.top >= 0 && mobileAssistantBounds.bottom <= 844, `AI panel must fit the mobile height: ${JSON.stringify(mobileAssistantBounds)}`);
  assert.equal(mobileAssistantBounds.inputVisible, true, "The assistant command field must remain visible on mobile");
  const offlinePrompts = [
    ["Создай 1 задание по математике на тему площадь круга", "Математика"],
    ["Создай 1 задание по физике на тему закон Ома", "Физика"],
    ["Создай 1 задание по химии на тему галогены", "Химия"],
    ["Создай 1 задание по химии на реакции нейтрализации", "Химия"],
    ["Создай 1 задание по русскому языку на тему Сложное предложение", "Русский язык"],
    ["Создай 1 олимпиадную задачу по математике на теорему Пифагора", "Математика"],
    ["Создай 1 олимпиадную задачу по физике на сохранение энергии для 9 класса", "Физика"],
    ["Создай 1 олимпиадную задачу по химии на окислительно-восстановительные реакции", "Химия"],
  ];
  for (const [offlinePrompt, expectedSubject] of offlinePrompts) {
    await devtools.evaluate(`(() => {
      const input = document.querySelector('.board-ai-panel input[aria-label="Команда для помощника"]');
      const value = ${JSON.stringify(offlinePrompt)};
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, value);
      input.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: value }));
      input.closest('form').requestSubmit();
    })()`);
    await waitFor(
      `(() => { const users = [...document.querySelectorAll('.board-ai-chat-message.user p')]; const answers = [...document.querySelectorAll('.board-ai-chat-message.assistant p')]; return users.at(-1)?.textContent === ${JSON.stringify(offlinePrompt)} && answers.at(-1)?.textContent?.includes('Создал на доске 1') && answers.at(-1)?.textContent?.includes(${JSON.stringify(`(${expectedSubject})`)}) && !document.querySelector('.board-ai-chat-pending'); })()`,
      `ИИ не смог создать задание по предмету «${expectedSubject}» на гостевой доске без сети`,
      30_000,
    );
  }
  console.log("AI offline PWA: production demo board reopened through service worker and generated tasks for all 4 release subjects offline from the locally cached model, including complex-sentence and olympiad challenges in math, physics and chemistry. Mobile emulation (390×844, touch) confirmed the assistant panel and input fit the viewport. No sign-in or Supabase required.");
} finally {
  try { await devtools?.call("Browser.close"); } catch { /* Chrome may already be closed. */ }
  devtools?.close();
  const browserClosed = await Promise.race([chromeExited.then(() => true), delay(5_000).then(() => false)]);
  if (!browserClosed) chrome.kill();
  preview.kill();
  await Promise.all([Promise.race([chromeExited, delay(5_000)]), Promise.race([previewExited, delay(5_000)])]);
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      await rm(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 250 });
      break;
    } catch (error) {
      if (attempt === 4) throw error;
      await delay(500);
    }
  }
}
