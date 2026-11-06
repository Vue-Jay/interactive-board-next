import {useState} from "react";
import {SKIN_REFERENCE_SPECIMENS,SKIN_CALIBRATED_EXTERNAL_REFERENCES,
 type SkinReferenceType} from "./lektrusSkinSpecimenCatalog";

/** Only real histology appears in this independent evidence view. It never
 * replaces the shared body camera or masquerades as the sample at the cursor.
 */
export default function LektrusSkinSpecimens({defaultOpen=false,defaultSelection="human"}:
 {defaultOpen?:boolean;defaultSelection?:SkinReferenceType}){
 const [selectedId,setSelectedId]=useState<SkinReferenceType>(defaultSelection);
 const item=SKIN_REFERENCE_SPECIMENS.find(sample=>sample.id===selectedId)
  ??SKIN_REFERENCE_SPECIMENS[0];
 return <details open={defaultOpen} className="lek-anatomy-source-plates">
  <summary>Подлинные гистопрепараты кожи</summary>
  <p className="lek-anatomy-source-note">
   Настоящие микрофотографии ткани для сравнения с учебным разрезом.
   Это <b>не кадры увеличения выбранного тела</b>.
   Указанный масштаб снимка нельзя переносить на цифровой зум доски.
  </p>
  <div className="lek-anatomy-source-tabs" role="group"
   aria-label="Выбрать гистологический препарат">
   {SKIN_REFERENCE_SPECIMENS.map(sample=><button
    key={sample.id} type="button"
    className={selectedId===sample.id?"is-active":""}
    aria-pressed={selectedId===sample.id}
    onClick={()=>setSelectedId(sample.id)}>
    {sample.id==="human"?"Человек · CDC":
     sample.id==="thin"?"Тонкая":"Толстая"}
   </button>)}
  </div>
  <figure className="lek-anatomy-source-plate">
   <a href={item.imageUrl} target="_blank" rel="noopener noreferrer"
    title="Открыть исходное изображение в полном размере, доступно офлайн">
    <img src={item.imageUrl} loading="lazy" key={item.id}
     alt={item.id==="human"?
      "Реальная микрофотография нормальной кожи человека, CDC PHIL 14586":
      item.id==="thin"?
      "Микрофотография ткани, обозначенная автором как тонкая кожа":
      "Микрофотография ткани, обозначенная автором как толстая кожа"}/>
   </a>
   <figcaption>
    <strong>{item.title}</strong>
    <span>{item.sampleOrigin}</span>
    <span>{item.notes}</span>
    <span className="lek-anatomy-source-license">
     {item.author}. <a href={item.originalUrl}
      target="_blank" rel="noopener noreferrer">Первоисточник</a>.
     <a href={item.licenseUrl}
      target="_blank" rel="noopener noreferrer">{item.licenseName}</a>.
    </span>
   </figcaption>
  </figure>
  <section className="lek-anatomy-calibrated-source"
   aria-label="Подтверждённые калиброванные препараты человека">
   <strong>Калиброванные препараты человека</strong>
   <p>Оригинальные микроснимки в научном просмотрщике
    Университета Миннесоты. Для всех трёх указан размер пикселя
    <b> 0,3171 мкм</b>, но он не относится к цифровому зуму Lektrus.</p>
   <div className="lek-anatomy-external-slides">
    {SKIN_CALIBRATED_EXTERNAL_REFERENCES.map(ref=>
     <a key={ref.id} href={ref.sourceUrl}
      target="_blank" rel="noopener noreferrer"
      title={"Открыть калиброванный препарат: "+ref.title}>
      <strong>{ref.title}</strong>
      <small>{ref.siteVerified?"Происхождение области подтверждено":
       "Анатомический тип подтверждён, конкретный участок не указан"}
       {" · "+ref.objective}</small>
     </a>)}
   </div>
   <p>Просмотр изображений доступен на сайте правообладателя.
    Их копии не входят в офлайн-пакет, поскольку права на
    распространение исходных препаратов не подтверждены.</p>
  </section>
 </details>;
}
