import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";

const file = "src/aiBoardTransfer.ts";
const source = readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
const output = ts.transpileModule(source, {
  fileName: file,
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
}).outputText.replace(/^export\s+/gm, "");
const { createAiBoardItems } = new Function(`${output}\nreturn { createAiBoardItems };`)();
let nextId = 0;
const createId = () => `ai-transfer-${++nextId}`;
const center = { x: 500, y: 300 };

const ordinaryQuiz = createAiBoardItems({
  id: "quiz", tool: "quiz", topic: "треугольники", subject: "Математика",
  title: "Проверочная работа · треугольники",
  body: "1. Найди периметр треугольника со сторонами 3, 4 и 5 см.\n2. Найди площадь прямоугольного треугольника с катетами 6 и 8 см.",
  answers: ["12 см", "24 см²"], createdAt: "2026-11-10T00:00:00.000Z",
}, center, createId);
assert.equal(ordinaryQuiz.length, 1);
assert.equal(ordinaryQuiz[0].kind, "checklist", "A written test without choices must not become a fake multiple-choice card");
assert.deepEqual(ordinaryQuiz[0].checklistItems, [
  "Найди периметр треугольника со сторонами 3, 4 и 5 см.",
  "Найди площадь прямоугольного треугольника с катетами 6 и 8 см.",
]);

const validQuiz = createAiBoardItems({
  id: "quiz-mc", tool: "quiz", topic: "проверка", subject: "История",
  title: "Проверка знаний",
  body: "1. Где возникла древнегреческая демократия?\nA) Афины\nБ) Спарта\nВ) Рим\nГ) Карфаген\nОтвет: A\n2. Как назывался народный совет в Афинах?\nA) Сенат\nB) Экклесия\nC) Форум\nD) Легион\nОтвет: B",
  answers: [], createdAt: "2026-11-10T00:00:00.000Z",
}, center, createId);
assert.equal(validQuiz.length, 2);
assert.ok(validQuiz.every(item => item.kind === "quiz"));
assert.deepEqual(validQuiz.map(item => item.quizOptions), [
  ["Афины", "Спарта", "Рим", "Карфаген"],
  ["Сенат", "Экклесия", "Форум", "Легион"],
]);
assert.deepEqual(validQuiz.map(item => item.quizCorrect), [0, 1]);

const incompleteQuiz = createAiBoardItems({
  id: "bad-quiz", tool: "quiz", topic: "проверка", subject: "Физика",
  title: "Проверка знаний",
  body: "1. Какая формула выражает закон Ома?\nA) I = U/R\nB) F = ma",
  answers: [], createdAt: "2026-11-10T00:00:00.000Z",
}, center, createId);
assert.equal(incompleteQuiz[0].kind, "checklist", "Incomplete choice data must stay an editable written task");

const assignment = createAiBoardItems({
  id: "assignment", tool: "assignment", topic: "дроби", subject: "Математика",
  title: "Практика · дроби",
  body: "1. Сократи дробь 6/8.\nРеши и запиши ход решения.\n2. Сравни 2/3 и 3/5.",
  answers: ["3/4", "2/3 > 3/5"], createdAt: "2026-11-10T00:00:00.000Z",
}, center, createId);
assert.deepEqual(assignment[0].checklistItems, [
  "Сократи дробь 6/8.\nРеши и запиши ход решения.",
  "Сравни 2/3 и 3/5.",
], "Continuation lines should remain attached to their task");
const longAssignment = createAiBoardItems({
  id: "long-assignment", tool: "assignment", topic: "молярная масса", subject: "Химия",
  title: "Практика · молярная масса",
  body: Array.from({ length: 5 }, (_, index) => `${index + 1}. Вычисли молярную массу вещества по формуле и затем найди массу указанного количества вещества. Используй относительные атомные массы из таблицы.`).join("\n\n"),
  answers: [], createdAt: "2026-11-10T00:00:00.000Z",
}, center, createId);
assert.equal(longAssignment.length, 1);
assert.ok(longAssignment[0].width > 380 && longAssignment[0].height > 310,
  "Long generated assignments must get a larger board object before insertion");
assert.ok(longAssignment[0].height >= 350, "Long task text must have room to wrap without manual resizing");

const legacyMathDraft = createAiBoardItems({
  id: "legacy-math", tool: "assignment", topic: "действия", subject: "Математика",
  title: "Практика · действия",
  body: "Вычисли 12 + 8.\nДля 2 класса: Реши один короткий пример.\nВычисли 25 − 7.\nДля 2 класса: Реши один короткий пример.",
  answers: ["20", "18"], createdAt: "2026-11-10T00:00:00.000Z",
}, center, createId);
assert.deepEqual(legacyMathDraft[0].checklistItems, [
  "Вычисли 12 + 8.\nДля 2 класса: Реши один короткий пример.",
  "Вычисли 25 − 7.\nДля 2 класса: Реши один короткий пример.",
], "Legacy unnumbered math drafts should keep each task separate");

const separatedMathDraft = createAiBoardItems({
  id: "separated-math", tool: "assignment", topic: "действия", subject: "Математика",
  title: "Практика · действия", body: "Вычисли 12 + 8.\n\nВычисли 25 − 7.",
  answers: ["20", "18"], createdAt: "2026-11-10T00:00:00.000Z",
}, center, createId);
assert.deepEqual(separatedMathDraft[0].checklistItems, ["Вычисли 12 + 8.", "Вычисли 25 − 7."],
  "Blank-line-separated tasks should transfer without merging");

const flashcards = createAiBoardItems({
  id: "cards", tool: "flashcards", topic: "части речи", subject: "Русский язык",
  title: "Карточки",
  body: "Карточка 1\nВопрос: Что обозначает имя существительное?\nОтвет: Предмет.\n\nКарточка 2\nВопрос: На какие вопросы отвечает?\nОтвет: Кто? Что?",
  answers: [], createdAt: "2026-11-10T00:00:00.000Z",
}, center, createId);
assert.equal(flashcards.length, 2);
assert.deepEqual(flashcards.map(item => [item.kind, item.text, item.flashcardBack]), [
  ["flashcard", "Что обозначает имя существительное?", "Предмет."],
  ["flashcard", "На какие вопросы отвечает?", "Кто? Что?"],
]);
const longCard = createAiBoardItems({
  id: "long-card", tool: "flashcards", topic: "проверка", subject: "Биология", title: "Карточки",
  body: `Карточка 1\nВопрос: ${"Как устроена клетка и какую функцию выполняют её основные органоиды? ".repeat(3)}\nОтвет: ${"Клеточная мембрана регулирует обмен веществ, ядро хранит наследственную информацию, а органоиды выполняют специализированные функции. ".repeat(2)}`,
  answers: [], createdAt: "2026-11-10T00:00:00.000Z",
}, center, createId);
assert.ok(longCard[0].width > 260 && longCard[0].height > 190,
  "Long question and answer text must get a larger flashcard");

console.log("AI → board transfer: written tests, real multiple-choice keys, task grouping and flashcards OK");
