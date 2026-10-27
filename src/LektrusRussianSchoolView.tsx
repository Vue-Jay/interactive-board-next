import {useEffect,useState,type SyntheticEvent} from "react";
import type {RussianSchoolDiagram} from "./lektrusRussianSchoolModel";
import {posNames,totalSounds,traitGroupNames} from "./lektrusRussianSchoolModel";
type Props={diagram:RussianSchoolDiagram;onChange?:(next:RussianSchoolDiagram)=>void};
function MorphologyGraphic({d}:{d:Extract<RussianSchoolDiagram,{kind:"morphology"}>}){
 const sections=["permanent","variable","syntax"] as const;
 return <svg viewBox="0 0 900 500" role="img" aria-label={d.title} className="lektrus-school-svg">
  <rect width="900" height="500" rx="20" fill="#fcfdff"/>
  <text x="450" y="39" fill="#264669" fontSize="25" fontWeight="750" textAnchor="middle">{d.title}</text>
  <rect x="60" y="64" width="780" height="74" rx="13" fill="#e9f1ff" stroke="#bacdeb"/>
  <text x="92" y="94" fill="#6a86a4" fontSize="15">Слово</text>
  <text x="172" y="98" fill="#284f8a" fontWeight="800" fontSize="25">{d.word}</text>
  <text x="92" y="121" fill="#56799c" fontSize="15">{posNames[d.partOfSpeech]}</text>
  {d.sentence&&<text x="450" y="166" textAnchor="middle" fill="#8195a8" fontSize="15">
   {d.sentence.length>72?d.sentence.slice(0,71)+"…":d.sentence}
  </text>}
  {sections.map((section,i)=>{
   const y=185+i*91,rows=d.rows.filter(row=>row.group===section&&row.feature.trim()&&row.value.trim());
   return <g key={section}>
    <rect x="60" y={y} width="780" height="80" rx="11" fill={i%2===0?"#f2f7fe":"#f8fbff"} stroke="#dce7f3"/>
    <text x="80" y={y+22} fill="#416b99" fontSize="16" fontWeight="750">{traitGroupNames[section]}</text>
    {d.showAnalysis?
     rows.slice(0,3).map((r,j)=><text key={r.id} x={80+(j%2)*390} y={y+46+Math.floor(j/2)*21}
      fontSize="14" fill="#3c5875">{r.feature}: <tspan fontWeight="700">{r.value.slice(0,37)}</tspan></text>):
     <g><line x1="84" x2="805" y1={y+54} y2={y+54} stroke="#afc6e2" strokeDasharray="6 7"/>
      <text x="440" y={y+48} textAnchor="middle" fontSize="13" fill="#91a6bd">Заполните самостоятельно</text></g>}
   </g>;
  })}
  <text x="450" y="482" textAnchor="middle" fill="#8a9eaf" fontSize="12">
   Морфологические признаки и часть речи задаются преподавателем
  </text>
 </svg>;
}
function PhoneticsGraphic({d}:{d:Extract<RussianSchoolDiagram,{kind:"phonetics"}>}){
 const n=d.letters.length,cell=Math.min(68,780/Math.max(1,n));
 const left=450-cell*n/2;
 const soundCount=totalSounds(d.letters),stress=d.letters.findIndex(l=>l.stressed);
 return <svg viewBox="0 0 900 500" role="img" aria-label={d.title} className="lektrus-school-svg">
  <rect width="900" height="500" rx="20" fill="#fcfdff"/>
  <text x="450" y="43" fill="#284b71" fontSize="25" fontWeight="750" textAnchor="middle">{d.title}</text>
  <text x="450" y="88" textAnchor="middle" fontSize="21" fill="#315987" fontWeight="700">Слово: {d.word}</text>
  <text x="450" y="119" textAnchor="middle" fontSize="14" fill="#7894ae">
   {n} букв · {d.showSounds?String(soundCount):"?"} звуков · ударение:
   {d.showSounds?(stress>=0?" отмечено":" не указано"):" ?"}
  </text>
  {d.letters.map((entry,i)=>{
   const x=left+i*cell;
   return <g key={entry.id}>
    <rect x={x+1.5} y="153" width={cell-3} height="82" rx="8" fill={i%2?"#f1f6ff":"#e8f2ff"} stroke="#bed2e8"/>
    <text x={x+cell/2} y="209" textAnchor="middle" fontSize={cell<43?22:32}
     fontWeight="800" fill="#345e9b">{entry.letter}</text>
    {d.showSounds&&entry.stressed&&<path d={`M${x+cell/2+7} 163l9-12`} stroke="#e07b55" strokeWidth="3" strokeLinecap="round"/>}
    <rect x={x+1.5} y="245" width={cell-3} height="68" rx="8" fill="#f5f9fc" stroke="#d5e2ef"/>
    <text x={x+cell/2} y="273" fill="#91a8bc" fontSize="12" textAnchor="middle">звук</text>
    <text x={x+cell/2} y="298" textAnchor="middle" fill="#396aa1" fontWeight="750"
     fontSize={cell<45?13:18}>{d.showSounds?(entry.sounds.length?entry.sounds.join(", "):"—"):"?"}</text>
   </g>;
  })}
  <rect x="65" y="332" width="770" height="101" rx="12" fill="#f2f7fd" stroke="#d7e4f2"/>
  <text x="88" y="357" fontSize="16" fill="#3a668d" fontWeight="750">Характеристика звуков</text>
  {d.showCharacteristics?
   d.letters.slice(0,6).map((entry,i)=><text key={entry.id} x={90+(i%2)*369}
    y={379+Math.floor(i/2)*19} fontSize="12" fill="#526f8e">
    {entry.letter}: {entry.characteristic.length>40?entry.characteristic.slice(0,39)+"…":entry.characteristic||"не указана"}
   </text>):
   <g><path d="M90 392H805" stroke="#b5cbe3" strokeDasharray="7 6"/>
    <text x="450" y="391" textAnchor="middle" fill="#91a6bc" fontSize="13">Характеристики скрыты для упражнения</text></g>}
  <text x="450" y="474" fontSize="12" textAnchor="middle" fill="#8299ad">
   Соответствие букв и звуков, ударение и транскрипцию заполняет учитель
  </text>
 </svg>;
}
function OrthographyBoard({d}:{d:Extract<RussianSchoolDiagram,{kind:"orthography"}>}){
 const [index,setIndex]=useState(0);
 const [picked,setPicked]=useState<number|null>(null);
 const [checked,setChecked]=useState(false);
 // Preserve the active question when classmates or the teacher update a different
 // question. Reset only if this particular question or its answers changed.
 const questionIds=d.questions.map(q=>q.id).join("|");
 useEffect(()=>setIndex(current=>Math.min(current,Math.max(0,d.questions.length-1))),[questionIds,d.questions.length]);
 const question=d.questions[Math.min(index,d.questions.length-1)];
 const signature=question?[question.id,question.prompt,...question.options,question.correct].join("\u0000"):"";
 useEffect(()=>{setPicked(null);setChecked(false)},[signature]);
 const ok=checked&&question!==undefined&&picked===question.correct;
 const ready=!!question&&question.prompt!=="□"&&
  question.options.length>=2&&question.options.every(option=>option.trim().length>0);
 const next=(i:number)=>{setIndex(i);setPicked(null);setChecked(false)};
 const stop=(e:SyntheticEvent)=>e.stopPropagation();
 if(!ready)return <div className="lektrus-orthography-board" role="status"
  onPointerDown={stop} onPointerUp={stop} onClick={stop}>
  <strong className="lektrus-orthography-title">{d.title}</strong>
  <p>Задание пока не заполнено. Преподавателю нужно указать слово и все варианты.</p>
 </div>;
 if(!question)return <div className="lektrus-orthography-board" role="status"
  onPointerDown={stop} onPointerUp={stop} onClick={stop}>
  <strong className="lektrus-orthography-title">{d.title}</strong>
  <p>Заданий пока нет. Добавьте слова и варианты ответов в редакторе.</p>
 </div>;
 return <div className="lektrus-orthography-board" role="group" aria-label={d.title}
  onPointerDown={stop} onPointerUp={stop} onClick={stop}>
  <strong className="lektrus-orthography-title">{d.title}</strong>
  <div className="lektrus-orthography-count">Задание {index+1} из {d.questions.length}</div>
  <div className="lektrus-orthography-prompt">{question.prompt.split("□")[0]}
   <span className="lektrus-orthography-gap">{picked===null?"□":question.options[picked]}</span>
   {question.prompt.split("□")[1]}</div>
  <div className="lektrus-orthography-answers" aria-label="Варианты ответа">
   {question.options.map((option,i)=><button key={i} type="button" disabled={checked}
    aria-pressed={picked===i} className={picked===i?"selected":""}
    onClick={()=>setPicked(i)}>{option}</button>)}
  </div>
  {checked?<div className={"lektrus-orthography-feedback "+(ok?"correct":"incorrect")} role="status">
   {ok?"Верно!":"Попробуйте ещё раз."}
   {d.showExplanation&&ok&&question.explanation&&<small>{question.explanation}</small>}
  </div>:<div className="lektrus-orthography-feedback neutral">Выберите ответ, затем нажмите «Проверить».</div>}
  <div className="lektrus-orthography-nav">
   <button type="button" disabled={index===0} onClick={()=>next(index-1)}>← Назад</button>
   {checked&&!ok?<button type="button" onClick={()=>{setPicked(null);setChecked(false)}}>Повторить</button>:
    <button type="button" disabled={picked===null||checked} onClick={()=>setChecked(true)}>Проверить</button>}
   <button type="button" disabled={index===d.questions.length-1}
    onClick={()=>next(index+1)}>Дальше →</button>
  </div>
 </div>;
}
const stopInline=(e:React.SyntheticEvent)=>e.stopPropagation();
export default function LektrusRussianSchoolView({diagram,onChange}:Props){
 if(diagram.kind==="orthography")return <OrthographyBoard d={diagram}/>;
 const inline=onChange&&<div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap",
  padding:"6px 9px",background:"#f5f9ff",fontSize:12,borderBottom:"1px solid #d8e5f2"}}>
  <label>Слово <input aria-label="Слово для разбора" value={diagram.word} maxLength={diagram.kind==="phonetics"?24:65}
   style={{border:"1px solid #c9dced",borderRadius:6,padding:5,maxWidth:160}}
   onChange={e=>{
    const word=e.target.value;
    if(diagram.kind==="morphology")onChange({...diagram,word});
    else onChange({...diagram,word,letters:[...word].map((letter,i)=>({
     id:diagram.letters[i]?.id??crypto.randomUUID(),letter,
     sounds:diagram.letters[i]?.letter===letter?diagram.letters[i].sounds:[],
     characteristic:diagram.letters[i]?.letter===letter?diagram.letters[i].characteristic:"",
     stressed:diagram.letters[i]?.letter===letter&&diagram.letters[i].stressed
    }))});
   }}/></label>
  {diagram.kind==="morphology"?<>
   <label>Часть речи <select value={diagram.partOfSpeech} onChange={e=>onChange({...diagram,
    partOfSpeech:e.target.value as typeof diagram.partOfSpeech})}>
    {Object.entries(posNames).map(([key,name])=><option value={key} key={key}>{name}</option>)}
   </select></label>
   <label><input type="checkbox" checked={diagram.showAnalysis}
    onChange={e=>onChange({...diagram,showAnalysis:e.target.checked})}/> Показать разбор</label>
  </>:<>
   <label><input type="checkbox" checked={diagram.showSounds}
    onChange={e=>onChange({...diagram,showSounds:e.target.checked})}/> Показать звуки</label>
   <label><input type="checkbox" checked={diagram.showCharacteristics}
    onChange={e=>onChange({...diagram,showCharacteristics:e.target.checked})}/> Характеристики</label>
  </>}
 </div>;
 return <div style={{display:"flex",flexDirection:"column",width:"100%",height:"100%"}}
  onPointerDown={stopInline} onPointerUp={stopInline} onClick={stopInline}>
  {inline}<div style={{flex:1,minHeight:0}}>
   {diagram.kind==="morphology"?<MorphologyGraphic d={diagram}/>:<PhoneticsGraphic d={diagram}/>}
  </div>
 </div>;
}
