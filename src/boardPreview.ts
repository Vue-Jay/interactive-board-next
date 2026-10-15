import { getDisplayAsset } from "./assetStore";
import { remoteRequest, isRemoteBackendEnabled } from "./backend";
import { expandDocumentInk, parseDocument, type DocumentData, type Item } from "./boardModel";
import { boardStorageKey } from "./boardStore";

// Lightweight board snapshots embedded in the existing board_documents JSONB.
// A small JSONB projection lets the gallery load previews WITHOUT entire boards.
const MAX_CHARS=100_000;
const KEY="lectris.board-preview.v1."+
  String(import.meta.env.VITE_SUPABASE_URL??"local").replace(/[^a-z0-9]/gi,"").slice(-40)+".";
const valid=(v:unknown):v is string=>typeof v==="string"&&v.length<MAX_CHARS&&
  /^data:image\/(?:webp|png|jpeg);base64,[A-Za-z0-9+/=]+$/.test(v);
export function cachedBoardPreview(id:string):string|null{
  try{const v=localStorage.getItem(KEY+id);return valid(v)?v:null}catch{return null}
}
export function cacheBoardPreview(id:string,v:string|null):void{
  try{if(valid(v))localStorage.setItem(KEY+id,v);
  else if(v===null)localStorage.removeItem(KEY+id)}catch{/* Do not block autosave. */}
}
export function previewFromRemoteDocument(doc:unknown):string|null{
  if(!doc||typeof doc!=="object")return null;
  const v=(doc as {preview?:unknown}).preview;return valid(v)?v:null;
}
export async function loadBoardPreviews(ids:string[]):Promise<Record<string,string>>{
  const output:Record<string,string>={};
  for(const id of ids){const v=cachedBoardPreview(id);if(v)output[id]=v}
  if(!isRemoteBackendEnabled())return output;
  const safe=[...new Set(ids)].filter(id=>/^[a-zA-Z0-9_-]{12,80}$/.test(id));
  for(let i=0;i<safe.length;i+=35){
    const batch=safe.slice(i,i+35);
    try{
      const rows=await remoteRequest<Array<{board_id:string;preview:string|null}>>(
        "/rest/v1/board_documents?select=board_id,preview:document->>preview&board_id=in.("+
        batch.join(",")+")");
      for(const row of rows){
        if(!batch.includes(row.board_id))continue;
        if(valid(row.preview)){output[row.board_id]=row.preview;cacheBoardPreview(row.board_id,row.preview)}
        // NULL means a migrated board without remote thumbnail. Keep local backfill.
        else if(row.preview===""){delete output[row.board_id];cacheBoardPreview(row.board_id,null)}
      }
    }catch{/* Cached results still work offline. */}
  }
  return output;
}
// For migrated boards, reuse a *small* local document without another
// heavy network download. Remote thumbnails will be created on subsequent edits.
export async function backfillCachedBoardPreviews(ids:string[]):Promise<Record<string,string>> {
  const result:Record<string,string>={};
  for(const id of ids.slice(0,6)){
    if(cachedBoardPreview(id))continue;
    try{
      const raw=localStorage.getItem(boardStorageKey(id));
      if(!raw||raw.length>2_000_000)continue;
      const parsed=parseDocument(raw);
      const image=await renderBoardPreview(parsed,id);
      if(image){cacheBoardPreview(id,image);result[id]=image}
    }catch{/* Damaged/stale local data is not authoritative. */}
  }
  return result;
}
type Bounds={left:number;top:number;right:number;bottom:number};
function itemBounds(item:Item):Bounds{
  let left=item.x,top=item.y,right=item.x+Math.max(1,item.width),
      bottom=item.y+Math.max(1,item.height);
  if((item.kind==="pen"||item.kind==="marker")&&item.points?.length){
    const stroke=item.points;
    let a=Infinity,b=Infinity,c=-Infinity,d=-Infinity;
    for(const p of stroke){a=Math.min(a,p.x);b=Math.min(b,p.y);c=Math.max(c,p.x);d=Math.max(d,p.y)}
    const pad=Math.max(2,(item.weight??3)/2);
    if(Number.isFinite(a)){left=item.x+a-pad;top=item.y+b-pad;right=item.x+c+pad;bottom=item.y+d+pad}
  }
  return {left,top,right,bottom};
}
const shape=(ctx:CanvasRenderingContext2D,w:number,h:number,r:number)=>{
  ctx.beginPath();ctx.roundRect(0,0,w,h,Math.max(0,Math.min(r,w/2,h/2)));
};
function draw(ctx:CanvasRenderingContext2D,item:Item){
  const w=Math.max(1,item.width),h=Math.max(1,item.height);
  ctx.save();ctx.translate(item.x,item.y);
  if(item.rotation&&item.kind!=="pen"&&item.kind!=="marker"){
    ctx.translate(w/2,h/2);ctx.rotate(item.rotation*Math.PI/180);ctx.translate(-w/2,-h/2)
  }
  if((item.kind==="pen"||item.kind==="marker")&&item.points?.length){
    const p=item.points,step=Math.max(1,Math.ceil(p.length/1200));
    ctx.strokeStyle=item.color??"#273950";ctx.fillStyle=ctx.strokeStyle;
    ctx.globalAlpha=item.kind==="marker"?.37:1;
    ctx.lineWidth=Math.max(.6,item.weight??3);ctx.lineCap="round";ctx.lineJoin="round";
    if(p.length===1){ctx.beginPath();ctx.arc(p[0].x,p[0].y,ctx.lineWidth/2,0,Math.PI*2);ctx.fill()}
    else{ctx.beginPath();ctx.moveTo(p[0].x,p[0].y);
      for(let j=step;j<p.length;j+=step)ctx.lineTo(p[j].x,p[j].y);
      ctx.lineTo(p[p.length-1].x,p[p.length-1].y);ctx.stroke()}
    ctx.restore();return;
  }
  if(item.kind==="connector"){
    ctx.strokeStyle=item.color??"#4269bd";ctx.lineWidth=item.weight??3;
    ctx.beginPath();ctx.moveTo(item.connectorStart?.x??0,item.connectorStart?.y??0);
    ctx.lineTo(item.connectorEnd?.x??w,item.connectorEnd?.y??h);ctx.stroke();
    ctx.restore();return;
  }
  if(item.kind==="shape"){
    ctx.beginPath();ctx.strokeStyle=item.color??"#4166c0";
    ctx.fillStyle=(item.color??"#4166c0")+"13";ctx.lineWidth=3;
    if(item.shapeType==="circle"||item.shapeType==="ellipse")ctx.ellipse(w/2,h/2,w/2,h/2,0,0,Math.PI*2);
    else if(item.shapeType==="triangle"||item.shapeType==="rightTriangle"){
      ctx.moveTo(w/2,1);ctx.lineTo(w-1,h-1);ctx.lineTo(1,h-1);ctx.closePath();
    }else if(item.shapeType==="diamond"){
      ctx.moveTo(w/2,1);ctx.lineTo(w-1,h/2);ctx.lineTo(w/2,h-1);ctx.lineTo(1,h/2);ctx.closePath();
    }else ctx.rect(0,0,w,h);
    ctx.fill();ctx.stroke();ctx.restore();return;
  }
  if(item.kind==="frame"){
    ctx.strokeStyle=item.color??"#8da2bd";ctx.lineWidth=2;ctx.setLineDash([9,6]);
    ctx.strokeRect(0,0,w,h);ctx.setLineDash([]);ctx.restore();return;
  }
  const media=item.kind==="pdf"||item.kind==="image"||item.kind==="linkmedia";
  ctx.fillStyle=item.kind==="sticky"?(item.color??"#fff2ac"):
    item.kind==="comment"?"#fff4dd":item.kind==="flashcard"?"#e6eeff":
    media?"#ebf2fc":"#ffffff";
  ctx.strokeStyle="#acbdd5";ctx.lineWidth=1.6;
  shape(ctx,w,h,item.kind==="sticky"?5:9);ctx.fill();
  if(item.kind!=="text")ctx.stroke();
  ctx.beginPath();ctx.rect(0,0,w,h);ctx.clip();
  if(media){
    ctx.fillStyle="#7b93b5";
    ctx.font="bold "+Math.min(24,h*.25)+"px sans-serif";
    ctx.textAlign="center";ctx.fillText(item.kind==="pdf"?"PDF":item.kind==="image"?"Фото":"▶",w/2,h/2);
  }else if(item.kind==="table"){
    const rows=Math.max(1,Math.min(20,item.tableRows??3));
    const cols=Math.max(1,Math.min(12,item.tableCols??3));
    ctx.strokeStyle="#bbcae0";ctx.lineWidth=1;
    for(let row=1;row<rows;row++){ctx.beginPath();ctx.moveTo(0,row*h/rows);ctx.lineTo(w,row*h/rows);ctx.stroke()}
    for(let col=1;col<cols;col++){ctx.beginPath();ctx.moveTo(col*w/cols,0);ctx.lineTo(col*w/cols,h);ctx.stroke()}
    ctx.fillStyle="#334f83";ctx.font=Math.max(9,Math.min(15,h/rows*.5))+"px sans-serif";
    for(let i=0;i<Math.min(rows*cols,32);i++){
      const text=item.tableCells?.[i];
      if(text)ctx.fillText(text.slice(0,12),i%cols*w/cols+5,Math.floor(i/cols)*h/rows+h/rows*.68,w/cols-7);
    }
  }else if(item.kind==="graph"){
    ctx.strokeStyle="#b9c9e1";ctx.lineWidth=2;ctx.beginPath();
    ctx.moveTo(w/2,0);ctx.lineTo(w/2,h);ctx.moveTo(0,h/2);ctx.lineTo(w,h/2);ctx.stroke();
    ctx.strokeStyle="#3c63cc";ctx.lineWidth=3;ctx.beginPath();
    for(let j=0;j<60;j++){
      const x=j/59*w,q=(j/59-.5)*5;
      const y=h*.5-(item.graphType==="quadratic"?(q*q-2)*h*.12:
        item.graphType==="sin"?Math.sin(q*2)*h*.3:q*h*.2);
      if(j===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);
    }ctx.stroke();
  }else{
    const text=item.kind==="checklist"?(item.checklistItems?.slice(0,5).join("\n")??item.text):
      item.kind==="quiz"?item.text+"\n"+(item.quizOptions?.slice(0,3).join("\n")??""):
      item.text??"";
    const pad=Math.max(5,Math.min(13,w*.06)),size=Math.max(10,Math.min(34,item.fontSize??18));
    ctx.fillStyle=item.kind==="text"?(item.color??"#1c3658"):"#293d58";
    ctx.font=(item.fontWeight==="bold"?"bold ":"")+size+"px sans-serif";
    let y=pad+size;
    for(const part of text.split("\n").slice(0,12)){
      let line="";
      for(const word of part.split(/\s+/)){
        const next=line?line+" "+word:word;
        if(line&&ctx.measureText(next).width>w-2*pad){
          ctx.fillText(line,pad,y,w-2*pad);y+=size*1.24;line=word;
        }else line=next;
        if(y>h)break;
      }
      if(y>h)break;
      ctx.fillText(line,pad,y,w-2*pad);y+=size*1.24;
    }
  }
  ctx.restore();
}
export async function renderBoardPreview(data:DocumentData,boardId:string):Promise<string|null>{
  if(typeof document==="undefined")return null;
  const all=expandDocumentInk(data).filter(item=>!item.hidden);
  if(all.length===0)return null;
  let left=Infinity,top=Infinity,right=-Infinity,bottom=-Infinity;
  for(const item of all){const r=itemBounds(item);left=Math.min(left,r.left);top=Math.min(top,r.top);right=Math.max(right,r.right);bottom=Math.max(bottom,r.bottom)}
  if(!Number.isFinite(left)||!Number.isFinite(right))return null;
  const canvas=document.createElement("canvas");canvas.width=480;canvas.height=270;
  const ctx=canvas.getContext("2d",{alpha:false});if(!ctx)return null;
  ctx.fillStyle="#fafcff";ctx.fillRect(0,0,480,270);
  ctx.fillStyle="#e0e8f3";
  for(let x=12;x<480;x+=18)for(let y=12;y<270;y+=18)ctx.fillRect(x,y,1,1);
  const width=Math.max(1,right-left),height=Math.max(1,bottom-top);
  const scale=Math.min(446/Math.max(width,130),238/Math.max(height,75),1.5);
  ctx.save();ctx.setTransform(scale,0,0,scale,(480-width*scale)/2-left*scale,(270-height*scale)/2-top*scale);
  const step=Math.max(1,Math.ceil(all.length/4200));
  for(let i=0;i<all.length;i+=step){try{draw(ctx,all[i])}catch{/* One item cannot break saving. */}}
  // Bounded preview of real raster attachments; PDF remains a representative card.
  const images=all.filter(item=>item.kind==="image"&&item.assetId).slice(0,3);
  for(const item of images){
    let bitmap:ImageBitmap|undefined;
    try{
      const blob=await Promise.race<Blob|null>([
        getDisplayAsset(item.assetId!,boardId),
        new Promise(resolve=>setTimeout(()=>resolve(null),450))
      ]);
      if(blob&&blob.type.startsWith("image/")&&typeof createImageBitmap==="function"){
        bitmap=await createImageBitmap(blob,{resizeWidth:Math.min(480,Math.max(2,Math.round(item.width*scale)))});
        ctx.save();ctx.translate(item.x,item.y);
        if(item.rotation){ctx.translate(item.width/2,item.height/2);ctx.rotate(item.rotation*Math.PI/180);ctx.translate(-item.width/2,-item.height/2)}
        ctx.drawImage(bitmap,0,0,item.width,item.height);ctx.restore();
      }
    }catch{/* Asset isn't cached or is offline. */}
    finally{bitmap?.close()}
  }
  ctx.restore();
  const preview=canvas.toDataURL("image/webp",.64);
  canvas.width=0;canvas.height=0;
  return valid(preview)?preview:null;
}
