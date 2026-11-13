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
INTENT_EXAMPLES_PATH = ROOT / "ai-training" / "subject_intent_examples.json"
AMBIGUITY_CALIBRATION_PATH = ROOT / "ai-training" / "subject_intent_diagnostic.json"
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
RUSSIAN_SUFFIXES = tuple(sorted((
    "иями", "ями", "ами", "иях", "ого", "ему", "ому", "ыми", "ими",
    "ая", "яя", "ое", "ее", "ые", "ие", "ый", "ий", "ой", "ей", "ую", "юю",
    "его", "ах", "ях", "ов", "ев",
    "ом", "ем", "ам", "ям", "ою", "ею", "ью", "ия", "ья", "а", "я", "ы", "и",
    "о", "е", "у", "ю", "ь", "й", "м",
), key=len, reverse=True))
REQUEST_STOP_WORDS = {
    "составь", "подготовь", "подготовить", "сделай", "создай", "сгенерируй", "придумай",
    "дай", "помоги", "подбери", "сформируй", "напиши", "реши", "найди", "объясни",
    "изучи", "разбери", "расскажи", "покажи", "хочу", "нужны", "нужна", "нужно", "мне",
    "можно", "пожалуйста", "задания", "задание", "задачи", "задачу", "вопросы", "вопрос",
    "упражнения", "упражнение", "тест", "теста", "тесты", "викторину", "карточки", "карточку",
    "флешкарточки", "проверочную", "контрольную", "самостоятельную", "практическую", "примеры",
    "пример", "набор", "подборку", "ученику", "ученикам", "учащимся", "тренировочный", "небольшой",
    "по", "на", "про", "тему", "тема", "теме", "класс", "класса", "классе", "кл",
    "для", "чтобы", "разобраться", "проверить", "провести", "знания", "урок", "занятие",
    "как", "что", "много", "несколько", "пару", "парочку", "сложные", "сложных", "сложную",
    "сложное", "нестандартные", "нестандартных", "олимпиадные", "олимпиадных", "простые", "простых",
}
SUBJECTS = [
    "Математика", "Физика", "Химия", "Биология", "География", "Русский язык",
    "Литература", "История", "Обществознание", "Информатика", "Иностранный язык",
]
MAX_FEATURES = 8000
MAX_MODEL_BYTES = 1_500_000
MIN_DOCUMENT_FREQUENCY = 3
CONFIDENCE_TARGET_ACCURACY = 1.0


def features(text: str) -> set[str]:
    words = [
        word for word in TOKEN_RE.findall(text.lower().replace("ё", "е"))
        if not word.isdigit() and word not in REQUEST_STOP_WORDS
    ]
    result = {f"w:{word}" for word in words if len(word) > 1}
    result.update(f"b:{left}_{right}" for left, right in zip(words, words[1:]))
    for word in words:
        stem = word
        if re.fullmatch(r"[а-я]+", word):
            for suffix in RUSSIAN_SUFFIXES:
                if len(word) - len(suffix) >= 3 and word.endswith(suffix):
                    stem = word[:-len(suffix)]
                    break
        if len(stem) > 1:
            result.add(f"s:{stem}")
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
    feature_class_counts: dict[str, Counter[str]] = defaultdict(Counter)
    documents: list[tuple[str, set[str]]] = []
    for text, subject in examples:
        doc_counts[subject] += 1
        present = features(text)
        document_frequency.update(present)
        for feature in present:
            feature_class_counts[feature][subject] += 1
        documents.append((subject, present))
    candidates = {feature for feature, count in document_frequency.items() if count >= MIN_DOCUMENT_FREQUENCY}
    class_docs = Counter(subject for _, subject in examples)
    total_docs = len(examples)

    def mutual_information(feature: str) -> float:
        present_by_class = feature_class_counts[feature]
        feature_docs = document_frequency[feature]
        score = 0.0
        for subject in SUBJECTS:
            for present_count, joint in ((feature_docs, present_by_class[subject]), (total_docs - feature_docs, class_docs[subject] - present_by_class[subject])):
                if not joint:
                    continue
                joint_probability = joint / total_docs
                score += joint_probability * math.log(joint * total_docs / (present_count * class_docs[subject]))
        return score

    ranked_features = sorted(
        (
            (mutual_information(feature) * (0.5 if feature.startswith("b:") else 1), feature)
            for feature in candidates
        ),
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
    # The catalogue deliberately has very different topic counts per subject.
    # A request is not more likely to be History just because the corpus has
    # more History entries, so keep the class prior uniform and let topic
    # evidence determine the prediction.
    priors = {subject: math.log(1 / len(SUBJECTS)) for subject in SUBJECTS}
    feature_index = {feature: index for index, feature in enumerate(vocabulary_list)}
    weights: dict[str, list[float]] = {}
    for subject in SUBJECTS:
        denominator = token_totals[subject] + feature_count
        weights[subject] = [
            round(math.log((token_counts[subject][feature] + 1) / denominator), 3)
            for feature in vocabulary_list
        ]
    return {
        "subjects": SUBJECTS,
        "priors": priors,
        "features": vocabulary_list,
        "featureIndex": feature_index,
        "featureWeights": weights,
        "vocabularySize": feature_count,
    }


def predict(model: dict, text: str) -> tuple[str, float, float]:
    present = features(text)
    scores = []
    for subject in model["subjects"]:
        weights = model["featureWeights"][subject]
        score = model["priors"][subject] + sum(
            weights[model["featureIndex"][feature]]
            for feature in present
            if feature in model["featureIndex"]
        )
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
    ambiguity_document = json.loads(AMBIGUITY_CALIBRATION_PATH.read_text(encoding="utf-8"))
    ambiguous_calibration_texts = [case["text"] for case in ambiguity_document["cases"] if not case.get("subject")]
    intent_examples = json.loads(INTENT_EXAMPLES_PATH.read_text(encoding="utf-8"))["subjects"]
    if set(intent_examples) != set(SUBJECTS):
        raise SystemExit("Дополнительные примеры классификатора должны содержать ровно 11 поддерживаемых предметов")
    extra_training = [
        (template.format(topic=topic), subject)
        for subject in SUBJECTS
        for topic in intent_examples[subject]
        for template in TEMPLATES
    ]
    train.extend(extra_training)
    model = fit(train)

    def predictions(examples: list[tuple[str, str]]) -> list[tuple[str, str, float]]:
        result = []
        for text, expected in examples:
            predicted, _, confidence = predict(model, text)
            result.append((expected, predicted, confidence))
        return result

    wording_calibration_scores = predictions(wording_calibration)
    topic_calibration_scores = predictions(topic_calibration)
    ambiguity_calibration_scores = [predict(model, text) for text in ambiguous_calibration_texts]
    def threshold_for_predicted_subject(subject: str) -> float:
        calibration = [
            row for row in wording_calibration_scores + topic_calibration_scores
            if row[1] == subject
        ]
        candidates = sorted({confidence for _, _, confidence in calibration})

        def meets_calibration_target(scores: list[tuple[str, str, float]], threshold: float) -> bool:
            accepted = [expected == predicted for expected, predicted, confidence in scores
                        if predicted == subject and confidence >= threshold]
            return bool(accepted) and sum(accepted) / len(accepted) >= CONFIDENCE_TARGET_ACCURACY

        # The classifier must abstain on generic or ambiguous requests as
        # well as stay precise on named-subject examples. Calibrate this class
        # boundary on the reviewed ambiguity set, never on final holdouts.
        highest_ambiguous_margin = max(
            (confidence for predicted, _, confidence in ambiguity_calibration_scores if predicted == subject),
            default=-1,
        )

        for threshold in candidates:
            if threshold > highest_ambiguous_margin \
                    and meets_calibration_target(wording_calibration_scores, threshold) \
                    and meets_calibration_target(topic_calibration_scores, threshold):
                return threshold
        return max(max(candidates, default=0), highest_ambiguous_margin) + 0.001

    subject_thresholds = {
        subject: round(threshold_for_predicted_subject(subject), 6)
        for subject in SUBJECTS
    }
    # Preserve each class's independently calibrated threshold at runtime.
    # A single maximum threshold is over-conservative because score margins
    # differ by class even when calibration precision is the same.
    model["subjectConfidenceThresholds"] = subject_thresholds
    confidence_threshold = max(subject_thresholds.values(), default=0)
    model["confidenceThreshold"] = confidence_threshold
    topic_labels: dict[str, str] = {}
    ambiguous_topics: set[str] = set()
    for subject in SUBJECTS:
        for topic in corpus[subject]:
            normalized = normalize_topic(topic)
            if normalized in topic_labels and topic_labels[normalized] != subject:
                ambiguous_topics.add(normalized)
            else:
                topic_labels[normalized] = subject
    for subject, mapping in grade_map.get("subjects", {}).items():
        for rows in mapping.get("officialAnnualPlanByGrade", {}).get("grades", {}).values():
            for row in rows:
                normalized = normalize_topic(row.get("title", ""))
                if not normalized:
                    continue
                if re.match(r"^(?:повторение|обобщение|систематизация|контроль)(?: |$)", normalized):
                    continue
                if normalized in topic_labels and topic_labels[normalized] != subject:
                    ambiguous_topics.add(normalized)
                else:
                    topic_labels[normalized] = subject
    for topic in ambiguous_topics:
        topic_labels.pop(topic, None)
    model["topicIndex"] = topic_labels

    topic_grades: dict[str, dict[str, str]] = defaultdict(dict)
    subject_grade_bands: dict[str, list[str]] = {}

    def merge_grade_bands(previous: str, current: str) -> str:
        def bounds(value: str) -> tuple[int, int]:
            match = re.fullmatch(r"(\d{1,2})(?:-(\d{1,2}))?", value)
            if not match:
                raise SystemExit(f"Некорректный диапазон классов: {value!r}")
            start = int(match[1])
            return start, int(match[2] or start)

        left_start, left_end = bounds(previous)
        right_start, right_end = bounds(current)
        if right_start > left_end + 1 or left_start > right_end + 1:
            raise SystemExit(
                f"Тема {previous!r} и {current!r} назначена разным несмежным диапазонам"
            )
        start, end = min(left_start, right_start), max(left_end, right_end)
        return str(start) if start == end else f"{start}-{end}"

    for subject, mapping in grade_map.get("subjects", {}).items():
        topics_by_grade = mapping.get("topicsByGradeBand", mapping.get("topicsByGrade", {}))
        subject_grade_bands[subject] = sorted(
            (str(grade) for grade in topics_by_grade if re.fullmatch(r"\d{1,2}(?:-\d{1,2})?", str(grade))),
            key=lambda value: (int(value.split("-")[0]), int(value.split("-")[-1])),
        )
        for grade, topics in topics_by_grade.items():
            for topic in topics:
                normalized = normalize_topic(topic)
                previous = topic_grades[subject].get(normalized)
                topic_grades[subject][normalized] = merge_grade_bands(previous, grade) if previous else grade
        # A few broad curriculum labels recur in adjacent grades with different
        # subskills. Keep an explicit source-backed band override rather than
        # forcing a valid request for the later grade to fail on the broad label.
        for topic, band in mapping.get("topicGradeOverrides", {}).items():
            normalized = normalize_topic(topic)
            if normalized not in topic_grades[subject]:
                raise SystemExit(f"Override references unmapped topic: {subject}: {topic}")
            if not re.fullmatch(r"([1-9]|1[01])(-([1-9]|1[01]))?", str(band)):
                raise SystemExit(f"Invalid topic grade override: {subject}: {topic}: {band}")
            topic_grades[subject][normalized] = str(band)
        # Exact wording from the official annual thematic plan is also a
        # supported curriculum topic. Keep the existing grade assignment when
        # one already exists; otherwise use the grades where the plan lists it.
        annual_topic_grades: dict[str, list[int]] = defaultdict(list)
        for grade, rows in mapping.get("officialAnnualPlanByGrade", {}).get("grades", {}).items():
            for row in rows:
                normalized = normalize_topic(row.get("title", ""))
                if normalized:
                    annual_topic_grades[normalized].append(int(grade))
        for normalized, grades in annual_topic_grades.items():
            annual_start, annual_end = min(grades), max(grades)
            previous = topic_grades[subject].get(normalized)
            if previous:
                match = re.fullmatch(r"(\d{1,2})(?:-(\d{1,2}))?", previous)
                if match:
                    annual_start = min(annual_start, int(match[1]))
                    annual_end = max(annual_end, int(match[2] or match[1]))
            topic_grades[subject][normalized] = str(annual_start) if annual_start == annual_end else f"{annual_start}-{annual_end}"
    # «Паронимы» встречаются в программе 5–9 классов и в старшей школе;
    # короткий запрос без уточнения разновидности должен допускать оба уровня.
    topic_grades["Русский язык"][normalize_topic("паронимы")] = "5-10"
    model["topicGradeIndex"] = dict(topic_grades)
    model["subjectGradeBands"] = subject_grade_bands

    def evaluate(examples: list[tuple[str, str]]) -> tuple[float, float, float, Counter, Counter]:
        totals = Counter()
        correct = Counter()
        accepted = Counter()
        accepted_correct = Counter()
        for text, expected in examples:
            predicted, _, confidence = predict(model, text)
            totals[expected] += 1
            correct[expected] += predicted == expected
            if confidence >= subject_thresholds.get(predicted, confidence_threshold):
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
    serialized_model = {key: value for key, value in model.items() if key != "featureIndex"}
    serialized = json.dumps(serialized_model, ensure_ascii=False, separators=(",", ":")) + "\n"
    serialized_bytes = serialized.encode("utf-8")
    if len(serialized_bytes) > MAX_MODEL_BYTES:
        raise SystemExit(
            f"Модель весит {len(serialized_bytes):,} байт; лимит — {MAX_MODEL_BYTES:,}. "
            "Уменьшите MAX_FEATURES, прежде чем обновлять артефакт."
        )
    OUTPUT_PATH.write_text(serialized, encoding="utf-8")
    version = hashlib.sha256(serialized.encode("utf-8")).hexdigest()[:16]
    VERSION_PATH.write_text(f'export const AI_SUBJECT_MODEL_VERSION = "{version}";\n', encoding="utf-8")
    print(f"Обучено на примерах: {len(train)} (в том числе {len(extra_training)} дополнительных предметных формулировок); калибровка: {len(wording_calibration)} формулировок и {len(topic_calibration)} примеров новых тем; финальная проверка: {len(wording_validation)} и {len(topic_validation)} примеров")
    print(f"Словарь признаков: {model['vocabularySize']}; размер модели: {OUTPUT_PATH.stat().st_size / 1024:.1f} КБ; версия {version}")
    print(f"Калибровка: цель {CONFIDENCE_TARGET_ACCURACY:.0%} по предметам и отказ от {len(ambiguous_calibration_texts)} общих/неоднозначных запросов; в браузере используется отдельный порог для предсказанного предмета")
    print("  " + "; ".join(f"{subject}: {threshold:.3f}" for subject, threshold in subject_thresholds.items()))
    print(f"Знакомые темы в новых формулировках: {wording_accuracy:.1%}; покрытие уверенных ответов {wording_coverage:.1%}, точность уверенных {wording_confident_accuracy:.1%}")
    print(f"Новые темы, целиком отложенные от обучения и калибровки: {topic_accuracy:.1%}; покрытие уверенных ответов {topic_coverage:.1%}, точность уверенных {topic_confident_accuracy:.1%}")
    for subject in ("Математика", "Физика", "Химия", "Русский язык"):
        rows = []
        for text, expected in topic_validation:
            if expected != subject:
                continue
            predicted, _, confidence = predict(model, text)
            rows.append((predicted == expected, confidence >= subject_thresholds.get(predicted, confidence_threshold), confidence, predicted, text))
        accepted_rows = [correct for correct, accepted, _, _, _ in rows if accepted]
        print(
            f"  Новые темы {subject}: {sum(correct for correct, _, _, _, _ in rows)}/{len(rows)} "
            f"сырых; уверенный охват {len(accepted_rows)}/{len(rows)}; "
            f"точность уверенных {sum(accepted_rows)}/{len(accepted_rows) if accepted_rows else 0}"
        )
        for _, accepted, confidence, predicted, text in rows:
            if accepted and predicted != subject:
                print(f"    Уверенная ошибка {subject} ({confidence:.3f}): {text!r}; получено {predicted}")
    topic_confident_errors = []
    for text, expected in topic_validation:
        predicted, _, confidence = predict(model, text)
        if confidence >= subject_thresholds.get(predicted, confidence_threshold) and predicted != expected:
            topic_confident_errors.append((confidence, expected, predicted, text))
    for confidence, expected, predicted, text in sorted(topic_confident_errors, reverse=True)[:20]:
        print(f"  Уверенная ошибка новой темы ({confidence:.3f}): {text!r}; ожидалось {expected}, получено {predicted}")
    for subject in SUBJECTS:
        print(f"  {subject}: {correct[subject]}/{totals[subject]}")


if __name__ == "__main__":
    main()
