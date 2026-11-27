-- Shared sentence responses: permit only an exact permutation of teacher-defined IDs and the check flag.
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
 if p_before->>'kind'='sentence-builder' then
  if (p_before-array['answerOrder','answerChecked'])<>(p_after-array['answerOrder','answerChecked']) then return false; end if;
  if p_before=p_after then return true; end if;
  if jsonb_typeof(p_after->'answerOrder') is distinct from 'array' or
     jsonb_typeof(p_after->'answerChecked') is distinct from 'boolean' or
     jsonb_typeof(p_before->'parts') is distinct from 'array' then return false; end if;
  if jsonb_array_length(p_after->'answerOrder')<>jsonb_array_length(p_before->'parts') or
     jsonb_array_length(p_after->'answerOrder')>24 or
     exists(select 1 from jsonb_array_elements(p_after->'answerOrder') a(value) where jsonb_typeof(value)<>'string') then return false; end if;
  return array(select value from jsonb_array_elements_text(p_after->'answerOrder') a(value) order by value)=
         array(select value->>'id' from jsonb_array_elements(p_before->'parts') a(value) order by value->>'id');
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
  -- Connector endpoints are geometry, not lesson text or assignments.
  if v_kind='connector' and coalesce(v_old->>'locked','false')<>'true' then
    v_fields:=v_fields||array['connectorStart','connectorEnd','connectorStartBinding','connectorEndBinding'];
  end if;
  if coalesce(v_old->>'locked','false')<>'true' then
   if v_kind='sticky' then
    v_fields:=v_fields||array['stickerInk'];
   elsif v_kind='pdf' then
    v_fields:=v_fields||array['pdfPage'];
   elsif v_kind='instrument' then
    v_fields:=v_fields||array['instrumentScale'];
   elsif v_kind='graph' and not (v_old ? 'subjectBoardEntries') and not (v_old ? 'schoolDiagram') then
    if v_old->>'graphPurpose' in ('coordinates','number-line','geometry','unit-circle','function') then
     v_fields:=v_fields||array['graphPoints','graphSegments','graphAngles','graphCircles',
       'graphPolygons','graphTriangleLines','graphTriangleVertex','graphMidpoints','graphConstraints',
       'graphFreePathStart','graphGrid','graphSnap','graphMagneticSnap','graphAxisLabelScale',
       'graphXMin','graphXMax','graphYMin','graphYMax','graphRotationX','graphRotationY'];
    end if;
    if v_old->>'graphFigureId'='chem-periodic' then
     v_fields:=v_fields||array['sciencePeriodicHighlights','sciencePeriodicLayout'];
    end if;
    if v_old->>'graphFigureId' like 'physics-%' then
     v_fields:=v_fields||array['graphPoints','scienceMechanics','scienceOptics','scienceCircuit'];
    end if;
   end if;
  end if;
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
     v_old->'schoolDiagram'->>'kind' in ('syntax','place-value','sentence-builder') and
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
