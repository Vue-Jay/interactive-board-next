import { readFile } from "node:fs/promises";
import { createServer } from "vite";

const { cases } = JSON.parse(await readFile("ai-training/subject_intent_diagnostic.json", "utf8"));
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

  const expectedSubjects = new Set(cases.map((item) => item.subject).filter(Boolean));
  const perSubject = Object.fromEntries([...expectedSubjects].sort().map((subject) => [subject, { total: 0, parsedCorrect: 0, classifierAccepted: 0, classifierCorrect: 0, generated: 0 }]));
  const wrong = [];
  const falseAssignments = [];
  let parsedCorrect = 0;
  let classifierAccepted = 0;
  let classifierCorrect = 0;
  let correctlyClarified = 0;
  let generated = 0;
  const generationFailures = [];

  for (const item of cases) {
    const modelSubject = classifier.classifyCurriculumSubject(item.text);
    const parsed = curriculum.parseCurriculumRequest(item.text);
    if (parsed.subject === item.subject) parsedCorrect += 1;
    if (item.subject) {
      const row = perSubject[item.subject];
      row.total += 1;
      if (parsed.subject === item.subject) row.parsedCorrect += 1;
      if (modelSubject) {
        classifierAccepted += 1;
        row.classifierAccepted += 1;
        if (modelSubject === item.subject) {
          classifierCorrect += 1;
          row.classifierCorrect += 1;
        }
      }
      if (parsed.subject !== item.subject) wrong.push({ text: item.text, expected: item.subject, classifier: modelSubject || "<уточнить>", parsed: parsed.subject || "<уточнить>" });
      if (parsed.subject === item.subject) {
        try {
          const result = curriculum.generateCurriculumAi(parsed.tool, item.text, parsed.level, parsed.count);
          if (result.subject !== item.subject || !result.items.length || result.items.length !== result.answers.length) {
            generationFailures.push({ text: item.text, expected: item.subject, actual: result.subject, items: result.items.length, answers: result.answers.length });
          } else {
            generated += 1;
            row.generated += 1;
          }
        } catch (error) {
          generationFailures.push({ text: item.text, expected: item.subject, error: String(error?.message ?? error) });
        }
      }
    } else if (!parsed.subject) {
      correctlyClarified += 1;
    } else {
      falseAssignments.push({ text: item.text, actual: parsed.subject, classifier: modelSubject || "<уточнить>" });
    }
  }

  const subjectCases = cases.filter((item) => item.subject).length;
  const ambiguousCases = cases.length - subjectCases;
  const summary = {
    total: cases.length,
    subjectCases,
    ambiguousCases,
    integratedParserAccuracy: `${parsedCorrect}/${cases.length} (${(100 * parsedCorrect / cases.length).toFixed(1)}%)`,
    classifierRawAccuracy: `${classifierCorrect}/${subjectCases} (${(100 * classifierCorrect / subjectCases).toFixed(1)}%)`,
    classifierAcceptedPrecision: `${classifierAccepted ? (100 * classifierCorrect / classifierAccepted).toFixed(1) : "0.0"}% (${classifierCorrect}/${classifierAccepted})`,
    classifierCoverage: `${(100 * classifierAccepted / subjectCases).toFixed(1)}% (${classifierAccepted}/${subjectCases})`,
    correctlyClarifiedAmbiguous: `${correctlyClarified}/${ambiguousCases}`,
    falseAssignments: falseAssignments.length,
    generatedWithCorrectSubjectAndAnswerCount: `${generated}/${subjectCases}`,
    perSubject,
    wrong,
    falseAssignmentsDetail: falseAssignments,
    generationFailures,
  };
  console.log(JSON.stringify(summary, null, 2));
  if (parsedCorrect / cases.length < 0.97 || classifierCorrect / Math.max(1, classifierAccepted) < 0.99 || correctlyClarified !== ambiguousCases || generationFailures.length) process.exitCode = 1;
} finally {
  await server.close();
}
