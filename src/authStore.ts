import { LEKTRUS_LOCAL_TEST_MODE, LEKTRUS_LOCAL_TEST_USER } from "./lektrusLocalTestMode";
import { setLocalAccountRole, type AccountRole } from "./accountRoleStore";
import { claimRemoteInvitations, completeEmailConfirmationRemote, getCachedRemoteSession, getRemoteSession, isRemoteBackendEnabled, signInRemote, signInAnonymousRemote, signOutRemote, signUpRemote, resendSignupOtpRemote, getRememberedRemoteAccount, resumeRememberedRemoteAccount, leaveRemoteAccountRemembered, clearRememberedRemoteAccount } from "./backend";
import { clearSelfhostSession, getCachedSelfhostSession, getSelfhostSession, isSelfhostBackendEnabled, selfhostClaimInvitations, selfhostLogin, selfhostGuestLogin, selfhostLogout, selfhostSignup, selfhostVerifyEmail, selfhostRequestPasswordReset, selfhostCompletePasswordReset, type SelfhostSession } from "./selfhostApi";

export type BoardRole = "owner" | "editor" | "viewer";
/** Independent, owner-assigned educational context. Never inferred from an upgraded account. */
export type BoardParticipantRole = "owner" | "co_teacher" | "student" | "observer";
export type InvitedParticipantRole = Exclude<BoardParticipantRole,"owner">;
export const PARTICIPANT_ROLE_LABELS: Record<BoardParticipantRole,string> = {
 owner:"Владелец",co_teacher:"Сопреподаватель",student:"Ученик",observer:"Наблюдатель"
};
export const participantAccess=(role:InvitedParticipantRole):Exclude<BoardRole,"owner">=>role==="observer"?"viewer":"editor";
export const participantRoleFor=(role:BoardRole,participant?:BoardParticipantRole|null):BoardParticipantRole=>
 role==="owner"?"owner":role==="viewer"?"observer":participant==="co_teacher"?"co_teacher":"student";

export const BOARD_ROLE_LABELS: Record<BoardRole, string> = { owner:"Владелец", editor:"Редактор", viewer:"Просмотр" };
export type AuthUser = { id:string; name:string; email:string; createdAt:string; isGuest?:boolean; guestBoardId?:string; accountRole?:"teacher"|"student"; teacherStatus?:"none"|"pending"|"approved"|"rejected"; isAdmin?:boolean };
type StoredUser = AuthUser & { passwordHash:string; passwordSalt:string };
type Session = { userId:string; createdAt:string };
const USERS_KEY="lesson-board.auth.users.v1"; const SESSION_KEY="lesson-board.auth.session.v1";
const normalizeEmail=(v:string)=>v.trim().toLowerCase();
const bytesToHex=(b:Uint8Array)=>Array.from(b,x=>x.toString(16).padStart(2,"0")).join("");
const randomSalt=()=>{const b=new Uint8Array(16);crypto.getRandomValues(b);return bytesToHex(b)};
const hashPassword=async(p:string,s:string)=>bytesToHex(new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(`${s}:${p}`))));
const loadUsers=():StoredUser[]=>{try{const v=JSON.parse(localStorage.getItem(USERS_KEY)||"[]");return Array.isArray(v)?v:[]}catch{return []}};
const saveUsers=(v:StoredUser[])=>localStorage.setItem(USERS_KEY,JSON.stringify(v));
const saveSession=(id:string)=>localStorage.setItem(SESSION_KEY,JSON.stringify({userId:id,createdAt:new Date().toISOString()} satisfies Session));
const publicUser=({passwordHash:_h,passwordSalt:_s,...u}:StoredUser):AuthUser=>u;
const remoteUser=(s:Awaited<ReturnType<typeof getRemoteSession>>):AuthUser|null=>{
 if(!s)return null; const meta=s.user.user_metadata||{}; const name=String(meta.display_name||meta.full_name||s.user.email?.split("@")[0]||"Пользователь");
 return {id:s.user.id,name,email:s.user.email||"",createdAt:s.user.created_at||new Date().toISOString(),isGuest:Boolean(meta.is_guest)||!s.user.email};
};
const selfhostUser=(s:Awaited<ReturnType<typeof getSelfhostSession>>|SelfhostSession|null):AuthUser|null=>{
 if(!s)return null;
 const meta=s.user.user_metadata||{};
 const name=String(meta.display_name||[meta.first_name,meta.last_name].filter(Boolean).join(" ")||s.user.email?.split("@")[0]||"Пользователь");
 return {id:s.user.id,name,email:s.user.email||"",createdAt:new Date().toISOString(),
  isGuest:Boolean(s.user.guest_board_id),guestBoardId:s.user.guest_board_id??undefined,
  accountRole:s.user.account_role,teacherStatus:s.user.teacher_status,isAdmin:s.user.is_admin};
};
let pendingSelfhostRegistration:{email:string;password:string;name:string;first_name:string;last_name:string;role:"teacher"|"student"}|null=null;
let pendingInvitationUser:string|null=null;
// The session is valid as soon as login succeeds. Claiming email invitations
// is a separate, idempotent operation, not a condition of authentication.
export async function retrySelfhostInvitations(userId:string):Promise<void>{
 if(pendingInvitationUser!==userId||getCachedSelfhostSession()?.user.id!==userId)return;
 try{await selfhostClaimInvitations(5000);if(pendingInvitationUser===userId)pendingInvitationUser=null;}
 catch{/* Keep it pending for the next workspace load. */}
}
async function claimSelfhostAfterAuth(session:SelfhostSession):Promise<void>{
 pendingInvitationUser=session.user.id;
 await retrySelfhostInvitations(session.user.id);
}

export const getCachedCurrentUser=():AuthUser|null=>{
 if(LEKTRUS_LOCAL_TEST_MODE)return {...LEKTRUS_LOCAL_TEST_USER};
 if(isSelfhostBackendEnabled())return selfhostUser(getCachedSelfhostSession());
 if(isRemoteBackendEnabled())return remoteUser(getCachedRemoteSession());
 try{const raw=localStorage.getItem(SESSION_KEY);if(!raw)return null;const id=JSON.parse(raw)?.userId;const u=loadUsers().find(x=>x.id===id);return u?publicUser(u):null}catch{return null}
};

export const getCurrentUser=async():Promise<AuthUser|null>=>{
 // Refresh an expired self-hosted session before trusting its cached identity.
 if(isSelfhostBackendEnabled())return selfhostUser(await getSelfhostSession());
 const cached=getCachedCurrentUser();
 if(cached)return cached;
 if(isRemoteBackendEnabled())return remoteUser(await getRemoteSession());
 return null;
};

export const registerUser=async(input:{name:string;email:string;password:string;firstName?:string;lastName?:string;role:AccountRole}):Promise<AuthUser|null>=>{
 const name=input.name.trim(),email=normalizeEmail(input.email),password=input.password;
 if(name.length<2)throw new Error("Введите имя не короче 2 символов");
 if(!/^\S+@\S+\.\S+$/.test(email))throw new Error("Введите корректный email");
 if(password.length<6)throw new Error("Пароль должен содержать минимум 6 символов");
 if(input.role!=="teacher"&&input.role!=="student")throw new Error("Выберите роль: учитель или ученик");
 if(isSelfhostBackendEnabled()){
  pendingSelfhostRegistration={email,password,name,first_name:input.firstName||"",last_name:input.lastName||"",role:input.role};
  await selfhostSignup(pendingSelfhostRegistration);
  return null;
 }
 if(isRemoteBackendEnabled()){const s=await signUpRemote(email,password,name,{firstName:input.firstName,lastName:input.lastName,role:input.role});if(!s)return null;await claimRemoteInvitations();return remoteUser(s)!}
 const users=loadUsers();
 if(users.some(u=>u.email===email))throw new Error("Пользователь с таким email уже зарегистрирован");
 const salt=randomSalt();
 const user:StoredUser={id:crypto.randomUUID(),name,email,createdAt:new Date().toISOString(),passwordHash:await hashPassword(password,salt),passwordSalt:salt};
 saveUsers([...users,user]);saveSession(user.id);setLocalAccountRole(user.id,input.role);return publicUser(user)
};

export const completeEmailConfirmation=async(callbackUrl:string):Promise<AuthUser|null>=>{
 if(isSelfhostBackendEnabled()){
  const callback=new URL(callbackUrl);
  const token=callback.searchParams.get("token");
  if(!token)return null;
  const session=await selfhostVerifyEmail(token);
  pendingSelfhostRegistration=null;
  await claimSelfhostAfterAuth(session);
  return selfhostUser(session)!;
 }
 if(!isRemoteBackendEnabled())return null;
 const session=await completeEmailConfirmationRemote(callbackUrl);
 if(!session)return null;
 await claimRemoteInvitations();
 return remoteUser(session)!;
};

export const resendRegistrationCode=async(email:string):Promise<void>=>{
 if(isSelfhostBackendEnabled()){
  const pending=pendingSelfhostRegistration;
  if(!pending||pending.email!==normalizeEmail(email))
   throw new Error("Чтобы повторно отправить письмо, заполните регистрацию ещё раз.");
  await selfhostSignup(pending);
  return;
 }
 if(!isRemoteBackendEnabled())throw new Error("Подтверждение почты доступно после подключения сервера.");
 await resendSignupOtpRemote(email);
};

export const requestPasswordReset=async(email:string):Promise<void>=>{
 if(!isSelfhostBackendEnabled())throw new Error("Восстановление пароля доступно после подключения нового сервера.");
 await selfhostRequestPasswordReset(normalizeEmail(email));
};
export const completePasswordReset=async(token:string,password:string):Promise<void>=>{
 if(!isSelfhostBackendEnabled())throw new Error("Восстановление пароля доступно после подключения нового сервера.");
 if(password.length<6)throw new Error("Пароль должен содержать минимум 6 символов");
 if(new TextEncoder().encode(password).length>72)throw new Error("Пароль слишком длинный");
 await selfhostCompletePasswordReset(token,password);
 clearSelfhostSession();
};

export const loginUser=async(input:{email:string;password:string}):Promise<AuthUser>=>{
 const email=normalizeEmail(input.email);
 if(isSelfhostBackendEnabled()){const s=await selfhostLogin(email,input.password);await claimSelfhostAfterAuth(s);return selfhostUser(s)!}
 if(isRemoteBackendEnabled()){const s=await signInRemote(email,input.password);await claimRemoteInvitations();return remoteUser(s)!}
 const u=loadUsers().find(x=>x.email===email);
 if(!u||await hashPassword(input.password,u.passwordSalt)!==u.passwordHash)throw new Error("Неверный email или пароль");
 saveSession(u.id);return publicUser(u)
};

export const loginGuest=async(name:string,token?:string,password?:string):Promise<AuthUser>=>{
 const guestName=name.trim();
 if(guestName.length<2)throw new Error("Введите имя гостя не короче 2 символов");
 if(guestName.length>60)throw new Error("Имя гостя слишком длинное");
 if(isSelfhostBackendEnabled()){
  if(!token)throw new Error("Для гостевого входа нужна ссылка приглашения.");
  return selfhostUser(await selfhostGuestLogin(guestName,token,password))!;
 }
 if(!isRemoteBackendEnabled())throw new Error("Гостевой вход доступен только при серверной синхронизации.");
 const s=await signInAnonymousRemote(guestName);
 return remoteUser(s)!;
};

export const getRememberedAccount=()=>!isSelfhostBackendEnabled()&&isRemoteBackendEnabled()?getRememberedRemoteAccount():null;

export const resumeRememberedAccount=async():Promise<AuthUser>=>{
 if(isSelfhostBackendEnabled())throw new Error("Для быстрого входа на новом сервере сохранённая сессия уже восстанавливается автоматически.");
 if(!isRemoteBackendEnabled())throw new Error("Быстрый вход доступен только в серверной версии.");
 const s=await resumeRememberedRemoteAccount();
 await claimRemoteInvitations();
 return remoteUser(s)!;
};

export const forgetRememberedAccount=async()=>{
 if(isSelfhostBackendEnabled()){await selfhostLogout();return}
 if(!isRemoteBackendEnabled())return;
 clearRememberedRemoteAccount();
 await signOutRemote();
};

export const logoutUser=async()=>{
 if(LEKTRUS_LOCAL_TEST_MODE)return;
 if(isSelfhostBackendEnabled()){await selfhostLogout();return}
 if(isRemoteBackendEnabled()){
   const current=getCachedRemoteSession();
   if(current?.user?.email)leaveRemoteAccountRemembered();
   else await signOutRemote();
 }else{
   localStorage.removeItem(SESSION_KEY);
 }
};

export const getUserById=(id:string):AuthUser|null=>{const u=loadUsers().find(x=>x.id===id);return u?publicUser(u):null};
export const getUserByEmail=(email:string):AuthUser|null=>{const e=normalizeEmail(email);const u=loadUsers().find(x=>x.email===e);return u?publicUser(u):null};
export { isRemoteBackendEnabled } from "./backend";
