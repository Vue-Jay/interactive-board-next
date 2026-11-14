-- Append-only, idempotent pilot object create/move operations.
-- Separate from stroke audit: object identity and revision are independent.
CREATE TABLE IF NOT EXISTS board_pilot_object_operations (
  board_id uuid NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
  operation_id uuid NOT NULL,
  actor_id uuid NOT NULL REFERENCES account_users(id),
  operation_type text NOT NULL CHECK (operation_type IN ('object_create','object_move')),
  object_id text NOT NULL CHECK (length(object_id) BETWEEN 1 AND 128),
  request_sha256 char(64) NOT NULL,
  object_revision bigint NOT NULL CHECK (object_revision >= 1),
  resulting_version bigint NOT NULL CHECK (resulting_version > 0),
  payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(board_id, operation_id)
);
CREATE INDEX IF NOT EXISTS board_pilot_object_ops_recent_idx
  ON board_pilot_object_operations(board_id, resulting_version DESC);
