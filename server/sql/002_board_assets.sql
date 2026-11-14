-- Private filesystem objects for migrated and newly uploaded board attachments.
-- All access is mediated by the authenticated API, not by static web hosting.
create table if not exists board_assets (
  board_id uuid not null references boards(id) on delete cascade,
  asset_id text not null check(length(asset_id) between 1 and 160 and asset_id ~ '^[A-Za-z0-9_-]+$'),
  storage_name uuid not null unique,
  content_type text not null,
  size_bytes bigint not null check(size_bytes between 1 and 52428800),
  sha256 char(64) not null,
  created_by uuid not null references account_users(id),
  created_at timestamptz not null default now(),
  primary key(board_id,asset_id)
);
create index if not exists board_assets_board_idx on board_assets(board_id,created_at);
