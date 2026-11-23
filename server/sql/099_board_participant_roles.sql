-- Explicit board-local educational context. Access permission remains editor/viewer.
-- Snapshot existing memberships once; changing account status never changes this column.
ALTER TABLE board_members ADD COLUMN IF NOT EXISTS participant_role text;
ALTER TABLE board_invites ADD COLUMN IF NOT EXISTS participant_role text;
ALTER TABLE board_share_links ADD COLUMN IF NOT EXISTS participant_role text;
UPDATE board_members m SET participant_role=CASE
    WHEN m.role='viewer' THEN 'observer'
    WHEN u.account_role='teacher' AND u.teacher_status='approved' AND u.guest_board_id IS NULL THEN 'co_teacher'
    ELSE 'student' END
FROM account_users u WHERE u.id=m.user_id AND m.participant_role IS NULL;
UPDATE board_invites SET participant_role=CASE WHEN role='viewer' THEN 'observer' ELSE 'student' END WHERE participant_role IS NULL;
UPDATE board_share_links SET participant_role=CASE WHEN role='viewer' THEN 'observer' ELSE 'student' END WHERE participant_role IS NULL;
ALTER TABLE board_members ADD CONSTRAINT board_members_participant_role_valid CHECK (
    participant_role IS NULL OR (role='viewer' AND participant_role='observer') OR
    (role='editor' AND participant_role IN ('student','co_teacher')));
ALTER TABLE board_invites ADD CONSTRAINT board_invites_participant_role_valid CHECK (
    participant_role IS NULL OR (role='viewer' AND participant_role='observer') OR
    (role='editor' AND participant_role IN ('student','co_teacher')));
ALTER TABLE board_share_links ADD CONSTRAINT board_links_participant_role_valid CHECK (
    participant_role IS NULL OR (role='viewer' AND participant_role='observer') OR
    (role='editor' AND participant_role IN ('student','co_teacher')));
-- NULL is reserved for pre-feature internal fixtures/legacy direct writes;
-- all application invitation paths set an explicit role.
CREATE SCHEMA IF NOT EXISTS lektrus_private;
REVOKE ALL ON SCHEMA lektrus_private FROM PUBLIC;
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

