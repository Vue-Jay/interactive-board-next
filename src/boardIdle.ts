// Foreground boards have no idle deadline. Only continuous background time counts.
export const BOARD_IDLE_MS=10*60*1000;
export const boardIdleAge=(hiddenSince:number|null,now=Date.now())=>hiddenSince===null?0:Math.max(0,Math.min(BOARD_IDLE_MS,now-hiddenSince));
export const boardIdleRemaining=(hiddenSince:number|null,now=Date.now())=>BOARD_IDLE_MS-boardIdleAge(hiddenSince,now);
export const boardIdleExpired=(hiddenSince:number|null,now=Date.now())=>hiddenSince!==null&&boardIdleRemaining(hiddenSince,now)===0;
