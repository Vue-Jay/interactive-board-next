-- Keep shared discussion/visit history without keeping expired guest accounts.
-- The existing author/user IDs are immutable attribution snapshots. The new
-- nullable FK preserves normal account deletion cascades; only guest cleanup
-- detaches the reference before deleting the temporary account.
ALTER TABLE board_visits ADD COLUMN account_user_id uuid REFERENCES account_users(id) ON DELETE CASCADE;
ALTER TABLE board_comments ADD COLUMN account_user_id uuid REFERENCES account_users(id) ON DELETE CASCADE;
UPDATE board_visits SET account_user_id=user_id;
UPDATE board_comments SET account_user_id=author_id;
CREATE INDEX board_visits_account_user_idx ON board_visits(account_user_id);
CREATE INDEX board_comments_account_user_idx ON board_comments(account_user_id);

CREATE FUNCTION attach_visit_account() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    NEW.account_user_id := NEW.user_id;
    RETURN NEW;
END;
$$;
CREATE FUNCTION attach_comment_account() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    NEW.account_user_id := NEW.author_id;
    RETURN NEW;
END;
$$;
CREATE TRIGGER board_visits_attach_account BEFORE INSERT OR UPDATE OF user_id ON board_visits
    FOR EACH ROW EXECUTE FUNCTION attach_visit_account();
CREATE TRIGGER board_comments_attach_account BEFORE INSERT OR UPDATE OF author_id ON board_comments
    FOR EACH ROW EXECUTE FUNCTION attach_comment_account();

ALTER TABLE board_visits DROP CONSTRAINT board_visits_user_id_fkey;
ALTER TABLE board_comments DROP CONSTRAINT board_comments_author_id_fkey;
ALTER TABLE board_visits ADD CONSTRAINT board_visits_account_snapshot CHECK (account_user_id IS NULL OR account_user_id=user_id);
ALTER TABLE board_comments ADD CONSTRAINT board_comments_account_snapshot CHECK (account_user_id IS NULL OR account_user_id=author_id);

-- Extend only currently valid guest access; never resurrect an expired guest.
WITH extended AS (
    UPDATE account_users SET guest_expires_at=created_at+interval '72 hours'
    WHERE guest_board_id IS NOT NULL AND guest_expires_at>now()
      AND guest_expires_at<created_at+interval '72 hours'
    RETURNING id,guest_expires_at
)
UPDATE account_sessions s SET expires_at=e.guest_expires_at
FROM extended e WHERE s.user_id=e.id AND s.revoked_at IS NULL AND s.expires_at>now();
