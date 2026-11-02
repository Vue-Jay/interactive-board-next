import {useEffect,useRef,useState} from "react";
import type {ChangeEvent,PointerEvent,KeyboardEvent} from "react";
import {BIO_MICROSCOPE_SLIDES,bioStageZoomAt,bioStageMove,bioStageBound,microscopeClamp,type BioStageView} from "./lektrusBioMicroscopeSlides";
import "./lektrusBioMicroscopeStage.css";
type XY={x:number;y:number};
const objectives=[{name:"4×",zoom:1},{name:"10×",zoom:2.5},{name:"40×",zoom:7}];
const zero:BioStageView={x:0,y:0,zoom:1};
const midpoint=(a:XY,b:XY)=>({x:(a.x+b.x)/2,y:(a.y+b.y)/2});
const distance=(a:XY,b:XY)=>Math.hypot(a.x-b.x,a.y-b.y);
export default function LektrusBioMicroscopeStage(){
 const viewport=useRef<HTMLDivElement>(null);
 const pointers=useRef(new Map<number,XY>());
 const urlRef=useRef<string|null>(null);
 const [slideId,setSlideId]=useState(BIO_MICROSCOPE_SLIDES[0].id);
 const [local,setLocal]=useState<{src:string;name:string}|null>(null);
 const [view,setView]=useState<BioStageView>(zero);
 const [focus,setFocus]=useState(0);
 const [light,setLight]=useState(73);
 const [objective,setObjective]=useState(0);
 const [broken,setBroken]=useState(false);
 const [loaded,setLoaded]=useState(false);
 const [resolution,setResolution]=useState({w:0,h:0});
 const slide=BIO_MICROSCOPE_SLIDES.find(s=>s.id===slideId)??BIO_MICROSCOPE_SLIDES[0];
 const src=local?.src??slide.image;
 const dims=()=>({width:viewport.current?.clientWidth??600,height:viewport.current?.clientHeight??400});
 useEffect(()=>{
  const node=viewport.current;if(!node)return;
  const observer=new ResizeObserver(()=>{
   const {width,height}=dims();
   setView(v=>bioStageBound(v,width,height));
  });
  observer.observe(node);
  return ()=>observer.disconnect();
 },[]);
 useEffect(()=>()=>{if(urlRef.current)URL.revokeObjectURL(urlRef.current);},[]);
 const reset=()=>{setView(zero);setFocus(0);setObjective(0);};
 const change=(id:string)=>{
  if(urlRef.current){URL.revokeObjectURL(urlRef.current);urlRef.current=null;}
  setLocal(null);setSlideId(id);setLoaded(false);setBroken(false);setResolution({w:0,h:0});reset();
 };
 const upload=(e:ChangeEvent<HTMLInputElement>)=>{
  const file=e.currentTarget.files?.[0];e.currentTarget.value="";
  if(!file||!file.type.startsWith("image/")||file.size>24*1024*1024)return;
  if(urlRef.current)URL.revokeObjectURL(urlRef.current);
  const url=URL.createObjectURL(file);urlRef.current=url;
  setLocal({src:url,name:file.name});setLoaded(false);setBroken(false);setResolution({w:0,h:0});reset();
 };
 const zoomTo=(zoom:number,at:XY={x:0,y:0})=>{
  const {width,height}=dims();
  setView(v=>bioStageZoomAt(v,zoom,at.x,at.y,width,height));
 };
 const p=(e:PointerEvent<HTMLDivElement>)=>{
  const r=e.currentTarget.getBoundingClientRect();
  return {x:e.clientX-r.left-r.width/2,y:e.clientY-r.top-r.height/2};
 };
 const down=(e:PointerEvent<HTMLDivElement>)=>{
  if(e.pointerType==="mouse"&&e.button!==0)return;
  e.currentTarget.setPointerCapture(e.pointerId);pointers.current.set(e.pointerId,p(e));
 };
 const move=(e:PointerEvent<HTMLDivElement>)=>{
  const map=pointers.current,last=map.get(e.pointerId);if(!last)return;
  const before=[...map.values()],now=p(e);map.set(e.pointerId,now);
  const {width,height}=dims();
  if(map.size>=2&&before.length>=2){
   const after=[...map.values()],a=midpoint(before[0],before[1]),b=midpoint(after[0],after[1]);
   const oldDistance=distance(before[0],before[1]);
   const factor=oldDistance>8?distance(after[0],after[1])/oldDistance:1;
   setView(v=>bioStageZoomAt(bioStageMove(v,b.x-a.x,b.y-a.y,width,height),
    v.zoom*factor,b.x,b.y,width,height));
  }else setView(v=>bioStageMove(v,now.x-last.x,now.y-last.y,width,height));
 };
 const end=(e:PointerEvent<HTMLDivElement>)=>{
  pointers.current.delete(e.pointerId);
  if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);
 };
 // React delegates wheel as a passive listener in supported browsers.
 // Attach a non-passive listener directly to the glass so scrolling does
 // not move the whole board while the teacher is magnifying the sample.
 useEffect(()=>{
  const element=viewport.current;if(!element)return;
  const handleWheel=(event:globalThis.WheelEvent)=>{
   event.preventDefault();
   const bounds=element.getBoundingClientRect();
   const width=bounds.width,height=bounds.height;
   setView(v=>bioStageZoomAt(v,v.zoom*Math.exp(-event.deltaY*.0018),
    event.clientX-bounds.left-width/2,event.clientY-bounds.top-height/2,width,height));
  };
  element.addEventListener("wheel",handleWheel,{passive:false});
  return ()=>element.removeEventListener("wheel",handleWheel);
 },[]);
 const keyboard=(e:KeyboardEvent<HTMLDivElement>)=>{
  const shifts:Record<string,XY>={ArrowLeft:{x:-28,y:0},ArrowRight:{x:28,y:0},
   ArrowUp:{x:0,y:-28},ArrowDown:{x:0,y:28}};
  if(shifts[e.key]){e.preventDefault();const {width,height}=dims();const delta=shifts[e.key];
   setView(v=>bioStageMove(v,delta.x,delta.y,width,height));}
  else if(e.key==="+"||e.key==="="){e.preventDefault();zoomTo(view.zoom*1.25);}
  else if(e.key==="-"){e.preventDefault();zoomTo(view.zoom/1.25);}
  else if(e.key==="Home"){e.preventDefault();reset();}
 };
 const movePad=(x:number,y:number)=>{const {width,height}=dims();setView(v=>bioStageMove(v,x,y,width,height));};
 const blur=microscopeClamp(Math.abs(focus)*.33,0,3.3);
 return <section className="lektrus-bio-photomicroscope" aria-label="Симуляция светового микроскопа">
  <header className="lektrus-bio-photo-head">
   <div><strong>Световой микроскоп</strong><small>Настоящие микрофотографии · движение столика · фокусировка</small></div>
   <label className="lektrus-bio-photo-upload">+ Свой препарат
    <input type="file" accept="image/*" onChange={upload} aria-label="Загрузить свою фотографию препарата"/>
   </label>
  </header>
  <div className="lektrus-bio-slide-library" role="group" aria-label="Коллекция настоящих препаратов">
   {BIO_MICROSCOPE_SLIDES.map(s=><button key={s.id} type="button"
    className={!local&&slideId===s.id?"is-selected":""} aria-pressed={!local&&slideId===s.id}
    onClick={()=>change(s.id)}>{s.name}</button>)}
   {local&&<span>Загружено: {local.name}</span>}
  </div>
  <div className="lektrus-bio-photo-layout">
   <div className="lektrus-bio-photo-main">
    <div ref={viewport} className="lektrus-bio-photo-viewport" role="region" tabIndex={0}
     aria-label="Перетаскивайте препарат, используйте колесо или жест двумя пальцами для увеличения, стрелки клавиатуры для перемещения"
     onPointerDown={down} onPointerMove={move} onPointerUp={end} onPointerCancel={end}
     onLostPointerCapture={e=>pointers.current.delete(e.pointerId)}
     onKeyDown={keyboard}>
     {!broken&&<img className="lektrus-bio-photo-image" key={src} src={src}
      draggable={false} alt={local?"Загруженная фотография микропрепарата":slide.name}
      onLoad={e=>{setLoaded(true);setResolution({w:e.currentTarget.naturalWidth,h:e.currentTarget.naturalHeight});}}
      onError={()=>{setBroken(true);setLoaded(false);}}
      style={{
       transform:"translate3d("+view.x+"px,"+view.y+"px,0) scale("+view.zoom+")",
       filter:"blur("+blur.toFixed(2)+"px) brightness("+(.42+light*.009).toFixed(2)+") contrast(1.08) saturate(.95)"
      }}/>}
     {broken&&<div className="lektrus-bio-photo-fallback" role="status">Изображение недоступно. Для Wikimedia Commons нужен интернет. Можно открыть собственную микрофотографию с устройства.</div>}
     {!broken&&!loaded&&<div className="lektrus-bio-photo-loading" role="status">Загрузка микропрепарата…</div>}
     <div className="lektrus-bio-photo-vignette" aria-hidden="true"/>
     <div className="lektrus-bio-photo-cross" aria-hidden="true"/>
     <div className="lektrus-bio-photo-hud" aria-hidden="true"><span>Цифровой масштаб ×{view.zoom.toFixed(1)}</span><span>XY {Math.round(-view.x)} / {Math.round(-view.y)}</span></div>
    </div>
    <p className="lektrus-bio-photo-tip">Тяните изображение мышью или пальцем; два пальца или колесо изменяют увеличение. Стрелки двигают предметный столик.</p>
    <div className="lektrus-bio-photo-source">
     {local?<span>Файл открыт локально и не отправляется на сервер.</span>:
      <><strong>{slide.subject}</strong><span>{slide.detail}</span>
       <a href={slide.source} target="_blank" rel="noopener noreferrer">{slide.author} · {slide.license} · Wikimedia Commons</a></>}
    </div>
   </div>
   <aside className="lektrus-bio-photo-console" aria-label="Панель микроскопа">
    <fieldset><legend>Револьвер объективов</legend>
     <div className="lektrus-bio-photo-objectives">{objectives.map((o,i)=><button key={o.name} type="button"
      className={i===objective?"is-selected":""} aria-pressed={i===objective}
      onClick={()=>{setObjective(i);zoomTo(o.zoom);}}>{o.name}</button>)}</div>
     <small>Положения объективов имитируются цифровым увеличением. Не измеренный оптический масштаб снимка.</small>
    </fieldset>
    <label htmlFor="bio-stage-zoom">Плавное увеличение <b>×{view.zoom.toFixed(1)}</b></label>
    <input id="bio-stage-zoom" type="range" min="1" max="12" step=".05" value={view.zoom}
     onChange={e=>zoomTo(Number(e.target.value))}/>
    <div className="lektrus-bio-photo-zoombtns">
     <button type="button" onClick={()=>zoomTo(view.zoom/1.25)}>−</button>
     <button type="button" onClick={reset}>Центр</button>
     <button type="button" onClick={()=>zoomTo(view.zoom*1.25)}>+</button>
    </div>
    <label htmlFor="bio-stage-focus">Тонкая фокусировка <b>{focus===0?"в фокусе":focus}</b></label>
    <input id="bio-stage-focus" aria-label="Фокусировочный винт" type="range" min="-10" max="10" step="1"
     value={focus} onChange={e=>setFocus(Number(e.target.value))}/>
    <button type="button" className="lektrus-bio-photo-autofocus" onClick={()=>setFocus(0)}>Навести резкость</button>
    <label htmlFor="bio-stage-light">Осветитель <b>{light}%</b></label>
    <input id="bio-stage-light" aria-label="Яркость осветителя" type="range" min="5" max="100"
     value={light} onChange={e=>setLight(Number(e.target.value))}/>
    <div className="lektrus-bio-photo-pad" aria-label="Кнопки перемещения столика">
     <button type="button" onClick={()=>movePad(0,-35)} aria-label="Вверх">↑</button>
     <div><button type="button" onClick={()=>movePad(-35,0)} aria-label="Влево">←</button>
      <span>XY</span>
      <button type="button" onClick={()=>movePad(35,0)} aria-label="Вправо">→</button></div>
     <button type="button" onClick={()=>movePad(0,35)} aria-label="Вниз">↓</button>
    </div>
    <small className="lektrus-bio-photo-disclaimer">Фокусировка имитирует расфокусировку готовой фотографии, но не является настоящим Z-стеком. Масштабная линейка не используется без калибровки.</small>
    {resolution.w>0&&<small>Изображение: {resolution.w} × {resolution.h} пикселей</small>}
   </aside>
  </div>
 </section>;
}
