# Lektrus: GitHub connector access preflight

**Audience:** assistants performing development tasks for `Vue-Jay/interactive-board-next`.
**Goal:** prevent false statements that GitHub is unavailable when only the
assistant's container checkout is absent.

## Correct sequence

1. In the current conversation, discover the connected GitHub actions
   (`ALL_TOOLS` in ChatGPT Code Mode, prefix `mcp__GitHub__`).
2. Immediately call `mcp__GitHub__get_repo` with
   `{repository_full_name:"Vue-Jay/interactive-board-next"}`.
   A successful response establishes read access to the repository; inspect
   `permissions.push` (when available) before assuming write access.
3. Read one actual source file using `mcp__GitHub__fetch_file` with
   `{repository_full_name:"Vue-Jay/interactive-board-next",path:"README.md",ref:"main"}`.
   If a tool is absent or fails, discover and try other available GitHub
   connector read actions; distinguish permission errors from missing tools.
4. Do requested development using GitHub connector actions. Create a branch,
   commit code changes, open a PR, verify GitHub Actions and merge when tests
   pass and merge is allowed. Report precise branch, PR, commit and checks.
5. Before stating an inability to access GitHub, record a **current-turn live
   GitHub call that failed**, plus the action's exact failure. A missing local
   worktree, failed shell command or one failed endpoint is never sufficient.

### Examples

**Valid proof:** a successful `mcp__GitHub__get_repo` response shows
`permissions.push: true`, and `mcp__GitHub__fetch_file` returns the real
`README.md` blob. Proceed with GitHub directly even when `/mnt/data` is empty.

**Invalid proof:** running `ls` in the container and finding no checked-out
repository; then claiming GitHub is disconnected. The container does not
automatically mount files from external plugins.

**Limited proof:** an unauthenticated `https://github.com/...` HTTP request
succeeds. This establishes only public web reachability and does **not**
establish authenticated GitHub connector access or write permissions.

**Real failure:** `mcp__GitHub__update_file` fails with a GitHub permission
error; distinguish denied write access from read access and report the exact
error, while exploring alternate available authorized actions.

## What the protection can and cannot enforce

- Root `AGENTS.md` instructs tools and coding agents that load repository
  instructions. `.github/copilot-instructions.md` advertises the same rule to
  GitHub Copilot workflows that consume that file.
- `.github/lektrus-agent-guard.json` is the canonical machine-readable
  contract: repository, branch, live probes, banned inferences and failure
  evidence requirements.
- `scripts/test-github-agent-guard.mjs` validates instruction presence and
  checks they still require the live probe. `npm run test:github-agent-guard`
  runs the test. GitHub Actions runs it before app build. Failure makes the
  workflow red if someone accidentally removes the guard.
- **Not a runtime hook:** no repository file can force the ChatGPT model to
  execute a particular action or reveal whether it did so. CI can verify
  guard-file integrity, not the status of the user's connector session.
  A new conversation still needs an actual GitHub tool call.

Do not create fake proof files or hard-code credentials. Tokens from GitHub
Actions belong to the CI runner and cannot validate ChatGPT's separate
GitHub connector authentication.
