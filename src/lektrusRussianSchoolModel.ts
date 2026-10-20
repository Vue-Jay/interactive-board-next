/** Three agreed Russian-language tools. No automatic morphological or phonetic
 * predictions: the teacher is responsible for every linguistic annotation. */
export type RussianToolId="ru-morphology"|"ru-phonetics"|"ru-orthography";
export type RussianPartOfSpeech="noun"|"adjective"|"verb"|"pronoun"|"numeral"|"adverb"|"participle"|"gerund"|"preposition"|"conjunction"|"particle"|"interjection"|"other";
export type TraitGroup="permanent"|"variable"|"syntax";
export type MorphologyRow={id:string;group:TraitGroup;feature:string;value:string};
export type PhoneticLetter={id:string;letter:string;sounds:string[];characteristic:string;stressed:boolean};
export type OrthographyQuestion={id:string;prompt:string;options:string[];correct:number;explanation:string};
export type RussianSchoolDiagram=
 |{kind:"morphology";title:string;word:string;sentence:string;partOfSpeech:RussianPartOfSpeech;
   rows:MorphologyRow[];showAnalysis:boolean}
 |{kind:"phonetics";title:string;word:string;letters:PhoneticLetter[];
   showSounds:boolean;showCharacteristics:boolean}
 |{kind:"orthography";title:string;questions:OrthographyQuestion[];showExplanation:boolean};
export const russianToolIds:RussianToolId[]=["ru-morphology","ru-phonetics","ru-orthography"];
export const posNames:Record<RussianPartOfSpeech,string>={
 noun:"Имя существительное",adjective:"Имя прилагательное",verb:"Глагол",
 pronoun:"Местоимение",numeral:"Имя числительное",adverb:"Наречие",
 participle:"Причастие",gerund:"Деепричастие",preposition:"Предлог",
 conjunction:"Союз",particle:"Частица",interjection:"Междометие",
 other:"Другая часть речи"
};
export const traitGroupNames:Record<TraitGroup,string>={
 permanent:"Постоянные признаки",variable:"Непостоянные признаки",
 syntax:"Синтаксическая роль"
};
const id=(v:unknown)=>typeof v==="string"&&v.length>0&&v.length<=64;
const text=(v:unknown,max:number,allowEmpty=false)=>typeof v==="string"&&v.length<=max&&(allowEmpty||v.trim().length>0);
const unique=(rows:{id:string}[])=>new Set(rows.map(r=>r.id)).size===rows.length;
export function isRussianToolId(v:string|undefined):v is RussianToolId{
 return russianToolIds.includes(v as RussianToolId);
}
export function createRussianSchoolDiagram(tool:RussianToolId):RussianSchoolDiagram{
 if(tool==="ru-morphology")return {
  kind:"morphology",title:"Морфологический разбор",word:"",sentence:"",
  partOfSpeech:"noun",showAnalysis:false,rows:[]};
 if(tool==="ru-phonetics")return{
  kind:"phonetics",title:"Фонетический разбор",word:"",
  showSounds:false,showCharacteristics:false,letters:[]};
 return{kind:"orthography",title:"Орфографический тренажёр",showExplanation:true,questions:[]};
}
export function validateRussianSchoolDiagram(value:unknown):value is RussianSchoolDiagram{
 if(!value||typeof value!=="object")return false;
 const v=value as Record<string,unknown>;
 if(!text(v.title,120))return false;
 if(v.kind==="morphology"){
  if(!text(v.word,65,true)||!text(v.sentence,220,true)||
   !Object.prototype.hasOwnProperty.call(posNames,v.partOfSpeech as string)||
   typeof v.showAnalysis!=="boolean"||!Array.isArray(v.rows)||
   v.rows.length>18)return false;
  const rows=v.rows as MorphologyRow[];
  return unique(rows)&&rows.every(r=>r&&id(r.id)&&
   Object.prototype.hasOwnProperty.call(traitGroupNames,r.group)&&
   text(r.feature,52)&&text(r.value,90));
 }
 if(v.kind==="phonetics"){
  if(!text(v.word,36,true)||typeof v.showSounds!=="boolean"||
   typeof v.showCharacteristics!=="boolean"||!Array.isArray(v.letters)||
   v.letters.length>24)return false;
  const letters=v.letters as PhoneticLetter[];
  if(!unique(letters)||letters.some(l=>!l||!id(l.id)||
   !text(l.letter,4)||!Array.isArray(l.sounds)||l.sounds.length>2||
   l.sounds.some(sound=>!text(sound,12))||
   !text(l.characteristic,100,true)||typeof l.stressed!=="boolean"))return false;
  const stressed=letters.filter(l=>l.stressed);
  return stressed.length<=1&&
   (stressed.length===0||stressed[0].sounds.length>0)&&
   letters.map(l=>l.letter).join("")===v.word;
 }
 if(v.kind==="orthography"){
  if(typeof v.showExplanation!=="boolean"||!Array.isArray(v.questions)||
   v.questions.length>20)return false;
  const questions=v.questions as OrthographyQuestion[];
  return unique(questions)&&questions.every(q=>q&&id(q.id)&&text(q.prompt,180)&&
   q.prompt.split("□").length===2&&Array.isArray(q.options)&&
   q.options.length>=2&&q.options.length<=4&&
   q.options.every(s=>text(s,24))&&new Set(q.options.map(s=>s.trim())).size===q.options.length&&
   Number.isInteger(q.correct)&&q.correct>=0&&q.correct<q.options.length&&
   text(q.explanation,250,true));
 }
 return false;
}
export const totalSounds=(letters:PhoneticLetter[])=>letters.reduce((n,l)=>n+l.sounds.length,0);
