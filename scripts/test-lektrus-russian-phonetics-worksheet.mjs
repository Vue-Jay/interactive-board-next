import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import ts from "typescript";

const read=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
const transpile=path=>ts.transpileModule(read(path),{
 fileName:path,compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.React}
}).outputText.replace(/^import[^\n]*;\s*$/gm,"")
 .replace(/^\s*export\s*\{[^}]*\};?\s*$/gm,"").replace(/^export /gm,"");
const logic=new Function(transpile("src/lektrusRussianWorkLogic.ts")+
 "\nreturn {emptyRussianPhoneticSound,russianPhoneticRows,russianPhoneticSoundCount,russianTaskHasWork};")();
const fresh=logic.russianPhoneticRows("ёлка");
assert.deepEqual(fresh.map(row=>row.letter),["ё","л","к","а"]);
assert.ok(fresh.every(row=>row.sounds.length===1&&row.sounds[0].text===""&&!row.silent));
const double=[{...logic.emptyRussianPhoneticSound(),text:"й'",kind:"consonant"},
 {...logic.emptyRussianPhoneticSound(),text:"о",kind:"vowel",stressed:true}];
const marked=[{...fresh[0],sounds:double},...fresh.slice(1)];
const response={source:"ёлка",phoneticLetters:marked};
assert.equal(logic.russianPhoneticSoundCount(marked),2);
assert.deepEqual(logic.russianPhoneticRows("ёлка",response),marked);
assert.equal(logic.russianPhoneticRows("ель",response)[0].sounds[0].text,"",
 "Changing the teacher's word resets stale pupil annotations");
assert.equal(logic.russianTaskHasWork(response),true);
assert.equal(logic.russianTaskHasWork({source:"ёлка",phoneticLetters:[]}),false);
const silent={...fresh[1],silent:true,sounds:[]};
assert.equal(logic.russianPhoneticSoundCount([silent]),0);

const file="src/boardModel.ts";
const compiled=ts.transpileModule(read(file).replace(/^import .*?;\s*$/gm,"")
 .replace(/\bexport\s+(?=(?:type|interface|const|let|function|class)\b)/g,""),{
 compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}
}).outputText.replace(/^\s*export\s*\{.*\};?\s*$/gm,"");
const {parseDocument}=new Function(compiled+"\nreturn {parseDocument};")();
const entry={id:"phonetics-1",kind:"task",subject:"russian",title:"Фонетика",prompt:"",
 format:"phonetics",details:{material:"ёлка"},answer:"",solution:"",revealed:false,russianWork:response};
const graph={id:"worksheet",kind:"graph",text:"Русский язык",x:0,y:0,width:820,height:470,
 graphFigureId:"subject-board-russian",graphPurpose:"geometry",graphAxisMode:"none",
 graphGrid:false,graphSnap:false,graphPoints:[],graphSegments:[],subjectBoardEntries:[entry]};
const doc=work=>JSON.stringify({version:1,title:"Русский",subject:"Русский язык",
 view:{x:0,y:0,zoom:1},items:[{...graph,subjectBoardEntries:[{...entry,russianWork:work}]}]});
assert.deepEqual(parseDocument(doc(response)).items[0].subjectBoardEntries[0].russianWork,response);
assert.throws(()=>parseDocument(doc({...response,phoneticLetters:[{...marked[0],sounds:[
 {...double[0],stressed:true},double[1]]},...marked.slice(1)]})),/Повреждён разбор/,
 "A consonant cannot be marked stressed");
assert.throws(()=>parseDocument(doc({...response,phoneticLetters:[{...marked[0],sounds:[
 {...double[0],kind:"vowel",stressed:true},double[1]]},...marked.slice(1)]})),/Повреждён разбор/,
 "At most one stressed vowel");
assert.throws(()=>parseDocument(doc({...response,phoneticLetters:[{...marked[0],silent:true},...marked.slice(1)]})),/Повреждён разбор/,
 "A silent letter cannot also emit sounds");
assert.throws(()=>parseDocument(doc({...response,phoneticLetters:[{...marked[0],letter:"и"},...marked.slice(1)]})),/Повреждён разбор/,
 "Saved phonetic letters must match the source word");

const answer=read("src/LektrusRussianTaskAnswer.tsx");
const board=read("src/LektrusSubjectBoard.tsx");
const studio=read("src/LektrusLanguageTaskStudio.tsx");
const registry=read("src/lektrusSubjectToolRegistry.ts");
for(const [name,source] of [["worksheet answer",answer],["studio",studio],["board",board]]){
 assert.equal(ts.createSourceFile(name+".tsx",source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX).parseDiagnostics.length,0,
  name+" must parse as TSX");
}
assert.ok(answer.includes('if(entry.format==="phonetics")'));
assert.ok(answer.includes('Звонкость')&&answer.includes('Твёрдость')&&answer.includes('Ударный'));
assert.ok(answer.includes('Звука нет')&&answer.includes('+ Второй звук'));
assert.ok(board.includes('["morphemes","syntax","morphology","phonetics","text"].includes(entry.format??"")'));
assert.ok(studio.includes('"russian:phonetics:material"'));
assert.ok(registry.includes('id:"ru-phonetics"')&&registry.includes('id==="ru-phonetics"'));
assert.ok(!/id:"ru-phonetics"[^\n]*subjects:\["русский язык"\]/.test(registry),
 "Legacy standalone phonetics must not appear as a duplicate subject tool");
console.log("Russian phonetic worksheets: two sounds, silent letters, single stress, persistence and UI wiring OK");
