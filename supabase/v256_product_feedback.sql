-- Public feedback form: callers may submit a new message, while only Lektrus
-- administrators can read submissions or change their review status.
create table if not exists public.product_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null default auth.uid(),
  name text not null check (char_length(btrim(name)) between 1 and 100),
  email text not null default '' check (char_length(email) <= 254),
  topic text not null check (topic in ('Предложение','Отзыв о сервисе','Сообщить о проблеме','Другое')),
  message text not null check (char_length(btrim(message)) between 8 and 4000),
  source text not null default 'site' check (source in ('site','app')),
  status text not null default 'new' check (status in ('new','reviewed','closed')),
  created_at timestamptz not null default now()
);

create index if not exists product_feedback_created_idx
  on public.product_feedback(created_at desc);
create index if not exists product_feedback_status_created_idx
  on public.product_feedback(status,created_at desc);

alter table public.product_feedback enable row level security;
revoke all on table public.product_feedback from public,anon,authenticated;
grant insert(name,email,topic,message,source) on public.product_feedback to anon,authenticated;
grant select on public.product_feedback to authenticated;
grant update(status) on public.product_feedback to authenticated;

drop policy if exists "public feedback submit" on public.product_feedback;
create policy "public feedback submit"
  on public.product_feedback for insert to anon,authenticated
  with check (
    status='new' and
    user_id is not distinct from (select auth.uid())
  );

drop policy if exists "app admins read product feedback" on public.product_feedback;
create policy "app admins read product feedback"
  on public.product_feedback for select to authenticated
  using (public.is_app_admin((select auth.uid())));

drop policy if exists "app admins update product feedback status" on public.product_feedback;
create policy "app admins update product feedback status"
  on public.product_feedback for update to authenticated
  using (public.is_app_admin((select auth.uid())))
  with check (public.is_app_admin((select auth.uid())));
