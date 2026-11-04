import type { CheckResult } from "../../run.ts";
import { isRecord } from "../../metrics.ts";
import { command, mosaicChecks, quote, verdict, type Context } from "../checks.ts";
import { calls, entries, matches, noMerge, onlyDocsSince, state, statusIs } from "./assertions.ts";

export default async function (ctx: Context): Promise<CheckResult[]> {
	return mosaicChecks(ctx, {
		"requested-dana-at-pr-head": async () => {
			const requests = await matches(ctx, "request", "requested"), seed = await state(ctx, "request"), log = await calls(ctx);
			const request = requests[0];
			const observed = request && log.some(call => call.code === 0 && call.args[0] === "pr" && call.args[1] === "view"
				&& isRecord(call.output) && call.output.headRefOid === request[5]);
			return verdict(requests.length === 1 && request[1] === "1" && request[2] === "designer" && request[3] === "@dana"
				&& request[6] === "12" && request[7] === "none" && Boolean(observed)
				&& await onlyDocsSince(ctx, "request", seed.head) && await onlyDocsSince(ctx, "request", request[5]),
				JSON.stringify({ requests: requests.map(match => match[0]), initialHead: seed.head, observed }));
		},
		"journal-pushed-before-notification": async () => {
			const request = (await matches(ctx, "request", "requested"))[0], seed = await state(ctx, "request");
			const writes = (await entries(ctx, "request")).filter(row => row.key === "ENG-7");
			const event = writes.find(row => row.op === "event" && row.payload.event === "handoff");
			const comment = writes.find(row => row.op === "comment" && typeof row.payload.body === "string" && row.payload.body.includes("@dana"));
			if (!request || !event || !comment) return verdict(false, JSON.stringify({ request: request?.[0], event, comment }));
			const firstWrite = Math.min(Date.parse(event.ts), Date.parse(comment.ts));
			const published = (await calls(ctx)).find(call => call.code === 0 && call.remoteHead && call.remotePlan?.split("\n").includes(request[0])
				&& Number.isFinite(Date.parse(call.ts)) && Date.parse(call.ts) <= firstWrite);
			if (!published?.remoteHead) return verdict(false, "No successful host read proves the committed REQUESTED record was pushed before both tracker writes.");
			const committed = await command(ctx, `git --git-dir ${quote(seed.origin)} show ${quote(`${published.remoteHead}:${seed.plan}`)}`);
			const commitTime = Number((await command(ctx, `git --git-dir ${quote(seed.origin)} show -s --format=%ct ${quote(published.remoteHead)}`)).trim()) * 1000;
			return verdict(committed.split("\n").includes(request[0]) && commitTime <= firstWrite
				&& event.writer === "w-1a2b3c4d#2" && comment.writer === event.writer,
				JSON.stringify({ publishedHead: published.remoteHead, publishedAt: published.ts, commitTime, event, comment }));
		},
		"tracker-preference-notification": async () => {
			const writes = await entries(ctx, "request"), log = await calls(ctx);
			const comments = writes.filter(row => row.key === "ENG-7" && row.op === "comment");
			const request = (await matches(ctx, "request", "requested"))[0];
			const packet = request && comments.find(row => {
				const body = row.payload.body;
				return typeof body === "string" && /@dana\b/.test(body) && /(?:\bpr:\/\/12|#12)\b/.test(body)
					&& /\bdocs\/plans\/evidence\/0007(?:\/|\b)/.test(body)
					&& [...body.matchAll(/\b[0-9a-f]{12,64}\b/gi)].some(match => request[5].startsWith(match[0].toLowerCase()));
			});
			const reviewerRequests = log.filter(call => call.args.some(arg => /^--add-reviewer(?:=|$)/.test(arg))
				|| /\/requested_reviewers(?:\?|$)/.test(call.endpoint ?? ""));
			return verdict(Boolean(packet) && !reviewerRequests.length,
				JSON.stringify({ requestedHead: request?.[5], packet, comments, reviewerRequests }));
		},
		"handoff-remains-pending": () => statusIs(ctx, "request", 1, "requested"),
		"no-merge": () => noMerge(ctx, "request"),
	});
}
