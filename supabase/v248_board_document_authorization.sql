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
 v_result jsonb := '{}'::jsonb;
 v_item jsonb;
 v_id text;
 v_count integer := 0;
begin
 if jsonb_typeof(p_document)<>'object' or
    jsonb_typeof(p_document->'items')<>'array' or
    (p_document ? 'ink' and jsonb_typeof(p_document->'ink')<>'array') then
  raise exception 'Invalid board item collections' using errcode='22023';
 end if;
 for v_item in
  select value from jsonb_array_elements(p_document->'items')
  union all
  select value->'stroke' from jsonb_array_elements(
   coalesce(p_document->'ink','[]'::jsonb))
 loop
  v_count:=v_count+1;
  v_id:=v_item->>'id';
  if v_count>10000 or jsonb_typeof(v_item)<>'object'
     or v_id is null or length(v_id)<1 or length(v_id)>160
     or v_result ? v_id
     or coalesce(v_item->>'kind','') not in
      ('sticky','text','shape','pen','marker','image','pdf','frame',
       'connector','comment','table','formula','graph','fraction',
       'checklist','quiz','flashcard','cover','linkmedia','instrument') then
   raise exception 'Invalid or duplicate board item ID/kind' using errcode='22023';
  end if;
  v_result:=v_result||jsonb_build_object(v_id,v_item);
 end loop;
 return v_result;
end;
$items$;

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

-- An authorized client must use version-checked save_board_document RPC.
-- Removing direct writes also closes forged version / updated_by REST PATCHes.
revoke insert,update,delete on public.board_documents from public,anon,authenticated;
grant select on public.board_documents to authenticated;
revoke all on function lektrus_private.board_items_by_id(jsonb) from public,anon,authenticated;
revoke all on function lektrus_private.student_document_delta_allowed(jsonb,jsonb,uuid) from public,anon,authenticated;
revoke all on function lektrus_private.check_board_document_write() from public,anon,authenticated;
commit;
