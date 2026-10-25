#!/usr/bin/env bun
// Original case names and parameter labels are retained for an auditable 70-case port.
import { strictEqual as eq, deepStrictEqual as same, ok } from "node:assert";
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import * as c from "../../kit/tools/constants/stack-base.ts";
const tool = resolve(import.meta.dir, "../../kit/tools/stack-base.ts");
const PARENT = "task/9901-parent", CHILD = "task/9902-child", LIGHT_CHILD = "docs/child", LIGHT_PARENT = "docs/parent";
const scratch = mkdtempSync(join(tmpdir(), "mosaic-stack-"));
let count = 0;
type Answer = { code: number; value: unknown; git_command?: string[] };
class Repo {
  root: string; work: string; origin: string; bin: string; fixture: string; calls: string;
  remote: string;
  env: Record<string, string>; branch = ""; parent = ""; old = ""; children: string[] = [];
  responses: Record<string, Answer> = { "auth status": { code: 0, value: {} }, "pr list": { code: 0, value: [] }, "pr view": { code: 0, value: {} } };
  defaultBranch = "trunk";
  planPath = "";
  constructor() {
    this.root = mkdtempSync(join(scratch, "case-")); this.work = join(this.root, "work"); this.origin = join(this.root, "origin.git"); this.bin = join(this.root, "bin");
    this.remote = `https://github.com/stack-smoke/${basename(this.root)}.git`;
    this.fixture = join(this.root, "gh.json"); this.calls = join(this.root, "calls.jsonl");
    mkdirSync(this.work); mkdirSync(this.bin);
    this.env = { ...process.env, GIT_CONFIG_GLOBAL: "/dev/null", GIT_CONFIG_NOSYSTEM: "1", GIT_AUTHOR_NAME: "Stack smoke", GIT_AUTHOR_EMAIL: "stack@example.invalid", GIT_COMMITTER_NAME: "Stack smoke", GIT_COMMITTER_EMAIL: "stack@example.invalid", GIT_AUTHOR_DATE: "2026-10-01T00:00:00Z", GIT_COMMITTER_DATE: "2026-10-01T00:00:00Z", GIT_EDITOR: "true", GIT_TERMINAL_PROMPT: "0", PATH: `${this.bin}:${process.env.PATH}`, STACK_FIXTURE: this.fixture, STACK_CALLS: this.calls };
    for (const key of ["GIT_DIR", "GIT_WORK_TREE", "GIT_INDEX_FILE"]) delete this.env[key];
    writeFileSync(join(this.bin, "gh"), `#!${process.execPath}\nimport {readFileSync,appendFileSync} from 'node:fs';\nconst args=process.argv.slice(2); appendFileSync(process.env.STACK_CALLS,JSON.stringify(args)+'\\n');\nconst data=JSON.parse(readFileSync(process.env.STACK_FIXTURE,'utf8')); const repo=args[args.indexOf('--repo')+1]; const answer=data[JSON.stringify([repo,...args.slice(0,3)])]??data[args.slice(0,2).join(' ')];\nif(!answer)process.exit(1);\nif(answer.git_command){appendFileSync(process.env.STACK_CALLS,JSON.stringify(answer.git_command)+'\\n');const r=Bun.spawnSync(answer.git_command);if(r.exitCode)process.exit(r.exitCode);}\nconsole.log(JSON.stringify(answer.value));process.exit(answer.code);\n`);
    chmodSync(join(this.bin, "gh"), 0o755);
    this.git("init", "--bare", `--initial-branch=${this.defaultBranch}`, this.origin);
    this.git("init", `--initial-branch=${this.defaultBranch}`); this.git("config", "commit.gpgsign", "false"); this.git("config", "core.hooksPath", "/dev/null"); this.git("config", "core.logAllRefUpdates", "true");
    this.git("config", `url.${this.origin}.insteadOf`, this.remote); this.git("remote", "add", "origin", this.remote);
    this.commit("root", "root"); this.git("push", "origin", this.defaultBranch); this.config();
  }
  config(repositories = [{ name: "link-repo", path: ".", remote: this.remote }], topology = "monorepo") {
    this.put(".omp/mosaic.json", JSON.stringify({ defaultBranch: this.defaultBranch, topology, landing: { mode: "pull-request", host: "github" }, repositories }));
  }
  put(file: string, text: string) { mkdirSync(dirname(join(this.work, file)), { recursive: true }); writeFileSync(join(this.work, file), text); }
  raw(...args: string[]) { return Bun.spawnSync(["git", ...args], { cwd: this.work, env: this.env, stdout: "pipe", stderr: "pipe" }); }
  git(...args: string[]) { const r = this.raw(...args); eq(r.exitCode, 0, `${args.join(" ")}\n${r.stderr}`); return r.stdout.toString().trim(); }
  commit(subject: string, filename: string, body?: string) {
    this.put(filename, subject + "\n"); this.git("add", filename); this.git("commit", "--allow-empty-message", "-m", subject, ...(body ? ["-m", body] : [])); return this.git("rev-parse", "HEAD");
  }
  plan(base: string = this.defaultBranch, number?: number, archived = false) {
    this.planPath = `docs/plans/${archived ? "archived/" : ""}9902-child.md`;
    this.put(this.planPath, `---\nplan: "9902"\nrepo: link-repo\nbranch: ${this.branch || CHILD}\nbases:\n  link-repo: { base: '${base}', base-pr: ${number ?? "null"} }\n---\n`);
    return join(this.work, this.planPath);
  }
  setup(plan = true, planParent = true, archived = false) {
    this.parent = planParent ? PARENT : LIGHT_PARENT; this.branch = plan ? CHILD : LIGHT_CHILD;
    this.git("switch", "-c", this.parent); this.commit("9901-T1: parent first", "parent1"); this.old = this.commit("9901: parent second", "parent2"); this.git("push", "origin", this.parent); this.git("fetch", "origin"); this.git("switch", "-c", this.branch);
    if (plan) { this.plan(this.parent, 1, archived); this.git("add", this.planPath); }
    this.children = ["9902-T1: child first", "9902: child second"];
    this.commit(this.children[0]!, "child1", plan ? undefined : `Base: ${this.parent} #1 for ${this.branch}`); this.commit(this.children[1]!, "child2"); this.parentResponse("OPEN");
  }
  headIdentity() { return { isCrossRepository: false, headRepository: { nameWithOwner: `stack-smoke/${basename(this.root)}` }, headRepositoryOwner: { login: "stack-smoke" } }; }
  parentResponse(state: string, landing?: string) { this.responses["pr view"]!.value = { ...this.headIdentity(), state, baseRefName: this.defaultBranch, headRefName: this.parent, headRefOid: this.git(`--git-dir=${this.origin}`, "rev-parse", `refs/heads/${this.parent}`), mergeCommit: landing ? { oid: landing } : null }; }
  own(base: string) { this.responses["pr list"]!.value = [{ ...this.headIdentity(), number: 2, baseRefName: base }]; }
  rewrite() { this.git("switch", "-c", "rewritten", this.defaultBranch); this.commit("9901: replacement", "replacement"); this.git("push", "--force", "origin", `HEAD:refs/heads/${this.parent}`); this.git("switch", this.branch); }
  land(mode: string) {
    this.git("switch", this.defaultBranch);
    if (mode === "rebase") { this.env.GIT_COMMITTER_DATE = "2026-10-02T00:00:00Z"; this.git("cherry-pick", `${this.old}~1`, this.old); }
    else { this.git("merge", "--squash", this.parent); this.git("commit", "-m", "9901: parent landed"); }
    const landing = this.git("rev-parse", "HEAD"); ok(landing !== this.old); this.git("push", "origin", this.defaultBranch); this.git("switch", this.branch); this.parentResponse("MERGED", landing); return landing;
  }
  prune() { this.git(`--git-dir=${this.origin}`, "update-ref", "-d", `refs/heads/${this.parent}`); this.git("fetch", "--prune", "origin"); }
  advance() { this.git("switch", this.defaultBranch); this.commit("default advance", "advance"); this.git("push", "origin", this.defaultBranch); this.git("switch", this.branch); }
  run(args = ["--repo", "link-repo"], cwd = this.work) { writeFileSync(this.fixture, JSON.stringify(this.responses)); return Bun.spawnSync([process.execPath, tool, ...args], { cwd, env: this.env, stdout: "pipe", stderr: "pipe" }); }
  resolve(args?: string[]) {
    const r = this.run(args); eq(r.exitCode, 0, r.stderr.toString()); eq(r.stderr.toString(), "");
    const values = Object.fromEntries(r.stdout.toString().trimEnd().split("\n").map(line => { const i = line.indexOf("="); return [line.slice(0, i), line.slice(i + 1)]; }));
    same(Object.keys(values), c.OUTPUT_KEYS); eq(values.base_sha, this.git("rev-parse", values.base_ref!));
    if (values.action === c.NONE) { eq(values.pending, c.NONE); eq(values.command, ""); }
    return values;
  }
  stop(number: number) { const r = this.run(); eq(r.exitCode, 1, r.stderr.toString()); eq(r.stdout.toString(), ""); eq(r.stderr.toString(), c.STOP_PREFIX + c.STOP_REASONS[number] + "\n"); }
  cannot(args?: string[], cwd?: string, expectedMessage?: string | RegExp) {
    const r = this.run(args, cwd); eq(r.exitCode, 2, r.stderr.toString()); eq(r.stdout.toString(), "");
    ok(r.stderr.toString().startsWith(c.ERROR_PREFIX)); eq(r.stderr.toString().trim().split("\n").length, 1);
    if (typeof expectedMessage === "string") eq(r.stderr.toString(), c.ERROR_PREFIX + expectedMessage + "\n");
    else if (expectedMessage) ok(expectedMessage.test(r.stderr.toString()), r.stderr.toString());
  }
  execute(values: Record<string, string>, base: string) {
    const r = Bun.spawnSync(["bash", "-c", values.command!], { cwd: this.work, env: this.env, stdout: "pipe", stderr: "pipe" }); eq(r.exitCode, 0, r.stderr.toString());
    same(this.git("log", "--reverse", "--format=%s", `${base}..HEAD`).split("\n"), this.children);
    for (const file of ["child1", "child2"]) ok(this.children.includes(readFileSync(join(this.work, file), "utf8").trim()));
  }
}
function test(name: string, body: (repo: Repo) => void) { const repo = new Repo(); try { body(repo); console.log(`PASS ${++count} ${name}`); } catch (error) { console.error(`FAIL ${name} (${repo.root})`); throw error; } }
try {
  for (const base of ["trunk", ""]) test(`unstacked_plan[${base || "empty"}]`, r => { r.git("switch", "-c", CHILD); r.plan(base); r.commit("9902: work", "child"); const v = r.resolve(); eq(v.kind, "plan"); eq(v.base, r.defaultBranch); eq(v.action, "none"); eq(v.pending, "none"); eq(v.command, ""); });
  test("unstacked_light", r => { r.git("switch", "-c", LIGHT_CHILD); r.commit("light work", "child"); const v = r.resolve(); eq(v.kind, "light"); eq(v.base, r.defaultBranch); eq(v.action, "none"); eq(v.command, ""); });
  test("stop_1_detached", r => { r.git("switch", "--detach"); r.stop(1); });
  for (const duplicate of [false, true]) test(`stop_2_missing_or_ambiguous_plan[${duplicate}]`, r => { r.git("switch", "-c", CHILD); if (duplicate) { r.plan(); r.plan(undefined, undefined, true); } r.stop(2); });
  for (const parent of [false, true]) test(`stop_3_fetch_failure[${parent}]`, r => { r.setup(); r.git(`--git-dir=${r.origin}`, "update-ref", "-d", `refs/heads/${parent ? r.parent : r.defaultBranch}`); r.stop(3); });
  for (const failure of [true, false]) test(`stop_4_own_lookup[${failure}]`, r => { r.git("switch", "-c", LIGHT_CHILD); if (failure) r.responses["pr list"]!.code = 1; else r.responses["pr list"]!.value = [{}, {}]; r.stop(4); });
  test("stop_5_inherited_only", r => { r.setup(false); r.git("switch", "-c", "docs/undeclared"); r.stop(5); });
  test("stop_6_half_declaration", r => { r.setup(); r.plan(PARENT); r.stop(6); });
  for (const which of ["failed", "head", "closed", "merged_elsewhere"]) test(`stop_7_parent_lookup[${which}]`, r => { r.setup(); const data = r.responses["pr view"]!.value as Record<string, unknown>; if (which === "failed") r.responses["pr view"]!.code = 1; else if (which === "head") data.headRefName = "other"; else if (which === "closed") data.state = "CLOSED"; else { data.state = "MERGED"; data.baseRefName = "other"; } r.stop(7); });
  test("stop_8_wrong_own_target", r => { r.setup(); r.own(r.defaultBranch); r.stop(8); });
  test("stop_9_open_without_old_tip", r => { r.setup(); r.git("switch", "-c", "unrelated", r.defaultBranch); r.commit("unrelated parent", "other"); r.git("push", "--force", "origin", `HEAD:refs/heads/${PARENT}`); r.git("switch", "-c", "task/9902-no-parent", r.defaultBranch); r.branch = "task/9902-no-parent"; r.plan(PARENT, 1); r.commit("9902: own work", "own"); r.stop(9); });
  for (const mode of ["open", "rebase", "squash"]) test(`stop_9_parent_fixup_above_own_commits[${mode}]`, r => { r.setup(); r.git("switch", r.parent); const fix = r.commit("fixup! 9901-T1: parent first", "parentfix"); r.git("push", "origin", r.parent); r.git("switch", r.branch); r.git("cherry-pick", fix); if (mode === "open") r.rewrite(); else r.land(mode); r.stop(9); });
  test("stop_10_unstacked_foreign_subject", r => { r.git("switch", "-c", CHILD); r.plan(); r.commit("9903: foreign work", "foreign"); r.stop(10); });
  test("owned_trailer_read", r => {
    r.setup(false); const v = r.resolve(); eq(v.declared, `${PARENT} #1`); eq(v.base, PARENT); eq(v.action, "none"); eq(v.command, "");
    const calls = readFileSync(r.calls, "utf8").trim().split("\n").map(line => JSON.parse(line));
    ok(calls.some(args => JSON.stringify(args) === JSON.stringify(["pr", "list", "--head", LIGHT_CHILD, ...c.OWN_PR_SUFFIX, "--repo", r.remote])));
    ok(calls.some(args => JSON.stringify(args) === JSON.stringify(["pr", "view", "1", ...c.PARENT_PR_SUFFIX, "--repo", r.remote])));
  });
  test("trailer_free_fixup", r => { r.setup(false); r.commit("fixup! child work", "fixup"); eq(r.resolve().declared, `${PARENT} #1`); });
  test("newer_default_trailer_wins", r => { r.setup(false); r.commit("redeclaration", "metadata", `Base: ${r.defaultBranch} for ${r.branch}`); const v = r.resolve(); eq(v.declared, r.defaultBranch); eq(v.parent, "none"); eq(v.action, "none"); });
  test("trailer_owner_prefix_does_not_match", r => { r.git("switch", "-c", "docs/foo-bar"); r.commit("work", "work", `Base: ${r.defaultBranch} for docs/foo-bar`); r.git("switch", "-c", "docs/foo"); r.stop(5); });
  test("open_parent_contained", r => { r.setup(); r.own(PARENT); const v = r.resolve(); eq(v.parent, "open"); eq(v.action, "none"); eq(v.old_tip, r.old); eq(v.command, ""); });
  test("open_contained_parent_with_borrowed_child_subject", r => { r.setup(); r.git("switch", r.parent); r.commit("9902: borrowed into parent", "borrowed"); r.commit("9901: parent third", "parent3"); r.git("push", "origin", r.parent); r.git("fetch", "origin", r.parent); r.git("switch", r.branch); r.git("rebase", c.remoteRef(r.parent)); eq(r.resolve().action, "none"); });
  test("stop_10_contained_parent_fixup_above_own_commits", r => { r.setup(); r.git("switch", r.parent); const fix = r.commit("fixup! 9901-T1: parent first", "parentfix"); r.git("switch", r.branch); r.git("cherry-pick", fix); r.stop(10); });
  for (const plan of [true, false]) test(`rewritten_parent_restack[${plan}]`, r => { r.setup(plan); r.rewrite(); const v = r.resolve(); eq(v.action, "restack"); eq(v.old_tip, r.old); eq(v.command, c.ontoCommand(c.remoteRef(PARENT), r.old, r.branch)); r.execute(v, c.remoteRef(PARENT)); eq(r.resolve().action, "none"); });
  test("parent_number_in_light_child_preserved", r => { r.setup(false); const subject = "9901: child follow-up"; r.commit(subject, "child3"); r.children.push(subject); r.rewrite(); const v = r.resolve(); eq(v.old_tip, r.old); r.execute(v, c.remoteRef(PARENT)); eq(readFileSync(join(r.work, "child3"), "utf8").trim(), subject); });
  for (const mode of ["rebase", "squash"]) test(`merged_parent_full_transition[${mode}]`, r => { r.setup(); r.own(PARENT); r.land(mode); const v = r.resolve(); eq(v.action, "land"); eq(v.pending, "history,declaration,retarget"); eq(v.old_tip, r.old); r.execute(v, c.remoteRef(r.defaultBranch)); r.plan(); r.own(r.defaultBranch); eq(r.resolve().action, "none"); });
  for (const mode of ["rebase", "squash"]) for (const planParent of [true, false]) test(`archived_landing_lifecycle_no_repeat[${mode},${planParent}]`, r => { r.setup(true, planParent, true); r.land(mode); const v = r.resolve(); eq(v.action, "land"); eq(v.pending, "history"); r.execute(v, c.remoteRef(r.defaultBranch)); if (!planParent) { ok(r.raw("merge-base", "--fork-point", c.remoteRef(r.parent), "HEAD").exitCode !== 0); ok(r.git("reflog", "show", c.remoteRef(r.parent))); eq(r.resolve().action, "none"); r.prune(); } for (let i = 0; i < 2; i++) { const settled = r.resolve(); eq(settled.action, "none"); eq(settled.pending, "none"); eq(settled.command, ""); } r.advance(); eq(r.resolve().action, "none"); });
  for (const mode of ["rebase", "squash"]) test(`active_light_landing_then_default_advance[${mode}]`, r => { r.setup(false, false); r.land(mode); let v = r.resolve(); eq(v.pending, "history,declaration"); r.execute(v, c.remoteRef(r.defaultBranch)); r.advance(); v = r.resolve(); eq(v.pending, "history,declaration"); eq(v.command, `git rebase ${c.remoteRef(r.defaultBranch)}`); r.execute(v, c.remoteRef(r.defaultBranch)); r.commit("default declaration", "metadata", `Base: ${r.defaultBranch} for ${r.branch}`); eq(r.resolve().action, "none"); });
  for (const mode of ["rebase", "squash"]) test(`stop_9_pruned_parent_before_landing_transition[${mode}]`, r => {
    r.setup(false); r.land(mode); r.prune(); const result = r.run(); eq(result.exitCode, 1); eq(result.stdout.toString(), ""); eq(result.stderr.toString(), c.STOP_PREFIX + c.recoveryMessage(r.parent, r.old) + "\n");
    r.git("update-ref", c.trackingRef(r.parent), r.old); const v = r.resolve(); eq(v.action, c.LAND); eq(v.pending, "history,declaration"); eq(v.old_tip, r.old);
    eq(v.command, c.ontoCommand(c.remoteRef(r.defaultBranch), r.old, r.branch)); r.execute(v, c.remoteRef(r.defaultBranch));
  });
  test("stop_9_pruned_rewound_parent_does_not_guess_boundary", r => {
    r.setup(false, false); const rewind = r.git("rev-parse", `${r.old}~1`); r.git("push", "--force", "origin", `${rewind}:refs/heads/${r.parent}`); r.git("switch", r.defaultBranch); r.env.GIT_COMMITTER_DATE = "2026-10-02T00:00:00Z"; r.git("cherry-pick", rewind); const landed = r.git("rev-parse", "HEAD"); r.git("push", "origin", r.defaultBranch); r.git("switch", r.branch); r.parentResponse("MERGED", landed); r.prune();
    eq(r.raw("merge-base", "--is-ancestor", rewind, "HEAD").exitCode, 0);
    const result = r.run(); eq(result.exitCode, 1); eq(result.stdout.toString(), ""); eq(result.stderr.toString(), c.STOP_PREFIX + c.recoveryMessage(r.parent, rewind) + "\n");
  });
  test("stop_9_pruned_rewritten_parent_head_not_ancestor", r => { r.setup(false, false); r.rewrite(); const rewritten = r.git("rev-parse", "rewritten"); const landed = r.land("rebase"); (r.responses["pr view"]!.value as Record<string, unknown>).headRefOid = rewritten; r.prune(); eq(r.raw("merge-base", "--is-ancestor", rewritten, "HEAD").exitCode, 1); eq(r.raw("merge-base", "--is-ancestor", landed, "HEAD").exitCode, 1); r.stop(9); });
  test("stop_9_expired_parent_reflog", r => { r.setup(false); r.rewrite(); r.git("fetch", "origin"); r.git("reflog", "expire", "--expire=now", c.trackingRef(PARENT)); r.land("squash"); r.stop(9); });
  for (const pruned of [false, true]) test(`stop_9_light_merged_default_instead_of_restack[${pruned}]`, r => { r.setup(false); r.land("squash"); r.git("fetch", "origin", r.defaultBranch); r.git("merge", "--no-ff", "-m", "merge default", c.remoteRef(r.defaultBranch)); if (pruned) r.prune(); r.stop(9); });
  test("stop_9_open_noncontained_merge", r => { r.setup(false); r.git("switch", "-c", "side", r.defaultBranch); r.commit("side work", "side"); r.git("switch", r.branch); r.git("merge", "--no-ff", "-m", "side merge", "side"); r.rewrite(); r.stop(9); });
  test("replayed_parent_subject_overrides_contained_landing", r => {
    r.setup(true, true, true); r.land("squash"); r.execute(r.resolve(), c.remoteRef(r.defaultBranch)); const kids = r.git("rev-list", "--reverse", `${c.remoteRef(r.defaultBranch)}..HEAD`).split("\n"); r.git("reset", "--hard", c.remoteRef(r.defaultBranch)); const replay = r.commit("9901: replayed copy", "replayed"); r.git("cherry-pick", ...kids);
    const v = r.resolve(); eq(v.action, c.LAND); eq(v.pending, "history"); eq(v.old_tip, replay); eq(v.command, c.ontoCommand(c.remoteRef(r.defaultBranch), replay, CHILD));
    r.execute(v, c.remoteRef(r.defaultBranch)); ok(!existsSync(join(r.work, "replayed"))); eq(r.resolve().action, "none");
  });
  for (const metadata of ["declaration", "retarget"]) test(`metadata_only_land_empty_command[${metadata}]`, r => { r.setup(true, true, metadata === "retarget"); r.land("squash"); r.execute(r.resolve(), c.remoteRef(r.defaultBranch)); if (metadata === "retarget") r.own(PARENT); const v = r.resolve(); eq(v.action, "land"); eq(v.pending, metadata); eq(v.command, ""); });
  for (const which of ["usage", "auth", "missing-gh", "frontmatter", "not-repo"]) test(`exit_2_cannot_evaluate[${which}]`, r => {
    if (which === "usage") r.cannot(["--unexpected"]);
    else if (which === "auth") { r.responses["auth status"]!.code = 1; r.cannot(); }
    else if (which === "missing-gh") { rmSync(join(r.bin, "gh")); const git = Bun.which("git")!; symlinkSync(git, join(r.bin, "git")); r.env.PATH = r.bin; r.cannot(); }
    else if (which === "frontmatter") { r.git("switch", "-c", CHILD); r.plan(); r.put(r.planPath, "---\nbases: [invalid\n---\n"); r.cannot(); }
    else { mkdirSync(join(r.root, ".omp")); writeFileSync(join(r.root, ".omp/mosaic.json"), readFileSync(join(r.work, ".omp/mosaic.json"))); r.cannot(undefined, r.root, /not a git repository/); }
  });
  for (const [key, value] of [["base", "false"], ["base", "[]"], ["base", "0"], ["base-pr", "true"]]) test(`exit_2_invalid_declaration_type[${key},${value}]`, r => { r.git("switch", "-c", CHILD); r.plan(); const text = readFileSync(join(r.work, r.planPath), "utf8"); r.put(r.planPath, text.replace("base: 'trunk', base-pr: null", key === "base" ? `base: ${value}, base-pr: null` : `base: trunk, base-pr: ${value}`)); r.cannot(undefined, undefined, c.FRONTMATTER_ERROR + c.DECLARATION_TYPE_INVALID); });
  for (const document of ["[]", "false", "0"]) test(`exit_2_falsy_frontmatter_document[${document}]`, r => { r.git("switch", "-c", CHILD); r.plan(); r.put(r.planPath, `---\n${document}\n---\n`); r.cannot(undefined, undefined, c.FRONTMATTER_ERROR + c.FRONTMATTER_NOT_MAPPING); });
  test("empty_frontmatter_document", r => { r.git("switch", "-c", CHILD); r.plan(); r.put(r.planPath, "---\n---\n"); eq(r.resolve().action, "none"); });
  for (const position of ["bottom", "top"]) test(`stop_10_empty_subject[${position}]`, r => { r.git("switch", "-c", CHILD); r.plan(); if (position === "bottom") r.commit("", "empty"); r.commit("9902: own work", "own"); if (position === "top") r.commit("", "empty"); r.stop(10); });
  test("empty_parent_subject_rewrite_does_not_traceback", r => { r.setup(); r.git("switch", r.parent); r.commit("", "empty-parent"); r.git("push", "origin", r.parent); r.git("switch", r.branch); r.git("rebase", r.parent); r.rewrite(); const v = r.resolve(); eq(v.action, "restack"); eq(v.old_tip, r.old); const run = Bun.spawnSync(["bash", "-c", v.command!], { cwd: r.work, env: r.env, stderr: "pipe" }); eq(run.exitCode, 0, run.stderr.toString()); const carried = r.raw("log", "--reverse", "--format=%s", `${c.remoteRef(r.parent)}..HEAD`); eq(carried.exitCode, 0); same(carried.stdout.toString().replace(/\n$/, "").split("\n"), ["", ...r.children]); r.stop(10); });
  test("stop_6_empty_owned_trailer", r => { r.git("switch", "-c", "docs/mal"); r.commit("malformed declaration", "malformed", "Base: for docs/mal"); r.stop(6); });
  for (const plan of [true, false]) test(`exit_2_default_ref_moved_during_evaluation[${plan}]`, r => { r.branch = plan ? CHILD : LIGHT_CHILD; r.git("switch", "-c", r.branch); if (plan) r.plan(); r.commit("9902: own work", "child"); r.git("switch", "-c", "new-default", r.defaultBranch); const moved = r.commit("new default work", "new-default"); r.git("switch", r.branch); r.responses["pr list"]!.git_command = ["git", "update-ref", c.trackingRef(r.defaultBranch), moved]; r.cannot(undefined, undefined, `${c.remoteRef(r.defaultBranch)} moved during evaluation; run again`); eq(r.git("rev-parse", c.remoteRef(r.defaultBranch)), moved); });
  eq(count, 70, "all original expanded cases are ported");
  // New kit-specific cases follow, with real independent repositories and colliding PR numbers.
  test("legacy_plan_without_bases", r => { r.git("switch", "-c", CHILD); r.plan(); r.put(r.planPath, `---\nplan: "9902"\nrepo: link-repo\nbranch: ${CHILD}\n---\n`); r.commit("9902: work", "own"); eq(r.resolve().action, "none"); });
  for (const automatic of [true, false]) test(`retarget_with_deleted_parent[automatic=${automatic}]`, r => { r.setup(); r.land("squash"); r.prune(); r.own(automatic ? r.defaultBranch : PARENT); const v = r.resolve(); eq(v.pending, automatic ? "history,declaration" : "history,declaration,retarget"); r.execute(v, c.remoteRef(r.defaultBranch)); r.plan(); r.own(r.defaultBranch); eq(r.resolve().action, "none"); });
  for (const which of ["missing", "wrong", "extra", "scalar", "branch", "number", "unknown-repo", "remote"]) test(`invalid_repository_declaration[${which}]`, r => { r.setup(); const text = readFileSync(join(r.work, r.planPath), "utf8"); if (which === "missing") r.put(r.planPath, text.replace(/bases:[\s\S]*---/, "bases: {}\n---")); else if (which === "wrong") r.put(r.planPath, text.replace("  link-repo:", "  other:")); else if (which === "extra") r.put(r.planPath, text.replace("bases:", "bases:\n  other: { base: trunk }")); else if (which === "scalar") r.put(r.planPath, text.replace("bases:", "base: trunk\nbases:")); else if (which === "branch") r.put(r.planPath, text.replace(CHILD, "task/9902-other")); else if (which === "number") r.put(r.planPath, text.replace('plan: "9902"', 'plan: "9903"')); else if (which === "unknown-repo") { r.cannot(["--repo", "other"]); return; } else r.config([{ name: "link-repo", path: ".", remote: "https://github.com/other/repo.git" }]); r.cannot(); });
  for (const cross of [false, true]) test(`repository_isolation[${cross ? "cross-repo" : "member-homed"}]`, link => {
    const a = new Repo(), b = new Repo(); a.setup(); b.setup(); b.rewrite();
    b.git("branch", "-m", PARENT, "task/9901-other"); b.git("push", "origin", "rewritten:refs/heads/task/9901-other");
    b.parent = "task/9901-other"; b.parentResponse("OPEN");
    // Both resolvers use one executable, fixture, and log. PR #1 intentionally disagrees.
    const shared: Record<string, Answer> = {
      "auth status": a.responses["auth status"]!,
      [JSON.stringify([a.remote, "pr", "list", "--head"])]: a.responses["pr list"]!,
      [JSON.stringify([b.remote, "pr", "list", "--head"])]: b.responses["pr list"]!,
      [JSON.stringify([a.remote, "pr", "view", "1"])]: a.responses["pr view"]!,
      [JSON.stringify([b.remote, "pr", "view", "1"])]: b.responses["pr view"]!,
    };
    a.responses = shared; b.responses = shared; b.fixture = a.fixture; b.calls = a.calls;
    b.env.STACK_FIXTURE = a.fixture; b.env.STACK_CALLS = a.calls; b.env.PATH = a.env.PATH!;
    // Compose independent checkouts below the link root, without altering either history.
    const moveA = Bun.spawnSync(["mv", a.work, join(link.work, "a")]); eq(moveA.exitCode, 0); a.work = join(link.work, "a");
    const moveB = Bun.spawnSync(["mv", b.work, join(link.work, "b")]); eq(moveB.exitCode, 0); b.work = join(link.work, "b");
    const repos = [{ name: "link-repo", path: ".", remote: link.remote }, { name: "a", path: "a", remote: a.remote }, { name: "b", path: "b", remote: b.remote }]; link.config(repos, "multi-repo");
    const beforeA = a.git("rev-parse", "HEAD"), beforeB = b.git("rev-parse", "HEAD");
    const path = cross ? "docs/plans/9902-child.md" : "a/docs/plans/9902-child.md";
    rmSync(join(a.work, a.planPath)); rmSync(join(b.work, b.planPath));
    link.put(path, `---\nplan: "9902"\nrepo: ${cross ? "[a, b]" : "a"}\nbranch: ${CHILD}\nbases:\n${cross ? "  link-repo: { base: trunk, base-pr: null }\n  b: { base: task/9901-other, base-pr: 1 }\n" : ""}  a: { base: task/9901-parent, base-pr: 1 }\n---\n`);
    const result = a.run(["--repo", "a", "--plan", path], link.work); eq(result.exitCode, 0, result.stderr.toString()); ok(result.stdout.toString().includes("action=none\n"));
    eq(a.git("rev-parse", "HEAD"), beforeA); eq(b.git("rev-parse", "HEAD"), beforeB);
    const calls = readFileSync(a.calls, "utf8").trim().split("\n").map(line => JSON.parse(line) as string[]);
    ok(calls.filter(args => args[0] === "pr").every(args => args.at(-1) === a.remote));
    if (cross) {
      const ownB = b.run(["--repo", "b", "--plan", path], link.work); eq(ownB.exitCode, 0, ownB.stderr.toString());
      ok(ownB.stdout.toString().includes("declared=task/9901-other #1\n")); ok(ownB.stdout.toString().includes("action=restack\n"));
      eq(a.git("rev-parse", "HEAD"), beforeA); eq(b.git("rev-parse", "HEAD"), beforeB);
      const bCalls = readFileSync(b.calls, "utf8").trim().split("\n").slice(calls.length).map(line => JSON.parse(line) as string[]);
      same(bCalls.filter(args => args[0] === "pr").map(args => [args[1], args.at(-1)]), [["list", b.remote], ["view", b.remote]]);
    }
  });
  for (const bases of [true, false]) test(`comma_separated_targets[bases=${bases}]`, link => {
    const a = new Repo(), b = new Repo();
    for (const [name, member] of [["a", a], ["b", b]] as const) {
      eq(Bun.spawnSync(["mv", member.work, join(link.work, name)]).exitCode, 0);
      member.work = join(link.work, name); member.git("switch", "-c", CHILD); member.commit("9902: own work", "own");
    }
    link.config([{ name: "link-repo", path: ".", remote: link.remote }, { name: "a", path: "a", remote: a.remote }, { name: "b", path: "b", remote: b.remote }], "multi-repo");
    link.put("docs/plans/9902-child.md", `---\nplan: "9902"\nrepo: a, b\nbranch: ${CHILD}\n${bases ? "bases:\n  link-repo: { base: trunk, base-pr: null }\n  a: { base: trunk, base-pr: null }\n  b: { base: trunk, base-pr: null }\n" : ""}---\n`);
    for (const name of ["a", "b"]) {
      const result = a.run(["--repo", name, "--plan", "docs/plans/9902-child.md"], link.work);
      eq(result.exitCode, 0, result.stderr.toString()); ok(result.stdout.toString().includes("action=none\n"));
    }
  });
  test("equivalent_remote_transports_and_insteadOf", r => {
    r.git("switch", "-c", LIGHT_CHILD); r.commit("light work", "own");
    const configured = "https://github.com/Example/Repo.git", ssh = "git@github.com:example/repo.git";
    r.config([{ name: "link-repo", path: ".", remote: configured }]);
    r.git("remote", "set-url", "origin", ssh); r.git("config", `url.${r.origin}.insteadOf`, ssh);
    eq(r.git("remote", "get-url", "origin"), r.origin);
    const v = r.resolve(); eq(v.base, r.defaultBranch); eq(v.action, "none");
  });
  test("multi_url_origin_rejects_matching_nonfirst_url_before_fetch", r => {
    const other = new Repo();
    other.commit("other repository base", "foreign"); other.git("push", "origin", other.defaultBranch);
    r.git("switch", "-c", LIGHT_CHILD); r.commit("own work", "own"); r.git("fetch", "origin", r.defaultBranch);
    r.git("remote", "set-url", "origin", other.origin); r.git("config", "--add", "remote.origin.url", r.remote);
    same(r.git("config", "--get-all", "remote.origin.url").split("\n"), [other.origin, r.remote]);
    eq(r.git("remote", "get-url", "origin"), other.origin);
    const refs = r.git("show-ref"), head = r.git("rev-parse", "HEAD");
    const fetchHead = readFileSync(join(r.work, ".git/FETCH_HEAD"));
    const result = r.run();
    eq(result.exitCode, c.CANNOT_EVALUATE, `${result.stdout}\n${result.stderr}`); eq(result.stdout.toString(), "");
    eq(result.stderr.toString(), c.ERROR_PREFIX + "origin does not match configured repository remote\n");
    const calls = existsSync(r.calls) ? readFileSync(r.calls, "utf8").trim().split("\n").map(line => JSON.parse(line) as string[]) : [];
    same(calls.filter(args => args[0] === "pr"), []);
    same(readFileSync(join(r.work, ".git/FETCH_HEAD")), fetchHead);
    eq(r.git("show-ref"), refs); eq(r.git("rev-parse", "HEAD"), head);
  });
  const revisionFailures: string[] = [];
  function regression(name: string, body: (repo: Repo) => void) {
    try { test(name, body); } catch (error) { revisionFailures.push(name); console.error(String(error)); }
  }
  for (const state of ["open", "merged"]) for (const position of ["excluded", "replayed"]) {
    regression(`S1_foreign_subject[${state},${position}]`, r => {
      r.setup();
      if (position === "excluded") {
        r.git("reset", "--hard", r.old); r.commit("9903: foreign work", "foreign");
        r.commit("9901: misleading cutoff", "cutoff"); r.plan(PARENT, 1); r.commit("9902: own work", "own");
      } else r.commit("9903: foreign work", "foreign");
      if (state === "open") r.rewrite(); else r.land("squash");
      const head = r.git("rev-parse", "HEAD");
      r.stop(10); eq(r.git("rev-parse", "HEAD"), head); ok(existsSync(join(r.work, "foreign")));
    });
  }
  regression("S1_proven_inherited_foreign_plan_history", r => {
    r.setup(); const original = r.old, root = r.git("rev-parse", `${r.old}~2`);
    r.git("switch", "-c", "upstream", root); r.commit("9900: inherited upstream work", "upstream");
    r.git("rebase", "--onto", "upstream", root, r.parent); r.old = r.git("rev-parse", "HEAD");
    r.git("push", "--force", "origin", r.parent); r.git("switch", r.branch);
    r.git("rebase", "--onto", r.parent, original, r.branch); r.rewrite();
    const values = r.resolve(); eq(values.action, c.RESTACK); r.execute(values, c.remoteRef(r.parent));
    eq(r.resolve().action, c.NONE);
  });
  for (const plan of [false, true]) regression(`R4_parent_ref_advanced_into_child[plan=${plan}]`, r => {
    r.setup(plan, false); r.land("squash");
    const firstChild = r.git("rev-parse", "HEAD~1");
    eq(r.git("rev-parse", c.remoteRef(r.parent)), r.old);
    r.git("push", "origin", `${firstChild}:refs/heads/child-copy`);
    r.git(`--git-dir=${r.origin}`, "update-ref", `refs/heads/${r.parent}`, firstChild);
    const values = r.resolve(); eq(values.action, c.LAND);
    r.execute(values, c.remoteRef(r.defaultBranch));
    eq(values.old_tip, r.old);
    if (plan) r.plan();
    else r.commit("default declaration", "metadata", `Base: ${r.defaultBranch} for ${r.branch}`);
    eq(r.resolve().action, c.NONE);
  });
  regression("R4_ref_tip_cannot_prove_discarded_foreign_subject", r => {
    r.setup(); r.git("reset", "--hard", r.old);
    const foreign = r.commit("9903: foreign work", "foreign");
    r.commit("9901: misleading cutoff", "cutoff"); r.plan(PARENT, 1); r.commit("9902: own work", "own");
    r.land("squash"); r.git("push", "origin", `${foreign}:refs/heads/child-copy`);
    r.git(`--git-dir=${r.origin}`, "update-ref", `refs/heads/${r.parent}`, foreign);
    r.stop(10);
  });
  regression("R4_merged_rewritten_plan_parent_subject_proof", r => {
    r.setup(false); r.rewrite(); r.git("switch", r.parent); r.git("reset", "--hard", "rewritten");
    r.git("switch", r.branch); r.land("squash");
    const values = r.resolve(); eq(values.action, c.LAND); eq(values.old_tip, r.old);
    r.execute(values, c.remoteRef(r.defaultBranch));
    r.commit("default declaration", "metadata", `Base: ${r.defaultBranch} for ${r.branch}`);
    eq(r.resolve().action, c.NONE);
  });
  for (const planParent of [false, true]) regression(`R5_retained_parent_rewound_before_merge[planParent=${planParent}]`, r => {
    r.setup(false, planParent);
    const firstParent = r.git("rev-parse", `${r.old}~1`);
    r.git("switch", r.parent); r.git("reset", "--hard", firstParent);
    r.git("push", "--force", "origin", r.parent); r.git("switch", r.branch); r.land("squash");
    const values = r.resolve(); eq(values.action, c.LAND); eq(values.old_tip, r.old);
    r.execute(values, c.remoteRef(r.defaultBranch));
    ok(!existsSync(join(r.work, "parent2")), "removed parent work must not be replayed");
    r.commit("default declaration", "metadata", `Base: ${r.defaultBranch} for ${r.branch}`);
    eq(r.resolve().action, c.NONE);
  });
  for (const lookup of ["own", "parent"]) for (const identity of ["fork", "owner", "unknown"]) {
    regression(`S3_head_identity[${lookup},${identity}]`, r => {
      r.setup(); if (lookup === "own") r.own(PARENT);
      const data = lookup === "own" ? (r.responses["pr list"]!.value as Record<string, unknown>[])[0]! : r.responses["pr view"]!.value as Record<string, unknown>;
      if (identity === "fork") { data.isCrossRepository = true; data.headRepository = { nameWithOwner: `fork/${basename(r.root)}` }; data.headRepositoryOwner = { login: "fork" }; }
      else if (identity === "owner") data.headRepositoryOwner = { login: "fork" };
      else { delete data.headRepository; delete data.headRepositoryOwner; delete data.isCrossRepository; }
      r.stop(lookup === "own" ? 4 : 7);
    });
  }
  // gh 2.83.2 returns `nameWithOwner: ""` from `pr list`; the owner login and repository name still identify the head.
  for (const lookup of ["own", "parent"]) for (const identity of ["same", "fork", "owner"]) {
    regression(`S3_head_identity_empty_name_with_owner[${lookup},${identity}]`, r => {
      r.setup(); r.own(PARENT);
      const data = lookup === "own" ? (r.responses["pr list"]!.value as Record<string, unknown>[])[0]! : r.responses["pr view"]!.value as Record<string, unknown>;
      data.headRepository = { name: basename(r.root), nameWithOwner: "" };
      if (identity === "fork") { data.isCrossRepository = true; data.headRepositoryOwner = { login: "fork" }; }
      else if (identity === "owner") data.headRepositoryOwner = { login: "fork" };
      if (identity === "same") { const v = r.resolve(); eq(v.parent, "open"); eq(v.action, c.NONE); }
      else r.stop(lookup === "own" ? 4 : 7);
    });
  }
  for (const name of ["true", "123", "null", "branch'quote", 'branch"quote']) regression(`S5_yaml_default_branch[${name}]`, r => {
    const manifest = join(r.root, "manifest.json"), rendered = join(r.root, "installed");
    writeFileSync(manifest, JSON.stringify({ project: { name: "Quoted", summary: "Quoted is a fixture." }, topology: "monorepo",
      git: { defaultBranch: name }, landing: { mode: "pull-request", host: "github" }, remotes: { link: r.remote }, members: [], components: [] }));
    const installed = Bun.spawnSync([process.execPath, resolve(import.meta.dir, "../../kit/install.ts"), "--manifest", manifest, "--target", rendered], { stdout: "pipe", stderr: "pipe" });
    eq(installed.exitCode, 0, installed.stderr.toString());
    const template = readFileSync(join(rendered, "docs/plans/TEMPLATE.md"), "utf8");
    const data = Bun.YAML.parse(template.split("---")[1]!) as { bases: { "link-repo": { base: unknown } } };
    eq(data.bases["link-repo"].base, name);
    r.git("branch", "-m", name); r.defaultBranch = name; r.git("push", "origin", name); r.config();
    r.git("switch", "-c", CHILD); r.planPath = "docs/plans/9902-child.md";
    r.put(r.planPath, template.replace("plan: NNNN", 'plan: "9902"').replace("task/NNNN-<slug>", CHILD));
    r.commit("9902: own work", "own"); eq(r.resolve().action, c.NONE);
  });
  regression("S6_numeric_zero_parent_number", r => {
    r.git("switch", "-c", CHILD); r.plan(r.defaultBranch, 0); r.commit("9902: own work", "own");
    r.cannot(undefined, undefined, c.DECLARATION_TYPE_INVALID);
  });
  regression("S7_missing_origin_diagnostic", r => {
    r.git("switch", "-c", LIGHT_CHILD); r.git("remote", "remove", "origin");
    r.cannot(undefined, undefined, "origin remote is not configured");
  });
  same(revisionFailures, [], "all final-review regressions pass");
  console.log(`stack-base smoke: ${count} cases passed (70 original plus ${count - 70} kit cases)`);
} finally { rmSync(scratch, { recursive: true, force: true }); }
