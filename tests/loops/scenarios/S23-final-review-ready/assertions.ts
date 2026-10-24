import { join } from "node:path";
import { isRecord } from "../../metrics.ts";
import { command, text, type Context } from "../checks.ts";
import { hostRequest } from "./host-request.ts";

export type HostCall = { case: string; args: string[]; code: number; output?: unknown; failure?: string;
  method?: string; endpoint?: string; body?: string };
export type Result = { ready: boolean; head: string; review: string; reason: string;
  rulings: { surface: string; id: number; author: string; disposition: string; reason: string }[] };
export async function calls(ctx: Context): Promise<HostCall[]> {
  const log: HostCall[] = (await text(ctx.workDir, ".scenario/calls.jsonl")).split("\n").filter(Boolean).map(line => JSON.parse(line));
  // Historical run packets predate normalized request recording; decode their recorded argv only.
  return Promise.all(log.map(async call => call.method ? call : { ...call,
    ...await hostRequest(call.args, join(ctx.workDir, "cases", call.case), call.case) }));
}
export async function result(ctx: Context, name: string): Promise<Result> {
  return JSON.parse(await text(ctx.workDir, `cases/${name}/result.json`));
}
export async function head(ctx: Context, name: string): Promise<string> {
  return (await command(ctx, `git -C cases/${name} rev-parse HEAD`)).trim();
}
export function dispatches(ctx: Context, name: string, engine: string | null = "gpt-reviewer"): string[] {
  const found: string[] = [];
  const agents = new Set<string>();
  for (const event of ctx.events) {
    if (event.type !== "tool_execution_start") continue;
    if (/(?:^|\.)write$/.test(String(event.toolName)) && isRecord(event.args)
      && typeof event.args.path === "string" && agents.has(event.args.path.replace(/^agent:\/\//, ""))) {
      found.push(JSON.stringify(event.args));
    }
    if (!/(?:^|\.)task$/.test(String(event.toolName))) continue;
    const shared = isRecord(event.args) && typeof event.args.context === "string" ? event.args.context : "";
    const visit = (value: unknown): void => {
      if (Array.isArray(value)) { value.forEach(visit); return; }
      if (!isRecord(value)) return;
      if (engine ? value.agent === engine : typeof value.agent === "string" && /reviewer$/.test(value.agent)) {
        const body = JSON.stringify(value);
        const targetsCase = body.includes(`cases/${name}`) || (!/cases\/[\w-]+/.test(body) && shared.includes(`cases/${name}`));
        if (targetsCase) {
          found.push(JSON.stringify({ context: shared, task: value }));
          if (typeof value.name === "string") agents.add(value.name);
        }
      } else Object.values(value).forEach(visit);
    };
    visit(event.args);
  }
  return found;
}
export function readinessWindow(calls: HostCall[], name: string, sha: string): HostCall[] {
  const own = calls.filter(call => call.case === name);
  const remoteHead = (call: HostCall) => isRecord(call.output) && typeof call.output.headRefOid === "string" ? call.output.headRefOid : undefined;
  const headRead = (call: HostCall) => call.code === 0 && call.args[0] === "pr" && call.args[1] === "view" && remoteHead(call) === sha;
  const lastChange = own.findLastIndex(call => remoteHead(call) !== undefined && remoteHead(call) !== sha);
  const stable = own.slice(lastChange + 1);
  const start = stable.findIndex(headRead), end = stable.findLastIndex(headRead);
  if (start < 0 || end <= start) return [];
  const first = stable[start].output, last = stable[end].output;
  if (!isRecord(first) || !isRecord(last) || first.baseRefName !== last.baseRefName || first.baseRefOid !== last.baseRefOid) return [];
  return stable.slice(start + 1, end);
}
export function ciRead(calls: HostCall[], name: string, sha: string): boolean {
  const window = readinessWindow(calls, name, sha);
  return ["check-runs", "statuses"].every(surface => window.some(call => call.code === 0 && call.method === "GET"
    && (call.endpoint === `repos/fixture/${name}/commits/${sha}/${surface}`
      || surface === "statuses" && call.endpoint === `repos/fixture/${name}/commits/${sha}/status`)
    && call.args.includes("--paginate")));
}
export function surfacesRead(calls: HostCall[], name: string, sha: string): boolean {
  const window = readinessWindow(calls, name, sha);
  return ["issues/1/comments", "pulls/1/reviews", "pulls/1/comments"].every(surface => window.some(call =>
    call.code === 0 && call.method === "GET" && call.endpoint === `repos/fixture/${name}/${surface}` && call.args.includes("--paginate")));
}
export async function record(ctx: Context, name: string): Promise<string> {
  const commits = await command(ctx, `git -C cases/${name} log --format=%B main..HEAD`);
  const plan = join(ctx.workDir, `cases/${name}/docs/plans/archived/0001-offset.md`);
  return commits + (await Bun.file(plan).exists() ? await Bun.file(plan).text() : "");
}
