import { readFile } from "node:fs/promises";
import { createServer } from "vite";

const corpus = JSON.parse(await readFile(new URL("../ai-training/subject_topics.json", import.meta.url), "utf8"));
const modelBytes = await readFile(new URL("../public/models/aiSubjectIntentModel.json", import.meta.url));
let seed = 0x1eaf;
Math.random = () => {
  seed = (seed * 48271) % 0x7fffffff;
  return seed / 0x7fffffff;
};
globalThis.localStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
globalThis.fetch = async () => new Response(modelBytes, { status: 200, headers: { "content-type": "application/json" } });

const server = await createServer({ configFile: "./vite.config.ts", server: { middlewareMode: true }, appType: "custom" });
try {
  const curriculum = await server.ssrLoadModule("/src/aiCurriculumGenerator.ts");
  const intent = await server.ssrLoadModule("/src/aiSubjectIntentClassifier.ts");
  const { generateSubjectExercise } = await server.ssrLoadModule("/src/aiSubjectExerciseBank.ts");
  await intent.loadCurriculumSubjectModel();

  const report = {
    topics: 0,
    exactTopicRecognition: 0,
    generatedSets: 0,
    wrongSubjectSets: 0,
    incompleteSets: 0,
    emptyAnswers: 0,
    repeatedSets: 0,
    repeatedTopics: [],
    topicsWithSpecificExercise: 0,
    topicsUsingSourceSafeRubric: 0,
    parserCases: 0,
    parserFailures: [],
  };

  for (const [subject, topics] of Object.entries(corpus)) {
    for (const topic of topics) {
      report.topics += 1;
      if (curriculum.detectCurriculumSubject(topic) === subject) report.exactTopicRecognition += 1;

      const firstExercise = generateSubjectExercise(subject, topic, "medium", 0);
      if (firstExercise.answer.startsWith("Ключ проверки:")) report.topicsUsingSourceSafeRubric += 1;
      else report.topicsWithSpecificExercise += 1;

      const result = curriculum.generateCurriculumAi("assignment", topic, "medium", 15, subject);
      report.generatedSets += 1;
      if (result.subject !== subject) report.wrongSubjectSets += 1;
      if (result.items.length !== 15 || result.answers.length !== 15) report.incompleteSets += 1;
      if (result.answers.some((answer) => !answer.trim())) report.emptyAnswers += 1;
      const prompts = result.items.map((item) => item.replace(/^\d+\.\s*/, "").replace(/\s+/g, " ").trim().toLocaleLowerCase("ru-RU"));
      if (new Set(prompts).size !== prompts.length) {
        report.repeatedSets += 1;
        report.repeatedTopics.push({ subject, topic });
      }
    }
  }

  const cases = [
    {
      input: "Сделай 10 простых задач по математике на простые числа для 7 класса",
      expected: { subject: "Математика", topic: "простые числа", count: 10, grade: 7, tool: "assignment", level: "easy" },
    },
    {
      input: "Подготовь контрольную на 8 вопросов по физике по закону Ома для 9 класса",
      expected: { subject: "Физика", count: 8, grade: 9, tool: "quiz" },
    },
    {
      input: "Сделай 6 флеш-карточек по химии на атомы",
      expected: { subject: "Химия", count: 6, tool: "flashcards" },
    },
    {
      input: "Нужно 4 вопроса по истории о Петре Первом для 8 класса",
      expected: { subject: "История", count: 4, grade: 8, tool: "quiz" },
    },
    {
      input: "Сделай 8 карточек по английскому Past Simple",
      expected: { subject: "Иностранный язык", count: 8, tool: "flashcards" },
    },
  ];
  for (const { input, expected } of cases) {
    report.parserCases += 1;
    const actual = curriculum.parseCurriculumRequest(input);
    const mismatches = Object.entries(expected).filter(([key, value]) => actual[key] !== value);
    if (mismatches.length) report.parserFailures.push({ input, mismatches: mismatches.map(([key, value]) => ({ key, expected: value, actual: actual[key] })) });
  }

  report.exactTopicRecognitionRate = Number((report.exactTopicRecognition / report.topics).toFixed(4));
  report.specificExerciseCoverageRate = Number((report.topicsWithSpecificExercise / report.topics).toFixed(4));
  console.log(JSON.stringify(report, null, 2));

  const failures = report.exactTopicRecognition !== report.topics
    || report.wrongSubjectSets > 0
    || report.incompleteSets > 0
    || report.emptyAnswers > 0
    || report.repeatedSets > 0
    || report.parserFailures.length > 0;
  if (failures) process.exitCode = 1;
} finally {
  await server.close();
}
