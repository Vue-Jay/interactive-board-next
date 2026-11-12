-- Lektrus public marketing media library (additive and isolated from lessons).
-- Public read, but only app administrators may upload new site assets.
begin;
insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('marketing-site','marketing-site',true,5242880,array['image/jpeg','image/png','image/webp']::text[])
on conflict(id) do nothing;

drop policy if exists marketing_site_admin_insert on storage.objects;
create policy marketing_site_admin_insert
 on storage.objects for insert to authenticated
 with check (bucket_id='marketing-site' and auth.uid() is not null and public.is_app_admin(auth.uid()));

-- Site assets are intentionally public (unlike board documents).
drop policy if exists marketing_site_public_select on storage.objects;
create policy marketing_site_public_select
 on storage.objects for select to anon,authenticated
 using (bucket_id='marketing-site');

commit;
