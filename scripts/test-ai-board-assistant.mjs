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
assert.deepEqual(api.parseBoardAssistantCommand("Скопируй формулу плотности"), { kind: "duplicate", query: "формулу плотности" });
assert.deepEqual(api.parseBoardAssistantCommand("Перемести заметку вправо"), { kind: "move", query: "заметку", direction: "right" });
assert.deepEqual(api.parseBoardAssistantCommand("Увеличь заметку про Пифагора на 30%"), { kind: "resize", query: "про Пифагора", direction: "larger", percent: 30 });
assert.deepEqual(api.parseBoardAssistantCommand("Сделай таблицу с плотностью шире"), { kind: "resize", query: "с плотностью", direction: "wider", percent: 25 });
assert.deepEqual(api.parseBoardAssistantCommand("Сузь формулу на 500%"), { kind: "resize", query: "", direction: "narrower", percent: 300 }, "Resize requests must be clamped to a safe maximum");
assert.deepEqual(api.parseBoardAssistantCommand("Удали старую заметку"), { kind: "delete", query: "старую заметку" });
assert.deepEqual(api.parseBoardAssistantCommand("Проанализируй все элементы"), { kind: "analyze" });
assert.deepEqual(api.parseBoardAssistantCommand("Найди заметку про Пифагора"), { kind: "find", query: "про Пифагора" });
assert.deepEqual(api.parseBoardAssistantCommand("Найди задание про молярную массу"), { kind: "find", query: "про молярную массу" });
assert.deepEqual(api.parseBoardAssistantCommand("Создай заметку: повторить теорему Пифагора"), { kind: "create-sticky", text: "повторить теорему Пифагора" });
assert.deepEqual(api.parseBoardAssistantCommand("Создай список: прочитать параграф; решить задачи"), { kind: "create-checklist", text: "прочитать параграф; решить задачи" });
assert.deepEqual(api.parseBoardAssistantCommand("Создай формулу: F = ma"), { kind: "create-formula", text: "F = ma" });
assert.deepEqual(api.parseBoardAssistantCommand("Добавь таблицу: Величина | Обозначение; Сила | F"), { kind: "create-table", text: "Величина | Обозначение; Сила | F" });
assert.deepEqual(api.parseBoardAssistantCommand("Создай круговую диаграмму Расходы: Еда | 12; Транспорт | 4"), {
  kind: "create-chart", chartStyle: "pie", title: "Расходы", text: "Еда | 12; Транспорт | 4",
});
assert.deepEqual(api.parseBoardAssistantCommand("Создай фрейм: План урока"), { kind: "create-frame", text: "План урока" });
assert.deepEqual(api.parseBoardAssistantCommand("Создай круг: центр фигуры"), { kind: "create-shape", shape: "circle", text: "центр фигуры" });
assert.deepEqual(api.parseBoardAssistantCommand("Создай викторину: Сколько будет 2 + 2?; 3; 4; ответ: 2; пояснение: Сложите два числа"), {
  kind: "create-quiz", question: "Сколько будет 2 + 2?", options: ["3", "4"], correct: 1, explanation: "Сложите два числа",
});
assert.deepEqual(api.parseBoardAssistantCommand("Создай карточку для повторения: Закон Ома | I = U / R"), {
  kind: "create-flashcard", front: "Закон Ома", back: "I = U / R",
});
assert.deepEqual(api.parseBoardAssistantCommand("Создай круговую дробь: 3/4"), {
  kind: "create-fraction", numerator: 3, denominator: 4, mode: "circle",
});
assert.deepEqual(api.parseBoardAssistantCommand("Создай комментарий: Проверить оформление"), {
  kind: "create-comment", text: "Проверить оформление",
});
assert.deepEqual(api.parseBoardAssistantCommand("Добавь видео: Урок 1 | https://example.com/lesson"), {
  kind: "create-linkmedia", url: "https://example.com/lesson", title: "Урок 1",
});
assert.deepEqual(api.parseBoardAssistantCommand("Создай задание на площадь круга"), { kind: "unknown" }, "Curriculum generation must take priority over shape words inside the topic");
assert.deepEqual(api.parseBoardAssistantCommand("Создай текст: Закон Ома"), { kind: "create-text", text: "Закон Ома" });
assert.deepEqual(api.parseBoardAssistantCommand("Добавь изображение"), { kind: "pick-media", mediaType: "image" });
assert.deepEqual(api.parseBoardAssistantCommand("Загрузи фото на доску"), { kind: "pick-media", mediaType: "image" });
assert.deepEqual(api.parseBoardAssistantCommand("Прикрепи PDF"), { kind: "pick-media", mediaType: "pdf" });
assert.deepEqual(api.parseBoardAssistantCommand("Добавь документ"), { kind: "pick-media", mediaType: "pdf" });
for (const [prompt, shape] of [
  ["Нарисуй прямоугольный треугольник: схема", "rightTriangle"],
  ["Создай скругленный прямоугольник: карточка", "rounded"],
  ["Добавь параллелограмм: ABCD", "parallelogram"],
  ["Нарисуй трапецию: основания", "trapezoid"],
  ["Создай пятиугольник: фигура", "pentagon"],
  ["Добавь шестиугольник: фигура", "hexagon"],
]) assert.equal(api.parseBoardAssistantCommand(prompt).shape, shape, `Shape command failed: ${prompt}`);

const items = [
  { id: "a", kind: "sticky", x: 10, y: 20, width: 100, height: 80, text: "Повторить теорему Пифагора", color: "#fff3a6" },
  { id: "b", kind: "checklist", x: 140, y: 40, width: 160, height: 120, text: "Геометрия", checklistItems: ["Построить треугольник", "Найти площадь"], checklistDone: [true, false] },
  { id: "c", kind: "table", x: -30, y: 0, width: 30, height: 30, text: "", tableCells: ["формула", "ответ"] },
];
const mediaRename = api.applyBoardAssistantMutation([
  { id: "photo", kind: "image", x: 0, y: 0, width: 80, height: 60, text: "", name: "old.png", assetId: "asset" },
  { id: "video", kind: "linkmedia", x: 0, y: 0, width: 80, height: 60, text: "", mediaTitle: "old video", mediaUrl: "https://example.test/video" },
  { id: "named-table", kind: "table", x: 0, y: 0, width: 80, height: 60, text: "", tableRows: 2, tableCols: 2, tableCells: [] },
], { kind: "rename", query: "old", text: "New label" });
assert.equal(mediaRename.items[0].name, "New label", "Renaming an image should change its visible media name");
assert.equal(mediaRename.items[0].text, "", "Renaming an image should not write an invisible text field");
assert.equal(mediaRename.items[1].mediaTitle, "New label", "Renaming linked media should change its visible title");
assert.equal(mediaRename.items[2].name, undefined, "A table must not match unrelated media rename queries");
const tableRename = api.applyBoardAssistantMutation([
  { id: "named-table", kind: "table", x: 0, y: 0, width: 80, height: 60, text: "", tableRows: 2, tableCols: 2, tableCells: ["Баланс", "Сила"] },
], { kind: "rename", query: "Баланс", text: "Физика · таблица величин" });
assert.equal(tableRename.items[0].name, "Физика · таблица величин", "Renaming a table should set a visible board-item label");
const resizeItems = [
  { id: "resize-note", kind: "sticky", x: 100, y: 200, width: 200, height: 100, text: "Повторить теорему Пифагора" },
  { id: "untouched-note", kind: "sticky", x: 400, y: 500, width: 120, height: 80, text: "Оставить без изменений" },
];
const resizeResult = api.applyBoardAssistantMutation(resizeItems, api.parseBoardAssistantCommand("Увеличь заметку про Пифагора на 30%"));
assert.equal(resizeResult.status, "changed");
assert.equal(resizeResult.items[0].width, 260, "The assistant should enlarge the requested object by the parsed percentage");
assert.equal(resizeResult.items[0].height, 130);
assert.equal(resizeResult.items[0].x, 70, "Resizing should keep the object centered in place");
assert.equal(resizeResult.items[0].y, 185);
assert.deepEqual(resizeResult.items[1], resizeItems[1], "Resize must leave unrelated objects unchanged");
const narrowResult = api.applyBoardAssistantMutation(resizeItems, api.parseBoardAssistantCommand("Сделай заметку про Пифагора уже на 50%"));
assert.equal(narrowResult.items[0].width, 100, "Directional resize should change only the named dimension");
assert.equal(narrowResult.items[0].height, 100);
const scalableItems = [
  { id: "resize-ink", kind: "pen", x: 0, y: 0, width: 100, height: 20, text: "E2E resize ink", points: [{ x: 0, y: 10 }, { x: 100, y: 10 }] },
  { id: "resize-connector", kind: "connector", x: 200, y: 0, width: 100, height: 20, text: "E2E resize connector", connectorStart: { x: 0, y: 10 }, connectorEnd: { x: 100, y: 10 } },
];
const scalableResult = api.applyBoardAssistantMutation(scalableItems, { kind: "resize", query: "E2E resize", direction: "larger", percent: 100 });
assert.deepEqual(scalableResult.items[0].points, [{ x: 0, y: 20 }, { x: 200, y: 20 }], "Ink geometry should scale with its object bounds");
assert.deepEqual(scalableResult.items[1].connectorStart, { x: 0, y: 20 }, "Connector endpoints should scale with their object bounds");
assert.deepEqual(scalableResult.items[1].connectorEnd, { x: 200, y: 20 });
const allBoardKinds = ["sticky", "text", "shape", "pen", "marker", "image", "pdf", "frame", "connector", "comment", "table", "formula", "graph", "fraction", "checklist", "quiz", "flashcard", "cover", "linkmedia", "instrument"];
for (const kind of allBoardKinds) {
  const label = `AI_KIND_${kind}`;
  const fixture = { id: `kind-${kind}`, kind, x: 20, y: 30, width: 120, height: 80, text: label };
  if (kind === "image" || kind === "pdf") { fixture.text = ""; fixture.name = label; }
  if (kind === "linkmedia") { fixture.text = ""; fixture.mediaTitle = label; fixture.mediaUrl = "https://example.test/media"; }
  if (kind === "instrument") fixture.instrumentType = "protractor";
  const found = api.findBoardItems([fixture], label);
  assert.deepEqual(found, [fixture], `${kind} should be searchable by visible content`);
  const renamed = api.applyBoardAssistantMutation([fixture], { kind: "rename", query: label, text: `RENAMED_${kind}` });
  assert.equal(renamed.status, "changed", `${kind} should support rename`);
  const visibleName = kind === "image" || kind === "pdf" || kind === "table" ? renamed.items[0].name
    : kind === "linkmedia" ? renamed.items[0].mediaTitle : renamed.items[0].text;
  assert.equal(visibleName, `RENAMED_${kind}`, `${kind} rename should update visible content`);
  const duplicated = api.applyBoardAssistantMutation([fixture], { kind: "duplicate", query: label }, { createId: () => `copy-${kind}` });
  assert.equal(duplicated.items.length, 2, `${kind} should support duplicate`);
  assert.equal(duplicated.items[1].kind, kind, `${kind} copy should preserve the object type`);
  assert.notEqual(duplicated.items[1].id, fixture.id, `${kind} copy should have a new ID`);
  assert.deepEqual({ ...duplicated.items[1], id: fixture.id, x: fixture.x, y: fixture.y }, fixture, `${kind} copy should preserve full object content`);
  const moved = api.applyBoardAssistantMutation([fixture], { kind: "move", query: label, direction: "right" });
  assert.equal(moved.items[0].x, fixture.x + 160, `${kind} should move`);
  const deletion = api.applyBoardAssistantMutation([fixture], { kind: "delete", query: label });
  assert.equal(deletion.status, "confirmation-required", `${kind} delete should ask for confirmation`);
  assert.equal(api.applyBoardAssistantMutation([fixture], { kind: "delete", query: label }, { confirmed: true }).items.length, 0, `${kind} should delete after confirmation`);
}
const localizedObjects = [
  { id: "protractor", kind: "instrument", x: 0, y: 0, width: 100, height: 80, text: "", instrumentType: "protractor" },
  { id: "cover", kind: "cover", x: 0, y: 0, width: 100, height: 80, text: "" },
  { id: "pen", kind: "pen", x: 0, y: 0, width: 100, height: 10, text: "" },
  { id: "marker", kind: "marker", x: 0, y: 0, width: 100, height: 10, text: "" },
];
for (const [query, expectedId] of [["транспортир", "protractor"], ["шторка", "cover"], ["карандаш", "pen"], ["маркер", "marker"]]) {
  assert.deepEqual(api.findBoardItems(localizedObjects, query).map(item => item.id), [expectedId], `An empty ${expectedId} object should be searchable by its Russian UI name`);
}
assert.deepEqual(api.findBoardItems(items, "заметку про Пифагора"), [items[0]]);
const numberedNotes = [1, 2].map(index => ({ id: `number-${index}`, kind: "sticky", x: 0, y: 0, width: 120, height: 60, text: `E2E_NOTE_${String(index).padStart(2, "0")}` }));
assert.deepEqual(api.findBoardItems(numberedNotes, "E2E_NOTE_01"), [numberedNotes[0]], "Search should use short numeric identifiers when they disambiguate objects");
assert.deepEqual(api.findBoardItems(items, api.parseBoardAssistantCommand("Найди задание про молярную массу").query), [], "Generic object words must not turn a semantic search into an impossible exact-term filter");
const generatedChemistryItems = [{ id: "chemistry-task", kind: "checklist", text: "Практика · Химия · молярную массу", checklistItems: ["Вычисли молярную массу воды (H₂O)"] }];
assert.deepEqual(api.findBoardItems(generatedChemistryItems, api.parseBoardAssistantCommand("Найди задание про молярную массу").query), generatedChemistryItems, "Natural search must find a generated assignment by its topic");
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
assert.ok(contentSummary.includes("первые 8 объектов с содержимым"), "Board analysis should bound output and disclose that it is a sample");
assert.ok(contentSummary.includes("F = ma"), "Board analysis should include formula content");
assert.ok(contentSummary.includes("Плотность"), "Board analysis should include structured table cells");
assert.ok(contentSummary.includes("Как найти скорость?"), "Board analysis should include quiz prompts");
assert.ok(contentSummary.includes("Карта Европы.png"), "Board analysis should include media names");
assert.ok(!contentSummary.includes("68a2aa73-42d2-45f1-b3a8-2151901c7b0c"), "Board analysis must not expose internal media IDs");
const laterContentSummary = api.summarizeBoard([
  ...Array.from({ length: 9 }, (_, index) => ({ id: `blank-${index}`, kind: "shape", x: 0, y: 0, width: 20, height: 20, text: "" })),
  { id: "late-note", kind: "sticky", x: 0, y: 0, width: 100, height: 50, text: "Сохранить вывод эксперимента" },
]);
assert.ok(laterContentSummary.includes("Сохранить вывод эксперимента"), "Board analysis should search beyond leading empty objects");

const objectForMutation = (id, text, x = 0, hidden = false) => ({ id, kind: "sticky", x, y: 20, width: 100, height: 80, text, hidden });
let mutationScenarios = 0;
const directions = ["left", "right", "up", "down", "center"];
for (let index = 0; index < 50; index += 1) {
  const target = objectForMutation(`rename-${index}`, `Уникальная заметка ${index}`);
  const hidden = objectForMutation(`hidden-${index}`, `Уникальная заметка ${index}`, 400, true);
  const unrelated = objectForMutation(`other-${index}`, `Другая заметка ${index}`, 800);
  const renameCommand = api.parseBoardAssistantCommand(`Переименуй Уникальная заметка ${index} в Новое название ${index}`);
  assert.deepEqual(renameCommand, { kind: "rename", query: `Уникальная заметка ${index}`, text: `Новое название ${index}` });
  const renamed = api.applyBoardAssistantMutation([target, hidden, unrelated], renameCommand);
  assert.equal(renamed.status, "changed");
  assert.equal(renamed.matches.length, 1, "Hidden objects must not match assistant commands");
  assert.equal(renamed.items[0].text, `Новое название ${index}`);
  assert.equal(renamed.items[1].text, hidden.text, "Hidden objects must remain untouched");
  assert.equal(renamed.items[2].text, unrelated.text, "Unmatched objects must remain untouched");
  mutationScenarios += 1;

  const direction = directions[index % directions.length];
  const targetCenter = { x: 1200 + index, y: 900 - index };
  const directionPhrase = { left: "влево", right: "вправо", up: "вверх", down: "вниз", center: "в центр" }[direction];
  const moveCommand = api.parseBoardAssistantCommand(`Сдвинь Уникальная заметка ${index} ${directionPhrase}`);
  assert.deepEqual(moveCommand, { kind: "move", query: `Уникальная заметка ${index}`, direction });
  const moved = api.applyBoardAssistantMutation([target, hidden, unrelated], moveCommand, { center: targetCenter });
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
  const deleteCommand = api.parseBoardAssistantCommand(`Удали Удаляемая заметка ${index}`);
  assert.deepEqual(deleteCommand, { kind: "delete", query: `Удаляемая заметка ${index}` });
  const confirmation = api.applyBoardAssistantMutation(beforeDelete, deleteCommand);
  assert.equal(confirmation.status, "confirmation-required");
  assert.deepEqual(confirmation.items, beforeDelete, "Deletion must not alter the board before confirmation");
  mutationScenarios += 1;
  const deleted = api.applyBoardAssistantMutation(beforeDelete, deleteCommand, { confirmed: true });
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
const formulaObject = api.createBoardAssistantObject({ kind: "create-formula", text: "F = ma" }, { x: 500, y: 300 }, () => "formula");
assert.equal(formulaObject.kind, "formula");
assert.equal(formulaObject.text, "F = ma");
const tableObject = api.createBoardAssistantObject({ kind: "create-table", text: "Величина | Обозначение; Сила | F" }, { x: 500, y: 300 }, () => "table");
assert.equal(tableObject.kind, "table");
assert.deepEqual(tableObject.tableCells, ["Величина", "Обозначение", "Сила", "F"]);
assert.ok(tableObject.width >= 420 && tableObject.height >= 180);
const chartCommand = api.parseBoardAssistantCommand("Создай круговую диаграмму Расходы: Еда | 12; Транспорт | 4");
const chartObject = api.createBoardAssistantObject(chartCommand, { x: 500, y: 300 }, () => "chart");
assert.equal(chartObject.kind, "graph");
assert.equal(chartObject.graphFigureId, "lektrus-chart");
assert.equal(chartObject.chartStyle, "pie");
assert.deepEqual(chartObject.chartEntries, [{ label: "Еда", value: 12 }, { label: "Транспорт", value: 4 }]);
assert.equal(api.createBoardAssistantObject({ ...chartCommand, text: "Еда | не число" }, { x: 500, y: 300 }, () => "invalid-chart"), null, "Invalid chart values should not create a misleading board object");
const frameObject = api.createBoardAssistantObject({ kind: "create-frame", text: "План урока" }, { x: 500, y: 300 }, () => "frame");
assert.equal(frameObject.kind, "frame");
assert.equal(frameObject.text, "План урока");
const quizCommand = api.parseBoardAssistantCommand("Создай викторину: Сколько будет 2 + 2?; 3; 4; ответ: 2");
const quizObject = api.createBoardAssistantObject(quizCommand, { x: 500, y: 300 }, () => "quiz");
assert.equal(quizObject.kind, "quiz");
assert.equal(quizObject.quizCorrect, 1);
assert.deepEqual(quizObject.quizOptions, ["3", "4"]);
assert.equal(api.createBoardAssistantObject({ ...quizCommand, correct: -1 }, { x: 0, y: 0 }, () => "invalid-quiz"), null, "A quiz without a valid correct answer must not be created");
const flashcardCommand = api.parseBoardAssistantCommand("Создай карточку для повторения: Закон Ома | I = U / R");
const flashcardObject = api.createBoardAssistantObject(flashcardCommand, { x: 500, y: 300 }, () => "flashcard");
assert.equal(flashcardObject.kind, "flashcard");
assert.equal(flashcardObject.text, "Закон Ома");
assert.equal(flashcardObject.flashcardBack, "I = U / R");
assert.equal(api.createBoardAssistantObject({ ...flashcardCommand, back: " " }, { x: 0, y: 0 }, () => "invalid-flashcard"), null, "An incomplete flashcard must not be created");
const fractionCommand = api.parseBoardAssistantCommand("Создай дробь: 3/4");
const fractionObject = api.createBoardAssistantObject(fractionCommand, { x: 500, y: 300 }, () => "fraction");
assert.equal(fractionObject.kind, "fraction");
assert.equal(fractionObject.fractionNumerator, 3);
assert.equal(fractionObject.fractionDenominator, 4);
assert.equal(api.createBoardAssistantObject({ ...fractionCommand, denominator: 0 }, { x: 0, y: 0 }, () => "invalid-fraction"), null, "A zero-denominator fraction must not be created");
const commentCommand = api.parseBoardAssistantCommand("Создай комментарий: Проверить оформление");
const commentObject = api.createBoardAssistantObject(commentCommand, { x: 500, y: 300 }, () => "comment");
assert.equal(commentObject.kind, "comment");
assert.equal(commentObject.text, "Проверить оформление");
const mediaCommand = api.parseBoardAssistantCommand("Добавь видео: Урок 1 | https://example.com/lesson");
const mediaObject = api.createBoardAssistantObject(mediaCommand, { x: 500, y: 300 }, () => "media");
assert.equal(mediaObject.kind, "linkmedia");
assert.equal(mediaObject.mediaTitle, "Урок 1");
assert.equal(mediaObject.mediaUrl, "https://example.com/lesson");
assert.equal(api.createBoardAssistantObject({ ...mediaCommand, url: "javascript:alert(1)" }, { x: 0, y: 0 }, () => "unsafe-media"), null, "Non-http media URLs must be rejected");
const graphCommand = api.parseBoardAssistantCommand("Создай график функции: y = x^2 - 4x + 3");
assert.deepEqual(graphCommand, { kind: "create-graph", expression: "x^2 - 4x + 3", title: "График y = x^2 - 4x + 3" });
const graphObject = api.createBoardAssistantObject(graphCommand, { x: 500, y: 300 }, () => "function-graph");
assert.equal(graphObject.kind, "graph");
assert.equal(graphObject.graphPurpose, "function");
assert.equal(graphObject.graphType, "quadratic");
assert.equal(graphObject.graphExpression, "x^2 - 4x + 3");
const instrumentCommand = api.parseBoardAssistantCommand("Добавь транспортир");
assert.deepEqual(instrumentCommand, { kind: "create-instrument", instrumentType: "protractor" });
assert.equal(api.createBoardAssistantObject(instrumentCommand, { x: 500, y: 300 }, () => "instrument").kind, "instrument");
assert.equal(api.createBoardAssistantObject(api.parseBoardAssistantCommand("Создай шторку"), { x: 500, y: 300 }, () => "cover").kind, "cover");
assert.equal(api.createBoardAssistantObject(api.parseBoardAssistantCommand("Создай стрелку: причина → следствие"), { x: 500, y: 300 }, () => "connector").kind, "connector");
const penStroke = api.createBoardAssistantObject(api.parseBoardAssistantCommand("Нарисуй линию карандашом"), { x: 500, y: 300 }, () => "pen");
assert.equal(penStroke.kind, "pen");
assert.equal(penStroke.points.length, 2);
const markerStroke = api.createBoardAssistantObject(api.parseBoardAssistantCommand("Нарисуй линию маркером: вертикальную"), { x: 500, y: 300 }, () => "marker");
assert.equal(markerStroke.kind, "marker");
assert.equal(markerStroke.points[0].x, markerStroke.points[1].x);
assert.equal(api.createBoardAssistantObject({ kind: "create-text", text: "   " }, { x: 0, y: 0 }, () => "x"), null);

const history = api.summarizeBoardActivity([{
  id: 1, version: 3, created_at: "2026-11-10T10:00:00.000Z", actor_id: "u", actor_name: "Анна",
  added_count: 2, changed_count: 1, removed_count: 0, item_count: 8, summary: "Добавлены задания",
}]);
assert.ok(history.includes("добавлено 2, изменено 1, удалено 0"));
assert.ok(history.includes("Анна: Добавлены задания"));

console.log(`AI board assistant: parsing, structured search, object creation and history OK; ${mutationScenarios} board mutations passed with hidden-item protection and delete confirmation.`);
