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
 -- The live autosave refreshes a thumbnail cache on any editor action.
 if not lektrus_private.student_document_delta_allowed(v_before,
    jsonb_set(v_before,'{preview}','"data:image/png;base64,thumbnail"'::jsonb),pupil) then
  raise exception 'Updating preview cache must not block a student save';end if;
 if not lektrus_private.student_document_delta_allowed(v_before,
    v_before||jsonb_build_object('background',
      jsonb_build_object('mode','dots','color','#f7f7f8','opacity',100),
     'backgroundShared',true),pupil) then
  raise exception 'Default legacy board background must normalize';end if;
 if lektrus_private.student_document_delta_allowed(v_before,
    jsonb_set(v_before,'{subject}','"chemistry"'::jsonb),pupil) then
  raise exception 'Student changed the subject';end if;
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
 -- Subject boards accept student answers without changing teacher prompts.
 v_new:=jsonb_set(v_before,'{items,0}',jsonb_build_object(
  'id','t','kind','graph','createdBy',teacher::text,
  'graphFigureId','subject-board-mathematics','text','Worksheet',
  'subjectBoardEntries',jsonb_build_array(jsonb_build_object(
   'id','entry1','kind','task','title','Example','prompt','2 + 2',
   'answer','4','solution','2 + 2 = 4'))));
 if not lektrus_private.student_document_delta_allowed(v_new,
   jsonb_set(v_new,'{items,0,subjectBoardEntries,0,activityResponse}',
    '{"text":"4"}'::jsonb),pupil) then
  raise exception 'Student activity response incorrectly blocked';end if;
 if not lektrus_private.student_document_delta_allowed(v_new,
   jsonb_set(v_new,'{items,0,subjectBoardEntries,0,answer}','"5"'::jsonb),pupil) then
  raise exception 'Actual student answer field was incorrectly blocked';end if;
 if not lektrus_private.student_document_delta_allowed(v_new,
   jsonb_set(v_new,'{items,0,subjectBoardEntries,0,workedSolution}',
    '{"steps":[{"expression":"2 + 2 = 4","conditions":""}],"answer":"4"}'::jsonb),pupil) then
  raise exception 'Actual student workedSolution was incorrectly blocked';end if;
 if lektrus_private.student_document_delta_allowed(v_new,
   jsonb_set(v_new,'{items,0,subjectBoardEntries,0,solution}',
    '"Teacher reference modified"'::jsonb),pupil) then
  raise exception 'Teacher reference solution was editable';end if;
 if not lektrus_private.student_document_delta_allowed(v_new,
    jsonb_set(jsonb_set(v_new,
     '{items,0,subjectBoardEntries,0,subject}','"mathematics"'::jsonb),
     '{items,0,subjectBoardEntries,0,answer}','"4"'::jsonb),pupil) then
  raise exception 'First response to legacy untagged task was rejected';end if;
 if lektrus_private.student_document_delta_allowed(v_new,
   jsonb_set(v_new,'{items,0,subjectBoardEntries,0,subject}',
    '"physics"'::jsonb),pupil) then
  raise exception 'Student changed a legacy task to another subject';end if;
 if lektrus_private.student_document_delta_allowed(v_new,
   jsonb_set(v_new,'{items,0,subjectBoardEntries}',
    (v_new#>'{items,0,subjectBoardEntries}')||
      '[{"id":"new","kind":"task","prompt":"Spoof"}]'::jsonb),pupil) then
  raise exception 'Student added a teacher-defined subject task';end if;

 -- Chemistry lab is an interactive shared simulator, while its parent
 -- teacher-owned graph object, title and other lesson fields remain immutable.
 v_new:=jsonb_set(v_before,'{items,0}',jsonb_build_object(
  'id','t','kind','graph','createdBy',teacher::text,
  'graphFigureId','chem-experiment-free','text','Chemical laboratory',
  'scienceLabBench',jsonb_build_object('vessels','[]'::jsonb,'event',0),
  'scienceReagents',jsonb_build_array('H2O'),'scienceExperimentStage',0));
 if not lektrus_private.student_document_delta_allowed(v_new,
   jsonb_set(v_new,'{items,0,scienceLabBench}',
    '{"vessels":[{"id":"beaker1","kind":"beaker","x":35,"y":40,"reagents":[],
    "environment":"aqueous","observed":false}],"event":1,"simulationPaused":false}'::jsonb),
   pupil) then
  raise exception 'Student cannot operate classroom chemistry bench';end if;
 if not lektrus_private.student_document_delta_allowed(v_new,
   jsonb_set(v_new,'{items,0}',(v_new->'items'->0)
     - array['scienceReagents','scienceExperimentStage']),pupil) then
  raise exception 'Clearing retired chemistry fields must remain allowed';end if;
 if lektrus_private.student_document_delta_allowed(v_new,
   jsonb_set(v_new,'{items,0,scienceReagents}',
     '["H2SO4"]'::jsonb),pupil) then
  raise exception 'Student can replace teacher chemistry reagents metadata';end if;
 if lektrus_private.student_document_delta_allowed(v_new,
   jsonb_set(v_new,'{items,0,text}','"Replaced lab lesson"'::jsonb),pupil) then
  raise exception 'Student changed laboratory object title';end if;
 if lektrus_private.student_document_delta_allowed(v_new,
   jsonb_set(v_new,'{items,0,graphFigureId}','"subject-board-physics"'::jsonb),pupil) then
  raise exception 'Student replaced chemistry tool identity';end if;
 if lektrus_private.student_document_delta_allowed(v_new,
   jsonb_set(v_new,'{items,0,scienceLabBench,vessels}',
    (select jsonb_agg(jsonb_build_object('id',n,'kind','beaker'))
      from generate_series(1,7) as n)),pupil) then
  raise exception 'Student exceeded supported chemistry vessels';end if;
 if lektrus_private.student_document_delta_allowed(v_new,
   jsonb_set(v_new,'{items,0,scienceLabBench,event}','"oops"'::jsonb),pupil) then
  raise exception 'Student saved invalid laboratory event';end if;
 if lektrus_private.student_document_delta_allowed(v_new,
   jsonb_set(v_new,'{items,0,scienceLabBench,placedDevices}',
    (select jsonb_agg(jsonb_build_object('id',n,'kind','hotplate'))
      from generate_series(1,11) as n)),pupil) then
  raise exception 'Student exceeded supported chemistry devices';end if;
 if lektrus_private.student_document_delta_allowed(v_new,
   jsonb_set(v_new,'{items,0,locked}','true'::jsonb),pupil) then
  raise exception 'Student was able to lock chemistry bench';end if;

 -- Linear JSONB indexing must remain usable on a multi-thousand-stroke
 -- classboard. No wall-clock assertion on shared CI runners.
 if (select count(*) from jsonb_each(lektrus_private.board_items_by_id(
    jsonb_build_object('items',(
       select jsonb_agg(jsonb_build_object('id','stroke-'||n,
         'kind','pen','createdBy',pupil::text))
       from generate_series(1,2500) n))))) <> 2500 then
  raise exception 'Large board item ID index lost strokes';end if;

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
