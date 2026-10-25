import type {BoardRole} from "./authStore";
import type {AccountRole} from "./accountRoleStore";

// UI-only role simulation for admin QA, never used to change the account,
// membership, authentication credentials or Supabase authorization.
export type BoardRolePreview="actual"|"teacher"|"student"|"guest";
export type BoardRoleCapabilities={
 canEdit:boolean; isStudent:boolean; isGuestPreview:boolean;
 canManageBoard:boolean; canCreateAssignments:boolean;
 canAnswerContour:boolean; canAddStudentMedia:boolean;
};
export function boardRoleCapabilities(input:{
 preview:BoardRolePreview;
 boardRole:BoardRole;accountRole:AccountRole;
 isAppAdmin:boolean;adminMaintenance:boolean;
}):BoardRoleCapabilities{
 const {preview,boardRole,accountRole,isAppAdmin,adminMaintenance}=input;
 const safePreview=isAppAdmin?preview:"actual";
 const realCanEdit=boardRole!=="viewer"||(isAppAdmin&&adminMaintenance);
 const realStudent=accountRole==="student"&&!adminMaintenance;
 const isStudent=realStudent||safePreview==="student";
 const isGuestPreview=safePreview==="guest";
 const canEdit=realCanEdit&&!isGuestPreview;
 const canManageBoard=canEdit&&!isStudent&&boardRole==="owner";
 return {
  canEdit,isStudent,isGuestPreview,canManageBoard,
  canCreateAssignments:canEdit&&!isStudent,
  canAnswerContour:canEdit&&!isGuestPreview,
  canAddStudentMedia:canEdit&&isStudent,
 };
}
export const BOARD_ROLE_PREVIEW_LABELS:Record<BoardRolePreview,string>={
 actual:"Настоящая роль",teacher:"Преподаватель",student:"Ученик",guest:"Гость (просмотр)"
};
