import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createServer } from "vite";

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

  for (const prompt of ["5 задач на молярную массу", "Сделай 5 задач на молярную массу", "Подготовь пять заданий по химии: молярная масса"]) {
    const request = curriculum.parseCurriculumRequest(prompt, "", 6, "medium", "assignment");
    assert.equal(request.subject, "Химия", `Wrong subject for: ${prompt}`);
    assert.equal(request.count, 5, `Lost requested count for: ${prompt}`);
    assert.match(request.topic, /молярн/i, `Lost requested topic for: ${prompt}`);
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
    ["Химия", "изотопы", /изотоп|нейтрон/i],
    ["Химия", "молярная концентрация", /моль|концентрац/i],
    ["Химия", "валентность элементов", /валентност|формул/i],
    ["Химия", "химическое равновесие", /равновес|катализатор/i],
    ["Химия", "лабораторное разделение смеси", /фильтр|смес/i],
    ["Химия", "гомологический ряд алканов", /углеводород|алкан|этан/i],
    ["Русский язык", "обособленные обстоятельства с деепричастием", /деепричастн/i],
    ["Русский язык", "правописание Н и НН", /нн|зависимым словом/i],
    ["Русский язык", "сложноподчинённые предложения с придаточным причины", /придаточн.*причин|потому что/i],
    ["Русский язык", "виды подчинительной связи", /управлен|согласован|примыкан/i],
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
