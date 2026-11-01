#!/usr/bin/env bun
// Read-only Mermaid diagram parser and validator. Run from the project root.
import { existsSync, readFileSync, realpathSync } from "node:fs";
import { basename, isAbsolute, relative, sep } from "node:path";
import * as c from "./constants/diagrams.ts";
import { realpathWithinRoot } from "./root-containment.ts";

export type Layer = c.Layer;
export type Element = {
  id: string;
  type: "node" | "edge" | "group" | "entity" | "relation";
  label: string;
  shape?: string;
  from?: string; to?: string;
  parent?: string;
  classes: string[];
  data: Record<string, string>;
  rows: string[];
  line: number;
  rowLines: number[];
};
const has = (list: readonly string[], value: string | undefined) => value !== undefined && list.includes(value);
const ID = String.raw`[^\s@{}\[\]"|,:;]+`;
const QUOTED = String.raw`"([^"\\]*)"`;
const DATA = new RegExp(String.raw`^(${ID})@\{(.*)\}$`);
const GROUP = new RegExp(String.raw`^subgraph (${ID})\[${QUOTED}\]$`);
const EDGE = new RegExp(String.raw`^(${ID}) (${ID})@-->(?:\|${QUOTED}\|)? (${ID})$`);
const CLASS = new RegExp(String.raw`^class (${ID}(?:,${ID})*) (\S+)$`);
const MARKER = /^%% generated: (\S+) from .+; do not edit$/;
const ER_METADATA = new RegExp(String.raw`^%% @(${ID})(?: (.*))?$`);
const ENTITY = new RegExp(String.raw`^(${ID})\[${QUOTED}\] \{$`);
const RELATION = new RegExp(String.raw`^(${ID}) (\}o--\|\||\|o--\|\||\}o--o\{) (${ID}) : ${QUOTED}$`);
// Types and names are Mermaid attribute words or backtick-quoted; keys come from PK/FK/UK.
const ER_WORD = String.raw`\`[^\`]+\`|[^\s\`"?]+`;
const ATTRIBUTE_ROW = new RegExp(String.raw`^(${ER_WORD})\?? (${ER_WORD})(?: (?:PK|FK|UK)(?:, (?:PK|FK|UK))*)?(?: "[^"]*")?$`);
const erWord = (word: string) => word.startsWith("`") || (c.ER_ATTRIBUTE_WORD.test(word) && !c.ER_KEY_WORD.test(word));
const PAIR = /([a-z][a-zA-Z0-9_]*): (?:([a-z]+)|"([^"\\]*)")/y;
// Mermaid decodes `#quot;` and numeric `#<code>;` entities in labels and values; `encode` escapes a literal `#` that would read as one.
// Line breaks follow Mermaid's own pattern (`<br>`, `<br/>`, `<br />`, any case).
const decode = (value: string, label = false) => {
  const text = label ? value.replace(/<br\s*\/?>/gi, "\n") : value;
  return text.replace(/#(quot|\d+);/g, (code, name: string) => name === "quot" ? '"' : Number(name) <= 0x10ffff ? String.fromCodePoint(Number(name)) : code);
};
function encode(value: string, label: boolean): string {
  if (/[\\\r]/.test(value) || (!label && value.includes("\n"))) throw new Error(`unencodable Mermaid value: ${JSON.stringify(value)}`);
  const text = value.replace(/#(?=quot;|\d+;)/g, "#35;").replace(/"/g, "#quot;");
  return label ? text.replace(/\n/g, "<br/>") : text;
}
/** A label as it sits inside `"…"` in a node data block, an edge `|"…"|` or a group `["…"]`. */
export const encodeLabel = (text: string) => encode(text, true);
/** `shape: …, label: "…", k: "v"`: shape and label first, then the pairs in insertion order. */
export function serializeData(pairs: Record<string, string>, shape?: string, label?: string): string {
  const parts: string[] = [];
  if (shape !== undefined) parts.push(`shape: ${shape}`);
  if (label !== undefined) parts.push(`label: "${encode(label, true)}"`);
  for (const [key, value] of Object.entries(pairs)) {
    if (!/^[a-z][a-zA-Z0-9_]*$/.test(key)) throw new Error(`invalid Mermaid key: ${key}`);
    parts.push(`${key}: "${encode(value, key === "label")}"`);
  }
  return parts.join(", ");
}
type Pairs = { data: Record<string, string>; shape?: string; label?: string };
// `node` lifts shape and label out of the data; elsewhere they stay in data and fail check 3 as reserved keys.
function parsePairs(text: string, node: boolean): Pairs {
  const result: Pairs = { data: {} }, seen = new Set<string>();
  for (let offset = 0; offset < text.length;) {
    PAIR.lastIndex = offset; const match = PAIR.exec(text);
    if (!match) throw new Error("invalid data pair");
    const key = match[1]!, bare = match[2], quoted = match[3];
    if (seen.has(key)) throw new Error(`duplicate key ${key}`); seen.add(key);
    if ((bare !== undefined) !== (key === "shape")) throw new Error(`invalid value for ${key}`);
    if (node && key === "shape") { if (!has(c.SHAPES, bare)) throw new Error(`unknown shape ${bare}`); result.shape = bare; }
    else if (node && key === "label") result.label = decode(quoted!, true);
    else result.data[key] = bare ?? decode(quoted!, key === "label");
    offset += match[0].length;
    if (offset === text.length) break;
    if (!text.startsWith(", ", offset) || offset + 2 === text.length) throw new Error("invalid data pair separator");
    offset += 2;
  }
  return result;
}
function dataBlock(inner: string, node: boolean): Pairs {
  if (inner === "" || inner === " ") return { data: {} };
  if (!inner.startsWith(" ") || !inner.endsWith(" ")) throw new Error("invalid data block");
  return parsePairs(inner.slice(1, -1), node);
}
type Line = { text: string; number: number };
export class Diagram {
  readonly text: string;
  readonly kind: "flowchart" | "erDiagram";
  readonly direction?: "LR" | "TB";
  readonly generator?: string;
  readonly elements: Element[] = [];
  readonly byId = new Map<string, Element>();
  /** Flowchart `classDef` statement lines in order (check 7). */
  readonly classDefs: string[] = [];
  /** Ids named by `class` statements that no element defines (check 2). */
  readonly unresolvedClassIds: string[] = [];
  constructor(text: string) {
    this.text = text;
    const lines = text.split(/\r?\n/);
    try {
      if (MARKER.test(lines[0] ?? "")) {
        this.kind = "erDiagram"; this.generator = MARKER.exec(lines[0]!)![1];
        if (lines[1] !== "erDiagram") throw new Error("line 2: expected erDiagram");
        this.parseEr(lines);
      } else {
        this.kind = "flowchart";
        const statements = lines.map((line, index) => ({ text: line.replace(/^ +/, ""), number: index + 1 })).filter(line => line.text && !line.text.startsWith("%%"));
        const header = /^flowchart (LR|TB)$/.exec(statements[0]?.text ?? "");
        if (!header) throw new Error(`line ${statements[0]?.number ?? 1}: expected flowchart LR or flowchart TB`);
        this.direction = header[1] as "LR" | "TB";
        this.parseFlowchart(statements.slice(1));
      }
    } catch (error) { throw new Error(`${c.CHECK_REASONS[1]}: ${(error as Error).message}`); }
    for (const e of this.elements) if (!this.byId.has(e.id)) this.byId.set(e.id, e);
  }
  private parseFlowchart(statements: Line[]): void {
    let section = 1, pendingGroup: Element | undefined;
    const stack: Element[] = [], classes: [number, string[], string][] = [];
    for (let index = 0; index < statements.length; index++) {
      const { text, number } = statements[index]!, at = `line ${number}`;
      const fail = (reason: string): never => { throw new Error(`${at}: ${reason}`); };
      if (c.FLOWCHART_DIRECTION_TEXT.test(text)) fail("Mermaid reads `direction <dir>` anywhere on a line as a direction statement; reword it or write the space as #32;");
      const group = pendingGroup; pendingGroup = undefined;
      const data = DATA.exec(text);
      if (group && data && data[1] === group.id) {
        try { group.data = dataBlock(data[2]!, false).data; } catch (error) { fail((error as Error).message); }
        continue;
      }
      if (text.startsWith("classDef ")) { section = 4; this.classDefs.push(text); continue; }
      if (section === 4) fail("only classDef statements may follow the classDef block");
      const classLine = CLASS.exec(text);
      if (classLine) { section = 3; classes.push([number, classLine[1]!.split(","), classLine[2]!]); continue; }
      if (section === 3) fail("only class and classDef statements may follow class statements");
      const edge = EDGE.exec(text);
      if (edge) {
        if (stack.length) fail("edges must be top level");
        section = 2;
        const next = statements[++index], line = next && DATA.exec(next.text);
        if (!line || line[1] !== edge[2]) fail(`edge ${edge[2]} needs its data line next`);
        let pairs: Pairs = { data: {} };
        try { pairs = dataBlock(line![2]!, false); } catch (error) { throw new Error(`line ${next!.number}: ${(error as Error).message}`); }
        if (edge[3] === "") fail(`edge ${edge[2]} has an empty label; omit |""|`);
        this.elements.push({ id: edge[2]!, type: "edge", label: decode(edge[3] ?? "", true), from: edge[1], to: edge[4], classes: [], data: pairs.data, rows: [], line: number, rowLines: [] });
        continue;
      }
      if (section === 2) fail("nodes and groups must precede edges");
      const open = GROUP.exec(text);
      if (open) {
        const element: Element = { id: open[1]!, type: "group", label: decode(open[2]!, true), classes: [], data: {}, rows: [], line: number, rowLines: [] };
        if (stack.length) element.parent = stack.at(-1)!.id;
        this.elements.push(element); stack.push(element); continue;
      }
      if (text === "end") { if (!stack.length) fail("end without subgraph"); pendingGroup = stack.pop(); continue; }
      if (!data) fail(`unsupported statement: ${text}`);
      let pairs: Pairs = { data: {} };
      try { pairs = dataBlock(data![2]!, true); } catch (error) { fail((error as Error).message); }
      if (pairs.shape === undefined || pairs.label === undefined) fail(`node ${data![1]} needs shape and label`);
      const element: Element = { id: data![1]!, type: "node", label: pairs.label!, shape: pairs.shape, classes: [], data: pairs.data, rows: [], line: number, rowLines: [] };
      if (stack.length) element.parent = stack.at(-1)!.id;
      if (element.data.table === "true") {
        const [title, ...rows] = element.label.split("\n");
        element.label = title!; element.rows = rows; element.rowLines = rows.map(() => number);
      }
      this.elements.push(element);
    }
    if (stack.length) throw new Error(`subgraph ${stack.at(-1)!.id} needs end`);
    const byId = new Map<string, Element>();
    for (const e of this.elements) if (!byId.has(e.id)) byId.set(e.id, e);
    for (const [, ids, name] of classes) for (const id of ids) {
      const element = byId.get(id);
      if (!element) { if (!this.unresolvedClassIds.includes(id)) this.unresolvedClassIds.push(id); }
      else if (!element.classes.includes(name)) element.classes.push(name);
    }
  }
  private parseEr(lines: string[]): void {
    let metadata: { id: string; data: Record<string, string>; number: number } | undefined, entity: Element | undefined;
    for (let index = 2; index < lines.length; index++) {
      const number = index + 1, text = lines[index]!.replace(/^ +/, ""), at = `line ${number}`;
      const fail = (reason: string): never => { throw new Error(`${at}: ${reason}`); };
      if (entity) {
        if (text === "}") { entity = undefined; continue; }
        const row = ATTRIBUTE_ROW.exec(text);
        if (text.startsWith("%% @@") || (row && erWord(row[1]!) && erWord(row[2]!))) { entity.rows.push(text); entity.rowLines.push(number); continue; }
        if (!text || text.startsWith("%%")) continue;
        fail(`invalid entity row: ${text}`);
      }
      if (!text) continue;
      const meta = ER_METADATA.exec(text);
      if (meta) {
        if (metadata) fail("metadata must precede an entity or relationship");
        try { metadata = { id: meta[1]!, data: parsePairs(meta[2] ?? "", false).data, number }; } catch (error) { fail((error as Error).message); }
        continue;
      }
      if (text.startsWith("%%")) { if (metadata) fail("metadata must precede an entity or relationship"); continue; }
      const open = ENTITY.exec(text), relation = RELATION.exec(text);
      if (!open && !relation) fail(`unsupported statement: ${text}`);
      if (c.ER_DIRECTION_TEXT.test(text)) fail("Mermaid reads `direction <dir>` anywhere on this line as a direction statement; write the space as #32;");
      if (open?.[2]!.includes("%")) fail("Mermaid cannot read % in an entity label; write #37;");
      if (!metadata || metadata.number !== number - 1) fail("entity or relationship needs its metadata line first");
      if (open) {
        if (open[1] !== metadata!.id) fail(`metadata id ${metadata!.id} does not match entity ${open[1]}`);
        entity = { id: open[1]!, type: "entity", label: decode(open[2]!, true), classes: [], data: metadata!.data, rows: [], line: number, rowLines: [] };
        this.elements.push(entity);
      } else this.elements.push({ id: metadata!.id, type: "relation", label: decode(relation![4]!, true), from: relation![1], to: relation![3], classes: [], data: metadata!.data, rows: [], line: number, rowLines: [] });
      metadata = undefined;
    }
    if (entity) throw new Error(`entity ${entity.id} needs a closing brace`);
    if (metadata) throw new Error(`line ${metadata.number}: metadata must precede an entity or relationship`);
  }
  layer(e: Element): Layer { return (e.classes.find(name => has(c.LAYER_CLASSES, name)) as Layer | undefined) ?? "as-built"; }
  ancestors(e: Element): Element[] {
    const result: Element[] = [], seen = new Set([e.id]); let parent = e.parent;
    while (parent && this.byId.has(parent) && !seen.has(parent)) { seen.add(parent); const ancestor = this.byId.get(parent)!; result.push(ancestor); parent = ancestor.parent; }
    return result;
  }
  legend(e: Element): boolean { return e.data.kind === "legend"; }
}
export const isEdge = (e: Element) => e.type === "edge" || e.type === "relation";
export type Settings = { root: string; components: string[]; tracking: "none" | "local" | "mcp" };
export function settings(): Settings {
  const config = JSON.parse(readFileSync(c.CONFIG_PATH, "utf8"));
  if (config.diagrams?.mode === c.REPLACED_MODE) throw new Error(c.REPLACED_MODE_MESSAGE);
  if (config.diagrams?.mode !== c.MODE || !c.safeDiagramsRoot(config.diagrams.root) || !Array.isArray(config.diagrams.components)
    || config.diagrams.components.some((p: unknown) => !c.safeRoot(p))) throw new Error("invalid mermaid settings");
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
  if (!c.safeDiagramsRoot(config.root)) throw new Error("invalid mermaid settings");
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
  let d: Diagram;
  const failures: string[] = [];
  const fail = (number: number, id?: string) => failures.push(`${file}: check ${number}: ${c.CHECK_REASONS[number]}${id === undefined ? "" : `: ${id}`}`);
  try { d = new Diagram(readDiagram(file, config)); } catch { fail(1); return { failures, count: 0 }; }
  const flowchart = d.kind === "flowchart";
  const classes = new Set<string>(d.unresolvedClassIds);
  for (const e of d.elements) {
    const layers = e.classes.filter(name => has(c.LAYER_CLASSES, name)), categories = e.classes.filter(name => has(c.CATEGORY_CLASSES, name)), kinds = e.classes.filter(name => has(c.EDGE_KIND_CLASSES, name));
    if (e.classes.length !== layers.length + categories.length + kinds.length || layers.length > 1 || categories.length > 1 || kinds.length > 1
      || (isEdge(e) ? categories.length : kinds.length)) classes.add(e.id);
  }
  for (const id of classes) fail(2, id);
  const ids = d.elements.map(e => e.id), invalid = new Set(ids.filter((id, i) => ids.indexOf(id) !== i));
  for (const e of d.elements) {
    if (!c.mermaidId(e.id) || Object.keys(e.data).some(key => has(c.MERMAID_RESERVED_KEYS, key))
      || ("kind" in e.data && e.data.kind !== "legend") || ("table" in e.data && (e.type !== "node" || e.data.table !== "true"))) { invalid.add(e.id); continue; }
    const labelled = !isEdge(e);
    if (d.legend(e)) { if (labelled && !e.label) invalid.add(e.id); continue; }
    const required = ["component"], layer = d.layer(e);
    if (layer !== "intended") required.push("source");
    if (layer !== "as-built") required.push("decision", "intent");
    if ((labelled && !e.label) || required.some(key => !e.data[key]) || ![...config.components, "platform", "external"].includes(e.data.component ?? "")) invalid.add(e.id);
  }
  for (const id of invalid) fail(3, id);
  for (const e of d.elements) {
    const data = e.data, layer = d.layer(e);
    if (!d.legend(e)) {
      if ("source" in data) for (const token of data.source!.split(",")) {
        const source = token.trim().replace(/:L\d+$/, "");
        try {
          const suffix = relative(realpathSync("."), realpathSync(source));
          if (!source || isAbsolute(source) || source.split(/[\\/]/).includes("..") || suffix === ".." || suffix.startsWith(`..${sep}`) || isAbsolute(suffix) || !existsSync(source)) throw new Error();
        } catch { fail(4, e.id); break; }
      }
      if ("decision" in data && !mapped.has(data.decision!)) fail(5, e.id);
      if ("intent" in data && !validIntent(data.intent, config)) fail(6, e.id);
    }
    if (isEdge(e) && [e.from, e.to].some(id => {
      const endpoint = d.byId.get(id ?? "");
      return !endpoint || endpoint.type !== (flowchart ? "node" : "entity") || !(c.ENDPOINT_LAYERS[layer] ?? []).includes(d.layer(endpoint));
    })) fail(8, e.id);
  }
  if (flowchart && JSON.stringify(d.classDefs) !== JSON.stringify(c.CLASS_DEFS)) fail(7);
  if (basename(file) === c.SYSTEM_FILE && config.components.some(component => !d.elements.some(e => !d.legend(e) && d.layer(e) !== "intended" && e.data.component === component))) fail(9);
  const legend = (e: Element) => d.legend(e) || d.ancestors(e).some(a => d.legend(a));
  for (const e of d.elements) {
    if ((!d.legend(e) && d.ancestors(e).some(a => d.legend(a))) || (isEdge(e) && [e.from, e.to].some(id => {
      const endpoint = d.byId.get(id ?? ""); return endpoint && legend(endpoint) !== d.legend(e);
    }))) fail(10, e.id);
  }
  failures.sort((a, b) => Number(/: check (\d+):/.exec(a)![1]) - Number(/: check (\d+):/.exec(b)![1]));
  return { failures, count: d.elements.length };
}
export function diagramPaths(root: string): string[] {
  if (!realpathWithinRoot(".", root)) throw new Error(c.CHECK_REASONS[1]);
  return [...new Bun.Glob(`**/*${c.EXTENSION}`).scanSync({ cwd: root, onlyFiles: false, followSymlinks: false })].map(file => `${root}/${file}`).sort();
}
export function main(args = Bun.argv.slice(2)): number {
  const config = settings();
  if (args.some(arg => arg.startsWith("--"))) throw new Error("unknown diagram-check option");
  const paths = args.length ? args : diagramPaths(config.root);
  const mapped = decisions(); let count = 0; const failures: string[] = [];
  for (const file of paths) { const result = validate(file, config, mapped); count += result.count; failures.push(...result.failures); }
  if (failures.length) { console.log(failures.join("\n")); return 1; }
  console.log(`diagram-check: ${paths.length} files, ${count} elements checked`); return 0;
}
if (import.meta.main) try { process.exitCode = main(); } catch (error) { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; }
