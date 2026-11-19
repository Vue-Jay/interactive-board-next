import { useLayoutEffect, useRef } from "react";

export type UnavailableReason = "offline" | "server" | "startup";
type ElementRoot = HTMLElement;

function text(root:ElementRoot, selector:string, value:string){
  const element=root.querySelector(selector);
  if(element)element.textContent=value;
}
function template(root:ElementRoot){
  const source=document.getElementById("lektrus-unavailable-template") as HTMLTemplateElement|null;
  if(!source)throw new Error("Lektrus recovery template missing");
  root.textContent="";
  root.appendChild(source.content.cloneNode(true));
}
function update(root:ElementRoot,reason:UnavailableReason,checking:boolean,automatic:boolean){
  const copy=reason==="offline"
    ? ["Нет соединения","Вы не в сети","Проверьте Wi-Fi или мобильный интернет, чтобы снова открыть Lektrus."]
    :reason==="startup"
      ? ["Ошибка загрузки","Не удалось открыть Lektrus","Интерфейс не загрузился. Проверьте соединение и повторите попытку."]
      : ["Сервис недоступен","Скоро вернёмся","Не удаётся связаться с сервером Lektrus. Попробуйте немного позже — возможно, сервис временно недоступен."];
  text(root,"[data-u-status]",copy[0]);
  text(root,"[data-u-title]",copy[1]);
  text(root,"[data-u-description]",copy[2]);
  text(root,"[data-u-button]",checking?"Проверяем…":"Повторить попытку");
  text(root,"[data-u-note]",automatic
    ?"Проверяем доступность автоматически. Эта ошибка не означает, что ваши данные удалены."
    :"Эта ошибка не означает, что ваши данные удалены. Не переустанавливайте приложение.");
  const button=root.querySelector<HTMLButtonElement>("[data-u-retry]");
  if(button)button.disabled=checking;

}

// The same self-contained markup is embedded in index.html at build time and
// emitted as the service worker's standalone navigation fallback.
export function ServiceUnavailableScreen({reason,checking=false,automatic=false,onRetry}:{
  reason:UnavailableReason;checking?:boolean;automatic?:boolean;onRetry:()=>void;
}){
  const host=useRef<HTMLDivElement>(null);
  useLayoutEffect(()=>{if(host.current)template(host.current)},[]);
  useLayoutEffect(()=>{if(host.current)update(host.current,reason,checking,automatic)},[reason,checking,automatic]);
  return <div ref={host} onClick={event=>{
    if(event.target instanceof Element){if(event.target.closest("[data-u-retry]"))onRetry();}
  }}/>;
}
export function mountStartupUnavailable(root:HTMLElement){
  template(root);
  update(root,navigator.onLine===false?"offline":"startup",false,false);
  root.querySelector("[data-u-retry]")?.addEventListener("click",()=>window.location.reload());
}
