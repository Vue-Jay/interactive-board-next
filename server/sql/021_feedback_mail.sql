CREATE TABLE IF NOT EXISTS feedback_mail (
  id uuid PRIMARY KEY,
  feedback_id uuid NOT NULL REFERENCES product_feedback(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('notification','reply')),
  recipient text NOT NULL DEFAULT '',
  subject text NOT NULL,
  body text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','sending','sent','failed')),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  send_after timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz
);
CREATE INDEX IF NOT EXISTS feedback_mail_feedback_idx ON feedback_mail(feedback_id,created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS feedback_mail_notification_idx ON feedback_mail(feedback_id) WHERE kind='notification';
CREATE INDEX IF NOT EXISTS feedback_mail_queue_idx ON feedback_mail(send_after,created_at) WHERE status IN ('pending','sending');
CREATE INDEX IF NOT EXISTS feedback_mail_replies_idx ON feedback_mail(created_at DESC) WHERE kind='reply';
