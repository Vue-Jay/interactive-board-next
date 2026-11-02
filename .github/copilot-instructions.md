# Lektrus: GitHub connector access is the first coding step

**Read root [AGENTS.md](../AGENTS.md) for mandatory repository preflight.**
Canonical repository: `Vue-Jay/interactive-board-next`, base branch: `main`.

- Before doing any development task, **discover GitHub tools and perform a live
  `get_repo` call** for this repository. When using ChatGPT Code Mode,
  discover `mcp__GitHub__*` with `ALL_TOOLS` and call
  `tools.mcp__GitHub__get_repo({repository_full_name:"Vue-Jay/interactive-board-next"})`.
- A missing local directory or failed `git clone` **does not prove** the
  connector is unavailable. The connector supports reading and editing files
  directly through GitHub.
- If the first tool fails, check other available connector GitHub read actions.
  Only state a failure after the live attempts, and include the exact error.
- Make and verify real code changes; do not ask the user to transfer snippets.
- Never announce a successful commit or merge without a tool receipt.

Machine-checkable rules:
`.github/lektrus-agent-guard.json`.
Integrity test:
`node scripts/test-github-agent-guard.mjs`.

**Scope:** repository instructions for code assistants; they do not
themselves control ChatGPT's runtime or authenticate its connector.
