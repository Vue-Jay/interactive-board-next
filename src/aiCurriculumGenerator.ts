import { generateMathAi, type MathAiLevel, type MathAiMode } from "./aiMathGenerator";
import { generateSubjectExercise } from "./aiSubjectExerciseBank";
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
  "Математика": /математ|алгебр|геометр|уравнен|дроб|процент|пифагор|функци|вычислен|арифмет|числ|корень|степен/i,
  "Физика": /физик|скорост|ускорен|сила|энерги|электр|давлен|теплот|оптик|звук|плотност|ома/i,
  "Химия": /хими|атом|молекул|реакци|раствор|кислот|основан|валент|периодическ/i,
  "Биология": /биолог|клетк|организм|экосистем|генет|растен|животн|кров|орган|фотосинтез/i,
  "География": /географ|климат|материк|океан|рельеф|населени|карта|природн зон|масштаб/i,
  "Русский язык": /русск|орфограф|пунктуац|морфем|часть речи|предложени|синтаксис|суффикс|причаст|тся|ться|падеж|глагол|нареч|приставк/i,
  "Литература": /литератур|роман|рассказ|поэ|геро|сюжет|автор|произведени|персонаж|композици/i,
  "История": /истори|пётр|петр|век|войн|революц|реформ|государств|правлен|цивилизац|древн|средневек/i,
  "Обществознание": /обществ|право|эконом|граждан|государств|социал|рынок|семь|бюджет/i,
  "Информатика": /информат|алгоритм|программ|код|данн|таблиц|сеть|безопасност/i,
  "Иностранный язык": /англий|иностран|english|лексик|грамматик|перевод|времен глагол|past simple/i,
};

export function detectCurriculumSubject(topic: string, selected = ""): string {
  if (LEKTRUS_SCHOOL_SUBJECTS.includes(selected as typeof LEKTRUS_SCHOOL_SUBJECTS[number])) return selected;
  for (const [subject, pattern] of Object.entries(subjectAliases)) if (pattern.test(topic)) return subject;
  return "";
}

export function generateCurriculumAi(tool: CurriculumAiTool, topic: string, level: CurriculumAiLevel, count: number, selectedSubject = ""): CurriculumAiResult {
  const subject = detectCurriculumSubject(topic, selectedSubject);
  const clean = topic.trim();
  if (!subject) throw new Error("Не удалось определить предмет. Выберите его в списке.");
  const safeCount = Math.max(1, Math.min(15, Math.round(count)));
  if (subject === "Математика") {
    const mathLevel: MathAiLevel = level === "easy" ? "primary" : level === "hard" ? "advanced" : "basic";
    const math = generateMathAi("auto" as MathAiMode, mathLevel, safeCount, clean, true);
    if (tool === "assignment") return { title: `${math.detected} · ${clean}`, items: math.items, answers: math.answers, subject, detected: math.detected };
    if (tool === "quiz") return {
      title: `Проверочная работа · Математика · ${clean}`,
      items: math.items.map((q, i) => `${i + 1}. ${q.replace(/\s*=\s*$/, " = ?")}`),
      answers: math.answers, subject, detected: math.detected,
    };
    return {
      title: `Карточки по математике · ${clean}`,
      items: math.items.map((q, i) => `Карточка ${i + 1}\nВопрос: ${q.replace(/\s*=\s*$/, " — чему равно выражение?")}\nОтвет: ${math.answers[i]}`),
      answers: math.answers, subject, detected: math.detected,
    };
  }

  const exercises = Array.from({ length: safeCount }, (_, i) => {
    const exercise = generateSubjectExercise(subject, clean, level, i);
    if (level === "easy") return { ...exercise, prompt: `${exercise.prompt} Работай по шагам; при необходимости пользуйся конспектом.` };
    if (level === "hard") return {
      ...exercise,
      prompt: `${exercise.prompt} Дополнительно объясни выбор способа решения и проверь вывод на другом примере.`,
      answer: `${exercise.answer} Для углублённого уровня: обоснование должно объяснять ход решения, а проверочный пример — подтверждать общий вывод.`,
    };
    return exercise;
  });
  const answers = exercises.map((exercise, i) => `${i + 1}. ${exercise.answer}`);
  if (tool === "assignment") return {
    title: `Практика · ${subject} · ${clean}`,
    items: exercises.map((exercise, i) => `${i + 1}. ${exercise.prompt}`), answers, subject, detected: subject,
  };
  if (tool === "quiz") return {
    title: `Проверочная работа · ${subject} · ${clean}`,
    items: exercises.map((exercise, i) => `${i + 1}. ${exercise.prompt}`), answers, subject, detected: subject,
  };
  return {
    title: `Карточки · ${subject} · ${clean}`,
    items: exercises.map((exercise, i) => `Карточка ${i + 1}\nВопрос: ${exercise.prompt}\nОтвет: ${exercise.answer}`),
    answers, subject, detected: subject,
  };
}

