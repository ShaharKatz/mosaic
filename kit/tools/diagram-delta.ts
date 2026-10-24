#!/usr/bin/env bun
// Revision/worktree projection, semantic delta and strict plan comparison. Never writes.
import { existsSync, readFileSync } from "node:fs";
import { relative } from "node:path";
import { fileURLToPath } from "node:url";
import { Drawing, decisions, diagramPaths, frontmatter, settings, styles, validIntent, readDiagram, serialize } from "./diagram-check.ts";
import type { Cell, Settings } from "./diagram-check.ts";
import * as c from "./constants/diagrams.ts";
function git(...args: string[]): string {
  const result = Bun.spawnSync(["git", ...args], { stdout: "pipe", stderr: "pipe", timeout: 30_000 });
  if (result.exitCode !== 0) throw new Error(result.stderr.toString().trim()); return result.stdout.toString();
}
export function project(d: Drawing): string[] {
  const lines: string[] = [];
  for (const e of d.elements) {
    const m = e.metadata.attrs, a = e.cell.attrs, label = (m.label ?? m.value ?? "").split(/\r?\n/).join(" ");
    if (a.edge === "1") lines.push(`edge | ${d.layer(e) ?? ""} | ${e.id} | ${a.source ?? ""} → ${a.target ?? ""} | ${label}`);
    else {
      let line = `${d.layer(e) ?? ""} | ${e.id} | ${label} | ${m.component ?? ""}`;
      for (const key of ["source", "decision", "intent", "kind"]) if (e.wrapped && key in m) line += ` | ${key}=${m[key]}`;
      lines.push(line, ...d.rows(e).map(row => `  row | ${row}`));
    }
  }
  return lines;
}
function semantic(d: Drawing, e: Cell, transition?: c.Kind, before?: string, after?: string, addedSource = false): string {
  const metadata = { ...e.metadata.attrs }, structural = { ...e.cell.attrs }, style = styles(e.cell);
  delete structural.style;
  for (const key of c.ROUTING_KEYS) delete style[key];
  if (transition && (c.LAYERS as readonly string[]).includes(structural.parent ?? "")) delete structural.parent;
  if (transition) for (const key of [...Object.keys(c.LAYER_STYLES[before ?? ""] ?? {}), ...Object.keys(c.LAYER_STYLES[after ?? ""] ?? {})]) delete style[key];
  if (addedSource) delete metadata.source;
  if (transition === "retires") { delete metadata.decision; delete metadata.intent; }
  // Attribute/style ordering is XML syntax, not a semantic edit.
  const sorted = (record: Record<string, string>) => Object.fromEntries(Object.entries(record).sort(([a], [b]) => a.localeCompare(b)));
  return JSON.stringify([sorted(metadata), sorted(structural), sorted(style), d.rows(e)]);
}
export type Change = { kind: c.Kind; reference: string; before?: Cell; after?: Cell; beforeLayer?: string; afterLayer?: string; rows: string[] };
export type Report = { changes: Change[]; legends: string[]; failures: string[]; changedFiles: string[]; snapshots: Map<string, [Drawing | undefined, Drawing | undefined]>; head?: string };
const transitions: Record<string, c.Kind> = { "→intended": "adds", "→as-built": "builds", "intended→as-built": "realizes", "as-built→retiring": "retires", "retiring→": "removes", "as-built→": "removes", "intended→": "withdraws" };
function rowDiff(before: string[], after: string[]): string[] {
  // LCS keeps unchanged rows out of the report, including repeated table rows.
  const lengths = Array.from({ length: before.length + 1 }, () => new Uint32Array(after.length + 1));
  for (let i = before.length - 1; i >= 0; i--) for (let j = after.length - 1; j >= 0; j--) lengths[i]![j] = before[i] === after[j] ? lengths[i + 1]![j + 1]! + 1 : Math.max(lengths[i + 1]![j]!, lengths[i]![j + 1]!);
  const lines: string[] = []; let i = 0, j = 0;
  while (i < before.length || j < after.length) {
    if (i < before.length && j < after.length && before[i] === after[j]) { i++; j++; }
    else if (i < before.length && (j === after.length || lengths[i + 1]![j]! >= lengths[i]![j + 1]!)) lines.push(`  - row | ${before[i++]}`);
    else lines.push(`  + row | ${after[j++]}`);
  }
  return lines;
}
export function delta(base: string, head: string | undefined, config: Settings, paths: string[] = []): Report {
  const pathsAt = (revision: string | undefined) => new Set(revision === undefined ? diagramPaths(config.root) : git("ls-tree", "-rz", "--name-only", revision, "--", config.root).split("\0").filter(p => p.endsWith(".drawio")));
  const oldPaths = pathsAt(base), newPaths = pathsAt(head);
  const report: Report = { changes: [], legends: [], failures: [], changedFiles: [], snapshots: new Map(), head };
  for (const path of [...new Set([...oldPaths, ...newPaths])].sort()) {
    if (paths.length && !paths.some(p => path === p || path.startsWith(p.replace(/\/+$/, "") + "/"))) continue;
    const oldText = oldPaths.has(path) ? git("show", `${base}:${path}`) : undefined;
    const newText = newPaths.has(path) ? (head === undefined ? readDiagram(path, config) : git("show", `${head}:${path}`)) : undefined;
    const before = oldText === undefined ? undefined : new Drawing(oldText), after = newText === undefined ? undefined : new Drawing(newText);
    report.snapshots.set(path, [before, after]);
    if (oldText === newText) continue;
    const file = relative(config.root, path); report.changedFiles.push(file);
    const old = new Map(before?.elements.map(e => [e.id, e])), current = new Map(after?.elements.map(e => [e.id, e]));
    for (const id of [...new Set([...old.keys(), ...current.keys()])].sort()) {
      let a = old.get(id), b = current.get(id); const reference = `${file}#${id}`;
      if (a?.legend || b?.legend) {
        if (!a || !b || semantic(before!, a) !== semantic(after!, b)) report.legends.push(reference);
        if (a?.legend) a = undefined; if (b?.legend) b = undefined;
      }
      if (!a && !b) continue;
      const beforeLayer = a ? before!.layer(a) : undefined, afterLayer = b ? after!.layer(b) : undefined;
      let transition: c.Kind | undefined;
      if (beforeLayer !== afterLayer) {
        transition = transitions[`${beforeLayer ?? ""}→${afterLayer ?? ""}`];
        if (!transition) { report.failures.push(`${c.UNSUPPORTED}: ${reference}: ${beforeLayer} → ${afterLayer}`); continue; }
        report.changes.push({ kind: transition, reference, before: a, after: b, beforeLayer, afterLayer, rows: [] });
      }
      const addedSource = !!(a && b && transition === "realizes" && !("source" in a.metadata.attrs) && "source" in b.metadata.attrs);
      if (a && b && semantic(before!, a, transition, beforeLayer, afterLayer, addedSource) !== semantic(after!, b, transition, beforeLayer, afterLayer, addedSource)) report.changes.push({
        kind: "changes", reference, before: a, after: b, beforeLayer, afterLayer, rows: rowDiff(before!.rows(a), after!.rows(b)),
      });
    }
  }
  return report;
}
export type Citation = { decision?: string; intent?: string };
export type Declaration = { declared: Record<c.Kind, Map<string, Citation>>; diagrams: string[] };
export function parseDeclaration(text: string): Declaration {
  const lines = text.split(/\r?\n/); if (lines.filter(line => line === c.ARCHITECTURE_HEADING).length !== 1) throw new Error(c.MALFORMED);
  const values: Record<string, string> = {};
  for (const line of lines.slice(lines.indexOf(c.ARCHITECTURE_HEADING) + 1)) {
    if (line.startsWith("#")) break;
    const match = /^- ([\w-]+):\s*(.*)$/.exec(line);
    if (!match) { if (line.startsWith("- ")) throw new Error(c.MALFORMED); continue; }
    const key = match[1]!, value = match[2]!.trim();
    if (key in values || ![...c.KINDS, "diagrams"].includes(key) || !value) throw new Error(c.MALFORMED); values[key] = value;
  }
  if (Object.keys(values).length !== c.KINDS.length + 1) throw new Error(c.MALFORMED);
  const declared = Object.fromEntries(c.KINDS.map(kind => [kind, new Map<string, Citation>()])) as Record<c.Kind, Map<string, Citation>>;
  for (const kind of c.KINDS) {
    let remaining = values[kind]!; if (remaining === "none") continue;
    while (remaining) {
      const match = /^([^,\s#]+)#([a-z0-9][a-z0-9._-]*)(?:\s+\((D\d+),\s*((?:plan:|tracker:\/\/)[^\s,()]+)\))?/.exec(remaining);
      if (!match || match[1]!.startsWith("/") || match[1]!.split(/[\\/]/).includes("..")) throw new Error(c.MALFORMED);
      const reference = `${match[1]}#${match[2]}`; if (declared[kind].has(reference)) throw new Error(c.MALFORMED);
      declared[kind].set(reference, { decision: match[3], intent: match[4] }); remaining = remaining.slice(match[0].length);
      if (remaining) { const separator = /^,\s*/.exec(remaining); if (!separator || separator[0].length === remaining.length) throw new Error(c.MALFORMED); remaining = remaining.slice(separator[0].length); }
    }
  }
  const diagrams = values.diagrams === "none" ? [] : values.diagrams!.split(",").map(p => p.trim());
  if (diagrams.some(p => !p || /\s|#|[()\\]/.test(p) || p.startsWith("/") || p.split("/").includes("..") || p === "none")) throw new Error(c.MALFORMED);
  return { declared, diagrams };
}
export function compare(report: Report, text: string, config: Settings): string[] {
  let declaration: Declaration;
  try { declaration = parseDeclaration(text); } catch (error) { return [(error as Error).message]; }
  const { declared, diagrams } = declaration, mapped = decisions(), failures = [...report.failures];
  const generated = new Set<string>();
  const erd = JSON.parse(readFileSync(c.CONFIG_PATH, "utf8")).diagrams?.erd;
  let snapshotMatches = true;
  if (erd !== undefined && report.head !== undefined) {
    // Optional adapter constants are absent in installations without the adapter.
    const { DEPENDENCY_DIRECTORY } = require("./constants/erd.ts");
    const included = (file: string) => !file.split("/").includes(DEPENDENCY_DIRECTORY);
    const patterns = erd.schemaGlobs.map((glob: string) => new Bun.Glob(glob));
    const revisionInputs = git("ls-tree", "-rz", "--name-only", report.head).split("\0").filter(file => included(file) && patterns.some((glob: Bun.Glob) => glob.match(file))).sort();
    const worktreeInputs = [...new Set<string>(erd.schemaGlobs.flatMap((glob: string) => [...new Bun.Glob(glob).scanSync({ onlyFiles: true, followSymlinks: false })]))].filter(included).sort();
    snapshotMatches = JSON.stringify(revisionInputs) === JSON.stringify(worktreeInputs)
      && revisionInputs.every(file => existsSync(file) && git("show", `${report.head}:${file}`) === readFileSync(file, "utf8"))
      && JSON.stringify(JSON.parse(git("show", `${report.head}:${c.CONFIG_PATH}`)).diagrams) === JSON.stringify(JSON.parse(readFileSync(c.CONFIG_PATH, "utf8")).diagrams);
    if (!snapshotMatches) failures.push("ERD sync check cannot verify revision: Prisma inputs or adapter settings differ from worktree");
  }
  if (erd !== undefined && snapshotMatches) {
    // Optional adapter may not be installed. Its read-only CLI validates settings and sync first.
    const check = Bun.spawnSync([process.execPath, fileURLToPath(new URL("./erd-generate.ts", import.meta.url)), "--check"], { stdout: "pipe", stderr: "pipe" });
    if (check.exitCode !== 0) failures.push(`ERD sync check failed: ${check.stdout.toString().trim()} ${check.stderr.toString().trim()}`);
    else for (const [path, [before, after]] of report.snapshots) {
      if (!path.startsWith(erd.output + "/") || !(after ?? before)?.xml.attrs.generator) continue;
      if (existsSync(path) !== !!after) continue;
      // Revision comparisons cannot borrow a passing check from a different worktree snapshot.
      if (after && serialize(after.xml) !== serialize(new Drawing(readDiagram(path, config)).xml)) continue;
      if ((after ?? before)!.xml.attrs.generator === "mosaic-prisma-erd") generated.add(relative(config.root, path));
    }
  }
  const observed = Object.fromEntries(c.KINDS.map(k => [k, new Set<string>()])) as Record<c.Kind, Set<string>>;
  for (const file of report.changedFiles) if (!generated.has(file) && !diagrams.some(p => file === p || (p.endsWith("/") && file.startsWith(p)))) failures.push(`${c.UNLISTED}: ${file}`);
  for (const change of report.changes) {
    if (generated.has(change.reference.split("#")[0]!)) continue;
    const { kind, reference } = change; observed[kind].add(reference);
    if (!declared[kind].has(reference)) failures.push(`${c.UNDECLARED}: ${kind}: ${reference}`);
    let citation: Citation | undefined;
    if (["adds", "builds", "retires"].includes(kind)) citation = change.after?.metadata.attrs;
    else if ((kind === "removes" && change.beforeLayer === "as-built") || kind === "withdraws" || (kind === "changes" && change.beforeLayer === "intended")) citation = declared[kind].get(reference) ?? {};
    if (citation && (!mapped.has(citation.decision ?? "") || !validIntent(citation.intent, config))) failures.push(`${c.BAD_CITATION}: ${kind}: ${reference}`);
  }
  for (const kind of c.KINDS) for (const reference of [...declared[kind].keys()].sort()) if (!observed[kind].has(reference)) failures.push(`${c.UNOBSERVED}: ${kind}: ${reference}`);
  return failures;
}
export function candidates(report: Report, text: string, config: Settings) {
  const areas = frontmatter(text).areas ?? [];
  const components = config.components.filter(component => areas.some(area => area === component || area.startsWith(component + "/")));
  const changed = new Set([...report.changes.map(change => change.reference.split("#")[0]), ...report.legends.map(ref => ref.split("#")[0]), ...report.failures.map(f => f.split(": ")[1]!.split("#")[0])]);
  const entries: { doc: string; class: string; why: string }[] = [];
  for (const [path, snapshots] of report.snapshots) {
    const file = relative(config.root, path), affinity = snapshots.some(d => d?.elements.some(e => components.includes(e.metadata.attrs.component ?? "")));
    if (changed.has(file) || affinity) entries.push({ doc: path, class: "diagram", why: changed.has(file) ? "diagram delta" : "plan component affinity" });
  }
  return { candidates: entries, cannotEvaluate: [] };
}
export function main(args = Bun.argv.slice(2)): number {
  const command = args.shift();
  if (command === "project") {
    if (args.length !== 1) throw new Error("usage: diagram-delta project <file>");
    console.log(project(new Drawing(readDiagram(args[0]!, settings()))).join("\n")); return 0;
  }
  if (command !== "delta" && command !== "compare") throw new Error("usage: diagram-delta project|delta|compare");
  const plan = command === "compare" ? args.shift() : undefined;
  const positionals: string[] = []; let worktree = false, json = false, candidatePlan: string | undefined;
  while (args.length) {
    const arg = args.shift()!;
    if (arg === "--worktree") worktree = true;
    else if (arg === "--candidates" && command === "delta") json = true;
    else if (arg === "--plan" && command === "delta") { candidatePlan = args.shift(); if (!candidatePlan) throw new Error("--plan requires a file"); }
    else if (arg.startsWith("--")) throw new Error(`unknown option ${arg}`);
    else positionals.push(arg);
  }
  const base = positionals.shift(), head = worktree ? undefined : positionals.shift();
  if (!base || (!worktree && !head)) throw new Error("head revision or --worktree is required");
  if (command === "compare" && (!plan || positionals.length)) throw new Error("compare does not accept paths");
  if (json && !candidatePlan) throw new Error("--candidates requires --plan");
  const config = settings(), report = delta(base, head, config, positionals);
  if (command === "compare") { const failures = compare(report, readFileSync(plan!, "utf8"), config); if (failures.length) console.log(failures.join("\n")); return failures.length ? 1 : 0; }
  const lines = report.changes.flatMap(change => [`${change.kind}: ${change.reference}`, ...change.rows]);
  if (report.legends.length) lines.push("legend:", ...report.legends); lines.push(...report.failures);
  if (lines.length) (json ? console.error : console.log)(lines.join("\n"));
  if (json) console.log(JSON.stringify(candidates(report, readFileSync(candidatePlan!, "utf8"), config), null, 2));
  return report.failures.length ? 1 : 0;
}
if (import.meta.main) try { process.exitCode = main(); } catch (error) { console.error((error instanceof Error ? error.message : String(error)).replace(/[\r\n]+/g, " ")); process.exitCode = 1; }
