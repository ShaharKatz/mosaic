// Optional Prisma adapter contract and grammar for generated Mermaid erDiagram files.
import { diagramPathKey, safeDiagramsRoot, safeRoot } from "./diagrams.ts";
export type Erd = { adapter: "prisma"; schemaGlobs: string[]; output: string; component: string; label: string };
export const BUNDLE_FILES = ["tools/erd-generate.ts", "tools/constants/erd.ts"];
export const SUFFIX = ".erd.mmd";
export const GENERATED = "mosaic-prisma-erd";
export const IDENTIFIER = /^[A-Za-z][A-Za-z0-9_]*$/;
export const BLOCK = /\s*(model|enum|datasource|generator)\s+([A-Za-z][A-Za-z0-9_]*)\s*\{/y;
export const ATTRIBUTE = /^(@@?[\w.]+)(?:\(([\s\S]*)\))?$/;
export const TYPE = /^(?:[A-Za-z][A-Za-z0-9_]*|Unsupported\("(?:[^"\\]|\\.)*"\))(?:\?|\[\])?$/;
export const SCALARS: Record<string, true> = { String: true, Boolean: true, Int: true, BigInt: true, Float: true, Decimal: true, DateTime: true, Json: true, Bytes: true };
export const FIELD_ATTRIBUTES: Record<string, true> = { id: true, unique: true, map: true, relation: true, default: true, updatedAt: true, ignore: true };
export const MODEL_ATTRIBUTES: Record<string, true> = { id: true, unique: true, index: true, fulltext: true, map: true, ignore: true, schema: true };
export const ENUM_ATTRIBUTES: Record<string, true> = { map: true, schema: true };
// Column markers: PK/FK/UK are Mermaid ER keys; IDX goes into the row comment.
export const MARKERS = [["id", "PK"], ["relation", "FK"], ["unique", "UK"], ["index", "IDX"]] as const;
export const MANY_TO_ONE = "}o--||", ONE_TO_ONE = "|o--||", MANY_TO_MANY = "}o--o{";
export const MANY_TO_OPTIONAL_ONE = "}o--o|", ONE_TO_OPTIONAL_ONE = "|o--o|";
export const DEPENDENCY_DIRECTORY = "node_modules";
export function safeGlob(value: unknown): value is string {
  return typeof value === "string" && !!value && !/[\\\s\0{}()]/.test(value) && !value.startsWith("/")
    && value.split("/").every(part => !!part && part !== "." && part !== ".." && diagramPathKey(part) !== ".git") && value.endsWith(".prisma");
}
export function validateErd(value: unknown, root: string, components: string[]): asserts value is Erd {
  const erd = value as Erd;
  if (!erd || typeof erd !== "object" || Array.isArray(erd) || erd.adapter !== "prisma") throw new Error("diagrams.erd.adapter must be prisma");
  if (!Array.isArray(erd.schemaGlobs) || !erd.schemaGlobs.length || erd.schemaGlobs.some(glob => !safeGlob(glob))) throw new Error("diagrams.erd.schemaGlobs must be nonempty safe repository-relative Prisma globs");
  if (!safeDiagramsRoot(root) || !safeDiagramsRoot(erd.output) || !erd.output.startsWith(root + "/") || !diagramPathKey(erd.output).startsWith(diagramPathKey(root) + "/")) throw new Error("diagrams.erd.output must be a safe directory strictly inside diagrams.root");
  if (!safeRoot(erd.component) || ![...components, "platform", "external"].includes(erd.component)) throw new Error("diagrams.erd.component must be a diagram component binding");
  if (typeof erd.label !== "string" || !erd.label.trim() || /[\r\n\0]/.test(erd.label) || erd.label.includes("\u007b\u007b")) throw new Error("diagrams.erd.label must be a nonempty single-line string without placeholders");
}
