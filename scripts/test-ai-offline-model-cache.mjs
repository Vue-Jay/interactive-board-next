import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";

const file = "src/aiSubjectIntentClassifier.ts";
const source = readFileSync(new URL(`../${file}`, import.meta.url), "utf8")
  .replace('import { AI_SUBJECT_MODEL_VERSION } from "./aiSubjectIntentModelVersion";', 'const AI_SUBJECT_MODEL_VERSION = "test-model";')
  .replace("${import.meta.env.BASE_URL}", "/")
  .replace(/^export\s+/gm, "");
const output = ts.transpileModule(source, {
  fileName: file,
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
}).outputText;
const createLoader = () => new Function(`${output}\nreturn { loadCurriculumSubjectModel, matchCanonicalCurriculumTopic };`)();
const values = new Map();
globalThis.localStorage = {
  getItem: key => values.get(key) ?? null,
  setItem: (key, value) => values.set(key, value),
  removeItem: key => values.delete(key),
};

const knownModel = {
  subjects: ["Математика"], priors: { "Математика": 0 },
  likelihoods: { "Математика": {} }, topicIndex: { "теорема пифагора": "Математика" },
};
let networkRequests = 0;
globalThis.fetch = async url => {
  networkRequests += 1;
  assert.equal(url, "/models/aiSubjectIntentModel.json?v=test-model");
  return { ok: true, json: async () => knownModel };
};

const firstLaunch = createLoader();
assert.equal(networkRequests, 0, "Importing the classifier must not fetch the model eagerly");
await firstLaunch.loadCurriculumSubjectModel();
assert.equal(networkRequests, 1, "Opening the assistant downloads its model once");
assert.ok(values.has("lectrus.ai.subject-model.test-model"), "The downloaded model must persist locally");

globalThis.fetch = async () => {
  networkRequests += 1;
  throw new Error("network is disabled for the restarted app");
};
const restartedApp = createLoader();
await restartedApp.loadCurriculumSubjectModel();
assert.equal(networkRequests, 1, "A fresh app instance must load the cached model without network access");
assert.equal(restartedApp.matchCanonicalCurriculumTopic("Теорема Пифагора"), "Математика");

console.log("AI offline cache: lazy first download and fresh offline restart from local model cache OK");
