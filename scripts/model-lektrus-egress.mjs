import assert from "node:assert/strict";

/**
 * Release capacity planning only, NOT metered billing data.
 * Units are decimal MB (10^6 bytes), GB (10^9 bytes).
 * A lesson-hour is ONE board session with teacher + pupils, not a user-hour.
 * Default assumptions come from the release audit, not production guarantees.
 */
export const assumptions=Object.freeze({
 daysPerMonth:22,participantsPerLesson:6,lessonHoursPerActiveDay:1,
 boardMB:0.231,savesPerLessonHour:120,duplicateFetchFraction:0.15,
 reconnectFraction:0.20,mediaMBPerUserHour:3,otherApiMBPerUserHour:0.3,
 monthlyLimitGB:250,releaseBudgetGB:175,
});
export function projectMonthlyEgress(usersPerSchoolDay,settings=assumptions){
 const s=settings;
 assert.ok(Number.isFinite(usersPerSchoolDay)&&usersPerSchoolDay>=0);
 const lessonHours=usersPerSchoolDay/s.participantsPerLesson*s.lessonHoursPerActiveDay*s.daysPerMonth;
 // A full shared board is sent to every OTHER participant, either via WAL
 // or via a key-only change event followed by a REST GET. Additional REST
 // fallbacks are modelled separately: do not count all two paths as obligatory.
 const boardRealtimeMB=lessonHours*s.savesPerLessonHour*s.boardMB*
  (s.participantsPerLesson-1)*(1+s.duplicateFetchFraction);
 const boardOpenReconnectMB=lessonHours*s.participantsPerLesson*s.boardMB*
  (1+s.reconnectFraction);
 const mediaMB=lessonHours*s.participantsPerLesson*s.mediaMBPerUserHour;
 const otherApiMB=lessonHours*s.participantsPerLesson*s.otherApiMBPerUserHour;
 const boardGB=(boardRealtimeMB+boardOpenReconnectMB)/1000;
 const mediaGB=mediaMB/1000,otherApiGB=otherApiMB/1000;
 return {usersPerSchoolDay,lessonHours,boardGB,mediaGB,otherApiGB,
  totalGB:boardGB+mediaGB+otherApiGB,
  insideReleaseBudget:boardGB+mediaGB+otherApiGB<=s.releaseBudgetGB};
}
for(const users of [6,60,300,600]){
 const row=projectMonthlyEgress(users);
 assert.ok(row.totalGB>0);
 console.log(`${users} daily active; ${row.lessonHours.toFixed(0)} lesson-h/month; board=${row.boardGB.toFixed(2)} GB, media=${row.mediaGB.toFixed(2)} GB, API=${row.otherApiGB.toFixed(2)} GB, total=${row.totalGB.toFixed(2)} GB, 175-GB gate=${row.insideReleaseBudget?"within scenario":"exceeded"}`);
}
const stress=projectMonthlyEgress(60,{...assumptions,
 boardMB:1.16,savesPerLessonHour:300,duplicateFetchFraction:0.5,
 reconnectFraction:0.5,mediaMBPerUserHour:12,otherApiMBPerUserHour:1});
assert.ok(stress.totalGB>assumptions.monthlyLimitGB,
 "High-stress 60-user scenario must not be misrepresented as safe");
console.log(`High-load 60 daily active: ${stress.totalGB.toFixed(2)} GB/month, exceeds 250 GB`);
