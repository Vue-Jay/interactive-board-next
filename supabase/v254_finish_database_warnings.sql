-- Lektrus v254: keep RPC behavior while moving SECURITY DEFINER implementations
-- out of the exposed API schema, and remove avoidable RLS evaluation warnings.

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated, service_role;

do $migration$
declare
  v_function record;
  v_call_args text;
  v_body text;
  v_volatility text;
  v_parallel text;
  v_options text;
begin
  -- Public invoker wrappers preserve the RPC names, signatures, defaults,
  -- results, and grants. The implementation keeps its SECURITY DEFINER bit
  -- and ACL after moving to the non-exposed private schema.
  for v_function in
    select p.oid,
           p.proname,
           pg_get_function_identity_arguments(p.oid) as identity_args,
           pg_get_function_arguments(p.oid) as arguments,
           pg_get_function_result(p.oid) as result_type,
           p.pronargs,
           p.proretset,
           p.prorettype,
           p.provolatile,
           p.proparallel,
           p.proisstrict,
           p.procost,
           p.prorows
    from pg_proc p
    join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public'
      and p.prokind='f'
      and p.prosecdef
      and has_function_privilege('authenticated',p.oid,'execute')
    order by p.proname, pg_get_function_identity_arguments(p.oid)
  loop
    select coalesce(string_agg(format('$%s', arg_no), ', ' order by arg_no), '')
      into v_call_args
      from generate_series(1, v_function.pronargs) as args(arg_no);

    if v_function.prorettype='void'::regtype then
      v_body := format('begin perform private.%I(%s); return; end;', v_function.proname, v_call_args);
    elsif v_function.proretset then
      v_body := format('begin return query select * from private.%I(%s); return; end;', v_function.proname, v_call_args);
    else
      v_body := format('begin return private.%I(%s); end;', v_function.proname, v_call_args);
    end if;

    v_volatility := case v_function.provolatile
      when 'i' then 'IMMUTABLE'
      when 's' then 'STABLE'
      else 'VOLATILE'
    end;
    v_parallel := case v_function.proparallel
      when 's' then 'SAFE'
      when 'r' then 'RESTRICTED'
      else 'UNSAFE'
    end;
    v_options := format('%s %s PARALLEL %s COST %s',
      v_volatility,
      case when v_function.proisstrict then 'STRICT' else 'CALLED ON NULL INPUT' end,
      v_parallel,
      v_function.procost);
    if v_function.proretset then
      v_options := v_options || format(' ROWS %s', v_function.prorows);
    end if;

    execute format(
      'alter function public.%I(%s) set schema private',
      v_function.proname,
      v_function.identity_args
    );

    execute format(
      'create function public.%I(%s) returns %s language plpgsql %s security invoker set search_path = pg_catalog as $wrapper$ %s $wrapper$',
      v_function.proname,
      v_function.arguments,
      v_function.result_type,
      v_options,
      v_body
    );

    execute format(
      'revoke all on function public.%I(%s) from public, anon, authenticated, service_role',
      v_function.proname,
      v_function.identity_args
    );

    -- All functions selected above are currently callable by authenticated;
    -- service_role also has the original implementation grant.
    execute format('grant execute on function public.%I(%s) to authenticated, service_role',
      v_function.proname, v_function.identity_args);
  end loop;
end
$migration$;

-- Make the auth identity lookup stable for each statement instead of each row.
do $policies$
declare
  v_policy record;
  v_using text;
  v_check text;
  v_sql text;
begin
  for v_policy in
    select schemaname, tablename, policyname, qual, with_check
    from pg_policies
    where schemaname='public'
      and (coalesce(qual,'') like '%auth.uid()%'
        or coalesce(with_check,'') like '%auth.uid()%')
  loop
    v_using := case when v_policy.qual is null then null
      else replace(v_policy.qual, 'auth.uid()', '(select auth.uid())') end;
    v_check := case when v_policy.with_check is null then null
      else replace(v_policy.with_check, 'auth.uid()', '(select auth.uid())') end;
    v_sql := format('alter policy %I on %I.%I',
      v_policy.policyname, v_policy.schemaname, v_policy.tablename);
    if v_using is not null then
      v_sql := v_sql || format(' using (%s)', v_using);
    end if;
    if v_check is not null then
      v_sql := v_sql || format(' with check (%s)', v_check);
    end if;
    execute v_sql;
  end loop;
end
$policies$;

-- These four tables intentionally have no direct client access. Explicit
-- deny policies keep that behavior while making the RLS intent visible.
create policy admin_board_edit_log_deny_direct_access
  on public.admin_board_edit_log for all to anon, authenticated
  using (false) with check (false);
create policy board_share_links_deny_direct_access
  on public.board_share_links for all to anon, authenticated
  using (false) with check (false);
create policy board_visit_sessions_deny_direct_access
  on public.board_visit_sessions for all to anon, authenticated
  using (false) with check (false);
create policy global_interface_settings_deny_direct_access
  on public.global_interface_settings for all to anon, authenticated
  using (false) with check (false);

-- Merge duplicate SELECT permissions without changing which rows each role sees.
drop policy if exists "assignment student read" on public.assignments;
drop policy if exists "assignment teacher read" on public.assignments;
create policy "assignment participants read"
  on public.assignments for select to authenticated
  using (student_id=(select auth.uid()) or teacher_id=(select auth.uid()));

-- Split the previous teacher ALL policy by command, then combine its SELECT
-- scope with the student's own-session scope.
drop policy if exists "student reads own sessions" on public.student_sessions;
drop policy if exists "teacher owns student sessions" on public.student_sessions;
create policy "session participants read"
  on public.student_sessions for select to authenticated
  using (student_id=(select auth.uid()) or
    (teacher_id=(select auth.uid()) and is_approved_teacher((select auth.uid()))));
create policy "teacher owns student sessions insert"
  on public.student_sessions for insert to authenticated
  with check ((teacher_id=(select auth.uid()))
    and is_approved_teacher((select auth.uid()))
    and exists (
      select 1 from public.boards b
      join public.board_members bm on bm.board_id=b.id
      where b.owner_id=(select auth.uid())
        and bm.user_id=student_sessions.student_id
    )
    and (board_id is null or exists (
      select 1 from public.boards b
      where b.id=student_sessions.board_id and b.owner_id=(select auth.uid())
    )));
create policy "teacher owns student sessions update"
  on public.student_sessions for update to authenticated
  using (teacher_id=(select auth.uid()) and is_approved_teacher((select auth.uid())))
  with check ((teacher_id=(select auth.uid()))
    and is_approved_teacher((select auth.uid()))
    and exists (
      select 1 from public.boards b
      join public.board_members bm on bm.board_id=b.id
      where b.owner_id=(select auth.uid())
        and bm.user_id=student_sessions.student_id
    )
    and (board_id is null or exists (
      select 1 from public.boards b
      where b.id=student_sessions.board_id and b.owner_id=(select auth.uid())
    )));
create policy "teacher owns student sessions delete"
  on public.student_sessions for delete to authenticated
  using (teacher_id=(select auth.uid()) and is_approved_teacher((select auth.uid())));
