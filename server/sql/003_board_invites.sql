-- Owner-controlled invitations matching Lektrus's existing invite/member semantics.
-- No direct database access from clients; routes verify a live session.
CREATE TABLE IF NOT EXISTS board_invites (
  id uuid PRIMARY KEY,
  board_id uuid NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
  email text NOT NULL CHECK (email=lower(email) AND length(email) BETWEEN 3 AND 254),
  role text NOT NULL CHECK (role IN ('editor','viewer')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(board_id,email)
);
CREATE INDEX IF NOT EXISTS board_invites_email_idx ON board_invites(email);
