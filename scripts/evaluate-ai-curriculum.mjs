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
    independentParserCases: 0,
    independentParserFailures: [],
    gradeGenerationCases: 0,
    gradeGenerationFailures: [],
    runtimeGradeMapChecks: 0,
    runtimeGradeMapFailures: [],
    gradeMismatchChecks: 0,
    gradeMismatchFailures: [],
    mathFocusedChecks: 0,
    mathFocusedFailures: [],
    physicsFocusedChecks: 0,
    physicsFocusedFailures: [],
    socialStudiesFocusedChecks: 0,
    socialStudiesFocusedFailures: [],
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
  }

  for (const [subject, topics] of Object.entries(corpus)) {
    for (const topic of topics) {
      report.topics += 1;
      if (curriculum.detectCurriculumSubject(topic) === subject) report.exactTopicRecognition += 1;

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
    if (check.verify && prompts.some((prompt, index) => !check.verify(prompt, answers[index]))) failures.push("расчёт ответа не сошёлся с условием");
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

  // Handwritten teacher-style requests, not generated from the topic/template matrix above.
  const independentCases = [
    { input: "Составь десять задач на треугольники для 7 класса", expected: { subject: "Математика", count: 10, grade: 7, tool: "assignment" } },
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
      const normalizedTopic = topic.replace(/[,:;.!?«»“”]+/g, " ").replace(/\s+/g, " ").trim();
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
    || report.mathFocusedFailures.length > 0
    || report.physicsFocusedFailures.length > 0
    || report.socialStudiesFocusedFailures.length > 0;
  if (failures) process.exitCode = 1;
} finally {
  await server.close();
}
