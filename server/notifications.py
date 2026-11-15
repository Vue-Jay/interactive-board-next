from __future__ import annotations
from uuid import UUID
import asyncpg
from fastapi import APIRouter,Depends,HTTPException,Request
from pydantic import BaseModel
class Settings(BaseModel):
 assignment:bool=True; submission:bool=True; review:bool=True; lesson:bool=True
 material:bool=True; comment:bool=True; lesson_reminder:bool=True; assignment_reminder:bool=True
def make_router(current_user):
 r=APIRouter()
 @r.get('/api/v1/notifications')
 async def listing(request:Request,user=Depends(current_user)):
  async with request.app.state.pool.acquire() as c: rows=await c.fetch('select id,kind,title,body,href,created_at,read_at from user_notifications where user_id=$1 order by created_at desc limit 100',user['id'])
  return [{**dict(x),'id':str(x['id']),'created_at':x['created_at'].isoformat(),'read_at':x['read_at'].isoformat() if x['read_at'] else None} for x in rows]
 @r.post('/api/v1/notifications/read-all')
 async def read_all(request:Request,user=Depends(current_user)):
  async with request.app.state.pool.acquire() as c: await c.execute('update user_notifications set read_at=now() where user_id=$1 and read_at is null',user['id'])
  return {'ok':True}
 @r.post('/api/v1/notifications/{ident}/read')
 async def read_one(ident:UUID,request:Request,user=Depends(current_user)):
  async with request.app.state.pool.acquire() as c:
   result=await c.execute('update user_notifications set read_at=coalesce(read_at,now()) where id=$1 and user_id=$2',ident,user['id'])
  if result.endswith('0'): raise HTTPException(404,'Уведомление не найдено.')
  return {'ok':True}
 @r.get('/api/v1/notification-settings')
 async def get_settings(request:Request,user=Depends(current_user)):
  async with request.app.state.pool.acquire() as c: row=await c.fetchrow('select assignment,submission,review,lesson,material,comment,lesson_reminder,assignment_reminder from user_notification_settings where user_id=$1',user['id'])
  return dict(row) if row else Settings().model_dump()
 @r.put('/api/v1/notification-settings')
 async def put_settings(data:Settings,request:Request,user=Depends(current_user)):
  async with request.app.state.pool.acquire() as c:
   await c.execute('''insert into user_notification_settings(user_id,assignment,submission,review,lesson,material,comment,lesson_reminder,assignment_reminder) values($1,$2,$3,$4,$5,$6,$7,$8,$9) on conflict(user_id) do update set assignment=$2,submission=$3,review=$4,lesson=$5,material=$6,comment=$7,lesson_reminder=$8,assignment_reminder=$9''',user['id'],data.assignment,data.submission,data.review,data.lesson,data.material,data.comment,data.lesson_reminder,data.assignment_reminder)
  return {'ok':True}
 return r
