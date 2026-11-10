import { readFile } from "node:fs/promises";
import { createServer } from "vite";

const cases = JSON.parse(await readFile("ai-training/subject_classifier_supplemental.json", "utf8")).cases;
const server = await createServer({ configFile: "./vite.config.ts", server: { middlewareMode: true }, appType: "custom" });
try {
  const curriculum = await server.ssrLoadModule("/src/aiCurriculumGenerator.ts");
  const classifier = await server.ssrLoadModule("/src/aiSubjectIntentClassifier.ts");
  const modelJson = await readFile("public/models/aiSubjectIntentModel.json", "utf8");
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(modelJson, { status: 200, headers: { "Content-Type": "application/json" } });
  try {
    await classifier.loadCurriculumSubjectModel();
  } finally {
    globalThis.fetch = originalFetch;
  }

  const subjects = new Map();
  const unknowns = { total: 0, correctlyAsked: 0, falseSubjects: new Map() };
  const wrong = [];
  let correct = 0;
  let generated = 0;
  const generationFailures = [];
  for (const item of cases) {
    const parsed = curriculum.parseCurriculumRequest(item.text);
    const actual = parsed.subject;
    correct += actual === item.subject ? 1 : 0;
    if (item.subject) {
      const row = subjects.get(item.subject) ?? { total: 0, correct: 0 };
      row.total += 1;
      row.correct += actual === item.subject ? 1 : 0;
      subjects.set(item.subject, row);
    } else {
      unknowns.total += 1;
      if (!actual) unknowns.correctlyAsked += 1;
      else unknowns.falseSubjects.set(actual, (unknowns.falseSubjects.get(actual) ?? 0) + 1);
    }
    if (actual !== item.subject) wrong.push({ text: item.text, expected: item.subject || "<уточнить>", actual: actual || "<уточнить>", parsedTopic: parsed.topic });
    if (item.subject) {
      try {
        const result = curriculum.generateCurriculumAi(parsed.tool, item.text, parsed.level, parsed.count);
        const issues = [];
        if (result.subject !== item.subject) issues.push(`предмет ${result.subject}`);
        if (!result.items.length || result.items.length !== result.answers.length) issues.push("пустые задания или ключи");
        if (!parsed.topic || !result.title.includes(parsed.topic)) issues.push(`потеряна тема «${parsed.topic}»`);
        if (issues.length) generationFailures.push({ text: item.text, expected: item.subject, issues });
        else generated += 1;
      } catch (error) {
        generationFailures.push({ text: item.text, expected: item.subject, issues: [String(error?.message ?? error)] });
      }
    } else {
      try {
        curriculum.generateCurriculumAi(parsed.tool, item.text, parsed.level, parsed.count);
        generationFailures.push({ text: item.text, expected: "<уточнить>", issues: ["генерация продолжилась без определённого предмета"] });
      } catch {
        // An ambiguous request must stop for clarification before generation.
      }
    }
  }

  console.log(`Сквозной разбор разработческого набора: ${correct}/${cases.length} (${(100 * correct / cases.length).toFixed(1)}%)`);
  console.log(`Генерация с сохранением предмета, темы и ключей: ${generated}/${cases.length - unknowns.total}; запросы без предмета остановлены до генерации: ${unknowns.correctlyAsked}/${unknowns.total}`);
  console.log(`Предметные запросы: ${cases.length - unknowns.total}; запросы без указания предмета: корректно уточнены ${unknowns.correctlyAsked}/${unknowns.total}`);
  for (const [subject, row] of subjects) console.log(`  ${subject}: ${row.correct}/${row.total} (${(100 * row.correct / row.total).toFixed(1)}%)`);
  if (unknowns.falseSubjects.size) console.log("Неоднозначные ошибочно отнесены: " + [...unknowns.falseSubjects].map(([subject, n]) => `${subject}=${n}`).join(", "));
  for (const row of wrong) console.log(`  Ошибка: ${JSON.stringify(row)}`);
  for (const row of generationFailures) console.log(`  Генерация: ${JSON.stringify(row)}`);
  if (wrong.length || generationFailures.length) process.exitCode = 1;
} finally {
  await server.close();
}
