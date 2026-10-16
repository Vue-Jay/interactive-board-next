import type {Item} from "./boardModel";
import {makeMathPresetItem} from "./lektrusMathPresets";

export type SubjectToolId="math-coordinate"|"math-fractions";
export type SubjectToolDefinition={id:SubjectToolId;label:string;description:string;subjects:string[];group:string};

export const subjectToolRegistry:SubjectToolDefinition[]=[
  {
    id:"math-coordinate",label:"Координатная плоскость",
    description:"Функции, числовая прямая, фигуры, углы и тригонометрия в одном редакторе",
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
  if(id==="math-fractions")return {
    id:createId(),kind:"fraction",text:"Дроби",x:x-180,y:y-130,width:360,height:260,
    fractionMode:"circle",fractionNumerator:3,fractionDenominator:4,color:"#5074dc"
  };
  return makeMathPresetItem("blank",x,y,createId());
}
