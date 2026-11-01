#!/usr/bin/env bun
// Mapping: format-neutral groups retain the upstream test_diagram_tools.py function names; the Mermaid
// grammar, class and classDef groups replace the former XML, geometry and normalization groups.
// Neutral fixtures replace committed/archive project data; core rejects the former erd exemption.
import { deepStrictEqual as eq, ok, strictEqual as equal, throws } from "node:assert";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { Diagram, frontmatter, serializeData, validate } from "../../kit/tools/diagram-check.ts";
import type { Settings } from "../../kit/tools/diagram-check.ts";
import { candidates, compare, delta, project } from "../../kit/tools/diagram-delta.ts";
import * as c from "../../kit/tools/constants/diagrams.ts";
import { install } from "../../kit/install.ts";
const original = process.cwd(), scratch = mkdtempSync(join(tmpdir(), "mosaic-diagrams-"));
const checkTool = resolve(import.meta.dir, "../../kit/tools/diagram-check.ts"), deltaTool = resolve(import.meta.dir, "../../kit/tools/diagram-delta.ts");
const config: Settings = { root: c.DIAGRAMS_ROOT, components: ["apps/api"], tracking: "none" };
let count = 0, groups = 0;
function group<const V>(name: string, variants: readonly V[], test: (variant: V) => void) {
  if (Bun.argv[2] && Bun.argv[2] !== name) return;
  for (const variant of variants) {
    const root = join(scratch, `case-${count++}`); mkdirSync(root); process.chdir(root);
    put(".omp/mosaic.json", JSON.stringify({ tracking: { mode: config.tracking }, diagrams: { mode: c.MODE, root: config.root, components: config.components } }));
    put(c.DECISION_MAP, "| D1 | previous |\n| D2 | current |\n"); mkdirSync("apps/api", { recursive: true }); mkdirSync(config.root, { recursive: true });
    git("init", "-q"); git("config", "user.name", "Smoke"); git("config", "user.email", "smoke@example.invalid"); git("config", "commit.gpgsign", "false");
    try { test(variant); } catch (error) { throw new Error(`${name}[${JSON.stringify(variant)}]: ${(error as Error).stack}`); }
  }
  groups++; console.log(`PASS ${name}: ${variants.length} cases`);
}
function put(path: string, text: string) { mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, text); }
function git(...args: string[]) {
  const r = Bun.spawnSync(["git", ...args], { stdout: "pipe", stderr: "pipe", env: { ...process.env, GIT_CONFIG_GLOBAL: "/dev/null", GIT_CONFIG_NOSYSTEM: "1" } });
  equal(r.exitCode, 0, r.stderr.toString()); return r.stdout.toString().trim();
}
function commit() { git("add", "."); git("commit", "-qm", "fixture"); return git("rev-parse", "HEAD"); }
function cli(tool: string, args: string[], code: number) {
  const r = Bun.spawnSync([process.execPath, tool, ...args], { stdout: "pipe", stderr: "pipe" });
  equal(r.exitCode, code, `${args.join(" ")}\n${r.stdout}\n${r.stderr}`); return { out: r.stdout.toString(), err: r.stderr.toString() };
}
// Mermaid fixture model: elements render in the canonical layout (vertices with nested groups, edges, classes, CLASS_DEFS).
type Options = { parent?: string; legend?: boolean; edge?: [string, string]; rows?: string[]; metadata?: Record<string, string>; classes?: string[]; group?: boolean; shape?: string };
type Spec = { id: string; layer: string; metadata: Record<string, string>; opts: Options };
type Fixture = { elements: Spec[] };
function diagram(): Fixture { return { elements: [] }; }
function element(d: Fixture, id = "node", layer = "as-built", opts: Options = {}): Spec {
  const metadata: Record<string, string> = { label: id, component: "apps/api" };
  if (["as-built", "retiring"].includes(layer)) metadata.source = "apps/api";
  if (["intended", "retiring"].includes(layer)) Object.assign(metadata, { decision: "D2", intent: "plan:0001" });
  if (opts.legend) { delete metadata.component; delete metadata.source; delete metadata.decision; delete metadata.intent; metadata.kind = "legend"; }
  if (opts.rows) metadata.table = "true";
  Object.assign(metadata, opts.metadata);
  const spec = { id, layer, metadata, opts }; d.elements.push(spec); return spec;
}
const quote = (label: string) => label.replace(/"/g, "#quot;").replace(/\n/g, "<br/>");
const block = (pairs: string) => pairs ? `@{ ${pairs} }` : "@{ }";
function render(d: Fixture, combine = false): string {
  const lines = ["flowchart LR"], vertices = d.elements.filter(s => !s.opts.edge);
  const vertex = (s: Spec, indent: string) => {
    const { label = "", ...data } = s.metadata;
    if (s.opts.group) {
      lines.push(`${indent}subgraph ${s.id}["${quote(label)}"]`);
      for (const child of vertices.filter(v => v.opts.parent === s.id)) vertex(child, indent + "  ");
      lines.push(`${indent}end`, `${indent}${s.id}${block(serializeData(data))}`);
    } else lines.push(`${indent}${s.id}${block(serializeData(data, s.opts.shape ?? "rounded", [label, ...s.opts.rows ?? []].join("\n")))}`);
  };
  for (const s of vertices.filter(v => !v.opts.parent || !vertices.some(p => p.id === v.opts.parent))) vertex(s, "  ");
  for (const s of d.elements.filter(e => e.opts.edge)) {
    const { label = "", ...data } = s.metadata;
    lines.push(`  ${s.opts.edge![0]} ${s.id}@-->${label ? `|"${quote(label)}"|` : ""} ${s.opts.edge![1]}`, `  ${s.id}${block(serializeData(data))}`);
  }
  const pairs = d.elements.flatMap(s => [...(s.layer === "as-built" ? [] : [s.layer]), ...s.opts.classes ?? []].map(name => [s.id, name] as const));
  if (combine) for (const name of [...new Set(pairs.map(([, name]) => name))].sort()) lines.push(`  class ${pairs.filter(([, n]) => n === name).map(([id]) => id).join(",")} ${name}`);
  else for (const [id, name] of pairs) lines.push(`  class ${id} ${name}`);
  lines.push(...c.CLASS_DEFS.map(line => `  ${line}`));
  return lines.join("\n") + "\n";
}
const file = `${config.root}/fixture.mmd`;
function save(d: Fixture, name = "fixture.mmd") { const path = `${config.root}/${name}`; put(path, render(d)); return path; }
function line(path: string, number: number, id?: string) { return `${path}: check ${number}: ${c.CHECK_REASONS[number]}${id === undefined ? "" : `: ${id}`}`; }
function fails(d: Fixture | string, number: number, id?: string, name = "fixture.mmd") {
  const path = `${config.root}/${name}`; put(path, typeof d === "string" ? d : render(d)); const result = validate(path, config);
  ok(result.failures.includes(line(path, number, id)), `${number} ${id}\n${result.failures.join("\n")}`);
}
function plan(entries: Partial<Record<c.Kind, string>> = {}, diagrams = "fixture.mmd") {
  return `---\nareas: [apps/api/src]\n---\n${c.ARCHITECTURE_HEADING}\n` + c.KINDS.map(k => `- ${k}: ${entries[k] ?? "none"}`).join("\n") + `\n- diagrams: ${diagrams}\n`;
}
function pair(before?: string, after?: string, options: { before?: Options; after?: Options; name?: string } = {}) {
  const a = diagram(); if (before) element(a, "subject", before, options.before); save(a, options.name); const base = commit();
  const b = diagram(), subject = after ? element(b, "subject", after, options.after) : undefined; save(b, options.name); return { base, drawing: b, subject };
}
function report(base: string) { return delta(base, undefined, config); }
const ref = "fixture.mmd#subject", citation = " (D2, plan:0001)";
const erdText = (rows = ["String id PK \"@default(cuid())\"", "String b_id FK", "%% @@index([b_id])"]) => [
  "%% generated: mosaic-prisma-erd from apps/api/schema.prisma; Data; do not edit", "erDiagram",
  "  %% @model-a component: \"apps/api\", source: \"apps/api\"", "  model-a[\"a_table (A)\"] {", ...rows.map(row => `    ${row}`), "  }",
  "  %% @model-b component: \"apps/api\", source: \"apps/api\"", "  model-b[\"B (other.prisma)\"] {", "  }",
  "  %% @edge-a-b component: \"apps/api\", source: \"apps/api\"", "  model-a }o--|| model-b : \"b_id → id onDelete: Cascade\"", ""].join("\n");
try {
  group("validator_each_check", Array.from({ length: 10 }, (_, i) => i + 1), number => {
    const d = diagram(), node = element(d); let id: string | undefined = "node", name = "fixture.mmd", text: string | undefined;
    if (number === 1) { text = render(d).replace("flowchart LR", "graph LR"); id = undefined; }
    if (number === 2) node.opts.classes = ["bogus"];
    if (number === 3) node.metadata.component = "absent";
    if (number === 4) node.metadata.source = "absent";
    if (number === 5) node.metadata.decision = "D999";
    if (number === 6) node.metadata.intent = "BAD-1";
    if (number === 7) { text = render(d).replace(`  ${c.CLASS_DEFS.at(-1)}\n`, ""); id = undefined; }
    if (number === 8) { element(d, "wanted", "intended"); element(d, "edge", "as-built", { edge: ["node", "wanted"] }); id = "edge"; }
    if (number === 9) { node.metadata.component = "platform"; element(d, "legend", "as-built", { legend: true, metadata: { component: "apps/api" } }); name = c.SYSTEM_FILE; id = undefined; }
    if (number === 10) { element(d, "legend-edge", "as-built", { legend: true, edge: ["node", "node"] }); id = "legend-edge"; }
    fails(text ?? d, number, id, name);
  });
  group("validator_structural_boundaries", ["legend-target", "legend-container", "duplicate", "bad-id", "missing-metadata", "keyword", "keyword-prefix", "link-start", "kind-value", "empty-label"], kind => {
    const d = diagram(), node = element(d); let number = 3, id = "node";
    if (kind === "legend-target") { element(d, "key", "as-built", { legend: true }); element(d, "edge", "as-built", { edge: ["node", "key"] }); number = 10; id = "edge"; }
    if (kind === "legend-container") { element(d, "key", "as-built", { legend: true, group: true }); node.opts.parent = "key"; number = 10; }
    if (kind === "duplicate") element(d);
    if (kind === "bad-id") { node.id = "Bad_Id"; id = "Bad_Id"; }
    if (kind === "missing-metadata") delete node.metadata.source;
    if (kind === "keyword") { node.id = "end"; id = "end"; }
    if (kind === "keyword-prefix") { node.id = "end-user"; id = "end-user"; }
    if (kind === "link-start") { node.id = "a--b"; id = "a--b"; }
    if (kind === "kind-value") node.metadata.kind = "note";
    if (kind === "empty-label") node.metadata.label = "";
    fails(d, number, id);
  });
  group("grammar_violations", ["unknown-statement", "section-order", "edge-in-subgraph", "missing-edge-data", "raw-quote", "backslash", "missing-header", "unclosed-subgraph", "stray-end", "bare-value", "unknown-shape", "missing-shape", "duplicate-key", "separator", "after-classdef", "class-before-edge", "group-data-gap", "empty-edge-label", "direction-node", "direction-edge", "direction-group"], kind => {
    const d = diagram(); element(d, "a"); element(d, "b"); element(d, "edge", "as-built", { edge: ["a", "b"] }); let text = render(d);
    const node = `  a@{ ${serializeData({ component: "apps/api", source: "apps/api" }, "rounded", "a")} }`;
    if (kind === "unknown-statement") text = text.replace(node, `${node}\n  style a fill:#fff`);
    if (kind === "section-order") text = text.replace(node, "").replace("  class", `${node}\n  class`).replace("  edge@{", "  c@{ shape: rect, label: \"c\" }\n  edge@{");
    if (kind === "edge-in-subgraph") text = text.replace(node, `  subgraph g["g"]\n${node}\n  a e2@--> a\n  e2@{ }\n  end`);
    if (kind === "missing-edge-data") text = text.replace(/  edge@\{.*\}\n/, "");
    if (kind === "raw-quote") text = text.replace('label: "a"', 'label: "a"b"');
    if (kind === "backslash") text = text.replace('label: "a"', String.raw`label: "a\b"`);
    if (kind === "missing-header") text = text.replace("flowchart LR\n", "");
    if (kind === "unclosed-subgraph") text = text.replace(node, `  subgraph g["g"]\n${node}`);
    if (kind === "stray-end") text = text.replace(node, `${node}\n  end`);
    if (kind === "bare-value") text = text.replace('component: "apps/api", source: "apps/api" }', 'component: apps, source: "apps/api" }');
    if (kind === "unknown-shape") text = text.replace("shape: rounded, label: \"a\"", "shape: hexagon, label: \"a\"");
    if (kind === "missing-shape") text = text.replace("shape: rounded, label: \"a\", ", "label: \"a\", ");
    if (kind === "duplicate-key") text = text.replace('label: "a"', 'label: "a", label: "a"');
    if (kind === "separator") text = text.replace('label: "a", ', 'label: "a",');
    if (kind === "after-classdef") text += "  class a service\n";
    if (kind === "class-before-edge") text = text.replace("  a edge@", "  class a service\n  a edge@");
    if (kind === "group-data-gap") text = text.replace(node, `  subgraph g["g"]\n${node}\n  end\n  b2@{ shape: rect, label: "b2" }\n  g@{ component: "apps/api" }`);
    if (kind === "empty-edge-label") text = text.replace('|"edge"|', '|""|');
    if (kind === "direction-node") text = text.replace('label: "a"', 'label: "set direction TB"');
    if (kind === "direction-edge") text = text.replace('|"edge"|', '|"direction LR"|');
    if (kind === "direction-group") text = text.replace(node, `  subgraph g["a direction RL"]\n${node}\n  end\n  g@{ component: "apps/api", source: "apps/api" }`);
    ok(text !== render(d) || kind === "after-classdef", kind);
    throws(() => new Diagram(text), (error: Error) => error.message.startsWith(c.CHECK_REASONS[1]));
    fails(text, 1);
  });
  group("metadata_rejections", ["reserved-node", "edge-label-key", "group-shape-key", "table-on-edge", "table-value", "keyword-edge", "keyword-prefix-edge"], kind => {
    const d = diagram(), node = element(d); let id = "node";
    if (kind === "reserved-node") node.metadata.icon = "fa:user";
    if (kind === "edge-label-key" || kind === "table-on-edge" || kind === "keyword-edge" || kind === "keyword-prefix-edge") {
      const edge = element(d, kind === "keyword-edge" ? "class" : kind === "keyword-prefix-edge" ? "default-x" : "edge", "as-built", { edge: ["node", "node"] }); id = edge.id;
      if (kind === "table-on-edge") edge.metadata.table = "true";
      if (kind === "edge-label-key") { put(file, render(d).replace(`  edge@{ `, `  edge@{ label: "x", `)); ok(validate(file, config).failures.includes(line(file, 3, id))); return; }
    }
    if (kind === "group-shape-key") { const g = element(d, "box", "as-built", { group: true }); node.opts.parent = "box"; id = "box"; put(file, render(d).replace(`  box@{ `, "  box@{ shape: rect, ")); ok(validate(file, config).failures.includes(line(file, 3, id))); return; }
    if (kind === "table-value") node.metadata.table = "yes";
    fails(d, 3, id);
  });
  group("class_rules", ["two-layers", "two-categories", "two-kinds", "category-on-edge", "kind-on-vertex", "unknown-class", "undefined-id", "valid"], kind => {
    const d = diagram(), node = element(d); element(d, "other"); const edge = element(d, "edge", "as-built", { edge: ["node", "other"] }); let id = kind.endsWith("edge") ? "edge" : "node";
    if (kind === "two-layers") { node.layer = "intended"; node.opts.classes = ["retiring"]; }
    if (kind === "two-categories") node.opts.classes = ["service", "store"];
    if (kind === "two-kinds") { edge.opts.classes = ["async", "observe"]; id = "edge"; }
    if (kind === "category-on-edge") edge.opts.classes = ["service"];
    if (kind === "kind-on-vertex") node.opts.classes = ["async"];
    if (kind === "unknown-class") node.opts.classes = ["Service"];
    if (kind === "valid") { node.opts.classes = ["service"]; edge.opts.classes = ["observe"]; eq(validate(save(d), config), { failures: [], count: 3 }); return; }
    if (kind === "undefined-id") { put(file, render(d).replace("  classDef service", "  class ghost service\n  classDef service")); id = "ghost"; ok(validate(file, config).failures.includes(line(file, 2, id))); return; }
    fails(d, 2, id);
    const parsed = new Diagram(render(d)), duplicated = new Diagram(render(d).replace("  classDef service", "  class node,node service\n  class node service\n  classDef service"));
    eq(duplicated.byId.get("node")!.classes, [...new Set([...parsed.byId.get("node")!.classes, "service"])]);
  });
  group("canonical_classdef_block", ["reordered", "extra", "edited", "indented-ok", "erd-exempt"], kind => {
    const d = diagram(); element(d); let text = render(d);
    const [first, second] = [c.CLASS_DEFS[0], c.CLASS_DEFS[1]];
    if (kind === "reordered") text = text.replace(`${first}\n  ${second}`, `${second}\n  ${first}`);
    if (kind === "extra") text += "  classDef extra fill:#000\n";
    if (kind === "edited") text = text.replace("#dae8fc", "#ffffff");
    if (kind === "indented-ok") text = text.replace(/^  classDef/gm, "classDef").replace(/\n$/, "\n\n%% trailing comment\n");
    if (kind === "erd-exempt") { put(`${config.root}/data.erd.mmd`, erdText()); eq(validate(`${config.root}/data.erd.mmd`, config).failures, []); return; }
    put(file, text); const failures = validate(file, config).failures;
    eq(failures, kind === "indented-ok" ? [] : [line(file, 7)]);
  });
  group("passing_and_cli_options", [null], () => {
    const d = diagram(); element(d); save(d);
    const expected = "diagram-check: 1 files, 1 elements checked\n"; equal(cli(checkTool, [file], 0).out, expected);
    equal(cli(deltaTool, ["project", file], 0).out, project(new Diagram(render(d))).join("\n") + "\n");
    ok(cli(checkTool, ["--normalize", file], 1).err.includes("unknown diagram-check option"));
  });
  group("projection_layers_rows_and_provenance", [null], () => {
    const d = diagram(); element(d, "table", "as-built", { rows: ["id : Int PK", "name : String"] }); element(d, "wanted", "intended"); element(d, "old", "retiring"); element(d, "key", "as-built", { legend: true }); element(d, "edge", "as-built", { edge: ["table", "table"] });
    eq(project(new Diagram(render(d))), ["as-built | table | table | apps/api | source=apps/api", "  row | id : Int PK", "  row | name : String", "intended | wanted | wanted | apps/api | decision=D2 | intent=plan:0001", "retiring | old | old | apps/api | source=apps/api | decision=D2 | intent=plan:0001", "as-built | key | key |  | kind=legend", "edge | as-built | edge | table → table | edge"]);
  });
  group("projection_matches_contract_example", [null], () => {
    const text = ["flowchart LR",
      `  api@{ shape: rounded, label: "Orders API", component: "apps/api", source: "apps/api/src/server.ts" }`,
      `  db@{ shape: cyl, label: "Postgres", component: "platform", source: "apps/api/prisma/schema.prisma" }`,
      `  search@{ shape: rounded, label: "Search service", component: "apps/api", decision: "D1", intent: "plan:0001" }`,
      `  api api-db@-->|"Prisma"| db`, `  api-db@{ component: "apps/api", source: "apps/api/src/db.ts" }`,
      `  api api-search@-->|"index orders"| search`, `  api-search@{ component: "apps/api", decision: "D1", intent: "plan:0001" }`,
      "  class search,api-search intended", "  class api,search service", "  class db store", ...c.CLASS_DEFS.map(l => `  ${l}`), ""].join("\n");
    const d = new Diagram(text);
    equal(d.kind, "flowchart"); equal(d.direction, "LR"); equal(d.text, text); eq(d.byId.get("search")!.classes, ["intended", "service"]); equal(d.byId.get("db")!.shape, "cyl"); equal(d.byId.get("api-db")!.line, 5);
    eq(project(d), ["as-built | api | Orders API | apps/api | source=apps/api/src/server.ts", "as-built | db | Postgres | platform | source=apps/api/prisma/schema.prisma", "intended | search | Search service | apps/api | decision=D1 | intent=plan:0001", "edge | as-built | api-db | api → db | Prisma", "edge | intended | api-search | api → search | index orders"]);
  });
  group("table_node_rows", ["table", "plain-multiline", "lr-tb"], kind => {
    const d = diagram();
    if (kind === "table") {
      element(d, "orders", "as-built", { rows: ["id : Int PK", 'name : "quoted"'], shape: "rect" }); const text = render(d), parsed = new Diagram(text), e = parsed.byId.get("orders")!;
      ok(text.includes('label: "orders<br/>id : Int PK<br/>name : #quot;quoted#quot;", component'), text);
      equal(e.label, "orders"); eq(e.rows, ["id : Int PK", 'name : "quoted"']); eq(e.rowLines, [2, 2]); equal(e.data.table, "true"); equal(e.shape, "rect");
      eq(validate(save(d), config), { failures: [], count: 1 });
    } else if (kind === "plain-multiline") {
      element(d, "box", "as-built", { metadata: { label: "first\nsecond" } }); const e = new Diagram(render(d)).byId.get("box")!;
      equal(e.label, "first\nsecond"); eq(e.rows, []); equal(project(new Diagram(render(d)))[0], "as-built | box | first second | apps/api | source=apps/api");
    } else { element(d); equal(new Diagram(render(d).replace("flowchart LR", "flowchart TB")).direction, "TB"); }
  });
  group("group_data_line", ["nested", "missing-data"], kind => {
    const d = diagram(); element(d, "outer", "as-built", { group: true }); element(d, "inner", "as-built", { group: true, parent: "outer", metadata: { label: 'Inner "box"' } }); element(d, "leaf", "as-built", { parent: "inner" });
    let text = render(d);
    if (kind === "missing-data") { text = text.replace(/^ *inner@\{.*\}\n/m, ""); put(file, text); ok(validate(file, config).failures.includes(line(file, 3, "inner"))); return; }
    const parsed = new Diagram(text), inner = parsed.byId.get("inner")!, leaf = parsed.byId.get("leaf")!;
    eq(parsed.elements.map(e => [e.id, e.type, e.parent]), [["outer", "group", undefined], ["inner", "group", "outer"], ["leaf", "node", "inner"]]);
    equal(inner.label, 'Inner "box"'); eq(inner.data, { component: "apps/api", source: "apps/api" }); eq(parsed.ancestors(leaf).map(e => e.id), ["inner", "outer"]);
    eq(validate(save(d), config), { failures: [], count: 3 });
  });
  group("label_round_trip", ["node", "edge", "group", "br-variant"], kind => {
    const label = 'Say "hi"\nnext line', d = diagram();
    if (kind === "br-variant") { const e = new Diagram(`flowchart LR\n  n@{ shape: rect, label: "a<br>b<br/>c<br />d<BR>e", source: "#quot;x#quot;" }\n`).byId.get("n")!; equal(e.label, "a\nb\nc\nd\ne"); eq(e.data, { source: '"x"' }); return; }
    const pairs = serializeData({ component: 'apps "api"' }, "rect", label);
    equal(pairs, 'shape: rect, label: "Say #quot;hi#quot;<br/>next line", component: "apps #quot;api#quot;"');
    element(d, "a", "as-built", { metadata: { label: kind === "node" ? label : "a" } }); element(d, "g", "as-built", { group: true, metadata: { label: kind === "group" ? label : "g" } });
    element(d, "e", "as-built", { edge: ["a", "a"], metadata: { label: kind === "edge" ? label : "" } });
    const parsed = new Diagram(render(d)); equal(parsed.byId.get(kind === "node" ? "a" : kind === "group" ? "g" : "e")!.label, label);
    throws(() => serializeData({ source: "a\\b" })); throws(() => serializeData({ source: "a\nb" }));
  });
  group("entity_codes", [null], () => {
    const parsed = new Diagram(`flowchart LR\n  n@{ shape: rect, label: "direction#32;TB 50#37;", note: "a#35;b" }\n`).byId.get("n")!;
    equal(parsed.label, "direction TB 50%"); eq(parsed.data, { note: "a#b" });
    const literal = 'keep #35; and #quot; as typed';
    equal(new Diagram(`flowchart LR\n  n@{ ${serializeData({}, "rect", literal)} }\n`).byId.get("n")!.label, literal);
  });
  group("erd_file_parsing", [null], () => {
    const text = erdText(), d = new Diagram(text);
    equal(d.kind, "erDiagram"); equal(d.generator, "mosaic-prisma-erd"); equal(d.direction, undefined); equal(d.text, text);
    eq(d.elements.map(e => [e.id, e.type, e.label, e.from, e.to]), [["model-a", "entity", "a_table (A)", undefined, undefined], ["model-b", "entity", "B (other.prisma)", undefined, undefined], ["edge-a-b", "relation", "b_id → id onDelete: Cascade", "model-a", "model-b"]]);
    const a = d.byId.get("model-a")!; eq(a.rows, ['String id PK "@default(cuid())"', "String b_id FK", "%% @@index([b_id])"]); eq(a.rowLines, [5, 6, 7]); equal(a.line, 4); eq(a.data, { component: "apps/api", source: "apps/api" }); eq(a.classes, []);
    equal(d.layer(a), "as-built"); eq(d.byId.get("model-b")!.rows, []);
    eq(project(d), ["as-built | model-a | a_table (A) | apps/api | source=apps/api", '  row | String id PK "@default(cuid())"', "  row | String b_id FK", "  row | %% @@index([b_id])", "as-built | model-b | B (other.prisma) | apps/api | source=apps/api", "edge | as-built | edge-a-b | model-a → model-b | b_id → id onDelete: Cascade"]);
  });
  group("erd_validation", ["pass", "quoted-names", "missing-metadata", "wrong-header", "bad-row", "key-word-name", "unlexable-name", "percent-label", "direction-label", "unknown-endpoint", "missing-source", "mismatched-id", "unclosed"], kind => {
    const path = `${config.root}/erd/data.erd.mmd`; let text = erdText(), number = 1, id: string | undefined;
    if (kind === "quoted-names") text = text.replace("String b_id FK", "`UK`? `first name` FK").replace("a_table (A)", "rate#37; (A)");
    if (kind === "pass" || kind === "quoted-names") { put(path, text); eq(validate(path, config), { failures: [], count: 3 }); return; }
    if (kind === "missing-metadata") text = text.replace(/ *%% @edge-a-b .*\n/, "");
    if (kind === "wrong-header") text = text.replace("erDiagram", "flowchart LR");
    if (kind === "bad-row") text = text.replace("String b_id FK", "String b_id FK extra words");
    if (kind === "key-word-name") text = text.replace("String b_id FK", "enum uk");
    if (kind === "unlexable-name") text = text.replace("String b_id FK", "String 2fa_secret");
    if (kind === "percent-label") text = text.replace("a_table (A)", "rate% (A)");
    if (kind === "direction-label") text = text.replace("b_id → id onDelete: Cascade", "direction lr");
    if (kind === "unknown-endpoint") { text = text.replace("model-a }o--|| model-b", "model-a }o--|| model-c"); number = 8; id = "edge-a-b"; }
    if (kind === "missing-source") { text = text.replace('%% @model-b component: "apps/api", source: "apps/api"', '%% @model-b component: "apps/api"'); number = 3; id = "model-b"; }
    if (kind === "mismatched-id") text = text.replace("%% @model-b ", "%% @model-x ");
    if (kind === "unclosed") text = text.replace(/  \}\n  %% @edge/, "  %% @edge");
    put(path, text); ok(validate(path, config).failures.includes(line(path, number, id)), validate(path, config).failures.join("\n"));
  });
  function transitionFixture() {
    const a = diagram();
    for (const [id, layer] of [["realize", "intended"], ["retire", "as-built"], ["remove-retiring", "retiring"], ["remove-built", "as-built"], ["withdraw", "intended"]]) element(a, id!, layer);
    element(a, "rows", "as-built", { rows: ["old : String"] });
    Object.assign(a.elements.find(e => e.id === "retire")!.metadata, { decision: "D1", intent: "plan:0002" }); save(a); const base = commit();
    const b = diagram(); element(b, "realize", "as-built", { metadata: { decision: "D2", intent: "plan:0001" } }); element(b, "retire", "retiring"); element(b, "add", "intended"); element(b, "build", "as-built", { metadata: { decision: "D2", intent: "plan:0001" } }); element(b, "rows", "as-built", { rows: ["new : Int"] }); element(b, "key", "as-built", { legend: true }); save(b); return base;
  }
  const declarations = { adds: "fixture.mmd#add", builds: "fixture.mmd#build", realizes: "fixture.mmd#realize", retires: "fixture.mmd#retire", removes: `fixture.mmd#remove-built${citation}, fixture.mmd#remove-retiring`, withdraws: `fixture.mmd#withdraw${citation}`, changes: "fixture.mmd#rows" };
  group("all_transitions_and_rows", [false, true], worktree => {
    const base = transitionFixture(), d = diagram(); element(d, "untracked", "intended"); save(d, "new.mmd");
    const head = worktree ? undefined : commit(), r = delta(base, head, config);
    eq(r.changes.map(e => `${e.kind}: ${e.reference}`), ["adds: fixture.mmd#add", "builds: fixture.mmd#build", "realizes: fixture.mmd#realize", "removes: fixture.mmd#remove-built", "removes: fixture.mmd#remove-retiring", "retires: fixture.mmd#retire", "changes: fixture.mmd#rows", "withdraws: fixture.mmd#withdraw", "adds: new.mmd#untracked"]);
    eq(r.changes.find(e => e.kind === "changes")!.rows, ["  - row | old : String", "  + row | new : Int"]); eq(r.legends, ["fixture.mmd#key"]);
    if (worktree) { equal(git("rev-parse", "HEAD"), base); eq(delta(base, "HEAD", config).changes, []); }
  });
  group("statement_layout_is_not_semantic_but_class_edits_are", [null], () => {
    const d = diagram(); element(d, "a", "as-built", { classes: ["service"] }); element(d, "b", "as-built", { classes: ["store"] }); const e = element(d, "edge", "as-built", { edge: ["a", "b"], classes: ["async"] }); save(d); const base = commit();
    for (const s of d.elements) s.metadata = Object.fromEntries(Object.entries(s.metadata).reverse());
    put(file, render(d, true).replace(/^  /gm, "    ").replace("flowchart LR\n", "%% layout only\nflowchart LR\n\n")); eq(report(base).changes, []);
    e.opts.classes = ["observe"]; save(d); eq(report(base).changes.map(e => [e.kind, e.reference]), [["changes", "fixture.mmd#edge"]]);
  });
  group("candidates_shape_and_affinity", [false, true], trailing => {
    const d = diagram(); element(d, "stable", "intended"); save(d, "affinity.mmd"); const base = commit(); element(d, "new", "intended"); save(d, "new.mmd");
    const text = plan().replace("areas: [apps/api/src]", `areas: [apps/api/src]${trailing ? " # path globs" : ""}`);
    eq(candidates(report(base), text, config), { candidates: [{ doc: `${config.root}/affinity.mmd`, class: "diagram", why: "plan component affinity" }, { doc: `${config.root}/new.mmd`, class: "diagram", why: "diagram delta" }], cannotEvaluate: [] });
  });
  group("rejected_transitions", [["as-built", "intended"], ["retiring", "intended"], ["intended", "retiring"]], ([before, after]) => {
    const { base } = pair(before, after); ok(report(base).failures[0]!.startsWith(c.UNSUPPORTED)); ok(compare(report(base), plan(), config).some(f => f.startsWith(c.UNSUPPORTED)));
  });
  group("legend_retag_is_architecture_transition", [false, true], reverse => {
    const { base } = pair("as-built", "as-built", { before: { legend: reverse }, after: { legend: !reverse } }); const r = report(base);
    eq(r.changes.map(e => [e.kind, e.reference]), [[reverse ? "builds" : "removes", ref]]); ok(compare(r, plan(), config).some(f => f.startsWith(c.UNDECLARED)));
  });
  group("compare_declared_equals_observed", [false, true], worktree => {
    const base = transitionFixture(); eq(compare(delta(base, worktree ? undefined : commit(), config), plan(declarations), config), []);
  });
  group("compare_cases", ["retired-removal", "legend-only", "undeclared-build", "missing-cell-citation", "invalid-cell-decision", "withdraw-no-citation", "withdraw-invalid-decision", "withdraw-valid", "built-removal-no-citation", "built-removal-valid", "unobserved", "unlisted", "missing-section", "missing-kind", "malformed-entry", "erd"], kind => {
    let before: string | undefined, after: string | undefined = "as-built", entries: Partial<Record<c.Kind, string>> = { builds: ref }, name = "fixture.mmd";
    if (kind === "retired-removal") { before = "retiring"; after = undefined; entries = { removes: ref }; }
    if (kind.startsWith("withdraw")) { before = "intended"; after = undefined; entries = { withdraws: ref + (kind === "withdraw-valid" ? citation : kind === "withdraw-invalid-decision" ? " (D999, plan:0001)" : "") }; }
    if (kind.startsWith("built-removal")) { before = "as-built"; after = undefined; entries = { removes: ref + (kind === "built-removal-valid" ? citation : "") }; }
    if (["legend-only", "undeclared-build", "erd"].includes(kind)) entries = {};
    if (kind === "unobserved") { before = "as-built"; entries = { realizes: ref }; }
    if (kind === "erd") name = "erd/fixture.mmd";
    const { base, drawing, subject } = pair(before, after, { name, after: { legend: kind === "legend-only", metadata: { decision: "D2", intent: "plan:0001" } } });
    if (kind === "missing-cell-citation") { delete subject!.metadata.decision; delete subject!.metadata.intent; save(drawing); }
    if (kind === "invalid-cell-decision") { subject!.metadata.decision = "D999"; save(drawing); }
    let text = plan(entries, ["unlisted", "erd"].includes(kind) ? "none" : name);
    if (kind === "missing-section") text = "# No section\n";
    if (kind === "missing-kind") text = text.replace("- changes: none\n", "");
    if (kind === "malformed-entry") text = text.replace(ref, "not an entry");
    const failures = compare(report(base), text, config), passing = ["retired-removal", "legend-only", "withdraw-valid", "built-removal-valid"].includes(kind);
    if (passing) eq(failures, []); else {
      const expected = kind === "erd" || kind === "undeclared-build" ? c.UNDECLARED : kind === "unobserved" ? c.UNOBSERVED : kind === "unlisted" ? c.UNLISTED : ["missing-section", "missing-kind", "malformed-entry"].includes(kind) ? c.MALFORMED : c.BAD_CITATION;
      ok(failures.some(f => f.startsWith(expected)), failures.join("\n"));
    }
  });
  group("realization_semantic_endpoint_change_requires_declaration_and_decision", [null], () => {
    const a = diagram(); element(a, "a"); element(a, "b"); element(a, "subject", "intended", { edge: ["a", "a"] }); save(a); const base = commit();
    const b = diagram(); element(b, "a"); element(b, "b"); element(b, "subject", "as-built", { edge: ["a", "b"], metadata: { decision: "D2", intent: "plan:0001" } }); save(b);
    const r = report(base); eq(r.changes.map(e => e.kind), ["realizes", "changes"]);
    ok(compare(r, plan({ realizes: ref }), config).some(f => f.startsWith(c.UNDECLARED)));
    ok(compare(r, plan({ realizes: ref, changes: ref }), config).some(f => f.startsWith(c.BAD_CITATION)));
    eq(compare(r, plan({ realizes: ref, changes: ref + citation }), config), []);
  });
  group("worktree_path_filter", [null], () => { const { base } = pair(undefined, "intended"); const other = diagram(); element(other, "extra", "intended"); save(other, "other.mmd"); eq(delta(base, undefined, config, [file]).changes.map(e => e.reference), [ref]); });
  group("committed_diagrams_pass", [null], () => { const d = diagram(); element(d); save(d); commit(); equal(cli(checkTool, [], 0).out, "diagram-check: 1 files, 1 elements checked\n"); });
  group("realization_source_addition_only_is_mechanical", [false, true], existing => { const { base } = pair("intended", "as-built", { before: { metadata: existing ? { source: "tools" } : {} }, after: { metadata: { decision: "D2", intent: "plan:0001" } } }); eq(report(base).changes.map(e => e.kind), existing ? ["realizes", "changes"] : ["realizes"]); });
  group("validator_nested_group_and_source_line_reference", [null], () => { const d = diagram(); element(d, "container", "as-built", { group: true }); element(d, "child", "as-built", { parent: "container", metadata: { source: `${c.DECISION_MAP}:L1` } }); eq(validate(save(d), config), { failures: [], count: 2 }); });
  group("compare_comma_separators_and_folder_prefix", [null], () => { const d = diagram(); save(d, "topology/a.mmd"); save(d, "other.mmd"); const base = commit(); element(d, "first", "intended"); element(d, "second", "intended"); save(d, "topology/a.mmd"); eq(compare(report(base), plan({ adds: "topology/a.mmd#first,topology/a.mmd#second" }, "topology/,other.mmd"), config), []); });
  group("legend_group_isolation", ["nested-architecture", "edge-into-legend-group", "legend-edge-inside-legend"], kind => {
    const d = diagram(); element(d, "a"); element(d, "key", "as-built", { legend: true, group: true }); element(d, "sample", "as-built", { legend: true, parent: "key" });
    if (kind === "nested-architecture") { element(d, "inner", "as-built", { parent: "key" }); fails(d, 10, "inner"); }
    if (kind === "edge-into-legend-group") { element(d, "e", "as-built", { edge: ["a", "sample"] }); fails(d, 10, "e"); }
    if (kind === "legend-edge-inside-legend") { element(d, "other", "as-built", { legend: true, parent: "key" }); element(d, "e", "as-built", { legend: true, edge: ["sample", "other"] }); eq(validate(save(d), config), { failures: [], count: 5 }); }
  });
  group("edge_endpoint_rules", ["group-endpoint", "intended-to-as-built", "as-built-to-intended"], kind => {
    const d = diagram(); element(d, "a"); element(d, "box", "as-built", { group: true }); element(d, "plan", "intended");
    if (kind === "group-endpoint") { element(d, "e", "as-built", { edge: ["a", "box"] }); fails(d, 8, "e"); }
    if (kind === "intended-to-as-built") { element(d, "e", "intended", { edge: ["plan", "a"] }); ok(!validate(save(d), config).failures.some(f => f.includes("check 8"))); }
    if (kind === "as-built-to-intended") { element(d, "e", "as-built", { edge: ["a", "plan"] }); fails(d, 8, "e"); }
  });
  group("source_must_stay_inside_repository", [",", "/tmp", "../", "escape"], source => { if (source === "escape") symlinkSync(scratch, "escape"); const d = diagram(); element(d, "node", "as-built", { metadata: { source } }); fails(d, 4, "node"); });
  group("transition_preserves_nonmechanical_class_changes", [false, true], retirement => { const a = diagram(); element(a, "subject", retirement ? "as-built" : "intended", { metadata: { decision: "D2", intent: "plan:0001" }, classes: retirement ? [] : ["service"] }); save(a); const base = commit(); const b = diagram(); element(b, "subject", retirement ? "retiring" : "as-built", { metadata: { decision: "D2", intent: "plan:0001" }, classes: [retirement ? "external" : "store"] }); save(b); eq(report(base).changes.map(e => e.kind), [retirement ? "retires" : "realizes", "changes"]); ok(compare(report(base), plan({ [retirement ? "retires" : "realizes"]: ref }), config).some(f => f.startsWith(c.UNDECLARED))); });
  group("shape_change_is_semantic", [null], () => { const { base, drawing, subject } = pair("intended", "intended"); subject!.opts.shape = "cyl"; save(drawing); eq(report(base).changes.map(e => e.kind), ["changes"]); });
  group("malformed_list_line_cannot_be_ignored", [null], () => { const { base } = pair("as-built", "as-built"); eq(compare(report(base), plan() + "- builds broken\n", config), [c.MALFORMED]); });
  group("frontmatter_sequences_without_site_packages", [false, true], inline => { eq(frontmatter(`---\nsources: [ignored]\ncomponents: ${inline ? "[apps/api, tools]" : "\n  - apps/api\n  - tools"}\n---\n`).components, ["apps/api", "tools"]); });
  group("each_bad_ticket_names_its_element", [null], () => { const d = diagram(); element(d, "first", "as-built", { metadata: { intent: "BAD-1" } }); element(d, "second", "as-built", { metadata: { intent: "BAD-1" } }); eq(validate(save(d), config).failures, ["first", "second"].map(id => line(file, 6, id))); });
  group("malformed_snapshot_cli_has_no_traceback", [null], () => { const { base } = pair("as-built", "as-built"); put(file, "flowchart LR\n  broken"); const r = cli(deltaTool, ["delta", base, "--worktree"], 1); equal(r.err.trim().split("\n").length, 1); ok(r.err.startsWith(c.CHECK_REASONS[1])); });
  group("candidates_stdout_is_json_only", [null], () => { const { base } = pair(undefined, "intended"); put("plan.md", plan()); const r = cli(deltaTool, ["delta", base, "--worktree", "--candidates", "--plan", "plan.md"], 0); equal(JSON.parse(r.out).candidates[0].doc, file); ok(r.err.includes(`adds: ${ref}`)); });
  group("project_identifies_legend", [null], () => { const d = diagram(); element(d, "key", "as-built", { legend: true }); equal(project(new Diagram(render(d)))[0], "as-built | key | key |  | kind=legend"); });
  group("frontmatter_comment_handling", [["[apps/api/src] # comment", ["apps/api/src"]], ["\n  - apps/api # note", ["apps/api"]], ['["apps/api # quoted"] # note', ["apps/api # quoted"]], ["['apps/api # quoted'] # note", ["apps/api # quoted"]], ["[apps/api#fragment] # note", ["apps/api#fragment"]], ["# comment-only", []]], ([value, expected]) => eq(frontmatter(`---\nareas: ${value}\n---\n`).areas, expected));
  console.log(`UPSTREAM MAPPING: ${groups} functions / ${count} cases (neutral archive/inventory; erd case rejects exemption)`);
  group("s6_cli_candidate_selection", ["baseline_inline", "quoted_comma"], variant => {
    mkdirSync("services/api", { recursive: true });
    put(c.CONFIG_PATH, JSON.stringify({ tracking: { mode: "none" }, diagrams: { mode: c.MODE, root: config.root, components: ["services/api"] } }));
    const d = diagram(); element(d, "api", "as-built", { metadata: { component: "services/api", source: "services/api" } });
    const drawing = save(d, "probe.mmd"); commit();
    put("plan.md", `---\nareas: ${variant === "baseline_inline" ? "[services/api]" : '["services/api/with,comma"]'}\n---\n`);
    const result = cli(deltaTool, ["delta", "HEAD", "--worktree", "--candidates", "--plan", "plan.md"], 0);
    eq(JSON.parse(result.out), { candidates: [{ doc: drawing, class: "diagram", why: "plan component affinity" }], cannotEvaluate: [] });
  });
  group("s6_complete_inline_items", [
    ['["services/api/with,comma", services/web]', ["services/api/with,comma", "services/web"]],
    [String.raw`["services/api/with\"quote,comma"]`, ['services/api/with"quote,comma']],
    ["['services/api/it''s,comma']", ["services/api/it's,comma"]],
    [String.raw`["services/api/with\\tail,comma"]`, [String.raw`services/api/with\tail,comma`]],
    [String.raw`["services/api/with\q,comma"]`, [String.raw`services/api/with\q,comma`]],
    ["[services/api/it's, services/web]", ["services/api/it's", "services/web"]],
  ] as const, ([value, expected]) => eq(frontmatter(`---\nareas: ${value}\n---\n`).areas, expected));
  group("s6_invalid_quoted_items", ['["apps/api/with,comma]', '["apps/api" garbage]'], value => {
    const d = diagram(); element(d); save(d); commit(); put("plan.md", `---\nareas: ${value}\n---\n`);
    cli(deltaTool, ["delta", "HEAD", "--worktree", "--candidates", "--plan", "plan.md"], 1);
  });
  group("r1_containment", ["validate", "project", "delta", "home"], operation => {
    const d = diagram(); element(d); save(d); const base = commit(), outside = join(scratch, `outside-${count}`), bytes = render(d);
    mkdirSync(outside); put(join(outside, "escape.mmd"), bytes);
    if (operation === "home") { rmSync(config.root, { recursive: true }); symlinkSync(outside, config.root); }
    else { rmSync(file); symlinkSync(join(outside, "escape.mmd"), file); }
    const path = operation === "home" ? `${config.root}/escape.mmd` : file;
    if (operation === "validate" || operation === "home") eq(validate(path, config).failures, [line(path, 1)]);
    else if (operation === "project") cli(deltaTool, ["project", path], 1);
    else cli(deltaTool, ["delta", base, "--worktree"], 1);
    equal(readFileSync(join(outside, "escape.mmd"), "utf8"), bytes, "external file unchanged");
  });
  group("r1_git_paths", ["revision-root", "worktree-root", "revision-file", "worktree-file"], variant => {
    const settings = { ...config, root: variant.endsWith("root") ? "vîews" : config.root }, path = `${settings.root}/${variant.endsWith("file") ? "système" : "fixture"}.mmd`;
    const d = diagram(), subject = element(d, "subject", "intended"); put(path, render(d)); const base = commit();
    subject.metadata.label = "changed"; put(path, render(d));
    const head = variant.startsWith("revision") ? commit() : undefined;
    eq(delta(base, head, settings).changes.map(change => [change.kind, change.reference]), [["changes", `${path.slice(settings.root.length + 1)}#subject`]]);
  });
  group("r1_diagnostic_order", [null], () => {
    const d = diagram(); for (const id of ["first", "second"]) element(d, id, "intended", { metadata: { decision: "D999", intent: "invalid" } });
    const failures = validate(save(d), config).failures.filter(entry => /check [56]:/.test(entry));
    eq(failures, [5, 6].flatMap(number => ["first", "second"].map(id => line(file, number, id))));
  });
  group("r1_cli_exit_codes", [null], () => {
    const { base } = pair("as-built", "intended"); put("plan.md", plan());
    cli(deltaTool, ["delta", base, "--worktree"], 1); cli(deltaTool, ["compare", "plan.md", base, "--worktree"], 1);
    const d = diagram(); element(d, "subject", "as-built"); save(d);
    cli(deltaTool, ["compare", "plan.md", base, "--worktree"], 0);
  });
  group("replaced_and_invalid_mode", ["drawio", "bogus"], mode => {
    const d = diagram(); element(d); save(d);
    put(c.CONFIG_PATH, JSON.stringify({ tracking: { mode: "none" }, diagrams: { mode, root: config.root, components: config.components } }));
    equal(cli(checkTool, [file], 1).err.trim(), mode === "drawio" ? c.REPLACED_MODE_MESSAGE : "invalid mermaid settings");
    equal(cli(deltaTool, ["project", file], 1).err.trim(), mode === "drawio" ? c.REPLACED_MODE_MESSAGE : "invalid mermaid settings");
  });
  group("r2_runtime_reserved_root", ["validate", "project", "delta"], command => {
    const d = diagram(); element(d, "subject", "intended"); const path = "tools/probe.mmd", bytes = render(d); put(path, bytes);
    put(c.CONFIG_PATH, JSON.stringify({ tracking: { mode: "none" }, diagrams: { mode: c.MODE, root: "tools", components: config.components } })); commit();
    if (command === "validate") cli(checkTool, [path], 1);
    else if (command === "project") cli(deltaTool, ["project", path], 1);
    else cli(deltaTool, ["delta", "HEAD", "--worktree"], 1);
    equal(readFileSync(path, "utf8"), bytes);
  });
  group("r2_supported_roots", [".git/diagrams", "nested/.git/diagrams", "docs/tracker/diagrams", "docs/standards/diagrams", ".GIT/diagrams", "DOCS/Architecture"], home => {
    const d = diagram(); element(d, "subject", "intended"); const path = `${home}/probe.mmd`, bytes = render(d); put(path, bytes);
    put(c.CONFIG_PATH, JSON.stringify({ tracking: { mode: "none" }, diagrams: { mode: c.MODE, root: home, components: config.components } }));
    cli(checkTool, [path], 1); equal(readFileSync(path, "utf8"), bytes);
  });
  // Additional kit-only behavior: no-tracker and tracker intent syntax, and bundle omission.
  group("kit_intent_modes", ["none", "local", "mcp"], mode => { const d = diagram(), wanted = element(d, "wanted", "intended", { metadata: { intent: mode === "none" ? "plan:0001" : "tracker://ENG-1" } }); const settings: Settings = { ...config, tracking: mode }; eq(validate(save(d), settings).failures, []); save(diagram()); const base = commit(); save(d); eq(compare(delta(base, undefined, settings), plan({ adds: "fixture.mmd#wanted" }), settings), []); wanted.metadata.intent = mode === "none" ? "tracker://ENG-1" : "plan:0001"; ok(validate(save(d), settings).failures.includes(line(file, 6, "wanted"))); });
  // Diagram decisions: a project's frozen legacy map stays citable; a number in both maps is refused.
  group("kit_decision_maps", ["archived", "reused"] as const, variant => { put(c.DECISION_ARCHIVE, variant === "archived" ? "| D7 | legacy |\n" : "| D2 | legacy |\n"); const d = diagram(); element(d, "wanted", "intended", { metadata: { decision: variant === "archived" ? "D7" : "D2" } }); const path = save(d); if (variant === "archived") eq(validate(path, config).failures, []); else ok(cli(checkTool, [path], 1).err.includes(`${c.DECISION_REUSED}: D2`)); });
  process.chdir(original);
  const manifest = join(scratch, "install.json"), input = { project: { name: "Atlas", summary: "Atlas is a project." }, topology: "monorepo", remotes: { link: "https://example.invalid/atlas.git" }, members: [] };
  for (const mode of [undefined, { mode: "none" }]) {
    writeFileSync(manifest, JSON.stringify({ ...input, diagrams: mode })); const target = join(scratch, mode ? "explicit-off" : "default-off"); await install({ manifest, target });
    for (const path of [...c.BUNDLE_FILES, c.DIAGRAMS_ROOT]) ok(!existsSync(join(target, path)), path);
    ok(!existsSync(join(target, ".mcp.json"))); equal(JSON.parse(readFileSync(join(target, c.CONFIG_PATH), "utf8")).diagrams, undefined);
  }
  console.log(`diagram-smoke: PASS — ${count} behavior cases plus two no-bundle installations`);
} finally { process.chdir(original); rmSync(scratch, { recursive: true, force: true }); }
