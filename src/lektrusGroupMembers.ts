// Per-teacher group membership, independent of the board-category labels.
// Stored locally until a server-side membership table is introduced.
const storageKey=(userId:string)=>"lektrus.group-members.v1."+userId;
export type GroupMembership=Record<string,string[]>;
export function readGroupMembership(userId:string):GroupMembership{
  try {
    const raw=JSON.parse(localStorage.getItem(storageKey(userId))||"{}") as unknown;
    if(!raw||typeof raw!=="object"||Array.isArray(raw))return {};
    return Object.fromEntries(Object.entries(raw).filter(([key,value])=>key.length>0&&Array.isArray(value)).map(([key,value])=>[key,(value as unknown[]).filter((id):id is string=>typeof id==="string")]));
  }catch{return {}}
}
export function setGroupMembership(userId:string,group:string,studentIds:string[]):GroupMembership{
  const next={...readGroupMembership(userId),[group]:[...new Set(studentIds)]};
  localStorage.setItem(storageKey(userId),JSON.stringify(next));
  return next;
}
