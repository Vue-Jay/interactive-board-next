// Wall-clock time includes frozen/background tabs. Neither ping nor received
// peer traffic is user activity; preserve this lease on automatic reconnect.
export const BOARD_IDLE_MS=10*60*1000;
export const boardIdleAge=(last:number,now=Date.now())=>Math.max(0,Math.min(BOARD_IDLE_MS,now-last));
export const boardIdleRemaining=(last:number,now=Date.now())=>BOARD_IDLE_MS-boardIdleAge(last,now);
export const boardIdleExpired=(last:number,now=Date.now())=>boardIdleRemaining(last,now)===0;
