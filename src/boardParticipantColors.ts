// Identity colours are independent from the user's selected drawing colour.
const PALETTE=["#3056c8","#087f69","#b23a56","#8052ac","#a65b13","#166b99","#71801b","#a13487","#096d79","#aa4426","#5744a8","#277247","#975321","#3c669c","#873b63","#536c22","#426b70","#8d3e36","#675197","#79591d","#28758d","#a34270","#4a6955","#6a5280"] as const;
export const validParticipantColor=(color:unknown):color is string=>typeof color==="string"&&/^#[0-9a-f]{6}$/i.test(color);
const hash=(id:string)=>{let n=0;for(const char of id)n=(Math.imul(n,31)+char.charCodeAt(0))>>>0;return n;};
export const fallbackParticipantColor=(id:string)=>PALETTE[hash(id)%PALETTE.length];
export function participantColors(users:readonly {userId:string;color?:string}[]):ReadonlyMap<string,string>{
  const colors=new Map<string,string>(),used=new Set<string>();
  for(const user of users)if(validParticipantColor(user.color)){colors.set(user.userId,user.color);used.add(user.color);}
  for(const user of [...users].sort((a,b)=>a.userId.localeCompare(b.userId))){
    if(colors.has(user.userId))continue;
    const start=hash(user.userId)%PALETTE.length;
    let color:string=fallbackParticipantColor(user.userId);
    for(let i=0;i<PALETTE.length;i++){const c=PALETTE[(start+i)%PALETTE.length];if(!used.has(c)){color=c;break;}}
    if(used.has(color)){for(let i=0;i<1000;i++){const c="#"+(0x304050+((hash(user.userId)+i*1297)%0x3f3f3f)).toString(16).padStart(6,"0");if(!used.has(c)){color=c;break;}}}
    used.add(color);colors.set(user.userId,color);
  }
  return colors;
}
