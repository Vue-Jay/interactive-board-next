// Live identity colors belong to a room session, not to a permanent user ID.
export const TEACHER_COLOR="#3056c8";
const STUDENT_PALETTE=["#087f69","#b23a56","#8052ac","#a65b13","#166b99","#71801b","#a13487","#096d79","#aa4426","#5744a8","#277247","#975321","#3c669c","#873b63","#536c22","#426b70","#8d3e36","#675197","#79591d","#28758d","#a34270","#4a6955","#6a5280"] as const;
export const validParticipantColor=(color:unknown):color is string=>typeof color==="string"&&/^#[0-9a-f]{6}$/i.test(color);
// Only a placeholder until a presence_state arrives. Do not bind its color to an ID.
export const fallbackParticipantColor=(_id:string):string=>STUDENT_PALETTE[0];

export function participantColors(users:readonly {userId:string;role?:string;onlineAt?:string;color?:string}[],ownerId?:string):ReadonlyMap<string,string>{
  const colors=new Map<string,string>(),used=new Set<string>([TEACHER_COLOR]);
  const ordered=[...users].sort((a,b)=>(a.onlineAt??"").localeCompare(b.onlineAt??"")||a.userId.localeCompare(b.userId));
  for(const user of ordered){
    if(user.role==="owner"||user.userId===ownerId)colors.set(user.userId,TEACHER_COLOR);
  }
  // Trust unique server-issued live colors, never a stale duplicated or teacher color.
  for(const user of ordered){
    if(colors.has(user.userId))continue;
    if(validParticipantColor(user.color)&&!used.has(user.color)){
      colors.set(user.userId,user.color);
      used.add(user.color);
    }
  }
  let cursor=0;
  for(const user of ordered){
    if(colors.has(user.userId))continue;
    let color:string|undefined;
    for(let i=0;i<STUDENT_PALETTE.length;i++){
      const candidate=STUDENT_PALETTE[(cursor+i)%STUDENT_PALETTE.length];
      if(!used.has(candidate)){color=candidate;cursor=(cursor+i+1)%STUDENT_PALETTE.length;break;}
    }
    if(!color){
      for(let i=0;i<1000;i++){
        const candidate="#"+((0x124365+Math.imul(i+1,0x9e3779b1))&0xffffff).toString(16).padStart(6,"0");
        if(!used.has(candidate)){color=candidate;break;}
      }
    }
    if(!color)throw Error("Board participant color palette exhausted");
    used.add(color);colors.set(user.userId,color);
  }
  return colors;
}
