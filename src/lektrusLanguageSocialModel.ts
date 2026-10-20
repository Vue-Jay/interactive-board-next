/** Approved classroom tools. Sentence patterns are curated examples, not a
 * morphological analyzer; civics diagrams are editable concepts, not legal advice. */
export type LanguageSocialId="ru-sentence-builder"|"civics-structure";
export type SentencePart={id:string;text:string};
export type SentencePattern={id:string;group:string;label:string;sample:string;tip:string};
export type StateNode={id:string;text:string;column:0|1|2|3;row:0|1|2|3|4;kind:"concept"|"institution"|"example"};
export type StateEdge={id:string;from:string;to:string;kind:"part"|"subordinate"|"interacts"};
export type LanguageSocialDiagram=
 |{kind:"sentence-builder";title:string;instructions:string;parts:SentencePart[];
   showKey:boolean;showHint:boolean;patternId:string}
 |{kind:"state-structure";title:string;subtitle:string;nodes:StateNode[];
   edges:StateEdge[];showRelationships:boolean;showLabels:boolean;templateId:string};
export const languageSocialIds:LanguageSocialId[]=["ru-sentence-builder","civics-structure"];
export const stateEdgeNames:Record<StateEdge["kind"],string>={
 part:"Состав / классификация",subordinate:"Подчинение",interacts:"Взаимодействие"
};
export const sentencePatterns:SentencePattern[]=[
 {id:"declarative",group:"Цель и интонация",label:"Повествовательное предложение",sample:"Наступила весна.",tip:"Сообщает о событии или факте."},
 {id:"question",group:"Цель и интонация",label:"Вопросительное предложение",sample:"Когда начнётся урок?",tip:"Содержит вопрос и завершается вопросительным знаком."},
 {id:"exclamatory",group:"Цель и интонация",label:"Восклицательное предложение",sample:"Как красиво вокруг!",tip:"Передаёт сильное чувство или побуждение."},
 {id:"imperative",group:"Цель и интонация",label:"Побудительное предложение",sample:"Откройте учебник.",tip:"Выражает просьбу, приказ или совет."},
 {id:"simple",group:"Простые предложения",label:"Простое двусоставное",sample:"Ученики читают книгу.",tip:"Одна грамматическая основа."},
 {id:"one-member",group:"Простые предложения",label:"Односоставное",sample:"На улице похолодало.",tip:"Один главный член предложения; не путать с неполным."},
 {id:"negative",group:"Простые предложения",label:"Отрицание",sample:"Сегодня дождя нет.",tip:"Отрицательная частица или слово внутри предложения."},
 {id:"circumstance",group:"Простые предложения",label:"Обстоятельство места",sample:"На поляне расцвели подснежники.",tip:"Обстоятельство отвечает на вопрос где?"},
 {id:"homogeneous-subject",group:"Однородные члены",label:"Однородные подлежащие",sample:"Листья и травы пожелтели.",tip:"Однородные члены связаны союзом «и»."},
 {id:"homogeneous-no-conjunction",group:"Однородные члены",label:"Однородные без союза",sample:"На столе лежат ручки, карандаши, тетради.",tip:"Однородные члены разделяются запятыми."},
 {id:"homogeneous-or",group:"Однородные члены",label:"Одиночный союз «или»",sample:"Мы поедем поездом или автобусом.",tip:"Между двумя однородными членами с одиночным «или» запятая не нужна."},
 {id:"homogeneous-but",group:"Однородные члены",label:"Противительный союз",sample:"День выдался холодным, но солнечным.",tip:"Перед «но» между однородными членами ставится запятая."},
 {id:"address-start",group:"Обращение и вводные слова",label:"Обращение в начале",sample:"Ребята, откройте тетради.",tip:"Обращение отделяется запятой."},
 {id:"address-middle",group:"Обращение и вводные слова",label:"Обращение в середине",sample:"Помоги мне, друг, решить задачу.",tip:"Обращение выделяется с двух сторон."},
 {id:"address-end",group:"Обращение и вводные слова",label:"Обращение в конце",sample:"До свидания, друзья!",tip:"Обращение отделяется запятой."},
 {id:"intro-word",group:"Обращение и вводные слова",label:"Вводное слово",sample:"К счастью, дождь прекратился.",tip:"Вводные слова обычно обособляются."},
 {id:"participial-after",group:"Обособленные конструкции",label:"Причастный оборот после определяемого слова",sample:"Дом, построенный недавно, уже заселили.",tip:"Причастный оборот после определяемого существительного обычно обособляется."},
 {id:"participle-before",group:"Обособленные конструкции",label:"Причастный оборот перед определяемым словом",sample:"Покрытый снегом лес казался тихим.",tip:"Перед определяемым словом оборот без добавочных причинных/уступительных оттенков обычно не обособляется."},
 {id:"gerund",group:"Обособленные конструкции",label:"Деепричастный оборот",sample:"Открыв книгу, ученик начал читать.",tip:"Деепричастный оборот обычно обособляется."},
 {id:"comparison",group:"Обособленные конструкции",label:"Сравнительный оборот",sample:"Облака плыли, словно белые корабли.",tip:"Сравнительный оборот с «словно» обычно обособляется; есть исключения."},
 {id:"compound-and",group:"Сложносочинённые",label:"Союз «и»",sample:"Солнце село, и на улице стало прохладно.",tip:"Две грамматические основы; с общим второстепенным членом возможны исключения."},
 {id:"compound-but",group:"Сложносочинённые",label:"Союз «но»",sample:"Ветер усилился, но дождь не начался.",tip:"Части сложносочинённого предложения разделяются запятой."},
 {id:"compound-or",group:"Сложносочинённые",label:"Разделительный союз",sample:"Начнётся дождь, или погода прояснится?",tip:"Части соединены разделительным союзом; пунктуация зависит от контекста."},
 {id:"subordinate-when",group:"Сложноподчинённые",label:"Придаточное времени",sample:"Когда закончился урок, ребята вышли из класса.",tip:"Придаточное отделяется запятой от главной части."},
 {id:"subordinate-if",group:"Сложноподчинённые",label:"Придаточное условия",sample:"Если будет тепло, мы пойдём гулять.",tip:"Союз «если» вводит придаточное условия."},
 {id:"subordinate-because",group:"Сложноподчинённые",label:"Придаточное причины",sample:"Мы остались дома, потому что началась гроза.",tip:"Союз «потому что» связывает причину и следствие."},
 {id:"subordinate-that",group:"Сложноподчинённые",label:"Изъяснительное придаточное",sample:"Я знаю, что ты справишься.",tip:"Придаточное поясняет содержание мысли или речи."},
 {id:"subordinate-which",group:"Сложноподчинённые",label:"Определительное придаточное",sample:"Я прочитал книгу, которую мне посоветовали.",tip:"Придаточное определяет существительное."},
 {id:"subordinate-so-that",group:"Сложноподчинённые",label:"Придаточное цели",sample:"Мы пришли пораньше, чтобы занять места.",tip:"Придаточное отвечает на вопрос зачем?"},
 {id:"as-syndetic-colon",group:"Бессоюзные сложные",label:"Пояснение после двоеточия",sample:"Я понял одно: пора возвращаться.",tip:"Вторая часть поясняет содержание первой."},
 {id:"as-syndetic-dash",group:"Бессоюзные сложные",label:"Тире между частями",sample:"Наступит весна — зазеленеют деревья.",tip:"Показаны условно-временные отношения."},
 {id:"as-syndetic-comma",group:"Бессоюзные сложные",label:"Запятая между частями",sample:"Солнце зашло, ветер стих.",tip:"Перечисление событий."},
 {id:"direct-speech",group:"Прямая речь",label:"Слова автора перед прямой речью",sample:"Учитель сказал: «Откройте тетради».",tip:"После слов автора ставится двоеточие."},
 {id:"direct-speech-first",group:"Прямая речь",label:"Прямая речь перед словами автора",sample:"«Я готов», — ответил ученик.",tip:"Учитываются кавычки, запятая и тире."},
 {id:"dialogue",group:"Прямая речь",label:"Реплика диалога",sample:"— Здравствуй!",tip:"Реплики диалога обозначаются тире."},
 {id:"parenthetical",group:"Пунктуация",label:"Уточняющий член",sample:"Вечером, около шести часов, начался концерт.",tip:"Уточнение времени обособлено."},
 {id:"apposition",group:"Пунктуация",label:"Приложение",sample:"Александр Пушкин, великий поэт, родился в Москве.",tip:"Распространённое приложение обособлено."},
 {id:"generalizing",group:"Пунктуация",label:"Обобщающее слово",sample:"Повсюду были цветы: на лугу, в саду, у дома.",tip:"После обобщающего слова перед перечислением ставится двоеточие."}
];
export const sentencePatternById=(id:string)=>sentencePatterns.find(v=>v.id===id);
export function tokenizeSentence(sample:string):SentencePart[]{
 // Spaces separate pieces. Punctuation remains attached to the teacher's token;
 // quotation marks and dashes can be standalone pieces.
 const terms=sample.trim().split(/\s+/u).filter(Boolean);
 return terms.map((text,i)=>({id:"w"+(i+1),text}));
}
export function initialScramble(parts:SentencePart[]):string[]{
 // Deterministic, stable across render/reopen and preserves exactly the multiset.
 const order=parts.map(p=>p.id);
 let seed=parts.reduce((sum,p)=>[...p.text].reduce((v,ch)=>((v*31+ch.charCodeAt(0))>>>0),sum),42);
 for(let i=order.length-1;i>0;i--){
  seed=(Math.imul(seed,1664525)+1013904223)>>>0;
  const j=seed%(i+1);[order[i],order[j]]=[order[j],order[i]];
 }
 if(order.every((id,i)=>id===parts[i].id)&&order.length>1){
  [order[0],order[1]]=[order[1],order[0]];
 }
 return order;
}
export const isLanguageSocialId=(id:string|undefined):id is LanguageSocialId=>
 languageSocialIds.includes(id as LanguageSocialId);
export function newLanguageSocialDiagram(id:LanguageSocialId):LanguageSocialDiagram{
 if(id==="ru-sentence-builder")return {kind:"sentence-builder",title:"Конструктор предложений",
  instructions:"Составьте предложение из слов и проверьте порядок.",showKey:false,showHint:true,
  patternId:"simple",parts:tokenizeSentence("Ученики читают книгу.")};
 return {kind:"state-structure",title:"Разделение государственной власти",subtitle:"Общая учебная схема принципа разделения властей",
  templateId:"separation",showRelationships:true,showLabels:true,
  nodes:[
   {id:"leg",text:"Законодательная власть",column:0,row:2,kind:"concept"},
   {id:"exec",text:"Исполнительная власть",column:1,row:2,kind:"concept"},
   {id:"jud",text:"Судебная власть",column:2,row:2,kind:"concept"}
  ],edges:[]};
}
export const civicsTemplates={
 separation:{label:"Разделение властей",subtitle:"Самостоятельные ветви власти; схема не означает подчинение друг другу",
  nodes:[
   {id:"leg",text:"Законодательная власть",column:0,row:2,kind:"concept"},
   {id:"exec",text:"Исполнительная власть",column:1,row:2,kind:"concept"},
   {id:"jud",text:"Судебная власть",column:2,row:2,kind:"concept"}
  ],edges:[]},
 stateForms:{label:"Форма государства",subtitle:"Три понятия, описывающих форму государства",
  nodes:[
   {id:"forms",text:"Форма государства",column:1,row:0,kind:"concept"},
   {id:"rule",text:"Форма правления",column:0,row:2,kind:"concept"},
   {id:"territory",text:"Территориальное устройство",column:1,row:2,kind:"concept"},
   {id:"regime",text:"Политический режим",column:2,row:2,kind:"concept"}
  ],edges:[
   {id:"e1",from:"forms",to:"rule",kind:"part"},
   {id:"e2",from:"forms",to:"territory",kind:"part"},
   {id:"e3",from:"forms",to:"regime",kind:"part"}
  ]},
 socialInstitutes:{label:"Общественные институты",subtitle:"Тематическая классификация для обществознания",
  nodes:[
   {id:"society",text:"Социальные институты",column:1,row:0,kind:"concept"},
   {id:"family",text:"Семья",column:0,row:2,kind:"example"},
   {id:"education",text:"Образование",column:1,row:2,kind:"example"},
   {id:"state",text:"Государство",column:2,row:2,kind:"example"}
  ],edges:[
   {id:"e1",from:"society",to:"family",kind:"part"},
   {id:"e2",from:"society",to:"education",kind:"part"},
   {id:"e3",from:"society",to:"state",kind:"part"}
  ]}
} as const;
const good=(s:unknown,max:number,allowEmpty=false)=>typeof s==="string"&&s.length<=max&&
 (allowEmpty||s.trim().length>0);
export function validateLanguageSocialDiagram(value:unknown):value is LanguageSocialDiagram{
 if(!value||typeof value!=="object")return false;
 const d=value as Record<string,unknown>;
 if(!good(d.title,120))return false;
 if(d.kind==="sentence-builder"){
  if(!good(d.instructions,180,true)||typeof d.showKey!=="boolean"||
   typeof d.showHint!=="boolean"||typeof d.patternId!=="string"||
   d.patternId.length>40||!Array.isArray(d.parts)||
   d.parts.length<2||d.parts.length>24)return false;
  const parts=d.parts as SentencePart[];
  return parts.every(w=>w&&good(w.id,64)&&good(w.text,65))&&
   new Set(parts.map(p=>p.id)).size===parts.length;
 }
 if(d.kind==="state-structure"){
  if(!good(d.subtitle,160,true)||!good(d.templateId,40,true)||
   typeof d.showRelationships!=="boolean"||typeof d.showLabels!=="boolean"||
   !Array.isArray(d.nodes)||d.nodes.length<1||d.nodes.length>15||
   !Array.isArray(d.edges)||d.edges.length>26)return false;
  const nodes=d.nodes as StateNode[],edges=d.edges as StateEdge[];
  if(!nodes.every(n=>n&&good(n.id,64)&&good(n.text,62)&&
   [0,1,2,3].includes(n.column)&&[0,1,2,3,4].includes(n.row)&&
   ["concept","institution","example"].includes(n.kind))||
   new Set(nodes.map(n=>n.id)).size!==nodes.length||
   new Set(nodes.map(n=>n.row+"-"+n.column)).size!==nodes.length)return false;
  const ids=new Set(nodes.map(n=>n.id));
  return edges.every(e=>e&&good(e.id,64)&&ids.has(e.from)&&ids.has(e.to)&&
   e.from!==e.to&&["part","subordinate","interacts"].includes(e.kind))&&
   new Set(edges.map(e=>e.id)).size===edges.length&&
   new Set(edges.map(e=>e.from+"|"+e.to+"|"+e.kind)).size===edges.length;
 }
 return false;
}
