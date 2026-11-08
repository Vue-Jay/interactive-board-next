import { generateMathAi, type MathAiLevel, type MathAiMode } from "./aiMathGenerator";
import { generateSubjectExercise } from "./aiSubjectExerciseBank";
import { classifyCurriculumSubject } from "./aiSubjectIntentClassifier";
import { LEKTRUS_SCHOOL_SUBJECTS } from "./lektrusSchoolSubjects";

export type CurriculumAiTool = "assignment" | "quiz" | "flashcards";
export type CurriculumAiLevel = "easy" | "medium" | "hard";
export type CurriculumAiResult = { title: string; items: string[]; answers: string[]; subject: string; detected: string };

const topicExamples: Record<string, string> = {
  "": "Например: тема и нужный навык",
  "Математика": "Например: квадратные уравнения",
  "Физика": "Например: закон Ома",
  "Химия": "Например: атомы и реакции",
  "Биология": "Например: клетка или цепь питания",
  "География": "Например: масштаб карты",
  "Русский язык": "Например: -тся и -ться",
  "Литература": "Например: образ героя в произведении",
  "История": "Например: причины и последствия события",
  "Обществознание": "Например: семейный бюджет",
  "Информатика": "Например: алгоритмы с условиями",
  "Иностранный язык": "Например: Past Simple",
};

export function aiTopicPlaceholder(subject = "") {
  return topicExamples[subject] ?? topicExamples[""];
}

const subjectAliases: Record<string, RegExp> = {
  "Математика": /математ|алгебр|геометр|треуголь|окружност|круг|площад|периметр|угол|уравнен|дроб|процент|пифагор|функци|вычислен|арифмет|числ|корень|степен|пропорц|отношени|десятичн|координат|простые числа|простых чисел|синус|косинус|тангенс|тригонометр|логарифм|вероятност|статистик|биномиальн|касательн|прогресси|комбинатор|производн|област.*определен|об[ъь]ем цилиндр|вписанн.*окруж/i,
  "Физика": /физик|скорост|ускорен|равномерн движ|сила|энерги|электр|давлен|теплот|оптик|звук|плотност|закон ом|механик|мощност|работа силы|архимед/i,
  "Химия": /хими|атом|молекул|реакци|раствор|кислот|основан|валент|периодическ|формул веществ|окислен|соль|оксид|энтальпи|диссоциац|гидролиз|гомолог|эфир|амфотер|молярн концентраци/i,
  "Биология": /биолог|клетк|организм|экосистем|генет|растен|животн|кров|орган|фотосинтез|дыхани|пищевар|наследствен|эволюц|митоз|мейоз|митохондр|хромосом|транскрипц|трансляц|нефрон|гамет|симбиоз|паразитизм/i,
  "География": /географ|климат|материк|океан|рельеф|населени|карта|природн зон|масштаб|столиц|река|горн|часов.*пояс|изобар|карст|сол[её]ност океан|демографическ переход|тектоническ платформ|водораздел|агломераци|долгот|атмосферн фронт/i,
  "Русский язык": /русск|орфограф|пунктуац|морфем|часть речи|предложени|синтаксис|суффикс|причаст|тся|ться|падеж|глагол|нареч|приставк|деепричаст|безударн гласн|однородн член|пароним|обособлен|вводн слов|чередован.*корн|лексическ норм|цитирован/i,
  "Литература": /литератур|роман|рассказ|поэ|геро|сюжет|автор|произведени|персонаж|композици|лирик|эпос|драма|басн|аллитерац|ассонанс|романтизм|отцы и дети|пейзаж|трагеди|лирическ геро|антитез|маленьк человек/i,
  "История": /истори|пётр|петр|век|войн|революц|реформ|государств|правлен|цивилизац|древн|средневек|импери|княжеств|историческ источник|тильзит|нэп|избранн рад|распад.*ссср|персидск войн|рюрикович|версальск договор|римск импер|земск собор/i,
  "Обществознание": /обществ|право|эконом|граждан|государств|социал|рынок|семь|бюджет|налог|спрос|предложени|потребност|трудов право|инфляц|валовой внутренний продукт|\bввп\b|монопол|кредит|сбережени/i,
  "Информатика": /информат|алгоритм|программ|код|данн|таблиц|сеть|безопасност|двоичн|цикл|ветвлен|переменн|логическ операц|рекурс|словарь.*python|сложност.*алгоритм|дерев.*поиск|стек.*очеред/i,
  "Иностранный язык": /англий|иностран|english|лексик|грамматик|перевод|времен глагол|past simple|present simple|present continuous|irregular verbs|немецк|французск|испанск|reported speech|пассивн залог|условн предложени|герунди|фразов.*глагол/i,
};

export function detectCurriculumSubject(topic: string, selected = ""): string {
  if (LEKTRUS_SCHOOL_SUBJECTS.includes(selected as typeof LEKTRUS_SCHOOL_SUBJECTS[number])) return selected;
  for (const [subject, pattern] of Object.entries(subjectAliases)) if (pattern.test(topic)) return subject;
  return classifyCurriculumSubject(topic);
}

export type ParsedCurriculumRequest = {
  subject: string;
  topic: string;
  count: number;
  grade: number | null;
  tool: CurriculumAiTool;
  level: CurriculumAiLevel;
  hasCount: boolean;
  hasTool: boolean;
  hasLevel: boolean;
};

const numberWords: Record<string, number> = {
  один: 1, одна: 1, одно: 1, одну: 1, два: 2, две: 2, три: 3, четыре: 4, пять: 5,
  шесть: 6, семь: 7, восемь: 8, девять: 9, десять: 10, одиннадцать: 11, двенадцать: 12,
  тринадцать: 13, четырнадцать: 14, пятнадцать: 15,
};
const countUnits = "шт\\.?|задач[а-яё]*|задани[а-яё]*|вопрос[а-яё]*|пример[а-яё]*|упражнен[а-яё]*|карточ[а-яё]*";
/** Understands natural school requests, e.g. "сделай десять простых задач на треугольники". */
export function parseCurriculumRequest(
  input: string,
  selectedSubject = "",
  selectedCount = 5,
  selectedLevel: CurriculumAiLevel = "medium",
  selectedTool: CurriculumAiTool = "assignment",
): ParsedCurriculumRequest {
  const qty = new RegExp(`(^|\\s)(\\d{1,2}|${Object.keys(numberWords).join("|")})(?:\\s+[а-яё-]+){0,2}\\s+(?:${countUnits})`, "iu");
  const countMatch = input.match(qty);
  const requestedCount = countMatch ? (numberWords[countMatch[2].toLocaleLowerCase("ru-RU")] ?? Number(countMatch[2])) : selectedCount;
  const hasCount = Boolean(countMatch);
  const hasLevel = /(?:прост|л[её]гк|базов|начинающ|сложн|углубл|олимпиад|продвинут|высокий уровень).{0,28}(?:задач|задан|упражнен|тест|карточ|уравнен|уровен)|для начинающ/i.test(input);
  const inferredLevel: CurriculumAiLevel = /сложн|углубл|олимпиад|продвинут|высокий уровень/i.test(input) ? "hard" : "easy";
  let topic = countMatch ? input.replace(qty, " ") : input;
  const gradeMatch = input.match(/(?:для|ученик(?:а|у|ом|ам|и|ов)?\s+|учащимся\s+)(\d{1,2})\s*(?:-?го\s*)?(?:класс[а-яё]*|кл\.?)/i);
  const grade = gradeMatch ? Math.min(11, Math.max(1, Number(gradeMatch[1]))) : null;
  topic = topic
    .replace(/[,:;.!?]+/g, " ")
    .replace(/(?:для|ученик(?:а|у|ом|ам|и|ов)?\s+|учащимся\s+)\d{1,2}\s*(?:-?го\s*)?(?:класс[а-яё]*|кл\.?)/ig, " ")
    .replace(/^\s*(?:(?:пожалуйста|мне|нужно|создай|составь|подготовь|сгенерируй|сделай|дай|хочу|придумай|напиши|подбери|сформируй|сгенерировать|реши|решить|вычисли|найди|объясни|изучи|разбери|расскажи|покажи|тест|теста|викторину|проверочную|контрольную|задания|задачи|упражнения|карточки)\s+)+/i, "")
    .replace(hasLevel ? /^\s*(?:(?:прост(?:ую|ые|ых|ое)|л[её]гк(?:ую|ие|их|ое)|сложн(?:ую|ые|ых|ое)|углублённ[а-яё]*|олимпиадн[а-яё]*|базов[а-яё]*|продвинут[а-яё]*)\s+)+/i : /$^/, "")
    .replace(/^\s*(?:(?:задач[а-яё]*|задани[а-яё]*|упражнен[а-яё]*|тест[а-яё]*|викторин[а-яё]*|карточ[а-яё]*)\s+)+/i, "")
    .replace(/^\s*(?:(?:по теме|на тему|по|на|про|тема|теме)\s+)+/i, "")
    .replace(/\s+/g, " ")
    .trim();
  const toolMatch = /карточк|флеш.?карточ|flash.?card/i.test(input)
    ? "flashcards"
    : /тест|проверочн|контрольн|викторин|quiz|самостоятельн/i.test(input)
      ? "quiz"
      : /задач|упражнен|домашн|практик|задани/i.test(input)
        ? "assignment"
        : null;
  const gradeLevel: CurriculumAiLevel = grade && grade <= 5 ? "easy" : grade && grade >= 9 ? "hard" : "medium";
  return {
    subject: detectCurriculumSubject(topic, selectedSubject),
    topic,
    count: Math.max(1, Math.min(15, Math.round(Number(requestedCount) || selectedCount || 5))),
    grade,
    tool: toolMatch ?? selectedTool,
    level: hasLevel ? inferredLevel : grade ? gradeLevel : selectedLevel,
    hasCount,
    hasTool: Boolean(toolMatch),
    hasLevel,
  };
}

export function generateCurriculumAi(tool: CurriculumAiTool, topic: string, level: CurriculumAiLevel, count: number, selectedSubject = ""): CurriculumAiResult {
  const request = parseCurriculumRequest(topic, selectedSubject, count, level, tool);
  const subject = request.subject;
  const clean = request.topic;
  const safeCount = request.count;
  const effectiveLevel = request.level;
  if (!clean) throw new Error("Укажите тему задания.");
  if (!subject) throw new Error("Не удалось определить предмет. Выберите его в списке.");
  if (subject === "Математика") {
    const mathLevel: MathAiLevel = effectiveLevel === "easy" ? "primary" : effectiveLevel === "hard" ? "advanced" : "basic";
    const math = generateMathAi("auto" as MathAiMode, mathLevel, safeCount, clean, true);
    const gradeLabel = request.grade ? ` · ${request.grade} класс` : "";
    if (tool === "assignment") return { title: `${math.detected} · ${clean}${gradeLabel}`, items: math.items, answers: math.answers, subject, detected: math.detected };
    if (tool === "quiz") return {
      title: `Проверочная работа · Математика · ${clean}${gradeLabel}`,
      items: math.items.map((q, i) => `${i + 1}. ${q.replace(/\s*=\s*$/, " = ?")}`),
      answers: math.answers, subject, detected: math.detected,
    };
    return {
      title: `Карточки по математике · ${clean}${gradeLabel}`,
      items: math.items.map((q, i) => `Карточка ${i + 1}\nВопрос: ${q.replace(/\s*=\s*$/, " — чему равно выражение?")}\nОтвет: ${math.answers[i]}`),
      answers: math.answers, subject, detected: math.detected,
    };
  }

  const exercises = Array.from({ length: safeCount }, (_, i) => {
    const exercise = generateSubjectExercise(subject, clean, effectiveLevel, i);
    if (effectiveLevel === "easy") return { ...exercise, prompt: `${exercise.prompt} Работай по шагам; при необходимости пользуйся конспектом.` };
    if (effectiveLevel === "hard") return {
      ...exercise,
      prompt: `${exercise.prompt} Дополнительно объясни выбор способа решения и проверь вывод на другом примере.`,
      answer: `${exercise.answer} Для углублённого уровня: обоснование должно объяснять ход решения, а проверочный пример — подтверждать общий вывод.`,
    };
    return exercise;
  });
  const answers = exercises.map((exercise, i) => `${i + 1}. ${exercise.answer}`);
  const gradeLabel = request.grade ? ` · ${request.grade} класс` : "";
  if (tool === "assignment") return {
    title: `Практика · ${subject} · ${clean}${gradeLabel}`,
    items: exercises.map((exercise, i) => `${i + 1}. ${exercise.prompt}`), answers, subject, detected: subject,
  };
  if (tool === "quiz") return {
    title: `Проверочная работа · ${subject} · ${clean}${gradeLabel}`,
    items: exercises.map((exercise, i) => `${i + 1}. ${exercise.prompt}`), answers, subject, detected: subject,
  };
  return {
    title: `Карточки · ${subject} · ${clean}${gradeLabel}`,
    items: exercises.map((exercise, i) => `Карточка ${i + 1}\nВопрос: ${exercise.prompt}\nОтвет: ${exercise.answer}`),
    answers, subject, detected: subject,
  };
}

