import { useEffect, useRef, useState, type FocusEvent, type FormEvent } from "react";
import { isRemoteBackendEnabled } from "./backend";
import {saveProfileDetails} from "./profileDetailsStore";
import { confirmRegistration,forgetRememberedAccount, getRememberedAccount, loginUser, loginGuest, registerUser,resendRegistrationCode, resumeRememberedAccount, type AuthUser } from "./authStore";

type Mode = "login" | "register";
type Props = { onAuthenticated: (user: AuthUser) => void; previewMode?:boolean; onPreviewClose?:()=>void };
const hasJoinLink = () => window.location.pathname.startsWith("/join/") || new URL(window.location.href).searchParams.has("join");

export default function AuthScreen({ onAuthenticated,previewMode=false,onPreviewClose }: Props) {
  const [mode, setMode] = useState<Mode>(previewMode?"register":"login");
  const [name, setName] = useState("");
  const [firstName,setFirstName]=useState("");
  const [lastName,setLastName]=useState("");
  const [confirmationCode,setConfirmationCode]=useState("");
  const [awaitingConfirmation,setAwaitingConfirmation]=useState(false);
  const [previewComplete,setPreviewComplete]=useState(false);
  const previewCode=useRef("");
  const [resendCooldown,setResendCooldown]=useState(0);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice,setNotice]=useState("");
  const [guestName, setGuestName] = useState("");
  const [remembered,setRemembered]=useState(()=>getRememberedAccount());
  const joining = hasJoinLink();
  // Android WebView and iOS Safari sometimes blur a field while their virtual
  // keyboard changes the visual viewport. Never treat deleting the last
  // character as a request to dismiss the keyboard.
  const fieldFocus = useRef({focusedAt:0,editedAt:0,outsidePressAt:0});
  useEffect(()=>{
    const outsidePress=(event:PointerEvent)=>{
      const target=event.target;
      const active=document.activeElement;
      // A tap on ANOTHER field is intentional too. Don't immediately restore
      // the previous one when WebKit reports relatedTarget=null during focus.
      if(!(target instanceof Element) ||
         (active instanceof HTMLInputElement && active.closest(".auth-form") &&
           active!==target) ||
         !target.closest(".auth-form input"))
        fieldFocus.current.outsidePressAt=Date.now();
    };
    document.addEventListener("pointerdown",outsidePress,true);
    return ()=>document.removeEventListener("pointerdown",outsidePress,true);
  },[]);
  useEffect(()=>{if(resendCooldown<=0)return;const timer=window.setTimeout(()=>setResendCooldown(value=>value-1),1000);return()=>window.clearTimeout(timer)},[resendCooldown]);
  const fieldEdited=(value:string,update:(next:string)=>void)=>{
    fieldFocus.current.editedAt=Date.now();
    update(value);
  };
  const fieldFocused=()=>{fieldFocus.current.focusedAt=Date.now()};
  const fieldBlurred=(event:FocusEvent<HTMLInputElement>)=>{
    if(!window.matchMedia("(max-width:700px), (pointer:coarse)").matches)return;
    // Explicit taps elsewhere, tab navigation and system back after a normal
    // editing session should work. Rescue only a near-immediate stray blur.
    if(event.relatedTarget)return;
    const now=Date.now(),focus=fieldFocus.current;
    if(now-focus.outsidePressAt<400 ||
       (now-focus.focusedAt>700 && now-focus.editedAt>230))return;
    const input=event.currentTarget;
    window.requestAnimationFrame(()=>{
      if(!input.isConnected || document.activeElement!==document.body ||
         Date.now()-fieldFocus.current.outsidePressAt<400)return;
      input.focus({preventScroll:true});
    });
  };

  const quickLogin=async()=>{
    if(busy||!remembered)return;
    setBusy(true);setError("");setNotice("");
    try{onAuthenticated(await resumeRememberedAccount())}
    catch(value){setError(value instanceof Error?value.message:"Не удалось выполнить быстрый вход");setRemembered(getRememberedAccount())}
    finally{setBusy(false)}
  };
  const forgetQuickLogin=async()=>{
    if(busy)return;
    setBusy(true);setError("");
    try{await forgetRememberedAccount();setRemembered(null)}
    finally{setBusy(false)}
  };
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (busy) return;
    // An intentional form submission may blur the keyboard; don't reopen it.
    fieldFocus.current.outsidePressAt=Date.now();
    setBusy(true);setError("");
    try {
      if(awaitingConfirmation){
        if(previewMode){
          if(confirmationCode!==previewCode.current){setError("Код не подошёл. Проверьте демонстрационный код выше.");return}
          setPreviewComplete(true);setPassword("");setError("");setNotice("Регистрация и подтверждение пройдены. Тестовый аккаунт не создан.");return;
        }
        const user=await confirmRegistration(email,confirmationCode);
        onAuthenticated(user);
      }else{
        if(previewMode){
          previewCode.current=String(Math.floor(100000+Math.random()*900000));
          setAwaitingConfirmation(true);setConfirmationCode("");setResendCooldown(0);
          setNotice(`Демонстрационный код Lektrus: ${previewCode.current}. Письмо и аккаунт не создаются.`);return;
        }
        const user = mode === "register" ? await registerUser({ name:mode==="register"?(name.trim()||[firstName,lastName].filter(Boolean).join(" ")):name,firstName:firstName.trim(),lastName:lastName.trim(),email,password }) : await loginUser({ email, password });
        if(!user&&mode==="register"){
          setAwaitingConfirmation(true);setConfirmationCode("");setResendCooldown(30);
          return;
        }
        if(user){
          if(mode==="register"&&!isRemoteBackendEnabled())await saveProfileDetails(user.id,{firstName:firstName.trim(),lastName:lastName.trim(),middleName:"",phone:"",city:"",organization:"",focusArea:""});
          onAuthenticated(user);
        }
      }
    } catch (value) { setError(value instanceof Error ? value.message : "Не удалось выполнить вход"); }
    finally { setBusy(false); }
  };
  const changeMode = (next: Mode) => { setMode(next);setError("");setNotice("");setPassword("");setAwaitingConfirmation(false);setConfirmationCode("");setPreviewComplete(false); };

  return <main className={`auth-shell${previewMode?" lektrus-registration-preview":""}`}><section className="auth-card" aria-labelledby="auth-title">
    <div className="auth-brand-row"><div className="auth-logo" aria-label="Lektrus"><img src="/lektrus-icon-192.png" width="52" height="52" alt="" /></div><div><div className="auth-brand">Lektrus</div><div className="auth-subtitle">Пространство для обучения</div></div>{previewMode&&<button type="button" className="boards-secondary auth-preview-close" onClick={onPreviewClose}>Вернуться к приложению</button>}</div>
    {!previewMode&&!isRemoteBackendEnabled() && <div className="access-notice" role="alert">Сервер Supabase не подключён. Сейчас доступен только локальный вход с аккаунтами, созданными в этом браузере. Для входа под существующим аккаунтом добавьте VITE_SUPABASE_URL и VITE_SUPABASE_ANON_KEY в файл .env.local и перезапустите npm run dev.</div>}
    {joining && <div className="access-notice">Откройте доску по приглашению: войдите в аккаунт или продолжите без регистрации.</div>}
    {!previewMode&&mode==="login"&&remembered&&<div className="auth-remembered"><div className="auth-remembered-avatar">{remembered.name.charAt(0).toUpperCase()}</div><div className="auth-remembered-copy"><strong>{remembered.name}</strong><span>{remembered.email}</span></div><button className="auth-remembered-login" type="button" disabled={busy} onClick={()=>void quickLogin()}>{busy?"Входим…":"Войти"}</button><button className="auth-remembered-forget" type="button" disabled={busy} onClick={()=>void forgetQuickLogin()} title="Забыть сохранённый аккаунт">×</button></div>}
    {!previewMode&&<div className="auth-tabs" role="tablist" aria-label="Вход или регистрация"><button type="button" className={mode==="login"?"active":""} onClick={()=>changeMode("login")}>Вход</button><button type="button" className={mode==="register"?"active":""} onClick={()=>changeMode("register")}>Регистрация</button></div>}
    <form className="auth-form" onSubmit={submit}>
      {previewMode&&previewComplete?<div className="auth-preview-success"><h1 id="auth-title">Регистрация подтверждена</h1><p>Экран подтверждения Lektrus работает. Демо не отправляет письма и не создаёт аккаунты.</p><button type="button" className="auth-submit" onClick={onPreviewClose}>Вернуться к приложению</button></div>:<>
      <div><h1 id="auth-title">{awaitingConfirmation?"Подтвердите email":mode==="register"?"Создать аккаунт":"С возвращением"}</h1><p>{awaitingConfirmation?previewMode?`Введите демонстрационный код для ${email}.`: `Введите код из письма, отправленного на ${email}.`:joining?"После входа откроется доска, которой с вами поделились.":mode==="register"?previewMode?"Заполните форму и проверьте собственный экран подтверждения Lektrus.":"Заполните данные, чтобы создать пространство для учёбы.":"Войдите, чтобы продолжить занятие или открыть свои доски."}</p></div>
      {mode==="register"&&!awaitingConfirmation&&<div className="auth-register-name-grid"><label className="auth-field"><span>Имя</span><input required value={firstName} onChange={e=>fieldEdited(e.target.value,setFirstName)} onFocus={fieldFocused} onBlur={fieldBlurred} autoComplete="given-name" autoCapitalize="words" placeholder="Ваше имя" maxLength={80} /></label><label className="auth-field"><span>Фамилия</span><input required value={lastName} onChange={e=>fieldEdited(e.target.value,setLastName)} onFocus={fieldFocused} onBlur={fieldBlurred} autoComplete="family-name" autoCapitalize="words" placeholder="Ваша фамилия" maxLength={80} /></label><label className="auth-field auth-register-display-name"><span>Как к вам обращаться</span><input value={name} onChange={e=>fieldEdited(e.target.value,setName)} onFocus={fieldFocused} onBlur={fieldBlurred} autoComplete="nickname" autoCapitalize="words" placeholder="Имя для участников доски" maxLength={80}/></label></div>}
      <label className="auth-field"><span>Email</span><input required type="email" value={email} onChange={e=>fieldEdited(e.target.value,setEmail)} onFocus={fieldFocused} onBlur={fieldBlurred} autoComplete="email" inputMode="email" autoCapitalize="none" autoCorrect="off" spellCheck={false} placeholder="name@example.com" maxLength={180} /></label>
      {!awaitingConfirmation&&<label className="auth-field"><span>Пароль</span><input required minLength={mode==="register"?6:undefined} type="password" value={password} onChange={e=>fieldEdited(e.target.value,setPassword)} onFocus={fieldFocused} onBlur={fieldBlurred} autoComplete={mode==="register"?"new-password":"current-password"} autoCapitalize="none" autoCorrect="off" spellCheck={false} placeholder={mode==="register"?"Минимум 6 символов":"Ваш пароль"} maxLength={200}/></label>}
      {awaitingConfirmation&&<><label className="auth-field"><span>{previewMode?"Код подтверждения":"Код из письма"}</span><input required inputMode="numeric" autoComplete="one-time-code" value={confirmationCode} onChange={e=>fieldEdited(e.target.value.replace(/\D/g,"").slice(0,8),setConfirmationCode)} onFocus={fieldFocused} onBlur={fieldBlurred} placeholder="Введите код подтверждения" maxLength={8}/></label><div className="auth-confirm-actions"><button type="button" disabled={busy||(!previewMode&&resendCooldown>0)} onClick={async()=>{if(previewMode){previewCode.current=String(Math.floor(100000+Math.random()*900000));setNotice(`Новый демонстрационный код Lektrus: ${previewCode.current}.`);setConfirmationCode("");return}setBusy(true);setError("");setNotice("");try{await resendRegistrationCode(email);setResendCooldown(30);setNotice("Новый код отправлен.")}catch(value){setError(value instanceof Error?value.message:"Не удалось отправить код")}finally{setBusy(false)}}}>{previewMode?"Сгенерировать другой код":resendCooldown>0?`Отправить код снова через ${resendCooldown} с`:"Отправить код повторно"}</button>{!previewMode&&<button type="button" disabled={busy} onClick={()=>{setAwaitingConfirmation(false);setConfirmationCode("");setError("");setNotice("")}}>Изменить email</button>}</div></>}
      {error&&<div className="auth-error" role="alert">{error}</div>}
      {notice&&<div className="auth-notice" role="status">{notice}</div>}
      <button className="auth-submit" type="submit" disabled={busy}>{busy?"Подождите…":awaitingConfirmation?"Подтвердить и продолжить":mode==="register"?"Создать аккаунт":"Войти"}</button>
      {joining&&<><div className="auth-or"><span>или</span></div><label className="auth-field"><span>Ваше имя на доске</span><input value={guestName} onChange={e=>fieldEdited(e.target.value,setGuestName)} onFocus={fieldFocused} onBlur={fieldBlurred} autoComplete="nickname" placeholder="Например, Анна" maxLength={60}/></label><button className="auth-guest" type="button" disabled={busy||guestName.trim().length<2} onClick={async()=>{if(busy)return;setBusy(true);setError("");try{onAuthenticated(await loginGuest(guestName))}catch(value){setError(value instanceof Error?value.message:"Не удалось войти как гость")}finally{setBusy(false)}}}>Продолжить как гость</button><p className="auth-guest-note">Аккаунт создавать не нужно. Это имя увидят участники доски.</p></>}
      </>}
    </form>
    <div className="auth-role-note">Одна доска, много возможностей. Учитесь, объясняйте и работайте вместе.</div>
  </section></main>;
}
