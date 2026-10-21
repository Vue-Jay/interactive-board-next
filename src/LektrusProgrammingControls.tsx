import type {ProgrammingDiagram,ProgrammingLanguage} from "./lektrusProgrammingModel";
import {programmingPresets,programmingLanguageLabels} from "./lektrusProgrammingModel";

export default function LektrusProgrammingControls({diagram:d,onChange}:{
 diagram:ProgrammingDiagram;onChange:(value:ProgrammingDiagram)=>void;
}){
 const changeLanguage=(lang:ProgrammingLanguage)=>{
  const preset=programmingPresets.find(p=>p.language===lang)!;
  onChange({...d,language:lang,code:preset.code,stdin:preset.stdin});
 };
 const usePreset=(id:string)=>{
  const preset=programmingPresets.find(p=>p.id===id);
  if(!preset)return;
  onChange({...d,language:preset.language,code:preset.code,stdin:preset.stdin});
 };
 return <>
  <div className="lektrus-school-controls-heading">Редактор программы</div>
  <label className="lektrus-school-field">Язык программирования
   <select value={d.language} onChange={e=>changeLanguage(e.target.value as ProgrammingLanguage)}>
    {Object.entries(programmingLanguageLabels).map(([id,label])=>
     <option key={id} value={id}>{label}</option>)}
   </select>
  </label>
  <label className="lektrus-school-field">Учебный пример
   <select value="" onChange={e=>usePreset(e.target.value)}>
    <option value="">Выберите для загрузки примера…</option>
    {programmingPresets.filter(p=>p.language===d.language).map(p=>
     <option key={p.id} value={p.id}>{p.label}</option>)}
   </select>
  </label>
  <label className="lektrus-school-field">Код программы ({d.code.length}/20 000)
   <textarea value={d.code} spellCheck={false} maxLength={20000}
    rows={14} aria-label="Исходный код программы"
    onChange={e=>onChange({...d,code:e.target.value})}
    style={{fontFamily:"ui-monospace, SFMono-Regular, Consolas, monospace",
     fontSize:13,lineHeight:1.5,tabSize:2,resize:"vertical",minHeight:240,
     whiteSpace:"pre",overflowWrap:"normal"}}/>
  </label>
  <label className="lektrus-school-field">Стандартный ввод (каждая строка отдельно)
   <textarea value={d.stdin} rows={3} maxLength={2000} spellCheck={false}
    aria-label="Стандартный ввод программы"
    onChange={e=>onChange({...d,stdin:e.target.value})}
    placeholder="Введите тестовые значения для readLine()"
    style={{fontFamily:"ui-monospace, Consolas, monospace"}}/>
  </label>
  <label className="lektrus-school-toggle"><input type="checkbox" checked={d.showCode}
   onChange={e=>onChange({...d,showCode:e.target.checked})}/>
   Показывать исходный код ученикам на доске
  </label>
  <p className="lektrus-school-hint">
   Нажмите «Запустить» в предпросмотре, чтобы проверить программу. В JavaScript доступны
   console.log(), print(), readLine(), input и prompt(). Для TypeScript выполняется
   преобразование в JavaScript, затем запуск в изолированной среде.
   Сетевые запросы отключены, время выполнения ограничено четырьмя секундами.
   Код запускается только по нажатию, а результаты не сохраняются в доску.
  </p>
 </>;
}
