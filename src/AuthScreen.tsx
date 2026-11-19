import { useEffect, useLayoutEffect, useRef, useState, type FocusEvent, type FormEvent } from "react";
import { nativeBoardUrl, pendingSharePath } from "./routes";
import { Capacitor } from "@capacitor/core";
import { installAuthViewport } from "./authViewport";
import UserAvatar from "./UserAvatar";
import type { AccountRole } from "./accountRoleStore";
import { isRemoteBackendEnabled } from "./backend";
import { isSelfhostBackendEnabled } from "./selfhostApi";
import {saveProfileDetails} from "./profileDetailsStore";
import { forgetRememberedAccount, getRememberedAccount, loginUser, loginGuest, registerUser,resendRegistrationCode, resumeRememberedAccount, requestPasswordReset, completePasswordReset, type AuthUser } from "./authStore";

type Mode = "login" | "register";
type Props = { onAuthenticated: (user: AuthUser) => void; previewMode?:boolean; onPreviewClose?:()=>void; initialError?:string };
const hasJoinLink = () => window.location.pathname.startsWith("/join/") || new URL(window.location.href).searchParams.has("join") || Boolean(pendingSharePath());

export default function AuthScreen({ onAuthenticated,previewMode=false,onPreviewClose,initialError="" }: Props) {
  const [mode, setMode] = useState<Mode>(previewMode?"register":"login");
  const [name, setName] = useState("");
  const [firstName,setFirstName]=useState("");
  const [lastName,setLastName]=useState("");
  const [awaitingConfirmation,setAwaitingConfirmation]=useState(false);
  const [previewComplete,setPreviewComplete]=useState(false);
  const [resendCooldown,setResendCooldown]=useState(0);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [registrationRole,setRegistrationRole] = useState<AccountRole|null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice,setNotice]=useState("");
  const [guestName, setGuestName] = useState("");
  const [guestLinkPassword,setGuestLinkPassword]=useState("");
  const [guestPasswordRequired,setGuestPasswordRequired]=useState(false);
  const [remembered,setRemembered]=useState(()=>getRememberedAccount());
  const [passwordResetToken,setPasswordResetToken]=useState(()=>new URLSearchParams(window.location.search).get("password-reset")||"");
  const [passwordResetRequest,setPasswordResetRequest]=useState(false);
  const [passwordConfirmation,setPasswordConfirmation]=useState("");
  const [resetLinkRequested,setResetLinkRequested]=useState(false);
  const recovering=Boolean(passwordResetToken)||passwordResetRequest;
  const authShell=useRef<HTMLElement>(null);
  useLayoutEffect(()=>{
    if(previewMode||!authShell.current)return;
    return installAuthViewport(authShell.current,Capacitor.isNativePlatform());
  },[previewMode]);
  const recoveryHeading=useRef<HTMLHeadingElement>(null);
  useEffect(()=>{
    if(recovering)recoveryHeading.current?.focus();
  },[recovering,passwordResetToken,resetLinkRequested]);
  useEffect(()=>{if(initialError)setError(initialError)},[initialError]);
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
    if (busy || resetLinkRequested) return;
    if(mode==="register"&&!awaitingConfirmation&&!registrationRole){setError("Выберите, кем вы регистрируетесь: учителем или учеником.");return;}
    if(!recovering&&mode==="register"&&!awaitingConfirmation&&password!==passwordConfirmation){
      setError("Пароли не совпадают. Проверьте оба поля.");return;
    }
    // An intentional form submission may blur the keyboard; don't reopen it.
    fieldFocus.current.outsidePressAt=Date.now();
    setBusy(true);setError("");setNotice("");
    try {
      if(passwordResetToken){
        if(password.length<6)throw new Error("Пароль должен содержать минимум 6 символов");
        if(password!==passwordConfirmation)throw new Error("Пароли не совпадают");
        await completePasswordReset(passwordResetToken,password);
        setPasswordResetToken("");setPassword("");setPasswordConfirmation("");
        clearResetLink();
        setMode("login");setNotice("Пароль изменён. Войдите с новым паролем.");return;
      }
      if(passwordResetRequest){
        await requestPasswordReset(email);
        setResetLinkRequested(true);
        return;
      }
      if(awaitingConfirmation){
        if(previewMode){
          setPreviewComplete(true);setPassword("");setError("");setNotice("Регистрация и подтверждение пройдены. Тестовый аккаунт не создан.");return;
        }
        return;
      }else{
        if(previewMode){
          setAwaitingConfirmation(true);setResendCooldown(0);
          setNotice("Демо-ссылка подтверждения готова. Нажмите кнопку ниже, чтобы проверить переход в приложение.");return;
        }
        const user = mode === "register" ? await registerUser({ name:mode==="register"?(name.trim()||[firstName,lastName].filter(Boolean).join(" ")):name,firstName:firstName.trim(),lastName:lastName.trim(),email,password,role:registrationRole! }) : await loginUser({ email, password });
        if(!user&&mode==="register"){
          setAwaitingConfirmation(true);setResendCooldown(30);
          setNotice("Письмо со ссылкой отправлено. Откройте его на этом устройстве — Lektrus подтвердит адрес и войдёт в аккаунт автоматически.");
          return;
        }
        if(user){
          if(mode==="register"&&!isRemoteBackendEnabled())await saveProfileDetails(user.id,{firstName:firstName.trim(),lastName:lastName.trim(),middleName:"",phone:"",city:"",organization:"",focusArea:""});
          onAuthenticated(user);
        }
      }
    } catch (value) {
      setError(value instanceof Error ? value.message : recovering
        ? "Не удалось восстановить пароль. Попробуйте ещё раз."
        : "Не удалось выполнить вход");
    }
    finally { setBusy(false); }
  };
  const clearResetLink=()=>{
    const url=new URL(window.location.href);
    url.searchParams.delete("password-reset");
    window.history.replaceState(window.history.state,"",url.pathname+url.search+url.hash);
  };
  const startRecovery=()=>{
    setPassword("");
    setPasswordConfirmation("");
    setPasswordResetToken("");
    setResetLinkRequested(false);
    setError("");
    setNotice("");
    clearResetLink();
    setPasswordResetRequest(true);
  };
  const leaveRecovery=()=>{
    setPasswordResetRequest(false);
    setPasswordResetToken("");
    setResetLinkRequested(false);
    setPassword("");
    setPasswordConfirmation("");
    setError("");
    setNotice("");
    clearResetLink();
  };
  const changeMode = (next: Mode) => { setMode(next);setError("");setNotice("");setPassword("");setPasswordConfirmation("");setPasswordResetRequest(false);setPasswordResetToken("");setAwaitingConfirmation(false);setPreviewComplete(false); };

  return <main ref={authShell} className={`auth-shell${previewMode?" lektrus-registration-preview":" auth-shell-interactive"}${mode==="register"&&!recovering&&!awaitingConfirmation?" auth-shell-register":""}`}><div className="auth-stage"><section className="auth-card" aria-labelledby="auth-title">
    <div className="auth-brand-row"><div className="auth-logo" aria-label="Lektrus"><img src="/lektrus-icon-192.png" width="52" height="52" alt="" /></div><div><div className="auth-brand">Lektrus</div><div className="auth-subtitle">Пространство для обучения</div></div>{previewMode&&<button type="button" className="boards-secondary auth-preview-close" onClick={onPreviewClose}>Вернуться к приложению</button>}</div>
    {!previewMode&&!isRemoteBackendEnabled()&&!isSelfhostBackendEnabled() && <div className="access-notice" role="alert">Сервер Lektrus не подключён. Сейчас доступен только локальный вход с аккаунтами, созданными в этом браузере.</div>}
    {joining && !recovering && <div className="access-notice">Откройте доску по приглашению: войдите в аккаунт или продолжите без регистрации.{!Capacitor.isNativePlatform()&&/Android|iPhone|iPad|iPod/i.test(navigator.userAgent)&&nativeBoardUrl(pendingSharePath()??window.location.pathname)&&<div><a href={nativeBoardUrl(pendingSharePath()??window.location.pathname)!}>Открыть в приложении Lektrus</a></div>}</div>}
    {!previewMode&&!recovering&&mode==="login"&&remembered&&<div className="auth-remembered"><div className="auth-remembered-avatar"><UserAvatar/></div><div className="auth-remembered-copy"><strong>{remembered.name}</strong><span>{remembered.email}</span></div><button className="auth-remembered-login" type="button" disabled={busy} onClick={()=>void quickLogin()}>{busy?"Входим…":"Войти"}</button><button className="auth-remembered-forget" type="button" disabled={busy} onClick={()=>void forgetQuickLogin()} title="Забыть сохранённый аккаунт">×</button></div>}
    {!previewMode&&!recovering&&<div className="auth-tabs" role="tablist" aria-label="Вход или регистрация"><button type="button" className={mode==="login"?"active":""} disabled={busy} onClick={()=>changeMode("login")}>Вход</button><button type="button" className={mode==="register"?"active":""} disabled={busy} onClick={()=>changeMode("register")}>Регистрация</button></div>}
    <form className="auth-form" onSubmit={submit}>
      {previewMode&&previewComplete?<div className="auth-preview-success"><h1 id="auth-title">Регистрация подтверждена</h1><p>Экран подтверждения Lektrus работает. Демо не отправляет письма и не создаёт аккаунты.</p><button type="button" className="auth-submit" onClick={onPreviewClose}>Вернуться к приложению</button></div>:<>
      {recovering ? <>
        <div>
          <h1 id="auth-title" tabIndex={-1} ref={recoveryHeading}>
            {passwordResetToken?"Новый пароль":resetLinkRequested?"Проверьте почту":"Восстановление пароля"}
          </h1>
          <p>{passwordResetToken?"Введите новый пароль и повторите его. Минимум 6 символов."
            :resetLinkRequested?<>Если к <strong>{email.trim()}</strong> привязан подтверждённый аккаунт Lektrus, мы отправим ссылку для смены пароля. Она действует 30 минут. Проверьте папку «Спам», если письма нет во входящих.</>
            :"Укажите email, с которым вы зарегистрировались в Lektrus."}</p>
        </div>
        {!resetLinkRequested&&(passwordResetToken?<div className="auth-recovery-fields">
          <label className="auth-field"><span>Новый пароль</span><input required type="password" minLength={6} maxLength={72} value={password} autoComplete="new-password" onChange={e=>fieldEdited(e.target.value,setPassword)} onFocus={fieldFocused} onBlur={fieldBlurred}/></label>
          <label className="auth-field"><span>Повторите новый пароль</span><input required type="password" minLength={6} maxLength={72} value={passwordConfirmation} autoComplete="new-password" onChange={e=>fieldEdited(e.target.value,setPasswordConfirmation)} onFocus={fieldFocused} onBlur={fieldBlurred}/></label>
        </div>:<label className="auth-field"><span>Email</span><input required type="email" inputMode="email" autoComplete="email" autoCapitalize="none" autoCorrect="off" spellCheck={false} maxLength={180} placeholder="name@example.com" value={email} onChange={e=>fieldEdited(e.target.value,setEmail)} onFocus={fieldFocused} onBlur={fieldBlurred}/></label>)}
        {error&&<div className="auth-error" role="alert">{error}</div>}
        {!resetLinkRequested&&<button className="auth-submit" type="submit" disabled={busy}>
          {passwordResetToken?(busy?"Сохраняем…":"Сохранить пароль"):(busy?"Отправляем…":"Отправить ссылку")}
        </button>}
        {(passwordResetToken||resetLinkRequested)&&<button className="auth-text-action" type="button" disabled={busy} onClick={startRecovery}>
          {passwordResetToken?"Запросить новую ссылку":"Изменить email или отправить снова"}
        </button>}
        <button className="auth-text-action" type="button" disabled={busy} onClick={leaveRecovery}>Вернуться ко входу</button>
      </>:<>
      <div><h1 id="auth-title">{awaitingConfirmation?"Проверьте почту":mode==="register"?"Создать аккаунт":"С возвращением"}</h1><p>{awaitingConfirmation?previewMode?`Предпросмотр ссылки подтверждения для ${email}.`: `Мы отправили ссылку на ${email}. Откройте её, чтобы подтвердить адрес и автоматически войти в Lektrus. Если письма нет во входящих, проверьте папку «Спам».`:joining?"После входа откроется доска, которой с вами поделились.":mode==="register"?previewMode?"Заполните форму и проверьте собственный экран подтверждения Lektrus.":"Заполните данные, чтобы создать пространство для учёбы.":"Войдите, чтобы продолжить занятие или открыть свои доски."}</p></div>
      {mode==="register"&&!awaitingConfirmation&&<fieldset className="auth-role-choice">
        <legend>Как вы хотите начать?</legend>
        <div className="auth-role-grid">
          <label className={`auth-role-option${registrationRole==="teacher"?" is-selected":""}`}>
            <input type="radio" name="registrationRole" value="teacher" required checked={registrationRole==="teacher"} onChange={()=>setRegistrationRole("teacher")}/>
            <span><strong>Я хочу преподавать</strong><small>Создавать уроки и работать с учениками</small></span>
          </label>
          <label className={`auth-role-option${registrationRole==="student"?" is-selected":""}`}>
            <input type="radio" name="registrationRole" value="student" required checked={registrationRole==="student"} onChange={()=>setRegistrationRole("student")}/>
            <span><strong>Я хочу учиться</strong><small>Участвовать в занятиях и выполнять задания</small></span>
          </label>
        </div>
        <small>Это начальный режим. Учиться можно с любым аккаунтом, а преподавательские возможности можно подключить позже.</small>
      </fieldset>}
      {mode==="register"&&!awaitingConfirmation&&<div className="auth-register-name-grid"><label className="auth-field"><span>Имя</span><input required value={firstName} onChange={e=>fieldEdited(e.target.value,setFirstName)} onFocus={fieldFocused} onBlur={fieldBlurred} autoComplete="given-name" autoCapitalize="words" placeholder="Ваше имя" maxLength={80} /></label><label className="auth-field"><span>Фамилия</span><input required value={lastName} onChange={e=>fieldEdited(e.target.value,setLastName)} onFocus={fieldFocused} onBlur={fieldBlurred} autoComplete="family-name" autoCapitalize="words" placeholder="Ваша фамилия" maxLength={80} /></label><label className="auth-field auth-register-display-name"><span>Как к вам обращаться</span><input value={name} onChange={e=>fieldEdited(e.target.value,setName)} onFocus={fieldFocused} onBlur={fieldBlurred} autoComplete="nickname" autoCapitalize="words" placeholder="Имя для участников доски" maxLength={80}/></label></div>}
      <label className="auth-field"><span>Email</span><input required type="email" value={email} readOnly={awaitingConfirmation&&!previewMode} onChange={e=>fieldEdited(e.target.value,setEmail)} onFocus={fieldFocused} onBlur={fieldBlurred} autoComplete="email" inputMode="email" autoCapitalize="none" autoCorrect="off" spellCheck={false} placeholder="name@example.com" maxLength={180} /></label>
      {!awaitingConfirmation&&<label className="auth-field"><span>Пароль</span><input required minLength={6} type="password" value={password} onChange={e=>fieldEdited(e.target.value,setPassword)} onFocus={fieldFocused} onBlur={fieldBlurred} autoComplete={mode==="register"?"new-password":"current-password"} autoCapitalize="none" autoCorrect="off" spellCheck={false} placeholder={mode==="register"?"Минимум 6 символов":"Ваш пароль"} maxLength={72}/></label>}
      {mode==="register"&&!awaitingConfirmation&&<label className="auth-field"><span>Повторите пароль</span><input required minLength={6} maxLength={72} type="password" value={passwordConfirmation} onChange={e=>fieldEdited(e.target.value,setPasswordConfirmation)} onFocus={fieldFocused} onBlur={fieldBlurred} autoComplete="new-password" autoCapitalize="none" autoCorrect="off" spellCheck={false} aria-invalid={passwordConfirmation.length>0&&passwordConfirmation!==password} aria-describedby={passwordConfirmation.length>0&&passwordConfirmation!==password?"auth-register-password-mismatch":undefined} placeholder="Введите пароль ещё раз"/></label>}
      {mode==="register"&&!awaitingConfirmation&&passwordConfirmation.length>0&&passwordConfirmation!==password&&<div id="auth-register-password-mismatch" className="auth-error">Пароли не совпадают.</div>}
      {awaitingConfirmation&&<div className="auth-confirm-actions">{previewMode?<button type="submit" className="auth-submit" disabled={busy}>Открыть ссылку подтверждения</button>:<><button type="button" disabled={busy||resendCooldown>0} onClick={async()=>{setBusy(true);setError("");setNotice("");try{await resendRegistrationCode(email);setResendCooldown(30);setNotice("Ссылка отправлена повторно.")}catch(value){setError(value instanceof Error?value.message:"Не удалось отправить письмо")}finally{setBusy(false)}}}>{resendCooldown>0?`Отправить ссылку через ${resendCooldown} с`:"Отправить ссылку повторно"}</button><button type="button" disabled={busy} onClick={()=>{setAwaitingConfirmation(false);setError("");setNotice("")}}>Изменить email</button></>}</div>}
      {error&&<div className="auth-error" role="alert">{error}</div>}
      {notice&&<div className="auth-notice" role="status">{notice}</div>}
      {!awaitingConfirmation&&<button className="auth-submit" type="submit" disabled={busy}>{busy?"Подождите…":mode==="register"?"Создать аккаунт":"Войти"}</button>}
      {!awaitingConfirmation&&mode==="login"&&isSelfhostBackendEnabled()&&<button className="auth-text-action auth-forgot-password" type="button" disabled={busy} onClick={startRecovery}>Забыли пароль?</button>}
      {joining&&<><div className="auth-or"><span>или</span></div><label className="auth-field"><span>Ваше имя на доске</span><input value={guestName} onChange={e=>fieldEdited(e.target.value,setGuestName)} onFocus={fieldFocused} onBlur={fieldBlurred} autoComplete="nickname" placeholder="Например, Анна" maxLength={60}/></label>{guestPasswordRequired&&<label className="auth-field"><span>Пароль ссылки</span><input type="password" value={guestLinkPassword} onChange={e=>setGuestLinkPassword(e.target.value)} autoComplete="off" maxLength={72}/></label>}<button className="auth-guest" type="button" disabled={busy||guestName.trim().length<2||(guestPasswordRequired&&!guestLinkPassword)} onClick={async()=>{if(busy)return;setBusy(true);setError("");try{const token=(window.location.pathname.match(/^\/join\/([a-f0-9]{64})\/?$/)?.[1]||new URLSearchParams(window.location.search).get("join")||pendingSharePath()?.slice(6));onAuthenticated(await loginGuest(guestName,token,guestLinkPassword||undefined))}catch(value){const message=value instanceof Error?value.message:"Не удалось войти как гость";if(/парол/i.test(message))setGuestPasswordRequired(true);setError(message)}finally{setBusy(false)}}}>Продолжить как гость</button><p className="auth-guest-note">Аккаунт создавать не нужно. Это имя увидят участники доски.</p></>}
      </>}
      </>}
    </form>
    {!recovering&&<div className="auth-role-note">Одна доска, много возможностей. Учитесь, объясняйте и работайте вместе.</div>}
  </section></div></main>;
}
