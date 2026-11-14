import {useMemo} from "react";
import BoardApp from "./BoardApp";
import {defaultLabBench,addLabVessel} from "./lektrusChemistryBenchModel";
import {circuitTemplate} from "./lektrusCircuitModel";
import {makeSchoolDiagram} from "./lektrusSchoolDiagramModel";
import type {DocumentData,Item} from "./boardModel";
import type {BoardSummary} from "./boardStore";
import type {AuthUser} from "./authStore";

type Scene="math"|"chemistry"|"geometry"|"physics"|"russian"|"contour"|"history";
const sceneIds:Record<Scene,string>={math:"00000000-0000-4000-8000-0000000000a0",chemistry:"00000000-0000-4000-8000-0000000000a1",geometry:"00000000-0000-4000-8000-0000000000a2",physics:"00000000-0000-4000-8000-0000000000a3",contour:"00000000-0000-4000-8000-0000000000a4",russian:"00000000-0000-4000-8000-0000000000a5",history:"00000000-0000-4000-8000-0000000000a6"};
const sceneNames:Record<Scene,string>={math:"Функция и её график",chemistry:"Химическая лаборатория",geometry:"Геометрическое исследование",physics:"Электрическая цепь",contour:"Контурная карта Европы",russian:"Фонетический разбор",history:"Европа в 1914 году"};
const txt=(id:string,x:number,y:number,width:number,height:number,text:string,size:number,color="#1b334c",weight:"normal"|"bold"="normal"):Item=>({id,kind:"text",x,y,width,height,text,fontSize:size,color,fontWeight:weight,lineHeight:1.25});
const card=(id:string,x:number,y:number,width:number,height:number,text:string,color:string,size=20):Item=>({id,kind:"sticky",x,y,width,height,text,color,fontSize:size,lineHeight:1.4});
const graph=(id:string,x:number,y:number,width:number,height:number,text:string,values:Partial<Item>):Item=>({id,kind:"graph",x,y,width,height,text,color:"#315bd4",graphGrid:true,graphShowCurve:true,graphAxisMode:"both",graphAxisLabels:true,...values});

function documentFor(scene:Scene):DocumentData{
 const common:Item[]=[txt(`${scene}-eyebrow`,92,24,540,44,"LEKTRUS · ИНТЕРАКТИВНОЕ ПРОСТРАНСТВО",12,"#54806f","bold")];
 if(scene==="math"){
  const items:Item[]=[...common,
   txt("math-title",90,80,1120,76,"Исследуем квадратичную функцию",34,"#172d47","bold"),
   txt("math-subtitle",94,164,1120,52,"От выражения — к графику, таблице значений и свойствам",17,"#597189"),
   {id:"math-equation",kind:"formula",x:100,y:246,width:355,height:96,text:"y = x² − 4",color:"#315bd4",fontSize:34},
   card("math-note",100,372,355,166,"Вершина параболы\n(0; −4)\n\nНули функции: −2 и 2","#e7f6ef",21),
   graph("math-graph",510,230,600,470,"График функции",{graphPurpose:"function",graphType:"quadratic",graphA:1,graphB:0,graphC:-4,graphExpression:"y = x^2 - 4",graphXMin:-5,graphXMax:5,graphYMin:-6,graphYMax:8,graphShowLabels:true,graphGridStep:1}),
   {id:"math-values",kind:"table",x:1150,y:240,width:270,height:335,text:"Таблица значений",color:"#238b73",fontSize:18,tableRows:5,tableCols:2,tableHeader:true,tableStripe:true,tableCells:["x","y","−2","0","−1","−3","0","−4","2","0"]},
   card("math-check",1150,590,270,120,"Проверьте понимание\nЧто изменится, если к функции прибавить 3?","#fff2df",16),
   {id:"math-ruler",kind:"instrument",x:560,y:760,width:300,height:42,text:"",instrumentType:"ruler",instrumentScale:1,rotation:-2}
  ];
  return {version:1,title:sceneNames[scene],subject:"Математика",view:{x:0,y:0,zoom:1},items,background:{mode:"dots",color:"#fbfcfe",opacity:100}};
 }
 if(scene==="chemistry"){
  let bench=defaultLabBench();
  bench=addLabVessel(bench,"tube",{x:33,y:69});
  bench=addLabVessel(bench,"conical",{x:64,y:70});
  const items:Item[]=[...common,
   txt("chem-title",90,80,1120,76,"Из чего состоит вещество?",34,"#172d47","bold"),
   txt("chem-subtitle",94,164,1120,52,"Периодическая система и оборудование для опытов — рядом",17,"#597189"),
   graph("chem-periodic",85,230,720,470,"Периодическая система",{graphFigureId:"chem-periodic",sciencePeriodicLayout:"school",sciencePeriodicShowNames:true,sciencePeriodicHighlights:[1,6,8,11,17,26,29,79]}),
   graph("chem-lab",840,230,610,470,"Химический эксперимент",{graphFigureId:"chem-experiment-free",scienceLabBench:bench}),
   card("chem-note",95,730,540,110,"Найдите элемент → сравните свойства → подготовьте опыт","#e7f6ef",18),
   {id:"chem-arrow",kind:"connector",x:667,y:765,width:145,height:42,text:"",connectorStart:{x:0,y:20},connectorEnd:{x:140,y:20},connectorStyle:"arrow",color:"#338b74",weight:3},
   card("chem-tools",840,730,520,110,"Колбы и пробирки для опытов","#eaf1ff",18)
  ];
  return {version:1,title:sceneNames[scene],subject:"Химия",view:{x:0,y:0,zoom:1},items,background:{mode:"dots",color:"#fbfcfe",opacity:100}};
 }
 if(scene==="physics"){
  const items:Item[]=[...common,
   txt("physics-title",90,80,1120,76,"Почему загорается лампа?",34,"#172d47","bold"),
   txt("physics-subtitle",94,164,1120,52,"Соберите цепь и проследите, как выключатель управляет током",17,"#597189"),
   graph("physics-circuit",90,230,900,560,"Последовательная электрическая цепь",{graphFigureId:"physics-circuit-series",graphPurpose:"geometry",graphAxisMode:"none",scienceCircuit:circuitTemplate("physics-circuit-series")}),
   card("physics-question",1030,230,410,185,"Проверьте понимание\nЧто произойдёт, если разомкнуть ключ?","#fff2df",19),
   {id:"physics-quiz",kind:"quiz",x:1030,y:455,width:410,height:250,text:"Выберите верный ответ",fontSize:18,color:"#315bd4",quizOptions:["Лампа станет ярче","Цепь прервётся, лампа погаснет","Ничего не изменится"],quizCorrect:1,quizExplanation:"Разомкнутый ключ разрывает цепь, поэтому ток перестаёт течь."},
   card("physics-note",1030,740,410,100,"Источник · ключ · лампа · амперметр","#e7f6ef",17)
  ];
  return {version:1,title:sceneNames[scene],subject:"Физика",view:{x:0,y:0,zoom:1},items,background:{mode:"dots",color:"#fbfcfe",opacity:100}};
 }
 if(scene==="contour"){
  const map=makeSchoolDiagram("contour-atlas");
  if(map.kind==="atlas"){
   map.title="Контурная карта Европы";
   map.mode="contour";
   map.regionId="europe";
   map.showLabels=false;
   map.contourTask="Подпишите страны и отметьте столицы Центральной Европы.";
   map.contourAssignment={showBorders:true,showRegions:false,showCoastline:true,showRivers:false,showLakes:false,showGrid:false,showCapitals:false,showMajorCities:false,allowLabels:true,allowPoints:true,allowDrawing:true,allowFill:true};
  }
  const items:Item[]=[...common,
   txt("contour-title",90,80,1120,76,"Откройте Европу на контурной карте",33,"#172d47","bold"),
   txt("contour-subtitle",94,164,1120,52,"Подписывайте страны, отмечайте города и рисуйте прямо на карте",17,"#597189"),
   graph("contour-map",90,230,900,560,"Контурная карта Европы",{graphFigureId:"contour-atlas",graphPurpose:"geometry",graphAxisMode:"none",schoolDiagram:map}),
   card("contour-task",1030,230,410,160,"Задание\nПодпишите страны и отметьте столицы Центральной Европы.","#e7f6ef",18),
   {id:"contour-quiz",kind:"quiz",x:1030,y:430,width:410,height:250,text:"Какая река протекает через Будапешт?",fontSize:18,color:"#315bd4",quizOptions:["Дунай","Рейн","Сена"],quizCorrect:0,quizExplanation:"Будапешт расположен на обоих берегах Дуная."},
   card("contour-tools",1030,720,410,110,"Подписи · метки · заливка · рисунок","#eaf1ff",17)
  ];
  return {version:1,title:sceneNames[scene],subject:"География",view:{x:0,y:0,zoom:1},items,background:{mode:"dots",color:"#fbfcfe",opacity:100}};
 }
 if(scene==="history"){
  const map=makeSchoolDiagram("history-atlas");
  if(map.kind==="atlas"){
   map.title="Европа в 1914 году";
   map.year=1914;
   map.regionId="europe";
   map.mode="historical";
   map.showLabels=true;
   map.showEvents=true;
  }
  const items:Item[]=[...common,
   txt("history-title",90,80,1120,76,"Историческая карта: Европа в 1914 году",33,"#172d47","bold"),
   txt("history-subtitle",94,164,1120,52,"Сравнивайте эпохи, территории и события на одной доске",17,"#597189"),
   graph("history-map",90,230,900,560,"Исторический атлас",{graphFigureId:"history-atlas",graphPurpose:"geometry",graphAxisMode:"none",schoolDiagram:map}),
   card("history-question",1030,230,410,160,"Рассмотрите карту\nГраницы государств перед Первой мировой войной","#eaf1ff",18),
   {id:"history-quiz",kind:"quiz",x:1030,y:430,width:410,height:250,text:"Какая империя распалась после Первой мировой войны?",fontSize:17,color:"#315bd4",quizOptions:["Австро-Венгерская","Римская","Монгольская"],quizCorrect:0,quizExplanation:"Австро-Венгрия распалась в 1918 году."},
   card("history-note",1030,720,410,110,"Меняйте год и сравнивайте карты эпох","#e7f6ef",17)
  ];
  return {version:1,title:sceneNames[scene],subject:"История",view:{x:0,y:0,zoom:1},items,background:{mode:"dots",color:"#fbfcfe",opacity:100}};
 }
 if(scene==="russian"){
  const diagram=makeSchoolDiagram("ru-phonetics");
  if(diagram.kind==="phonetics"){
   diagram.word="дом";
   diagram.showSounds=true;
   diagram.showCharacteristics=true;
   diagram.letters=[
    {id:"ru-d",letter:"д",sounds:["д"],characteristic:"согласный, звонкий, твёрдый",stressed:false},
    {id:"ru-o",letter:"о",sounds:["о"],characteristic:"гласный, ударный",stressed:true},
    {id:"ru-m",letter:"м",sounds:["м"],characteristic:"согласный, звонкий, твёрдый",stressed:false}
   ];
  }
  const items:Item[]=[...common,
   txt("russian-title",90,80,1120,76,"Слово, буква и звук",34,"#172d47","bold"),
   txt("russian-subtitle",94,164,1120,52,"Разберите слово по звукам и проверьте себя",17,"#597189"),
   graph("russian-phonetics",85,230,760,500,"Фонетический разбор",{graphFigureId:"ru-phonetics",graphPurpose:"geometry",graphAxisMode:"none",schoolDiagram:diagram}),
   card("russian-rule",900,230,470,145,"Слушайте слово\nВ нём 3 буквы, 3 звука и один слог","#eaf1ff",19),
   {id:"russian-quiz",kind:"quiz",x:900,y:415,width:470,height:250,text:"Сколько звуков в слове «дом»?",fontSize:18,color:"#315bd4",quizOptions:["2","3","4"],quizCorrect:1,quizExplanation:"Каждая из трёх букв обозначает один звук."},
   card("russian-note",900,705,470,110,"Отмечайте ударение и характеристики звуков","#e7f6ef",17)
  ];
  return {version:1,title:sceneNames[scene],subject:"Русский язык",view:{x:0,y:0,zoom:1},items,background:{mode:"dots",color:"#fbfcfe",opacity:100}};
 }
 const items:Item[]=[...common,
  txt("geo-title",90,80,1120,76,"Постройте фигуру и проверьте гипотезу",33,"#172d47","bold"),
  txt("geo-subtitle",94,164,1120,52,"Измерьте стороны, изучите углы и проверьте ответ на задаче",16,"#597189"),
  graph("geo-triangle",100,230,660,480,"Свойства треугольника",{graphPurpose:"geometry",graphAxisMode:"none",graphSnap:true,graphShowLabels:true,graphPoints:[{x:-4,y:-2,label:"A"},{x:4,y:-2,label:"B"},{x:1,y:4,label:"C"}],graphSegments:[{a:0,b:1,kind:"segment",label:"8 см",measure:true},{a:1,b:2,kind:"segment",label:"5 см",measure:true},{a:2,b:0,kind:"segment",label:"6 см",measure:true}],graphPolygons:[{points:[0,1,2],label:"",measure:false}],graphAngles:[{a:0,vertex:2,b:1,label:"?",autoMeasure:true}],graphGrid:false}),
  card("geo-question",820,230,550,155,"Вопрос\nКак изменится площадь, если основание увеличить вдвое, а высоту оставить прежней?","#fff2df",20),
  {id:"geo-quiz",kind:"quiz",x:820,y:425,width:550,height:245,text:"Выберите верное утверждение",fontSize:18,color:"#315bd4",quizOptions:["Площадь не изменится","Площадь увеличится в 2 раза","Площадь увеличится в 4 раза"],quizCorrect:1,quizExplanation:"S = ½ · основание · высота. При удвоении основания площадь также удваивается."},
  {id:"geo-compass",kind:"instrument",x:1150,y:800,width:185,height:50,text:"",instrumentType:"triangle",instrumentScale:.6,rotation:0},
  card("geo-note",110,760,520,106,"Угольник помогает строить и проверять фигуры","#e7f6ef",17)
 ];
 return {version:1,title:sceneNames[scene],subject:"Математика",view:{x:0,y:0,zoom:1},items,background:{mode:"dots",color:"#fbfcfe",opacity:100}};
}
export default function PublicDemoBoard(){
 const params=useMemo(()=>new URLSearchParams(window.location.search),[]);
 const raw=params.get("scene");
 const scene:Scene=raw&&raw in sceneIds?raw as Scene:"math";
 const id=sceneIds[scene];
 const board:BoardSummary={id,title:sceneNames[scene],ownerId:"lektrus-public-demo",role:"owner",createdAt:"2026-01-01T00:00:00.000Z",updatedAt:"2026-01-01T00:00:00.000Z"};
 const user:AuthUser={id:"lektrus-public-demo",name:"Гость",email:"",createdAt:"2026-01-01T00:00:00.000Z",isGuest:true};
 const capture=params.get("capture")==="1";
 const key=`lesson-board.document.v1.board.${id}`;
 const seed=documentFor(scene);
 let useMemorySeed=false;
 try{
  const existing=localStorage.getItem(key);
  // Preserve edits on ordinary reloads. The capture query still resets the
  // demo intentionally for reproducible product screenshots.
  if(capture||!existing){
   localStorage.setItem(key,JSON.stringify(seed));
   useMemorySeed=true;
  }
 }catch{
  // Storage-blocked/private browsers can still explore an in-memory lesson.
  useMemorySeed=true;
 }
 return <BoardApp key={scene} authUser={user} boardSummary={board} accountRole="student" demoMode demoInitialDocument={useMemorySeed?seed:undefined} onBackToBoards={()=>window.location.assign("/")} onLogout={()=>window.location.assign("/")} onBoardChanged={()=>{}}/>;
}
