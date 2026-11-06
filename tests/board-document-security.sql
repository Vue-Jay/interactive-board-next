\set ON_ERROR_STOP on
-- Isolated Postgres: mock only auth/JWT/board membership. No production connection.
create role authenticated;
create role anon;
create schema auth;
create function auth.uid() returns uuid language sql stable as $uid$
 select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid;
$uid$;
create table public.boards(id uuid primary key,owner_id uuid not null);
create table public.board_documents(
 board_id uuid primary key references public.boards(id),
 document jsonb not null,version bigint not null default 1,
 updated_at timestamptz not null default now(),updated_by uuid
);
create function public.can_edit_board(p_board_id uuid)
returns boolean language sql stable as $edit$
 select coalesce(nullif(current_setting('test.can_edit',true),'')::boolean,false);
$edit$;
create function public.get_my_account_access()
returns jsonb language sql stable as $role$
 select jsonb_build_object('role',coalesce(current_setting('test.role',true),'student'),
  'is_admin',coalesce(nullif(current_setting('test.admin',true),'')::boolean,false));
$role$;
grant select,insert,update,delete on public.board_documents to authenticated;

\ir ../supabase/v248_board_document_authorization.sql

do $test$
declare
 teacher constant uuid := '11111111-1111-4111-8111-111111111111';
 pupil constant uuid := '22222222-2222-4222-8222-222222222222';
 v_before jsonb := '{
   "version":1,"title":"Lesson","subject":"math",
   "view":{"x":0,"y":0,"zoom":1},
   "items":[
    {"id":"t","kind":"shape","createdBy":"11111111-1111-4111-8111-111111111111",
     "text":"Question","x":1,"y":2,"width":100,"height":80},
    {"id":"q","kind":"quiz","createdBy":"11111111-1111-4111-8111-111111111111",
     "text":"2+2?","quizCorrect":1,"quizSelected":null,"locked":true,
     "x":1,"y":2,"width":100,"height":80},
    {"id":"p","kind":"pen","createdBy":"11111111-1111-4111-8111-111111111111",
     "text":"","x":1,"y":2,"width":100,"height":80}
   ]}'::jsonb;
 v_new jsonb;
begin
 if has_table_privilege('authenticated','public.board_documents','INSERT')
    or has_table_privilege('authenticated','public.board_documents','UPDATE')
    or has_table_privilege('authenticated','public.board_documents','DELETE')
    or not has_table_privilege('authenticated','public.board_documents','SELECT') then
  raise exception 'Direct REST writes must be revoked; document read must remain';
 end if;
 v_new:=jsonb_set(v_before,'{items,0,x}','22'::jsonb);
 if not lektrus_private.student_document_delta_allowed(v_before,v_new,pupil) then
  raise exception 'Unlocked teacher geometry must remain adjustable';end if;
 if lektrus_private.student_document_delta_allowed(v_before,
    jsonb_set(v_before,'{items,0,text}','"Cheated"'::jsonb),pupil) then
  raise exception 'Teacher text tampering passed';end if;
 if lektrus_private.student_document_delta_allowed(v_before,
    jsonb_set(v_before,'{title}','"New title"'::jsonb),pupil) then
  raise exception 'Student title tampering passed';end if;
 if lektrus_private.student_document_delta_allowed(v_before,
    jsonb_set(v_before,'{items}',(v_before->'items')-0),pupil) then
  raise exception 'Foreign object deletion passed';end if;
 v_new:=jsonb_set(v_before,'{items}',
  v_before->'items'||jsonb_build_array(jsonb_build_object(
    'id','mine','createdBy',pupil::text,'kind','text','text','Hi')));
 if not lektrus_private.student_document_delta_allowed(v_before,v_new,pupil) then
  raise exception 'Student own object create denied';end if;
 v_new:=jsonb_set(v_new,'{items,3,kind}','"quiz"'::jsonb);
 if lektrus_private.student_document_delta_allowed(v_before,v_new,pupil) then
  raise exception 'Student forged quiz create passed';end if;
 v_new:=jsonb_set(v_new,'{items,3,kind}','"text"'::jsonb);
 v_new:=jsonb_set(v_new,'{items,3,createdBy}',to_jsonb(teacher::text));
 if lektrus_private.student_document_delta_allowed(v_before,v_new,pupil) then
  raise exception 'New item creator spoof passed';end if;
 v_new:=jsonb_set(v_before,'{items,1,quizSelected}','1'::jsonb);
 if not lektrus_private.student_document_delta_allowed(v_before,v_new,pupil) then
  raise exception 'Answer to locked quiz denied';end if;
 v_new:=jsonb_set(v_before,'{items,1,quizCorrect}','0'::jsonb);
 if lektrus_private.student_document_delta_allowed(v_before,v_new,pupil) then
  raise exception 'Correct quiz answer modified';end if;
 v_new:=jsonb_set(v_before,'{items,1,x}','75'::jsonb);
 if lektrus_private.student_document_delta_allowed(v_before,v_new,pupil) then
  raise exception 'Locked teacher quiz moved';end if;
 v_new:=jsonb_set(v_before,'{items}',(v_before->'items')-2);
 if not lektrus_private.student_document_delta_allowed(v_before,v_new,pupil) then
  raise exception 'Shared teacher ink erasure denied';end if;
 v_new:=jsonb_set(v_before,'{items}',
  v_before->'items'||jsonb_build_array(jsonb_build_object(
   'id','locked-pen','kind','pen','createdBy',pupil::text,'locked',true)));
 if lektrus_private.student_document_delta_allowed(v_before,v_new,pupil) then
  raise exception 'Locked pen creation passed';end if;
 v_new:=jsonb_set(v_before,'{items}',
  v_before->'items'||jsonb_build_array(v_before->'items'->0));
 if lektrus_private.student_document_delta_allowed(v_before,v_new,pupil) then
  raise exception 'Duplicate ID passed';
 end if;
 -- Legacy ink[] -> items[] migration must not be treated as deletion.
 v_new:=jsonb_set(v_before,'{items}',(v_before->'items')-2);
 v_new:=jsonb_set(v_new,'{ink}',jsonb_build_array(
  jsonb_build_object('after',2,'stroke',v_before->'items'->2)));
 if not lektrus_private.student_document_delta_allowed(v_before,v_new,pupil) then
  raise exception 'Legacy ink collection relocation rejected';end if;

 -- Protect actual UPDATE path even when called via a privileged RPC owner.
 perform set_config('request.jwt.claim.sub',teacher::text,true);
 perform set_config('test.role','teacher',true);
 perform set_config('test.can_edit','true',true);
 insert into public.boards(id,owner_id)
 values('33333333-3333-4333-8333-333333333333',teacher);
 insert into public.board_documents(board_id,document,version)
 values('33333333-3333-4333-8333-333333333333',v_before,1);
 perform set_config('request.jwt.claim.sub',pupil::text,true);
 perform set_config('test.role','student',true);
 update public.board_documents set document=jsonb_set(document,
   '{items,0,x}','22'::jsonb),version=2;
 begin
  update public.board_documents set document=jsonb_set(document,
    '{items,0,text}','"Cheated"'::jsonb),version=3;
  raise exception 'Trigger allowed teacher text change';
 exception when sqlstate '42501' then null;end;
 if (select document->'items'->0->>'text' from public.board_documents) <> 'Question' then
  raise exception 'Rejected update still changed teacher content';end if;
 perform set_config('test.can_edit','false',true);
 begin
  update public.board_documents set document=jsonb_set(document,
    '{items,0,x}','30'::jsonb),version=3;
  raise exception 'Viewer update accepted';
 exception when sqlstate '42501' then null;end;
 -- A real board owner may maintain a board even if initially registered as pupil.
 perform set_config('test.can_edit','true',true);
 insert into public.boards(id,owner_id)
 values('44444444-4444-4444-8444-444444444444',pupil);
 insert into public.board_documents(board_id,document,version)
 values('44444444-4444-4444-8444-444444444444',v_before,1);
 raise notice 'PASS: isolated Postgres policy (field diffs, actor, auth, RLS grants and trigger)';
end;
$test$;
