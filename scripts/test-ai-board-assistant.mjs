import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";

const file = "src/aiBoardAssistant.ts";
const source = readFileSync(new URL(`../${file}`, import.meta.url), "utf8").replace(/^export\s+/gm, "");
const output = ts.transpileModule(source, {
  fileName: file,
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
}).outputText.replace(/^export\s*\{\s*\};?\s*$/gm, "");
const api = new Function(`${output}\nreturn { parseBoardAssistantCommand, findBoardItems, summarizeBoard, summarizeBoardActivity, createBoardAssistantObject, boardItemBounds };`)();

assert.deepEqual(api.parseBoardAssistantCommand("Что менялось на доске?"), { kind: "history" });
assert.deepEqual(api.parseBoardAssistantCommand("Отмени последнее действие"), { kind: "undo" });
assert.deepEqual(api.parseBoardAssistantCommand("Повтори действие"), { kind: "redo" });
assert.deepEqual(api.parseBoardAssistantCommand("Переименуй геометрию в План урока"), { kind: "rename", query: "геометрию", text: "План урока" });
assert.deepEqual(api.parseBoardAssistantCommand("Перемести заметку вправо"), { kind: "move", query: "заметку", direction: "right" });
assert.deepEqual(api.parseBoardAssistantCommand("Удали старую заметку"), { kind: "delete", query: "старую заметку" });
assert.deepEqual(api.parseBoardAssistantCommand("Проанализируй все элементы"), { kind: "analyze" });
assert.deepEqual(api.parseBoardAssistantCommand("Найди заметку про Пифагора"), { kind: "find", query: "заметку про Пифагора" });
assert.deepEqual(api.parseBoardAssistantCommand("Создай заметку: повторить теорему Пифагора"), { kind: "create-sticky", text: "повторить теорему Пифагора" });
assert.deepEqual(api.parseBoardAssistantCommand("Создай список: прочитать параграф; решить задачи"), { kind: "create-checklist", text: "прочитать параграф; решить задачи" });
assert.deepEqual(api.parseBoardAssistantCommand("Создай круг: центр фигуры"), { kind: "create-shape", shape: "circle", text: "центр фигуры" });

const items = [
  { id: "a", kind: "sticky", x: 10, y: 20, width: 100, height: 80, text: "Повторить теорему Пифагора", color: "#fff3a6" },
  { id: "b", kind: "checklist", x: 140, y: 40, width: 160, height: 120, text: "Геометрия", checklistItems: ["Построить треугольник", "Найти площадь"], checklistDone: [true, false] },
  { id: "c", kind: "table", x: -30, y: 0, width: 30, height: 30, text: "", tableCells: ["формула", "ответ"] },
];
assert.deepEqual(api.findBoardItems(items, "заметку про Пифагора"), [items[0]]);
assert.deepEqual(api.findBoardItems(items, "формула"), [items[2]], "Search must index structured text inside objects");
const nestedItem = {
  id: "nested", kind: "instrument", x: 0, y: 0, width: 100, height: 100,
  settings: { label: "Лаборатория", values: ["Раствор", "Реакция нейтрализации"] },
  imageData: "Искать это поле не нужно",
  points: Array.from({ length: 5000 }, (_, index) => ({ x: index, y: index })),
};
assert.deepEqual(api.findBoardItems([nestedItem], "нейтрализации"), [nestedItem], "Search must keep nested readable text");
assert.deepEqual(api.findBoardItems([nestedItem], "искать это поле"), [], "Search must skip image payload fields");
assert.equal(api.summarizeBoard(items).includes("На доске 3 элементов."), true);
assert.equal(api.summarizeBoard(items).includes("отмечено 1 из 2 пунктов"), true);
assert.deepEqual(api.boardItemBounds([items[0], items[1]]), { x: 10, y: 20, width: 290, height: 140 });

const created = api.createBoardAssistantObject({ kind: "create-sticky", text: "Проверить решение" }, { x: 500, y: 300 }, () => "created");
assert.equal(created.kind, "sticky");
assert.equal(created.text, "Проверить решение");
const createdList = api.createBoardAssistantObject({ kind: "create-checklist", text: "Прочитать параграф; Решить задачи" }, { x: 500, y: 300 }, () => "list");
assert.deepEqual(createdList.checklistItems, ["Прочитать параграф", "Решить задачи"]);
assert.ok(createdList.width >= 440 && createdList.height >= 190);
const longList = api.createBoardAssistantObject({
  kind: "create-checklist", text: "Прочитать большой параграф и выписать основные понятия из учебника. Перечислить определения и формулы, которые встречаются в этом разделе; Решить задачи и подробно записать ход вычислений, объяснить каждый шаг и проверить полученные ответы обратным действием",
}, { x: 0, y: 0 }, () => "long-list");
assert.ok(longList.height > createdList.height, "Long checklist entries should grow the new object vertically");
assert.equal(api.createBoardAssistantObject({ kind: "create-text", text: "   " }, { x: 0, y: 0 }, () => "x"), null);

const history = api.summarizeBoardActivity([{
  id: 1, version: 3, created_at: "2026-11-10T10:00:00.000Z", actor_id: "u", actor_name: "Анна",
  added_count: 2, changed_count: 1, removed_count: 0, item_count: 8, summary: "Добавлены задания",
}]);
assert.ok(history.includes("добавлено 2, изменено 1, удалено 0"));
assert.ok(history.includes("Анна: Добавлены задания"));

console.log("AI board assistant: intent parsing, structured search, board summary, object creation and history analysis OK");
