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


## Background-only timeout and repeated outage acceptance

Added a real PostgreSQL/WebSocket integration assertion for the negotiated background-only lease: foreground return cancels an almost-expired lease, another background interval expires with code 4410. Extended the real two-account browser lesson with three actual transport outages, alternating post-reconnect authors, and preservation of earlier strokes. Added separate sub-10-minute and over-10-minute browser lifecycle cases (accelerated browser clock and simulated visibility, actual server and UI), including same socket plus first stroke for short background, missed revision recovery without clicking and fresh socket for long background. This is accelerated lifecycle coverage, not evidence of ten actual minutes on physical devices or a sustained impaired-network lesson. Existing 14/20 (70%) baseline is unchanged until exact results are available. No main merge or deployment.


## Lost modal reset recovery

Source audit found a dropped reset frame could leave a peer seeing an old value indefinitely while refreshes of a different unsaved field kept the preview alive. Track only modal fields previously published; periodic refresh and close rollback now explicitly reassert those fields, even if they match the durable base, including removed optional fields. Untouched properties remain excluded. Added regression cases for missed reset, rollback and optional-field removal. Candidate tests pending. Progress remains 14/20 (70%) until verified; physical devices and sustained impaired-network testing remain open. Main untouched.


## Exact-head CI failures and expanded object matrix

Both full workflows on 44f0250 passed (46022649783/46022649742). Subsequent runs 46022997482 and 46023457941 passed repeated real outages, all six instrument role scenarios and PDF, but failed short background same-socket assertion. The new test installed Playwright's clock after native timers had already started; this may interfere with existing heartbeat/expiry timers. Retain the assertion, replace fake timer installation with a wall-clock offset only, record actual lifecycle frames and use a near-expired real server lease to exercise the server-driven idle close. Exact cause of the extra connection is not yet established. Frontend run 46023457879 failed the optional-field comparison because the merge helper represents removal as undefined (absent when serialized); corrected the regression to assert both undefined and wire-level absence. Added actual fraction catalogue creation, legacy comment edit/resolve/delete (comment creation is intentionally disabled), and opposite-role movement for the ten previously covered UI objects. New evidence pending. Last observed post-input-to-peer raster samples were 48.5–70.6 ms in CI; not end-to-end device measurements. 90 server tests passed, one combined browser test failed. Gate remains 14/20 (70%). Main unchanged.


## Verified baseline cb65c64 and sustained impaired UI follow-up

Exact baseline cb65c6494b64935c5787c176f8eb250513d6abf0: both full CI workflows passed (46025217793 and 46025217796), 91 server tests, short/long background assertions with real timers and accelerated wall clock/server lease, repeated transport outages, actual fraction and legacy-comment cases and pupil movement of ten object kinds. Checkpoint 20 was evidenced at that revision, bringing historical baseline to 15/20 (75%). No merge. New candidate must revalidate exact-head CI.

Added a 60-second minimum two-browser acceptance scenario with 24 actual pointer-drawn pen/marker strokes, deterministic incoming live-frame/revision loss and 120 ms delivery delay, explicit pre-dispatch to peer-raster sample collection, unique durable IDs and exact convergence of both client copies. Added PDF movement and deletion. These are new pending tests, not claimed as passing. Impairment is protocol-level test routing, not a physical radio network; the timing includes automation and polling overhead and cannot measure display scanout. Physical Android phone/tablet remain unavailable; exhaustive subject editor and object gesture coverage still open. No production merge or deployment.


## Verified impaired UI run and timing decomposition

Exact candidate 9c7c596 passed both full workflows 46026746941/46026747012 (91 server tests). The 60.01 s dual UI scenario drew all 24 strokes and converged both client copies after 128 discarded frames; PDF creation/page change/movement/deletion passed. Median measured dispatch-to-raster was 1898.5 ms, p95 2019.5 ms, max 2024.8 ms. This is too slow to claim smooth impaired-network behavior; it also includes the synchronous automation router and a blocking multi-step pointer call. New test interleaves relay with individual pointer events and logs dispatch duration, post-dispatch observation, and excess proxy queue delay separately. Added actual approved-image move/rotation/deletion and real mechanics/optics live nested controls with intervening pupil geometry update and close. New coverage pending. Historical confirmed baseline remains 15/20 (75%); exact new candidate CI remains open, as do long unstable lessons, full editor/gesture matrix, physical devices and satisfactory sustained latency. No main merge or deployment.


## Verified physics controls and final ink acknowledgement recovery

Exact 41ba8e1 workflows 46028453332/46028453307 passed all steps (91 server tests). Actual approved image move/rotate/delete and mechanics/optics settings with concurrent pupil geometry were confirmed. Impaired dual UI: 24 strokes, 142 discarded messages, 60.03 s, full convergence. Median total 1538.2 ms, median input automation 1442.3 ms, post-dispatch median 139.1 ms, proxy excess queue delay p95 228.2 ms. These measurements do not establish physical device latency; the artificial harness dominates total dispatch time.

Source follow-up: final ink-motion acknowledgement was attempted only once, so backpressure could strand a preview until another edit. New bounded retry coalesces the latest watermark and cancels on reset; regression exercises rejected sends, newer durable revision, deduplication and cancellation. Shared instrument translation now commits only x/y and does not overwrite rotation during a concurrent drag; cancel uses current rendered authoritative pose. Added real circuit nested settings and peer movement test. Exact CI pending. Historical baseline 15/20 (75%); current exact-head gate pending. No main merge or deployment.


## Stale drawing prefix and five-minute impairment gate

Exact prior passing baseline 41ba8e1 remains 15/20 (75%). Candidate 15e5c17 CI was still executing when this follow-up was prepared. Added a narrowly scoped guard against a delayed short motion frame shrinking a longer already persisted drawing even if the motion ACK is missing; compare normalized world points, drawing gesture identity, and style/author, not bounding-box coordinates. Do not suppress eraser gestures or newer extensions. Added executed-source regressions for pending prefix, delayed frame, newer extension and eraser. Strengthened sustained test to five real minutes, 48 distinct UI strokes and actual dropped/delayed messages, measuring one extension dispatch instead of ten serial automation commands. Browser subprocess deadline increased to 780 s to accommodate this single longer acceptance scenario. This is not a physical-device test. Exact candidate results pending; do not count an unverified checkpoint or merge main.


## Verified five-minute network gate and quiet-edge repair

Exact 62b8c04 passed both full workflows 46030556723/46030556930, 91 server tests. Five-minute actual dual browser: 300.03 seconds, 48 unique strokes, 66 discarded notices/frames, identical saved IDs in both clients; repeated transport outages and accelerated background cases also passed. Checkpoint 17 (long impaired session and lifecycle recovery) now evidenced, bringing historical gate to 16/20 (80%). Circuit GUI settings passed. Latency checkpoint remains open: median total 526.0 ms, p95 2672.2 ms, max 4865.3 ms; post-dispatch median 329 ms. These are automated, impaired-network measurements, not physical device scanout.

Source fix: send one full quiet-edge motion replay after 90 ms to repair loss of the last frame when no further pointer sample arrives. Original change watermark and base version retained; new envelope sequence allows recovery after a failed compact delta, durable ACK and tombstones still apply. New local sender regression verifies lost first frame recovery and durable acknowledgement. Expanded real GUI tests for pupil resize/rotation across ordinary object families, connector endpoint, PDF/image/fraction and live physical graph point editing with peer movement. New evidence pending, exact CI checkpoint reopened for the candidate; physical devices unavailable. No main merge/deployment.


## Verified quiet-edge repair, native actions and touch acceptance

Exact 4dab146 passed both full workflows 46032835792/46032835775 (91 server tests). Under the same five-minute impairment fixture all 48 strokes converged despite 80 discarded messages. Median total dispatch-to-raster 427.1 ms, p95 546.0 ms, maximum 559.8 ms, versus prior p95 2672.2 ms and max 4865.3 ms. The measured sustained desktop UI latency/convergence checkpoint 19 is evidenced; baseline 17/20 (85%). It is not a guarantee of low latency on all networks or physical devices. Added a regression ceiling of p95 <1000 ms and max <1500 ms for this impaired automation fixture (not a production SLA). Native GUI resize/rotate matrix and motion graph point edit passed; remaining native lifecycle and complete subject matrix open.

Source fixes: PDF navigation, duplicate and spread actions now re-resolve the authoritative current item, refuse removed/locked/replaced assets and apply relative navigation to the current page. Added executed helper regressions and real two-page duplication. Expanded instrument rotation/reset and authenticated touch phone/tablet/desktop acceptance using actual Chromium touch dispatch in the landscape iframe, checking pre-release save and cross-client copies. This is device emulation, not physical Android proof. Current exact CI remains pending. No main merge or deployment.


## PDF typecheck and repeated native editor audit

Exact ff3ad813 server integration passed 91 tests, including phone/tablet emulated touch strokes before release and desktop-to-mobile convergence, PDF duplication, and instrument rotation/reset. Both workflows subsequently failed the strict TypeScript build on an unused parameter in nextPdfPage (TS6133); removed that parameter at all call sites. Sustained impairment test remained inside the new budget: 300.02 s, 48 strokes, 80 discarded messages, median 505.2 ms, p95 698.0 ms, max 718.3 ms.

Source audit: existing link-media edit previously wrote both stale form fields and could modify a locked peer object; now capture current base, validate role/current item, and merge only edited fields. Existing modal save now refuses locked/read-only/structurally protected current objects rather than applying the stale draft. Added actual reopen/edit/peer move/save regression for formula, checklist, quiz, flashcard, link media and fraction denominator. New CI required. Historical verified baseline 17/20 (85%); current candidate has exact-head CI open and cannot claim completion. Physical Android hardware remains unavailable. No main merge/deployment.


## Native re-edit acceptance and shared sentence response repair

Exact 3c1ca14 passed both full workflows 46039556398/46039556395 (91 server tests). Existing formula/checklist/quiz/flashcard/link-media edits preserved peer geometry; fraction re-edit, PDF duplication, instrument rotations and emulated phone/tablet/desktop touch all passed. Sustained impaired run: 300.06 seconds, 48 strokes, 81 discarded frames, p95 697.3 ms, max 711.2 ms. Native lifecycle checkpoint 15 is now evidenced (18/20 = 90% on verified baseline). Physical hardware and subject editor matrix remain open.

Found a subject workflow gap: standalone word-order exercise was intentionally local-only; a teacher could not see a student's reordered words or checked result. This candidate changes actual board answers to shared state, while the detached preview continues to work locally. Server migration permits only an exact permutation of existing teacher-defined word IDs plus boolean checked state, not source changes. Teacher source changes reset stale answers; stale callbacks are guarded against current locks and changed parts. Added real authenticated dual-client keyboard/check/reset and forged student document tests, plus model validation. Geography matching/card responses still use local state; not counted as complete. Current exact-head CI pending; no main merge or deployment.


## Shared sentence acceptance follow-up

Candidate bec2ddb failed four workflows. The browser reproduced the missing central student-object allowlist for sentence answers; migration and editor changes alone were insufficient. Added allowlist, model validation and atomic permutation merging. Updated obsolete source assertions to test the new shared answer behavior and current geography auto-fit call. New CI required; historical verified baseline 18/20 (90%). Geography practice remains local; subject gate remains open. No main merge or deployment.


## Shared geography practice

Matching and question cards now publish a coherent answer state (selection, matched countries, errors, order, card index, reveal and mastery) while preserving teacher-defined source. Legacy exercises open with a common deterministic order; restart publishes a new order. Model and server reject invalid permutations, foreign country IDs and malformed response state. Stale responses are rejected when the assignment changes. Added authenticated two-browser pairing/reset/card/forged-answer regression. Updated the isolated, unpublished migration 204. Candidate CI not confirmed; physical hardware gate remains open. No main merge or deployment.
