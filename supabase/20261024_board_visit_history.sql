-- Lektrus: persist exact board visits separately from lesson notes.
-- Heartbeat timestamps come from Postgres; clients cannot forge attendance.
create table if not exists public.board_visit_sessions (
  id uuid primary key,
  board_id uuid not null references public.boards(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  started_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  ended_at timestamptz,
  constraint board_visit_order check (
    last_seen_at >= started_at and (ended_at is null or ended_at >= started_at)
  )
);
create index if not exists board_visit_board_recent_idx
  on public.board_visit_sessions(board_id,started_at desc);
create index if not exists board_visit_user_recent_idx
  on public.board_visit_sessions(user_id,started_at desc);

alter table public.board_visit_sessions enable row level security;
revoke all on public.board_visit_sessions from anon,authenticated;
-- No direct RLS policies: only narrowly authorized RPCs below may access it.

create or replace function public.record_board_visit(
  p_board_id uuid,p_session_id uuid,p_action text default 'ping'
) returns void
language plpgsql security definer set search_path = ''
as $$
declare v_user uuid := auth.uid();
begin
  if v_user is null or p_board_id is null or p_session_id is null
     or p_action not in ('ping','leave') then
    raise exception 'Некорректная запись посещения' using errcode='22023';
  end if;
  if not public.can_access_board(p_board_id) then
    raise exception 'Нет доступа к доске' using errcode='42501';
  end if;
  if p_action='ping' then
    insert into public.board_visit_sessions(id,board_id,user_id)
    values(p_session_id,p_board_id,v_user)
    on conflict (id) do update
      set last_seen_at=greatest(
        public.board_visit_sessions.last_seen_at,pg_catalog.now())
      where public.board_visit_sessions.board_id=p_board_id
        and public.board_visit_sessions.user_id=v_user
        and public.board_visit_sessions.ended_at is null;
  else
    update public.board_visit_sessions
       set last_seen_at=greatest(last_seen_at,pg_catalog.now()),
           ended_at=pg_catalog.now()
     where id=p_session_id and board_id=p_board_id and user_id=v_user
       and ended_at is null;
  end if;
end;
$$;

create or replace function public.list_board_visits(
 p_board_id uuid,p_student_id uuid default null,p_limit integer default 150
) returns table (
 visit_id uuid,board_id uuid,user_id uuid,user_name text,board_title text,
 started_at timestamptz,left_at timestamptz,
 duration_seconds integer,active boolean
)
language plpgsql security definer set search_path = ''
as $$
begin
 if auth.uid() is null or not exists(
   select 1 from public.boards b
    where b.id=p_board_id and b.deleted_at is null
      and (b.owner_id=auth.uid() or public.is_app_admin(auth.uid()))
 ) then
   raise exception 'Журнал посещений доступен владельцу доски'
     using errcode='42501';
 end if;
 return query
 select v.id,v.board_id,v.user_id,
   coalesce(nullif(p.display_name,''),'Участник')::text,b.title,
   v.started_at,
   case when v.ended_at is not null then v.ended_at
        when v.last_seen_at<now()-interval '70 seconds'
         then v.last_seen_at+interval '35 seconds'
        else null end as left_at,
   greatest(0,extract(epoch from (
     case when v.ended_at is not null then v.ended_at
          when v.last_seen_at<now()-interval '70 seconds'
            then v.last_seen_at+interval '35 seconds'
          else now() end-v.started_at
   ))::integer) as duration_seconds,
   (v.ended_at is null and v.last_seen_at>=now()-interval '70 seconds') as active
 from public.board_visit_sessions v
 join public.boards b on b.id=v.board_id
 left join public.profiles p on p.id=v.user_id
 where v.board_id=p_board_id
   and (p_student_id is null or v.user_id=p_student_id)
   and v.user_id<>b.owner_id
 order by v.started_at desc
 limit least(greatest(coalesce(p_limit,150),1),200);
end;
$$;

create or replace function public.list_student_board_visits(
 p_student_id uuid,p_limit integer default 100
) returns table (
 visit_id uuid,board_id uuid,user_id uuid,user_name text,board_title text,
 started_at timestamptz,left_at timestamptz,
 duration_seconds integer,active boolean
)
language plpgsql security definer set search_path = ''
as $$
begin
 if auth.uid() is null then
  raise exception 'Требуется вход' using errcode='42501';
 end if;
 return query
 select v.id,v.board_id,v.user_id,
   coalesce(nullif(p.display_name,''),'Участник')::text,b.title,
   v.started_at,
   case when v.ended_at is not null then v.ended_at
        when v.last_seen_at<now()-interval '70 seconds'
         then v.last_seen_at+interval '35 seconds'
        else null end as left_at,
   greatest(0,extract(epoch from (
     case when v.ended_at is not null then v.ended_at
          when v.last_seen_at<now()-interval '70 seconds'
            then v.last_seen_at+interval '35 seconds'
          else now() end-v.started_at
   ))::integer) as duration_seconds,
   (v.ended_at is null and v.last_seen_at>=now()-interval '70 seconds') as active
 from public.board_visit_sessions v
 join public.boards b on b.id=v.board_id
 left join public.profiles p on p.id=v.user_id
 where v.user_id=p_student_id and b.deleted_at is null
   and (b.owner_id=auth.uid() or public.is_app_admin(auth.uid()))
   and v.user_id<>b.owner_id
 order by v.started_at desc
 limit least(greatest(coalesce(p_limit,100),1),200);
end;
$$;

revoke all on function public.record_board_visit(uuid,uuid,text) from public,anon;
revoke all on function public.list_board_visits(uuid,uuid,integer) from public,anon;
revoke all on function public.list_student_board_visits(uuid,integer) from public,anon;
grant execute on function public.record_board_visit(uuid,uuid,text) to authenticated;
grant execute on function public.list_board_visits(uuid,uuid,integer) to authenticated;
grant execute on function public.list_student_board_visits(uuid,integer) to authenticated;
