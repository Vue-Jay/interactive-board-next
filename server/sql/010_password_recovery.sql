-- Single-use, short-lived password recovery tokens. Only their hashes are stored.
create table if not exists account_password_resets (
  user_id uuid primary key references account_users(id) on delete cascade,
  token_sha256 text not null unique,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
