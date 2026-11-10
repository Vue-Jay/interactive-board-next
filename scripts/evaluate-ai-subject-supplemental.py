#!/usr/bin/env python3
"""Report the manual, off-catalog subject-classification development set."""
from __future__ import annotations

import importlib.util
import json
import sys
from collections import Counter, defaultdict
from pathlib import Path

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

ROOT = Path(__file__).resolve().parents[1]
TRAINER_PATH = ROOT / "scripts" / "train-ai-subject-model.py"
MODEL_PATH = ROOT / "public" / "models" / "aiSubjectIntentModel.json"
CASES_PATH = ROOT / "ai-training" / "subject_classifier_supplemental.json"

spec = importlib.util.spec_from_file_location("trainer", TRAINER_PATH)
if spec is None or spec.loader is None:
    raise SystemExit("Не удалось загрузить скрипт модели")
trainer = importlib.util.module_from_spec(spec)
spec.loader.exec_module(trainer)

model = json.loads(MODEL_PATH.read_text(encoding="utf-8"))
model["featureIndex"] = {feature: index for index, feature in enumerate(model["features"])}
cases_doc = json.loads(CASES_PATH.read_text(encoding="utf-8"))
cases = cases_doc["cases"]
threshold = model["confidenceThreshold"]

exact_topics = {
    trainer.normalize_topic(topic)
    for topics in json.loads((ROOT / "ai-training" / "subject_topics.json").read_text(encoding="utf-8")).values()
    for topic in topics
}
overlaps = [case["text"] for case in cases if trainer.normalize_topic(case["text"]) in exact_topics]
if overlaps:
    raise SystemExit("Разработческий набор содержит полные совпадения тем каталога: " + repr(overlaps))

totals: Counter[str] = Counter()
accepted: Counter[str] = Counter()
correct: Counter[str] = Counter()
accepted_correct: Counter[str] = Counter()
raw_correct: Counter[str] = Counter()
confusions: dict[str, Counter[str]] = defaultdict(Counter)
false_confident: list[tuple[str, str, str, float]] = []
scored_cases: list[tuple[str, str, str, float]] = []
for case in cases:
    expected = case["subject"]
    predicted, _, confidence = trainer.predict(model, case["text"])
    result = predicted if confidence >= threshold else ""
    scored_cases.append((expected, predicted, result, confidence))
    totals[expected] += 1
    accepted[expected] += bool(result)
    correct[expected] += result == expected
    raw_correct[expected] += predicted == expected
    accepted_correct[expected] += bool(result) and result == expected
    confusions[expected][result or "<уточнить>"] += 1
    if result and result != expected:
        false_confident.append((case["text"], expected or "<уточнить>", result, confidence))

subject_cases = sum(count for subject, count in totals.items() if subject)
subject_accepted = sum(count for subject, count in accepted.items() if subject)
subject_correct = sum(count for subject, count in accepted_correct.items() if subject)
unknown_total = totals[""]
unknown_accepted = accepted[""]
all_correct = sum(correct.values())

print(f"Разработческий набор: {len(cases)} запросов, точное совпадение с каталогом: 0, порог: {threshold:.3f}")
print(f"Темы с указанным ожидаемым предметом: принято {subject_accepted}/{subject_cases} ({subject_accepted / subject_cases:.1%}); точность принятых {subject_correct}/{subject_accepted} ({subject_correct / max(1, subject_accepted):.1%})")
print(f"Предмет модели до порога: {sum(raw_correct[s] for s in trainer.SUBJECTS)}/{subject_cases} ({sum(raw_correct[s] for s in trainer.SUBJECTS) / subject_cases:.1%})")
print(f"Запросы без предметной подсказки: ошибочный уверенный ответ {unknown_accepted}/{unknown_total} ({unknown_accepted / unknown_total:.1%})")
print("Пороговый срез (только запросы с ожидаемым предметом):")
for candidate in (0, 1, 2, 3, 4, 5, 6, 8, 10):
    selected = [row for row in scored_cases if row[0] and row[3] >= candidate]
    n_correct = sum(expected == predicted for expected, predicted, _, _ in selected)
    unknown_false = sum(not expected and confidence >= candidate for expected, _, _, confidence in scored_cases)
    print(f"  порог {candidate:>2}: принято {len(selected)}/{subject_cases} ({len(selected) / subject_cases:.1%}), точность {n_correct}/{len(selected)} ({n_correct / max(1, len(selected)):.1%}), ошибочный ответ на запрос без предметной подсказки {unknown_false}/{unknown_total}")
print(f"Все запросы, с учётом отказа от ненадёжного ответа: {all_correct}/{len(cases)} ({all_correct / len(cases):.1%})")
for subject in trainer.SUBJECTS:
    n = totals[subject]
    a = accepted[subject]
    c = accepted_correct[subject]
    print(f"  {subject}: сырое {raw_correct[subject]}/{n} ({raw_correct[subject] / max(1, n):.1%}), охват {a}/{n} ({a / max(1, n):.1%}), точность принятых {c}/{a} ({c / max(1, a):.1%}), "
          + ", ".join(f"{label}={count}" for label, count in sorted(confusions[subject].items())))
print("  Неоднозначные: " + ", ".join(f"{label}={count}" for label, count in sorted(confusions[""].items())))
for text, expected, result, confidence in false_confident:
    print(f"  Ошибка уверенного ответа ({confidence:.3f}): {text!r}; ожидалось {expected}, получено {result}")
