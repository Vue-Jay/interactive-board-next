import { isRemoteBackendEnabled,remoteRequest } from "./backend";
export type ProfileSettings={displayName:string;theme:"system"|"light"|"dark";compactUi:boolean;defaultBoardZoom:number};
const KEY="onlinerepetitor.profile-settings.v51";
export async function getProfileSettings(user:{id:string;name:string}):Promise<ProfileSettings>{if(!isRemoteBackendEnabled()){try{return {...{displayName:user.name,theme:"system",compactUi:false,defaultBoardZoom:100},...JSON.parse(localStorage.getItem(KEY)||"{}")}}catch{return {displayName:user.name,theme:"system",compactUi:false,defaultBoardZoom:100}}}const r=await remoteRequest<any[]>("/rest/v1/rpc/get_my_profile_settings",{method:"POST",body:"{}"});const x=r[0];return {displayName:x?.display_name||user.name,theme:x?.theme||"system",compactUi:!!x?.compact_ui,defaultBoardZoom:Number(x?.default_board_zoom||100)}}
export async function saveProfileSettings(s:ProfileSettings){localStorage.setItem(KEY,JSON.stringify(s));if(!isRemoteBackendEnabled())return;await remoteRequest("/rest/v1/rpc/save_my_profile_settings",{method:"POST",body:JSON.stringify({p_display_name:s.displayName,p_theme:s.theme,p_compact_ui:s.compactUi,p_default_board_zoom:s.defaultBoardZoom})})}
function paintProfileAppearance(_preference:ProfileSettings["theme"],compactUi:boolean){
  document.documentElement.dataset.theme="light";
  document.documentElement.dataset.themePreference="light";
  document.documentElement.classList.toggle("compact-ui",compactUi);
}
export function initProfileAppearance(){
  let preference:ProfileSettings["theme"]="system";
  let compactUi=false;
  try{
    const saved=JSON.parse(localStorage.getItem(KEY)||"{}") as Partial<ProfileSettings>;
    if(saved.theme==="dark"||saved.theme==="light"||saved.theme==="system")preference=saved.theme;
    compactUi=saved.compactUi===true;
  }catch{/* Private mode, blocked storage or invalid older settings. */}
  paintProfileAppearance(preference,compactUi);

}
export function applyProfileAppearance(s:ProfileSettings){
  paintProfileAppearance(s.theme,s.compactUi);
  try{localStorage.setItem(KEY,JSON.stringify(s))}catch{/* Visual choice still applies without storage. */}
}
