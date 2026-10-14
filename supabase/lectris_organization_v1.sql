-- Lectris organization v1.
-- IMPORTANT: Apply ONLY to a new, dedicated Supabase project for Lectris.
-- Never execute on the original OnlineRepetitor production project.
-- Prerequisite: base Lectris/board schema containing public.boards and
-- public.can_access_board(uuid), public.is_board_owner(uuid).
begin;

create table if not exists public.lectris_categories (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  kind text not null check (kind in ('subject','group')),
  name text not null check (char_length(btrim(name)) between 1 and 80 and name = btrim(name)),
  updated_at timestamptz not null default now(),
  unique(owner_id,kind,name)
);

create table if not exists public.lectris_board_organization (
  board_id uuid primary key references public.boards(id) on delete cascade,
  subject text not null default '' check (char_length(subject) <= 80),
  group_name text not null default '' check (char_length(group_name) <= 80),
  updated_at timestamptz not null default now()
);

create index if not exists lectris_categories_owner_kind_idx
  on public.lectris_categories(owner_id,kind);

alter table public.lectris_categories enable row level security;
alter table public.lectris_board_organization enable row level security;

drop policy if exists lectris_categories_owner_read on public.lectris_categories;
create policy lectris_categories_owner_read on public.lectris_categories
  for select to authenticated using (owner_id = auth.uid());
drop policy if exists lectris_categories_owner_insert on public.lectris_categories;
create policy lectris_categories_owner_insert on public.lectris_categories
  for insert to authenticated with check (owner_id = auth.uid());
drop policy if exists lectris_categories_owner_update on public.lectris_categories;
create policy lectris_categories_owner_update on public.lectris_categories
  for update to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
drop policy if exists lectris_categories_owner_delete on public.lectris_categories;
create policy lectris_categories_owner_delete on public.lectris_categories
  for delete to authenticated using (owner_id = auth.uid());

drop policy if exists lectris_org_board_read on public.lectris_board_organization;
create policy lectris_org_board_read on public.lectris_board_organization
  for select to authenticated using (public.can_access_board(board_id));
drop policy if exists lectris_org_board_insert on public.lectris_board_organization;
create policy lectris_org_board_insert on public.lectris_board_organization
  for insert to authenticated with check (public.is_board_owner(board_id));
drop policy if exists lectris_org_board_update on public.lectris_board_organization;
create policy lectris_org_board_update on public.lectris_board_organization
  for update to authenticated
  using (public.is_board_owner(board_id))
  with check (public.is_board_owner(board_id));
drop policy if exists lectris_org_board_delete on public.lectris_board_organization;
create policy lectris_org_board_delete on public.lectris_board_organization
  for delete to authenticated using (public.is_board_owner(board_id));

grant select,insert,update,delete on public.lectris_categories to authenticated;
grant select,insert,update,delete on public.lectris_board_organization to authenticated;
commit;
