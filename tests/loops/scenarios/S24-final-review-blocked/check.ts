import { assistantText, command, mosaicChecks, text, verdict, type Context } from "../checks.ts";
import { calls, ciRead, dispatches, head, record, result, surfacesRead } from "../S23-final-review-ready/assertions.ts";

export default async function (ctx: Context) {
  return mosaicChecks(ctx, {
    "failed-page-blocks-readiness": async () => {
      const outcome = await result(ctx, "fetch-failed");
      const failed = (await calls(ctx)).find(call => call.case === "fetch-failed" && call.code !== 0 && /page 2/.test(call.failure ?? ""));
      return verdict(Boolean(failed) && outcome.ready === false && /fetch|503|comment|page/i.test(outcome.reason), JSON.stringify({ outcome, failed }));
    },
    "changed-head-reviewed-as-delta": async () => {
      const state = JSON.parse(await text(ctx.workDir, ".scenario/state.json")).cases["head-moved"];
      const reviews = dispatches(ctx, "head-moved");
      const first = reviews.findIndex(body => body.includes(state.head) && body.includes(state.base));
      const next = reviews.findIndex((body, index) => index > first && body.includes(state.next)
        && /delta|own.change|replay/i.test(body));
      const outcome = await result(ctx, "head-moved");
      const sha = await head(ctx, "head-moved");
      const ownCode = await command(ctx, `git -C cases/head-moved diff ${state.next} HEAD -- src/offset.ts`);
      return verdict(state.moved === true && first >= 0 && next > first && !ownCode.trim()
        && outcome.head === sha && outcome.ready === true && outcome.review === "approved"
        && ciRead(await calls(ctx), "head-moved", sha) && surfacesRead(await calls(ctx), "head-moved", sha), JSON.stringify({ state, reviews, outcome, sha }));
    },
    "two-revise-human-no-third-round": async () => {
      const outcome = await result(ctx, "two-revise");
      const state = JSON.parse(await text(ctx.workDir, ".scenario/state.json")).cases["two-revise"];
      const sha = await head(ctx, "two-revise");
      const source = await text(ctx.workDir, "cases/two-revise/src/offset.ts");
      const ownCode = await command(ctx, `git -C cases/two-revise diff ${state.head} HEAD -- src/offset.ts`);
      return verdict(outcome.ready === false && outcome.review === "human" && /human|escalat|two|2/i.test(outcome.reason)
        && !dispatches(ctx, "two-revise", null).length && !ownCode.trim() && source.includes("value + 2"), JSON.stringify({ outcome, sha, source }));
    },
    "blocking-and-review-records": async () => {
      const report = assistantText(ctx);
      const failedRecord = await record(ctx, "fetch-failed");
      const movedRecord = await record(ctx, "head-moved");
      // An excluded result file alone is not the rule's durable branch record.
      const humanRecord = await command(ctx, "git -C cases/two-revise log --format=%B main..HEAD");
      return verdict(["fetch-failed", "head-moved", "two-revise"].every(name => report.includes(name))
        && /fetch|503|comment/i.test(failedRecord) && /exempt|skip/i.test(failedRecord)
        && /final R[2-9] gpt-reviewer: APPROVE/.test(movedRecord) && /reviewed [a-f0-9]{40} on [a-f0-9]{40}/.test(movedRecord)
        && /human|escalat/i.test(humanRecord), JSON.stringify({ failedRecord, movedRecord, humanRecord, report }));
    },
  });
}
