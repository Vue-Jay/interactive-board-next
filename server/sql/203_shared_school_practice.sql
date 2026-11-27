create or replace function lektrus_private.shared_practice_allowed(p jsonb,d jsonb)
returns boolean language plpgsql immutable set search_path=pg_catalog as $practice$
declare k text; expected text[]; codes jsonb; n integer; selected jsonb;
begin
 if jsonb_typeof(p)<>'object' or jsonb_typeof(d)<>'object' or
    coalesce(p->>'key','') !~ '^[0-9a-f]{8}$' then return false; end if;
 k:=p->>'kind';
 case k
 when 'sentence' then
  if d->>'kind'<>'sentence-builder' then return false; end if;
  expected:=array['kind','key','order','checked'];
  select jsonb_agg(value->'id') into codes from jsonb_array_elements(d->'parts');
  if jsonb_typeof(p->'checked')<>'boolean' then return false; end if;
 when 'geo-matching' then
  if d->>'kind'<>'geo-training' or d->>'exercise'<>'matching' then return false; end if;
  expected:=array['kind','key','order','matched','selected','wrong','feedback'];
  codes:=d->'countryCodes';
  if jsonb_typeof(p->'matched')<>'array' or not ((p->'order') @> (p->'matched')) or
     jsonb_array_length(p->'matched')<>(select count(distinct value) from jsonb_array_elements(p->'matched')) or
     coalesce(p->>'wrong','') !~ '^[0-9]{1,6}$' or (p->>'wrong')::integer>100000 or
     coalesce(p->>'feedback','invalid') not in ('','correct','wrong') then return false; end if;
  selected:=p->'selected';
  if selected<>'null'::jsonb and (jsonb_typeof(selected)<>'object' or
     not (selected ?& array['side','code']) or (selected-array['side','code'])<>'{}'::jsonb or coalesce(selected->>'side','') not in ('left','right') or
     not (codes @> jsonb_build_array(selected->'code'))) then return false; end if;
 when 'geo-cards' then
  if d->>'kind'<>'geo-training' or d->>'exercise'<>'cards' then return false; end if;
  expected:=array['kind','key','order','index','revealed','known'];
  codes:=d->'countryCodes';
  if jsonb_typeof(p->'known')<>'array' or not ((p->'order') @> (p->'known')) or
     jsonb_array_length(p->'known')<>(select count(distinct value) from jsonb_array_elements(p->'known')) or
     jsonb_typeof(p->'revealed')<>'boolean' then return false; end if;
  n:=jsonb_array_length(codes);
 when 'language-cards' then
  if d->>'kind'<>'flashcards' or jsonb_typeof(p->'revealed')<>'boolean' then return false; end if;
  expected:=array['kind','key','index','revealed'];
  n:=jsonb_array_length(d->'cards');
 when 'orthography' then
  if d->>'kind'<>'orthography' or jsonb_typeof(p->'checked')<>'boolean' then return false; end if;
  expected:=array['kind','key','index','picked','checked'];
  n:=jsonb_array_length(d->'questions');
 else return false;
 end case;
 if not (p ?& expected) or (p-expected)<>'{}'::jsonb then return false; end if;
 if codes is not null and (jsonb_typeof(p->'order')<>'array' or
    jsonb_array_length(p->'order')<>jsonb_array_length(codes) or not ((p->'order') @> codes) or
    not (codes @> (p->'order'))) then return false; end if;
 if n is not null and (jsonb_typeof(p->'index')<>'number' or
    coalesce(p->>'index','') !~ '^[0-9]{1,2}$' or (p->>'index')::integer>=n) then return false; end if;
 if k='orthography' then
  if p->'picked'='null'::jsonb then
   if p->'checked'='true'::jsonb then return false; end if;
  elsif jsonb_typeof(p->'picked')<>'number' or coalesce(p->>'picked','') !~ '^[0-9]$' or
   (p->>'picked')::integer>=jsonb_array_length(d->'questions'->((p->>'index')::integer)->'options') then return false;
  end if;
 end if;
 return true;
exception when data_exception or invalid_text_representation then return false;
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
     coalesce(v_old->>'locked','false')<>'true' and
     v_old->'schoolPractice' is distinct from v_new->'schoolPractice' then
   if v_new ? 'schoolPractice' and not lektrus_private.shared_practice_allowed(v_new->'schoolPractice',v_old->'schoolDiagram') then return false; end if;
   v_fields:=v_fields||array['schoolPractice'];
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
