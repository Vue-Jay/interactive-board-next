from uuid import UUID,uuid4
from fastapi import APIRouter,Depends,HTTPException,Request
from pydantic import BaseModel,Field
class Message(BaseModel):body:str=Field(min_length=1,max_length=4000)
class Peer(BaseModel):user_id:UUID
def make_router(current_user):
 r=APIRouter()
 @r.get('/api/v1/direct-chats')
 async def chats(request:Request,user=Depends(current_user)):
  async with request.app.state.pool.acquire() as c:
   rows=await c.fetch('''select c.id,p.user_id,u.display_name,u.email,m.body,m.created_at,(select count(*) from direct_messages unread where unread.conversation_id=c.id and unread.sender_id=p.user_id and unread.created_at>coalesce(me.last_read_at,'epoch')) unread from direct_conversations c join direct_conversation_members me on me.conversation_id=c.id and me.user_id=$1 join direct_conversation_members p on p.conversation_id=c.id and p.user_id<>$1 join account_users u on u.id=p.user_id left join lateral(select body,created_at from direct_messages where conversation_id=c.id order by created_at desc limit 1)m on true order by m.created_at desc nulls last''',user['id'])
  return [{'id':str(x['id']),'other_user_id':str(x['user_id']),'other_name':x['display_name'],'other_email':x['email'],'last_message':x['body'],'last_message_at':x['created_at'].isoformat() if x['created_at'] else None,'unread_count':x['unread']} for x in rows]
 @r.get('/api/v1/direct-chats/contacts')
 async def contacts(request:Request,user=Depends(current_user)):
  async with request.app.state.pool.acquire() as c: rows=await c.fetch("select id,display_name,email from account_users where id<>$1 and email_confirmed_at is not null order by display_name limit 500",user['id'])
  return [{'user_id':str(x['id']),'display_name':x['display_name'],'email':x['email']} for x in rows]
 @r.post('/api/v1/direct-chats')
 async def ensure(data:Peer,request:Request,user=Depends(current_user)):
  if data.user_id==user['id']: raise HTTPException(422,'Нельзя создать чат с собой.')
  async with request.app.state.pool.acquire() as c:
   async with c.transaction():
    if not await c.fetchval('select exists(select 1 from account_users where id=$1 and email_confirmed_at is not null)',data.user_id): raise HTTPException(404,'Пользователь не найден.')
    key=':'.join(sorted((str(user['id']),str(data.user_id))))
    cid=await c.fetchval('insert into direct_conversations(id,unique_id) values($1,$2) on conflict(unique_id) do update set unique_id=excluded.unique_id returning id',uuid4(),key)
    await c.execute('insert into direct_conversation_members(conversation_id,user_id) values($1,$2),($1,$3) on conflict do nothing',cid,user['id'],data.user_id)
  return {'id':str(cid)}
 async def member(c,cid,uid):
  if not await c.fetchval('select exists(select 1 from direct_conversation_members where conversation_id=$1 and user_id=$2)',cid,uid): raise HTTPException(404,'Чат не найден.')
 @r.get('/api/v1/direct-chats/{cid}/messages')
 async def messages(cid:UUID,request:Request,user=Depends(current_user)):
  async with request.app.state.pool.acquire() as c: await member(c,cid,user['id']); rows=await c.fetch('select id,conversation_id,sender_id,sender_name,body,created_at,edited_at,deleted_at from direct_messages where conversation_id=$1 order by created_at limit 500',cid)
  return [{**dict(x),'id':str(x['id']),'conversation_id':str(x['conversation_id']),'sender_id':str(x['sender_id']),'created_at':x['created_at'].isoformat(),'edited_at':x['edited_at'].isoformat() if x['edited_at'] else None,'deleted_at':x['deleted_at'].isoformat() if x['deleted_at'] else None} for x in rows]
 @r.post('/api/v1/direct-chats/{cid}/messages')
 async def send(cid:UUID,data:Message,request:Request,user=Depends(current_user)):
  async with request.app.state.pool.acquire() as c: await member(c,cid,user['id']); await c.execute('insert into direct_messages(id,conversation_id,sender_id,sender_name,body) values($1,$2,$3,$4,$5)',uuid4(),cid,user['id'],user['display_name'],data.body.strip())
  return {'ok':True}
 @r.post('/api/v1/direct-chats/{cid}/read')
 async def read(cid:UUID,request:Request,user=Depends(current_user)):
  async with request.app.state.pool.acquire() as c: await member(c,cid,user['id']); await c.execute('update direct_conversation_members set last_read_at=now() where conversation_id=$1 and user_id=$2',cid,user['id'])
  return {'ok':True}
 @r.get('/api/v1/direct-chats/{cid}/read-state')
 async def read_state(cid:UUID,request:Request,user=Depends(current_user)):
  async with request.app.state.pool.acquire() as c:
   await member(c,cid,user['id']); value=await c.fetchval('select last_read_at from direct_conversation_members where conversation_id=$1 and user_id<>$2',cid,user['id'])
  return {'other_last_read_at':value.isoformat() if value else None}
 @r.patch('/api/v1/direct-messages/{mid}')
 async def edit(mid:UUID,data:Message,request:Request,user=Depends(current_user)):
  async with request.app.state.pool.acquire() as c:
   result=await c.execute("update direct_messages set body=$2,edited_at=now() where id=$1 and sender_id=$3 and deleted_at is null",mid,data.body.strip(),user['id'])
  if result.endswith('0'): raise HTTPException(404,'Сообщение не найдено.')
  return {'ok':True}
 @r.delete('/api/v1/direct-messages/{mid}')
 async def delete(mid:UUID,request:Request,user=Depends(current_user)):
  async with request.app.state.pool.acquire() as c: result=await c.execute("update direct_messages set body='Сообщение удалено',deleted_at=now(),edited_at=null where id=$1 and sender_id=$2 and deleted_at is null",mid,user['id'])
  if result.endswith('0'): raise HTTPException(404,'Сообщение не найдено.')
  return {'ok':True}
 return r
