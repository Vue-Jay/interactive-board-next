import {useRef,useState,type ChangeEvent} from "react";
import {SITE_LIBRARY_SHOTS,uploadMarketingImage} from "./marketingSiteImages";

export default function SiteImageChooser({onChoose}:{onChoose:(url:string)=>void}){
 const input=useRef<HTMLInputElement>(null);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState("");
 const upload=async(event:ChangeEvent<HTMLInputElement>)=>{
  const file=event.currentTarget.files?.[0];
  event.currentTarget.value="";
  if(!file)return;
  setBusy(true);setError("");
  try{onChoose(await uploadMarketingImage(file))}
  catch(failure){setError(failure instanceof Error?failure.message:"Не удалось загрузить изображение")}
  finally{setBusy(false)}
 };
 return <div className="site-builder-image-chooser">
  <h3>Изображения Lektrus</h3>
  <div className="site-builder-image-grid">{SITE_LIBRARY_SHOTS.map(shot=>
   <button key={shot.src} type="button" disabled={busy} onClick={()=>onChoose(shot.src)} title={shot.name}>
    <img src={shot.src} loading="lazy" alt=""/><span>{shot.name}</span>
   </button>)}
  </div>
  <input type="file" ref={input} accept="image/png,image/jpeg,image/webp" hidden onChange={e=>void upload(e)}/>
  <button className="site-builder-media-upload" type="button" disabled={busy} onClick={()=>input.current?.click()}>{busy?"Загружаем…":"+ Загрузить своё изображение"}</button>
  <p>JPEG, PNG или WebP, до 5 МБ. Изображение будет доступно посетителям сайта после публикации.</p>
  {error&&<p className="site-builder-media-error" role="alert">{error}</p>}
 </div>;
}
