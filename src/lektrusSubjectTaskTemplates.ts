import type {SubjectTone} from "./lektrusSubjectAccent";
import type {SubjectBoardEntry} from "./boardModel";

export type SubjectTaskField={id:string;label:string;placeholder:string;multiline?:boolean};
export type SubjectTaskTemplate={
 id:string;title:string;instruction:string;promptLabel:string;promptPlaceholder:string;
 fields:readonly SubjectTaskField[];answerLabel?:string;
};
const field=(id:string,label:string,description:string,multiline=false):SubjectTaskField=>({id,label,placeholder:description,multiline});
const type=(id:string,title:string,description:string,fields:SubjectTaskField[]=[],promptLabel="Условие задания"):SubjectTaskTemplate=>({
 id,title,instruction:description,promptLabel,promptPlaceholder:"Сформулируйте задание для ученика",fields
});
const task=type("task","Задание","Свободный вопрос или упражнение с письменным ответом");
const textProblem=type("word-problem","Текстовая задача",
 "Преподаватель вводит только условие. Ученик самостоятельно заполняет краткую запись, решение и ответ.",
 [],"Текст задачи");

/** Only distinct learning workflows appear as authoring types. */
export const subjectTaskTemplates:Record<SubjectTone,readonly SubjectTaskTemplate[]>={
 mathematics:[
  task,
  textProblem,
  type("equation","Уравнения и неравенства","Запишите уравнение, неравенство или систему, которую нужно решить",[
   field("expression","Математическая запись","Уравнение, неравенство или система",true)
  ]),
  type("geometry","Геометрическая задача","Укажите фигуру и то, что требуется найти или доказать",[
   field("figure","Чертёж и обозначения","Обозначения фигуры и известные геометрические условия",true)
  ])
 ],
 physics:[
  task,
  type("calculation","Расчётная задача","Преподаватель задаёт условие. Ученик оформляет «Дано», «Найти», решение и ответ. Перевод единиц записывается в «Дано».",[],"Условие задачи"),
  type("lab","Лабораторная работа","Цель, материалы, измерения и выводы",[
   field("aim","Цель работы","Что необходимо исследовать"),
   field("equipment","Оборудование","Какие приборы и материалы потребуются"),
   field("procedure","Ход работы","Последовательность действий и измерений",true)
  ])
 ],
 chemistry:[
  task,
  type("chain","Цепочка превращений","Последовательность химических превращений",[
   field("sequence","Цепочка веществ","Запишите исходные и конечные вещества или неизвестные звенья",true)
  ]),
  type("calculation","Расчётная задача","Преподаватель вводит условие; ученик записывает данные, расчёт и ответ.",[],"Условие задачи"),
  type("experiment","Практическая работа","Описание химического опыта и задания по наблюдениям",[
   field("materials","Реактивы и оборудование","Вещества и необходимые приборы",true),
   field("procedure","Ход работы","Последовательность действий и условия опыта",true)
  ])
 ],
 russian:[
  task,
  type("orthography","Орфография","Ученик вставляет пропущенные буквы или раскрывает скобки в тексте"),
  type("punctuation","Пунктуация","Ученик вставляет знаки препинания в предложения"),
  type("morphemes","Разбор слова по составу","Ученик разделяет слово на морфемы и выбирает обозначения",[
   field("material","Слово для разбора","Одно слово без пробелов")
  ]),
  type("morphology","Морфологический разбор","Ученик определяет часть речи и грамматические признаки",[
   field("material","Предложение","Укажите предложение, в котором употреблено слово",true),
   field("target","Разбираемое слово","Укажите одно слово из предложения")
  ]),
  type("syntax","Синтаксический разбор","Ученик подчёркивает члены предложения",[
   field("material","Предложение для разбора","Введите предложение для синтаксического разбора",true)
  ]),
  type("text","Работа с текстом","Работа с исходным текстом и вопросами",[
   field("material","Текст","Введите текст для чтения и анализа",true),
   field("questions","Вопросы","Вопросы или действия по содержанию текста",true)
  ])
 ],
 languages:[
  task,
  type("translation","Перевод","Письменный перевод текста",[
   field("material","Текст для перевода","Текст на исходном языке",true),
   field("direction","Направление перевода","Укажите, на какой язык переводить")
  ]),
  type("gaps","Пропуски","Вставить недостающие слова или грамматические формы"),
  type("vocabulary","Сопоставление слов","Соотнести иностранные слова и их значения"),
  type("word-order","Порядок слов","Составить предложение из перемешанных слов")
 ],
 biology:[task],
 geography:[task],
 literature:[task],
 history:[task],
 social:[task],
 informatics:[task]
};

/** Previously saved types remain readable and editable, but aren't offered for new tasks. */
const retiredTaskTemplates:Partial<Record<SubjectTone,readonly SubjectTaskTemplate[]>>={
 mathematics:[
  type("interactive","Интерактивный тренажёр","Сохранённое интерактивное упражнение"),
  type("choice","Выбор ответа","Сохранённый математический тест"),
  type("cloze","Пропуски в выражении","Сохранённое математическое упражнение"),
  type("matching","Сопоставление","Сохранённое математическое сопоставление"),
  type("sequence","Порядок действий","Сохранённая последовательность действий"),
  type("expression","Вычисление / преобразование","Прежнее вычислительное задание",[
   field("expression","Выражение","Выражение или вычисление",true)
  ]),
  type("function","Функция / график","Прежнее задание по функциям",[
   field("function","Функция","Запись функции"),
   field("conditions","Область и условия","Ограничения и область определения"),
   field("find","Исследовать","Что требуется установить")
  ])
 ],
 chemistry:[
  type("equation","Уравнения","Прежнее задание с реакцией",[
   field("reactants","Исходные вещества","Запись реагентов"),
   field("products","Продукты","Запись продуктов"),
   field("conditions","Условия","Условия реакции")
  ]),
  type("balance","Расстановка коэффициентов","Прежнее задание с коэффициентами",[
   field("reactions","Уравнения реакций","Текст реакций",true)
  ])
 ],
 russian:[
  type("interactive","Интерактивный тренажёр","Сохранённое интерактивное задание"),
  type("matching","Сопоставление","Прежнее сопоставление"),
  type("sequence","Составь предложение","Прежнее упражнение на порядок слов"),
  type("choice","Выбор ответа","Прежний вопрос с вариантами ответа"),
  type("cloze","Вставь пропущенное","Прежнее упражнение с пропусками")
 ],
 languages:[
  type("grammar","Грамматическое преобразование","Сохранённое грамматическое задание",[
   field("material","Предложения","Предложения для преобразования",true),
   field("instruction","Требуемое действие","Как нужно изменить форму или конструкцию")
  ]),
  type("reading","Чтение и понимание","Сохранённый текст с вопросами",[
   field("material","Текст","Текст для чтения",true),
   field("questions","Вопросы по тексту","Вопросы, требующие ответа",true)
  ]),
  type("choice","Выбор ответа","Сохранённый тест по лексике или грамматике"),
  type("matching","Соедини пары","Прежнее сопоставление"),
  type("sequence","Собери фразу","Прежняя последовательность слов"),
  type("cloze","Заполни пропуски","Прежнее упражнение с пропусками")
 ]
};
export const subjectTaskTypeAllowed=(tone:SubjectTone,format:string|undefined):boolean=>
 !format||subjectTaskTemplates[tone].some(item=>item.id===format);
export const subjectTaskTypeKnown=(tone:SubjectTone,format:string|undefined):boolean=>
 subjectTaskTypeAllowed(tone,format)||Boolean(retiredTaskTemplates[tone]?.some(item=>item.id===format));
export function taskTemplateFor(tone:SubjectTone,format:string|undefined):SubjectTaskTemplate{
 return subjectTaskTemplates[tone].find(item=>item.id===format)??
 retiredTaskTemplates[tone]?.find(item=>item.id===format)??
 subjectTaskTemplates[tone][0];
}
export function freshTaskDetails(tone:SubjectTone,format:string):Record<string,string>{
 return Object.fromEntries(taskTemplateFor(tone,format).fields.map(item=>[item.id,""]));
}
export const isSchoolSolutionSubject=(tone:SubjectTone)=>tone==="mathematics"||tone==="physics"||tone==="chemistry";
/** Numeric and word problems receive a blank school solution as soon as they are placed. */
export const needsAutomaticWorkedSolution=(tone:SubjectTone,format:string|undefined):boolean=>
 (tone==="mathematics"&&format==="word-problem")||
 (tone==="physics"&&format==="calculation")||
 (tone==="chemistry"&&format==="calculation");
export function subjectBoardHasWork(entry:SubjectBoardEntry):boolean{
 const worked=entry.workedSolution;
 return Boolean(entry.title.trim()||entry.prompt.trim()||entry.solution.trim()||entry.answer.trim()||
 Object.values(entry.details??{}).some(value=>value.trim())||
 (entry.activity&&(
  entry.activity.options?.some(value=>value.trim())||
  entry.activity.blanks?.some(value=>value.before.trim()||value.answer.trim())||
  entry.activity.tail?.trim()||
  entry.activity.pairs?.some(value=>value.left.trim()||value.right.trim())||
  entry.activity.tokens?.some(value=>value.trim())
 ))||
 (worked&&Object.values(worked).some(value=>value.trim()))||
 entry.steps?.some(step=>step.expression.replace(/[→⇌=\s]/g,"").trim()||step.conditions.trim()));
}
