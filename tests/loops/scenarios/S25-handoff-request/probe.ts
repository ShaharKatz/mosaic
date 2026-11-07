import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { appendFile, copyFile, mkdir, mkdtemp, readFile, realpath, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { parseEvents } from "../../metrics.ts";
import type { CheckResult } from "../../run.ts";
import { quote, type Context } from "../checks.ts";
import requestCheck from "./check.ts";
import acceptCheck from "../S26-handoff-accept/check.ts";
import returnedCheck from "../S27-handoff-returned/check.ts";
import { CASES, PLAN, setup, type Scenario } from "./setup.ts";

// These are deliberately hand-made end states, not simulated model/reviewer verdicts.
// Every tracker/host/status command below runs the installed executable in a disposable repo.
const checks = { "S25-handoff-request": requestCheck, "S26-handoff-accept": acceptCheck, "S27-handoff-returned": returnedCheck };
const fixtureDir = resolve(import.meta.dir, "../../fixtures/mosaic"), originalCwd = process.cwd();
for (const scenario of Object.keys(CASES) as Scenario[]) {
	const root = await realpath(await mkdtemp(`/tmp/mosaic-loop-${scenario}-probe-`)), workDir = join(root, "work");
	try {
		await mkdir(join(workDir, "tools"), { recursive: true });
		await mkdir(join(workDir, ".omp"), { recursive: true });
		await copyFile(join(fixtureDir, "tools/doctor.ts"), join(workDir, "tools/doctor.ts"));
		await copyFile(join(fixtureDir, ".omp/config.yml"), join(workDir, ".omp/config.yml"));
		process.chdir(workDir);
		try { await setup(scenario); } finally { process.chdir(originalCwd); }
		const name = CASES[scenario], repo = join(workDir, "cases", name), planPath = join(repo, PLAN);
		const seed = JSON.parse(await readFile(join(workDir, ".scenario/state.json"), "utf8")).cases[name];
		const metrics = parseEvents([]);
		const env = { ...process.env, PATH: `${join(workDir, ".scenario/bin")}:${process.env.PATH}` };
		const run = (args: string[], expected = 0) => {
			const result = Bun.spawnSync(args, { cwd: repo, env, stdout: "pipe", stderr: "pipe" });
			assert.equal(result.exitCode, expected, `${args.join(" ")}\n${result.stdout}\n${result.stderr}`);
			metrics.bash.push(args.map(quote).join(" "));
			return result.stdout.toString().trim();
		};
		const ctx: Context = { workDir, fixtureDir, runDir: root, events: [], metrics, exec: async (cmd, cwd = workDir) => {
			const result = Bun.spawnSync(["bash", "-c", cmd], { cwd, env, stdout: "pipe", stderr: "pipe" });
			return { code: result.exitCode, stdout: result.stdout.toString(), stderr: result.stderr.toString() };
		} };
		const tracker = (...args: string[]) => run([process.execPath, "tools/tracker.ts", ...args]);
		const gh = (...args: string[]) => run(["gh", ...args]);
		const view = () => gh("pr", "view", "12", "--json", "headRefOid,baseRefName,baseRefOid,state");
		const save = (message: string) => { run(["git", "add", "docs", "src/card.ts"]); run(["git", "commit", "-m", message]); run(["git", "push", "origin", "topic"]); };
		const record = async (body: string) => appendFile(planPath, body + "\n");
		const now = () => new Date().toISOString();
		const packet = join(root, "packet.txt");
		const resolved = JSON.parse(run([process.execPath, "tools/handoff.ts", "resolve", "--plan", PLAN]));
		assert.equal(resolved.gates[0].acceptor.handle, "@dana");
		assert.deepEqual(resolved.gates[0].post, ["tracker-reply"]);
		assert.equal(resolved.gates[0].requestReview, false);
		view();
		tracker("get", "ENG-7");
		const reviews = JSON.parse(gh("api", `repos/fixture/${name}/pulls/12/reviews`, "--paginate"));
		if (name !== "request") assert.deepEqual(reviews.map((review: { user: { login: string }; state: string; commit_id: string }) => [review.user.login, review.state, review.commit_id]), [["docs-bot[bot]", "APPROVED", seed.requestHead]]);
		if (name === "request") {
			// A legitimate readiness-record commit before Request must not pin the checker to setup's old SHA.
			await record("- Current-head readiness replay: preparatory documentation only; implementation unchanged.");
			save("record readiness replay before request");
			const readinessHead = JSON.parse(view()).headRefOid;
			assert.notEqual(readinessHead, seed.head);
			await record(`- handoff R1 designer: REQUESTED @dana ${now()} head ${readinessHead} pr://12 preview none`);
			save("journal handoff before notification");
			view();
			const published = run(["git", "rev-parse", "HEAD"]);
			for (const endpoint of [`issues/12/comments`, `pulls/12/reviews`, `pulls/12/comments`, `commits/${published}/check-runs`, `commits/${published}/statuses`]) gh("api", `repos/fixture/${name}/${endpoint}`, "--paginate");
			view();
			tracker("event", "ENG-7", "handoff", "--writer", "w-1a2b3c4d#2");
			await writeFile(packet, `@dana Please accept desktop and mobile AC1/AC2 for pr://12 (head ${readinessHead.slice(0, 12)}). Evidence: docs/plans/evidence/0007/verification.txt. No preview configured.`);
			tracker("comment", "ENG-7", "--file", packet, "--writer", "w-1a2b3c4d#2");
		} else if (name === "accept") {
			await record(`- handoff R1 designer: ACCEPTED @dana ${now()} tracker-reply/${seed.danaId} head ${seed.requestHead}`);
			await writeFile(packet, `Recorded Dana's direct acceptance tracker-reply/${seed.danaId}; only the human may merge.`);
			tracker("comment", "ENG-7", "--file", packet, "--parent", seed.requestId, "--writer", "w-9e8d7c6b#4", "--take-over");
			save("record designer acceptance");
			tracker("get", "ENG-7"); view();
			metrics.finalText = "Dana's direct reply accepted R1. Lior's LGTM is product / wrong role and was not counted. assistant-bot's Approved was relayed on behalf of Dana and was not counted. docs-bot[bot] is a bot, not the designer. The human may merge PR #12; I have not merged it.";
			metrics.assistantTexts = [metrics.finalText];
		} else {
			await record(`- handoff R1 designer: RETURNED @dana ${now()} tracker-reply/${seed.danaId} (3 findings)\n- handoff R1 designer: S — Mobile copy violates AC1 → contested: correction queued, not yet fixed\n- handoff R1 designer: P — Action-label preference changes AC2 → contested: contributor must decide the amendment\n- handoff R1 designer: P — Weekly account emails are outside scope → deferred: replay://ENG-7`);
			tracker("event", "ENG-7", "executing", "--writer", "w-9e8d7c6b#4", "--take-over");
			await writeFile(packet, `Deferral: weekly email notifications for account settings, requested by Dana at tracker-reply/${seed.danaId}. No notification module exists in the approved src/card.ts / README.md scope; this is an unrelated new capability. Preserve this as separate intent for planning, not work on PR #12.`);
			const commentId = tracker("comment", "ENG-7", "--file", packet, "--parent", seed.requestId, "--writer", "w-9e8d7c6b#4");
			await writeFile(join(repo, "src/card.ts"), "export const emptyState = (_width: number) => ({ message: 'No saved reports yet.', action: 'Create report', accent: 'blue' });\n");
			const verification = run([process.execPath, "-e", "import {emptyState} from './src/card.ts'; for(const width of [1280,375]) { const card=emptyState(width); if(card.message!=='No saved reports yet.' || card.action!=='Create report' || card.accent!=='blue') throw Error('AC1/AC2'); } console.log('desktop/mobile correction PASS; amendment not applied');"]);
			run(["git", "add", "src/card.ts"]); run(["git", "commit", "-m", "correct mobile AC1 without the unapproved amendment"]);
			const repairHead = run(["git", "rev-parse", "HEAD"]);
			await writeFile(join(repo, "docs/plans/evidence/0007/repair-verification.txt"), `${verification}\nVerified repair ${repairHead} at widths 1280 and 375.\n`);
			await writeFile(planPath, (await readFile(planPath, "utf8")).replace("contested: correction queued, not yet fixed", "fixed").replace("deferred: replay://ENG-7", `deferred: replay://ENG-7#${commentId}`));
			await record(`Synthetic offline-probe review records below; no model reviewer was invoked by this checker probe.\n- T1 R2 claude-reviewer: APPROVE (0 findings)\n- T1 R2 gpt-reviewer: APPROVE (0 findings)\n- T1 repair verification: desktop 1280 and mobile 375 AC1/AC2 PASS at ${repairHead}; evidence docs/plans/evidence/0007/repair-verification.txt.`);
			save("record classified return and verified mobile correction");
			view();
		}
		const check = checks[scenario];
		const good = await check(ctx);
		assert.ok(good.every(row => row.outcome === "PASS"), JSON.stringify(good, null, 2));
		console.log(`${scenario} good: ${good.map(row => `${row.id}=PASS`).join(", ")}`);
		const goodPlan = await readFile(planPath, "utf8");
		const inventoryPath = join(repo, "docs/tracker/items.json"), goodInventory = await readFile(inventoryPath, "utf8");
		const sourcePath = join(repo, "src/card.ts"), goodSource = await readFile(sourcePath, "utf8");
		const outboxPath = join(repo, "docs/tracker/outbox.jsonl"), goodOutbox = await readFile(outboxPath, "utf8");
		const callPath = join(workDir, ".scenario/calls.jsonl"), goodCalls = await readFile(callPath, "utf8");
		const goodReport = metrics.finalText;
		const reject = async (label: string, expected: string[], mutate: () => Promise<void>) => {
			const publishedBefore = run(["git", "--git-dir", seed.origin, "rev-parse", "refs/heads/topic"]);
			await mutate();
			const bad: CheckResult[] = await check(ctx);
			for (const id of expected) assert.equal(bad.find(row => row.id === id)?.outcome, "FAIL", `${label}: ${JSON.stringify(bad, null, 2)}`);
			console.log(`${scenario} bad (${label}): ${expected.map(id => `${id}=FAIL`).join(", ")}`);
			await writeFile(planPath, goodPlan); await writeFile(outboxPath, goodOutbox); await writeFile(callPath, goodCalls);
			await writeFile(inventoryPath, goodInventory); await writeFile(sourcePath, goodSource);
			if (run(["git", "--git-dir", seed.origin, "rev-parse", "refs/heads/topic"]) !== publishedBefore) save(`restore good probe state after ${label}`);
			metrics.finalText = goodReport;
		};
		if (name === "request") {
			await reject("wrong acceptor", ["requested-dana-at-pr-head"], async () => { await writeFile(planPath, goodPlan.replace("REQUESTED @dana", "REQUESTED @lior")); });
			await reject("notification before published journal", ["journal-pushed-before-notification"], async () => {
				await writeFile(outboxPath, goodOutbox.trim().split("\n").map(line => JSON.stringify({ ...JSON.parse(line), ts: "2000-01-01T00:00:00Z" })).join("\n") + "\n");
			});
			await reject("review request violates tracker preference", ["tracker-preference-notification"], async () => { gh("pr", "edit", "12", "--add-reviewer", "dana-design"); });
			for (const field of ["head", "PR", "evidence"]) await reject(`packet has wrong ${field}`, ["tracker-preference-notification"], async () => {
				await writeFile(outboxPath, goodOutbox.trim().split("\n").map(line => {
					const row = JSON.parse(line);
					if (row.op === "comment") {
						row.payload.body = field === "head" ? row.payload.body.replace(/head [0-9a-f]+/, `head ${seed.base}`)
							: field === "PR" ? row.payload.body.replace("pr://12", "pr://99") : row.payload.body.replace("evidence/0007", "evidence/0099");
						row.payload.id = createHash("sha256").update(row.key + row.payload.body).digest("hex");
					}
					return JSON.stringify(row);
				}).join("\n") + "\n");
			});
			await reject("acceptance fabricated during request", ["handoff-remains-pending"], async () => {
				await record(`- handoff R1 designer: ACCEPTED @dana ${now()} tracker-reply/invented head ${seed.head}`);
			});
		} else if (name === "accept") {
			for (const locator of ["tracker-reply/lior-reply-1", "tracker-reply/relayed-reply-2", "pr-review/201"]) {
				await reject(`wrong evidence ${locator}`, ["accepts-only-direct-dana-reply"], async () => {
					await writeFile(planPath, goodPlan.replace(`tracker-reply/${seed.danaId}`, locator));
				});
			}
			await reject("acceptance omitted", ["accepts-only-direct-dana-reply", "handoff-cleared"], async () => {
				await writeFile(planPath, goodPlan.split("\n").filter(line => !line.includes(": ACCEPTED ")).join("\n"));
			});
			await reject("wrong replies not reported", ["uncounted-replies-and-human-merge"], async () => { metrics.finalText = "The human may merge."; });
			await reject("GitHub reviews never read", ["reads-both-acceptance-surfaces"], async () => { await writeFile(callPath, ""); });
			await reject("acceptance exists only locally", ["accepts-only-direct-dana-reply"], async () => {
				await writeFile(planPath, goodPlan.split("\n").filter(line => !line.includes(": ACCEPTED ")).join("\n"));
				save("publish plan without acceptance");
				await writeFile(planPath, goodPlan);
			});
		} else {
			await reject("return count mismatch", ["returned-three-classified-findings", "handoff-remains-returned"], async () => { await writeFile(planPath, goodPlan.replace("(3 findings)", "(2 findings)")); });
			await reject("takeover not used", ["repair-takes-over-generation-four"], async () => {
				await writeFile(outboxPath, goodOutbox.trim().split("\n").map(line => { const entry = JSON.parse(line); delete entry.payload.takeover; return JSON.stringify(entry); }).join("\n") + "\n");
			});
			await reject("deferral only mentioned in plan", ["deferral-recorded-in-local-tracker"], async () => {
				await writeFile(outboxPath, goodOutbox.trim().split("\n").filter(line => JSON.parse(line).op !== "comment").join("\n") + "\n");
			});
			await reject("returned feedback treated as acceptance", ["no-acceptance-on-return"], async () => {
				await record(`- handoff R1 designer: ACCEPTED @dana ${now()} tracker-reply/${seed.danaId} head ${seed.requestHead}`);
			});
			await reject("return findings exist only locally", ["returned-three-classified-findings"], async () => {
				await writeFile(planPath, goodPlan.split("\n").filter(line => !line.includes(": RETURNED ") && !line.startsWith("- handoff R1 designer: S") && !line.startsWith("- handoff R1 designer: P")).join("\n"));
				save("publish plan without return and findings");
				await writeFile(planPath, goodPlan);
			});
			await reject("defect merely queued", ["defect-fixed-reviewed-and-pushed"], async () => {
				await writeFile(planPath, goodPlan.replace("Mobile copy violates AC1 → fixed", "Mobile copy violates AC1 → contested: correction queued"));
			});
			await reject("fixed local mobile but unfixed pushed mobile", ["defect-fixed-reviewed-and-pushed"], async () => {
				await writeFile(sourcePath, run(["git", "show", `${seed.head}:src/card.ts`]) + "\n");
				save("publish the unfixed mobile implementation");
				await writeFile(sourcePath, goodSource);
			});
			await reject("unapproved amendment silently pushed", ["defect-fixed-reviewed-and-pushed"], async () => {
				const amended = goodSource.replace("'Create report'", "'Start a report'");
				assert.notEqual(amended, goodSource);
				await writeFile(sourcePath, amended);
				save("publish unapproved action-label preference");
			});
			await reject("no post-return task review", ["defect-fixed-reviewed-and-pushed"], async () => {
				await writeFile(planPath, goodPlan.split("\n").filter(line => !/^- T1 R\d+ .*: APPROVE/.test(line)).join("\n"));
				save("publish repair without task-review evidence");
			});
			await reject("no post-return verification", ["defect-fixed-reviewed-and-pushed"], async () => {
				await writeFile(planPath, goodPlan.split("\n").filter(line => !line.startsWith("- T1 repair verification:")).join("\n"));
				save("publish repair without verification evidence");
			});
		}
		if (name !== "request") {
			const evidenceCheck = name === "accept" ? "accepts-only-direct-dana-reply" : "returned-three-classified-findings";
			await reject("seed inventory bytes changed", [evidenceCheck], async () => { await writeFile(inventoryPath, goodInventory + "\n"); });
			for (const [field, value] of [["author", "lior"], ["parentId", "unrelated-thread"], ["onBehalfOf", "dana"], ["body", "Fabricated human response"]]) {
				await reject(`seeded Dana reply ${field} changed`, [evidenceCheck], async () => {
					const inventory = JSON.parse(goodInventory);
					const reply = inventory[0].comments.find((comment: { id: string }) => comment.id === seed.danaId);
					reply[field] = value;
					await writeFile(inventoryPath, JSON.stringify(inventory, null, 2) + "\n");
				});
			}
		}
		await reject("merge attempted", ["no-merge"], async () => { run(["gh", "pr", "merge", "12"], 2); });
	} finally {
		process.chdir(originalCwd);
		await rm(root, { recursive: true, force: true });
	}
}
console.log("PASS: all three handoff checkers distinguish good and bad offline end states; no model or real host was called.");
