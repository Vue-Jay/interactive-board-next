import type {Item} from "./boardModel";
import {makeMathPresetItem} from "./lektrusMathPresets";

export type SubjectToolId="math-coordinate"|"math-fractions"|"math-formula"|"math-geometry"|"math-solids";
export type SubjectToolDefinition={id:SubjectToolId;label:string;description:string;subjects:string[];group:string};

export const subjectToolRegistry:SubjectToolDefinition[]=[
  {id:"math-formula",label:"Математическая формула",description:"Дроби, степени, корни, уравнения и математические символы",group:"Математические инструменты",subjects:["математика","алгебра","геометрия"]},
  {
    id:"math-geometry",label:"Геометрический конструктор",
    description:"Фигуры, окружности, углы, медианы, высоты и биссектрисы",
    group:"Математические инструменты",subjects:["математика","геометрия"]
  },
  {
    id:"math-solids",label:"Геометрия 3D",
    description:"Куб, призма, пирамида, цилиндр и конус: построения без готовых ответов",
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
  }
];

export function subjectToolsFor(subject:string):SubjectToolDefinition[]{
  const key=subject.trim().toLocaleLowerCase("ru-RU");
  return subjectToolRegistry.filter(tool=>tool.subjects.includes(key));
}
export function makeSubjectToolItem(id:SubjectToolId,x:number,y:number,createId:()=>string):Item{
  if(id==="math-formula")return {id:createId(),kind:"formula",text:"x² + y² = r²",x:x-190,y:y-70,width:380,height:140,fontSize:28,color:"#20242c"};
  if(id==="math-fractions")return {
    id:createId(),kind:"fraction",text:"Дроби",x:x-180,y:y-130,width:360,height:260,
    fractionMode:"circle",fractionNumerator:3,fractionDenominator:4,color:"#5074dc"
  };
  return makeMathPresetItem(id==="math-geometry"?"triangle":id==="math-solids"?"cube":"blank",x,y,createId());
}
