-- Lektrus v252: keep the read-receipt SECURITY DEFINER RPC private to signed-in users.
revoke all on function public.get_direct_chat_read_state(uuid) from public, anon;
grant execute on function public.get_direct_chat_read_state(uuid) to authenticated;
