import { AI_SUBJECT_MODEL_VERSION } from "./aiSubjectIntentModelVersion";

type Model = {
  subjects: string[];
  priors: Record<string, number>;
  likelihoods: Record<string, Record<string, number>>;
  topicIndex?: Record<string, string>;
  confidenceThreshold?: number;
};

let model: Model | null = null;
let modelLoad: Promise<void> | null = null;
const MIN_CONFIDENCE_MARGIN = 4;
const tokenPattern = /[а-яёa-z0-9]+/giu;

/** Loads the compact model only when the assistant is opened. */
export function loadCurriculumSubjectModel(): Promise<void> {
  modelLoad ??= (async () => {
    const cacheKey = `lectrus.ai.subject-model.${AI_SUBJECT_MODEL_VERSION}`;
    try {
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        const data = JSON.parse(cached) as Model;
        if (Array.isArray(data.subjects) && data.likelihoods && data.priors) {
          model = data;
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
    model = data;
    try {
      localStorage.setItem(cacheKey, JSON.stringify(data));
    } catch {
      // Keep the in-memory model when persistent browser storage is unavailable.
    }
  })().catch(() => undefined);
  return modelLoad;
}

function extractFeatures(text: string): Set<string> {
  const words = text.toLocaleLowerCase("ru-RU").replace(/ё/g, "е").match(tokenPattern) ?? [];
  const result = new Set(words.filter((word) => word.length > 1).map((word) => `w:${word}`));
  for (const word of words) {
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
  const normalizedTopic = text.toLocaleLowerCase("ru-RU").replace(/ё/g, "е").match(tokenPattern)?.join(" ") ?? "";
  const canonicalSubject = activeModel.topicIndex?.[normalizedTopic];
  if (canonicalSubject) return canonicalSubject;
  const features = extractFeatures(text);
  const scored = activeModel.subjects.map((subject) => {
    const likelihoods = activeModel.likelihoods[subject];
    let score = activeModel.priors[subject];
    for (const feature of features) {
      const value = likelihoods[feature];
      if (value !== undefined) score += value;
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
