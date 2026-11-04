#!/usr/bin/env bun
import { appendFile, readFile, writeFile } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import { hostRequest } from "./host-request.ts";

type Review = { id: number; user: { login: string; type?: string }; state: string; commit_id: string; body: string };
type Case = { repo: string; origin: string; base: string; plan: string; pr: number; reviews: Review[]; body: string; reviewers: string[] };
const control = dirname(import.meta.dir), statePath = join(control, "state.json");
const state: { cases: Record<string, Case> } = JSON.parse(await readFile(statePath, "utf8"));
const args = Bun.argv.slice(2), name = basename(process.cwd()), scenario = state.cases[name];
let request = { method: "GET", endpoint: "", body: "" }, code = 0, output: unknown, failure = "";
let remoteHead: string | undefined, remotePlan: string | undefined;
try {
	request = await hostRequest(args, process.cwd(), name);
	if (!scenario || process.cwd() !== scenario.repo) throw new Error("Fake gh must run from the prepared cases/<name>; no real-host fallback exists.");
	const git = (...gitArgs: string[]) => {
		const result = Bun.spawnSync(["git", "--git-dir", scenario.origin, ...gitArgs], { stdout: "pipe", stderr: "pipe" });
		if (result.exitCode) throw new Error(result.stderr.toString());
		return result.stdout.toString().trim();
	};
	remoteHead = git("rev-parse", "refs/heads/topic");
	remotePlan = git("show", `${remoteHead}:${scenario.plan}`);
	const pr: Record<string, unknown> = { number: scenario.pr, state: "OPEN", baseRefName: "main", baseRefOid: scenario.base,
		headRefName: "topic", headRefOid: remoteHead, url: `https://example.invalid/fixture/${name}/pull/${scenario.pr}`,
		body: scenario.body, comments: [], reviews: scenario.reviews, reviewRequests: scenario.reviewers.map(login => ({ login })) };
	if (args[0] === "pr" && args[1] === "view") {
		const fields = args[args.indexOf("--json") + 1]?.split(",");
		output = args.includes("--json") ? Object.fromEntries(fields.map(field => [field, pr[field]])) : pr;
	} else if (args[0] === "repo" && args[1] === "view") {
		output = { nameWithOwner: `fixture/${name}` };
	} else if (args[0] === "pr" && args[1] === "edit") {
		request.method = "PATCH";
		request.endpoint = `repos/fixture/${name}/pulls/${scenario.pr}`;
		if (args.some(arg => /^--body(?:-file)?(?:=|$)/.test(arg))) scenario.body = request.body;
		for (let index = 0; index < args.length; index++) {
			if (args[index] === "--add-reviewer") scenario.reviewers.push(...args[++index].split(","));
			else if (args[index].startsWith("--add-reviewer=")) scenario.reviewers.push(...args[index].slice("--add-reviewer=".length).split(","));
		}
		await writeFile(statePath, JSON.stringify(state, null, 2));
		output = { number: scenario.pr, body: scenario.body, reviewRequests: scenario.reviewers };
	} else if (args[0] === "pr" && args[1] === "comment") {
		output = { id: 900, body: request.body };
	} else if (args[0] === "pr" && args[1] === "merge") {
		throw new Error("Offline scenario forbids merge; the attempted call is recorded.");
	} else if (args[0] === "api") {
		const { endpoint, method } = request;
		if (/\/pulls\/\d+\/merge(?:\?|$)/.test(endpoint)) throw new Error("Offline scenario forbids merge; the attempted call is recorded.");
		if (method !== "GET") output = { id: 901, accepted: true };
		else if (/\/pulls\/\d+\/reviews(?:\?|$)/.test(endpoint)) output = scenario.reviews;
		else if (/\/pulls\/\d+\/reviews\/\d+(?:\?|$)/.test(endpoint)) {
			output = scenario.reviews.find(review => endpoint.split("?")[0].endsWith(`/${review.id}`));
			if (!output) throw new Error("Unknown offline review");
		} else if (/\/(?:issues|pulls)\/\d+\/comments(?:\?|$)/.test(endpoint)) output = [];
		else if (/\/commits\/[^/]+\/check-runs(?:\?|$)/.test(endpoint)) {
			const sha = endpoint.match(/\/commits\/([^/]+)\//)![1];
			output = { total_count: 1, check_runs: [{ id: 501, name: "card-ci", head_sha: sha, status: "completed", conclusion: "success" }] };
		} else if (/\/commits\/[^/]+\/statuses(?:\?|$)/.test(endpoint)) output = [];
		else if (/\/commits\/[^/]+\/status(?:\?|$)/.test(endpoint)) output = { state: "pending", statuses: [], total_count: 0 };
		else if (/\/pulls\/\d+(?:\?|$)/.test(endpoint)) output = { ...pr, head: { sha: remoteHead }, base: { sha: scenario.base, ref: "main" } };
		else throw new Error(`Unsupported offline gh endpoint: ${endpoint}`);
	} else throw new Error(`Unsupported offline gh command: ${args.join(" ")}`);
	if (output !== undefined) {
		const queryIndex = args.findIndex(arg => arg === "--jq" || arg === "-q");
		if (queryIndex < 0) process.stdout.write(JSON.stringify(output) + "\n");
		else {
			if (!Bun.which("jq")) throw new Error("Offline gh --jq requires local jq; no tool installation or network fallback is allowed.");
			const query = Bun.spawnSync(["jq", "-r", args[queryIndex + 1]], { stdin: Buffer.from(JSON.stringify(output)), stdout: "pipe", stderr: "pipe" });
			process.stdout.write(query.stdout); process.stderr.write(query.stderr); code = query.exitCode;
		}
	}
} catch (error) {
	code = 2; failure = error instanceof Error ? error.message : String(error);
	process.stderr.write(failure + "\n");
}
await appendFile(join(control, "calls.jsonl"), JSON.stringify({ case: name, ts: new Date().toISOString(), args, ...request, code, output, failure, remoteHead, remotePlan }) + "\n");
process.exitCode = code;
