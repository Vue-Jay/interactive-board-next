import {useEffect,useState} from "react";
import type {AuthUser} from "./authStore";
import {applyProfileAppearance,getProfileSettings,saveProfileSettings,type ProfileSettings} from "./profileStore";
import {emptyProfileDetails,getProfileDetails,saveProfileDetails,type ProfileDetails,validateProfileDetails} from "./profileDetailsStore";
import type {AccountRole} from "./accountRoleStore";

type Props={user:AuthUser;accountRole:AccountRole;isAppAdmin:boolean;previewMode?:boolean;onBack:()=>void;onLogout:()=>void};
const personalFields:["firstName"|"lastName"|"middleName",string,string][]=[
 ["firstName","Имя","Например, Анна"],["lastName","Фамилия","Ваша фамилия"],["middleName","Отчество","Необязательно"],
];
const teacherFields:["phone"|"city"|"organization"|"focusArea",string,string][]=[
 ["phone","Телефон","+7 900 000-00-00"],["city","Город","Где вы находитесь"],
 ["organization","Место работы","Школа, вуз или учебный центр"],["focusArea","Преподаваемые предметы","Например, физика и математика"],
];

export default function ProfileScreen({user,accountRole,isAppAdmin,previewMode=false,onBack,onLogout}:Props){
 const [profile,setProfile]=useState<ProfileSettings>({displayName:user.name,theme:"system",compactUi:false,defaultBoardZoom:100});
 const [details,setDetails]=useState<ProfileDetails>(emptyProfileDetails);
 const [loaded,setLoaded]=useState(false),[busy,setBusy]=useState(false),[saved,setSaved]=useState(""),[error,setError]=useState("");
 const isTeacher=accountRole==="teacher";
 useEffect(()=>{
  let alive=true;
  void Promise.all([getProfileSettings(user),getProfileDetails(user.id)]).then(([settings,personal])=>{
   if(!alive)return;setProfile(settings);setDetails(personal);setLoaded(true);
  }).catch(()=>{if(alive){setLoaded(true);setError("Не удалось загрузить профиль. Попробуйте обновить страницу.")}});
  return()=>{alive=false};
 },[user.id]);
 const setField=(key:keyof ProfileDetails,value:string)=>setDetails(current=>({...current,[key]:value}));
 const save=async()=>{
  if(busy)return;
  if(isTeacher){const validation=validateProfileDetails(details);if(validation){setError(validation);return}}
  const name=profile.displayName.trim();
  if(name.length<2){setError("Имя для отображения должно содержать минимум 2 символа.");return}
  setBusy(true);setError("");setSaved("");
  try{
   const next={...profile,displayName:name};
   if(previewMode){setProfile(next);setSaved("Предпросмотр роли: изменения профиля не сохраняются");return}
   await Promise.all([saveProfileSettings(next),saveProfileDetails(user.id,details)]);
   applyProfileAppearance(next);setProfile(next);setSaved("Профиль сохранён");window.setTimeout(()=>setSaved(""),2500);
  }catch(value){setError(value instanceof Error?value.message:"Не удалось сохранить профиль")}
  finally{setBusy(false)}
 };
 const setDate=new Date(user.createdAt);
 const joined=Number.isNaN(setDate.getTime())?"":setDate.toLocaleDateString("ru-RU",{month:"long",year:"numeric"});
 return <main className="profile-shell profile-only-shell profile-redesign">
  <header className="students-header"><div><button className="boards-secondary" onClick={onBack}>← Доски</button><div><strong>Профиль</strong><span>Личные данные и информация аккаунта</span></div></div></header>
  <div className="profile-redesign-wrap">
   <section className="profile-identity-card profile-identity-wide">
    <div className="profile-big-avatar">{(details.firstName||profile.displayName||user.name).trim().charAt(0).toUpperCase()||"?"}</div>
    <div className="profile-identity-copy"><p className="profile-eyebrow">МОЙ ПРОФИЛЬ</p><h1>{profile.displayName||user.name}</h1><p>{user.email}</p><div className="profile-role-pills"><span>{isTeacher?"Преподаватель":"Ученик"}</span>{isAppAdmin&&<span>Администратор</span>}</div></div>
    {joined&&<div className="profile-member-since"><span>В Lektrus с</span><strong>{joined}</strong></div>}
   </section>
   {error&&<div className="profile-redesign-alert" role="alert">{error}</div>}
   {saved&&<div className="profile-redesign-success" role="status">✓ {saved}</div>}
   <section className="profile-redesign-card">
    <div className="profile-section-heading"><div><span>01</span><div><h2>Личные данные</h2><p>Как вас будут видеть на досках и занятиях.</p></div></div></div>
    <div className="profile-redesign-grid">
     <label className="profile-redesign-field profile-field-full"><span>Отображаемое имя</span><input value={profile.displayName} maxLength={80} onChange={e=>setProfile(current=>({...current,displayName:e.target.value}))} placeholder="Как к вам обращаться" autoComplete="nickname"/></label>
     {personalFields.map(([key,label,placeholder])=><label key={key} className="profile-redesign-field"><span>{label}</span><input value={details[key]} onChange={e=>setField(key,e.target.value)} placeholder={placeholder} autoComplete={key==="firstName"?"given-name":key==="lastName"?"family-name":"additional-name"} maxLength={80}/></label>)}
     <label className="profile-redesign-field"><span>Email</span><input value={user.email} readOnly aria-readonly="true"/><small>Используется для входа в аккаунт.</small></label>
    </div>
    <div className="profile-redesign-actions"><span>Изменения сохраняются в вашем аккаунте.</span><button className="boards-create" type="button" disabled={!loaded||busy} onClick={()=>void save()}>{busy?"Сохраняем…":"Сохранить изменения"}</button></div>
   </section>
   {isTeacher&&<section className="profile-redesign-card">
    <div className="profile-section-heading"><div><span>02</span><div><h2>Преподавание</h2><p>Профессиональные данные, которые вы указали в заявке. Их можно обновить здесь.</p></div></div><span className="profile-section-badge">ПРОФИЛЬ ПРЕПОДАВАТЕЛЯ</span></div>
    <div className="profile-redesign-grid">
     {teacherFields.map(([key,label,placeholder])=><label key={key} className="profile-redesign-field"><span>{label}</span><input value={details[key]} onChange={e=>setField(key,e.target.value)} placeholder={placeholder} autoComplete={key==="phone"?"tel":key==="city"?"address-level2":"organization"} maxLength={key==="organization"?160:120}/></label>)}
    </div>
    <div className="profile-redesign-actions"><span>Обновите сведения о себе и предметах преподавания.</span><button className="boards-create" type="button" disabled={!loaded||busy} onClick={()=>void save()}>{busy?"Сохраняем…":"Сохранить изменения"}</button></div>
   </section>}
   <section className="profile-redesign-card profile-redesign-account"><div className="profile-account-identity"><span className="profile-account-icon" aria-hidden="true">{user.email.charAt(0).toUpperCase()||"@"}</span><div><h2>Учётная запись</h2><p>Вы вошли как <strong>{user.email}</strong></p></div></div><button type="button" className="profile-logout-button" onClick={onLogout}><span aria-hidden="true">↪</span> {previewMode?"Завершить проверку роли":"Выйти из аккаунта"}</button></section>
  </div>
 </main>
}
