#!/usr/bin/env python3
"""Train a tiny, dependency-free subject classifier from the checked-in Russian corpus."""
from __future__ import annotations

import json
import hashlib
import math
import re
import sys
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CORPUS_PATH = ROOT / "ai-training" / "subject_topics.json"
OUTPUT_PATH = ROOT / "public" / "models" / "aiSubjectIntentModel.json"
VERSION_PATH = ROOT / "src" / "aiSubjectIntentModelVersion.ts"
TEMPLATES = (
    "Составь задания по теме {topic}",
    "Подготовь вопросы и объяснение: {topic}",
    "Мне нужны упражнения, чтобы разобраться в теме {topic}",
    "Сделай карточки для урока про {topic}",
    "Помоги проверить знания по теме {topic}",
    "Придумай практическую работу: {topic}",
)
TOKEN_RE = re.compile(r"[а-яёa-z0-9]+", re.IGNORECASE)
SUBJECTS = [
    "Математика", "Физика", "Химия", "Биология", "География", "Русский язык",
    "Литература", "История", "Обществознание", "Информатика", "Иностранный язык",
]
MAX_FEATURES = 1600


def features(text: str) -> set[str]:
    words = TOKEN_RE.findall(text.lower().replace("ё", "е"))
    result = {f"w:{word}" for word in words if len(word) > 1}
    for word in words:
        bounded = f"^{word}$"
        for size in (3, 4, 5):
            result.update(f"c:{bounded[i:i + size]}" for i in range(max(0, len(bounded) - size + 1)))
    return result


def make_examples(corpus: dict[str, list[str]]) -> tuple[list[tuple[str, str]], list[tuple[str, str]]]:
    train: list[tuple[str, str]] = []
    validation: list[tuple[str, str]] = []
    for subject in SUBJECTS:
        topics = corpus[subject]
        for topic in topics:
            for index, template in enumerate(TEMPLATES):
                destination = validation if index in (1, 4) else train
                destination.append((template.format(topic=topic), subject))
    return train, validation


def fit(examples: list[tuple[str, str]]) -> dict:
    doc_counts = Counter()
    token_counts: dict[str, Counter[str]] = defaultdict(Counter)
    token_totals = Counter()
    document_frequency: Counter[str] = Counter()
    documents: list[tuple[str, set[str]]] = []
    for text, subject in examples:
        doc_counts[subject] += 1
        present = features(text)
        document_frequency.update(present)
        documents.append((subject, present))
    candidates = {feature for feature, count in document_frequency.items() if count >= 2}
    class_docs = Counter(subject for _, subject in examples)
    total_docs = len(examples)

    def mutual_information(feature: str) -> float:
        present_by_class = Counter(subject for subject, present in documents if feature in present)
        feature_docs = sum(present_by_class.values())
        score = 0.0
        for subject in SUBJECTS:
            for present_count, joint in ((feature_docs, present_by_class[subject]), (total_docs - feature_docs, class_docs[subject] - present_by_class[subject])):
                if not joint:
                    continue
                joint_probability = joint / total_docs
                score += joint_probability * math.log(joint * total_docs / (present_count * class_docs[subject]))
        return score

    ranked_features = sorted(
        ((mutual_information(feature), feature) for feature in candidates),
        key=lambda item: (-item[0], item[1]),
    )
    vocabulary_list = [feature for _, feature in ranked_features[:MAX_FEATURES]]
    vocabulary = set(vocabulary_list)
    for subject, present in documents:
        for feature in present:
            if feature not in vocabulary:
                continue
            token_counts[subject][feature] += 1
            token_totals[subject] += 1
    total_docs = sum(doc_counts.values())
    feature_count = len(vocabulary)
    priors = {subject: math.log(doc_counts[subject] / total_docs) for subject in SUBJECTS}
    likelihoods: dict[str, dict[str, float]] = {}
    for subject in SUBJECTS:
        denominator = token_totals[subject] + feature_count
        likelihoods[subject] = {
            feature: round(math.log((token_counts[subject][feature] + 1) / denominator), 3)
            for feature in vocabulary_list
        }
    return {"subjects": SUBJECTS, "priors": priors, "likelihoods": likelihoods, "vocabularySize": feature_count}


def predict(model: dict, text: str) -> tuple[str, float, float]:
    present = features(text)
    scores = []
    for subject in model["subjects"]:
        likelihood = model["likelihoods"][subject]
        score = model["priors"][subject] + sum(likelihood[feature] for feature in present if feature in likelihood)
        scores.append((score, subject))
    scores.sort(reverse=True)
    margin = scores[0][0] - scores[1][0]
    normalized = margin / max(1, len(present) ** 0.5)
    return scores[0][1], margin, normalized


def main() -> None:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    corpus = json.loads(CORPUS_PATH.read_text(encoding="utf-8"))
    missing = set(SUBJECTS) - corpus.keys()
    if missing:
        raise SystemExit(f"В корпусе отсутствуют предметы: {', '.join(sorted(missing))}")
    train, validation = make_examples(corpus)
    model = fit(train)
    totals = Counter()
    correct = Counter()
    accepted = Counter()
    accepted_correct = Counter()
    confusion = Counter()
    for text, expected in validation:
        predicted, _, confidence = predict(model, text)
        totals[expected] += 1
        correct[expected] += predicted == expected
        confusion[(expected, predicted)] += 1
        if confidence >= 0.5:
            accepted[expected] += 1
            accepted_correct[expected] += predicted == expected
    accuracy = sum(correct.values()) / max(1, sum(totals.values()))
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    serialized = json.dumps(model, ensure_ascii=False, separators=(",", ":")) + "\n"
    OUTPUT_PATH.write_text(serialized, encoding="utf-8")
    version = hashlib.sha256(serialized.encode("utf-8")).hexdigest()[:16]
    VERSION_PATH.write_text(f'export const AI_SUBJECT_MODEL_VERSION = "{version}";\n', encoding="utf-8")
    print(f"Обучено на примерах: {len(train)}; проверочная выборка: {len(validation)}")
    print(f"Словарь признаков: {model['vocabularySize']}; размер модели: {OUTPUT_PATH.stat().st_size / 1024:.1f} КБ; версия {version}")
    print(f"Точность отложенной выборки: {accuracy:.1%}")
    accepted_total = sum(accepted.values())
    accepted_accuracy = sum(accepted_correct.values()) / max(1, accepted_total)
    print(f"При пороге уверенности 0,5: принято {accepted_total}/{len(validation)} запросов; точность среди принятых {accepted_accuracy:.1%}")
    for subject in SUBJECTS:
        print(f"  {subject}: {correct[subject]}/{totals[subject]}")
    mistakes = [(expected, predicted, count) for (expected, predicted), count in confusion.items() if expected != predicted]
    if mistakes:
        print("Частые ошибки:")
        for expected, predicted, count in sorted(mistakes, key=lambda item: -item[2])[:8]:
            print(f"  {expected} → {predicted}: {count}")


if __name__ == "__main__":
    main()
