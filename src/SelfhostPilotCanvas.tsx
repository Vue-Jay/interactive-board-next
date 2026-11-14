import { useEffect, useRef, useState, type PointerEvent } from "react";
import type { PilotLiveEvent, PilotLiveInkPacket, PilotPoint } from "./selfhostPilotApi";

type Stroke = {id:string;clientId:string;color:string;weight:number;points:PilotPoint[];finished:boolean;seenAt:number};
type Cursor = {clientId:string;name:string;x:number;y:number;seenAt:number};
type Props = {
  boardId:string;canDraw:boolean;incoming:PilotLiveEvent|null;
  sendCursor:(clientId:string,x:number,y:number)=>boolean;
  sendInk:(packet:PilotLiveInkPacket)=>boolean;
};
const boundedPoint=(n:number)=>Math.max(0,Math.min(1000,n));
const uid=()=>typeof crypto!=="undefined"&&typeof crypto.randomUUID==="function"
  ? crypto.randomUUID().replaceAll("-",""):Math.random().toString(36).slice(2);
const svgPath=(points:PilotPoint[])=>
  points.map((p,i)=>(i?"L":"M")+p.x.toFixed(1)+" "+p.y.toFixed(1)).join(" ");
const MAX_STROKES=60;

export default function SelfhostPilotCanvas({boardId,canDraw,incoming,sendCursor,sendInk}:Props){
  const clientId=useRef(uid());
  const active=useRef<Stroke|null>(null);
  const lastSent=useRef(0);
  const [local,setLocal]=useState<Stroke[]>([]);
  const [remote,setRemote]=useState<Stroke[]>([]);
  const [cursors,setCursors]=useState<Cursor[]>([]);
  const [warning,setWarning]=useState("");

  useEffect(()=>{
    if(!incoming)return;
    if(incoming.type==="event_error"){
      if(incoming.reason==="ink_ack_timeout")
        setWarning("Нет подтверждения штриха. Предпросмотр может отличаться у участников.");
      else if(incoming.reason!=="rate_limited")
        setWarning("Сервер отклонил сообщение: "+incoming.reason);
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
        // This pilot deliberately transmits the full <=200-point window. Ignore
        // delayed intermediary frames after a newer or completed frame.
        if(match&&(match.points.length>incoming.points.length||
          match.finished&&(!incoming.finished||match.points.length>=incoming.points.length)))return previous;
        const next=previous.filter(p=>p.id!==incoming.stroke_id||p.clientId!==incoming.client_id);
        next.push({
          id:incoming.stroke_id,clientId:incoming.client_id,color:incoming.color,
          weight:incoming.weight,points:incoming.points,finished:incoming.finished,seenAt:now,
        });
        return next.slice(-MAX_STROKES);
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
    },3000);
    return()=>clearInterval(tick);
  },[boardId]);

  const coords=(event:PointerEvent<SVGSVGElement>):PilotPoint=>{
    const bounds=event.currentTarget.getBoundingClientRect();
    return {
      x:boundedPoint(((event.clientX-bounds.left)/Math.max(1,bounds.width))*1000),
      y:boundedPoint(((event.clientY-bounds.top)/Math.max(1,bounds.height))*1000),
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
    if(!canDraw||event.button!==0)return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    const stroke:Stroke={
      id:uid(),clientId:clientId.current,color:"#275ec7",weight:3,
      points:[coords(event)],finished:false,seenAt:Date.now(),
    };
    active.current=stroke;
    updateStroke(stroke);
    publish(stroke,false);
  };
  const onMove=(event:PointerEvent<SVGSVGElement>)=>{
    const pt=coords(event);
    sendCursor(clientId.current,pt.x,pt.y);
    if(!active.current)return;
    const stroke=active.current;
    const previous=stroke.points[stroke.points.length-1];
    if(Math.hypot(previous.x-pt.x,previous.y-pt.y)<2)return;
    // Keep this isolated preview bounded: full final packets fit into one
    // relay message, so reconnect replay can recover a complete short stroke.
    if(stroke.points.length>=200)return;
    const next:Stroke={...stroke,points:[...stroke.points,pt],seenAt:Date.now()};
    active.current=next;updateStroke(next);
    if(Date.now()-lastSent.current>=55)publish(next,false);
  };
  const finish=(event:PointerEvent<SVGSVGElement>)=>{
    const stroke=active.current;if(!stroke)return;
    active.current=null;
    try{
      if(event.currentTarget.hasPointerCapture(event.pointerId))
        event.currentTarget.releasePointerCapture(event.pointerId);
    }catch{/* Pointer may have been cancelled by the browser. */}
    const final:Stroke={...stroke,finished:true,seenAt:Date.now()};
    updateStroke(final);
    publish(final,true);
  };
  return <div className="pilot-live">
    <div className="pilot-doc-header">
      <h3>Живые курсоры и штрихи</h3>
      <span className="pilot-ws">Предпросмотр · не сохраняется в доску</span>
    </div>
    <p className="pilot-muted">
      {canDraw?"Рисуйте мышью или пальцем.":"Доступен просмотр чужих штрихов и ваш курсор."}
      {" "}Откройте эту доску в двух аккаунтах, чтобы проверить передачу.
    </p>
    <svg className="pilot-live-canvas" viewBox="0 0 1000 1000"
      preserveAspectRatio="none" role="img"
      aria-label="Тестовое поле для рисования и отображения курсоров"
      onPointerDown={onDown} onPointerMove={onMove}
      onPointerUp={finish} onPointerCancel={finish}>
      <rect width="1000" height="1000" fill="transparent"/>
      {remote.map(stroke=><path key={"remote:"+stroke.clientId+":"+stroke.id}
        d={svgPath(stroke.points)} stroke={stroke.color}
        strokeWidth={stroke.weight*3} strokeLinecap="round" strokeLinejoin="round"
        fill="none" opacity={.65}/>)}
      {local.map(stroke=><path key={"local:"+stroke.id}
        d={svgPath(stroke.points)} stroke={stroke.color}
        strokeWidth={stroke.weight*3} strokeLinecap="round" strokeLinejoin="round"
        fill="none"/>)}
      {cursors.map(cursor=><g key={cursor.clientId}
        transform={"translate("+cursor.x+" "+cursor.y+")"}>
        <circle r="9" fill="#fff" stroke="#275ec7" strokeWidth="4"/>
        <rect x="16" y="-27" width="135" height="25" rx="8"
          fill="#275ec7"/>
        <text x="22" y="-10" fontSize="15" fill="#fff">
          {cursor.name.slice(0,15)}</text>
      </g>)}
    </svg>
    {warning&&<p role="status" className="pilot-muted">{warning}</p>}
    <button type="button" onClick={()=>{
      setLocal([]);setRemote([]);setCursors([]);setWarning("");
    }}>Очистить предпросмотр</button>
    <p className="pilot-muted">Полноценное сохранение штрихов, история и синхронизация объектов появятся после переноса редактора.</p>
  </div>;
}
