export type MathAiMode="auto"|"arithmetic"|"equations"|"fractions"|"decimals"|"rounding"|"geometry"|"functions"|"vectors"|"percent"|"word"|"powers"|"prime"|"divisibility"|"probability"|"statistics"|"proportion"|"trigonometry"|"logarithms"|"sequence"|"combinatorics"|"division"|"algebra"|"absolute"|"domain"|"derivative"|"mixed";
export type MathAiLevel="primary"|"basic"|"advanced";
export type MathAiResult={title:string;items:string[];answers:string[];detected:string};

const rnd=(a:number,b:number)=>Math.floor(Math.random()*(b-a+1))+a;
const pick=<T,>(x:T[])=>x[rnd(0,x.length-1)];
const gcd=(a:number,b:number):number=>b?gcd(b,a%b):Math.abs(a);
const fmt=(n:number)=>Number.isInteger(n)?String(n):String(Math.round(n*100)/100).replace(".",",");
const signed=(n:number)=>n>=0?`+ ${n}`:`− ${Math.abs(n)}`;

function detect(topic:string,mode:MathAiMode):MathAiMode{
 if(mode!=="auto")return mode;
 const t=topic.toLowerCase();
 if(/числа и цифры от 0 до 20|состав числа в пределах 10|сложение и вычитание в пределах 20|простые текстовые задачи в одно действие|измерение длины отрезка в сантиметрах|таблицы и числовые закономерности|положение предметов и пространственные отношения|верные и неверные математические утверждения|двухшаговые инструкции с вычислениями и построением/.test(t))return"arithmetic";
 if(/геометрические фигуры начальной школы/.test(t))return"geometry";
 if(/график.*(?:квадрат|парабол)|квадрат.*функц|парабол.*функц/.test(t))return"functions";
 if(/округлен|оценк.*результат/.test(t))return"rounding";
 if(/скалярн.*произвед|вектор.*координат|координат.*вектор/.test(t))return"vectors";
 if(/касател.*(?:окруж|круг)|(?:окруж|круг).*касател/.test(t))return"geometry";
 if(/тригонометр|синус|косинус|тангенс|sin\b|cos\b/.test(t))return"trigonometry";
 if(/биномиальн|вероятност|шанс|монет|кубик|игральн кост/.test(t))return"probability";
 if(/делимост|признак делим/.test(t))return"divisibility";
 if(/десятичн.*дроб/.test(t))return"decimals";
 if(/арифметическ.*прогресс|прогресси/.test(t))return"sequence";
 if(/многозначн.*числ|сложен.*вычитан.*многознач/.test(t))return"arithmetic";
 if(/умножен.*делен.*натуральн|натуральн.*числ.*умножен.*делен/.test(t))return"arithmetic";
 if(/комбинатор|размещен|перестанов|сочетан/.test(t))return"combinatorics";
 if(/делени.*остат|остатк.*делени/.test(t))return"division";
 if(/формул.*сокращ.*умнож|разложени.*многочлен.*множител|многочлен.*множител/.test(t))return"algebra";
 if(/модул/.test(t))return"absolute";
 if(/област.*определени/.test(t))return"domain";
 if(/производн|касательн/.test(t))return"derivative";
 if(/координатн.*плоск|отрицательн.*числ/.test(t))return"arithmetic";
 if(/логарифм/.test(t))return"logarithms";
 if(/средн.*арифмет|медиан|мода|статистик|размах/.test(t))return"statistics";
 if(/прост.*чис|делител|разлож.*множител/.test(t))return"prime";
 if(/степен|корен|квадрат.*числ|куб.*числ/.test(t))return"powers";
 if(/пропорц|отношен|масштаб/.test(t))return"proportion";
 if(/об[ъь]?[её]м.*(?:цилиндр|призм)|цилиндр|призм.*об[ъь]?[её]м/.test(t))return"geometry";
 if(/вписанн.*окруж/.test(t))return"geometry";
 if(/неравен|квадратн|дискриминант|уравнен|систем/.test(t))return"equations";
 if(/геометр|треуг|круг|окруж|прямоуг|квадрат|площад|периметр|угол|теорем.*пифагор/.test(t))return"geometry";
 if(/дроб|числител|знаменател|рациональн.*числ/.test(t))return"fractions";
 if(/процент|скид|нацен/.test(t))return"percent";
 if(/функц|график|парабол|координат/.test(t))return"functions";
 if(/задач|скорост|время|расстоя|работ|движен/.test(t))return"word";
 if(/пример|вычисл|арифмет|порядок действий|числов.*буквен|отрицательн.*числ/.test(t))return"arithmetic";
 return"mixed";
}

function cubic(){
 const roots=[rnd(-6,6),rnd(-6,6),rnd(-6,6)];
 const [r1,r2,r3]=roots;
 const b=-(r1+r2+r3),c=r1*r2+r1*r3+r2*r3,d=-(r1*r2*r3);
 const term=(coef:number,power:string)=>{
  if(coef===0)return"";
  const sign=coef>0?"+":"−",abs=Math.abs(coef),body=`${abs===1&&power?"":abs}${power}`;
  return` ${sign} ${body}`;
 };
 const q=`x³${term(b,"x²")}${term(c,"x")}${term(d,"")} = 0`;
 return{q,a:`x₁ = ${r1}, x₂ = ${r2}, x₃ = ${r3}`};
}
function system2(index:number){
 const x=-5+(index%11),y=3+((index*3)%9),a=1+(index%5),b=1+((index*2+1)%5),c=1+((index*3+2)%5);let d=1+((index*4+3)%5);
   while(a*d-b*c===0)d=d%5+1;
 return{q:`Решите систему: ${a}x + ${b}y = ${a*x+b*y}; ${c}x ${d>=0?"+":"−"} ${Math.abs(d)}y = ${c*x+d*y}`,a:`x = ${x}, y = ${y}`};
}

function quadratic(index:number){
 const r1=-9+(index%19),candidate=-8+((index*7+3)%19),r2=candidate===r1?(candidate+1>9?-9:candidate+1):candidate,b=-(r1+r2),c=r1*r2;
 return {q:`x² ${signed(b)}x ${signed(c)} = 0`.replace("+ -","− "),a:`x₁ = ${r1}, x₂ = ${r2}`};
}
function linear(level:MathAiLevel){
 const x=rnd(level==="advanced"?-12:1,20),a=rnd(2,9),b=rnd(-18,20),c=a*x+b;
 return {q:`${a}x ${signed(b)} = ${c}`,a:`x = ${x}`};
}
function arithmetic(level:MathAiLevel){
 const a=rnd(12,120),b=rnd(2,40);
 if(level==="primary"){const op=pick(["+","−","×"]);if(op==="+")return{q:`${a} + ${b} =`,a:String(a+b)};if(op==="−"){const minuend=Math.max(a,b),subtrahend=Math.min(a,b);return{q:`${minuend} − ${subtrahend} =`,a:String(minuend-subtrahend)}}const x=rnd(2,12),y=rnd(2,12);return{q:`${x} × ${y} =`,a:String(x*y)}}
 const m=rnd(2,12),n=rnd(2,15),c=rnd(2,25),subtract=rnd(2,30);
 return{q:`${m} · (${n} + ${c}) − ${subtract} =`,a:String(m*(n+c)-subtract)};
}
function fraction(index:number){
 const b=2+(index%19),a=1+(index%(b-1)),d=b+1,c=1+(index%(d-1)),op=index%2===0?"+":"−";
 const num=op==="+"?a*d+c*b:a*d-c*b,den=b*d,g=gcd(num,den);
 return{q:`${a}/${b} ${op} ${c}/${d} =`,a:`${num/g}/${den/g}`};
}
function geometry(level:MathAiLevel){
 const kind=pick(level==="advanced"?["pythagoras","circle","triangle","rectangle"]:["rectangle","triangle","circle"]);
 if(kind==="rectangle"){const a=rnd(3,18),b=rnd(3,18);return{q:`Прямоугольник имеет стороны ${a} см и ${b} см. Найдите площадь и периметр.`,a:`S = ${a*b} см²; P = ${2*(a+b)} см`}}
 if(kind==="triangle"){const a=rnd(4,16),h=rnd(3,14);return{q:`Основание треугольника ${a} см, высота к нему ${h} см. Найдите площадь.`,a:`S = ${fmt(a*h/2)} см²`}}
 if(kind==="circle"){const r=rnd(2,12);return{q:`Радиус круга ${r} см. Найдите длину окружности и площадь круга. π ≈ 3,14.`,a:`L ≈ ${fmt(2*3.14*r)} см; S ≈ ${fmt(3.14*r*r)} см²`}}
 const triples=pick([[3,4,5],[5,12,13],[6,8,10],[8,15,17]]);return{q:`Катеты прямоугольного треугольника равны ${triples[0]} см и ${triples[1]} см. Найдите гипотенузу.`,a:`${triples[2]} см`};
}
function percent(){
 const price=rnd(10,200)*10,p=pick([5,10,15,20,25,30,40]);
 return{q:`Товар стоит ${price} руб. Цена ${Math.random()>.5?"уменьшилась":"увеличилась"} на ${p}%. На сколько рублей изменится цена?`,a:`${price*p/100} руб.`};
}
function func(index:number){
 const k=[-4,-3,-2,2,3,4][index%6],b=-8+((index*3)%17),x=-5+(index%11);
 return{q:`Для функции y = ${k}x ${signed(b)} найдите y при x = ${x}.`,a:`y = ${k*x+b}`};
}
function word(index:number){
 const v=35+(index*7)%56,t=2+(index%7);return{q:`Автомобиль ехал ${t} ч со скоростью ${v} км/ч. Какое расстояние он проехал?`,a:`${v*t} км`};
}
function powers(index:number,topic:string){
 if(/корен/.test(topic)){
  const roots=[2,3,4,5,6,7,8,9,10,11,12],root=roots[index%roots.length],power=[2,3,2,3][Math.floor(index/roots.length)%4];
  const value=power===2?root*root:root*root*root;
  return{q:`Вычисли ${power===2?"квадратный":"кубический"} корень из ${value}${power===2?"":" (∛)"}.`,a:String(root)};
 }
 const base=2+(index%11),exponent=[2,3,4,2,3][Math.floor(index/11)%5];
 return{q:`Вычисли ${base}${exponent===2?"²":exponent===3?"³":"⁴"}. Запиши умножение как проверку.`,a:`${base**exponent} (${Array(exponent).fill(base).join(" · ")})`};
}
function prime(index:number){
 const primes=[3,5,7,11,13,17,19,23,29,31,37,41,43,47,53,59,61,67,71,73],p=2,q=primes[index%primes.length];
 const n=p*q;
 return{q:`Разложи ${n} на простые множители. Затем назови все его простые делители.`,a:`${n} = ${p} · ${q}; простые делители: ${p} и ${q}.`};
}
function probability(index:number,topic:string){
 if(/биномиальн/.test(topic)){
  const n=4,k=index%5,p=1+Math.floor(index/5),denominator=4**n,coefficient=factorial(n)/(factorial(k)*factorial(n-k)),numerator=coefficient*(p**k)*((4-p)**(n-k)),g=gcd(numerator,denominator);
  return{q:`Случайная величина X имеет биномиальное распределение: ${n} независимых испытаний, вероятность успеха в каждом равна ${p}/4. Найди P(X = ${k}).`,a:`P(X=${k}) = C(${n},${k}) · (${p}/4)^${k} · (${4-p}/4)^${n-k} = ${numerator}/${denominator}${g>1?` = ${numerator/g}/${denominator/g}`:""}.`};
 }
 const sample=Math.floor(index/3);
 if(index%3===0){const face=1+sample,outcomes=6-face;return{q:`Бросают правильный шестигранный кубик. Какова вероятность выпадения числа больше ${face}? Запиши ответ дробью и процентом.`,a:`Благоприятных исходов ${outcomes} из 6: ${outcomes}/6 = ${fmt(outcomes/6*100)}%.`};}
 if(index%3===1){const flips=sample+1,success=2**flips-1,denominator=2**flips;return{q:`Монету подбрасывают ${flips} раз. Какова вероятность получить хотя бы один орёл?`,a:`Противоположное событие — ни одного орла: P = 1 − (1/2)^${flips} = ${success}/${denominator}.`};}
 const red=2+sample,blue=5+sample,total=red+blue,g=gcd(red,total);return{q:`В мешке ${red} красных и ${blue} синих одинаковых жетонов. Наугад вытаскивают один. Какова вероятность достать красный жетон?`,a:`Благоприятных исходов ${red} из ${total}: P = ${red}/${total}${g>1?` = ${red/g}/${total/g}`:""}.`};
}
function statistics(index:number){
 const values=Array.from({length:5},(_,i)=>2+((index*3+i*7)%19)),sum=values.reduce((a,b)=>a+b,0),mean=sum/values.length;
 return{q:`Найди среднее арифметическое чисел: ${values.join(", ")}. Покажи сумму и количество чисел.`,a:`Сумма ${sum}; чисел ${values.length}; среднее арифметическое ${fmt(mean)}.`};
}
function rounding(index:number,topic:string){
 if(/оценк.*результат/.test(topic)){
  const a=198+(index%17)*37,b=41+(index%9)*13,exact=a+b,estimate=Math.round(a/100)*100+Math.round(b/10)*10;
  return{q:`Оцени сумму ${a} + ${b}, округлив первое слагаемое до сотен, а второе — до десятков. Затем вычисли точную сумму и сравни результаты.`,a:`Оценка: ${Math.round(a/100)*100} + ${Math.round(b/10)*10} = ${estimate}. Точная сумма: ${exact}.`};
 }
 const number=1243+(index*137)%8756,place=index%2===0?10:100,result=Math.round(number/place)*place;
 return{q:`Округли число ${number} до ближайших ${place===10?"десятков":"сотен"}.`,a:`${number} ≈ ${result} при округлении до ${place===10?"десятков":"сотен"}.`};
}
function vectors(index:number,topic:string){
 if(/скалярн.*произвед/.test(topic)){
  const a=1+(index%7),b=-3+(index%9),c=2+((index*3)%8),d=-4+((index*5)%9),dot=a*c+b*d;
  return{q:`Даны векторы u = (${a}; ${b}) и v = (${c}; ${d}). Найди их скалярное произведение.`,a:`u · v = ${a} · ${c} + (${b}) · ${d} = ${a*c} + ${b*d} = ${dot}.`};
 }
 const ax=-4+(index%9),ay=-3+((index*2)%7),dx=3+(index%2),dy=4,length=dx===3?"5":`4√2 ≈ ${fmt(Math.sqrt(dx*dx+dy*dy))}`;
 return{q:`Даны точки A(${ax}; ${ay}) и B(${ax+dx}; ${ay+dy}). Найди координаты вектора AB и его длину.`,a:`AB = (${ax+dx} − ${ax}; ${ay+dy} − ${ay}) = (${dx}; ${dy}); |AB| = √(${dx}² + ${dy}²) = ${length}.`};
}
function proportion(index:number){
 const unit=12+(index*7)%79,first=2+(index%7),second=first+1+(index%5);
 return{q:`${first} одинаковых тетради стоят ${first*unit} ₽. Сколько будут стоить ${second} таких тетрадей? Составь пропорцию.`,a:`Цена одной тетради ${unit} ₽; ${second} · ${unit} = ${second*unit} ₽.`};
}
function trigonometry(index:number,topic=""){
 if(/теорем.*косинус|косинус.*теорем/.test(topic)){
  const first=5+index,second=7+(index*3)%11,angle=[60,90,120][index%3],cosine=angle===60?"1/2":angle===90?"0":"−1/2",radicand=first*first+second*second-(2*first*second*(angle===60?1:angle===90?0:-1))/2;
  return{q:`Две стороны треугольника равны ${first} см и ${second} см, угол между ними — ${angle}°. Найди третью сторону по теореме косинусов.`,a:`c² = ${first}² + ${second}² − 2 · ${first} · ${second} · cos ${angle}° = ${radicand}; c = √${radicand} см (cos ${angle}° = ${cosine}).`};
 }
 if(/теорем.*синус|синус.*теорем/.test(topic)){
  const rows=[[30,60,6,"6√3"],[45,45,8,"8"],[60,30,10,"10√3/3"]] as const;
  const [a,b,baseSideA,baseSideB]=rows[index%rows.length],scale=1+Math.floor(index/rows.length),sideA=baseSideA*scale,sideB=baseSideB.includes("√")?`${Number(baseSideB.match(/^\d+/)?.[0] ?? 1)*scale}${baseSideB.replace(/^\d+/,"")}`:String(Number(baseSideB)*scale);
  return{q:`В треугольнике угол A = ${a}°, угол B = ${b}°, сторона a = ${sideA} см. Найди сторону b по теореме синусов.`,a:`По теореме синусов b/sin ${b}° = a/sin ${a}°. Поэтому b = ${sideA} · sin ${b}° / sin ${a}° = ${sideB} см.`};
 }
 const rows=[[30,"1/2","√3/2","1/√3"],[45,"√2/2","√2/2","1"],[60,"√3/2","1/2","√3"]] as const;
 const [angle,sin,cos,tan]=rows[Math.floor(index/5)%rows.length];
 const task=index%5;
 if(task===0)return{q:`Вычисли sin ${angle}°, cos ${angle}° и tg ${angle}° по таблице значений для стандартных углов.`,a:`sin ${angle}° = ${sin}; cos ${angle}° = ${cos}; tg ${angle}° = ${tan}.`};
 if(task===1){const value=angle===30?"1 + √3/2":angle===45?"3√2/2":"√3 + 1/2";return{q:`Найди точное значение выражения 2 · sin ${angle}° + cos ${angle}°.`,a:`2 · sin ${angle}° + cos ${angle}° = ${value}.`};}
 if(task===2)return{q:`Реши уравнение sin x = ${sin} на промежутке от 0° до 360°.`,a:`x = ${angle}° или x = ${180-angle}°.`};
 if(task===3)return{q:`Реши уравнение cos x = ${cos} на промежутке от 0° до 360°.`,a:`x = ${angle}° или x = ${360-angle}°.`};
 const identity=angle===30?"7/4":angle===45?"5/2":"13/4";return{q:`Вычисли точное значение выражения 4 · sin² ${angle}° + cos² ${angle}°.`,a:`Используем sin²x + cos²x = 1: выражение равно 1 + 3 · sin² ${angle}° = ${identity}.`};
}
function logarithms(index:number){
 const base=[2,3,5,10][index%4],exponent=2+Math.floor(index/4)%5,value=base**exponent;
 return{q:`Вычисли log₍${base}₎ ${value}. Запиши равенство в показательной форме для проверки.`,a:`log₍${base}₎ ${value} = ${exponent}, так как ${base}^${exponent} = ${value}.`};
}

function factorial(n:number):number{return n<=1?1:n*factorial(n-1);}
function sequence(index:number){
 const first=2+(index%17),difference=1+(index%8),n=5+(index%12),last=first+(n-1)*difference,sum=n*(first+last)/2;
 return{q:`Арифметическая прогрессия задана: a₁ = ${first}, d = ${difference}. Найди a${n} и сумму первых ${n} членов.`,a:`a${n} = ${first} + (${n} − 1) · ${difference} = ${last}; S${n} = ${n} · (${first} + ${last}) / 2 = ${sum}.`};
}
function combinatorics(index:number){
 const n=6+Math.floor(index/5),k=2+(index%5),count=factorial(n)/factorial(n-k);
 return{q:`Сколькими способами можно выбрать и расставить ${k} разных участников из ${n} претендентов на первые места? Порядок важен.`,a:`Это размещения: A(${n}, ${k}) = ${n}! / (${n} − ${k})! = ${count}.`};
}
function division(index:number){
 const divisor=2+(index%9),quotient=3+Math.floor(index/9),remainder=index%divisor,dividend=divisor*quotient+remainder;
 return{q:`Раздели ${dividend} на ${divisor} с остатком. Назови частное и остаток.`,a:`${dividend} = ${divisor} · ${quotient} + ${remainder}; частное ${quotient}, остаток ${remainder}.`};
}
function divisibility(index:number){
 const divisor=[2,3,4,5,6,8,9,10,11,12][index%10],quotient=21+index,remainder=index%2===0?0:1,number=divisor*quotient+remainder;
 return{q:`Проверь, делится ли ${number} на ${divisor} без остатка. Если делится, укажи частное; если нет — остаток.`,a:remainder===0?`${number} делится на ${divisor}: частное ${quotient}.`:`${number} = ${divisor} · ${quotient} + 1, поэтому при делении на ${divisor} остаток 1.`};
}
function algebra(index:number,topic:string){
 const a=2+index,b=1+(index%7),sum=a+b,product=a*b;
 if(/сокращ.*умнож/.test(topic)){
  if(index%2===0)return{q:`Раскрой скобки по формуле сокращённого умножения: (x + ${a})².`,a:`(x + ${a})² = x² + ${2*a}x + ${a*a}.`};
  return{q:`Разложи на множители по формуле разности квадратов: x² − ${a*a}.`,a:`x² − ${a*a} = (x − ${a})(x + ${a}).`};
 }
 return{q:`Разложи квадратный трёхчлен x² + ${sum}x + ${product} на множители.`,a:`x² + ${sum}x + ${product} = (x + ${a})(x + ${b}).`};
}
function absolute(index:number){
 const center=-5+(index%11),distance=2+(index%9),left=center-distance,right=center+distance;
 return{q:`Реши уравнение |x − (${center})| = ${distance}.`,a:`x − (${center}) = ±${distance}; x = ${left} или x = ${right}.`};
}
function domain(index:number){
 const boundary=-6+(index%13);
 if(index%2===0)return{q:`Найди область определения выражения 1 / (x − (${boundary})).`,a:`Знаменатель не должен быть равен нулю: x − (${boundary}) ≠ 0, значит x ≠ ${boundary}. D = ℝ \\ {${boundary}}.`};
 return{q:`Найди область определения выражения √(x − (${boundary})).`,a:`Подкоренное выражение должно быть неотрицательным: x − (${boundary}) ≥ 0, значит x ≥ ${boundary}.`};
}
function derivative(index:number,topic:string){
 if(/касательн/.test(topic)){
  const at=-5+index,intercept=-(at*at),slope=2*at;
  return{q:`Найди уравнение касательной к графику y = x² в точке с абсциссой x = ${at}.`,a:`y′ = 2x, поэтому угловой коэффициент ${slope}. Касательная: y = ${slope}x ${signed(intercept)}.`};
 }
 const coefficient=2+(index%7),power=2+(index%4),linear=1+(index%6);
 return{q:`Найди производную многочлена f(x) = ${coefficient}x^${power} + ${linear}x² − 5.`,a:`f′(x) = ${coefficient*power}x^${power-1} + ${2*linear}x.`};
}
function quadraticFunction(index:number){
 const first=-4+(index%7),gap=2+2*(index%4),second=first+gap,b=-(first+second),c=first*second,vertexX=(first+second)/2,vertexY=-(gap*gap)/4;
 return{q:`Построй эскиз графика y = x² ${signed(b)}x ${signed(c)}. Найди нули функции и координаты вершины параболы.`,a:`y = (x − (${first}))(x − (${second})); нули: x₁ = ${first}, x₂ = ${second}. Вершина: x₀ = (${first} + ${second})/2 = ${vertexX}, y₀ = ${vertexY}; вершина (${vertexX}; ${vertexY}).`};
}

export function generateMathAi(mode:MathAiMode,level:MathAiLevel,count:number,topic:string,withAnswers=true):MathAiResult{
 const actual=detect(topic,mode),safe=Math.max(1,Math.min(20,count)),t=topic.toLowerCase();
 const make=(index:number)=>{
  if(actual==="equations"){
  if(/неравен/.test(t)){
    if(/с параметр/.test(t)){
     const bound=2+(index%15);
     return{q:`Реши неравенство с параметром m: m · x < ${bound}. Рассмотри случаи для m > 0, m = 0 и m < 0.`,a:`Если m > 0, x < ${bound}/m; если m < 0, знак меняется: x > ${bound}/m; если m = 0, получаем 0 < ${bound}, поэтому подходят все x.`};
    }
    const coefficient=2+(index%7),boundary=-6+(index%19),constant=1+(index%11),threshold=coefficient*boundary+constant,relation=index%2===0?"<":"≤";
    return{q:`Решите неравенство: ${coefficient}x + ${constant} ${relation} ${threshold}`,a:`${coefficient}x ${relation} ${coefficient*boundary}; x ${relation} ${boundary}`};
   }
   if(/кубическ|третьей степени|x\s*[³3]/.test(t))return cubic();
   if(/систем/.test(t))return system2(index);
   if(/квадратн|дискриминант|второй степени|x\s*[²2]/.test(t))return quadratic(index);
   return linear(level);
  }
  if(actual==="fractions")return fraction(index);
  if(actual==="decimals"){
   if(/сравнен/.test(t)){
    const left=12+(index*17)%87,right=13+(index*23)%86,symbol=left===right?"=":left>right?">":"<";
    const explanation=left===right?`${fmt(left/100)} и ${fmt(right/100)} равны.`:left>right?`${fmt(left/100)} больше ${fmt(right/100)}.`:`${fmt(right/100)} больше ${fmt(left/100)}.`;
    return{q:`Сравни десятичные дроби ${fmt(left/100)} и ${fmt(right/100)}. Поставь знак >, < или = и объясни выбор.`,a:`${explanation} Сравниваем сотые: ${fmt(left/100)} ${symbol} ${fmt(right/100)}.`};
   }
   const left=12+(index*17)%87,right=13+(index*23)%86,subtract=index%2===1;
   const larger=Math.max(left,right),smaller=Math.min(left,right),value=subtract?(larger-smaller)/10:(left+right)/10;
   return{q:`Вычисли ${subtract?`${fmt(larger/10)} − ${fmt(smaller/10)}`:`${fmt(left/10)} + ${fmt(right/10)}`}.`,a:`${fmt(value)}.`};
  }
  if(actual==="rounding")return rounding(index,t);
  if(actual==="vectors")return vectors(index,t);
  if(actual==="geometry"){
   if(/геометрические фигуры начальной школы/.test(t)){
    const shapes=["круг","треугольник","квадрат","прямоугольник"],shape=shapes[index%shapes.length];
    return{q:`На карточке №${index+1} нарисована фигура с ${shape==="круг"?"одной круглой границей и без углов":shape==="треугольник"?"тремя сторонами и тремя углами":shape==="квадрат"?"четырьмя равными сторонами и четырьмя углами":"четырьмя сторонами, причём противоположные стороны равны"}. Назови фигуру.`,a:`${shape[0].toLocaleUpperCase("ru-RU")}${shape.slice(1)}.`};
   }
   if(/окруж|круг/.test(t)&&/касател/.test(t)){
    const triples=[[5,12,13],[8,15,17],[7,24,25]] as const,[radius,tangent,distance]=triples[Math.floor(index/5)%triples.length],scale=1+index%5;
    return{q:`Из точки P проведена касательная PT к окружности с центром O. Радиус OT = ${radius*scale} см, расстояние OP = ${distance*scale} см. Найди длину касательной PT.`,a:`OT ⟂ PT, поэтому по теореме Пифагора PT² = OP² − OT² = ${distance*scale}² − ${radius*scale}² = ${(tangent*scale)**2}; PT = ${tangent*scale} см.`};
   }
   if(/периметр.*многоугольник/.test(t)){
    const sides=3+(index%12),side=2+(index%17),perimeter=sides*side;
    return{q:`Правильный ${sides}-угольник имеет сторону ${side} см. Найди его периметр.`,a:`P = ${sides} · ${side} = ${perimeter} см.`};
   }
   if(/об[ъь]?[её]м/.test(t)&&/цилиндр/.test(t)){
    const radius=2+(index%9),height=3+(index%11),volume=3.14*radius*radius*height;
    return{q:`Найди объём цилиндра с радиусом основания ${radius} см и высотой ${height} см. Используй π ≈ 3,14.`,a:`V = πr²h ≈ 3,14 · ${radius}² · ${height} = ${fmt(volume)} см³.`};
   }
   if(/об[ъь]?[её]м/.test(t)&&/призм/.test(t)){
    const area=6+(index%13),height=2+(index%9),volume=area*height;
    return{q:`Площадь основания прямой призмы равна ${area} см², высота — ${height} см. Найди объём.`,a:`V = Sосн · h = ${area} · ${height} = ${volume} см³.`};
   }
   if(/многоугольник/.test(t)){
    const sides=3+index,angleSum=(sides-2)*180;
    return{q:`Найди сумму внутренних углов выпуклого ${sides}-угольника.`,a:`S = (${sides} − 2) · 180° = ${angleSum}°.`};
   }
   if(/площад/.test(t)){
    if(index%3===0){const a=3+index,b=4+2*(index%11),area=a*b;return{q:`Прямоугольник имеет стороны ${a} см и ${b} см. Найди его площадь.`,a:`S = ${a} · ${b} = ${area} см².`};}
    if(index%3===1){const base=6+2*index,height=3+(index%13),area=base*height/2;return{q:`Основание треугольника равно ${base} см, высота к нему — ${height} см. Найди площадь.`,a:`S = (${base} · ${height}) / 2 = ${fmt(area)} см².`};}
    const radius=2+index,area=3.14*radius*radius;return{q:`Найди площадь круга радиуса ${radius} см. Используй π ≈ 3,14.`,a:`S = πr² ≈ 3,14 · ${radius}² = ${fmt(area)} см².`};
   }
   if(/средн.*лини.*треуг/.test(t)){
    const side=6+2*(index%16),midline=side/2;
    return{q:`Средняя линия треугольника параллельна стороне длиной ${side} см. Найди длину средней линии.`,a:`Средняя линия равна половине параллельной стороны: ${side} / 2 = ${fmt(midline)} см.`};
   }
   if(/подоб.*треуг/.test(t)){
    const first=3+(index%12),scale=2+(index%5),second=first*scale;
    return{q:`Соответствующая сторона первого треугольника равна ${first} см. Коэффициент подобия второго к первому равен ${scale}. Найди соответствующую сторону второго треугольника.`,a:`${first} · ${scale} = ${second} см.`};
   }
   if(/равнобедрен/.test(t)){
    const baseAngle=20+index,vertexAngle=180-2*baseAngle;
    return{q:`В равнобедренном треугольнике угол при основании равен ${baseAngle}°. Найди второй угол при основании и угол при вершине.`,a:`Углы при основании равны: второй ${baseAngle}°. Угол при вершине: 180° − 2 · ${baseAngle}° = ${vertexAngle}°.`};
   }
   if(/вписанн.*окруж/.test(t)){
    const side=4+2*index,radius=side/2;
    return{q:`В квадрат со стороной ${side} см вписана окружность. Найди её радиус и длину окружности (π ≈ 3,14).`,a:`Диаметр равен стороне квадрата: d = ${side} см, r = ${radius} см; L ≈ 2 · 3,14 · ${radius} = ${fmt(2*3.14*radius)} см.`};
   }
   if(/пифагор|гипотенуз|катет/.test(t)){
    const triples=[3,4,5],factor=1+index,scaled=triples.map(value=>value*factor);
    return{q:`Катеты прямоугольного треугольника равны ${scaled[0]} см и ${scaled[1]} см. Найдите гипотенузу.`,a:`${scaled[2]} см`};
   }
   if(/окруж|круг|радиус|диаметр/.test(t)){
    const r=2+(index%19);return{q:`Радиус круга ${r} см. Найдите длину окружности и площадь круга. π ≈ 3,14.`,a:`L ≈ ${fmt(2*3.14*r)} см; S ≈ ${fmt(3.14*r*r)} см²`};
   }
   if(/квадрат/.test(t)){const a=3+index;return{q:`Сторона квадрата равна ${a} см. Найдите площадь и периметр.`,a:`S = ${a*a} см²; P = ${4*a} см`};}
   if(/прямоуг/.test(t)){const a=3+(index%17),b=4+(Math.floor(index/2)%13);return{q:`Стороны прямоугольника равны ${a} см и ${b} см. Найдите площадь и периметр.`,a:`S = ${a*b} см²; P = ${2*(a+b)} см`};}
   if(/треуг/.test(t)){
    if(/периметр/.test(t)){const a=rnd(3,9),b=rnd(3,9),c=rnd(Math.abs(a-b)+1,a+b-1),sides=[a,b,c];return{q:`Стороны треугольника равны ${sides.join(", ")} см. Найдите периметр.`,a:`P = ${sides.join(" + ")} = ${sides.reduce((sum,x)=>sum+x,0)} см`};}
   if(/(?:^|[^\p{L}])уг(?:ол|ла|лы|лов|лам|лами|лу|лом|ле)(?:$|[^\p{L}])/iu.test(t)){const a=20+5*(index%17),b=25+5*(Math.floor(index/17)%10),third=180-a-b;return{q:`Два угла треугольника равны ${a}° и ${b}°. Найдите третий угол.`,a:`180° − ${a}° − ${b}° = ${third}°`};}
    const a=rnd(4,16),h=rnd(3,14);return{q:`Основание треугольника ${a} см, высота к нему ${h} см. Найдите площадь.`,a:`S = ${fmt(a*h/2)} см²`};
   }
   return geometry(level);
  }
  if(actual==="percent")return percent();
  if(actual==="functions")return /квадрат.*функц|парабол/.test(t)?quadraticFunction(index):func(index);
  if(actual==="word")return word(index);
  if(actual==="arithmetic"){
   if(/числа и цифры от 0 до 20/.test(t)){
    const n=1+(index*7)%19,kind=index%3;
    if(kind===0)return{q:`Запиши число ${n} словами и укажи, сколько в нём десятков и единиц.`,a:`${n} — «${n===1?"один":n===2?"два":n===3?"три":n===4?"четыре":n===5?"пять":n===6?"шесть":n===7?"семь":n===8?"восемь":n===9?"девять":n===10?"десять":n===11?"одиннадцать":n===12?"двенадцать":n===13?"тринадцать":n===14?"четырнадцать":n===15?"пятнадцать":n===16?"шестнадцать":n===17?"семнадцать":n===18?"восемнадцать":n===19?"девятнадцать":"двадцать"}»; ${Math.floor(n/10)} десятков и ${n%10} единиц.`};
    if(kind===1)return{q:`Запиши предыдущее и следующее числа для ${n}.`,a:`${n-1}, ${n}, ${n+1}.`};
    const other=n===20?19:n+1;return{q:`Сравни числа ${n} и ${other}. Поставь знак >, < или =.`,a:`${n} < ${other}.`};
   }
   if(/состав числа в пределах 10/.test(t)){
    const total=2+(index%9),right=total-1,left=1,blankFirst=index>=9;
    return blankFirst
     ?{q:`Разложи число ${total} на два слагаемых. Заполни: □ + ${left} = ${total}.`,a:`В окошке ${right}: ${right} + ${left} = ${total}.`}
     :{q:`Разложи число ${total} на два слагаемых. Заполни: ${left} + □ = ${total}.`,a:`В окошке ${right}: ${left} + ${right} = ${total}.`};
   }
   if(/сложение и вычитание в пределах 20/.test(t)){
    if(index%2===0){const slot=Math.floor(index/2),a=1+(slot%4),b=1+Math.floor(slot/4);return{q:`Вычисли ${a} + ${b}.`,a:`${a} + ${b} = ${a+b}.`};}
    const slot=Math.floor(index/2),top=11+slot,bottom=1+(slot%3);return{q:`Вычисли ${top} − ${bottom}.`,a:`${top} − ${bottom} = ${top-bottom}.`};
   }
   if(/простые текстовые задачи в одно действие/.test(t)){
    const a=3+(index%8),b=1+(index%7),sum=a+b;
    if(index%2===0)return{q:`У Маши было ${a} карандаш${a%10===1?"":"а"}. Ей дали ещё ${b}. Сколько карандашей стало?`,a:`Одно действие: ${a} + ${b} = ${sum}. Ответ: ${sum} карандашей.`};
    const total=sum;return{q:`На тарелке лежало ${total} яблок. ${b} яблок съели. Сколько осталось?`,a:`Одно действие: ${total} − ${b} = ${a}. Ответ: ${a} яблок.`};
   }
   if(/измерение длины отрезка в сантиметрах/.test(t)){
    const start=2+(index%5),length=3+(index%8),end=start+length;
    return{q:`Отметь на числовой линейке отрезок от ${start} см до ${end} см. Найди его длину.`,a:`Длина отрезка: ${end} − ${start} = ${length} см.`};
   }
   if(/положение предметов и пространственные отношения/.test(t)){
    const objects=["мяч","кубик","книга","карандаш","игрушка"],directions=["слева","справа","выше","ниже"],object=objects[index%objects.length],other=objects[(index+1+Math.floor(index/objects.length))%objects.length],direction=directions[Math.floor(index/objects.length)];
    return{q:`На рисунке ${object} находится ${direction} ${other}. Где расположен ${object} относительно ${other}?`,a:`${object[0].toLocaleUpperCase("ru-RU")}${object.slice(1)} находится ${direction}.`};
   }
   if(/таблицы и числовые закономерности/.test(t)){
    const first=1+(index%5),step=1+(index%3),second=first+step,third=second+step,next=third+step;
    if(index%2===0)return{q:`Продолжи закономерность: ${first}, ${second}, ${third}, __.`,a:`Каждый раз прибавляем ${step}; следующее число — ${next}.`};
    return{q:`В таблице записано: красных кружков — ${first}, синих — ${second}. Сколько кружков всего?`,a:`${first} + ${second} = ${first+second}. Всего ${first+second} кружков.`};
   }
   if(/верные и неверные математические утверждения/.test(t)){
    const left=1+(index%10),right=1+Math.floor(index/10),actual=left+right,claim=actual+(index%2===0?0:1),isTrue=claim===actual;
    return{q:`Проверь утверждение: ${left} + ${right} = ${claim}. Оно верное?`,a:isTrue?`Верное: ${left} + ${right} = ${actual}.`:`Неверное: ${left} + ${right} = ${actual}, а не ${claim}.`};
   }
   if(/двухшаговые инструкции с вычислениями и построением/.test(t)){
    const firstLength=4+(index%7),shorterBy=1+(index%3),secondLength=firstLength-shorterBy;
    return{q:`Выполни по порядку: 1) начерти отрезок AB длиной ${firstLength} см; 2) начерти рядом отрезок CD на ${shorterBy} см короче. Какова длина CD?`,a:`Сначала вычисляем: ${firstLength} − ${shorterBy} = ${secondLength}. Затем чертим CD длиной ${secondLength} см.`};
   }
   if(/многозначн.*числ|сложен.*вычитан.*многознач/.test(t)){
    const left=12_458+(index*1_307)%37_000,right=2_167+(index*719)%9_000,subtract=index%2===1,larger=Math.max(left,right),smaller=Math.min(left,right),result=subtract?larger-smaller:left+right;
    return{q:`Вычисли ${larger} ${subtract?"−":"+"} ${smaller}.`,a:`${larger} ${subtract?"−":"+"} ${smaller} = ${result}.`};
   }
   if(/умножен.*делен.*натуральн|натуральн.*числ.*умножен.*делен/.test(t)){
    const factor=12+(index%18),divisor=3+(index%10),product=factor*divisor;
    return{q:`Вычисли ${factor} · ${divisor}, затем проверь результат обратным действием: раздели произведение на ${divisor}.`,a:`${factor} · ${divisor} = ${product}; ${product} / ${divisor} = ${factor}.`};
   }
   if(/координатн.*плоск/.test(t)){const x=-8+(index%17),y=1+((index*3)%12);return{q:`Точка A(${x}; ${y}) задана на координатной плоскости. Укажи четверть и отрази точку относительно оси Ox.`,a:`x < 0 и y > 0, поэтому точка во II четверти. При отражении относительно Ox получаем A′(${x}; ${-y}).`};}
   if(/отрицательн/.test(t)){const a=-1-(index%15),b=2+((index*3)%12);return{q:`Расположи числа ${a}, 0 и ${b} на координатной прямой по возрастанию. Найди сумму крайних чисел.`,a:`${a} < 0 < ${b}; сумма крайних чисел ${a} + ${b} = ${a+b}.`};}
   if(/порядок действий|скобк/.test(t)){const a=2+(index%9),b=3+(index%8),c=1+(index%7),d=2+(index%6),value=a*(b+c)-d;return{q:`Вычисли выражение ${a} · (${b} + ${c}) − ${d}, соблюдая порядок действий.`,a:`Сначала скобки: ${b}+${c}=${b+c}; затем умножение и вычитание: ${a}·${b+c}−${d}=${value}.`};}
   if(/буквен.*выражен/.test(t)){const a=2+(index%8),b=1+(index%7),x=3+(index%9),value=a*x+b*x;return{q:`Упрости выражение ${a}x + ${b}x и вычисли его значение при x = ${x}.`,a:`${a}x + ${b}x = ${a+b}x; при x=${x}: ${a+b}·${x}=${value}.`};}
   return arithmetic(level);
  }
  if(actual==="powers")return powers(index,t);
  if(actual==="prime"){
   if(/прост.*чис/.test(t)){const primeValue=11+index*2;let divisor=2;while(divisor*divisor<=primeValue&&primeValue%divisor!==0)divisor++;const isPrime=divisor*divisor>primeValue;return{q:`Проверь, является ли число ${primeValue} простым. Если составное, найди его делитель, отличный от 1 и самого числа.`,a:isPrime?`${primeValue} — простое число: у него только два натуральных делителя, 1 и ${primeValue}.`:`${primeValue} — составное число: ${divisor} · ${primeValue/divisor} = ${primeValue}.`};}
   return prime(index);
  }
  if(actual==="probability")return probability(index,t);
  if(actual==="statistics")return statistics(index);
  if(actual==="proportion")return proportion(index);
  if(actual==="trigonometry")return trigonometry(index,t);
  if(actual==="logarithms")return logarithms(index);
  if(actual==="sequence")return sequence(index);
  if(actual==="combinatorics")return combinatorics(index);
  if(actual==="division")return division(index);
  if(actual==="divisibility")return divisibility(index);
  if(actual==="algebra")return algebra(index,t);
  if(actual==="absolute")return absolute(index);
  if(actual==="domain")return domain(index);
  if(actual==="derivative")return derivative(index,t);
  return pick([()=>linear(level),()=>fraction(index),()=>geometry(level),()=>percent(),()=>func(index),()=>word(index),()=>arithmetic(level),()=>powers(index,t),()=>prime(index),()=>proportion(index)])();
 };
 const rows=Array.from({length:safe},(_,index)=>make(index));
 const names:Record<string,string>={arithmetic:"Примеры",equations:"Уравнения",fractions:"Дроби",decimals:"Десятичные дроби",rounding:"Округление и оценка",geometry:"Геометрия",functions:"Функции",vectors:"Векторы",percent:"Проценты",word:"Текстовые задачи",powers:"Степени и корни",prime:"Простые множители",divisibility:"Делимость",probability:"Вероятность",statistics:"Статистика",proportion:"Пропорции",trigonometry:"Тригонометрия",logarithms:"Логарифмы",sequence:"Прогрессии",combinatorics:"Комбинаторика",division:"Деление с остатком",algebra:"Алгебраические выражения",absolute:"Модуль числа",domain:"Область определения",derivative:"Производная и касательная",mixed:"Смешанная работа"};
 const promptTitle=topic.trim();
 const detected=actual==="equations"&&/неравен/.test(t)?"Неравенства":actual==="prime"&&/прост.*чис/.test(t)?"Простые числа":actual==="arithmetic"&&/координатн.*плоск/.test(t)?"Координатная плоскость":names[actual]||"Задания";
 const title=promptTitle?`${detected} · по запросу`:detected;
 return{title,items:rows.map(x=>x.q),answers:withAnswers?rows.map(x=>x.a):[],detected};
}
