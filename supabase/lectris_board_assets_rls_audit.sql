-- Lektrus read-only Storage/RLS audit for a NEW Supabase target project.
-- Run in the SQL Editor BEFORE/AFTER lectris_fix_board_assets_rls.sql.
-- It shows policies/configuration, not credentials, file contents or user data.
-- NOTE: auth.uid() in the SQL Editor is usually NULL. This is not an upload
-- simulation. Test a real signed-in editor from Lektrus after applying fixes.

select
  b.id as bucket_id,
  b.public as publicly_accessible,
  b.file_size_limit,
  b.allowed_mime_types
from storage.buckets b where b.id='board-assets';

select
  p.policyname,
  p.cmd,
  p.roles,
  p.permissive,
  p.qual as condition_on_existing_row,
  p.with_check as condition_on_new_row
from pg_policies p
where p.schemaname='storage' and p.tablename='objects'
  and (
    p.policyname like 'board_assets_%'
    or p.policyname like 'admin maintenance %board assets'
    or p.permissive='RESTRICTIVE'
  )
order by p.cmd,p.policyname;

select
  to_regprocedure('public.board_asset_board_id(text)') is not null as asset_path_function_exists,
  to_regprocedure('public.can_access_board(uuid)') is not null as access_function_exists,
  to_regprocedure('public.can_edit_board(uuid)') is not null as edit_function_exists,
  to_regprocedure('public.admin_can_maintain_boards()') is not null as admin_maintenance_function_exists;

select
  c.relrowsecurity as storage_rls_enabled,
  c.relforcerowsecurity as storage_rls_forced
from pg_class c where c.oid='storage.objects'::regclass;

-- Optional: check one known board ID without revealing board data. Replace
-- the UUID inside the SQL Editor only; do not paste private IDs into GitHub.
-- select id, deleted_at is null as active from public.boards
-- where id='00000000-0000-0000-0000-000000000000'::uuid;
