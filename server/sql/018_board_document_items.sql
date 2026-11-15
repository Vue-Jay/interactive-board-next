-- Native document deltas can persist individual objects. Keep the previous
-- full snapshot until the next full save; materialize before a server rollback.
ALTER TABLE board_documents ADD COLUMN document_metadata jsonb;
ALTER TABLE board_documents ADD COLUMN item_order text[];
ALTER TABLE board_documents ADD CONSTRAINT board_documents_layout_check
  CHECK ((document_metadata IS NULL) = (item_order IS NULL));

CREATE TABLE board_document_items (
  board_id uuid NOT NULL REFERENCES board_documents(board_id) ON DELETE CASCADE,
  item_id text NOT NULL,
  item jsonb NOT NULL,
  PRIMARY KEY (board_id, item_id),
  CHECK (item->>'id' IS NOT NULL AND item->>'id' = item_id)
);

-- Read the full document atomically, with its exact original object order.
CREATE FUNCTION lektrus_board_document(d board_documents) RETURNS jsonb
LANGUAGE sql STABLE AS $$
  SELECT CASE WHEN d.document_metadata IS NULL THEN d.document
    ELSE d.document_metadata || jsonb_build_object('items', COALESCE((
      SELECT jsonb_agg(i.item ORDER BY ord.position)
      FROM unnest(d.item_order) WITH ORDINALITY AS ord(item_id, position)
      JOIN board_document_items i ON i.board_id=d.board_id AND i.item_id=ord.item_id
    ), '[]'::jsonb)) END
$$;

-- Stop application writers before invoking this operation to roll back to a
-- backend predating migration 018. Revision and updated_at remain unchanged.
CREATE FUNCTION lektrus_materialize_board_documents() RETURNS bigint
LANGUAGE plpgsql AS $$
DECLARE affected bigint;
BEGIN
  LOCK TABLE board_documents IN EXCLUSIVE MODE;
  LOCK TABLE board_document_items IN EXCLUSIVE MODE;
  UPDATE board_documents d SET document=lektrus_board_document(d),
      document_metadata=NULL, item_order=NULL
    WHERE d.document_metadata IS NOT NULL;
  GET DIAGNOSTICS affected = ROW_COUNT;
  DELETE FROM board_document_items;
  RETURN affected;
END;
$$;
