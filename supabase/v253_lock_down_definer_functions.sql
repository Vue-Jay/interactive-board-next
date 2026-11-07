-- Lektrus v253: remove anonymous RPC access to SECURITY DEFINER functions.
-- The app's public routes do not expose data through the anon database role;
-- signed-in calls retain their explicit authenticated grants.
do $$
declare
  v_function regprocedure;
begin
  for v_function in
    select p.oid::regprocedure
    from pg_proc p
    join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public'
      and p.prosecdef
      and has_function_privilege('anon',p.oid,'execute')
  loop
    execute format('revoke execute on function %s from public, anon',v_function);
  end loop;

  -- Trigger functions and scheduled maintenance are internal operations.
  for v_function in
    select p.oid::regprocedure
    from pg_proc p
    join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public'
      and p.prosecdef
      and p.prorettype='trigger'::regtype
  loop
    execute format('revoke execute on function %s from public, anon, authenticated',v_function);
  end loop;
end
$$;

revoke execute on function public.cleanup_expired_guest_accounts() from public, anon, authenticated;
revoke execute on function public.cleanup_old_direct_call_signals() from public, anon, authenticated;
revoke execute on function public.finish_queued_board_purges() from public, anon, authenticated;
revoke execute on function public.generate_due_notifications() from public, anon, authenticated;
revoke execute on function public.queue_expired_trashed_boards() from public, anon, authenticated;
revoke execute on function public.notification_enabled(uuid,text) from public, anon, authenticated;
