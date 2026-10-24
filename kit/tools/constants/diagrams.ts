// Shared drawio vocabulary and install contract; no runtime or package dependencies.
export const DIAGRAMS_ROOT = "docs/architecture/diagrams";
export const DRAWIO_PACKAGE = "@drawio/mcp@1.8.0";
export const DRAWIO_MOUNT = { command: "npx", args: ["-y", DRAWIO_PACKAGE] };
export const CONFIG_PATH = ".omp/mosaic.json";
export const DECISION_MAP = "docs/architecture/README.md";
export const DECISION_ARCHIVE = "docs/architecture/decisions-archive.md";
export const DECISION_REUSED = "decision number listed twice across the decision maps";
export const LAYERS = ["as-built", "intended", "retiring"] as const;
export type Layer = typeof LAYERS[number];
export const KINDS = ["adds", "realizes", "builds", "retires", "removes", "withdraws", "changes"] as const;
export type Kind = typeof KINDS[number];
export const LAYER_STYLES: Record<string, Record<string, string>> = {
  "as-built": {}, intended: { opacity: "45", fontStyle: "2" },
  retiring: { opacity: "45", fillColor: "#f5f5f5", strokeColor: "#666666" },
};
export const ENDPOINT_LAYERS: Record<string, readonly string[]> = {
  "as-built": ["as-built"], intended: ["as-built", "intended"], retiring: ["as-built", "retiring"],
};
export const PALETTE = {
  external: ["#d5e8d4", "#82b366"], service: ["#dae8fc", "#6c8ebf"], agent: ["#e1d5e7", "#9673a6"],
  store: ["#ffe6cc", "#d79b00"], messaging: ["#fff2cc", "#d6b656"], legend: ["#f5f5f5", "#666666"],
};
export const ROUTING_KEYS = ["exitX", "exitY", "exitDx", "exitDy", "exitPerimeter", "entryX", "entryY", "entryDx", "entryDy", "entryPerimeter"];
export const PAGE_WIDTH_LIMIT = 1600;
export const MAX_EXPANDED_PAGE_BYTES = 16 * 1024 * 1024;
const XML_NAME_START = "[:A-Z_a-z\\u00C0-\\u00D6\\u00D8-\\u00F6\\u00F8-\\u02FF\\u0370-\\u037D\\u037F-\\u1FFF\\u200C-\\u200D\\u2070-\\u218F\\u2C00-\\u2FEF\\u3001-\\uD7FF\\uF900-\\uFDCF\\uFDF0-\\uFFFD\\u{10000}-\\u{EFFFF}]";
const XML_NAME = `${XML_NAME_START}(?:${XML_NAME_START}|[-.0-9\\u00B7\\u0300-\\u036F\\u203F-\\u2040])*`;
export const XML_OPEN_TAG = new RegExp(`^<(${XML_NAME})`, "u");
export const XML_CLOSE_TAG = new RegExp(`^</(${XML_NAME})\\s*>`, "u");
export const XML_ATTRIBUTE = new RegExp(`^\\s+(${XML_NAME})\\s*=\\s*(?:"([^"<]*)"|'([^'<]*)')`, "u");
export const FONT_SIZE_FLOOR = 11;
export const ID_PATTERN = /^[a-z0-9][a-z0-9._-]*$/;
export const INTENT_PATTERNS = { none: /^plan:\d{4}$/, local: /^tracker:\/\/[^\s,()]+$/, mcp: /^tracker:\/\/[^\s,()]+$/ };
export const CHECK_REASONS = ["", "expected one well-formed uncompressed drawio page", "missing or invalid layers or parent chain",
  "invalid element metadata or id", "source path does not exist", "decision absent from decision map", "invalid intent",
  "style contradicts layer", "invalid edge endpoints or cross-layer edge", "overlapping element vertices",
  "vertex outside page or pageWidth over limit", "fontSize below minimum", "system diagram missing inventory components",
  "legend and architecture are connected or nested"];
export const MALFORMED_OBJECT = "object must wrap exactly one mxCell";
export const FRONTMATTER_INLINE_ITEM = /^\s*(?:('(?:[^']|'')*')|("(?:[^"\\]|\\.)*")|([^'"\s,][^,]*))?\s*(?:,|$)/;
export const INVALID_FRONTMATTER_ITEM = "invalid quoted frontmatter sequence item";
export const ARCHITECTURE_HEADING = "## Architecture delta";
export const MALFORMED = "missing or malformed Architecture delta section";
export const UNSUPPORTED = "unsupported transition";
export const UNDECLARED = "observed but not declared";
export const UNOBSERVED = "declared but not observed";
export const UNLISTED = "changed diagram not listed under diagrams";
export const BAD_CITATION = "missing or invalid decision citation";
export const BUNDLE_FILES = ["docs/process/diagrams.md", ".omp/rules/diagrams.md", ".omp/skills/diagrams/SKILL.md",
  ".claude/skills/diagrams/SKILL.md", ".omp/agents/diagram-keeper.md", ".claude/agents/diagram-keeper.md",
  "tools/diagram-check.ts", "tools/diagram-delta.ts", "tools/constants/diagrams.ts"];
export function safeRoot(value: unknown): value is string {
  return typeof value === "string" && !!value && !/[\\\s\0{}]/.test(value) && !value.startsWith("/")
    && value.split("/").every(part => !!part && part !== "." && part !== "..");
}
export function diagramPathKey(value: string): string {
  // Upper/lower also folds expanding and positional case aliases; reject ambiguity conservatively.
  return value.normalize("NFC").toUpperCase().toLowerCase().normalize("NFC");
}
export function safeDiagramsRoot(value: unknown): value is string {
  if (!safeRoot(value)) return false;
  const key = diagramPathKey(value);
  return !["docs", "docs/architecture", "docs/plans", "docs/process"].includes(key)
    && !key.split("/").includes(".git")
    && ![".omp", ".claude", "tools", "docs/tracker", "docs/standards"].some(directory => key === directory || key.startsWith(directory + "/"));
}
