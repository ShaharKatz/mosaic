// Optional Prisma adapter contract, grammar and deterministic layout.
import { diagramPathKey, safeDiagramsRoot, safeRoot } from "./diagrams.ts";
export type Erd = { adapter: "prisma"; schemaGlobs: string[]; output: string; component: string; label: string };
export const BUNDLE_FILES = ["tools/erd-generate.ts", "tools/constants/erd.ts"];
export const SUFFIX = ".erd.drawio";
export const GENERATED = "mosaic-prisma-erd";
export const IDENTIFIER = /^[A-Za-z][A-Za-z0-9_]*$/;
export const BLOCK = /\s*(model|enum|datasource|generator)\s+([A-Za-z][A-Za-z0-9_]*)\s*\{/y;
export const ATTRIBUTE = /^(@@?[\w.]+)(?:\(([\s\S]*)\))?$/;
export const TYPE = /^(?:[A-Za-z][A-Za-z0-9_]*|Unsupported\("(?:[^"\\]|\\.)*"\))(?:\?|\[\])?$/;
export const SCALARS: Record<string, true> = { String: true, Boolean: true, Int: true, BigInt: true, Float: true, Decimal: true, DateTime: true, Json: true, Bytes: true };
export const FIELD_ATTRIBUTES: Record<string, true> = { id: true, unique: true, map: true, relation: true, default: true, updatedAt: true, ignore: true };
export const MODEL_ATTRIBUTES: Record<string, true> = { id: true, unique: true, index: true, fulltext: true, map: true, ignore: true, schema: true };
export const ENUM_ATTRIBUTES: Record<string, true> = { map: true, schema: true };
export const MARKERS = [["id", "PK"], ["relation", "FK"], ["unique", "U"], ["index", "IDX"]] as const;
export const ROW_HEIGHT = 26, GRID_COLUMNS = 4, TABLE_WIDTH = 350, GRID_GAP = 26, MARGIN = 20;
export const TABLE_STYLE = "shape=table;startSize=26;container=1;collapsible=0;childLayout=tableLayout;fixedRows=1;rowLines=0;html=0;align=left;fontSize=11;";
export const ROW_STYLE = "shape=tableRow;horizontal=0;startSize=0;fillColor=none;collapsible=0;";
export const PARTIAL_STYLE = "shape=partialRectangle;connectable=0;fillColor=none;align=left;spacingLeft=6;overflow=hidden;whiteSpace=wrap;html=0;fontSize=11;";
export const LANE_STYLE = "swimlane;startSize=26;horizontal=1;fontSize=11;";
export const REFERENCE_STYLE = "rounded=0;fontSize=11;";
export const RELATION_STYLE = "edgeStyle=orthogonalEdgeStyle;startArrow=ERmany;endArrow=ERone;fontSize=11;";
export const ONE_TO_ONE_STYLE = "edgeStyle=orthogonalEdgeStyle;startArrow=ERone;endArrow=ERone;fontSize=11;";
export const MANY_TO_MANY_STYLE = "edgeStyle=orthogonalEdgeStyle;startArrow=ERmany;endArrow=ERmany;fontSize=11;";
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
