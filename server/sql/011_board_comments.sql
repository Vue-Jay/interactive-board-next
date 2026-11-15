-- Native board discussions. Access is checked by the FastAPI board membership layer.
create table if not exists board_comments (
  id uuid primary key,
  board_id uuid not null references boards(id) on delete cascade,
  author_id uuid not null references account_users(id) on delete cascade,
  author_name text not null default 'Участник',
  parent_id uuid references board_comments(id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 4000),
  resolved boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists board_comments_board_created_idx
  on board_comments(board_id, created_at, id);
create index if not exists board_comments_parent_idx
  on board_comments(parent_id);
