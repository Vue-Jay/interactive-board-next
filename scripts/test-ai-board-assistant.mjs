import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";

const file = "src/aiBoardAssistant.ts";
const source = readFileSync(new URL(`../${file}`, import.meta.url), "utf8").replace(/^export\s+/gm, "");
const output = ts.transpileModule(source, {
  fileName: file,
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
}).outputText.replace(/^export\s*\{\s*\};?\s*$/gm, "");
const api = new Function(`${output}\nreturn { parseBoardAssistantCommand, findBoardItems, applyBoardAssistantMutation, summarizeBoard, summarizeBoardActivity, createBoardAssistantObject, boardItemBounds };`)();

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
const contentSummary = api.summarizeBoard([
  { id: "formula", kind: "formula", x: 0, y: 0, width: 100, height: 40, text: "F = ma" },
  { id: "table", kind: "table", x: 0, y: 0, width: 100, height: 40, text: "", tableCells: ["Вещество", "Плотность", "Вода", "1000 кг/м³"] },
  { id: "quiz", kind: "quiz", x: 0, y: 0, width: 100, height: 40, text: "Как найти скорость?", quizOptions: ["Путь разделить на время", "Время разделить на путь"] },
  { id: "media", kind: "image", x: 0, y: 0, width: 100, height: 40, text: "", name: "Карта Европы.png", assetId: "68a2aa73-42d2-45f1-b3a8-2151901c7b0c" },
  ...Array.from({ length: 7 }, (_, index) => ({ id: `extra-${index}`, kind: "sticky", x: 0, y: 0, width: 100, height: 40, text: `Дополнительная заметка ${index}` })),
]);
assert.ok(contentSummary.includes("Содержание 8 из 11"), "Board analysis should bound output and disclose omitted items");
assert.ok(contentSummary.includes("F = ma"), "Board analysis should include formula content");
assert.ok(contentSummary.includes("Плотность"), "Board analysis should include structured table cells");
assert.ok(contentSummary.includes("Как найти скорость?"), "Board analysis should include quiz prompts");
assert.ok(contentSummary.includes("Карта Европы.png"), "Board analysis should include media names");
assert.ok(!contentSummary.includes("68a2aa73-42d2-45f1-b3a8-2151901c7b0c"), "Board analysis must not expose internal media IDs");

const objectForMutation = (id, text, x = 0, hidden = false) => ({ id, kind: "sticky", x, y: 20, width: 100, height: 80, text, hidden });
let mutationScenarios = 0;
const directions = ["left", "right", "up", "down", "center"];
for (let index = 0; index < 50; index += 1) {
  const target = objectForMutation(`rename-${index}`, `Уникальная заметка ${index}`);
  const hidden = objectForMutation(`hidden-${index}`, `Уникальная заметка ${index}`, 400, true);
  const unrelated = objectForMutation(`other-${index}`, `Другая заметка ${index}`, 800);
  const renamed = api.applyBoardAssistantMutation([target, hidden, unrelated], {
    kind: "rename", query: `Уникальная заметка ${index}`, text: `Новое название ${index}`,
  });
  assert.equal(renamed.status, "changed");
  assert.equal(renamed.matches.length, 1, "Hidden objects must not match assistant commands");
  assert.equal(renamed.items[0].text, `Новое название ${index}`);
  assert.equal(renamed.items[1].text, hidden.text, "Hidden objects must remain untouched");
  assert.equal(renamed.items[2].text, unrelated.text, "Unmatched objects must remain untouched");
  mutationScenarios += 1;

  const direction = directions[index % directions.length];
  const targetCenter = { x: 1200 + index, y: 900 - index };
  const moved = api.applyBoardAssistantMutation([target, hidden, unrelated], {
    kind: "move", query: `Уникальная заметка ${index}`, direction,
  }, { center: targetCenter });
  assert.equal(moved.status, "changed");
  assert.equal(moved.matches.length, 1);
  if (direction === "left") assert.equal(moved.items[0].x, target.x - 160);
  if (direction === "right") assert.equal(moved.items[0].x, target.x + 160);
  if (direction === "up") assert.equal(moved.items[0].y, target.y - 160);
  if (direction === "down") assert.equal(moved.items[0].y, target.y + 160);
  if (direction === "center") {
    assert.equal(moved.bounds.x + moved.bounds.width / 2, targetCenter.x);
    assert.equal(moved.bounds.y + moved.bounds.height / 2, targetCenter.y);
  }
  assert.deepEqual(moved.items[1], hidden, "Hidden objects must not move");
  assert.deepEqual(moved.items[2], unrelated, "Unmatched objects must not move");
  mutationScenarios += 1;

  const deletionTarget = objectForMutation(`delete-${index}`, `Удаляемая заметка ${index}`);
  const hiddenDeletionTarget = objectForMutation(`hidden-delete-${index}`, `Удаляемая заметка ${index}`, 400, true);
  const beforeDelete = [deletionTarget, hiddenDeletionTarget, unrelated];
  const confirmation = api.applyBoardAssistantMutation(beforeDelete, { kind: "delete", query: `Удаляемая заметка ${index}` });
  assert.equal(confirmation.status, "confirmation-required");
  assert.deepEqual(confirmation.items, beforeDelete, "Deletion must not alter the board before confirmation");
  mutationScenarios += 1;
  const deleted = api.applyBoardAssistantMutation(beforeDelete, { kind: "delete", query: `Удаляемая заметка ${index}` }, { confirmed: true });
  assert.equal(deleted.status, "changed");
  assert.deepEqual(deleted.items.map(item => item.id), [hiddenDeletionTarget.id, unrelated.id]);
  mutationScenarios += 1;
}
assert.equal(mutationScenarios, 200, "The mutation regression set must retain all 200 scenarios");

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

console.log(`AI board assistant: parsing, structured search, object creation and history OK; ${mutationScenarios} board mutations passed with hidden-item protection and delete confirmation.`);
