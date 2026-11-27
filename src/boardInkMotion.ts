import type {Item,Point,StickerInk} from "./boardModel";

export const INK_MOTION_CHECKPOINT_MS=125;
const FRAME_MS=34, MAX_CHANGES=256, MAX_POINTS=5000, MAX_CLIENTS=64;
type InkShape={kind:"pen"|"marker";id:string;x:number;y:number;width:number;height:number;color:string;weight:number;points:Point[];rotation?:number;hidden?:boolean;locked?:boolean;createdBy?:string;groupId?:string};
type StickerShape={kind:"sticky";id:string;stickerInk:StickerInk[]};
export type MotionShape=InkShape|StickerShape;
type Tail={kind:"tail";id:string;count:number;keep:number;from_x:number;from_y:number;x:number;y:number;width:number;height:number;points:Point[]};
type Change={id:string;index:number;seq:number;value:MotionShape|Tail|null};
type FullChange=Omit<Change,"value">&{value:MotionShape|null};
export type InkMotionPacket={type:"ink_motion";client_id:string;gesture:string;base_version:number;seq:number;x:number;y:number;changes:Change[]};
export type InkMotionAck={type:"ink_motion_ack";client_id:string;seq:number;version:number};
export type RemoteInkMotion=(InkMotionPacket|InkMotionAck)&{user_id:string;name:string;role:"owner"|"editor"|"viewer";sent_at:number};
type Send=(packet:InkMotionPacket|InkMotionAck)=>boolean;
const ink=(item:Item|MotionShape|undefined):item is Item&{kind:"pen"|"marker"}=>item?.kind==="pen"||item?.kind==="marker";
function shape(item:Item):MotionShape|undefined{
  if(item.kind==="sticky")return {kind:"sticky",id:item.id,stickerInk:item.stickerInk??[]};
  if(!ink(item)||!item.points?.length)return undefined;
  return {id:item.id,kind:item.kind,x:item.x,y:item.y,width:item.width,height:item.height,
    color:item.color??"#000000",weight:item.weight??3,points:item.points,
    ...(item.rotation!==undefined?{rotation:item.rotation}:{}),
    ...(item.hidden!==undefined?{hidden:item.hidden}:{}),
    ...(item.locked!==undefined?{locked:item.locked}:{}),
    ...(item.createdBy?{createdBy:item.createdBy}:{}),...(item.groupId?{groupId:item.groupId}:{})};
}
function same(a:MotionShape|undefined,b:MotionShape|undefined):boolean{
  if(a===b)return true;
  if(!a||!b||a.id!==b.id||a.kind!==b.kind)return false;
  if(a.kind==="sticky"&&b.kind==="sticky"){
    if(a.stickerInk===b.stickerInk)return true;
    return a.stickerInk.length===b.stickerInk.length&&a.stickerInk.every((s,i)=>{
      const t=b.stickerInk[i];return s.id===t.id&&s.kind===t.kind&&s.color===t.color&&s.weight===t.weight&&samePoints(s.points,t.points);
    });
  }
  if(a.kind==="sticky"||b.kind==="sticky")return false;
  return a.x===b.x&&a.y===b.y&&a.width===b.width&&a.height===b.height&&a.color===b.color&&a.weight===b.weight&&
    (a.rotation??0)===(b.rotation??0)&&!!a.hidden===!!b.hidden&&!!a.locked===!!b.locked&&a.groupId===b.groupId&&samePoints(a.points,b.points);
}
function samePoints(a:Point[],b:Point[]):boolean{
  return a===b||a.length===b.length&&a.every((p,i)=>p.x===b[i].x&&p.y===b[i].y);
}
const round=(n:number)=>Math.round(n*100)/100;
function compact(old:MotionShape|undefined,next:MotionShape):MotionShape|Tail{
  if(!old||old.kind==="sticky"||next.kind==="sticky"||old.kind!==next.kind||
      old.color!==next.color||old.weight!==next.weight||old.rotation!==next.rotation||old.hidden!==next.hidden||
      old.locked!==next.locked||old.groupId!==next.groupId||old.createdBy!==next.createdBy||old.points.length<64)return next;
  let keep=0;
  while(keep<Math.min(old.points.length,next.points.length)){
    const p=old.points[keep],q=next.points[keep];
    if(round(p.x+old.x-next.x)!==q.x||round(p.y+old.y-next.y)!==q.y)break;
    keep++;
  }
  if(keep<48)return next;
  return {kind:"tail",id:next.id,count:old.points.length,keep,from_x:old.x,from_y:old.y,
    x:next.x,y:next.y,width:next.width,height:next.height,points:next.points.slice(keep)};
}
function expandTail(old:MotionShape|undefined,tail:Tail):InkShape|undefined{
  if(!old||old.kind==="sticky"||old.points.length!==tail.count||old.x!==tail.from_x||old.y!==tail.from_y||
     !Number.isSafeInteger(tail.keep)||tail.keep<1||tail.keep>tail.count||tail.keep+tail.points.length>MAX_POINTS)return;
  return {...old,x:tail.x,y:tail.y,width:tail.width,height:tail.height,
    points:old.points.slice(0,tail.keep).map(p=>({x:round(p.x+old.x-tail.x),y:round(p.y+old.y-tail.y)})).concat(tail.points)};
}
export function inkMotionChanges(before:Item[],after:Item[]):Omit<FullChange,"seq">[]{
  const old=new Map(before.map(item=>[item.id,item])),next=new Set(after.map(item=>item.id));
  const changes:Omit<FullChange,"seq">[]=[];
  before.forEach((item,index)=>{if(ink(item)&&!next.has(item.id))changes.push({id:item.id,index,value:null})});
  after.forEach((item,index)=>{
    const previous=old.get(item.id);
    if(item===previous)return;
    const value=shape(item);
    if(!value||value.kind==="sticky"&&(!previous||previous.kind!=="sticky"||previous.stickerInk===item.stickerInk))return;
    if(!same(previous?shape(previous):undefined,value))changes.push({id:item.id,index,value});
  });
  return changes;
}
/** Coalesce actual permanent object changes, not pointer previews. Each saved
 * array carries the exact motion watermark it contains. No extra socket. */
export function createInkMotionSender(clientId:string,send:Send,enabled:()=>boolean,version:()=>number){
  let seq=0,lastSentAt=0,lastAck=0,lastGesture="",position:Point={x:0,y:0};
  let timer:ReturnType<typeof setTimeout>|undefined;
  let ackTimer:ReturnType<typeof setTimeout>|undefined;
  let pendingAck:InkMotionAck|undefined,ackFailures=0;
  const flushAck=()=>{
    clearTimeout(ackTimer);ackTimer=undefined;
    if(!pendingAck||!enabled()){pendingAck=undefined;ackFailures=0;return;}
    if(send(pendingAck)){
      lastAck=Math.max(lastAck,pendingAck.seq);
      pendingAck=undefined;ackFailures=0;return;
    }
    // A full socket buffer may reject the final watermark even though the
    // durable revision succeeded. Retry without needing another user edit.
    if(++ackFailures<=6)ackTimer=setTimeout(flushAck,Math.min(100*2**(ackFailures-1),1000));
    else{pendingAck=undefined;ackFailures=0;}
  };
  const queue=new Map<string,FullChange>(),wire=new Map<string,MotionShape>();
  const watermarks=new WeakMap<Item[],number>();
  let sends=0;
  const flush=()=>{
    clearTimeout(timer);timer=undefined;
    if(!queue.size||!enabled()){queue.clear();wire.clear();return;}
    const all=[...queue.values()].sort((a,b)=>a.seq-b.seq||a.index-b.index);
    const changes:Change[]=all.map(change=>({...change,value:change.value&&
      (sends%12!==0?compact(wire.get(change.id),change.value):change.value)}));
    const packet:InkMotionPacket={type:"ink_motion",client_id:clientId,gesture:lastGesture,base_version:version(),
      seq,x:position.x,y:position.y,changes};
    // Very large cuts/legacy paths use the existing durable checkpoint path.
    if(changes.length<=MAX_CHANGES&&JSON.stringify(packet).length<105000&&send(packet)){
      for(const change of all){
        if(change.value){wire.delete(change.id);wire.set(change.id,change.value);}else wire.delete(change.id);
      }
      while(wire.size>64)wire.delete(wire.keys().next().value!);
      sends++;
    }else wire.clear();
    queue.clear();lastSentAt=Date.now();
  };
  const schedule=()=>{
    if(timer!==undefined)return;
    const wait=FRAME_MS-(Date.now()-lastSentAt);
    if(wait<=0)flush();else timer=setTimeout(flush,wait);
  };
  return {
    enabled,
    publish(before:Item[],after:Item[],gesture:string,cursor:Point){
      if(!enabled())return false;
      if(queue.size&&lastGesture!==gesture)flush();
      const changes=inkMotionChanges(before,after);
      if(!changes.length){watermarks.set(after,seq);return false;}
      seq++;lastGesture=gesture;position=cursor;
      for(const change of changes){queue.delete(change.id);queue.set(change.id,{...change,seq});}
      if(queue.size>MAX_CHANGES){queue.clear();wire.clear();return false;}
      watermarks.set(after,seq);schedule();return true;
    },
    mark(items:Item[]){watermarks.set(items,seq);},
    ack(items:Item[],savedVersion:number){
      const watermark=watermarks.get(items)??0;
      if(watermark<=lastAck||!enabled())return;
      if(pendingAck&&watermark<pendingAck.seq)return;
      pendingAck={type:"ink_motion_ack",client_id:clientId,seq:watermark,version:savedVersion};
      if(ackTimer===undefined)flushAck();
    },
    reset(){clearTimeout(timer);clearTimeout(ackTimer);timer=undefined;ackTimer=undefined;
      pendingAck=undefined;ackFailures=0;queue.clear();wire.clear();lastSentAt=0;},
  };
}
type Pending=FullChange&{gesture:string;base:number;order:number};
type Peer={user:string;last:number;ack:number;acks:{seq:number;version:number}[];pending:Map<string,Pending>;wire:Map<string,MotionShape>;blocked:Set<string>};
/** A single render projection of ordinary Item IDs. The local document, undo,
 * export and persistence NEVER read this unacknowledged network journal. */
export function createInkMotionLedger(){
  let version=0,serial=0;
  let authoritative=new Map<string,Item>();
  const tombstones=new Map<string,number>(),peers=new Map<string,Peer>();
  const bounded=(map:Map<string,unknown>,limit:number)=>{while(map.size>limit)map.delete(map.keys().next().value!)};
  const applyAcks=(peer:Peer)=>{
    let changed=false;
    peer.acks=peer.acks.filter(ack=>{
      if(ack.version>version)return true;
      peer.ack=Math.max(peer.ack,ack.seq);return false;
    });
    for(const [id,change] of peer.pending)if(change.seq<=peer.ack){peer.pending.delete(id);changed=true;}
    return changed;
  };
  const block=(peer:Peer,gesture:string)=>{
    peer.blocked.add(gesture);
    while(peer.blocked.size>256)peer.blocked.delete(peer.blocked.values().next().value!);
    for(const [id,change] of peer.pending)if(change.gesture===gesture){peer.pending.delete(id);peer.wire.delete(id);}
  };
  return {
    reconcile(items:Item[],nextVersion:number,author?:string|null){
      if(nextVersion<version)return false;
      const next=new Map(items.map(item=>[item.id,item]));
      let changed=false;
      if(nextVersion>version){
        for(const [id,old] of authoritative)if(ink(old)&&!next.has(id)){
          tombstones.delete(id);tombstones.set(id,nextVersion);
        }
        bounded(tombstones,4096);
        for(const peer of peers.values()){
          for(const [id,entry] of [...peer.pending]){
            if(entry.base>=nextVersion)continue;
            const old=authoritative.get(id),now=next.get(id);
            const oldShape=old?shape(old):undefined,newShape=now?shape(now):undefined;
            if(entry.value&&same(entry.value,newShape)||!entry.value&&old&&!now){
              peer.pending.delete(id);changed=true;continue;
            }
            // A competing authoritative deletion/edit wins over every
            // queued sample of the conflicting gesture, including cut fragments.
            if(author!==peer.user&&old&&!same(oldShape,newShape)){
              block(peer,entry.gesture);changed=true;
            }
          }
        }
      }
      authoritative=next;version=nextVersion;
      for(const peer of peers.values())if(applyAcks(peer))changed=true;
      return changed;
    },
    receive(event:RemoteInkMotion){
      const key=event.user_id+":"+event.client_id;
      let peer=peers.get(key);
      if(!peer){
        if(peers.size>=MAX_CLIENTS)return false;
        peer={user:event.user_id,last:0,ack:0,acks:[],pending:new Map(),wire:new Map(),blocked:new Set()};peers.set(key,peer);
      }
      if(event.type==="ink_motion_ack"){
        if(event.seq<=peer.ack)return false;
        peer.acks.push({seq:event.seq,version:event.version});if(peer.acks.length>32)peer.acks.shift();
        return applyAcks(peer);
      }
      if(event.seq<=peer.last||peer.blocked.has(event.gesture))return false;
      peer.last=event.seq;
      let changed=false;
      for(const change of event.changes){
        let value=change.value;
        if(value?.kind==="tail"){
          const expanded=expandTail(peer.wire.get(change.id),value);
          if(!expanded)continue;
          value=expanded;
        }
        if(value){
          peer.wire.delete(change.id);peer.wire.set(change.id,value);
          if((tombstones.get(change.id)??0)>event.base_version||
             event.gesture===change.id&&tombstones.has(change.id)&&!authoritative.has(change.id)){
            block(peer,event.gesture);return true;
          }
          const saved=authoritative.get(change.id);
          if(value.kind==="sticky"&&(!saved||saved.kind!=="sticky"||saved.locked))continue;
          if(value.kind!=="sticky"&&saved&&!ink(saved))continue;
          if(!saved&&value.kind!=="sticky"&&value.createdBy!==event.user_id)continue;
        }else peer.wire.delete(change.id);
        if(change.seq<=peer.ack)continue;
        const saved=authoritative.get(change.id);
        if(value&&saved&&same(value,shape(saved))){
          if(peer.pending.delete(change.id))changed=true;
          continue;
        }
        peer.pending.set(change.id,{...change,value,gesture:event.gesture,base:event.base_version,order:++serial});
        changed=true;
      }
      bounded(peer.wire,64);
      if(peer.pending.size>2048){peer.pending.clear();return true;}
      return changed;
    },
    project(items:Item[]):Item[]{
      const entries=[...peers.values()].flatMap(peer=>[...peer.pending.values()]);
      if(!entries.length)return items;
      entries.sort((a,b)=>a.order-b.order);
      const removed=new Set(entries.filter(e=>!e.value).map(e=>e.id));
      const updates=new Map(entries.map(e=>[e.id,e]));
      const seen=new Set<string>();const result:Item[]=[];
      for(const item of items){
        seen.add(item.id);const update=updates.get(item.id),value=update?.value;
        if(ink(item)&&removed.has(item.id))continue;
        if(value?.kind==="sticky"&&item.kind==="sticky"&&!item.locked){result.push({...item,stickerInk:value.stickerInk});continue;}
        if(value&&value.kind!=="sticky"&&ink(item)){result.push({...item,...value});continue;}
        result.push(item);
      }
      const added=[...updates.values()].filter(entry=>!seen.has(entry.id)&&entry.value&&entry.value.kind!=="sticky"&&!removed.has(entry.id));
      added.sort((a,b)=>a.index-b.index||a.order-b.order);
      for(const entry of added){const value=entry.value as InkShape;result.splice(Math.min(entry.index,result.length),0,{text:"",...value});}
      return result;
    },
    hasUser(user:string){return [...peers.values()].some(peer=>peer.user===user&&peer.pending.size>0);},
    leave(user:string){let changed=false;for(const [key,peer] of peers)if(peer.user===user){changed||=peer.pending.size>0;peers.delete(key);}return changed;},
    reset(){const changed=[...peers.values()].some(peer=>peer.pending.size>0);peers.clear();return changed;},
  };
}
