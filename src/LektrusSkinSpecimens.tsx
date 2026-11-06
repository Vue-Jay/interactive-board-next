import {SKIN_REFERENCE_SPECIMENS} from "./lektrusSkinSpecimenCatalog";

/** Supporting evidence view, deliberately separate from the continuous
 * anatomical camera. An unrelated specimen must never be substituted for
 * the exact world coordinates of the teacher's current zoom.
 */
export default function LektrusSkinSpecimens({defaultOpen=false}:{defaultOpen?:boolean}){
 return <details open={defaultOpen} className="lek-anatomy-source-plates">
  <summary>Гистопрепараты: тонкая и толстая кожа</summary>
  <p className="lek-anatomy-source-note">
   Настоящие микроснимки окрашенной ткани для сравнения с учебным
   разрезом. Это <b>не кадры увеличения выбранного тела</b>.
   Происхождение участка, вид и калибровка в метаданных снимков
   не указаны. Поэтому линейка в мкм здесь не имитируется.
  </p>
  <div className="lek-anatomy-source-grid">
   {SKIN_REFERENCE_SPECIMENS.map(item=><figure key={item.id}
     className="lek-anatomy-source-plate">
    <a href={item.imageUrl} target="_blank" rel="noopener noreferrer"
     title="Открыть оригинальный препарат крупно, в том числе офлайн">
     <img src={item.imageUrl} loading="lazy"
      alt={item.id==="thin"?
       "Оригинальный микроснимок тонкой кожи с волосяным фолликулом и дермой":
       "Оригинальный микроснимок толстой кожи с выраженным эпидермисом и дермой"}/>
    </a>
    <figcaption>
     <strong>{item.title}</strong>
     <span>{item.id==="thick"?
      "Для человека характерна для ладоней и подошв; волос нет.":
      "Для волосистой кожи: в срезе видны фолликулы."}</span>
     <span className="lek-anatomy-source-license">
      Фото: {item.author}. <a href={item.originalUrl}
       target="_blank" rel="noopener noreferrer">Источник</a>.
      <a href={item.licenseUrl}
       target="_blank" rel="noopener noreferrer">{item.licenseName}</a>.
     </span>
    </figcaption>
   </figure>)}
  </div>
 </details>;
}
