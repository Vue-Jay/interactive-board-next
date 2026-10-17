import type {SciencePresetId} from "./lektrusSciencePresets";

export type ScienceToolId =
  "physics-mechanics"|"physics-optics"|"physics-graphs"|"physics-circuits"|"chem-molecules"|"chem-atoms"|"chem-organic"|"chem-formulas"|"chem-experiments";

export type ScienceToolGroup={
  id:ScienceToolId; subject:"physics"|"chem";
  label:string;description:string;group:string;
  templates:{id:SciencePresetId;label:string;hint:string}[];
};
export const scienceToolGroups:ScienceToolGroup[]=[
  {id:"physics-mechanics",subject:"physics",label:"Механика",
   description:"Силы, трение, рычаг, пружина и равновесие в одном редакторе",
   group:"Физика · движение и силы",templates:[
     {id:"physics-forces",label:"Силы на тело",hint:"Векторы действующих сил с подписями"},
     {id:"physics-incline",label:"Наклонная плоскость",hint:"Силы и геометрия наклонной поверхности"},
     {id:"physics-friction",label:"Сила трения",hint:"Силы на горизонтальной поверхности"},
     {id:"physics-lever",label:"Рычаг",hint:"Плечи сил и опора рычага"},
     {id:"physics-spring",label:"Пружина и упругость",hint:"Пружина и направления сил"},
     {id:"physics-equilibrium",label:"Равновесие сил",hint:"Схема равнодействующей и условий равновесия"}
   ]},
  {id:"physics-optics",subject:"physics",label:"Оптика",
   description:"Отражение, линзы, зеркало, призма и преломление",
   group:"Физика · свет",templates:[
     {id:"physics-optics",label:"Отражение света",hint:"Падающий и отражённый лучи"},
     {id:"physics-refraction",label:"Преломление",hint:"Граница двух сред и нормаль"},
     {id:"physics-lens",label:"Собирающая линза",hint:"Оптическая ось и построение лучей"},
     {id:"physics-diverging-lens",label:"Рассеивающая линза",hint:"Ход лучей через рассеивающую линзу"},
     {id:"physics-plane-mirror",label:"Плоское зеркало",hint:"Предмет и его мнимое изображение"},
     {id:"physics-total-reflection",label:"Полное отражение",hint:"Отражение света от границы сред"},
     {id:"physics-prism",label:"Призма",hint:"Преломление луча при прохождении призмы"}
   ]},
  {id:"physics-graphs",subject:"physics",label:"Графики движения",
   description:"Путь, скорость, ускорение, разгон и торможение без готовых решений",
   group:"Физика · движение и силы",templates:[
     {id:"physics-motion",label:"Путь от времени · s(t)",hint:"Точки и участки графика пути"},
     {id:"physics-speed",label:"Скорость от времени · v(t)",hint:"Равномерное движение"},
     {id:"physics-accelerated-speed",label:"Разгон · v(t)",hint:"Возрастание скорости со временем"},
     {id:"physics-acceleration",label:"Ускорение · a(t)",hint:"Постоянное ускорение"},
     {id:"physics-braking",label:"Торможение · v(t)",hint:"Убывание скорости со временем"},
     {id:"physics-rest",label:"Остановка на пути · s(t)",hint:"Постоянный путь во время остановки"}
   ]},
  {id:"physics-circuits",subject:"physics",label:"Электрические цепи",
   description:"Источники питания, провода, лампы, резисторы, выключатели и приборы",
   group:"Физика · электричество",templates:[
     {id:"physics-circuit-series",label:"Простая цепь",hint:"Источник, выключатель, резистор и лампа"},
     {id:"physics-circuit-meters",label:"Измерительные приборы",hint:"Амперметр и вольтметр в схеме"},
     {id:"physics-circuit-free",label:"Создать с нуля",hint:"Начните с чистого листа и добавьте компоненты"}
   ]},
  {id:"chem-molecules",subject:"chem",label:"Молекулы и связи",
   description:"Структурные схемы, атомы и связи: готовые молекулы внутри редактора",
   group:"Химия · молекулы",templates:[
     {id:"chem-water",label:"Вода · H₂O",hint:"Две связи O—H"},
     {id:"chem-carbon-dioxide",label:"Углекислый газ · CO₂",hint:"Двойные связи C=O"},
     {id:"chem-methane",label:"Метан · CH₄",hint:"Четыре связи C—H"},
     {id:"chem-ammonia",label:"Аммиак · NH₃",hint:"Три связи N—H"},
     {id:"chem-oxygen",label:"Кислород · O₂",hint:"Двойная связь O=O"}
   ]},
  {id:"chem-organic",subject:"chem",label:"Органические соединения",
   description:"Углеродные цепи, кольца и функциональные группы; редактируемые связи",
   group:"Химия · органика",templates:[
    {id:"chem-organic-ethane",label:"Этан · C₂H₆",hint:"Одинарная связь C—C"},
    {id:"chem-organic-ethene",label:"Этен · C₂H₄",hint:"Двойная связь C=C"},
    {id:"chem-organic-ethyne",label:"Этин · C₂H₂",hint:"Тройная связь C≡C"},
    {id:"chem-organic-ethanol",label:"Этанол · C₂H₆O",hint:"Гидроксильная группа —OH"},
    {id:"chem-organic-ethanoic",label:"Этановая кислота · C₂H₄O₂",hint:"Карбоксильная группа —COOH"},
    {id:"chem-organic-benzene",label:"Бензол · C₆H₆",hint:"Шестичленный цикл с чередующимися связями"},
    {id:"chem-organic-free",label:"Свободная структура",hint:"Стройте углеродный скелет по точкам"}
   ]},
  {id:"chem-formulas",subject:"chem",label:"Химические формулы и уравнения",
   description:"Формулы с нижними индексами и учебные уравнения реакций",
   group:"Химия · запись",templates:[
    {id:"chem-formula-water",label:"Формула воды · H₂O",hint:"Молекулярная формула"},
    {id:"chem-formula-combustion",label:"Горение метана",hint:"CH₄ + 2O₂ → CO₂ + 2H₂O"},
    {id:"chem-formula-neutralization",label:"Нейтрализация",hint:"HCl + NaOH → NaCl + H₂O"},
    {id:"chem-formula-free",label:"Своя формула или реакция",hint:"Введите формулу или уравнение"}
   ]},
  {id:"chem-experiments",subject:"chem",label:"Моделирование опытов",
   description:"Безопасные пошаговые схемы превращений и наблюдений, без лабораторных инструкций",
   group:"Химия · опыты",templates:[
    {id:"chem-experiment-salt",label:"Растворение соли",hint:"Ионы в воде · до и после"},
    {id:"chem-experiment-litmus",label:"Индикатор в кислоте",hint:"Синий лакмус становится красным"},
    {id:"chem-experiment-lime",label:"Углекислый газ и известковая вода",hint:"Образование осадка CaCO₃"}
   ]},
  {id:"chem-atoms",subject:"chem",label:"Строение атома",
   description:"Модели Бора, Резерфорда, Льюиса и состав атома; 118 элементов",
   group:"Химия · атом",templates:[
     {id:"chem-atom",label:"Модель атома",hint:"Схема ядра и оболочки"}
   ]}
];

export function scienceToolGroupForId(id:string):ScienceToolGroup|undefined{
  return scienceToolGroups.find(group=>group.id===id||group.templates.some(t=>t.id===id));
}
export function scienceDefaultPreset(id:string):SciencePresetId|undefined{
  return scienceToolGroupForId(id)?.templates[0]?.id;
}
