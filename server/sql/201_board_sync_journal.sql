-- Bounded technical event journal; no board content or authentication tokens.
CREATE TABLE board_sync_journal (
    id bigserial PRIMARY KEY,
    board_id uuid NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
    actor_id uuid,
    source text NOT NULL CHECK(source IN ('client','server')),
    created_at timestamptz NOT NULL DEFAULT now(),
    event jsonb NOT NULL
);
CREATE INDEX board_sync_journal_board_idx ON board_sync_journal(board_id,id DESC);
CREATE INDEX board_sync_journal_time_idx ON board_sync_journal(created_at);
