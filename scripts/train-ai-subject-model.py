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
GRADE_MAP_PATH = ROOT / "ai-training" / "curriculum_grade_map.json"
OUTPUT_PATH = ROOT / "public" / "models" / "aiSubjectIntentModel.json"
VERSION_PATH = ROOT / "src" / "aiSubjectIntentModelVersion.ts"
TEMPLATES = (
    "Составь задания по теме {topic}",
    "Подготовь вопросы и объяснение: {topic}",
    "Мне нужны упражнения, чтобы разобраться в теме {topic}",
    "Сделай карточки для урока про {topic}",
    "Помоги проверить знания по теме {topic}",
    "Придумай практическую работу: {topic}",
    "Подбери задания ученику по теме: {topic}",
    "Хочу вопросы на тему {topic}",
    "Сгенерируй тренировочный тест: {topic}",
    "Нужны карточки для повторения: {topic}",
    "Дай примеры и упражнения по теме {topic}",
    "Сделай карточки на урок по теме {topic}",
    "Составь небольшой тест по теме {topic}",
    "Мне нужна проверочная работа на тему {topic}",
    "Подготовь карточки для занятия по теме {topic}",
    "Создай тренировочные задания по теме: {topic}",
    "Сгенерируй упражнения для закрепления темы {topic}",
    "Сделай викторину по теме {topic}",
    "Подготовь набор примеров и вопросов по теме {topic}",
    "Помоги провести проверку знаний по теме {topic}",
)
TOKEN_RE = re.compile(r"[а-яёa-z0-9]+", re.IGNORECASE)
SUBJECTS = [
    "Математика", "Физика", "Химия", "Биология", "География", "Русский язык",
    "Литература", "История", "Обществознание", "Информатика", "Иностранный язык",
]
MAX_FEATURES = 5790
MAX_MODEL_BYTES = 1_500_000
MIN_DOCUMENT_FREQUENCY = 3
CONFIDENCE_TARGET_ACCURACY = 0.99


def features(text: str) -> set[str]:
    words = TOKEN_RE.findall(text.lower().replace("ё", "е"))
    result = {f"w:{word}" for word in words if len(word) > 1}
    for word in words:
        bounded = f"^{word}$"
        for size in (3, 4, 5):
            result.update(f"c:{bounded[i:i + size]}" for i in range(max(0, len(bounded) - size + 1)))
    return result


def normalize_topic(text: str) -> str:
    return " ".join(re.findall(r"[а-яёa-z0-9]+", text.lower().replace("ё", "е")))


def make_examples(corpus: dict[str, list[str]]) -> tuple[list[tuple[str, str]], list[tuple[str, str]], list[tuple[str, str]], list[tuple[str, str]], list[tuple[str, str]]]:
    train: list[tuple[str, str]] = []
    wording_calibration: list[tuple[str, str]] = []
    wording_validation: list[tuple[str, str]] = []
    topic_calibration: list[tuple[str, str]] = []
    topic_validation: list[tuple[str, str]] = []
    for subject in SUBJECTS:
        topics = corpus[subject]
        for topic_index, topic in enumerate(topics):
            if topic_index % 5 == 0:
                destination = topic_calibration if topic_index % 10 == 0 else topic_validation
                destination.extend((template.format(topic=topic), subject) for template in TEMPLATES)
                continue
            for template_index, template in enumerate(TEMPLATES):
                if template_index in (3, 8):
                    destination = wording_calibration if topic_index % 10 == 1 else wording_validation
                else:
                    destination = train
                destination.append((template.format(topic=topic), subject))
    return train, wording_calibration, wording_validation, topic_calibration, topic_validation


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
    candidates = {feature for feature, count in document_frequency.items() if count >= MIN_DOCUMENT_FREQUENCY}
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
    grade_map = json.loads(GRADE_MAP_PATH.read_text(encoding="utf-8"))
    missing = set(SUBJECTS) - corpus.keys()
    if missing:
        raise SystemExit(f"В корпусе отсутствуют предметы: {', '.join(sorted(missing))}")
    train, wording_calibration, wording_validation, topic_calibration, topic_validation = make_examples(corpus)
    model = fit(train)

    def predictions(examples: list[tuple[str, str]]) -> list[tuple[bool, float]]:
        result = []
        for text, expected in examples:
            predicted, _, confidence = predict(model, text)
            result.append((predicted == expected, confidence))
        return result

    wording_calibration_scores = predictions(wording_calibration)
    topic_calibration_scores = predictions(topic_calibration)
    candidate_thresholds = sorted({confidence for _, confidence in wording_calibration_scores + topic_calibration_scores})

    def meets_calibration_target(scores: list[tuple[bool, float]], threshold: float) -> bool:
        accepted = [correct for correct, confidence in scores if confidence >= threshold]
        return bool(accepted) and sum(accepted) / len(accepted) >= CONFIDENCE_TARGET_ACCURACY

    confidence_threshold = next((
        threshold for threshold in candidate_thresholds
        if meets_calibration_target(wording_calibration_scores, threshold)
        and meets_calibration_target(topic_calibration_scores, threshold)
    ), max(candidate_thresholds, default=0) + 1)
    model["confidenceThreshold"] = round(confidence_threshold, 6)
    topic_labels: dict[str, str] = {}
    ambiguous_topics: set[str] = set()
    for subject in SUBJECTS:
        for topic in corpus[subject]:
            normalized = normalize_topic(topic)
            if normalized in topic_labels and topic_labels[normalized] != subject:
                ambiguous_topics.add(normalized)
            else:
                topic_labels[normalized] = subject
    for topic in ambiguous_topics:
        topic_labels.pop(topic, None)
    model["topicIndex"] = topic_labels

    topic_grades: dict[str, dict[str, str]] = defaultdict(dict)
    for subject, mapping in grade_map.get("subjects", {}).items():
        topics_by_grade = mapping.get("topicsByGradeBand", mapping.get("topicsByGrade", {}))
        for grade, topics in topics_by_grade.items():
            for topic in topics:
                normalized = normalize_topic(topic)
                if normalized in topic_grades[subject]:
                    raise SystemExit(f"Тема {topic!r} по предмету {subject!r} указана более чем для одного класса")
                topic_grades[subject][normalized] = grade
    model["topicGradeIndex"] = dict(topic_grades)

    def evaluate(examples: list[tuple[str, str]]) -> tuple[float, float, float, Counter, Counter]:
        totals = Counter()
        correct = Counter()
        accepted = Counter()
        accepted_correct = Counter()
        for text, expected in examples:
            predicted, _, confidence = predict(model, text)
            totals[expected] += 1
            correct[expected] += predicted == expected
            if confidence >= confidence_threshold:
                accepted[expected] += 1
                accepted_correct[expected] += predicted == expected
        accuracy = sum(correct.values()) / max(1, sum(totals.values()))
        accepted_total = sum(accepted.values())
        accepted_accuracy = sum(accepted_correct.values()) / max(1, accepted_total)
        coverage = accepted_total / max(1, len(examples))
        return accuracy, coverage, accepted_accuracy, correct, totals

    wording_accuracy, wording_coverage, wording_confident_accuracy, correct, totals = evaluate(wording_validation)
    topic_accuracy, topic_coverage, topic_confident_accuracy, _, _ = evaluate(topic_validation)
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    serialized = json.dumps(model, ensure_ascii=False, separators=(",", ":")) + "\n"
    serialized_bytes = serialized.encode("utf-8")
    if len(serialized_bytes) > MAX_MODEL_BYTES:
        raise SystemExit(
            f"Модель весит {len(serialized_bytes):,} байт; лимит — {MAX_MODEL_BYTES:,}. "
            "Уменьшите MAX_FEATURES, прежде чем обновлять артефакт."
        )
    OUTPUT_PATH.write_text(serialized, encoding="utf-8")
    version = hashlib.sha256(serialized.encode("utf-8")).hexdigest()[:16]
    VERSION_PATH.write_text(f'export const AI_SUBJECT_MODEL_VERSION = "{version}";\n', encoding="utf-8")
    print(f"Обучено на примерах: {len(train)}; калибровка: {len(wording_calibration)} формулировок и {len(topic_calibration)} примеров новых тем; финальная проверка: {len(wording_validation)} формулировок и {len(topic_validation)} примеров новых тем")
    print(f"Словарь признаков: {model['vocabularySize']}; размер модели: {OUTPUT_PATH.stat().st_size / 1024:.1f} КБ; версия {version}")
    print(f"Калибровочный целевой уровень точности уверенного ответа: {CONFIDENCE_TARGET_ACCURACY:.0%}; выбран порог {confidence_threshold:.3f}")
    print(f"Знакомые темы в новых формулировках: {wording_accuracy:.1%}; покрытие уверенных ответов {wording_coverage:.1%}, точность уверенных {wording_confident_accuracy:.1%}")
    print(f"Новые темы, целиком отложенные от обучения и калибровки: {topic_accuracy:.1%}; покрытие уверенных ответов {topic_coverage:.1%}, точность уверенных {topic_confident_accuracy:.1%}")
    for subject in SUBJECTS:
        print(f"  {subject}: {correct[subject]}/{totals[subject]}")


if __name__ == "__main__":
    main()
