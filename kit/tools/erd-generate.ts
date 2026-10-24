#!/usr/bin/env bun
// Offline Prisma → generated-only drawio. Parse and preflight everything before mutation.
import { existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, unlinkSync, writeFileSync } from "node:fs";
import { basename, dirname, join, relative, resolve } from "node:path";
import { Drawing, serialize } from "./diagram-check.ts";
import type { Xml } from "./diagram-check.ts";
import { CONFIG_PATH, LAYERS, PAGE_WIDTH_LIMIT, diagramPathKey } from "./constants/diagrams.ts";
import * as c from "./constants/erd.ts";
import type { Erd } from "./constants/erd.ts";
import { realpathWithinRoot } from "./root-containment.ts";
export type Attribute = { name: string; arguments: string[]; text: string };
export type Relation = { target: string; fields: string[]; references: string[]; name?: string; onDelete?: string; onUpdate?: string; map?: string };
export type Field = { name: string; type: string; baseType: string; attributes: Attribute[]; relation?: Relation; line: number };
export type Model = { name: string; fields: Field[]; attributes: Attribute[] };
export type Enum = { name: string; values: { name: string; attributes: Attribute[] }[]; attributes: Attribute[] };
export type Schema = { path: string; models: Model[]; enums: Enum[] };
const order = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0;
function syntax(path: string, line: number, message: string): never { throw new Error(`${path}:${line}: ${message}`); }
// Keep offsets/newlines so every error cites its original file and line. Strings protect URLs/comments.
export function stripComments(text: string, path = "schema.prisma"): string {
  let result = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i]!;
    if (quoted) {
      result += char;
      if (char === "\\" && i + 1 < text.length) result += text[++i];
      else if (char === '"') quoted = false;
    } else if (char === '"') { quoted = true; result += char; }
    else if (text.startsWith("//", i)) {
      while (i < text.length && text[i] !== "\n") { result += " "; i++; }
      if (i < text.length) result += "\n";
    } else if (text.startsWith("/*", i)) {
      // Prisma supports /* */ block comments alongside // and ///.
      const end = text.indexOf("*/", i + 2);
      if (end < 0) syntax(path, text.slice(0, i).split("\n").length, "unterminated Prisma comment");
      result += text.slice(i, end + 2).replace(/[^\n]/g, " "); i = end + 1;
    } else result += char;
  }
  if (quoted) syntax(path, text.split("\n").length, "unterminated Prisma string");
  return result;
}
export function splitBalanced(text: string, separator?: string): string[] {
  const result: string[] = [], stack: string[] = []; let start = 0, quoted = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i]!;
    if (quoted) { if (char === "\\") i++; else if (char === '"') quoted = false; continue; }
    if (char === '"') quoted = true;
    else if ("([{".includes(char)) stack.push(char);
    else if (")]}".includes(char)) {
      if (!stack.length || "([{".indexOf(stack.pop()!) !== ")]}".indexOf(char)) throw new Error("unbalanced Prisma expression");
    } else if (!stack.length && (separator === undefined ? /\s/.test(char) : char === separator)) {
      if (text.slice(start, i).trim()) result.push(text.slice(start, i).trim()); start = i + 1;
    }
  }
  if (stack.length || quoted) throw new Error("incomplete Prisma expression");
  if (text.slice(start).trim()) result.push(text.slice(start).trim()); return result;
}
export const findAttribute = (items: Attribute[], name: string) => items.find(item => item.name === name);
export function mappedName(name: string, items: Attribute[]): string {
  const mapped = findAttribute(items, "map"); return mapped ? JSON.parse(mapped.arguments[0]!) : name;
}
function attributes(tokens: string[], block: boolean, allowed: Record<string, true>): Attribute[] {
  return tokens.map(text => {
    const match = c.ATTRIBUTE.exec(text), name = match?.[1]!.replace(/^@@?/, "");
    if (!match || match[1]!.startsWith("@@") !== block || (!allowed[name!] && !(name!.startsWith("db.") && !block))) throw new Error(`unsupported Prisma attribute: ${text}`);
    const arguments_ = splitBalanced(match[2] ?? "", ",");
    if (name === "map") {
      try {
        if (arguments_.length !== 1 || typeof JSON.parse(arguments_[0]!) !== "string") throw new Error();
      } catch { throw new Error("@map/@@map requires one positional string argument"); }
    }
    return { name: name!, arguments: arguments_, text };
  });
}
function names(argument: string): string[] {
  if (!argument.startsWith("[") || !argument.endsWith("]")) throw new Error("expected Prisma field list");
  const result = splitBalanced(argument.slice(1, -1), ",").map(part => part.split("(")[0]!.trim());
  if (result.some(name => !c.IDENTIFIER.test(name))) throw new Error("invalid Prisma field list"); return result;
}
function options(attr: Attribute): Record<string, string> {
  return Object.fromEntries(attr.arguments.filter(a => /^[A-Za-z]+\s*:/.test(a)).map(a => { const colon = a.indexOf(":"); return [a.slice(0, colon).trim(), a.slice(colon + 1).trim()]; }));
}
function constraintName(argument: string): string {
  try {
    const value: unknown = JSON.parse(argument);
    if (typeof value === "string") return value;
  } catch { /* fall through to the explicit error */ }
  throw new Error("@relation map requires a string constraint name");
}
export function parseSchema(source: string, path: string): Schema {
  const text = stripComments(source.replace(/\r\n?/g, "\n"), path), schema: Schema = { path, models: [], enums: [] };
  const lineAt = (offset: number) => text.slice(0, offset).split("\n").length;
  let offset = 0;
  while (text.slice(offset).trim()) {
    c.BLOCK.lastIndex = offset; const match = c.BLOCK.exec(text);
    if (!match) syntax(path, lineAt(offset + text.slice(offset).search(/\S/)), "unsupported Prisma block or syntax");
    const kind = match[1]!, name = match[2]!, start = c.BLOCK.lastIndex;
    let end = start, quoted = false, depth = 1;
    for (; end < text.length; end++) {
      const char = text[end]!;
      if (quoted) { if (char === "\\") end++; else if (char === '"') quoted = false; }
      else if (char === '"') quoted = true;
      else if (char === "{") depth++;
      else if (char === "}" && --depth === 0) break;
    }
    if (end === text.length) syntax(path, lineAt(start), "unterminated Prisma block");
    const model: Model = { name, fields: [], attributes: [] }, enumeration: Enum = { name, values: [], attributes: [] };
    let pending = "", pendingLine = lineAt(start), cursor = start;
    const statements = text.slice(start, end).split("\n");
    for (let i = 0; i < statements.length; i++) {
      const raw = statements[i]!, line = raw.trim();
      if (!pending && line) pendingLine = lineAt(cursor + raw.indexOf(line));
      cursor += raw.length + 1;
      if (!line) continue;
      pending = pending ? pending + "\n" + line : line;
      let tokens: string[];
      try { tokens = splitBalanced(pending); }
      catch (error) { if ((error as Error).message.startsWith("incomplete") && i < statements.length - 1) continue; syntax(path, pendingLine, (error as Error).message); }
      // A following attribute belongs to this field; bracket continuations are already balanced above.
      const next = statements.slice(i + 1).find(row => row.trim());
      if (next && /^\s*@(?!@)/.test(next) && !pending.startsWith("@@") && (kind === "model" || kind === "enum")) continue;
      try {
        if (kind === "datasource" || kind === "generator") {
          if (!/^[A-Za-z][A-Za-z0-9_]*\s*=\s*\S[\s\S]*$/.test(pending) || tokens.includes("{")) throw new Error("unsupported Prisma configuration syntax");
        } else if (tokens[0]!.startsWith("@@")) {
          (kind === "model" ? model : enumeration).attributes.push(...attributes(tokens, true, kind === "model" ? c.MODEL_ATTRIBUTES : c.ENUM_ATTRIBUTES));
        } else {
          if (!c.IDENTIFIER.test(tokens[0]!)) throw new Error(`invalid Prisma name: ${tokens[0]}`);
          if (kind === "enum") enumeration.values.push({ name: tokens[0]!, attributes: attributes(tokens.slice(1), false, c.ENUM_ATTRIBUTES) });
          else {
            if (!tokens[1] || !c.TYPE.test(tokens[1])) throw new Error(`invalid or unsupported Prisma field: ${pending}`);
            const attrs = attributes(tokens.slice(2), false, c.FIELD_ATTRIBUTES), baseType = tokens[1].replace(/(?:\?|\[\])$/, "");
            const field: Field = { name: tokens[0]!, type: [tokens[1], ...tokens.slice(2).filter(t => t.startsWith("@db."))].join(" "), baseType, attributes: attrs, line: pendingLine };
            const relation = findAttribute(attrs, "relation");
            if (relation) {
              const opts = options(relation);
              const relationName = opts.name ?? relation.arguments.find(argument => argument.startsWith('"'));
              const name = relationName === undefined ? undefined : JSON.parse(relationName);
              if (name !== undefined && typeof name !== "string") throw new Error("invalid Prisma relation name");
              field.relation = { target: baseType, fields: opts.fields ? names(opts.fields) : [], references: opts.references ? names(opts.references) : [],
                ...(name !== undefined ? { name } : {}), ...(opts.onDelete ? { onDelete: opts.onDelete } : {}), ...(opts.onUpdate ? { onUpdate: opts.onUpdate } : {}),
                ...(opts.map !== undefined ? { map: constraintName(opts.map) } : {}) };
            }
            if (model.fields.some(f => f.name === field.name)) throw new Error(`duplicate Prisma field: ${field.name}`);
            model.fields.push(field);
          }
        }
      } catch (error) { syntax(path, pendingLine, (error as Error).message); }
      pending = "";
    }
    if (pending) syntax(path, pendingLine, "incomplete Prisma expression");
    if (kind === "model") schema.models.push(model);
    if (kind === "enum") schema.enums.push(enumeration);
    offset = end + 1;
  }
  return schema;
}
export function logicalIds(keys: string[]): Map<string, string> {
  const bases = new Set(keys.map(key => key.toLowerCase())), assigned = new Set<string>(), result = new Map<string, string>();
  for (const key of [...keys].sort(order)) {
    const base = key.toLowerCase(); let id = base, suffix = 2;
    while (assigned.has(id) || (id !== base && bases.has(id))) id = `${base}-${suffix++}`;
    assigned.add(id); result.set(key, id);
  }
  return result;
}
export function columnRows(model: Model, modelNames: Set<string>): string[] {
  const marked = Object.fromEntries(c.MARKERS.map(([key]) => [key, new Set<string>()]));
  for (const attr of model.attributes) if (marked[attr.name] && attr.arguments.length) {
    const list = attr.arguments.find(a => a.startsWith("[")) ?? options(attr).fields;
    if (list) for (const name of names(list)) marked[attr.name]!.add(name);
  }
  for (const item of model.fields) {
    for (const attr of item.attributes) marked[attr.name]?.add(item.name);
    for (const name of item.relation?.fields ?? []) marked.relation!.add(name);
  }
  return [...model.fields].sort((a, b) => order(a.name, b.name)).filter(item => !modelNames.has(item.baseType)).map(item =>
    `${mappedName(item.name, item.attributes)} : ${item.type}${c.MARKERS.filter(([key]) => marked[key]!.has(item.name)).map(([, marker]) => ` ${marker}`).join("")}${item.attributes.filter(a => !["id", "unique", "map"].includes(a.name) && !a.name.startsWith("db.")).map(a => ` ${a.text}`).join("")}`);
}
const node = (tag: string, attrs: Record<string, string> = {}, children: Xml[] = []): Xml => ({ tag, attrs, children, text: "" });
function geometry(values: Record<string, number>): Xml { return node("mxGeometry", { ...Object.fromEntries(Object.entries(values).map(([k, v]) => [k, String(v)])), as: "geometry" }); }
type ImplicitRelation = { model: Model; field: Field; target: string; source: string; name?: string };
function implicitRelations(schemas: Schema[]): ImplicitRelation[] {
  const models = new Map(schemas.flatMap(schema => schema.models.map(model => [model.name, model] as const))), edges: ImplicitRelation[] = [];
  for (const schema of schemas) for (const model of schema.models) for (const field of model.fields) {
    const target = models.get(field.baseType);
    if (!target || !field.type.startsWith(field.baseType + "[]") || field.relation?.fields.length) continue;
    const backReferences = target.fields.filter(other => other !== field && other.baseType === model.name && other.relation?.name === field.relation?.name);
    const lists = backReferences.filter(other => other.type.startsWith(other.baseType + "[]") && !other.relation?.fields.length);
    // A list opposite an FK-owning scalar is the inverse of an already drawn one-to-many.
    if (!lists.length && backReferences.some(other => other.relation?.fields.length)) continue;
    if (lists.length !== 1 || backReferences.some(other => other.relation?.fields.length)) syntax(schema.path, field.line, "ambiguous implicit many-to-many");
    const other = lists[0]!;
    if (order(`${model.name}.${field.name}`, `${target.name}.${other.name}`) < 0) edges.push({ model, field, target: target.name, source: schema.path, ...(field.relation?.name !== undefined ? { name: field.relation.name } : {}) });
  }
  return edges;
}
function oneToOne(model: Model, fields: string[]): boolean {
  if (fields.every(name => model.fields.some(field => field.name === name && field.attributes.some(attr => attr.name === "id" || attr.name === "unique")))) return true;
  return model.attributes.some(attr => {
    if (attr.name !== "id" && attr.name !== "unique") return false;
    const list = attr.arguments.find(argument => argument.startsWith("[")) ?? options(attr).fields;
    if (!list) return false;
    const unique = names(list); return unique.length === fields.length && fields.every(name => unique.includes(name));
  });
}
export function renderSchema(schema: Schema, schemas: Schema[], config: Erd): string {
  const models = new Map(schemas.flatMap(s => s.models.map(model => [model.name, { model, path: s.path }] as const)));
  const local = new Set(schema.models.map(m => m.name));
  const implicit = implicitRelations(schemas).filter(edge => edge.source === schema.path);
  const references = [...new Set([...schema.models.flatMap(m => m.fields.filter(f => f.relation?.fields.length && !local.has(f.baseType)).map(f => f.baseType)),
    ...implicit.filter(edge => !local.has(edge.target)).map(edge => edge.target)])].sort(order);
  for (const target of references) if (!models.has(target)) throw new Error(`${schema.path}: undefined relation model ${target}`);
  const keys = [...local, ...references].map(name => `model-${name}`);
  keys.push(...schema.enums.map(e => `enum-${e.name}`), ...schema.models.flatMap(m => m.fields.filter(f => f.relation?.fields.length).map(f => `edge-${m.name}-${f.name}`)));
  keys.push(...implicit.map(edge => `edge-${edge.model.name}-${edge.field.name}`));
  const ids = logicalIds(keys), id = (key: string) => ids.get(key)!;
  const entries: { id: string; label: string; source: string; rows?: string[]; style: string }[] = [];
  for (const model of [...schema.models].sort((a, b) => order(a.name, b.name))) entries.push({ id: id(`model-${model.name}`), label: `${mappedName(model.name, model.attributes)} (${model.name})`, source: schema.path,
    rows: [...columnRows(model, new Set(models.keys())), ...model.attributes.map(a => a.text)], style: c.TABLE_STYLE });
  for (const enumeration of [...schema.enums].sort((a, b) => order(a.name, b.name))) entries.push({ id: id(`enum-${enumeration.name}`), label: `${mappedName(enumeration.name, enumeration.attributes)} (${enumeration.name})`, source: schema.path,
    rows: [...enumeration.values].sort((a, b) => order(a.name, b.name)).map(v => mappedName(v.name, v.attributes)).concat(enumeration.attributes.map(a => a.text)), style: c.TABLE_STYLE });
  for (const name of references) entries.push({ id: id(`model-${name}`), label: `${name} (${basename(models.get(name)!.path)})`, source: models.get(name)!.path, style: c.REFERENCE_STYLE });
  const root = node("root", {}, [node("mxCell", { id: "0" }), node("mxCell", { id: "1", parent: "0" }), ...LAYERS.map(layer => node("mxCell", { id: layer, value: layer, parent: "0" }))]);
  function element(identifier: string, label: string, source: string, structure: Record<string, string>, values: Record<string, number>): Xml {
    const cell = node("mxCell", structure, [geometry(values)]);
    root.children.push(node("object", { id: identifier, label, component: config.component, source }, [cell])); return cell;
  }
  const lane = element("schema", `${config.label} · ${basename(schema.path)} · generated-only; never keeper-edited`, schema.path, { vertex: "1", parent: "as-built", style: c.LANE_STYLE }, {});
  let y = c.ROW_HEIGHT + c.GRID_GAP;
  for (let start = 0; start < entries.length; start += c.GRID_COLUMNS) {
    const group = entries.slice(start, start + c.GRID_COLUMNS), heights = group.map(e => c.ROW_HEIGHT * (e.rows ? e.rows.length + 1 : 2));
    for (const [column, entry] of group.entries()) {
      const height = heights[column]!;
      element(entry.id, entry.label, entry.source, { vertex: "1", parent: "schema", style: entry.style }, { x: c.GRID_GAP + column * (c.TABLE_WIDTH + c.GRID_GAP), y, width: c.TABLE_WIDTH, height });
      for (const [index, text] of (entry.rows ?? []).entries()) {
        const rowId = `${entry.id}-row-${index}`;
        root.children.push(node("mxCell", { id: rowId, parent: entry.id, vertex: "1", style: c.ROW_STYLE, value: "" }, [geometry({ y: c.ROW_HEIGHT * (index + 1), width: c.TABLE_WIDTH, height: c.ROW_HEIGHT })]),
          node("mxCell", { id: `${rowId}-text`, parent: rowId, vertex: "1", style: c.PARTIAL_STYLE, value: text }, [geometry({ width: c.TABLE_WIDTH, height: c.ROW_HEIGHT })]));
      }
    }
    y += Math.max(...heights) + c.GRID_GAP;
  }
  lane.children = [geometry({ x: c.MARGIN, y: c.MARGIN, width: c.GRID_COLUMNS * (c.TABLE_WIDTH + c.GRID_GAP) + c.GRID_GAP, height: y })];
  for (const model of [...schema.models].sort((a, b) => order(a.name, b.name))) for (const item of [...model.fields].sort((a, b) => order(a.name, b.name))) {
    const relation = item.relation; if (!relation?.fields.length) continue;
    element(id(`edge-${model.name}-${item.name}`), `${relation.fields.join(", ")} → ${relation.references.join(", ")}${relation.onDelete ? ` onDelete: ${relation.onDelete}` : ""}${relation.onUpdate ? ` onUpdate: ${relation.onUpdate}` : ""}${relation.map !== undefined ? ` map: ${JSON.stringify(relation.map)}` : ""}`, schema.path,
      { edge: "1", parent: "schema", source: id(`model-${model.name}`), target: id(`model-${relation.target}`), style: oneToOne(model, relation.fields) ? c.ONE_TO_ONE_STYLE : c.RELATION_STYLE }, { relative: 1 });
  }
  for (const edge of implicit) element(id(`edge-${edge.model.name}-${edge.field.name}`), `m:n${edge.name !== undefined ? ` "${edge.name}"` : ""}`, schema.path,
    { edge: "1", parent: "schema", source: id(`model-${edge.model.name}`), target: id(`model-${edge.target}`), style: c.MANY_TO_MANY_STYLE }, { relative: 1 });
  return serialize(node("mxfile", { compressed: "false", generator: c.GENERATED }, [node("diagram", { id: basename(schema.path, ".prisma"), name: basename(schema.path) },
    [node("mxGraphModel", { page: "1", pageWidth: String(PAGE_WIDTH_LIMIT), pageHeight: String(y + 2 * c.MARGIN) }, [root])])])) + "\n";
}
function containedPath(root: string, file: string): string {
  // Resolve the nearest existing ancestor, without ever creating anything during --check.
  let ancestor = resolve(root, file);
  while (!existsSync(ancestor)) { const parent = dirname(ancestor); if (parent === ancestor) throw new Error(`unsafe ERD path: ${file}`); ancestor = parent; }
  if (!realpathWithinRoot(root, ancestor)) throw new Error(`ERD path outside repository: ${file}`);
  const destination = resolve(root, file);
  for (let part = destination; part !== resolve(root); part = dirname(part)) {
    try { if (lstatSync(part).isSymbolicLink()) throw new Error(`ERD path must not traverse symlinks: ${file}`); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
  }
  return destination;
}
export function adapterSettings(root = "."): Erd {
  const config = JSON.parse(readFileSync(join(root, CONFIG_PATH), "utf8"));
  if (config.diagrams?.mode !== "drawio" || !config.diagrams.erd) throw new Error("Prisma ERD adapter requires enabled diagrams.erd and drawio mode");
  c.validateErd(config.diagrams.erd, config.diagrams.root, config.diagrams.components ?? []); return config.diagrams.erd;
}
export function loadSchemas(root: string, config: Erd): Schema[] {
  const files = new Set<string>();
  for (const glob of config.schemaGlobs) for (const file of new Bun.Glob(glob).scanSync({ cwd: root, onlyFiles: true, followSymlinks: false })) {
    if (!file.split("/").includes(c.DEPENDENCY_DIRECTORY)) files.add(file);
  }
  if (!files.size) throw new Error("no Prisma schema inputs matched diagrams.erd.schemaGlobs");
  const schemas = [...files].sort(order).map(file => parseSchema(readFileSync(containedPath(root, file), "utf8"), file));
  const declared = new Set<string>(), models = new Set(schemas.flatMap(s => s.models.map(m => m.name))), enums = new Set(schemas.flatMap(s => s.enums.map(e => e.name)));
  for (const schema of schemas) {
    for (const item of [...schema.models, ...schema.enums]) { if (declared.has(item.name)) syntax(schema.path, 1, `duplicate Prisma declaration: ${item.name}`); declared.add(item.name); }
    for (const model of schema.models) for (const field of model.fields) {
      if (!c.SCALARS[field.baseType] && !field.baseType.startsWith("Unsupported(") && !models.has(field.baseType) && !enums.has(field.baseType)) syntax(schema.path, field.line, `undefined relation model ${field.baseType}`);
      if (field.relation && !models.has(field.relation.target)) syntax(schema.path, field.line, `undefined relation model ${field.relation.target}`);
    }
  }
  return schemas;
}
export type Sync = { expected: Map<string, string>; extras: string[]; failures: string[]; schemas: number };
export function synchronization(root: string, config: Erd, selected?: string): Sync {
  const schemas = loadSchemas(root, config);
  let chosen = schemas;
  if (selected !== undefined) {
    chosen = schemas.filter(s => s.path === selected || s.path.endsWith("/" + selected));
    if (chosen.length !== 1 || selected.split(/[\\/]/).some(p => p === ".." || p === ".") || selected.startsWith("/")) throw new Error(`not an unambiguous schema input: ${selected}`);
  }
  // Reserve every natural stem first, including case/NFC aliases; allocate deterministic suffixes.
  const reserved = new Set(schemas.map(s => diagramPathKey(basename(s.path, ".prisma")))), used = new Set<string>(), outputNames = new Map<string, string>();
  for (const schema of schemas) {
    const stem = basename(schema.path, ".prisma"); let name = stem, suffix = 2;
    while (used.has(diagramPathKey(name))) {
      name = `${stem}--${suffix++}`;
      while (reserved.has(diagramPathKey(name)) || used.has(diagramPathKey(name))) name = `${stem}--${suffix++}`;
    }
    used.add(diagramPathKey(name)); outputNames.set(schema.path, name);
  }
  const expected = new Map<string, string>();
  for (const schema of chosen) {
    const file = `${config.output}/${outputNames.get(schema.path)}${c.SUFFIX}`;
    containedPath(root, file); expected.set(file, renderSchema(schema, schemas, config));
  }
  const extras: string[] = [];
  const output = containedPath(root, config.output);
  function walk(directory: string): void {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const file = join(directory, entry.name); containedPath(root, relative(root, file));
      if (entry.isDirectory()) walk(file); else extras.push(relative(root, file));
    }
  }
  if (!selected && existsSync(output)) walk(output);
  const unexpected = extras.filter(file => !expected.has(file)).sort(order), failures: string[] = [];
  for (const [file, content] of expected) {
    const destination = join(root, file);
    if (!existsSync(destination)) failures.push(`erd-check: missing: ${file}`);
    else if (readFileSync(destination, "utf8") !== content) failures.push(`erd-check: changed: ${file}`);
  }
  failures.push(...unexpected.map(file => `erd-check: unexpected: ${file}`));
  return { expected, extras: unexpected, failures, schemas: schemas.length };
}
export function generate(root: string, check = false, selected?: string): number {
  root = resolve(root); const config = adapterSettings(root), sync = synchronization(root, config, selected);
  if (check) {
    console.log(sync.failures.length ? sync.failures.join("\n") : `erd-check: ${sync.expected.size} files match ${sync.schemas} schema files`); return sync.failures.length ? 1 : 0;
  }
  // Never overwrite a hand-authored file, even if someone gives it the generated suffix.
  const generated = (file: string) => { try { return new Drawing(readFileSync(join(root, file), "utf8")).xml.attrs.generator === c.GENERATED; } catch { return false; } };
  for (const file of sync.expected.keys()) if (existsSync(join(root, file)) && !generated(file)) throw new Error(`refusing to overwrite non-generated ERD: ${file}`);
  for (const [file, content] of sync.expected) { mkdirSync(dirname(join(root, file)), { recursive: true }); writeFileSync(join(root, file), content); }
  for (const file of sync.extras) if (file.endsWith(c.SUFFIX) && generated(file)) unlinkSync(join(root, file));
  return 0;
}
export function main(args = Bun.argv.slice(2)): number {
  let check = false, selected: string | undefined;
  while (args.length) {
    const arg = args.shift();
    if (arg === "--check" && !check) check = true;
    else if (arg === "--file" && selected === undefined && args[0] && !args[0].startsWith("--")) selected = args.shift();
    else throw new Error("usage: erd-generate [--check] [--file <schema>]");
  }
  return generate(process.cwd(), check, selected);
}
if (import.meta.main) try { process.exitCode = main(); } catch (error) { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; }
