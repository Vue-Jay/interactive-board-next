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

console.log("AI board request: molar-mass requests preserve chemistry, count and topic; 15 generated answers are arithmetically consistent");
