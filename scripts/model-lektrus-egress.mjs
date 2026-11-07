import assert from "node:assert/strict";

/** Forecast only, not TatNet meter data. Decimal MB/GB, school days. */
export const assumptions=Object.freeze({
 daysPerMonth:22,participantsPerLesson:6,lessonHoursPerActiveDay:1,
 boardMB:0.231,savesPerLessonHour:120,duplicateFetchFraction:0.15,
 reconnectFraction:0.20,
 mediaMBPerUserHour:3,otherApiMBPerUserHour:0.3,
 // Cursor, presence, chat and board control (NOT document updates).
 sideRealtimeMBPerUserHour:0.5,
 monthlyLimitGB:250,releaseBudgetGB:175,
});
export function projectMonthlyEgress(usersPerSchoolDay,settings=assumptions){
 const s=settings;
 assert.ok(Number.isFinite(usersPerSchoolDay)&&usersPerSchoolDay>=0);
 assert.ok(s.participantsPerLesson>0&&s.daysPerMonth>0);
 const lessonHours=usersPerSchoolDay/s.participantsPerLesson*s.lessonHoursPerActiveDay*s.daysPerMonth;
 // Full record or fallback GET can reach each OTHER participant per save.
 // The fallback multiplier is uncertain: measure actual WAL/GET split.
 const boardRealtimeMB=lessonHours*s.savesPerLessonHour*s.boardMB*
  (s.participantsPerLesson-1)*(1+s.duplicateFetchFraction);
 const boardOpenReconnectMB=lessonHours*s.participantsPerLesson*s.boardMB*
  (1+s.reconnectFraction);
 const mediaMB=lessonHours*s.participantsPerLesson*s.mediaMBPerUserHour;
 const sideRealtimeMB=lessonHours*s.participantsPerLesson*s.sideRealtimeMBPerUserHour;
 const otherApiMB=lessonHours*s.participantsPerLesson*s.otherApiMBPerUserHour;
 // Upstream PUT/RPC is NEVER quietly counted as egress, but future TatNet
 // could bill combined traffic rather than strict outbound bytes.
 const inboundBoardSavesMB=lessonHours*s.savesPerLessonHour*s.boardMB;
 const boardGB=(boardRealtimeMB+boardOpenReconnectMB)/1000;
 const mediaGB=mediaMB/1000,sideRealtimeGB=sideRealtimeMB/1000,
  otherApiGB=otherApiMB/1000,inboundBoardSavesGB=inboundBoardSavesMB/1000;
 const totalGB=boardGB+mediaGB+sideRealtimeGB+otherApiGB;
 return {usersPerSchoolDay,lessonHours,boardGB,mediaGB,sideRealtimeGB,otherApiGB,
  inboundBoardSavesGB,totalGB,combinedWithInboundGB:totalGB+inboundBoardSavesGB,
  insideReleaseBudget:totalGB<=s.releaseBudgetGB,
  insideCombinedBudget:totalGB+inboundBoardSavesGB<=s.releaseBudgetGB};
}
for(const users of [6,60,300,600]){
 const row=projectMonthlyEgress(users);
 assert.ok(row.totalGB>0);
 const perDayMB=row.totalGB*1000/(users*assumptions.daysPerMonth);
 console.log(`${users} daily active; ${row.lessonHours.toFixed(0)} lesson-h/month; board=${row.boardGB.toFixed(2)} GB, media=${row.mediaGB.toFixed(2)} GB, side-realtime=${row.sideRealtimeGB.toFixed(2)} GB, API=${row.otherApiGB.toFixed(2)} GB, total egress=${row.totalGB.toFixed(2)} GB, inbound board saves=${row.inboundBoardSavesGB.toFixed(2)} GB, per-user day=${perDayMB.toFixed(2)} MB, 175-GB gate=${row.insideReleaseBudget?"within scenario":"exceeded"}`);
}
const stress=projectMonthlyEgress(60,{...assumptions,
 boardMB:1.16,savesPerLessonHour:300,duplicateFetchFraction:0.5,
 reconnectFraction:0.5,mediaMBPerUserHour:12,sideRealtimeMBPerUserHour:2,
 otherApiMBPerUserHour:1});
assert.ok(stress.totalGB>assumptions.monthlyLimitGB,
 "High-stress 60-user scenario must not be misrepresented as safe");
console.log(`High-load 60 daily active: ${stress.totalGB.toFixed(2)} GB/month egress, ${stress.combinedWithInboundGB.toFixed(2)} GB combined, exceeds 250 GB`);
