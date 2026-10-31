/** Dispatch one reference-enrichment run after a 20-minute cooldown.
 * Scheduled checks happen every five minutes; an active worker always wins.
 * No API key or external model is called by this dispatcher.
 */
const WORKER = "lektrus-lab-autofill-worker.yml";
const COOLDOWN_MS = 20 * 60 * 1000;
const RUNNING = new Set(["queued", "in_progress", "waiting", "pending", "requested"]);
export function dispatchDecision(runs, now = Date.now()) {
  const ordered = [...runs].sort((a, b) =>
    Date.parse(b.created_at) - Date.parse(a.created_at));
  if (ordered.some(run => RUNNING.has(run.status)))
    return { launch: false, reason: "worker-active" };
  const last = ordered[0];
  if (last) {
    const started = Date.parse(last.run_started_at || last.created_at);
    if (!Number.isFinite(started))
      return { launch: false, reason: "invalid-run-timestamp" };
    const elapsed = now - started;
    if (elapsed < COOLDOWN_MS)
      return { launch: false, reason: "cooldown", retryAfterMinutes:
        Math.ceil((COOLDOWN_MS - elapsed) / 60000) };
  }
  return { launch: true, reason: last ? "worker-idle" : "first-run" };
}
async function github(url, token, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: "Bearer " + token,
      "X-GitHub-Api-Version": "2022-11-28",
      ...options.headers,
    },
  });
  if (!response.ok)
    throw new Error("GitHub API returned " + response.status + " for " + url
      + ": " + (await response.text()).slice(0, 400));
  return response.status === 204 ? null : response.json();
}
export async function main(env = process.env, now = Date.now()) {
  if (env.LEKTRUS_AUTOFILL_ENABLED === "false") {
    console.log("Laboratory autofill is explicitly paused.");
    return;
  }
  if (env.LEKTRUS_AUTOFILL_KEY_PRESENT !== "true") {
    console.log("No OPENAI_API_KEY secret: do not launch an AI worker.");
    return;
  }
  const repo = env.GITHUB_REPOSITORY;
  const token = env.GH_TOKEN;
  if (!repo || !token) throw new Error("Missing GitHub repository/token");
  const api = (env.GITHUB_API_URL || "https://api.github.com")
    + "/repos/" + repo + "/actions/workflows/" + WORKER;
  const result = await github(api + "/runs?per_page=30", token);
  const decision = dispatchDecision(result.workflow_runs || [], now);
  console.log("Lektrus enrichment gate: " + JSON.stringify(decision));
  if (!decision.launch) return;
  // The GITHUB_TOKEN belongs to the dispatcher, not the AI research job.
  await github(api + "/dispatches", token, {
    method: "POST",
    body: JSON.stringify({ ref: env.GITHUB_REF_NAME || "main" }),
    headers: { "Content-Type": "application/json" },
  });
  console.log("Dispatched " + WORKER + " for " + repo);
}
if (process.argv[1] && import.meta.url === new URL("file://" +
  (process.argv[1].startsWith("/") ? process.argv[1] :
    process.cwd() + "/" + process.argv[1])).href) {
  main().catch(error => { console.error(error); process.exitCode = 1; });
}
