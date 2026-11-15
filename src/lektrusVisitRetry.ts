/** Visit requests are idempotent with their original session ID. Retry a
 * transient gateway/network failure, but never an authorization failure. */
export async function retryVisitRequest<T>(request:()=>Promise<T>,
 wait:(ms:number)=>Promise<void>=ms=>new Promise(resolve=>setTimeout(resolve,ms))):Promise<T>{
 const delays=[400,1200];
 for(let attempt=0;;attempt++){
  try{return await request()}catch(error){
   const status=(error as {status?:number}|null)?.status;
   const transient=status===502||status===503||status===504||error instanceof TypeError||
    (error instanceof Error&&error.message==="Время ожидания собственного сервера истекло.");
   if(!transient||attempt>=delays.length)throw error;
   await wait(delays[attempt]);
  }
 }
}
