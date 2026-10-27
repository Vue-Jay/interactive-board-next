import type {SubjectTone} from "./lektrusSubjectAccent";
import type {SubjectBoardEntry} from "./boardModel";

export type SubjectTaskField={id:string;label:string;placeholder:string;multiline?:boolean;hint?:string};
export type SubjectTaskTemplate={
 id:string;title:string;instruction:string;promptLabel:string;promptPlaceholder:string;
 fields:readonly SubjectTaskField[];answerLabel?:string;
};
const field=(id:string,label:string,placeholder:string,multiline=false):SubjectTaskField=>({id,label,placeholder,multiline});
const standard=(id:string,title:string,instruction:string,fields:SubjectTaskField[],promptLabel="Условие",promptPlaceholder="Сформулируйте задание"):SubjectTaskTemplate=>
 ({id,title,instruction,fields,promptLabel,promptPlaceholder});

export const subjectTaskTemplates:Record<SubjectTone,readonly SubjectTaskTemplate[]>={
 chemistry:[
  standard("equation","Составить уравнение","Реагенты, продукты и условия протекания реакции",
   [field("reactants","Исходные вещества","Например: Fe + HCl"),field("products","Продукты реакции","Например: FeCl₂ + H₂"),
    field("conditions","Условия реакции","Нагревание, катализатор, среда")],
   "Задание ученику","Составьте уравнение реакции и расставьте коэффициенты"),
  standard("chain","Цепочка превращений","Укажите исходное вещество и последовательность превращений",
   [field("start","Начальное вещество","Например: Ca"),field("sequence","Цепочка веществ","Ca → CaO → Ca(OH)₂ → CaCO₃",true),
    field("conditions","Дополнительные условия","Реагенты и условия над стрелками",true)],
   "Что требуется выполнить","Допишите реакции каждого этапа цепочки"),
  standard("balance","Расстановка коэффициентов","Задайте уравнение с пропущенными коэффициентами",
   [field("reaction","Уравнение без коэффициентов","Fe + O₂ → Fe₂O₃"),field("reactionConditions","Условия","При необходимости")],
   "Инструкция","Уравняйте химическую реакцию"),
  standard("calculation","Расчётная задача","Данные, искомая величина и условия расчёта",
   [field("given","Дано","Масса, объём, количество вещества, концентрация",true),field("find","Найти","Что нужно вычислить?"),
    field("units","Единицы измерения","г, моль, л, моль/л")],"Условие задачи","Вычислите неизвестную величину"),
  standard("experiment","Химический опыт","Реактивы, оборудование, условия и наблюдения",
   [field("reagents","Реактивы","Состав веществ",true),field("equipment","Оборудование","Посуда и приборы"),
    field("procedure","Ход опыта","Последовательность действий",true),
    field("observations","Наблюдения","Что нужно увидеть или объяснить?",true)]),
 ],
 mathematics:[
  standard("equation","Решение уравнения","Уравнение и допустимые значения переменных",
   [field("expression","Уравнение","2x² − 5x + 2 = 0"),field("domain","Ограничения","x ∈ ℝ; ОДЗ")],"Задание","Решите уравнение"),
  standard("expression","Вычисления и выражения","Укажите выражение и способ решения",
   [field("expression","Выражение","(3/4 + 1/6) · 12"),field("method","Способ","Упростить / вычислить / преобразовать")]),
  standard("word-problem","Текстовая задача","Составьте условие, данные и искомое",
   [field("given","Известно","Исходные данные",true),field("find","Найти","Искомые величины"),
    field("units","Единицы","м, км/ч, руб.")]),
  standard("geometry","Геометрическая задача","Фигура, данные, искомые элементы",
   [field("figure","Фигура","Треугольник ABC"),field("given","Дано","Стороны, углы, соотношения",true),
    field("prove","Найти или доказать","∠ABC, площадь, равенство")]),
  standard("function","График функции","Функция, диапазон и свойства",
   [field("function","Функция","y = x² − 4x + 3"),field("interval","Область / интервал","x ∈ [−5; 5]"),
    field("properties","Исследовать","Нули, вершина, монотонность",true)]),
 ],
 physics:[
  standard("calculation","Расчётная задача","Величины с единицами и физическая модель",
   [field("given","Дано","m = 2 кг; F = 10 Н",true),field("find","Найти","Ускорение a"),field("units","Система единиц","СИ"),
    field("formula","Подходящие законы","Второй закон Ньютона")]),
  standard("mechanics","Механика","Тела, силы и условия движения",
   [field("objects","Тела","Груз, тележка, блок"),field("forces","Силы","F, N, mg, сила трения",true),
    field("motion","Условия движения","Покой / ускоренное движение")]),
  standard("electricity","Электрические цепи","Элементы цепи и параметры",
   [field("circuit","Схема соединения","Последовательное / параллельное",true),
    field("parameters","Дано","U = 12 В; R = 6 Ом",true),field("find","Найти","Сила тока, сопротивление")]),
  standard("optics","Оптика","Оптические объекты, лучи и углы",
   [field("objects","Элементы схемы","Линза, зеркало, призма"),
    field("rays","Луч / угол","Угол падения, фокусное расстояние",true),
    field("find","Построить / найти","Изображение, ход луча, угол преломления")]),
  standard("experiment","Лабораторная работа","Цель, оборудование и наблюдения",
   [field("aim","Цель","Что исследовать?"),field("equipment","Оборудование","Приборы"),
    field("measurements","Измерения","Результаты наблюдений",true)]),
 ],
 russian:[
  standard("orthography","Орфография","Слова с пропусками и правило",
   [field("words","Слова с пропусками","пр..красный, р..стение",true),field("rule","Орфограмма / правило","Безударная гласная в корне")],
   "Инструкция","Вставьте пропущенные буквы и объясните выбор"),
  standard("morphemes","Разбор по составу","Слово и элементы для разбора",
   [field("word","Слово","подснежник"),field("parts","Что выделить","Приставка, корень, суффикс, окончание")]),
  standard("syntax","Синтаксический разбор","Предложение и требуемые признаки",
   [field("sentence","Предложение","Укажите предложение",true),
    field("analyse","Что разобрать","Члены предложения, схема, части речи",true)]),
  standard("morphology","Морфологический разбор","Слово и морфологические признаки",
   [field("word","Слово","Читающий"),field("part","Часть речи","Укажите часть речи"),
    field("features","Разобрать признаки","Постоянные и непостоянные",true)]),
  standard("punctuation","Пунктуация","Текст без знаков препинания",
   [field("text","Предложение / текст","Когда взошло солнце мы отправились в путь",true),
    field("rule","Правило","Обособление, сложное предложение")]),
 ],
 biology:[
  standard("cell","Строение клетки","Тип клетки и органоиды",
   [field("cell","Тип клетки","Растительная / животная"),field("organelles","Органоиды","Найдите и подпишите",true)]),
  standard("genetics","Генетическая задача","Генотипы и тип наследования",
   [field("parents","Родительские генотипы","Aa × Aa"),field("trait","Признак","Доминантный / рецессивный"),
    field("generation","Поколение","F₁ / F₂")]),
  standard("ecology","Пищевая цепь","Организмы и связи между ними",
   [field("organisms","Организмы","Трава → заяц → лиса",true),field("task","Что определить","Трофические уровни")]),
  standard("classification","Систематика","Организм и таксономические признаки",
   [field("organism","Организм","Назовите вид"),field("rank","Уровни классификации","Царство, тип, класс, отряд…")]),
 ],
 geography:[
  standard("map","Работа с картой","Территория, слой карты и географические объекты",
   [field("territory","Территория","Европа, Россия, материк"),field("layer","Тип карты","Политическая / физическая / контурная"),
    field("features","Найти / отметить","Страны, реки, горы, столицы",true)]),
  standard("coordinates","Географические координаты","Географический объект и координаты",
   [field("locations","Объекты","Города, вершины, крайние точки",true),
    field("coordinates","Координаты","Широта и долгота")]),
  standard("comparison","Сравнение территорий","Две территории и критерии сравнения",
   [field("regionA","Первая территория","Регион A"),field("regionB","Вторая территория","Регион B"),
    field("criteria","Критерии","Климат, рельеф, население",true)]),
 ],
 history:[
  standard("timeline","Хронология","События, даты и порядок",
   [field("events","События","Запишите события в произвольном порядке",true),
    field("period","Эпоха / период","Век, правление, период")]),
  standard("source","Исторический источник","Фрагмент и вопросы к источнику",
   [field("source","Текст источника","Цитата или описание документа",true),
    field("questions","Вопросы","Автор, период, причины, выводы",true)]),
  standard("map","Историческая карта","Эпоха, государство и территория",
   [field("period","Период","Год / век"),field("state","Государство","Название"),
    field("features","Что показать","Границы, события, походы",true)]),
 ],
 informatics:[
  standard("algorithm","Алгоритм","Данные, шаги и ожидаемый результат",
   [field("input","Входные данные","Значения и типы"),field("steps","Шаги / псевдокод","Последовательность действий",true),
    field("output","Ожидаемый результат","Что вывести?")]),
  standard("programming","Программирование","Язык, исходный код и требование",
   [field("language","Язык","Python, JavaScript, TypeScript"),field("code","Код / заготовка","Введите фрагмент кода",true),
    field("input","Входные данные","Пример ввода")]),
  standard("numeral","Системы счисления","Число и основание",
   [field("value","Исходное число","101101"),field("baseFrom","Из основания","2"),field("baseTo","В основание","10")]),
  standard("logic","Логика","Высказывания и логическая формула",
   [field("expression","Логическое выражение","(A ∧ B) ∨ ¬C"),field("inputs","Значения переменных","A=1, B=0, C=1")]),
 ],
 languages:[
  standard("translation","Перевод","Исходный текст и направление перевода",
   [field("original","Исходный текст","Предложение или небольшой текст",true),
    field("direction","Направление","На русский / на изучаемый язык")]),
  standard("gaps","Пропуски","Предложение с пропущенными словами",
   [field("sentence","Текст с пропусками","I ___ reading a book.",true),
    field("words","Слова на выбор","am, is, are")]),
  standard("vocabulary","Лексика","Слова и значения",
   [field("words","Слова","Список слов",true),field("topic","Тема","Дом, путешествия, школа")]),
  standard("grammar","Грамматика","Грамматическая конструкция и предложение",
   [field("construction","Правило / время","Present Perfect"),field("sentence","Предложения","Введите предложения",true)]),
 ],
 literature:[
  standard("analysis","Анализ произведения","Автор, произведение и аспект анализа",
   [field("author","Автор","Имя автора"),field("work","Произведение","Название"),
    field("aspects","Анализ","Тема, идея, композиция, герои",true)]),
  standard("quotation","Работа с цитатой","Цитата и вопрос к ней",
   [field("quote","Цитата","Фрагмент произведения",true),field("source","Источник","Автор, произведение"),
    field("question","Вопрос к цитате","Что раскрывает цитата?",true)]),
  standard("characters","Сравнение героев","Персонажи и критерии",
   [field("characters","Герои","Имена персонажей"),field("criteria","Критерии","Поступки, мотивы, речь",true)]),
 ],
 social:[
  standard("case","Обществоведческая ситуация","Описание ситуации и вопросы",
   [field("situation","Ситуация","Обстоятельства и действующие лица",true),
    field("concepts","Термины","Право, мораль, экономика"),field("questions","Вопросы","Причины и последствия",true)]),
  standard("classification","Классификация понятий","Понятия и основания группировки",
   [field("concepts","Понятия","Список для распределения",true),
    field("groups","Категории","Типы, признаки, уровни",true)]),
  standard("law","Правовая задача","Норма права и обстоятельства",
   [field("situation","Ситуация","Опишите обстоятельства",true),
    field("norm","Норма / понятие","Тема правового регулирования")]),
 ],
};
export function taskTemplateFor(tone:SubjectTone,format:string|undefined):SubjectTaskTemplate{
 const templates=subjectTaskTemplates[tone];
 return templates.find(template=>template.id===format)??templates[0];
}
export function freshTaskDetails(tone:SubjectTone,format:string):Record<string,string>{
 return Object.fromEntries(taskTemplateFor(tone,format).fields.map(field=>[field.id,""]));
}
export function subjectBoardHasWork(entry:SubjectBoardEntry):boolean{
 return Boolean(entry.title.trim()||entry.prompt.trim()||entry.solution.trim()||entry.answer.trim()||
 Object.values(entry.details??{}).some(value=>value.trim())||
 entry.steps?.some(step=>step.expression.replace(/[→⇌=\s]/g,"").trim()||step.conditions.trim()));
}
