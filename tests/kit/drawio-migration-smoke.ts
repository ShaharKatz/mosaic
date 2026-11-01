#!/usr/bin/env bun
// Source-side converter smoke: old draw.io fixtures (builders from e2b4125 tests/kit/diagram-smoke.ts) in a
// sandbox installed with the current kit, converted by install/drawio-to-mermaid.ts and checked by the new tools.
import { deepStrictEqual as eq, ok, strictEqual as equal } from "node:assert";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { deflateRawSync } from "node:zlib";
import * as c from "../../kit/tools/constants/diagrams.ts";
import { install } from "../../kit/install.ts";
import { Diagram } from "../../kit/tools/diagram-check.ts";
const scratch = mkdtempSync(join(tmpdir(), "mosaic-drawio-migration-"));
const converter = resolve(import.meta.dir, "../../install/drawio-to-mermaid.ts");
const root = c.DIAGRAMS_ROOT, fixture = `${root}/fixture.drawio`, output = `${root}/fixture.mmd`;
let count = 0, sandbox = "";

// ---- Old-format builders (copied from e2b4125) ----
type Xml = { tag: string; attrs: Record<string, string>; children: Xml[]; text: string };
const LAYERS = ["as-built", "intended", "retiring"] as const;
const LAYER_STYLES: Record<string, Record<string, string>> = {
  "as-built": {}, intended: { opacity: "45", fontStyle: "2" },
  retiring: { opacity: "45", fillColor: "#f5f5f5", strokeColor: "#666666" },
};
const escape = (value: string) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
function serialize(node: Xml, indent = ""): string {
  const start = `${indent}<${node.tag}${Object.entries(node.attrs).map(([key, value]) => ` ${key}="${escape(value).replace(/\n/g, "&#10;").replace(/\r/g, "&#13;").replace(/\t/g, "&#9;")}"`).join("")}`;
  if (!node.children.length && !node.text.trim()) return start + "/>";
  if (!node.children.length) return `${start}>${escape(node.text)}</${node.tag}>`;
  return `${start}>\n${node.children.map(child => serialize(child, indent + "  ")).join("\n")}\n${indent}</${node.tag}>`;
}
function xml(tag: string, attrs: Record<string, string> = {}, children: Xml[] = []): Xml { return { tag, attrs, children, text: "" }; }
function diagram() {
  return xml("mxfile", { compressed: "false" }, [xml("diagram", {}, [xml("mxGraphModel", { pageWidth: "1600", pageHeight: "1600" }, [xml("root", {}, [xml("mxCell", { id: "0" }), ...LAYERS.map(id => xml("mxCell", { id, parent: "0" }))])])])]);
}
function rootOf(d: Xml) { return d.children[0]!.children[0]!.children[0]!; }
type Options = { parent?: string; legend?: boolean; edge?: [string, string]; rows?: string[]; metadata?: Record<string, string>; style?: string };
function element(d: Xml, id: string, layer = "as-built", opts: Options = {}) {
  const metadata: Record<string, string> = { id, label: id, component: "platform" };
  if (["as-built", "retiring"].includes(layer)) metadata.source = "AGENTS.md";
  if (["intended", "retiring"].includes(layer)) Object.assign(metadata, { decision: "D2", intent: "plan:0001" });
  if (opts.legend) { delete metadata.component; delete metadata.source; delete metadata.decision; delete metadata.intent; metadata.kind = "legend"; }
  Object.assign(metadata, opts.metadata);
  const style = Object.entries(LAYER_STYLES[layer]!).map(([k, v]) => `${k}=${v};`).join("") + (opts.rows ? "shape=table;" : "") + (opts.style ?? "");
  const cell = xml("mxCell", { parent: opts.parent ?? layer, style, ...(opts.edge ? { edge: "1", source: opts.edge[0], target: opts.edge[1] } : { vertex: "1" }) }, [xml("mxGeometry", { x: "10", y: "10", width: "50", height: "50" })]);
  rootOf(d).children.push(xml("object", metadata, [cell]));
  for (const [i, text] of (opts.rows ?? []).entries()) rootOf(d).children.push(xml("mxCell", { id: `${id}-row-${i}`, parent: id, value: text, vertex: "1", style: "shape=tableRow;" }));
}
function compress(d: Xml): Xml {
  const page = d.children[0]!, model = page.children[0]!;
  return { ...d, children: [{ ...page, children: [], text: deflateRawSync(Buffer.from(encodeURIComponent(serialize(model)))).toString("base64") }] };
}
// ---- Sandbox ----
function put(path: string, text: string) { mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, text); }
function save(d: Xml, path = fixture) { put(path, serialize(d)); return path; }
function run(args: string[], code: number, tool = converter) {
  const r = Bun.spawnSync([process.execPath, tool, ...args], { cwd: sandbox, stdout: "pipe", stderr: "pipe" });
  const out = r.stdout.toString(), err = r.stderr.toString();
  equal(r.exitCode, code, `${args.join(" ")}\n${out}\n${err}`); return { out, err };
}
const read = (path: string) => readFileSync(join(sandbox, path), "utf8");
const exists = (path: string) => existsSync(join(sandbox, path));
function test(name: string, body: () => void) {
  sandbox = join(scratch, `case-${count++}`); cpSync(join(scratch, "template"), sandbox, { recursive: true });
  const cwd = process.cwd(); process.chdir(sandbox);
  try { body(); } catch (error) { throw new Error(`${name}: ${(error as Error).stack}`); } finally { process.chdir(cwd); }
  console.log(`PASS ${name}`);
}
function full(): Xml {
  const d = diagram(), service = "rounded=1;fillColor=#dae8fc;strokeColor=#6c8ebf;";
  element(d, "api", "as-built", { style: service, metadata: { label: 'Orders "API"\nv2', owner: "team-a" } });
  element(d, "db", "as-built", { style: "shape=cylinder3;fillColor=#ffe6cc;strokeColor=#d79b00;" });
  element(d, "stripe", "as-built", { style: "fillColor=#d5e8d4;strokeColor=#82b366;" });
  element(d, "search", "intended", { style: "rounded=1;fillColor=#e1d5e7;strokeColor=#9673a6;" });
  element(d, "old", "retiring", { style: "rounded=1;" });
  element(d, "lane", "as-built", { style: "fillColor=#fff2cc;strokeColor=#d6b656;", metadata: { label: "Messaging lane" } });
  element(d, "queue", "as-built", { parent: "lane", style: "shape=cylinder3;" });
  element(d, "worker", "as-built", { parent: "lane", style: "rounded=1;" });
  element(d, "key", "as-built", { legend: true, style: "fillColor=#f5f5f5;strokeColor=#666666;", metadata: { label: "Legend" } });
  element(d, "key-item", "as-built", { legend: true, parent: "key", metadata: { label: "Service" } });
  element(d, "key-table", "as-built", { legend: true, parent: "key", rows: ["solid | sync", "dashed | async"], metadata: { label: "Edges" } });
  element(d, "api-db", "as-built", { edge: ["api", "db"], metadata: { label: "Prisma" } });
  element(d, "api-queue", "as-built", { edge: ["api", "queue"], style: "dashed=1;", metadata: { label: "publish" } });
  element(d, "worker-api", "as-built", { edge: ["worker", "api"], style: "dashed=1;dashPattern=1 4;", metadata: { label: "" } });
  element(d, "api-search", "intended", { edge: ["api", "search"] });
  element(d, "api-old", "retiring", { edge: ["api", "old"] });
  return d;
}
try {
  const manifest = join(scratch, "manifest.json"), template = join(scratch, "template");
  writeFileSync(manifest, JSON.stringify({ project: { name: "Example", summary: "An example project." }, topology: "monorepo", git: { defaultBranch: "main" }, members: [], components: [], remotes: { link: "https://example.invalid/project.git" }, diagrams: { mode: "mermaid" } }));
  await install({ manifest, target: template, kitCommit: "smoke" });
  writeFileSync(join(template, c.DECISION_MAP), readFileSync(join(template, c.DECISION_MAP), "utf8") + "\n| D2 | current |\n");
  Bun.spawnSync(["git", "init", "-q"], { cwd: template });

  test("full_mapping", () => {
    save(full());
    const { out } = run(["--root", root], 0);
    ok(out.includes(`converted: ${fixture} → ${output}`) && out.includes("diagram-check: 1 converted files clean"), out);
    ok(!exists(fixture)); const text = read(output);
    for (const line of [
      "flowchart LR",
      '  api@{ shape: rounded, label: "Orders #quot;API#quot;<br/>v2", component: "platform", source: "AGENTS.md", owner: "team-a" }',
      '  db@{ shape: cyl, label: "db", component: "platform", source: "AGENTS.md" }',
      '  stripe@{ shape: rect, label: "stripe", component: "platform", source: "AGENTS.md" }',
      '  subgraph lane["Messaging lane"]', '    queue@{ shape: cyl, label: "queue", component: "platform", source: "AGENTS.md" }',
      '  end', '  lane@{ component: "platform", source: "AGENTS.md" }',
      '    key-table@{ shape: rect, label: "Edges<br/>solid | sync<br/>dashed | async", kind: "legend", table: "true" }',
      '  key@{ kind: "legend" }',
      '  api api-db@-->|"Prisma"| db', '  worker worker-api@--> api', '  api-search@{ component: "platform", decision: "D2", intent: "plan:0001" }',
      "  class api service", "  class search agent", "  class db store", "  class lane messaging", "  class stripe external", "  class key legend",
      "  class api-queue async", "  class worker-api observe", "  class search,api-search intended", "  class old,api-old retiring",
    ]) ok(text.split("\n").includes(line), `missing ${line}\n${text}`);
    ok(text.endsWith(c.CLASS_DEFS.map(line => `  ${line}`).join("\n") + "\n"));
    run([], 0, join(sandbox, "tools/diagram-check.ts"));
    equal(run(["project", output], 0, join(sandbox, "tools/diagram-delta.ts")).out.includes("  row | dashed | async"), true);
  });
  test("compressed_page", () => {
    const d = diagram(); element(d, "api", "as-built", { metadata: { label: "Compressed" } }); save(compress(d));
    run(["--root", root], 0); ok(read(output).includes('api@{ shape: rect, label: "Compressed"'));
  });
  test("entity_text_in_labels", () => {
    const d = diagram(); element(d, "lane", "as-built", { metadata: { label: "Lane #quot;x#quot;" } });
    element(d, "step", "as-built", { parent: "lane", metadata: { label: "Step #12; done" } }); element(d, "next");
    element(d, "retry", "as-built", { edge: ["step", "next"], metadata: { label: "retry #3; then fail" } }); save(d);
    run(["--root", root], 0); const parsed = new Diagram(read(output));
    eq(["lane", "step", "retry"].map(id => parsed.byId.get(id)!.label), ["Lane #quot;x#quot;", "Step #12; done", "retry #3; then fail"]);
  });
  test("keyword_id_aborts", () => {
    const d = diagram(); element(d, "end", "as-built"); save(d); const other = diagram(); element(other, "api"); element(other, "graph-db"); save(other, `${root}/other.drawio`);
    const { err } = run(["--root", root], 1);
    ok(err.includes(`${fixture}#end`) && err.includes(`${root}/other.drawio#graph-db`) && err.includes("nothing written"), err);
    ok(exists(fixture) && exists(`${root}/other.drawio`) && !exists(output) && !exists(`${root}/other.mmd`));
  });
  test("generated_erd_deleted", () => {
    const erd = diagram(); erd.attrs.generator = "mosaic-prisma-erd"; element(erd, "model-x"); save(erd, `${root}/erd/schema.erd.drawio`);
    const d = diagram(); element(d, "api"); save(d);
    const { out } = run(["--root", root], 0);
    ok(out.includes(`deleted generated ERD: ${root}/erd/schema.erd.drawio`), out);
    ok(!exists(`${root}/erd/schema.erd.drawio`) && !exists(`${root}/erd/schema.erd.mmd`) && exists(output));
  });
  test("gate_mismatch_writes_nothing", () => {
    const d = diagram(); element(d, "api"); element(d, "loose", "as-built", { parent: "0" }); save(d);
    const { err } = run(["--root", root], 1);
    ok(err.includes("equivalence gate failed") && err.includes("- | loose | loose | platform") && err.includes("+as-built | loose | loose | platform"), err);
    ok(exists(fixture) && !exists(output));
  });
  test("keep_sources", () => {
    save(full()); run(["--root", root, "--keep"], 0); ok(exists(fixture) && exists(output));
  });
  test("plans_rewritten", () => {
    save(full());
    const plan = (prefix: string) => `---\nareas: [diagram:${root}/fixture.drawio#api, apps/api]\n---\n# Plan\nBody cites ${prefix}fixture.drawio#api.\n${c.ARCHITECTURE_HEADING}\n- adds: ${root}/fixture.drawio#search (D2, plan:0001)\n- diagrams: ${root}/fixture.drawio\n## Next\nSee ${root}/fixture.drawio#api.\n`;
    put("docs/plans/0001-active.md", plan("")); put("docs/plans/archived/0000-old.md", plan(""));
    // Block-list areas at column 0 and CRLF line endings are rewritten too.
    const crlf = (ext: string) => `---\r\nareas:\r\n- diagram:${root}/fixture${ext}#api\r\n- apps/api\r\n---\r\n# Plan\r\n`;
    put("docs/plans/0002-crlf.md", crlf(".drawio"));
    const { out } = run(["--root", root, "--plans", "docs/plans"], 0);
    ok(out.includes("rewrote plan references: docs/plans/0001-active.md") && !out.includes("0000-old"), out);
    const text = read("docs/plans/0001-active.md");
    ok(text.includes(`areas: [diagram:${root}/fixture.mmd#api, apps/api]`) && text.includes(`- adds: ${root}/fixture.mmd#search`) && text.includes(`- diagrams: ${root}/fixture.mmd\n`), text);
    ok(text.includes("Body cites fixture.drawio#api.") && text.includes(`See ${root}/fixture.drawio#api.`), text);
    equal(read("docs/plans/archived/0000-old.md"), plan(""));
    equal(read("docs/plans/0002-crlf.md"), crlf(".mmd"));
  });
  test("live_docs_repoint_only_migrated_destinations", () => {
    const d = diagram(); element(d, "api"); save(d);
    const erd = diagram(); erd.attrs.generator = "mosaic-prisma-erd";
    save(erd, `${root}/erd/schema.erd.drawio`);
    put("docs/archived/fixture.drawio", serialize(d));
    const doc = "docs/architecture/nested/overview.md";
    const before = [
      "[system](../diagrams/fixture.drawio)",
      "![detail](../diagrams/./fixture.drawio#api)",
      `Repo path: \`${fixture}\`.`,
      "[schema](../diagrams/erd/schema.erd.drawio)",
      "[history](../../archived/fixture.drawio)",
      "[unconverted](../diagrams/absent.drawio)",
      "[remote](https://example.invalid/diagrams/fixture.drawio)",
    ].join("\n");
    const after = before.replace("../diagrams/fixture.drawio)", "../diagrams/fixture.mmd)")
      .replace("../diagrams/./fixture.drawio#api", "../diagrams/./fixture.mmd#api")
      .replace(`\`${fixture}\``, `\`${output}\``)
      .replace("schema.erd.drawio)", "schema.erd.mmd)");
    put(doc, before);
    const frozen = [
      "docs/architecture/nested/archived/overview.md",
      "docs/plans/evidence/overview.md",
      "docs/architecture/source/overview.md",
      "docs/architecture/gaps-archive.md",
      "docs/architecture/decisions-archive.md",
    ];
    for (const file of frozen) put(file, `Frozen: \`${fixture}\`.`);
    const { out } = run(["--root", root, "--plans", "docs/plans", "--docs", "docs"], 0);
    equal(read(doc), after);
    ok(out.includes(`rewrote doc references: ${doc}`), out);
    for (const file of frozen) equal(read(file), `Frozen: \`${fixture}\`.`);
    equal(read("docs/archived/fixture.drawio"), serialize(d));
  });
  test("evidence_frozen_without_plans_option", () => {
    const d = diagram(); element(d, "api"); save(d);
    const text = `Evidence: \`${fixture}\`.`;
    put("docs/plans/evidence/0001/x.md", text);
    run(["--root", root, "--docs", "docs"], 0);
    equal(read("docs/plans/evidence/0001/x.md"), text);
  });
  test("external_docs_alias_rejected_without_writes", () => {
    const d = diagram(); element(d, "api"); save(d);
    const external = join(scratch, "outside-docs"), text = `Outside: \`${fixture}\`.`;
    put(join(external, "overview.md"), text);
    symlinkSync(external, "docs-alias");
    run(["--root", root, "--docs", "docs-alias"], 1);
    equal(readFileSync(join(external, "overview.md"), "utf8"), text);
    ok(exists(fixture) && !exists(output));
  });
  test("internal_docs_alias_keeps_frozen_source", () => {
    const d = diagram(); element(d, "api"); save(d);
    const text = `Frozen: \`${fixture}\`.`;
    put("docs/architecture/source/overview.md", text);
    symlinkSync("docs/architecture/source", "history-alias");
    run(["--root", root, "--docs", "history-alias"], 0);
    equal(read("docs/architecture/source/overview.md"), text);
  });
  test("root_relative_destination", () => {
    const d = diagram(); element(d, "api"); save(d);
    put("docs/architecture/overview.md", `[system](/${fixture}?q=1#api "System title")`);
    run(["--root", root, "--docs", "docs"], 0);
    equal(read("docs/architecture/overview.md"), `[system](/${output}?q=1#api "System title")`);
  });
  test("encoded_destination_suffix", () => {
    const erd = diagram(); erd.attrs.generator = "mosaic-prisma-erd";
    save(erd, `${root}/schema.erd.drawio`);
    put("docs/architecture/overview.md", '[encoded](diagrams/schema.erd%2Edrawio?q=1#model "Schema title")');
    run(["--root", root, "--docs", "docs"], 0);
    equal(read("docs/architecture/overview.md"), '[encoded](diagrams/schema.erd%2Emmd?q=1#model "Schema title")');
  });
  test("angle_destination_with_spaces", () => {
    const erd = diagram(); erd.attrs.generator = "mosaic-prisma-erd";
    save(erd, `${root}/schema space.erd.drawio`);
    put("docs/architecture/overview.md", '[spaced](<diagrams/schema space.erd.drawio?q=1#model> "Schema title")');
    run(["--root", root, "--docs", "docs"], 0);
    equal(read("docs/architecture/overview.md"), '[spaced](<diagrams/schema space.erd.mmd?q=1#model> "Schema title")');
  });
  test("custom_plans_alias_keeps_evidence_frozen", () => {
    const d = diagram(); element(d, "api"); save(d);
    const text = `Evidence: \`${fixture}\`.`;
    put("docs/planning/evidence/review.md", text);
    symlinkSync("docs/planning", "planning-alias");
    run(["--root", root, "--docs", "planning-alias", "--plans", "planning-alias"], 0);
    equal(read("docs/planning/evidence/review.md"), text);
  });
  test("parenthesized_link_title", () => {
    const erd = diagram(); erd.attrs.generator = "mosaic-prisma-erd";
    save(erd, `${root}/schema.erd.drawio`);
    put("docs/architecture/overview.md", "[title](diagrams/schema.erd.drawio (Title))");
    run(["--root", root, "--docs", "docs"], 0);
    equal(read("docs/architecture/overview.md"), "[title](diagrams/schema.erd.mmd (Title))");
  });
  test("balanced_parentheses_destination", () => {
    const erd = diagram(); erd.attrs.generator = "mosaic-prisma-erd";
    save(erd, `${root}/schema(v2).erd.drawio`);
    const before = [
      "[balanced](diagrams/schema(v2).erd.drawio)",
      "[escaped](diagrams/schema\\(v2\\).erd.drawio#model 'Schema title')",
      "[title](diagrams/schema(v2).erd.drawio (Title \\(v2\\)))",
      "[reference]: diagrams/schema(v2).erd.drawio",
      "[malformed](diagrams/schema(v2).erd.drawio (unterminated)",
    ];
    put("docs/architecture/overview.md", before.join("\n"));
    run(["--root", root, "--docs", "docs"], 0);
    equal(read("docs/architecture/overview.md"), before.map((line, index) => index < 4 ? line.replace(".drawio", ".mmd") : line).join("\n"));
  });
  test("docs_unchanged_without_option", () => {
    const d = diagram(); element(d, "api"); save(d);
    const text = `[system](diagrams/fixture.drawio#api)\n\`${fixture}\`\n`;
    put("docs/architecture/overview.md", text);
    run(["--root", root], 0);
    equal(read("docs/architecture/overview.md"), text);
  });
  test("docs_unchanged_on_exit_1", () => {
    const d = diagram(); element(d, "end"); save(d);
    const text = `[system](diagrams/fixture.drawio)\n\`${fixture}\`\n`;
    put("docs/architecture/overview.md", text);
    run(["--root", root, "--docs", "docs/architecture"], 1);
    equal(read("docs/architecture/overview.md"), text);
    ok(exists(fixture) && !exists(output));
  });
  test("findings_exit_2", () => {
    const d = diagram(); element(d, "api", "as-built", { metadata: { source: "missing/file.ts" } }); save(d);
    const { out } = run(["--root", root], 2);
    ok(out.includes(`${output}: check 4: ${c.CHECK_REASONS[4]}`), out); ok(exists(output) && !exists(fixture));
  });
  console.log(`drawio-migration-smoke: PASS — ${count} cases`);
} finally { rmSync(scratch, { recursive: true, force: true }); }
