-- Guest identities are scoped to one board and have an absolute lifetime.
ALTER TABLE account_users ADD COLUMN IF NOT EXISTS guest_board_id uuid;
ALTER TABLE account_users ADD COLUMN IF NOT EXISTS guest_expires_at timestamptz;
ALTER TABLE account_users ADD CONSTRAINT account_guest_scope CHECK (
  (guest_board_id IS NULL AND guest_expires_at IS NULL) OR
  (guest_board_id IS NOT NULL AND guest_expires_at IS NOT NULL AND NOT is_admin
    AND account_role='student' AND teacher_status='none')
);

-- Checkpoints plus forward deltas: avoid copying the whole board on every autosave.
CREATE TABLE board_history (
  board_id uuid NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
  version bigint NOT NULL CHECK (version>0),
  checkpoint jsonb,
  delta jsonb,
  saved_at timestamptz NOT NULL,
  saved_by uuid,
  saved_by_name text NOT NULL,
  title text NOT NULL,
  item_count integer NOT NULL,
  ink_count integer NOT NULL,
  added_count integer NOT NULL DEFAULT 0,
  changed_count integer NOT NULL DEFAULT 0,
  removed_count integer NOT NULL DEFAULT 0,
  PRIMARY KEY(board_id,version),
  CHECK ((checkpoint IS NULL) <> (delta IS NULL))
);

CREATE TABLE board_visits (
  board_id uuid NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES account_users(id) ON DELETE CASCADE,
  visit_id uuid NOT NULL,
  user_name text NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  last_seen timestamptz NOT NULL DEFAULT now(),
  left_at timestamptz,
  PRIMARY KEY(board_id,user_id,visit_id)
);
CREATE INDEX board_visits_board_time_idx ON board_visits(board_id,started_at DESC);
CREATE INDEX board_visits_user_time_idx ON board_visits(user_id,started_at DESC);
