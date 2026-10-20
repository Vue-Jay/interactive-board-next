import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";
const source=fs.readFileSync(new URL("../src/boardModel.ts",import.meta.url),"utf8");
const stripped=source.replace(/^import .*?;\s*$/gm,"").replace(/\bexport\s+(?=(?:type|interface|const|let|function|class)\b)/g,"");
const compiled=ts.transpileModule(stripped,{compilerOptions:{
 target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None
}}).outputText.replace(/^\s*export\s*\{.*\};?\s*$/gm,"");
const {parseDocument,packDocumentInk}=new Function(compiled+"\nreturn {parseDocument,packDocumentInk};")();
const item=(id,kind,data={})=>({id,kind,x:10,y:20,width:600,height:380,text:"Тест",...data});
const circuit={
 version:1,components:[],junctions:[],wires:[],showGrid:true,snap:true
};
const model={atomicNumber:8,mode:"orbital",labelX:0,labelY:0,showElectronConfiguration:true};
const graph=item("physics","graph",{
 graphPurpose:"geometry",graphFigureId:"physics-optics",graphAxisMode:"none",
 graphGrid:false,graphSnap:false,graphShowLabels:true,
 graphPoints:[{x:0,y:0,label:"O",labelDx:.6,labelDy:.8},
 {x:-4,y:3,label:"A"}],
 graphSegments:[{a:1,b:0,kind:"segment",label:"Луч",
 measure:false,scienceArrow:true,labelDx:1,labelDy:-1}],
 graphCircles:[],graphPolygons:[],graphAngles:[],graphMidpoints:[]
});
const docs=[
 item("mechanics","graph",{...graph,id:"mechanics",graphFigureId:"physics-forces"}),
 item("optics","graph",graph),
 item("chemical","graph",{graphPurpose:"geometry",graphFigureId:"chem-atom",
   scienceAtomModel:model,graphAxisMode:"none",graphGrid:false,graphPoints:[],graphSegments:[]}),
 item("circuit","graph",{graphPurpose:"geometry",graphFigureId:"physics-circuit-free",
   scienceCircuit:circuit,graphAxisMode:"none",graphGrid:true,graphPoints:[],graphSegments:[]}),
 item("periodic","graph",{graphPurpose:"geometry",graphFigureId:"chem-periodic",
   sciencePeriodicHighlights:[8,27],sciencePeriodicShowNames:true,graphPoints:[],graphSegments:[]}),
 item("organic","graph",{graphPurpose:"geometry",graphFigureId:"chem-organic-free",
  graphPoints:[{x:0,y:0,label:"C"},{x:2.15,y:0,label:"O"}],
  graphSegments:[{a:0,b:1,kind:"segment",label:"",measure:false,bondOrder:1}],
  scienceOrganicAnnotations:[{x:0,y:1,text:"OH"}]}),
 item("experiment","graph",{graphPurpose:"geometry",graphFigureId:"chem-experiments-free",
  scienceReagents:["HCl","NaOH"],scienceEnvironment:"aqueous",
  scienceExperimentStage:1,scienceReactionConditions:"Водная среда"}),
 item("math","graph",{graphPurpose:"geometry",graphFigureId:"triangle",
  graphGrid:false,graphPoints:[{x:0,y:0,label:"A"},{x:4,y:0,label:"B"},{x:1,y:3,label:"C"}],
  graphSegments:[],graphPolygons:[{points:[0,1,2],label:"",measure:false}],
  graphGivenSides:["4","",""],graphGivenAngles:[],graphTriangleInputMode:"SSS"}),
 item("bio-cell","graph",{graphFigureId:"bio-cell",graphPurpose:"geometry",schoolDiagram:{
  kind:"cell",title:"Растительная клетка",cell:"plant",showLabels:true,
  visible:["wall","membrane","cytoplasm","nucleus","vacuole","chloroplast","mitochondria"]}}),
 item("bio-food","graph",{graphFigureId:"bio-food-chain",graphPurpose:"geometry",schoolDiagram:{
  kind:"food-chain",title:"Цепь питания",showRoles:false,organisms:[
   {id:"a",name:"Трава",role:"producer"},{id:"b",name:"Полёвка",role:"consumer"},
   {id:"c",name:"Сова",role:"consumer"}]}}),
 item("geo-climate","graph",{graphFigureId:"geo-climate",graphPurpose:"geometry",schoolDiagram:{
  kind:"climate",title:"Учебная климатограмма",showLegend:true,
  months:Array.from({length:12},(_,i)=>({temperature:i-6,precipitation:20+i*5}))}}),
 item("hist-timeline","graph",{graphFigureId:"history-timeline",graphPurpose:"geometry",schoolDiagram:{
  kind:"timeline",title:"Лента времени",showEra:true,events:[
   {id:"a",year:988,label:"Крещение Руси"},{id:"b",year:1380,label:"Куликовская битва"}]}}),
 item("syntax","graph",{graphFigureId:"ru-syntax",graphPurpose:"geometry",schoolDiagram:{
  kind:"syntax",title:"Разбор предложения",showMarks:true,words:[
   {id:"w1",text:"Маленький",role:"attribute"},{id:"w2",text:"кот",role:"subject"},
   {id:"w3",text:"спит.",role:"predicate"}]}}),
 item("flowchart","graph",{graphFigureId:"info-flowchart",graphPurpose:"geometry",schoolDiagram:{
  kind:"flowchart",title:"Алгоритм с условием",showEdgeLabels:true,nodes:[
   {id:"n1",kind:"start",label:"Начало",lane:0},
   {id:"n2",kind:"process",label:"Действие",lane:0},
   {id:"n3",kind:"decision",label:"Условие?",lane:0},
   {id:"n4",kind:"end",label:"Конец",lane:0}],
  edges:[{id:"e1",from:"n1",to:"n2",label:""},{id:"e2",from:"n2",to:"n3",label:""},
   {id:"e3",from:"n3",to:"n4",label:"да"},{id:"e4",from:"n3",to:"n2",label:"нет"}]}}),
 item("place-value","graph",{graphFigureId:"info-place-value",graphPurpose:"geometry",schoolDiagram:{
  kind:"place-value",title:"Разрядная таблица",showPowers:true,base:16,digits:"2AF"}}),
 item("bio-organs","graph",{graphFigureId:"bio-organ-systems",graphPurpose:"geometry",schoolDiagram:{
  kind:"organs",title:"Пищеварительная система человека",system:"digestive",
  labels:["mouth","esophagus","stomach","liver","pancreas","small-intestine","large-intestine"]}}),
 item("geo-relief","graph",{graphFigureId:"geo-relief-profile",graphPurpose:"geometry",schoolDiagram:{
  kind:"relief",title:"Профиль рельефа",showGrid:true,showLabels:true,
  points:[{id:"a",distance:0,height:120,label:"Начало"},{id:"b",distance:12,height:280,label:"Вершина"},
   {id:"c",distance:25,height:-50,label:"Ниже уровня моря"}]}}),
 item("ru-morphemes","graph",{graphPurpose:"geometry",graphFigureId:"ru-morphemes",schoolDiagram:{
  kind:"morphemes",title:"Разбор слова",showMarks:true,showBase:true,zeroEnding:true,
  segments:[{id:"a",text:"под",role:"prefix"},{id:"b",text:"снеж",role:"root"},
   {id:"c",text:"ник",role:"suffix"}]}}),
 item("family","graph",{graphPurpose:"geometry",graphFigureId:"history-family-tree",schoolDiagram:{
  kind:"family-tree",title:"Родословная",showGenerations:true,
  people:[{id:"p",name:"Родитель",parents:[]},{id:"c",name:"Ребёнок",parents:["p"]}]}}),
 item("foreign","graph",{graphPurpose:"geometry",graphFigureId:"language-flashcards",schoolDiagram:{
  kind:"flashcards",title:"Слова",showTranslation:false,showTranscription:true,
  direction:"foreign-first",cards:[{id:"c",term:"book",translation:"книга",transcription:"[bʊk]"}]}}),
 item("ru-morphology","graph",{graphFigureId:"ru-morphology",graphPurpose:"geometry",schoolDiagram:{
  kind:"morphology",title:"Морфологический разбор",word:"лес",sentence:"Ветер шумит в лесу.",
  partOfSpeech:"noun",showAnalysis:false,
  rows:[{id:"r1",group:"permanent",feature:"Род",value:"Мужской"},
   {id:"r2",group:"variable",feature:"Падеж",value:"Предложный"}]}}),
 item("ru-phonetics","graph",{graphFigureId:"ru-phonetics",graphPurpose:"geometry",schoolDiagram:{
  kind:"phonetics",title:"Фонетический разбор",word:"кот",showSounds:false,showCharacteristics:false,
  letters:[{id:"l1",letter:"к",sounds:["к"],characteristic:"согласный, глухой",stressed:false},
   {id:"l2",letter:"о",sounds:["о"],characteristic:"гласный",stressed:true},
   {id:"l3",letter:"т",sounds:["т"],characteristic:"согласный",stressed:false}]}}),
 item("ru-orthography","graph",{graphFigureId:"ru-orthography",graphPurpose:"geometry",schoolDiagram:{
  kind:"orthography",title:"Орфографический тренажёр",showExplanation:true,questions:[
   {id:"q1",prompt:"Вставьте букву: тр□ва",options:["а","о"],correct:0,
    explanation:"Проверочное слово: травы."}]}}),
 item("sentence-builder","graph",{graphFigureId:"ru-sentence-builder",graphPurpose:"geometry",schoolDiagram:{
  kind:"sentence-builder",title:"Конструктор предложений",
  instructions:"Составьте предложение",showKey:false,showHint:true,patternId:"simple",
  parts:[{id:"w1",text:"Ребята"},{id:"w2",text:"читают"},{id:"w3",text:"книгу."}]}}),
 item("state-structure","graph",{graphFigureId:"civics-structure",graphPurpose:"geometry",schoolDiagram:{
  kind:"state-structure",title:"Форма государства",subtitle:"Учебная структура",templateId:"stateForms",
  showRelationships:true,showLabels:false,nodes:[
   {id:"root",text:"Форма государства",row:0,column:1,kind:"concept"},
   {id:"rule",text:"Форма правления",row:2,column:0,kind:"concept"},
   {id:"regime",text:"Политический режим",row:2,column:2,kind:"concept"}
  ],edges:[
   {id:"e1",from:"root",to:"rule",kind:"part"},
   {id:"e2",from:"root",to:"regime",kind:"part"}]}}),
 item("fraction","fraction",{fractionNumerator:1,fractionDenominator:3,fractionMode:"circle"}),
 item("table","table",{tableRows:2,tableCols:2,tableCells:["a","b","c","d"],
  tableHeader:true,tableAlign:"right",tableStripe:true,tableCompact:true})
];
const original={version:1,title:"Тест сохранения",subject:"Физика",
 view:{x:1,y:2,zoom:1},items:docs};
const loaded=parseDocument(JSON.stringify(original));
assert.equal(loaded.subject,"Физика","subject must survive reopen");
assert.equal(loaded.items.length,docs.length);
for(const expected of docs){
 const actual=loaded.items.find(x=>x.id===expected.id);
 assert.ok(actual,expected.id+" must survive");
 for(const [key,value] of Object.entries(expected)){
  assert.deepEqual(actual[key],value,expected.id+"."+key+" must survive reopen");
 }
}
// Damaged scientific content must be rejected rather than silently altered.
const invalidItem=(id,patch)=>{
 const sample=structuredClone(docs.find(v=>v.id===id));
 Object.assign(sample.schoolDiagram,patch);
 const payload={version:1,title:"Неверная схема",view:{x:0,y:0,zoom:1},items:[sample]};
 assert.throws(()=>parseDocument(JSON.stringify(payload)),/Повреждена предметная учебная схема/);
};
invalidItem("bio-cell",{cell:"animal",visible:["chloroplast"]});
invalidItem("bio-food",{organisms:[{id:"a",name:"Трава",role:"producer"},{id:"a",name:"Сова",role:"consumer"}]});
invalidItem("geo-climate",{months:Array.from({length:12},()=>({temperature:120,precipitation:23}))});
invalidItem("hist-timeline",{events:[{id:"a",year:0,label:"Ошибка"},{id:"b",year:100,label:"Второе"}]});
invalidItem("syntax",{words:[{id:"w",text:"",role:"subject"}]});
invalidItem("flowchart",{edges:[{id:"e1",from:"n1",to:"n3",label:""}]});
invalidItem("place-value",{base:2,digits:"102"});
invalidItem("bio-organs",{system:"respiratory",labels:["stomach"]});
invalidItem("geo-relief",{points:[{id:"a",distance:0,height:25,label:""},{id:"b",distance:0,height:100,label:""}]});
invalidItem("ru-morphemes",{zeroEnding:true,segments:[
 {id:"a",text:"дом",role:"root"},{id:"b",text:"а",role:"ending"}]});
invalidItem("family",{people:[
 {id:"p",name:"Родитель",parents:["c"]},{id:"c",name:"Ребёнок",parents:["p"]}]});
invalidItem("foreign",{cards:[{id:"same",term:"cat",translation:"кот",transcription:""},
 {id:"same",term:"dog",translation:"собака",transcription:""}]});
invalidItem("ru-morphology",{partOfSpeech:"unknown"});
invalidItem("ru-phonetics",{letters:[{id:"l1",letter:"к",sounds:["к"],characteristic:"",stressed:true},
 {id:"l2",letter:"о",sounds:["о"],characteristic:"",stressed:true}]});
invalidItem("ru-orthography",{questions:[{id:"q1",prompt:"Без пропуска",options:["о","а"],
 correct:1,explanation:""}]});
invalidItem("sentence-builder",{parts:[{id:"duplicate",text:"Слово"},{id:"duplicate",text:"Слово"}]});
invalidItem("state-structure",{edges:[{id:"bad",from:"root",to:"root",kind:"subordinate"}]});



const second=parseDocument(JSON.stringify(packDocumentInk(loaded)));
assert.deepEqual(second,loaded,"board must be stable after repeated reopening");
const app=fs.readFileSync(new URL("../src/App.tsx",import.meta.url),"utf8");
assert.match(app,/subject:lectrisBoardOrganization\.subject,[\s\S]{0,150}items: editing/);
assert.match(app,/storageKey\+"\.pending-sync"/);
assert.match(app,/snapshot\.current=packDocumentInk/);
console.log("Lektrus persistence: physics, circuit, orbital atoms, periodic highlights, geometry, fractions, tables and subject survive repeated reload.");
