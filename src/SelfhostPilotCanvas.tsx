import { useEffect, useRef, useState, type PointerEvent } from "react";
import type {
  PilotLiveEvent, PilotLiveInkPacket, PilotPoint, PilotStoredStroke,
  PilotRectObject, PilotObjectPreview,
} from "./selfhostPilotApi";

type Stroke = {id:string;clientId:string;color:string;weight:number;points:PilotPoint[];finished:boolean;seenAt:number};
type Cursor = {clientId:string;name:string;x:number;y:number;seenAt:number};
type RemoteObject = {objectId:string;clientId:string;gestureId:string;name:string;revision:number;seq:number;x:number;y:number;seenAt:number};
type LocalObjectPreview = {id:string;x:number;y:number;revision:number};
type ActiveObjectDrag = {
  objectId:string;expectedRevision:number;gestureId:string;seq:number;
  startX:number;startY:number;baseX:number;baseY:number;
  x:number;y:number;width:number;height:number;moved:boolean;
};
type Props = {
  boardId:string;canDraw:boolean;incoming:PilotLiveEvent|null;
  sendCursor:(clientId:string,x:number,y:number)=>boolean;
  sendInk:(packet:PilotLiveInkPacket)=>boolean;
  sendObjectPreview:(preview:PilotObjectPreview)=>boolean;
  savedStrokes:unknown[];savedObjects:unknown[];
  undoneStrokeIds:string[];
  onPersist:(packet:PilotLiveInkPacket,operationId:string)=>Promise<void>;
  onUndo:()=>Promise<void>;
  onCreateObject:()=>Promise<void>;
  onMoveObject:(objectId:string,operationId:string,expectedRevision:number,x:number,y:number)=>Promise<void>;
};
const boundedPoint=(n:number)=>Math.max(0,Math.min(1000,n));
const boundedObjectPoint=(n:number,size:number)=>Math.max(0,Math.min(1000-size,n));
const uid=()=>typeof crypto!=="undefined"&&typeof crypto.randomUUID==="function"
  ? crypto.randomUUID().replaceAll("-",""):Math.random().toString(36).slice(2);
const svgPath=(points:PilotPoint[])=>
  points.map((p,i)=>(i?"L":"M")+p.x.toFixed(1)+" "+p.y.toFixed(1)).join(" ");
const MAX_STROKES=60;
const MAX_OBJECTS=80;

const isStoredStroke=(input:unknown):input is PilotStoredStroke=>{
  if(!input||typeof input!=="object")return false;
  const s=input as Partial<PilotStoredStroke>;
  return typeof s.id==="string"&&typeof s.color==="string"&&
    /^#[0-9a-fA-F]{6}$/.test(s.color)&&Number.isFinite(s.weight)&&
    typeof s.created_by==="string"&&Array.isArray(s.points)&&s.points.length<=200&&
    s.points.every(p=>Number.isFinite(p?.x)&&Number.isFinite(p?.y));
};
const isPilotRect=(input:unknown):input is PilotRectObject=>{
  if(!input||typeof input!=="object")return false;
  const item=input as Partial<PilotRectObject>;
  return typeof item.id==="string"&&/^[A-Za-z0-9_-]{1,128}$/.test(item.id)&&
    item.kind==="pilot_rect"&&
    [item.x,item.y,item.width,item.height].every(Number.isFinite)&&
    Number(item.x)>=0&&Number(item.y)>=0&&Number(item.width)>=30&&
    Number(item.height)>=30&&Number(item.x)+Number(item.width)<=1000&&
    Number(item.y)+Number(item.height)<=1000&&
    typeof item.color==="string"&&/^#[0-9a-fA-F]{6}$/.test(item.color)&&
    Number.isSafeInteger(item.revision)&&Number(item.revision)>=1&&
    typeof item.created_by==="string";
};

export default function SelfhostPilotCanvas({
  boardId,canDraw,incoming,sendCursor,sendInk,sendObjectPreview,
  savedStrokes,savedObjects,undoneStrokeIds,onPersist,onUndo,
  onCreateObject,onMoveObject,
}:Props){
  const clientId=useRef(uid());
  const active=useRef<Stroke|null>(null);
  const activeObject=useRef<ActiveObjectDrag|null>(null);
  const lastSent=useRef(0);
  const [local,setLocal]=useState<Stroke[]>([]);
  const [remote,setRemote]=useState<Stroke[]>([]);
  const [cursors,setCursors]=useState<Cursor[]>([]);
  const [remoteObjects,setRemoteObjects]=useState<RemoteObject[]>([]);
  const [localObjectPreview,setLocalObjectPreview]=useState<LocalObjectPreview|null>(null);
  const [warning,setWarning]=useState("");
  const [objectWarning,setObjectWarning]=useState("");
  const [saving,setSaving]=useState(false);
  const [undoing,setUndoing]=useState(false);
  const [objectBusy,setObjectBusy]=useState(false);
  const [failed,setFailed]=useState<{packet:PilotLiveInkPacket;operationId:string}|null>(null);
  const persisted=savedStrokes.filter(isStoredStroke).slice(-MAX_STROKES);
  const persistedIds=new Set(persisted.map(s=>s.id));
  const objects=savedObjects.filter(isPilotRect).slice(-MAX_OBJECTS);
  const undoneIds=new Set(undoneStrokeIds);
  const saveInk=async(packet:PilotLiveInkPacket,operationId:string)=>{
    setSaving(true);
    try{
      await onPersist(packet,operationId);
      setFailed(current=>current?.operationId===operationId?null:current);
      setWarning("");
    }catch(error){
      setFailed({packet,operationId});
      setWarning("Штрих не сохранён в PostgreSQL: "+
        (error instanceof Error?error.message:"ошибка сети")+
        ". Повторите сохранение тем же запросом.");
    }finally{setSaving(false)}
  };

  useEffect(()=>{
    if(!incoming)return;
    if(incoming.type==="event_error"){
      if(incoming.reason==="ink_ack_timeout")
        setWarning("Нет подтверждения штриха. Предпросмотр может отличаться у участников.");
      else if(incoming.reason!=="rate_limited")
        setObjectWarning("Сервер отклонил сообщение: "+incoming.reason);
      return;
    }
    if(incoming.client_id===clientId.current)return;
    const now=Date.now();
    if(incoming.type==="cursor"){
      setCursors(previous=>{
        const next=previous.filter(p=>p.clientId!==incoming.client_id);
        next.push({clientId:incoming.client_id,name:incoming.name,x:incoming.x,y:incoming.y,seenAt:now});
        return next.slice(-30);
      });
      return;
    }
    if(incoming.type==="live_ink"){
      if(!incoming.points.length)return;
      setRemote(previous=>{
        const match=previous.find(p=>p.id===incoming.stroke_id&&p.clientId===incoming.client_id);
        if(match&&(match.points.length>incoming.points.length||
          match.finished&&(!incoming.finished||match.points.length>=incoming.points.length)))return previous;
        const next=previous.filter(p=>p.id!==incoming.stroke_id||p.clientId!==incoming.client_id);
        next.push({
          id:incoming.stroke_id,clientId:incoming.client_id,color:incoming.color,
          weight:incoming.weight,points:incoming.points,finished:incoming.finished,seenAt:now,
        });
        return next.slice(-MAX_STROKES);
      });
      return;
    }
    if(incoming.type==="object_preview"){
      setRemoteObjects(previous=>{
        const current=previous.find(p=>p.objectId===incoming.object_id&&p.clientId===incoming.client_id);
        if(current&&current.gestureId===incoming.gesture_id&&current.seq>=incoming.seq)return previous;
        const next=previous.filter(p=>p.objectId!==incoming.object_id||p.clientId!==incoming.client_id);
        next.push({
          objectId:incoming.object_id,clientId:incoming.client_id,
          gestureId:incoming.gesture_id,name:incoming.name,
          revision:incoming.object_revision,seq:incoming.seq,
          x:incoming.x,y:incoming.y,seenAt:now,
        });
        return next.slice(-MAX_OBJECTS);
      });
    }
  },[incoming]);

  useEffect(()=>{
    const tick=setInterval(()=>{
      const now=Date.now();
      setCursors(value=>value.some(x=>now-x.seenAt>8000)?
        value.filter(x=>now-x.seenAt<=8000):value);
      setRemote(value=>value.some(x=>now-x.seenAt>30000)?
        value.filter(x=>now-x.seenAt<=30000):value);
      setLocal(value=>value.some(x=>now-x.seenAt>30000)?
        value.filter(x=>now-x.seenAt<=30000):value);
      setRemoteObjects(value=>value.some(x=>now-x.seenAt>8000)?
        value.filter(x=>now-x.seenAt<=8000):value);
    },3000);
    return()=>clearInterval(tick);
  },[boardId]);

  const coords=(clientX:number,clientY:number,svg:SVGSVGElement):PilotPoint=>{
    const bounds=svg.getBoundingClientRect();
    return {
      x:boundedPoint(((clientX-bounds.left)/Math.max(1,bounds.width))*1000),
      y:boundedPoint(((clientY-bounds.top)/Math.max(1,bounds.height))*1000),
    };
  };
  const publish=(stroke:Stroke,finished:boolean)=>{
    const packet:PilotLiveInkPacket={
      type:"live_ink",client_id:clientId.current,stroke_id:stroke.id,
      kind:"pen",color:stroke.color,weight:stroke.weight,
      offset:0,points:stroke.points,finished,
    };
    if(!sendInk(packet)&&finished){
      setWarning("Нет соединения. Этот штрих остался только в вашем предпросмотре.");
    }
    lastSent.current=Date.now();
  };
  const updateStroke=(stroke:Stroke)=>{
    setLocal(previous=>{
      const next=previous.filter(p=>p.id!==stroke.id);
      next.push(stroke);
      return next.slice(-MAX_STROKES);
    });
  };
  const onDown=(event:PointerEvent<SVGSVGElement>)=>{
    if(!canDraw||event.button!==0||activeObject.current)return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    const stroke:Stroke={
      id:uid(),clientId:clientId.current,color:"#275ec7",weight:3,
      points:[coords(event.clientX,event.clientY,event.currentTarget)],
      finished:false,seenAt:Date.now(),
    };
    active.current=stroke;
    updateStroke(stroke);
    publish(stroke,false);
  };
  const beginObjectDrag=(event:PointerEvent<SVGRectElement>,object:PilotRectObject)=>{
    if(!canDraw||event.button!==0||active.current)return;
    const svg=event.currentTarget.ownerSVGElement;
    if(!svg)return;
    event.preventDefault();event.stopPropagation();
    svg.setPointerCapture(event.pointerId);
    const point=coords(event.clientX,event.clientY,svg);
    activeObject.current={
      objectId:object.id,expectedRevision:object.revision,gestureId:uid(),seq:0,
      startX:point.x,startY:point.y,baseX:object.x,baseY:object.y,
      x:object.x,y:object.y,width:object.width,height:object.height,moved:false,
    };
    setLocalObjectPreview({id:object.id,x:object.x,y:object.y,revision:object.revision});
    setObjectWarning("");
  };
  const onMove=(event:PointerEvent<SVGSVGElement>)=>{
    const pt=coords(event.clientX,event.clientY,event.currentTarget);
    sendCursor(clientId.current,pt.x,pt.y);
    const drag=activeObject.current;
    if(drag){
      const x=boundedObjectPoint(drag.baseX+pt.x-drag.startX,drag.width);
      const y=boundedObjectPoint(drag.baseY+pt.y-drag.startY,drag.height);
      if(Math.abs(x-drag.x)<0.5&&Math.abs(y-drag.y)<0.5)return;
      const next={...drag,x,y,seq:drag.seq+1,moved:true};
      activeObject.current=next;
      setLocalObjectPreview({id:drag.objectId,x,y,revision:drag.expectedRevision});
      sendObjectPreview({
        type:"object_preview",client_id:clientId.current,
        object_id:drag.objectId,gesture_id:drag.gestureId,
        seq:next.seq,object_revision:drag.expectedRevision,x,y,
      });
      return;
    }
    if(!active.current)return;
    const stroke=active.current;
    const previous=stroke.points[stroke.points.length-1];
    if(Math.hypot(previous.x-pt.x,previous.y-pt.y)<2)return;
    if(stroke.points.length>=200)return;
    const next:Stroke={...stroke,points:[...stroke.points,pt],seenAt:Date.now()};
    active.current=next;updateStroke(next);
    if(Date.now()-lastSent.current>=55)publish(next,false);
  };
  const finish=(event:PointerEvent<SVGSVGElement>)=>{
    const drag=activeObject.current;
    if(drag){
      activeObject.current=null;
      try{
        if(event.currentTarget.hasPointerCapture(event.pointerId))
          event.currentTarget.releasePointerCapture(event.pointerId);
      }catch{/* Pointer capture may already have been released. */}
      if(!drag.moved){setLocalObjectPreview(null);return}
      setObjectBusy(true);setObjectWarning("Сохраняем положение объекта…");
      void onMoveObject(drag.objectId,crypto.randomUUID(),drag.expectedRevision,drag.x,drag.y)
        .then(()=>setObjectWarning("Положение объекта сохранено."))
        .catch(error=>setObjectWarning("Перемещение не сохранено: "+
          (error instanceof Error?error.message:"ошибка сети")+
          ". Положение восстановлено по серверной версии."))
        .finally(()=>{setObjectBusy(false);setLocalObjectPreview(null)});
      return;
    }
    const stroke=active.current;if(!stroke)return;
    active.current=null;
    try{
      if(event.currentTarget.hasPointerCapture(event.pointerId))
        event.currentTarget.releasePointerCapture(event.pointerId);
    }catch{/* Pointer may have been cancelled by the browser. */}
    const final:Stroke={...stroke,finished:true,seenAt:Date.now()};
    updateStroke(final);
    publish(final,true);
    const operationId=crypto.randomUUID();
    void saveInk({
      type:"live_ink",client_id:clientId.current,stroke_id:final.id,
      kind:"pen",color:final.color,weight:final.weight,offset:0,
      points:final.points,finished:true,
    },operationId);
  };
  const addObject=async()=>{
    setObjectBusy(true);setObjectWarning("");
    try{await onCreateObject();setObjectWarning("Прямоугольник добавлен и сохранён в PostgreSQL.")}
    catch(error){setObjectWarning("Не удалось добавить объект: "+
      (error instanceof Error?error.message:"ошибка сети"))}
    finally{setObjectBusy(false)}
  };

  return <div className="pilot-live">
    <div className="pilot-doc-header">
      <h3>Совместное рисование и объекты</h3>
      <span className="pilot-ws">Сохранение в PostgreSQL · живые предпросмотры по WebSocket</span>
    </div>
    <p className="pilot-muted">
      {canDraw?"Рисуйте мышью или пальцем, добавляйте прямоугольники и перетаскивайте их.":"Доступен просмотр штрихов, объектов и вашего курсора."}
      {" "}Откройте эту доску в двух аккаунтах, чтобы проверить передачу.
    </p>
    {canDraw&&<div className="pilot-object-actions">
      <button type="button" disabled={objectBusy}
        onClick={()=>void addObject()}>Добавить прямоугольник</button>
    </div>}
    <svg className="pilot-live-canvas" viewBox="0 0 1000 1000"
      preserveAspectRatio="none" role="img"
      aria-label="Тестовое поле для рисования и перемещения объектов"
      onPointerDown={onDown} onPointerMove={onMove}
      onPointerUp={finish} onPointerCancel={finish}>
      <rect width="1000" height="1000" fill="transparent"/>
      {persisted.map(stroke=><path key={"saved:"+stroke.id}
        d={svgPath(stroke.points)} stroke={stroke.color}
        strokeWidth={stroke.weight*3} strokeLinecap="round" strokeLinejoin="round"
        fill="none" pointerEvents="none"/>)}
      {remote.filter(s=>!persistedIds.has(s.id)&&!undoneIds.has(s.id)).map(stroke=><path key={"remote:"+stroke.clientId+":"+stroke.id}
        d={svgPath(stroke.points)} stroke={stroke.color}
        strokeWidth={stroke.weight*3} strokeLinecap="round" strokeLinejoin="round"
        fill="none" opacity={.65} pointerEvents="none"/>)}
      {local.filter(s=>!persistedIds.has(s.id)&&!undoneIds.has(s.id)).map(stroke=><path key={"local:"+stroke.id}
        d={svgPath(stroke.points)} stroke={stroke.color}
        strokeWidth={stroke.weight*3} strokeLinecap="round" strokeLinejoin="round"
        fill="none" pointerEvents="none"/>)}
      {objects.map(object=>{
        const localPreview=localObjectPreview?.id===object.id&&localObjectPreview.revision===object.revision?localObjectPreview:null;
        const remotePreview=remoteObjects.find(p=>p.objectId===object.id&&p.revision===object.revision);
        const x=localPreview?.x??remotePreview?.x??object.x;
        const y=localPreview?.y??remotePreview?.y??object.y;
        return <g key={"object:"+object.id}>
          <rect x={x} y={y} width={object.width} height={object.height}
            rx="12" fill={object.color} stroke="#275ec7" strokeWidth="3"
            style={{cursor:canDraw?"grab":"default",touchAction:"none"}}
            onPointerDown={event=>beginObjectDrag(event,object)}/>
          <text x={x+12} y={y+25} fill="#234979" fontSize="18"
            fontWeight="650" pointerEvents="none">Тестовый объект</text>
          {remotePreview&&!localPreview&&<text x={x+12} y={y+48}
            fill="#234979" fontSize="13" pointerEvents="none">
            Перемещает: {remotePreview.name.slice(0,24)}
          </text>}
        </g>;
      })}
      {cursors.map(cursor=><g key={cursor.clientId}
        transform={"translate("+cursor.x+" "+cursor.y+")"} pointerEvents="none">
        <circle r="9" fill="#fff" stroke="#275ec7" strokeWidth="4"/>
        <rect x="16" y="-27" width="135" height="25" rx="8" fill="#275ec7"/>
        <text x="22" y="-10" fontSize="15" fill="#fff">
          {cursor.name.slice(0,15)}</text>
      </g>)}
    </svg>
    {warning&&<p role="status" className="pilot-muted">{warning}</p>}
    {objectWarning&&<p role="status" className="pilot-muted">{objectWarning}</p>}
    {saving&&<p role="status" className="pilot-muted">Сохраняем штрих…</p>}
    {objectBusy&&<p role="status" className="pilot-muted">Обрабатываем объект…</p>}
    {failed&&<button type="button" disabled={saving}
      onClick={()=>void saveInk(failed.packet,failed.operationId)}>
      Повторить сохранение штриха
    </button>}
    {canDraw&&<button type="button" disabled={saving||undoing||objectBusy}
      onClick={()=>void (async()=>{
        setUndoing(true);
        try{await onUndo();setWarning("")}
        catch(error){setWarning(error instanceof Error?error.message:"Не удалось отменить штрих.")}
        finally{setUndoing(false)}
      })()}>
      Отменить мой последний штрих
    </button>}
    <button type="button" onClick={()=>{
      setLocal([]);setRemote([]);setCursors([]);setRemoteObjects([]);
      setWarning("");setObjectWarning("");
    }}>Очистить предпросмотр</button>
    <p className="pilot-muted">Штрихи и прямоугольники сохраняются на сервере. Курсоры и незавершённые перемещения временные; это всё ещё изолированный пилот, а не основной редактор Lektrus.</p>
  </div>;
}
