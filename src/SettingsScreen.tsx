import {useEffect,useMemo,useState,type FormEvent} from "react";
import { Capacitor } from "@capacitor/core";
import { clearNativeBackendConnection, nativeBackendIsBundled } from "./backend";
import type {AuthUser} from "./authStore";
import {applyProfileAppearance,getProfileSettings,saveProfileSettings,type ProfileSettings} from "./profileStore";
import {getAccountAccess,requestTeacherAccess,setStudentRole,type AccountAccess,type TeacherApplication} from "./accountRoleStore";
import {getProfileDetails} from "./profileDetailsStore";
import {getPlan} from "./billingStore";
import {readDeveloperPreferences,writeDeveloperPreferences} from "./developerPreferences";
import { applyLectrisPalette,readLectrisPalette,type LectrisPalette } from "./lectrisPalette";
import {addPreviewTeacherRequest} from "./previewTeacherRequestsStore";

// Browsers without beforeinstallprompt (notably iOS Safari) still support
// installing via the browser menu. Do not present a disabled install button.
function manualInstallHelp():string {
 const ua=navigator.userAgent;
 const isIOS=/iPhone|iPad|iPod/i.test(ua)||(navigator.platform==="MacIntel"&&navigator.maxTouchPoints>1);
 if(isIOS)return "Откройте Lektrus в Safari, нажмите «Поделиться» и выберите «На экран Домой».";
 if(/Android/i.test(ua))return "Откройте меню браузера и выберите «Установить приложение» или «Добавить на главный экран».";
 if(/Macintosh|Mac OS X/i.test(ua))return "В Safari выберите «Файл» → «Добавить в Dock»; в Chrome используйте установку в меню браузера.";
 return "Откройте меню браузера и выберите «Установить Lektrus» или «Создать ярлык».";
}
type Props={user:AuthUser;onBack:()=>void;onLogout:()=>void;installAvailable:boolean;isInstalled:boolean;onInstall:()=>void;onBilling:()=>void;previewRole?:"student"|"teacher"|null;onPreviewRoleChange?:(role:"student"|"teacher"|"actual")=>void};

export default function SettingsScreen({user,onBack,onLogout,installAvailable,isInstalled,onInstall,onBilling,previewRole=null,onPreviewRoleChange}:Props){
 const defaults:ProfileSettings={displayName:user.name,theme:"system",compactUi:false,defaultBoardZoom:100};
 const [s,setS]=useState(defaults),[initial,setInitial]=useState(defaults),[notice,setNotice]=useState("");
 const [access,setAccess]=useState<AccountAccess>({role:"student",teacherStatus:"none",isAdmin:false,requestedAt:null,reviewedAt:null,subscriptionPlan:"free",subscriptionUntil:null}),[roleBusy,setRoleBusy]=useState(false);
 const [applicationOpen,setApplicationOpen]=useState(false),[applicationError,setApplicationError]=useState("");
 const [application,setApplication]=useState<TeacherApplication>({phone:"",city:"",organization:"",focusArea:"",experience:"",motivation:""});
 const plan=getPlan(access.subscriptionPlan);
 const shownAccess=previewRole?{...access,role:previewRole,isAdmin:false,teacherStatus:previewRole==="teacher"?"approved" as const:access.teacherStatus}:access;
 const [palette,setPalette]=useState<LectrisPalette>(readLectrisPalette);
 const changePalette=(next:LectrisPalette)=>{setPalette(next);applyLectrisPalette(next)};
 const [developerPrefs,setDeveloperPrefs]=useState(readDeveloperPreferences);
 const updateDeveloperPref=(key:keyof typeof developerPrefs,checked:boolean)=>{const next={...developerPrefs,[key]:checked};setDeveloperPrefs(next);writeDeveloperPreferences(next)};
 useEffect(()=>{void getProfileSettings(user).then(x=>{setS(x);setInitial(x);applyProfileAppearance(x)});const sync=()=>void getAccountAccess().then(setAccess);sync();window.addEventListener("onlinerepetitor:account-access",sync);window.addEventListener("focus",sync);return()=>{window.removeEventListener("onlinerepetitor:account-access",sync);window.removeEventListener("focus",sync)}},[user.id]);
 const dirty=useMemo(()=>JSON.stringify(s)!==JSON.stringify(initial),[s,initial]);
 const patch=<K extends keyof ProfileSettings>(k:K,v:ProfileSettings[K])=>{const next={...s,[k]:v};setS(next);applyProfileAppearance(next)};
 const save=async()=>{await saveProfileSettings(s);setInitial(s);setNotice("Настройки сохранены");setTimeout(()=>setNotice(""),1500)};
 const openTeacherApplication=()=>{
  setApplicationError("");setApplicationOpen(true);
  void getProfileDetails(user.id).then(details=>setApplication(current=>({...current,phone:current.phone||details.phone,city:current.city||details.city,organization:current.organization||details.organization,focusArea:current.focusArea||details.focusArea}))).catch(()=>{});
 };
 const updateApplication=(key:keyof TeacherApplication,value:string)=>setApplication(current=>({...current,[key]:value}));
 const sendTeacherApplication=async(event:FormEvent<HTMLFormElement>)=>{
  event.preventDefault();if(roleBusy)return;
  if(application.organization.trim().length<2||application.focusArea.trim().length<2){setApplicationError("Укажите место работы и предметы, которые планируете преподавать.");return}
  const cleaned={...application,phone:application.phone.trim(),city:application.city.trim(),organization:application.organization.trim(),focusArea:application.focusArea.trim(),experience:application.experience.trim(),motivation:application.motivation.trim()};
  if(previewRole){
   if(previewRole==="student"){
    addPreviewTeacherRequest(user,cleaned);setApplicationOpen(false);setNotice("Тестовая заявка сохранена только на этом устройстве. Удалить её можно в Администрирование → Заявки преподавателей.");
   }else{setApplicationOpen(false);setNotice("Анкета проверена в режиме просмотра. Настоящие данные аккаунта не изменены.")}
   return;
  }
  setRoleBusy(true);setApplicationError("");
  try{setAccess(await requestTeacherAccess(cleaned));setApplicationOpen(false);setNotice("Заявка отправлена администратору");window.dispatchEvent(new Event("onlinerepetitor:account-access"))}
  catch(value){setApplicationError(value instanceof Error?value.message:"Не удалось отправить заявку")}
  finally{setRoleBusy(false)}
 };
 return <main className="profile-shell settings-shell">
  <header className="students-header compact-settings-header"><div><button className="boards-secondary" onClick={onBack}>← Доски</button><div><strong>Настройки</strong><span>Интерфейс, доска, роль и приложение</span></div></div><button className="boards-create" disabled={!dirty} onClick={()=>void save()}>Сохранить</button></header>
  <section className="settings-compact-content">{notice&&<div className="access-notice">{notice}</div>}
   <div className="settings-compact-grid">
    <section className="settings-row-card lectris-palette-setting"><div><b>Цвет Lektrus</b><small>Основной акцент приложения · сохраняется на этом устройстве</small></div>
      <div className="lectris-palette-options" role="group" aria-label="Цветовое оформление Lektrus">
        {([["sapphire","Синий"],["jade","Бирюзовый"],["violet","Фиолетовый"],["sunset","Коралловый"]] as const).map(([key,label])=>
          <button type="button" key={key} className={palette===key?"selected":""} aria-pressed={palette===key}
            onClick={()=>changePalette(key)}>
            <span className="lektrus-palette-label"><span className={`lectris-palette-swatch is-${key}`} aria-hidden="true"/>{label}<span className="lektrus-palette-check" aria-hidden="true">{palette===key?"✓":""}</span></span>
          </button>)}
      </div>
    </section>
    <section className="settings-row-card"><div><b>Компактный интерфейс</b><small>Меньше отступов и крупности элементов</small></div><input type="checkbox" checked={s.compactUi} onChange={e=>patch("compactUi",e.target.checked)}/></section>
    <section className="settings-row-card"><div><b>Масштаб новых досок</b><small>Стартовое значение</small></div><select value={s.defaultBoardZoom} onChange={e=>patch("defaultBoardZoom",Number(e.target.value))}><option value={75}>75%</option><option value={90}>90%</option><option value={100}>100%</option><option value={110}>110%</option><option value={125}>125%</option></select></section>
    <section className="settings-row-card settings-plan-row"><div><b>Тариф · {plan.name}</b><small>{access.subscriptionUntil&&access.subscriptionPlan!=="free"?`${plan.description} · до ${new Date(access.subscriptionUntil).toLocaleDateString("ru-RU")}`:plan.description}</small></div><button onClick={onBilling}>Тарифы</button></section><section className="settings-row-card"><div><b>AI-студия</b><small>Задания, тесты и карточки</small></div><button onClick={()=>{window.history.pushState({},"","/?section=ai");window.dispatchEvent(new PopStateEvent("popstate"))}}>Открыть</button></section>
    <section className="settings-row-card settings-role-row"><div><b>Роль</b><small>{previewRole?`${shownAccess.role==="teacher"?"Преподаватель":"Ученик"} · режим проверки`:shownAccess.isAdmin?"Администратор":shownAccess.role==="teacher"?"Преподаватель":shownAccess.teacherStatus==="pending"?"Заявка преподавателя рассматривается":shownAccess.teacherStatus==="rejected"?"Заявку можно отправить повторно":"Ученик"}</small></div>{previewRole?shownAccess.role==="teacher"?<button onClick={()=>onPreviewRoleChange?.("student")}>Проверить как ученик</button>:<button onClick={()=>openTeacherApplication()}>Проверить заявку преподавателя</button>:!shownAccess.isAdmin&&shownAccess.role!=="teacher"&&shownAccess.teacherStatus!=="pending"?<button disabled={roleBusy} onClick={openTeacherApplication}>Подать заявку преподавателя</button>:shownAccess.role==="teacher"&&!shownAccess.isAdmin?<button disabled={roleBusy} onClick={async()=>{if(!confirm("Перейти в роль ученика?"))return;setRoleBusy(true);try{setAccess(await setStudentRole());window.dispatchEvent(new Event("onlinerepetitor:account-access"))}finally{setRoleBusy(false)}}}>Роль ученика</button>:null}</section>
    {Capacitor.isNativePlatform()&&!nativeBackendIsBundled()&&<section className="settings-row-card"><div><b>Сервер Lektrus</b><small>Для входа и совместной работы используется сохранённое подключение Supabase</small></div><button type="button" onClick={()=>{if(window.confirm("Изменить подключение к серверу? Потребуется снова указать публичный адрес Supabase и ключ.")){clearNativeBackendConnection();window.location.reload()}}}>Изменить</button></section>}
    {!Capacitor.isNativePlatform()&&<section className="settings-row-card lektrus-install-settings"><div><b>Приложение для вашего устройства</b><small>{isInstalled?"Lektrus запущен как приложение":installAvailable?"Установите Lektrus для запуска без вкладки браузера":manualInstallHelp()}</small><small>Для входа, совместной работы и синхронизации досок необходимо подключение к интернету.</small></div>{!isInstalled&&installAvailable&&<button type="button" onClick={onInstall}>Установить</button>}</section>}
    {shownAccess.isAdmin&&<section className="settings-row-card settings-developer-card"><div><b>Настройки разработчика</b><small>Диагностика включается только на этом устройстве.</small></div>
     <div className="settings-developer-options">
      <label><span><b>Обмен штрихами</b><small>Показывать отправку и получение рисунков.</small></span><input type="checkbox" checked={developerPrefs.showInkDiagnostics} onChange={e=>updateDeveloperPref("showInkDiagnostics",e.target.checked)}/></label>
      <label><span><b>Состояние доски</b><small>Показывать статус синхронизации и подключения.</small></span><input type="checkbox" checked={developerPrefs.showBoardDiagnostics} onChange={e=>updateDeveloperPref("showBoardDiagnostics",e.target.checked)}/></label>
      <label><span><b>Показатели производительности</b><small>Показывать количество объектов и масштаб доски.</small></span><input type="checkbox" checked={developerPrefs.showPerformanceDiagnostics} onChange={e=>updateDeveloperPref("showPerformanceDiagnostics",e.target.checked)}/></label>
     </div>
    </section>}
   </div>
   <div className="settings-account-footer"><div><strong>Учётная запись</strong><span>{user.email} · {previewRole?"завершите режим проверки, чтобы вернуться к администратору":"вы можете завершить сеанс на этом устройстве"}</span></div><button className="profile-logout-button" onClick={onLogout}>{previewRole?"Завершить проверку роли":"Выйти из аккаунта"}</button></div>
  </section>
  {applicationOpen&&<div className="access-backdrop teacher-application-backdrop" onMouseDown={event=>{if(event.target===event.currentTarget&&!roleBusy)setApplicationOpen(false)}}>
   <form className="access-modal teacher-application-modal" onSubmit={event=>void sendTeacherApplication(event)}>
    <div className="access-head"><div><h2>{previewRole?"Тестовая заявка преподавателя":"Заявка преподавателя"}</h2><p>{previewRole?"Заявка останется в этом браузере и не уйдёт администратору как настоящее обращение.":"Заполните сведения, чтобы администратор мог рассмотреть ваш запрос."}</p></div><button type="button" aria-label="Закрыть" disabled={roleBusy} onClick={()=>setApplicationOpen(false)}>×</button></div>
    <div className="teacher-application-grid">
     <label><span>Предметы для преподавания <i>*</i></span><input required value={application.focusArea} onChange={event=>updateApplication("focusArea",event.target.value)} placeholder="Например, математика и физика" maxLength={120}/></label>
     <label><span>Место работы или формат занятий <i>*</i></span><input required value={application.organization} onChange={event=>updateApplication("organization",event.target.value)} placeholder="Школа, учебный центр или частная практика" maxLength={160}/></label>
     <label><span>Телефон для связи</span><input type="tel" value={application.phone} onChange={event=>updateApplication("phone",event.target.value)} placeholder="+7 900 000-00-00" maxLength={40}/></label>
     <label><span>Город</span><input value={application.city} onChange={event=>updateApplication("city",event.target.value)} placeholder="Ваш город" maxLength={100}/></label>
     <label className="teacher-application-full"><span>Опыт преподавания</span><textarea value={application.experience} onChange={event=>updateApplication("experience",event.target.value)} placeholder="Стаж, возраст учеников, направления занятий" maxLength={1000} rows={3}/></label>
     <label className="teacher-application-full"><span>Комментарий для администратора</span><textarea value={application.motivation} onChange={event=>updateApplication("motivation",event.target.value)} placeholder="Расскажите, как вы планируете использовать Lektrus" maxLength={1000} rows={3}/></label>
    </div>
    {applicationError&&<div className="profile-redesign-alert" role="alert">{applicationError}</div>}
    <div className="teacher-application-actions"><span><i>*</i> обязательные поля</span><button className="boards-create" type="submit" disabled={roleBusy}>{roleBusy?"Отправляем…":"Отправить заявку"}</button></div>
   </form>
  </div>}
 </main>
}
