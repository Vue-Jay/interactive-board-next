import type { BoardActivityEntry } from "./historyStore";
import type { Item, Point, ShapeType } from "./boardModel";
import type { ChartStyle } from "./LektrusDataChart";

export type BoardAssistantCommand =
  | { kind: "help" }
  | { kind: "analyze" }
  | { kind: "history" }
  | { kind: "undo" }
  | { kind: "redo" }
  | { kind: "find"; query: string }
  | { kind: "rename"; query: string; text: string }
  | { kind: "delete"; query: string }
  | { kind: "duplicate"; query: string }
  | { kind: "move"; query: string; direction: "left" | "right" | "up" | "down" | "center" }
  | { kind: "resize"; query: string; direction: "larger" | "smaller" | "wider" | "narrower" | "taller" | "shorter"; percent: number }
  | { kind: "rotate"; query: string; degrees: number }
  | { kind: "reset-rotation"; query: string }
  | { kind: "layer"; query: string; direction: "front" | "back" | "forward" | "backward" }
  | { kind: "lock" | "unlock" | "hide" | "show" | "group" | "ungroup"; query: string }
  | { kind: "align"; query: string; direction: "left" | "center-x" | "right" | "top" | "center-y" | "bottom" }
  | { kind: "distribute"; query: string; axis: "x" | "y" }
  | { kind: "equalize"; query: string; axis: "width" | "height" | "both" }
  | { kind: "create-sticky"; text: string }
  | { kind: "create-text"; text: string }
  | { kind: "create-checklist"; text: string }
  | { kind: "create-formula"; text: string }
  | { kind: "create-table"; text: string }
  | { kind: "create-chart"; text: string; title: string; chartStyle: ChartStyle }
  | { kind: "create-quiz"; question: string; options: string[]; correct: number; explanation: string }
  | { kind: "create-flashcard"; front: string; back: string }
  | { kind: "create-comment"; text: string }
  | { kind: "create-fraction"; numerator: number; denominator: number; mode: "circle" | "bar" }
  | { kind: "create-linkmedia"; url: string; title: string }
  | { kind: "create-frame"; text: string }
  | { kind: "create-shape"; shape: ShapeType; text: string }
  | { kind: "create-graph"; expression: string; title: string }
  | { kind: "create-instrument"; instrumentType: "ruler" | "triangle" | "protractor" }
  | { kind: "create-cover" }
  | { kind: "create-connector"; text: string }
  | { kind: "create-ink"; tool: "pen" | "marker"; direction: "horizontal" | "vertical" | "diagonal" }
  | { kind: "pick-media"; mediaType: "image" | "pdf" }
  | { kind: "unknown" };

const commandPrefix = /^(?:пожалуйста\s+)?(?:создай|добавь|размести|нарисуй|напиши|вставь)\s+/i;
const shapeNames: [RegExp, ShapeType][] = [
  [/прямоугольн[а-яё]*\s+треугольник[а-яё]*/i, "rightTriangle"], [/скругл[её]нн[а-яё]*\s+прямоугольник[а-яё]*/i, "rounded"],
  [/параллелограмм/i, "parallelogram"], [/трапец/i, "trapezoid"], [/пятиугольник/i, "pentagon"], [/шестиугольник/i, "hexagon"],
  [/круг|окружност/i, "circle"], [/эллипс/i, "ellipse"], [/квадрат/i, "square"],
  [/прямоугольник/i, "rectangle"], [/треугольник/i, "triangle"], [/ромб/i, "diamond"],
  [/звезд/i, "star"], [/стрелк/i, "arrow"],
];

function cleanPayload(input: string): string {
  return input
    .replace(commandPrefix, "")
    .replace(/^(?:заметку|стикер|записку|текст|надпись|фигуру|формул[а-яё]*|форму|список|таблиц[а-яё]*|фрейм[а-яё]*)\s*/i, "")
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
  const showHidden = value.match(/^(?:покажи|восстанови|отобрази)\s+(?:скрыт(?:ый|ую|ое|ые)\s+)?(.+)$/iu);
  if (showHidden && /скрыт|восстанови|отобрази/i.test(value)) return { kind: "show", query: showHidden[1].trim() };
  const hide = value.match(/^(?:скрой|спрячь)\s+(.+)$/iu);
  if (hide) return { kind: "hide", query: hide[1].trim() };
  const lock = value.match(/^(заблокируй|разблокируй)\s+(.+)$/iu);
  if (lock) return { kind: lock[1].toLocaleLowerCase("ru-RU") === "заблокируй" ? "lock" : "unlock", query: lock[2].trim() };
  const resetRotation = value.match(/^(?:сбрось|обнули)\s+поворот\s+(?:у\s+)?(.+)$/iu);
  if (resetRotation) return { kind: "reset-rotation", query: resetRotation[1].trim() };
  const rotate = value.match(/^поверни\s+(.+?)\s+(?:(?:на\s+)?(\d{1,3})\s*(?:градус(?:а|ов)?|°)?\s*)?(вправо|по\s+часовой|влево|против\s+часовой)?$/iu);
  if (rotate) return { kind: "rotate", query: rotate[1].trim(), degrees: Math.max(1, Math.min(360, Number(rotate[2] ?? 90))) * (/влево|против\s+часовой/iu.test(rotate[3] ?? "") ? -1 : 1) };
  const layer = value.match(/^(?:перемести|подними|опусти)\s+(.+?)\s+(?:на\s+)?(передний|задний|слой\s+впер[её]д|слой\s+назад)\s+план(?:\s|$)|^(?:перемести|подними|опусти)\s+(.+?)\s+на\s+слой\s+(впер[её]д|назад)$/iu);
  if (layer) {
    const query = (layer[1] ?? layer[3]).trim();
    const direction = /передний/iu.test(layer[2] ?? "") ? "front" : /задний/iu.test(layer[2] ?? "") ? "back" : /впер[её]д/iu.test(layer[2] ?? layer[4] ?? "") ? "forward" : "backward";
    return { kind: "layer", query, direction };
  }
  const align = value.match(/^выровняй\s+(.+?)\s+(?:по\s+)?(левому\s+краю|правому\s+краю|верхнему\s+краю|нижнему\s+краю|центру\s+по\s+горизонтали|центрам\s+по\s+горизонтали|центру\s+по\s+вертикали|центрам\s+по\s+вертикали)$/iu);
  if (align) {
    const edge = align[2].toLocaleLowerCase("ru-RU");
    return { kind: "align", query: align[1].trim(), direction: /левому/iu.test(edge) ? "left" : /правому/iu.test(edge) ? "right" : /верхнему/iu.test(edge) ? "top" : /нижнему/iu.test(edge) ? "bottom" : /горизонтали/iu.test(edge) ? "center-x" : "center-y" };
  }
  const distribute = value.match(/^распредели\s+(.+?)\s+(?:равномерно\s+)?по\s+(горизонтали|вертикали)$/iu);
  if (distribute) return { kind: "distribute", query: distribute[1].trim(), axis: /горизонтали/iu.test(distribute[2]) ? "x" : "y" };
  const equalize = value.match(/^сделай\s+(?:одинаков(?:ую|ый)\s+)?(ширину|высоту|размер)\s+(?:у\s+)?(.+)$/iu);
  if (equalize) return { kind: "equalize", query: equalize[2].trim(), axis: equalize[1] === "ширину" ? "width" : equalize[1] === "высоту" ? "height" : "both" };
  const ungroup = value.match(/^(?:разгруппируй|разъедини\s+группу)\s+(.+)$/iu);
  if (ungroup) return { kind: "ungroup", query: ungroup[1].trim() };
  const group = value.match(/^(?:сгруппируй|объедини\s+в\s+группу)\s+(.+)$/iu);
  if (group) return { kind: "group", query: group[1].trim() };
  const rename = value.match(/^(?:переименуй|измени название|измени текст(?: объекта)?)\s+(.+?)\s+(?:в|на)\s+[«"']?(.+?)[»"']?$/i);
  if (rename) return { kind: "rename", query: rename[1].trim(), text: rename[2].trim() };
  const duplicate = value.match(/^(?:дублируй|дублировать|скопируй|сделай копию(?: объекта)?)\s+(.+)$/i);
  if (duplicate) return { kind: "duplicate", query: duplicate[1].trim() };
  const resizeVerb = value.match(/^(увеличь|уменьши|расширь|сузь)\s+(.+?)(?:\s+на\s+(\d{1,3})\s*%?)?$/iu);
  if (resizeVerb) return {
    kind: "resize",
    query: resizeVerb[2].trim().replace(/^(?:заметк[а-яё]*|стикер[а-яё]*|записк[а-яё]*|формул[а-яё]*|таблиц[а-яё]*|диаграмм[а-яё]*|график[а-яё]*|текст[а-яё]*|надпис[а-яё]*|фигур[а-яё]*|спис[а-яё]*|карточ[а-яё]*|тест[а-яё]*|вопрос[а-яё]*|задан[а-яё]*|задач[а-яё]*|упражнен[а-яё]*|материал[а-яё]*)(?:\s+|$)/iu, ""),
    direction: /увеличь/iu.test(resizeVerb[1]) ? "larger" : /уменьши/iu.test(resizeVerb[1]) ? "smaller" : /расширь/iu.test(resizeVerb[1]) ? "wider" : "narrower",
    percent: Math.max(5, Math.min(300, Number(resizeVerb[3] ?? 25))),
  };
  const resizePhrase = value.match(/^сделай\s+(.+?)\s+(шире|уже|выше|ниже|больше|меньше)(?:\s+на\s+(\d{1,3})\s*%?)?$/iu);
  if (resizePhrase) return {
    kind: "resize",
    query: resizePhrase[1].trim().replace(/^(?:заметк[а-яё]*|стикер[а-яё]*|записк[а-яё]*|формул[а-яё]*|таблиц[а-яё]*|диаграмм[а-яё]*|график[а-яё]*|текст[а-яё]*|надпис[а-яё]*|фигур[а-яё]*|спис[а-яё]*|карточ[а-яё]*|тест[а-яё]*|вопрос[а-яё]*|задан[а-яё]*|задач[а-яё]*|упражнен[а-яё]*|материал[а-яё]*)(?:\s+|$)/iu, ""),
    direction: ({ "шире": "wider", "уже": "narrower", "выше": "taller", "ниже": "shorter", "больше": "larger", "меньше": "smaller" } as const)[resizePhrase[2].toLocaleLowerCase("ru-RU") as "шире" | "уже" | "выше" | "ниже" | "больше" | "меньше"],
    percent: Math.max(5, Math.min(300, Number(resizePhrase[3] ?? 25))),
  };
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
      .replace(/^(?:заметк[а-яё]*|стикер[а-яё]*|записк[а-яё]*|текст[а-яё]*|надпис[а-яё]*|фигур[а-яё]*|спис[а-яё]*|чек.?лист[а-яё]*|карточ[а-яё]*|тест[а-яё]*|вопрос[а-яё]*|задан[а-яё]*|задач[а-яё]*|упражнен[а-яё]*|материал[а-яё]*)\s+/i, "")
      .replace(/^(?:по теме|на тему)\s+/i, "")
      .replace(/[?!.,]+$/g, "").trim();
    return query ? { kind: "find", query } : { kind: "analyze" };
  }
  if (/(?:проанализируй|анализ|сводка|обзор|содержимое|что есть на доске|что на доске|все элементы|перечисли элементы|покажи все элементы)/i.test(value)) return { kind: "analyze" };

  const mediaPick = value.match(/^(?:пожалуйста\s+)?(?:создай|добавь|вставь|загрузи|прикрепи)\s+(?:на доску\s+)?(изображение|картинк[а-яё]*|фото|снимок|pdf|документ)(?:\s+на доску)?\s*$/i);
  if (mediaPick) return { kind: "pick-media", mediaType: /^(?:pdf|документ)$/i.test(mediaPick[1]) ? "pdf" : "image" };

  if (commandPrefix.test(value)) {
    const quiz = value.match(/^(?:создай|добавь)\s+(?:викторин[а-яё]*|вопрос\s+с\s+вариантами)\s*[:—–-]\s*(.+)$/i);
    if (quiz) {
      const parts = quiz[1].split(/[;\n]+/).map(part => part.trim()).filter(Boolean);
      const question = parts.shift()?.replace(/^вопрос\s*:\s*/i, "").trim() ?? "";
      const options: string[] = [];
      let answer = "";
      let explanation = "";
      for (const part of parts) {
        const answerMatch = part.match(/^(?:верный\s+ответ|ответ|правильный)\s*[:—–-]\s*(.+)$/i);
        const explanationMatch = part.match(/^(?:пояснение|объяснение)\s*[:—–-]\s*(.+)$/i);
        if (answerMatch) answer = answerMatch[1].trim();
        else if (explanationMatch) explanation = explanationMatch[1].trim();
        else options.push(part.replace(/^(?:[A-FА-Е]|\d+)[.)]\s*/i, "").trim());
      }
      const correctByIndex = /^\d+$/.test(answer) ? Number(answer) - 1 : -1;
      const correctByText = options.findIndex(option => normalizeSearch(option) === normalizeSearch(answer));
      return { kind: "create-quiz", question, options, correct: correctByIndex >= 0 ? correctByIndex : correctByText, explanation };
    }
    const flashcard = value.match(/^(?:создай|добавь)\s+(?:карточку\s+(?:для\s+повторения|вопрос-ответ)|карточку)\s*[:—–-]\s*(.+)$/i);
    if (flashcard) {
      const [front = "", ...backParts] = flashcard[1].split(/\s*(?:\||=>|→)\s*/);
      return { kind: "create-flashcard", front: front.trim(), back: backParts.join(" | ").trim() };
    }
    const fraction = value.match(/^(?:создай|добавь)\s+(?:(круговую|ленточную)\s+)?дроб(?:ь|ную\s+модель)\s*[:—–-]?\s*(\d{1,4})\s*[/÷]\s*(\d{1,4})$/i);
    if (fraction) return { kind: "create-fraction", numerator: Number(fraction[2]), denominator: Number(fraction[3]), mode: /круг/i.test(fraction[1] ?? "") ? "circle" : "bar" };
    const comment = value.match(/^(?:создай|добавь)\s+комментарий\s*[:—–-]\s*(.+)$/i);
    if (comment) return { kind: "create-comment", text: comment[1].trim() };
    const media = value.match(/^(?:создай|добавь|вставь)\s+(?:медиа|видео|аудио|ссылку)\s*[:—–-]\s*(.+)$/i);
    if (media) {
      const parts = media[1].split("|").map(part => part.trim());
      const url = parts.length > 1 ? parts.at(-1) ?? "" : parts[0] ?? "";
      const title = parts.length > 1 ? parts.slice(0, -1).join(" | ") : "";
      return { kind: "create-linkmedia", url, title };
    }
  }

  // Task creation is handled by the curriculum generator below. Do not let a
  // topic word such as "круг" steal a request like "создай задание на площадь круга".
  if (commandPrefix.test(value) && /^(?:создай|добавь|размести|нарисуй|напиши|вставь)\s+(?:\d+\s+)?(?:задач|упражнен|задан|тест|карточ|викторин)/i.test(value)) return { kind: "unknown" };
  if (commandPrefix.test(value)) {
    const graph = value.match(/^(?:создай|добавь)\s+(?:график(?:\s+функции)?|функцию)\s*[:—–-]\s*(.+)$/i);
    if (graph) {
      const expression = graph[1].trim().replace(/^[yу]\s*=\s*/i, "").replaceAll("²", "^2").replaceAll("×", "*").slice(0, 160);
      if (expression && /^[\da-zа-яёx()+\-*/^.,\s]+$/i.test(expression)) return { kind: "create-graph", expression, title: `График y = ${expression}` };
    }
    const connector = value.match(/^(?:создай|добавь)\s+(?:стрелку|связь|соединитель)\s*[:—–-]\s*(.+)$/i);
    if (connector) return { kind: "create-connector", text: connector[1].trim().slice(0, 120) };
    const instrument = value.match(/^(?:создай|добавь|размести)\s+(линейку|транспортир|угольник)\s*$/i);
    if (instrument) return { kind: "create-instrument", instrumentType: /транспортир/i.test(instrument[1]) ? "protractor" : /угольник/i.test(instrument[1]) ? "triangle" : "ruler" };
    if (/^(?:создай|добавь|размести)\s+шторк[ауи]?\s*$/i.test(value)) return { kind: "create-cover" };
    const ink = value.match(/^нарисуй\s+(?:линию|штрих)(?:\s+(карандашом|маркером))?(?:\s*[:—–-]\s*(горизонтальн[а-яё]*|вертикальн[а-яё]*|диагональн[а-яё]*))?\s*$/i);
    if (ink) return { kind: "create-ink", tool: /маркером/i.test(ink[1] ?? "") ? "marker" : "pen", direction: /вертикальн/i.test(ink[2] ?? "") ? "vertical" : /диагональн/i.test(ink[2] ?? "") ? "diagonal" : "horizontal" };
    const chart = value.match(/^(?:создай|добавь)\s+(?:(столбчатую|круговую|линейную)\s+)?диаграмму(?:\s+([^:—–-]+?))?\s*[:—–-]\s*(.+)$/i);
    if (chart) return {
      kind: "create-chart",
      chartStyle: /круговую/i.test(chart[1] ?? "") ? "pie" : /линейную/i.test(chart[1] ?? "") ? "line" : "bar",
      title: chart[2]?.trim() || "Диаграмма",
      text: chart[3].trim(),
    };
    if (/формул/i.test(value)) return { kind: "create-formula", text: cleanPayload(value) };
    if (/таблиц/i.test(value)) return { kind: "create-table", text: cleanPayload(value) };
    if (/фрейм|рамк/i.test(value)) return { kind: "create-frame", text: cleanPayload(value) };
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
const ignoredSearchFields = /^(?:id|assetId|boardId|points|graphPoints|ink|imageCrop|connectorStart|connectorEnd|imageData|thumbnail|base64|blob|binary|previewData|rawData|pathData)$/i;

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

const ignoredQueryWords = new Set(["найди", "найти", "покажи", "пожалуйста", "объект", "объекты", "элемент", "элементы", "все", "всё", "весь", "всех", "вся", "заметку", "заметка", "стикер", "стикеры", "записку", "текст", "карточку", "доска", "доске", "этой", "на", "в", "и", "или", "по", "про", "скрытый", "скрытая", "скрытое", "скрытые"]);
const itemKindSearchAliases: Partial<Record<Item["kind"], string>> = {
  sticky: "заметка заметки стикер стикеры записка записки",
  text: "текст надпись надписи",
  shape: "фигура фигуры",
  pen: "карандаш линия штрих рисунок",
  marker: "маркер линия штрих выделение",
  cover: "шторка занавеска",
  instrument: "инструмент линейка транспортир угольник",
  fraction: "дробь дробная модель",
  graph: "график график функции",
  connector: "стрелка связь соединитель",
};
const instrumentTypeSearchAliases: Record<NonNullable<Item["instrumentType"]>, string> = {
  ruler: "линейка",
  triangle: "угольник линейка",
  protractor: "транспортир",
};

export function findBoardItems(items: Item[], query: string): Item[] {
  const terms = normalizeSearch(query).match(/[а-яa-z0-9]+/giu)?.filter(word => (word.length > 2 || /^\d{1,4}$/u.test(word)) && !ignoredQueryWords.has(word)) ?? [];
  if (!terms.length) return [];
  return items.filter(item => {
    const searchable: string[] = [];
    flattenStrings(item, searchable, new Set(), { chars: 0 });
    searchable.push(itemKindSearchAliases[item.kind] ?? "");
    if (item.kind === "instrument" && item.instrumentType) searchable.push(instrumentTypeSearchAliases[item.instrumentType]);
    const text = normalizeSearch(searchable.join(" "));
    return terms.every(term => {
      if (text.includes(term)) return true;
      const prefix = term.slice(0, Math.min(4, term.length));
      return text.split(/[^а-яa-z0-9]+/u).some(word => word.startsWith(prefix));
    });
  });
}

export type BoardAssistantMutationCommand = Extract<BoardAssistantCommand, { kind:
  | "rename" | "move" | "resize" | "delete" | "duplicate" | "rotate" | "reset-rotation" | "layer"
  | "lock" | "unlock" | "hide" | "show" | "group" | "ungroup" | "align" | "distribute" | "equalize"
}>;
export type BoardAssistantMutationResult = {
  status: "not-found" | "confirmation-required" | "changed" | "needs-more" | "unsupported";
  items: Item[];
  matches: Item[];
  selectedIds: string[];
  bounds: ReturnType<typeof boardItemBounds>;
};

/** Applies a board-item command as one immutable update; destructive deletes require explicit confirmation. */
export function applyBoardAssistantMutation(
  items: Item[],
  command: BoardAssistantMutationCommand,
  options: { confirmed?: boolean; center?: Point; createId?: () => string } = {},
): BoardAssistantMutationResult {
  const foundMatches = findBoardItems(items.filter(item => command.kind === "show" ? item.hidden : !item.hidden), command.query);
  const matches = foundMatches.filter(item =>
    (command.kind === "unlock" || !item.locked)
    && (!(command.kind === "rotate" || command.kind === "reset-rotation") || item.kind !== "connector"),
  );
  const selectedIds = matches.map(item => item.id);
  if (!matches.length) return { status: foundMatches.length ? "unsupported" : "not-found", items, matches: foundMatches, selectedIds: [], bounds: boardItemBounds(foundMatches) };
  if (command.kind === "delete" && !options.confirmed) {
    return { status: "confirmation-required", items, matches, selectedIds, bounds: boardItemBounds(matches) };
  }

  const ids = new Set(selectedIds);
  let nextItems: Item[];
  if (command.kind === "hide" || command.kind === "show") {
    nextItems = items.map(item => ids.has(item.id) ? { ...item, hidden: command.kind === "hide" } : item);
  } else if (command.kind === "lock" || command.kind === "unlock") {
    const lockable = matches.filter(item => item.kind !== "pen" && item.kind !== "marker");
    if (!lockable.length) return { status: "unsupported", items, matches, selectedIds, bounds: boardItemBounds(matches) };
    const lockIds = new Set(lockable.map(item => item.id));
    nextItems = items.map(item => lockIds.has(item.id) ? { ...item, locked: command.kind === "lock" } : item);
  } else if (command.kind === "group") {
    if (matches.length < 2) return { status: "needs-more", items, matches, selectedIds, bounds: boardItemBounds(matches) };
    const groupId = globalThis.crypto?.randomUUID?.() ?? `ai-group-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    nextItems = items.map(item => ids.has(item.id) ? { ...item, groupId } : item);
  } else if (command.kind === "ungroup") {
    const groupIds = new Set(matches.map(item => item.groupId).filter((id): id is string => !!id));
    if (!groupIds.size) return { status: "unsupported", items, matches, selectedIds, bounds: boardItemBounds(matches) };
    const affected = new Set(items.filter(item => item.groupId && groupIds.has(item.groupId)).map(item => item.id));
    nextItems = items.map(item => affected.has(item.id) ? { ...item, groupId: undefined } : item);
  } else if (command.kind === "align" || command.kind === "distribute" || command.kind === "equalize") {
    const minimum = command.kind === "distribute" ? 3 : 2;
    if (matches.length < minimum) return { status: "needs-more", items, matches, selectedIds, bounds: boardItemBounds(matches) };
    if (command.kind === "align") {
      const bounds = boardItemBounds(matches)!;
      nextItems = items.map(item => {
        if (!ids.has(item.id)) return item;
        if (command.direction === "left") return { ...item, x: bounds.x };
        if (command.direction === "center-x") return { ...item, x: bounds.x + (bounds.width - item.width) / 2 };
        if (command.direction === "right") return { ...item, x: bounds.x + bounds.width - item.width };
        if (command.direction === "top") return { ...item, y: bounds.y };
        if (command.direction === "center-y") return { ...item, y: bounds.y + (bounds.height - item.height) / 2 };
        return { ...item, y: bounds.y + bounds.height - item.height };
      });
    } else if (command.kind === "equalize") {
      const reference = matches[0];
      nextItems = items.map(item => !ids.has(item.id) ? item : {
        ...item,
        ...(command.axis === "width" || command.axis === "both" ? { width: reference.width } : {}),
        ...(command.axis === "height" || command.axis === "both" ? { height: reference.height } : {}),
      });
    } else {
      const sorted = [...matches].sort((a, b) => command.axis === "x" ? a.x - b.x : a.y - b.y);
      const first = sorted[0], last = sorted[sorted.length - 1];
      const totalSize = sorted.reduce((sum, item) => sum + (command.axis === "x" ? item.width : item.height), 0);
      const span = command.axis === "x" ? last.x + last.width - first.x : last.y + last.height - first.y;
      const gap = (span - totalSize) / (sorted.length - 1);
      let cursor = command.axis === "x" ? first.x : first.y;
      const positions = new Map<string, number>();
      for (const item of sorted) {
        positions.set(item.id, cursor);
        cursor += (command.axis === "x" ? item.width : item.height) + gap;
      }
      nextItems = items.map(item => {
        const position = positions.get(item.id);
        if (position == null) return item;
        return command.axis === "x" ? { ...item, x: position } : { ...item, y: position };
      });
    }
  } else if (command.kind === "layer") {
    const chosen = items.filter(item => ids.has(item.id));
    const rest = items.filter(item => !ids.has(item.id));
    if (command.direction === "front") nextItems = [...rest, ...chosen];
    else if (command.direction === "back") nextItems = [...chosen, ...rest];
    else {
      nextItems = [...items];
      const forward = command.direction === "forward";
      if (forward) {
        for (let i = nextItems.length - 2; i >= 0; i--) if (ids.has(nextItems[i].id) && !ids.has(nextItems[i + 1].id)) [nextItems[i], nextItems[i + 1]] = [nextItems[i + 1], nextItems[i]];
      } else {
        for (let i = 1; i < nextItems.length; i++) if (ids.has(nextItems[i].id) && !ids.has(nextItems[i - 1].id)) [nextItems[i], nextItems[i - 1]] = [nextItems[i - 1], nextItems[i]];
      }
    }
  } else if (command.kind === "delete") {
    nextItems = items.filter(item => !ids.has(item.id));
  } else if (command.kind === "duplicate") {
    const createId = options.createId ?? (() => globalThis.crypto?.randomUUID?.()
      ?? `ai-copy-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`);
    const clones = matches.map((item, index) => ({
      ...structuredClone(item),
      id: createId(),
      x: item.x + 40 + (index % 4) * 12,
      y: item.y + 40 + (index % 4) * 12,
    }));
    nextItems = [...items, ...clones];
    const bounds = boardItemBounds(clones);
    return { status: "changed", items: nextItems, matches, selectedIds: clones.map(item => item.id), bounds };
  } else if (command.kind === "resize") {
    const factor = command.direction === "larger" || command.direction === "wider" || command.direction === "taller"
      ? 1 + command.percent / 100
      : Math.max(0.1, 1 - command.percent / 100);
    nextItems = items.map(item => {
      if (!ids.has(item.id)) return item;
      const widthFactor = command.direction === "wider" || command.direction === "narrower" ? factor : command.direction === "larger" || command.direction === "smaller" ? factor : 1;
      const heightFactor = command.direction === "taller" || command.direction === "shorter" ? factor : command.direction === "larger" || command.direction === "smaller" ? factor : 1;
      const width = Math.max(24, Math.min(4000, item.width * widthFactor));
      const height = Math.max(24, Math.min(4000, item.height * heightFactor));
      const actualWidthFactor = width / item.width;
      const actualHeightFactor = height / item.height;
      const centerX = item.x + item.width / 2;
      const centerY = item.y + item.height / 2;
      return {
        ...item,
        width,
        height,
        x: centerX - width / 2,
        y: centerY - height / 2,
        ...((item.kind === "pen" || item.kind === "marker") && item.points
          ? { points: item.points.map(point => ({ x: point.x * actualWidthFactor, y: point.y * actualHeightFactor })) }
          : {}),
        ...(item.kind === "connector" && item.connectorStart && item.connectorEnd
          ? {
              connectorStart: { x: item.connectorStart.x * actualWidthFactor, y: item.connectorStart.y * actualHeightFactor },
              connectorEnd: { x: item.connectorEnd.x * actualWidthFactor, y: item.connectorEnd.y * actualHeightFactor },
            }
          : {}),
      };
    });
  } else if (command.kind === "rotate" || command.kind === "reset-rotation") {
    const degrees = command.kind === "rotate" ? command.degrees : 0;
    const bounds = boardItemBounds(matches)!;
    const cx = bounds.x + bounds.width / 2, cy = bounds.y + bounds.height / 2;
    const rad = degrees * Math.PI / 180, cos = Math.cos(rad), sin = Math.sin(rad);
    nextItems = items.map(item => {
      if (!ids.has(item.id)) return item;
      if (command.kind === "reset-rotation") return { ...item, rotation: 0 };
      if (item.kind === "connector") return item;
      if (matches.length === 1) return { ...item, rotation: (((item.rotation ?? 0) + degrees) % 360 + 360) % 360 };
      const ox = item.x + item.width / 2 - cx, oy = item.y + item.height / 2 - cy;
      const ncx = cx + ox * cos - oy * sin, ncy = cy + ox * sin + oy * cos;
      return { ...item, x: ncx - item.width / 2, y: ncy - item.height / 2, rotation: (((item.rotation ?? 0) + degrees) % 360 + 360) % 360 };
    });
  } else if (command.kind === "rename") {
    nextItems = items.map(item => {
      if (!ids.has(item.id)) return item;
      if (item.kind === "image" || item.kind === "pdf") return { ...item, name: command.text };
      if (item.kind === "linkmedia") return { ...item, mediaTitle: command.text };
      if (item.kind === "table") return { ...item, name: command.text };
      return { ...item, text: command.text };
    });
  } else if (command.kind === "move") {
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
  } else return { status: "unsupported", items, matches, selectedIds, bounds: boardItemBounds(matches) };
  const changedItems = nextItems.filter(item => ids.has(item.id));
  const hiddenResult = command.kind === "hide";
  return { status: "changed", items: nextItems, matches, selectedIds: hiddenResult ? [] : selectedIds, bounds: boardItemBounds(changedItems) };
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
  command: Extract<BoardAssistantCommand, { kind: "create-sticky" | "create-text" | "create-checklist" | "create-formula" | "create-table" | "create-chart" | "create-quiz" | "create-flashcard" | "create-comment" | "create-fraction" | "create-linkmedia" | "create-frame" | "create-shape" | "create-graph" | "create-instrument" | "create-cover" | "create-connector" | "create-ink" }>,
  center: Point,
  createId: () => string,
): Item | null {
  const wrappedLineCount = (value: string, width: number) => value.split(/\r?\n/).reduce((sum, line) =>
    sum + Math.max(1, Math.ceil(line.length / width)), 0);
  if (command.kind === "create-graph") {
    const expression = command.expression.trim();
    if (!expression || !/^[\da-zа-яёx()+\-*/^.,\s]+$/i.test(expression)) return null;
    const graphType: NonNullable<Item["graphType"]> = /sin\s*\(/i.test(expression) ? "sin" : /cos\s*\(/i.test(expression) ? "cos" : /(?:\^\s*2|\bx\s*\*\s*x\b)/i.test(expression) ? "quadratic" : "linear";
    const width = 560, height = 420;
    return { id: createId(), kind: "graph", x: center.x - width / 2, y: center.y - height / 2, width, height,
      text: command.title.slice(0, 100), graphPurpose: "function", graphType, graphExpression: expression,
      graphShowCurve: true, graphAxisMode: "both", graphGrid: true, graphShowLabels: true,
      graphXMin: graphType === "sin" || graphType === "cos" ? -7 : -10, graphXMax: graphType === "sin" || graphType === "cos" ? 7 : 10,
      graphYMin: graphType === "sin" || graphType === "cos" ? -2 : -10, graphYMax: graphType === "sin" || graphType === "cos" ? 2 : 10,
      graphA: 1, graphB: 0, graphC: 0, color: "#3158c9" };
  }
  if (command.kind === "create-instrument") {
    const dimensions = command.instrumentType === "ruler" ? [410, 88] : command.instrumentType === "triangle" ? [340, 260] : [360, 205];
    const [width, height] = dimensions;
    return { id: createId(), kind: "instrument", x: center.x - width / 2, y: center.y - height / 2, width, height,
      text: "", instrumentType: command.instrumentType, instrumentScale: 1, rotation: 0 };
  }
  if (command.kind === "create-cover") {
    const width = 360, height = 220;
    return { id: createId(), kind: "cover", x: center.x - width / 2, y: center.y - height / 2, width, height,
      text: "", coverOpen: false, coverOpacity: 1, color: "#3158c9" };
  }
  if (command.kind === "create-connector") {
    const width = 260, height = 40;
    return { id: createId(), kind: "connector", x: center.x - width / 2, y: center.y - height / 2, width, height,
      text: command.text.trim().slice(0, 120), connectorStart: { x: 12, y: height / 2 }, connectorEnd: { x: width - 16, y: height / 2 },
      connectorStyle: "arrow", connectorRouting: "straight", color: "#3158c9", weight: 3 };
  }
  if (command.kind === "create-ink") {
    const half = 120;
    const points = command.direction === "vertical"
      ? [{ x: center.x, y: center.y - half }, { x: center.x, y: center.y + half }]
      : command.direction === "diagonal"
        ? [{ x: center.x - half, y: center.y + half }, { x: center.x + half, y: center.y - half }]
        : [{ x: center.x - half, y: center.y }, { x: center.x + half, y: center.y }];
    const weight = command.tool === "marker" ? 18 : 4;
    const color = command.tool === "marker" ? "#ed8734" : "#253a64";
    const x = Math.min(...points.map(point => point.x)) - weight / 2;
    const y = Math.min(...points.map(point => point.y)) - weight / 2;
    const width = Math.max(weight, Math.max(...points.map(point => point.x)) - Math.min(...points.map(point => point.x)) + weight);
    const height = Math.max(weight, Math.max(...points.map(point => point.y)) - Math.min(...points.map(point => point.y)) + weight);
    return { id: createId(), kind: command.tool, x, y, width, height, text: "", color, weight,
      points: points.map(point => ({ x: point.x - x, y: point.y - y })) };
  }
  if (command.kind === "create-quiz") {
    if (!command.question.trim() || command.options.length < 2 || command.options.length > 6
      || command.options.some(option => !option.trim()) || command.correct < 0 || command.correct >= command.options.length) return null;
    const width = 500;
    const questionLines = wrappedLineCount(command.question, 48);
    const optionLines = command.options.reduce((sum, option) => sum + wrappedLineCount(option, 54), 0);
    const height = Math.max(300, Math.min(620, 170 + questionLines * 26 + optionLines * 22));
    return {
      id: createId(), kind: "quiz", x: center.x - width / 2, y: center.y - height / 2, width, height,
      text: command.question.slice(0, 1500), quizOptions: command.options.map(option => option.slice(0, 500)),
      quizCorrect: command.correct, quizSelected: -1, quizRevealed: false,
      quizExplanation: command.explanation.slice(0, 1200), fontSize: 16, color: "#5355c9",
    };
  }
  if (command.kind === "create-flashcard") {
    const front = command.front.trim().slice(0, 1500), back = command.back.trim().slice(0, 2000);
    if (!front || !back) return null;
    const width = Math.max(360, Math.min(620, 300 + Math.max(front.length, back.length) * 2.2));
    const height = Math.max(250, Math.min(460, 190 + Math.ceil(Math.max(front.length, back.length) / 42) * 28));
    return {
      id: createId(), kind: "flashcard", x: center.x - width / 2, y: center.y - height / 2, width, height,
      text: front, flashcardBack: back, flashcardFlipped: false, fontSize: 18, color: "#5355c9",
    };
  }
  if (command.kind === "create-comment") {
    const text = command.text.trim().slice(0, 1200);
    if (!text) return null;
    const width = Math.max(280, Math.min(520, 230 + text.length * 1.8));
    const height = Math.max(150, Math.min(360, 120 + Math.ceil(text.length / 44) * 28));
    return { id: createId(), kind: "comment", x: center.x - width / 2, y: center.y - height / 2, width, height, text, color: "#fff8d6" };
  }
  if (command.kind === "create-fraction") {
    if (command.denominator <= 0 || command.numerator > command.denominator || command.denominator > 1000) return null;
    const width = 320, height = 240;
    return {
      id: createId(), kind: "fraction", x: center.x - width / 2, y: center.y - height / 2, width, height,
      text: "Дробная модель", fractionMode: command.mode,
      fractionNumerator: command.numerator, fractionDenominator: command.denominator, color: "#5355c9",
    };
  }
  if (command.kind === "create-linkmedia") {
    try {
      const url = new URL(command.url);
      if (url.protocol !== "https:" && url.protocol !== "http:") return null;
      const width = 480, height = 300;
      return {
        id: createId(), kind: "linkmedia", x: center.x - width / 2, y: center.y - height / 2,
        width, height, text: "", mediaUrl: url.href,
        mediaTitle: command.title.trim().slice(0, 120) || url.hostname.replace(/^www\./i, ""),
      };
    } catch { return null; }
  }
  if (!("text" in command)) return null;
  if (!command.text.trim() && command.kind !== "create-shape") return null;
  const text = command.text.slice(0, 3000);
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
  if (command.kind === "create-formula") return {
    id: createId(), kind: "formula", x: center.x - 240, y: center.y - 80,
    width: Math.max(360, Math.min(720, 80 + text.length * 20)), height: 160,
    text, fontSize: 30, color: "#20242c",
  };
  if (command.kind === "create-table") {
    const rows = text.split(/[\n;]+/).map(row => row.trim()).filter(Boolean).slice(0, 20);
    if (!rows.length) return null;
    const matrix = rows.map(row => row.split(/[\t|]/).map(cell => cell.trim().slice(0, 2000)));
    const cols = Math.min(12, Math.max(1, ...matrix.map(row => row.length)));
    const cells = Array.from({ length: matrix.length * cols }, (_, index) => matrix[Math.floor(index / cols)]?.[index % cols] ?? "");
    const width = Math.max(420, Math.min(960, cols * 190));
    const height = Math.max(180, Math.min(700, matrix.length * 64 + 60));
    return {
      id: createId(), kind: "table", x: center.x - width / 2, y: center.y - height / 2,
      width, height, text: "", name: "Таблица", tableRows: matrix.length, tableCols: cols,
      tableCells: cells, tableHeader: true, tableStripe: true, fontSize: 15, color: "#315bd4",
    };
  }
  if (command.kind === "create-chart") {
    const rows = text.split(/[\n;]+/).map(row => row.trim()).filter(Boolean).slice(0, 12);
    const entries = rows.map(row => {
      const match = row.match(/^(.+?)\s*(?:\||=|:|—|–|-)\s*(\d+(?:[.,]\d+)?)\s*$/);
      if (!match) return null;
      return { label: match[1].trim().slice(0, 80), value: Number(match[2].replace(",", ".")) };
    });
    if (!entries.length || entries.some(entry => !entry || !entry.label || !Number.isFinite(entry.value) || entry.value < 0 || entry.value > 1e9)) return null;
    const width = 480, height = Math.max(320, Math.min(520, 250 + entries.length * 14));
    return {
      id: createId(), kind: "graph", graphFigureId: "lektrus-chart",
      x: center.x - width / 2, y: center.y - height / 2, width, height,
      text: command.title.slice(0, 100), chartStyle: command.chartStyle,
      chartEntries: entries as { label: string; value: number }[], color: "#4774d7",
    };
  }
  if (command.kind === "create-frame") return {
    id: createId(), kind: "frame", x: center.x - 320, y: center.y - 210,
    width: 640, height: 420, text: text || "Новый фрейм", color: "#73798a", presentationOrder: 0,
  };
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
