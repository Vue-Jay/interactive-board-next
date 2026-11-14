-- Lektrus self-hosted schema v1, isolated from production Supabase.
-- No user data is moved by this migration. All UUIDs can be preserved on import.
create table if not exists account_users (
  id uuid primary key,
  email text not null unique check(email=lower(email) and length(email) between 3 and 254),
  password_hash text not null,
  display_name text not null default 'Пользователь',
  first_name text not null default '',
  last_name text not null default '',
  account_role text not null default 'student' check(account_role in ('teacher','student')),
  teacher_status text not null default 'none' check(teacher_status in ('none','pending','approved','rejected')),
  is_admin boolean not null default false,
  email_confirmed_at timestamptz,
  created_at timestamptz not null default now()
);
create table if not exists account_sessions (
  id uuid primary key,
  user_id uuid not null references account_users(id) on delete cascade,
  refresh_sha256 text not null unique,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists account_sessions_user_idx on account_sessions(user_id,expires_at);
create table if not exists boards (
  id uuid primary key,
  owner_id uuid not null references account_users(id) on delete cascade,
  title text not null default 'Новая доска',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index if not exists boards_owner_idx on boards(owner_id,updated_at desc);
create table if not exists board_members (
  board_id uuid not null references boards(id) on delete cascade,
  user_id uuid not null references account_users(id) on delete cascade,
  role text not null check(role in ('editor','viewer')),
  added_at timestamptz not null default now(),
  primary key(board_id,user_id)
);
create index if not exists board_members_user_idx on board_members(user_id,board_id);
create table if not exists board_documents (
  board_id uuid primary key references boards(id) on delete cascade,
  document jsonb not null,
  version bigint not null default 1 check(version>0),
  updated_by uuid not null references account_users(id),
  updated_at timestamptz not null default now()
);
-- No public SQL connection is exposed: the API checks membership and session
-- on every request. The PostgreSQL port must remain internal to Docker.
