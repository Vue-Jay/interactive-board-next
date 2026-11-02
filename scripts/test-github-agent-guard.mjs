import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const guard=JSON.parse(readFileSync(".github/lektrus-agent-guard.json","utf8"));
const agentText=readFileSync("AGENTS.md","utf8");
const copilotText=readFileSync(".github/copilot-instructions.md","utf8");
const guide=readFileSync("docs/development/github-access-preflight.md","utf8");

function issues(policy){
 const errors=[];
 if(policy.version!==1)errors.push("schema version must be 1");
 if(policy.repository!=="Vue-Jay/interactive-board-next")errors.push("wrong repository");
 if(policy.default_branch!=="main")errors.push("wrong branch");
 if(policy.execution?.preferred_route!=="functions.exec")errors.push("connector route missing");
 if(!policy.execution?.discovery_expression?.includes("mcp__GitHub__"))
  errors.push("GitHub tool discovery missing");
 if(policy.execution?.live_probe!=="mcp__GitHub__get_repo")
  errors.push("live tool probe missing");
 if(policy.execution?.live_probe_arguments?.repository_full_name!==policy.repository)
  errors.push("live tool target incorrect");
 if(policy.execution?.read_probe!=="mcp__GitHub__fetch_file" ||
    policy.execution?.read_probe_arguments?.repository_full_name!==policy.repository)
  errors.push("repository content read probe missing");
 const mandatory=[
  "discover_github_tools_before_local_files",
  "verify_connection_by_live_github_call",
  "inspect_repository_file_via_connector",
  "write_changes_via_connector_when_authorized",
  "verify_changes_and_report_branch_commit_tests"
 ];
 for(const value of mandatory)if(!policy.required_actions?.includes(value))
  errors.push("mandatory action removed: "+value);
 const forbidden=[
  "local_checkout_missing_means_github_unavailable",
  "shell_git_unavailable_means_github_connector_unavailable",
  "one_failed_transport_proves_all_github_transports_unavailable",
  "public_unauthenticated_http_proves_authenticated_write_access",
  "prior_turn_access_proves_current_turn_access",
  "github_error_without_live_tool_attempt"
 ];
 for(const value of forbidden)if(!policy.forbidden_inferences?.includes(value))
  errors.push("forbidden inference removed: "+value);
 for(const [key,required] of Object.entries({
  require_current_turn_live_attempt:true,
  require_exact_tool_name_and_error:true,
  require_check_of_other_available_github_tools:true,
  cannot_claim_missing_from_local_directory_only:true,
  never_claim_committed_without_github_commit_receipt:true
 }))if(policy.failure_report?.[key]!==required)
  errors.push("failure-report guarantee removed: "+key);
 const requiredFiles=["AGENTS.md",".github/copilot-instructions.md",
  "docs/development/github-access-preflight.md"];
 for(const file of requiredFiles)if(!policy.policy_files?.includes(file))
  errors.push("policy file absent from registry: "+file);
 return errors;
}
assert.deepEqual(issues(guard),[],"The GitHub access guard policy has weakened");

// Regression test the validator, not just a static list of assertions.
for(const mutation of [
 { ...guard,execution:{...guard.execution,live_probe:null}},
 { ...guard,forbidden_inferences:guard.forbidden_inferences.filter(
  v=>v!=="local_checkout_missing_means_github_unavailable")},
 { ...guard,failure_report:{...guard.failure_report,require_current_turn_live_attempt:false}},
 { ...guard,execution:{...guard.execution,read_probe:null}}
])assert.ok(issues(mutation).length>0,"The guard must fail for weakened policies");

const requiredDocs=[
 [agentText,"AGENTS.md",[
  "Vue-Jay/interactive-board-next","mcp__GitHub__get_repo",
  "mcp__GitHub__fetch_file","ALL_TOOLS","local checkout",
  "current conversation","exact tool/action","CI"
 ]],
 [copilotText,"copilot-instructions.md",[
  "AGENTS.md","mcp__GitHub__get_repo","local directory",
  "exact error","lektrus-agent-guard.json"
 ]],
 [guide,"github-access-preflight.md",[
  "mcp__GitHub__get_repo","mcp__GitHub__fetch_file",
  "current-turn live","missing local","cannot validate"
 ]]
];
for(const [text,name,keywords] of requiredDocs){
 assert.ok(text.length>400,name+" unexpectedly empty");
 for(const keyword of keywords)assert.ok(
  text.toLowerCase().includes(keyword.toLowerCase()),
  name+" missing required guidance: "+keyword
 );
}
const pack=JSON.parse(readFileSync("package.json","utf8"));
assert.equal(pack.scripts?.["test:github-agent-guard"],
 "node scripts/test-github-agent-guard.mjs",
 "Expose the guard audit as an npm script");
const workflow=readFileSync(".github/workflows/lectris-check.yml","utf8");
const preflight='run: node scripts/test-github-agent-guard.mjs';
const build='run: npm run build';
assert.ok(workflow.includes(preflight),"CI does not enforce the guard");
assert.ok(workflow.indexOf(preflight)<workflow.indexOf(build),
 "GitHub guard must run before the application build");
console.log("GitHub agent access guard: policy, both agent instruction files, proof requirements, negative tests and CI order OK");
