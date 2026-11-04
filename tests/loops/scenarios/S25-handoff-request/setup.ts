import { createHash } from "node:crypto";
import { appendFile, chmod, copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import { install } from "../../../../kit/install.ts";

export const PLAN = "docs/plans/archived/0007-report-empty-state.md";
export const CASES = {
	"S25-handoff-request": "request",
	"S26-handoff-accept": "accept",
	"S27-handoff-returned": "returned",
} as const;
export type Scenario = keyof typeof CASES;
export type CaseName = typeof CASES[Scenario];
const stamp = "2026-11-03T10:00:00Z";
const roster = `# People
Registry: one row per person; handles are never reused. No emails or secrets. Reviewed rows say who may accept which gate.

| Handle | Roles | Tracker id | Tracker mention | GitHub login | Prefers |
|---|---|---|---|---|---|
| @dana | designer | dana | @dana | dana-design | surface: tracker-reply |
| @lior | product | lior | @lior | lior-pm | — |
`;

export async function setup(scenario: Scenario): Promise<void> {
	const work = process.cwd();
	if (!Object.hasOwn(CASES, scenario) || basename(work) !== "work"
		|| !basename(dirname(work)).startsWith(`mosaic-loop-${scenario}-`)) {
		throw new Error("Handoff setup writes only a runner-created disposable scenario work directory.");
	}
	if (!await Bun.file(join(work, "tools/doctor.ts")).exists()) return;
	const name = CASES[scenario], control = join(work, ".scenario"), repo = join(work, "cases", name);
	const origin = join(control, `${basename(dirname(work))}.git`);
	const manifest = join(control, "manifest.json"), overlay = join(control, "overlay");
	await mkdir(join(control, "bin"), { recursive: true });
	await mkdir(join(overlay, "docs/surfaces"), { recursive: true });
	await writeFile(join(overlay, "docs/surfaces/people.md"), roster);
	await appendFile(join(work, ".gitignore"), "\n/.scenario/\n/cases/\n");
	await copyFile(join(import.meta.dir, "fake-gh.ts"), join(control, "bin/gh"));
	await copyFile(join(import.meta.dir, "../S23-final-review-ready/host-request.ts"), join(control, "bin/host-request.ts"));
	await chmod(join(control, "bin/gh"), 0o755);
	await writeFile(join(control, "bin/codex"), "#!/bin/sh\nprintf 'Codex is unavailable in this offline scenario\\n' >&2\nexit 127\n", { mode: 0o755 });
	await writeFile(manifest, JSON.stringify({
		project: { name: "Report cards", summary: "A report dashboard with a responsive empty-state card." },
		topology: "monorepo", members: [], remotes: { link: origin }, tracking: { mode: "local" },
		landing: { mode: "pull-request", host: "github" },
		handoff: { flows: [{ id: "design-acceptance", gates: [{ role: "designer", surfaces: ["tracker-reply", "pr-review"], artifacts: ["pr"] }] }] },
	}));
	await install({ manifest, target: repo, overlay, kitCommit: "scenario" });
	await writeFile(join(repo, ".omp/config.yml"), await readFile(join(work, ".omp/config.yml"), "utf8"));
	await writeFile(join(repo, ".gitignore"), "/.scenario/\n");
	const git = (...args: string[]) => {
		const result = Bun.spawnSync(["git", ...args], { cwd: repo, stdout: "pipe", stderr: "pipe" });
		if (result.exitCode) throw new Error(`${name}: git ${args.join(" ")}\n${result.stderr}`);
		return result.stdout.toString().trim();
	};
	await mkdir(join(repo, "src"), { recursive: true });
	await writeFile(join(repo, "src/card.ts"), "export const emptyState = (_width: number) => ({ message: 'No reports.', action: 'Create report', accent: 'blue' });\n");
	await writeFile(join(repo, "README.md"), "Report dashboard empty-state card.\n");
	git("init", "-b", "main");
	git("config", "user.name", "Scenario Author");
	git("config", "user.email", "scenario@example.invalid");
	git("config", "commit.gpgsign", "false");
	git("add", "."); git("commit", "-m", "base dashboard");
	const base = git("rev-parse", "HEAD");
	git("init", "--bare", "-b", "main", origin);
	git("remote", "add", "origin", origin); git("push", "origin", "main");
	git("checkout", "-b", "topic");
	await writeFile(join(repo, "src/card.ts"), name === "returned"
		? "export const emptyState = (width: number) => ({ message: width < 600 ? 'Nothing here' : 'No saved reports yet.', action: 'Create report', accent: 'blue' });\n"
		: "export const emptyState = (_width: number) => ({ message: 'No saved reports yet.', action: 'Create report', accent: 'blue' });\n");
	await writeFile(join(repo, "README.md"), "The approved report card uses ‘No saved reports yet.’ on desktop and mobile, with a Create report action and blue accent.\n");
	git("add", "src/card.ts", "README.md"); git("commit", "-m", "implement report empty-state copy");
	const reviewedHead = git("rev-parse", "HEAD");
	const verify = Bun.spawnSync([process.execPath, "-e", "import {emptyState} from './src/card.ts'; const card=emptyState(1280); if(card.message!=='No saved reports yet.' || card.action!=='Create report') throw Error('desktop card regression'); console.log('desktop card smoke PASS; mobile was not exercised by this fixture receipt');"], { cwd: repo, stdout: "pipe", stderr: "pipe" });
	if (verify.exitCode) throw new Error(verify.stderr.toString());
	await mkdir(join(repo, "docs/plans/evidence/0007/final-review/R1"), { recursive: true });
	await writeFile(join(repo, "docs/plans/evidence/0007/verification.txt"), verify.stdout);
	await writeFile(join(repo, "docs/plans/evidence/0007/final-review/R1/review.md"), `Synthetic prior-session fixture history, not a review performed by setup.\nAPPROVE (0 findings)\nReviewed ${reviewedHead} on ${base}.\n`);
	await writeFile(join(repo, "docs/plans/evidence/0007/final-review/R1/test-results.txt"), verify.stdout);
	await mkdir(dirname(join(repo, PLAN)), { recursive: true });
	await writeFile(join(repo, PLAN), `---
status: done
repo: link-repo
areas: [src/card.ts, README.md]
flow: design-acceptance
acceptors: { designer: "@dana" }
tracker: { provider: replay, id: eng-7, key: ENG-7, url: replay://ENG-7 }
---
# Report dashboard empty state
## Context
Use consistent, welcoming report-dashboard copy on desktop and mobile.
## Scope
Only src/card.ts and README.md; report-card copy and visual preferences within those files. Account notification settings and delivery are out of scope.
## Task breakdown
### T1 — Empty-state card
- files: src/card.ts, README.md
- AC1: at widths 1280 (desktop) and 375 (mobile), emptyState(width).message is exactly "No saved reports yet.".
- AC2: the action is "Create report" and the accent is blue on both widths.
## Review checklist
Check both widths and avoid unrelated account settings changes.
## Verification
See ../evidence/0007/verification.txt for the actual desktop smoke receipt. The prior-session approval below is synthetic scenario history, not a claim that setup reviewed or visually tested mobile.
## Planning log
Synthetic history: the human approved this scope, AC1/AC2 and design-acceptance with @dana before execution.
## Execution log
Synthetic history: ordinary task reviewers approved, human sign-off granted, close-out archived the plan; PR pr://12 is open and unmerged. The ledger Landed cell is empty. No new approval is inferred from this fixture history.
- final R1 gpt-reviewer: APPROVE (0 findings)
- final R1 gpt-reviewer: reviewed ${reviewedHead} on ${base}
- Prior-session final readiness: all comment surfaces read; no actionable host comments; exact-head Actions passed; no legacy statuses. Record-only deltas after this reviewed head use replay, not another code-review round.
`);
	await writeFile(join(repo, "docs/plans/README.md"), `# Plans\n\n| Plan | Title | Status | Repo(s) | Branch | Landed |\n|---|---|---|---|---|---|\n| [0007](archived/0007-report-empty-state.md) | Report dashboard empty state | done | link-repo | topic | |\n`);
	git("add", "docs"); git("commit", "-m", "archive signed-off plan and final-review evidence");
	const requestHead = git("rev-parse", "HEAD");
	const writer = name === "request" ? "w-1a2b3c4d#2" : "w-old00001#3";
	const requestId = "handoff-r1", danaId = name === "returned" ? "dana-return-3" : "dana-accept-3";
	const requestBody = `@dana Please accept the report empty state on desktop and mobile against AC1/AC2. PR pr://12 (head ${requestHead}); evidence docs/plans/evidence/0007/verification.txt. No preview is configured.`;
	const comments = name === "request" ? [] : [
		{ id: requestId, author: writer, writer, body: requestBody, createdAt: stamp, onBehalfOf: null },
		{ id: "lior-reply-1", author: "lior", body: "LGTM", createdAt: "2026-11-03T10:05:00Z", parentId: requestId, onBehalfOf: null },
		{ id: "relayed-reply-2", author: "assistant-bot", onBehalfOf: "dana", body: "Approved", createdAt: "2026-11-03T10:06:00Z", parentId: requestId },
		{ id: danaId, author: "dana", onBehalfOf: null, parentId: requestId, createdAt: "2026-11-03T10:07:00Z", body: name === "returned"
			? "Returned:\n1. At width 375 the card says ‘Nothing here’; AC1 requires ‘No saved reports yet.’ on mobile as well as desktop. Reproduce with emptyState(375) in src/card.ts.\n2. I prefer ‘Start a report’ instead of ‘Create report’ for the action in src/card.ts and README.md; the current action meets AC2. Please ask the contributor to approve this preference.\n3. Unrelated request: add weekly email notifications to account settings. There is no notification settings or delivery module in this change; keep it out of this PR and track separately."
			: "Accepted: matches the spec on desktop and mobile" },
	];
	const lastEvent = { event: name === "request" ? "review" : "handoff", ts: stamp };
	const managed = { plan: PLAN, repos: ["link-repo"], areas: ["src/card.ts", "README.md"], branch: { "link-repo": "topic" }, writer, lastEvent, parked: null };
	const body = `Human-owned context: designer acceptance before the contributor merges.\n\n<!-- mosaic:begin -->\nplan: ${PLAN}\nrepos: link-repo\nareas: src/card.ts, README.md\nbranch: link-repo:topic\nwriter: ${writer}\nlast-event: ${lastEvent.event} ${stamp}\nparked: none\n<!-- mosaic:end -->`;
	await writeFile(join(repo, "docs/tracker/items.json"), JSON.stringify([{ key: "ENG-7", id: "eng-7", title: "Report dashboard empty state", body, state: lastEvent.event,
		assignee: "contributor", labels: ["mosaic"], team: "Engineering", url: "replay://ENG-7", updatedAt: stamp,
		repos: ["link-repo"], managed, comments, attachments: [] }], null, 2) + "\n");
	const inventorySha256 = createHash("sha256").update(await readFile(join(repo, "docs/tracker/items.json"))).digest("hex");
	await writeFile(join(repo, "docs/tracker/outbox.jsonl"), "");
	if (name !== "request") await appendFile(join(repo, PLAN), `- handoff R1 designer: REQUESTED @dana ${stamp} head ${requestHead} pr://12 preview none\n`);
	git("add", "docs"); git("commit", "-m", name === "request" ? "seed local replay ownership" : "record prior handoff request and local replies");
	git("push", "-u", "origin", "topic");
	const head = git("rev-parse", "HEAD");
	// A request pins the pre-journal head; committing that record necessarily advances a docs-only head.
	const currentRequestHead = name === "request" ? head : requestHead;
	await appendFile(join(repo, ".git/info/exclude"), "\nCASE.md\nreview-notes.md\n");
	await writeFile(join(repo, "CASE.md"), `# ${name}\nPlan: ${PLAN}\nTracker: ENG-7 (local replay); PR #12 is OPEN against main. Only the prepared bare origin is a host.\nBase: ${base}\nCurrent PR head: ${head}\nRequested implementation head: ${name === "request" ? "not requested yet" : requestHead}\nThe current head differs from the reviewed/requested head only in docs/. Prior final readiness is synthetic completed history; do not restart execution or close unrelated fixture work.\n${name === "request" ? "Continue the SAME execution session: writer w-1a2b3c4d#2. No handoff request has been made." : "The prior session w-old00001#3 is gone. The human has explicitly authorized this new session to take over at generation 4; generate and retain a NEW random token, never impersonate the old one."}\n${name === "returned" ? "The contributor has not approved the requested action-label preference. Route the acceptance defect through repair, record the unrelated request separately, and ask the contributor to decide the amendment rather than applying it silently." : "Acceptance is not implied by tracker state or relayed/bot comments."}\nNo merge is authorized. Codex is unavailable.\n`);
	await writeFile(join(control, "state.json"), JSON.stringify({ cases: { [name]: { repo, origin, base, head, requestHead: currentRequestHead, plan: PLAN, requestId, danaId, writer, inventorySha256, pr: 12,
		reviews: name === "request" ? [] : [{ id: 201, user: { login: "docs-bot[bot]", type: "Bot" }, state: "APPROVED", commit_id: currentRequestHead, body: "Automated documentation checks passed." }],
		body: "Report dashboard empty-state copy; plan 0007; no preview configured.", reviewers: [] } } }, null, 2));
	await writeFile(join(control, "calls.jsonl"), "");
	console.log(`${scenario}: prepared cases/${name}, ENG-7 and offline PR #12`);
}

if (import.meta.main) await setup(Bun.argv[2] as Scenario);
