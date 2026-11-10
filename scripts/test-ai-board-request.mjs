import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createServer } from "vite";

const server = await createServer({ configFile: "./vite.config.ts", server: { middlewareMode: true }, appType: "custom" });
try {
  const curriculum = await server.ssrLoadModule("/src/aiCurriculumGenerator.ts");
  const exerciseBank = await server.ssrLoadModule("/src/aiSubjectExerciseBank.ts");
  const classifier = await server.ssrLoadModule("/src/aiSubjectIntentClassifier.ts");
  const modelJson = await readFile("public/models/aiSubjectIntentModel.json", "utf8");
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(modelJson, { status: 200, headers: { "Content-Type": "application/json" } });
  try {
    await classifier.loadCurriculumSubjectModel();
  } finally {
    globalThis.fetch = originalFetch;
  }
  assert.equal(classifier.classifyCurriculumSubject("Составь 4 задачи на молярную массу в 8 классе"), "Химия", "A high-specificity chemical term must outrank generic math-like task wording");
  assert.equal(classifier.classifyCurriculumSubject("Хочу вопросы на тему физические величины и измерения"), "Физика");
  assert.equal(curriculum.parseCurriculumRequest("Сделай тест из пяти вопросов о линейном расширении тел").subject, "Физика", "Thermal expansion must resolve to physics even when the subject is omitted");
  assert.equal(classifier.classifyCurriculumSubject("Подготовь 3 карточки на спряжение глаголов"), "Русский язык");
  assert.equal(classifier.classifyCurriculumSubject("Дай четыре задачи на показатель преломления стекла"), "Физика");
  assert.equal(curriculum.parseCurriculumRequest("Проверочная на четыре вопроса об аксиомах стереометрии").subject, "Математика");
  assert.equal(curriculum.parseCurriculumRequest("Проверочная из четырёх вопросов на обращение и запятые").subject, "Русский язык");
  assert.equal(classifier.classifyCurriculumSubject("Составь 4 задачи по физике на плотность для 8 класса"), "Физика");
  assert.equal(curriculum.parseCurriculumRequest("Подготовь 9 вопросов для викторины о нервной системе в 8 классе").subject, "Биология");
  assert.equal(curriculum.parseCurriculumRequest("Сделай 6 карточек на сравнительную степень прилагательных в английском").subject, "Иностранный язык");

  const broadRussianTopic = curriculum.parseCurriculumRequest("Сложное предложение", "Русский язык", 1, "medium", "assignment");
  assert.equal(broadRussianTopic.topic.toLocaleLowerCase("ru-RU"), "сложное предложение", "A grammar topic beginning with сложное must not be stripped as a difficulty adjective");
  const complexSentenceSet = curriculum.generateCurriculumAi("assignment", "Сложное предложение", "medium", 3, "Русский язык");
  assert.ok(complexSentenceSet.items.every((item) => /сложн|част[ьяи].*предложен|грамматическ.*основ/u.test(item)), "Complex-sentence tasks must stay on the requested grammar topic");
  assert.ok(complexSentenceSet.answers.every((answer) => !answer.startsWith("Ключ проверки:")), "Complex-sentence tasks must include subject-specific answer guidance");

  const unstressedVowelSet = curriculum.generateCurriculumAi("assignment", "3 упражнения для 5 класса на безударные гласные в корне слова", "medium", 3, "Русский язык");
  assert.ok(unstressedVowelSet.items.every((item) => /безударн.*гласн.*корн.*слова/u.test(item)), "Unstressed-vowel tasks must ask for the requested orthographic skill");
  assert.ok(unstressedVowelSet.answers.every((answer) => /проверочн.*слов/u.test(answer)), "Unstressed-vowel answers must include a stress-bearing check word");
  assert.ok(unstressedVowelSet.items.every((item) => !/чередован/u.test(item)), "Unstressed-vowel tasks must not be replaced with the unrelated alternating-root rule");

  const complexSubordinateSet = curriculum.generateCurriculumAi("assignment", "Составь 3 сложных задания по русскому языку для 9 класса на сложноподчинённые предложения", "medium", 3, "Русский язык");
  assert.equal(new Set(complexSubordinateSet.items).size, 3, "A multi-task set must not repeat prompts");
  assert.ok(complexSubordinateSet.items.every((item) => /предложен|союз|придаточ/u.test(item)), "Every requested complex-sentence task must remain on topic");
  assert.ok(complexSubordinateSet.items.every((item) => /все грамматические основы/u.test(item)), "Hard complex-sentence requests must require analysis of all clauses");
  assert.ok(complexSubordinateSet.answers.every((answer) => /две придаточ/iu.test(answer)), "Every hard complex-sentence key must identify both subordinate clauses");
  assert.ok(complexSubordinateSet.answers.every((answer) => !/союзное слово «когда»/iu.test(answer)), "The temporal subordinate example must identify «когда» as a conjunction here");

  const participialSet = curriculum.generateCurriculumAi("flashcards", "Сделай 3 карточки по русскому языку на причастный оборот для 7 класса", "medium", 3, "Русский язык");
  assert.equal(new Set(participialSet.items).size, 3, "A participial-phrase card set must contain unique tasks");
  assert.ok(participialSet.items.every((item) => /причастн.*оборот/u.test(item)), "Every card must remain on the requested participial-phrase topic");
  assert.ok(participialSet.answers.every((answer) => /причастн.*оборот/iu.test(answer)), "Every card must have a topic-specific answer key");

  const olympiadDivisibilitySet = curriculum.generateCurriculumAi("assignment", "Составь 3 олимпиадные задачи по математике на делимость чисел", "hard", 3, "Математика");
  assert.equal(olympiadDivisibilitySet.items.length, 3, "An olympiad divisibility request must preserve the requested task count");
  assert.ok(olympiadDivisibilitySet.items.every((item) => /делятся на|делится на/u.test(item)), "Olympiad divisibility prompts must actually test divisibility");
  assert.ok(olympiadDivisibilitySet.answers.every((answer) => /делимост|делится|делятся/u.test(answer)), "Olympiad divisibility answer keys must explain the relevant divisibility condition");
  assert.match(olympiadDivisibilitySet.answers[0], /18, 36, 54, 72, 90/u, "The first divisibility puzzle must enumerate every valid multiple of 6");
  assert.match(olympiadDivisibilitySet.answers[1], /28, 64/u, "The second divisibility puzzle must list both and only valid multiples of 4");
  assert.match(olympiadDivisibilitySet.answers[2], /Исходное число 36/u, "The digit-reversal divisibility puzzle must have the correct solution");

  const hardPythagorasSet = curriculum.generateCurriculumAi("assignment", "Нужны 3 сложные задачи на теорему Пифагора для 8 класса", "hard", 3, "Математика");
  assert.equal(new Set(hardPythagorasSet.items).size, 3, "Advanced Pythagorean tasks must not be scaled copies of one basic exercise");
  assert.ok(hardPythagorasSet.items.every((item) => /прямоугольн|равнобедренн/iu.test(item)), "Every advanced task must apply the Pythagorean theorem in a right-triangle context");
  assert.match(hardPythagorasSet.answers[0], /15 м.*1 м/u, "The first multi-step Pythagorean answer must calculate the diagonal and cable remainder");
  assert.match(hardPythagorasSet.answers[1], /24 см.*84 см².*56 см/u, "The second Pythagorean answer must calculate the missing leg, area and perimeter");
  assert.match(hardPythagorasSet.answers[2], /12 см.*60 см².*36 см/u, "The third Pythagorean answer must calculate the isosceles altitude, area and perimeter");

  const olympiadPythagorasSet = curriculum.generateCurriculumAi("assignment", "Составь 3 олимпиадные задачи по математике на теорему Пифагора", "hard", 3, "Математика");
  assert.ok(olympiadPythagorasSet.items.every((item) => /прямоугольн|равнобедренн/iu.test(item)), "Olympiad Pythagorean requests must produce actual theorem problems, not generic research rubrics");
  assert.ok(olympiadPythagorasSet.answers.every((answer) => /√|теорем[а-яё]* Пифагора/u.test(answer)), "Olympiad Pythagorean solutions must show a verifiable calculation");

  const olympiadEnergySet = curriculum.generateCurriculumAi("assignment", "Нужно 3 нестандартных задачи по физике на сохранение энергии для 9 класса", "hard", 3, "Физика");
  assert.equal(new Set(olympiadEnergySet.items).size, 3, "Energy conservation challenges must cover distinct physical situations");
  assert.ok(olympiadEnergySet.items.every((item) => /энерги|пружин|скорост|высот/u.test(item)), "Energy challenges must present concrete energy-conservation problems");
  assert.ok(olympiadEnergySet.answers.every((answer) => /энерги[яи]|v₂|v₀|скорость/iu.test(answer)), "Energy challenge keys must contain a topic-specific solution");
  assert.match(olympiadEnergySet.answers[1], /20 м.*10 м\/с/u, "The vertical-throw energy solution must give the correct maximum height and speed");

  const olympiadRedoxSet = curriculum.generateCurriculumAi("assignment", "Подготовь 3 олимпиадные задачи по химии на окислительно-восстановительные реакции", "hard", 3, "Химия");
  assert.equal(new Set(olympiadRedoxSet.items).size, 3, "Redox challenges must not repeat generic investigation rubrics");
  assert.ok(olympiadRedoxSet.items.every((item) => /электронн.*баланс|окислител|коэффициент/u.test(item)), "Redox challenges must ask for specific redox reasoning");
  assert.ok(olympiadRedoxSet.answers.every((answer) => /окислител.*восстановител|принимают.*e|отдают.*e/u.test(answer)), "Redox challenge keys must identify electron transfer and roles");
  const subscripts = new Map([..."₀₁₂₃₄₅₆₇₈₉"].map((digit, value) => [digit, String(value)]));
  const parseFormula = (formula) => {
    const atomCounts = new Map();
    const tokens = [...formula.matchAll(/([A-Z][a-z]?)([₀₁₂₃₄₅₆₇₈₉]*)/gu)];
    assert.ok(tokens.length > 0 && tokens.map((token) => token[0]).join("") === formula, `Could not parse chemical formula: ${formula}`);
    for (const [, element, subscript] of tokens) {
      const amount = subscript ? Number([...subscript].map((digit) => subscripts.get(digit)).join("")) : 1;
      atomCounts.set(element, (atomCounts.get(element) ?? 0) + amount);
    }
    return atomCounts;
  };
  const atomTotals = (side) => {
    const totals = new Map();
    for (const rawTerm of side.split(/\s*\+\s*/u)) {
      const term = rawTerm.match(/^(\d+)\s*(.+)$/u);
      const coefficient = term ? Number(term[1]) : 1;
      const atoms = parseFormula(term ? term[2] : rawTerm);
      for (const [element, amount] of atoms) totals.set(element, (totals.get(element) ?? 0) + coefficient * amount);
    }
    return totals;
  };
  for (const [index, answer] of olympiadRedoxSet.answers.entries()) {
    const arrowIndex = answer.indexOf("→");
    assert.ok(arrowIndex >= 0, `Redox answer ${index + 1} must include a balanced equation`);
    const reactantSide = answer.slice(0, arrowIndex).split(/[:.]|\n/u).at(-1)?.trim() ?? "";
    const productSide = answer.slice(arrowIndex + 1).split(/[.;\n]/u)[0]?.trim() ?? "";
    const reactants = atomTotals(reactantSide);
    const products = atomTotals(productSide);
    assert.deepEqual([...products].sort(), [...reactants].sort(), `Redox equation ${index + 1} must conserve every element`);
  }

  for (const [prompt, expectedSubject] of [
    ["Составь 5 заданий по физике на движение тел с ускорением", "Физика"],
    ["Составь 5 упражнений по химии на валентность элементов", "Химия"],
    ["Подготовь 5 заданий по русскому языку на деепричастные обороты", "Русский язык"],
    ["Сделай 5 задач по математике на площади треугольников", "Математика"],
    ["Составь примеры на установление коэффициентов методом электронного баланса", "Химия"],
    ["Сделай задания на определение вида придаточного в сложноподчинённом предложении", "Русский язык"],
  ]) {
    const request = curriculum.parseCurriculumRequest(prompt, "", 6, "medium", "assignment");
    assert.equal(request.subject, expectedSubject, `Subject was not preserved from a natural request: ${prompt}`);
    assert.match(request.topic, /движени|валентност|деепричаст|площад|электрон|баланс|придаточ/i, `Inflected topic was not preserved: ${prompt}`);
  }

  // A board's current subject is a default, not a lock: an explicit subject
  // in a natural command must determine both parsing and generated material.
  for (const [prompt, expectedSubject] of [
    ["Сделай 3 задания по физике на закон Ома", "Физика"],
    ["Подготовь 3 задачи по химии на молярную массу", "Химия"],
    ["Составь 3 упражнения по русскому языку на причастные обороты", "Русский язык"],
  ]) {
    const request = curriculum.parseCurriculumRequest(prompt, "Математика", 5, "medium", "assignment");
    assert.equal(request.subject, expectedSubject, `An explicit subject must override the selected board subject: ${prompt}`);
    const generated = curriculum.generateCurriculumAi(request.tool, prompt, request.level, request.count, request.subject);
    assert.equal(generated.subject, expectedSubject, `Generation must follow the explicit subject: ${prompt}`);
    assert.equal(generated.items.length, 3, `Requested count was lost: ${prompt}`);
  }

  for (const prompt of [
    "Сделай 5 задач на корень",
    "Нужно 4 упражнения на предложение",
    "Дай 3 задачки на таблицу",
    "Составь 4 задания на состав",
  ]) {
    const parsed = curriculum.parseCurriculumRequest(prompt);
    assert.equal(parsed.subject, "", `An underspecified subject should trigger clarification: ${prompt} => ${JSON.stringify(parsed)}`);
  }
  for (const [prompt, expectedSubject] of [
    ["Сделай 5 задач на квадратный корень", "Математика"],
    ["Составь 4 упражнения на однородные члены предложения", "Русский язык"],
    ["Подготовь 3 вопроса по таблице Менделеева", "Химия"],
    ["Придумай пять задач про движение навстречу друг другу", "Математика"],
    ["Для урока химии составь 5 заданий на определение валентности", "Химия"],
    ["Сделай четыре карточки по теме электролиты и ионы", "Химия"],
    ["Дай 2 вопроса для повторения типов речи: описание, повествование, рассуждение", "Русский язык"],
    ["Сделай 4 задания на части речи", "Русский язык"],
    ["Составь 5 заданий про генетическую связь между классами неорганических соединений", "Химия"],
    ["Надо 3 упражнения на электронное строение атомов", "Химия"],
    ["Составь 4 задачи на равнодействующую нескольких сил", "Физика"],
    ["Дай 5 простых задач на применение правила рычага", "Физика"],
    ["Нужна проверочная на 6 вопросов о степенях окисления", "Химия"],
    ["Придумай 5 задач на вычисление концентрации раствора", "Химия"],
    ["Придумай 6 заданий на способы образования слов", "Русский язык"],
    ["Подбери 4 задачи, в которых надо использовать формулу пути", "Физика"],
    ["Нужно 3 упражнения на расчёт КПД простого механизма", "Физика"],
    ["Дай 2 трудных задания на обособление приложений", "Русский язык"],
    ["Составь 2 сложные олимпиадные задачи на раскраску клеток доски", "Математика"],
    ["Составь три вопроса про конвекцию", "Физика"],
    ["Нужно 6 карточек на колебания математического маятника", "Физика"],
    ["Составь 4 карточки для повторения атомного ядра", "Физика"],
    ["Дай 5 упражнений на расчёт количества теплоты", "Физика"],
    ["Сделай 4 вопроса для проверки темы закон Гука", "Физика"],
    ["Дай четыре упражнения на расчёт выталкивающей силы", "Физика"],
    ["Придумай 4 упражнения по теме генетической связи классов соединений", "Химия"],
    ["Подготовь 3 упражнения на правописание производных союзов", "Русский язык"],
    ["Составь две олимпиадные задачи на шахматную раскраску", "Математика"],
    ["Придумай 5 карточек о плавлении и кристаллизации", "Физика"],
    ["Подготовь 6 карточек на свойства векторов", "Математика"],
    ["Подготовь 6 карточек на свойства ромба", "Математика"],
    ["Сочини 3 примера, где нужно найти неизвестный множитель", "Математика"],
    ["Проведи мини-тест из трех вопросов по графику квадратичной функции", "Математика"],
    ["Нужны 3 упражнения на вычисление потенциальной энергии", "Физика"],
    ["Дай 3 задания на удельную теплоёмкость вещества", "Физика"],
    ["Составь задания по теме физические величины и измерения", "Физика"],
    ["Нужно 4 упражнения на расчёт пути при равномерном движении", "Физика"],
    ["Составь 3 задачи на определение силы тяжести", "Физика"],
    ["Сделай 5 упражнений на вынесение общего множителя за скобки", "Математика"],
    ["Нужен тест из 4 вопросов про вписанные углы", "Математика"],
    ["Придумай две олимпиадные задачи на логику с цифрами", "Математика"],
    ["Сделай 5 карточек для склонения числительных", "Русский язык"],
    ["Подготовь 4 вопроса по элементному составу органических соединений", "Химия"],
    ["Нужны 4 задачи на теорему Виета", "Математика"],
    ["Придумай 2 олимпиадные задачи на расчёты по уравнению реакции", "Химия"],
    ["Проверь знания тестом из 5 вопросов о щелочных металлах", "Химия"],
    ["Две сложные задачи на вычисление выхода реакции", "Химия"],
    ["Составь 3 задания на нахождение плотности в 8 классе", "Физика"],
    ["Придумай 6 упражнений на уравнения химических реакций", "Химия"],
    ["Составь 4 задания на расстановку коэффициентов в химических уравнениях", "Химия"],
    ["Составь пять заданий на движение спутника по орбите", "Физика"],
    ["Составь 4 упражнения на разделительный мягкий знак", "Русский язык"],
    ["Придумай 7 заданий на образование форм сравнительной степени прилагательных", "Русский язык"],
  ]) {
    assert.equal(curriculum.parseCurriculumRequest(prompt).subject, expectedSubject, `A specific qualifier should resolve an ambiguous word: ${prompt}`);
  }
  assert.equal(curriculum.parseCurriculumRequest("Сделай 4 задания на деление").subject, "", "Bare division without a math context should ask for clarification");
  for (const prompt of ["Составь 3 задания на число", "Подготовь 2 задания на функцию", "Придумай 6 задач на силу", "Дай 3 упражнения на состояние", "Дай 4 задания про закон", "Дай 4 задания на величину", "Сделай 5 заданий на основание", "Дай вопросы для работы в классе", "Составь карточки по заданному материалу"]) {
    assert.equal(curriculum.parseCurriculumRequest(prompt).subject, "", `A generic single-word topic should ask for clarification: ${prompt}`);
  }
  const nontrivialRequest = curriculum.parseCurriculumRequest("Сгенерируй 4 тренировки на приведение подобных слагаемых");
  assert.equal(nontrivialRequest.count, 4, "A familiar practice noun should preserve the requested count");
  assert.equal(nontrivialRequest.tool, "assignment");
  assert.equal(curriculum.parseCurriculumRequest("Проверь знания шестью упражнениями на пропорции").count, 6);
  for (const [prompt, subject, topic] of [
    ["Подготовь тест из 5 вопросов о галогенах", "Химия", /галоген/i],
    ["Тест из пяти вопросов на прямую и косвенную речь", "Русский язык", /прямую и косвенную речь/i],
  ]) {
    const parsed = curriculum.parseCurriculumRequest(prompt);
    assert.equal(parsed.subject, subject, `Count wording should not hide the requested subject: ${prompt}`);
    assert.equal(parsed.count, 5, `Count should be retained: ${prompt}`);
    assert.match(parsed.topic, topic, `Topic should be retained: ${prompt}`);
  }
  assert.equal(curriculum.parseCurriculumRequest("Сделай проверочную по изученному материалу").subject, "", "A generic reference to studied material should ask what subject/topic the user means");
  assert.equal(curriculum.parseCurriculumRequest("Составь 2 непростые задачи про мощность электрического тока").level, "hard", "Negated simple wording should be interpreted as a harder request");
  assert.equal(curriculum.parseCurriculumRequest("Дай 2 трудных задания на обособление приложений").level, "hard");
  const wrapperRequest = curriculum.parseCurriculumRequest("Набор из 4 коротких задач на сумму углов треугольника");
  assert.equal(wrapperRequest.count, 4);
  assert.equal(wrapperRequest.topic, "сумму углов треугольника");
  assert.throws(() => curriculum.generateCurriculumAi("assignment", "Нужно 4 задания по плотности для 8 класса по физике", "medium", 4), /Уточните тему или класс/u, "A shortened physics topic must still enforce its mapped grade");
  assert.throws(() => curriculum.generateCurriculumAi("assignment", "Составь 3 задания по химии на молярный объём газов для 6 класса", "medium", 3), /Уточните тему или класс|Уточните класс или предмет/u, "A chemistry topic must clarify when its mapped grade conflicts");
  assert.throws(() => curriculum.generateCurriculumAi("assignment", "Подготовь три задачи на скорость для 4 класса по физике", "medium", 3), /изучается в 7–11 классах/u, "A subject requested outside its source-mapped grade range must ask for clarification");
  const seniorParonyms = curriculum.generateCurriculumAi("assignment", "Для 10 класса подготовь четыре задания по русскому языку на паронимы", "medium", 4);
  assert.equal(seniorParonyms.items.length, 4, "Paronyms are covered in the official 10–11 Russian curriculum as well as the 5–9 program");

  for (const prompt of ["5 задач на молярную массу", "Сделай 5 задач на молярную массу", "Подготовь пять заданий по химии: молярная масса"]) {
    const request = curriculum.parseCurriculumRequest(prompt, "", 6, "medium", "assignment");
    assert.equal(request.subject, "Химия", `Wrong subject for: ${prompt}`);
    assert.equal(request.count, 5, `Lost requested count for: ${prompt}`);
    assert.match(request.topic, /молярн/i, `Lost requested topic for: ${prompt}`);
  }

  const geometryBasics = curriculum.generateCurriculumAi(
    "assignment", "геометрические понятия, фигуры и виды углов", "medium", 15, "Математика",
  );
  assert.equal(geometryBasics.items.length, 15);
  assert.equal(new Set(geometryBasics.items).size, 15, `Basic geometry must not repeat prompts in a 15-item set: ${JSON.stringify(geometryBasics.items)}`);
  assert.ok(geometryBasics.items.every((item) => /уг[о]?л|многоугольник|часть прямой|отрезок|луч|линия/iu.test(item)), "Basic geometry tasks must stay within the requested topic");
  for (const [index, answer] of geometryBasics.answers.entries()) {
    assert.ok(answer.trim().length > 0, `Basic geometry task ${index + 1} needs an answer`);
    const angle = geometryBasics.items[index].match(/равен (\d+)°/u);
    if (angle) {
      const value = Number(angle[1]);
      if (/острый/u.test(answer)) assert.ok(value > 0 && value < 90, `Incorrect acute-angle key at task ${index + 1}`);
      if (/тупой/u.test(answer)) assert.ok(value > 90 && value < 180, `Incorrect obtuse-angle key at task ${index + 1}`);
    }
  }
  const practicalPercents = curriculum.generateCurriculumAi(
    "assignment", "проценты и практические задачи на проценты в 7 классе", "medium", 15, "Математика",
  );
  assert.equal(new Set(practicalPercents.items).size, 15, "Practical percentage tasks must not repeat in a 15-item set");
  for (const [index, answer] of practicalPercents.answers.entries()) {
    const prompt = practicalPercents.items[index];
    const price = prompt.match(/Товар стоит (\d+) руб/u);
    const rate = prompt.match(/на (\d+)%/u);
    const change = answer.match(/^([\d.,]+) руб\.$/u);
    assert.ok(price && rate && change, `Missing explicit percentage calculation in item ${index + 1}: ${prompt} => ${answer}`);
    assert.equal(Number(change[1].replace(",", ".")), Number(price[1]) * Number(rate[1]) / 100, `Incorrect price change in item ${index + 1}`);
  }
  const parallelograms = curriculum.generateCurriculumAi(
    "assignment", "четырёхугольники параллелограмм и их свойства в 8 классе", "medium", 15, "Математика",
  );
  assert.equal(new Set(parallelograms.items).size, 15, "Parallelogram tasks must not repeat in a 15-item set");
  assert.ok(parallelograms.items.every((item) => /параллелограмм/u.test(item)), "Parallelogram generation must keep the requested topic");
  for (const [index, answer] of parallelograms.answers.entries()) {
    assert.ok(answer.trim().length > 0, `Parallelogram task ${index + 1} needs an answer`);
    const sum = answer.match(/P = 2 · \((\d+) \+ (\d+)\) = (\d+) см/u);
    if (sum) assert.equal(Number(sum[3]), 2 * (Number(sum[1]) + Number(sum[2])), `Incorrect parallelogram perimeter at item ${index + 1}`);
    const adjacent = answer.match(/∠B = 180° − (\d+)° = (\d+)°/u);
    if (adjacent) assert.equal(Number(adjacent[1]) + Number(adjacent[2]), 180, `Incorrect adjacent angles at item ${index + 1}`);
  }

  const geographyPrompt = "Составь 3 олимпиадных задания на почвы и факторы почвообразования для 6 класса";
  const geographyRequest = curriculum.parseCurriculumRequest(geographyPrompt, "", 5, "medium", "assignment");
  assert.equal(geographyRequest.subject, "География", "A known cross-subject term must use its topic-specific subject");
  assert.equal(geographyRequest.count, 3, "Olympiad wording must not hide the requested count");
  assert.equal(geographyRequest.grade, 6, "Olympiad wording must preserve the requested grade");
  assert.equal(geographyRequest.olympiad, true, "The natural-language request must affect task generation");
  assert.match(geographyRequest.topic, /почв.*фактор.*почвообраз/i, "The request topic must be retained");

  const geographyResult = curriculum.generateCurriculumAi("assignment", geographyPrompt, "medium", 3);
  assert.equal(geographyResult.subject, "География");
  assert.equal(geographyResult.items.length, 3);
  assert.match(geographyResult.title, /^Практика · География ·/u, "The result remains a regular assignment, not a separately labeled mode");
  assert.doesNotMatch(geographyResult.title, /олимпиад/i);
  assert.ok(geographyResult.items.every((item) => /почв|почвообраз/i.test(item)), "Generated tasks must keep the user's requested topic");

  for (const [prompt, expectedSubject] of [
    ["Составь 2 задания на древнейшие люди и переход к земледелию", "История"],
    ["Составь 2 задания на валютный курс и внешняя торговля", "Обществознание"],
    ["Составь 2 задания на потребности человека и ограниченность ресурсов", "Обществознание"],
  ]) {
    const request = curriculum.parseCurriculumRequest(prompt, "", 5, "medium", "assignment");
    assert.equal(request.subject, expectedSubject, `Canonical topic index must disambiguate: ${prompt}`);
    const generated = curriculum.generateCurriculumAi("assignment", prompt, "medium", 2);
    assert.equal(generated.subject, expectedSubject, `Wrong generated subject for: ${prompt}`);
    assert.equal(generated.items.length, 2);
  }

  const result = curriculum.generateCurriculumAi("assignment", "молярную массу", "medium", 15);
  assert.equal(result.subject, "Химия");
  assert.equal(result.items.length, 15);
  assert.equal(result.answers.length, 15);
  assert.equal(new Set(result.items).size, 15, "Generated tasks must be distinct");
  for (const [index, answer] of result.answers.entries()) {
    const prompt = result.items[index];
    const mass = answer.match(/M\(.+?\) = .+? = ([\d,]+) г\/моль/);
    const amount = prompt.match(/найди массу (\d+) моль/i);
    const computed = answer.match(/= (\d+)·([\d,]+) = ([\d,]+) г\./);
    assert.ok(mass && amount && computed, `Missing verifiable molar-mass calculation: ${answer}`);
    const molarMass = Number(mass[1].replace(",", "."));
    const requestedMolarMass = Number(computed[2].replace(",", "."));
    const finalMass = Number(computed[3].replace(",", "."));
    assert.equal(requestedMolarMass, molarMass, `Inconsistent molar mass in task ${index + 1}`);
    assert.equal(Number(computed[1]), Number(amount[1]), `Mole count changed in task ${index + 1}`);
    assert.equal(finalMass, molarMass * Number(amount[1]), `Incorrect mass in task ${index + 1}`);
  }

  const focusedCases = [
    ["Физика", "эффект Доплера", /доплер|высокий тон/i],
    ["Физика", "резонанс и вынужденные колебания", /резонанс/i],
    ["Физика", "тепловой баланс", /теплопотерь|температур|тепло/i],
    ["Физика", "первый закон термодинамики", /термодинамик|внутренн/i],
    ["Физика", "свободное падение тел", /падени|время падения/i],
    ["Физика", "закон всемирного тяготения", /тяготен|гравитац/i],
    ["Физика", "сила упругости и закон Гука", /Гука|пружин/i],
    ["Физика", "уравнение состояния идеального газа", /Бойля|давление/i],
    ["Физика", "напряжённость электрического поля", /напряжённост|заряд/i],
    ["Физика", "закон сохранения импульса", /сцепля|импульс/i],
    ["Физика", "удельная теплоёмкость", /теплоёмкост|количество теплоты/i],
    ["Физика", "радиоактивные превращения", /полураспад|радиоактив/i],
    ["Физика", "электромагнитные волны", /радиоволн|длину волны/i],
    ["Физика", "тепловое расширение тел", /стержн|расшир/i],
    ["Физика", "влажность воздуха", /влажност|водяного пара/i],
    ["Физика", "интерференция света", /интерференц|разность хода/i],
    ["Физика", "закон отражения света", /угол отражения|зеркал/i],
    ["Физика", "закон сохранения энергии в тепловых процессах", /установивш|энерг|горячей воды/i],
    ["Физика", "электрические цепи и безопасность", /низковольт|батарейк/i],
    ["Физика", "физические явления и методы исследования", /маятник|измерять/i],
    ["Физика", "физические величины и измерения", /3,2 км|5 400/i],
    ["Физика", "строение вещества и агрегатные состояния", /частиц|твёрдом теле/i],
    ["Физика", "инерция, взаимодействие тел и масса", /инерци|автобус/i],
    ["Физика", "сила тяжести, вес и невесомость", /силу тяжести|невесомост/i],
    ["Физика", "равновесие тел и момент силы", /равновеси.*момент|рычаг/i],
    ["Физика", "лучевая модель света и прямолинейное распространение", /лучевой модели|прямолинейн/i],
    ["Физика", "дисперсия и спектр света", /призм|фиолетов/i],
    ["Физика", "модель атома и квантовые явления", /энергетическ.*уровен|фотон/i],
    ["Химия", "изотопы", /изотоп|нейтрон/i],
    ["Химия", "молярная концентрация", /моль|концентрац/i],
    ["Химия", "валентность элементов", /валентност|формул/i],
    ["Химия", "химическое равновесие", /равновес|катализатор/i],
    ["Химия", "лабораторное разделение смеси", /фильтр|смес/i],
    ["Химия", "гомологический ряд алканов", /углеводород|алкан|этан/i],
    ["Химия", "растворы и растворимость", /растворимост|насыщен/i],
    ["Химия", "окислительно-восстановительный баланс", /восстановител|восстанавливается/i],
    ["Химия", "кислород и горение", /горения магния|2Mg/i],
    ["Химия", "углекислый газ", /известков|CaCO₃/i],
    ["Химия", "электролитическая диссоциация", /диссоциац|Na⁺/i],
    ["Химия", "гидролиз солей", /гидролиз|CO₃²⁻/i],
    ["Химия", "электролиз расплавов", /электролиз|катод/i],
    ["Химия", "щелочноземельные металлы", /магни|MgCl₂/i],
    ["Химия", "глюкоза и углеводы", /глюкоз|180 г\/моль/i],
    ["Химия", "спирты и функциональная группа", /этанол|гидроксиль/i],
    ["Химия", "полимеры и пластмассы", /полиэтилен|полимеризац/i],
    ["Химия", "водородный показатель pH", /pH 3|нейтральн/i],
    ["Химия", "степень окисления", /степень окисления|\+6/i],
    ["Химия", "эфиры и сложные эфиры", /этерификац|этилэтаноат/i],
    ["Химия", "изомерия и номенклатура органических веществ", /изомер|2-метилпропан/i],
    ["Химия", "предмет химии и методы исследования", /независим|растворимость/i],
    ["Химия", "химический эксперимент и правила безопасности", /неизвестн.*раствор|защитные очки/i],
    ["Химия", "кислород, озон и состав воздуха", /озон|аллотроп|O₃/i],
    ["Химия", "сера и её соединения", /SO₂|степень окисления/i],
    ["Химия", "фосфор и его соединения", /P₄O₁₀|4H₃PO₄/i],
    ["Химия", "углерод и его соединения", /угарный газ|CO₂/i],
    ["Химия", "кремний и силикатные материалы", /SiO₂|кварцев/i],
    ["Химия", "алюминий и его соединения", /алюмини|Al₂O₃|оксидн.*плёнк/i],
    ["Химия", "железо и его соединения", /корроз|ржавчин/i],
    ["Химия", "первоначальные понятия об органических веществах", /органическ.*веществ|алкан/i],
    ["Химия", "химическое загрязнение и продукты переработки нефти", /разлив|пятна|нефтепродукт|водоём/i],
    ["Химия", "безопасность веществ и новые материалы", /пиктограммы|полимерн/i],
    ["Химия", "теория строения органических веществ", /ковалентн|четырьмя/i],
    ["Химия", "алкадиены и синтетический каучук", /бутадиен|каучук/i],
    ["Химия", "фенол и его свойства", /фенол|ароматическ/i],
    ["Химия", "альдегиды и кетоны", /класс вещества|альдегид|карбонильн/i],
    ["Химия", "экспериментальные методы органической химии", /неизвестн.*органическ|лаборатор/i],
    ["Химия", "неметаллы и аллотропные модификации", /аллотропн|графит/i],
    ["Химия", "металлы и электрохимический ряд напряжений", /ряд активност|цинк/i],
    ["Химия", "химия и окружающая среда", /пятна|нефтепродукт|водоём/i],
    ["Химия", "химия, экология и безопасность", /нефтепродукт|сообщить/i],
    ["Химия", "промышленная химия и материалы", /производств.*аммиака|4 моль/i],
    ["Химия", "лекарственные препараты и бытовая химия", /бытов.*средств|этикетк/i],
    ["Химия", "генетические превращения неорганических веществ", /CaO|генетическ/i],
    ["Русский язык", "обособленные обстоятельства с деепричастием", /деепричастн/i],
    ["Русский язык", "правописание Н и НН", /нн|зависимым словом/i],
    ["Русский язык", "сложноподчинённые предложения с придаточным причины", /придаточн.*причин|потому что/i],
    ["Русский язык", "виды подчинительной связи", /управлен|согласован|примыкан/i],
    ["Русский язык", "фонетический разбор", /звуко-буквен|3 буквы и 3 звука/i],
    ["Русский язык", "разбор слова по составу", /морфем|приставк|корен/i],
    ["Русский язык", "главные члены предложения", /грамматическ.*основ|вернулись/i],
    ["Русский язык", "прямая речь и диалог", /прямая речь|слова автора/i],
    ["Русский язык", "виды сказуемого", /сказуем|грамматическ.*основ/i],
    ["Русский язык", "лексические нормы", /сувенир|избыточност/i],
    ["Русский язык", "вводные слова и конструкции", /вводн|к счастью/i],
    ["Русский язык", "виды придаточных предложений", /придаточн|союзн/i],
    ["Русский язык", "тире между подлежащим и сказуемым", /Москва|тире/i],
    ["Русский язык", "правописание производных предлогов", /производн.*предлог|в течение/i],
    ["Русский язык", "ударение в трудных словах", /ударен|звонИт/i],
    ["Русский язык", "средства связи предложений в тексте", /связь лексическ|ливень/i],
    ["Русский язык", "виды односоставных предложений", /односоставн|определённо-личн|сказуем/i],
    ["Русский язык", "обособленные приложения и уточняющие члены предложения", /оборот|приложение|уточняет/i],
    ["Русский язык", "сложные предложения с разными видами связи", /разными видами связи|сочинительн/i],
    ["Русский язык", "сочинение-рассуждение и аргументация тезиса", /тезис|аргумент/i],
    ["Русский язык", "Язык и речь", /языков.*единиц|речевое действие/i],
    ["Русский язык", "Функциональные разновидности языка", /стиль речи|официально-деловой|научный стиль/i],
    ["Русский язык", "Текст", /определи тему текста|связн.*описание|тема — дождь/i],
    ["Русский язык", "Система языка", /звуковой уровень|синтаксический/i],
    ["Русский язык", "Культура речи", /нарушение нормы|дательн.*падеж|дождю/i],
    ["Русский язык", "Фонетический анализ слова", /фонетическ.*анализ/i],
    ["Русский язык", "Лексический анализ слова", /лексическ.*анализ/i],
    ["Русский язык", "Морфемный анализ слов", /морфемн.*анализ/i],
    ["Русский язык", "Словообразование", /словообразовательн.*разбор/i],
    ["Русский язык", "Союзы и союзные слова", /союзн.*слов/i],
  ];
  for (const [subject, topic, expected] of focusedCases) {
    const generated = curriculum.generateCurriculumAi("assignment", topic, "medium", 1, subject);
    assert.equal(generated.subject, subject, `Wrong focused subject for ${topic}`);
    assert.match(generated.items[0], expected, `Generated task does not match ${topic}`);
    assert.match(generated.answers[0], expected, `Answer does not explain ${topic}`);
  }

  const concentration = curriculum.generateCurriculumAi("assignment", "молярная концентрация", "medium", 8, "Химия");
  for (const [index, answer] of concentration.answers.entries()) {
    const match = answer.match(/C = n\/V = (\d+)\/([\d,]+) = ([\d,]+) моль\/л/u);
    assert.ok(match, `Missing concentration calculation in item ${index + 1}`);
    const amount = Number(match[1]);
    const volume = Number(match[2].replace(",", "."));
    const computed = Number(match[3].replace(",", "."));
    assert.ok(Math.abs(computed - amount / volume) < 0.01, `Incorrect concentration answer in item ${index + 1}`);
  }

  const localizedNumber = (value) => Number(value.replace(/\s/gu, "").replace(",", "."));
  const chemistryCalculationCases = [
    {
      topic: "массовая доля вещества в растворе",
      prompt: /В (\d+) г воды растворили (\d+) г соли/u,
      answer: /m\(раствора\) = (\d+) г; ω = (\d+)\/(\d+)·100% ≈ ([\d,]+)%/u,
      calculate: (p, a) => {
        const solvent = Number(p[1]), solute = Number(p[2]);
        assert.equal(Number(a[1]), solvent + solute, "Solution mass must include solute and solvent");
        assert.equal(Number(a[2]), solute, "Mass-fraction numerator must be the solute mass");
        assert.equal(Number(a[3]), solvent + solute, "Mass-fraction denominator must be the solution mass");
        assert.ok(Math.abs(localizedNumber(a[4]) - solute / (solvent + solute) * 100) < 0.02, "Incorrect solution mass fraction");
      },
    },
    {
      topic: "выход продукта реакции",
      prompt: /теоретически можно получить (\d+) г продукта\. Практический выход составляет (\d+)%/u,
      answer: /m\(практ\.\) = m\(теор\.\)·η\/100% = (\d+)·(\d+)\/100 = ([\d,.]+) г/u,
      calculate: (p, a) => {
        assert.equal(Number(a[1]), Number(p[1]), "Theoretical product mass changed in the key");
        assert.equal(Number(a[2]), Number(p[2]), "Yield percent changed in the key");
        assert.equal(localizedNumber(a[3]), Number(p[1]) * Number(p[2]) / 100, "Incorrect actual product mass");
      },
    },
    {
      topic: "растворы и растворимость",
      prompt: /растворимость соли равна (\d+) г на 100 г воды\. Сколько соли можно растворить в (\d+) г воды/u,
      answer: /m\(соли\) = (\d+) · (\d+) \/ 100 = ([\d,]+) г/u,
      calculate: (p, a) => {
        assert.equal(Number(a[1]), Number(p[1]), "Solubility value changed in the key");
        assert.equal(Number(a[2]), Number(p[2]), "Water mass changed in the key");
        assert.equal(localizedNumber(a[3]), Number(p[1]) * Number(p[2]) / 100, "Incorrect dissolved mass");
      },
    },
  ];
  for (const testCase of chemistryCalculationCases) {
    for (let index = 0; index < 12; index += 1) {
      const exercise = exerciseBank.generateSubjectExercise("Химия", testCase.topic, "medium", index);
      const promptMatch = exercise.prompt.match(testCase.prompt);
      const answerMatch = exercise.answer.match(testCase.answer);
      const prompt = exercise.prompt;
      const answer = exercise.answer;
      assert.ok(promptMatch && answerMatch, `Missing independently checkable ${testCase.topic} data: ${prompt} / ${answer}`);
      testCase.calculate(promptMatch, answerMatch);
    }
  }

  for (let index = 0; index < 12; index += 1) {
    const spring = exerciseBank.generateSubjectExercise("Физика", "потенциальная энергия пружины", "medium", index);
    const answer = spring.answer;
    const prompt = spring.prompt;
    const promptMatch = prompt.match(/жёсткостью (\d+) Н\/м растянули на (\d+) см/u);
    const answerMatch = answer.match(/Eупр = kx²\/2 = (\d+) · ([\d,.]+)² \/ 2 = ([\d,.]+) Дж/u);
    assert.ok(promptMatch && answerMatch, `Missing spring-energy calculation in item ${index + 1}: ${prompt} / ${answer}`);
    const stiffness = Number(promptMatch[1]);
    const extensionMetres = Number(promptMatch[2]) / 100;
    assert.equal(Number(answerMatch[1]), stiffness, `Spring stiffness changed in item ${index + 1}`);
    assert.equal(localizedNumber(answerMatch[2]), extensionMetres, `Centimetres were not converted to metres in item ${index + 1}`);
    assert.ok(Math.abs(localizedNumber(answerMatch[3]) - stiffness * extensionMetres ** 2 / 2) < 0.001, `Incorrect spring energy in item ${index + 1}`);
  }

  const upperPhysicsCases = [
    ["газовые законы и изопроцессы", /p₂ = p₁V₁\/V₂ = (\d+)·(\d+)\/(\d+) = ([\d,.]+) кПа/u, (p1, v1, v2) => p1 * v1 / v2],
    ["электроёмкость и энергия конденсатора", /q = CU = (\d+)·(\d+) = (\d+) мкКл; W = CU²\/2 = (\d+)·(\d+)²\/2 = ([\d,.\s]+) мкДж/u, (c, u) => [c*u, c*u*u/2]],
    ["модели атома, постулаты Бора и спектры", /E = Eнач − Eкон = −([\d,.]+) − \(−([\d,.]+)\) = ([\d,.]+) эВ/u, (initial, final) => final - initial],
    ["переменный ток и трансформатор", /U₂ = (\d+)·(\d+)\/(\d+) = (\d+) В/u, (u1, n2, n1) => u1*n2/n1],
    ["фотоэффект и уравнение Эйнштейна", /Eк,max = (\d+) − (\d+) = (\d+) эВ/u, (photon, work) => photon-work],
    ["радиоактивный распад и период полураспада", /N = N₀\/2ⁿ = (\d+)\/2\^(\d+) = (\d+)/u, (start, periods) => start / 2**periods],
    ["ядерные реакции, деление и синтез ядер", /A = (\d+) \+ (\d+) = (\d+) и Z = (\d+) \+ (\d+) = (\d+)/u, (a1,a2,_massTotal,z1,z2) => [a1+a2,z1+z2]],
  ];
  for (let index = 0; index < 8; index += 1) {
    const { prompt, answer } = exerciseBank.generateSubjectExercise("Физика", "упругие и неупругие столкновения", "medium", index);
    const data = prompt.match(/массами (\d+) кг .*? скоростью (\d+) м\/с/u);
    const result = answer.match(/= ([\d,.]+) м\/с/u);
    assert.ok(data && result, `Missing collision data or answer, variant ${index + 1}`);
    assert.ok(Math.abs(localizedNumber(result[1]) - localizedNumber(data[1]) * localizedNumber(data[2]) / (2 * localizedNumber(data[1]))) < 0.001, `Momentum was not conserved, variant ${index + 1}`);
  }
  for (let index = 0; index < 8; index += 1) {
    const { prompt, answer } = exerciseBank.generateSubjectExercise("Физика", "волны де Бройля и корпускулярно-волновой дуализм", "medium", index);
    const speed = prompt.match(/движущегося со скоростью (\d+)·10⁶ м\/с/u);
    const wavelength = answer.match(/≈ ([\d,]+)e-(\d+) м/u);
    assert.ok(speed && wavelength, `Missing de Broglie values, variant ${index + 1}`);
    const reported = localizedNumber(wavelength[1]) * 10 ** -Number(wavelength[2]);
    const expected = 6.63e-34 / (9.1e-31 * Number(speed[1]) * 1e6);
    assert.ok(Math.abs(reported - expected) / expected < 0.001, `Incorrect de Broglie wavelength, variant ${index + 1}`);
  }
  const radiation = exerciseBank.generateSubjectExercise("Физика", "радиоактивность и виды ядерного излучения", "medium", 0);
  assert.match(radiation.answer, /α-излучение.*заряд \+2e.*бумаги.*β⁻-излучение.*−e.*алюминия.*γ-излучение.*нулю.*свинца/u);
  const solarSystem = exerciseBank.generateSubjectExercise("Физика", "Солнечная система, звёзды и Галактика", "medium", 0);
  assert.match(solarSystem.answer, /Меркурий, Венера, Земля, Марс/u);
  const particles = exerciseBank.generateSubjectExercise("Физика", "элементарные частицы и фундаментальные взаимодействия", "medium", 0);
  assert.match(particles.answer, /электрон.*лептон.*−e.*позитрон.*античастица.*\+e.*протон.*составными барионами.*кварков/iu);
  const stellarEvolution = exerciseBank.generateSubjectExercise("Физика", "эволюция звёзд и расширение Вселенной", "medium", 0);
  assert.match(stellarEvolution.answer, /красный гигант → планетарная туманность → белый карлик/u);
  for (const [topic, answerPattern, calculate] of upperPhysicsCases) {
    for (let index = 0; index < 8; index += 1) {
      const { prompt, answer } = exerciseBank.generateSubjectExercise("Физика", topic, "medium", index);
      const match = answer.match(answerPattern);
      assert.ok(match, `Missing checkable upper-grade physics answer for ${topic}: ${prompt} / ${answer}`);
      const values = match.slice(1).map(localizedNumber);
      const expected = calculate(...values);
      if (Array.isArray(expected)) {
        const actual = [values[2], values.at(-1)];
        assert.deepEqual(actual, expected, `Incorrect calculation for ${topic}, variant ${index + 1}`);
      } else {
        assert.ok(Math.abs(values.at(-1) - expected) < 0.01, `Incorrect calculation for ${topic}, variant ${index + 1}`);
      }
    }
  }

  for (let index = 0; index <= 30; index += 1) {
    const exercise = exerciseBank.generateSubjectExercise("Физика", "условие плавания тел", "medium", index);
    const match = exercise.prompt.match(/Плотность тела (\d+) кг\/м³, плотность жидкости (\d+) кг\/м³/u);
    assert.ok(match, `Missing density values in buoyancy exercise ${index + 1}`);
    const bodyDensity = Number(match[1]);
    const liquidDensity = Number(match[2]);
    if (bodyDensity < liquidDensity) {
      assert.match(exercise.answer, /плотность тела меньше плотности жидкости.*всплывёт/u, `Incorrect floating answer for ${bodyDensity} kg/m³`);
    } else if (bodyDensity > liquidDensity) {
      assert.match(exercise.answer, /плотность тела больше плотности жидкости.*опустится на дно/u, `Incorrect sinking answer for ${bodyDensity} kg/m³`);
    } else {
      assert.match(exercise.answer, /плотности равны.*взвешенном состоянии/u, `Incorrect neutral-buoyancy answer for ${bodyDensity} kg/m³`);
    }
  }

  for (let index = 0; index < 12; index += 1) {
    const expansion = exerciseBank.generateSubjectExercise("Физика", "тепловое расширение", "medium", index);
    const answer = expansion.answer;
    const prompt = expansion.prompt;
    const promptMatch = prompt.match(/длиной ([\d,]+) м нагрели на (\d+) °C/u);
    const answerMatch = answer.match(/ΔL = αL₀ΔT = ([\d,]+) · ([\d,]+) · (\d+) = ([\d,]+) м = ([\d,]+) мм/u);
    assert.ok(promptMatch && answerMatch, `Missing thermal-expansion calculation in item ${index + 1}`);
    const length = localizedNumber(promptMatch[1]);
    const temperatureChange = Number(promptMatch[2]);
    const alpha = localizedNumber(answerMatch[1]);
    assert.equal(localizedNumber(answerMatch[2]), length, `Rod length changed in item ${index + 1}`);
    assert.equal(Number(answerMatch[3]), temperatureChange, `Temperature change changed in item ${index + 1}`);
    const expectedMetres = alpha * length * temperatureChange;
    assert.ok(Math.abs(localizedNumber(answerMatch[4]) - expectedMetres) < 0.000001, `Incorrect expansion in metres in item ${index + 1}`);
    assert.ok(Math.abs(localizedNumber(answerMatch[5]) - expectedMetres * 1000) < 0.001, `Incorrect expansion in millimetres in item ${index + 1}`);
  }

  const lens = curriculum.generateCurriculumAi("assignment", "линзы и фокусное расстояние", "medium", 4, "Физика");
  for (const [index, answer] of lens.answers.entries()) {
    const match = answer.match(/1\/(\d+) − 1\/(\d+) = 1\/(\d+)/u);
    assert.ok(match, `Missing thin-lens equation in item ${index + 1}`);
    const focal = Number(match[1]);
    const object = Number(match[2]);
    const image = Number(match[3]);
    assert.ok(Math.abs(1 / focal - 1 / object - 1 / image) < 1e-9, `Incorrect thin-lens answer in item ${index + 1}`);
  }
} finally {
  await server.close();
}

console.log("AI board request: subject and grade parsing, advanced prompts, physics/chemistry/Russian topic tasks, board flow and checked calculation families OK");
