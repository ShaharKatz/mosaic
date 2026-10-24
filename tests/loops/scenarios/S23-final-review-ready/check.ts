import { assistantText, mosaicChecks, text, verdict, type Context } from "../checks.ts";
import { calls, ciRead, dispatches, head, record, result, surfacesRead } from "./assertions.ts";

export default async function (ctx: Context) {
  return mosaicChecks(ctx, {
    "planned-default-engine-pinned": async () => {
      const state = JSON.parse(await text(ctx.workDir, ".scenario/state.json")).cases.planned;
      const reviews = dispatches(ctx, "planned");
      return verdict(reviews.some(body => body.includes(state.head) && body.includes(state.base)), JSON.stringify(reviews));
    },
    "light-default-engine-pinned": async () => {
      const state = JSON.parse(await text(ctx.workDir, ".scenario/state.json")).cases.light;
      const reviews = dispatches(ctx, "light");
      return verdict(reviews.some(body => body.includes(state.head) && body.includes(state.base)), JSON.stringify(reviews));
    },
    "docs-exempt-with-ci": async () => {
      const outcome = await result(ctx, "docs");
      const sha = await head(ctx, "docs");
      const evidence = await record(ctx, "docs");
      return verdict(outcome.ready === true && outcome.review === "exempt" && outcome.head === sha
        && !dispatches(ctx, "docs", null).length && /docs|documentation/i.test(evidence) && /exempt|skip/i.test(evidence)
        && ciRead(await calls(ctx), "docs", sha), JSON.stringify(outcome) + "\n" + evidence);
    },
    "all-surfaces-and-exact-heads": async () => {
      const log = await calls(ctx);
      const evidence = await Promise.all(["planned", "light", "docs"].map(async name => {
        const outcome = await result(ctx, name), sha = await head(ctx, name);
        return { name, outcome, stable: outcome.head === sha, ci: ciRead(log, name, sha), comments: surfacesRead(log, name, sha) };
      }));
      return verdict(evidence.every(row => row.outcome.ready === true && row.stable && row.ci && row.comments), JSON.stringify(evidence));
    },
    "every-bot-finding-ruled": async () => {
      const outcome = await result(ctx, "planned");
      const log = await calls(ctx);
      const bots: [string, number, string][] = [["issue", 101, "compat-bot[bot]"], ["review", 201, "docs-bot[bot]"], ["inline", 301, "numeric-bot[bot]"]];
      const matched = bots.every(([surface, id, author]) => outcome.rulings.some(ruling => ruling.surface === surface
        && ruling.id === id && ruling.author === author && ruling.reason.trim()
        && (id === 201 ? ruling.disposition === "fixed" : ruling.disposition === "rejected")));
      const replies = log.filter(call => call.case === "planned" && call.code === 0 && call.method === "POST");
      const rejectionReplies = [101, 301].every(id => replies.some(call =>
        `${call.endpoint} ${call.body}`.includes(String(id)) && Boolean(call.body?.trim())));
      const readme = await text(ctx.workDir, "cases/planned/README.md");
      const evidence = await record(ctx, "planned");
      return verdict(matched && rejectionReplies && /two|\b2\b/.test(readme)
        && bots.every(([, id, author]) => evidence.includes(String(id)) && evidence.includes(author)), JSON.stringify({ outcome, replies, readme, evidence }));
    },
    "review-records-and-report": async () => {
      const evidence = await Promise.all(["planned", "light"].map(name => record(ctx, name)));
      const report = assistantText(ctx);
      return verdict(evidence.every(body => /final R\d+ gpt-reviewer: APPROVE/.test(body)
        && /reviewed [a-f0-9]{40} on [a-f0-9]{40}/.test(body))
        && ["planned", "light", "docs"].every(name => report.includes(name)), evidence.join("\n") + "\n" + report);
    },
  });
}
