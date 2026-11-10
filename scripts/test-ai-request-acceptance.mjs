import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createServer } from "vite";
import { additionalAiRequestAcceptanceCases } from "./ai-request-acceptance-data.mjs";

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

  const bySubject = new Map();
  const byGrade = new Map();
  const byTool = new Map();
  for (const [subject, input, topicPattern, count, grade, tool, level, olympiad] of additionalAiRequestAcceptanceCases) {
    const parsed = curriculum.parseCurriculumRequest(input);
    const expected = { subject, count, grade, tool, level, olympiad, hasCount: true, hasTool: true, hasLevel: level !== "medium" };
    for (const [key, value] of Object.entries(expected)) {
      assert.equal(parsed[key], value, `Request parameter ${key} was misread in: ${input}`);
    }
    assert.match(parsed.topic, topicPattern, `Topic was lost or changed in: ${input}; parsed: ${parsed.topic}`);

    const generated = curriculum.generateCurriculumAi(parsed.tool, input, parsed.level, parsed.count);
    assert.equal(generated.subject, subject, `Generation changed the subject for: ${input}`);
    assert.equal(generated.items.length, count, `Generation changed the requested amount for: ${input}`);
    assert.equal(generated.answers.length, count, `Answer count does not match request: ${input}`);
    assert.ok(generated.title.includes(parsed.topic), `Generated title dropped the parsed topic for: ${input}`);
    if (grade !== null) assert.ok(generated.title.includes(`${grade} класс`), `Generated title dropped class ${grade}: ${input}`);
    if (level === "easy") {
      const referenceTopic = grade === null ? parsed.topic : `${parsed.topic} для ${grade} класса`;
      const medium = curriculum.generateCurriculumAi(parsed.tool, referenceTopic, "medium", parsed.count, subject);
      assert.notDeepEqual(generated.items, medium.items, `Easy difficulty did not change generation: ${input}`);
    }

    bySubject.set(subject, (bySubject.get(subject) ?? 0) + 1);
    if (grade !== null) byGrade.set(grade, (byGrade.get(grade) ?? 0) + 1);
    byTool.set(tool, (byTool.get(tool) ?? 0) + 1);
  }

  assert.equal(additionalAiRequestAcceptanceCases.length, 146);
  assert.equal(bySubject.size, 11, "Acceptance set must cover all supported subjects");
  for (const subject of ["Математика", "Физика", "Химия", "Биология", "География", "Русский язык", "Литература", "История", "Обществознание", "Информатика", "Иностранный язык"]) {
    assert.ok((bySubject.get(subject) ?? 0) >= 13, `Insufficient independent requests for ${subject}`);
  }
  for (let grade = 1; grade <= 11; grade += 1) assert.ok(byGrade.has(grade), `No independent request for grade ${grade}`);
  for (const tool of ["assignment", "quiz", "flashcards"]) assert.ok(byTool.has(tool), `No independent request for tool ${tool}`);

  console.log(`AI request acceptance: ${additionalAiRequestAcceptanceCases.length} independent natural requests across 11 subjects, grades 1–11 and all output formats; parameters preserved through generation.`);
} finally {
  await server.close();
}
