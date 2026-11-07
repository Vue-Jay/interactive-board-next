import type {BoardRole} from "./authStore";
import type {AccountRole} from "./accountRoleStore";
import type {SchoolDiagram} from "./lektrusSchoolDiagramModel";

// Developer-only board-role simulation. The selected role controls only
// visible actions and locally enforced editing rules. Membership, identity,
// credentials, and server authorization are always unchanged.
export type BoardRolePreview="actual"|"teacher"|"student"|"guest";
export type BoardRoleCapabilities={
 canEdit:boolean;isStudent:boolean;isGuestPreview:boolean;
 canManageBoard:boolean;canCreateAssignments:boolean;
 canAnswerContour:boolean;canAddStudentMedia:boolean;
 canUseStudentTools:boolean;canUseTeacherTools:boolean;
 effectiveRole:"teacher"|"student";
};
/** Students and anonymous guests share one and the same board policy.
 * A viewer invitation remains read-only, regardless of preview selection.
 */
export function boardRoleCapabilities(input:{
 preview:BoardRolePreview;
 boardRole:BoardRole;accountRole:AccountRole;
 isAppAdmin:boolean;adminMaintenance:boolean;
 isGuest?:boolean;
}):BoardRoleCapabilities{
 const {preview,boardRole,accountRole,isAppAdmin,adminMaintenance,isGuest=false}=input;
 const safePreview=isAppAdmin?preview:"actual";
 const realCanEdit=boardRole!=="viewer"||(isAppAdmin&&adminMaintenance);
 const effectiveRole:"teacher"|"student"=safePreview==="teacher"?"teacher":
   safePreview==="student"||safePreview==="guest"?"student":
   // The server-authorized board owner always has teacher-level tools,
   // regardless of whether their account was originally created as a pupil
   // or an anonymous guest. Developer previews remain simulations only.
   boardRole==="owner"?"teacher":
   (isGuest||(accountRole==="student"&&!adminMaintenance))?"student":"teacher";
 const isStudent=effectiveRole==="student";
 const isGuestPreview=safePreview==="guest";
 const canEdit=realCanEdit;
 const canUseTeacherTools=canEdit&&!isStudent;
 const canUseStudentTools=canEdit&&isStudent;
 const canManageBoard=canUseTeacherTools&&boardRole==="owner";
 return {
  canEdit,isStudent,isGuestPreview,effectiveRole,canManageBoard,
  canCreateAssignments:canUseTeacherTools,
  canAnswerContour:canEdit,
  canAddStudentMedia:canUseStudentTools,
  canUseStudentTools,canUseTeacherTools,
 };
}
export const BOARD_ROLE_PREVIEW_LABELS:Record<BoardRolePreview,string>={
 actual:"Настоящая роль",teacher:"Преподаватель",student:"Ученик",guest:"Гость"
};

/** Central policy for board creation tools: identical for registered students
 * and guests, including the same assignment-construction restrictions.
 */
export const STUDENT_BLOCKED_CREATE_TOOLS=Object.freeze([
 "frame","table","formula","graph","checklist","quiz","flashcard","cover","linkmedia"
] as const);
export const STUDENT_PROTECTED_OBJECT_KINDS=Object.freeze([
 "frame","checklist","quiz","flashcard","cover","linkmedia"
] as const);
export function canUseBoardCreationTool(
 toolId:string,capabilities:BoardRoleCapabilities
):boolean{
 // Navigation never edits document state and remains available to viewers.
 if(toolId==="select"||toolId==="hand"||toolId==="lasso")return true;
 return capabilities.canEdit&&(!capabilities.isStudent||
   !(STUDENT_BLOCKED_CREATE_TOOLS as readonly string[]).includes(toolId));
}
/** Object placement is not assignment authoring. Editable students and
 * guests can drag/resize all unlocked lesson objects, including teacher-built
 * questions, while creation and answer-key edits remain restricted. */
export function canTransformStudentBoardObject(kind:string,capabilities:BoardRoleCapabilities):boolean{
 void kind;
 return capabilities.canEdit;
}
export function isStudentProtectedBoardObject(
 kind:string,capabilities:BoardRoleCapabilities
):boolean{
 return capabilities.isStudent&&
   (STUDENT_PROTECTED_OBJECT_KINDS as readonly string[]).includes(kind);
}

/** Keep teacher-designed contour assignments immutable when students draw.
 * This also covers edits initiated directly on the board, not just the editor.
 */
export function restrictStudentDiagramChange(
 current:SchoolDiagram|undefined,next:SchoolDiagram
):SchoolDiagram|null{
 if(!current||current.kind!==next.kind)return null;
 if(current.kind==="atlas"&&next.kind==="atlas"){
  if(current.title!=="Контурная карта")return null;
  return {...current,
   contourMarks:next.contourMarks,
   contourStrokes:next.contourStrokes,
   contourLegend:next.contourLegend,
   paintedCountries:next.paintedCountries,
   contourCamera:next.contourCamera
  };
 }
 // Syntax is a real on-board student answer: only annotate existing
 // teacher-defined words. The sentence, word IDs and assignment title stay
 // unchanged even when a client sends a forged complete diagram.
 if(current.kind==="syntax"&&next.kind==="syntax"){
  if(current.words.length!==next.words.length||
     current.words.some((word,i)=>word.id!==next.words[i]?.id||
       word.text!==next.words[i]?.text))return null;
  const allowedRoles=new Set(["subject","predicate","attribute","object","adverbial","none"]);
  if(next.words.some(word=>!allowedRoles.has(word.role)))return null;
  return {...current,words:current.words.map((word,i)=>({
   ...word,role:next.words[i].role
  }))};
 }
 // The input in a place-value exercise is an answer; the teacher's number
 // base and presentation settings must not be editable by a student.
 if(current.kind==="place-value"&&next.kind==="place-value"){
  const pattern=current.base===2?/^[01]{0,10}$/:
   current.base===8?/^[0-7]{0,10}$/:
   current.base===10?/^[0-9]{0,10}$/:/^[0-9A-F]{0,10}$/;
  if(typeof next.digits!=="string"||!pattern.test(next.digits))return null;
  return {...current,digits:next.digits};
 }
 // Morphology/phonetics currently store the teacher's source word and
 // annotations, not separate student answer fields. Treat them as read-only
 // until independent pupil-response storage exists. Orthography answers and
 // foreign-language sentence ordering already use local per-user state.
 return null;
}
