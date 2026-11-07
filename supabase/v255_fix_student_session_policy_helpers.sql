-- Lektrus v255: bind student-session policies to the private authorization
-- helper instead of the public SECURITY INVOKER RPC wrapper.
drop policy if exists "session participants read" on public.student_sessions;
drop policy if exists "teacher owns student sessions insert" on public.student_sessions;
drop policy if exists "teacher owns student sessions update" on public.student_sessions;
drop policy if exists "teacher owns student sessions delete" on public.student_sessions;

create policy "session participants read"
  on public.student_sessions for select to authenticated
  using (student_id=(select auth.uid()) or
    (teacher_id=(select auth.uid()) and (select private.is_approved_teacher(auth.uid()))));

create policy "teacher owns student sessions insert"
  on public.student_sessions for insert to authenticated
  with check ((teacher_id=(select auth.uid()))
    and (select private.is_approved_teacher(auth.uid()))
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
  using (teacher_id=(select auth.uid()) and (select private.is_approved_teacher(auth.uid())))
  with check ((teacher_id=(select auth.uid()))
    and (select private.is_approved_teacher(auth.uid()))
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
  using (teacher_id=(select auth.uid()) and (select private.is_approved_teacher(auth.uid())));
