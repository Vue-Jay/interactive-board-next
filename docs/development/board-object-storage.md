# Native board object storage (migrations 018–019)

Native version-1 documents with stable object IDs are converted on their first
successful PATCH. Existing documents are not migrated in bulk. A full PUT and
pilot documents still use the original JSONB layout. Both layouts use the same
version checks and access checks. The GET API shape and object order are unchanged.

On subsequent PATCH requests only added/edited objects are inserted or updated,
and deleted objects are removed. Reordering changes only the order array. The
previous full snapshot remains in `board_documents.document`; it is not the
current document for a normalized board. The read helper reconstructs the current
document. Version-only PATCH reads metadata, ID order and the byte sizes of
changed/deleted objects, without reading unchanged object bodies. Migration 019
adds nullable per-object and total sizes; existing normalized documents initialize
them on their next PATCH. Size checks retain the exact compact UTF-8 JSON limit
and item-count limit, and sizes are measured from PostgreSQL-normalized JSONB.
Full-response PATCH still reconstructs the document.

## Rollback to a backend predating migration 019

Do not deploy the old backend over normalized documents without materializing them.
Stop application writers (including any other backend replicas), make a database
backup, then execute `SELECT lektrus_materialize_board_documents();` on the database
in a transaction and verify that `SELECT count(*) FROM board_documents WHERE
document_metadata IS NOT NULL;` returns zero. The function reconstructs each latest
document, preserves its revision and timestamps, and clears separate item rows
atomically. Only after successful verification restart the old backend. Migration
018–019 are additive and do not need to be removed.
