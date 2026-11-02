/** Classroom drag-and-place tasks, kept separate from the saved atlas.
 * A diagram stores the teacher's five-node answer path; the pupil's
 * placements stay ephemeral and cannot change that answer or the shared board.
 */
import type {BioNode,BioLevel} from "./lektrusBioMicroscopeModel";
import {BIO_LEVELS,bioAncestors,bioTaskChoices} from "./lektrusBioMicroscopeModel";
export type BioAssemblyLevel=Exclude<BioLevel,"organism">;
export const BIO_ASSEMBLY_LEVELS:BioAssemblyLevel[]=["system","organ","tissue","cell"];
export type BioAssemblyPlacements=Partial<Record<BioAssemblyLevel,string>>;
export type BioAssemblyEvaluation={
 total:4;correct:number;complete:boolean;passed:boolean;
 results:Record<BioAssemblyLevel,"correct"|"wrong"|"empty">;
};
const rank=(id:string):number=>{
 let x=2166136261;
 for(const char of id)x=Math.imul(x^char.charCodeAt(0),16777619);
 return x>>>0;
};
/** Teacher path is a chain, not four independent correct names. */
export function bioAssemblyAnswer(nodes:BioNode[],path:string[]):BioNode[] {
 if(path.length!==5)return [];
 const lookup=new Map(nodes.map(node=>[node.id,node]));
 const chain=path.map(id=>lookup.get(id));
 if(chain.some(node=>!node))return [];
 for(let i=0;i<chain.length;i++){
  if(chain[i]?.level!==BIO_LEVELS[i])return [];
  if(i===0?chain[i]?.parentId!==null:chain[i]?.parentId!==chain[i-1]?.id)return [];
 }
 return chain.filter((node):node is BioNode=>!!node);
}
/** Never use free-text names as identifiers: "Лист" occurs in two species
 * and several branches may share a tissue. Only stable full IDs count. */
export function bioAssemblyPalette(nodes:BioNode[],path:string[]):BioNode[]{
 const answer=bioAssemblyAnswer(nodes,path);
 if(answer.length!==5)return [];
 const picked=new Map<string,BioNode>();
 for(const target of answer.slice(1)){
  for(const node of bioTaskChoices(nodes,target,3))picked.set(node.id,node);
 }
 return [...picked.values()].sort((a,b)=>rank(a.id)-rank(b.id)||a.id.localeCompare(b.id));
}
export function bioAssemblyEvaluate(
 nodes:BioNode[],path:string[],placements:BioAssemblyPlacements
):BioAssemblyEvaluation{
 const answer=bioAssemblyAnswer(nodes,path);
 const byId=new Map(nodes.map(node=>[node.id,node]));
 const results={} as BioAssemblyEvaluation["results"];
 let correct=0,complete=answer.length===5;
 for(let i=0;i<BIO_ASSEMBLY_LEVELS.length;i++){
  const level=BIO_ASSEMBLY_LEVELS[i];
  const id=placements[level];
  const node=id?byId.get(id):undefined;
  if(!node||node.level!==level){results[level]=id?"wrong":"empty";complete=false;continue;}
  if(node.id===answer[i+1]?.id){results[level]="correct";correct++;}
  else results[level]="wrong";
 }
 return {total:4,correct,complete,passed:complete&&correct===4,results};
}
/** A placement must be one existing node of the matching educational
 * level AND of the current organism. Never accept strings from another atlas. */
export function bioAssemblyPlace(
 nodes:BioNode[],placements:BioAssemblyPlacements,
 level:BioAssemblyLevel,id:string
):BioAssemblyPlacements|null{
 if(!BIO_ASSEMBLY_LEVELS.includes(level))return null;
 const node=nodes.find(candidate=>candidate.id===id);
 if(!node||node.level!==level)return null;
 // Avoid duplicating a single card in more than one target position.
 return {...Object.fromEntries(Object.entries(placements).filter(([,value])=>value!==id)),[level]:id};
}
export function bioAssemblyRemove(placements:BioAssemblyPlacements,level:BioAssemblyLevel):BioAssemblyPlacements{
 const copy={...placements};delete copy[level];return copy;
}
export function bioAssemblyPathForSelection(nodes:BioNode[],selectedId:string):string[]{
 const node=nodes.find(n=>n.id===selectedId);
 if(!node||node.level!=="cell")return [];
 return bioAncestors(nodes,node.id).map(n=>n.id);
}
