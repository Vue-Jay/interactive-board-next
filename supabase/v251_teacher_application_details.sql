-- Lektrus v251: collect professional information as part of a teacher request.
alter table public.profiles add column if not exists teacher_application jsonb not null default '{}'::jsonb;

drop function if exists public.request_teacher_access();
create or replace function public.request_teacher_access(p_application jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_phone text;v_city text;v_organization text;v_focus_area text;
begin
 if auth.uid() is null then raise exception 'Требуется авторизация'; end if;
 if public.is_app_admin(auth.uid()) then return public.get_my_account_access(); end if;
 if p_application is null or jsonb_typeof(p_application)<>'object' or octet_length(p_application::text)>8192 then
   raise exception 'Проверьте заполнение заявки' using errcode='22023';
 end if;
 v_phone:=left(btrim(coalesce(p_application->>'phone','')),40);
 v_city:=left(btrim(coalesce(p_application->>'city','')),100);
 v_organization:=left(btrim(coalesce(p_application->>'organization','')),160);
 v_focus_area:=left(btrim(coalesce(p_application->>'focusArea','')),120);
 if length(v_organization)<2 or length(v_focus_area)<2 then
   raise exception 'Укажите место работы и предметы, которые планируете преподавать' using errcode='22023';
 end if;
 if v_phone<>'' and v_phone !~ '^[+0-9 ()-]{7,40}$' then
   raise exception 'Проверьте номер телефона' using errcode='22023';
 end if;
 update public.profiles set
   account_role='student',teacher_status='pending',teacher_requested_at=now(),teacher_reviewed_at=null,teacher_reviewed_by=null,
   teacher_application=jsonb_build_object(
     'phone',v_phone,'city',v_city,'organization',v_organization,'focusArea',v_focus_area,
     'experience',left(btrim(coalesce(p_application->>'experience','')),1000),
     'motivation',left(btrim(coalesce(p_application->>'motivation','')),1000)
   ),
   phone=v_phone,city=v_city,organization=v_organization,focus_area=v_focus_area
 where id=auth.uid();
 return public.get_my_account_access();
end $$;
revoke all on function public.request_teacher_access(jsonb) from public,anon,authenticated;
grant execute on function public.request_teacher_access(jsonb) to authenticated;

-- Keep older clients compatible when the account already has the required
-- professional details; users without them are directed to the new form.
create or replace function public.request_teacher_access()
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_application jsonb;
begin
 select jsonb_build_object(
   'phone',phone,'city',city,'organization',organization,'focusArea',focus_area,
   'experience','','motivation',''
 ) into v_application from public.profiles where id=auth.uid();
 return public.request_teacher_access(v_application);
end $$;
revoke all on function public.request_teacher_access() from public,anon,authenticated;
grant execute on function public.request_teacher_access() to authenticated;

create or replace function public.list_teacher_requests()
returns jsonb language plpgsql stable security definer set search_path=public as $$
begin
 if not public.is_app_admin(auth.uid()) then raise exception 'Недостаточно прав' using errcode='42501'; end if;
 return coalesce((select jsonb_agg(jsonb_build_object(
   'user_id',p.id,'name',p.display_name,'email',p.email,'status',p.teacher_status,
   'requested_at',p.teacher_requested_at,'reviewed_at',p.teacher_reviewed_at,
   'application',coalesce(p.teacher_application,'{}'::jsonb)
 ) order by case p.teacher_status when 'pending' then 0 else 1 end,p.teacher_requested_at desc nulls last)
 from public.profiles p where p.teacher_status in ('pending','approved','rejected')),'[]'::jsonb);
end $$;
revoke all on function public.list_teacher_requests() from public,anon,authenticated;
grant execute on function public.list_teacher_requests() to authenticated;

create or replace function public.set_my_account_role(p_role text)
returns text language plpgsql security definer set search_path=public as $$
begin
 if auth.uid() is null then raise exception 'Требуется авторизация'; end if;
 if p_role='teacher' then raise exception 'Отправьте заявку преподавателя через настройки аккаунта';
 elsif p_role='student' then
   update public.profiles set account_role='student',teacher_status=case when teacher_status='approved' then 'none' else teacher_status end where id=auth.uid();
   return 'student';
 end if;
 raise exception 'Некорректная роль';
end $$;
