/** Teacher-authored programs. Code is data until explicitly run inside the sandbox. */
export type ProgrammingLanguage="python"|"javascript"|"typescript";
export type ProgrammingTest={id:string;name:string;stdin:string;expected:string};
export function normalizeProgramOutput(text:string):string{return text.replace(/\r\n?/g,"\n").replace(/\n+$/,"")}
export type ProgrammingDiagram={
 kind:"programming";title:string;language:ProgrammingLanguage;
 code:string;stdin:string;showCode:boolean;tests?:ProgrammingTest[];showExpected?:boolean;
};
export type ProgrammingPreset={id:string;label:string;language:ProgrammingLanguage;code:string;stdin:string};
export const programmingPresets:ProgrammingPreset[]=[
 {id:"py-hello",label:"Приветствие и ввод",language:"python",stdin:"Ученик",
  code:'name = input("Как вас зовут? ")\nprint("Привет, " + name + "!")'},
 {id:"py-sum",label:"Сумма чисел",language:"python",stdin:"2 3 5",
  code:'numbers = list(map(int, input().split()))\nprint("Сумма:", sum(numbers))'},
 {id:"py-loops",label:"Цикл и таблица умножения",language:"python",stdin:"5",
  code:'n = int(input())\nfor i in range(1, 11):\n    print(f"{n} × {i} = {n * i}")'},
 {id:"py-empty",label:"Чистый Python",language:"python",stdin:"",code:""},
 {id:"js-hello",label:"Приветствие и ввод",language:"javascript",stdin:"Ученик",
  code:'const name = readLine() || "мир";\nconsole.log("Привет, " + name + "!");'},
 {id:"js-sum",label:"Сумма чисел",language:"javascript",stdin:"2 3 5",
  code:'const values = input.trim().split(/\\s+/).map(Number);\nconst sum = values.reduce((total, n) => total + n, 0);\nconsole.log("Сумма:", sum);'},
 {id:"js-loops",label:"Цикл и таблица умножения",language:"javascript",stdin:"5",
  code:'const number = Number(readLine() || 5);\nfor (let i = 1; i <= 10; i++) {\n  console.log(number + " × " + i + " = " + number * i);\n}'},
 {id:"ts-functions",label:"Функции и типы TypeScript",language:"typescript",stdin:"6",
  code:'function square(number: number): number {\n  return number * number;\n}\nconst value: number = Number(readLine() || 6);\nconsole.log("Квадрат:", square(value));'},
 {id:"js-empty",label:"Чистый JavaScript",language:"javascript",stdin:"",code:""},
 {id:"ts-empty",label:"Чистый TypeScript",language:"typescript",stdin:"",code:""}
];
export const programmingLanguageLabels:Record<ProgrammingLanguage,string>={
 python:"Python",javascript:"JavaScript",typescript:"TypeScript"
};
export const defaultProgrammingDiagram=():ProgrammingDiagram=>({
 kind:"programming",title:"Практикум программирования",language:"javascript",
 code:programmingPresets.find(p=>p.id==="js-hello")!.code,stdin:programmingPresets.find(p=>p.id==="js-hello")!.stdin,showCode:true,
 tests:[{id:"case-1",name:"Обычное имя",stdin:"Ученик",expected:"Привет, Ученик!"},
 {id:"case-2",name:"Другое имя",stdin:"Мир",expected:"Привет, Мир!"}],showExpected:false
});
export function validateProgrammingDiagram(value:unknown):value is ProgrammingDiagram{
 if(!value||typeof value!=="object")return false;
 const d=value as Record<string,unknown>;
 return d.kind==="programming"&&typeof d.title==="string"&&
   d.title.trim().length>0&&d.title.length<=120&&
   (d.language==="python"||d.language==="javascript"||d.language==="typescript")&&
   typeof d.code==="string"&&d.code.length<=20000&&
   typeof d.stdin==="string"&&d.stdin.length<=2000&&
   typeof d.showCode==="boolean"&&
   (d.showExpected===undefined||typeof d.showExpected==="boolean")&&
   (d.tests===undefined||(Array.isArray(d.tests)&&d.tests.length<=8&&
    new Set(d.tests.map((t:{id?:unknown})=>t?.id)).size===d.tests.length&&
    d.tests.every((t:unknown)=>{
     if(!t||typeof t!=="object")return false;
     const c=t as Record<string,unknown>;
     return typeof c.id==="string"&&c.id.length>0&&c.id.length<=64&&
      typeof c.name==="string"&&c.name.trim().length>0&&c.name.length<=60&&
      typeof c.stdin==="string"&&c.stdin.length<=2000&&
      typeof c.expected==="string"&&c.expected.length<=4000;
    })));
}
