-- Lektrus v249: publish the administrator's interface layout application-wide.
-- Run after v82_teacher_approval.sql, which defines public.is_app_admin(uuid).

create table if not exists public.global_interface_settings (
  setting_key text primary key check (setting_key = 'default'),
  layout jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);
alter table public.global_interface_settings enable row level security;
revoke all on public.global_interface_settings from public, anon, authenticated;

create or replace function public.get_global_interface_layout()
returns table(layout jsonb)
language sql stable security definer set search_path=public as $$
  select s.layout from public.global_interface_settings s where s.setting_key='default'
$$;
revoke all on function public.get_global_interface_layout() from public, anon;
grant execute on function public.get_global_interface_layout() to authenticated;

create or replace function public.admin_publish_interface_layout(p_layout jsonb)
returns void
language plpgsql security definer set search_path=public as $$
begin
  if not public.is_app_admin(auth.uid()) then
    raise exception 'Недостаточно прав' using errcode='42501';
  end if;
  if p_layout is null or jsonb_typeof(p_layout)<>'object' or octet_length(p_layout::text)>1048576 then
    raise exception 'Некорректные настройки интерфейса' using errcode='22023';
  end if;
  insert into public.global_interface_settings(setting_key,layout,updated_at,updated_by)
  values('default',p_layout,now(),auth.uid())
  on conflict(setting_key) do update
  set layout=excluded.layout,updated_at=excluded.updated_at,updated_by=excluded.updated_by;
end
$$;
revoke all on function public.admin_publish_interface_layout(jsonb) from public, anon;
grant execute on function public.admin_publish_interface_layout(jsonb) to authenticated;
