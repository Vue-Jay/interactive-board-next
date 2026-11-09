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
let modelFetchRequests = 0;
let offlineFetchAttempts = 0;
globalThis.fetch = async () => {
  modelFetchRequests += 1;
  return new Response(modelBytes, { status: 200, headers: { "content-type": "application/json" } });
};

const server = await createServer({ configFile: "./vite.config.ts", server: { middlewareMode: true }, appType: "custom" });
try {
  const curriculum = await server.ssrLoadModule("/src/aiCurriculumGenerator.ts");
  const intent = await server.ssrLoadModule("/src/aiSubjectIntentClassifier.ts");
  const boardTransfer = await server.ssrLoadModule("/src/aiBoardTransfer.ts");
  await intent.loadCurriculumSubjectModel();
  const modelFetchesOnWarmup = modelFetchRequests;
  globalThis.fetch = async () => {
    offlineFetchAttempts += 1;
    throw new Error("offline acceptance: network is unavailable after the model is loaded");
  };

  const report = {
    topics: 0,
    exactTopicRecognition: 0,
    exactTopicRecognitionFailures: [],
    generatedSets: 0,
    wrongSubjectSets: 0,
    incompleteSets: 0,
    emptyAnswers: 0,
    repeatedSets: 0,
    repeatedTopics: [],
    topicsWithSpecificExercise: 0,
    topicsUsingSourceSafeRubric: 0,
    exerciseCoverageBySubject: {},
    specificTopicsBySubject: {},
    rubricTopicsBySubject: {},
    mathTopicsByGenerator: {},
    parserCases: 0,
    parserFailures: [],
    generatedParserCases: 0,
    generatedParserFailures: [],
    generatedParserCasesBySubject: {},
    generatedParserCasesByGrade: {},
    boardTransferCases: 0,
    boardTransferFailures: [],
    boardTransferCasesByTool: {},
    boardTransferCasesBySubject: {},
    independentParserCases: 0,
    independentParserFailures: [],
    gradeGenerationCases: 0,
    gradeGenerationFailures: [],
    gradeOneMathChecks: 0,
    gradeOneMathFailures: [],
    gradeTwoMathChecks: 0,
    gradeTwoMathFailures: [],
    gradeThreeMathChecks: 0,
    gradeThreeMathFailures: [],
    gradeFourMathChecks: 0,
    gradeFourMathFailures: [],
    primaryMathAnswerChecks: 0,
    primaryMathAnswerFailures: [],
    olympiadMathChecks: 0,
    olympiadMathFailures: [],
    runtimeGradeMapChecks: 0,
    runtimeGradeMapFailures: [],
    gradeMismatchChecks: 0,
    gradeMismatchFailures: [],
    officialCoverageBySubject: {},
    officialCoverageFailures: [],
    modelFetchesOnWarmup,
    offlineGenerationCases: 0,
    offlineFetchAttempts: 0,
    mathFocusedChecks: 0,
    mathFocusedFailures: [],
    physicsFocusedChecks: 0,
    physicsFocusedFailures: [],
    socialStudiesFocusedChecks: 0,
    socialStudiesFocusedFailures: [],
    literatureFactChecks: 0,
    literatureFactFailures: [],
    gradeMapTopicsBySubject: {},
    gradeMapTopicsByGrade: {},
    gradeMapMissingTopicsBySubject: {},
    gradeMapExcludedTopicsBySubject: {},
    gradeMapErrors: [],
  };

  for (const [subject, mapping] of Object.entries(gradeMap.subjects ?? {})) {
    const sourceTopics = new Set(corpus[subject] ?? []);
    const mappedTopics = Object.values(mapping.topicsByGradeBand ?? mapping.topicsByGrade ?? {}).flat();
    report.gradeMapTopicsByGrade[subject] = Object.fromEntries(Object.entries(mapping.topicsByGradeBand ?? mapping.topicsByGrade ?? {}).map(([grade, topics]) => [grade, topics.length]));
    const excludedTopics = mapping.outOfBasicCourse ?? [];
    report.gradeMapTopicsBySubject[subject] = mappedTopics.length;
    for (const topic of mappedTopics) if (!sourceTopics.has(topic)) report.gradeMapErrors.push(`${subject}: тема отсутствует в корпусе: ${topic}`);
    if (new Set(mappedTopics).size !== mappedTopics.length) report.gradeMapErrors.push(`${subject}: тема размечена более чем в одной полосе классов`);
    for (const topic of excludedTopics) {
      if (!sourceTopics.has(topic)) report.gradeMapErrors.push(`${subject}: тема в списке расширения отсутствует в корпусе: ${topic}`);
      if (mappedTopics.includes(topic)) report.gradeMapErrors.push(`${subject}: тема одновременно размечена в программе и в списке расширения: ${topic}`);
    }
    if (new Set(excludedTopics).size !== excludedTopics.length) report.gradeMapErrors.push(`${subject}: тема повторяется в списке расширения`);
    report.gradeMapExcludedTopicsBySubject[subject] = excludedTopics.length;
    const mappedSet = new Set(mappedTopics);
    const excludedSet = new Set(excludedTopics);
    const missingTopics = [...sourceTopics].filter((topic) => !mappedSet.has(topic) && !excludedSet.has(topic));
    report.gradeMapMissingTopicsBySubject[subject] = missingTopics.length;
    if (missingTopics.length) report.gradeMapErrors.push(`${subject}: не распределены темы корпуса (${missingTopics.length})`);
    const gradeKeys = Object.keys(mapping.topicsByGradeBand ?? mapping.topicsByGrade ?? {});
    const exactGradeMap = Boolean(mapping.topicsByGrade);
    for (const band of gradeKeys) {
      const pattern = exactGradeMap ? /^([1-9]|1[01])$/ : /^([1-9]|1[01])(-([1-9]|1[01]))?$/;
      if (!pattern.test(band)) report.gradeMapErrors.push(`${subject}: некорректный класс или диапазон классов ${band}`);
      for (const topic of (mapping.topicsByGradeBand ?? mapping.topicsByGrade ?? {})[band] ?? []) {
        report.runtimeGradeMapChecks += 1;
        const actualBand = intent.matchCanonicalCurriculumGrade(topic, subject);
        if (actualBand !== band) report.runtimeGradeMapFailures.push({ subject, topic, expected: band, actual: actualBand });
      }
    }
    for (const topic of excludedTopics) {
      report.runtimeGradeMapChecks += 1;
      const actualBand = intent.matchCanonicalCurriculumGrade(topic, subject);
      if (actualBand) report.runtimeGradeMapFailures.push({ subject, topic, expected: "", actual: actualBand });
    }
    for (const [grade, audit] of Object.entries(mapping.officialCoverage?.grades ?? {})) {
      const codes = audit.contentCodes ?? [];
      const covered = new Set(Object.values(audit.topicCodes ?? {}).flat());
      const gradeTopics = new Set((mapping.topicsByGradeBand ?? mapping.topicsByGrade ?? {})[grade] ?? []);
      const absentCodes = codes.filter((code) => !covered.has(code));
      const unknownTopics = Object.keys(audit.topicCodes ?? {}).filter((topic) => !sourceTopics.has(topic) || !gradeTopics.has(topic));
      const rate = codes.length ? Number(((codes.length - absentCodes.length) / codes.length).toFixed(4)) : 0;
      report.officialCoverageBySubject[subject] ??= {};
      report.officialCoverageBySubject[subject][grade] = { codes: codes.length, covered: codes.length - absentCodes.length, rate, source: audit.source };
      if (rate < 0.95 || unknownTopics.length) report.officialCoverageFailures.push({ subject, grade, absentCodes, unknownTopics, rate });
    }
  }

  const gradeOneMathTopics = [
    "числа и цифры от 0 до 20",
    "состав числа в пределах 10",
    "сложение и вычитание в пределах 20",
    "простые текстовые задачи в одно действие",
    "измерение длины отрезка в сантиметрах",
    "геометрические фигуры начальной школы",
    "положение предметов и пространственные отношения",
    "таблицы и числовые закономерности",
    "верные и неверные математические утверждения",
    "двухшаговые инструкции с вычислениями и построением",
  ];
  for (const topic of gradeOneMathTopics) {
    const generated = curriculum.generateCurriculumAi("assignment", `${topic} для 1 класса`, "medium", 15, "Математика");
    for (let index = 0; index < generated.items.length; index += 1) {
      report.gradeOneMathChecks += 1;
      const prompt = generated.items[index].split("\nДля 1 класса:")[0];
      const answer = generated.answers[index] ?? "";
      const failures = [];
      if (!generated.items[index].includes("Для 1 класса:")) failures.push("нет инструкции для 1 класса");
      if (!answer.trim() || answer.startsWith("Ключ проверки:")) failures.push("нет конкретного проверяемого ответа");
      if (topic === "сложение и вычитание в пределах 20") {
        const match = prompt.match(/Вычисли (\d+) ([+−]) (\d+)\./);
        if (!match) failures.push("не распознано простое арифметическое условие");
        else {
          const left = Number(match[1]), right = Number(match[3]);
          const result = match[2] === "+" ? left + right : left - right;
          if (left > 20 || right > 20 || result < 0 || result > 20 || (match[2] === "+" && left % 10 + right % 10 > 9) || (match[2] === "−" && left % 10 < right)) failures.push("пример выходит за изученный диапазон или требует перехода через десяток");
          if (!answer.includes(`${left} ${match[2]} ${right} = ${result}`)) failures.push("ответ не совпадает с независимым вычислением");
        }
      } else if (topic === "состав числа в пределах 10") {
        const match = prompt.match(/Заполни: (?:(\d+) \+ □ = (\d+)|□ \+ (\d+) = (\d+))/);
        if (!match) failures.push("не распознано задание на состав числа");
        else {
          const left = Number(match[1] ?? match[3]), total = Number(match[2] ?? match[4]);
          const missing = total - left;
          if (total > 10 || missing < 1 || !answer.includes(`${left} + ${missing} = ${total}`) && !answer.includes(`${missing} + ${left} = ${total}`)) failures.push("ответ не совпадает с независимым вычислением");
        }
      } else if (topic === "измерение длины отрезка в сантиметрах") {
        const match = prompt.match(/от (\d+) см до (\d+) см/);
        if (!match) failures.push("не распознаны границы отрезка");
        else if (!answer.includes(`${Number(match[2])} − ${Number(match[1])} = ${Number(match[2]) - Number(match[1])} см`)) failures.push("ответ не совпадает с вычисленной длиной");
      } else if (topic === "верные и неверные математические утверждения") {
        const match = prompt.match(/утверждение: (\d+) \+ (\d+) = (\d+)\. Оно верное\?/);
        if (!match) failures.push("не распознано задание на проверку утверждения");
        else {
          const sum = Number(match[1]) + Number(match[2]);
          const claimed = Number(match[3]);
          const expected = sum === claimed ? `Верное: ${match[1]} + ${match[2]} = ${sum}.` : `Неверное: ${match[1]} + ${match[2]} = ${sum}, а не ${claimed}.`;
          if (answer !== expected) failures.push("верность утверждения или ответ вычислены неправильно");
        }
      } else if (topic === "двухшаговые инструкции с вычислениями и построением") {
        const match = prompt.match(/отрезок AB длиной (\d+) см; 2\) начерти рядом отрезок CD на (\d+) см короче/);
        if (!match) failures.push("не распознаны два шага задания на построение");
        else {
          const length = Number(match[1]) - Number(match[2]);
          if (length < 1 || !answer.includes(`${match[1]} − ${match[2]} = ${length}`) || !answer.includes(`CD длиной ${length} см`)) failures.push("вычисленная длина или инструкция построения неверны");
        }
      }
      if (failures.length) report.gradeOneMathFailures.push({ topic, index, prompt, answer, failures });
    }
  }

  const gradeTwoMathTopics = Object.keys(gradeMap.subjects?.["Математика"]?.officialCoverage?.grades?.["2"]?.topicCodes ?? {});
  for (const topic of gradeTwoMathTopics) {
    const generated = curriculum.generateCurriculumAi("assignment", `${topic} для 2 класса`, "medium", 15, "Математика");
    for (let index = 0; index < generated.items.length; index += 1) {
      report.gradeTwoMathChecks += 1;
      const prompt = generated.items[index].split("\nДля 2 класса:")[0];
      const answer = generated.answers[index] ?? "";
      const failures = [];
      if (!generated.items[index].includes("Для 2 класса:")) failures.push("нет инструкции для 2 класса");
      if (!answer.trim() || answer.startsWith("Ключ проверки:")) failures.push("нет конкретного проверяемого ответа");
      if (topic === "сложение и вычитание до 100") {
        const match = prompt.match(/Вычисли (\d+) ([+−]) (\d+)\./);
        if (!match) failures.push("не распознано сложение или вычитание");
        else {
          const left = Number(match[1]), right = Number(match[3]);
          const result = match[2] === "+" ? left + right : left - right;
          if (left > 100 || right > 100 || result < 0 || result > 100 || !answer.includes(`${left} ${match[2]} ${right} = ${result}`)) failures.push("вычисление выходит за диапазон или ответ неверен");
        }
      } else if (topic === "цена, количество и стоимость") {
        const match = prompt.match(/стоит (\d+) ₽\. Сколько стоят (\d+)/);
        if (!match || !answer.includes(`${Number(match?.[1]) * Number(match?.[2])} ₽`)) failures.push("стоимость не совпадает с ценой и количеством");
      } else if (topic === "табличное умножение и деление до 50" || topic === "смысл умножения и деления") {
        const match = prompt.match(/В (\d+) коробках лежит по (\d+) фишек/);
        if (match && (!answer.includes(`${Number(match[1]) * Number(match[2])} фишек`) || Number(match[1]) * Number(match[2]) > 50)) failures.push("произведение или ответ не соответствуют условию");
        else if (!match) {
          const division = prompt.match(/(\d+) фишек поровну разложили в (\d+) коробок/);
          if (!division || Number(division[1]) % Number(division[2]) !== 0 || !answer.includes(`${Number(division[1]) / Number(division[2])} фишек`)) failures.push("деление не проверяется по таблице или ответ неверен");
        }
      } else if (topic === "доли величины: половина, треть, четверть, пятая и десятая часть") {
        const match = prompt.match(/числа (\d+)/);
        const divisor = [2, 3, 4, 5, 10][index % 5];
        if (!match || Number(match[1]) % divisor !== 0 || !answer.includes(String(Number(match[1]) / divisor))) failures.push("доля не вычисляется целым результатом или ответ неверен");
      } else if (topic === "порядок действий со скобками") {
        const match = prompt.match(/\((\d+) \+ (\d+)\) − (\d+)/);
        if (!match || !answer.includes(String(Number(match[1]) + Number(match[2]) - Number(match[3])))) failures.push("порядок действий или результат неверен");
      } else if (topic === "двухшаговые текстовые задачи") {
        const match = prompt.match(/В (\d+) коробках было по (\d+) карандашей\. (\d+) карандашей раздали/);
        if (!match || Number(match[1]) * Number(match[2]) <= Number(match[3]) || !answer.includes(String(Number(match[1]) * Number(match[2]) - Number(match[3])))) failures.push("решение в два действия неверно");
      } else if (topic === "периметр многоугольника") {
        const match = prompt.match(/Сторона квадрата равна (\d+) см/);
        if (!match || !answer.includes(`${Number(match[1]) * 4} см`)) failures.push("периметр квадрата вычислен неверно");
      } else if (topic === "сравнение площадей фигур") {
        const match = prompt.match(/A \((\d+) × (\d+) клеток\) и B \((\d+) × (\d+) клеток\)/);
        if (!match) failures.push("не найдены размеры фигур на сетке");
        else {
          const areaA = Number(match[1]) * Number(match[2]), areaB = Number(match[3]) * Number(match[4]);
          const expected = areaA === areaB ? "Площади равны." : areaA > areaB ? "Площадь A больше." : "Площадь B больше.";
          if (!answer.includes(`${areaA} клеток`) || !answer.includes(`${areaB} клеток`) || !answer.includes(expected)) failures.push("площадь или сравнение фигур неверно");
        }
      } else if (topic === "логические утверждения о числах и величинах") {
        const match = prompt.match(/утверждение: (\d+) \+ (\d+) = (\d+)/);
        if (!match) failures.push("не распознано проверяемое утверждение");
        else {
          const sum = Number(match[1]) + Number(match[2]), claimed = Number(match[3]);
          if (claimed === sum ? answer !== `Верное: ${match[1]} + ${match[2]} = ${sum}.` : answer !== `Неверное: ${match[1]} + ${match[2]} = ${sum}, а не ${claimed}.`) failures.push("проверка истинности утверждения неверна");
        }
      }
      if (failures.length) report.gradeTwoMathFailures.push({ topic, index, prompt, answer, failures });
    }
  }

  const gradeThreeMathTopics = Object.keys(gradeMap.subjects?.["Математика"]?.officialCoverage?.grades?.["3"]?.topicCodes ?? {});
  const verifyPrimaryAnswer = (grade, topic, prompt, answer) => {
    const unitFactor = { "кг→г": 1000, "м→см": 100, "ч→мин": 60, "км→м": 1000, "руб.→коп.": 100, "л→мл": 1000 };
    let match;
    if (grade === 3 && topic === "числа в пределах 1000 и разрядный состав") {
      match = prompt.match(/число (\d+)/); const parts = answer.match(/= ([\d +]+)\./)?.[1].split("+").map(Number);
      return Boolean(match && parts) && parts.reduce((sum, value) => sum + value, 0) === Number(match[1]);
    }
    if (grade === 3 && topic === "сложение вычитание умножение и деление до 1000") {
      match = prompt.match(/Вычисли (\d+) ([+−·:]) (\d+)\./); const result = Number(answer.match(/= (\d+)\./)?.[1]);
      if (!match) return false;
      const [, a, op, b] = match.map((value) => value); const expected = op === "+" ? Number(a) + Number(b) : op === "−" ? Number(a) - Number(b) : op === "·" ? Number(a) * Number(b) : Number(a) / Number(b);
      return result === expected;
    }
    if (grade === 3 && topic === "единицы величин и их сравнение в задачах 3 класса") {
      match = prompt.match(/Переведи (\d+) (кг|м|ч|км|руб\.) в (г|см|мин|м|коп\.)/); const result = Number(answer.match(/= (\d+) (?:г|см|мин|м|коп\.)\./)?.[1]);
      return Boolean(match) && result === Number(match[1]) * unitFactor[`${match[2]}→${match[3]}`];
    }
    if (grade === 3 && topic === "порядок действий и неизвестный компонент до 1000") {
      match = prompt.match(/\((\d+) \+ (\d+)\) · (\d+)/);
      if (match) return answer.includes(String((Number(match[1]) + Number(match[2])) * Number(match[3])));
      match = prompt.match(/□ \+ (\d+) = (\d+)/); return Boolean(match) && Number(match[2]) - Number(match[1]) === Number(answer.match(/= (\d+)\./)?.[1]);
    }
    if (grade === 3 && topic === "сложение и вычитание однородных величин") {
      match = prompt.match(/(\d+) г и (\d+) г/); return Boolean(match) && Number(answer.match(/= (\d+) г\./)?.[1]) === Number(match[1]) + Number(match[2]);
    }
    if (grade === 3 && topic === "двухшаговые задачи на сравнение и величины") {
      match = prompt.match(/В (\d+) коробках лежало по (\d+) карандашей, затем добавили ещё (\d+)/); return Boolean(match) && Number(answer.match(/= (\d+)\. Ответ:/)?.[1]) === Number(match[1]) * Number(match[2]) + Number(match[3]);
    }
    if (grade === 3 && topic === "периметр и площадь прямоугольника в 3 классе") {
      match = prompt.match(/стороны (\d+) см и (\d+) см/); return Boolean(match) && answer.includes(`= ${Number(match[1]) * Number(match[2])} см²`) && answer.includes(`P = 2 · (${match[1]} + ${match[2]}) = ${2 * (Number(match[1]) + Number(match[2]))} см`);
    }
    if (grade === 3 && topic === "таблицы диаграммы и логика по математическим данным 3 класса") {
      match = prompt.match(/понедельник — (\d+), вторник — (\d+), среда — (\d+)/); return Boolean(match) && answer.includes(`${Number(match[1]) + Number(match[2]) + Number(match[3])} страниц`) && answer.includes(`${Number(match[2]) - Number(match[3])} страниц`);
    }
    if (grade === 4 && topic === "числа до миллиона и многозначное сравнение") {
      match = prompt.match(/число (\d+)/); const parts = answer.match(/= ([\d +]+)\./)?.[1].split("+").map(Number);
      return Boolean(match && parts) && parts.reduce((sum, value) => sum + value, 0) === Number(match[1]);
    }
    if (grade === 4 && topic === "единицы величин и преобразования 4 класса") {
      match = prompt.match(/Переведи (\d+) (кг|м|ч|л|км) в (г|см|мин|мл|м)/); const result = Number(answer.match(/= (\d+) (?:г|см|мин|мл|м)\./)?.[1]);
      return Boolean(match) && result === Number(match[1]) * unitFactor[`${match[2]}→${match[3]}`];
    }
    if (grade === 4 && topic === "письменные действия с многозначными числами") {
      match = prompt.match(/Вычисли письменно (\d+) ([+−]) (\d+)\./); const values = answer.match(/(\d+) ([+−]) (\d+) = (\d+)\./);
      if (!match || !values) return false;
      const expected = values[2] === "+" ? Number(values[1]) + Number(values[3]) : Number(values[1]) - Number(values[3]);
      return values[1] === match[1] && values[2] === match[2] && values[3] === match[3] && Number(values[4]) === expected;
    }
    if (grade === 4 && topic === "выражения и свойства арифметических действий") {
      match = prompt.match(/Вычисли (\d+) \+ (\d+) · (\d+)/); return Boolean(match) && Number(answer.match(/затем .* = (\d+)\./)?.[1]) === Number(match[1]) + Number(match[2]) * Number(match[3]);
    }
    if (grade === 4 && topic === "доли величин и нахождение целого по доле") {
      match = prompt.match(/числа равна (\d+)\. Найди число/);
      if (match) { const values = answer.match(/(\d+) · (\d+) = (\d+)\./)?.slice(1).map(Number); return Boolean(values) && values[0] === Number(match[1]) && values[0] * values[1] === values[2]; }
      match = prompt.match(/числа (\d+)\./); const values = answer.match(/(\d+) : (\d+) = (\d+)\./)?.slice(1).map(Number);
      return Boolean(match && values) && values[0] === Number(match[1]) && values[0] / values[1] === values[2];
    }
    if (grade === 4 && topic === "практические задачи на движение работу и покупки") {
      match = prompt.match(/скоростью (\d+) км\/ч (\d+) ч/); return Boolean(match) && Number(answer.match(/= (\d+) км\./)?.[1]) === Number(match[1]) * Number(match[2]);
    }
    if (grade === 4 && topic === "геометрические построения окружность и пространственные тела") {
      match = prompt.match(/радиус (\d+) см/); return match ? Number(answer.match(/= (\d+) см\./)?.[1]) === 2 * Number(match[1]) : /Это (?:куб|цилиндр|конус|шар|пирамида|прямоугольный параллелепипед|призма)\./.test(answer);
    }
    if (grade === 4 && topic === "площадь и периметр составных фигур") {
      match = prompt.match(/прямоугольника (\d+) × (\d+) см вырезали в углу прямоугольник (\d+) × (\d+) см/);
      return Boolean(match) && answer.includes(`${Number(match[1]) * Number(match[2]) - Number(match[3]) * Number(match[4])} см²`) && answer.includes(`${2 * (Number(match[1]) + Number(match[2]))} см.`);
    }
    if (grade === 4 && topic === "таблицы логические утверждения и алгоритмы 4 класса") {
      match = prompt.match(/последовательность по правилу «прибавляй (\d+)»: (\d+), (\d+), (\d+), __/); return Boolean(match) && Number(answer.match(/Следующее число: .* = (\d+)\./)?.[1]) === Number(match[2]) + 3 * Number(match[1]);
    }
    if (grade === 4 && topic === "уравнения с неизвестным компонентом в 4 классе") {
      match = prompt.match(/□ \+ (\d+) = (\d+)/); return Boolean(match) && Number(answer.match(/= (\d+)\./)?.[1]) === Number(match[2]) - Number(match[1]);
    }
    if (grade === 4 && topic === "умножение и деление величин на число") {
      match = prompt.match(/содержит (\d+) г продукта\. Сколько граммов продукта в (\d+)/); return Boolean(match) && Number(answer.match(/= (\d+) г\./)?.[1]) === Number(match[1]) * Number(match[2]);
    }
    return true;
  };
  for (const topic of gradeThreeMathTopics) {
    const gradeThreePrompts = new Set();
    const generated = curriculum.generateCurriculumAi("assignment", `${topic} для 3 класса`, "medium", 15, "Математика");
    for (let index = 0; index < generated.items.length; index += 1) {
      report.gradeThreeMathChecks += 1;
      const prompt = generated.items[index].split("\nДля 3 класса:")[0];
      const answer = generated.answers[index] ?? "";
      const failures = [];
      if (!generated.items[index].includes("Для 3 класса:")) failures.push("нет инструкции для 3 класса");
      if (!answer.trim() || answer.startsWith("Ключ проверки:")) failures.push("нет конкретного проверяемого ответа");
      report.primaryMathAnswerChecks += 1;
      if (!verifyPrimaryAnswer(3, topic, prompt, answer)) {
        failures.push("ответ не сошёлся с независимой проверкой по условию");
        report.primaryMathAnswerFailures.push({ grade: 3, topic, index, prompt, answer });
      }
      if (/Составь понятную схему|Подготовь таблицу по теме|Ключ проверки:/i.test(prompt)) failures.push("вместо предметного задания выдан общий шаблон");
      const normalizedPrompt = prompt.toLocaleLowerCase("ru-RU").replace(/\s+/g, " ").trim();
      if (gradeThreePrompts.has(normalizedPrompt)) failures.push("повторяется формулировка в наборе тем 3 класса");
      gradeThreePrompts.add(normalizedPrompt);
      if (topic === "деление с остатком") {
        const match = prompt.match(/Раздели (\d+) на (\d+) с остатком/);
        if (!match) failures.push("не распознано деление с остатком");
        else {
          const dividend = Number(match[1]), divisor = Number(match[2]);
          const quotient = Math.floor(dividend / divisor), remainder = dividend % divisor;
          if (remainder >= divisor || !answer.includes(`частное ${quotient}, остаток ${remainder}`)) failures.push("частное или остаток неверны");
        }
      } else if (topic === "доли и дроби в начальной школе") {
        const match = prompt.match(/наборе (\d+) фишек/);
        if (!match) failures.push("не распознано условие сравнения долей");
        else {
          const whole = Number(match[1]), third = whole / 3, quarter = whole / 4, difference = third - quarter;
          if (whole % 12 !== 0 || !answer.includes(`Треть: ${whole} : 3 = ${third}`) || !answer.includes(`Четверть: ${whole} : 4 = ${quarter}`) || !answer.includes(`Разница: ${third} − ${quarter} = ${difference}`)) failures.push("сравнение долей вычислено неверно");
        }
      } else if (/доли величины|доли и дроби/.test(topic)) {
        const match = prompt.match(/числа (\d+)/);
        const denominator = [2, 3, 4, 5, 10][index % 5];
        if (!match || Number(match[1]) % denominator !== 0 || !answer.includes(String(Number(match[1]) / denominator))) failures.push("доля вычислена неверно");
      } else if (topic === "сравнение площадей фигур") {
        const match = prompt.match(/A \((\d+) × (\d+) клеток\) и B \((\d+) × (\d+) клеток\)/);
        if (!match) failures.push("не распознаны размеры прямоугольников на сетке");
        else {
          const areaA = Number(match[1]) * Number(match[2]), areaB = Number(match[3]) * Number(match[4]);
          const expected = areaA === areaB ? "Площади равны." : areaA > areaB ? "Площадь A больше." : "Площадь B больше.";
          if (!answer.includes(`${areaA} клеток`) || !answer.includes(`${areaB} клеток`) || !answer.includes(expected)) failures.push("сравнение площадей неверно");
        }
      } else if (topic === "площади фигур") {
        const match = prompt.match(/стороны (\d+) см и (\d+) см/);
        if (!match || !answer.includes(String(Number(match[1]) * Number(match[2])))) failures.push("площадь прямоугольника вычислена неверно");
      }
      if (failures.length) report.gradeThreeMathFailures.push({ topic, index, prompt, answer, failures });
    }
  }

  const gradeFourMathTopics = Object.keys(gradeMap.subjects?.["Математика"]?.officialCoverage?.grades?.["4"]?.topicCodes ?? {});
  for (const topic of gradeFourMathTopics) {
    const gradeFourPrompts = new Set();
    const generated = curriculum.generateCurriculumAi("assignment", `${topic} для 4 класса`, "medium", 15, "Математика");
    for (let index = 0; index < generated.items.length; index += 1) {
      report.gradeFourMathChecks += 1;
      const prompt = generated.items[index].split("\nДля 4 класса:")[0];
      const answer = generated.answers[index] ?? "";
      const failures = [];
      if (!generated.items[index].includes("Для 4 класса:")) failures.push("нет инструкции для 4 класса");
      if (!answer.trim() || answer.startsWith("Ключ проверки:")) failures.push("нет конкретного проверяемого ответа");
      report.primaryMathAnswerChecks += 1;
      if (!verifyPrimaryAnswer(4, topic, prompt, answer)) {
        failures.push("ответ не сошёлся с независимой проверкой по условию");
        report.primaryMathAnswerFailures.push({ grade: 4, topic, index, prompt, answer });
      }
      if (/Составь понятную схему|Подготовь таблицу по теме|Ключ проверки:/i.test(prompt)) failures.push("вместо предметного задания выдан общий шаблон");
      const normalizedPrompt = prompt.toLocaleLowerCase("ru-RU").replace(/\s+/g, " ").trim();
      if (gradeFourPrompts.has(normalizedPrompt)) failures.push("повторяется формулировка в наборе тем 4 класса");
      gradeFourPrompts.add(normalizedPrompt);
      if (failures.length) report.gradeFourMathFailures.push({ topic, index, prompt, answer, failures });
    }
  }

  const olympiadMath = curriculum.generateCurriculumAi("assignment", "Составь 15 олимпиадных задач на числа до миллиона для 4 класса", "hard", 15, "Математика");
  const olympiadPrompts = olympiadMath.items.map((item) => item.split("\nДля 4 класса:")[0]);
  const olympiadAnswers = olympiadMath.answers;
  for (let index = 0; index < olympiadPrompts.length; index += 1) {
    report.olympiadMathChecks += 1;
    const prompt = olympiadPrompts[index], answer = olympiadAnswers[index] ?? "";
    const failures = [];
    const difference = Number(prompt.match(/больше числа с переставленными цифрами на (\d+)/)?.[1]);
    const sum = Number(prompt.match(/сумма его цифр равна (\d+)/)?.[1]);
    const number = Number(answer.match(/Искомое число (\d+)/)?.[1]);
    if (!olympiadMath.items[index].includes("Для 4 класса:")) failures.push("не сохранён класс");
    if (!Number.isInteger(difference) || !Number.isInteger(sum) || !Number.isInteger(number)) failures.push("не распознана задача на восстановление числа");
    else {
      const tens = Math.floor(number / 10), ones = number % 10;
      if (tens + ones !== sum || number - (10 * ones + tens) !== difference) failures.push("условие и найденное число не согласуются");
    }
    if (failures.length) report.olympiadMathFailures.push({ index, prompt, answer, failures });
  }
  if (new Set(olympiadPrompts).size !== 15) report.olympiadMathFailures.push({ topic: "числа до миллиона", failures: ["олимпиадный набор содержит повторы"] });

  for (const [request, topicPattern] of [
    ["Составь 5 олимпиадных задач по математике на принцип Дирихле для 8 класса", /принцип|ящик|предмет/iu],
    ["Придумай 5 нестандартных задач по математике на инварианты для 8 класса", /инвариант|шахматн|домино/iu],
    ["Составь 5 олимпиадных задач по математике на комбинаторику для 8 класса", /комбинаторик/iu],
  ]) {
    const generated = curriculum.generateCurriculumAi("assignment", request, "hard", 5, "Математика");
    const prompts = generated.items.map((item) => item.split("\nДля 8 класса:")[0]);
    const topic = generated.title;
    for (let index = 0; index < prompts.length; index += 1) {
      report.olympiadMathChecks += 1;
      const failures = [];
      if (!topicPattern.test(prompts[index]) && !topicPattern.test(generated.answers[index] ?? "")) failures.push("задание не связано с запрошенной нестандартной темой");
      if (!generated.answers[index]?.trim()) failures.push("нет ответа или критериев проверки");
      if (/клетчатом поле|кратчайших маршрутов/iu.test(prompts[index]) && !/путь|маршрут/iu.test(topic)) failures.push("вместо запрошенной темы подставлен посторонний шаблон маршрутов");
      if (!generated.items[index].includes("Для 8 класса:")) failures.push("не сохранён класс");
      if (failures.length) report.olympiadMathFailures.push({ request, index, prompt: prompts[index], answer: generated.answers[index], failures });
    }
    if (new Set(prompts).size !== 5) report.olympiadMathFailures.push({ request, failures: ["набор содержит повторы"] });
  }

  let transferItemId = 0;
  for (const [subject, topics] of Object.entries(corpus)) {
    for (const topic of topics) {
      report.topics += 1;
      const detectedTopicSubject = curriculum.detectCurriculumSubject(topic);
      if (detectedTopicSubject === subject) report.exactTopicRecognition += 1;
      else report.exactTopicRecognitionFailures.push({ topic, expected: subject, actual: detectedTopicSubject });

      const firstSet = curriculum.generateCurriculumAi("assignment", topic, "medium", 1, subject);
      const firstAnswer = firstSet.answers[0]?.replace(/^\d+\.\s*/, "") ?? "";
      if (subject === "Математика") {
        const routedTopics = report.mathTopicsByGenerator[firstSet.detected] ?? [];
        routedTopics.push(topic);
        report.mathTopicsByGenerator[firstSet.detected] = routedTopics;
      }
      const hasSpecificExercise = !firstAnswer.startsWith("Ключ проверки:");
      const coverage = report.exerciseCoverageBySubject[subject] ?? { total: 0, specific: 0, sourceSafeRubric: 0 };
      coverage.total += 1;
      if (hasSpecificExercise) {
        coverage.specific += 1;
        report.topicsWithSpecificExercise += 1;
        report.specificTopicsBySubject[subject] ??= [];
        report.specificTopicsBySubject[subject].push(topic);
      } else {
        coverage.sourceSafeRubric += 1;
        report.topicsUsingSourceSafeRubric += 1;
        report.rubricTopicsBySubject[subject] ??= [];
        report.rubricTopicsBySubject[subject].push(topic);
      }
      report.exerciseCoverageBySubject[subject] = coverage;

      const result = curriculum.generateCurriculumAi("assignment", topic, "medium", 15, subject);
      report.generatedSets += 1;
      report.offlineGenerationCases += 1;
      if (result.subject !== subject) report.wrongSubjectSets += 1;
      if (result.items.length !== 15 || result.answers.length !== 15) report.incompleteSets += 1;
      if (result.answers.some((answer) => !answer.trim())) report.emptyAnswers += 1;
      const prompts = result.items.map((item) => item.replace(/^\d+\.\s*/, "").replace(/\s+/g, " ").trim().toLocaleLowerCase("ru-RU"));
      if (new Set(prompts).size !== prompts.length) {
        report.repeatedSets += 1;
        report.repeatedTopics.push({ subject, topic });
      }

      for (const tool of ["assignment", "quiz", "flashcards"]) {
        const draftResult = curriculum.generateCurriculumAi(tool, topic, "medium", 10, subject);
        const transferred = boardTransfer.createAiBoardItems({
          id: `evaluation-${report.topics}-${tool}`, tool, topic, subject: draftResult.subject,
          title: draftResult.title,
          body: draftResult.items.join("\n\n"),
          answers: draftResult.answers, createdAt: "2026-11-10T00:00:00.000Z",
        }, { x: 500, y: 300 }, () => `evaluation-item-${++transferItemId}`);
        report.boardTransferCases += 1;
        report.boardTransferCasesByTool[tool] = (report.boardTransferCasesByTool[tool] ?? 0) + 1;
        report.boardTransferCasesBySubject[subject] = (report.boardTransferCasesBySubject[subject] ?? 0) + 1;

        const transferredCount = tool === "flashcards"
          ? transferred.filter(item => item.kind === "flashcard").length
          : transferred.length === 1 && transferred[0].kind === "checklist"
            ? transferred[0].checklistItems?.length ?? 0
            : transferred.filter(item => item.kind === "quiz").length;
        if (draftResult.items.length !== 10 || transferredCount !== 10) {
          report.boardTransferFailures.push({ subject, topic, tool, generated: draftResult.items.length, transferred: transferredCount });
        }
      }
    }
  }

  const mathAlignmentCases = [
    { topic: "округление чисел и оценка результата", prompt: /оцени сумму/i, answer: /Оценка:.*Точная сумма:/i, verify: (prompt, answer) => {
      const [left, right] = prompt.match(/\d+/g).map(Number);
      const values = answer.match(/\d+/g).map(Number);
      return values[0] === Math.round(left / 100) * 100 && values[1] === Math.round(right / 10) * 10
        && values[2] === values[0] + values[1] && values[3] === left + right;
    } },
    { topic: "сравнение десятичных дробей", prompt: /сравни десятичные дроби/i, answer: /сравниваем сотые:/i, verify: (prompt, answer) => {
      const [, leftText, rightText] = prompt.match(/дроби ([\d,]+) и ([\d,]+)/i) ?? [];
      const left = Number(leftText?.replace(",", ".")), right = Number(rightText?.replace(",", "."));
      const symbol = answer.match(/сотые: [\d,]+ ([<>=]) [\d,]+/i)?.[1];
      return Number.isFinite(left) && Number.isFinite(right) && symbol === (left === right ? "=" : left > right ? ">" : "<");
    } },
    { topic: "график квадратичной функции", prompt: /графика y = x².*нули функции/i, answer: /нули:.*вершин/i, verify: (prompt, answer) => {
      const equation = prompt.match(/y = x²\s*([+−-])\s*(\d+)x\s*([+−-])\s*(\d+)/i);
      const roots = answer.match(/нули: x₁ = (-?\d+), x₂ = (-?\d+)/i)?.slice(1).map(Number);
      const vertex = answer.match(/Вершина: x₀ = .*?= (-?\d+), y₀ = (-?\d+)/i)?.slice(1).map(Number);
      if (!equation || !roots || !vertex) return false;
      const b = (equation[1] === "−" || equation[1] === "-" ? -1 : 1) * Number(equation[2]);
      const c = (equation[3] === "−" || equation[3] === "-" ? -1 : 1) * Number(equation[4]);
      return roots[0] * roots[1] === c && -(roots[0] + roots[1]) === b
        && vertex[0] === (roots[0] + roots[1]) / 2 && vertex[1] === vertex[0] ** 2 + b * vertex[0] + c;
    } },
    { topic: "векторы и координаты", prompt: /координаты вектора AB/i, answer: /AB = .*\|AB\|/i, verify: (prompt, answer) => {
      const points = prompt.match(/A\((-?\d+); (-?\d+)\).*B\((-?\d+); (-?\d+)\)/i)?.slice(1).map(Number);
      const vector = answer.match(/= \((-?\d+); (-?\d+)\); \|AB\|/i)?.slice(1).map(Number);
      if (!points || !vector) return false;
      const dx = points[2] - points[0], dy = points[3] - points[1];
      return vector[0] === dx && vector[1] === dy && answer.includes(`√(${dx}² + ${dy}²)`)
        && (dx * dx + dy * dy === 25 ? / = 5\./.test(answer) : /4√2 ≈ 5,66/.test(answer));
    } },
    { topic: "скалярное произведение векторов", prompt: /скалярное произведение/i, answer: /u · v =/i, verify: (prompt, answer) => {
      const values = prompt.match(/u = \((-?\d+); (-?\d+)\) и v = \((-?\d+); (-?\d+)\)/i)?.slice(1).map(Number);
      const result = Number(answer.match(/= (-?\d+)\.$/)?.[1]);
      return Boolean(values) && result === values[0] * values[2] + values[1] * values[3];
    } },
    { topic: "теорема синусов", prompt: /по теореме синусов/i, answer: /b\/sin .* = a\/sin/i, verify: (prompt, answer) => {
      const values = prompt.match(/угол A = (\d+)°, угол B = (\d+)°, сторона a = (\d+) см/i)?.slice(1).map(Number);
      const exact = answer.match(/= ([\d√/]+) см\.$/)?.[1];
      if (!values || !exact) return false;
      const [angleA, angleB, sideA] = values;
      const exactParts = exact.split("/");
      const coefficient = Number(exactParts[0].replace("√3", "")) * (exactParts[0].includes("√3") ? Math.sqrt(3) : 1);
      const exactValue = coefficient / Number(exactParts[1] ?? 1);
      return Math.abs(exactValue - sideA * Math.sin(angleB * Math.PI / 180) / Math.sin(angleA * Math.PI / 180)) < 0.0001;
    } },
    { topic: "теорема косинусов", prompt: /по теореме косинусов/i, answer: /c² = .*cos/i, verify: (prompt, answer) => {
      const values = prompt.match(/равны (\d+) см и (\d+) см, угол между ними — (\d+)°/i)?.slice(1).map(Number);
      const radicand = Number(answer.match(/= (\d+); c = √(\d+)/i)?.[1]);
      if (!values || !Number.isFinite(radicand)) return false;
      const [a, b, angle] = values;
      const expected = a * a + b * b - 2 * a * b * Math.cos(angle * Math.PI / 180);
      return radicand === Number(answer.match(/; c = √(\d+)/i)?.[1]) && Math.abs(radicand - expected) < 0.0001;
    } },
    { topic: "окружность и касательная", prompt: /касательная PT.*радиус OT.*расстояние OP/i, answer: /PT² = OP² − OT² = \d+² − \d+² = \d+; PT = \d+ см/i, verify: (prompt, answer) => {
      const values = prompt.match(/OT = (\d+) см, расстояние OP = (\d+) см/i)?.slice(1).map(Number);
      const result = answer.match(/= (\d+); PT = (\d+) см/i)?.slice(1).map(Number);
      return Boolean(values && result) && result[0] === values[1] ** 2 - values[0] ** 2 && result[1] ** 2 === result[0];
    } },
    { topic: "сложение и вычитание многозначных чисел", prompt: /Вычисли \d+ [−+] \d+\./i, answer: /\d+ [−+] \d+ = \d+\./i, verify: (_prompt, answer) => {
      const values = answer.match(/(\d+) ([−+]) (\d+) = (\d+)\./)?.slice(1);
      if (!values) return false;
      const [left, operator, right, result] = values;
      return Number(result) === (operator === "+" ? Number(left) + Number(right) : Number(left) - Number(right));
    } },
    { topic: "умножение и деление натуральных чисел", prompt: /обратным действием/i, answer: /\d+ · \d+ = \d+; \d+ \/ \d+ = \d+/i, verify: (_prompt, answer) => {
      const values = answer.match(/(\d+) · (\d+) = (\d+); (\d+) \/ (\d+) = (\d+)/)?.slice(1).map(Number);
      return Boolean(values) && values[0] * values[1] === values[2] && values[2] / values[4] === values[5] && values[1] === values[4] && values[0] === values[5];
    } },
    { topic: "геометрические построения и симметрия в 6 классе", prompt: /отрази её относительно оси|отражена центральной симметрией/i, answer: /[ABC]′\([−-]?\d+; [−-]?\d+\)/i, verify: (_prompt, answer, index) => {
      const x = 2 + (index % 11), y = 3 + ((index * 2) % 9), kind = index % 3;
      const expected = kind === 0 ? `A′(−${x}; ${y})` : kind === 1 ? `B′(−${x}; −${y})` : `C′(−${x}; ${y})`;
      return answer.includes(expected);
    } },
    { topic: "осевая симметрия в 7 классе", prompt: /отражена относительно оси O[xy]/i, answer: /меняется знак [xy]: [AB]′\([−-]?\d+; [−-]?\d+\)/i },
    { topic: "геометрические построения и линии треугольника в 7 классе", prompt: /построена медиана AM.*M — середина BC/i, answer: /BM = MC = \d+ : 2 = \d+ см/i },
    { topic: "графы вершины рёбра и пути в 7 классе", prompt: /Граф-цепь содержит \d+ вершин/i, answer: /Эйлеров путь есть/i },
    { topic: "линейное уравнение с двумя переменными и график в 7 классе", prompt: /Найди три его решения.*построения графика/i, answer: /Решения: \(0; .*\), \(1; .*\), \(2; .*\)\./i },
    { topic: "графическое решение уравнений и систем в 7 классе", prompt: /Реши графически систему/i, answer: /Точка пересечения прямых — \([-−]?\d+; \d+\)/i },
    { topic: "среднее арифметическое медиана и размах в 7 классе", prompt: /найди среднее арифметическое, медиану и размах/i, answer: /Среднее: .*; медиана: .*; размах:/i },
    { topic: "формулы и вычисления по формулам в 7 классе", prompt: /по формуле s = v · t/i, answer: /s = \d+ · \d+ = \d+ км/i },
    { topic: "текстовые задачи на уравнения в 7 классе", prompt: /Составь уравнение и найди оба числа/i, answer: /Числа: \d+ и \d+\./i },
    { topic: "периметр и длины в 6 классе", prompt: /начерти прямоугольник со сторонами/i, answer: /P = 2 · \(\d+ \+ \d+\) = \d+ см/i, verify: (prompt, answer) => {
      const [a, b] = prompt.match(/со сторонами (\d+) см и (\d+) см/)?.slice(1).map(Number) ?? [];
      const perimeter = 2 * (a + b);
      return Number.isFinite(perimeter) && answer.includes(`P = 2 · (${a} + ${b}) = ${perimeter} см`);
    } },
  ];
  for (const check of mathAlignmentCases) {
    const generated = curriculum.generateCurriculumAi("assignment", check.topic, "medium", 15, "Математика");
    report.mathFocusedChecks += 1;
    const prompts = generated.items.map((item) => item.replace(/^\d+\.\s*/, ""));
    const answers = generated.answers.map((answer) => answer.replace(/^\d+\.\s*/, "").replace(/[\u00a0\u202f]/g, " "));
    const failures = [];
    if (generated.subject !== "Математика") failures.push(`предмет: ${generated.subject}`);
    if (prompts.length !== 15 || answers.length !== 15) failures.push(`ожидалось 15 задач и ответов, получено ${prompts.length}/${answers.length}`);
    if (prompts.some((prompt) => !check.prompt.test(prompt))) failures.push("формулировка не соответствует теме");
    if (answers.some((answer) => !check.answer.test(answer))) failures.push("ответ не содержит ожидаемого решения");
    if (check.verify && prompts.some((prompt, index) => !check.verify(prompt, answers[index], index))) failures.push("расчёт ответа не сошёлся с условием");
    if (new Set(prompts).size !== prompts.length) failures.push("есть повторяющиеся задачи");
    if (failures.length) report.mathFocusedFailures.push({ topic: check.topic, detected: generated.detected, firstPrompt: prompts[0], firstAnswer: answers[0], failures });
  }

  const physicsAlignmentCases = [
    { topic: "удельная теплота плавления", prompt: /расплавить лёд/i, answer: /удельная теплота плавления/i, verify: (prompt, answer) => {
      const mass = Number(prompt.match(/для (\d+) кг/)?.[1]);
      const values = answer.match(/Q = λm = ([\d ]+) · (\d+) = ([\d ]+) Дж/);
      return Boolean(values) && Number(values[1].replaceAll(" ", "")) === 334000 && Number(values[2]) === mass && Number(values[3].replaceAll(" ", "")) === mass * 334000;
    } },
    { topic: "удельная теплота парообразования", prompt: /воду .* в пар/i, answer: /удельная теплота парообразования/i, verify: (prompt, answer) => {
      const mass = Number(prompt.match(/для (\d+) кг/)?.[1]);
      const values = answer.match(/Q = λm = ([\d ]+) · (\d+) = ([\d ]+) Дж/);
      return Boolean(values) && Number(values[1].replaceAll(" ", "")) === 2260000 && Number(values[2]) === mass && Number(values[3].replaceAll(" ", "")) === mass * 2260000;
    } },
    { topic: "закон Джоуля — Ленца", prompt: /по проводнику|проводником/i, answer: /Q = I²Rt/i, verify: (prompt, answer) => {
      const [, resistance, time, current] = prompt.match(/сопротивлением (\d+) Ом в течение (\d+) с проходит ток (\d+) А/) ?? [];
      const values = answer.match(/Q = I²Rt = (\d+)² · (\d+) · (\d+) = (\d+) Дж/);
      return Boolean(values && resistance) && Number(values[1]) === Number(current) && Number(values[2]) === Number(resistance) && Number(values[3]) === Number(time) && Number(values[4]) === Number(current) ** 2 * Number(resistance) * Number(time);
    } },
    { topic: "средняя скорость на всём пути", prompt: /среднюю скорость на всём пути/i, answer: /vср = sобщ \/ tобщ/i, verify: (prompt, answer) => {
      const values = prompt.match(/прошло (\d+) км за (\d+) ч, затем ещё (\d+) км за (\d+) ч/)?.slice(1).map(Number);
      const average = Number(answer.match(/= (\d+) \/ (\d+) = ([\d,]+) км\/ч/)?.slice(1)[2]?.replace(",", "."));
      return Boolean(values) && Math.abs(average - (values[0] + values[2]) / (values[1] + values[3])) < 0.011;
    } },
    { topic: "ускорение тела", prompt: /скорость тела изменилась/i, answer: /a = \(v − v₀\) \/ t/i, verify: (prompt, answer) => {
      const values = prompt.match(/с (\d+) м\/с до (\d+) м\/с за (\d+) с/)?.slice(1).map(Number);
      const acceleration = Number(answer.match(/= \((\d+) − (\d+)\) \/ (\d+) = (\d+) м\/с²/)?.[4]);
      return Boolean(values) && acceleration === (values[1] - values[0]) / values[2];
    } },
    { topic: "сила трения", prompt: /коэффициент трения скольжения/i, answer: /Fтр = μN/i, verify: (prompt, answer) => {
      const [, mass, coefficientText] = prompt.match(/массой (\d+) кг.*μ = ([\d,]+)/) ?? [];
      const result = Number(answer.match(/= ([\d,]+) Н\.$/)?.[1]?.replace(",", "."));
      return Boolean(mass && coefficientText) && Math.abs(result - Number(mass) * 10 * Number(coefficientText.replace(",", "."))) < 0.001;
    } },
    { topic: "давление жидкости", prompt: /гидростатическое давление воды/i, answer: /p = ρgh/i, verify: (prompt, answer) => {
      const depth = Number(prompt.match(/глубине (\d+) м/)?.[1]);
      const result = Number(answer.match(/= 1000 · 10 · \d+ = ([\d ]+) Па/)?.[1]?.replaceAll(" ", ""));
      return result === 10000 * depth;
    } },
    { topic: "электрическое сопротивление проводника", prompt: /Найди сопротивление/i, answer: /R = U \/ I/i, verify: (prompt, answer) => {
      const [, voltage, current] = prompt.match(/напряжение (\d+) В, сила тока (\d+) А/) ?? [];
      const values = answer.match(/R = U \/ I = (\d+) \/ (\d+) = (\d+) Ом/);
      return Boolean(values && voltage) && Number(values[1]) === Number(voltage) && Number(values[2]) === Number(current) && Number(values[3]) === Number(voltage) / Number(current);
    } },
    { topic: "плавание тел и условие плавания", prompt: /плотность тела .* плотность жидкости/i, answer: /поэтому тело/i, verify: (prompt, answer) => {
      const [, bodyDensity, liquidDensity] = prompt.match(/тела (\d+) кг\/м³, плотность жидкости (\d+) кг\/м³/) ?? [];
      if (!bodyDensity) return false;
      return Number(bodyDensity) < Number(liquidDensity) ? /всплывёт и будет плавать/.test(answer)
        : Number(bodyDensity) > Number(liquidDensity) ? /опустится на дно/.test(answer) : /будет плавать в толще жидкости/.test(answer);
    } },
    { topic: "последовательное соединение резисторов", prompt: /соединены последовательно/i, answer: /Rобщ = R₁ \+ R₂/i, verify: (prompt, answer) => {
      const values = prompt.match(/сопротивлением (\d+) Ом и (\d+) Ом/)?.slice(1).map(Number);
      const total = Number(answer.match(/= (\d+) \+ (\d+) = (\d+) Ом/)?.[3]);
      return Boolean(values) && total === values[0] + values[1];
    } },
    { topic: "параллельное соединение резисторов", prompt: /соединены параллельно/i, answer: /Rобщ = R₁R₂\/\(R₁ \+ R₂\)/i, verify: (prompt, answer) => {
      const values = prompt.match(/резистора (\d+) Ом и (\d+) Ом/)?.slice(1).map(Number);
      const equivalent = Number(answer.match(/= (\d+) Ом\.$/)?.[1]);
      return Boolean(values) && Math.abs(equivalent - values[0] * values[1] / (values[0] + values[1])) < 0.001;
    } },
    { topic: "последовательное соединение конденсаторов", prompt: /соединены последовательно/i, answer: /Cобщ = C₁C₂\/\(C₁ \+ C₂\)/i, verify: (prompt, answer) => {
      const values = prompt.match(/ёмкостью (\d+) мкФ и (\d+) мкФ/)?.slice(1).map(Number);
      const equivalent = Number(answer.match(/= (\d+) мкФ\.$/)?.[1]);
      return Boolean(values) && equivalent === values[0] * values[1] / (values[0] + values[1]);
    } },
    { topic: "потенциальная энергия пружины", prompt: /пружину жёсткостью/i, answer: /Eупр = kx²\/2/i, verify: (prompt, answer) => {
      const [, stiffness, stretchCm] = prompt.match(/жёсткостью (\d+) Н\/м растянули на (\d+) см/) ?? [];
      const energy = Number(answer.match(/= ([\d,]+) Дж\.$/)?.[1]?.replace(",", "."));
      return Boolean(stiffness) && Math.abs(energy - Number(stiffness) * (Number(stretchCm) / 100) ** 2 / 2) < 0.0006;
    } },
    { topic: "закон сохранения механической энергии", prompt: /сохранения механической энергии/i, answer: /mgh = mv²\/2/i, verify: (prompt, answer) => {
      const height = Number(prompt.match(/высоты (\d+) м/)?.[1]);
      const speed = Number(answer.match(/= (\d+) м\/с\.$/)?.[1]);
      return speed ** 2 === 2 * 10 * height;
    } },
    { topic: "равномерное и неравномерное движение", prompt: /сравни скорости на участках/i, answer: /v₁ = .* м\/с; v₂ = .* м\/с/i, verify: (prompt, answer) => {
      const values = prompt.match(/прошло (\d+) м за (\d+) с, на втором — (\d+) м за (\d+) с/)?.slice(1).map(Number);
      const speeds = answer.match(/v₁ = (\d+)\/(\d+) = (\d+) м\/с; v₂ = (\d+)\/(\d+) = (\d+) м\/с/)?.slice(1).map(Number);
      return Boolean(values && speeds) && speeds[0] === values[0] && speeds[1] === values[1] && speeds[2] === values[0] / values[1] && speeds[3] === values[2] && speeds[4] === values[3] && speeds[5] === values[2] / values[3];
    } },
    { topic: "графики зависимости координаты от времени", prompt: /графике зависимости координаты x от времени/i, answer: /v = Δx\/Δt/i, verify: (prompt, answer) => {
      const values = prompt.match(/точки \(0 с; 0 м\) и \((\d+) с; (\d+) м\)/)?.slice(1).map(Number);
      const calculated = Number(answer.match(/v = Δx\/Δt = (\d+)\/(\d+) = (\d+) м\/с/)?.[3]);
      return Boolean(values) && calculated === values[1] / values[0];
    } },
  ];
  for (const check of physicsAlignmentCases) {
    const generated = curriculum.generateCurriculumAi("assignment", check.topic, "medium", 15, "Физика");
    report.physicsFocusedChecks += 1;
    const prompts = generated.items.map((item) => item.replace(/^\d+\.\s*/, ""));
    const answers = generated.answers.map((answer) => answer.replace(/^\d+\.\s*/, "").replace(/[\u00a0\u202f]/g, " "));
    const failures = [];
    if (generated.subject !== "Физика") failures.push(`предмет: ${generated.subject}`);
    if (prompts.length !== 15 || answers.length !== 15) failures.push(`ожидалось 15 задач и ответов, получено ${prompts.length}/${answers.length}`);
    if (prompts.some((prompt) => !check.prompt.test(prompt))) failures.push("формулировка не соответствует теме");
    if (answers.some((answer) => !check.answer.test(answer))) failures.push("ответ не содержит ожидаемого решения");
    if (check.verify && prompts.some((prompt, index) => !check.verify(prompt, answers[index]))) failures.push("расчёт ответа не сошёлся с условием");
    if (new Set(prompts).size !== prompts.length) failures.push("есть повторяющиеся задачи");
    if (failures.length) report.physicsFocusedFailures.push({ topic: check.topic, detected: generated.detected, firstPrompt: prompts[0], firstAnswer: answers[0], offTopicPrompts: prompts.filter((prompt) => !check.prompt.test(prompt)), failures });
  }

  const socialStudiesAlignmentCases = [
    { topic: "инфляция и покупательная способность", prompt: /цены выросли на \d+%/i, answer: /прежней покупательной способности/i, verify: (prompt, answer) => {
      const values = prompt.match(/доход не изменился и составляет ([\d\s\u00a0\u202f]+) ₽.*?выросли на (\d+)%/i)?.slice(1).map((value) => Number(value.replace(/[\s\u00a0\u202f]/g, "")));
      const result = Number(answer.match(/покрывает около ([\d\s\u00a0\u202f,]+) ₽/i)?.[1]?.replace(/[\s\u00a0\u202f]/g, "").replace(",", "."));
      return Boolean(values) && Math.abs(result - values[0] / (1 + values[1] / 100)) < 0.011;
    } },
    { topic: "банковский вклад и сложный процент", prompt: /вклад .* ежегодной капитализацией/i, answer: /каждый год проценты начисляются/i, verify: (prompt, answer) => {
      const values = prompt.match(/вклад ([\d\s\u00a0\u202f]+) ₽ приносит (\d+)% годовых.*?через (\d+) года/i)?.slice(1).map((value) => Number(value.replace(/[\s\u00a0\u202f]/g, "")));
      const result = Number(answer.match(/\^\d+ = ([\d\s\u00a0\u202f]+) ₽/i)?.[1]?.replace(/[\s\u00a0\u202f]/g, ""));
      return Boolean(values) && Math.abs(result - values[0] * (1 + values[1] / 100) ** values[2]) < 0.011;
    } },
    { topic: "заём и полная стоимость кредита", prompt: /заём .* простой процент .* отдельно указаны комиссия .* страхование/i, answer: /дополнительные расходы = .* все платежи с возвратом долга/i, verify: (prompt, answer) => {
      const values = prompt.match(/заём ([\d\s\u00a0\u202f]+) ₽ выдан на один год под простой процент (\d+)% годовых\. Отдельно указаны комиссия (\d+) ₽ и страхование (\d+) ₽/i)?.slice(1).map((value) => Number(value.replace(/[\s\u00a0\u202f]/g, "")));
      const results = answer.match(/Дополнительные расходы = .* = ([\d\s\u00a0\u202f]+) ₽\. Все платежи с возвратом долга: .* = ([\d\s\u00a0\u202f]+) ₽/i)?.slice(1).map((value) => Number(value.replace(/[\s\u00a0\u202f]/g, "")));
      const interest = values?.[0] * values?.[1] / 100;
      return Boolean(values && results) && results[0] === interest + values[2] + values[3] && results[1] === values[0] + results[0];
    } },
    { topic: "эластичность спроса и предложения", prompt: /цена товара выросла на \d+%, а величина спроса снизилась на \d+%/i, answer: /спрос эластичный/i, verify: (prompt, answer) => {
      const values = prompt.match(/выросла на (\d+)%, а величина спроса снизилась на (\d+)%/i)?.slice(1).map(Number);
      const result = Number(answer.match(/= ([\d.]+)\. Так как/i)?.[1]);
      return Boolean(values) && result === values[1] / values[0] && result > 1;
    } },
    { topic: "валовой внутренний продукт", prompt: /потребление составило \d+, инвестиции — \d+, государственные расходы — \d+, экспорт — \d+, импорт — \d+/i, answer: /ВВП = C \+ I \+ G \+ \(X − M\)/i, verify: (prompt, answer) => {
      const values = prompt.match(/потребление составило (\d+), инвестиции — (\d+), государственные расходы — (\d+), экспорт — (\d+), импорт — (\d+)/i)?.slice(1).map(Number);
      const result = Number(answer.match(/= (\d+) млрд ₽\.$/i)?.[1]);
      return Boolean(values) && result === values[0] + values[1] + values[2] + values[3] - values[4];
    } },
  ];
  for (const check of socialStudiesAlignmentCases) {
    const generated = curriculum.generateCurriculumAi("assignment", check.topic, "medium", 15, "Обществознание");
    report.socialStudiesFocusedChecks += 1;
    const prompts = generated.items.map((item) => item.replace(/^\d+\.\s*/, ""));
    const answers = generated.answers.map((answer) => answer.replace(/^\d+\.\s*/, "").replace(/[\u00a0\u202f]/g, " "));
    const failures = [];
    if (generated.subject !== "Обществознание") failures.push(`предмет: ${generated.subject}`);
    if (prompts.length !== 15 || answers.length !== 15) failures.push(`ожидалось 15 задач и ответов, получено ${prompts.length}/${answers.length}`);
    if (prompts.some((prompt) => !check.prompt.test(prompt))) failures.push("формулировка не соответствует теме");
    if (answers.some((answer) => !check.answer.test(answer))) failures.push("ответ не содержит ожидаемое объяснение");
    const mismatchedAnswers = check.verify ? prompts.map((prompt, index) => ({ index, prompt, answer: answers[index] })).filter(({ prompt, answer }) => !check.verify(prompt, answer)) : [];
    if (mismatchedAnswers.length) failures.push("расчёт ответа не сошёлся с условием");
    if (new Set(prompts).size !== prompts.length) failures.push("есть повторяющиеся задачи");
    if (answers.some((answer) => answer.startsWith("Ключ проверки:"))) failures.push("вместо конкретного ответа выдан общий критерий");
    if (failures.length) report.socialStudiesFocusedFailures.push({ topic: check.topic, detected: generated.detected, firstPrompt: prompts[0], firstAnswer: answers[0], verificationExamples: mismatchedAnswers.slice(0, 2), failures });
  }

  const literatureFactCases = [
    { topic: "Евгений Онегин и образ Татьяны Лариной", title: "Евгений Онегин", answer: "Автор — А.С. Пушкин; жанр — роман в стихах." },
    { topic: "Капитанская дочка и тема чести", title: "Капитанская дочка", answer: "Автор — А.С. Пушкин; жанр — роман." },
    { topic: "Мёртвые души и образ помещиков", title: "Мёртвые души", answer: "Автор — Н.В. Гоголь; жанр — поэма." },
    { topic: "Ревизор и комическое в пьесе", title: "Ревизор", answer: "Автор — Н.В. Гоголь; жанр — комедия." },
    { topic: "Горе от ума и конфликт поколений", title: "Горе от ума", answer: "Автор — А.С. Грибоедов; жанр — комедия." },
    { topic: "Герой нашего времени и композиция романа", title: "Герой нашего времени", answer: "Автор — М.Ю. Лермонтов; жанр — роман." },
    { topic: "поэма Мцыри и романтический герой", title: "Мцыри", answer: "Автор — М.Ю. Лермонтов; жанр — поэма." },
    { topic: "проблематика романа Отцы и дети", title: "Отцы и дети", answer: "Автор — И.С. Тургенев; жанр — роман." },
    { topic: "Отцы и дети и спор поколений", title: "Отцы и дети", answer: "Автор — И.С. Тургенев; жанр — роман." },
    { topic: "Война и мир и нравственный выбор героев", title: "Война и мир", answer: "Автор — Л.Н. Толстой; жанр — роман-эпопея." },
    { topic: "Преступление и наказание и теория Раскольникова", title: "Преступление и наказание", answer: "Автор — Ф.М. Достоевский; жанр — роман." },
    { topic: "Мастер и Маргарита и нравственная проблематика", title: "Мастер и Маргарита", answer: "Автор — М.А. Булгаков; жанр — роман." },
  ];
  for (const check of literatureFactCases) {
    const generated = curriculum.generateCurriculumAi("assignment", check.topic, "medium", 15, "Литература");
    report.literatureFactChecks += 1;
    const firstPrompt = generated.items[0]?.replace(/^\d+\.\s*/, "") ?? "";
    const firstAnswer = generated.answers[0]?.replace(/^\d+\.\s*/, "") ?? "";
    const failures = [];
    if (generated.subject !== "Литература") failures.push(`предмет определён как ${generated.subject}`);
    if (!firstPrompt.includes(check.title)) failures.push("задание не относится к проверяемому произведению");
    if (firstAnswer !== check.answer) failures.push(`неверный ключ: ${firstAnswer}`);
    if (firstAnswer.startsWith("Ключ проверки:")) failures.push("вместо конкретного ответа выдан общий критерий");
    if (failures.length) report.literatureFactFailures.push({ topic: check.topic, firstPrompt, firstAnswer, failures });
  }

  const cases = [
    {
      input: "Сделай 10 простых задач по математике на простые числа для 7 класса",
      expected: { subject: "Математика", topic: "простые числа", count: 10, grade: 7, tool: "assignment", level: "easy", hasCount: true, hasTool: true, hasLevel: true },
    },
    {
      input: "Подготовь 5 олимпиадных задач на числа до миллиона для 4 класса",
      expected: { subject: "Математика", count: 5, grade: 4, tool: "assignment", level: "hard", olympiad: true, hasCount: true, hasTool: true, hasLevel: true },
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

  // Handwritten teacher-style requests, not generated from the topic/template matrix above.
  const independentCases = [
    { input: "Составь десять задач на треугольники для 7 класса", expected: { subject: "Математика", count: 10, grade: 7, tool: "assignment" } },
    { input: "Составь 10 нестандартных задач на треугольники для 7 класса", expected: { subject: "Математика", count: 10, grade: 7, tool: "assignment", level: "hard", olympiad: true } },
    { input: "Составь 5 нестандартных задач по математике на треугольники для 8 класса", expected: { subject: "Математика", topic: "треугольники", count: 5, grade: 8, tool: "assignment", level: "hard", olympiad: true } },
    { input: "Подготовь 4 нестандартных задания по физике на рычаги для 7 класса", expected: { subject: "Физика", topic: "рычаги", count: 4, grade: 7, tool: "assignment", level: "hard", olympiad: true } },
    { input: "Придумай 5 задач на сообразительность про дроби для 5 класса", expected: { subject: "Математика", count: 5, grade: 5, tool: "assignment", olympiad: true } },
    { input: "Нужно 5 упражнений про силу трения в 7 классе", expected: { subject: "Физика", count: 5, grade: 7, tool: "assignment" } },
    { input: "Подготовь 3 задания: реакция нейтрализации, 8 класс", expected: { subject: "Химия", count: 3, grade: 8, tool: "assignment" } },
    { input: "Сделай четыре карточки по фотосинтезу для шестого класса", expected: { subject: "Биология", count: 4, grade: 6, tool: "flashcards" } },
    { input: "Дай 6 вопросов про климатические пояса для 7 класса", expected: { subject: "География", count: 6, grade: 7, tool: "quiz" } },
    { input: "Составь 8 упражнений на Н и НН в причастиях", expected: { subject: "Русский язык", count: 8, tool: "assignment" } },
    { input: "Придумай 5 вопросов по Евгению Онегину", expected: { subject: "Литература", count: 5, tool: "quiz" } },
    { input: "Сделай 6 заданий про реформы Петра Первого для 8 класса", expected: { subject: "История", count: 6, grade: 8, tool: "assignment" } },
    { input: "Подготовь 4 задания про семейный бюджет", expected: { subject: "Обществознание", count: 4, tool: "assignment" } },
    { input: "Дай 7 заданий на алгоритмы с ветвлением", expected: { subject: "Информатика", count: 7, tool: "assignment" } },
    { input: "Сделай 10 карточек по Past Simple для шестого класса", expected: { subject: "Иностранный язык", count: 10, grade: 6, tool: "flashcards" } },
    { input: "Накидай семь примеров на деление дробей пятиклассникам", expected: { subject: "Математика", count: 7, tool: "assignment" } },
    { input: "Короткую проверочную по площади круга, 9 класс, шесть вопросов", expected: { subject: "Математика", count: 6, grade: 9, tool: "quiz" } },
    { input: "Нужны 12 карточек: пропорции, математика, 6 класс", expected: { subject: "Математика", count: 12, grade: 6, tool: "flashcards" } },
    { input: "Подготовь три несложные задачи на проценты для 4 класса", expected: { subject: "Математика", count: 3, grade: 4, tool: "assignment", level: "easy" } },
    { input: "Сделай 9 вопросов для теста по закону Ома, физика, 8 класс", expected: { subject: "Физика", count: 9, grade: 8, tool: "quiz" } },
    { input: "Для урока в седьмом классе — пять упражнений на давление газа", expected: { subject: "Физика", count: 5, grade: 7, tool: "assignment" } },
    { input: "Подбери 4 карточки про отражение света для 8 класса", expected: { subject: "Физика", count: 4, grade: 8, tool: "flashcards" } },
    { input: "Двенадцать задач повышенной сложности по механической работе, 7 класс", expected: { subject: "Физика", count: 12, grade: 7, tool: "assignment", level: "hard" } },
    { input: "Подготовь 6 вопросов для викторины по таблице Менделеева", expected: { subject: "Химия", count: 6, tool: "quiz" } },
    { input: "Нужно четыре карточки на валентность для восьмого класса", expected: { subject: "Химия", count: 4, grade: 8, tool: "flashcards" } },
    { input: "Сделай 8 упражнений по химии на расстановку коэффициентов", expected: { subject: "Химия", count: 8, tool: "assignment" } },
    { input: "Для 9 класса составь 5 вопросов о кислотах и основаниях", expected: { subject: "Химия", count: 5, grade: 9, tool: "quiz" } },
    { input: "Шесть заданий про пищевые цепи, биология", expected: { subject: "Биология", count: 6, tool: "assignment" } },
    { input: "Сделай 5 карточек по строению листа для шестого класса", expected: { subject: "Биология", count: 5, grade: 6, tool: "flashcards" } },
    { input: "Десять вопросов для теста по наследственности в 9 классе", expected: { subject: "Биология", count: 10, grade: 9, tool: "quiz" } },
    { input: "Подготовь три упражнения на дыхательную систему человека", expected: { subject: "Биология", count: 3, tool: "assignment" } },
    { input: "Составь 7 карточек для работы с координатами на карте", expected: { subject: "География", count: 7, tool: "flashcards" } },
    { input: "Восемь вопросов по природным зонам России для 8 класса", expected: { subject: "География", count: 8, grade: 8, tool: "quiz" } },
    { input: "Нужно 4 задания на круговорот воды", expected: { subject: "География", count: 4, tool: "assignment" } },
    { input: "Для девятого класса сделай пять тестовых вопросов про отрасли хозяйства", expected: { subject: "География", count: 5, grade: 9, tool: "quiz" } },
    { input: "Сделай 6 упражнений на разбор слова по составу для 3 класса", expected: { subject: "Русский язык", count: 6, grade: 3, tool: "assignment" } },
    { input: "Пять карточек на правописание НЕ с глаголами", expected: { subject: "Русский язык", count: 5, tool: "flashcards" } },
    { input: "Подготовь 9 вопросов по однородным членам предложения, 8 класс", expected: { subject: "Русский язык", count: 9, grade: 8, tool: "quiz" } },
    { input: "Нужно три несложных задания на склонение существительных", expected: { subject: "Русский язык", count: 3, tool: "assignment", level: "easy" } },
    { input: "Составь 5 вопросов для обсуждения по Капитанской дочке", expected: { subject: "Литература", count: 5, tool: "quiz" } },
    { input: "Четыре карточки по басням Крылова для 5 класса", expected: { subject: "Литература", count: 4, grade: 5, tool: "flashcards" } },
    { input: "Подготовь 7 заданий на характеристику героя романа", expected: { subject: "Литература", count: 7, tool: "assignment" } },
    { input: "Десять вопросов для викторины по поэзии Серебряного века", expected: { subject: "Литература", count: 10, tool: "quiz" } },
    { input: "Сделай 8 заданий о Смутном времени, 7 класс", expected: { subject: "История", count: 8, grade: 7, tool: "assignment" } },
    { input: "Три карточки про Древний Египет для пятого класса", expected: { subject: "История", count: 3, grade: 5, tool: "flashcards" } },
    { input: "Подготовь 6 вопросов по причинам Первой мировой войны", expected: { subject: "История", count: 6, tool: "quiz" } },
    { input: "Нужно двенадцать тестовых вопросов про реформы Александра II для 8 класса", expected: { subject: "История", count: 12, grade: 8, tool: "quiz" } },
    { input: "Составь 5 заданий на права ребёнка", expected: { subject: "Обществознание", count: 5, tool: "assignment" } },
    { input: "Семь карточек по налогам и семейному бюджету для 8 класса", expected: { subject: "Обществознание", count: 7, grade: 8, tool: "flashcards" } },
    { input: "Сделай 4 вопроса для викторины о разделении властей", expected: { subject: "Обществознание", count: 4, tool: "quiz" } },
    { input: "Для девятого класса нужны 9 заданий про спрос и предложение", expected: { subject: "Обществознание", count: 9, grade: 9, tool: "assignment" } },
    { input: "Подготовь 6 упражнений на циклы со счётчиком", expected: { subject: "Информатика", count: 6, tool: "assignment" } },
    { input: "Пять карточек по двоичной системе счисления для 8 класса", expected: { subject: "Информатика", count: 5, grade: 8, tool: "flashcards" } },
    { input: "Сделай тест из 10 вопросов на логические выражения", expected: { subject: "Информатика", count: 10, tool: "quiz" } },
    { input: "Нужны 3 задания для 7 класса по электронным таблицам", expected: { subject: "Информатика", count: 3, grade: 7, tool: "assignment" } },
    { input: "Подготовь восемь карточек на неправильные глаголы английского языка", expected: { subject: "Иностранный язык", count: 8, tool: "flashcards" } },
    { input: "Сделай 5 упражнений на артикли для 6 класса", expected: { subject: "Иностранный язык", count: 5, grade: 6, tool: "assignment" } },
    { input: "Десять вопросов для теста по немецким модальным глаголам", expected: { subject: "Иностранный язык", count: 10, tool: "quiz" } },
    { input: "Нужно 4 карточки по французской лексике на тему путешествий", expected: { subject: "Иностранный язык", count: 4, tool: "flashcards" } },
  ];
  for (const { input, expected } of independentCases) {
    report.independentParserCases += 1;
    const actual = curriculum.parseCurriculumRequest(input);
    const mismatches = Object.entries({ ...expected, hasTopic: true }).filter(([key, value]) =>
      key === "hasTopic" ? Boolean(actual.topic.trim()) !== value : actual[key] !== value,
    );
    if (mismatches.length) report.independentParserFailures.push({ input, mismatches: mismatches.map(([key, value]) => ({ key, expected: value, actual: actual[key] })) });
  }

  const gradeGenerationGuidance = {
    primary: { easy: "Реши один короткий пример; при необходимости нарисуй схему.", medium: "Разбей решение на два коротких шага и запиши ответ.", hard: "Реши задачу в несколько действий знакомыми способами; объясни ход простыми словами." },
    middle: { easy: "Примени одно изученное правило или понятие к примеру.", medium: "Покажи ход рассуждения и кратко объясни результат.", hard: "Сопоставь два случая, найди общее правило и объясни различие." },
    upper: { easy: "Примени изученное правило или понятие к одному случаю и укажи основание ответа.", medium: "Свяжи несколько шагов, обоснуй выбор правила и поясни результат.", hard: "Соедини несколько понятий, проверь вывод на другом случае и объясни ограничения." },
    senior: { easy: "Примени ключевое понятие к ситуации и укажи основание ответа.", medium: "Обоснуй ход решения, подкрепив вывод расчётом или аргументом.", hard: "Сравни подходы, назови допущения и оцени ограничения вывода." },
  };
  const representativeGrade = (band) => Number(band.match(/^\d+/)?.[0] ?? 0);
  const instructionBand = (grade) => grade <= 4 ? "primary" : grade <= 6 ? "middle" : grade <= 9 ? "upper" : "senior";
  for (const [subject, mapping] of Object.entries(gradeMap.subjects ?? {})) {
    const topicsByGrade = mapping.topicsByGradeBand ?? mapping.topicsByGrade ?? {};
    for (const [mappedBand, topics] of Object.entries(topicsByGrade)) {
      const topic = topics[0];
      if (!topic) continue;
      const grade = representativeGrade(mappedBand);
      for (const level of ["easy", "medium", "hard"]) {
        for (const tool of ["assignment", "quiz", "flashcards"]) {
          const generated = curriculum.generateCurriculumAi(tool, `${topic} для ${grade} класса`, level, 1, subject);
          report.gradeGenerationCases += 1;
          const expectedInstruction = `Для ${grade} класса: ${gradeGenerationGuidance[instructionBand(grade)][level]}`;
          const failures = [];
          if (generated.subject !== subject) failures.push(`неверный предмет: ${generated.subject}`);
          if (!generated.title.includes(`${grade} класс`)) failures.push("класс отсутствует в заголовке");
          if (!generated.items.length || generated.items.some((item) => !item.includes(expectedInstruction))) failures.push("классно-уровневая инструкция отсутствует или не соответствует выбранным параметрам");
          if (failures.length) report.gradeGenerationFailures.push({ subject, topic, grade, level, tool, title: generated.title, firstItem: generated.items[0], failures });
        }
      }
      const first = representativeGrade(mappedBand);
      const lastMatch = mappedBand.match(/-(\d+)$/);
      const last = Number(lastMatch?.[1] ?? first);
      const mismatchedGrade = first > 1 ? first - 1 : (last < 11 ? last + 1 : 0);
      if (mismatchedGrade) {
        report.gradeMismatchChecks += 1;
        try {
          curriculum.generateCurriculumAi("assignment", `${topic} для ${mismatchedGrade} класса`, "medium", 1, subject);
          report.gradeMismatchFailures.push({ subject, topic, mappedBand, mismatchedGrade, reason: "запрос с неподходящим классом не был остановлен" });
        } catch (error) {
          if (!String(error?.message ?? error).includes("предварительной карте Lectrus")) {
            report.gradeMismatchFailures.push({ subject, topic, mappedBand, mismatchedGrade, reason: String(error?.message ?? error) });
          }
        }
      }
    }
  }

  const subjectPhrases = {
    "Математика": "математике",
    "Физика": "физике",
    "Химия": "химии",
    "Биология": "биологии",
    "География": "географии",
    "Русский язык": "русскому языку",
    "Литература": "литературе",
    "История": "истории",
    "Обществознание": "обществознанию",
    "Информатика": "информатике",
    "Иностранный язык": "иностранному языку",
  };
  const counts = [2, 5, 10, 15];
  for (const [subject, topics] of Object.entries(corpus)) {
    const subjectPhrase = subjectPhrases[subject];
    for (let index = 0; index < 22; index += 1) {
      const topic = topics[(index * 3) % topics.length];
      const grade = (index % 11) + 1;
      const count = counts[index % counts.length];
      const variant = index % 4;
      const forms = [
        { input: `Сделай ${count} простых задач по ${subjectPhrase} на тему «${topic}» для ${grade} класса`, expected: { tool: "assignment", level: "easy", hasLevel: true } },
        { input: `Составь ${count} сложных упражнений по ${subjectPhrase} на тему «${topic}» для ${grade} класса`, expected: { tool: "assignment", level: "hard", hasLevel: true } },
        { input: `Подготовь ${count} вопросов по ${subjectPhrase} на тему «${topic}» для ${grade} класса`, expected: { tool: "quiz", hasLevel: false } },
        { input: `Создай ${count} флеш-карточек по ${subjectPhrase} на тему «${topic}» для ${grade} класса`, expected: { tool: "flashcards", hasLevel: false } },
      ];
      const sample = forms[variant];
      const normalizedTopic = topic.replace(/[«»“”]+/g, "").replace(/\s+/g, " ").trim();
      const expected = { subject, topic: normalizedTopic, count, grade, ...sample.expected, hasCount: true, hasTool: true };
      const actual = curriculum.parseCurriculumRequest(sample.input);
      report.generatedParserCases += 1;
      report.generatedParserCasesBySubject[subject] = (report.generatedParserCasesBySubject[subject] ?? 0) + 1;
      report.generatedParserCasesByGrade[grade] = (report.generatedParserCasesByGrade[grade] ?? 0) + 1;
      const mismatches = Object.entries(expected).filter(([key, value]) => actual[key] !== value);
      if (mismatches.length) report.generatedParserFailures.push({ input: sample.input, mismatches: mismatches.map(([key, value]) => ({ key, expected: value, actual: actual[key] })) });
    }
  }

  report.exactTopicRecognitionRate = Number((report.exactTopicRecognition / report.topics).toFixed(4));
  report.specificExerciseCoverageRate = Number((report.topicsWithSpecificExercise / report.topics).toFixed(4));
  report.boardTransferTargetCases = report.topics * 3;
  report.boardTransferRate = report.boardTransferTargetCases
    ? Number(((report.boardTransferCases - report.boardTransferFailures.length) / report.boardTransferTargetCases).toFixed(4))
    : 0;
  report.offlineFetchAttempts = offlineFetchAttempts;
  for (const coverage of Object.values(report.exerciseCoverageBySubject)) {
    coverage.rate = Number((coverage.specific / coverage.total).toFixed(4));
  }
  console.log(JSON.stringify(report, null, 2));

  const failures = report.exactTopicRecognition !== report.topics
    || report.wrongSubjectSets > 0
    || report.incompleteSets > 0
    || report.emptyAnswers > 0
    || report.repeatedSets > 0
    || report.gradeMapErrors.length > 0
    || report.parserFailures.length > 0
    || report.independentParserFailures.length > 0
    || report.generatedParserFailures.length > 0
    || report.gradeGenerationFailures.length > 0
    || report.runtimeGradeMapFailures.length > 0
    || report.gradeMismatchFailures.length > 0
    || report.officialCoverageFailures.length > 0
    || report.gradeOneMathFailures.length > 0
    || report.gradeTwoMathFailures.length > 0
    || report.gradeThreeMathFailures.length > 0
    || report.modelFetchesOnWarmup !== 1
    || report.offlineFetchAttempts !== 0
    || report.offlineGenerationCases !== report.topics
    || report.mathFocusedFailures.length > 0
    || report.physicsFocusedFailures.length > 0
    || report.socialStudiesFocusedFailures.length > 0
    || report.literatureFactFailures.length > 0;
  const boardTransferTargetsMet = report.boardTransferCases === report.topics * 3
    && report.boardTransferFailures.length === 0;
  if (!boardTransferTargetsMet) process.exitCode = 1;
  if (failures) process.exitCode = 1;
} finally {
  await server.close();
}
