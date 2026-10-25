/** Editable mechanics drawing, independent from arbitrary geometric vertices. */
export type MechanicsBody={id:string;kind:"block"|"circle";x:number;y:number;width:number;height:number;mass:number;label:string};
export type MechanicsSupport={id:string;kind:"floor"|"incline"|"pivot";x:number;y:number;width:number;angle:number;label:string};
export type MechanicsForce={id:string;bodyId:string|null;x:number;y:number;angle:number;length:number;magnitude:number;label:string;showValue:boolean};
export type MechanicsDocument={version:1;bodies:MechanicsBody[];supports:MechanicsSupport[];forces:MechanicsForce[];grid:boolean;labels:boolean};
export type MechanicsSelection={type:"body"|"support"|"force";id:string}|null;
export type MechanicsTool="select"|"block"|"circle"|"floor"|"incline"|"pivot"|"force";
export const MECH_WIDTH=960,MECH_HEIGHT=560;
export const mechanicsId=()=>Math.random().toString(36).slice(2,9)+Date.now().toString(36).slice(-5);
export const mechClamp=(v:number,a:number,b:number)=>Math.max(a,Math.min(b,v));
export const emptyMechanics=():MechanicsDocument=>({version:1,bodies:[],supports:[],forces:[],grid:true,labels:true});
export const mechanicsForceOrigin=(force:MechanicsForce,doc:MechanicsDocument)=>{
 const body=force.bodyId?doc.bodies.find(b=>b.id===force.bodyId):undefined;
 return body?{x:body.x+force.x,y:body.y+force.y}:{x:force.x,y:force.y};
};
export const mechanicsForceTip=(force:MechanicsForce,doc:MechanicsDocument)=>{
 const p=mechanicsForceOrigin(force,doc),r=force.angle*Math.PI/180;
 return {x:p.x+Math.cos(r)*force.length,y:p.y-Math.sin(r)*force.length};
};
export function mechanicsValid(data:unknown):data is MechanicsDocument{
 if(!data||typeof data!=="object")return false;
 const d=data as Partial<MechanicsDocument>;
 if(d.version!==1||!Array.isArray(d.bodies)||!Array.isArray(d.supports)||!Array.isArray(d.forces)||
 d.bodies.length>60||d.supports.length>60||d.forces.length>180||
 typeof d.grid!=="boolean"||typeof d.labels!=="boolean")return false;
 const ids=new Set<string>(),bodyIds=new Set<string>();
 const common=(v:{id:string;x:number;y:number;label:string})=>
  v&&typeof v.id==="string"&&v.id.length>0&&v.id.length<=64&&!ids.has(v.id)&&
  Number.isFinite(v.x)&&Number.isFinite(v.y)&&v.x>=0&&v.x<=960&&v.y>=0&&v.y<=560&&
  typeof v.label==="string"&&v.label.length<=75;
 for(const b of d.bodies){
  if(!common(b)||!["block","circle"].includes(b.kind)||![b.width,b.height,b.mass].every(Number.isFinite)||
    b.width<20||b.width>420||b.height<20||b.height>420||b.mass<0||b.mass>1e7)return false;
  ids.add(b.id);bodyIds.add(b.id);
 }
 for(const s of d.supports){
  if(!common(s)||!["floor","incline","pivot"].includes(s.kind)||
    !Number.isFinite(s.width)||s.width<30||s.width>500||
    !Number.isFinite(s.angle)||s.angle< -75||s.angle>75)return false;
  ids.add(s.id);
 }
 for(const f of d.forces){
  if(!common(f)||!Number.isFinite(f.angle)||f.angle< -360||f.angle>360||
    !Number.isFinite(f.length)||f.length<15||f.length>400||
    !Number.isFinite(f.magnitude)||f.magnitude<0||f.magnitude>1e9||
    typeof f.showValue!=="boolean"||
    (f.bodyId!==null&&(typeof f.bodyId!=="string"||!bodyIds.has(f.bodyId))))return false;
  ids.add(f.id);
 }
 return true;
}
