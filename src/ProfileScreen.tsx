import {useEffect,useState} from "react";
import type {AuthUser} from "./authStore";
import {applyProfileAppearance,getProfileSettings,saveProfileSettings,type ProfileSettings} from "./profileStore";
import {emptyProfileDetails,getProfileDetails,saveProfileDetails,type ProfileDetails,validateProfileDetails} from "./profileDetailsStore";
import type {AccountRole} from "./accountRoleStore";

type Props={user:AuthUser;accountRole:AccountRole;isAppAdmin:boolean;onBack:()=>void;onLogout:()=>void};
const fields:[keyof ProfileDetails,string,string][]=[
 ["firstName","Имя","Например, Анна"],["lastName","Фамилия","Ваша фамилия"],
 ["middleName","Отчество","Необязательно"],["phone","Телефон","+7 900 000-00-00"],
 ["city","Город","Где вы находитесь"],["organization","Организация","Школа, вуз или центр"],
 ["focusArea","Предмет или класс","Например, физика или 8 класс"],
];

export default function ProfileScreen({user,accountRole,isAppAdmin,onBack,onLogout}:Props){
 const [profile,setProfile]=useState<ProfileSettings>({displayName:user.name,theme:"system",compactUi:false,defaultBoardZoom:100});
 const [details,setDetails]=useState<ProfileDetails>(emptyProfileDetails);
 const [loaded,setLoaded]=useState(false),[busy,setBusy]=useState(false),[saved,setSaved]=useState(""),[error,setError]=useState("");
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
  const validation=validateProfileDetails(details);
  if(validation){setError(validation);return}
  const name=profile.displayName.trim();
  if(name.length<2){setError("Отображаемое имя должно содержать минимум 2 символа.");return}
  setBusy(true);setError("");setSaved("");
  try{
   const next={...profile,displayName:name};
   await Promise.all([saveProfileSettings(next),saveProfileDetails(user.id,details)]);
   applyProfileAppearance(next);setProfile(next);setSaved("Изменения сохранены");window.setTimeout(()=>setSaved(""),2500);
  }catch(value){setError(value instanceof Error?value.message:"Не удалось сохранить профиль")}
  finally{setBusy(false)}
 };
 return <main className="profile-shell profile-only-shell profile-redesign">
  <header className="students-header"><div><button className="boards-secondary" onClick={onBack}>← Доски</button><div><strong>Профиль</strong><span>Расскажите о себе и настройте свой аккаунт</span></div></div></header>
  <div className="profile-redesign-wrap">
   <section className="profile-identity-card profile-identity-wide">
    <div className="profile-big-avatar">{(details.firstName||profile.displayName||user.name).trim().charAt(0).toUpperCase()||"?"}</div>
    <div className="profile-identity-copy"><p className="profile-eyebrow">ВАШ АККАУНТ</p><h1>{profile.displayName||user.name}</h1><p>{user.email}</p><div className="profile-role-pills"><span>{accountRole==="teacher"?"Преподаватель":"Ученик"}</span>{isAppAdmin&&<span>Администратор</span>}</div></div>
    <div className="profile-completion"><strong>{Object.values(details).filter(value=>value.trim()).length+Number(Boolean(profile.displayName.trim()))} из 9</strong><span>полей заполнено</span></div>
   </section>
   {error&&<div className="profile-redesign-alert" role="alert">{error}</div>}
   {saved&&<div className="profile-redesign-success" role="status">✓ {saved}</div>}
   <section className="profile-redesign-card">
    <div className="profile-section-heading"><div><span>01</span><div><h2>Основная информация</h2><p>Имя будет видно участникам ваших досок и занятий.</p></div></div></div>
    <div className="profile-redesign-grid">
     <label className="profile-redesign-field profile-field-full"><span>Отображаемое имя <i>*</i></span><input value={profile.displayName} maxLength={80} onChange={e=>setProfile(current=>({...current,displayName:e.target.value}))} placeholder="Как к вам обращаться" autoComplete="nickname"/></label>
     {fields.slice(0,3).map(([key,label,placeholder])=><label key={key} className="profile-redesign-field"><span>{label}{key==="firstName"&&<i> *</i>}</span><input value={details[key]} onChange={e=>setField(key,e.target.value)} placeholder={placeholder} autoComplete={key==="firstName"?"given-name":key==="lastName"?"family-name":"additional-name"} maxLength={80}/></label>)}
     <label className="profile-redesign-field"><span>Email</span><input value={user.email} readOnly aria-readonly="true"/><small>Email связан со входом в аккаунт.</small></label>
    </div>
   </section>
   <section className="profile-redesign-card">
    <div className="profile-section-heading"><div><span>02</span><div><h2>О вас и вашей работе</h2><p>Эти данные помогут лучше настроить образовательное пространство.</p></div></div></div>
    <div className="profile-redesign-grid">
     {fields.slice(3).map(([key,label,placeholder])=><label key={key} className="profile-redesign-field"><span>{label}</span><input value={details[key]} onChange={e=>setField(key,e.target.value)} placeholder={placeholder} autoComplete={key==="phone"?"tel":key==="city"?"address-level2":"organization"} maxLength={key==="organization"?160:120}/></label>)}
     <label className="profile-redesign-field profile-field-full"><span>Коротко о себе</span><textarea value={details.bio} onChange={e=>setField("bio",e.target.value)} placeholder={accountRole==="teacher"?"Опыт, подход к занятиям, интересы…":"Ваши учебные цели и интересы…"} maxLength={500} rows={4}/><small>{details.bio.length}/500</small></label>
    </div>
    <div className="profile-redesign-actions"><span>Поля со звёздочкой обязательны для отображения.</span><button className="boards-create" type="button" disabled={!loaded||busy} onClick={()=>void save()}>{busy?"Сохраняем…":"Сохранить профиль"}</button></div>
   </section>
   <section className="profile-redesign-card profile-redesign-account"><div><span className="profile-account-icon">↗</span><div><h2>Безопасность аккаунта</h2><p>Выйдите из аккаунта на этом устройстве.</p></div></div><button type="button" className="profile-logout-button" onClick={onLogout}>Выйти из аккаунта</button></section>
  </div>
 </main>
}
