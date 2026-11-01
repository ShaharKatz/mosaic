#!/usr/bin/env bun
// Review comment smoke: one git sandbox with a flowchart and a generated-style ERD, base → head and worktree.
import { ok, strictEqual as equal } from "node:assert";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { Diagram, serializeData } from "../../kit/tools/diagram-check.ts";
import * as c from "../../kit/tools/constants/diagrams.ts";
const original = process.cwd(), scratch = mkdtempSync(join(tmpdir(), "mosaic-diagram-review-"));
const tool = resolve(import.meta.dir, "../../kit/tools/diagram-review.ts");
const root = c.DIAGRAMS_ROOT, system = `${root}/${c.SYSTEM_FILE}`, erd = `${root}/erd/schema.erd.mmd`;
let count = 0;
function check(name: string, test: () => void) {
  try { test(); } catch (error) { throw new Error(`${name}: ${(error as Error).stack}`); }
  count++; console.log(`PASS ${name}`);
}
function put(path: string, text: string) { mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, text); }
function git(...args: string[]) {
  const r = Bun.spawnSync(["git", ...args], { stdout: "pipe", stderr: "pipe", env: { ...process.env, GIT_CONFIG_GLOBAL: "/dev/null", GIT_CONFIG_NOSYSTEM: "1" } });
  equal(r.exitCode, 0, r.stderr.toString()); return r.stdout.toString().trim();
}
function commit() { git("add", "."); git("commit", "-qm", "fixture"); return git("rev-parse", "HEAD"); }
function cli(args: string[], code: number) {
  const r = Bun.spawnSync([process.execPath, tool, ...args], { stdout: "pipe", stderr: "pipe" });
  equal(r.exitCode, code, `${args.join(" ")}\n${r.stdout}\n${r.stderr}`); return { out: r.stdout.toString(), err: r.stderr.toString() };
}
const api = { component: "apps/api" };
const node = (id: string, shape: string, label: string, data: Record<string, string>) => `  ${id}@{ ${serializeData({ ...api, ...data }, shape, label)} }`;
const edge = (id: string, from: string, to: string, label: string, data: Record<string, string>) => [`  ${from} ${id}@-->|"${label}"| ${to}`, `  ${id}@{ ${serializeData({ ...api, ...data })} }`];
const built = (source = "apps/api/src/server.ts") => ({ source });
const planned = { decision: "D1", intent: "plan:0001" };
function flowchart(vertices: string[], edges: string[][], classes: string[]) {
  return ["flowchart LR", ...vertices, ...edges.flat(), ...classes.map(line => `  ${line}`), ...c.CLASS_DEFS.map(line => `  ${line}`)].join("\n") + "\n";
}
const baseSystem = flowchart([
  node("api", "rounded", "Orders API", built()), node("db", "cyl", "Postgres", built("apps/api/src/db.ts")),
  node("cache", "rect", "Cache", built()), node("old", "rect", "Old queue", built()),
], [edge("api-db", "api", "db", "Prisma", built("apps/api/src/db.ts")), edge("api-old", "api", "old", "enqueue", built())], ["class api service", "class db store"]);
const headSystem = (searchLabel = "Search service", extraClass = "") => flowchart([
  node("api", "rounded", "Orders API", built()), node("db", "cyl", "Postgres", built("apps/api/src/store.ts")),
  node("cache", "rect", "Cache", { ...built(), ...planned }), node("search", "rounded", searchLabel, planned), node("worker", "rounded", "Worker", built()),
], [edge("api-db", "api", "db", "Prisma ORM", built("apps/api/src/db.ts")), edge("api-worker", "api", "worker", "dispatch", built())],
["class api service", "class db store", "class search intended", "class cache retiring", ...extraClass ? [extraClass] : []]);
const erText = (rows: string[]) => [
  "%% generated: mosaic-prisma-erd from apps/api/schema.prisma; Data; do not edit", "erDiagram",
  "  %% @model-a component: \"apps/api\", source: \"apps/api/schema.prisma\"", "  model-a[\"a_table (A)\"] {", ...rows.map(row => `    ${row}`), "  }",
  "  %% @model-b component: \"apps/api\", source: \"apps/api/schema.prisma\"", "  model-b[\"B (other.prisma)\"] {", "  }",
  "  %% @edge-a-b component: \"apps/api\", source: \"apps/api/schema.prisma\"", "  model-a }o--|| model-b : \"b_id → id onDelete: Cascade\"", ""].join("\n");
const baseRows = ["String id PK \"@default(cuid())\"", "String b_id FK \"IDX\"", "%% @@index([b_id])"];
const headRows = ["String id PK \"@default(cuid())\"", "DateTime created_at", "%% @@index([b_id])", "%% @@unique([created_at])"];
const REVIEW_LINE = /^\s*(classDef rv-|class \S+ rv-|style )/;
// Each Mermaid block, minus the appended review lines and row markers, is the snapshot text and parses.
function blocks(out: string): string[] { return [...out.matchAll(/```mermaid\n([\s\S]*?)\n```/g)].map(m => m[1]! + "\n"); }
function unreviewed(block: string): string {
  return block.split("\n").filter(line => !REVIEW_LINE.test(line)).join("\n").replace(/ "🟢 new"| 🟢 new| 🔴 removed/g, "");
}
function section(out: string, path: string): string {
  const start = out.indexOf(`#### \`${path}\``); ok(start >= 0, `missing section ${path}\n${out}`);
  const next = out.indexOf("#### `", start + 1), problems = out.indexOf("\nProblems:", start);
  return out.slice(start, [next, problems].filter(i => i >= 0).sort((a, b) => a - b)[0] ?? out.length);
}
try {
  process.chdir(scratch);
  put(c.CONFIG_PATH, JSON.stringify({ tracking: { mode: "none" }, diagrams: { mode: c.MODE, root, components: ["apps/api"] } }));
  put(c.DECISION_MAP, "| D1 | search |\n");
  for (const source of ["apps/api/src/server.ts", "apps/api/src/db.ts", "apps/api/src/store.ts", "apps/api/schema.prisma"]) put(source, "// source\n");
  git("init", "-q"); git("config", "user.name", "Smoke"); git("config", "user.email", "smoke@example.invalid"); git("config", "commit.gpgsign", "false");
  put(system, baseSystem); put(erd, erText(baseRows)); const base = commit();
  put(system, headSystem()); put(erd, erText(headRows)); const head = commit();
  const { out } = cli([base, head], 0);
  check("header", () => {
    const lines = out.split("\n");
    equal(lines[0], "<!-- mosaic:diagram-review -->"); equal(lines[1], "### Diagram changes"); equal(lines[2], "");
    equal(lines[3], "🟢 new · 🟣 planned (intended) · 🟡 changed · 🔴 retiring or removed");
  });
  check("flowcharts_before_erds", () => {
    const flow = out.indexOf(`#### \`${system}\``), er = out.indexOf(`#### \`${erd}\``);
    ok(flow > 0 && er > flow, "system.mmd precedes erd/schema.erd.mmd although the ERD path sorts first");
  });
  const flow = section(out, system), er = section(out, erd);
  check("flowchart_change_list", () => {
    const bullets = flow.split("\n").filter(line => line.startsWith("- ") || line.startsWith("  - "));
    equal(bullets.join("\n"), [
      "- 🟡 **changes** Orders API → Postgres “Prisma ORM”",
      "  - label: `Prisma` → `Prisma ORM`",
      "- 🔴 **removes** Orders API → Old queue “enqueue”",
      "- 🟢 **builds** Orders API → Worker “dispatch”",
      "- 🔴 **retires** “Cache”",
      "- 🟡 **changes** “Postgres”",
      "  - source: `apps/api/src/db.ts` → `apps/api/src/store.ts`",
      "- 🔴 **removes** “Old queue”",
      "- 🟣 **adds** “Search service” (planned: D1, plan:0001)",
      "- 🟢 **builds** “Worker”",
    ].join("\n"));
  });
  check("flowchart_before_after", () => {
    const before = flow.indexOf("<details><summary>Before</summary>"), after = flow.indexOf("<details open><summary>After</summary>");
    ok(before > 0 && after > before, flow);
    const [beforeBlock, afterBlock] = blocks(flow);
    for (const definition of ["classDef rv-new stroke:#1a7f37,stroke-width:3px", "classDef rv-planned stroke:#8250df,stroke-width:3px",
      "classDef rv-changed stroke:#bf8700,stroke-width:3px,color:#bf8700", "classDef rv-removed stroke:#cf222e,stroke-width:3px"]) {
      ok(beforeBlock!.includes(`\n  ${definition}\n`) && afterBlock!.includes(`\n  ${definition}\n`), definition);
    }
    ok(beforeBlock!.startsWith(baseSystem), "Before keeps the base text first"); ok(afterBlock!.startsWith(headSystem()), "After keeps the head text first");
    const classes = (block: string) => block.split("\n").filter(line => /^ {2}class \S+ rv-/.test(line));
    equal(classes(beforeBlock!).join("\n"), ["  class db,api-db rv-changed", "  class cache,old,api-old rv-removed"].join("\n"));
    equal(classes(afterBlock!).join("\n"), ["  class worker,api-worker rv-new", "  class search rv-planned", "  class db,api-db rv-changed", "  class cache rv-removed"].join("\n"));
  });
  check("erd_change_list", () => {
    const bullets = er.split("\n").filter(line => line.startsWith("- ") || line.startsWith("  - "));
    equal(bullets.join("\n"), [
      "- 🟡 **changes** table “a_table (A)”",
      "  - `- String b_id FK \"IDX\"`",
      "  - `+ DateTime created_at`",
      "  - `+ %% @@unique([created_at])`",
    ].join("\n"));
  });
  check("erd_styles_and_row_markers", () => {
    const [beforeBlock, afterBlock] = blocks(er);
    ok(beforeBlock!.includes("\n    String b_id FK \"IDX 🔴 removed\"\n"), beforeBlock);
    ok(afterBlock!.includes("\n    DateTime created_at \"🟢 new\"\n"), afterBlock);
    ok(afterBlock!.includes("\n    %% @@unique([created_at]) 🟢 new\n"), afterBlock);
    ok(!afterBlock!.includes("🔴") && !beforeBlock!.includes("🟢"), "markers stay on their side");
    ok(beforeBlock!.endsWith("\n  style model-a stroke:#bf8700,stroke-width:3px\n") && afterBlock!.endsWith("\n  style model-a stroke:#bf8700,stroke-width:3px\n"));
    ok(!er.includes("rv-"), "ERDs use style lines, not classes");
  });
  check("blocks_parse_after_stripping", () => {
    const expected = [baseSystem, headSystem(), erText(baseRows), erText(headRows)], found = blocks(out);
    equal(found.length, 4);
    found.forEach((block, i) => { equal(unreviewed(block), expected[i]); new Diagram(unreviewed(block)); });
  });
  check("one_side_files", () => {
    put(`${root}/added.mmd`, flowchart([node("solo", "rounded", "Solo", built())], [], [])); const next = commit();
    const added = section(cli([head, next], 0).out, `${root}/added.mmd`);
    ok(!added.includes("Before") && added.includes("<details open><summary>After</summary>"), added);
    ok(added.includes("- 🟢 **builds** “Solo”") && added.includes("  class solo rv-new"), added);
    rmSync(`${root}/added.mmd`); const removed = commit();
    const gone = section(cli([next, removed], 0).out, `${root}/added.mmd`);
    ok(gone.includes("<details><summary>Before</summary>") && !gone.includes("After"), gone);
    ok(gone.includes("- 🔴 **removes** “Solo”") && gone.includes("  class solo rv-removed"), gone);
    for (const block of blocks(gone)) new Diagram(unreviewed(block));
  });
  check("worktree_mode", () => {
    put(system, headSystem("Search index"));
    const { out: worktree } = cli(["HEAD", "--worktree"], 0);
    const bullets = worktree.split("\n").filter(line => line.startsWith("- ") || line.startsWith("  - "));
    equal(bullets.join("\n"), ["- 🟡 **changes** “Search index”", "  - label: `Search service` → `Search index`"].join("\n"));
    ok(worktree.includes("  class search rv-changed"), worktree);
    for (const block of blocks(worktree)) new Diagram(unreviewed(block));
  });
  check("problems_list", () => {
    put(system, headSystem("Search service", "class api intended"));
    const { out: problems } = cli(["HEAD", "--worktree"], 0);
    ok(problems.endsWith(`Problems:\n\n- ${c.UNSUPPORTED}: ${c.SYSTEM_FILE}#api: as-built → intended\n`), problems);
    put(system, headSystem());
  });
  check("no_changes", () => {
    equal(cli(["HEAD", "HEAD"], 0).out, "<!-- mosaic:diagram-review -->\n### Diagram changes\n\nNo diagram changes.\n");
    equal(cli(["HEAD", "--worktree"], 0).out, "<!-- mosaic:diagram-review -->\n### Diagram changes\n\nNo diagram changes.\n");
  });
  check("exit_codes", () => {
    for (const args of [[], ["HEAD"], ["HEAD", "HEAD", "HEAD"], ["HEAD", "HEAD", "--worktree"], ["HEAD", "--bogus"]]) {
      const { out: stdout, err } = cli(args, 1); equal(stdout, ""); equal(err.trim().split("\n").length, 1, err);
    }
    const { err } = cli(["no-such-revision", "HEAD"], 1); equal(err.trim().split("\n").length, 1, err);
    put(system, "graph LR\n"); const { err: malformed } = cli(["HEAD", "--worktree"], 1);
    ok(malformed.startsWith(c.CHECK_REASONS[1]!), malformed); put(system, headSystem());
  });
  check("erd_focus", () => {
    const path = `${root}/erd/focus.erd.mmd`, entity = (id: string, rows: string[]) => [`  %% @model-${id} component: "apps/api", source: "apps/api/schema.prisma"`, `  model-${id}["${id.toUpperCase()} (${id.toUpperCase()})"] {`, ...rows.map(row => `    ${row}`), "  }"];
    const meta = (id: string) => `  %% @${id} component: "apps/api", source: "apps/api/schema.prisma"`;
    const text = (rows: string[], withD = false) => ["%% generated: mosaic-prisma-erd from apps/api/schema.prisma; Data; do not edit", "erDiagram", ...entity("a", rows), ...entity("b", ["String b_col"]), ...entity("c", ["String c_col"]),
      ...withD ? entity("d", ["String id PK", "String a_id FK"]) : [], meta("edge-a-b"), '  model-a }o--|| model-b : "b_id → id"', ...withD ? [meta("edge-d-a"), '  model-d }o--|| model-a : "a_id → id"'] : [], ""].join("\n");
    put(path, text(["String id PK"])); const before = commit(); put(path, text(["String id PK", "String note"])); const after = commit();
    const focused = section(cli([before, after], 0).out, path), drawings = blocks(focused);
    equal(drawings.length, 2); ok(focused.includes("_ERD drawings show the changed tables in full and the tables they relate to as name-only boxes._"), focused);
    for (const block of drawings) {
      ok(block.includes("String id PK") && block.includes('  model-b["B (B)"] {\n  }\n') && !block.includes("b_col") && !block.includes("model-c") && block.includes("  model-a }o--|| model-b"), block);
      new Diagram(unreviewed(block));
    }
    // Additions only, then removals only: both drawings share one focus, so neither side falls back to the whole schema.
    put(path, text(["String id PK", "String note"], true)); const added = commit();
    const [beforeAdd, afterAdd] = blocks(section(cli([after, added], 0).out, path));
    ok(beforeAdd!.includes('  model-a["A (A)"] {\n  }\n') && !beforeAdd!.includes("model-d") && !beforeAdd!.includes("model-c") && !beforeAdd!.includes("note"), beforeAdd);
    ok(afterAdd!.includes('  model-a["A (A)"] {\n  }\n') && afterAdd!.includes("    String a_id FK") && afterAdd!.includes("  model-d }o--|| model-a") && !afterAdd!.includes("model-c"), afterAdd);
    put(path, text(["String id PK", "String note"])); const removed = commit();
    const [beforeRemove, afterRemove] = blocks(section(cli([added, removed], 0).out, path));
    ok(beforeRemove!.includes("    String a_id FK") && beforeRemove!.includes("  style model-d stroke:#cf222e") && !beforeRemove!.includes("model-c"), beforeRemove);
    ok(afterRemove!.includes('  model-a["A (A)"] {\n  }\n') && !afterRemove!.includes("model-d") && !afterRemove!.includes("model-c"), afterRemove);
    for (const block of [beforeAdd!, afterAdd!, beforeRemove!, afterRemove!]) new Diagram(unreviewed(block));
  });
  check("comment_size_cap", () => {
    const path = `${root}/big.mmd`, big = (suffix: string) => flowchart(Array.from({ length: 600 }, (_, i) => node(`n${i}`, "rounded", `Service ${i} ${"x".repeat(80)}${i ? "" : suffix}`, built())), [], []);
    put(path, big("")); const before = commit(); put(path, big(" v2")); const after = commit();
    const capped = section(cli([before, after], 0).out, path), whole = cli([before, after], 0).out;
    ok(new TextEncoder().encode(whole).length <= 65536, `${new TextEncoder().encode(whole).length} bytes`);
    ok(capped.includes("- 🟡 **changes** “Service 0") && !capped.includes("```mermaid"), capped.slice(0, 1500));
    for (const title of ["Before", "After"]) ok(capped.includes(`_${title} drawing omitted to stay within GitHub's 65,536-character comment limit; open the file in the pull request._`), capped.slice(0, 1500));
  });
  console.log(`diagram-review-smoke: PASS — ${count} cases`);
} finally { process.chdir(original); rmSync(scratch, { recursive: true, force: true }); }
