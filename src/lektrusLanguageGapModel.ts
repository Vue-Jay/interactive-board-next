import type {SubjectTaskActivity} from "./boardModel";

/** Author a gap naturally within text: square brackets contain the teacher's answer.
 * Bracket contents are never rendered to pupils, only the input slot is shown. */
export type GapDraft={activity:SubjectTaskActivity|undefined;issue:string|null;count:number};
export function parseLanguageGapText(source:string):GapDraft{
 const text=source.replace(/\r\n/g,"\n");
 const parts:{before:string;answer:string}[]=[];
 let fragment="",position=0;
 while(position<text.length){
  const current=text[position];
  if(current==="]")return {activity:undefined,issue:"Закрывающая скобка без начала пропуска",count:parts.length};
  if(current!=="["){fragment+=current;position++;continue;}
  const close=text.indexOf("]",position+1);
  if(close===-1)return {activity:undefined,issue:"Закройте пропуск квадратной скобкой",count:parts.length};
  const answer=text.slice(position+1,close);
  if(!answer.trim())return {activity:undefined,issue:"В пропуске должен быть правильный ответ",count:parts.length};
  if(answer.includes("["))
   return {activity:undefined,issue:"Пропуски нельзя вкладывать друг в друга",count:parts.length};
  if(answer.length>240||fragment.length>1200)
   return {activity:undefined,issue:"Укоротите текст фрагмента или ответ",count:parts.length};
  if(parts.length>=8)return {activity:undefined,issue:"В одном задании допускается до восьми пропусков",count:parts.length};
  parts.push({before:fragment,answer:answer.trim()});
  fragment="";position=close+1;
 }
 if(fragment.length>1200)return {activity:undefined,issue:"Укоротите текст после последнего пропуска",count:parts.length};
 if(!parts.length)return {activity:undefined,issue:text.trim()?"Выделите пропущенные буквы, знаки или слова квадратными скобками":null,count:0};
 const activity:SubjectTaskActivity={mode:"fill",blanks:parts,tail:fragment};
 return {activity,issue:null,count:parts.length};
}
export function languageGapText(activity?:SubjectTaskActivity):string{
 if(activity?.mode!=="fill")return "";
 return (activity.blanks??[]).map(part=>part.before+"["+part.answer+"]").join("")+(activity.tail??"");
}
export const isLanguageGapExercise=(subject:string,format:string|undefined):boolean=>
 (subject==="russian"&&(format==="orthography"||format==="punctuation"))||
 (subject==="languages"&&format==="gaps");
