#!/usr/bin/env bun
// Pull-request review comment for diagram changes: the change list plus before/after Mermaid with review colours. Never writes.
import { relative } from "node:path";
import { Buffer } from "node:buffer";
import { isEdge, settings } from "./diagram-check.ts";
import type { Diagram, Element, Settings } from "./diagram-check.ts";
import { delta } from "./diagram-delta.ts";
import type { Change } from "./diagram-delta.ts";
export const MARKER = "<!-- mosaic:diagram-review -->";
export const LEGEND = "🟢 new · 🟣 planned (intended) · 🟡 changed · 🔴 retiring or removed";
// GitHub rejects comment bodies over 65,536 characters; counting UTF-8 bytes is the strictest reading.
export const COMMENT_LIMIT = 65536;
const ER_FOCUS_NOTE = "_ERD drawings show the changed tables in full and the tables they relate to as name-only boxes._";
const omittedNote = (title: string) => `_${title} drawing omitted to stay within GitHub's ${COMMENT_LIMIT.toLocaleString("en-US")}-character comment limit; open the file in the pull request._`;
type Mark = "new" | "planned" | "changed" | "removed";
const MARKS: readonly Mark[] = ["new", "planned", "changed", "removed"];
const COLOURS: Record<Mark, string> = { new: "#1a7f37", planned: "#8250df", changed: "#bf8700", removed: "#cf222e" };
export const REVIEW_CLASS_DEFS = MARKS.map(mark => `classDef rv-${mark} stroke:${COLOURS[mark]},stroke-width:3px${mark === "changed" ? `,color:${COLOURS.changed}` : ""}`);
// A removal outranks an addition, which outranks a plain change, when one element has several changes.
const RANK: Record<Mark, number> = { changed: 0, new: 1, planned: 1, removed: 2 };
const ADDED: readonly string[] = ["adds", "builds", "realizes"];
const flat = (text: string) => text.split("\n").join(" ");
function code(value: string | undefined): string {
  if (value === undefined || value === "") return "(none)";
  const run = Math.max(0, ...(value.match(/`+/g) ?? []).map(ticks => ticks.length)), fence = "`".repeat(run + 1), pad = run ? " " : "";
  return `${fence}${pad}${value}${pad}${fence}`;
}
const planned = (change: Change) => ADDED.includes(change.kind) && change.afterLayer === "intended";
function icon(change: Change): string {
  if (change.kind === "changes") return "🟡";
  if (ADDED.includes(change.kind)) return planned(change) ? "🟣" : "🟢";
  return "🔴";
}
function describe(e: Element, d: Diagram): string {
  if (isEdge(e)) {
    const end = (id = "") => flat(d.byId.get(id)?.label || id);
    return `${end(e.from)} → ${end(e.to)}${e.label ? ` “${flat(e.label)}”` : ""}`;
  }
  return `${e.type === "entity" || e.data.table === "true" ? "table " : ""}“${flat(e.label)}”`;
}
function differences(a: Element, b: Element, transition: Change | undefined, rows: string[]): string[] {
  const skipped = new Set(transition?.kind === "retires" ? ["decision", "intent"] : transition?.kind === "realizes" && !("source" in a.data) ? ["source"] : []);
  const classes = (e: Element) => e.classes.filter(name => name !== "intended" && name !== "retiring").sort().join(", ") || undefined;
  const label = (e: Element) => e.label.replace(/\n/g, "<br/>");
  const keys = [...new Set([...Object.keys(a.data), ...Object.keys(b.data)])].filter(key => !skipped.has(key)).sort();
  const pairs: [string, string | undefined, string | undefined][] = [
    ["label", label(a), label(b)], ["shape", a.shape, b.shape], ["from", a.from, b.from], ["to", a.to, b.to], ["parent", a.parent, b.parent],
    ...keys.map(key => [key, a.data[key], b.data[key]] as [string, string | undefined, string | undefined]), ["classes", classes(a), classes(b)],
  ];
  const lines = pairs.filter(([, old, now]) => old !== now).map(([key, old, now]) => `  - ${key}: ${code(old)} → ${code(now)}`);
  for (const row of rows) { const match = /^ {2}([+-]) row \| (.*)$/.exec(row); if (match) lines.push(`  - ${code(`${match[1]} ${match[2]}`)}`); }
  return lines;
}
/** Index form of diagram-delta's row LCS (same tie-breaking), so markers land on the reported rows. */
function rowIndexes(before: string[], after: string[]): { removed: number[]; added: number[] } {
  const lengths = Array.from({ length: before.length + 1 }, () => new Uint32Array(after.length + 1));
  for (let i = before.length - 1; i >= 0; i--) for (let j = after.length - 1; j >= 0; j--) lengths[i]![j] = before[i] === after[j] ? lengths[i + 1]![j + 1]! + 1 : Math.max(lengths[i + 1]![j]!, lengths[i]![j + 1]!);
  const removed: number[] = [], added: number[] = []; let i = 0, j = 0;
  while (i < before.length || j < after.length) {
    if (i < before.length && j < after.length && before[i] === after[j]) { i++; j++; }
    else if (i < before.length && (j === after.length || lengths[i + 1]![j]! >= lengths[i]![j + 1]!)) removed.push(i++);
    else added.push(j++);
  }
  return { removed, added };
}
function annotate(d: Diagram, marks: Map<string, Mark>, rowMarks: Map<number, string>, keep?: Focus): string | undefined {
  const text = d.text.endsWith("\n") ? d.text : d.text + "\n";
  if (d.kind === "flowchart") {
    const indent = [...text.matchAll(/^( *)classDef /gm)].at(-1)?.[1] ?? "  ";
    const lines = REVIEW_CLASS_DEFS.map(line => indent + line);
    for (const mark of MARKS) {
      const ids = d.elements.filter(e => marks.get(e.id) === mark).map(e => e.id);
      if (ids.length) lines.push(`${indent}class ${ids.join(",")} rv-${mark}`);
    }
    return text + lines.join("\n") + "\n";
  }
  const all = text.slice(0, -1).split("\n");
  for (const [number, label] of rowMarks) {
    const line = all[number - 1]!;
    all[number - 1] = line.trimStart().startsWith("%%") ? `${line} ${label}` : line.endsWith('"') ? `${line.slice(0, -1)} ${label}"` : `${line} "${label}"`;
  }
  const lines = keep ? focus(d, keep, all) : all;
  if (!lines) return undefined;
  for (const e of d.elements) { const mark = marks.get(e.id); if (mark && e.type === "entity") lines.push(`  style ${e.id} stroke:${COLOURS[mark]},stroke-width:3px`); }
  return lines.join("\n") + "\n";
}
type Focus = { full: Set<string>; relations: Set<string>; named: Set<string> };
/** One ERD focus per file from both sides' marks: marked tables in full, marked relationships and those touching a marked table, and the tables they name. */
function erFocus(sides: (Diagram | undefined)[], marks: Map<string, Mark>[]): Focus | undefined {
  const marked = new Set(marks.flatMap(side => [...side.keys()])), elements = sides.flatMap(d => d?.elements ?? []);
  const full = new Set(elements.filter(e => e.type === "entity" && marked.has(e.id)).map(e => e.id));
  const relations = elements.filter(e => e.type === "relation" && (marked.has(e.id) || full.has(e.from!) || full.has(e.to!)));
  if (!full.size && !relations.length) return undefined;
  return { full, relations: new Set(relations.map(e => e.id)), named: new Set(relations.flatMap(e => [e.from!, e.to!])) };
}
/** The focused lines of one side; tables named only by a kept relationship keep just their name. Undefined when the side keeps no table. */
function focus(d: Diagram, keep: Focus, lines: string[]): string[] | undefined {
  const kept = lines.slice(0, 2); let tables = 0;
  for (const e of d.elements) {
    if (e.type === "entity" && (keep.full.has(e.id) || keep.named.has(e.id))) {
      tables++;
      const close = lines.findIndex((line, index) => index >= e.line && line.trim() === "}");
      kept.push(...lines.slice(e.line - 2, e.line), ...keep.full.has(e.id) ? lines.slice(e.line, close) : [], lines[close]!);
    } else if (e.type === "relation" && keep.relations.has(e.id)) kept.push(...lines.slice(e.line - 2, e.line));
  }
  return tables ? kept : undefined;
}
type Drawing = { title: string; text: string; omitted: boolean };
type Section = { lines: string[]; drawings: Drawing[] };
function drawingLines(drawing: Drawing): string[] {
  if (drawing.omitted) return [omittedNote(drawing.title), ""];
  return [`<details${drawing.title === "After" ? " open" : ""}><summary>${drawing.title}</summary>`, "", "```mermaid", drawing.text.replace(/\n$/, ""), "```", "", "</details>", ""];
}
function section(path: string, before: Diagram | undefined, after: Diagram | undefined, changes: Change[]): Section {
  const out = [`#### \`${path}\``, ""], beforeMarks = new Map<string, Mark>(), afterMarks = new Map<string, Mark>();
  const beforeRows = new Map<number, string>(), afterRows = new Map<number, string>();
  const mark = (marks: Map<string, Mark>, id: string, value: Mark) => { const current = marks.get(id); if (!current || RANK[value] > RANK[current]) marks.set(id, value); };
  const bullets: string[] = [];
  for (const change of changes) {
    const e = (change.after ?? change.before)!, d = (change.after ? after : before)!;
    let line = `- ${icon(change)} **${change.kind}** ${describe(e, d)}`;
    if (planned(change)) line += ` (planned: ${[e.data.decision, e.data.intent].filter(Boolean).join(", ")})`;
    bullets.push(line);
    if (change.kind === "changes") {
      const a = change.before!, b = change.after!;
      const transition = changes.find(other => other !== change && other.reference === change.reference);
      bullets.push(...differences(a, b, transition, change.rows));
      mark(beforeMarks, a.id, "changed"); mark(afterMarks, b.id, "changed");
      if (a.type === "entity" && b.type === "entity") {
        const { removed, added } = rowIndexes(a.rows, b.rows);
        for (const i of removed) beforeRows.set(a.rowLines[i]!, "🔴 removed");
        for (const j of added) afterRows.set(b.rowLines[j]!, "🟢 new");
      }
    } else if (ADDED.includes(change.kind)) mark(afterMarks, e.id, planned(change) ? "planned" : "new");
    else { mark(beforeMarks, e.id, "removed"); if (change.after) mark(afterMarks, e.id, "removed"); }
  }
  if (bullets.length) out.push(...bullets, "");
  const keep = (after ?? before)!.kind === "erDiagram" ? erFocus([before, after], [beforeMarks, afterMarks]) : undefined;
  if (keep) out.push(ER_FOCUS_NOTE, "");
  const drawings: Drawing[] = [];
  for (const [title, d, marks, rows] of [["Before", before, beforeMarks, beforeRows], ["After", after, afterMarks, afterRows]] as const) {
    const text = d && annotate(d, marks, rows, keep);
    if (text) drawings.push({ title, text, omitted: false });
  }
  return { lines: out, drawings };
}
export function review(base: string, head: string | undefined, config: Settings): string {
  const report = delta(base, head, config), out = [MARKER, "### Diagram changes", ""];
  const files = [...report.snapshots].filter(([, [before, after]]) => before?.text !== after?.text)
    .map(([path, [before, after]]) => ({ path, file: relative(config.root, path), before, after, er: (after ?? before)!.kind === "erDiagram" }))
    .sort((x, y) => Number(x.er) - Number(y.er) || (x.path < y.path ? -1 : x.path > y.path ? 1 : 0));
  if (!files.length && !report.failures.length) return [...out, "No diagram changes.", ""].join("\n");
  out.push(LEGEND, "");
  const sections = files.map(({ path, file, before, after }) =>
    section(path, before, after, report.changes.filter(change => change.reference.slice(0, change.reference.lastIndexOf("#")) === file)));
  const problems = report.failures.length ? ["Problems:", "", ...report.failures.map(failure => `- ${failure}`), ""] : [];
  const render = () => [...out, ...sections.flatMap(s => [...s.lines, ...s.drawings.flatMap(drawingLines)]), ...problems].join("\n");
  // Over the limit, replace the largest drawings with a note until the comment fits; the change list always stays.
  let text = render();
  for (const drawing of sections.flatMap(s => s.drawings).sort((x, y) => y.text.length - x.text.length)) {
    if (Buffer.byteLength(text) <= COMMENT_LIMIT) break;
    drawing.omitted = true; text = render();
  }
  return text;
}
export function main(args = Bun.argv.slice(2)): number {
  const usage = "usage: diagram-review <base> (<head> | --worktree)", positionals: string[] = []; let worktree = false;
  for (const arg of args) {
    if (arg === "--worktree") worktree = true;
    else if (arg.startsWith("--")) throw new Error(`unknown option ${arg}`);
    else positionals.push(arg);
  }
  if (positionals.length !== (worktree ? 1 : 2)) throw new Error(usage);
  process.stdout.write(review(positionals[0]!, worktree ? undefined : positionals[1], settings())); return 0;
}
if (import.meta.main) try { process.exitCode = main(); } catch (error) { console.error((error instanceof Error ? error.message : String(error)).replace(/[\r\n]+/g, " ")); process.exitCode = 1; }
