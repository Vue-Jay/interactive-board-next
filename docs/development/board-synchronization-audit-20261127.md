# Synchronization audit (2026-11-27)

Scope: shared board editing, authenticated realtime and persisted revisions. Navigation and intentionally private exercise state are not shared. This is a source-path audit, not a claim that every UI permutation has been run.

| Family | Authoritative path | Live path / permission check |
|---|---|---|
| Pen, marker, eraser, attached sticky ink | durable checkpoint / versioned delta | ink motion, server ACK, shared unlocked ink |
| Text, sticky, shape, connector, instrument, fraction | commit / delta | editor mutation and transform; student author/geometry rules |
| Image/PDF | upload, commit / delta | attachment approval for student upload; crop ownership; shared page |
| Frame, table, formula, quiz, checklist, flashcard, cover, linkmedia | commit / delta | authoring teacher; permitted responses and transforms |
| Graphs, coordinate planes, geometry, subject/science models | commit / delta | field-level previews, persisted graph payload; teacher assignment protection |
| Undo/redo, layer order, groups, duplicate, delete | version-checked save | model-level guards; rebase local operations |
| Pan/zoom, lasso, selection | personal viewport / work state | no document revision for navigation |
| Recovery | revision notice + incremental/full GET + periodic version probe | retry after loss, conflict rebase; timeout only background |

Tests in the PR: real WebSocket teacher/student commits for object kinds; SQL/HTTP permission checks; browser UI create/delete in both directions for core objects; existing real-browser ink, eraser, drag, text, role and touch tests. No production content was accessed. Remaining: exhaustive interactive UI variations, physical devices, and long unstable-network lessons.

## Recovery follow-up

Source findings addressed in the follow-up: a rejected or malformed socket delta must force a full authenticated snapshot before further socket deltas; committed cursor hints must remain available until the corresponding document is accepted; access denial must not mark an unreceived revision as delivered. Regression cases added to the mocked selfhost client suite. Physical-device, exhaustive editor variants and long-session network tests remain open until actually executed.
