-- Lektrus marketing site visual editor. Apply only to the intended Supabase project.
-- Publishing is restricted to the existing app administrator role.
begin;
create table if not exists public.marketing_site_settings(
 setting_key text primary key check(setting_key='default'),
 document jsonb not null,
 updated_at timestamptz not null default now(),
 updated_by uuid references auth.users(id) on delete set null
);
alter table public.marketing_site_settings enable row level security;
revoke all on public.marketing_site_settings from public,anon,authenticated;
grant select on public.marketing_site_settings to anon,authenticated;
drop policy if exists marketing_site_public_read on public.marketing_site_settings;
create policy marketing_site_public_read on public.marketing_site_settings
 for select to anon,authenticated using(true);

create or replace function public.admin_publish_marketing_site(p_document jsonb)
returns void
language plpgsql security definer set search_path=public as $$
begin
 if auth.uid() is null or not public.is_app_admin(auth.uid()) then
  raise exception 'Доступно только администратору Lektrus' using errcode='42501';
 end if;
 if p_document is null or jsonb_typeof(p_document)<>'object'
  or p_document->>'version' <> '1'
  or jsonb_typeof(p_document->'navigation')<>'array'
  or jsonb_typeof(p_document->'customPages')<>'array'
  or octet_length(p_document::text)>262144 then
  raise exception 'Неверный формат или слишком большой размер сайта' using errcode='22023';
 end if;
 insert into public.marketing_site_settings(setting_key,document,updated_at,updated_by)
 values('default',p_document,now(),auth.uid())
 on conflict(setting_key) do update
 set document=excluded.document,updated_at=excluded.updated_at,updated_by=excluded.updated_by;
end $$;
revoke all on function public.admin_publish_marketing_site(jsonb) from public,anon;
grant execute on function public.admin_publish_marketing_site(jsonb) to authenticated;
commit;
