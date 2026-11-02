#!/usr/bin/env bun
// One-time draw.io → Mermaid converter for /mosaic-kit upgrades (source-side only; never installed).
// Run from the installed project root:
//   bun <mosaic>/install/drawio-to-mermaid.ts --root <diagrams root> [--plans <dir>] [--docs <dir>] [--keep]
// Generated ERDs always live inside the diagrams root, so --root covers them.
// Exit 0: converted and clean; 1: nothing written (usage, parse, misread-id or equivalence-gate failure);
// 2: converted, but diagram-check findings remain.
import { existsSync, readFileSync, realpathSync, rmSync, statSync, writeFileSync } from "node:fs";
import { inflateRawSync } from "node:zlib";
import { basename, dirname, relative, resolve } from "node:path";
import { Diagram, decisions, encodeLabel, serializeData, settings, validate } from "../kit/tools/diagram-check.ts";
import { project } from "../kit/tools/diagram-delta.ts";
import * as c from "../kit/tools/constants/diagrams.ts";
import { GENERATED } from "../kit/tools/constants/erd.ts";
import { realpathWithinRoot } from "../kit/tools/root-containment.ts";

// ---- Pre-migration reader, copied from e2b4125 kit/tools/diagram-check.ts and constants/diagrams.ts ----
const OLD_LAYERS = ["as-built", "intended", "retiring"] as const;
const MAX_EXPANDED_PAGE_BYTES = 16 * 1024 * 1024;
const OLD_MALFORMED = "expected one well-formed drawio page";
// Former `fillColor|strokeColor` pairs of the category palette.
const CATEGORY_BY_PALETTE: Record<string, (typeof c.CATEGORY_CLASSES)[number]> = {
  "#d5e8d4|#82b366": "external", "#dae8fc|#6c8ebf": "service", "#e1d5e7|#9673a6": "agent",
  "#ffe6cc|#d79b00": "store", "#fff2cc|#d6b656": "messaging", "#f5f5f5|#666666": "legend",
};
const XML_NAME_START = "[:A-Z_a-z\\u00C0-\\u00D6\\u00D8-\\u00F6\\u00F8-\\u02FF\\u0370-\\u037D\\u037F-\\u1FFF\\u200C-\\u200D\\u2070-\\u218F\\u2C00-\\u2FEF\\u3001-\\uD7FF\\uF900-\\uFDCF\\uFDF0-\\uFFFD\\u{10000}-\\u{EFFFF}]";
const XML_NAME = `${XML_NAME_START}(?:${XML_NAME_START}|[-.0-9\\u00B7\\u0300-\\u036F\\u203F-\\u2040])*`;
const XML_OPEN_TAG = new RegExp(`^<(${XML_NAME})`, "u");
const XML_CLOSE_TAG = new RegExp(`^</(${XML_NAME})\\s*>`, "u");
const XML_ATTRIBUTE = new RegExp(`^\\s+(${XML_NAME})\\s*=\\s*(?:"([^"<]*)"|'([^'<]*)')`, "u");
type Xml = { tag: string; attrs: Record<string, string>; children: Xml[]; text: string };
function decodeEntities(value: string): string {
  if (/&(?!(?:amp|lt|gt|quot|apos|#\d+|#x[\da-fA-F]+);)/.test(value)) throw new Error("invalid XML entity");
  return value.replace(/&(#x[\da-fA-F]+|#\d+|amp|lt|gt|quot|apos);/g, (_, entity: string) => {
    if (entity.startsWith("#")) {
      const code = parseInt(entity.slice(entity[1] === "x" ? 2 : 1), entity[1] === "x" ? 16 : 10);
      if (!(code === 9 || code === 10 || code === 13 || (code >= 0x20 && code <= 0xd7ff) || (code >= 0xe000 && code <= 0xfffd) || (code >= 0x10000 && code <= 0x10ffff))) throw new Error("invalid XML character");
      return String.fromCodePoint(code);
    }
    return ({ amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" } as Record<string, string>)[entity]!;
  });
}
function parseXml(text: string): Xml {
  if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f\ufffe\uffff\ud800-\udfff]/u.test(text)) throw new Error("invalid XML character");
  text = text.replace(/\r\n?/g, "\n");
  const document: Xml = { tag: "", attrs: {}, children: [], text: "" };
  const stack = [document];
  let position = 0;
  while (position < text.length) {
    const rest = text.slice(position);
    if (rest.startsWith("<!--")) {
      const end = text.indexOf("-->", position + 4), comment = text.slice(position + 4, end);
      if (end < 0 || comment.includes("--") || comment.endsWith("-")) throw new Error("invalid XML comment");
      position = end + 3; continue;
    }
    if (rest.startsWith("<?")) {
      const end = text.indexOf("?>", position + 2); if (end < 0) throw new Error("invalid XML instruction");
      position = end + 2; continue;
    }
    if (rest.startsWith("<![CDATA[")) {
      const end = text.indexOf("]]>", position + 9); if (end < 0) throw new Error("invalid XML CDATA");
      stack.at(-1)!.text += text.slice(position + 9, end); position = end + 3; continue;
    }
    if (rest.startsWith("</")) {
      const match = XML_CLOSE_TAG.exec(rest);
      if (!match || stack.length === 1 || stack.pop()!.tag !== match[1]) throw new Error("invalid XML closing tag");
      position += match[0].length; continue;
    }
    if (rest.startsWith("<")) {
      const match = XML_OPEN_TAG.exec(rest); if (!match) throw new Error("invalid XML opening tag");
      const node: Xml = { tag: match[1]!, attrs: {}, children: [], text: "" };
      position += match[0].length;
      while (true) {
        const remaining = text.slice(position);
        const close = /^\s*(\/?>)/.exec(remaining);
        if (close) {
          position += close[0].length; stack.at(-1)!.children.push(node);
          if (close[1] === ">") stack.push(node); break;
        }
        const attribute = XML_ATTRIBUTE.exec(remaining);
        if (!attribute || Object.hasOwn(node.attrs, attribute[1]!)) throw new Error("invalid XML attribute");
        const raw = attribute[2] ?? attribute[3]!;
        node.attrs[attribute[1]!] = decodeEntities(raw.replace(/[\n\r\t]/g, " ")); position += attribute[0].length;
      }
      continue;
    }
    const end = text.indexOf("<", position);
    const raw = text.slice(position, end < 0 ? text.length : end);
    if (raw.includes("]]>")) throw new Error("invalid XML text");
    stack.at(-1)!.text += decodeEntities(raw); position += raw.length;
  }
  if (stack.length !== 1 || document.children.length !== 1 || document.text.trim()) throw new Error("invalid XML document");
  return document.children[0]!;
}
function decodePage(page: Xml): Xml {
  const model = page.children.find(node => node.tag === "mxGraphModel");
  if (model) return model;
  try { return parseXml(decodeURIComponent(inflateRawSync(Buffer.from(page.text.trim(), "base64"), { maxOutputLength: MAX_EXPANDED_PAGE_BYTES }).toString())); }
  catch { throw new Error(OLD_MALFORMED); }
}
type Cell = { metadata: Xml; cell: Xml; wrapped: boolean; id: string };
const styles = (cell: Xml): Record<string, string> => Object.fromEntries((cell.attrs.style ?? "").split(";").filter(Boolean).map(part => {
  const equals = part.indexOf("="); return equals < 0 ? [part, ""] : [part.slice(0, equals), part.slice(equals + 1)];
}));
class Drawing {
  xml: Xml; model: Xml; cells: Cell[] = []; malformed: Xml[] = []; byId: Map<string, Cell>; elements: Cell[];
  constructor(text: string) {
    this.xml = parseXml(text);
    const pages = this.xml.children.filter(node => node.tag === "diagram");
    if (pages.length > 1) throw new Error(OLD_MALFORMED);
    this.model = pages[0] ? decodePage(pages[0]) : this.xml;
    const root = this.model.children.find(node => node.tag === "root");
    if (!root) throw new Error(OLD_MALFORMED);
    for (const node of root.children) {
      const wrapped = node.tag === "object";
      const inner = wrapped ? node.children.filter(child => child.tag === "mxCell") : [node];
      if (wrapped && inner.length !== 1) { this.malformed.push(node); continue; }
      if (inner[0]?.tag === "mxCell") this.cells.push({ metadata: node, cell: inner[0], wrapped, id: node.attrs.id ?? "" });
    }
    this.byId = new Map(this.cells.map(cell => [cell.id, cell]));
    this.elements = this.cells.filter(e => (e.cell.attrs.vertex === "1" || e.cell.attrs.edge === "1") && !this.ancestors(e).some(a => styles(a.cell).shape === "table"));
  }
  ancestors(cell: Cell): Cell[] {
    const result: Cell[] = [], seen = new Set([cell.id]); let parent = cell.cell.attrs.parent;
    while (parent && this.byId.has(parent) && !seen.has(parent)) {
      seen.add(parent); const ancestor = this.byId.get(parent)!; result.push(ancestor); parent = ancestor.cell.attrs.parent;
    }
    return result;
  }
  layer(cell: Cell): string | undefined { return this.ancestors(cell).find(a => (OLD_LAYERS as readonly string[]).includes(a.id))?.id; }
  rows(cell: Cell): string[] { return styles(cell.cell).shape !== "table" ? [] : this.cells.filter(other => this.ancestors(other).includes(cell) && other.cell.attrs.value).map(other => other.cell.attrs.value!); }
}
// Copied from e2b4125 kit/tools/diagram-delta.ts.
function oldProject(d: Drawing): string[] {
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
// ---- End of pre-migration code ----

const block = (pairs: string) => pairs ? `@{ ${pairs} }` : "@{ }";
function labelOf(e: Cell): string { return e.metadata.attrs.label ?? e.metadata.attrs.value ?? ""; }
function dataOf(e: Cell): Record<string, string> {
  if (!e.wrapped) return {};
  const { id: _id, label, value, ...pairs } = e.metadata.attrs;
  // `value` is the label only when `label` is absent; otherwise it is plain metadata.
  return label === undefined || value === undefined ? pairs : { ...pairs, value };
}
function edgeKind(style: Record<string, string>): string | undefined {
  if (style.dashed !== "1") return undefined;
  const first = Number((style.dashPattern ?? "").trim().split(/\s+/)[0]);
  return style.dashPattern !== undefined && Number.isFinite(first) && first <= 2 ? "observe" : "async";
}
function category(d: Drawing, e: Cell, layer: string | undefined): string | undefined {
  const style = styles(e.cell), found = CATEGORY_BY_PALETTE[`${(style.fillColor ?? "").toLowerCase()}|${(style.strokeColor ?? "").toLowerCase()}`];
  // The old retiring layer style forced the legend palette, so it says nothing about a retiring element's category.
  if (found === "legend" && layer === "retiring" && e.metadata.attrs.kind !== "legend") return undefined;
  return found;
}
function convert(d: Drawing): string {
  const lines = ["flowchart LR"], classes = new Map<string, string[]>();
  const addClass = (id: string, name: string | undefined) => { if (name) classes.set(name, [...classes.get(name) ?? [], id]); };
  const vertices = d.elements.filter(e => e.cell.attrs.edge !== "1"), edges = d.elements.filter(e => e.cell.attrs.edge === "1");
  const vertexIds = new Set(vertices.map(e => e.id));
  const children = (id: string) => vertices.filter(v => v.cell.attrs.parent === id);
  const emit = (e: Cell, indent: string) => {
    const layer = d.layer(e), style = styles(e.cell), table = style.shape === "table", label = labelOf(e), data = dataOf(e);
    if (!table && children(e.id).length) {
      lines.push(`${indent}subgraph ${e.id}["${encodeLabel(label)}"]`);
      for (const child of children(e.id)) emit(child, indent + "  ");
      lines.push(`${indent}end`, `${indent}${e.id}${block(serializeData(data))}`);
    } else {
      const shape = table ? "rect" : (style.shape ?? "").startsWith("cylinder") ? "cyl" : style.rounded === "1" ? "rounded" : "rect";
      const pairs = table ? { ...data, table: "true" } : data;
      lines.push(`${indent}${e.id}${block(serializeData(pairs, shape, table ? [label, ...d.rows(e)].join("\n") : label))}`);
    }
    if (layer === "intended" || layer === "retiring") addClass(e.id, layer);
    addClass(e.id, category(d, e, layer));
  };
  for (const v of vertices) if (!vertexIds.has(v.cell.attrs.parent ?? "")) emit(v, "  ");
  for (const e of edges) {
    const label = labelOf(e), layer = d.layer(e);
    lines.push(`  ${e.cell.attrs.source ?? ""} ${e.id}@-->${label ? `|"${encodeLabel(label)}"|` : ""} ${e.cell.attrs.target ?? ""}`, `  ${e.id}${block(serializeData(dataOf(e)))}`);
    addClass(e.id, edgeKind(styles(e.cell)));
    if (layer === "intended" || layer === "retiring") addClass(e.id, layer);
  }
  for (const definition of c.CLASS_DEFS) {
    const name = definition.split(" ")[1]!, members = classes.get(name);
    if (members) lines.push(`  class ${members.join(",")} ${name}`);
  }
  lines.push(...c.CLASS_DEFS.map(line => `  ${line}`));
  return lines.join("\n") + "\n";
}
function blocks(lines: string[]): string[] {
  const result: string[] = [];
  for (const line of lines) if (line.startsWith("  row | ") && result.length) result[result.length - 1] += "\n" + line; else result.push(line);
  return result.sort();
}
function unifiedDiff(before: string[], after: string[], from: string, to: string): string {
  const a = before.flatMap(b => b.split("\n")), b = after.flatMap(x => x.split("\n"));
  const lengths = Array.from({ length: a.length + 1 }, () => new Uint32Array(b.length + 1));
  for (let i = a.length - 1; i >= 0; i--) for (let j = b.length - 1; j >= 0; j--) lengths[i]![j] = a[i] === b[j] ? lengths[i + 1]![j + 1]! + 1 : Math.max(lengths[i + 1]![j]!, lengths[i]![j + 1]!);
  const out = [`--- ${from}`, `+++ ${to}`, `@@ -1,${a.length} +1,${b.length} @@`]; let i = 0, j = 0;
  while (i < a.length || j < b.length) {
    if (i < a.length && j < b.length && a[i] === b[j]) { out.push(` ${a[i++]}`); j++; }
    else if (i < a.length && (j === b.length || lengths[i + 1]![j]! >= lengths[i]![j + 1]!)) out.push(`-${a[i++]}`);
    else out.push(`+${b[j++]}`);
  }
  return out.join("\n");
}
function scan(dir: string, pattern: string): string[] {
  return [...new Bun.Glob(pattern).scanSync({ cwd: dir, onlyFiles: true, followSymlinks: false })].map(file => `${dir}/${file}`).sort();
}
function rewritePlan(text: string): string {
  const lines = text.split("\n"), bare = (line: string) => line.replace(/\r$/, "");
  let inFrontmatter = bare(lines[0] ?? "") === "---", inAreas = false, inDelta = false;
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index]!;
    if (inFrontmatter && index > 0) {
      if (bare(line) === "---") { inFrontmatter = false; continue; }
      if (/^areas\s*:/.test(line)) inAreas = true;
      // Block list items may sit at column 0 (`- diagram:…`) or be indented.
      else if (!/^(?:\s|-(?:\s|$))/.test(line)) inAreas = false;
      if (inAreas) lines[index] = line.replace(/\.drawio(?=#)/g, ".mmd");
      continue;
    }
    if (line.replace(/\r$/, "") === c.ARCHITECTURE_HEADING) { inDelta = true; continue; }
    if (inDelta && line.startsWith("#")) inDelta = false;
    // References carry `#<id>`; the section's `- diagrams:` list names whole files.
    if (inDelta) lines[index] = /^- diagrams:/.test(line) ? line.replace(/\.drawio(?=,|\s|$)/g, ".mmd") : line.replace(/\.drawio(?=#)/g, ".mmd");
  }
  return lines.join("\n");
}
function frozen(file: string, plans?: string): boolean {
  const paths = c.MIGRATION_FROZEN_PATHS, directories = file.split("/").slice(0, -1);
  return directories.includes(paths.directory)
    || directories.some((part, index) => part === paths.plansSegment && directories[index + 1] === paths.plansDirectory)
    || file.startsWith(`${paths.repoDirectory}/`)
    || (paths.files as readonly string[]).includes(basename(file))
    || !!plans && file.startsWith(`${plans}/${paths.plansDirectory}/`);
}
// Return the destination's character range, but validate the enclosing inline link too.
function markdownDestination(text: string, offset: number, inline: boolean): { start: number; end: number; after: number } | undefined {
  let position = offset, start = offset, end: number;
  if (text[position] === "<") {
    start = ++position;
    while (position < text.length && text[position] !== ">") {
      if (/[\n\r<]/.test(text[position]!)) return;
      if (text[position] === "\\" && /[!-/:-@[-`{-~]/.test(text[position + 1] ?? "")) position++;
      position++;
    }
    if (text[position] !== ">") return;
    end = position++;
  } else {
    let depth = 0;
    while (position < text.length) {
      const char = text[position]!;
      if (char === "\\" && /[!-/:-@[-`{-~]/.test(text[position + 1] ?? "")) { position += 2; continue; }
      if (/\s/.test(char)) break;
      if (char === "<" || char.charCodeAt(0) < 32) return;
      if (char === "(") depth++;
      else if (char === ")") { if (!depth) break; depth--; }
      position++;
    }
    if (depth) return;
    end = position;
  }
  if (!inline) return position === text.length || /\s/.test(text[position]!) ? { start, end, after: position } : undefined;
  const separator = position;
  while (/[ \t\r\n]/.test(text[position] ?? "")) position++;
  if (text[position] === ")") return { start, end, after: position + 1 };
  // A title must be separated from the destination; its own delimiters do not belong to the path.
  const opener = text[position], closer = opener === "(" ? ")" : opener;
  if (position === separator || !opener || !['"', "'", "("].includes(opener)) return;
  position++;
  while (position < text.length && text[position] !== closer) {
    if (opener === "(" && text[position] === "(") return;
    if (text[position] === "\\" && /[!-/:-@[-`{-~]/.test(text[position + 1] ?? "")) position++;
    position++;
  }
  if (text[position] !== closer) return;
  position++;
  while (/[ \t\r\n]/.test(text[position] ?? "")) position++;
  return text[position] === ")" ? { start, end, after: position + 1 } : undefined;
}
function rewriteDoc(text: string, file: string, migrated: Set<string>): string {
  const repoint = (destination: string, base: string) => {
    const path = destination.split(/[?#]/, 1)[0]!;
    if (!path || /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(path)) return destination;
    let decoded: string;
    try { decoded = decodeURIComponent(path.replace(/\\([!-/:-@[-`{-~])/g, "$1")); } catch { return destination; }
    const target = decoded.startsWith("/") ? resolve(".", decoded.slice(1)) : resolve(base, decoded);
    if (!migrated.has(target)) return destination;
    // Preserve the original path spelling (including an encoded dot), query and fragment.
    const rewritten = path.replace(/(\.|%2e)(?:d|%64)(?:r|%72)(?:a|%61)(?:w|%77)(?:i|%69)(?:o|%6f)$/i,
      (_suffix, dot) => dot + c.EXTENSION.slice(1));
    return rewritten + destination.slice(path.length);
  };
  // The regex finds token starts only; the scanner handles destination escapes and nesting.
  const tokens = /(^ {0,3}(`{3,}|~{3,})[^\n]*\n[\s\S]*?^ {0,3}\2[ \t]*$)|(`+)([^\n]*?)\3|(\]\([ \t\r\n]*)|(^ {0,3}\[[^\]\n]+\]:[ \t]*(?:\r?\n[ \t]*)?)/gm;
  const pieces: string[] = [];
  let copied = 0;
  for (let token; (token = tokens.exec(text));) {
    if (token[1]) continue;
    let start: number, end: number, rewritten: string;
    if (token[3]) {
      start = token.index; end = tokens.lastIndex;
      rewritten = `${token[3]}${repoint(token[4]!, ".")}${token[3]}`;
    } else {
      const destination = markdownDestination(text, tokens.lastIndex, !!token[5]);
      if (!destination) continue;
      ({ start, end } = destination);
      rewritten = repoint(text.slice(start, end), dirname(file));
      tokens.lastIndex = destination.after;
    }
    pieces.push(text.slice(copied, start), rewritten);
    copied = end;
  }
  pieces.push(text.slice(copied));
  return pieces.join("");
}
type Options = { root: string; plans?: string; docs?: string; keep: boolean };
function parseArgs(args: string[]): Options {
  const options: Partial<Options> & { keep: boolean } = { keep: false };
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]!, value = () => { const v = args[++i]; if (v === undefined || v.startsWith("--")) throw new Error(`${arg} needs a value`); return v.replace(/\/+$/, ""); };
    if (arg === "--root") options.root = value();
    else if (arg === "--plans") options.plans = value();
    else if (arg === "--docs") {
      if (options.docs !== undefined) throw new Error("--docs may be passed only once");
      options.docs = value();
    }
    else if (arg === "--keep") options.keep = true;
    else throw new Error(`unknown argument: ${arg}`);
  }
  if (!options.root) throw new Error("--root is required");
  for (const dir of [options.root, options.plans, options.docs]) if (dir !== undefined && (!c.safeRoot(dir) || !statSync(dir, { throwIfNoEntry: false })?.isDirectory())) throw new Error(`not a project-relative directory: ${dir}`);
  return options as Options;
}
export function main(args = Bun.argv.slice(2)): number {
  const usage = "usage: drawio-to-mermaid.ts --root <diagrams root> [--plans <dir>] [--docs <dir>] [--keep]";
  let options: Options;
  const docFiles: string[] = [];
  try {
    options = parseArgs(args);
    const repo = realpathSync(".");
    // Every path the rewrite compares (root, plans, docs) lives in one canonical repository frame.
    const root = realpathWithinRoot(repo, options.root);
    if (!root) throw new Error(`diagrams root escapes repository: ${options.root}`);
    options.root = relative(repo, root) || ".";
    if (options.plans) {
      const canonical = realpathWithinRoot(repo, options.plans);
      if (!canonical) throw new Error(`plans directory escapes repository: ${options.plans}`);
      options.plans = relative(repo, canonical);
    }
    if (options.docs) {
      if (!realpathWithinRoot(repo, options.docs)) throw new Error(`docs directory escapes repository: ${options.docs}`);
      for (const file of scan(options.docs, "**/*.md")) {
        const canonical = realpathWithinRoot(repo, file);
        if (!canonical) throw new Error(`docs file escapes repository: ${file}`);
        docFiles.push(relative(repo, canonical));
      }
    }
  } catch (error) { console.error(`${(error as Error).message}\n${usage}`); return 1; }
  const sources = scan(options.root, "**/*.drawio").sort();
  const generated: string[] = [], outputs: { source: string; target: string; text: string; count: number }[] = [];
  const errors: string[] = [], keywords: string[] = [], mismatches: string[] = [];
  for (const source of sources) {
    let drawing: Drawing;
    try { drawing = new Drawing(readFileSync(source, "utf8")); } catch (error) { errors.push(`${source}: ${(error as Error).message}`); continue; }
    if (drawing.xml.attrs.generator === GENERATED) { generated.push(source); continue; }
    if (drawing.malformed.length) { errors.push(`${source}: object must wrap exactly one mxCell`); continue; }
    const target = source.replace(/\.drawio$/, c.EXTENSION);
    if (existsSync(target)) { errors.push(`${source}: ${target} already exists`); continue; }
    const misread = drawing.elements.filter(e => c.ID_PATTERN.test(e.id) && !c.mermaidId(e.id));
    if (misread.length) { keywords.push(...misread.map(e => `${source}#${e.id}`)); continue; }
    let text: string, after: Diagram;
    try { text = convert(drawing); after = new Diagram(text); } catch (error) { errors.push(`${source}: ${(error as Error).message}`); continue; }
    const before = blocks(oldProject(drawing)), now = blocks(project(after));
    if (JSON.stringify(before) !== JSON.stringify(now)) mismatches.push(unifiedDiff(before, now, `${source} (draw.io projection)`, `${target} (Mermaid projection)`));
    outputs.push({ source, target, text, count: drawing.elements.length });
  }
  if (keywords.length) console.error(`ids Mermaid misreads (keywords such as end or end-user, or --, -. and .-; rename them before converting, plans cite ids):\n${keywords.map(k => `  ${k}`).join("\n")}`);
  if (errors.length) console.error(`conversion errors:\n${errors.map(e => `  ${e}`).join("\n")}`);
  if (mismatches.length) console.error(`equivalence gate failed (sorted projection blocks):\n${mismatches.join("\n")}`);
  if (keywords.length || errors.length || mismatches.length) { console.error("drawio-to-mermaid: nothing written"); return 1; }

  for (const output of outputs) writeFileSync(output.target, output.text);
  if (!options.keep) for (const output of outputs) rmSync(output.source);
  for (const file of generated) rmSync(file);
  const plans: string[] = [];
  if (options.plans) for (const file of scan(options.plans, "**/*.md")) {
    if (frozen(file, options.plans)) continue;
    const text = readFileSync(file, "utf8"), rewritten = rewritePlan(text);
    if (rewritten !== text) { writeFileSync(file, rewritten); plans.push(file); }
  }
  const docs: string[] = [];
  if (options.docs) {
    const migrated = new Set([...outputs.map(output => output.source), ...generated].map(source => resolve(source)));
    for (const file of docFiles) {
      if (frozen(file, options.plans)) continue;
      const text = readFileSync(file, "utf8"), rewritten = rewriteDoc(text, file, migrated);
      if (rewritten !== text) { writeFileSync(file, rewritten); docs.push(file); }
    }
  }
  console.log("drawio-to-mermaid report");
  for (const output of outputs) console.log(`  converted: ${output.source} → ${output.target} (${output.count} elements; projection equal)${options.keep ? "; source kept" : ""}`);
  for (const file of generated) console.log(`  deleted generated ERD: ${file} (regenerate with bun tools/erd-generate.ts)`);
  for (const file of plans) console.log(`  rewrote plan references: ${file}`);
  for (const file of docs) console.log(`  rewrote doc references: ${file}`);
  if (!outputs.length && !generated.length && !plans.length && !docs.length) console.log("  nothing to convert");

  let findings: string[] = [];
  try {
    const config = settings(), mapped = decisions();
    findings = outputs.flatMap(output => validate(output.target, config, mapped).failures);
  } catch (error) { findings = [`diagram-check not run: ${(error as Error).message}`]; }
  if (findings.length) {
    console.log(`diagram-check findings (files were written; fix and re-run bun tools/diagram-check.ts):\n${findings.map(f => `  ${f}`).join("\n")}`);
    return 2;
  }
  console.log(`diagram-check: ${outputs.length} converted files clean`);
  return 0;
}
if (import.meta.main) process.exit(main());
