import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createServer } from "vite";

const datasetPath = process.argv[2] ?? "ai-training/acceptance_holdout_v1.json";
const dataset = JSON.parse(await readFile(datasetPath, "utf8"));
const server = await createServer({ configFile: "./vite.config.ts", server: { middlewareMode: true }, appType: "custom" });
try {
  const curriculum = await server.ssrLoadModule("/src/aiCurriculumGenerator.ts");
  const classifier = await server.ssrLoadModule("/src/aiSubjectIntentClassifier.ts");
  const modelJson = await readFile("public/models/aiSubjectIntentModel.json", "utf8");
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(modelJson, { status: 200, headers: { "Content-Type": "application/json" } });
  try { await classifier.loadCurriculumSubjectModel(); }
  finally { globalThis.fetch = originalFetch; }

  const clear = dataset.cases.filter(item => item.subject);
  const ambiguous = dataset.cases.filter(item => !item.subject);
  const perSubject = Object.fromEntries([...new Set(clear.map(item => item.subject))].map(subject => [subject, { total: 0, correct: 0, generated: 0, expectedClarifications: 0 }]));
  const mistakes = [];
  const falseAssignments = [];
  const classifierErrors = [];
  let correct = 0, generated = 0, expectedClarifications = 0, parameterErrors = 0, classifierAccepted = 0, classifierCorrect = 0, clarified = 0;

  for (const item of clear) {
    const parsed = curriculum.parseCurriculumRequest(item.text);
    const modelSubject = classifier.classifyCurriculumSubject(item.text);
    const row = perSubject[item.subject]; row.total += 1;
    const matches = parsed.subject === item.subject;
    if (matches) { correct += 1; row.correct += 1; }
    else mistakes.push({ text: item.text, expected: item.subject, actual: parsed.subject || "<уточнить>", parsedTopic: parsed.topic, canonicalTopicSubject: classifier.matchCanonicalCurriculumTopic(parsed.topic) || "<none>" });
    if (modelSubject) {
      classifierAccepted += 1;
      if (modelSubject === item.subject) classifierCorrect += 1;
      else classifierErrors.push({ text: item.text, expected: item.subject, actual: modelSubject });
    }
    if (parsed.count !== item.count || parsed.grade !== item.grade || parsed.tool !== item.tool || parsed.level !== item.level || (item.olympiad !== undefined && parsed.olympiad !== item.olympiad)) {
      parameterErrors += 1;
      mistakes.push({ text: item.text, expectedParameters: item, actualParameters: parsed });
    }
    if (!matches) continue;
    if (item.expectClarification) {
      try {
        curriculum.generateCurriculumAi(parsed.tool, item.text, parsed.level, parsed.count, parsed.subject);
        mistakes.push({ text: item.text, expected: "clarification due to topic/grade conflict", actual: "generated without clarification" });
      } catch (error) {
        if (/Уточните (?:тему или класс|класс или предмет)/u.test(String(error?.message ?? error))) {
          expectedClarifications += 1;
          row.expectedClarifications += 1;
        }
        else mistakes.push({ text: item.text, expected: "clarification due to topic/grade conflict", generationError: String(error?.message ?? error) });
      }
      continue;
    }
    try {
      const result = curriculum.generateCurriculumAi(parsed.tool, item.text, parsed.level, parsed.count, parsed.subject);
      assert.equal(result.subject, item.subject);
      assert.equal(result.items.length, item.count);
      assert.equal(result.answers.length, item.count);
      row.generated += 1; generated += 1;
    } catch (error) { mistakes.push({ text: item.text, generationError: String(error?.message ?? error) }); }
  }

  for (const item of ambiguous) {
    const parsed = curriculum.parseCurriculumRequest(item.text);
    const modelSubject = classifier.classifyCurriculumSubject(item.text);
    if (!parsed.subject) clarified += 1;
    else falseAssignments.push({ text: item.text, integrated: parsed.subject, classifier: modelSubject || "<уточнить>" });
  }

  const summary = {
    holdoutVersion: dataset.version,
    clearRequests: clear.length,
    integratedSubjectAccuracy: `${correct}/${clear.length}`,
    parametersPreserved: `${clear.length - parameterErrors}/${clear.length}`,
    generatedWithExpectedSubjectAndAnswerCount: `${generated}/${clear.filter(item => !item.expectClarification).length}`,
    expectedTopicGradeConflictsClarified: `${expectedClarifications}/${clear.filter(item => item.expectClarification).length}`,
    ambiguousRequests: ambiguous.length,
    correctlyClarifiedAmbiguous: `${clarified}/${ambiguous.length}`,
    directClassifierAccepted: `${classifierAccepted}/${clear.length}`,
    directClassifierAcceptedPrecision: `${classifierAccepted ? (100 * classifierCorrect / classifierAccepted).toFixed(1) : "0.0"}% (${classifierCorrect}/${classifierAccepted})`,
    perSubject,
    classifierErrors,
    mistakes,
    falseAssignments,
  };
  console.log(JSON.stringify(summary, null, 2));
  const expectedGenerated = clear.filter(item => !item.expectClarification).length;
  if (correct / Math.max(1, clear.length) < 0.97 || parameterErrors || generated !== expectedGenerated || expectedClarifications !== clear.filter(item => item.expectClarification).length || clarified !== ambiguous.length) process.exitCode = 1;
} finally { await server.close(); }
