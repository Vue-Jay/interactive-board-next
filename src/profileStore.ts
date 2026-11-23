import { isRemoteBackendEnabled,remoteRequest } from "./backend";
import { isSelfhostBackendEnabled,selfhostRequest } from "./selfhostApi";
export type ProfileSettings={displayName:string;theme:"system"|"light"|"dark";compactUi:boolean;defaultBoardZoom:number};
const KEY="onlinerepetitor.profile-settings.v51";
type StoredProfileSettings={
  display_name:string;theme:ProfileSettings["theme"];compact_ui:boolean;default_board_zoom:number;
};
export async function getProfileSettings(user:{id:string;name:string}):Promise<ProfileSettings>{
  const selfhost=isSelfhostBackendEnabled();
  const defaults:ProfileSettings={displayName:user.name,theme:"system",compactUi:false,defaultBoardZoom:100};
  if(!selfhost&&!isRemoteBackendEnabled()){
    try{return {...defaults,...JSON.parse(localStorage.getItem(KEY)||"{}")}}
    catch{return defaults}
  }
  const row=selfhost
    ? await selfhostRequest<StoredProfileSettings>("/api/v1/account/profile")
    : (await remoteRequest<StoredProfileSettings[]>("/rest/v1/rpc/get_my_profile_settings",{method:"POST",body:"{}"}))[0];
  return {displayName:row?.display_name||user.name,theme:row?.theme||"system",
    compactUi:!!row?.compact_ui,defaultBoardZoom:Number(row?.default_board_zoom||100)};
}
export async function saveProfileSettings(s:ProfileSettings){
  if(isSelfhostBackendEnabled()){
    await selfhostRequest("/api/v1/account/profile/settings",{
      method:"PUT",body:JSON.stringify({display_name:s.displayName,theme:s.theme,
        compact_ui:s.compactUi,default_board_zoom:s.defaultBoardZoom}),
    });
    localStorage.setItem(KEY,JSON.stringify(s));
    return;
  }
  localStorage.setItem(KEY,JSON.stringify(s));
  if(!isRemoteBackendEnabled())return;
  await remoteRequest("/rest/v1/rpc/save_my_profile_settings",{method:"POST",body:JSON.stringify({
    p_display_name:s.displayName,p_theme:s.theme,p_compact_ui:s.compactUi,p_default_board_zoom:s.defaultBoardZoom,
  })});
}
function paintProfileAppearance(_preference:ProfileSettings["theme"]){
  document.documentElement.dataset.theme="light";
  document.documentElement.dataset.themePreference="light";
  // Older clients may still send compact_ui; current layouts are responsive.
  document.documentElement.classList.remove("compact-ui");
}
export function initProfileAppearance(){
  let preference:ProfileSettings["theme"]="system";
  try{
    const saved=JSON.parse(localStorage.getItem(KEY)||"{}") as Partial<ProfileSettings>;
    if(saved.theme==="dark"||saved.theme==="light"||saved.theme==="system")preference=saved.theme;
  }catch{/* Private mode, blocked storage or invalid older settings. */}
  paintProfileAppearance(preference);

}
export function applyProfileAppearance(s:ProfileSettings){
  paintProfileAppearance(s.theme);
  try{localStorage.setItem(KEY,JSON.stringify(s))}catch{/* Visual choice still applies without storage. */}
}
