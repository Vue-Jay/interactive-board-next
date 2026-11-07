-- Lektrus v250: editable account profile fields with row and column safeguards.
alter table public.profiles add column if not exists first_name text not null default '';
alter table public.profiles add column if not exists last_name text not null default '';
alter table public.profiles add column if not exists middle_name text not null default '';
alter table public.profiles add column if not exists phone text not null default '';
alter table public.profiles add column if not exists city text not null default '';
alter table public.profiles add column if not exists organization text not null default '';
alter table public.profiles add column if not exists focus_area text not null default '';
alter table public.profiles add column if not exists bio text not null default '';

insert into public.profiles(id,display_name,email,created_at)
select id,coalesce(nullif(raw_user_meta_data->>'display_name',''),split_part(coalesce(email,''),'@',1),'Пользователь'),coalesce(email,''),created_at
from auth.users on conflict(id) do nothing;
update public.profiles p set
 first_name=coalesce(nullif(p.first_name,''),u.raw_user_meta_data->>'first_name',''),
 last_name=coalesce(nullif(p.last_name,''),u.raw_user_meta_data->>'last_name','')
from auth.users u where u.id=p.id;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  insert into public.profiles(id,display_name,email,first_name,last_name)
  values(new.id,coalesce(nullif(new.raw_user_meta_data->>'display_name',''),split_part(coalesce(new.email,''),'@',1),'Пользователь'),coalesce(new.email,''),coalesce(new.raw_user_meta_data->>'first_name',''),coalesce(new.raw_user_meta_data->>'last_name',''))
  on conflict(id) do update set display_name=excluded.display_name,email=excluded.email,first_name=excluded.first_name,last_name=excluded.last_name;
  return new;
end;
$$;

drop policy if exists profiles_self_update_details on public.profiles;
create policy profiles_self_update_details on public.profiles for update to authenticated
using (id=auth.uid()) with check (id=auth.uid());
revoke update on public.profiles from public,anon,authenticated;
grant update(first_name,last_name,middle_name,phone,city,organization,focus_area,bio) on public.profiles to authenticated;
grant select on public.profiles to authenticated;
