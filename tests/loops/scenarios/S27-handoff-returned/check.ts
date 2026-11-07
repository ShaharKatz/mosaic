import { join } from "node:path";
import type { CheckResult } from "../../run.ts";
import { command, mosaicChecks, quote, verdict, type Context } from "../checks.ts";
import { entries, executionLog, LINE, lines, matches, noMerge, publishedPlan, seededTrackerEvidence, state, statusIs } from "../S25-handoff-request/assertions.ts";

export default async function (ctx: Context): Promise<CheckResult[]> {
	return mosaicChecks(ctx, {
		"returned-three-classified-findings": async () => {
			const returned = await matches(ctx, "returned", "returned"), findings = await matches(ctx, "returned", "finding");
			const seed = await state(ctx, "returned"), line = returned[0];
			const own = findings.filter(match => match[1] === "1" && match[2] === "designer");
			const trackerEvidence = await seededTrackerEvidence(ctx, "returned", "returned");
			const published = await publishedPlan(ctx, "returned");
			return verdict(returned.length === 1 && line[1] === "1" && line[2] === "designer" && line[3] === "@dana"
				&& line[5] === "tracker-reply" && line[6] === seed.danaId && line[7] === "3" && own.length === 3
				&& trackerEvidence.valid && own.every(match => match[4].split(/\s+/).length <= 15)
				&& [line, ...own].every(match => published.lines.includes(match[0])),
				JSON.stringify({ returned: returned.map(match => match[0]), findings: own.map(match => match[0]),
					publishedHead: published.head, trackerEvidence }));
		},
		"defect-fixed-reviewed-and-pushed": async () => {
			const seed = await state(ctx, "returned"), findings = await matches(ctx, "returned", "finding");
			const fixed = findings.some(match => match[1] === "1" && match[2] === "designer" && match[3] === "S" && match[5] === "fixed");
			const remoteHead = (await command(ctx, `git --git-dir ${quote(seed.origin)} rev-parse refs/heads/topic`)).trim();
			const source = await command(ctx, `git --git-dir ${quote(seed.origin)} show ${quote(`${remoteHead}:src/card.ts`)}`);
			const publishedPlan = await command(ctx, `git --git-dir ${quote(seed.origin)} show ${quote(`${remoteHead}:${seed.plan}`)}`);
			const log = executionLog(publishedPlan).split(/\r?\n/);
			const returnedIndex = log.findIndex(line => LINE.returned.test(line));
			const repairLog = log.slice(returnedIndex + 1);
			const review = repairLog.find(line => /^- T1 R[1-9]\d* [A-Za-z][\w.-]*: APPROVE \(\d+ findings\)$/.test(line));
			const verification = repairLog.find(line => /\b(?:verification|verified|smoke|tests?)\b/i.test(line)
				&& /\b(?:mobile|375)\b/i.test(line) && /\b(?:desktop|1280)\b/i.test(line) && /\b(?:PASS(?:ED)?|exit[=: ]+0)\b/i.test(line));
			const publishedFixed = repairLog.some(line => {
				const finding = LINE.finding.exec(line);
				return finding?.[3] === "S" && finding[5] === "fixed";
			});
			const probe = `${source}\nfor (const width of [1280, 375]) { const card = emptyState(width); if (card.message !== "No saved reports yet." || card.action !== "Create report" || card.accent !== "blue") throw new Error("AC1/AC2 failed at width " + width + ": " + JSON.stringify(card)); } console.log("pushed desktop/mobile AC1 and unchanged AC2 PASS");`;
			const behavior = await ctx.exec(`bun -e ${quote(probe)}`, join(ctx.workDir, "cases/returned"));
			return verdict(fixed && publishedFixed && returnedIndex >= 0 && Boolean(review) && Boolean(verification) && behavior.code === 0,
				JSON.stringify({ remoteHead, fixed, publishedFixed, review, verification, behavior }));
		},
		"repair-takes-over-generation-four": async () => {
			const seed = await state(ctx, "returned"), writes = await entries(ctx, "returned");
			const event = writes.find(row => row.key === "ENG-7" && row.op === "event" && row.payload.event === "executing");
			return verdict(Boolean(event && event.payload.takeover === true && /^w-[a-f0-9]{8}#4$/.test(event.writer)
				&& event.writer.split("#")[0] !== seed.writer.split("#")[0]), JSON.stringify({ previousWriter: seed.writer, event }));
		},
		"deferral-recorded-in-local-tracker": async () => {
			const seed = await state(ctx, "returned"), writes = await entries(ctx, "returned"), findings = await matches(ctx, "returned", "finding");
			const deferred = findings.filter(match => match[5].startsWith("deferred: "));
			const evidence = writes.filter(row => row.op === "intent" || row.op === "comment").filter(row => {
				const body = String(row.payload.body ?? row.payload.title ?? "");
				const aboutRequest = /(?:email|weekly).*(?:notification|account)|(?:notification|account).*(?:email|weekly)/is.test(body);
				const linked = row.op === "intent" || body.includes(seed.danaId) || body.includes("replay://ENG-7") || /\bAC[12]\b|src\/card\.ts/.test(body);
				return aboutRequest && linked && deferred.some(match => match[5].includes(row.key) || typeof row.payload.id === "string" && match[5].includes(row.payload.id));
			});
			return verdict(deferred.length > 0 && evidence.length > 0, JSON.stringify({ deferred: deferred.map(match => match[0]), evidence }));
		},
		"no-acceptance-on-return": async () => {
			const log = await lines(ctx, "returned");
			return verdict(!log.some(line => /^- handoff .*\bACCEPTED\b/.test(line)), log.join("\n"));
		},
		"handoff-remains-returned": () => statusIs(ctx, "returned", 1, "returned"),
		"no-merge": () => noMerge(ctx, "returned"),
	});
}
