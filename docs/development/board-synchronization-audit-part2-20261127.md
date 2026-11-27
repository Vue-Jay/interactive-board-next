# Synchronization audit: second pass

Current focus: separate subject interactions and actual peer state, not compilation alone.

- Added shared persisted practice state for sentence ordering, geography matching and cards, language flashcards and orthography. Existing editor preview remains local. Observers see shared state but cannot modify it. Teacher-authored material remains protected.
- Stable configuration key discards stale progress after assignment content changes. Shared geo exercises begin in identical deterministic order.
- Worksheet entry merging uses stable entry IDs, preserves teacher reorder and independent student answers, and never resurrects a deleted task through a stale preview.
- Regression coverage: all 20 base Item kinds and school diagram IDs through actual projection, delta, cached peer parser, independent conflict merge and deletion; five practice modes through server permission checks; four interactive subject modes through two real browser accounts.

Known bounds: audit is not a claim that each UI action of every legacy tool has been exercised. Hidden legacy interactive simulations, simultaneous input to same response, and physical-device prolonged degraded-network runs remain separate coverage. Shared practice represents the common whiteboard, not per-student graded independent homework.
