import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import net from "node:net";
import { setTimeout as delay } from "node:timers/promises";

const baseUrl = process.env.AI_BOARD_DEMO_URL ?? "http://127.0.0.1:5173/demo/board";
const chromePath = process.env.CHROME_PATH ?? [
  process.env.PROGRAMFILES && path.join(process.env.PROGRAMFILES, "Google/Chrome/Application/chrome.exe"),
  process.env["PROGRAMFILES(X86)"] && path.join(process.env["PROGRAMFILES(X86)"], "Google/Chrome/Application/chrome.exe"),
  process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, "Google/Chrome/Application/chrome.exe"),
].filter(Boolean).find(candidate => process.platform === "win32");
if (!chromePath) throw new Error("Не найден Chrome. Укажите путь через CHROME_PATH.");

const response = await fetch(baseUrl);
assert.equal(response.status, 200, `Демо-доска недоступна: ${baseUrl}`);
const portServer = net.createServer();
await new Promise((resolve, reject) => portServer.once("error", reject).listen(0, "127.0.0.1", resolve));
const debugPort = portServer.address().port;
await new Promise(resolve => portServer.close(resolve));
const profile = await mkdtemp(path.join(tmpdir(), "lektrus-ai-board-ui-"));
const chrome = spawn(chromePath, [
  "--headless=new", "--disable-gpu", "--no-first-run", "--no-default-browser-check",
  "--disable-extensions", "--remote-allow-origins=*", `--remote-debugging-port=${debugPort}`,
  `--user-data-dir=${profile}`, "--window-size=1440,1000", baseUrl,
], { stdio: "ignore", windowsHide: true });
const chromeExited = new Promise(resolve => chrome.once("exit", resolve));

class DevTools {
  nextId = 0;
  pending = new Map();
  onDialog = null;
  constructor(url) {
    this.socket = new WebSocket(url);
    this.socket.addEventListener("message", event => {
      const message = JSON.parse(event.data);
      if (message.method === "Page.javascriptDialogOpening") {
        const accept = this.onDialog?.() ?? false;
        void this.call("Page.handleJavaScriptDialog", { accept }).catch(() => {});
      }
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
      page = targets.find(target => target.type === "page" && target.url.startsWith(baseUrl.split("/demo/")[0]));
    } catch { /* Chrome is still starting. */ }
    if (!page) await delay(150);
  }
  assert.ok(page, "Chrome не открыл демо-доску за 30 секунд");
  devtools = new DevTools(page.webSocketDebuggerUrl);
  await devtools.ready();
  await devtools.call("Page.enable");
  await devtools.call("Runtime.enable");
  await devtools.call("Page.setLifecycleEventsEnabled", { enabled: true });
  const waitFor = async (expression, message, timeout = 15_000) => {
    const until = Date.now() + timeout;
    while (Date.now() < until) {
      const result = await devtools.evaluate(expression);
      if (result) return result;
      await delay(100);
    }
    throw new Error(message);
  };
  await waitFor(`document.readyState === "complete" && !!document.querySelector('button[aria-label="AI-помощник по доске"]')`, "Интерфейс демо-доски не загрузил помощника.");
  await devtools.evaluate(`document.querySelector('button[aria-label="AI-помощник по доске"]').click()`);
  await waitFor(`!!document.querySelector('.board-ai-panel input[aria-label="Команда для помощника"]')`, "Панель помощника не открылась.");

  let sent = 0;
  const send = async (prompt, expected, { confirm } = {}) => {
    const text = JSON.stringify(prompt);
    const ready = await devtools.evaluate(`(() => {
      const input = document.querySelector('.board-ai-panel input[aria-label="Команда для помощника"]');
      if (!input || document.querySelector('.board-ai-chat-pending')) return false;
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
      setter.call(input, ${text});
      input.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: ${text} }));
      const form = input.closest('form');
      if (!form) return false;
      window.__aiBoardDialogDecision = ${confirm === undefined ? "null" : JSON.stringify(confirm)};
      return true;
    })()`);
    assert.equal(ready, true, `Не удалось подготовить команду «${prompt}»`);
    devtools.onDialog = () => {
      const decision = devtools.dialogDecision;
      devtools.dialogDecision = null;
      return decision ?? false;
    };
    devtools.dialogDecision = confirm;
    await devtools.evaluate(`document.querySelector('.board-ai-panel input[aria-label="Команда для помощника"]').closest('form').requestSubmit()`);
    const result = await waitFor(`(() => {
      const users = [...document.querySelectorAll('.board-ai-chat-message.user p')];
      const assistants = [...document.querySelectorAll('.board-ai-chat-message.assistant p')];
      if (users.at(-1)?.textContent !== ${text} || !assistants.length || document.querySelector('.board-ai-chat-pending')) return null;
      return assistants.at(-1).textContent;
    })()`, `Помощник не завершил команду «${prompt}»`, 20_000);
    assert.match(result, expected, `Неожиданный ответ для «${prompt}»: ${result}`);
    sent += 1;
    return result;
  };

  const assignmentPrompts = [
    ["Математика", "теорема Пифагора"], ["Математика", "сокращение дробей"], ["Математика", "площадь круга"],
    ["Математика", "квадратные уравнения"], ["Математика", "вероятность события"],
    ["Физика", "закон Ома"], ["Физика", "плотность вещества"], ["Физика", "сила трения"],
    ["Физика", "закон Архимеда"], ["Физика", "количество теплоты"],
    ["Химия", "молярная масса вещества"], ["Химия", "галогены"], ["Химия", "химические свойства солей"],
    ["Химия", "степени окисления"], ["Химия", "уравнения химических реакций"],
    ["Русский язык", "непроизносимые согласные"], ["Русский язык", "НЕ с глаголами"],
    ["Русский язык", "прямая и косвенная речь"], ["Русский язык", "склонение числительных"],
    ["Русский язык", "чередование гласных в корне"],
  ];
  const imageFixture = path.join(profile, "ai-board-upload.svg");
  const pdfFixture = path.join(profile, "ai-board-upload.pdf");
  await writeFile(imageFixture, '<svg xmlns="http://www.w3.org/2000/svg" width="160" height="120"><rect width="160" height="120" fill="#3568cc"/><text x="12" y="64" fill="white">AI upload</text></svg>');
  await writeFile(pdfFixture, "%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Count 0/Kids[]>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF");
  const attachFile = async (fixture, expectedSelector) => {
    const { root } = await devtools.call("DOM.getDocument", { depth: -1 });
    const { nodeId } = await devtools.call("DOM.querySelector", { nodeId: root.nodeId, selector: 'input[aria-label="Добавить фото или PDF"]' });
    assert.ok(nodeId, "Не найден выбор медиафайла, используемый помощником и панелью инструментов");
    await devtools.call("DOM.setFileInputFiles", { files: [fixture], nodeId });
    try { await waitFor(`document.querySelectorAll(${JSON.stringify(expectedSelector)}).length === 1`, `Вложение ${path.basename(fixture)} не появилось на доске`); }
    catch (error) {
      const state = await devtools.evaluate(`JSON.stringify({ files: [...(document.querySelector('input[aria-label="Добавить фото или PDF"]')?.files ?? [])].map(file => file.name), objects: [...document.querySelectorAll('.board-object')].map(node => node.className), messages: [...document.querySelectorAll('.board-ai-chat-message.assistant p')].slice(-2).map(node => node.textContent), notice: document.querySelector('[role="status"]')?.textContent })`);
      throw new Error(`${error.message}; browser state: ${state}`);
    }
  };
  await send("Добавь изображение", /Выберите изображение на устройстве/i);
  await attachFile(imageFixture, ".board-object.object-image");
  await send("Прикрепи PDF", /Выберите PDF на устройстве/i);
  await attachFile(pdfFixture, ".board-object.object-pdf");

  const subjectCases = { "Математика": "математике", "Физика": "физике", "Химия": "химии", "Русский язык": "русскому языку" };
  for (const [subject, topic] of assignmentPrompts) {
    await send(`Создай 1 задание по ${subjectCases[subject]} на тему ${topic}`, /Создал на доске 1 .*\(/i);
  }
  for (const prompt of [
    "Создай 1 олимпиадную задачу по математике на теорему Пифагора",
    "Создай 1 олимпиадную задачу по физике на сохранение энергии для 9 класса",
    "Создай 1 олимпиадную задачу по химии на окислительно-восстановительные реакции",
  ]) await send(prompt, /Создал на доске 1 .*\(/i);

  const noteLabels = ["ALPHA", "BRAVO", "CHARLIE", "DELTA", "ECHO", "FOXTROT", "GOLF", "HOTEL", "INDIA", "JULIET", "KILO", "LIMA", "MIKE", "NOVEMBER", "OSCAR", "PAPA", "QUEBEC", "ROMEO", "SIERRA", "TANGO", "UNIFORM", "VICTOR", "WHISKEY", "XRAY", "YANKEE", "ZULU", "APRICOT", "BIRCH", "COBALT", "DENIM"];
  const noteNames = noteLabels.map(label => `E2E_NOTE_${label}`);
  for (const name of noteNames) await send(`создай заметку: ${name}`, /Создал заметку и выделил/i);
  for (let index = 1; index <= 10; index += 1) await send(`создай текст: E2E_TEXT_${String(index).padStart(2, "0")}`, /Создал текстовый объект и выделил/i);
  for (let index = 1; index <= 10; index += 1) await send(`создай список: E2E_TASK_${String(index).padStart(2, "0")}; повторить тему`, /Создал список и выделил/i);
  for (let index = 1; index <= 10; index += 1) await send(`создай фигуру треугольник: E2E_SHAPE_${String(index).padStart(2, "0")}`, /Создал фигуру и выделил/i);
  await send("создай формулу: E2E_FORMULA = m × a", /Создал формулу и выделил/i);
  await send("создай таблицу: E2E_Величина | Обозначение; Сила | F", /Создал таблицу и выделил/i);
  await send("создай фрейм: E2E_План урока", /Создал фрейм и выделил/i);
  await send("создай столбчатую диаграмму E2E_Продажи: Январь | 12; Февраль | 18", /Создал диаграмму и выделил/i);
  await send("найди E2E_Продажи", /Нашёл 1 элемент и выделил/i);
  await send("создай викторину: E2E_Сколько будет 2 + 2?; 3; 4; ответ: 2; пояснение: сложение чисел", /Создал викторину и выделил/i);
  await send("создай карточку для повторения: E2E_Закон Ома | I = U / R", /Создал карточку для повторения и выделил/i);
  await send("создай круговую дробь: 3/4", /Создал дробную модель и выделил/i);
  await send("создай комментарий: E2E_Проверить оформление", /Создал комментарий и выделил/i);
  await send("добавь видео: E2E_Урок | https://example.com/lesson", /Создал медиа-ссылку и выделил/i);
  await send("создай график функции: y = x^2 + 12345*x + 6789", /Создал график функции и выделил/i);
  await send("добавь транспортир", /Создал измерительный инструмент и выделил/i);
  await send("создай шторку", /Создал шторку и выделил/i);
  await send("создай стрелку: E2E_Причина → E2E_Следствие", /Создал стрелку и выделил/i);
  await send("нарисуй линию карандашом", /Создал линию карандашом и выделил/i);
  await send("нарисуй линию маркером: вертикальную", /Создал линию маркером и выделил/i);

  // Exercise every object mutation through the real UI on every supported
  // Item.kind. The browser profile and demo board are isolated fixtures.
  const kindActions = [
    ["E2E_TEXT_01", "текст"], ["E2E_TASK_01", "список"], ["E2E_SHAPE_01", "фигура"],
    ["E2E_FORMULA", "формулу"], ["E2E_Величина", "таблицу"], ["E2E_План урока", "фрейм"],
    ["E2E_Продажи", "диаграмму"], ["E2E_Сколько будет", "викторину"], ["E2E_Закон Ома", "карточку"],
    ["Дробная модель", "дробь"], ["E2E_Проверить оформление", "комментарий"], ["E2E_Урок", "видео"],
    ["12345*x+6789", "график"], ["транспортир", "инструмент"], ["шторку", "шторку"],
    ["E2E_Причина", "стрелку"], ["линию карандашом", "карандаш"], ["линию маркером", "маркер"],
    ["ai-board-upload.svg", "изображение"], ["ai-board-upload.pdf", "PDF"],
  ];
  const actionLabels = ["ALPHA", "BRAVO", "CHARLIE", "DELTA", "ECHO", "FOXTROT", "GOLF", "HOTEL", "INDIA", "JULIET", "KILO", "LIMA", "MIKE", "NOVEMBER", "OSCAR", "PAPA", "QUEBEC", "ROMEO", "SIERRA", "TANGO"];
  for (let index = 0; index < kindActions.length; index += 1) {
    const [query, label] = kindActions[index];
    const renamed = `E2E_KIND_RENAMED_${actionLabels[index]}`;
    const found = await send(`найди ${query}`, /Нашёл \d+ элемент.*выделил/i);
    const matched = Number(found.match(/Нашёл (\d+)/i)?.[1]);
    assert.ok(matched > 0, `Search should return at least one ${label} object`);
    await send(`переименуй ${query} в ${renamed}`, new RegExp(`Обновил название или текст у ${matched} объект`, "i"));
    await send(`перемести ${renamed} вправо`, new RegExp(`Переместил ${matched} объект`, "i"));
    await send(`скопируй ${renamed}`, new RegExp(`Создал ${matched} копи.*найденных объектов`, "i"));
    await send(`найди ${renamed}`, new RegExp(`Нашёл ${matched * 2} элемент.*выделил`, "i"));
    await send(`удали ${renamed}`, /Удаление отменено/i, { confirm: false });
    await send(`удали ${renamed}`, new RegExp(`Удалил ${matched * 2} элемент`, "i"), { confirm: true });
    if ((index + 1) % 5 === 0) console.log(`Проверены действия на ${index + 1}/20 типах объектов`);
  }

  for (const name of noteNames) await send(`найди ${name}`, /Нашёл 1 элемент и выделил/i);
  for (let index = 1; index <= 20; index += 1) {
    const from = noteNames[index - 1];
    const to = `E2E_NOTE_RENAMED_${noteLabels[index - 1]}`;
    await send(`переименуй ${from} в ${to}`, /Обновил название или текст у 1 объекта/i);
  }
  const directions = ["влево", "вправо", "вверх", "вниз", "в центр"];
  for (let index = 1; index <= 20; index += 1) {
    const name = `E2E_NOTE_RENAMED_${noteLabels[index - 1]}`;
    await send(`перемести ${name} ${directions[(index - 1) % directions.length]}`, /Переместил 1 объект/i);
  }
  await send("скопируй E2E_NOTE_RENAMED_ALPHA", /Создал 1 копию найденных объектов/i);
  await send("найди E2E_NOTE_RENAMED_ALPHA", /Нашёл 2 элемента? и выделил/i);
  for (let index = 0; index < 10; index += 1) await send("сводка доски", /На доске \d+ элементов/i);
  for (let index = 0; index < 10; index += 1) await send("покажи историю изменений", /локальной истории отмены/i);
  for (let index = 0; index < 10; index += 1) await send("отмени последнее действие", /Последнее действие отменено|Дальше в этом направлении/i);
  for (let index = 0; index < 10; index += 1) await send("повтори действие", /Действие повторено|Дальше в этом направлении/i);
  for (let index = 20; index < 25; index += 1) await send(`удали ${noteNames[index]}`, /Удаление отменено/i, { confirm: false });
  for (let index = 25; index < 30; index += 1) await send(`удали ${noteNames[index]}`, /Удалил 1 элемент/i, { confirm: true });

  assert.equal(sent, 363, "Должно быть выполнено ровно 363 сквозные команды через UI");
  console.log("AI board UI acceptance: 363 реальные команды выполнены через локальный /demo/board; 20 базовых генераций (по 5 на каждый приоритетный предмет) и 3 нестандартных задачи по математике, физике и химии, 21 вид создания объектов/элементов, включая загрузку изображения/PDF, функцию-график, измерительный инструмент, шторку, стрелку, штрихи пера и маркера; поиск, переименование, копирование и оба исхода подтверждения удаления проверены на всех 20 Item.kind, перемещение проверено по всем объектам и пяти направлениям, дополнительно проверены анализ, локальная история и отмена/повтор.");
} finally {
  devtools?.close();
  if (process.platform === "win32" && chrome.pid) {
    const killer = spawn("taskkill.exe", ["/PID", String(chrome.pid), "/T", "/F"], { stdio: "ignore", windowsHide: true });
    await new Promise(resolve => { killer.once("exit", resolve); killer.once("error", resolve); });
  } else chrome.kill();
  await Promise.race([chromeExited, delay(5_000)]);
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
