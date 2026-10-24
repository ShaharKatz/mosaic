#!/usr/bin/env bun
// Mapping: each group below retains the upstream test_diagram_tools.py function name.
// Neutral fixtures replace committed/archive project data; core rejects the former erd exemption.
import { deepStrictEqual as eq, ok, strictEqual as equal } from "node:assert";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { deflateRawSync } from "node:zlib";
import { Drawing, frontmatter, parseXml, serialize, validate } from "../../kit/tools/diagram-check.ts";
import type { Settings, Xml } from "../../kit/tools/diagram-check.ts";
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
    put(".omp/mosaic.json", JSON.stringify({ tracking: { mode: config.tracking }, diagrams: { mode: "drawio", root: config.root, components: config.components } }));
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
function xml(tag: string, attrs: Record<string, string> = {}, children: Xml[] = []): Xml { return { tag, attrs, children, text: "" }; }
function diagram() {
  return xml("mxfile", { compressed: "false" }, [xml("diagram", {}, [xml("mxGraphModel", { pageWidth: "1600", pageHeight: "1600" }, [xml("root", {}, [xml("mxCell", { id: "0" }), ...c.LAYERS.map(id => xml("mxCell", { id, parent: "0" }))])])])]);
}
function root(d: Xml) { return d.children[0]!.children[0]!.children[0]!; }
type Options = { x?: number; parent?: string; legend?: boolean; edge?: [string, string]; rows?: string[]; metadata?: Record<string, string> };
function element(d: Xml, id = "node", layer = "as-built", opts: Options = {}) {
  const metadata: Record<string, string> = { id, label: id, component: "apps/api" };
  if (["as-built", "retiring"].includes(layer)) metadata.source = "apps/api";
  if (["intended", "retiring"].includes(layer)) Object.assign(metadata, { decision: "D2", intent: "plan:0001" });
  if (opts.legend) { delete metadata.component; delete metadata.source; delete metadata.decision; delete metadata.intent; metadata.kind = "legend"; }
  Object.assign(metadata, opts.metadata);
  const cell = xml("mxCell", { parent: opts.parent ?? layer, style: Object.entries(c.LAYER_STYLES[layer]!).map(([k, v]) => `${k}=${v};`).join("") + (opts.rows ? "shape=table;" : ""), ...(opts.edge ? { edge: "1", source: opts.edge[0], target: opts.edge[1] } : { vertex: "1" }) }, [xml("mxGeometry", { x: String(opts.x ?? 10), y: "10", width: "50", height: "50" })]);
  const wrapper = xml("object", metadata, [cell]); root(d).children.push(wrapper);
  for (const [i, text] of (opts.rows ?? []).entries()) root(d).children.push(xml("mxCell", { id: `${id}-row-${i}`, parent: id, value: text, vertex: "1", style: "shape=tableRow;" }));
  return { wrapper, cell };
}
const file = `${config.root}/fixture.drawio`;
function save(d: Xml, name = "fixture.drawio") { const path = `${config.root}/${name}`; put(path, serialize(d)); return path; }
function fails(d: Xml, number: number, id?: string, name = "fixture.drawio") {
  const path = save(d, name), result = validate(path, config);
  ok(result.failures.includes(`${path}: check ${number}: ${c.CHECK_REASONS[number]}${id === undefined ? "" : `: ${id}`}`), result.failures.join("\n"));
}
function plan(entries: Partial<Record<c.Kind, string>> = {}, diagrams = "fixture.drawio") {
  return `---\nareas: [apps/api/src]\n---\n${c.ARCHITECTURE_HEADING}\n` + c.KINDS.map(k => `- ${k}: ${entries[k] ?? "none"}`).join("\n") + `\n- diagrams: ${diagrams}\n`;
}
function pair(before?: string, after?: string, options: { before?: Options; after?: Options; name?: string } = {}) {
  const a = diagram(); if (before) element(a, "subject", before, options.before); save(a, options.name); const base = commit();
  const b = diagram(); if (after) element(b, "subject", after, options.after); save(b, options.name); return { base, drawing: b };
}
function report(base: string) { return delta(base, undefined, config); }
const ref = "fixture.drawio#subject", citation = " (D2, plan:0001)";
try {
  group("validator_each_check", Array.from({ length: 13 }, (_, i) => i + 1), number => {
    const d = diagram(), { wrapper, cell } = element(d); let id: string | undefined = "node", name = "fixture.drawio";
    if (number === 1) { d.attrs.compressed = "true"; id = undefined; }
    if (number === 2) { cell.attrs.parent = "1"; id = undefined; }
    if (number === 3) wrapper.attrs.component = "absent";
    if (number === 4) wrapper.attrs.source = "absent";
    if (number === 5) wrapper.attrs.decision = "D999";
    if (number === 6) wrapper.attrs.intent = "BAD-1";
    if (number === 7) cell.attrs.style = "opacity=45;";
    if (number === 8) { element(d, "wanted", "intended", { x: 100 }); element(d, "edge", "as-built", { edge: ["node", "wanted"] }); id = "edge"; }
    if (number === 9) element(d, "overlap", "as-built", { x: 20 });
    if (number === 10) cell.children[0]!.attrs.x = "1590";
    if (number === 11) cell.attrs.style = "fontSize=10;";
    if (number === 12) { wrapper.attrs.component = "platform"; element(d, "legend", "as-built", { x: 100, legend: true, metadata: { component: "apps/api" } }); name = "system.drawio"; id = undefined; }
    if (number === 13) { element(d, "legend-edge", "as-built", { legend: true, edge: ["node", "node"] }); id = "legend-edge"; }
    fails(d, number, id, name);
  });
  group("validator_structural_boundaries", ["inner-id", "legend-target", "legend-container", "duplicate", "bad-id", "missing-metadata", "missing-root", "cycle"], kind => {
    const d = diagram(), { wrapper, cell } = element(d); let number = 3;
    if (kind === "inner-id") cell.attrs.id = "inner";
    if (kind === "legend-target") { element(d, "key", "as-built", { legend: true, x: 100 }); element(d, "edge", "as-built", { edge: ["node", "key"] }); number = 13; }
    if (kind === "legend-container") { element(d, "key", "as-built", { legend: true }); cell.attrs.parent = "key"; number = 13; }
    if (kind === "duplicate") element(d);
    if (kind === "bad-id") wrapper.attrs.id = "BAD ID";
    if (kind === "missing-metadata") delete wrapper.attrs.source;
    if (kind === "missing-root") { root(d).children.shift(); number = 2; }
    if (kind === "cycle") { cell.attrs.parent = "node"; number = 2; }
    const id = number === 2 ? undefined : kind === "bad-id" ? "BAD ID" : kind === "legend-target" ? "edge" : "node";
    ok(validate(save(d), config).failures.includes(`${file}: check ${number}: ${c.CHECK_REASONS[number]}${id === undefined ? "" : `: ${id}`}`));
  });
  group("passing_and_normalize", [null], () => {
    const d = diagram(); element(d); save(d);
    const expected = "diagram-check: 1 files, 1 elements checked\n"; equal(cli(checkTool, [file], 0).out, expected);
    const projection = cli(deltaTool, ["project", file], 0).out, page = d.children[0]!, model = page.children[0]!;
    page.children = []; page.text = deflateRawSync(Buffer.from(encodeURIComponent(serialize(model)))).toString("base64"); d.attrs.compressed = "true"; save(d);
    equal(cli(checkTool, [file], 1).out, `${file}: check 1: ${c.CHECK_REASONS[1]}\n`); equal(cli(checkTool, ["--normalize", file], 0).out, expected); equal(cli(deltaTool, ["project", file], 0).out, projection);
  });
  group("projection_layers_rows_and_provenance", [null], () => {
    const d = diagram(); element(d, "table", "as-built", { rows: ["id : Int PK", "name : String"] }); element(d, "wanted", "intended"); element(d, "old", "retiring"); element(d, "key", "as-built", { legend: true }); element(d, "edge", "as-built", { edge: ["table", "table"] });
    eq(project(new Drawing(serialize(d))), ["as-built | table | table | apps/api | source=apps/api", "  row | id : Int PK", "  row | name : String", "intended | wanted | wanted | apps/api | decision=D2 | intent=plan:0001", "retiring | old | old | apps/api | source=apps/api | decision=D2 | intent=plan:0001", "as-built | key | key |  | kind=legend", "edge | as-built | edge | table → table | edge"]);
  });
  function transitionFixture() {
    const a = diagram();
    for (const [id, layer] of [["realize", "intended"], ["retire", "as-built"], ["remove-retiring", "retiring"], ["remove-built", "as-built"], ["withdraw", "intended"]]) element(a, id, layer);
    element(a, "rows", "as-built", { rows: ["old : String"] });
    const retired = root(a).children.find(e => e.attrs.id === "retire")!; Object.assign(retired.attrs, { decision: "D1", intent: "plan:0002" }); save(a); const base = commit();
    const b = diagram(); element(b, "realize", "as-built", { metadata: { decision: "D2", intent: "plan:0001" } }); element(b, "retire", "retiring"); element(b, "add", "intended"); element(b, "build", "as-built", { metadata: { decision: "D2", intent: "plan:0001" } }); element(b, "rows", "as-built", { rows: ["new : Int"] }); element(b, "key", "as-built", { legend: true }); save(b); return base;
  }
  const declarations = { adds: "fixture.drawio#add", builds: "fixture.drawio#build", realizes: "fixture.drawio#realize", retires: "fixture.drawio#retire", removes: `fixture.drawio#remove-built${citation}, fixture.drawio#remove-retiring`, withdraws: `fixture.drawio#withdraw${citation}`, changes: "fixture.drawio#rows" };
  group("all_transitions_and_rows", [false, true], worktree => {
    const base = transitionFixture(), d = diagram(); element(d, "untracked", "intended"); save(d, "new.drawio");
    const head = worktree ? undefined : commit(), r = delta(base, head, config);
    eq(r.changes.map(e => `${e.kind}: ${e.reference}`), ["adds: fixture.drawio#add", "builds: fixture.drawio#build", "realizes: fixture.drawio#realize", "removes: fixture.drawio#remove-built", "removes: fixture.drawio#remove-retiring", "retires: fixture.drawio#retire", "changes: fixture.drawio#rows", "withdraws: fixture.drawio#withdraw", "adds: new.drawio#untracked"]);
    eq(r.changes.find(e => e.kind === "changes")!.rows, ["  - row | old : String", "  + row | new : Int"]); eq(r.legends, ["fixture.drawio#key"]);
    if (worktree) { equal(git("rev-parse", "HEAD"), base); eq(delta(base, "HEAD", config).changes, []); }
  });
  group("edge_port_edits_are_layout_but_stroke_edits_are_semantic", [null], () => {
    const d = diagram(); element(d, "a"); element(d, "b"); const e = element(d, "edge", "as-built", { edge: ["a", "b"] }); e.cell.attrs.style = "edgeStyle=orthogonalEdgeStyle;exitX=1;entryY=0.5;"; save(d); const base = commit();
    e.cell.attrs.style = "edgeStyle=orthogonalEdgeStyle;exitX=0;entryY=1;exitPerimeter=0;"; save(d); eq(report(base).changes, []);
    e.cell.attrs.style += "strokeColor=#ff0000;"; save(d); eq(report(base).changes.map(e => [e.kind, e.reference]), [["changes", "fixture.drawio#edge"]]);
  });
  group("candidates_shape_and_affinity", [false, true], trailing => {
    const d = diagram(); element(d, "stable", "intended"); save(d, "affinity.drawio"); const base = commit(); element(d, "new", "intended"); save(d, "new.drawio");
    const text = plan().replace("areas: [apps/api/src]", `areas: [apps/api/src]${trailing ? " # path globs" : ""}`);
    eq(candidates(report(base), text, config), { candidates: [{ doc: `${config.root}/affinity.drawio`, class: "diagram", why: "plan component affinity" }, { doc: `${config.root}/new.drawio`, class: "diagram", why: "diagram delta" }], cannotEvaluate: [] });
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
    let before: string | undefined, after: string | undefined = "as-built", entries: Partial<Record<c.Kind, string>> = { builds: ref }, name = "fixture.drawio";
    if (kind === "retired-removal") { before = "retiring"; after = undefined; entries = { removes: ref }; }
    if (kind.startsWith("withdraw")) { before = "intended"; after = undefined; entries = { withdraws: ref + (kind === "withdraw-valid" ? citation : kind === "withdraw-invalid-decision" ? " (D999, plan:0001)" : "") }; }
    if (kind.startsWith("built-removal")) { before = "as-built"; after = undefined; entries = { removes: ref + (kind === "built-removal-valid" ? citation : "") }; }
    if (["legend-only", "undeclared-build", "erd"].includes(kind)) entries = {};
    if (kind === "unobserved") { before = "as-built"; entries = { realizes: ref }; }
    if (kind === "erd") name = "erd/fixture.drawio";
    const { base, drawing } = pair(before, after, { name, after: { legend: kind === "legend-only", metadata: { decision: "D2", intent: "plan:0001" } } });
    const subject = root(drawing).children.find(e => e.attrs.id === "subject");
    if (kind === "missing-cell-citation") { delete subject!.attrs.decision; delete subject!.attrs.intent; save(drawing); }
    if (kind === "invalid-cell-decision") { subject!.attrs.decision = "D999"; save(drawing); }
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
  group("worktree_path_filter", [null], () => { const { base } = pair(undefined, "intended"); const other = diagram(); element(other, "extra", "intended"); save(other, "other.drawio"); eq(delta(base, undefined, config, [file]).changes.map(e => e.reference), [ref]); });
  group("committed_diagrams_pass", [null], () => { const d = diagram(); element(d); save(d); commit(); equal(cli(checkTool, [], 0).out, "diagram-check: 1 files, 1 elements checked\n"); });
  group("archived_projection_and_metadata_rejection", [null], () => { const d = diagram(); root(d).children.push(xml("mxCell", { id: "legacy", vertex: "1", value: "legacy", parent: "as-built" })); save(d); eq(project(new Drawing(serialize(d))), ["as-built | legacy | legacy | "]); fails(d, 3, "legacy"); });
  group("realization_source_addition_only_is_mechanical", [false, true], existing => { const { base } = pair("intended", "as-built", { before: { metadata: existing ? { source: "tools" } : {} }, after: { metadata: { decision: "D2", intent: "plan:0001" } } }); eq(report(base).changes.map(e => e.kind), existing ? ["realizes", "changes"] : ["realizes"]); });
  group("validator_additional_boundaries", ["xml", "multiple-pages", "missing-layer", "missing-endpoint", "wide-page", "nested-offset"], kind => {
    const d = diagram(), { cell } = element(d); let number = 1;
    if (kind === "multiple-pages") d.children.push(xml("diagram"));
    if (kind === "missing-layer") { root(d).children.splice(3, 1); number = 2; }
    if (kind === "missing-endpoint") { element(d, "edge", "as-built", { edge: ["node", "absent"] }); number = 8; }
    if (kind === "wide-page") { d.children[0]!.children[0]!.attrs.pageWidth = "1601"; number = 10; }
    if (kind === "nested-offset") { element(d, "container", "as-built", { x: 1550 }); cell.attrs.parent = "container"; cell.children[0]!.attrs.x = "20"; number = 10; }
    save(d); if (kind === "xml") put(file, "<broken");
    const id = kind === "missing-endpoint" ? "edge" : kind === "nested-offset" ? "node" : undefined;
    ok(validate(file, config).failures.includes(`${file}: check ${number}: ${c.CHECK_REASONS[number]}${id === undefined ? "" : `: ${id}`}`));
  });
  group("validator_nested_container_and_source_line_reference", [null], () => { const d = diagram(); element(d, "container"); const { cell } = element(d, "child", "as-built", { parent: "container", x: 0, metadata: { source: `${c.DECISION_MAP}:L1` } }); cell.children[0]!.attrs.y = "0"; eq(validate(save(d), config), { failures: [], count: 2 }); });
  group("compare_comma_separators_and_folder_prefix", [null], () => { const d = diagram(); save(d, "topology/a.drawio"); save(d, "other.drawio"); const base = commit(); element(d, "first", "intended"); element(d, "second", "intended"); save(d, "topology/a.drawio"); eq(compare(report(base), plan({ adds: "topology/a.drawio#first,topology/a.drawio#second" }, "topology/,other.drawio"), config), []); });
  function hidden(kind: string) {
    const d = diagram(); element(d, "a", "as-built", { x: 100 }); element(d, "b", "as-built", { x: 200 }); element(d, "key", "as-built", { legend: kind !== "nonrow", rows: ["one"] });
    const { wrapper, cell } = element(d, "hidden", "as-built", { parent: "key", ...(kind === "nonrow" ? {} : { edge: ["a", "b"] as [string, string] }) });
    if (kind !== "wrapped") { root(d).children.pop(); cell.attrs.id = "hidden"; root(d).children.push(cell); }
    const failures = validate(save(d), config).failures; ok(failures.includes(`${file}: check 3: ${c.CHECK_REASONS[3]}: hidden`)); if (kind !== "nonrow") ok(failures.includes(`${file}: check 13: ${c.CHECK_REASONS[13]}: hidden`));
  }
  group("wrapped_edge_in_legend_table_is_rejected", [null], () => hidden("wrapped"));
  group("source_must_stay_inside_repository", [",", "/tmp", "../", "escape"], source => { if (source === "escape") symlinkSync(scratch, "escape"); const d = diagram(); element(d, "node", "as-built", { metadata: { source } }); fails(d, 4, "node"); });
  group("transition_preserves_nonmechanical_style_changes", [false, true], retirement => { const a = diagram(), first = element(a, "subject", retirement ? "as-built" : "intended", { metadata: { decision: "D2", intent: "plan:0001" } }); first.cell.attrs.style += retirement ? "" : "fillColor=#dae8fc;strokeColor=#6c8ebf;"; save(a); const base = commit(); const b = diagram(), last = element(b, "subject", retirement ? "retiring" : "as-built", { metadata: { decision: "D2", intent: "plan:0001" } }); last.cell.attrs.style += retirement ? "fontStyle=1;" : "fillColor=#ffe6cc;strokeColor=#d79b00;"; save(b); eq(report(base).changes.map(e => e.kind), [retirement ? "retires" : "realizes", "changes"]); ok(compare(report(base), plan({ [retirement ? "retires" : "realizes"]: ref }), config).some(f => f.startsWith(c.UNDECLARED))); });
  group("bare_style_token_change_is_semantic", [null], () => { const { base, drawing } = pair("intended", "intended"); root(drawing).children.at(-1)!.children[0]!.attrs.style += "ellipse;"; save(drawing); eq(report(base).changes.map(e => e.kind), ["changes"]); });
  group("malformed_list_line_cannot_be_ignored", [null], () => { const { base } = pair("as-built", "as-built"); eq(compare(report(base), plan() + "- builds broken\n", config), [c.MALFORMED]); });
  group("table_descendant_font_size_is_checked", ["tableRow", "partialRectangle"], shape => { const d = diagram(); element(d, "table", "as-built", { rows: ["value"] }); root(d).children.at(-1)!.attrs.style = `shape=${shape};fontSize=8;`; fails(d, 11, "table-row-0"); });
  group("frontmatter_sequences_without_site_packages", [false, true], inline => { eq(frontmatter(`---\nsources: [ignored]\ncomponents: ${inline ? "[apps/api, tools]" : "\n  - apps/api\n  - tools"}\n---\n`).components, ["apps/api", "tools"]); });
  group("each_bad_ticket_names_its_element", [null], () => { const d = diagram(); element(d, "first", "as-built", { metadata: { intent: "BAD-1" } }); element(d, "second", "as-built", { x: 100, metadata: { intent: "BAD-1" } }); eq(validate(save(d), config).failures, ["first", "second"].map(id => `${file}: check 6: ${c.CHECK_REASONS[6]}: ${id}`)); });
  group("malformed_snapshot_cli_has_no_traceback", [null], () => { const { base } = pair("as-built", "as-built"); put(file, "<broken"); const r = cli(deltaTool, ["delta", base, "--worktree"], 1); equal(r.err.trim().split("\n").length, 1); ok(!r.err.includes("Traceback")); });
  group("candidates_stdout_is_json_only", [null], () => { const { base } = pair(undefined, "intended"); put("plan.md", plan()); const r = cli(deltaTool, ["delta", base, "--worktree", "--candidates", "--plan", "plan.md"], 0); equal(JSON.parse(r.out).candidates[0].doc, file); ok(r.err.includes(`adds: ${ref}`)); });
  group("project_identifies_legend", [null], () => { const d = diagram(); element(d, "key", "as-built", { legend: true }); equal(project(new Drawing(serialize(d)))[0], "as-built | key | key |  | kind=legend"); });
  group("frontmatter_comment_handling", [["[apps/api/src] # comment", ["apps/api/src"]], ["\n  - apps/api # note", ["apps/api"]], ['["apps/api # quoted"] # note', ["apps/api # quoted"]], ["['apps/api # quoted'] # note", ["apps/api # quoted"]], ["[apps/api#fragment] # note", ["apps/api#fragment"]], ["# comment-only", []]], ([value, expected]) => eq(frontmatter(`---\nareas: ${value}\n---\n`).areas, expected));
  group("unwrapped_edge_in_legend_table_is_rejected", [null], () => hidden("unwrapped"));
  group("unwrapped_nonrow_vertex_in_table_is_rejected", [null], () => hidden("nonrow"));
  group("legend_row_endpoint_classification", [["a", false, false], ["key-row-0", false, false], ["key-row-0", true, true]], ([source, legend, passing]) => { const d = diagram(); element(d, "a", "as-built", { x: 100 }); element(d, "key", "as-built", { legend: true, rows: ["one", "two"] }); element(d, "e", "as-built", { legend, edge: [source, source === "a" ? "key-row-0" : "key-row-1"] }); const result = validate(save(d), config); if (passing) eq(result, { failures: [], count: 3 }); else ok(result.failures.includes(`${file}: check 13: ${c.CHECK_REASONS[13]}: e`)); });
  group("object_requires_exactly_one_inner_cell", [[0, false], [0, true], [2, false], [2, true]], ([cells, missing]) => { const d = diagram(); root(d).children.push(xml("object", missing ? {} : { id: "malformed" }, Array.from({ length: cells }, () => xml("mxCell", { parent: "as-built" })))); ok(validate(save(d), config).failures.includes(`${file}: check 3: ${c.MALFORMED_OBJECT}: ${missing ? "<no id>" : "malformed"}`)); });
  group("page_requires_exactly_one_graph_model", [null], () => { const d = diagram(); element(d); d.children[0]!.children.push(xml("mxGraphModel")); fails(d, 1); });
  console.log(`UPSTREAM MAPPING: ${groups} functions / ${count} cases (neutral archive/inventory; erd case rejects exemption)`);
  group("s6_cli_candidate_selection", ["baseline_inline", "quoted_comma"], variant => {
    mkdirSync("services/api", { recursive: true });
    put(c.CONFIG_PATH, JSON.stringify({ tracking: { mode: "none" }, diagrams: { mode: "drawio", root: config.root, components: ["services/api"] } }));
    const d = diagram(); element(d, "api", "as-built", { metadata: { component: "services/api", source: "services/api" } });
    const drawing = save(d, "probe.drawio"); commit();
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
  group("r1_attribute_roundtrip", [null], () => {
    const d = diagram(); element(d); save(d);
    put(file, readFileSync(file, "utf8").replace('label="node"', 'label="a&#10;b&#13;c&#9;d" literal="a\nb\rc\td"'));
    cli(checkTool, ["--normalize", file], 0);
    const output = readFileSync(file, "utf8");
    ok(output.includes('label="a&#10;b&#13;c&#9;d" literal="a b c d"'), output);
    const reader = Bun.spawnSync(["python3", "-c", "import json,sys,xml.etree.ElementTree as E; o=E.parse(sys.argv[1]).find('.//object'); print(json.dumps([o.get('label'),o.get('literal')]))", file], { stdout: "pipe", stderr: "pipe" });
    if (reader.error?.code === "ENOENT") equal(parseXml(output).children[0]!.children[0]!.children[0]!.children.at(-1)!.attrs.label, "a\nb\rc\td");
    else { equal(reader.exitCode, 0, reader.stderr.toString()); eq(JSON.parse(reader.stdout.toString()), ["a\nb\rc\td", "a b c d"]); }
  });
  group("r1_containment", ["validate", "project", "delta", "normalize", "home"], operation => {
    const d = diagram(); element(d); save(d); const base = commit(), outside = join(scratch, `outside-${count}`), bytes = serialize(d);
    mkdirSync(outside); put(join(outside, "escape.drawio"), bytes);
    if (operation === "home") { rmSync(config.root, { recursive: true }); symlinkSync(outside, config.root); }
    else { rmSync(file); symlinkSync(join(outside, "escape.drawio"), file); }
    const path = operation === "home" ? `${config.root}/escape.drawio` : file;
    if (operation === "validate" || operation === "home") eq(validate(path, config).failures, [`${path}: check 1: ${c.CHECK_REASONS[1]}`]);
    else if (operation === "project") cli(deltaTool, ["project", path], 1);
    else if (operation === "delta") cli(deltaTool, ["delta", base, "--worktree"], 1);
    else cli(checkTool, ["--normalize", path], 1);
    equal(readFileSync(join(outside, "escape.drawio"), "utf8"), bytes, "external file unchanged");
  });
  group("r1_expanded_page_limit", ["validate", "project", "delta", "normalize"], operation => {
    const d = diagram(); save(d); const base = commit(), page = d.children[0]!;
    page.children = []; page.text = deflateRawSync(Buffer.from(`<mxGraphModel><root>${" ".repeat(c.MAX_EXPANDED_PAGE_BYTES)}</root></mxGraphModel>`)).toString("base64"); d.attrs.compressed = "true"; save(d);
    if (operation === "validate") eq(validate(file, config).failures, [`${file}: check 1: ${c.CHECK_REASONS[1]}`]);
    else if (operation === "project") cli(deltaTool, ["project", file], 1);
    else if (operation === "delta") cli(deltaTool, ["delta", base, "--worktree"], 1);
    else cli(checkTool, ["--normalize", file], 1);
  });
  group("r1_git_paths", ["revision-root", "worktree-root", "revision-file", "worktree-file"], variant => {
    const settings = { ...config, root: variant.endsWith("root") ? "vîews" : config.root }, path = `${settings.root}/${variant.endsWith("file") ? "système" : "fixture"}.drawio`;
    const d = diagram(); element(d, "subject", "intended"); put(path, serialize(d)); const base = commit();
    root(d).children.at(-1)!.attrs.label = "changed"; put(path, serialize(d));
    const head = variant.startsWith("revision") ? commit() : undefined;
    eq(delta(base, head, settings).changes.map(change => [change.kind, change.reference]), [["changes", `${path.slice(settings.root.length + 1)}#subject`]]);
  });
  group("r1_xml_strictness", ["&AMP;", "&missing;", "&#0;", "&#x1F;", "\u0001", "\uFFFE"], value => {
    const d = diagram(); element(d); save(d); put(file, readFileSync(file, "utf8").replace('label="node"', `label="${value}"`));
    eq(validate(file, config).failures, [`${file}: check 1: ${c.CHECK_REASONS[1]}`]);
    const result = cli(deltaTool, ["project", file], 1); equal(result.err.trim().split("\n").length, 1);
  });
  group("r1_diagnostic_order", [null], () => {
    const d = diagram(); for (const id of ["first", "second"]) element(d, id, "intended", { metadata: { decision: "D999", intent: "invalid" } });
    const failures = validate(save(d), config).failures.filter(line => /check [56]:/.test(line));
    eq(failures, [5, 6].flatMap(number => ["first", "second"].map(id => `${file}: check ${number}: ${c.CHECK_REASONS[number]}: ${id}`)));
  });
  group("r1_nonfinite_geometry", ["NaN", "Infinity"], value => {
    const d = diagram(); element(d).cell.children[0]!.attrs.x = value;
    eq(validate(save(d), config).failures, [9, 10].map(number => `${file}: check ${number}: ${c.CHECK_REASONS[number]}`));
  });
  group("r1_cli_exit_codes", [null], () => {
    const { base } = pair("as-built", "intended"); put("plan.md", plan());
    cli(deltaTool, ["delta", base, "--worktree"], 1); cli(deltaTool, ["compare", "plan.md", base, "--worktree"], 1);
    const d = diagram(); element(d, "subject", "as-built"); save(d);
    cli(deltaTool, ["compare", "plan.md", base, "--worktree"], 0);
  });
  group("r2_xml_wellformedness", ["comment", "comment-end", "text", "element-name", "attribute-name"], variant => {
    const d = diagram(); element(d); const valid = serialize(d);
    const invalid = variant === "comment" ? valid.replace("<diagram", "<!-- a--b --><diagram")
      : variant === "comment-end" ? valid.replace("<diagram", "<!-- a---><diagram")
      : variant === "text" ? valid.replace("<root>", "<root>bad]]>")
      : variant === "element-name" ? valid.replace("<root>", "<root><1invalid/>")
      : valid.replace('<mxfile compressed', '<mxfile 1invalid="x" compressed');
    put(file, invalid);
    eq(validate(file, config).failures, [`${file}: check 1: ${c.CHECK_REASONS[1]}`]);
    cli(checkTool, ["--normalize", file], 1); equal(readFileSync(file, "utf8"), invalid);
  });
  group("r2_xml_valid_tokens", [null], () => {
    const d = diagram(); element(d);
    put(file, serialize(d).replace("<mxfile", '<!-- valid - comment --><mxfile rôle="a"'));
    eq(validate(file, config).failures, []); cli(checkTool, ["--normalize", file], 0);
    equal(parseXml(readFileSync(file, "utf8")).attrs.rôle, "a");
  });
  group("r2_runtime_reserved_root", ["normalize", "validate", "project", "delta"], command => {
    const d = diagram(); element(d, "subject", "intended"); const path = "tools/probe.drawio", bytes = serialize(d); put(path, bytes);
    put(c.CONFIG_PATH, JSON.stringify({ tracking: { mode: "none" }, diagrams: { mode: "drawio", root: "tools", components: config.components } })); commit();
    if (command === "normalize") cli(checkTool, ["--normalize", path], 1);
    else if (command === "validate") cli(checkTool, [path], 1);
    else if (command === "project") cli(deltaTool, ["project", path], 1);
    else cli(deltaTool, ["delta", "HEAD", "--worktree"], 1);
    equal(readFileSync(path, "utf8"), bytes);
  });
  group("r2_supported_roots", [".git/diagrams", "nested/.git/diagrams", "docs/tracker/diagrams", "docs/standards/diagrams", ".GIT/diagrams", "DOCS/Architecture"], home => {
    const d = diagram(); element(d, "subject", "intended"); const path = `${home}/probe.drawio`, bytes = serialize(d); put(path, bytes);
    put(c.CONFIG_PATH, JSON.stringify({ tracking: { mode: "none" }, diagrams: { mode: "drawio", root: home, components: config.components } }));
    cli(checkTool, ["--normalize", path], 1); equal(readFileSync(path, "utf8"), bytes);
  });
  // Additional kit-only behavior: no-tracker and tracker intent syntax, and bundle omission.
  group("kit_intent_modes", ["none", "local", "mcp"], mode => { const d = diagram(); element(d, "wanted", "intended", { metadata: { intent: mode === "none" ? "plan:0001" : "tracker://ENG-1" } }); const settings: Settings = { ...config, tracking: mode }; eq(validate(save(d), settings).failures, []); const baseDrawing = diagram(); save(baseDrawing); const base = commit(); save(d); eq(compare(delta(base, undefined, settings), plan({ adds: "fixture.drawio#wanted" }), settings), []); root(d).children.at(-1)!.attrs.intent = mode === "none" ? "tracker://ENG-1" : "plan:0001"; ok(validate(save(d), settings).failures.includes(`${file}: check 6: ${c.CHECK_REASONS[6]}: wanted`)); });
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
