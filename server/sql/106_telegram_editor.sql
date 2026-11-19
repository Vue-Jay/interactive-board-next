CREATE TABLE IF NOT EXISTS telegram_editor_settings (
    singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
    auto_news boolean NOT NULL DEFAULT false,
    auto_maintenance boolean NOT NULL DEFAULT false,
    auto_publish boolean NOT NULL DEFAULT false,
    news_since timestamptz NOT NULL DEFAULT now(),
    maintenance_key text,
    maintenance_phase text,
    verified_chat_id bigint,
    verified_bot_id bigint,
    verified_channel text,
    bot_username text,
    verified_at timestamptz
);
INSERT INTO telegram_editor_settings (singleton) VALUES (true) ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS telegram_posts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    source_key text UNIQUE,
    source_kind text NOT NULL DEFAULT 'manual' CHECK (source_kind IN ('manual','news','maintenance')),
    text text NOT NULL CHECK (char_length(text) BETWEEN 1 AND 3500),
    status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','scheduled','sending','sent','failed','unknown','cancelled')),
    scheduled_at timestamptz,
    auto_queued boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    sent_at timestamptz,
    telegram_message_id bigint,
    error text,
    image_data bytea CHECK (octet_length(image_data) <= 2097152),
    had_image boolean NOT NULL DEFAULT false
);
CREATE INDEX IF NOT EXISTS telegram_posts_due_idx ON telegram_posts (scheduled_at,id) WHERE status='scheduled';
CREATE INDEX IF NOT EXISTS telegram_posts_recent_idx ON telegram_posts (created_at DESC,id DESC);
CREATE TABLE IF NOT EXISTS telegram_generation_attempts (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    kind text NOT NULL CHECK (kind IN ('text','image')),
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS telegram_generation_recent_idx ON telegram_generation_attempts (kind,created_at);
