type Evaluation=(x:number)=>number;
const functions:Record<string,(x:number)=>number>={sin:Math.sin,cos:Math.cos,tan:Math.tan,
  sqrt:Math.sqrt,abs:Math.abs,exp:Math.exp,ln:Math.log,log:Math.log10};

/** Parse once, not for every sampled x. No evaluation of arbitrary JavaScript. */
export function compileGraphExpression(source:string):Evaluation|null {
  const text=source.trim().toLowerCase().replace(/^y\s*=\s*/,"").replace(/,/g,".")
    .replace(/π/g,"pi").replace(/−/g,"-").replace(/[×·]/g,"*").replace(/÷/g,"/");
  if(!text||source.length>500)return null;
  const tokens=text.match(/(?:\d+(?:\.\d*)?|\.\d+)|(?:[a-z]+)|[()+\-*/^]|[^\s]/g)??[];
  let pos=0;
  const numberToken=(t:string|undefined)=>t!==undefined&&/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(t);
  const symbolToken=(t:string|undefined)=>t==="x"||t==="pi"||t==="e"||!!t&&Object.hasOwn(functions,t);
  const primary=():Evaluation=>{
    const t=tokens[pos++];
    if(t==="("){const value=expr();if(tokens[pos++]!==")")throw 0;return value;}
    if(numberToken(t)){const value=Number(t);if(!Number.isFinite(value))throw 0;return ()=>value;}
    if(t==="x")return x=>x;
    if(t==="pi")return ()=>Math.PI;
    if(t==="e")return ()=>Math.E;
    if(t&&Object.hasOwn(functions,t)){
      if(tokens[pos++]!=="(")throw 0;
      const value=expr();if(tokens[pos++]!==")")throw 0;
      return x=>functions[t](value(x));
    }
    throw 0;
  };
  // Exponentiation binds more tightly than unary minus and is right-associative.
  const power=():Evaluation=>{const left=primary();if(tokens[pos]!=="^")return left;pos++;
    const right=unary();return x=>Math.pow(left(x),right(x));};
  const unary=():Evaluation=>{if(tokens[pos]==="-"||tokens[pos]==="+"){
    const negative=tokens[pos++]==="-",value=unary();return negative?x=>-value(x):value;}
    return power();};
  const term=():Evaluation=>{let value=unary();while(pos<tokens.length){
    const next=tokens[pos];
    const implicit=next==="("||symbolToken(next)||(numberToken(next)&&!numberToken(tokens[pos-1]));
    if(next!=="*"&&next!=="/"&&!implicit)break;
    const divide=next==="/";if(!implicit)pos++;
    const left=value,right=unary();value=divide?x=>left(x)/right(x):x=>left(x)*right(x);
  }return value;};
  const expr=():Evaluation=>{let value=term();while(tokens[pos]==="+"||tokens[pos]==="-"){
    const add=tokens[pos++]==="+",left=value,right=term();value=add?x=>left(x)+right(x):x=>left(x)-right(x);
  }return value;};
  try{const evaluate=expr();return pos===tokens.length?evaluate:null;}catch{return null;}
}
