import { cp, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import type { Context } from "../checks.ts";
import { calls, head, readinessWindow } from "./assertions.ts";

const args = Bun.argv.slice(2);
const run = args.find(arg => !arg.startsWith("--"));
if (!run || args.some(arg => arg.startsWith("--") && arg !== "--probe-final-comments")) {
  throw new Error("Usage: bun replay.ts <run-directory> [--probe-final-comments]");
}
const runDir = resolve(run);
const meta = await Bun.file(join(runDir, "meta.json")).json();
if (!["S23-final-review-ready", "S24-final-review-blocked"].includes(meta.scenario)) throw new Error("Expected an S23 or S24 packet");
const temporary = await mkdtemp(join(tmpdir(), "mosaic-final-review-replay-"));
try {
  const workDir = join(temporary, "work");
  await cp(meta.workDir, workDir, { recursive: true, verbatimSymlinks: true });
  const ctx: Context = { runDir, workDir, fixtureDir: meta.fixtureDir,
    metrics: await Bun.file(join(runDir, "metrics.json")).json(),
    events: (await Bun.file(join(runDir, "events.jsonl")).text()).split("\n").filter(Boolean).map(line => JSON.parse(line)),
    exec: async (cmd, cwd = workDir) => {
      const child = Bun.spawn(["bash", "-c", cmd], { cwd, stdout: "pipe", stderr: "pipe" });
      const [code, stdout, stderr] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()]);
      return { code, stdout, stderr };
    } };
  const check = (await import(pathToFileURL(join(import.meta.dir, "..", meta.scenario, "check.ts")).href)).default;
  const result = await check(ctx);
  console.log(`${meta.scenario}: ${result.filter((row: { outcome: string }) => row.outcome === "PASS").length}/${result.length} PASS`);
  for (const row of result) console.log(`${row.outcome} ${row.id}${row.outcome === "PASS" ? "" : `: ${row.evidence}`}`);
  if (args.includes("--probe-final-comments")) {
    const target = meta.scenario.startsWith("S23") ? "all-surfaces-and-exact-heads" : "changed-head-reviewed-as-delta";
    if (result.find((row: { id: string }) => row.id === target)?.outcome !== "PASS") throw new Error("Negative probe requires passing readiness evidence");
    const log = await calls(ctx);
    const names = meta.scenario.startsWith("S23") ? ["planned", "light", "docs"] : ["head-moved"];
    const removed = new Set();
    for (const name of names) for (const call of readinessWindow(log, name, await head(ctx, name))) {
      if (call.method === "GET" && /\/(?:issues\/1\/comments|pulls\/1\/(?:reviews|comments))$/.test(call.endpoint ?? "")) removed.add(call);
    }
    if (!removed.size) throw new Error("No final-window comment GETs found to remove");
    await writeFile(join(workDir, ".scenario/calls.jsonl"), log.filter(call => !removed.has(call)).map(call => JSON.stringify(call)).join("\n") + "\n");
    const negative = await check(ctx);
    if (negative.find((row: { id: string }) => row.id === target)?.outcome !== "FAIL") throw new Error("Checker accepted missing final-head comment GETs");
    console.log(`PASS negative probe: ${removed.size} final-window GETs removed; ${target} rejected readiness`);
  }
  if (result.some((row: { outcome: string }) => row.outcome !== "PASS")) process.exitCode = 1;
} finally { await rm(temporary, { recursive: true, force: true }); }
