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

## Анатомия человека: обязательный постоянный план

Для всех изменений атласа человека сначала читать
[`docs/ANATOMY_HUMAN_CANONICAL_PLAN.md`](../docs/ANATOMY_HUMAN_CANONICAL_PLAN.md).
Там закреплены научные источники, требования к рисункам, порядок задач,
критерии визуальной приёмки и точный следующий незавершённый этап.
После каждой итерации обновлять журнал плана. «Дальше» = следующий этап,
а не новые схемы или только тесты. Этот пункт дополняет, но не заменяет
существующие правила GitHub в этом файле.
