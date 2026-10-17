import type {Item} from "./boardModel";
import type {CircuitSymbol} from "./ScienceCircuitGlyph";

/** Stable saved format. Wires attach to terminals or independent junctions. */
export type CircuitComponent={
  id:string;type:Exclude<CircuitSymbol,"wire">;
  x:number;y:number;rotation:0|90|180|270;
  label:string;value:string;closed?:boolean;
};
export type CircuitJunction={id:string;x:number;y:number};
export type CircuitAnchor=
  |{kind:"terminal";componentId:string;side:"a"|"b"}
  |{kind:"junction";junctionId:string};
export type CircuitWire={
  id:string;from:CircuitAnchor;to:CircuitAnchor;
  route:"hvh"|"vhv"|"straight";
};
export type CircuitDocument={
  version:1;components:CircuitComponent[];
  junctions:CircuitJunction[];wires:CircuitWire[];
  showGrid:boolean;snap:boolean;
};
export const CIRCUIT_SIZE={width:900,height:580,step:20,lead:33};
export const circuitId=()=>Math.random().toString(36).slice(2,10)+Date.now().toString(36).slice(-4);
export const clampCircuit=(v:number,min:number,max:number)=>Math.min(max,Math.max(min,v));
export const gridCircuit=(v:number,snap:boolean)=>snap?Math.round(v/CIRCUIT_SIZE.step)*CIRCUIT_SIZE.step:Math.round(v);
export const createCircuitDocument=():CircuitDocument=>({version:1,components:[],junctions:[],wires:[],showGrid:true,snap:true});
export const circuitTerminal=(component:CircuitComponent,side:"a"|"b")=>{
  const radius=CIRCUIT_SIZE.lead*(side==="a"?-1:1);
  const angle=component.rotation*Math.PI/180;
  return {x:component.x+Math.cos(angle)*radius,y:component.y+Math.sin(angle)*radius};
};
export function circuitAnchorPosition(doc:CircuitDocument,anchor:CircuitAnchor):{x:number;y:number}|null{
  if(anchor.kind==="junction"){
    const junction=doc.junctions.find(x=>x.id===anchor.junctionId);
    return junction?{x:junction.x,y:junction.y}:null;
  }
  const component=doc.components.find(x=>x.id===anchor.componentId);
  return component?circuitTerminal(component,anchor.side):null;
}
export function circuitPolyline(doc:CircuitDocument,wire:CircuitWire):{x:number;y:number}[]{
  const a=circuitAnchorPosition(doc,wire.from),b=circuitAnchorPosition(doc,wire.to);
  if(!a||!b)return [];
  if(wire.route==="straight"||Math.abs(a.x-b.x)<.1||Math.abs(a.y-b.y)<.1)return [a,b];
  if(wire.route==="hvh"){
    const x=(a.x+b.x)/2;
    return [a,{x,y:a.y},{x,y:b.y},b];
  }
  const y=(a.y+b.y)/2;
  return [a,{x:a.x,y},{x:b.x,y},b];
}
export const circuitPolylineString=(points:{x:number;y:number}[])=>
  points.map(p=>p.x+","+p.y).join(" ");
export function connectedCircuit(a:CircuitAnchor,b:CircuitAnchor):boolean{
  return a.kind===b.kind&&(a.kind==="terminal"&&b.kind==="terminal"?
    a.componentId===b.componentId&&a.side===b.side:
    a.kind==="junction"&&b.kind==="junction"&&a.junctionId===b.junctionId);
}
export function circuitDocumentWithWire(doc:CircuitDocument,from:CircuitAnchor,to:CircuitAnchor):CircuitDocument{
  if(connectedCircuit(from,to))return doc;
  if(doc.wires.length>=400)return doc;
  if(doc.wires.some(w=>(connectedCircuit(w.from,from)&&connectedCircuit(w.to,to))||
    (connectedCircuit(w.from,to)&&connectedCircuit(w.to,from))))return doc;
  return {...doc,wires:[...doc.wires,{id:circuitId(),from,to,route:"hvh"}]};
}
export function circuitRemoveComponent(doc:CircuitDocument,id:string):CircuitDocument{
  return {...doc,components:doc.components.filter(c=>c.id!==id),
    wires:doc.wires.filter(w=>[w.from,w.to].every(a=>a.kind!=="terminal"||a.componentId!==id))};
}
export function circuitRemoveJunction(doc:CircuitDocument,id:string):CircuitDocument{
  return {...doc,junctions:doc.junctions.filter(n=>n.id!==id),
    wires:doc.wires.filter(w=>[w.from,w.to].every(a=>a.kind!=="junction"||a.junctionId!==id))};
}
export function circuitIsDocument(input:unknown):input is CircuitDocument{
  if(!input||typeof input!=="object")return false;
  const d=input as Partial<CircuitDocument>;
  if(d.version!==1||!Array.isArray(d.components)||!Array.isArray(d.junctions)||
    !Array.isArray(d.wires)||typeof d.showGrid!=="boolean"||typeof d.snap!=="boolean"||
    d.components.length>120||d.junctions.length>240||d.wires.length>400)return false;
  const validCoord=(x:unknown,y:unknown)=>typeof x==="number"&&Number.isFinite(x)&&x>=0&&x<=CIRCUIT_SIZE.width&&
    typeof y==="number"&&Number.isFinite(y)&&y>=0&&y<=CIRCUIT_SIZE.height;
  const ids=new Set<string>();
  const addId=(id:unknown)=>typeof id==="string"&&id.length>0&&id.length<=72&&!ids.has(id)&&(ids.add(id),true);
  const types=new Set<string>([
    "resistor","variable-resistor","lamp","source","cell","battery","ac-source",
    "switch","push-button","fuse","ammeter","voltmeter","galvanometer","motor",
    "diode","led","capacitor","capacitor-polarized","inductor","bell","ground",
    "photoresistor"
  ]);
  for(const c of d.components){
    if(!c||!addId(c.id)||!types.has(c.type)||!validCoord(c.x,c.y)||
      ![0,90,180,270].includes(c.rotation)||typeof c.label!=="string"||c.label.length>60||
      typeof c.value!=="string"||c.value.length>60||(c.closed!=null&&typeof c.closed!=="boolean"))return false;
  }
  for(const n of d.junctions)if(!n||!addId(n.id)||!validCoord(n.x,n.y))return false;
  const componentIds=new Set(d.components.map(c=>c.id));
  const junctionIds=new Set(d.junctions.map(n=>n.id));
  const anchorIsValid=(a:CircuitAnchor)=>a&&(
    a.kind==="terminal"&&componentIds.has(a.componentId)&&(a.side==="a"||a.side==="b")||
    a.kind==="junction"&&junctionIds.has(a.junctionId));
  for(const w of d.wires)if(!w||!addId(w.id)||!anchorIsValid(w.from)||!anchorIsValid(w.to)||
    !["hvh","vhv","straight"].includes(w.route)||connectedCircuit(w.from,w.to))return false;
  return true;
}
/** Read older saved constructions so users do not lose their old circuit diagrams. */
export function circuitFromLegacyItem(item:Item):CircuitDocument{
  if(item.scienceCircuit&&circuitIsDocument(item.scienceCircuit))return item.scienceCircuit;
  const doc=createCircuitDocument();
  doc.showGrid=item.graphGrid!==false;
  const source=item.graphPoints??[];
  const graphToCanvas=(x:number,y:number)=>({x:clampCircuit(450+x*38,20,880),y:clampCircuit(290-y*38,20,560)});
  doc.junctions=source.map((p,i)=>({id:"legacy-node-"+i,...graphToCanvas(p.x,p.y)}));
  for(const [i,seg] of (item.graphSegments??[]).entries()){
    const a=doc.junctions[seg.a],b=doc.junctions[seg.b];
    if(!a||!b)continue;
    const from:CircuitAnchor={kind:"junction",junctionId:a.id};
    const to:CircuitAnchor={kind:"junction",junctionId:b.id};
    const symbol=seg.scienceCircuitSymbol;
    if(!symbol||symbol==="wire"){
      doc.wires.push({id:"legacy-wire-"+i,from,to,route:"straight"});continue;
    }
    // Rotate school symbols to horizontal or vertical, preserve the original junctions.
    const vertical=Math.abs(a.y-b.y)>Math.abs(a.x-b.x);
    const component:CircuitComponent={
      id:"legacy-component-"+i,
      type:symbol,x:(a.x+b.x)/2,y:(a.y+b.y)/2,
      rotation:vertical?90:0,label:seg.label??"",value:""
    };
    doc.components.push(component);
    doc.wires.push({id:"legacy-wire-"+i+"a",from,
      to:{kind:"terminal",componentId:component.id,side:vertical?(a.y<b.y?"a":"b"):(a.x<b.x?"a":"b")},
      route:"straight"});
    doc.wires.push({id:"legacy-wire-"+i+"b",
      from:{kind:"terminal",componentId:component.id,side:vertical?(a.y<b.y?"b":"a"):(a.x<b.x?"b":"a")},
      to,route:"straight"});
  }
  return doc;
}
export function circuitTemplate(id:"physics-circuit-series"|"physics-circuit-meters"|"physics-circuit-free"|"physics-circuit-parallel"):CircuitDocument{
  const doc=createCircuitDocument();
  if(id==="physics-circuit-free")return doc;
  const component=(id:string,type:CircuitComponent["type"],x:number,y:number,rotation:0|90|180|270=0):CircuitComponent=>
    ({id,type,x,y,rotation,label:"",value:""});
  const ca=(id:string,side:"a"|"b"):CircuitAnchor=>({kind:"terminal",componentId:id,side});
  const j=(id:string):CircuitAnchor=>({kind:"junction",junctionId:id});
  if(id==="physics-circuit-series"){
    doc.components=[
      component("battery","battery",190,310,90),
      component("resistor","resistor",450,155),
      component("switch","switch",690,155),
      component("lamp","lamp",690,420),
      component("am","ammeter",450,420)
    ];
    doc.wires=[
      ["battery","a","resistor","a"],["resistor","b","switch","a"],["switch","b","lamp","a"],
      ["lamp","b","am","b"],["am","a","battery","b"]
    ].map(([from,fromSide,to,toSide],index)=>({id:"wire"+index,from:ca(from,fromSide as "a"|"b"),to:ca(to,toSide as "a"|"b"),route:"hvh" as const}));
  }else if(id==="physics-circuit-parallel"){
    // Two parallel lamp branches fed by a separate source.
    // The source spans the two bus rails; the switch is in the upper branch.
    doc.components=[
      component("source","battery",450,495),
      component("lamp1","lamp",450,150),
      component("lamp2","lamp",450,355),
      component("switch","switch",640,255,90)
    ];
    doc.junctions=[
      {id:"left-top",x:280,y:150},{id:"left-bottom",x:280,y:355},
      {id:"right-top",x:640,y:150},{id:"right-bottom",x:640,y:355}
    ];
    const wires:[CircuitAnchor,CircuitAnchor][]=[
      [ca("source","a"),j("left-bottom")],
      [ca("source","b"),j("right-bottom")],
      [j("left-top"),ca("lamp1","a")],
      [ca("lamp1","b"),j("right-top")],
      [j("left-bottom"),ca("lamp2","a")],
      [ca("lamp2","b"),j("right-bottom")],
      [j("left-top"),j("left-bottom")],
      [j("right-top"),ca("switch","a")],
      [ca("switch","b"),j("right-bottom")]
    ];
    doc.wires=wires.map(([from,to],index)=>({id:"wire"+index,from,to,route:"hvh"}));
  }else{
    doc.components=[
      component("source","battery",170,300,90),component("switch","switch",420,160),
      component("resistor","resistor",650,160),component("amp","ammeter",650,430),
      component("volt","voltmeter",430,300),component("lamp","lamp",420,430)
    ];
    doc.junctions=[{id:"upper-a",x:320,y:160},{id:"upper-b",x:750,y:160},
      {id:"lower-a",x:320,y:430},{id:"lower-b",x:750,y:430}];
    const pairs:[CircuitAnchor,CircuitAnchor][]=[
      [ca("source","a"),j("upper-a")],[j("upper-a"),ca("switch","a")],
      [ca("switch","b"),ca("resistor","a")],[ca("resistor","b"),j("upper-b")],
      [j("upper-b"),ca("amp","a")],[ca("amp","b"),j("lower-b")],
      [j("lower-b"),ca("lamp","b")],[ca("lamp","a"),j("lower-a")],
      [j("lower-a"),ca("source","b")],[j("upper-a"),ca("volt","a")],
      [ca("volt","b"),j("lower-a")]
    ];
    doc.wires=pairs.map(([from,to],index)=>({id:"wire"+index,from,to,route:"hvh"}));
  }
  return doc;
}
