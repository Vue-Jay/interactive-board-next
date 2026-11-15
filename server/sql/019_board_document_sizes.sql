-- Nullable sizes allow an existing normalized board to initialize lazily.
-- Sizes are bytes of the Python compact encoding of persisted JSONB, not
-- PostgreSQL's formatted JSON text or the compressed storage size.
ALTER TABLE board_document_items ADD COLUMN byte_size integer CHECK (byte_size >= 0);
ALTER TABLE board_documents ADD COLUMN item_bytes bigint CHECK (item_bytes >= 0);

CREATE OR REPLACE FUNCTION lektrus_materialize_board_documents() RETURNS bigint
LANGUAGE plpgsql AS $$
DECLARE affected bigint;
BEGIN
  LOCK TABLE board_documents IN EXCLUSIVE MODE;
  LOCK TABLE board_document_items IN EXCLUSIVE MODE;
  UPDATE board_documents d SET document=lektrus_board_document(d),
      document_metadata=NULL, item_order=NULL, item_bytes=NULL
    WHERE d.document_metadata IS NOT NULL;
  GET DIAGNOSTICS affected = ROW_COUNT;
  DELETE FROM board_document_items;
  RETURN affected;
END;
$$;
