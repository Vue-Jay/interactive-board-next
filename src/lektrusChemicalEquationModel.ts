/** Chemistry equation editing and conservative stoichiometry.
 * Unrecognized formulas are never silently balanced: charges, radicals,
 * incomplete structures and reactions with a non-unique nullspace require review.
 */
export type EquationSpecies={formula:string;coefficient:number;indicator:""|"↑"|"↓"};
export type EquationArrow="→"|"⇌"|"=";
export type EquationDraft={left:EquationSpecies[];right:EquationSpecies[];arrow:EquationArrow};
export type BalanceResult={status:"empty"|"incomplete"|"invalid"|"unsupported"|"balanced"|"unbalanced";
 message:string;coefficients?:number[]};
export const blankSpecies=():EquationSpecies=>({formula:"",coefficient:1,indicator:""});
const arrows=/(⇌|⇄|↔|→|⟶|⟹|->|=)/;
const unicodeSub="₀₁₂₃₄₅₆₇₈₉";
const elements=new Set(("H He Li Be B C N O F Ne Na Mg Al Si P S Cl Ar K Ca Sc Ti V Cr Mn Fe Co Ni Cu Zn Ga Ge As Se Br Kr "+
"Rb Sr Y Zr Nb Mo Tc Ru Rh Pd Ag Cd In Sn Sb Te I Xe Cs Ba La Ce Pr Nd Pm Sm Eu Gd Tb Dy Ho Er Tm Yb Lu "+
"Hf Ta W Re Os Ir Pt Au Hg Tl Pb Bi Po At Rn Fr Ra Ac Th Pa U Np Pu Am Cm Bk Cf Es Fm Md No Lr "+
"Rf Db Sg Bh Hs Mt Ds Rg Cn Nh Fl Mc Lv Ts Og").split(" "));
export const normalizeFormulaInput=(s:string)=>s.replace(/[₀-₉]/g,n=>String(unicodeSub.indexOf(n)))
 .replace(/[（【]/g,"(").replace(/[）】]/g,")").replace(/[［]/g,"[").replace(/[］]/g,"]").trim();
function arrowValue(s:string):EquationArrow{return s==="⇌"||s==="⇄"||s==="↔"?"⇌":s==="="? "=":"→";}
export function splitEquationSide(text:string):string[]{
 const parts:string[]=[];let current="",depth=0;
 for(let i=0;i<text.length;i++){
  const ch=text[i];
  if(ch==="("||ch==="[")depth++;
  if(ch===")"||ch==="]")depth=Math.max(0,depth-1);
  if(ch==="+"&&depth===0){
   const next=text.slice(i+1).trimStart();
   const previous=current.trimEnd();
   // A plus sign inside an ion (Na+ + Cl−) is not a separator.
   const isSeparator=next.length===0?/\s$/.test(current):
    /^(?:[0-9]{0,3}[A-Z([{])/.test(next) &&
    !(/[+⁺]\s*$/.test(previous)&&next.startsWith("+"));
   if(isSeparator){parts.push(current.trim());current="";continue;}
  }
  current+=ch;
 }
 parts.push(current.trim());
 return parts;
}
export function readSpecies(value:string):EquationSpecies{
 const raw=value.trim();
 const match=raw.match(/^([1-9][0-9]{0,2})\s*(?=[A-Z([{])([\s\S]*)$/);
 const coefficient=match?Number(match[1]):1;
 let formula=match?match[2].trim():raw;
 const indicator=(formula.match(/[↑↓]$/)?.[0]??"") as EquationSpecies["indicator"];
 if(indicator)formula=formula.slice(0,-1).trimEnd();
 return {coefficient,formula,indicator};
}
export function parseEquationDraft(input:string):EquationDraft|null{
 if(!input.trim())return {left:[blankSpecies()],right:[blankSpecies()],arrow:"→"};
 const match=arrows.exec(input);
 if(!match)return null; // A standalone formula remains editable in source mode.
 const left=splitEquationSide(input.slice(0,match.index)).map(readSpecies);
 const right=splitEquationSide(input.slice(match.index+match[0].length)).map(readSpecies);
 if(left.length>10||right.length>10)return null;
 return {left,right,arrow:arrowValue(match[0])};
}
export function writeEquationDraft(e:EquationDraft):string{
 const side=(parts:EquationSpecies[])=>parts.map(p=>
  (p.formula.trim()?((p.coefficient>1?p.coefficient:"")+p.formula.trim()+p.indicator):"")).join(" + ");
 return side(e.left)+" "+e.arrow+" "+side(e.right);
}
/** Parses a neutral formula, including groups and hydration dots. Returns null for ions/uncertainties. */
export function countFormulaAtoms(input:string):Map<string,bigint>|null{
 const raw=normalizeFormulaInput(input).replace(/\s+/g,"");
 if(!raw||raw.length>120||/[+\-−⁺⁻^↑↓→⇌=]/.test(raw))return null;
 const full=new Map<string,bigint>();
 const add=(dest:Map<string,bigint>,sym:string,n:bigint)=>dest.set(sym,(dest.get(sym)??0n)+n);
 for(const part of raw.split(/[·.]/)){
  if(!part)return null;
  const prefix=part.match(/^([1-9]\d{0,2})(?=[A-Z([{])/);
  const factor=prefix?BigInt(prefix[1]):1n,fragment=prefix?part.slice(prefix[1].length):part;
  let i=0;
  const sequence=(closing=""):Map<string,bigint>|null=>{
   const result=new Map<string,bigint>();let entries=0;
   const number=()=>{
    const m=/^\d+/.exec(fragment.slice(i));if(!m)return 1n;
    i+=m[0].length;const value=BigInt(m[0]);return value>0n&&value<=9999n?value:0n;
   };
   while(i<fragment.length){
    const ch=fragment[i];
    if(closing&&ch===closing){i++;return entries?result:null;}
    if(ch==="("||ch==="["){
     i++;
     const nested=sequence(ch==="("?")":"]");
     if(!nested)return null;
     const times=number();if(!times)return null;
     for(const [s,v] of nested)add(result,s,v*times);
     entries++;continue;
    }
    const m=/^[A-Z][a-z]?/.exec(fragment.slice(i));
    if(!m||!elements.has(m[0]))return null;
    i+=m[0].length;const times=number();if(!times)return null;
    add(result,m[0],times);entries++;
   }
   return closing?null:entries?result:null;
  };
  const parsed=sequence();
  if(!parsed||i!==fragment.length)return null;
  for(const [s,v] of parsed)add(full,s,v*factor);
 }
 return full;
}
const abs=(n:bigint)=>n<0n?-n:n;
function gcd(a:bigint,b:bigint):bigint{a=abs(a);b=abs(b);while(b){const r=a%b;a=b;b=r;}return a||1n;}
type Fraction={n:bigint;d:bigint};
const f=(n:bigint,d=1n):Fraction=>{
 if(d===0n)throw new Error("Zero denominator");
 if(d<0n){n=-n;d=-d;}
 const divisor=gcd(n,d);return {n:n/divisor,d:d/divisor};
};
const minus=(a:Fraction,b:Fraction)=>f(a.n*b.d-b.n*a.d,a.d*b.d);
const mul=(a:Fraction,b:Fraction)=>f(a.n*b.n,a.d*b.d);
const div=(a:Fraction,b:Fraction)=>f(a.n*b.d,a.d*b.n);
export function inspectEquationBalance(e:EquationDraft):BalanceResult{
 const all=[...e.left,...e.right];
 if(all.every(s=>!s.formula.trim()))return {status:"empty",message:"Добавьте вещества по обе стороны стрелки"};
 if(!e.left.length||!e.right.length||all.some(s=>!s.formula.trim()))
  return {status:"incomplete",message:"Заполните формулы реагентов и продуктов"};
 if(all.length<2||all.length>12)return {status:"unsupported",message:"Поддерживается от 2 до 12 веществ"};
 const compositions=all.map(s=>countFormulaAtoms(s.formula));
 if(compositions.some(c=>!c))return {status:"unsupported",message:"Для заряженных и нестандартных формул автоматическая проверка недоступна"};
 const present=new Map<string,{left:boolean;right:boolean}>();
 compositions.forEach((c,index)=>{
  for(const sym of c!.keys()){
   const found=present.get(sym)??{left:false,right:false};
   if(index<e.left.length)found.left=true;else found.right=true;
   present.set(sym,found);
  }
 });
 if([...present.values()].some(v=>!v.left||!v.right))
  return {status:"invalid",message:"Не совпадает набор химических элементов в левой и правой частях"};
 const keys=[...present.keys()].sort(),n=all.length,m=keys.length;
 const matrix:Fraction[][]=keys.map(sym=>compositions.map((c,i)=>
  f((i<e.left.length?1n:-1n)*(c!.get(sym)??0n))));
 const current=all.map(s=>BigInt(s.coefficient||1));
 const okay=matrix.every(row=>row.reduce((sum,x,i)=>sum+x.n*current[i],0n)===0n);
 if(okay)return {status:"balanced",message:"Число атомов каждого элемента слева и справа совпадает"};
 let pivotRow=0;const pivots:number[]=[];
 for(let col=0;col<n&&pivotRow<m;col++){
  const selected=matrix.findIndex((row,i)=>i>=pivotRow&&row[col].n!==0n);
  if(selected<0)continue;
  [matrix[pivotRow],matrix[selected]]=[matrix[selected],matrix[pivotRow]];
  const pivot=matrix[pivotRow][col];
  matrix[pivotRow]=matrix[pivotRow].map(x=>div(x,pivot));
  for(let i=0;i<m;i++){
   if(i===pivotRow||matrix[i][col].n===0n)continue;
   const k=matrix[i][col];
   matrix[i]=matrix[i].map((x,j)=>minus(x,mul(k,matrix[pivotRow][j])));
  }
  pivots.push(col);pivotRow++;
 }
 const free=[...Array(n).keys()].filter(i=>!pivots.includes(i));
 if(free.length!==1)return {status:"unsupported",message:"Несколько вариантов расстановки коэффициентов: нужна ручная проверка"};
 const solution=Array.from({length:n},()=>f(0n));
 solution[free[0]]=f(1n);
 for(let row=pivots.length-1;row>=0;row--){
  const col=pivots[row];
  const sum=matrix[row].reduce((acc,c,i)=>i>col?minus(acc,mul(c,solution[i])):acc,f(0n));
  solution[col]=sum;
 }
 let common=1n;for(const v of solution)common=common/gcd(common,v.d)*v.d;
 let values=solution.map(v=>v.n*(common/v.d));
 if(values.every(v=>v<0n))values=values.map(v=>-v);
 if(values.some(v=>v<=0n))return {status:"unsupported",message:"Положительные коэффициенты однозначно не определены"};
 const divisor=values.reduce((a,b)=>gcd(a,b));
 values=values.map(v=>v/divisor);
 if(values.some(v=>v>999n))return {status:"unsupported",message:"Коэффициенты выходят за допустимый диапазон"};
 return {status:"unbalanced",message:"Коэффициенты можно расставить автоматически",
  coefficients:values.map(Number)};
}
