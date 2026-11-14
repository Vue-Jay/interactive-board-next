-- One-time, server-generated email verification credentials.
-- Only SHA-256 digests are stored; the plaintext token is sent by email.
CREATE TABLE IF NOT EXISTS account_email_verifications (
  user_id uuid PRIMARY KEY REFERENCES account_users(id) ON DELETE CASCADE,
  token_sha256 char(64) NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS account_email_verifications_expiry_idx
  ON account_email_verifications(expires_at);
