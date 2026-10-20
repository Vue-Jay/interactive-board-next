import type {Item} from "./boardModel";
import {normalizeLektrusSubject} from "./lektrusSchoolSubjects";
import {makeSchoolDiagram,type SchoolDiagramId} from "./lektrusSchoolDiagramModel";
import {makeMathPresetItem} from "./lektrusMathPresets";
import {makeSciencePresetItem} from "./lektrusSciencePresets";
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
  {id:"bio-cell",label:"Строение клетки",description:"Растительная и животная клетки с подписями органоидов",group:"Биология · клетка",subjects:["биология"]},
  {id:"bio-food-chain",label:"Цепь питания",description:"Организмы и стрелки переноса вещества и энергии",group:"Биология · экосистемы",subjects:["биология"]},
  {id:"geo-climate",label:"Климатограмма",description:"Температура и осадки за 12 месяцев, оси и подписи",group:"География · климат",subjects:["география"]},
  {id:"history-timeline",label:"Лента времени",description:"События и даты в хронологическом порядке",group:"История · хронология",subjects:["история"]},
  {id:"ru-syntax",label:"Разбор предложения",description:"Школьное подчёркивание членов предложения, без автоматического анализа",group:"Русский язык · синтаксис",subjects:["русский язык"]},
  {id:"info-flowchart",label:"Блок-схема алгоритма",description:"Начало, действие, ввод, вывод, условия и направленные стрелки",group:"Информатика · алгоритмы",subjects:["информатика"]},
  {id:"info-place-value",label:"Системы счисления",description:"Разряды в системах с основаниями 2, 8, 10 и 16",group:"Информатика · информация",subjects:["информатика"]},
  {id:"bio-organ-systems",label:"Системы органов",description:"Пищеварительная и дыхательная системы, скрываемые подписи",group:"Биология · человек",subjects:["биология"]},
  {id:"geo-relief-profile",label:"Профиль рельефа",description:"Расстояния, высоты, условный профиль местности",group:"География · рельеф",subjects:["география"]},
  {id:"ru-morphemes",label:"Разбор слова по составу",description:"Приставки, корни, суффиксы и окончания, основа и задания без ответов",group:"Русский язык · морфемика",subjects:["русский язык"]},
  {id:"history-family-tree",label:"Генеалогическое дерево",description:"Поколения, два родителя и редактируемые родственные связи",group:"История и обществознание · родословные",subjects:["история","обществознание"]},
  {id:"language-flashcards",label:"Карточки слов",description:"Иностранные слова, перевод, транскрипция и переворот карточки",group:"Иностранные языки · лексика",subjects:["английский язык","иностранный язык"]},
  {id:"ru-morphology",label:"Морфологический разбор",description:"Часть речи, постоянные и непостоянные признаки, скрываемые ответы",group:"Русский язык · морфология",subjects:["русский язык"]},
  {id:"ru-phonetics",label:"Фонетический разбор",description:"Буквы, звуки, ударение и ручная транскрипция",group:"Русский язык · фонетика",subjects:["русский язык"]},
  {id:"ru-orthography",label:"Орфографический тренажёр",description:"Орфограммы с пропусками и проверкой ответов на доске",group:"Русский язык · орфография",subjects:["русский язык"]},
  ...scienceToolGroups.map(group=>({id:group.id,label:group.label,description:group.description,
    group:group.group,subjects:[group.subject==="physics"?"физика":"химия"]}))
];

export function subjectToolsFor(subject:string):SubjectToolDefinition[]{
  const key=normalizeLektrusSubject(subject).toLocaleLowerCase("ru-RU");
  return subjectToolRegistry.filter(tool=>tool.subjects.includes(key));
}

export function makeSubjectToolItem(id:SubjectToolId,x:number,y:number,createId:()=>string):Item{
  if(id==="bio-cell"||id==="bio-food-chain"||id==="geo-climate"||id==="history-timeline"||
     id==="ru-syntax"||id==="info-flowchart"||id==="info-place-value"||
     id==="bio-organ-systems"||id==="geo-relief-profile"||
     id==="ru-morphemes"||id==="history-family-tree"||id==="language-flashcards"||
     id==="ru-morphology"||id==="ru-phonetics"||id==="ru-orthography"){
    const diagram=makeSchoolDiagram(id);
    return {id:createId(),kind:"graph",text:diagram.title,
      x:x-405,y:y-225,width:810,height:450,graphFigureId:id,
      graphPurpose:"geometry",graphAxisMode:"none",graphGrid:false,graphSnap:false,
      graphPoints:[],graphSegments:[],schoolDiagram:diagram};
  }
  const sciencePreset=scienceDefaultPreset(id);
  if(sciencePreset)return makeSciencePresetItem(sciencePreset,x,y,createId);
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
