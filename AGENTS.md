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
