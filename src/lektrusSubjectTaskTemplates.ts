import type {SubjectTone} from "./lektrusSubjectAccent";
import type {SubjectBoardEntry} from "./boardModel";

export type SubjectTaskField={id:string;label:string;placeholder:string;multiline?:boolean};
export type SubjectTaskTemplate={
 id:string;title:string;instruction:string;promptLabel:string;promptPlaceholder:string;
 fields:readonly SubjectTaskField[];answerLabel?:string;
};
const field=(id:string,label:string,description:string,multiline=false):SubjectTaskField=>({id,label,placeholder:description,multiline});
const type=(id:string,title:string,description:string,fields:SubjectTaskField[]=[],promptLabel="Условие задания"):SubjectTaskTemplate=>({
 id,title,instruction:description,promptLabel,promptPlaceholder:"Опишите, что необходимо выполнить",fields
});
const task=type("task","Задание","Свободное задание с условием и ответом");

export const subjectTaskTemplates:Record<SubjectTone,readonly SubjectTaskTemplate[]>={
 chemistry:[
  task,
  type("equation","Уравнения","Составление и уравнивание химических реакций",[
   field("reactants","Исходные вещества","Укажите реагирующие вещества"),
   field("products","Продукты","Укажите вещества, образующиеся в реакции"),
   field("conditions","Условия","Укажите условия реакции, если они известны")
  ]),
  type("chain","Цепочка превращений","Последовательность превращений с неизвестными звеньями",[
   field("sequence","Схема превращений","Запишите звенья цепочки, укажите пропущенные вещества",true),
   field("conditions","Условия переходов","Укажите реагенты и условия для отдельных переходов",true)
  ]),
  type("balance","Расстановка коэффициентов","Уравнивание заданных реакций",[
   field("reactions","Уравнения реакций","Запишите реакции, в которых нужно расставить коэффициенты",true)
  ]),
  type("calculation","Расчётная задача","Задача на количество вещества, массу, объём или выход продукта",[
   field("given","Исходные данные","Перечислите известные величины с единицами",true),
   field("find","Искомая величина","Укажите, что требуется вычислить")
  ]),
  type("experiment","Практическая работа","Наблюдения и вывод по химическому опыту",[
   field("materials","Вещества и оборудование","Перечислите необходимые вещества и оборудование",true),
   field("procedure","Ход работы","Опишите действия и условия проведения работы",true),
   field("observations","Наблюдения","Что требуется зафиксировать?",true)
  ])
 ],
 mathematics:[
  task,
  type("equation","Уравнение / неравенство","Решение уравнений, неравенств и систем",[
   field("expression","Математическая запись","Введите выражение, которое нужно решить",true),
   field("domain","Ограничения","Укажите ОДЗ или ограничения при необходимости")
  ]),
  type("expression","Вычисление / преобразование","Вычисление значений и тождественные преобразования",[
   field("expression","Выражение","Введите выражение для вычисления или преобразования",true)
  ]),
  type("word-problem","Текстовая задача","Задача по условию с числовыми данными",[
   field("given","Известные данные","Укажите величины и зависимости из условия",true),
   field("find","Что требуется найти","Укажите искомую величину или величины")
  ]),
  type("geometry","Геометрическая задача","Чертёж, доказательство или вычисление",[
   field("figure","Фигура / обозначения","Укажите фигуру и принятые обозначения"),
   field("given","Дано","Перечислите известные стороны, углы и отношения",true),
   field("find","Найти / доказать","Укажите требуемый результат")
  ]),
  type("function","Функция / график","Исследование функции и построение графика",[
   field("function","Функция","Запишите функцию"),
   field("conditions","Область и условия","Укажите интервалы или дополнительные условия"),
   field("find","Исследовать / построить","Укажите требуемые свойства или построение")
  ])
 ],
 physics:[
  task,
  type("calculation","Расчётная задача","Дано, найти, перевод в СИ, формулы и ответ",[
   field("given","Исходные данные","Перечислите физические величины с единицами",true),
   field("find","Найти","Укажите искомые физические величины")
  ]),
  type("lab","Лабораторная работа","Цель, приборы, измерения и выводы",[
   field("aim","Цель","Сформулируйте цель исследования"),
   field("equipment","Оборудование","Перечислите приборы и материалы"),
   field("procedure","Порядок работы","Опишите последовательность действий",true),
   field("measurements","Измерения","Укажите, какие результаты необходимо получить",true)
  ])
 ],
 russian:[
  task,
  type("orthography","Орфографическое задание","Вставить буквы, раскрыть скобки, объяснить орфограммы",[
   field("material","Слова или текст","Введите учебный материал с пропусками или вариантами написания",true),
   field("instruction","Что выполнить","Уточните, нужно ли вставить буквы, раскрыть скобки или объяснить написание")
  ]),
  type("punctuation","Пунктуационное задание","Расставить знаки препинания и объяснить их",[
   field("material","Предложения / текст","Введите материал без необходимых знаков препинания",true),
   field("instruction","Что выполнить","Укажите необходимость объяснить знаки или составить схему")
  ]),
  type("morphemes","Разбор слова по составу","Выделить морфемы в заданных словах",[
   field("material","Слова для разбора","Перечислите слова, которые необходимо разобрать",true),
   field("instruction","Требования к разбору","Уточните особенности разбора, если это необходимо")
  ]),
  type("morphology","Морфологический разбор","Разобрать часть речи в контексте",[
   field("material","Слово и контекст","Введите предложение и выделите слово для разбора",true),
   field("instruction","Требования к разбору","Укажите часть речи или требуемые грамматические признаки")
  ]),
  type("syntax","Синтаксический разбор","Найти грамматическую основу, члены предложения и составить схему",[
   field("material","Предложение для разбора","Введите предложение, которое нужно разобрать",true),
   field("instruction","Объём разбора","Уточните, нужен полный разбор, схема или отдельные члены предложения")
  ]),
  type("text","Работа с текстом","Анализ содержания, стиля, типа речи или изложение",[
   field("material","Исходный текст","Введите текст для работы",true),
   field("questions","Вопросы / задания","Перечислите действия, которые нужно выполнить с текстом",true)
  ])
 ],
 languages:[
  task,
  type("translation","Перевод","Перевод текста с одного языка на другой",[
   field("material","Текст для перевода","Введите текст на исходном языке",true),
   field("direction","Направление перевода","Укажите, на какой язык выполнить перевод")
  ]),
  type("gaps","Пропуски","Вставить недостающие слова или грамматические формы",[
   field("material","Текст с пропусками","Введите предложения с обозначенными пропусками",true),
   field("words","Слова для выбора","При необходимости перечислите предложенные варианты",true)
  ]),
  type("grammar","Грамматика","Преобразовать предложения или употребить нужную грамматическую форму",[
   field("material","Предложения","Введите материал, с которым нужно работать",true),
   field("instruction","Грамматическое действие","Укажите нужное преобразование или грамматическое правило")
  ]),
  type("vocabulary","Лексика","Работа со словами и словосочетаниями",[
   field("material","Слова / словосочетания","Введите слова для перевода, подбора или употребления",true),
   field("instruction","Действие со словами","Укажите, требуется ли перевести, сопоставить или составить предложения")
  ]),
  type("word-order","Порядок слов","Составить грамматически верное предложение",[
   field("material","Слова для составления","Введите набор слов, которые нужно расположить в правильном порядке",true),
   field("instruction","Дополнительные условия","Укажите необходимое время, вопросительную форму или другие ограничения")
  ]),
  type("reading","Чтение и понимание","Прочитать текст и ответить на вопросы",[
   field("material","Текст для чтения","Введите учебный текст",true),
   field("questions","Вопросы по тексту","Запишите вопросы, на которые нужно ответить",true)
  ])
 ],
 biology:[task],
 geography:[task],
 literature:[task],
 history:[task],
 social:[task],
 informatics:[task]
};

/** Preserve historical task types and fields instead of silently erasing their data. */
export function taskTemplateFor(tone:SubjectTone,format:string|undefined):SubjectTaskTemplate{
 const templates=subjectTaskTemplates[tone];
 return templates.find(template=>template.id===format)??templates[0];
}
export function freshTaskDetails(tone:SubjectTone,format:string):Record<string,string>{
 return Object.fromEntries(taskTemplateFor(tone,format).fields.map(item=>[item.id,""]));
}
export const isSchoolSolutionSubject=(tone:SubjectTone)=>tone==="mathematics"||tone==="physics"||tone==="chemistry";
export function subjectBoardHasWork(entry:SubjectBoardEntry):boolean{
 const worked=entry.workedSolution;
 return Boolean(entry.title.trim()||entry.prompt.trim()||entry.solution.trim()||entry.answer.trim()||
 Object.values(entry.details??{}).some(value=>value.trim())||
 (worked&&Object.values(worked).some(value=>value.trim()))||
 entry.steps?.some(step=>step.expression.replace(/[→⇌=\s]/g,"").trim()||step.conditions.trim()));
}
