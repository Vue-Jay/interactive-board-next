-- Native Lektrus administration and product feedback.
ALTER TABLE account_users
  ADD COLUMN IF NOT EXISTS teacher_requested_at timestamptz,
  ADD COLUMN IF NOT EXISTS teacher_reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS teacher_reviewed_by uuid REFERENCES account_users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS teacher_application jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS subscription_granted_by uuid REFERENCES account_users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS subscription_updated_at timestamptz;

CREATE TABLE IF NOT EXISTS product_feedback (
  id uuid PRIMARY KEY,
  user_id uuid REFERENCES account_users(id) ON DELETE SET NULL,
  name text NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 100),
  email text NOT NULL DEFAULT '' CHECK (char_length(email) <= 254),
  topic text NOT NULL CHECK (topic IN ('Предложение','Отзыв о сервисе','Сообщить о проблеме','Другое')),
  message text NOT NULL CHECK (char_length(btrim(message)) BETWEEN 8 AND 4000),
  source text NOT NULL DEFAULT 'site' CHECK (source IN ('site','app')),
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new','reviewed','closed')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS product_feedback_created_idx
  ON product_feedback(created_at DESC);
CREATE INDEX IF NOT EXISTS product_feedback_status_created_idx
  ON product_feedback(status,created_at DESC);
