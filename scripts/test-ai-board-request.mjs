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

  for (const [prompt, expectedSubject] of [
    ["Составь 5 заданий по физике на движение тел с ускорением", "Физика"],
    ["Составь 5 упражнений по химии на валентность элементов", "Химия"],
    ["Подготовь 5 заданий по русскому языку на деепричастные обороты", "Русский язык"],
    ["Сделай 5 задач по математике на площади треугольников", "Математика"],
  ]) {
    const request = curriculum.parseCurriculumRequest(prompt, "", 6, "medium", "assignment");
    assert.equal(request.subject, expectedSubject, `Subject was not preserved from a natural request: ${prompt}`);
    assert.match(request.topic, /движени|валентност|деепричаст|площад/i, `Inflected topic was not preserved: ${prompt}`);
  }

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
