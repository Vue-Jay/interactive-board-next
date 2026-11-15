CREATE TABLE IF NOT EXISTS board_share_links (
  id uuid PRIMARY KEY,
  board_id uuid NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  role text NOT NULL CHECK (role IN ('editor', 'viewer')),
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  revoked_at timestamptz,
  max_uses integer CHECK (max_uses BETWEEN 1 AND 10000),
  use_count bigint NOT NULL DEFAULT 0 CHECK (use_count >= 0),
  password_hash text
);
CREATE INDEX IF NOT EXISTS board_share_links_active_idx
  ON board_share_links (board_id, created_at DESC) WHERE revoked_at IS NULL;
