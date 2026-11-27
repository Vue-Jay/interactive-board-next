-- Decisions are authoritative across teacher devices and reconnects.
-- The board row lock serializes approval/rejection with document revisions.
CREATE TABLE board_attachment_approvals (
    board_id uuid NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
    request_id text NOT NULL,
    student_id uuid NOT NULL REFERENCES account_users(id) ON DELETE CASCADE,
    asset_id text NOT NULL,
    request_event jsonb NOT NULL,
    approved boolean,
    result_event jsonb,
    created_at timestamptz NOT NULL DEFAULT now(),
    resolved_at timestamptz,
    PRIMARY KEY(board_id,request_id),
    UNIQUE(board_id,asset_id),
    FOREIGN KEY(board_id,asset_id) REFERENCES board_assets(board_id,asset_id) ON DELETE CASCADE,
    CHECK ((approved IS NULL) = (result_event IS NULL)),
    CHECK ((approved IS NULL) = (resolved_at IS NULL))
);
CREATE INDEX board_attachment_approvals_student ON board_attachment_approvals(board_id,student_id,created_at DESC);
CREATE INDEX board_attachment_approvals_pending ON board_attachment_approvals(board_id,created_at) WHERE approved IS NULL;
