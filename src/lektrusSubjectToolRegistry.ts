import type {Item} from "./boardModel";
import {normalizeLektrusSubject} from "./lektrusSchoolSubjects";
import {makeSchoolDiagram,type SchoolDiagramId} from "./lektrusSchoolDiagramModel";
import {makeMathPresetItem} from "./lektrusMathPresets";
import {makeSciencePresetItem} from "./lektrusSciencePresets";
import {emptyMechanics} from "./lektrusMechanicsModel";
import {emptyMechanics} from "./lektrusMechanicsModel";
import {scienceDefaultPreset,scienceToolGroups,type ScienceToolId} from "./lektrusScienceCatalog";

export type SubjectToolId="math-coordinate"|"math-fractions"|"math-formula"|"math-geometry"|"chem-periodic-table"|ScienceToolId|SchoolDiagramId;
export type SubjectToolDefinition={id:SubjectToolId;label:string;description:string;subjects:string[];group:string};

/** A tool is a distinct editing workflow; its examples are selected INSIDE the editor. */
export const subjectToolRegistry:SubjectToolDefinition[]=[
  {id:"math-formula",label:"Математическая формула",description:"Степени, корни и математические символы",group:"Математические инструменты",subjects:["математика"]},
  {id:"math-geometry",label:"Построение фигур",description:"Плоские и объёмные фигуры, стороны и углы",group:"Математические инструменты",subjects:["математика"]},
  {id:"math-coordinate",label:"Координатная плоскость",description:"Функции, точки, числовая прямая и графики",group:"Математические инструменты",subjects:["математика"]},
  {id:"math-fractions",label:"Дроби",description:"Круг и полоска с наглядными частями",group:"Математические инструменты",subjects:["математика"]},
  {id:"chem-periodic-table",label:"Периодическая система",description:"118 элементов, поиск, семейства и выделение элементов для урока",group:"Химия · элементы",subjects:["химия"]},
  {id:"bio-dna",label:"Строение ДНК",description:"Комплементарность, последовательность оснований и направление цепей",group:"Биология · генетика",subjects:["биология"]},
  {id:"bio-taxonomy",label:"Классификация организмов",description:"Редактируемая схема таксономических рангов животных и растений",group:"Биология · систематика",subjects:["биология"]},
  {id:"bio-division",label:"Деление клетки",description:"Стадии митоза с подписями и учебными схемами",group:"Биология · клетка",subjects:["биология"]},
  {id:"info-encoding",label:"Кодирование текста",description:"Кодовые точки Unicode и байты UTF-8",group:"Информатика · информация",subjects:["информатика"]},
  {id:"bio-genetics",label:"Генетические скрещивания",description:"Моногибридные скрещивания, решётка Пеннета и скрытие ответов",group:"Биология · генетика",subjects:["биология"]},
  {id:"info-programming",label:"Программирование",description:"Код, компиляция TypeScript, запуск Python и JavaScript, ввод и консоль",group:"Информатика · программирование",subjects:["информатика"]},
  {id:"info-circuit",label:"Логические схемы",description:"Два настраиваемых логических элемента, три входа, интерактивное переключение сигналов",group:"Информатика · логика",subjects:["информатика"]},
  {id:"info-logic",label:"Логические операции",description:"Таблицы истинности пяти логических операций",group:"Информатика · логика",subjects:["информатика"]},
  {id:"bio-cell",label:"Строение клетки",description:"Растительная и животная клетки с подписями органоидов",group:"Биология · клетка",subjects:["биология"]},
  {id:"bio-food-chain",label:"Цепь питания",description:"Организмы и стрелки переноса вещества и энергии",group:"Биология · экосистемы",subjects:["биология"]},
  {id:"history-timeline",label:"Лента времени",description:"События и даты в хронологическом порядке",group:"История · хронология",subjects:["история"]},
  {id:"ru-syntax",label:"Разбор предложения",description:"Школьное подчёркивание членов предложения, без автоматического анализа",group:"Русский язык · синтаксис",subjects:["русский язык"]},
  {id:"info-flowchart",label:"Блок-схема алгоритма",description:"Начало, действие, ввод, вывод, условия и направленные стрелки",group:"Информатика · алгоритмы",subjects:["информатика","обществознание","история"]},
  {id:"info-place-value",label:"Системы счисления",description:"Разряды в системах с основаниями 2, 8, 10 и 16",group:"Информатика · информация",subjects:["информатика"]},
  {id:"bio-organ-systems",label:"Системы органов",description:"Пищеварительная и дыхательная системы, скрываемые подписи",group:"Биология · человек",subjects:["биология"]},
  {id:"ru-morphemes",label:"Разбор слова по составу",description:"Приставки, корни, суффиксы и окончания, основа и задания без ответов",group:"Русский язык · морфемика",subjects:["русский язык"]},
  {id:"history-family-tree",label:"Генеалогическое дерево",description:"Поколения, два родителя и редактируемые родственные связи",group:"История и обществознание · родословные",subjects:["история","обществознание"]},
  {id:"ru-sentence-builder",label:"Конструктор предложений",description:"Сборка предложения из слов и проверка порядка",group:"Русский язык · синтаксис",subjects:["русский язык"]},
  {id:"language-sentence-builder",label:"Составление предложений",description:"Интерактивное упражнение на порядок слов",group:"Иностранный язык · грамматика",subjects:["иностранный язык"]},
  {id:"literature-analysis",label:"Анализ произведения",description:"Тема, идея, композиция и сравнение персонажей в редактируемых схемах",group:"Литература · анализ текста",subjects:["литература"]},
  {id:"civics-structure",label:"Обществознание: учебные схемы",description:"Государство, общественные институты, социальные и экономические отношения",group:"Обществознание · схемы",subjects:["обществознание"]},
  {id:"language-flashcards",label:"Карточки слов",description:"Иностранные слова, перевод, транскрипция и переворот карточки",group:"Иностранные языки · лексика",subjects:["иностранный язык"]},
  {id:"ru-morphology",label:"Морфологический разбор",description:"Часть речи, постоянные и непостоянные признаки, скрываемые ответы",group:"Русский язык · морфология",subjects:["русский язык"]},
  {id:"ru-phonetics",label:"Фонетический разбор",description:"Буквы, звуки, ударение и ручная транскрипция",group:"Русский язык · фонетика",subjects:["русский язык"]},
  {id:"ru-orthography",label:"Орфографический тренажёр",description:"Орфограммы с пропусками и проверкой ответов на доске",group:"Русский язык · орфография",subjects:["русский язык"]},
  {id:"maps-atlas",label:"Географические карты",description:"Единая подложка: страны, контурная, физическая карта, рельеф, воды и города",group:"География · карты",subjects:["география"]},
  {id:"contour-atlas",label:"Контурная карта",description:"Отдельная контурная карта с раскрашиванием стран, маркером и очисткой",group:"География · карты",subjects:["география"]},
  {id:"geo-matching",label:"Сопоставление",description:"Флаги, контуры, страны и столицы: пары и генерация по сложности",group:"География · задания",subjects:["география"]},
  {id:"geo-question-cards",label:"Карточки вопросов",description:"Флаги, контуры и столицы: карточки с генерацией по сложности",group:"География · задания",subjects:["география"]},
  {id:"history-atlas",label:"Исторические карты",description:"Единая подложка: границы эпох, исторические события и ползунок времени",group:"История · карты",subjects:["история"]},
  ...scienceToolGroups.map(group=>({id:group.id,label:group.label,description:group.description,
    group:group.group,subjects:[group.subject==="physics"?"физика":"химия"]}))
];

export function subjectToolsFor(subject:string):SubjectToolDefinition[]{
  const key=normalizeLektrusSubject(subject).toLocaleLowerCase("ru-RU");
  return subjectToolRegistry.filter(tool=>tool.subjects.includes(key));
}

export function makeSubjectToolItem(id:SubjectToolId,x:number,y:number,createId:()=>string):Item{
  if(id==="info-programming"||id==="info-circuit"||id==="bio-dna"||id==="bio-taxonomy"||id==="bio-division"||id==="info-encoding"||id==="bio-genetics"||id==="info-logic"||id==="maps-atlas"||id==="history-atlas"||id==="contour-atlas"||id==="geo-matching"||id==="geo-question-cards"||id==="bio-cell"||id==="bio-food-chain"||id==="history-timeline"||
     id==="ru-syntax"||id==="info-flowchart"||id==="info-place-value"||
     id==="bio-organ-systems"||
     id==="ru-morphemes"||id==="history-family-tree"||id==="language-flashcards"||
     id==="ru-morphology"||id==="ru-phonetics"||id==="ru-orthography"||
     id==="ru-sentence-builder"||id==="language-sentence-builder"||id==="civics-structure"||id==="literature-analysis"){
    const diagram=makeSchoolDiagram(id);
    return {id:createId(),kind:"graph",text:diagram.title,
      x:x-405,y:y-225,width:810,height:450,graphFigureId:id,
      graphPurpose:"geometry",graphAxisMode:"none",graphGrid:false,graphSnap:false,
      graphPoints:[],graphSegments:[],schoolDiagram:diagram};
  }
  const sciencePreset=scienceDefaultPreset(id);
  if(sciencePreset){
    const item=makeSciencePresetItem(id==="physics-circuits"?"physics-circuit-free":sciencePreset,x,y,createId);
    // Subject tools open on a clean sheet; stored objects created earlier retain their content.
    if(id==="physics-mechanics")return {...item,text:"Механика",graphFigureId:"physics-forces",scienceMechanics:emptyMechanics(),
      graphPoints:[],graphSegments:[],graphPolygons:[],graphCircles:[],graphAngles:[],graphMidpoints:[],
      graphGrid:false,scienceMechanics:emptyMechanics()};
    if(id==="physics-optics")return {...item,text:"Оптика",graphFigureId:"physics-optics",
      graphPoints:[],graphSegments:[],graphPolygons:[],graphCircles:[],graphAngles:[],graphMidpoints:[],graphGrid:false};
    if(id==="physics-graphs")return {...item,text:"График движения",
      graphPoints:[],graphSegments:[],graphPolygons:[],graphCircles:[],graphAngles:[],graphMidpoints:[],
      graphGrid:true,graphConnectPoints:true};
    if(id==="physics-circuits")return {...item,text:"Электрическая цепь",graphPoints:[],graphSegments:[]};
    return item;
  }
  if(id==="chem-periodic-table"){
    const base=makeMathPresetItem("blank",x,y,createId());
    return {...base,text:"Периодическая система химических элементов",
      x:x-420,y:y-260,width:840,height:520,
      graphFigureId:"chem-periodic",graphPurpose:"geometry",
      graphAxisMode:"none",graphGrid:false,graphSnap:false,
      graphPoints:[],graphSegments:[],sciencePeriodicHighlights:[],sciencePeriodicLayout:"school",sciencePeriodicShowNames:true};
  }
  if(id==="math-formula")return {id:createId(),kind:"formula",text:"x² + y² = r²",x:x-190,y:y-70,width:380,height:140,fontSize:28,color:"#20242c"};
  if(id==="math-fractions")return {
    id:createId(),kind:"fraction",text:"Дроби",x:x-180,y:y-130,width:360,height:260,
    fractionMode:"circle",fractionNumerator:3,fractionDenominator:4,color:"#5074dc"
  };
  return makeMathPresetItem(id==="math-geometry"?"free":"blank",x,y,createId());
}
