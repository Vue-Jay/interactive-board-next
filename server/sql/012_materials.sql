create table if not exists learning_materials (
  id uuid primary key,
  owner_id uuid not null references account_users(id) on delete cascade,
  folder text not null default '',
  title text not null,
  file_name text not null,
  mime text not null,
  size_bytes bigint not null check(size_bytes between 1 and 52428800),
  storage_name uuid not null unique,
  favorite boolean not null default false,
  use_count integer not null default 0 check(use_count>=0),
  last_used_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists learning_materials_owner_idx
  on learning_materials(owner_id,favorite desc,last_used_at desc nulls last,created_at desc);
