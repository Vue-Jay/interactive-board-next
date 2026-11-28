from fastapi import APIRouter,Depends,HTTPException,Request
from pydantic import BaseModel,Field
from uuid import UUID
class BoardOrg(BaseModel): board_id:UUID; subject:str=Field(default='',max_length=80); group_name:str=Field(default='',max_length=80)
class Category(BaseModel): kind:str; name:str=Field(min_length=1,max_length=80)
def make_router(current_user,board_access,board_participant,can_edit_board_metadata,set_shared_board_metadata):
 r=APIRouter()
 @r.get('/api/v1/organization')
 async def get(request:Request,user=Depends(current_user)):
  async with request.app.state.pool.acquire() as c:
   cats=await c.fetch("select kind,name from teacher_categories where user_id=$1",user['id'])
   boards=await c.fetch("select o.board_id,o.subject,o.group_name from board_organization o where exists(select 1 from board_members m where m.board_id=o.board_id and m.user_id=$1) or exists(select 1 from boards b where b.id=o.board_id and b.owner_id=$1)",user['id'])
  return {'categories':[dict(x) for x in cats],'boards':[{'board_id':str(x['board_id']),'subject':x['subject'],'group_name':x['group_name']} for x in boards]}
 @r.put('/api/v1/organization/board')
 async def put_board(data:BoardOrg,request:Request,user=Depends(current_user)):
  async with request.app.state.pool.acquire() as c:
   board,role=await board_access(c,data.board_id,user['id'])
   participant=await board_participant(c,data.board_id,user,role)
   if not can_edit_board_metadata(user,participant): raise HTTPException(403,'Название и предмет доступны владельцу, сопреподавателю и администратору.')
  await set_shared_board_metadata(data.board_id,request,user,{'subject':data.subject.strip()})
  # Preserve the owner's existing class/group when a co-teacher or administrator
  # changes the subject. Never grant membership/organization rights implicitly.
  if role=='owner':
   async with request.app.state.pool.acquire() as c:
    async with c.transaction():
     board,current_role=await board_access(c,data.board_id,user['id'],lock=True)
     if current_role!='owner': raise HTTPException(403,'Только владелец может менять класс и группу.')
     await c.execute('insert into board_organization(board_id,group_name,updated_at) values($1,$2,now()) on conflict(board_id) do update set group_name=$2,updated_at=now()',data.board_id,data.group_name.strip())
  return {'ok':True}
 @r.post('/api/v1/organization/category')
 async def put_category(data:Category,request:Request,user=Depends(current_user)):
  if data.kind not in ('subject','group'): raise HTTPException(422,'Недопустимый тип категории.')
  if user['account_role']!='teacher': raise HTTPException(403,'Только преподаватель может управлять категориями.')
  async with request.app.state.pool.acquire() as c: await c.execute('insert into teacher_categories(user_id,kind,name) values($1,$2,$3) on conflict do nothing',user['id'],data.kind,data.name.strip())
  return {'ok':True}
 return r
