import {useState} from "react";
import {SKIN_REFERENCE_SPECIMENS,SKIN_CALIBRATED_EXTERNAL_REFERENCE,
 type SkinReferenceType} from "./lektrusSkinSpecimenCatalog";

/** Only real histology appears in this independent evidence view. It never
 * replaces the shared body camera or masquerades as the sample at the cursor.
 */
export default function LektrusSkinSpecimens({defaultOpen=false}:{defaultOpen?:boolean}){
 const [selectedId,setSelectedId]=useState<SkinReferenceType>("human");
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
   aria-label="Подтверждённый калиброванный препарат человека">
   <strong>Калиброванный образец человека</strong>
   <p>В <a href={SKIN_CALIBRATED_EXTERNAL_REFERENCE.sourceUrl}
    target="_blank" rel="noopener noreferrer">научном микроскопе
    Университета Миннесоты</a> доступна толстая кожа большого пальца
    человека, окраска H&E. Известный масштаб оригинального изображения:
    <b> 0,3171 мкм/пиксель</b>. Это число относится только к
    внешнему цифровому препарату, не к картинке Lektrus.
    Он открыт по ссылке, поскольку права на копирование его снимков
    в наш офлайн-пакет пока не подтверждены.</p>
  </section>
 </details>;
}
