import type {Item} from "./boardModel";
import {makeMathPresetItem} from "./lektrusMathPresets";
import {makeSciencePresetItem, type SciencePresetId} from "./lektrusSciencePresets";

export type SubjectToolId="math-coordinate"|"math-fractions"|"math-formula"|"math-geometry"|SciencePresetId;
export type SubjectToolDefinition={id:SubjectToolId;label:string;description:string;subjects:string[];group:string};

export const subjectToolRegistry:SubjectToolDefinition[]=[
  {id:"math-formula",label:"Математическая формула",description:"Дроби, степени, корни, уравнения и математические символы",group:"Математические инструменты",subjects:["математика","алгебра","геометрия"]},
  {
    id:"math-geometry",label:"Построение фигур",
    description:"Плоские и объёмные фигуры, стороны, углы и вспомогательные линии",
    group:"Математические инструменты",subjects:["математика","геометрия"]
  },
  {
    id:"math-coordinate",label:"Координатная плоскость",
    description:"Функции, точки, числовая прямая и координаты",
    group:"Математические инструменты",subjects:["математика","алгебра","геометрия"]
  },
  {
    id:"math-fractions",label:"Дроби",
    description:"Круг и полоска с переключением, числителем и знаменателем",
    group:"Математические инструменты",subjects:["математика","алгебра"]
  },
  {id:"physics-forces",label:"Механика и силы",description:"Силы и векторы: перемещайте точки и подписывайте величины, без готовых ответов",group:"Физика · механика",subjects:["физика"]},
  {id:"physics-incline",label:"Наклонная плоскость",description:"Схема сил на наклонной плоскости для школьной задачи",group:"Физика · механика",subjects:["физика"]},
  {id:"physics-optics",label:"Оптика: лучи",description:"Падающий, отражённый лучи и линия зеркала",group:"Физика · оптика",subjects:["физика"]},
  {id:"physics-motion",label:"График движения",description:"Оси и подвижные точки графика зависимости величин",group:"Физика · движение",subjects:["физика"]},
  {id:"chem-water",label:"Молекула воды",description:"Редактируемая схема H₂O с атомами и связями",group:"Химия · структуры",subjects:["химия"]},
  {id:"chem-carbon-dioxide",label:"Молекула углекислого газа",description:"Редактируемая схема CO₂ с двойными связями",group:"Химия · структуры",subjects:["химия"]},
  {id:"chem-methane",label:"Молекула метана",description:"Редактируемая схема CH₄",group:"Химия · структуры",subjects:["химия"]},
  {id:"chem-atom",label:"Строение атома",description:"Оболочка, электроны и ядро на учебной схеме",group:"Химия · атом",subjects:["химия"]}
];

export function subjectToolsFor(subject:string):SubjectToolDefinition[]{
  const key=subject.trim().toLocaleLowerCase("ru-RU");
  return subjectToolRegistry.filter(tool=>tool.subjects.includes(key));
}
export function makeSubjectToolItem(id:SubjectToolId,x:number,y:number,createId:()=>string):Item{
  if(id.startsWith("physics-")||id.startsWith("chem-"))return makeSciencePresetItem(id as SciencePresetId,x,y,createId);
  if(id==="math-formula")return {id:createId(),kind:"formula",text:"x² + y² = r²",x:x-190,y:y-70,width:380,height:140,fontSize:28,color:"#20242c"};
  if(id==="math-fractions")return {
    id:createId(),kind:"fraction",text:"Дроби",x:x-180,y:y-130,width:360,height:260,
    fractionMode:"circle",fractionNumerator:3,fractionDenominator:4,color:"#5074dc"
  };
  return makeMathPresetItem(id==="math-geometry"?"free":"blank",x,y,createId());
}
