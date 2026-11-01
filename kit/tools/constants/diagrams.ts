// Shared Mermaid diagram vocabulary and install contract; no runtime or package dependencies.
export const DIAGRAMS_ROOT = "docs/architecture/diagrams";
export const MODE = "mermaid";
export const EXTENSION = ".mmd";
export const SYSTEM_FILE = "system.mmd";
export const REPLACED_MODE = "drawio";
export const REPLACED_MODE_MESSAGE = 'diagrams.mode "drawio" was replaced by "mermaid"; upgrade with /mosaic-kit (mosaic checkout: install/drawio-to-mermaid.md)';
export const CONFIG_PATH = ".omp/mosaic.json";
export const DECISION_MAP = "docs/architecture/README.md";
export const DECISION_ARCHIVE = "docs/architecture/decisions-archive.md";
export const DECISION_REUSED = "decision number listed twice across the decision maps";
export const LAYERS = ["as-built", "intended", "retiring"] as const;
export type Layer = typeof LAYERS[number];
export const KINDS = ["adds", "realizes", "builds", "retires", "removes", "withdraws", "changes"] as const;
export type Kind = typeof KINDS[number];
export const ENDPOINT_LAYERS: Record<string, readonly string[]> = {
  "as-built": ["as-built"], intended: ["as-built", "intended"], retiring: ["as-built", "retiring"],
};
export const DIRECTIONS = ["LR", "TB"] as const;
export const SHAPES = ["rounded", "rect", "cyl"] as const;
export const LAYER_CLASSES = ["intended", "retiring"] as const;
export const CATEGORY_CLASSES = ["service", "agent", "store", "messaging", "external", "legend"] as const;
export const EDGE_KIND_CLASSES = ["async", "observe"] as const;
export const METADATA_KEYS = ["component", "source", "decision", "intent", "kind", "table"] as const;
export const MERMAID_RESERVED_KEYS = ["shape", "label", "icon", "form", "pos", "img", "w", "h", "constraint", "animate", "animation", "curve", "labelLocation"] as const;
export const MERMAID_KEYWORDS = ["end", "graph", "flowchart", "subgraph", "class", "classdef", "style", "linkstyle", "click", "direction", "default", "call", "href", "interpolate"] as const;
// Mermaid's lexer still reads these when an id continues with `-` or `.` (`end-user` lexes as `end`).
export const MERMAID_KEYWORD_PREFIXES = ["end", "graph", "flowchart", "subgraph", "class", "style", "default", "interpolate"] as const;
// Mermaid swallows a whole line containing this text as a direction statement: flowcharts match case-sensitively,
// erDiagram case-insensitively and without TD.
export const FLOWCHART_DIRECTION_TEXT = /direction\s+(?:TB|BT|RL|LR|TD)/;
export const ER_DIRECTION_TEXT = /direction\s+(?:TB|BT|RL|LR)/i;
// erDiagram attribute types and names: Mermaid's attribute word, never a PK/FK/UK key word; anything else needs backticks.
export const ER_ATTRIBUTE_WORD = /^[*A-Za-z_\u00C0-\uFFFF][A-Za-z0-9\-_[\]().,\u00C0-\uFFFF*]*$/;
export const ER_KEY_WORD = /\b(?:PK|FK|UK)\b/i;
// Categories first, then edge kinds, then layers, so layer styles override category colours.
export const CLASS_DEFS = [
  "classDef service fill:#dae8fc,stroke:#6c8ebf,color:#1f2328",
  "classDef agent fill:#e1d5e7,stroke:#9673a6,color:#1f2328",
  "classDef store fill:#ffe6cc,stroke:#d79b00,color:#1f2328",
  "classDef messaging fill:#fff2cc,stroke:#d6b656,color:#1f2328",
  "classDef external fill:#d5e8d4,stroke:#82b366,color:#1f2328",
  "classDef legend fill:#f5f5f5,stroke:#666666,color:#1f2328",
  "classDef async stroke-dasharray:6 4",
  "classDef observe stroke-dasharray:2 3",
  "classDef intended opacity:0.5,font-style:italic",
  "classDef retiring opacity:0.5,stroke:#666666,color:#666666",
] as const;
export const ID_PATTERN = /^[a-z0-9][a-z0-9._-]*$/;
/** Whether Mermaid reads `id` as one node, edge or group id: no keyword prefix, no `--`, `-.` or `.-` (link starts). */
export function mermaidId(id: string): boolean {
  return ID_PATTERN.test(id) && !(MERMAID_KEYWORDS as readonly string[]).includes(id)
    && !(MERMAID_KEYWORD_PREFIXES as readonly string[]).includes(id.split(/[.-]/)[0]!)
    && !/^swimlane-beta(?:$|[.-])/.test(id) && !/--|-\.|\.-/.test(id);
}
export const INTENT_PATTERNS = { none: /^plan:\d{4}$/, local: /^tracker:\/\/[^\s,()]+$/, mcp: /^tracker:\/\/[^\s,()]+$/ };
export const CHECK_REASONS = ["", "expected one well-formed diagram in the supported Mermaid subset", "invalid or conflicting classes",
  "invalid element metadata or id", "source path does not exist", "decision absent from decision map", "invalid intent",
  "classDef block differs from the contract", "invalid edge endpoints or cross-layer edge", "system diagram missing inventory components",
  "legend and architecture are connected or nested"];
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
  "tools/diagram-check.ts", "tools/diagram-delta.ts", "tools/diagram-review.ts", "tools/constants/diagrams.ts"];
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
