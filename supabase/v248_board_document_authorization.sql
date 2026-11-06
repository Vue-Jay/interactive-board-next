-- Lektrus v248: server-side document authorization, NOT automatically deployed.
-- Requires v247 durable history and the existing get_my_account_access()/can_edit_board().
-- Roll out only after isolated Postgres policy tests and real multi-user acceptance.
begin;

create schema if not exists lektrus_private;
revoke all on schema lektrus_private from public, anon, authenticated;

-- Work on stable item IDs. Old documents may still store drawings separately in
-- ink[].stroke; flattening by ID avoids mistaking a format migration for deletion.
create or replace function lektrus_private.board_items_by_id(p_document jsonb)
returns jsonb language plpgsql immutable set search_path=pg_catalog as $items$
declare
 v_result jsonb;
 v_count integer;
 v_unique integer;
 v_valid boolean;
begin
 if jsonb_typeof(p_document)<>'object' or
    jsonb_typeof(p_document->'items')<>'array' or
    (p_document ? 'ink' and jsonb_typeof(p_document->'ink')<>'array') then
  raise exception 'Invalid board item collections' using errcode='22023';
 end if;
 -- Enforce the cap BEFORE building a JSON index. A repeated jsonb ||
 -- append copies the entire growing map on every stroke (quadratic cost).
 if jsonb_array_length(p_document->'items')+
    jsonb_array_length(coalesce(p_document->'ink','[]'::jsonb))>10000 then
  raise exception 'Too many board items' using errcode='22023';
 end if;
 select count(*)::integer,
        count(distinct item->>'id')::integer,
        coalesce(bool_and(coalesce(
          jsonb_typeof(item)='object' and
          length(item->>'id') between 1 and 160 and
          (item->>'kind') in
           ('sticky','text','shape','pen','marker','image','pdf','frame',
            'connector','comment','table','formula','graph','fraction',
            'checklist','quiz','flashcard','cover','linkmedia','instrument'),
         false)),true),
        coalesce(jsonb_object_agg(item->>'id',item)
          filter (where item->>'id' is not null and item->>'id'<>''),'{}'::jsonb)
 into v_count,v_unique,v_valid,v_result
 from (
  select value as item from jsonb_array_elements(p_document->'items')
  union all
  select value->'stroke' as item from jsonb_array_elements(
    coalesce(p_document->'ink','[]'::jsonb))
 ) board_items;
 if not v_valid or v_count<>v_unique then
  raise exception 'Invalid or duplicate board item ID/kind' using errcode='22023';
 end if;
 return v_result;
end;
$items$;

-- Student responses live inside a teacher's structured subject tasks.
-- Client edits answer (student response), workedSolution, activityResponse and
-- russianWork. Do NOT allow editing prompt, solution (teacher reference),
-- title, task order, kind or any teacher-provided structure.
create or replace function lektrus_private.subject_responses_only(
 p_before jsonb,p_after jsonb,p_board_kind text
) returns boolean language plpgsql immutable set search_path=pg_catalog as $response$
declare
 v_index integer;
 v_old jsonb;
 v_new jsonb;
begin
 if jsonb_typeof(p_before)<>'array' or jsonb_typeof(p_after)<>'array'
    or jsonb_array_length(p_before)<>jsonb_array_length(p_after)
    or jsonb_array_length(p_after)>200 then return false; end if;
 for v_index in 0..jsonb_array_length(p_before)-1 loop
  v_old:=p_before->v_index;
  v_new:=p_after->v_index;
  -- Legacy teacher tasks are sometimes missing a subject tag. The client
  -- adds its canonical subject on the first student response; permit only
  -- this exact normalization, never changes to an existing teacher tag.
  if not (v_old ? 'subject') and (v_new ? 'subject') then
   if p_board_kind not like 'subject-board-%' or
      v_new->>'subject'<>substr(p_board_kind,15) or
      v_new->>'subject' not in
       ('chemistry','physics','mathematics','geography','history','biology',
        'russian','literature','social','languages','informatics') then
    return false;
   end if;
   v_new:=v_new-'subject';
  end if;
  if jsonb_typeof(v_old)<>'object' or jsonb_typeof(v_new)<>'object'
     or coalesce(v_old->>'id','')=''
     or (v_old - array['answer','workedSolution','activityResponse','russianWork']) <>
        (v_new - array['answer','workedSolution','activityResponse','russianWork']) then
   return false;
  end if;
 end loop;
 return true;
end;
$response$;

-- On-board school practice: pupils annotate the roles of existing words or
-- enter digits, without rewriting teacher content or changing the base.
-- Orthography and foreign-language sentence ordering are local UI state.
create or replace function lektrus_private.student_school_practice_allowed(
 p_before jsonb,p_after jsonb
) returns boolean language plpgsql immutable set search_path=pg_catalog as $practice$
declare
 v_index integer;
 v_old jsonb;
 v_new jsonb;
 v_number text;
begin
 if jsonb_typeof(p_before)<>'object' or
    jsonb_typeof(p_after)<>'object' or
    p_before->'kind' is distinct from p_after->'kind' then return false; end if;
 if p_before->>'kind'='syntax' then
  if (p_before-'words')<>(p_after-'words') or
     jsonb_typeof(p_before->'words')<>'array' or
     jsonb_typeof(p_after->'words')<>'array' or
     jsonb_array_length(p_before->'words')<>jsonb_array_length(p_after->'words') or
     jsonb_array_length(p_after->'words')>14 then return false; end if;
  for v_index in 0..jsonb_array_length(p_before->'words')-1 loop
   v_old:=p_before->'words'->v_index;
   v_new:=p_after->'words'->v_index;
   if jsonb_typeof(v_old)<>'object' or
      jsonb_typeof(v_new)<>'object' or
      (v_old-'role')<>(v_new-'role') or
      v_new->>'role' not in
       ('subject','predicate','attribute','object','adverbial','none') or
      v_new->>'role' is null then return false; end if;
  end loop;
  return true;
 end if;
 if p_before->>'kind'='place-value' then
  if (p_before-'digits')<>(p_after-'digits') or
     jsonb_typeof(p_after->'digits')<>'string' then return false; end if;
  v_number:=p_after->>'digits';
  return case p_before->>'base'
   when '2' then v_number ~ '^[01]{0,10}$'
   when '8' then v_number ~ '^[0-7]{0,10}$'
   when '10' then v_number ~ '^[0-9]{0,10}$'
   when '16' then v_number ~ '^[0-9A-F]{0,10}$'
   else false end;
 end if;
 return false;
end;
$practice$;

-- Pure, side-effect-free diff guard, testable with isolated JSON fixtures.
-- Server role/UID must be derived by the trigger, never taken from the HTTP body.
create or replace function lektrus_private.student_document_delta_allowed(
 p_before jsonb,p_after jsonb,p_actor uuid
) returns boolean language plpgsql immutable set search_path=pg_catalog as $delta$
declare
 v_before_items jsonb;
 v_after_items jsonb;
 v_id text;
 v_old jsonb;
 v_new jsonb;
 v_kind text;
 v_is_mine boolean;
 v_move_fields text[] := array['x','y','width','height','rotation'];
 v_fields text[];
 v_old_atlas jsonb;
 v_new_atlas jsonb;
begin
 if p_actor is null or jsonb_typeof(p_before)<>'object'
    or jsonb_typeof(p_after)<>'object'
    or p_before->'version' is distinct from '1'::jsonb
    or p_after->'version' is distinct from '1'::jsonb then
  return false;
 end if;
 -- Preview is a cache, not the lesson definition. The earliest board version
 -- may omit subject, background and backgroundShared: compare canonical
 -- defaults so a student's first save does not become a false metadata edit.
 if (p_before - array['items','ink','view','preview','subject','background','backgroundShared']) <>
    (p_after - array['items','ink','view','preview','subject','background','backgroundShared'])
    or coalesce(p_before->>'subject','')<>coalesce(p_after->>'subject','')
    or coalesce(p_before->'background',
       '{"mode":"dots","color":"#f7f7f8","opacity":100}'::jsonb) <>
       coalesce(p_after->'background',
       '{"mode":"dots","color":"#f7f7f8","opacity":100}'::jsonb)
    or coalesce(p_before->'backgroundShared','true'::jsonb) <>
       coalesce(p_after->'backgroundShared','true'::jsonb) then
  return false;
 end if;
 v_before_items:=lektrus_private.board_items_by_id(p_before);
 v_after_items:=lektrus_private.board_items_by_id(p_after);
 -- Every new item must truly belong to this user. No spoofed createdBy.
 for v_id,v_new in select key,value from jsonb_each(v_after_items) loop
  if v_new->>'kind' in ('pen','marker') and
     coalesce(v_new->>'locked','false')='true' then return false; end if;
  v_old:=v_before_items->v_id;
  v_kind:=v_new->>'kind';
  if v_old is null then
   if v_new->>'createdBy' is distinct from p_actor::text
      or v_kind in ('frame','table','formula','graph','checklist','quiz',
                    'flashcard','cover','linkmedia') then return false; end if;
   continue;
  end if;
  if v_new->'kind' is distinct from v_old->'kind' or
     v_new->'createdBy' is distinct from v_old->'createdBy' or
     v_new->'locked' is distinct from v_old->'locked'
       and v_kind not in ('pen','marker') then return false; end if;
  if v_kind in ('pen','marker') then
   -- Shared ink: no locking, anyone with editor membership can erase/cut.
   continue;
  end if;
  v_is_mine := v_old->>'createdBy'=p_actor::text and
   coalesce(v_old->>'locked','false')<>'true' and
   v_kind not in ('frame','table','formula','graph','checklist','quiz',
                  'flashcard','cover','linkmedia');
  if v_is_mine then continue; end if;

  -- Moving an unlocked teacher object is legitimate student interaction.
  -- Locking prevents transforms but NOT answering an embedded exercise.
  v_fields:=case when coalesce(v_old->>'locked','false')='true'
                 then array[]::text[] else v_move_fields end;
  v_fields:=v_fields || case v_kind
   when 'checklist' then array['checklistDone']
   when 'quiz' then array['quizSelected','quizRevealed']
   when 'flashcard' then array['flashcardFlipped','flashcardMastery']
   when 'cover' then array['coverOpen']
   else array[]::text[] end;
  if v_kind='graph' and v_old ? 'subjectBoardEntries' and
     v_new ? 'subjectBoardEntries' then
   if not lektrus_private.subject_responses_only(
     v_old->'subjectBoardEntries',v_new->'subjectBoardEntries',
     v_old->>'graphFigureId') then
    return false;
   end if;
   v_fields:=v_fields||array['subjectBoardEntries'];
  end if;
  -- The chemistry desk is a shared, manipulable apparatus, not a quiz
  -- answer key. Students can run an experience but cannot change its graph
  -- identity, geometry, other teacher fields or oversized/invalid apparatus.
  if v_kind='graph' and
     v_old->>'graphFigureId'='chem-experiment-free' and
     v_old ? 'scienceLabBench' and v_new ? 'scienceLabBench' and
     coalesce(v_old->>'locked','false')<>'true' then
   if jsonb_typeof(v_new->'scienceLabBench')<>'object' or
      jsonb_typeof(v_new#>'{scienceLabBench,vessels}')<>'array' or
      jsonb_array_length(v_new#>'{scienceLabBench,vessels}')>6 or
      jsonb_typeof(v_new#>'{scienceLabBench,event}')<>'number' or
      length((v_new->'scienceLabBench')::text)>700000 or
      (v_new->'scienceLabBench' ? 'placedDevices' and
       (jsonb_typeof(v_new#>'{scienceLabBench,placedDevices}')<>'array' or
        jsonb_array_length(v_new#>'{scienceLabBench,placedDevices}')>10)) or
      (v_new->'scienceLabBench' ? 'reactionLog' and
       (jsonb_typeof(v_new#>'{scienceLabBench,reactionLog}')<>'array' or
        jsonb_array_length(v_new#>'{scienceLabBench,reactionLog}')>1000)) then
    return false;
   end if;
   v_fields:=v_fields||array['scienceLabBench'];
   -- Live laboratory updates retire these two legacy fields by setting
   -- them undefined. Treat removal as safe, but never allow substitution.
   if v_old ? 'scienceReagents' and not (v_new ? 'scienceReagents') then
    v_fields:=v_fields||array['scienceReagents'];
   end if;
   if v_old ? 'scienceExperimentStage' and
      not (v_new ? 'scienceExperimentStage') then
    v_fields:=v_fields||array['scienceExperimentStage'];
   end if;
  end if;
  if v_kind='graph' and v_old ? 'schoolDiagram' and
     v_old->'schoolDiagram'->>'kind' in ('syntax','place-value') and
     v_new ? 'schoolDiagram' then
   if not lektrus_private.student_school_practice_allowed(
      v_old->'schoolDiagram',v_new->'schoolDiagram') then return false; end if;
   v_fields:=v_fields||array['schoolDiagram'];
  end if;
  if v_kind='graph' and
     v_old->'schoolDiagram'->>'kind'='atlas' and
     v_old->'schoolDiagram'->>'title'='Контурная карта' then
   v_old_atlas:=v_old->'schoolDiagram';
   v_new_atlas:=v_new->'schoolDiagram';
   if jsonb_typeof(v_new_atlas)<>'object' or
      (v_old_atlas - array['contourMarks','contourStrokes',
        'paintedCountries','contourLegend','contourCamera']) <>
      (v_new_atlas - array['contourMarks','contourStrokes',
        'paintedCountries','contourLegend','contourCamera']) then
    return false;
   end if;
   v_fields:=v_fields||array['schoolDiagram'];
  end if;
  if (v_old - v_fields) <> (v_new - v_fields) then return false; end if;
 end loop;

 for v_id,v_old in select key,value from jsonb_each(v_before_items) loop
  if v_after_items ? v_id then continue; end if;
  v_kind:=v_old->>'kind';
  if v_kind in ('pen','marker') then continue; end if;
  if v_old->>'createdBy' is distinct from p_actor::text or
     coalesce(v_old->>'locked','false')='true' or
     v_kind in ('frame','table','formula','graph','checklist','quiz',
                'flashcard','cover','linkmedia') then return false; end if;
 end loop;
 return true;
exception when data_exception or invalid_text_representation then
 return false;
end;
$delta$;

-- Applies to BOTH save_board_document() and admin_save_board_document(),
-- including future RPC implementations. On the direct table path permissions
-- are independently revoked below.
create or replace function lektrus_private.check_board_document_write()
returns trigger language plpgsql security definer
set search_path=pg_catalog,public,lektrus_private as $gate$
declare
 v_actor uuid := auth.uid();
 v_access jsonb;
 v_owner boolean;
 v_items jsonb;
 v_value jsonb;
begin
 if v_actor is null then
  raise exception 'Board write requires an authenticated user'
   using errcode='42501';
 end if;
 if tg_op='UPDATE' and new.board_id is distinct from old.board_id then
  raise exception 'Board ID is immutable' using errcode='42501';
 end if;
 -- A pupil can legitimately edit view/preview and their own text. Those fields
 -- still need structural/size validation: otherwise one direct RPC call could
 -- make an entire classboard unreadable or flood Realtime with large payloads.
 if jsonb_typeof(new.document)<>'object' or
    new.document->'version' is distinct from '1'::jsonb or
    jsonb_typeof(new.document->'items')<>'array' or
    jsonb_typeof(new.document->'title')<>'string' or
    length(new.document->>'title')>10000 or
    (new.document ? 'subject' and
      (jsonb_typeof(new.document->'subject')<>'string' or
       length(new.document->>'subject')>80)) or
    jsonb_typeof(new.document->'view')<>'object' or
    jsonb_typeof(new.document#>'{view,x}')<>'number' or
    jsonb_typeof(new.document#>'{view,y}')<>'number' or
    jsonb_typeof(new.document#>'{view,zoom}')<>'number' or
    (new.document ? 'preview' and
      (jsonb_typeof(new.document->'preview')<>'string' or
       length(new.document->>'preview')>6000000)) or
    pg_column_size(new.document)>24*1024*1024 then
  raise exception 'Malformed or oversized board document' using errcode='22023';
 end if;
 if abs((new.document#>>'{view,x}')::numeric)>=1000000000 or
    abs((new.document#>>'{view,y}')::numeric)>=1000000000 or
    (new.document#>>'{view,zoom}')::numeric<0.1 or
    (new.document#>>'{view,zoom}')::numeric>8 then
  raise exception 'Invalid board viewport' using errcode='22023';
 end if;
 v_access:=public.get_my_account_access();
 if not public.can_edit_board(new.board_id) and
    not coalesce((v_access->>'is_admin')::boolean,false) then
  raise exception 'Board editor permission required' using errcode='42501';
 end if;

 v_items:=lektrus_private.board_items_by_id(new.document);
 for v_value in select value from jsonb_each(v_items) loop
  if v_value->>'kind' in ('pen','marker') and
     coalesce(v_value->>'locked','false')='true' then
   raise exception 'Pen and marker strokes cannot be locked'
    using errcode='42501';
  end if;
 end loop;
 select exists(select 1 from public.boards b
   where b.id=new.board_id and b.owner_id=v_actor) into v_owner;
 if (v_access->>'role')='student' and not v_owner then
  if tg_op='INSERT' or not lektrus_private.student_document_delta_allowed(
     old.document,new.document,v_actor) then
   raise exception 'Student editor cannot modify other users or assignment structure'
    using errcode='42501';
  end if;
 end if;
 return new;
end;
$gate$;

drop trigger if exists trg_lektrus_board_document_auth on public.board_documents;
create trigger trg_lektrus_board_document_auth
before insert or update of document on public.board_documents
for each row execute function lektrus_private.check_board_document_write();

-- Preserve the legacy save RPC's document/history/activity semantics while
-- requiring optimistic version checks on *every* write (no NULL bypass).
-- This is a deliberate redefinition of v120, not a privileged alternative
-- endpoint. Client paths already pass the last acknowledged version or 0.
create or replace function public.save_board_document(
  p_board_id uuid,
  p_document jsonb,
  p_expected_version bigint default null
)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $versioned_save$
declare
  v_current_version bigint;
  v_current_document jsonb;
  v_next_version bigint;
  v_delta jsonb;
  v_name text;
  v_document_found boolean := false;
begin
  -- Every save must name its current base version. A NULL expected version
  -- historically disabled optimistic locking and allowed stale snapshots to
  -- overwrite a peer's work.
  if p_expected_version is null or p_expected_version<0 then
    raise exception 'Expected board document version is required'
      using errcode='22023';
  end if;
  if not public.can_edit_board(p_board_id) then
    raise exception 'Недостаточно прав для редактирования доски';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_board_id::text,0));

  select version, document
    into v_current_version, v_current_document
  from public.board_documents
  where board_id=p_board_id;

  -- IMPORTANT: capture FOUND immediately. Any later SELECT changes FOUND.
  v_document_found := found;

  select nullif(trim(display_name),'')
    into v_name
  from public.profiles
  where id=auth.uid();
  v_name := coalesce(v_name,'Участник');

  if not v_document_found then
    if p_expected_version<>0 then
      raise exception 'New board document requires expected version 0'
        using errcode='22023';
    end if;
    v_delta := public.board_item_delta('{"items":[]}'::jsonb,p_document);

    insert into public.board_documents(board_id,document,version,updated_at,updated_by)
    values(p_board_id,p_document,1,now(),auth.uid());

    insert into public.board_document_history(board_id,version,document,saved_at,saved_by)
    values(p_board_id,1,p_document,now(),auth.uid())
    on conflict do nothing;

    insert into public.board_activity(
      board_id,version,actor_id,actor_name,
      added_count,changed_count,removed_count,item_count
    )
    values(
      p_board_id,1,auth.uid(),v_name,
      (v_delta->>'added')::int,
      (v_delta->>'changed')::int,
      (v_delta->>'removed')::int,
      (v_delta->>'items')::int
    )
    on conflict(board_id,version) do nothing;

    update public.boards set updated_at=now() where id=p_board_id;

    return jsonb_build_object(
      'ok',true,'conflict',false,'version',1,'updated_at',now()
    );
  end if;

  if p_expected_version<>v_current_version then
    return jsonb_build_object(
      'ok',false,
      'conflict',true,
      'version',v_current_version,
      'document',v_current_document
    );
  end if;

  v_next_version := v_current_version+1;
  v_delta := public.board_item_delta(v_current_document,p_document);

  update public.board_documents
  set document=p_document,
      version=v_next_version,
      updated_at=now(),
      updated_by=auth.uid()
  where board_id=p_board_id;

  insert into public.board_document_history(board_id,version,document,saved_at,saved_by)
  values(p_board_id,v_next_version,p_document,now(),auth.uid())
  on conflict do nothing;

  insert into public.board_activity(
    board_id,version,actor_id,actor_name,
    added_count,changed_count,removed_count,item_count
  )
  values(
    p_board_id,v_next_version,auth.uid(),v_name,
    (v_delta->>'added')::int,
    (v_delta->>'changed')::int,
    (v_delta->>'removed')::int,
    (v_delta->>'items')::int
  )
  on conflict(board_id,version) do nothing;

  delete from public.board_document_history h
  where h.board_id=p_board_id
    and h.id not in (
      select id from public.board_document_history
      where board_id=p_board_id
      order by version desc
      limit 100
    );

  delete from public.board_activity a
  where a.board_id=p_board_id
    and a.id not in (
      select id from public.board_activity
      where board_id=p_board_id
      order by version desc
      limit 100
    );

  update public.boards set updated_at=now() where id=p_board_id;

  return jsonb_build_object(
    'ok',true,'conflict',false,'version',v_next_version,'updated_at',now()
  );
end
$versioned_save$;
revoke all on function public.save_board_document(uuid,jsonb,bigint) from public,anon;
grant execute on function public.save_board_document(uuid,jsonb,bigint) to authenticated;

-- An authorized client must use version-checked save_board_document RPC.
-- Removing direct writes also closes forged version / updated_by REST PATCHes.
revoke insert,update,delete on public.board_documents from public,anon,authenticated;
grant select on public.board_documents to authenticated;
revoke all on function lektrus_private.board_items_by_id(jsonb) from public,anon,authenticated;
revoke all on function lektrus_private.subject_responses_only(jsonb,jsonb,text) from public,anon,authenticated;
revoke all on function lektrus_private.student_school_practice_allowed(jsonb,jsonb) from public,anon,authenticated;
revoke all on function lektrus_private.student_document_delta_allowed(jsonb,jsonb,uuid) from public,anon,authenticated;
revoke all on function lektrus_private.check_board_document_write() from public,anon,authenticated;
commit;
