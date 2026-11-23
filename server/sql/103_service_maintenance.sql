CREATE TABLE IF NOT EXISTS service_maintenance (
    singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
    starts_at timestamptz,
    ends_at timestamptz,
    notice text NOT NULL DEFAULT '',
    allowed_accounts uuid[] NOT NULL DEFAULT '{}',
    CHECK (ends_at IS NULL OR (starts_at IS NOT NULL AND ends_at > starts_at))
);
INSERT INTO service_maintenance(singleton) VALUES(true) ON CONFLICT DO NOTHING;
