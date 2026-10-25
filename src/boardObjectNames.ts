import type { Item } from "./boardModel";
import { subjectToolRegistry } from "./lektrusSubjectToolRegistry";
import { mathPresets } from "./lektrusMathPresets";
import { scienceToolGroups } from "./lektrusScienceCatalog";

// The persistence kind "graph" includes every subject-specific interactive
// teaching object. It must never be used as its visible type by default.
const schoolToolNames = new Map<string, string>(
  subjectToolRegistry.map(tool => [tool.id, tool.label]),
);
const mathNames = new Map<string, string>(
  mathPresets.map(preset => [preset.id, preset.title]),
);
const scienceNames = new Map<string, string>(
  scienceToolGroups.flatMap(group =>
    group.templates.map(template => [template.id, template.label] as const),
  ),
);

const kindNames: Record<Item["kind"], string> = {
  pen: "Карандаш",
  marker: "Маркер",
  shape: "Фигура",
  text: "Текст",
  sticky: "Стикер",
  image: "Изображение",
  pdf: "PDF",
  frame: "Фрейм",
  connector: "Линия",
  comment: "Комментарий",
  table: "Таблица",
  formula: "Формула",
  graph: "График функции",
  fraction: "Дробная модель",
  checklist: "Чек-лист",
  quiz: "Тест",
  flashcard: "Карточка",
  cover: "Шторка",
  linkmedia: "Медиа",
  instrument: "Измерительный инструмент",
};

export function boardObjectTypeName(item: Item): string {
  if (item.kind !== "graph") {
    if (item.kind === "connector") {
      if (item.connectorStyle === "double") return "Двусторонняя стрелка";
      return item.connectorStyle === "line" ? "Линия" : "Стрелка";
    }
    return kindNames[item.kind] ?? "Объект";
  }

  const id = item.graphFigureId ?? "";
  if (id === "chem-periodic") return "Периодическая система";
  if (id === "chem-atom") return "Строение атома";
  if (id === "lektrus-chart") return "Диаграмма";
  if (id === "chem-organic-free" || id.startsWith("chem-organic-")) return "Органическая структура";
  if (item.scienceCircuit) return "Электрическая цепь";
  if (item.scienceAtomModel) return "Строение атома";

  const known = schoolToolNames.get(id) ?? scienceNames.get(id) ?? mathNames.get(id);
  if (known) return known;

  const diagramTitle = item.schoolDiagram?.title?.trim();
  if (diagramTitle) return diagramTitle;

  switch (item.graphPurpose) {
    case "geometry": return "Геометрическое построение";
    case "coordinates": return "Координатная плоскость";
    case "number-line": return "Числовая прямая";
    case "unit-circle": return "Единичная окружность";
    case "polar": return "Полярная система координат";
    default: return "График функции";
  }
}
