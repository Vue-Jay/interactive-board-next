import type {Item} from "./boardModel";

export type SubjectToolId="math-function"|"math-coordinate"|"math-trigonometry"|"math-geometry";
export type SubjectToolDefinition={id:SubjectToolId;label:string;description:string;subjects:string[]};
export const subjectToolRegistry:SubjectToolDefinition[]=[
 {id:"math-function",label:"График функции",description:"Редактируемый график с формулой и осями",subjects:["математика","алгебра"]},
 {id:"math-coordinate",label:"Координатная плоскость",description:"Точки, сетка и координаты",subjects:["математика","алгебра","геометрия"]},
 {id:"math-trigonometry",label:"Тригонометрия",description:"Единичная окружность на координатной плоскости",subjects:["математика","алгебра"]},
 {id:"math-geometry",label:"Геометрические построения",description:"Треугольник и его вершины с возможностью редактирования",subjects:["математика","геометрия"]},
];
export function subjectToolsFor(subject:string):SubjectToolDefinition[]{
 const key=subject.trim().toLocaleLowerCase("ru-RU");
 return subjectToolRegistry.filter(entry=>entry.subjects.includes(key));
}
export function makeSubjectToolItem(id:SubjectToolId,x:number,y:number,createId:()=>string):Item{
 const common:Item={
  id:createId(),kind:"graph",x:x-260,y:y-170,width:520,height:340,text:"",
  graphType:"quadratic",graphExpression:"",graphConnectPoints:true,graphA:1,graphB:0,graphC:0,
  graphXMin:-10,graphXMax:10,graphYMin:-10,graphYMax:10,
  graphGrid:true,graphPoints:[],graphShowLabels:true,graphSnap:true,graphAxisLabels:true,
  graphGridStep:1,graphShowCurve:true,graphProjections:false,graphSegments:[],graphAngles:[],
  graphCircles:[],graphPolygons:[],graphMidpoints:[],color:"#365fc8"
 };
 if(id==="math-function")return {...common,graphExpression:"x^2 - 4*x + 3"};
 if(id==="math-coordinate")return {...common,graphExpression:"",graphPoints:[{x:2,y:3,label:"A",color:"#111111"},{x:-3,y:1,label:"B",color:"#111111"}]};
 if(id==="math-trigonometry")return {...common,graphXMin:-1.6,graphXMax:1.6,graphYMin:-1.6,graphYMax:1.6,graphGridStep:.5,graphCircles:[{center:0,edge:1,label:"Единичная окружность",measure:false}],graphPoints:[{x:0,y:0,label:"O",color:"#111111"},{x:1,y:0,label:"0",color:"#111111"},{x:0,y:1,label:"π/2",color:"#111111"},{x:-1,y:0,label:"π",color:"#111111"},{x:0,y:-1,label:"3π/2",color:"#111111"}]};
 return {...common,graphXMin:-8,graphXMax:8,graphYMin:-6,graphYMax:6,graphPoints:[{x:-4,y:-3,label:"A",color:"#111111"},{x:4,y:-3,label:"B",color:"#111111"},{x:0,y:3,label:"C",color:"#111111"}],graphPolygons:[{points:[0,1,2],label:"ABC",measure:false}]};
}
