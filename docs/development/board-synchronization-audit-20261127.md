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

## Nested editor conflict follow-up

Added regression cases for partially overlapping concurrent geometry point additions and reference rebasing, stale ID-based previews after deletion, and oversized/deep preview operations falling back atomically to durable revisions. The new checks cover nested atlas, physics, circuit, optics, chemistry and sticker collections at the merge-helper level; they do not constitute full physical-device or end-to-end coverage.

## Isolated full-audit branch: history and conflict handling

Collaborative teacher/owner/editor undo now uses the same per-participant operation history as pupils rather than a snapshot stack reset by each incoming revision. Added layer-order-only history, peer-order conflict protection, removal of fully superseded actions from history, and replay of only the actually applied fields after partial conflicts. Explicit eraser/transform baselines are used to avoid missing undo actions after a concurrent checkpoint. Pending validation in the isolated branch; do not merge or deploy until the complete audit gate is satisfied.

Nested personal undo additionally distinguishes independent changes inside JSON records and stable-ID collections (sticker strokes, contour marks, physics/optics/circuit and lab elements). Concurrent positional-array edits remain conservative to avoid overwriting ambiguous peer geometry. The history regression suite exercises all 20 board item kinds for independent field undo/redo, plus nested peer additions and field edits. These tests are model-level, not evidence of all tool gestures or device behavior.

### Audit release gate (do not merge until all rows have evidence)

| Area | Current evidence / remaining gate |
|---|---|
| Native object inventory | 20 kinds enumerated in model, durable server socket and merge regression suites; require real two-session UI create/edit/transform/delete for every allowed kind and role. |
| Nested editors | Model-level regression for stable IDs, geometry reference rebase, partial inverse and historical missing sticker ink; require real subject-editor UI coverage for concurrent work. |
| Undo/redo | New isolated-branch regressions for all object kinds, layer ordering, partial peer conflicts and nested records; require two-session browser undo/redo and deletion cases. |
| Roles | Existing server permission matrix and guest/observer coverage; require two-session UI permission/attachment acceptance, including denied operations. |
| Network lifecycle | Existing mocked loss/reconnect, version probing, rejected patch and idle tests; require long-lived real session with dropped/slow traffic, socket reconnect, refresh and background <10 min / >=10 min. |
| Device interaction | Existing Chromium touch/pointer tests and native emulator workflows; require physical phone/tablet gesture and cross-device convergence evidence. |
| Performance and publication | Require measured latency, dropped revisions, reconnect convergence under sustained collaboration; do not publish or merge until all gate rows are evidenced. |

No physical-device, exhaustive UI or production publication claims are made in this branch.
