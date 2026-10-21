import type {ProgrammingDiagram,ProgrammingLanguage} from "./lektrusProgrammingModel";
import {programmingPresets,programmingLanguageLabels} from "./lektrusProgrammingModel";

export default function LektrusProgrammingControls({diagram:d,onChange}:{
 diagram:ProgrammingDiagram;onChange:(value:ProgrammingDiagram)=>void;
}){
 const changeLanguage=(lang:ProgrammingLanguage)=>{
  const preset=programmingPresets.find(p=>p.language===lang)!;
  onChange({...d,language:lang,code:preset.code,stdin:preset.stdin,tests:[]});
 };
 const usePreset=(id:string)=>{
  const preset=programmingPresets.find(p=>p.id===id);
  if(!preset)return;
  onChange({...d,language:preset.language,code:preset.code,stdin:preset.stdin,tests:[]});
 };
 const tests=d.tests??[];
 const updateTest=(id:string,key:"name"|"stdin"|"expected",value:string)=>onChange({...d,tests:tests.map(t=>t.id===id?{...t,[key]:value}:t)});
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
  <div className="lektrus-school-controls-heading">Проверочные примеры ({tests.length}/8)</div>
  <p className="lektrus-school-hint">Учитель задаёт вход и ожидаемый вывод. Ученик сможет запустить программу на всех наборах и увидеть результаты проверки. При смене языка или загрузке нового шаблона тесты очищаются.</p>
  {tests.map((test,i)=><div key={test.id} style={{border:"1px solid #d5e2ef",borderRadius:10,padding:10,marginBottom:9}}>
   <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:8}}>
    <span style={{fontWeight:700}}>Тест {i+1}</span>
    <input aria-label={"Название теста "+(i+1)} value={test.name} maxLength={60}
     onChange={e=>updateTest(test.id,"name",e.target.value)} style={{flex:1,minWidth:0}}/>
    <button type="button" title="Удалить тест" onClick={()=>onChange({...d,tests:tests.filter(t=>t.id!==test.id)})}>×</button>
   </div>
   <label className="lektrus-school-field">Входные данные
    <textarea rows={2} maxLength={2000} value={test.stdin} onChange={e=>updateTest(test.id,"stdin",e.target.value)} spellCheck={false}/>
   </label>
   <label className="lektrus-school-field">Ожидаемый вывод
    <textarea rows={2} maxLength={4000} value={test.expected} onChange={e=>updateTest(test.id,"expected",e.target.value)} spellCheck={false}/>
   </label>
  </div>)}
  <button type="button" className="lektrus-school-add" disabled={tests.length>=8}
   onClick={()=>onChange({...d,tests:[...tests,{id:crypto.randomUUID(),name:"Новый тест",stdin:"",expected:""}]})}>
   + Добавить тест</button>
  <label className="lektrus-school-toggle"><input type="checkbox" checked={d.showExpected??false}
   onChange={e=>onChange({...d,showExpected:e.target.checked})}/>Показывать ученику ожидаемый вывод тестов</label>
  <p className="lektrus-school-hint">
   Нажмите «Запустить» в предпросмотре, чтобы проверить программу. В JavaScript доступны
   console.log(), print(), readLine(), input и prompt(). Для Python работают print(), input(), циклы и стандартные модули. Для TypeScript выполняется
   преобразование в JavaScript, затем запуск в изолированной среде.
   JavaScript выполняется без доступа к сети, Python загружает WebAssembly-интерпретатор через интернет. Ограничение времени: 4 секунды для JavaScript и до 30 секунд для Python с загрузкой.
   Код запускается только по нажатию, а результаты не сохраняются в доску.
  </p>
 </>;
}
