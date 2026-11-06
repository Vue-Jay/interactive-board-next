\set ON_ERROR_STOP on
-- Isolated Postgres: mock only auth/JWT/board membership. No production connection.
create role authenticated;
create role anon;
create schema auth;
create function auth.uid() returns uuid language sql stable as $uid$
 select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid;
$uid$;
create table public.boards(
 id uuid primary key,owner_id uuid not null,updated_at timestamptz default now());
create table public.board_documents(
 board_id uuid primary key references public.boards(id),
 document jsonb not null,version bigint not null default 1,
 updated_at timestamptz not null default now(),updated_by uuid
);
-- Minimal independent copies of the existing v247 tables for exercising
-- the REAL save RPC body; the migration itself never creates/mutates these.
create table public.profiles(id uuid primary key,display_name text);
create table public.board_document_history(
 id bigint generated always as identity primary key,
 board_id uuid not null,version bigint not null,document jsonb not null,
 saved_at timestamptz not null default now(),saved_by uuid,
 unique(board_id,version));
create table public.board_activity(
 id bigint generated always as identity primary key,
 board_id uuid not null,version bigint not null,
 actor_id uuid,actor_name text,
 added_count integer,changed_count integer,removed_count integer,item_count integer,
 unique(board_id,version));
create function public.board_item_delta(p_old jsonb,p_new jsonb)
returns jsonb language sql immutable as $delta$
 select jsonb_build_object('added',0,'changed',0,'removed',0,
   'items',coalesce(jsonb_array_length(p_new->'items'),0));
$delta$;
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
 v_response jsonb;
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

 -- Russian sentence: pupil role marks are legitimate saved answers.
 -- The sentence text, IDs, word order and teacher title are immutable.
 v_new:=jsonb_set(v_before,'{items,0}',jsonb_build_object(
  'id','t','kind','graph','createdBy',teacher::text,
  'graphFigureId','ru-syntax','text','Teacher sentence',
  'schoolDiagram',jsonb_build_object('kind','syntax','title','Члены предложения',
   'showMarks',true,'words',jsonb_build_array(
    jsonb_build_object('id','w1','text','Мама','role','none'),
    jsonb_build_object('id','w2','text','читает','role','none')))));
 if not lektrus_private.student_document_delta_allowed(v_new,
   jsonb_set(v_new,'{items,0,schoolDiagram,words,0,role}',
    '"subject"'::jsonb),pupil) then
  raise exception 'Russian sentence role annotation was incorrectly blocked';end if;
 if lektrus_private.student_document_delta_allowed(v_new,
   jsonb_set(v_new,'{items,0,schoolDiagram,words,0,text}',
    '"Подменено"'::jsonb),pupil) then
  raise exception 'Pupil rewrote a word in teacher syntax exercise';end if;
 if lektrus_private.student_document_delta_allowed(v_new,
   jsonb_set(v_new,'{items,0,schoolDiagram,words,1,id}',
    '"forged"'::jsonb),pupil) then
  raise exception 'Pupil forged a teacher sentence word ID';end if;
 if lektrus_private.student_document_delta_allowed(v_new,
   jsonb_set(v_new,'{items,0,schoolDiagram,title}',
    '"Подменённое условие"'::jsonb),pupil) then
  raise exception 'Pupil rewrote Russian sentence title';end if;
 if lektrus_private.student_document_delta_allowed(v_new,
   jsonb_set(v_new,'{items,0,schoolDiagram,words,0,role}',
    '"invented"'::jsonb),pupil) then
  raise exception 'Pupil forged a grammatical role';end if;
 if lektrus_private.student_document_delta_allowed(v_new,
   jsonb_set(v_new,'{items,0,schoolDiagram,words}',
     (v_new#>'{items,0,schoolDiagram,words}')||
      '[{"id":"w3","text":"книгу","role":"none"}]'::jsonb),pupil) then
  raise exception 'Pupil added a word to teacher syntax exercise';end if;

 -- Place-value: numeric response is editable, but the number base, teacher
 -- title and display of correct powers may not be changed by a pupil.
 v_new:=jsonb_set(v_before,'{items,0}',jsonb_build_object(
  'id','t','kind','graph','createdBy',teacher::text,
  'graphFigureId','info-place-value','text','Number base task',
  'schoolDiagram',jsonb_build_object('kind','place-value',
   'title','Бинарная запись','base',2,'digits','','showPowers',true)));
 if not lektrus_private.student_document_delta_allowed(v_new,
   jsonb_set(v_new,'{items,0,schoolDiagram,digits}',
    '"101101"'::jsonb),pupil) then
  raise exception 'Valid pupil binary input incorrectly blocked';end if;
 if lektrus_private.student_document_delta_allowed(v_new,
   jsonb_set(v_new,'{items,0,schoolDiagram,digits}',
    '"102"'::jsonb),pupil) then
  raise exception 'Invalid digit for base two accepted';end if;
 if lektrus_private.student_document_delta_allowed(v_new,
   jsonb_set(v_new,'{items,0,schoolDiagram,base}',
    '16'::jsonb),pupil) then
  raise exception 'Student changed the teacher number base';end if;
 if lektrus_private.student_document_delta_allowed(v_new,
   jsonb_set(v_new,'{items,0,schoolDiagram,showPowers}',
    'false'::jsonb),pupil) then
  raise exception 'Student changed the teacher powers display';end if;
 if lektrus_private.student_document_delta_allowed(v_new,
   jsonb_set(v_new,'{items,0,schoolDiagram,digits}',
    to_jsonb(repeat('1',11))),pupil) then
  raise exception 'Oversized student number accepted';end if;

 -- Linguistic source diagrams have NO independent answer fields yet.
 -- Their tools may be shown but teacher definitions cannot be overwritten.
 v_new:=jsonb_set(v_before,'{items,0}',jsonb_build_object(
  'id','t','kind','graph','createdBy',teacher::text,
  'graphFigureId','ru-morphology','text','Word analysis',
  'schoolDiagram',jsonb_build_object('kind','morphology',
   'title','Морфологический разбор','word','весна','sentence','',
   'partOfSpeech','noun','showAnalysis',false,'rows','[]'::jsonb)));
 if lektrus_private.student_document_delta_allowed(v_new,
   jsonb_set(v_new,'{items,0,schoolDiagram,word}',
    '"зима"'::jsonb),pupil) then
  raise exception 'Pupil replaced teacher morphology word';end if;
 v_new:=jsonb_set(v_before,'{items,0}',jsonb_build_object(
  'id','t','kind','graph','createdBy',teacher::text,
  'graphFigureId','ru-phonetics','text','Phonetics',
  'schoolDiagram',jsonb_build_object('kind','phonetics',
   'title','Фонетический разбор','word','кот','letters','[]'::jsonb,
   'showSounds',false,'showCharacteristics',false)));
 if lektrus_private.student_document_delta_allowed(v_new,
   jsonb_set(v_new,'{items,0,schoolDiagram,word}',
    '"кит"'::jsonb),pupil) then
  raise exception 'Pupil replaced teacher phonetics word';end if;
 v_new:=jsonb_set(v_before,'{items,0}',jsonb_build_object(
  'id','t','kind','graph','createdBy',teacher::text,
  'graphFigureId','ru-orthography','text','Spelling exercise',
  'schoolDiagram',jsonb_build_object('kind','orthography',
   'title','Орфография','showExplanation',false,'questions',
   jsonb_build_array(jsonb_build_object('id','q1','prompt','тр□ва',
    'options',jsonb_build_array('а','о'),'correct',0,'explanation','Травы')))));
 if lektrus_private.student_document_delta_allowed(v_new,
   jsonb_set(v_new,'{items,0,schoolDiagram,questions,0,correct}',
    '1'::jsonb),pupil) then
  raise exception 'Pupil modified spelling answer key';end if;

 -- Foreign-language sentence puzzle solves in local UI state; the saved
 -- teacher sentence order/answer-key cannot be changed through board JSON.
 v_new:=jsonb_set(v_before,'{items,0}',jsonb_build_object(
  'id','t','kind','graph','createdBy',teacher::text,
  'graphFigureId','language-sentence-builder','text','Foreign language',
  'schoolDiagram',jsonb_build_object('kind','sentence-builder',
   'title','Sentence','instructions','Составьте предложение',
   'showKey',false,'showHint',false,'patternId','',
   'parts',jsonb_build_array(
    jsonb_build_object('id','a','text','I'),
    jsonb_build_object('id','b','text','read'),
    jsonb_build_object('id','c','text','books.')))));
 if lektrus_private.student_document_delta_allowed(v_new,
   jsonb_set(v_new,'{items,0,schoolDiagram,parts,0,text}',
    '"You"'::jsonb),pupil) then
  raise exception 'Pupil changed the foreign language question';end if;
 if lektrus_private.student_document_delta_allowed(v_new,
   jsonb_set(v_new,'{items,0,schoolDiagram,showKey}',
    'true'::jsonb),pupil) then
  raise exception 'Pupil turned on teacher foreign-language answer key';end if;

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
 -- RPC must never allow a NULL expected version to overwrite a fresh
 -- peer edit. A new document accepts expected=0; version increments atomically.
 perform set_config('request.jwt.claim.sub',pupil::text,true);
 perform set_config('test.role','student',true);
 perform set_config('test.can_edit','true',true);
 insert into public.boards(id,owner_id)
 values('55555555-5555-4555-8555-555555555555',pupil);
 begin
  perform public.save_board_document(
   '55555555-5555-4555-8555-555555555555',v_before,null);
  raise exception 'NULL expected version bypassed optimistic locking';
 exception when sqlstate '22023' then null;end;
 select public.save_board_document(
   '55555555-5555-4555-8555-555555555555',v_before,0)
  into v_response;
 if v_response->>'ok' <> 'true' or (v_response->>'version')::integer<>1 then
  raise exception 'Initial version-0 RPC save failed: %',v_response;end if;
 select public.save_board_document(
   '55555555-5555-4555-8555-555555555555',
   jsonb_set(v_before,'{title}','"Wrong stale copy"'::jsonb),0)
 into v_response;
 if v_response->>'conflict' <> 'true' or
    (v_response->>'version')::integer<>1 then
  raise exception 'Stale version did not produce a conflict: %',v_response;end if;
 select public.save_board_document(
   '55555555-5555-4555-8555-555555555555',
   jsonb_set(v_before,'{title}','"Owner change"'::jsonb),1)
 into v_response;
 if v_response->>'ok' <> 'true' or (v_response->>'version')::integer<>2 then
  raise exception 'Valid version-1 owner update failed: %',v_response;end if;
 select public.save_board_document(
   '55555555-5555-4555-8555-555555555555',v_before,1)
 into v_response;
 if v_response->>'conflict' <> 'true' or
    (v_response->>'version')::integer<>2 or
    v_response->'document'->>'title'<>'Owner change' then
  raise exception 'Stale version-1 RPC should return actual version/document: %',
    v_response;end if;
 if (select count(*) from public.board_document_history where board_id=
   '55555555-5555-4555-8555-555555555555')<>2 then
  raise exception 'Two successful RPC versions must be recoverable';end if;
 begin
  perform public.save_board_document(
   '55555555-5555-4555-8555-555555555555',v_before,null);
  raise exception 'RPC allowed NULL version after the first update';
 exception when sqlstate '22023' then null;end;
 if (select document->>'title' from public.board_documents where board_id=
   '55555555-5555-4555-8555-555555555555')<>'Owner change' then
  raise exception 'A rejected stale save changed the lesson';end if;
 -- Even when a real board owner can edit everything, malformed view/preview
 -- cannot corrupt a shared board for every connected pupil.
 begin
  perform public.save_board_document(
   '55555555-5555-4555-8555-555555555555',
   jsonb_set(v_before,'{view,zoom}','"not-a-number"'::jsonb),2);
  raise exception 'RPC accepted a non-numeric viewport';
 exception when sqlstate '22023' then null;end;
 begin
  perform public.save_board_document(
   '55555555-5555-4555-8555-555555555555',
   jsonb_set(v_before,'{view,zoom}','20'::jsonb),2);
  raise exception 'RPC accepted an out-of-range viewport';
 exception when sqlstate '22023' then null;end;
 begin
  perform public.save_board_document(
   '55555555-5555-4555-8555-555555555555',
   jsonb_set(v_before,'{preview}',to_jsonb(repeat('x',6000001))),2);
  raise exception 'RPC accepted an oversized thumbnail payload';
 exception when sqlstate '22023' then null;end;
 if (select version from public.board_documents where board_id=
   '55555555-5555-4555-8555-555555555555')<>2 then
  raise exception 'Rejected malformed RPC unexpectedly advanced the version';end if;

 raise notice 'PASS: isolated Postgres policy (field diffs, actor, auth, RLS grants and trigger)';
end;
$test$;


-- Unlike the DO block above (which calls privileged functions as postgres),
-- this transaction executes with the same database ROLE as a real PostgREST
-- user. A mocked JWT sub is used only because this is an isolated database.
-- Everything is rolled back; no provider/project is connected.
begin;
set local role authenticated;
set local request.jwt.claim.sub = '22222222-2222-4222-8222-222222222222';
set local test.role = 'student';
set local test.can_edit = 'true';
do $authenticated_client$
declare
 v_result jsonb;
begin
 if has_table_privilege(current_user,'public.board_documents','UPDATE') then
  raise exception 'Authenticated client unexpectedly has direct table UPDATE';
 end if;
 begin
  update public.board_documents set version=99 where board_id=
    '55555555-5555-4555-8555-555555555555';
  raise exception 'Direct REST-equivalent document UPDATE was accepted';
 exception when insufficient_privilege then null;end;
 begin
  insert into public.board_documents(board_id,document)
   values('55555555-5555-4555-8555-555555555555','{"items":[]}'::jsonb);
  raise exception 'Direct REST-equivalent document INSERT was accepted';
 exception when insufficient_privilege then null;end;
 select public.save_board_document(
  '55555555-5555-4555-8555-555555555555',
  document,version) into v_result
  from public.board_documents where board_id=
  '55555555-5555-4555-8555-555555555555';
 if v_result->>'ok'<>'true' or (v_result->>'version')::integer<>3 then
  raise exception 'Authenticated board owner cannot use safe RPC: %',v_result;
 end if;
 raise notice 'PASS: authenticated role: REST writes denied, versioned RPC allowed';
end;
$authenticated_client$;
rollback;
