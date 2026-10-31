/** Lab-only persistence pacing. Visual collaboration remains realtime:
 * this bounds how often automatic simulation ticks serialize the complete
 * shared board. Explicit teacher actions still use the normal 220ms autosave.
 */
export const LAB_SIMULATION_LOCAL_QUIET_MS=900;
export const LAB_SIMULATION_CHECKPOINT_MAX_MS=2200;

export function labSimulationCheckpointDelayMs(nowMs:number,firstTickAtMs:number):number{
 if(!Number.isFinite(nowMs)||!Number.isFinite(firstTickAtMs))return 0;
 const elapsed=Math.max(0,nowMs-firstTickAtMs);
 // The absolute deadline prevents starvation when the lab updates faster
 // than the quiet debounce. Save the latest full document within 2.2s.
 return Math.max(0,Math.min(LAB_SIMULATION_LOCAL_QUIET_MS,
  LAB_SIMULATION_CHECKPOINT_MAX_MS-elapsed));
}
