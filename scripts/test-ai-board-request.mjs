import assert from "node:assert/strict";
import { createServer } from "vite";

const server = await createServer({ configFile: "./vite.config.ts", server: { middlewareMode: true }, appType: "custom" });
try {
  const curriculum = await server.ssrLoadModule("/src/aiCurriculumGenerator.ts");
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
} finally {
  await server.close();
}

console.log("AI board request: chemistry requests and an olympiad geography request preserve subject, topic, count and grade in the ordinary assignment flow; 15 molar-mass answers are arithmetically consistent");
