#!/usr/bin/env bun
// Origin mapping (9 functions / 29 cases), all neutral inputs, no source project's data:
// test_parser_preserves_database_semantics (1) → semantics
// test_block_attributes_mark_named_and_positional_fields (4) → composite-0..3
// test_real_schema_counts (13 project-file parameters) → counts-0..12; replace private
// corpus with 13 independent neutral grammar fixtures, not hard-coded repository counts.
// test_generation_is_deterministic_and_has_contract_metadata (1) → metadata
// test_committed_erds_match_generator (1) → installed-sync (disposable instead of kit data)
// test_check_names_each_drift (5) → drift-alter/extra/notes/orphan/missing
// test_file_selection_only_writes_selected_schema (2) → selection-root/suffix
// test_case_distinct_names_keep_unique_ids_and_endpoints (1) → case-distinct
// test_orphan_with_dangling_reference_names_undefined_model (1) → undefined-no-writes
import { deepStrictEqual, ok, strictEqual, throws } from "node:assert";
import { existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { install } from "../../kit/install.ts";
import { columnRows, findAttribute, mappedName, parseSchema, renderSchema } from "../../kit/tools/erd-generate.ts";
import { Drawing } from "../../kit/tools/diagram-check.ts";
import { DIAGRAMS_ROOT, DRAWIO_MOUNT } from "../../kit/tools/constants/diagrams.ts";
import { GENERATED, SUFFIX } from "../../kit/tools/constants/erd.ts";
import type { Erd } from "../../kit/tools/constants/erd.ts";
const scratch = mkdtempSync(join(tmpdir(), "mosaic-erd-")), bun = process.execPath;
const erd: Erd = { adapter: "prisma", schemaGlobs: ["schema/**/*.prisma"], output: `${DIAGRAMS_ROOT}/erd`, component: "platform", label: "Schema" };
const fixture = `model Owner {
 first String @map("first_id")
 second Int
 native Decimal? @db.Decimal(14, 6)
 opaque Unsupported("vector(3)")?
 generated String @default(dbgenerated("concat('a,//', 'b')"))
 // ignored comment
 remote Other @relation(
   fields: [first, second], references: [a, b], onDelete: Cascade
 )
 @@id([first, second])
 @@unique([second, first], map: "owner_unique")
 @@index(
   [first(sort: Desc), second],
   type: BTree, map: "owner_index"
 )
 @@map("owner_table")
}
enum Status {
 live
 mapped @map("wire-value")
 @@map("status_type")
}
`;
const other = `model Other {
 a String
 b Int
 @@id([a, b])
}
`;
let cases = 0;
function pass(name: string): void { cases++; console.log(`PASS ${name}`); }
function put(root: string, file: string, content: string): void { mkdirSync(dirname(join(root, file)), { recursive: true }); writeFileSync(join(root, file), content); }
function command(root: string, args: string[], code: number): string {
 const result = Bun.spawnSync(args, { cwd: root, stdout: "pipe", stderr: "pipe", env: { ...process.env, GIT_CONFIG_NOSYSTEM: "1", GIT_CONFIG_GLOBAL: "/dev/null" } });
 strictEqual(result.exitCode, code, `${args.join(" ")}\n${result.stdout}\n${result.stderr}`); return result.stdout.toString() + result.stderr.toString();
}
const cli = (root: string, code = 0, ...args: string[]) => command(root, [bun, "tools/erd-generate.ts", ...args], code);
function snapshot(root: string): Record<string, string> {
 const result: Record<string, string> = {};
 function visit(directory: string): void {
  for (const name of readdirSync(join(root, directory)).sort()) {
   const file = directory ? `${directory}/${name}` : name, stat = lstatSync(join(root, file));
   if (stat.isDirectory()) visit(file); else result[file] = `${stat.mtimeMs}:${stat.mode}:${readFileSync(join(root, file)).toString("base64")}`;
  }
 }
 visit(""); return result;
}
async function installed(name: string): Promise<string> {
 const root = join(scratch, name), manifest = join(scratch, "manifest.json");
 writeFileSync(manifest, JSON.stringify({ project: { name: "Example", summary: "An example project." }, topology: "monorepo", git: { defaultBranch: "main" }, members: [], components: [], remotes: { link: "https://example.invalid/project.git" }, diagrams: { mode: "drawio", erd } }));
 await install({ manifest, target: root, kitCommit: "smoke" });
 put(root, ".mcp.json", JSON.stringify({ mcpServers: { drawio: DRAWIO_MOUNT } }));
 put(root, "schema/models/owner.prisma", fixture); put(root, "schema/models/other.prisma", other);
 return root;
}
try {
 const schema = parseSchema(fixture, "schema/models/owner.prisma"), model = schema.models[0]!, fields = Object.fromEntries(model.fields.map(f => [f.name, f]));
 strictEqual(mappedName(model.name, model.attributes), "owner_table");
 deepStrictEqual(findAttribute(model.attributes, "index")!.arguments, ["[first(sort: Desc), second]", "type: BTree", 'map: "owner_index"']);
 strictEqual(fields.native!.type, "Decimal? @db.Decimal(14, 6)"); strictEqual(fields.opaque!.type, 'Unsupported("vector(3)")?');
 deepStrictEqual(findAttribute(fields.generated!.attributes, "default")!.arguments, [`dbgenerated("concat('a,//', 'b')")`]);
 deepStrictEqual(fields.remote!.relation, { target: "Other", fields: ["first", "second"], references: ["a", "b"], onDelete: "Cascade" });
 const rows = columnRows(model, new Set(["Owner", "Other"]));
 ok(rows.includes("first_id : String PK FK U IDX")); ok(rows.includes("second : Int PK FK U IDX")); ok(!rows.some(row => row.startsWith("remote")));
 strictEqual(mappedName(schema.enums[0]!.name, schema.enums[0]!.attributes), "status_type");
 deepStrictEqual(schema.enums[0]!.values.map(v => mappedName(v.name, v.attributes)), ["live", "wire-value"]);
 const schemas = [schema, parseSchema(other, "schema/models/other.prisma")], drawing = new Drawing(renderSchema(schema, schemas, erd));
 strictEqual(drawing.byId.get("model-other")!.metadata.attrs.source, "schema/models/other.prisma");
 strictEqual(drawing.byId.get("model-other")!.metadata.attrs.label, "Other (other.prisma)");
 strictEqual(drawing.byId.get("edge-owner-remote")!.metadata.attrs.label, "first, second → a, b onDelete: Cascade");
 strictEqual(drawing.byId.get("edge-owner-remote")!.cell.attrs.target, "model-other"); pass("semantics");
 for (const [index, [attribute, a, b]] of [
  ['@@id(name: "pk", fields: [a])', " PK", ""], ['@@unique(fields: [a, b], name: "pair")', " U", " U"], ["@@index(fields: [a, b])", " IDX", " IDX"], ['@@unique([a, b], name: "pair")', " U", " U"],
 ].entries()) {
  const parsed = parseSchema(`model Pair {\n a String\n b Int\n c String\n ${attribute}\n}`, "pair.prisma");
  deepStrictEqual(columnRows(parsed.models[0]!, new Set(["Pair"])), [`a : String${a}`, `b : Int${b}`, "c : String"]); pass(`composite-${index}`);
 }
 const countInputs = [
  "model Item {\n id Int @id\n}", "enum State {\n on\n off\n}", "// model Fake {\nmodel Item {\n id Int\n}",
  "/* enum Fake {} */\nenum State {\n on\n}", 'model Item {\n url String @default("https://example.invalid/a//b")\n}',
  'model Item {\n value String @default("/* not a comment */")\n}', fixture, fixture + other,
  'model Item {\n point Unsupported("point")?\n}', "model Item {\n amount Decimal @db.Decimal(12, 4)\n}",
  "model Item {\n a String\n @@index(\n [a]\n )\n}", "enum State {\n on @map(\"enabled\")\n}", "model Item {\n id Int\n}\nmodel Note {\n id Int\n}\nenum State {\n on\n}",
 ];
 for (const [index, text] of countInputs.entries()) {
  const parsed = parseSchema(text, `counts-${index}.prisma`);
  const expected = index === 1 || index === 3 || index === 11 ? [0, 1] : index === 6 ? [1, 1] : index === 7 || index === 12 ? [2, 1] : [1, 0];
  deepStrictEqual([parsed.models.length, parsed.enums.length], expected); pass(`counts-${index}`);
 }
 for (const input of schemas) {
  const first = renderSchema(input, schemas, erd); strictEqual(first, renderSchema(input, schemas, erd));
  const d = new Drawing(first); strictEqual(d.xml.attrs.compressed, "false"); strictEqual(d.xml.attrs.generator, GENERATED);
  deepStrictEqual(d.cells.filter(e => e.cell.attrs.parent === "0").map(e => e.id), ["1", "as-built", "intended", "retiring"]);
  for (const cell of d.elements) { ok(cell.metadata.attrs.id && cell.metadata.attrs.label && cell.metadata.attrs.source); strictEqual(cell.metadata.attrs.component, "platform"); ok(!("id" in cell.cell.attrs) && !("value" in cell.cell.attrs)); strictEqual(d.layer(cell), "as-built"); }
 }
 pass("metadata");
 const root = await installed("sync café"); cli(root);
 ok(cli(root, 0, "--check").includes("erd-check: 2 files match 2 schema files"));
 ok(command(root, [bun, "tools/diagram-check.ts"], 0).includes("files,"));
 strictEqual(command(root, [bun, "tools/doctor.ts"], 0), "doctor: 0 fail, 0 warn, 0 cannot-evaluate\n"); pass("installed-sync");
 for (const mutation of ["alter", "extra", "notes", "orphan", "missing"]) {
  const fresh = await installed(`drift-${mutation}`); cli(fresh);
  let file = `${erd.output}/owner${SUFFIX}`;
  if (mutation === "alter") put(fresh, file, readFileSync(join(fresh, file), "utf8") + "\n");
  if (mutation === "extra" || mutation === "notes") { file = `${erd.output}/${mutation === "extra" ? "hand-authored.drawio" : "notes.md"}`; put(fresh, file, "unexpected file"); }
  if (mutation === "orphan") rmSync(join(fresh, "schema/models/owner.prisma"));
  if (mutation === "missing") rmSync(join(fresh, file));
  const before = snapshot(fresh), output = cli(fresh, 1, "--check");
  ok(output.includes(`erd-check: ${mutation === "alter" ? "changed" : mutation === "missing" ? "missing" : "unexpected"}: ${file}`), output); deepStrictEqual(snapshot(fresh), before);
  if (mutation === "orphan") { cli(fresh); ok(!existsSync(join(fresh, file))); cli(fresh, 0, "--check"); }
  pass(`drift-${mutation}`);
 }
 for (const suffix of [false, true]) {
  const fresh = await installed(`selection-${suffix}`); cli(fresh);
  const selected = `${erd.output}/owner${SUFFIX}`, untouched = `${erd.output}/other${SUFFIX}`;
  rmSync(join(fresh, selected)); put(fresh, untouched, "unchanged sentinel");
  const before = statSync(join(fresh, untouched)).mtimeMs;
  cli(fresh, 0, "--file", suffix ? "models/owner.prisma" : "schema/models/owner.prisma");
  ok(existsSync(join(fresh, selected))); strictEqual(readFileSync(join(fresh, untouched), "utf8"), "unchanged sentinel"); strictEqual(statSync(join(fresh, untouched)).mtimeMs, before);
  cli(fresh, 0, "--check", "--file", suffix ? "models/owner.prisma" : "schema/models/owner.prisma"); pass(`selection-${suffix ? "suffix" : "root"}`);
 }
 const casesSchema = parseSchema(`model Foo {\n id String @id\n parentId String\n parent foo @relation(fields: [parentId], references: [id])\n}\nmodel foo {\n id String @id\n parentId String\n parent Foo @relation(fields: [parentId], references: [id])\n}`, "case.prisma");
 const caseDrawing = new Drawing(renderSchema(casesSchema, [casesSchema], erd)), ids = caseDrawing.cells.map(e => e.id);
 strictEqual(ids.length, new Set(ids).size);
 for (const id of ids) ok(/^[a-z0-9][a-z0-9._-]*$/.test(id));
 const tables = Object.fromEntries(caseDrawing.elements.filter(e => ["Foo (Foo)", "foo (foo)"].includes(e.metadata.attrs.label!)).map(e => [e.metadata.attrs.label!, e.id]));
 deepStrictEqual(new Set(caseDrawing.elements.filter(e => e.cell.attrs.edge).map(e => `${e.cell.attrs.source}→${e.cell.attrs.target}`)), new Set([`${tables["Foo (Foo)"]}→${tables["foo (foo)"]}`, `${tables["foo (foo)"]}→${tables["Foo (Foo)"]}`])); pass("case-distinct");
 const undefinedRoot = await installed("undefined"); cli(undefinedRoot); rmSync(join(undefinedRoot, "schema/models/other.prisma"));
 const undefinedBefore = snapshot(undefinedRoot);
 for (const args of [["--check"], []]) ok(/schema\/models\/owner.prisma:\d+: undefined relation model Other/.test(cli(undefinedRoot, 1, ...args)));
 deepStrictEqual(snapshot(undefinedRoot), undefinedBefore); pass("undefined-no-writes");
 strictEqual(cases, 29, "origin mapping covers all 29 cases");
 const single = parseSchema(`datasource db {\n provider = "postgresql"\n url = env("DATABASE_URL")\n}\ngenerator client {\n provider = "prisma-client-js"\n previewFeatures = [\n "views"\n ]\n}\nmodel Item { id Int @id }`, "single.prisma"); strictEqual(single.models[0]!.name, "Item"); pass("single-file datasource/generator");
 for (const [text, line] of [["view Item {\n id Int\n}", 1], ["model Item {\n id Int @unknown\n}", 2], ["model Item {\n id Int\n garbage\n}", 3], ['model Item {\n id String @default("unterminated)\n}', 3]] as const) throws(() => parseSchema(text, "bad.prisma"), new RegExp(`bad.prisma:${line}:`)); pass("unsupported syntax file:line");
 const cleanup = await installed("cleanup"); cli(cleanup);
 put(cleanup, `${erd.output}/hand${SUFFIX}`, "hand-authored"); put(cleanup, `${erd.output}/notes.md`, "notes");
 put(cleanup, `${erd.output}/nested/stale${SUFFIX}`, readFileSync(join(cleanup, `${erd.output}/owner${SUFFIX}`), "utf8"));
 cli(cleanup); ok(!existsSync(join(cleanup, `${erd.output}/nested/stale${SUFFIX}`))); strictEqual(readFileSync(join(cleanup, `${erd.output}/hand${SUFFIX}`), "utf8"), "hand-authored"); strictEqual(readFileSync(join(cleanup, `${erd.output}/notes.md`), "utf8"), "notes");
 put(cleanup, `${erd.output}/owner${SUFFIX}`, "hand-authored"); ok(cli(cleanup, 1).includes("refusing to overwrite non-generated")); pass("orphan cleanup only generated files");
 const stable = readFileSync(join(root, `${erd.output}/owner${SUFFIX}`)); cli(root); deepStrictEqual(readFileSync(join(root, `${erd.output}/owner${SUFFIX}`)), stable); pass("byte-identical rerun");
 const collision = await installed("collisions"); put(collision, "schema/extra/owner.prisma", "model Extra { id Int @id }"); cli(collision); cli(collision, 0, "--check");
 const collisionDrawings = readdirSync(join(collision, erd.output)).map(file => new Drawing(readFileSync(join(collision, erd.output, file), "utf8")));
 deepStrictEqual(new Set(collisionDrawings.map(d => d.byId.get("schema")!.metadata.attrs.source)), new Set(["schema/models/owner.prisma", "schema/extra/owner.prisma", "schema/models/other.prisma"])); pass("split basename collision");
 const escape = await installed("escape"); mkdirSync(join(scratch, "outside")); symlinkSync(join(scratch, "outside"), join(escape, erd.output)); const escapeError = cli(escape, 1); ok(escapeError.includes("outside repository") || escapeError.includes("symlinks")); deepStrictEqual(readdirSync(join(scratch, "outside")), []); pass("output symlink escape");
 // Actual installed commands, real history, schema edit, stale check, regeneration and declaration comparison.
 command(root, ["git", "init", "-b", "main"], 0); command(root, ["git", "add", "."], 0);
 command(root, ["git", "-c", "user.name=Smoke", "-c", "user.email=smoke@example.invalid", "commit", "-m", "fixture"], 0);
 const base = command(root, ["git", "rev-parse", "HEAD"], 0).trim();
 const plan = "## Architecture delta\n" + ["adds", "realizes", "builds", "retires", "removes", "withdraws", "changes", "diagrams"].map(k => `- ${k}: none`).join("\n") + "\n";
 put(root, "plan.md", plan); put(root, "schema/models/owner.prisma", fixture.replace("second Int", "second BigInt"));
 put(root, "schema/node_modules/dependency/schema.prisma", "unsupported dependency schema");
 ok(cli(root, 1, "--check").includes(`changed: ${erd.output}/owner${SUFFIX}`));
 cli(root); cli(root, 0, "--check"); command(root, [bun, "tools/diagram-check.ts"], 0);
 command(root, [bun, "tools/diagram-delta.ts", "compare", "plan.md", base, "--worktree"], 0);
 command(root, ["git", "add", "schema", erd.output], 0);
 command(root, ["git", "-c", "user.name=Smoke", "-c", "user.email=smoke@example.invalid", "commit", "-m", "schema update"], 0);
 const head = command(root, ["git", "rev-parse", "HEAD"], 0).trim();
 command(root, [bun, "tools/diagram-delta.ts", "compare", "plan.md", base, head], 0);
 put(root, "schema/models/owner.prisma", fixture);
 ok(command(root, [bun, "tools/diagram-delta.ts", "compare", "plan.md", base, head], 1).includes("Prisma inputs or adapter settings differ from worktree"));
 put(root, "schema/models/owner.prisma", fixture.replace("second Int", "second BigInt"));
 put(root, `${erd.output}/notes.md`, "unexpected"); ok(command(root, [bun, "tools/diagram-delta.ts", "compare", "plan.md", base, "--worktree"], 1).includes("ERD sync check failed"));
 rmSync(join(root, `${erd.output}/notes.md`));
 const config = JSON.parse(readFileSync(join(root, ".omp/mosaic.json"), "utf8")); delete config.diagrams.erd; put(root, ".omp/mosaic.json", JSON.stringify(config));
 ok(command(root, [bun, "tools/diagram-delta.ts", "compare", "plan.md", base, "--worktree"], 1).includes("observed but not declared")); pass("installed end-to-end and conditional exemption");
 const reviewFailures: string[] = [];
 async function regression(name: string, run: () => void | Promise<void>): Promise<void> {
  try { await run(); pass(name); } catch (error) { reviewFailures.push(`${name}: ${String(error)}`); console.log(`FAIL ${name}: ${String(error)}`); }
 }
 await regression("implicit unnamed many-to-many", () => {
  const s = parseSchema("model User {\n id Int @id\n tags Tag[]\n}\nmodel Tag {\n id Int @id\n users User[]\n}", "many.prisma");
  const d = new Drawing(renderSchema(s, [s], erd)), edges = d.elements.filter(e => e.cell.attrs.edge);
  deepStrictEqual(edges.map(e => [e.id, e.metadata.attrs.label, e.cell.attrs.source, e.cell.attrs.target]), [["edge-tag-users", "m:n", "model-tag", "model-user"]]);
  ok(edges[0]!.cell.attrs.style!.includes("startArrow=ERmany;endArrow=ERmany;"));
 });
 await regression("implicit named and cross-file many-to-many", async () => {
  const a = parseSchema('model Account {\n id Int @id\n tags Tag[] @relation("Primary")\n saved Tag[] @relation(name: "Saved")\n}', "schema/account.prisma");
  const b = parseSchema('model Tag {\n id Int @id\n accounts Account[] @relation(name: "Primary")\n savers Account[] @relation("Saved")\n}', "schema/tag.prisma");
  const d = new Drawing(renderSchema(a, [a, b], erd)), reverse = new Drawing(renderSchema(b, [a, b], erd));
  deepStrictEqual(d.elements.filter(e => e.cell.attrs.edge).map(e => [e.id, e.metadata.attrs.label]).sort(), [["edge-account-saved", 'm:n "Saved"'], ["edge-account-tags", 'm:n "Primary"']]);
  strictEqual(d.byId.get("model-tag")!.metadata.attrs.source, "schema/tag.prisma");
  deepStrictEqual(reverse.elements.filter(e => e.cell.attrs.edge), []);
  const fresh = await installed("many-to-many");
  put(fresh, "schema/models/owner.prisma", 'model Account {\n id Int @id\n tags Tag[] @relation("Primary")\n saved Tag[] @relation(name: "Saved")\n}');
  put(fresh, "schema/models/other.prisma", 'model Tag {\n id Int @id\n accounts Account[] @relation(name: "Primary")\n savers Account[] @relation("Saved")\n}');
  cli(fresh); cli(fresh, 0, "--check"); command(fresh, [bun, "tools/diagram-check.ts"], 0);
 });
 await regression("ambiguous implicit relation fails without writes", async () => {
  const fresh = await installed("ambiguous");
  put(fresh, "schema/models/owner.prisma", "model User {\n id Int @id\n tags Tag[]\n other Tag[]\n}\nmodel Tag {\n id Int @id\n users User[]\n}");
  const before = snapshot(fresh);
  for (const args of [[], ["--check"]]) ok(/schema\/models\/owner.prisma:\d+: ambiguous implicit many-to-many/.test(cli(fresh, 1, ...args)));
  deepStrictEqual(snapshot(fresh), before);
 });
 await regression("onUpdate and one-to-one connectors", () => {
  for (const constraint of ["id Int @id\n accountId Int @unique", "id Int @id\n accountId Int\n @@unique([accountId])", "id Int @id\n accountId Int\n @@id([accountId])", "accountId Int @id"]) {
   const s = parseSchema(`model Profile {\n ${constraint}\n account Account @relation(fields: [accountId], references: [id], onDelete: Cascade, onUpdate: Restrict)\n}\nmodel Account {\n id Int @id\n}`, "one.prisma");
   strictEqual(s.models[0]!.fields.find(f => f.name === "account")!.relation!.onUpdate, "Restrict");
   const edge = new Drawing(renderSchema(s, [s], erd)).byId.get("edge-profile-account")!;
   strictEqual(edge.metadata.attrs.label, "accountId → id onDelete: Cascade onUpdate: Restrict");
   ok(edge.cell.attrs.style!.includes("startArrow=ERone;endArrow=ERone;"));
  }
  const s = parseSchema("model Child {\n a Int\n b Int\n parent Parent @relation(fields: [a, b], references: [a, b])\n @@unique([a, b])\n}\nmodel Parent {\n a Int\n b Int\n @@id([a, b])\n}", "composite.prisma");
  ok(new Drawing(renderSchema(s, [s], erd)).byId.get("edge-child-parent")!.cell.attrs.style!.includes("startArrow=ERone;endArrow=ERone;"));
  for (const constraint of ["@@unique([a, b, extra])", "@@unique([a])"]) {
   const many = parseSchema(`model Child {\n a Int\n b Int\n extra Int\n parent Parent @relation(fields: [a, b], references: [a, b])\n ${constraint}\n}\nmodel Parent {\n a Int\n b Int\n children Child[]\n @@id([a, b])\n}`, "many.prisma");
   const d = new Drawing(renderSchema(many, [many], erd));
   strictEqual(d.elements.filter(e => e.cell.attrs.edge).length, 1);
   ok(d.byId.get("edge-child-parent")!.cell.attrs.style!.includes("startArrow=ERmany;endArrow=ERone;"));
  }
 });
 await regression("named map diagnostic", () => {
  for (const text of ['model Item {\n id Int @map(name: "x")\n}', 'model Item {\n id Int\n @@map(name: "x")\n}']) throws(() => parseSchema(text, "mapped.prisma"), /mapped.prisma:\d+: @map\/@@map requires one positional string argument/);
 });
 await regression("schema globs exclude dependencies", async () => {
  const fresh = await installed("dependencies");
  const config = JSON.parse(readFileSync(join(fresh, ".omp/mosaic.json"), "utf8")); config.diagrams.erd.schemaGlobs = ["**/*.prisma"];
  put(fresh, ".omp/mosaic.json", JSON.stringify(config));
  put(fresh, "node_modules/dependency/schema.prisma", "unsupported dependency schema");
  put(fresh, "schema/node_modules/nested/schema.prisma", "unsupported dependency schema");
  cli(fresh); ok(cli(fresh, 0, "--check").includes("2 files match 2 schema files"));
 });
await regression("block comments supported, unterminated rejected", () => {
 strictEqual(parseSchema("model Item {\n id Int @id\n /**\n  * documented\n  */\n note String\n}", "block.prisma").models[0]!.fields.length, 2);
 throws(() => parseSchema("model Item {\n id Int @id\n /* open\n}", "block.prisma"), /block.prisma:3: unterminated Prisma comment/);
 strictEqual(parseSchema('model Item {\n id Int @id\n note String @default("/* text */") // trailing\n}', "string.prisma").models[0]!.fields.length, 2);
});
await regression("relation constraint name kept", () => {
 const s = parseSchema('model Post {\n id Int @id\n ownerId Int\n owner User @relation(fields: [ownerId], references: [id], map: "fk_owner")\n}\nmodel User {\n id Int @id\n}', "mapped.prisma");
 strictEqual(s.models[0]!.fields.find(f => f.name === "owner")!.relation!.map, "fk_owner");
 strictEqual(new Drawing(renderSchema(s, [s], erd)).byId.get("edge-post-owner")!.metadata.attrs.label, 'ownerId → id map: "fk_owner"');
 throws(() => parseSchema("model Post {\n id Int @id\n ownerId Int\n owner User @relation(fields: [ownerId], references: [id], map: fk)\n}\nmodel User {\n id Int @id\n}", "badmap.prisma"), /badmap.prisma:4: @relation map requires a string constraint name/);
});
await regression("doctor rejects a dangling-symlink output", async () => {
 const fresh = await installed("dangling-output");
 rmSync(join(fresh, erd.output), { recursive: true, force: true });
 symlinkSync(join(scratch, "missing-erd-target"), join(fresh, erd.output));
 // The FAIL is the point; the unreadable link also yields CANNOT-EVALUATE, which takes exit-code precedence.
 ok(command(fresh, [bun, "tools/doctor.ts"], 2).includes("FAIL mosaic-config .omp/mosaic.json: /mosaic-kit: Error: unsafe ERD output ancestor"));
});
 deepStrictEqual(reviewFailures, []);
 console.log(`erd-smoke: ${cases} cases passed (29 mapped origin cases plus adapter boundaries)`);
} finally { rmSync(scratch, { recursive: true, force: true }); }
