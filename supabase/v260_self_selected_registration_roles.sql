-- Lektrus v260: assign teacher/student at initial signup (never by mutable JWT claims).
-- This project intentionally allows self-selected teaching accounts at registration.
-- No admin membership or paid subscription is granted by this trigger.
-- Existing profiles and role reviews are not modified.
begin;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  selected_role text := 'student';
begin
  -- Snapshot the choice once, on INSERT into auth.users.
  -- Never derive authorization directly from user_metadata after signup.
  if coalesce(new.email,'') <> ''
     and coalesce(new.raw_user_meta_data->>'is_guest','false') <> 'true'
     and new.raw_user_meta_data->>'registration_role' = 'teacher'
  then
    selected_role := 'teacher';
  end if;

  insert into public.profiles
    (id, display_name, email, first_name, last_name, account_role, teacher_status)
  values
    (new.id,
     coalesce(nullif(new.raw_user_meta_data->>'display_name',''),
              split_part(coalesce(new.email,''),'@',1),'Пользователь'),
     coalesce(new.email,''),
     coalesce(new.raw_user_meta_data->>'first_name',''),
     coalesce(new.raw_user_meta_data->>'last_name',''),
     selected_role,
     case when selected_role='teacher' then 'approved' else 'none' end)
  on conflict (id) do update set
    display_name=excluded.display_name,
    email=excluded.email,
    first_name=excluded.first_name,
    last_name=excluded.last_name;
    -- Existing profile roles/statuses remain unchanged on conflict.
  return new;
end;
$$;

revoke all on function public.handle_new_user() from public,anon,authenticated;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users for each row
  execute function public.handle_new_user();

commit;
