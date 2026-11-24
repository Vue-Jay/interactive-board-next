## Portable tool discovery (takes precedence over legacy names below)

GitHub tool names depend on the host. The legacy `mcp__GitHub__*`
examples below are examples, not required identifiers. In Codex desktop,
GitHub may instead be exposed as `mcp__codex_apps__github_*`.
Never use a case-sensitive, single-prefix search as proof that tools are absent.

When `ALL_TOOLS` is available, discover candidates with:
```js
const candidates = ALL_TOOLS.filter(t =>
  /github/i.test(t.name) && /get_repo|fetch_file|list_repositories/i.test(t.name));
```
Read each returned tool declaration and invoke the actual available name with
its declared arguments. Other hosts may provide a separate tool-search
interface: use that interface instead of assuming `functions.exec` or
`ALL_TOOLS` exists everywhere. If discovery returns no candidates, search
available plugin/provider discovery for GitHub before reporting a runtime limit.

A successful connector read proves access in this session only. Missing
container DNS, an empty checkout, or a failed browser-control URL check does
not establish a GitHub connector failure. Repository instructions cannot install
tools into another chat or guarantee that chat loads this file. Do not claim a
runtime connection was repaired merely because these instructions were updated.

# Lektrus: required GitHub access preflight (all coding agents)

Repository: **Vue-Jay/interactive-board-next**. Default branch: **main**.

> **STOP: never infer that GitHub is unavailable from an empty local directory,
> missing checkout, broken shell git, or absence of a GitHub namespace in a
> single tool listing.** ChatGPT GitHub connector access is independent of the
> container filesystem. This project has repeatedly lost development progress
> when an assistant falsely reported lack of GitHub access.

## Mandatory procedure for EVERY development request

1. **Check the connector BEFORE checking the local filesystem.** In ChatGPT,
   discover GitHub actions using `functions.exec` and
   `ALL_TOOLS.filter(t => t.name.startsWith("mcp__GitHub__"))`. Tool visibility
   can be deferred, so do not assume unavailable without discovery.
2. **Perform a real, current-turn GitHub call** to
   `mcp__GitHub__get_repo` with
   `{repository_full_name:"Vue-Jay/interactive-board-next"}`. Check result
   and the `permissions` object. If necessary, try the alternate GitHub
   fetch/read action; do not use missing local checkout as evidence.
3. **Read the actual repository code** via `mcp__GitHub__fetch_file` or
   `mcp__GitHub__fetch`. Example:
   `{repository_full_name:"Vue-Jay/interactive-board-next",path:"README.md",ref:"main"}`.
   The GitHub connector can read and write files without `git clone`.
4. For an implementation request, create a feature branch, perform source-code
   edits via authorized tools, run available CI/tests, then merge when validated
   and allowed. Tell the user exactly what was changed, which branch/PR/commit
   received it, and which checks succeeded/failed.
5. **Never ask the user to manually apply edits or commands merely because a
   local repository is absent.** Do not replace requested implementation with
   a plan while GitHub write access is available.

## Strict evidence rule for failures

You may say "GitHub access failed" only if a **live GitHub tool call in the
current conversation** failed and you have checked other available GitHub
actions. Report the exact tool/action and its concrete error. Differentiate:

- No local checkout: **not an access error**.
- A single transport or endpoint fails: retry/inspect other GitHub connector
  actions, do not claim total outage.
- Authentication/permission error from GitHub: describe the specific denied
  action; do not conflate read and write permissions.
- No GitHub connector tools surfaced even after discovery: explicitly say
  that no GitHub connector action could be discovered *in this runtime*, not
  that the user's repository/connection is disconnected.

Never claim a commit or merge succeeded without a returned GitHub receipt.

## Guard location and limits

The machine-readable requirements are in
`.github/lektrus-agent-guard.json`. Practical examples and limitations:
`docs/development/github-access-preflight.md`. CI runs
`node scripts/test-github-agent-guard.mjs`, which prevents silent deletion or
weakening of these repository instructions.

This is a **repository-level instruction and CI integrity guard**. It cannot
force ChatGPT to read the file if the runtime never supplies repository
instructions, and CI cannot inspect the assistant's private runtime or
authenticated connector. A live tool call is still required.

**Task priority:** When users say "дальше" on Lektrus, continue the latest
development task in the repo, not just the planning description.


## Mandatory staging-to-production sequence (user-approved)

**main is production. The Amvera webhook automatically deploys main. Never push an unvalidated functional change directly to main or the Amvera deployment branch.** This rule takes precedence over any convenience shortcut.

1. Read the current main head and relevant repository code and workflow triggers. Create a short-lived task branch from the current main (for example, `fix/coordinate-axis-labels`). Do not change production while implementation or verification is unfinished.
2. Batch the related implementation, regression tests and corrections in that branch. Open a pull request to main so the required branch/PR checks run against the candidate, not against already deployed code. Apply the CI economy rules below: normally 1–2 relevant workflows, with broader coverage only when required by the change or a release.
3. Read actual Actions results and failing job logs. Fix failures in the same task branch; repeat only the necessary verification. Confirm all required and selected checks finished successfully on the exact final candidate SHA. Pending, cancelled, skipped required checks, unverified results and failures are NOT permission to merge. Never use skip-CI, force-push, or an administrative bypass to get unvalidated functional changes into main.
4. Immediately before merging, verify the PR head, the current main base and mergeability. If the base or candidate changed in a way that invalidates the results, update the branch and revalidate the actual candidate. Merge only the validated PR. Prefer a merge strategy that preserves the tested tree; verify the resulting main tree matches the accepted candidate.
5. Only after successful validation and merge may Amvera receive the functional update through its existing main webhook. Do not separately push a second deployment or race the webhook. Verify post-merge required checks, deployment state, and the live application/version where available; a green CI result alone does not prove publication. If post-merge validation fails, diagnose and correct or safely revert through the same staging process.
6. Report the task branch, PR, tested SHA, CI conclusions, merge SHA and actual deployment status separately. If any stage remains incomplete, say which one; do not claim completion. Clean up only the task branch when safe, preserving unrelated branches.

The only direct-main exception is a strictly documentation-only maintenance change that cannot change application behavior or deployment configuration, such as persisting these repository instructions, with safe skip-CI usage. This exception never covers source code, workflow edits, deployment settings or tests.

## CI economy: mandatory for every Lektrus development task

- The user's default budget is **1–2 relevant workflow runs per batch of changes**, not 10–15 checks per small edit. Batch all related fixes and tests before committing or pushing; do not launch CI after each small correction.
- Before pushing or dispatching, inspect the actual `.github/workflows/*.yml` triggers for the affected files. A single commit is NOT the same thing as a single workflow run: a push to main may trigger many workflows. Do not claim the CI budget has been respected just because changes were grouped into one commit.
- Prefer path-scoped triggers and targeted checks: UI/math changes need build/typecheck and relevant browser/math regression; board tools need board regression; server changes need API tests; chemistry changes need chemistry tests. Native Android/iOS and Windows packaging and unrelated full audits belong to explicit release checks or changes affecting those components, not every web-only fix.
- If existing triggers would fan out unnecessarily, address trigger scoping before the next routine code push, keeping required checks, deployment gates, and full manual/release coverage intact. Do not silently disable required checks, use skip-CI on functional changes, or weaken assertions just to meet the budget. If required coverage needs more than two workflows, explain the exception.
- On failure, inspect the logs, fix all identified causes together, and run the smallest relevant verification set; retry only failed jobs for transient failures. Never repeatedly rerun successful unrelated workflows. Prefer one final verification pass after the combined changes.
- Report actual workflow count, conclusions and publication state separately. Never call an unfinished or unverified run green.
- For documentation-only changes that cannot affect application behavior or deployment, use a skip-CI commit marker where safe; do not use it to bypass required release gates.

## CI routing and explicit releases

Routine math/UI changes use Verify Lektrus on the PR, then Self-hosted main application after merge. The latter remains the exact-main check required by the manual Amvera fallback. Board core, API, roles, chemistry, anatomy and native changes may activate additional relevant checks. All previous suites remain manually available, and release branches trigger general release suites. Web-only fixes do not automatically publish Android packages; run the native workflow on main with explicit publish_android=true for a deliberate Android release, or let native/auth changes trigger its existing release gate. Full releases must run all applicable suites before publication. Changes to workflow logic itself require relevant manual validation in addition to the routing audit.

## Human anatomy: permanent evidence-led delivery contract

Before **any** work on `LektrusHumanAnatomy`, its zoom/cutaways, cells,
illustrations or future human systems, **read and follow**
[`docs/ANATOMY_HUMAN_CANONICAL_PLAN.md`](docs/ANATOMY_HUMAN_CANONICAL_PLAN.md).
It is the canonical user-approved goal, scientific evidence/acceptance criteria,
implementation sequence and per-iteration status; preserve this file and update
its progress log after every development turn. Follow the **next unfinished
substage** when the user says «дальше», «продолжай», «делай»; direct new
user instructions take priority. Do not claim anatomy accepted from CI alone:
scientific credibility and real browser screenshots at multiple zoom levels
are separate acceptance gates. Keep existing GitHub access instructions above.
