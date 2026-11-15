-- Preserve shared board content when its former contributor is deleted.
-- Personal records and boards owned by the deleted account remain cascading.
ALTER TABLE board_documents
  ALTER COLUMN updated_by DROP NOT NULL,
  DROP CONSTRAINT board_documents_updated_by_fkey,
  ADD CONSTRAINT board_documents_updated_by_fkey
    FOREIGN KEY (updated_by) REFERENCES account_users(id) ON DELETE SET NULL;
ALTER TABLE board_assets
  ALTER COLUMN created_by DROP NOT NULL,
  DROP CONSTRAINT board_assets_created_by_fkey,
  ADD CONSTRAINT board_assets_created_by_fkey
    FOREIGN KEY (created_by) REFERENCES account_users(id) ON DELETE SET NULL;
ALTER TABLE board_pilot_operations
  ALTER COLUMN actor_id DROP NOT NULL,
  DROP CONSTRAINT board_pilot_operations_actor_id_fkey,
  ADD CONSTRAINT board_pilot_operations_actor_id_fkey
    FOREIGN KEY (actor_id) REFERENCES account_users(id) ON DELETE SET NULL;
ALTER TABLE board_pilot_object_operations
  ALTER COLUMN actor_id DROP NOT NULL,
  DROP CONSTRAINT board_pilot_object_operations_actor_id_fkey,
  ADD CONSTRAINT board_pilot_object_operations_actor_id_fkey
    FOREIGN KEY (actor_id) REFERENCES account_users(id) ON DELETE SET NULL;
