import type { BoardActivityEntry } from "./historyStore";
import type { Item, Point, ShapeType } from "./boardModel";

export type BoardAssistantCommand =
  | { kind: "help" }
  | { kind: "analyze" }
  | { kind: "history" }
  | { kind: "undo" }
  | { kind: "redo" }
  | { kind: "find"; query: string }
  | { kind: "rename"; query: string; text: string }
  | { kind: "delete"; query: string }
  | { kind: "move"; query: string; direction: "left" | "right" | "up" | "down" | "center" }
  | { kind: "create-sticky"; text: string }
  | { kind: "create-text"; text: string }
  | { kind: "create-checklist"; text: string }
  | { kind: "create-shape"; shape: ShapeType; text: string }
  | { kind: "unknown" };

const commandPrefix = /^(?:пожалуйста\s+)?(?:создай|добавь|размести|нарисуй|напиши|вставь)\s+/i;
const shapeNames: [RegExp, ShapeType][] = [
  [/круг|окружност/i, "circle"], [/эллипс/i, "ellipse"], [/квадрат/i, "square"],
  [/прямоугольник/i, "rectangle"], [/треугольник/i, "triangle"], [/ромб/i, "diamond"],
  [/звезд/i, "star"], [/стрелк/i, "arrow"],
];

function cleanPayload(input: string): string {
  return input
    .replace(commandPrefix, "")
    .replace(/^(?:заметку|стикер|записку|текст|надпись|фигуру|форму|список)\s*/i, "")
    .replace(/^[:—–-]\s*/, "")
    .replace(/^([«"'])(.*)\1$/, "$2")
    .trim();
}

export function parseBoardAssistantCommand(input: string): BoardAssistantCommand {
  const value = input.trim();
  if (!value) return { kind: "unknown" };
  if (/^(?:помощь|что ты умеешь|команды|help)\??$/i.test(value)) return { kind: "help" };
  if (/(?:отмени|отменить|шаг назад|undo)/i.test(value)) return { kind: "undo" };
  if (/(?:повтори действие|верни последнее действие|шаг вперед|шаг впер[её]д|redo)/i.test(value)) return { kind: "redo" };
  if (/истори|последн(?:ие|их) изменения|что менялось|кто менял|журнал изменений/i.test(value)) return { kind: "history" };
  const rename = value.match(/^(?:переименуй|измени название|измени текст(?: объекта)?)\s+(.+?)\s+(?:в|на)\s+[«"']?(.+?)[»"']?$/i);
  if (rename) return { kind: "rename", query: rename[1].trim(), text: rename[2].trim() };
  const move = value.match(/^(?:перемести|сдвинь)\s+(.+?)\s+(влево|вправо|вверх|вниз|в центр|по центру)$/i);
  if (move) {
    const direction = /влево/i.test(move[2]) ? "left" : /вправо/i.test(move[2]) ? "right" : /вверх/i.test(move[2]) ? "up" : /вниз/i.test(move[2]) ? "down" : "center";
    return { kind: "move", query: move[1].trim(), direction };
  }
  const remove = value.match(/^(?:удали|удалить|убери)\s+(.+)$/i);
  if (remove) return { kind: "delete", query: remove[1].trim() };
  if (/найди|найти|отыщи|поиск|где (?:написано|находится)|покажи .*объект/i.test(value)) {
    const query = value
      .replace(/^(?:пожалуйста\s+)?(?:найди|найти|отыщи|поиск|покажи|где (?:написано|находится))\s*/i, "")
      .replace(/(?:на доске|на этой доске|объект|объекты)/gi, " ")
      .replace(/[?!.,]+$/g, "").trim();
    return query ? { kind: "find", query } : { kind: "analyze" };
  }
  if (/(?:проанализируй|анализ|сводка|обзор|содержимое|что есть на доске|что на доске|все элементы|перечисли элементы|покажи все элементы)/i.test(value)) return { kind: "analyze" };

  if (commandPrefix.test(value)) {
    const shape = shapeNames.find(([pattern]) => pattern.test(value));
    if (shape) return { kind: "create-shape", shape: shape[1], text: cleanPayload(value).replace(shape[0], "").replace(/^[:—–-]\s*/, "").trim() };
    if (/заметк|стикер|записк/i.test(value)) return { kind: "create-sticky", text: cleanPayload(value) };
    if (/список|чек.?лист/i.test(value)) return { kind: "create-checklist", text: cleanPayload(value) };
    if (/текст|надпис/i.test(value)) return { kind: "create-text", text: cleanPayload(value) };
  }
  return { kind: "unknown" };
}

const MAX_SEARCH_STRINGS_PER_ITEM = 256;
const MAX_SEARCH_CHARS_PER_ITEM = 24_000;
const MAX_SEARCH_ARRAY_ENTRIES = 256;
const ignoredSearchFields = /^(?:points|graphPoints|ink|imageCrop|connectorStart|connectorEnd|imageData|thumbnail|base64|blob|binary|previewData|rawData|pathData)$/i;

function flattenStrings(value: unknown, output: string[], seen: Set<object>, state: { chars: number }): void {
  if (output.length >= MAX_SEARCH_STRINGS_PER_ITEM || state.chars >= MAX_SEARCH_CHARS_PER_ITEM) return;
  if (typeof value === "string") {
    const text = value.trim();
    if (text && text.length < 12000 && !/^data:[^,]+;base64,/i.test(text)) {
      const remaining = MAX_SEARCH_CHARS_PER_ITEM - state.chars;
      output.push(text.slice(0, remaining));
      state.chars += Math.min(text.length, remaining);
    }
    return;
  }
  if (!value || typeof value !== "object" || seen.has(value)) return;
  seen.add(value);
  if (Array.isArray(value)) {
    for (const entry of value.slice(0, MAX_SEARCH_ARRAY_ENTRIES)) {
      flattenStrings(entry, output, seen, state);
      if (output.length >= MAX_SEARCH_STRINGS_PER_ITEM || state.chars >= MAX_SEARCH_CHARS_PER_ITEM) break;
    }
    return;
  }
  for (const [key, entry] of Object.entries(value)) {
    if (ignoredSearchFields.test(key)) continue;
    flattenStrings(entry, output, seen, state);
    if (output.length >= MAX_SEARCH_STRINGS_PER_ITEM || state.chars >= MAX_SEARCH_CHARS_PER_ITEM) break;
  }
}

function normalizeSearch(value: string): string {
  return value.toLocaleLowerCase("ru-RU").replace(/ё/g, "е");
}

const ignoredQueryWords = new Set(["найди", "найти", "покажи", "пожалуйста", "объект", "объекты", "заметку", "заметка", "стикер", "записку", "текст", "карточку", "доска", "доске", "этой", "на", "в", "и", "или", "по", "про"]);

export function findBoardItems(items: Item[], query: string): Item[] {
  const terms = normalizeSearch(query).match(/[а-яa-z0-9]+/giu)?.filter(word => word.length > 2 && !ignoredQueryWords.has(word)) ?? [];
  if (!terms.length) return [];
  return items.filter(item => {
    const searchable: string[] = [];
    flattenStrings(item, searchable, new Set(), { chars: 0 });
    const text = normalizeSearch(searchable.join(" "));
    return terms.every(term => {
      if (text.includes(term)) return true;
      const prefix = term.slice(0, Math.min(4, term.length));
      return text.split(/[^а-яa-z0-9]+/u).some(word => word.startsWith(prefix));
    });
  });
}

export type BoardAssistantMutationCommand = Extract<BoardAssistantCommand, { kind: "rename" | "move" | "delete" }>;
export type BoardAssistantMutationResult = {
  status: "not-found" | "confirmation-required" | "changed";
  items: Item[];
  matches: Item[];
  selectedIds: string[];
  bounds: ReturnType<typeof boardItemBounds>;
};

/** Applies a board-item command as one immutable update; destructive deletes require explicit confirmation. */
export function applyBoardAssistantMutation(
  items: Item[],
  command: BoardAssistantMutationCommand,
  options: { confirmed?: boolean; center?: Point } = {},
): BoardAssistantMutationResult {
  const matches = findBoardItems(items.filter(item => !item.hidden), command.query);
  const selectedIds = matches.map(item => item.id);
  if (!matches.length) return { status: "not-found", items, matches, selectedIds: [], bounds: null };
  if (command.kind === "delete" && !options.confirmed) {
    return { status: "confirmation-required", items, matches, selectedIds, bounds: boardItemBounds(matches) };
  }

  const ids = new Set(selectedIds);
  let nextItems: Item[];
  if (command.kind === "delete") {
    nextItems = items.filter(item => !ids.has(item.id));
  } else if (command.kind === "rename") {
    nextItems = items.map(item => {
      if (!ids.has(item.id)) return item;
      if (item.kind === "image" || item.kind === "pdf") return { ...item, name: command.text };
      if (item.kind === "linkmedia") return { ...item, mediaTitle: command.text };
      if (item.kind === "table") return { ...item, name: command.text };
      return { ...item, text: command.text };
    });
  } else {
    let dx = 0, dy = 0;
    if (command.direction === "left") dx = -160;
    if (command.direction === "right") dx = 160;
    if (command.direction === "up") dy = -160;
    if (command.direction === "down") dy = 160;
    if (command.direction === "center") {
      const bounds = boardItemBounds(matches);
      if (!bounds || !options.center) return { status: "not-found", items, matches: [], selectedIds: [], bounds: null };
      dx = options.center.x - (bounds.x + bounds.width / 2);
      dy = options.center.y - (bounds.y + bounds.height / 2);
    }
    nextItems = items.map(item => ids.has(item.id) ? { ...item, x: item.x + dx, y: item.y + dy } : item);
  }
  const changedItems = nextItems.filter(item => ids.has(item.id));
  return { status: "changed", items: nextItems, matches, selectedIds, bounds: boardItemBounds(changedItems) };
}

const kindNames: Record<string, string> = {
  sticky: "заметки", text: "текст", shape: "фигуры", pen: "рисунки", marker: "выделения",
  image: "изображения", pdf: "документы", frame: "фреймы", connector: "связи", comment: "комментарии",
  table: "таблицы", formula: "формулы", graph: "графики", fraction: "дроби", checklist: "списки и задания",
  quiz: "тесты", flashcard: "карточки", cover: "обложки", linkmedia: "видео и ссылки", instrument: "инструменты",
};

export function summarizeBoard(items: Item[]): string {
  if (!items.length) return "Доска пока пустая.";
  const counts = new Map<string, number>();
  for (const item of items) counts.set(item.kind, (counts.get(item.kind) ?? 0) + 1);
  const kinds = [...counts].sort((a, b) => b[1] - a[1]).map(([kind, count]) => `${kindNames[kind] ?? kind}: ${count}`);
  const checklists = items.filter(item => item.kind === "checklist");
  const totalTasks = checklists.reduce((sum, item) => sum + (item.checklistItems?.length ?? 0), 0);
  const doneTasks = checklists.reduce((sum, item) => sum + (item.checklistDone?.filter(Boolean).length ?? 0), 0);
  const emptyItems = items.filter(item => !item.text?.trim() && !item.name?.trim() && !(item.checklistItems?.length)
    && !(item.tableCells?.some(cell => cell.trim())) && item.kind !== "pen" && item.kind !== "marker").length;
  const contentFor = (item: Item): string[] => {
    const values: unknown[] = [item.name, item.text, item.mediaTitle, item.notes, item.flashcardBack,
      item.quizExplanation, item.graphExpression, item.scienceReactionConditions, item.scienceReagents,
      item.checklistItems, item.tableCells, item.quizOptions,
      item.chartEntries?.map(entry => `${entry.label}: ${entry.value}`),
      item.graphSegments?.map(segment => segment.label), item.graphAngles?.map(angle => angle.label),
      item.graphCircles?.map(circle => circle.label), item.graphPolygons?.map(polygon => polygon.label),
      item.scienceReactionSteps, item.subjectBoardEntries, item.schoolDiagram, item.scienceCircuit,
      item.scienceOptics, item.scienceMechanics, item.scienceAtomModel, item.scienceLabBench];
    const candidates: string[] = [];
    for (const value of values) flattenStrings(value, candidates, new Set(), { chars: 0 });
    const unique = new Set<string>();
    for (const candidate of candidates) {
      const text = candidate.replace(/\s+/g, " ").trim();
      if (!text || text.length < 2 || /^[0-9a-f]{8}-[0-9a-f-]{20,}$/i.test(text) || /^#[0-9a-f]{6}$/i.test(text)) continue;
      unique.add(text.length > 150 ? `${text.slice(0, 147)}…` : text);
      if (unique.size >= 3) break;
    }
    return [...unique];
  };
  const contentLines: string[] = [];
  for (const item of items) {
    if (contentLines.length >= 8) break;
    const content = contentFor(item);
    if (!content.length) continue;
    contentLines.push(`${kindNames[item.kind] ?? item.kind}: ${content.join(" · ")}`);
  }
  const contentCountLabel = contentLines.length === 8 ? "первые 8 объектов с содержимым" : `${contentLines.length} объектов с содержимым`;
  return [
    `На доске ${items.length} элементов.`,
    kinds.join(" · "),
    totalTasks ? `В списках отмечено ${doneTasks} из ${totalTasks} пунктов.` : "",
    emptyItems ? `${emptyItems} элементов пока без текстового содержимого.` : "",
    `Примеры содержания (${contentCountLabel}):\n${contentLines.length ? contentLines.join("\n") : "Текстовых данных нет."}`,
  ].filter(Boolean).join("\n");
}

export function summarizeBoardActivity(entries: BoardActivityEntry[]): string {
  if (!entries.length) return "В сохранённой истории пока нет записей об изменениях.";
  const recent = entries.slice(0, 8).map(entry => {
    const date = new Date(entry.created_at).toLocaleString("ru-RU", { dateStyle: "short", timeStyle: "short" });
    const actor = entry.actor_name ? `${entry.actor_name}: ` : "";
    return `• ${date} · ${actor}${entry.summary} (добавлено ${entry.added_count}, изменено ${entry.changed_count}, удалено ${entry.removed_count})`;
  });
  const added = entries.reduce((sum, entry) => sum + entry.added_count, 0);
  const changed = entries.reduce((sum, entry) => sum + entry.changed_count, 0);
  const removed = entries.reduce((sum, entry) => sum + entry.removed_count, 0);
  return [`В истории ${entries.length} последних записей: всего добавлено ${added}, изменено ${changed}, удалено ${removed}.`, ...recent].join("\n");
}

export function createBoardAssistantObject(
  command: Extract<BoardAssistantCommand, { kind: "create-sticky" | "create-text" | "create-checklist" | "create-shape" }>,
  center: Point,
  createId: () => string,
): Item | null {
  if (!command.text.trim() && command.kind !== "create-shape") return null;
  const text = command.text.slice(0, 3000);
  const wrappedLineCount = (value: string, width: number) => value.split(/\r?\n/).reduce((sum, line) =>
    sum + Math.max(1, Math.ceil(line.length / width)), 0);
  if (command.kind === "create-sticky") return {
    id: createId(), kind: "sticky", x: center.x - 170, y: center.y - Math.max(105, wrappedLineCount(text, 26) * 13 + 45), width: 340,
    height: Math.max(210, wrappedLineCount(text, 26) * 26 + 90),
    text, color: "#fff3a6", fontSize: 18,
  };
  if (command.kind === "create-text") return {
    id: createId(), kind: "text", x: center.x - 200, y: center.y - Math.max(50, wrappedLineCount(text, 25) * 17 + 20), width: 400,
    height: Math.max(100, wrappedLineCount(text, 25) * 35 + 40),
    text, color: "#253a64", fontSize: 24,
  };
  if (command.kind === "create-checklist") {
    const checklistItems = text.split(/[\n;]+/).map(entry => entry.replace(/^\s*\d+[.)]\s*/, "").trim()).filter(Boolean).slice(0, 30);
    if (!checklistItems.length) return null;
    const width = Math.max(440, Math.min(620, 390 + Math.round(Math.max(...checklistItems.map(entry => entry.length), 0) * 2.4)));
    const charsPerLine = Math.max(24, Math.floor((width - 76) / (16 * 0.54)));
    const rowsHeight = checklistItems.reduce((height, entry) => height + Math.max(28, Math.ceil(entry.length / charsPerLine) * 22 + 6), 0);
    const height = Math.max(190, Math.ceil(rowsHeight + 16 * 5.8));
    return {
      id: createId(), kind: "checklist", x: center.x - width / 2, y: center.y - height / 2, width, height,
      text: "Список", checklistItems, checklistDone: Array(checklistItems.length).fill(false),
      fontSize: 16, color: "#5355c9",
    };
  }
  return {
    id: createId(), kind: "shape", x: center.x - 100, y: center.y - 70, width: 200, height: 140,
    text, shapeType: command.shape, color: "#5355c9", fontSize: 18,
  };
}

export function boardItemBounds(items: Item[]): { x: number; y: number; width: number; height: number } | null {
  if (!items.length) return null;
  const left = Math.min(...items.map(item => item.x));
  const top = Math.min(...items.map(item => item.y));
  const right = Math.max(...items.map(item => item.x + item.width));
  const bottom = Math.max(...items.map(item => item.y + item.height));
  return { x: left, y: top, width: Math.max(1, right - left), height: Math.max(1, bottom - top) };
}
