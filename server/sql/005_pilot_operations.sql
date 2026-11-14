-- Pilot-only immutable audit log. Never rewrite imported full Lektrus documents.
-- The storage unit is an operation, so retries cannot add duplicate strokes.
create table if not exists board_pilot_operations (
  board_id uuid not null references boards(id) on delete cascade,
  operation_id uuid not null,
  actor_id uuid not null references account_users(id),
  operation_type text not null check(operation_type in ('ink_append','ink_undo')),
  stroke_id text not null check(length(stroke_id) between 1 and 128),
  request_sha256 char(64) not null,
  resulting_version bigint not null check(resulting_version > 0),
  payload jsonb not null,
  created_at timestamptz not null default now(),
  primary key(board_id,operation_id)
);
create index if not exists board_pilot_operations_recent_idx
  on board_pilot_operations(board_id,resulting_version desc);
