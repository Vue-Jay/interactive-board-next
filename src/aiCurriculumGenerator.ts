import { generateMathAi, type MathAiLevel, type MathAiMode } from "./aiMathGenerator";
import { generateSubjectExercise, generateSubjectExerciseVariant } from "./aiSubjectExerciseBank";
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
  "Математика": /математ|алгебр|геометр|треуголь|окружност|круг|площад|периметр|угол|уравнен|дроб|процент|пифагор|функци|вычислен|арифмет|числ|чисел|корень|степен|пропорц|отношени|десятичн|координат|делимост|кратн|простые числа|простых чисел|синус|косинус|тангенс|тригонометр|логарифм|вероятност|статистик|биномиальн|касательн|прогресси|комбинатор|производн|област.*определен|об[ъь][её]м цилиндр|вписанн.*окруж/i,
  "Физика": /физик|ньютон|кинематик|динамик|скорост|ускорен|равномерн движ|сила|энерги|электр|давлен|теплот|теплопередач|теплообмен|оптик|линз|фокусн расстояни|звук|плотност.*(?:тел|веществ|жидк|газ)|закон ом|механик|мощност|работа силы|архимед|изобарн[а-яё]* процесс|термодинамик/i,
  "Химия": /хими|атом|молекул|реакци|раствор|кислот|кислород|горени|основан|валент|периодическ|формул веществ|окислен|соль|оксид|энтальпи|диссоциац|гидролиз|гомолог|эфир|амфотер|молярн концентраци/i,
  "Биология": /биолог|клетк|организм|экосистем|генет|растен|животн|кров|орган|фотосинтез|дыхани|дыхательн[а-яё]* систем|пищевар|наследствен|эволюц|естественн[а-яё]* отбор|иммун|митоз|мейоз|митохондр|хромосом|транскрипц|трансляц|нефрон|гамет|симбиоз|паразитизм|строени.*лист/i,
  "География": /географ|климат|материк|океан|рельеф|населени|плотност населени|карта|природн зон|масштаб|столиц|река|образован.*гор|горообразован|ледник|мерзлот|тектоник|часов.*пояс|изобар|сол[её]ност океан|демографическ переход|платформ|водораздел|агломераци|долгот|атмосферн фронт/i,
  "Русский язык": /русск|орфограф|правописан|пунктуац|морфем|часть речи|предложени|синтаксис|сказуем|суффикс|причаст|тся|ться|падеж|глагол|нареч|приставк|деепричаст|безударн гласн|однородн член|пароним|обособлен|вводн слов|чередован.*корн|лексическ норм|цитирован|н и нн/i,
  "Литература": /литератур|роман|рассказ|поэ|геро|сюжет|автор|произведени|персонаж|композици|лирик|эпос|драма|басн|аллитерац|ассонанс|романтизм|отцы и дети|пейзаж|трагеди|лирическ геро|антитез|маленьк человек|лишн.*человек/i,
  "История": /истори|п[её]тр|петр|век|войн|революц|реформ|государств|правлен|цивилизац|древн|средневек|импери|княжеств|историческ источник|крепостн|тильзит|нэп|избранн рад|распад.*ссср|персидск войн|рюрикович|версальск договор|римск импер|земск собор/i,
  "Обществознание": /обществ|прав|эконом|граждан|государств|социал|рынок|семь|бюджет|налог|спрос|предложени|потребност|трудов право|инфляц|валовой внутренний продукт|(?:^|\s)ввп(?:$|\s)|монопол|кредит|сбережени/i,
  "Информатика": /информат|алгоритм|программ|код|данн|таблиц|сеть|безопасност|двоичн|цикл|ветвлен|переменн|логическ операц|рекурс|словарь.*python|сложност.*алгоритм|дерев.*поиск|стек.*очеред/i,
  "Иностранный язык": /англий|иностран|english|лексик|грамматик|перевод|времен глагол|past simple|present simple|present continuous|irregular verbs|немецк|французск|испанск|reported speech|пассивн залог|условн предложени|герунди|фразов.*глагол|степени сравн.*прилагател|множественн[а-яё]* число существительн/i,
};

const specificSubjectAliases: [string, RegExp][] = [
  ["Биология", /строени[ея].*днк|днк.*комплементарност|строени[ея].*цветк|опылени[ея]|рефлекторн[а-яё]* дуг/i],
  ["Химия", /количеств[оа].*веществ|количеств[оа].*мол[ья]|водород.*свойств|глюкоз[аые].*углевод/i],
  ["География", /почв[а-яё]*.*(?:фактор|образован)|почвообразован/i],
  ["Обществознание", /вид[а-яё]* безработиц|занятост[ья].*населени/i],
  ["Физика", /равномерн[а-яё]* движени.*график|график.*пути|плавлени[ея]|кристаллизаци[яи].*веществ/i],
  ["Литература", /евгени[йя].*онегин|онегин.*татьян[а-яё]*/i],
  ["История", /карибск[а-яё]* кризис|холодн[а-яё]* войн/i],
  ["Информатика", /перевод.*(?:двоичн|шестнадцатеричн)|систем[а-яё]* счислени|двоичн.*шестнадцатеричн/i],
  ["Математика", /линейн[а-яё]* неравен|неравенств[а-яё]* с переменн/i],
  ["Русский язык", /чередующ[а-яё]* корн|бер бир|дер дир|однородн[а-яё]* и неоднородн[а-яё]* определени/i],
  ["Иностранный язык", /английск[а-яё]*\s+язык|английск[а-яё]*.*относительн.*придаточн|future simple|relative clauses|немецк.*приставк|степени сравн.*прилагател|множественн[а-яё]* число существительн|past simple|present simple|present perfect|reported speech|фразов.*глагол/i],
  ["Информатика", /рекурсивн.*функц|словарь.*python|сложност.*алгоритм|двоичн дерево|стек.*очеред/i],
  ["География", /плотност населени|природн зон|контурн карт|тектоническ платформ|географическ долг/i],
  ["Русский язык", /правописан.*н и нн|орфографическ.*нн|падежи? имен существительн|виды сказуем/i],
];

export function detectCurriculumSubject(topic: string, selected = ""): string {
  if (LEKTRUS_SCHOOL_SUBJECTS.includes(selected as typeof LEKTRUS_SCHOOL_SUBJECTS[number])) return selected;
  for (const [subject, pattern] of specificSubjectAliases) if (pattern.test(topic)) return subject;
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
  тринадцать: 13, четырнадцать: 14, пятнадцать: 15, шестнадцать: 16, семнадцать: 17,
  восемнадцать: 18, девятнадцать: 19, двадцать: 20,
};
const countUnits = "шт\\.?|задач[а-яё]*|задани[а-яё]*|вопрос[а-яё]*|пример[а-яё]*|упражнен[а-яё]*|флеш[- ]?карточ[а-яё]*|карточ[а-яё]*";
const gradeWords: Record<string, number> = {
  первый: 1, первого: 1, первом: 1, второй: 2, второго: 2, втором: 2, третий: 3, третьего: 3, третьем: 3,
  четвертый: 4, четвертого: 4, четвертом: 4, пятый: 5, пятого: 5, пятом: 5, шестой: 6, шестого: 6, шестом: 6,
  седьмой: 7, седьмого: 7, седьмом: 7, восьмой: 8, восьмого: 8, восьмом: 8, девятый: 9, девятого: 9, девятом: 9,
  десятый: 10, десятого: 10, десятом: 10, одиннадцатый: 11, одиннадцатого: 11, одиннадцатом: 11,
};
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
  const hardRequest = /посложнее|сложнее|сложн(?:ые?|ых)\s+(?:задач|задан|упражнен|тест|пример)|сложный уровень|повышенн\w* сложност|углубл|олимпиад|продвинут|высокого уровня/i.test(input);
  const easyRequest = /попроще|полегче|прост(?:ые?|ых|ую)\s+(?:задач|задан|упражнен|тест|пример)|простой уровень|базов\w* уровень|начинающ|для новичк|начальн\w* уровень/i.test(input);
  const hasLevel = hardRequest || easyRequest;
  const inferredLevel: CurriculumAiLevel = hardRequest ? "hard" : "easy";
  let topic = countMatch ? input.replace(qty, " ") : input;
  const numericGrade = input.match(/(?:^|\s)(\d{1,2})(?:-(?:й|го|м))?\s*(?:класс[а-яё]*|кл\.?)/i);
  const wordGrade = input.match(new RegExp(`(?:^|\\s)(${Object.keys(gradeWords).sort((a, b) => b.length - a.length).join("|")})\\s+класс[а-яё]*`, "iu"));
  const grade = numericGrade ? Math.min(11, Math.max(1, Number(numericGrade[1])))
    : wordGrade ? gradeWords[wordGrade[1].toLocaleLowerCase("ru-RU")] ?? null : null;
  const gradePhrase = numericGrade?.[0] ?? wordGrade?.[0]?.trim();
  if (gradePhrase) topic = topic.replace(gradePhrase, " ");
  const subjectForCleanup = detectCurriculumSubject(topic, selectedSubject);
  let explicitSubjectPrefixRemoved = false;
  topic = topic.replace(/[,:;.!?«»“”]+/g, " ");
  for (let pass = 0; pass < 3; pass += 1) {
    topic = topic
      .replace(/^\s*(?:(?:пожалуйста|мне|мне нужно|мне нужна|мне нужны|нужно|нужна|нужны|хочу|можно|создай|составь|подготовь|подготовить|сгенерируй|сделай|дай|придумай|напиши|подбери|сформируй|сгенерировать|реши|решить|вычисли|найди|объясни|изучи|разбери|расскажи|покажи|хотелось бы|давай)\s+)+/i, "")
      .replace(/^\s*(?:(?:что-нибудь|что нибудь|попроще|полегче|посложнее|сложнее|л[её]гк(?:ую|ие|их|ое)|сложн(?:ую|ые|ых|ое)|углублённ[а-яё]*|олимпиадн[а-яё]*|базов[а-яё]*|продвинут[а-яё]*)\s+)+/i, "")
      .replace(/^\s*прост(?:ую|ые|ых|ое)\s+(?=(?:задач|задан|упражнен|тест|пример))/i, "")
      .replace(/^\s*(?:(?:задач[а-яё]*|задани[а-яё]*|упражнен[а-яё]*|тест[а-яё]*|викторин[а-яё]*|проверочн[а-яё]*|контрольн[а-яё]*|самостоятельн[а-яё]*|флеш[- ]?карточ[а-яё]*|карточ[а-яё]*|вопрос[а-яё]*|пример[а-яё]*|практическ\w*)\s+)+/i, "")
      .replace(/^\s*(?:(?:по теме|на тему|по|на|про|тема|теме|для|о)\s+)+/i, "");
    const subjectLead: Partial<Record<string, RegExp>> = {
      "Математика": /^(?:математик[а-яё]*|алгебр[а-яё]*|геометр[а-яё]*)\s+/i,
      "Физика": /^физик[а-яё]*\s+/i,
      "Химия": /^хими[а-яё]*\s+/i,
      "Биология": /^биолог[а-яё]*\s+/i,
      "География": /^географ[а-яё]*\s+/i,
      "Русский язык": /^(?:русск[а-яё]*\s+язык[а-яё]*|русск[а-яё]*)\s+/i,
      "Литература": /^литератур[а-яё]*\s+/i,
      "История": /^истор[а-яё]*\s+/i,
      "Обществознание": /^обществозн[а-яё]*\s+/i,
      "Информатика": /^информатик[а-яё]*\s+/i,
      "Иностранный язык": /^(?:английск[а-яё]*\s+язык[а-яё]*|иностран[а-яё]*\s+язык[а-яё]*|английск[а-яё]*|english)\s+/i,
    };
    const subjectPattern = subjectLead[subjectForCleanup];
    if (subjectPattern?.test(topic)) explicitSubjectPrefixRemoved = true;
    if (subjectPattern) topic = topic.replace(subjectPattern, "");
  }
  topic = topic.replace(/^\s*(?:(?:по теме|на тему|по|на|про|тема|теме|для|о)\s+)+/i, "")
    .replace(/\s+(?:для|учени(?:к|ца|кам|кам)?|учащимс[яи])\s*$/i, "")
    .replace(/\s+/g, " ").trim();
  const toolMatch = /карточ[а-яё]*|флеш.?карточ|flash.?card/i.test(input)
    ? "flashcards"
    : /тест|проверочн|контрольн|викторин|quiz|самостоятельн|вопрос[а-яё]*/i.test(input)
      ? "quiz"
      : /задач|упражнен|домашн|практик|задани/i.test(input)
        ? "assignment"
        : null;
  const gradeLevel: CurriculumAiLevel = grade && grade <= 4 ? "easy" : selectedLevel;
  return {
    subject: selectedSubject || (explicitSubjectPrefixRemoved ? subjectForCleanup : detectCurriculumSubject(topic) || subjectForCleanup),
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

  const seenPrompts = new Set<string>();
  let fallbackVariant = 0;
  const exercises = Array.from({ length: safeCount }, (_, i) => {
    let exercise = generateSubjectExercise(subject, clean, effectiveLevel, i);
    let normalizedPrompt = exercise.prompt.toLocaleLowerCase("ru-RU").replace(/\s+/g, " ").trim();
    while (seenPrompts.has(normalizedPrompt) && fallbackVariant < 30) {
      exercise = generateSubjectExerciseVariant(subject, clean, fallbackVariant++);
      normalizedPrompt = exercise.prompt.toLocaleLowerCase("ru-RU").replace(/\s+/g, " ").trim();
    }
    seenPrompts.add(normalizedPrompt);
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

