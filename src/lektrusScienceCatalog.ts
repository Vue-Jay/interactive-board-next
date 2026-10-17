import type {SciencePresetId} from "./lektrusSciencePresets";

export type ScienceToolId =
  "physics-mechanics"|"physics-optics"|"physics-graphs"|"physics-circuits"|"chem-molecules"|"chem-atoms";

export type ScienceToolGroup={
  id:ScienceToolId; subject:"physics"|"chem";
  label:string;description:string;group:string;
  templates:{id:SciencePresetId;label:string;hint:string}[];
};
export const scienceToolGroups:ScienceToolGroup[]=[
  {id:"physics-mechanics",subject:"physics",label:"Механика",
   description:"Силы, свободное тело и наклонная плоскость в одном редакторе",
   group:"Физика · движение и силы",templates:[
     {id:"physics-forces",label:"Силы на тело",hint:"Векторы действующих сил с подписями"},
     {id:"physics-incline",label:"Наклонная плоскость",hint:"Силы и геометрия наклонной поверхности"}
   ]},
  {id:"physics-optics",subject:"physics",label:"Оптика",
   description:"Отражение, преломление и построение лучей",
   group:"Физика · свет",templates:[
     {id:"physics-optics",label:"Отражение света",hint:"Падающий и отражённый лучи"},
     {id:"physics-refraction",label:"Преломление",hint:"Граница двух сред и нормаль"},
     {id:"physics-lens",label:"Линза",hint:"Оптическая ось и построение лучей"}
   ]},
  {id:"physics-graphs",subject:"physics",label:"Графики движения",
   description:"Путь и скорость от времени с редактируемыми точками, без решения задач",
   group:"Физика · движение и силы",templates:[
     {id:"physics-motion",label:"Путь от времени · s(t)",hint:"Точки и участки графика пути"},
     {id:"physics-speed",label:"Скорость от времени · v(t)",hint:"Точки и участки графика скорости"}
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
