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

  // Keep the user's everyday example covered without requiring a subject label
  // or the word "нестандартных". The intent parser must infer mathematics and
  // preserve the requested number while producing genuinely triangle-focused work.
  const plainTriangleRequest = "Составь 10 задач на треугольники";
  const parsedTriangleRequest = curriculum.parseCurriculumRequest(plainTriangleRequest);
  assert.equal(parsedTriangleRequest.subject, "Математика", "An unlabelled triangle request should resolve to mathematics");
  assert.equal(parsedTriangleRequest.count, 10, "The requested task count should be preserved");
  assert.match(parsedTriangleRequest.topic, /треугольник/iu, "The requested triangle topic should be retained");
  const plainTriangleSet = curriculum.generateCurriculumAi("assignment", plainTriangleRequest, "medium", 5);
  assert.equal(plainTriangleSet.subject, "Математика");
  assert.equal(plainTriangleSet.items.length, 10);
  assert.equal(plainTriangleSet.answers.length, 10);
  assert.ok(plainTriangleSet.items.every((item) => /треугольник|угол|катет|гипотенуз|площад/u.test(item)), "Every generated item should stay tied to triangle mathematics");
  assert.ok(plainTriangleSet.answers.every((answer) => answer.trim().length > 0), "Every triangle task should include an answer key");

  const understandingRegressions = [
    ["Подготовь 3 исследовательские задачи по фотоэффекту", "Физика", "hard", true],
    ["Дай 7 карточек для повторения уравнения состояния идеального газа", "Физика", "medium", false],
    ["Составь 5 упражнений на вычисление массовой доли элемента в соединении", "Химия", "medium", false],
    ["Дай три карточки на склонение количественных числительных", "Русский язык", "medium", false],
    ["Сделай четыре лёгких карточки по действиям с обыкновенными дробями для 5 класса", "Математика", "easy", false],
    ["Придумай 4 необычных задачи на принцип Дирихле", "Математика", "hard", true],
    ["Составь 4 упражнения на свойства вертикальных и смежных углов", "Математика", "medium", false],
    ["Подготовь 3 задания на разложение многочлена группировкой", "Математика", "medium", false],
    ["Составь 4 задачи про сообщающиеся сосуды", "Физика", "medium", false],
    ["Дай 3 задачи на внутреннее сопротивление источника тока", "Физика", "medium", false],
    ["Сделай 5 заданий на расчёт относительной плотности газа", "Химия", "medium", false],
    ["Подготовь 3 карточки про классификацию аминов", "Химия", "medium", false],
    ["Нужны 4 карточки по теме мягкого знака после шипящих", "Русский язык", "medium", false],
    ["Придумай 3 необычных упражнения на разграничение омонимов и многозначных слов", "Русский язык", "hard", true],
    ["Составь 5 вопросов на написание производных предлогов", "Русский язык", "medium", false],
    ["Составь 4 упражнения на перенос слов по слогам", "Русский язык", "medium", false],
    ["Сделай 5 карточек о правописании сложных числительных", "Русский язык", "medium", false],
    ["Подготовь 3 задания на вычисление сопротивления по закону Ома", "Физика", "medium", false],
    ["Дай 4 вопроса про электролиз водного раствора", "Химия", "medium", false],
    ["Составь 3 задания на стоимость покупки по цене и количеству товара", "Математика", "medium", false],
    ["Подготовь 4 карточки о производной степенной функции", "Математика", "medium", false],
    ["Нужны 3 карточки о моменте силы и плече рычага", "Физика", "medium", false],
    ["Составь 8 карточек о переходе жидкости в пар и обратной конденсации", "Физика", "medium", false],
    ["Проведи тест на 4 вопроса о направлении силовых линий магнитного поля", "Физика", "medium", false],
    ["Нужны 3 задачи на относительную влажность по показаниям психрометра", "Физика", "medium", false],
    ["Нужны 7 карточек о лабораторном получении этилена", "Химия", "medium", false],
    ["Составь тест из 4 вопросов о полимеризации этена", "Химия", "medium", false],
    ["Подготовь восемь вопросов о степенях сравнения прилагательных", "Русский язык", "medium", false],
    ["Составь 5 примеров для выбора между «тоже» и «то же»", "Русский язык", "medium", false],
    ["Составь 6 карточек о точках пересечения графика прямой с осями", "Математика", "medium", false],
    ["Подготовь тест на 5 вопросов о средней линии трапеции", "Математика", "medium", false],
    ["Составь 4 карточки о нахождении вершины параболы по коэффициентам", "Математика", "medium", false],
    ["Составь 4 упражнения, чтобы разложить многочлен на множители", "Математика", "medium", false],
    ["Подготовь 6 сложных упражнений на стилистические ошибки", "Русский язык", "hard", false],
    ["Сделай пять задач на вероятность независимых событий", "Математика", "medium", false],
  ];
  for (const [request, subject, level, olympiad] of understandingRegressions) {
    const parsed = curriculum.parseCurriculumRequest(request);
    assert.equal(parsed.subject, subject, `Subject inference should preserve the specific topic: ${request}`);
    assert.equal(parsed.level, level, `Difficulty wording should be recognized: ${request}`);
    assert.equal(parsed.olympiad, olympiad, `Challenge wording should be preserved: ${request}`);
    const generated = curriculum.generateCurriculumAi(parsed.tool, request, parsed.level, parsed.count);
    assert.equal(generated.subject, subject);
    assert.equal(generated.items.length, parsed.count);
    assert.equal(generated.answers.length, parsed.count);
  }
  const naturalParameterRegressions = [
    { text: "Проведи мини-тест из четырёх вопросов по физике о плотности твёрдых тел для 7 класса", count: 4, grade: 7, tool: "quiz", subject: "Физика" },
    { text: "Сделай карточки по физике о мощности, нужно 6", count: 6, grade: null, tool: "flashcards", subject: "Физика" },
    { text: "Составь 4 задачи по физике на сопротивление по закону Ома для 8 класса", count: 4, grade: 8, tool: "assignment", subject: "Физика" },
    { text: "Сделай 4 вопроса по температурной шкале и термометрам", count: 4, grade: null, tool: "quiz", subject: "Физика", topicPattern: /температур/iu },
    { text: "Сделай для шестого класса 4 задания на сравнение обыкновенных дробей", count: 4, grade: 6, tool: "assignment", subject: "Математика", topicPattern: /сравнен.*дроб/iu },
    { text: "Шесть вопросов по площади круга для шестиклассной викторины", count: 6, grade: 6, tool: "quiz", subject: "Математика", topicPattern: /площад.*круг/iu },
    { text: "Проведи семиклассную проверку изображения в собирающей линзе: 7 вопросов", count: 7, grade: 7, tool: "quiz", subject: "Физика", topicPattern: /линз|изображен/iu },
    { text: "Викторина по ОВР: восемь вопросов для химии одиннадцатого класса", count: 8, grade: 11, tool: "quiz", subject: "Химия", topicPattern: /окислительно-восстановительн/iu },
  ];
  for (const expected of naturalParameterRegressions) {
    const parsed = curriculum.parseCurriculumRequest(expected.text);
    assert.equal(parsed.count, expected.count, `Natural count wording should be preserved: ${expected.text}`);
    assert.equal(parsed.grade, expected.grade, `Explicit class should be preserved: ${expected.text}`);
    assert.equal(parsed.tool, expected.tool, `Explicit output format should be preserved: ${expected.text}`);
    assert.equal(parsed.subject, expected.subject, `Explicit subject should be preserved: ${expected.text}`);
    if (expected.topicPattern) assert.match(parsed.topic, expected.topicPattern, `A topic word must not be consumed as a count unit: ${expected.text}`);
    const generated = curriculum.generateCurriculumAi(parsed.tool, expected.text, parsed.level, parsed.count);
    assert.equal(generated.items.length, expected.count);
    assert.equal(generated.answers.length, expected.count);
  }
  const gradeSixAlternation = "Дай четыре упражнения на чередование гласных в корне для 6 класса";
  const parsedGradeSixAlternation = curriculum.parseCurriculumRequest(gradeSixAlternation);
  assert.equal(parsedGradeSixAlternation.subject, "Русский язык");
  assert.equal(parsedGradeSixAlternation.grade, 6);
  assert.match(classifier.matchCanonicalCurriculumGrade(parsedGradeSixAlternation.topic, "Русский язык"), /5-6/u, "The broad alternation topic is taught across grades 5–6");
  assert.equal(curriculum.generateCurriculumAi("assignment", gradeSixAlternation, "medium", 4).items.length, 4, "A valid 6th-grade continuation of root alternation must not be rejected");
  for (const request of [
    "Составь задания на корни для контрольной",
    "Подготовь пять примеров на степень",
    "Нужны задания про таблицу и элементы",
    "Подготовь вопросы о периоде",
    "Нужна задача на движение с графиком",
    "Сделай тест на график и функцию",
    "Дай вопросы на движение и скорость",
    "Сделай задания об энергии в системе без предметного контекста",
    "Подготовь карточки про период и частоту без указания предмета",
    "Составь задачи о корнях растения и корнях уравнения",
    "Сделай тест про таблицы значений и элементы таблицы",
    "Подготовь вопросы о реакции организма и химической реакции",
    "Составь задания на подбор коэффициентов в уравнениях без указания предмета",
    "Подготовь вопросы о ядре атома и электронной оболочке без названия предмета",
    "Сделай карточки про белки как биополимеры без указания предмета",
    "Подготовь карточки о реакции, предмет пока не важен",
    "Нужны карточки про число без предмета",
    "Дай упражнения про атомы и их строение",
    "Подготовь вопросы про клетку без предмета",
  ]) {
    assert.equal(curriculum.parseCurriculumRequest(request).subject, "", `A short cross-disciplinary topic should ask for a subject: ${request}`);
  }
  for (const request of [
    "Придумай вопросы про реакции и их типы",
    "Составь три вопроса про части речи и героев повести",
  ]) {
    assert.equal(curriculum.parseCurriculumRequest(request).subject, "", `Mixed or context-free subject cues should ask for clarification: ${request}`);
  }

  const ohmExercises = Array.from({ length: 6 }, (_, index) => exerciseBank.generateSubjectExercise("Физика", "закон Ома", "medium", index));
  assert.equal(new Set(ohmExercises.slice(0, 3).map(({ prompt }) => prompt)).size, 3, "Ohm's law exercises should rotate between finding voltage, current, and resistance");
  for (const exercise of ohmExercises) {
    const values = [...exercise.prompt.matchAll(/\d+ (?:Ом|В|А)/gu)];
    assert.ok(values.length >= 2, `Ohm's law exercise must supply enough values: ${exercise.prompt}`);
    assert.match(exercise.answer, /закон Ома|U = I|R = U|I = U/u, "Every Ohm's law answer must show a checkable relationship");
  }

  const densityExercises = Array.from({ length: 6 }, (_, index) => exerciseBank.generateSubjectExercise("Физика", "плотность", "medium", index));
  assert.equal(new Set(densityExercises.slice(0, 3).map(({ prompt }) => prompt)).size, 3, "Density exercises should rotate between finding density, mass, and volume");
  assert.ok(densityExercises.some(({ prompt }) => /Найди плотность/u.test(prompt)));
  assert.ok(densityExercises.some(({ prompt }) => /Найди массу/u.test(prompt)));
  assert.ok(densityExercises.some(({ prompt }) => /Найди объём/u.test(prompt)));
  for (const exercise of densityExercises) assert.match(exercise.answer, /ρ = m \/ V|m = ρV|V = m \/ ρ/u, "Density answers must show the correct formula");
  assert.equal(classifier.classifyCurriculumSubject("Составь 4 задачи на молярную массу в 8 классе"), "Химия", "A high-specificity chemical term must outrank generic math-like task wording");
  assert.equal(classifier.classifyCurriculumSubject("Подготовь упражнение по грамматике"), "", "Generic grammar wording must request language context instead of guessing a subject");
  assert.equal(curriculum.parseCurriculumRequest("Подготовь упражнение по грамматике").subject, "", "Integrated parsing must preserve the clarification for generic grammar wording");
  assert.equal(classifier.classifyCurriculumSubject("Подготовь упражнения по грамматике английского языка"), "Иностранный язык", "An explicitly named foreign language must still resolve");
  assert.equal(classifier.classifyCurriculumSubject("Хочу вопросы на тему физические величины и измерения"), "Физика");
  assert.equal(curriculum.parseCurriculumRequest("Сделай тест из пяти вопросов о линейном расширении тел").subject, "Физика", "Thermal expansion must resolve to physics even when the subject is omitted");
  assert.equal(classifier.classifyCurriculumSubject("Подготовь 3 карточки на спряжение глаголов"), "Русский язык");
  assert.equal(classifier.classifyCurriculumSubject("Дай четыре задачи на показатель преломления стекла"), "Физика");
  assert.equal(curriculum.parseCurriculumRequest("Придумай задания про гигантское магнитосопротивление").subject, "Физика", "An established advanced physics phenomenon should resolve without an explicit subject label");
  assert.equal(classifier.classifyCurriculumSubject("Придумай задания про гигантское магнитосопротивление"), "Физика", "The local classifier must recognize an uncommon but unambiguous physics topic");
  const directTopicCases = [
    ["Составь задачу на китайскую теорему об остатках", "Математика"],
    ["Объясни метод бесконечного спуска в доказательстве", "Математика"],
    ["Сделай задания про предел Роша и приливное разрушение спутника", "Физика"],
    ["Подготовь вопросы об эффекте Казимира", "Физика"],
    ["Нужны задания на буферную ёмкость раствора", "Химия"],
    ["Объясни свойства фуллеренов и их производных", "Химия"],
    ["Составь упражнения на плеоназм и речевую избыточность", "Русский язык"],
    ["Подготовь примеры эллиптических конструкций в разговорной речи", "Русский язык"],
    ["Подготовь карточки о конференции в Бандунге и движении неприсоединения", "История"],
    ["Морфология как раздел грамматики", "Русский язык"],
    ["Составь 4 задачи: резисторы соединены смешанно, найди общее сопротивление", "Физика"],
    ["Подготовь задачу, чтобы рассчитать эффективность двигателя", "Физика"],
    ["Придумай задачу про период радиоактивного распада изотопа", "Физика"],
    ["Найди массу вещества, получившегося после реакции", "Химия"],
    ["Сделай упражнение на согласование существительного с числительным", "Русский язык"],
    ["Подготовь задание: как проверить парную согласную в конце слова", "Русский язык"],
    ["Составь примеры умножения степеней с одинаковым основанием", "Математика"],
    ["Нужны 3 задания для 7 класса по электронным таблицам", "Информатика"],
    ["Сделай пять карточек для повторения закона Паскаля", "Физика"],
    ["Нужно 8 задач про последовательное и параллельное подключение ламп", "Физика"],
    ["Придумай три нестандартные задачи на движение по окружности", "Физика"],
    ["Подготовь карточки с формулами боковой поверхности цилиндра", "Математика"],
    ["Сделай карточки о распространении света и отражении от зеркала", "Физика"],
    ["Придумай задачу о работе газа в цилиндре с поршнем", "Физика"],
    ["Составь задания на выход вещества при электролизе", "Химия"],
    ["Дай карточки о механизмах присоединения к двойной связи", "Химия"],
    ["Нужны упражнения на установление коэффициентов в уравнениях горения", "Химия"],
    ["Подготовь карточки на образование повелительного наклонения", "Русский язык"],
    ["Сформируй упражнения на склонение географических названий", "Русский язык"],
    ["Составь задания по натуральным числам и позиционной системе счисления", "Математика"],
    ["Подготовь лабораторные упражнения по разделению смеси", "Химия"],
    ["Составь задания на смачивание и капиллярные явления", "Физика"],
    ["Сделай упражнения на чередование гласных в корнях бер-бир и дер-дир", "Русский язык"],
    ["Подготовь задания по пунктуации при цитировании", "Русский язык"],
    ["Составь упражнения на касательную к графику функции", "Математика"],
    ["Подготовь карточки о глюкозе и углеводах", "Химия"],
    ["Сделай тест на фонетический разбор", "Русский язык"],
    ["Подбери задания на проверяемые согласные в корне слова", "Русский язык"],
    ["Упражнения на буквы О и Ё после шипящих", "Русский язык"],
  ];
  for (const [request, expectedSubject] of directTopicCases) {
    assert.equal(classifier.classifyCurriculumSubject(request), expectedSubject, `Recognize high-specificity topic: ${request}`);
    assert.equal(curriculum.parseCurriculumRequest(request).subject, expectedSubject, `Integrated parser should preserve the high-specificity subject: ${request}`);
  }
  const trailingCount = curriculum.parseCurriculumRequest("Подготовь карточки про вероятность противоположных событий, штук 6");
  assert.equal(trailingCount.count, 6, "A trailing 'штук N' count should be preserved");
  assert.equal(trailingCount.hasCount, true);
  assert.doesNotMatch(trailingCount.topic, /штук\s*6/u, "The trailing count marker should not leak into the topic");
  const hardCalculation = curriculum.parseCurriculumRequest("Подготовь пять трудных расчётных заданий на выход продукта реакции");
  assert.equal(hardCalculation.level, "hard", "Difficulty should survive adjectives between 'hard' and the task noun");
  assert.equal(curriculum.parseCurriculumRequest("Придумай сложные 4 задачи по химии на выход продукта реакции").level, "hard", "Difficulty before a numeric count must be preserved");
  for (const ambiguous of ["Составь карточки на виды реакции", "Подготовь задачи про движение тела", "Составь 3 задачи на работу и мощность", "Подготовь 5 карточек про состав и строение", "Нужно 5 примеров на преобразование выражений", "Составь задания по речи для 6 класса", "Дай вопросы на правила и исключения", "Нужны задачи на отношения между величинами", "Составь задания о том, как устроена система", "Сделай карточки о разновидностях и исключениях", "Подготовь задания о распределении величины", "Подбери задания на простые и составные формы"]) {
    assert.equal(curriculum.parseCurriculumRequest(ambiguous).subject, "", `Short cross-disciplinary wording should request subject context: ${ambiguous}`);
  }
  assert.equal(curriculum.parseCurriculumRequest("Простая и составная формы сравнительной и превосходной степеней сравнения наречий").subject, "Русский язык", "The Russian grammar topic about adverb comparison degrees must not be mistaken for an ambiguous generic forms request");
  for (const [request, expectedSubject] of [
    ["Придумай 3 задачи на период и частоту математического маятника", "Физика"],
    ["Карточки по давлению твёрдого тела на опору", "Физика"],
    ["Упражнения на чередующиеся корни раст- и ращ-", "Русский язык"],
  ]) {
    assert.equal(curriculum.parseCurriculumRequest(request).subject, expectedSubject, `Recognize a specific topic despite ambiguity guards: ${request}`);
    assert.equal(classifier.classifyCurriculumSubject(request), expectedSubject, `The local intent model should recognize the specific topic: ${request}`);
  }
  for (const ambiguous of [
    "Нужны три упражнения на сравнение двух вариантов решения",
    "Подбери карточки о признаках и разновидностях",
    "Составь задания, чтобы проверить понимание связи между частями",
    "Нужно три упражнения на поиск ошибки в записи",
  ]) {
    assert.equal(curriculum.parseCurriculumRequest(ambiguous).subject, "", `Cross-disciplinary wording should request context: ${ambiguous}`);
    assert.equal(classifier.classifyCurriculumSubject(ambiguous), "", `The local intent model should not guess a subject: ${ambiguous}`);
  }
  for (const [request, expectedSubject] of [
    ["Область допустимых значений рационального выражения", "Математика"],
    ["Задачи по закону Кулона", "Физика"],
    ["Подключение вольтметра к участку цепи", "Физика"],
    ["Высота подъёма жидкости в капилляре", "Физика"],
    ["Температура теплового равновесия", "Физика"],
    ["Диссоциация сильных электролитов", "Химия"],
    ["Полное сгорание пропана", "Химия"],
    ["Объёмные отношения газов в реакции", "Химия"],
    ["Запятые при вводных словах", "Русский язык"],
    ["Сравнительная степень наречий", "Русский язык"],
  ]) {
    assert.equal(curriculum.parseCurriculumRequest(request).subject, expectedSubject, `Recognize a clear curriculum topic: ${request}`);
    assert.equal(classifier.classifyCurriculumSubject(request), expectedSubject, `The local intent model should recognize the clear topic: ${request}`);
  }
  for (const ambiguous of ["Классификация по общим свойствам", "Подготовь классификацию по общим свойствам"]) {
    assert.equal(curriculum.parseCurriculumRequest(ambiguous).subject, "", `Unspecified classification should ask for a subject: ${ambiguous}`);
    assert.equal(classifier.classifyCurriculumSubject(ambiguous), "", `The local intent model should not guess for an unspecified classification: ${ambiguous}`);
  }
  const miniControl = curriculum.parseCurriculumRequest("Проведи мини-контрольную из четырёх пунктов о разбавлении растворов");
  assert.equal(miniControl.tool, "quiz", "A mini-control test should be recognized as a quiz");
  const checkByItems = curriculum.parseCurriculumRequest("Проведи проверку из шести пунктов о линейном увеличении линзы");
  assert.equal(checkByItems.tool, "quiz", "A knowledge check described as numbered points should be recognized as a quiz");
  for (const [request, expectedSubject] of [
    ["Свойства степеней", "Математика"],
    ["Размещения без повторений", "Математика"],
    ["Диффузия в жидкостях и газах", "Физика"],
    ["Изотермический процесс газа", "Физика"],
    ["Ускорение свободного падения", "Физика"],
    ["Относительная молекулярная масса", "Химия"],
    ["Строение аминов", "Химия"],
    ["Правописание приставок на з и с", "Русский язык"],
  ]) {
    assert.equal(curriculum.parseCurriculumRequest(request).subject, expectedSubject, `Recognize a clear curriculum topic: ${request}`);
    assert.equal(classifier.classifyCurriculumSubject(request), expectedSubject, `The local intent model should recognize the clear topic: ${request}`);
  }
  const prefixSpelling = curriculum.parseCurriculumRequest("Задания на правописание приставок на з и с");
  assert.match(prefixSpelling.topic, /з\s+и\s+с$/iu, "The topic's final letter name must not be stripped as a preposition");
  for (const ambiguous of ["Изменение состояния и его признаки", "Исправление неточностей"]) {
    assert.equal(curriculum.parseCurriculumRequest(ambiguous).subject, "", `Underspecified wording should request context: ${ambiguous}`);
    assert.equal(classifier.classifyCurriculumSubject(ambiguous), "", `The local intent model should not guess for underspecified wording: ${ambiguous}`);
  }
  for (const [request, expectedSubject] of [
    ["Преобразование степенного выражения", "Математика"],
    ["Нахождение медианы набора чисел", "Математика"],
    ["Рентгеновское излучение", "Физика"],
    ["Электронные конфигурации атомов", "Химия"],
    ["Взаимодействие металлов с водой", "Химия"],
    ["Цепочка превращений с участием этанола", "Химия"],
    ["Сложные союзы", "Русский язык"],
    ["Значение фразеологизмов", "Русский язык"],
  ]) {
    assert.equal(curriculum.parseCurriculumRequest(request).subject, expectedSubject, `Recognize a clear curriculum topic: ${request}`);
    assert.equal(classifier.classifyCurriculumSubject(request), expectedSubject, `The local intent model should recognize the clear topic: ${request}`);
  }
  assert.equal(curriculum.parseCurriculumRequest("Способы описания и их отличительные особенности").subject, "", "A generic description task should not imply Russian language");
  assert.equal(classifier.classifyCurriculumSubject("Способы описания и их отличительные особенности"), "", "The local intent model should clarify generic description tasks");
  const gradeThenCount = curriculum.parseCurriculumRequest("Сделай для 6 класса три карточки на сравнение обыкновенных дробей");
  assert.equal(gradeThenCount.grade, 6);
  assert.equal(gradeThenCount.count, 3, "Grade digits must not be misread as the requested exercise count");
  const gradeThenCountAgain = curriculum.parseCurriculumRequest("Составь для 8 класса три задания по пунктуации при однородных членах");
  assert.equal(gradeThenCountAgain.grade, 8);
  assert.equal(gradeThenCountAgain.count, 3, "A grade before the count must not overwrite the count");
  const commaTrailingCount = curriculum.parseCurriculumRequest("Сделай карточки, штук 6, на образование повелительного наклонения");
  assert.equal(commaTrailingCount.count, 6, "Trailing count syntax should allow surrounding punctuation");
  const neutralizationEquations = [
    "HCl + NaOH → NaCl + H₂O", "HCl + KOH → KCl + H₂O", "2HCl + Ca(OH)₂ → CaCl₂ + 2H₂O",
    "2HCl + Mg(OH)₂ → MgCl₂ + 2H₂O", "2HCl + Ba(OH)₂ → BaCl₂ + 2H₂O", "HNO₃ + NaOH → NaNO₃ + H₂O",
    "HNO₃ + KOH → KNO₃ + H₂O", "2HNO₃ + Ca(OH)₂ → Ca(NO₃)₂ + 2H₂O", "2HNO₃ + Mg(OH)₂ → Mg(NO₃)₂ + 2H₂O",
    "2HNO₃ + Ba(OH)₂ → Ba(NO₃)₂ + 2H₂O", "H₂SO₄ + 2NaOH → Na₂SO₄ + 2H₂O", "H₂SO₄ + 2KOH → K₂SO₄ + 2H₂O",
    "H₂SO₄ + Ca(OH)₂ → CaSO₄ + 2H₂O", "H₂SO₄ + Mg(OH)₂ → MgSO₄ + 2H₂O", "H₂SO₄ + Ba(OH)₂ → BaSO₄ + 2H₂O",
  ];
  const neutralizationSet = curriculum.generateCurriculumAi("assignment", "Составь 15 заданий по химии на реакции нейтрализации", "medium", 15, "Химия");
  assert.equal(neutralizationSet.subject, "Химия");
  assert.equal(neutralizationSet.items.length, 15);
  assert.equal(new Set(neutralizationSet.items).size, 15, "Neutralization sets should not fall back to unrelated generic items");
  for (let index = 0; index < neutralizationEquations.length; index += 1) {
    assert.match(neutralizationSet.items[index], /нейтрализ/u, `Neutralization prompt must stay on-topic: ${neutralizationSet.items[index]}`);
    assert.ok(neutralizationSet.answers[index].includes(neutralizationEquations[index]), `Balanced reaction must be correct: ${neutralizationSet.answers[index]}`);
  }
  const extendedNeutralization = Array.from({ length: 45 }, (_, index) => exerciseBank.generateSubjectExercise("Химия", "реакции нейтрализации", "medium", index));
  assert.equal(new Set(extendedNeutralization.slice(0, 30).map(({ prompt }) => prompt)).size, 30, "The equation-writing modes should remain distinct across reactions");
  assert.ok(extendedNeutralization.every(({ prompt, answer }) => /нейтрализ/u.test(prompt) && /H⁺ \+ OH⁻ → H₂O|→ .*H₂O/u.test(answer)), "Neutralization variants must contain chemistry-specific prompts and keys");
  for (const underspecified of ["Составь задачу про клетки", "Составь задачу про клетки, чтобы было интересно", "Объясни атом", "Дай задания про реакцию", "Расскажи про силу и энергию"]) {
    assert.equal(classifier.classifyCurriculumSubject(underspecified), "", `Ask for subject context for a cross-disciplinary topic: ${underspecified}`);
  }
  const mixedSubjectRequest = "Составь 4 задания по математике и физике про графики движения";
  assert.equal(classifier.classifyCurriculumSubject(mixedSubjectRequest), "", "Explicitly mixed subjects must not silently resolve to the first one named");
  assert.equal(curriculum.parseCurriculumRequest(mixedSubjectRequest).subject, "", "The integrated request parser must ask which subject to use for a mixed request");
  assert.throws(() => curriculum.generateCurriculumAi("assignment", mixedSubjectRequest, "medium", 4, "Математика"), /Не удалось определить предмет/u, "A board's current subject must not override conflicting subjects named in the request");
  const mixedPriorityAndCatalogSubject = "Составь общую работу по химии и биологии о веществах внутри клетки";
  assert.equal(classifier.classifyCurriculumSubject(mixedPriorityAndCatalogSubject), "", "Mixed requests involving a non-priority catalog subject must also ask for clarification");
  assert.equal(curriculum.parseCurriculumRequest(mixedPriorityAndCatalogSubject).subject, "", "A single priority subject must not mask a second named catalog subject");
  const mendeleevAtomRequest = "Дай 7 карточек для повторения таблицы Менделеева и строения атома";
  assert.equal(classifier.classifyCurriculumSubject(mendeleevAtomRequest), "Химия", "The periodic table must resolve a broad atomic-structure phrase to chemistry");
  assert.equal(curriculum.parseCurriculumRequest(mendeleevAtomRequest).subject, "Химия");
  const literaryLanguageTopic = "Функциональные разновидности языка. Язык художественной литературы и его отличия от других функциональных разновидностей современного русского языка";
  assert.equal(classifier.classifyCurriculumSubject(literaryLanguageTopic), "Русский язык", "The curricular phrase 'language of literary fiction' must not conflict with Russian language");
  assert.equal(curriculum.parseCurriculumRequest(literaryLanguageTopic, "Русский язык").subject, "Русский язык");
  const dativeGradeRequest = "Третьему классу нужны три лёгких упражнения на таблицу умножения";
  assert.equal(curriculum.parseCurriculumRequest(dativeGradeRequest).grade, 3, "Ordinal dative grade wording should resolve the intended class");
  assert.equal(classifier.classifyCurriculumSubject("формулы пути скорости и времени"), "Математика", "An exact catalog topic must take priority over an ambiguous path/time heuristic");
  assert.equal(curriculum.detectCurriculumSubject("формулы пути скорости и времени"), "Математика", "The integrated generator must honor the exact catalog subject too");
  const easyWithTaskModifier = curriculum.parseCurriculumRequest("Четыре простые практические задачи для 7 класса на измерение скорости");
  assert.equal(easyWithTaskModifier.subject, "Физика");
  assert.equal(easyWithTaskModifier.level, "easy", "An adjective followed by a task modifier should preserve the requested easy level");
  for (const ambiguousRequest of [
    "Нужны 4 задания про таблицы и закономерности для 6 класса",
    "Составь викторину о плотности: 4 вопроса",
    "Сделай 5 заданий про реакцию организма на вещества для 9 класса",
    "Подготовь карточки о героях и частях речи: 7 штук",
    "Нужен тест из 8 заданий о давлении для семиклассников",
    "Дай три задачи на корень растения и уравнение для 7 класса",
    "Нужны четыре карточки о типах реакций для урока в 9 классе",
    "Составь 5 примеров для разбора силы с числовыми значениями",
    "Нужна работа о силе, добавь четыре аналогичных примера",
    "Сделай 7 вопросов о графиках и таблицах для средней школы",
    "Сделай 4 упражнения о движении тел для восьмого класса",
    "Подготовь викторину на 6 вопросов про клетки для шестого класса",
  ]) {
    assert.equal(classifier.classifyCurriculumSubject(ambiguousRequest), "", `Ambiguous subject should be clarified: ${ambiguousRequest}`);
    assert.equal(curriculum.parseCurriculumRequest(ambiguousRequest).subject, "", `Integrated parsing should preserve ambiguity: ${ambiguousRequest}`);
  }
  const adjectivePhysicsRequest = "Равновесие и сложение сил: придумай 4 физические задачи для 7 класса";
  assert.equal(classifier.classifyCurriculumSubject(adjectivePhysicsRequest), "Физика", "The adjective 'физические' should identify a physics request when it modifies tasks");
  assert.equal(curriculum.parseCurriculumRequest(adjectivePhysicsRequest, "Математика").subject, "Физика", "A clear subject adjective must override the board's fallback subject");
  const countedSubjectAdjective = curriculum.parseCurriculumRequest("Сделай 4 физические задачи на равновесие сил для 7 класса");
  assert.equal(countedSubjectAdjective.count, 4, "Count parsing must preserve words between the number and the counted noun");
  assert.equal(countedSubjectAdjective.subject, "Физика", "A subject adjective between the count and task noun must not be swallowed by count parsing");
  const difficultMathTasks = curriculum.parseCurriculumRequest("Составь 4 сложные математические задачи для 8 класса на квадратный трёхчлен");
  assert.equal(difficultMathTasks.subject, "Математика");
  assert.equal(difficultMathTasks.level, "hard", "Difficulty should survive intervening subject adjectives between the count and task noun");
  const numberingCases = [
    curriculum.generateCurriculumAi("assignment", "Сделай 3 задачи по физике на плотность вещества", "medium", 3, "Физика"),
    curriculum.generateCurriculumAi("assignment", "Подготовь 3 олимпиадные задачи по химии на окислительно-восстановительные реакции", "hard", 3, "Химия"),
    curriculum.generateCurriculumAi("flashcards", "Сделай 3 карточки по русскому языку на причастный оборот", "medium", 3, "Русский язык"),
  ];
  for (const output of numberingCases) {
    assert.ok(output.items.every((item) => !/^\d+\.\s+\d+\./u.test(item)), `Task/quiz numbering must not be duplicated: ${output.items.join(" | ")}`);
    assert.ok(output.items.every((item) => !/\nВопрос: \d+\.\s+\d+\./u.test(item)), `Flashcard question numbering must not be duplicated: ${output.items.join(" | ")}`);
    assert.ok(output.items.every((item) => !/\nОтвет: \d+\.\s+\d+\./u.test(item)), `Flashcard answer numbering must not be duplicated: ${output.items.join(" | ")}`);
    assert.ok(output.answers.every((answer) => !/^\d+\.\s+\d+\./u.test(answer)), `Answer-key numbering must not be duplicated: ${output.answers.join(" | ")}`);
  }
  for (const ambiguous of [
    "Придумай задачи про силу, с числами",
    "Подготовь задачу на давление, но не помню контекст",
    "Подготовь вопросы о реакции и её видах",
    "Сделай карточки о степени, без дополнительных деталей",
    "Хочу разобрать язык и его функции",
    "Нужны вопросы по частям речи и героям рассказа",
  ]) {
    assert.equal(curriculum.parseCurriculumRequest(ambiguous).subject, "", `Ambiguous cross-subject request must ask for context: ${ambiguous}`);
  }
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

  const promptSelectedCards = curriculum.generateCurriculumAi("assignment", "Сделай 3 карточки по русскому языку на причастный оборот для 7 класса", "medium", 3, "Русский язык");
  assert.ok(promptSelectedCards.items.every((item, index) => item.startsWith(`Карточка ${index + 1}`)), "An explicitly requested card format in the prompt must override the preselected assignment mode");
  const promptSelectedQuiz = curriculum.generateCurriculumAi("assignment", "Сделай тест из 3 вопросов по русскому языку на причастный оборот для 7 класса", "medium", 3, "Русский язык");
  assert.match(promptSelectedQuiz.title, /Проверочная работа/u, "An explicitly requested quiz format in the prompt must override the preselected assignment mode");

  const olympiadDivisibilitySet = curriculum.generateCurriculumAi("assignment", "Составь 3 олимпиадные задачи по математике на делимость чисел", "hard", 3, "Математика");
  assert.equal(olympiadDivisibilitySet.items.length, 3, "An olympiad divisibility request must preserve the requested task count");
  assert.ok(olympiadDivisibilitySet.items.every((item) => /делятся на|делится на/u.test(item)), "Olympiad divisibility prompts must actually test divisibility");
  assert.ok(olympiadDivisibilitySet.answers.every((answer) => /делимост|делится|делятся/u.test(answer)), "Olympiad divisibility answer keys must explain the relevant divisibility condition");
  assert.match(olympiadDivisibilitySet.answers[0], /n = 60·5 \+ 1 = 301/u, "The first remainder puzzle must find the least valid multiple of 7");
  assert.match(olympiadDivisibilitySet.answers[1], /3, 11, 12, 20/u, "The consecutive-product puzzle must enumerate every valid residue modulo 24");
  assert.match(olympiadDivisibilitySet.answers[2], /153, 234, 315/u, "The digit-reversal divisibility puzzle must enumerate every valid three-digit number");
  const expandedOlympiadDivisibilitySet = curriculum.generateCurriculumAi("assignment", "Составь 15 олимпиадных задач по математике на делимость чисел", "hard", 15, "Математика");
  assert.equal(new Set(expandedOlympiadDivisibilitySet.items).size, 15, "A long olympiad set must contain 15 distinct divisibility tasks");
  for (let index = 0; index < expandedOlympiadDivisibilitySet.items.length; index += 1) {
    const prompt = expandedOlympiadDivisibilitySet.items[index];
    const answer = expandedOlympiadDivisibilitySet.answers[index];
    const leastMultiple = prompt.match(/простое число p = (\d+)/u);
    const residuePuzzle = prompt.match(/прост[а-яё]* p = (\d+)/u);
    const reversal = prompt.match(/увеличивает число на (\d+)/u);
    if (leastMultiple) {
      const prime = Number(leastMultiple[1]);
      const expected = Array.from({ length: 60 * prime }, (_, offset) => offset + 1)
        .find((value) => [2, 3, 4, 5].every((divisor) => value % divisor === 1) && value % prime === 0);
      assert.ok(expected, `Remainder variant ${index + 1} must have a solution`);
      assert.ok(answer.includes(`= ${expected}. Проверка`), `Remainder key ${index + 1} must identify the least valid number`);
    } else if (residuePuzzle) {
      const prime = Number(residuePuzzle[1]);
      const modulus = 8 * prime;
      const expected = Array.from({ length: modulus }, (_, residue) => residue)
        .filter((residue) => residue * (residue + 1) % (4 * prime) === 0
          && residue * (residue + 1) % (8 * prime) !== 0);
      assert.equal(expected.length, 4, `Consecutive-product variant ${index + 1} must produce the four CRT cases`);
      assert.ok(answer.includes(expected.join(", ")), `Consecutive-product key ${index + 1} must enumerate every valid residue`);
    } else if (reversal) {
      const increase = Number(reversal[1]);
      const expected = Array.from({ length: 900 }, (_, offset) => offset + 100)
        .filter((value) => [...String(value)].reduce((sum, digit) => sum + Number(digit), 0) === 9
          && value % 9 === 0
          && Number([...String(value)].reverse().join("")) - value === increase);
      assert.ok(expected.length > 0, `Digit-reversal variant ${index + 1} must have a solution`);
      assert.ok(answer.includes(expected.join(", ")), `Digit-reversal key ${index + 1} must enumerate the complete solution set`);
    } else assert.fail(`Unknown divisibility variant: ${prompt}`);
  }

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
  const advancedRedoxEquations = [
    "MnO₄⁻ + 5Fe²⁺ + 8H⁺ → Mn²⁺ + 5Fe³⁺ + 4H₂O",
    "Cr₂O₇²⁻ + 6I⁻ + 14H⁺ → 2Cr³⁺ + 3I₂ + 7H₂O",
    "ClO₃⁻ + 6I⁻ + 6H⁺ → Cl⁻ + 3I₂ + 3H₂O",
  ];
  const advancedRedoxElectronCounts = ["5e⁻", "6e⁻", "6e⁻"];
  for (let index = 0; index < advancedRedoxEquations.length; index += 1) {
    assert.ok(olympiadRedoxSet.answers[index].includes(advancedRedoxEquations[index]), `Advanced redox task ${index + 1} must use its independently balanced ionic equation`);
    assert.ok(olympiadRedoxSet.answers[index].includes(advancedRedoxElectronCounts[index]), `Advanced redox task ${index + 1} must show the correct electron exchange`);
    assert.match(olympiadRedoxSet.answers[index], /Заряд обеих частей равен/u, "Advanced redox keys must report a charge-balance check");
  }
  const subscripts = new Map([..."₀₁₂₃₄₅₆₇₈₉"].map((digit, value) => [digit, String(value)]));
  const parseFormula = (formula) => {
    const atomCounts = new Map();
    const atomPart = formula.replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹]*[⁺⁻]$/u, "");
    const tokens = [...atomPart.matchAll(/([A-Z][a-z]?)([₀₁₂₃₄₅₆₇₈₉]*)/gu)];
    assert.ok(tokens.length > 0 && tokens.map((token) => token[0]).join("") === atomPart, `Could not parse chemical formula: ${formula}`);
    for (const [, element, subscript] of tokens) {
      const amount = subscript ? Number([...subscript].map((digit) => subscripts.get(digit)).join("")) : 1;
      atomCounts.set(element, (atomCounts.get(element) ?? 0) + amount);
    }
    return atomCounts;
  };
  const valenceExercises = Array.from({ length: 4 }, (_, index) => exerciseBank.generateSubjectExercise("Химия", "валентность элементов", "medium", index));
  const romanValence = { I: 1, II: 2, III: 3 };
  for (const [index, exercise] of valenceExercises.entries()) {
    const formula = exercise.answer.match(/индексами и сокращаем, если возможно: ([A-Z][A-Za-z₀₁₂₃₄₅₆₇₈₉]*)\./u)?.[1];
    const [metalValence, nonmetalValence] = exercise.prompt.match(/валентность металла равна (I{1,3}), а второго элемента — (I{1,3})/u)?.slice(1) ?? [];
    assert.ok(formula && metalValence && nonmetalValence, `Valence task ${index + 1} must include a formula and both valences`);
    const atoms = parseFormula(formula);
    const [metal, nonmetal] = [...atoms.keys()];
    assert.ok(metal && nonmetal, `Valence formula ${formula} must include both elements`);
    assert.equal(romanValence[metalValence] * atoms.get(metal), romanValence[nonmetalValence] * atoms.get(nonmetal), `Valence formula ${formula} must balance both elements' valences`);
  }
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
  const superscriptDigits = "⁰¹²³⁴⁵⁶⁷⁸⁹";
  const ionicCharge = (side) => side.split(/\s*\+\s*/u).reduce((total, rawTerm) => {
    const term = rawTerm.match(/^(\d+)\s*(.+)$/u);
    const coefficient = term ? Number(term[1]) : 1;
    const formula = term ? term[2] : rawTerm;
    const charge = formula.match(/([⁰¹²³⁴⁵⁶⁷⁸⁹]*)([⁺⁻])$/u);
    if (!charge) return total;
    const magnitude = charge[1] ? Number([...charge[1]].map((digit) => superscriptDigits.indexOf(digit)).join("")) : 1;
    return total + coefficient * magnitude * (charge[2] === "⁺" ? 1 : -1);
  }, 0);
  for (const [index, answer] of olympiadRedoxSet.answers.entries()) {
    const arrowIndex = answer.indexOf("→");
    assert.ok(arrowIndex >= 0, `Redox answer ${index + 1} must include a balanced equation`);
    const reactantSide = answer.slice(0, arrowIndex).split(/[:.]|\n/u).at(-1)?.trim() ?? "";
    const productSide = answer.slice(arrowIndex + 1).split(/[.;\n]/u)[0]?.trim() ?? "";
    const reactants = atomTotals(reactantSide);
    const products = atomTotals(productSide);
    assert.deepEqual([...products].sort(), [...reactants].sort(), `Redox equation ${index + 1} must conserve every element`);
    assert.equal(ionicCharge(productSide), ionicCharge(reactantSide), `Redox equation ${index + 1} must conserve total ionic charge`);
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
  for (const [text, level, topic] of [
    ["Составь сложный тест из 7 вопросов по математике на тригонометрические уравнения", "hard", /тригонометрическ.*уравнен/iu],
    ["Подготовь простой тест из 5 вопросов по математике на признаки делимости", "easy", /признак.*делимост|признаки делимости/iu],
    ["Сделай лёгкий тест из 4 вопросов по физике на равномерное движение", "easy", /равномерн.*движен/iu],
  ]) {
    const parsed = curriculum.parseCurriculumRequest(text);
    assert.equal(parsed.level, level, `Difficulty adjective must apply to the requested test: ${text}`);
    assert.match(parsed.topic, topic, `Difficulty and format words must not leak into the topic: ${text}`);
  }
  const wrapperRequest = curriculum.parseCurriculumRequest("Набор из 4 коротких задач на сумму углов треугольника");
  assert.equal(wrapperRequest.count, 4);
  const geometricProgression = curriculum.parseCurriculumRequest("Составь 5 упражнений для 9 класса по геометрической прогрессии");
  assert.equal(geometricProgression.subject, "Математика");
  assert.match(geometricProgression.topic, /геометрическ.*прогресс/iu, "An adjective inside a named topic must not be consumed as an explicit subject");
  assert.equal(wrapperRequest.topic, "сумму углов треугольника");
  assert.throws(() => curriculum.generateCurriculumAi("assignment", "Нужно 4 задания по плотности для 8 класса по физике", "medium", 4), /Уточните тему или класс/u, "A shortened physics topic must still enforce its mapped grade");
  assert.throws(() => curriculum.generateCurriculumAi("assignment", "Составь 3 задания по химии на молярный объём газов для 6 класса", "medium", 3), /Уточните тему или класс|Уточните класс или предмет/u, "A chemistry topic must clarify when its mapped grade conflicts");
  assert.throws(() => curriculum.generateCurriculumAi("assignment", "Сделай 3 задания для второго класса: решение квадратных неравенств", "medium", 3), /Уточните тему или класс/u, "An inflected curriculum topic should retain its source grade and clarify a mismatch");
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
