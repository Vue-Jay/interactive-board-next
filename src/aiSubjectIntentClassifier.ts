import { AI_SUBJECT_MODEL_VERSION } from "./aiSubjectIntentModelVersion";

type Model = {
  subjects: string[];
  priors: Record<string, number>;
  features?: string[];
  featureWeights?: Record<string, number[]>;
  likelihoods?: Record<string, Record<string, number>>;
  topicIndex?: Record<string, string>;
  topicGradeIndex?: Record<string, Record<string, string>>;
  subjectGradeBands?: Record<string, string[]>;
  confidenceThreshold?: number;
};

let model: Model | null = null;
let modelLoad: Promise<void> | null = null;
let modelFeatureIndex: Map<string, number> | null = null;
const MIN_CONFIDENCE_MARGIN = 4;
const tokenPattern = /[а-яёa-z0-9]+/giu;
const russianSuffixes = [
  "иями", "ями", "ами", "иях", "ого", "ему", "ому", "ыми", "ими", "ая", "яя", "ое", "ее",
  "ые", "ие", "ый", "ий", "ой", "ей", "ую", "юю", "ах", "ях", "ов", "ев", "ом", "ем",
  "ам", "ям", "ою", "ею", "ью", "ия", "ья", "а", "я", "ы", "и", "о", "е", "у", "ю", "ь", "й", "м",
];

/** Loads the compact model only when the assistant is opened. */
export function loadCurriculumSubjectModel(): Promise<void> {
  modelLoad ??= (async () => {
    const cacheKey = `lectrus.ai.subject-model.${AI_SUBJECT_MODEL_VERSION}`;
    try {
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        const data = JSON.parse(cached) as Model;
        if (isUsableModel(data)) {
          setModel(data);
          return;
        }
        localStorage.removeItem(cacheKey);
      }
    } catch {
      // Storage may be disabled or full; the network copy remains available.
    }
    const response = await fetch(`${import.meta.env.BASE_URL}models/aiSubjectIntentModel.json?v=${AI_SUBJECT_MODEL_VERSION}`);
    if (!response.ok) return;
    const data = await response.json() as Model;
    if (isUsableModel(data)) setModel(data);
    try {
      localStorage.setItem(cacheKey, JSON.stringify(data));
    } catch {
      // Keep the in-memory model when persistent browser storage is unavailable.
    }
  })().catch(() => undefined);
  return modelLoad;
}

function isUsableModel(data: Model): boolean {
  return Array.isArray(data.subjects) && Boolean(data.priors)
    && (Boolean(data.likelihoods) || (Array.isArray(data.features) && Boolean(data.featureWeights)));
}

function setModel(data: Model): void {
  model = data;
  modelFeatureIndex = Array.isArray(data.features)
    ? new Map(data.features.map((feature, index) => [feature, index]))
    : null;
}

function extractFeatures(text: string): Set<string> {
  const words = text.toLocaleLowerCase("ru-RU").replace(/ё/g, "е").match(tokenPattern) ?? [];
  const result = new Set(words.filter((word) => word.length > 1).map((word) => `w:${word}`));
  for (let index = 0; index < words.length - 1; index += 1) {
    result.add(`b:${words[index]}_${words[index + 1]}`);
  }
  for (const word of words) {
    if (/^[а-я]+$/u.test(word)) {
      const suffix = russianSuffixes.find((candidate) => word.length - candidate.length >= 3 && word.endsWith(candidate));
      const stem = suffix ? word.slice(0, -suffix.length) : word;
      if (stem.length > 1) result.add(`s:${stem}`);
    }
    const bounded = `^${word}$`;
    for (const size of [3, 4, 5]) {
      for (let index = 0; index <= bounded.length - size; index += 1) result.add(`c:${bounded.slice(index, index + size)}`);
    }
  }
  return result;
}

/** Local subject inference. Returns an empty string when the model is unsure. */
export function classifyCurriculumSubject(text: string): string {
  const activeModel = model;
  if (!activeModel) return "";
  const explicitSubject = ([
    ["Математика", /(?:^|\s)по\s+(?:математик[а-яё]*|алгебр[а-яё]*|геометр[а-яё]*)(?=\s|$)/iu],
    ["Физика", /(?:^|\s)по\s+физик[а-яё]*(?=\s|$)/iu],
    ["Химия", /(?:^|\s)по\s+хими[а-яё]*(?=\s|$)/iu],
    ["Русский язык", /(?:^|\s)по\s+русск[а-яё]*\s+язык[а-яё]*(?=\s|$)/iu],
  ] as [string, RegExp][]).find(([, pattern]) => pattern.test(text));
  if (explicitSubject) return explicitSubject[0];
  if (/аксиом[а-яё]*.{0,24}стереометр|стереометр[а-яё]*/iu.test(text)) return "Математика";
  if (/(?:показател[ья].{0,18}преломлен|преломлен[а-яё]*.{0,18}показател|индекс[а-яё]*.{0,18}преломлен)/iu.test(text)) return "Физика";
  if (/(?:обращен[а-яё]*.{0,20}запят|запят[а-яё]*.{0,20}обращен)/iu.test(text)) return "Русский язык";
  if (/молярн[а-яё]*\s+масс[а-яё]*/iu.test(text)) return "Химия";
  if (/(?:физическ[а-яё]*\s+величин[а-яё]*.{0,24}измерени[яе]|измерени[яе].{0,24}физическ[а-яё]*\s+величин[а-яё]*)/iu.test(text)) return "Физика";
  if (/(?:спряжен[а-яё]*.{0,20}глагол[а-яё]*|глагол[а-яё]*.{0,20}спряжен[а-яё]*)/iu.test(text)) return "Русский язык";
  if (/(?:количеств[а-яё]*\s+теплот[а-яё]*|конвекци[а-яё]*|атомн[а-яё]*\s+ядр[а-яё]*|математическ[а-яё]*\s+маятник[а-яё]*|плавлени[а-яё]*.{0,30}кристаллизаци[а-яё]*|кристаллизаци[а-яё]*.{0,30}плавлени[а-яё]*)/iu.test(text)) return "Физика";
  if (/плотност[а-яё]*.{0,24}(?:тел[а-яё]*|веществ[а-яё]*|жидкост[а-яё]*|газ[а-яё]*|8\s+класс[а-яё]*)|(?:тел[а-яё]*|веществ[а-яё]*).{0,24}плотност[а-яё]*/iu.test(text)) return "Физика";
  const normalizedTopic = text.toLocaleLowerCase("ru-RU").replace(/ё/g, "е").match(tokenPattern)?.join(" ") ?? "";
  const canonicalSubject = activeModel.topicIndex?.[normalizedTopic];
  if (canonicalSubject) return canonicalSubject;
  const features = extractFeatures(text);
  const scored = activeModel.subjects.map((subject) => {
    let score = activeModel.priors[subject];
    const denseWeights = activeModel.featureWeights?.[subject];
    if (denseWeights && modelFeatureIndex) {
      for (const feature of features) {
        const index = modelFeatureIndex.get(feature);
        if (index !== undefined) score += denseWeights[index] ?? 0;
      }
    } else {
      const likelihoods = activeModel.likelihoods?.[subject] ?? {};
      for (const feature of features) {
        const value = likelihoods[feature];
        if (value !== undefined) score += value;
      }
    }
    return { subject, score };
  }).sort((left, right) => right.score - left.score);

  const margin = scored[0].score - scored[1].score;
  const normalizedMargin = margin / Math.max(1, Math.sqrt(features.size));
  const confidenceThreshold = Number.isFinite(activeModel.confidenceThreshold)
    ? activeModel.confidenceThreshold!
    : MIN_CONFIDENCE_MARGIN;
  return normalizedMargin >= confidenceThreshold ? scored[0].subject : "";
}

/** Returns a subject only for an exact normalized curriculum topic. */
export function matchCanonicalCurriculumTopic(text: string): string {
  const activeModel = model;
  if (!activeModel?.topicIndex) return "";
  const normalizedTopic = text.toLocaleLowerCase("ru-RU").replace(/ё/g, "е").match(tokenPattern)?.join(" ") ?? "";
  return activeModel.topicIndex[normalizedTopic] ?? "";
}

/** Returns the mapped grade or grade band for an exact topic in a selected subject. */
export function matchCanonicalCurriculumGrade(text: string, subject: string): string {
  const activeModel = model;
  if (!activeModel?.topicGradeIndex || !subject) return "";
  const normalizedTopic = text.toLocaleLowerCase("ru-RU").replace(/ё/g, "е").match(tokenPattern)?.join(" ") ?? "";
  const subjectGrades = activeModel.topicGradeIndex[subject];
  return subjectGrades?.[normalizedTopic]
    ?? subjectGrades?.[`тема ${normalizedTopic}`]
    ?? subjectGrades?.[`теме ${normalizedTopic}`]
    ?? "";
}

/** Returns source-mapped grade bands in which the selected subject is taught. */
export function getCanonicalCurriculumSubjectGradeBands(subject: string): string[] {
  return model?.subjectGradeBands?.[subject] ?? [];
}
