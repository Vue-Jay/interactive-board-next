/** Teacher-authored programs. Code is data until explicitly run inside the sandbox. */
export type ProgrammingLanguage="javascript"|"typescript";
export type ProgrammingDiagram={
 kind:"programming";title:string;language:ProgrammingLanguage;
 code:string;stdin:string;showCode:boolean;
};
export type ProgrammingPreset={id:string;label:string;language:ProgrammingLanguage;code:string;stdin:string};
export const programmingPresets:ProgrammingPreset[]=[
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
 javascript:"JavaScript",typescript:"TypeScript"
};
export const defaultProgrammingDiagram=():ProgrammingDiagram=>({
 kind:"programming",title:"Практикум программирования",language:"javascript",
 code:programmingPresets[0].code,stdin:programmingPresets[0].stdin,showCode:true
});
export function validateProgrammingDiagram(value:unknown):value is ProgrammingDiagram{
 if(!value||typeof value!=="object")return false;
 const d=value as Record<string,unknown>;
 return d.kind==="programming"&&typeof d.title==="string"&&
   d.title.trim().length>0&&d.title.length<=120&&
   (d.language==="javascript"||d.language==="typescript")&&
   typeof d.code==="string"&&d.code.length<=20000&&
   typeof d.stdin==="string"&&d.stdin.length<=2000&&
   typeof d.showCode==="boolean";
}
