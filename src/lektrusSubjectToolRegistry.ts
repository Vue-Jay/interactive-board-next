import type {Item} from "./boardModel";

export type SubjectToolId =
  | "math-coordinate" | "math-numberline" | "math-trigonometry"
  | "math-geometry" | "math-quadrilateral" | "math-angle"
  | "math-fraction-circle" | "math-fraction-bar";

export type SubjectToolDefinition = {
  id:SubjectToolId; label:string; description:string; subjects:string[]; group:string;
};

export const subjectToolRegistry:SubjectToolDefinition[]=[
  {id:"math-coordinate",label:"Координатная плоскость",description:"Оси, точки и любые графики функций в одном редакторе",group:"Координаты и функции",subjects:["математика","алгебра","геометрия"]},
  {id:"math-numberline",label:"Числовая прямая",description:"Отмечайте числа, показывайте отрезки и промежутки",group:"Числа и дроби",subjects:["математика","алгебра"]},
  {id:"math-fraction-circle",label:"Дробный круг",description:"Наглядные доли круга: числитель и знаменатель",group:"Числа и дроби",subjects:["математика","алгебра"]},
  {id:"math-fraction-bar",label:"Дробная полоска",description:"Сравнение долей на прямоугольной модели",group:"Числа и дроби",subjects:["математика","алгебра"]},
  {id:"math-geometry",label:"Треугольник",description:"Перемещение вершин, стороны и периметр",group:"Геометрические построения",subjects:["математика","геометрия"]},
  {id:"math-quadrilateral",label:"Четырёхугольник",description:"Подвижные вершины и автоматически вычисляемый периметр",group:"Геометрические построения",subjects:["математика","геометрия"]},
  {id:"math-angle",label:"Угол",description:"Два луча и измерение угла при изменении положения точек",group:"Геометрические построения",subjects:["математика","геометрия"]},
  {id:"math-trigonometry",label:"Единичная окружность",description:"Радиус, углы и основные точки тригонометрии",group:"Геометрические построения",subjects:["математика","алгебра","геометрия"]}
];

export function subjectToolsFor(subject:string):SubjectToolDefinition[]{
  const key=subject.trim().toLocaleLowerCase("ru-RU");
  return subjectToolRegistry.filter(tool=>tool.subjects.includes(key));
}

export function makeSubjectToolItem(id:SubjectToolId,x:number,y:number,createId:()=>string):Item{
  const definition=subjectToolRegistry.find(t=>t.id===id);
  const title=definition?.label??"Учебный объект";
  if(id==="math-fraction-circle"||id==="math-fraction-bar")return{
    id:createId(),kind:"fraction",text:title,x:x-180,y:y-130,width:360,height:260,
    fractionMode:id==="math-fraction-circle"?"circle":"bar",fractionNumerator:3,fractionDenominator:4,color:"#5074dc"
  };
  const item:Item={
    id:createId(),kind:"graph",x:x-260,y:y-170,width:520,height:340,text:title,
    graphPurpose:"coordinates",graphAxisMode:"both",graphType:"quadratic",
    graphExpression:"",graphConnectPoints:false,graphA:1,graphB:0,graphC:0,
    graphXMin:-10,graphXMax:10,graphYMin:-6,graphYMax:6,graphGrid:true,
    graphPoints:[],graphShowLabels:true,graphSnap:true,graphAxisLabels:true,
    graphGridStep:1,graphShowCurve:false,graphProjections:false,
    graphSegments:[],graphAngles:[],graphCircles:[],graphPolygons:[],
    graphMidpoints:[],color:"#4267ce"
  };
  if(id==="math-coordinate")return item;
  if(id==="math-numberline")return{
    ...item,graphPurpose:"number-line",graphAxisMode:"x",graphGrid:false,
    graphAxisLabels:true,graphXMin:-10,graphXMax:10,
    graphYMin:-3,graphYMax:3,graphConnectPoints:true,
    graphIntervalStartClosed:false,graphIntervalEndClosed:true,
    graphPoints:[{x:-2,y:0,label:"−2"},{x:3,y:0,label:"3"}]
  };
  if(id==="math-geometry")return{
    ...item,graphPurpose:"geometry",graphAxisMode:"none",graphGrid:false,
    graphPoints:[{x:-4,y:-3,label:"A"},{x:4,y:-3,label:"B"},{x:0,y:3,label:"C"}],
    graphPolygons:[{points:[0,1,2],label:"ABC",measure:true}]
  };
  if(id==="math-quadrilateral")return{
    ...item,graphPurpose:"geometry",graphAxisMode:"none",graphGrid:false,
    graphPoints:[{x:-4,y:-3,label:"A"},{x:4,y:-3,label:"B"},{x:3,y:3,label:"C"},{x:-3,y:3,label:"D"}],
    graphPolygons:[{points:[0,1,2,3],label:"ABCD",measure:true}]
  };
  if(id==="math-angle")return{
    ...item,graphPurpose:"geometry",graphAxisMode:"none",graphGrid:false,
    graphPoints:[{x:4,y:0,label:"A"},{x:0,y:0,label:"O"},{x:3,y:4,label:"B"}],
    graphSegments:[{a:1,b:0,kind:"ray",label:"",measure:false},{a:1,b:2,kind:"ray",label:"",measure:false}],
    graphAngles:[{a:0,vertex:1,b:2,label:"∠AOB"}]
  };
  return{
    ...item,graphPurpose:"unit-circle",graphGrid:false,graphGridStep:.5,
    graphXMin:-2.7,graphXMax:2.7,graphYMin:-1.6,graphYMax:1.6,
    graphPoints:[
      {x:0,y:0,label:"O"},{x:1,y:0,label:"0"},
      {x:0,y:1,label:"π/2"},{x:-1,y:0,label:"π"},
      {x:0,y:-1,label:"3π/2"},
      {x:Math.SQRT1_2,y:Math.SQRT1_2,label:"π/4"}
    ],
    graphCircles:[{center:0,edge:1,label:"r = 1",measure:true}],
    graphSegments:[{a:0,b:1,kind:"segment",label:"",measure:false},{a:0,b:5,kind:"segment",label:"",measure:false}],
    graphAngles:[{a:1,vertex:0,b:5,label:"45°"}]
  };
}
