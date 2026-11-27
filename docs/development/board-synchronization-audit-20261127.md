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

## Revision transport and resume follow-up

Prevent malformed or wrong-board HTTP snapshots from poisoning delta bases; version watchdog uses a bounded single-flight timer independent of notification frequency; temporary access denial is rechecked via the authenticated version-only endpoint, with no content delivered while denied; wake-from-background cannot unlock input while the required server revision is only deferred. Added mocked client fault cases for wrong board, invalid version, invalid document and access recovery without reconnect. Still requires full two-session UI fault injection and physical-device evidence.

## Real two-session acceptance infrastructure

The API integration workflow now starts two independent Chrome profiles against the actual authenticated application and disposable PostgreSQL-backed Uvicorn through a local-only proxy. First scenario covers teacher pen, pupil marker, teacher undo/redo after pupil revision, transport disconnect, slow reconnect and reload; each condition is asserted against the authoritative API and both client backup documents. This is not yet full GUI coverage of 20 object types, physical devices, or measured production latency. Results pending CI. No production deployment from the audit branch.

## Version-bound editor previews and attachment delivery

The isolated candidate now preserves packet boundaries (no 300-op slicing), tags preview operations with the sender's acknowledged revision, and ignores revision-mismatched previews. Server validation preserves compatibility with older unversioned packets. Attachment requests coalesce retries, retain failed sends and resume after background/reload; a teacher's approval is acknowledged only when the asset is present in the authoritative document. Stable item IDs protect against duplicate approvals and locally remembered decisions replay lost responses. Added transport regressions and real browser scenarios for pending upload reload, dropped approval/rejection result and duplicate prevention. Cross-device or multi-teacher decision arbitration still needs a server-backed durable approval ledger; do not claim this coverage complete.

The first custom Chromium CDP harness failed to open the first board (run 46013107494). The frontend workflow 46013107478 passed. Replaced that harness with the repository's existing authenticated Playwright integration, exposing its focused --sync-only mode and extending it with real undo/redo and offline/reconnect/attachment acceptance. Await results on the new candidate. Production untouched.

## Browser infrastructure and write acknowledgement follow-up

Run 46014297602 passed all frontend steps. Run 46014297649 passed 89 API tests and failed the browser integration before login: the job's HTTP CORS allowlist was captured at API import time, while the test only added localhost later for WebSocket origins. Added localhost to the disposable CI environment and a preflight/health assertion before browser launch. Independently, the document save now rejects malformed, non-integer, repeated or skipped revision acknowledgements before caching the local document. Regressions assert no ambiguous write is automatically replayed. Await exact-head results; real two-session acceptance has not yet passed.

## Actual dual-session results and inverse history correction

Run 46015053586 passed all frontend steps. Run 46015053529 reached authenticated browser collaboration and passed live shape/instrument motion, text before blur, bidirectional text/shape/sticky creation/deletion, pencil/marker pixels before database ACK, both eraser modes and concurrent eraser versus delayed ink extensions in both directions. The subsequent personal history test failed. Source investigation found two defects: JSON string equality depends on property insertion order (the real parser moves createdBy and inserts defaults), and the teacher's inverse operation was incorrectly subject to the student-only edit guard. Corrected content equality, canonical comparison of touched items and role-scoped authorization; added actual parser round-trip regressions and more diagnostic browser assertions. Exact-head CI pending. No publication.

## Verified personal history and durable attachment decisions

Run 46016184486 passed all frontend steps, including parser round trips for all 20 object families. Run 46016184399 passed actual dual-session teacher/pupil undo and redo, offline catch-up and reload, alongside the prior bidirectional motion and erasing tests. The browser then stopped at media upload because the disposable server had no private assets directory; 89 integration tests passed including 30 real sockets for 60.09 s (3960 client events, 115560 delivered messages, 12 durable saves; p95 round completion 317.45 ms, not pointer-to-pixel latency). Added a temporary private assets directory for the browser test. Replaced transient-only approval with a board-scoped PostgreSQL request/decision ledger; both document insertion and decision are serialized by the board lock, teacher API decisions are idempotent, replay/list recover on reconnect, and a rejected request cannot become a stale insertion. Added actual concurrent teacher-decision API regression, authorization checks and full native object fixture fields. Await exact-head CI for new ledger and expanded matrix. Physical devices and exhaustive GUI permutations remain open.


## Keyboard geometry consistency

The attachment ledger candidate passed the PostgreSQL integration step of run 46017350521 and all frontend steps of 46017350483, including actual upload/reload and lost-result browser checks. Keyboard nudge, rotation/reset and alignment now share the unlocked-object transform policy instead of rejecting protected lesson content as a structural edit; the central content and deletion guards remain in force. Added a real two-account check for all six protected object families with server-seeded fixtures: pupil keyboard translation and rotation, both local backups, prohibited deletion, and teacher-lock denial. This is placement coverage, not evidence of every family being created via its toolbar or editor. Exact new-head CI pending. Physical-device and complete subject/editor coverage remain open.

## Checkpointed text history and modal baseline

Runs 46018166239 and 46018166062 passed frontend and server integration steps, including the six protected lesson transform/lock tests. This follow-up fixes source-level text history loss when a peer revision folds a typing checkpoint into the current board before blur, preserves a peer text value as the inverse baseline after concurrent edits, explicitly cancels checkpointed typing on Escape, and records the initial table draft baseline at creation. Same-fingerprint server revisions now retain the actual acknowledged data. Added a real two-session regression for persisted text plus an unrelated pupil stroke, then undo/redo/cancel; exact new-head CI pending. No main merge.

## Detached subject editor save audit

Source inspection found stale full-item replacement in atom, periodic table, chart, school diagram, non-live science and fraction editors, plus save-after-deletion resurrection through physical editor creation fallback. Added explicit creation intent at open time and field-scoped three-way result merge; existing deleted or locked objects are not recreated or overwritten. Live physical editors retain their already committed component state at close. Added model regressions for ten families, including peer position/rotation/group preservation, delete/lock denial and explicit new item creation. Preserve a text editor when a newly local item is not yet present in a concurrent server revision. Exact-head CI and real subject GUI concurrency remain required.

## Active modal preview and GUI coverage

Runs 46018942268/46018942295 passed, including checkpointed text undo/redo/cancel after a real pupil revision. Added idempotent full unsaved modal-field previews and bounded refresh of small active drafts, plus retry of failed work-state, editor-packet and object-transform sends. Table double-click now initializes the proper modal base. Expanded real browser acceptance for detached subject modal vs pupil movement, deleted-chart save denial, teacher tool creation/peer rendering/deletion, and student responses for checklist, quiz, flashcard and cover. These tests are not yet passed at this head. Physical Android devices and complete subject-specific gesture permutations remain outside current evidence.

### Expanded acceptance fixtures

Corrected the atom fixture to the actual validated AtomModel shape and covered the intentionally teacher-only cover toggle. Added real ruler/set-square/protractor creation, movement, scale and deletion for teacher and pupil, plus a generated valid two-page PDF uploaded through the pupil approval flow with bidirectional page switching. These are new tests, not yet verified results.

## Gesture-release revision race

The detached editor correction passed both full workflows (46019654965 and 46019654920). Inspection found a further object-delay race: pointer-up queued a local save microtask before deferred peer revisions were applied by a zero-delay timer. Reconcile deferred revisions synchronously once the gesture is finalized, guard the save entry point, retain the queued snapshot if application remains deferred/rejected, and ignore stale notifications before deferring. Added a real held pupil drag with an independent teacher revision delivered through the actual socket, requiring the first durable write to use the new revision. New exact-head CI pending; no publication.


## Attachment ledger recovery and measurable release gate

An online socket previously made only one HTTP ledger read after reconnect. If that read failed while the original uploader was absent, pending durable requests could remain invisible until another reconnect. The isolated candidate retries transient ledger reads with capped exponential backoff, cancels on offline/close, and does not poll permanent 4xx or legacy endpoints. Added regressions for transient failure without reconnect, offline timer cancellation, and legacy endpoint handling. Pending exact-head CI.

Progress is measured by 20 equally counted acceptance checkpoints, not percentage of source lines or a guarantee of defect-free behavior. Historical passes must be revalidated by the exact-head CI gate. An incomplete or unverified checkpoint counts as open.

| # | Acceptance checkpoint | Status at base 04250d2 |
|---|---|---|
| 1 | Shared object and tool source-path inventory | evidenced |
| 2 | Model inverse and conflict regressions for all 20 native kinds | evidenced |
| 3 | Server role and authorization matrix | evidenced |
| 4 | Real server socket object revision matrix | evidenced |
| 5 | Real dual-session pen and marker before durable ACK | evidenced |
| 6 | Both eraser modes and concurrent delayed stroke extension | evidenced |
| 7 | Core text/shape/sticky bidirectional creation/deletion and live motion | evidenced |
| 8 | Text checkpoint history, peer edit and Escape cancellation | evidenced |
| 9 | Personal undo/redo for teacher and pupil | evidenced |
| 10 | Real offline catch-up and reload | evidenced |
| 11 | Attachment approval, image reload/lost-result and ledger recovery | open: new retry regression |
| 12 | PostgreSQL concurrent attachment decisions and authorization | evidenced |
| 13 | Six protected assignment families keyboard transform and lock/delete denial | evidenced |
| 14 | 30 real sockets for 60 seconds, transport round measurement | evidenced |
| 15 | Every allowed native kind via actual UI creation/edit/transform/delete, including PDF and instruments | open |
| 16 | Real subject editor concurrent edits, responses and gesture variants | open |
| 17 | Long unstable network lesson and background resume both below and above 10 minutes | open |
| 18 | Physical Android phone/tablet and cross-device interaction | open |
| 19 | End-to-end pointer-to-peer-pixel latency and convergence under sustained UI collaboration | open |
| 20 | Exact candidate head frontend and server workflows complete | open |

Baseline: 13/20 evidenced (65%), 7/20 open (35%). Never merge on percentage alone; all checkpoints must pass. No publication.


## Measurable gate update: 14/20 (70%)

Exact candidate d4cfbfa frontend run 46021660456 passed all steps, including transient attachment ledger retry, offline cancellation and permanent endpoint handling. Server run 46021660433 verified the held drag revision race, real attachment upload/replay, four detached subject editor concurrent transforms, save-after-delete denial and ten additional UI object creation/peer display/response/deletion cases. It stopped on the measuring instrument portal anchor: the actual instrument body was rendered, but the zero-size anchor cannot satisfy a Playwright visible assertion. The release gate remains open. Corrected the test to use the rendered body, check peer scale and both saved copies; also guard instrument updates/deletion against peer lock/removal during a captured gesture. Added post-input to observed peer raster timings to the existing real two-session pen/marker/eraser tests; those polling measurements exclude input dispatch and are not a sustained pointer-to-pixel benchmark. Exact new-head results pending. No main merge or deployment.

Checkpoint 11 is now evidenced; 6 checkpoints remain (15–20). Physical device evidence is still unavailable in this environment.
