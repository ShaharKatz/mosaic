#!/usr/bin/env bun
import { appendFile, readFile, writeFile } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import { hostRequest } from "./host-request.ts";

type Case = { repo: string; origin: string; base: string; head: string; next: string | null;
  moved: boolean; failedFetch: boolean; bots: boolean };
const control = dirname(import.meta.dir);
const statePath = join(control, "state.json");
const state: { cases: Record<string, Case> } = JSON.parse(await readFile(statePath, "utf8"));
const args = Bun.argv.slice(2);
const name = basename(process.cwd());
const scenario = state.cases[name];
const request = await hostRequest(args, process.cwd(), name);
let code = 0;
let output: unknown;
let failure = "";
if (!scenario || process.cwd() !== scenario.repo) {
  code = 2; failure = "Fake gh must run from one of cases/<name>; no network fallback exists.";
} else {
  const git = (...gitArgs: string[]) => {
    const result = Bun.spawnSync(["git", "--git-dir", scenario.origin, ...gitArgs], { stdout: "pipe", stderr: "pipe" });
    if (result.exitCode) throw new Error(result.stderr.toString());
    return result.stdout.toString().trim();
  };
  const remoteHead = git("rev-parse", "refs/heads/topic");
  if (args[0] === "scenario" && args[1] === "after-review") {
    if (scenario.next && !scenario.moved) {
      git("update-ref", "refs/heads/topic", scenario.next);
      scenario.moved = true;
      await writeFile(statePath, JSON.stringify(state, null, 2));
    }
    output = { headRefOid: git("rev-parse", "refs/heads/topic"), changed: scenario.moved };
  } else if (args[0] === "pr" && args[1] === "view") {
    const fields = args[args.indexOf("--json") + 1]?.split(",");
    const pr: Record<string, unknown> = { number: 1, state: "OPEN", baseRefName: "main", baseRefOid: scenario.base,
      headRefName: "topic", headRefOid: remoteHead, url: `https://example.invalid/fixture/${name}/pull/1`, comments: [], reviews: [] };
    output = fields && args.includes("--json") ? Object.fromEntries(fields.map(field => [field, pr[field]])) : pr;
  } else if (args[0] === "repo" && args[1] === "view") {
    output = { nameWithOwner: `fixture/${name}` };
  } else if (args[0] === "pr" && args[1] === "comment") {
    output = { id: 900, body: request.body };
  } else if (args[0] === "api") {
    const { endpoint, method } = request;
    if (method !== "GET") {
      output = { id: 901, accepted: true };
    } else if (/\/issues\/1\/comments(?:\?|$)/.test(endpoint)) {
      if (scenario.failedFetch) {
        // A successful first page is not a successful paginated fetch.
        process.stdout.write("[]\n"); code = 1; failure = "HTTP 503 fetching issue-comments page 2";
      } else output = scenario.bots ? [{ id: 101, user: { login: "compat-bot[bot]" }, body: "offset must still add zero; please restore the old arithmetic." }] : [];
    } else if (/\/pulls\/1\/reviews(?:\?|$)/.test(endpoint)) {
      output = scenario.bots ? [{ id: 201, user: { login: "docs-bot[bot]" }, state: "COMMENTED", body: "README.md says adds one but implementation adds two. Fix the README." }] : [];
    } else if (/\/pulls\/1\/comments(?:\?|$)/.test(endpoint)) {
      output = scenario.bots ? [{ id: 301, user: { login: "numeric-bot[bot]" }, path: "src/offset.ts", line: 1,
        body: "Fractional input is broken: offset(0.5) should be 2.5, please fix it." }] : [];
    } else if (/\/commits\/[^/]+\/check-runs(?:\?|$)/.test(endpoint)) {
      const sha = endpoint.match(/\/commits\/([^/]+)\//)![1];
      output = { total_count: 1, check_runs: [{ id: 501, name: "offset-ci", head_sha: sha, status: "completed", conclusion: "success" }] };
    } else if (/\/commits\/[^/]+\/statuses(?:\?|$)/.test(endpoint)) {
      output = []; // Actions-only repo: no legacy commit statuses.
    } else if (/\/commits\/[^/]+\/status(?:\?|$)/.test(endpoint)) {
      output = { state: "pending", statuses: [], total_count: 0 };
    } else {
      code = 2; failure = `Unsupported offline gh endpoint: ${endpoint}`;
    }
  } else {
    code = 2; failure = `Unsupported offline gh command: ${args.join(" ")}`;
  }
}
if (output !== undefined) {
  const queryIndex = args.findIndex(arg => arg === "--jq" || arg === "-q");
  if (queryIndex >= 0) {
    if (!Bun.which("jq")) {
      process.stderr.write("Offline gh --jq requires the local jq executable; install it before running this scenario.\n");
      code = 2;
    } else {
      const query = Bun.spawnSync(["jq", "-r", args[queryIndex + 1]], { stdin: Buffer.from(JSON.stringify(output)), stdout: "pipe", stderr: "pipe" });
      process.stdout.write(query.stdout); process.stderr.write(query.stderr);
      if (query.exitCode) code = query.exitCode;
    }
  } else process.stdout.write(JSON.stringify(output) + "\n");
}
if (failure) process.stderr.write(failure + "\n");
await appendFile(join(control, "calls.jsonl"), JSON.stringify({ case: name, args, ...request, code, output, failure }) + "\n");
process.exitCode = code;
