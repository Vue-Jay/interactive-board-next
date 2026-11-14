"""Private teacher material library API."""
from __future__ import annotations
import asyncio, os, re, tempfile, urllib.parse
from pathlib import Path
from uuid import UUID, uuid4
import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import FileResponse, Response
from pydantic import BaseModel, Field

MAX_BYTES=50*1024*1024
SAFE_NAME=re.compile(r"^[0-9a-f]{32}$")
def root()->Path:
    value=os.environ.get("LEKTRUS_ASSETS_DIR","").strip()
    if not value or not Path(value).is_absolute(): raise RuntimeError("LEKTRUS_ASSETS_DIR must be an absolute private path")
    path=Path(value); path.mkdir(parents=True,exist_ok=True,mode=0o700); return path.resolve()
def material_path(name:UUID)->Path: return root()/"materials"/name.hex
def view(row):
    return {"id":str(row["id"]),"owner_id":str(row["owner_id"]),"folder":row["folder"],"title":row["title"],"file_name":row["file_name"],"mime":row["mime"],"size_bytes":row["size_bytes"],"storage_path":str(row["id"]),"favorite":row["favorite"],"use_count":row["use_count"],"last_used_at":row["last_used_at"].isoformat() if row["last_used_at"] else None,"created_at":row["created_at"].isoformat()}
class Meta(BaseModel): title:str=Field(min_length=1,max_length=240); folder:str=Field(default="",max_length=160)
class Favorite(BaseModel): favorite:bool
def make_material_router(current_user):
    router=APIRouter()
    @router.get("/api/v1/materials")
    async def listing(request:Request,user=Depends(current_user)):
        async with request.app.state.pool.acquire() as c:
            rows=await c.fetch("select * from learning_materials where owner_id=$1 order by favorite desc,last_used_at desc nulls last,created_at desc limit 2000",user["id"])
        return [view(x) for x in rows]
    @router.post("/api/v1/materials/{ident}",status_code=201)
    async def upload(ident:UUID,request:Request,user=Depends(current_user)):
        if user["account_role"]!="teacher": raise HTTPException(403,"Библиотека доступна преподавателям.")
        name=urllib.parse.unquote(request.headers.get("x-file-name","")[:720])[:240] or "file"
        title=urllib.parse.unquote(request.headers.get("x-material-title",name)[:720])[:240]
        folder=urllib.parse.unquote(request.headers.get("x-material-folder","")[:480])[:160]
        mime=request.headers.get("content-type","application/octet-stream").split(";")[0][:120]
        body=await request.body()
        if not body or len(body)>MAX_BYTES: raise HTTPException(413,"Файл должен быть не больше 50 МБ.")
        storage=uuid4(); path=material_path(storage); path.parent.mkdir(parents=True,exist_ok=True,mode=0o700)
        fd,tmp=tempfile.mkstemp(dir=path.parent,prefix=".incoming-")
        try:
            with os.fdopen(fd,"wb") as out: await asyncio.to_thread(out.write,body)
            await asyncio.to_thread(os.replace,tmp,path)
            async with request.app.state.pool.acquire() as c:
                row=await c.fetchrow("""insert into learning_materials(id,owner_id,folder,title,file_name,mime,size_bytes,storage_name) values($1,$2,$3,$4,$5,$6,$7,$8) returning *""",ident,user["id"],folder,title,name,mime,len(body),storage)
            return view(row)
        except Exception:
            Path(tmp).unlink(missing_ok=True); path.unlink(missing_ok=True); raise
    async def owned(c,ident,user):
        row=await c.fetchrow("select * from learning_materials where id=$1 and owner_id=$2",ident,user["id"])
        if row is None: raise HTTPException(404,"Материал не найден.")
        return row
    @router.get("/api/v1/materials/{ident}/file")
    async def download(ident:UUID,request:Request,user=Depends(current_user)):
        async with request.app.state.pool.acquire() as c: row=await owned(c,ident,user)
        path=material_path(row["storage_name"])
        if not path.is_file(): raise HTTPException(503,"Файл отсутствует в хранилище.")
        return FileResponse(path,media_type=row["mime"],filename=row["file_name"],headers={"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"})
    @router.patch("/api/v1/materials/{ident}")
    async def update(ident:UUID,data:Meta|Favorite,request:Request,user=Depends(current_user)):
        async with request.app.state.pool.acquire() as c:
            await owned(c,ident,user)
            if isinstance(data,Meta): row=await c.fetchrow("update learning_materials set title=$3,folder=$4 where id=$1 and owner_id=$2 returning *",ident,user["id"],data.title.strip(),data.folder.strip())
            else: row=await c.fetchrow("update learning_materials set favorite=$3 where id=$1 and owner_id=$2 returning *",ident,user["id"],data.favorite)
        return view(row)
    @router.post("/api/v1/materials/{ident}/used")
    async def used(ident:UUID,request:Request,user=Depends(current_user)):
        async with request.app.state.pool.acquire() as c: await owned(c,ident,user); await c.execute("update learning_materials set use_count=use_count+1,last_used_at=now() where id=$1",ident)
        return {"ok":True}
    @router.delete("/api/v1/materials/{ident}",status_code=204)
    async def delete(ident:UUID,request:Request,user=Depends(current_user)):
        async with request.app.state.pool.acquire() as c: row=await owned(c,ident,user); await c.execute("delete from learning_materials where id=$1",ident)
        await asyncio.to_thread(material_path(row["storage_name"]).unlink,missing_ok=True); return Response(status_code=204)
    return router
