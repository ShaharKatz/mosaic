import { appendFile, chmod, copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

// Both scenarios use the same disposable Git/host boundary; no network client is delegated to.
const scenario = Bun.argv[2];
const work = process.cwd();
if (!["S23-final-review-ready", "S24-final-review-blocked"].includes(scenario)
  || basename(work) !== "work" || !basename(dirname(work)).startsWith(`mosaic-loop-${scenario}-`)) {
  throw new Error("Final-review setup writes only the runner-created scenario work directory.");
}
if (!await Bun.file(join(work, "tools/doctor.ts")).exists()) process.exit(0);
const source = resolve(import.meta.dir, "../../../..");
// The source checkout is resolved from this runtime-selected scenario location.
const { install } = await import(pathToFileURL(join(source, "kit/install.ts")).href);
const control = join(work, ".scenario");
await mkdir(join(control, "bin"), { recursive: true });
await appendFile(join(work, ".gitignore"), "\n/.scenario/\n/cases/\n");
await copyFile(join(import.meta.dir, "fake-gh.ts"), join(control, "bin/gh"));
await copyFile(join(import.meta.dir, "host-request.ts"), join(control, "bin/host-request.ts"));
await chmod(join(control, "bin/gh"), 0o755);
await writeFile(join(control, "bin/codex"), "#!/bin/sh\nprintf 'Codex is not installed in this isolated scenario\\n' >&2\nexit 127\n", { mode: 0o755 });
const roles = await readFile(join(work, ".omp/config.yml"), "utf8");
const names = scenario === "S23-final-review-ready" ? ["planned", "light", "docs"] : ["fetch-failed", "head-moved", "two-revise"];
const cases: Record<string, unknown> = {};
for (const name of names) {
  const repo = join(work, "cases", name);
  const origin = join(control, `${name}.git`);
  const manifest = join(control, `${name}.manifest.json`);
  await writeFile(manifest, JSON.stringify({ project: { name: "Offset", summary: "Offset adds a documented numeric increment." },
    topology: "monorepo", members: [], remotes: { link: origin }, tracking: { mode: "none" },
    landing: { mode: "pull-request", host: "github" } }));
  await install({ manifest, target: repo, kitCommit: "scenario" });
  await writeFile(join(repo, ".omp/config.yml"), roles);
  await writeFile(join(repo, ".gitignore"), "/.scenario/\n");
  const git = (...args: string[]) => {
    const result = Bun.spawnSync(["git", ...args], { cwd: repo, stdout: "pipe", stderr: "pipe" });
    if (result.exitCode) throw new Error(`${name}: git ${args.join(" ")}\n${result.stderr}`);
    return result.stdout.toString().trim();
  };
  await mkdir(join(repo, "src"));
  await writeFile(join(repo, "src/offset.ts"), "export const offset = (value: number) => value + 0;\n");
  await writeFile(join(repo, "README.md"), "Offset currently adds zero.\n");
  git("init", "-b", "main"); git("config", "user.name", "Scenario Author");
  git("config", "user.email", "scenario@example.invalid"); git("config", "commit.gpgsign", "false");
  git("add", "."); git("commit", "-m", "base");
  const base = git("rev-parse", "HEAD");
  git("init", "--bare", "-b", "main", origin); git("remote", "add", "origin", origin); git("push", "origin", "main");
  git("checkout", "-b", "topic");
  const docs = name === "docs" || name === "fetch-failed";
  await writeFile(join(repo, "README.md"), docs ? "Offset adds zero; documentation clarified.\n"
    : name === "head-moved" ? "Offset adds two.\n" : "Offset currently adds one.\n");
  if (!docs) await writeFile(join(repo, "src/offset.ts"), "export const offset = (value: number) => value + 2;\n");
  const targetOffset = docs ? 0 : name === "two-revise" ? 3 : 2;
  // This receipt exercises real code before the scenario claims implementation verification.
  const verify = Bun.spawnSync([process.execPath, "-e", `import {offset} from './src/offset.ts'; if(offset(4)!==${docs ? 4 : 6} || offset(0.5)!==${docs ? 0.5 : 2.5}) throw Error('offset regression'); console.log('offset smoke PASS');`], { cwd: repo, stdout: "pipe", stderr: "pipe" });
  if (verify.exitCode) throw new Error(verify.stderr.toString());
  await mkdir(join(repo, "docs/plans/evidence/0001"), { recursive: true });
  await writeFile(join(repo, "docs/plans/evidence/0001/verification.txt"), verify.stdout);
  const plan = "docs/plans/archived/0001-offset.md";
  await mkdir(dirname(join(repo, plan)), { recursive: true });
  if (name === "planned") await writeFile(join(repo, plan), `---\nstatus: done\nrepo: link-repo\n---\n# Offset increment\n## Context\nSet the increment to two.\n## Scope\nOnly src/offset.ts and README.md.\n## Task breakdown\n### T1 — Increment\n- files: src/offset.ts, README.md\n- acceptance: offset(4) is 6 and offset(0.5) is 2.5.\n## Review checklist\nKeep fractional inputs; no input validation is requested.\n## Verification\nSee ../evidence/0001/verification.txt.\n## Planning log\nSynthetic fixture history: human approved the increment.\n## Execution log\nSynthetic fixture history: task reviewers approved, verification ran, sign-off granted and close-out committed. Final review has not run.\n### Unverified\nOpen-PR final review, comments and CI.\n`);
  git("add", "."); git("commit", "-m", docs ? "clarify documentation" : "implement increment");
  const head = git("rev-parse", "HEAD");
  git("push", "-u", "origin", "topic");
  let next: string | null = null;
  if (name === "head-moved") {
    git("checkout", "-b", "next");
    await writeFile(join(repo, "src/offset.ts"), "export function offset(value: number) { return 2 + value; }\n");
    git("add", "."); git("commit", "-m", "later own-code change"); next = git("rev-parse", "HEAD");
    git("push", "origin", "next"); git("checkout", "topic");
  }
  await writeFile(join(repo, "CASE.md"), `# ${name}\nPR #1 is already open against main; local bare origin is the only host.\nProcedure: ${name === "planned" || name === "two-revise" ? "planned" : "light"}. ${docs ? "Documentation-only work." : `Acceptance: offset(4) === ${4 + targetOffset}; offset(0.5) === ${0.5 + targetOffset}.`}\n${name === "planned" ? `Plan: ${plan}. All ordinary pre-PR gates are complete; this synthetic history does not claim a final review.` : "Ordinary task review and sign-off, if applicable, are already complete (synthetic fixture history)."}\nBase: ${base}\nCurrent implementation head: ${head}\n${name === "two-revise" ? `Final R1 gpt-reviewer: REVISE (1 finding) — arithmetic increment is wrong.\nFinal R2 gpt-reviewer: REVISE (1 finding) — src/offset.ts:1 still adds two; approved acceptance requires three.\nLast reviewed ${head} on ${base}. Both findings remain substantive and unresolved. Task repair REVISE counter is zero. No human waiver exists.\n` : "No final review has run yet. Codex is unavailable; no optional engine is selected.\n"}The host may receive a concurrent update. Fetch and fast-forward topic if its remote head changes; never overwrite the remote.\n`);
  // Case instructions and scenario outputs are outside the code diff being reviewed.
  await appendFile(join(repo, ".git/info/exclude"), "\nCASE.md\nresult.json\nreview-notes.md\n");
  cases[name] = { repo, origin, base, head, next, moved: false, failedFetch: name === "fetch-failed", bots: name === "planned" };
}
await writeFile(join(control, "state.json"), JSON.stringify({ cases }, null, 2));
await writeFile(join(control, "calls.jsonl"), "");
console.log(`${scenario}: prepared ${names.join(", ")} with PR-mode rules and an offline host`);
