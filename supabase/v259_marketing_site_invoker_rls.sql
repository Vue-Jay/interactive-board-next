-- Harden site publication: enforce admin-only INSERT/UPDATE through RLS
-- so the public RPC can run with caller privileges (SECURITY INVOKER).
begin;
grant insert,update on public.marketing_site_settings to authenticated;

drop policy if exists marketing_site_admin_insert on public.marketing_site_settings;
create policy marketing_site_admin_insert on public.marketing_site_settings
 for insert to authenticated
 with check (auth.uid() is not null and public.is_app_admin(auth.uid()));

drop policy if exists marketing_site_admin_update on public.marketing_site_settings;
create policy marketing_site_admin_update on public.marketing_site_settings
 for update to authenticated
 using (auth.uid() is not null and public.is_app_admin(auth.uid()))
 with check (auth.uid() is not null and public.is_app_admin(auth.uid()));

alter function public.admin_publish_marketing_site(jsonb) security invoker;
revoke all on function public.admin_publish_marketing_site(jsonb) from public,anon;
grant execute on function public.admin_publish_marketing_site(jsonb) to authenticated;
commit;
