-- Lectris migration AUDIT, read-only.
-- Run FIRST on the old Supabase project and save the output securely.
-- Run AGAIN on the new Supabase project after database + Storage migration.
-- This script does not create, delete, update or restore anything.
-- Counts include private data but print NUMBERS ONLY, no user email or content.
do $lectris$
declare
  x record;
  n bigint;
begin
  for x in
    select * from (values
      ('auth','users'),
      ('auth','identities'),
      ('public','profiles'),
      ('public','boards'),
      ('public','board_members'),
      ('public','board_documents'),
      ('public','board_assets'),
      ('public','student_profiles'),
      ('public','student_sessions'),
      ('public','scheduled_lessons'),
      ('public','assignments'),
      ('public','submissions'),
      ('public','lesson_sessions'),
      ('public','board_share_links'),
      ('public','lectris_categories'),
      ('public','lectris_board_organization'),
      ('storage','buckets'),
      ('storage','objects')
    ) as tbl(schema_name,table_name)
  loop
    if to_regclass(format('%I.%I',x.schema_name,x.table_name)) is null then
      raise notice 'ABSENT % . %', x.schema_name, x.table_name;
    else
      execute format('select count(*)::bigint from %I.%I',x.schema_name,x.table_name) into n;
      raise notice 'COUNT %.% = %',x.schema_name,x.table_name,n;
    end if;
  end loop;
end
$lectris$;

-- Compare enabled database extensions between source and target.
select extname, extversion from pg_extension order by extname;

-- Compare Realtime publications and published tables.
select pubname, schemaname, tablename
from pg_publication_tables
where pubname = 'supabase_realtime'
order by schemaname, tablename;

-- Inspect bucket CONFIGURATION, not stored file bytes.
select id,name,public,file_size_limit,allowed_mime_types
from storage.buckets
order by name;

-- Optional RLS audit for key tables: security must stay enabled.
select schemaname,tablename,rowsecurity
from pg_tables
where schemaname='public' and tablename in (
  'boards','board_members','board_documents','lectris_categories','lectris_board_organization'
)
order by tablename;
