import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { createServer } from "vite";

const outputPath = "ai-training/teacher-review-pack.md";
const reviewCases = [
  { id: "M1", text: "Составь 3 задания для 6 класса по математике на сложение и вычитание дробей", subject: "Математика", count: 3, grade: 6, tool: "assignment", level: "medium" },
  { id: "M2", text: "Нужны 3 сложные задачи на теорему Пифагора для 8 класса", subject: "Математика", count: 3, grade: 8, tool: "assignment", level: "hard" },
  { id: "M3", text: "Подготовь 3 олимпиадные задачи по математике на делимость чисел", subject: "Математика", count: 3, grade: null, tool: "assignment", level: "hard", olympiad: true },
  { id: "F1", text: "Сделай 3 задачи по физике на плотность вещества для 7 класса", subject: "Физика", count: 3, grade: 7, tool: "assignment", level: "medium" },
  { id: "F2", text: "Подготовь 3 вопроса по физике на закон Ома для 8 класса", subject: "Физика", count: 3, grade: 8, tool: "quiz", level: "medium" },
  { id: "F3", text: "Нужно 3 нестандартных задачи по физике на сохранение энергии для 9 класса", subject: "Физика", count: 3, grade: 9, tool: "assignment", level: "hard", olympiad: true },
  { id: "C1", text: "Составь 3 упражнения по химии для 8 класса на валентность", subject: "Химия", count: 3, grade: 8, tool: "assignment", level: "medium" },
  { id: "C2", text: "Нужно 3 карточки по химии на расчёт молярной массы для 9 класса", subject: "Химия", count: 3, grade: 9, tool: "flashcards", level: "medium" },
  { id: "C3", text: "Подготовь 3 олимпиадные задачи по химии на окислительно-восстановительные реакции", subject: "Химия", count: 3, grade: null, tool: "assignment", level: "hard", olympiad: true },
  { id: "R1", text: "Дай 3 упражнения по русскому языку для 5 класса на безударные гласные в корне", subject: "Русский язык", count: 3, grade: 5, tool: "assignment", level: "medium" },
  { id: "R2", text: "Сделай 3 карточки по русскому языку на причастный оборот для 7 класса", subject: "Русский язык", count: 3, grade: 7, tool: "flashcards", level: "medium" },
  { id: "R3", text: "Составь 3 сложных задания по русскому языку для 9 класса на сложноподчинённые предложения", subject: "Русский язык", count: 3, grade: 9, tool: "assignment", level: "hard" },
];

const server = await createServer({ configFile: "./vite.config.ts", server: { middlewareMode: true }, appType: "custom" });
let markdown = "";
try {
  const curriculum = await server.ssrLoadModule("/src/aiCurriculumGenerator.ts");
  const { AI_SUBJECT_MODEL_VERSION } = await server.ssrLoadModule("/src/aiSubjectIntentModelVersion.ts");
  const sections = [];
  for (const sample of reviewCases) {
    const parsed = curriculum.parseCurriculumRequest(sample.text);
    assert.equal(parsed.subject, sample.subject, `${sample.id}: предмет`);
    assert.equal(parsed.count, sample.count, `${sample.id}: количество`);
    assert.equal(parsed.grade, sample.grade, `${sample.id}: класс`);
    assert.equal(parsed.tool, sample.tool, `${sample.id}: формат`);
    assert.equal(parsed.level, sample.level, `${sample.id}: сложность`);
    if (sample.olympiad) assert.equal(parsed.olympiad, true, `${sample.id}: олимпиадный запрос`);
    const result = curriculum.generateCurriculumAi(sample.tool, sample.text, sample.level, sample.count, sample.subject);
    assert.equal(result.subject, sample.subject, `${sample.id}: предмет генерации`);
    assert.equal(result.items.length, sample.count, `${sample.id}: число заданий`);
    assert.equal(result.answers.length, sample.count, `${sample.id}: число ответов`);
    sections.push({ sample, parsed, result });
  }

  markdown = [
    "# Ручная оценка генерации Lectrus",
    "",
    `Создано: ${new Date().toISOString().slice(0, 10)} · версия модели маршрутизации: \`${AI_SUBJECT_MODEL_VERSION}\``,
    "",
    "Пакет сформирован из текущего локального генератора. Автоматическая проверка подтвердила предмет, класс, формат, сложность, количество заданий и наличие ключей; это **не** подтверждение содержательной правильности. Оценку должен заполнить преподаватель, сверяя задания с учебной программой.",
    "",
    "## Как оценивать",
    "",
    "Оценивайте каждое задание отдельно: (1) корректно и решаемо; (2) ответ/ключ верен; (3) соответствует заявленному классу; (4) формулировка ясна. Для каждого критерия отметьте «Да» или «Нет» и поясните любой ответ «Нет». Для олимпиадных формулировок дополнительно отметьте, требует ли задача нестандартного рассуждения. Ключи расположены ниже заданий, чтобы сначала можно было независимо решить задачу.",
    "",
    "Пакет содержит отдельную строку оценки для всех 36 заданий. Считайте задание принятым, только если все четыре критерия отмечены «Да». Не засчитывайте пустые или спорные пункты как принятые.",
    "",
    "## Задания для оценки",
    "",
    ...sections.flatMap(({ sample, parsed, result }) => [
      `### ${sample.id} · ${sample.subject}`,
      "",
      `**Запрос:** ${sample.text}`,
      `**Разобрано:** тема «${parsed.topic}»; класс ${parsed.grade ?? "не указан"}; ${parsed.count} шт.; ${sample.tool}; сложность ${parsed.level}${sample.olympiad ? "; нестандартная/олимпиадная формулировка" : ""}.`,
      "",
      ...result.items.flatMap((item, index) => {
        const displayItem = item.startsWith("Карточка ")
          ? item
          : `**Задание ${index + 1}:** ${item.replace(/^(?:\d+\.\s*)+/u, "")}`;
        assert.doesNotMatch(displayItem, /^\*\*Задание \d+:\*\*\s+\d+\.\s+\d+\./u, `${sample.id}.${index + 1}: duplicate task numbering`);
        return [
          displayItem,
          `**Проверка ${sample.id}.${index + 1}:** решаемость ___ · ключ ___ · класс ___ · ясность ___${sample.olympiad ? " · нестандартность ___" : ""} · исправление/пояснение: ______________________________`,
          "",
        ];
      }),
      "",
      "**Комментарий к набору:** __________________________________________________________________",
      "",
    ]),
    "## Ключи для проверки",
    "",
    "Сначала оцените постановки, затем откройте ключи.",
    "",
    ...sections.flatMap(({ sample, result }) => [
      `### ${sample.id}`,
      "",
      ...result.answers.map((answer) => `- ${answer}`),
      "",
    ]),
    "## Итог преподавателя",
    "",
    "- Оценено заданий: ___ / 36",
    "- Принято заданий (все четыре критерия — «Да»): ___ / 36",
    "- Принятых заданий по предметам: математика ___ / 9 · физика ___ / 9 · химия ___ / 9 · русский язык ___ / 9",
    "- Исправления, обязательные до выпуска: ___",
    "- Предмет и классы преподавателя: ___",
    "- Дата и подпись/инициалы: ___",
    "",
  ].join("\n");
} finally {
  await server.close();
}

await writeFile(outputPath, markdown, "utf8");
console.log(`Создан ${outputPath}: ${reviewCases.length} наборов, ${reviewCases.length * 3} заданий; все параметры разбора и количество ответов сверены автоматически.`);
