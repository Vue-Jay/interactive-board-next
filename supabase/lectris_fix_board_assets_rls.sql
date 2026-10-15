-- Lektrus: restore private board attachment RLS after migration to a new Supabase.
-- Run ONLY in the NEW Supabase project's SQL Editor, with an administrator DB role.
-- This migration is idempotent and does not copy/delete any files or make a bucket public.
-- It cannot grant editor access to someone who is a viewer.
--
-- Why: the Storage API inserts into storage.objects, whose policies may not
-- have been restored when database data and bucket objects were migrated.
--
-- First review: supabase/lectris_board_assets_rls_audit.sql
begin;

do $preflight$
begin
  if to_regclass('storage.objects') is null or to_regclass('storage.buckets') is null then
    raise exception 'Supabase Storage schema is missing. Do not apply this migration.';
  end if;
  if to_regprocedure('public.can_access_board(uuid)') is null or
     to_regprocedure('public.can_edit_board(uuid)') is null then
    raise exception 'Missing board permission functions. Restore the board schema first.';
  end if;
  if not exists(select 1 from storage.buckets where id='board-assets') then
    raise exception 'Missing private bucket board-assets. Restore/check Storage buckets before applying policies.';
  end if;
end
$preflight$;

-- Only names "UUID/asset-id" map to a board. Bad/malicious paths resolve to
-- NULL and fail the access check instead of raising a cast exception.
create or replace function public.board_asset_board_id(object_name text)
returns uuid language sql immutable set search_path=public as $$
  select case when object_name ~
    '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/[a-zA-Z0-9_-]+$'
    then split_part(object_name,'/',1)::uuid
    else null end;
$$;

-- Restore only the four application-owned board-assets policies.
-- Leave all other Storage buckets and unrelated policies untouched.
drop policy if exists board_assets_read on storage.objects;
create policy board_assets_read on storage.objects
  for select to authenticated
  using (bucket_id='board-assets'
    and public.can_access_board(public.board_asset_board_id(name)));

drop policy if exists board_assets_insert on storage.objects;
create policy board_assets_insert on storage.objects
  for insert to authenticated
  with check (bucket_id='board-assets'
    and public.can_edit_board(public.board_asset_board_id(name)));

drop policy if exists board_assets_update on storage.objects;
create policy board_assets_update on storage.objects
  for update to authenticated
  using (bucket_id='board-assets'
    and public.can_edit_board(public.board_asset_board_id(name)))
  with check (bucket_id='board-assets'
    and public.can_edit_board(public.board_asset_board_id(name)));

-- Deleting files of trashed boards remains owner-only, consistent with v71.
drop policy if exists board_assets_delete on storage.objects;
create policy board_assets_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id='board-assets'
    and (
      public.can_edit_board(public.board_asset_board_id(name))
      or exists (
        select 1 from public.boards b
        where b.id=public.board_asset_board_id(name)
          and b.owner_id=auth.uid()
          and b.deleted_at is not null
      )
    )
  );

-- Administrators can edit inspected boards through a separate, server-side
-- admin maintenance function (v246). Restore those Storage policies ONLY when
-- the actual server-side permission function exists in this project.
-- Do not create a fake/admin-everyone function or use service_role in the app.
do $admin_policies$
begin
  if to_regprocedure('public.admin_can_maintain_boards()') is not null then
    execute 'drop policy if exists "admin maintenance select board assets" on storage.objects';
    execute 'create policy "admin maintenance select board assets" on storage.objects
      for select to authenticated
      using (bucket_id=''board-assets'' and public.admin_can_maintain_boards())';

    execute 'drop policy if exists "admin maintenance upload board assets" on storage.objects';
    execute 'create policy "admin maintenance upload board assets" on storage.objects
      for insert to authenticated
      with check (bucket_id=''board-assets'' and public.admin_can_maintain_boards())';

    execute 'drop policy if exists "admin maintenance update board assets" on storage.objects';
    execute 'create policy "admin maintenance update board assets" on storage.objects
      for update to authenticated
      using (bucket_id=''board-assets'' and public.admin_can_maintain_boards())
      with check (bucket_id=''board-assets'' and public.admin_can_maintain_boards())';
  end if;
end
$admin_policies$;

commit;

-- Expected: storage.objects has board_assets_insert FOR INSERT to authenticated,
-- and optionally "admin maintenance upload board assets".
-- Bucket stays private, user must be owner/editor or authorized admin.
