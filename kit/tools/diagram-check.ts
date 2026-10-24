#!/usr/bin/env bun
// Read-only except for the explicit --normalize operation. Run from the project root.
import { existsSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { basename, isAbsolute, relative, sep } from "node:path";
import { inflateRawSync } from "node:zlib";
import * as c from "./constants/diagrams.ts";
import { realpathWithinRoot } from "./root-containment.ts";

export type Xml = { tag: string; attrs: Record<string, string>; children: Xml[]; text: string };
function decode(value: string): string {
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
// A small XML reader, not an HTML parser: quoted attributes, entities, comments and CDATA;
// rejects DTDs/external entities and malformed syntax rather than silently repairing it.
export function parseXml(text: string): Xml {
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
      const match = c.XML_CLOSE_TAG.exec(rest);
      if (!match || stack.length === 1 || stack.pop()!.tag !== match[1]) throw new Error("invalid XML closing tag");
      position += match[0].length; continue;
    }
    if (rest.startsWith("<")) {
      const match = c.XML_OPEN_TAG.exec(rest); if (!match) throw new Error("invalid XML opening tag");
      const node: Xml = { tag: match[1]!, attrs: {}, children: [], text: "" };
      position += match[0].length;
      while (true) {
        const remaining = text.slice(position);
        const close = /^\s*(\/?>)/.exec(remaining);
        if (close) {
          position += close[0].length; stack.at(-1)!.children.push(node);
          if (close[1] === ">") stack.push(node); break;
        }
        const attribute = c.XML_ATTRIBUTE.exec(remaining);
        if (!attribute || Object.hasOwn(node.attrs, attribute[1]!)) throw new Error("invalid XML attribute");
        const raw = attribute[2] ?? attribute[3]!;
        node.attrs[attribute[1]!] = decode(raw.replace(/[\n\r\t]/g, " ")); position += attribute[0].length;
      }
      continue;
    }
    const end = text.indexOf("<", position);
    const raw = text.slice(position, end < 0 ? text.length : end);
    if (raw.includes("]]>")) throw new Error("invalid XML text");
    stack.at(-1)!.text += decode(raw); position += raw.length;
  }
  if (stack.length !== 1 || document.children.length !== 1 || document.text.trim()) throw new Error("invalid XML document");
  return document.children[0]!;
}
const escape = (value: string) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
export function serialize(node: Xml, indent = ""): string {
  const start = `${indent}<${node.tag}${Object.entries(node.attrs).map(([key, value]) => ` ${key}="${escape(value).replace(/\n/g, "&#10;").replace(/\r/g, "&#13;").replace(/\t/g, "&#9;")}"`).join("")}`;
  if (!node.children.length && !node.text.trim()) return start + "/>";
  if (!node.children.length) return `${start}>${escape(node.text)}</${node.tag}>`;
  return `${start}>\n${node.children.map(child => serialize(child, indent + "  ")).join("\n")}\n${indent}</${node.tag}>`;
}
export function decodePage(page: Xml): Xml {
  const model = page.children.find(node => node.tag === "mxGraphModel");
  if (model) return model;
  try { return parseXml(decodeURIComponent(inflateRawSync(Buffer.from(page.text.trim(), "base64"), { maxOutputLength: c.MAX_EXPANDED_PAGE_BYTES }).toString())); }
  catch { throw new Error(c.CHECK_REASONS[1]); }
}
export type Cell = { metadata: Xml; cell: Xml; wrapped: boolean; id: string; legend: boolean };
export const styles = (cell: Xml): Record<string, string> => Object.fromEntries((cell.attrs.style ?? "").split(";").filter(Boolean).map(part => {
  const equals = part.indexOf("="); return equals < 0 ? [part, ""] : [part.slice(0, equals), part.slice(equals + 1)];
}));
export class Drawing {
  xml: Xml; model: Xml; cells: Cell[] = []; malformed: Xml[] = []; byId: Map<string, Cell>; elements: Cell[];
  constructor(text: string) {
    this.xml = parseXml(text);
    const page = this.xml.children.find(node => node.tag === "diagram");
    this.model = page ? decodePage(page) : this.xml;
    const root = this.model.children.find(node => node.tag === "root");
    if (!root) throw new Error(c.CHECK_REASONS[1]);
    for (const node of root.children) {
      const wrapped = node.tag === "object";
      const inner = wrapped ? node.children.filter(child => child.tag === "mxCell") : [node];
      if (wrapped && inner.length !== 1) { this.malformed.push(node); continue; }
      if (inner[0]?.tag === "mxCell") this.cells.push({ metadata: node, cell: inner[0], wrapped, id: node.attrs.id ?? "", legend: node.attrs.kind === "legend" });
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
  layer(cell: Cell): string | undefined { return this.ancestors(cell).find(a => (c.LAYERS as readonly string[]).includes(a.id))?.id; }
  rows(cell: Cell): string[] { return styles(cell.cell).shape !== "table" ? [] : this.cells.filter(other => this.ancestors(other).includes(cell) && other.cell.attrs.value).map(other => other.cell.attrs.value!); }
  box(cell: Cell): number[] {
    const geometry = cell.cell.children.find(node => node.tag === "mxGeometry");
    const values = ["x", "y", "width", "height"].map(key => Number(geometry?.attrs[key] ?? 0));
    for (const a of this.ancestors(cell)) {
      const g = a.cell.children.find(node => node.tag === "mxGeometry"); values[0]! += Number(g?.attrs.x ?? 0); values[1]! += Number(g?.attrs.y ?? 0);
    }
    return values;
  }
}
export type Settings = { root: string; components: string[]; tracking: "none" | "local" | "mcp" };
export function settings(): Settings {
  const config = JSON.parse(readFileSync(c.CONFIG_PATH, "utf8"));
  if (config.diagrams?.mode !== "drawio" || !c.safeDiagramsRoot(config.diagrams.root) || !Array.isArray(config.diagrams.components)
    || config.diagrams.components.some((p: unknown) => !c.safeRoot(p))) throw new Error("invalid drawio settings");
  const tracking = config.tracking?.mode ?? "none";
  if (!Object.hasOwn(c.INTENT_PATTERNS, tracking)) throw new Error("invalid tracking mode");
  return { root: config.diagrams.root, components: config.diagrams.components, tracking };
}
// Diagram decisions live in the architecture README's map; a project that numbered decisions before may also keep a frozen legacy map. A number is never reused across them.
export function decisions(): Set<string> {
  const ids = [c.DECISION_MAP, ...[c.DECISION_ARCHIVE].filter(file => existsSync(file))].flatMap(file => [...readFileSync(file, "utf8").matchAll(/^\|\s*(D\d+)\s*\|/gm)].map(m => m[1]!));
  const reused = [...new Set(ids.filter((id, index) => ids.indexOf(id) !== index))];
  if (reused.length) throw new Error(`${c.DECISION_REUSED}: ${reused.join(", ")}`);
  return new Set(ids);
}
export function validIntent(value: string | undefined, config: Settings): boolean { return c.INTENT_PATTERNS[config.tracking].test(value ?? ""); }
export function diagramFile(file: string, config: Settings): string {
  if (!c.safeDiagramsRoot(config.root)) throw new Error("invalid drawio settings");
  const home = realpathWithinRoot(".", config.root);
  if (!home) throw new Error(c.CHECK_REASONS[1]);
  const resolved = realpathWithinRoot(home, file);
  if (!resolved) throw new Error(c.CHECK_REASONS[1]);
  return resolved;
}
export function readDiagram(file: string, config: Settings): string {
  return readFileSync(diagramFile(file, config), "utf8");
}
export function frontmatter(text: string): Record<string, string[]> {
  const lines = text.split(/\r?\n/); if (lines[0] !== "---") return {};
  const result: Record<string, string[]> = {}; let key: string | undefined;
  const clean = (value: string) => value.replace(/'(?:[^']|'')*'|"(?:[^"\\]|\\.)*"|(?:^|\s)#.*/g, token => /^\s*#/.test(token) ? "" : token).trim();
  const unquote = (value: string) => {
    value = value.trim();
    if (/^'(?:[^']|'')*'$/.test(value)) return value.slice(1, -1).replace(/''/g, "'");
    if (/^"(?:[^"\\]|\\.)*"$/.test(value)) return value.slice(1, -1).replace(/\\(["\\])/g, "$1");
    if (/^['"]/.test(value)) throw new Error(c.INVALID_FRONTMATTER_ITEM);
    return value;
  };
  const inline = (value: string) => {
    const items: string[] = [];
    for (let offset = 0; offset < value.length;) {
      const match = c.FRONTMATTER_INLINE_ITEM.exec(value.slice(offset));
      if (!match || !match[0]) throw new Error(c.INVALID_FRONTMATTER_ITEM);
      const item = match[1] ?? match[2] ?? match[3];
      if (item?.trim()) items.push(unquote(item));
      offset += match[0].length;
    }
    return items;
  };
  for (const line of lines.slice(1)) {
    if (line === "---") return result;
    const match = /^([\w-]+):\s*(.*)$/.exec(line);
    if (match) {
      key = ["areas", "components"].includes(match[1]!) ? match[1] : undefined; if (!key) continue;
      const value = clean(match[2]!); result[key] = value.startsWith("[") && value.endsWith("]") ? inline(value.slice(1, -1)) : value ? [unquote(value)] : [];
    } else if (key && /^\s*- /.test(line)) result[key]!.push(unquote(clean(line.replace(/^\s*- /, ""))));
  }
  throw new Error("unterminated frontmatter");
}
export function validate(file: string, config: Settings, mapped = decisions()): { failures: string[]; count: number } {
  let d: Drawing;
  const failures: string[] = [];
  const fail = (number: number, id?: string, reason = c.CHECK_REASONS[number]) => failures.push(`${file}: check ${number}: ${reason}${id === undefined ? "" : `: ${id}`}`);
  try { d = new Drawing(readDiagram(file, config)); } catch { fail(1); return { failures, count: 0 }; }
  const pages = d.xml.children.filter(n => n.tag === "diagram");
  if (d.xml.tag !== "mxfile" || d.xml.attrs.compressed !== "false" || pages.length !== 1 || pages[0]!.children.filter(n => n.tag === "mxGraphModel").length !== 1) fail(1);
  const ids = d.cells.map(e => e.id), defaultCell = d.byId.get("1");
  const prefix = ["0", ...(defaultCell ? ["1"] : []), ...c.LAYERS];
  if (JSON.stringify(ids.slice(0, prefix.length)) !== JSON.stringify(prefix) || JSON.stringify(ids.filter(id => (c.LAYERS as readonly string[]).includes(id))) !== JSON.stringify(c.LAYERS)
    || c.LAYERS.some(layer => d.byId.get(layer)?.cell.attrs.parent !== "0")
    || (defaultCell && (defaultCell.wrapped || defaultCell.cell.attrs.parent !== "0" || ["vertex", "edge", "value"].some(k => defaultCell.cell.attrs[k])))
    || d.cells.some(e => !prefix.includes(e.id) && (!d.layer(e) || d.ancestors(e).at(-1)?.id !== "0"))) fail(2);
  const invalid = new Set(ids.filter((id, i) => ids.indexOf(id) !== i));
  for (const e of d.cells) {
    if (d.ancestors(e).some(a => styles(a.cell).shape === "table")) {
      if (e.wrapped || e.cell.attrs.vertex !== "1" || e.cell.attrs.edge === "1" || !["tableRow", "partialRectangle"].includes(styles(e.cell).shape ?? "")) invalid.add(e.id);
    } else if (d.elements.includes(e)) {
      if (!c.ID_PATTERN.test(e.id) || !e.wrapped || "id" in e.cell.attrs || "value" in e.cell.attrs) { invalid.add(e.id); continue; }
      if (e.legend) { if (!e.metadata.attrs.label) invalid.add(e.id); continue; }
      const required = ["label", "component"];
      if (["as-built", "retiring"].includes(d.layer(e) ?? "")) required.push("source");
      if (["intended", "retiring"].includes(d.layer(e) ?? "")) required.push("decision", "intent");
      if (required.some(k => !e.metadata.attrs[k]) || ![...config.components, "platform", "external"].includes(e.metadata.attrs.component ?? "")) invalid.add(e.id);
    }
  }
  for (const id of invalid) fail(3, id);
  for (const node of d.malformed) fail(3, node.attrs.id ?? "<no id>", c.MALFORMED_OBJECT);
  for (const e of d.elements) {
    const metadata = e.metadata.attrs, layer = d.layer(e) ?? "", style = styles(e.cell);
    if (!e.legend) {
      if ("source" in metadata) for (const token of metadata.source!.split(",")) {
        const source = token.trim().replace(/:L\d+$/, "");
        try {
          const suffix = relative(realpathSync("."), realpathSync(source));
          if (!source || isAbsolute(source) || source.split(/[\\/]/).includes("..") || suffix === ".." || suffix.startsWith(`..${sep}`) || isAbsolute(suffix) || !existsSync(source)) throw new Error();
        } catch { fail(4, e.id); break; }
      }
      if ("decision" in metadata && !mapped.has(metadata.decision!)) fail(5, e.id);
      if ("intent" in metadata && !validIntent(metadata.intent, config)) fail(6, e.id);
    }
    if ((layer === "as-built" && "opacity" in style) || Object.entries(c.LAYER_STYLES[layer] ?? {}).some(([k, v]) => style[k] !== v)) fail(7, e.id);
    if (e.cell.attrs.edge === "1" && ["source", "target"].some(k => {
      const endpoint = d.byId.get(e.cell.attrs[k] ?? ""); return !endpoint || endpoint.cell.attrs.vertex !== "1" || !(c.ENDPOINT_LAYERS[layer] ?? []).includes(d.layer(endpoint) ?? "");
    })) fail(8, e.id);
  }
  const vertices = d.elements.filter(e => e.cell.attrs.vertex === "1"), overlap = new Set<string>();
  const finiteGeometry = vertices.every(vertex => d.box(vertex).every(Number.isFinite));
  if (!finiteGeometry) fail(9);
  for (const [i, a] of vertices.entries()) for (const b of vertices.slice(i + 1)) {
    if (d.layer(a) !== d.layer(b) || d.ancestors(a).includes(b) || d.ancestors(b).includes(a)) continue;
    const [x, y, w, h] = d.box(a) as [number, number, number, number], [bx, by, bw, bh] = d.box(b) as [number, number, number, number];
    if (x < bx + bw && bx < x + w && y < by + bh && by < y + h) { overlap.add(a.id); overlap.add(b.id); }
  }
  for (const id of overlap) fail(9, id);
  const width = Number(d.model.attrs.pageWidth ?? c.PAGE_WIDTH_LIMIT), height = Number(d.model.attrs.pageHeight ?? 0);
  if (!Number.isFinite(width) || width > c.PAGE_WIDTH_LIMIT) fail(10);
  if (!finiteGeometry || !Number.isFinite(height)) fail(10);
  for (const e of finiteGeometry ? vertices : []) {
    const [x, y, w, h] = d.box(e) as [number, number, number, number]; if (!(x >= 0 && y >= 0 && x + w <= width && y + h <= height)) fail(10, e.id);
  }
  for (const e of d.cells) {
    const font = styles(e.cell).fontSize; if (font !== undefined && !(Number(font) >= c.FONT_SIZE_FLOOR)) fail(11, e.id);
  }
  if (basename(file) === "system.drawio" && config.components.some(component => !d.elements.some(e => !e.legend && ["as-built", "retiring"].includes(d.layer(e) ?? "") && e.metadata.attrs.component === component))) fail(12);
  const legend = (e: Cell) => e.legend || d.ancestors(e).some(a => a.legend);
  for (const e of d.cells) {
    if (!(e.cell.attrs.edge === "1" || (e.wrapped && e.cell.attrs.vertex === "1"))) continue;
    if ((!e.legend && d.ancestors(e).some(a => a.legend)) || (e.cell.attrs.edge === "1" && ["source", "target"].some(k => {
      const endpoint = d.byId.get(e.cell.attrs[k] ?? ""); return endpoint && legend(endpoint) !== e.legend;
    }))) fail(13, e.id);
  }
  failures.sort((a, b) => Number(/: check (\d+):/.exec(a)![1]) - Number(/: check (\d+):/.exec(b)![1]));
  return { failures, count: d.elements.length };
}
export function diagramPaths(root: string): string[] {
  if (!realpathWithinRoot(".", root)) throw new Error(c.CHECK_REASONS[1]);
  return [...new Bun.Glob("**/*.drawio").scanSync({ cwd: root, onlyFiles: false, followSymlinks: false })].map(file => `${root}/${file}`).sort();
}
export function main(args = Bun.argv.slice(2)): number {
  const config = settings(); let paths = args;
  if (args[0] === "--normalize") {
    if (args.length !== 2) throw new Error("usage: diagram-check [paths] | --normalize <file>");
    const file = args[1]!;
    try {
      const destination = diagramFile(file, config), xml = parseXml(readFileSync(destination, "utf8"));
      for (const page of xml.children.filter(n => n.tag === "diagram")) { page.children = [decodePage(page)]; page.text = ""; }
      xml.attrs.compressed = "false"; writeFileSync(destination, serialize(xml) + "\n"); paths = [file];
    } catch { console.log(`${file}: check 1: ${c.CHECK_REASONS[1]}`); return 1; }
  } else if (args.some(arg => arg.startsWith("--"))) throw new Error("unknown diagram-check option");
  if (!paths.length) paths = diagramPaths(config.root);
  const mapped = decisions(); let count = 0; const failures: string[] = [];
  for (const file of paths) { const result = validate(file, config, mapped); count += result.count; failures.push(...result.failures); }
  if (failures.length) { console.log(failures.join("\n")); return 1; }
  console.log(`diagram-check: ${paths.length} files, ${count} elements checked`); return 0;
}
if (import.meta.main) try { process.exitCode = main(); } catch (error) { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; }
