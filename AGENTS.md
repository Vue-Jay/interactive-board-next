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
