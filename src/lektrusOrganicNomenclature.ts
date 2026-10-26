import type {Item} from "./boardModel";
import {analyzeOrganicStructure} from "./lektrusOrganicFormula";

/** A deliberately bounded nomenclature engine: no plausible-looking guesses for unhandled chemistry.
 * Characteristic-group precedence follows IUPAC Brief Guide, Table 3 (2019).
 * https://iupac.qmul.ac.uk/BriefGuide/organic.html
 */
type Link={a:number;b:number;order:number};
type Graph={atoms:string[];links:Link[]};
type RecordName={smiles:string;systematic:string;trivial?:string};
export type OrganicNameResult={
 systematic:string|null;trivial:string|null;
 status:"reference"|"calculated"|"unsupported";reason:string;
};
const unsupported=(reason:string):OrganicNameResult=>({systematic:null,trivial:null,status:"unsupported",reason});
const values:Record<string,number>={C:4,O:2,N:3,H:1,S:2,F:1,Cl:1,Br:1,I:1};
const stems=["","мет","эт","проп","бут","пент","гекс","гепт","окт","нон","дек","ундек","додек","тридек","тетрадек","пентадек","гексадек","гептадек","октадек","нонадек","эйкоз"];
const prefixes:Record<string,string>={F:"фтор",Cl:"хлор",Br:"бром",I:"иод"};
const multipliers=["","", "ди","три","тетра","пента","гекса"];
const manual:RecordName[]=[
 ["C1=CC=CC=C1","бензол"],
 ["CC1=CC=CC=C1","метилбензол","толуол"],
 ["CC1=CC=CC(=C1)C","1,3-диметилбензол","м-ксилол"],
 ["CC1=CC=CC=C1C","1,2-диметилбензол","о-ксилол"],
 ["CC1=CC=C(C=C1)C","1,4-диметилбензол","п-ксилол"],
 ["C=CC1=CC=CC=C1","этенилбензол","стирол"],
 ["C1=CC=CC=C1O","фенол","карболовая кислота"],
 ["C1=CC=CC=C1N","бензенамин","анилин"],
 ["C1=CC=CC=C1C=O","бензальдегид","бензойный альдегид"],
 ["C1=CC=CC=C1C(=O)O","бензойная кислота"],
 ["C1=CC=CC=C1OC","метоксибензол","анизол"],
 ["C1=CC=CC=C1Cl","хлорбензол"],
 ["C1=CC=CC=C1Br","бромбензол"],
 ["C1=CC=CC=C1F","фторбензол"],
 ["C1=CC=CC=C1C(=O)OC","метилбензоат","метиловый эфир бензойной кислоты"],
 ["C1CC1","циклопропан"],
 ["C1CCC1","циклобутан"],
 ["C1CCCC1","циклопентан"],
 ["C1CCCCC1","циклогексан"],
 ["C1CCCCCC1","циклогептан"],
 ["C1CCCCCCC1","циклооктан"],
 ["C1CCCCC1O","циклогексанол"],
 ["C1CCCCC1=O","циклогексанон"],
 ["C1=CCCCC1","циклогексен"],
 ["N1=CC=CC=C1","пиридин"],
 ["O1C=CC=C1","фуран"],
 ["S1C=CC=C1","тиофен"],
 ["N1C=CC=C1","пиррол"],
 ["COC","метоксиметан","диметиловый эфир"],
 ["CCOCC","этоксиэтан","диэтиловый эфир"],
 ["COCC","метоксиэтан","метилэтиловый эфир"],
 ["CO","метанол","метиловый спирт"],
 ["CCO","этанол","этиловый спирт"],
 ["CCCO","пропан-1-ол","пропиловый спирт"],
 ["CC(O)C","пропан-2-ол","изопропиловый спирт"],
 ["CCCCO","бутан-1-ол","бутиловый спирт"],
 ["CC(C)(C)O","2-метилпропан-2-ол","трет-бутиловый спирт"],
 ["OCCO","этан-1,2-диол","этиленгликоль"],
 ["OCC(O)CO","пропан-1,2,3-триол","глицерин"],
 ["C=O","метаналь","формальдегид"],
 ["CC=O","этаналь","ацетальдегид"],
 ["CCC=O","пропаналь","пропионовый альдегид"],
 ["CCCC=O","бутаналь","масляный альдегид"],
 ["CC(=O)C","пропан-2-он","ацетон"],
 ["CCC(=O)C","бутан-2-он","метилэтилкетон"],
 ["C(=O)O","метановая кислота","муравьиная кислота"],
 ["CC(=O)O","этановая кислота","уксусная кислота"],
 ["CCC(=O)O","пропановая кислота","пропионовая кислота"],
 ["CCCC(=O)O","бутановая кислота","масляная кислота"],
 ["CC(C)C(=O)O","2-метилпропановая кислота","изомасляная кислота"],
 ["CCCCC(=O)O","пентановая кислота","валериановая кислота"],
 ["C=CC(=O)O","проп-2-еновая кислота","акриловая кислота"],
 ["CC(=C)C(=O)O","2-метилпроп-2-еновая кислота","метакриловая кислота"],
 ["OC(=O)C(=O)O","этандиовая кислота","щавелевая кислота"],
 ["OC(=O)CC(=O)O","пропандиовая кислота","малоновая кислота"],
 ["OC(=O)CCC(=O)O","бутандиовая кислота","янтарная кислота"],
 ["CC(O)C(=O)O","2-гидроксипропановая кислота","молочная кислота"],
 ["CC(=O)C(=O)O","2-оксопропановая кислота","пировиноградная кислота"],
 ["CC(=O)OC","метилэтаноат","метилацетат"],
 ["CC(=O)OCC","этилэтаноат","этилацетат"],
 ["C(=O)OC","метилметаноат","метилформиат"],
 ["C(=O)OCC","этилметаноат","этилформиат"],
 ["CCC(=O)OCC","этилпропаноат","этилпропионат"],
 ["C(=O)N","метанамид","формамид"],
 ["CC(=O)N","этанамид","ацетамид"],
 ["CC(=O)Cl","этаноилхлорид","ацетилхлорид"],
 ["CCC(=O)Cl","пропаноилхлорид","пропионилхлорид"],
 ["CC(=O)Br","этаноилбромид","ацетилбромид"],
 ["NC(=O)N","карбамид","мочевина"],
 ["C=CC(=O)N","проп-2-енамид","акриламид"],
 ["CC#N","этаннитрил","ацетонитрил"],
 ["CCC#N","пропаннитрил","пропионитрил"],
 ["CN","метанамин","метиламин"],
 ["CCN","этанамин","этиламин"],
 ["CNC","диметиламин"],
 ["NCCN","этан-1,2-диамин","этилендиамин"],
 ["CCl","хлорметан","хлористый метил"],
 ["C(Cl)Cl","дихлорметан","метиленхлорид"],
 ["C(Cl)(Cl)Cl","трихлорметан","хлороформ"],
 ["C(Cl)(Cl)(Cl)Cl","тетрахлорметан","четырёххлористый углерод"],
 ["CBr","бромметан","бромистый метил"],
 ["CI","иодметан","йодистый метил"],
 ["C=C","этен","этилен"],
 ["CC=C","пропен","пропилен"],
 ["C#C","этин","ацетилен"],
 ["CC#C","пропин","метилацетилен"],
 ["C=CC=C","бута-1,3-диен","дивинил"],
 ["C=C(C)C=C","2-метилбута-1,3-диен","изопрен"],
 ["CC(C)C","2-метилпропан","изобутан"],
 ["CC(C)CC","2-метилбутан","изопентан"],
 ["CC(C)(C)C","2,2-диметилпропан","неопентан"]
].map(([smiles,systematic,trivial])=>({smiles,systematic,trivial}));

/** Tiny restricted SMILES reader for the curated reference database, not a general SMILES parser. */
export function parseOrganicReference(smiles:string):Graph{
 const atoms:string[]=[],links:Link[]=[],stack:number[]=[],rings=new Map<string,{at:number;order:number}>();
 let current=-1,order=1;
 for(let i=0;i<smiles.length;){
  const pair=smiles.slice(i,i+2);
  if(pair==="Cl"||pair==="Br"||/[CONHSFI]/.test(smiles[i])){
   const symbol=pair==="Cl"||pair==="Br"?pair:smiles[i],at=atoms.length;atoms.push(symbol);
   if(current>=0)links.push({a:current,b:at,order});
   current=at;order=1;i+=symbol.length;continue;
  }
  const ch=smiles[i++];
  if(ch==="("){stack.push(current);continue;}
  if(ch===")"){current=stack.pop()??-1;continue;}
  if(ch==="="||ch==="#"){order=ch==="="?2:3;continue;}
  if(/[0-9]/.test(ch)){
   const other=rings.get(ch);
   if(!other){rings.set(ch,{at:current,order});}
   else{links.push({a:other.at,b:current,order:order!==1?order:other.order});rings.delete(ch);}
   order=1;continue;
  }
  throw new Error("Неверная эталонная структура: "+smiles);
 }
 if(stack.length||rings.size)throw new Error("Незамкнутая эталонная структура: "+smiles);
 return {atoms,links};
}
function neighbors(g:Graph,i:number):{index:number;order:number}[]{
 return g.links.flatMap(e=>e.a===i?[{index:e.b,order:e.order}]:e.b===i?[{index:e.a,order:e.order}]:[]);
}
function connected(g:Graph):boolean{
 if(!g.atoms.length)return false;
 const visited=new Set<number>(),pending=[0];
 while(pending.length){
  const at=pending.pop()!;if(visited.has(at))continue;visited.add(at);
  neighbors(g,at).forEach(n=>pending.push(n.index));
 }
 return visited.size===g.atoms.length;
}
function sameStructure(a:Graph,b:Graph):boolean{
 if(a.atoms.length!==b.atoms.length||a.links.length!==b.links.length)return false;
 const sig=(g:Graph,i:number)=>g.atoms[i]+":"+neighbors(g,i).map(n=>n.order+":"+g.atoms[n.index]).sort().join(",");
 const signaturesA=a.atoms.map((_,i)=>sig(a,i)),signaturesB=b.atoms.map((_,i)=>sig(b,i));
 if(signaturesA.slice().sort().join("|")!==signaturesB.slice().sort().join("|"))return false;
 const candidates=signaturesA.map(s=>signaturesB.map((b,i)=>b===s?i:-1).filter(i=>i>=0));
 const order=[...candidates.keys()].sort((i,j)=>candidates[i].length-candidates[j].length);
 const mapping=new Array(a.atoms.length).fill(-1),used=new Set<number>();
 const walk=(step:number):boolean=>{
  if(step===order.length)return true;
  const from=order[step];
  for(const to of candidates[from]){
   if(used.has(to))continue;
   if(order.slice(0,step).some(old=>{
    const edgeA=a.links.find(e=>e.a===from&&e.b===old||e.b===from&&e.a===old);
    const edgeB=b.links.find(e=>e.a===to&&e.b===mapping[old]||e.b===to&&e.a===mapping[old]);
    return (edgeA?.order??0)!==(edgeB?.order??0);
   }))continue;
   mapping[from]=to;used.add(to);
   if(walk(step+1))return true;
   used.delete(to);mapping[from]=-1;
  }
  return false;
 };
 return walk(0);
}
const references=manual.map(entry=>({...entry,graph:parseOrganicReference(entry.smiles)}));
export const ORGANIC_REFERENCE_COUNT=references.length;

type Group={kind:"acid"|"ester"|"amide"|"nitrile"|"aldehyde"|"ketone"|"alcohol"|"amine"|"thiol";at:number;members:number[]};
const seniority:Record<Group["kind"],number>={
 acid:0,ester:1,amide:2,nitrile:3,aldehyde:4,ketone:5,alcohol:6,thiol:7,amine:8
};
function calculated(g:Graph):OrganicNameResult{
 const carbon=g.atoms.flatMap((a,i)=>a==="C"?[i]:[]);
 if(!carbon.length)return unsupported("Нужен углеродный скелет");
 if(carbon.length>20)return unsupported("Для цепей длиннее 20 атомов C требуется проверка справочника");
 const groups:Group[]=[],used=new Set<number>();
 const add=(kind:Group["kind"],at:number,members:number[])=>{
  groups.push({kind,at,members});members.forEach(i=>used.add(i));
 };
 for(const at of carbon){
  const near=neighbors(g,at);
  const ox=near.find(n=>g.atoms[n.index]==="O"&&n.order===2);
  const singleO=near.filter(n=>g.atoms[n.index]==="O"&&n.order===1);
  const amino=near.filter(n=>g.atoms[n.index]==="N"&&n.order===1);
  const cyano=near.find(n=>g.atoms[n.index]==="N"&&n.order===3);
  if(ox){
   // R-C(=O)-X and R-C(=O)-S are acid derivatives, never aldehydes.
   // Those without an exact reference match must remain unnamed.
   if(near.some(n=>n.order===1&&(!!prefixes[g.atoms[n.index]]||g.atoms[n.index]==="S")))
    return unsupported("Производное карбоновой кислоты требует отдельного правила");
   const acid=singleO.find(n=>neighbors(g,n.index).length===1);
   const ester=singleO.find(n=>neighbors(g,n.index).length===2);
   const amide=amino.find(n=>neighbors(g,n.index).length===1);
   if(acid)add("acid",at,[ox.index,acid.index]);
   else if(ester)add("ester",at,[ox.index,ester.index]);
   else if(amide)add("amide",at,[ox.index,amide.index]);
   else{
    const carbonNeighbors=near.filter(n=>g.atoms[n.index]==="C").length;
    if(carbonNeighbors===1)add("aldehyde",at,[ox.index]);
    else if(carbonNeighbors===2)add("ketone",at,[ox.index]);
    else return unsupported("Карбонильная группа не соответствует поддерживаемому типу");
   }
  }else if(cyano)add("nitrile",at,[cyano.index]);
 }
 for(let i=0;i<g.atoms.length;i++){
  if(used.has(i))continue;
  const near=neighbors(g,i);
  if(g.atoms[i]==="O"&&near.length===1&&near[0].order===1&&g.atoms[near[0].index]==="C"){
   add("alcohol",near[0].index,[i]);
  }else if(g.atoms[i]==="N"&&near.length===1&&near[0].order===1&&g.atoms[near[0].index]==="C"){
   add("amine",near[0].index,[i]);
  }else if(g.atoms[i]==="S"&&near.length===1&&near[0].order===1&&g.atoms[near[0].index]==="C"){
   add("thiol",near[0].index,[i]);
  }
 }
 // Ethers, tertiary amines, substituted amides/esters and conjugated aromatic
 // systems need additional rules; never silently give them alkane names.
 for(let i=0;i<g.atoms.length;i++){
  const a=g.atoms[i],ns=neighbors(g,i);
  if(a==="C")continue;
  if(prefixes[a]){
   if(ns.length!==1||ns[0].order!==1||g.atoms[ns[0].index]!=="C")
    return unsupported("Необычная связь с галогеном");
  }else if(!used.has(i)&&a!=="H")
   return unsupported("Для этой гетероатомной группы пока нет однозначного правила");
  else if(a==="H"&&(ns.length!==1||ns[0].order!==1))
   return unsupported("Проверьте явные атомы водорода");
 }
 if(groups.some(v=>v.kind==="ester"))return unsupported("Сложные эфиры определяются по проверенной базе; этот эфир пока не найден");
 const rank=Math.min(99,...groups.map(v=>seniority[v.kind]));
 const primary=groups.filter(v=>seniority[v.kind]===rank);
 const chief=primary[0]?.kind;
 if(primary.length>1)return unsupported("Для нескольких старших функциональных групп требуется дополнительная проверка номенклатуры");
 // Unsupported lower-ranking carbonyl/acid groups are not converted to suffixes.
 if(groups.some(v=>v.kind==="acid"&&v!==primary[0]||v.kind==="amide"&&v!==primary[0]||
     v.kind==="nitrile"&&v!==primary[0]||v.kind==="aldehyde"&&v!==primary[0]))
  return unsupported("Сочетание функциональных групп требует специального правила");
 const carbonds=g.links.filter(e=>g.atoms[e.a]==="C"&&g.atoms[e.b]==="C");
 if(carbonds.length!==carbon.length-1)return unsupported("Кольца и несколько углеродных фрагментов именуются по справочнику");
 const ends=carbon.filter(i=>carbonds.filter(e=>e.a===i||e.b===i).length<=1);
 const mainAtom=primary[0]?.at;
 const paths:number[][]=[];
 function route(at:number,seen:Set<number>,path:number[]){
  if(path.length>20)return;
  const next=carbonds.flatMap(e=>e.a===at&&!seen.has(e.b)?[e.b]:e.b===at&&!seen.has(e.a)?[e.a]:[]);
  if(!next.length){if((mainAtom===undefined||path.includes(mainAtom))&&path.length)paths.push(path);return;}
  next.forEach(i=>route(i,new Set([...seen,i]),[...path,i]));
 }
 ends.forEach(i=>route(i,new Set([i]),[i]));
 if(!paths.length)return unsupported("Не найдена подходящая главная цепь");
 type Option={path:number[];score:number[];prefix:string;core:string};
 const options:Option[]=[];
 for(const path of paths){
  if(path.length>20)continue;
  const loc=(i:number)=>path.indexOf(i)+1;
  const multiple=carbonds.filter(e=>path.includes(e.a)&&path.includes(e.b)&&e.order>1)
   .map(e=>({loc:Math.min(loc(e.a),loc(e.b)),order:e.order})).sort((a,b)=>a.loc-b.loc);
  const mainLoc=mainAtom===undefined?[]:[loc(mainAtom)];
  const branches:{at:number;kind:string}[]=[];
  let valid=true;
  path.forEach((at,index)=>{
   carbonds.filter(e=>e.a===at||e.b===at).forEach(e=>{
    const other=e.a===at?e.b:e.a;
    if(path.includes(other))return;
    const side=[other],prev=at;
    let cursor=other,parent=prev;
    while(true){
     const next=carbonds.flatMap(edge=>edge.a===cursor&&edge.b!==parent?[edge.b]:
       edge.b===cursor&&edge.a!==parent?[edge.a]:[]);
     if(next.length>1){valid=false;break;}
     if(!next.length)break;
     parent=cursor;cursor=next[0];if(side.includes(cursor)){valid=false;break;}
     side.push(cursor);
    }
    if(side.length>4||side.some(id=>neighbors(g,id).some(n=>g.atoms[n.index]!=="C"&&g.atoms[n.index]!=="H"))){
     valid=false;return;
    }
    const alky=["","метил","этил","пропил","бутил"][side.length];
    if(alky)branches.push({at:index+1,kind:alky});
    else valid=false;
   });
  });
  const otherGroups=groups.filter(v=>v!==primary[0]);
  for(const group of otherGroups){
   const p=loc(group.at);
   if(p<1){valid=false;break;}
   const name=group.kind==="alcohol"?"гидрокси":group.kind==="amine"?"амино":
     group.kind==="ketone"?"оксо":group.kind==="thiol"?"сульфанил":null;
   if(!name){valid=false;break;}
   branches.push({at:p,kind:name});
  }
  for(let i=0;i<g.atoms.length;i++){
   if(!prefixes[g.atoms[i]])continue;
   const anchor=neighbors(g,i)[0]?.index,p=loc(anchor);
   if(p<1){valid=false;break;}
   branches.push({at:p,kind:prefixes[g.atoms[i]]});
  }
  if(!valid)continue;
  const grouped=new Map<string,number[]>();
  branches.forEach(b=>grouped.set(b.kind,[...(grouped.get(b.kind)??[]),b.at]));
  const named=[...grouped.entries()].sort(([a],[b])=>a.localeCompare(b,"ru"))
   .map(([name,locants])=>{
    const nums=locants.sort((a,b)=>a-b).join(",");
    return nums+"-"+(multipliers[locants.length]??"")+" "+name;
   }).map(s=>s.replace(" ","")).join("-");
  const prefix=named;
  const unsats=multiple.filter(m=>m.order===2),ynes=multiple.filter(m=>m.order===3);
  if(unsats.length&&ynes.length){valid=false;}
  if(unsats.length>2||ynes.length>2)valid=false;
  if(!valid)continue;
  const stem=stems[path.length],saturated=stem+"ан";
  const orderGroup=unsats.length?unsats:ynes;
  const ene=unsats.length>0,unsuffix=ene?"ен":"ин";
  let hydrocarbon=saturated;
  if(orderGroup.length){
   const times=orderGroup.length>1?(multipliers[orderGroup.length]??""):"";
   const locants=orderGroup.map(m=>m.loc).join(",");
   hydrocarbon=stem+(orderGroup.length>1?"а":"")+"-"+locants+"-"+times+unsuffix;
  }
  let core=hydrocarbon;
  if(chief==="acid")core=(orderGroup.length?hydrocarbon:stem+"анов")+"ая кислота";
  if(chief==="amide")core=(orderGroup.length?hydrocarbon:stem+"ан")+"амид";
  if(chief==="nitrile")core=(orderGroup.length?hydrocarbon:stem+"ан")+"нитрил";
  if(chief==="aldehyde")core=(orderGroup.length?hydrocarbon:stem+"ан")+"аль";
  if(chief==="ketone")core=hydrocarbon+(orderGroup.length?"-":"-")+loc(mainAtom!)+"-он";
  if(chief==="alcohol")core=hydrocarbon+(path.length===1?"ол":path.length===2&&loc(mainAtom!)===1?"ол":"-"+loc(mainAtom!)+"-ол");
  if(chief==="thiol")core=hydrocarbon+(path.length===1?"тиол":"-"+loc(mainAtom!)+"-тиол");
  if(chief==="amine")core=hydrocarbon+(path.length===1?"амин":"-"+loc(mainAtom!)+"-амин");
  // Fixed nomenclature for -ene-ol requires the connecting '...ен-...ол' form.
  if(chief==="alcohol"&&path.length===1)core="метанол";
  // Path selection: longest chain -> most unsaturations -> lowest principal
  // locant -> lowest double/triple locants -> lowest branch locants.
  const score=[-path.length,-multiple.length,...mainLoc,99,
   ...orderGroup.map(x=>x.loc),99,...branches.map(b=>b.at).sort((a,b)=>a-b),99];
  options.push({path,score,prefix,core});
 }
 if(!options.length)return unsupported("Строение заместителей требует расширенных правил именования");
 const compare=(a:number[],b:number[])=>{
  for(let i=0;i<Math.max(a.length,b.length);i++){
   const d=(a[i]??99)-(b[i]??99);
   if(d)return d;
  }
  return 0;
 };
 options.sort((a,b)=>compare(a.score,b.score)||a.prefix.localeCompare(b.prefix,"ru"));
 const chosen=options[0];
 return {systematic:chosen.prefix+chosen.core,trivial:null,status:"calculated",
  reason:"Название рассчитано по главной цепи, приоритету функциональных групп, кратным связям и заместителям. Стереохимия не определялась."};
}
export function nameOrganicStructure(item:Pick<Item,"graphPoints"|"graphSegments">):OrganicNameResult{
 const formula=analyzeOrganicStructure(item as Item);
 if(!formula.valid)return unsupported(formula.note);
 const atoms=(item.graphPoints??[]).map(p=>p.label.trim());
 const links=(item.graphSegments??[]).map(e=>({a:e.a,b:e.b,order:e.bondOrder??1}));
 if(!atoms.length||atoms.length>80||links.length>120)return unsupported("Необходимо проверить размер и связность структуры");
 const g:Graph={atoms,links};
 if(atoms.some(a=>!(a in values)))return unsupported("В структуре есть неподдерживаемый символ атома");
 if(links.some(e=>e.a===e.b||!atoms[e.a]||!atoms[e.b]||![1,2,3].includes(e.order)))
  return unsupported("Проверьте порядок и концы связей");
 if(!connected(g))return unsupported("Соединение должно состоять из одной связной структуры");
 const hydrogens=g.atoms.map((s,i)=>values[s]-neighbors(g,i).reduce((n,v)=>n+v.order,0));
 if(hydrogens.some(n=>n<0))return unsupported("Превышена допустимая валентность");
 if(atoms.some((s,i)=>s==="H"&&neighbors(g,i).length!==1))
  return unsupported("Атом водорода должен иметь одну связь");
 // Hydrogen coordinates are not part of molecular identity: a structure with
 // explicitly drawn H atoms must match the same reference as implicit H.
 const heavyIndices=atoms.map((a,i)=>a==="H"?-1:i).filter(i=>i>=0);
 const indices=new Map(heavyIndices.map((original,i)=>[original,i]));
 const heavy:Graph={atoms:heavyIndices.map(i=>atoms[i]),links:links
  .filter(e=>indices.has(e.a)&&indices.has(e.b))
  .map(e=>({...e,a:indices.get(e.a)!,b:indices.get(e.b)!}))};
 for(const entry of references){
  if(sameStructure(heavy,entry.graph))return {systematic:entry.systematic,trivial:entry.trivial??null,
   status:"reference",reason:"Структура совпала с проверенным справочным соединением"};
 }
 return calculated(heavy);
}
