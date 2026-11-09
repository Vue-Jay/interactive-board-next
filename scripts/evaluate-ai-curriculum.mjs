import { readFile } from "node:fs/promises";
import { createServer } from "vite";

const corpus = JSON.parse(await readFile(new URL("../ai-training/subject_topics.json", import.meta.url), "utf8"));
const gradeMap = JSON.parse(await readFile(new URL("../ai-training/curriculum_grade_map.json", import.meta.url), "utf8"));
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
    gradeMapTopicsBySubject: {},
    gradeMapMissingTopicsBySubject: {},
    gradeMapErrors: [],
  };

  for (const [subject, mapping] of Object.entries(gradeMap.subjects ?? {})) {
    const sourceTopics = new Set(corpus[subject] ?? []);
    const mappedTopics = Object.values(mapping.topicsByGradeBand ?? {}).flat();
    report.gradeMapTopicsBySubject[subject] = mappedTopics.length;
    for (const topic of mappedTopics) if (!sourceTopics.has(topic)) report.gradeMapErrors.push(`${subject}: тема отсутствует в корпусе: ${topic}`);
    if (new Set(mappedTopics).size !== mappedTopics.length) report.gradeMapErrors.push(`${subject}: тема размечена более чем в одной полосе классов`);
    const mappedSet = new Set(mappedTopics);
    const missingTopics = [...sourceTopics].filter((topic) => !mappedSet.has(topic));
    report.gradeMapMissingTopicsBySubject[subject] = missingTopics.length;
    if (missingTopics.length) report.gradeMapErrors.push(`${subject}: не распределены темы корпуса (${missingTopics.length})`);
    for (const band of Object.keys(mapping.topicsByGradeBand ?? {})) {
      if (!/^([1-9]|1[01])(-([1-9]|1[01]))?$/.test(band)) report.gradeMapErrors.push(`${subject}: некорректный диапазон классов ${band}`);
    }
  }

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
      expected: { subject: "Математика", topic: "простые числа", count: 10, grade: 7, tool: "assignment", level: "easy", hasCount: true, hasTool: true, hasLevel: true },
    },
    {
      input: "10 задач на треугольники для 7 класса",
      expected: { subject: "Математика", topic: "треугольники", count: 10, grade: 7, tool: "assignment", hasCount: true, hasTool: true },
    },
    {
      input: "Подготовь контрольную на 8 вопросов по физике по закону Ома для 9 класса",
      expected: { subject: "Физика", topic: "закону Ома", count: 8, grade: 9, tool: "quiz", hasCount: true, hasTool: true },
    },
    {
      input: "Сделай 6 флеш-карточек по химии на атомы",
      expected: { subject: "Химия", topic: "атомы", count: 6, tool: "flashcards", hasCount: true, hasTool: true },
    },
    {
      input: "Нужно 4 вопроса по истории о Петре Первом для 8 класса",
      expected: { subject: "История", topic: "Петре Первом", count: 4, grade: 8, tool: "quiz", hasCount: true, hasTool: true },
    },
    {
      input: "Сделай 8 карточек по английскому Past Simple",
      expected: { subject: "Иностранный язык", topic: "Past Simple", count: 8, tool: "flashcards", hasCount: true, hasTool: true },
    },
    {
      input: "Составь 12 заданий по химии на реакцию нейтрализации для 8 класса, посложнее",
      expected: { subject: "Химия", topic: "реакцию нейтрализации", count: 12, grade: 8, tool: "assignment", level: "hard", hasCount: true, hasTool: true, hasLevel: true },
    },
    {
      input: "Сделай 5 простых упражнений по русскому языку на безударные гласные",
      expected: { subject: "Русский язык", topic: "безударные гласные", count: 5, tool: "assignment", level: "easy", hasCount: true, hasTool: true, hasLevel: true },
    },
    {
      input: "Нужно 3 задания по географии на масштаб карты для шестого класса",
      expected: { subject: "География", topic: "масштаб карты", count: 3, grade: 6, tool: "assignment", hasCount: true, hasTool: true },
    },
    {
      input: "Подготовь викторину на 20 вопросов по биологии о клетке",
      expected: { subject: "Биология", topic: "клетке", count: 15, tool: "quiz", hasCount: true, hasTool: true },
    },
    {
      input: "Дай восемь задач по математике на проценты, для начинающих",
      expected: { subject: "Математика", topic: "проценты", count: 8, tool: "assignment", level: "easy", hasCount: true, hasTool: true, hasLevel: true },
    },
    {
      input: "Придумай пять заданий про алгоритмы с условиями",
      expected: { subject: "Информатика", topic: "алгоритмы с условиями", count: 5, tool: "assignment", hasCount: true, hasTool: true },
    },
    {
      input: "Линейные уравнения",
      args: ["Математика", 7, "hard", "quiz"],
      expected: { subject: "Математика", topic: "Линейные уравнения", count: 7, grade: null, tool: "quiz", level: "hard", hasCount: false, hasTool: false, hasLevel: false },
    },
  ];
  for (const { input, args = [], expected } of cases) {
    report.parserCases += 1;
    const actual = curriculum.parseCurriculumRequest(input, ...args);
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
    || report.gradeMapErrors.length > 0
    || report.parserFailures.length > 0;
  if (failures) process.exitCode = 1;
} finally {
  await server.close();
}
