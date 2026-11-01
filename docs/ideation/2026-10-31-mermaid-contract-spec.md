# Implementation spec: Mermaid diagram bundle (2026-10-31)

Shared contract for the work in [the migration plan](2026-10-31-mermaid-migration-plan.md). Every slice codes against this file; when code and this spec disagree, fix one of them explicitly.

Rendering facts (verified with Mermaid 12.2.0, GitHub's version, and 11.17.2, Orca's):

- `id@{ shape: rounded, label: "…", anykey: "…" }` renders; unknown keys are ignored.
- Edge ids (`a e1@--> b`) take classes, and `e1@{ anykey: "…" }` is accepted.
- `g@{ … }` after a subgraph's `end` adds no node.
- Ids with `-` and `.` work for nodes, edges and ER entities.
- ER entity aliases `model-order["Order (orders)"]`, types `String?`, `String[]`, `Decimal(14,6)`, key lists `FK, UK`, `%%` lines inside entity blocks, and cardinalities `}o--||`, `|o--||`, `}o--o{` all render.
- An ER type containing quotes (`Unsupported("x")`) fails to parse.

## 1. Files and modes

- `.omp/mosaic.json` and manifest: `diagrams: { mode: "none" | "mermaid", root?, erd? }`.
  - `"drawio"` is rejected everywhere with this message: `diagrams.mode "drawio" was replaced by "mermaid"; upgrade with /mosaic-kit (mosaic checkout: install/drawio-to-mermaid.md)`.
- Diagram files: `<root>/**/*.mmd`.
  - `system.mmd` is the system diagram (coverage check).
  - Generated ERDs: `<erd.output>/<stem>.erd.mmd`.
- Installer Markdown blocks: `DIAGRAMS_MERMAID` replaces `DIAGRAMS_DRAWIO` with the same own-line/inline semantics. `DRAWIO_PACKAGE` no longer exists. `DIAGRAMS_ROOT` and `DIAGRAMS_ERD` are unchanged.
- No MCP server is involved; nothing reads or requires `.mcp.json`.

## 2. Flowchart subset (hand-authored diagrams)

Line-oriented. Leading spaces are ignored. Blank lines and `%%` comment lines are ignored anywhere. Every other line must be exactly one of these statements, in this section order:

1. **Header (first statement):** `flowchart LR` or `flowchart TB`.
2. **Nodes and groups:**
   - Node definition: `<id>@{ <pairs> }`. Required pairs: `shape`, `label`. Each id is defined once.
   - Group open: `subgraph <id>["<label>"]`. Groups may nest; each open needs an `end` line.
   - Group metadata: `<id>@{ <pairs> }` on the line right after that group's `end` (the group's own data; no `shape`, no `label`).
3. **Edges:** `<from> <id>@--> <to>` or `<from> <id>@-->|"<label>"| <to>`.
   - The arrow is always `-->`; the kind comes from classes.
   - The edge's data line `<id>@{ <pairs> }` must follow on the next statement line.
   - Edges are top level only, never inside a subgraph.
4. **Classes:** `class <id>[,<id>…] <class>`, repeated as needed.
5. **The canonical `classDef` block:** exactly the lines of `CLASS_DEFS` (section 5), in that order, nothing else.

**Pairs** (`<pairs>`) are `<key>: <value>` separated by `, `.

- Keys match `^[a-z][a-zA-Z0-9_]*$`; a key appears at most once.
- `shape` takes a bare value from `SHAPES` (`rounded`, `rect`, `cyl`).
- Every other value is a double-quoted string. Inside quoted strings, a raw `"` or `\` is invalid; `#quot;` encodes `"`. In labels, `<br/>` encodes a line break.
  - Parsing decodes `<br/>` (also `<br>`) to `\n`, then `#quot;` and numeric `#<code>;` entities in one pass (Mermaid renders them); writing encodes `"`, line breaks, and a literal `#` that would read as an entity (`#35;`).
- Mermaid's lexer swallows a whole line containing `direction` + whitespace + `TB|BT|RL|LR|TD` as a direction statement (a node line loses its label and data, an edge vanishes, a group title fails to parse), so check 1 rejects such lines; `#32;` keeps the text. An edge label `|""|` fails to parse in Mermaid, so present edge labels are non-empty.
- Allowed keys:
  - Nodes: `shape`, `label`, plus metadata keys.
  - Edges and groups: metadata keys only (the edge label lives in the edge line).
  - Metadata keys: `component`, `source`, `decision`, `intent`, `kind` (only value `legend`), `table` (nodes only, only value `true`), and any other key not in `MERMAID_RESERVED_KEYS`. Other keys are kept as semantic metadata, as unknown XML attributes were.
  - `MERMAID_RESERVED_KEYS`: `shape`, `label`, `icon`, `form`, `pos`, `img`, `w`, `h`, `constraint`, `animate`, `animation`, `curve`, `labelLocation`. They are rejected where not allowed above.

**Ids** match `ID_PATTERN` (`^[a-z0-9][a-z0-9._-]*$`) and Mermaid must read them as one id (`mermaidId()`): not in `MERMAID_KEYWORDS` (`end`, `graph`, `flowchart`, `subgraph`, `class`, `classdef`, `style`, `linkstyle`, `click`, `direction`, `default`, `call`, `href`, `interpolate`); no `MERMAID_KEYWORD_PREFIXES` entry (`end`, `graph`, `flowchart`, `subgraph`, `class`, `style`, `default`, `interpolate`) before the first `-` or `.` (`end-user` lexes as `end`); not starting `swimlane-beta`; no `--`, `-.` or `.-`. Probed against Mermaid 12.2.0 and 11.17.2. Ids are unique across nodes, edges and groups.

**Group membership:**
- A node definition between `subgraph g…` and its `end` belongs to `g`. Nested groups belong to their enclosing group.
- Edge endpoints must be defined node ids (not groups), in any section order.

**Labels:** the node `label` value, the edge `|"…"|` text (empty when absent), the group `["…"]` text.

**Tables:** a node with `table: "true"` has rows = its label's lines after the first. Its projection label is the first line only. Any other multi-line label projects with lines joined by a single space, as draw.io did.

**Classes:**

| Kind | Classes | Applies to |
|---|---|---|
| Layer | `intended`, `retiring` (none = as-built) | Nodes, edges, groups; at most one per element |
| Category | `service`, `agent`, `store`, `messaging`, `external`, `legend` | Nodes and groups; at most one per element |
| Edge kind | `async` (dashed), `observe` (dotted); none = sync | Edges; at most one |

- A class name outside these lists, or a class statement naming an undefined id, fails check 2.
- Element classes are recorded in statement order without duplicates.

Example (canonical layout; the `classDef` lines come from `CLASS_DEFS`):

```text
flowchart LR
  api@{ shape: rounded, label: "Orders API", component: "apps/api", source: "apps/api/src/server.ts" }
  db@{ shape: cyl, label: "Postgres", component: "platform", source: "apps/api/prisma/schema.prisma" }
  search@{ shape: rounded, label: "Search service", component: "apps/api", decision: "D1", intent: "plan:0001" }
  api api-db@-->|"Prisma"| db
  api-db@{ component: "apps/api", source: "apps/api/src/db.ts" }
  api api-search@-->|"index orders"| search
  api-search@{ component: "apps/api", decision: "D1", intent: "plan:0001" }
  class search,api-search intended
  class api,search service
  class db store
  (CLASS_DEFS lines)
```

## 3. ER subset (generated ERDs only)

Generated by `tools/erd-generate.ts`; never hand-edited.

1. **Line 1, the marker:** `%% generated: mosaic-prisma-erd from <schema repo path>; <erd.label>; do not edit`. `GENERATED` stays `mosaic-prisma-erd`.
2. **Header:** line 2 is `erDiagram`.
3. **Element metadata:** `%% @<id> <pairs>` on the line before each entity and each relationship. Pairs use the section 2 grammar; keys are `component` and `source`. The ER grammar has no `@{ }` blocks, so this comment form is the only exception to D4's data blocks, and only for generated files.
4. **Entity:** `<id>["<label>"] {` … `}`, one per model, enum and cross-file reference.
   - Each row inside the block is either an attribute line `<type> <name>[ <keys>][ "<comment>"]` or a model-attribute line `%% @@…`. Both are rows, in order.
   - A reference entity (a model from another schema file) has an empty block, `<id>["<label>"] {` then `}`.
5. **Relationship:** `<from> <card> <to> : "<label>"`, with card `}o--||` (many-to-one), `|o--||` (one-to-one) or `}o--o{` (implicit many-to-many).

ER row and label rules (generator; the parser stores rows verbatim):

- **Ids and labels:** as today (`logicalIds`; `model-<name>`, `enum-<name>`, `edge-<model>-<field>`). There is no `schema` lane element any more.
  - Model labels: `<mapped> (<Name>)`.
  - Reference labels: `<Name> (<file>.prisma)`.
  - Enum labels: `<mapped> (<Name>)`.
  - Relationship labels: as today (`fields → refs onDelete: … onUpdate: … map: …`; `m:n` / `m:n "<name>"`).
  - Entity and relationship labels write `"` as `#quot;`, `%` as `#37;`, `\` as `#92;` and the whitespace in `direction <dir>` (case-insensitive) as `#32;`; Mermaid cannot read a raw `%` in an entity label, and swallows a relationship line containing direction text.
- **Attribute line:** `<type>` is the Prisma type with any quoted part removed (`Unsupported("vector(3)")?` becomes `Unsupported?`). `<name>` is the mapped column name. A type or name that is not a Mermaid attribute word (`^[*A-Za-z_\u00C0-\uFFFF][A-Za-z0-9\-_[\]().,\u00C0-\uFFFF*]*$`) or contains a `PK`/`FK`/`UK` word (case-insensitive) is backtick-quoted (`` enum `UK` ``, `` String `first name` ``); Mermaid renders it without the backticks.
- **Keys:** `PK` (`@id` or in `@@id`), `FK` (relation scalar), `UK` (`@unique` or in `@@unique`), comma-separated in that order.
- **Comment:** the remaining markers and attributes joined by single spaces, in this order:
  - `IDX` when the column is in an `@@index`;
  - the original type when quotes were stripped;
  - field attributes other than `@id`, `@unique`, `@map`, `@relation`, as their source text (`@default(cuid())`, `@db.Decimal(14, 6)`, `@updatedAt`).

  Inside the comment, `"` becomes `'`. The comment is omitted when empty.
- **Enum rows:** `enum <MAPPED_VALUE>`, then `%% @@map(…)` rows for enum attributes.
- **Model `@@` attributes:** `%% <source text>` rows, after the columns.
- **Ordering:** deterministic as today (entries sorted with `order`). Output ends with one `\n`.

## 4. Parsed model (exported from `kit/tools/diagram-check.ts`)

```ts
export type Layer = "as-built" | "intended" | "retiring";
export type Element = {
  id: string;
  type: "node" | "edge" | "group" | "entity" | "relation";
  label: string;                   // decoded; "\n" for line breaks; tables/entities: title only
  shape?: string;                  // nodes
  from?: string; to?: string;      // edges and relations
  parent?: string;                 // enclosing group id (flowchart)
  classes: string[];               // statement order, no duplicates (flowchart only; ER elements: [])
  data: Record<string, string>;    // metadata pairs, decoded (excludes shape and label)
  rows: string[];                  // table-node label lines after the first; ER entity rows verbatim
  line: number;                    // 1-based line of the defining statement
  rowLines: number[];              // ER: 1-based line of each row; tables: the node's line repeated
};
export class Diagram {
  constructor(text: string);       // throws Error whose message starts with CHECK_REASONS[1]
  readonly text: string;           // the exact source text
  readonly kind: "flowchart" | "erDiagram";
  readonly direction?: "LR" | "TB";
  readonly generator?: string;     // ER marker's generator token, e.g. "mosaic-prisma-erd"
  readonly elements: Element[];    // definition order; groups at their subgraph line
  readonly byId: Map<string, Element>;
  layer(e: Element): Layer;        // from classes; ER elements are "as-built"
  ancestors(e: Element): Element[]; // enclosing groups, innermost first
  legend(e: Element): boolean;     // e.data.kind === "legend"
}
export function serializeData(pairs: Record<string, string>, shape?: string, label?: string): string; // "shape: …, label: "…", k: "v"" in that order then keys in insertion order
```

The `vertex`/`edge` distinction used by checks and delta: `edge` and `relation` are edges; `node`, `group` and `entity` are vertices.

## 5. Constants (`kit/tools/constants/diagrams.ts`)

- **Keep:** `DIAGRAMS_ROOT`, `CONFIG_PATH`, `DECISION_MAP`, `DECISION_ARCHIVE`, `DECISION_REUSED`, `LAYERS`, `Layer`, `KINDS`, `Kind`, `ENDPOINT_LAYERS`, `ID_PATTERN`, `INTENT_PATTERNS`, `FRONTMATTER_INLINE_ITEM`, `INVALID_FRONTMATTER_ITEM`, `ARCHITECTURE_HEADING`, `MALFORMED`, `UNSUPPORTED`, `UNDECLARED`, `UNOBSERVED`, `UNLISTED`, `BAD_CITATION`, `safeRoot`, `diagramPathKey`, `safeDiagramsRoot`.
- **Remove:** `DRAWIO_PACKAGE`, `DRAWIO_MOUNT`, `LAYER_STYLES`, `PALETTE`, `ROUTING_KEYS`, `PAGE_WIDTH_LIMIT`, `MAX_EXPANDED_PAGE_BYTES`, `XML_*`, `FONT_SIZE_FLOOR`, `MALFORMED_OBJECT`.
- **Add:**
  - `MODE = "mermaid"`, `EXTENSION = ".mmd"`, `SYSTEM_FILE = "system.mmd"`.
  - `REPLACED_MODE = "drawio"` and `REPLACED_MODE_MESSAGE` (the section 1 text).
  - `DIRECTIONS = ["LR", "TB"]`, `SHAPES = ["rounded", "rect", "cyl"]`.
  - `LAYER_CLASSES = ["intended", "retiring"]`, `CATEGORY_CLASSES = ["service", "agent", "store", "messaging", "external", "legend"]`, `EDGE_KIND_CLASSES = ["async", "observe"]`.
  - `METADATA_KEYS = ["component", "source", "decision", "intent", "kind", "table"]`, `MERMAID_RESERVED_KEYS`, `MERMAID_KEYWORDS`.
  - `CLASS_DEFS`. Categories come first, then edge kinds, then layers, so layer styles override category colours as before:
    ```
    classDef service fill:#dae8fc,stroke:#6c8ebf,color:#1f2328
    classDef agent fill:#e1d5e7,stroke:#9673a6,color:#1f2328
    classDef store fill:#ffe6cc,stroke:#d79b00,color:#1f2328
    classDef messaging fill:#fff2cc,stroke:#d6b656,color:#1f2328
    classDef external fill:#d5e8d4,stroke:#82b366,color:#1f2328
    classDef legend fill:#f5f5f5,stroke:#666666,color:#1f2328
    classDef async stroke-dasharray:6 4
    classDef observe stroke-dasharray:2 3
    classDef intended opacity:0.5,font-style:italic
    classDef retiring opacity:0.5,stroke:#666666,color:#666666
    ```
  - (The old fill/stroke pairs mapped to these classes live in the converter, not in the installed constants.)
- **`CHECK_REASONS`** (index = check number):
  1. `expected one well-formed diagram in the supported Mermaid subset`
  2. `invalid or conflicting classes`
  3. `invalid element metadata or id`
  4. `source path does not exist`
  5. `decision absent from decision map`
  6. `invalid intent`
  7. `classDef block differs from the contract`
  8. `invalid edge endpoints or cross-layer edge`
  9. `system diagram missing inventory components`
  10. `legend and architecture are connected or nested`
- **`BUNDLE_FILES`:** today's list with `tools/diagram-review.ts` added.

## 6. Checks (`tools/diagram-check.ts [files]`)

Same CLI shape as today: no args checks every `**/*.mmd` under the root; exit 0 prints `diagram-check: N files, M elements checked`; exit 1 prints `<file>: check <n>: <reason>[: <id>]` sorted by check number. `--normalize` is removed; any `--` option is an error.

1. Grammar and section order (sections 2 and 3). The file must be under the root (containment, as today).
2. Classes: unknown names, undefined ids, more than one layer, category or edge-kind class on an element, a category on an edge, an edge kind on a vertex.
3. Ids and metadata: id pattern, keywords, duplicates, reserved keys, `kind`/`table` values.
   - Required keys: `label` (non-empty) on nodes, groups, entities; `component` for non-legend elements; `source` on as-built and retiring; `decision` and `intent` on intended and retiring.
   - `component` must be in the configured bindings, `platform` or `external`.
   - Legends need only a label.
   - Edges and relations need no label.
4. `source`: every comma-separated token (optional `:L<n>`) exists inside the repository, as today.
5. `decision`: in the decision map, as today.
6. `intent`: syntax per tracking mode, as today.
7. `classDef` block: flowcharts must end with exactly `CLASS_DEFS`. Not checked for ER files.
8. Edge endpoints: must exist and be vertices; layer visibility per `ENDPOINT_LAYERS`.
9. `system.mmd` covers every configured component with a non-legend as-built or retiring element.
10. Legend isolation: a non-legend element inside a legend group, or an edge between a legend and a non-legend element.

## 7. Projection and delta (`tools/diagram-delta.ts`)

Projection output is unchanged:

```text
<layer> | <id> | <label> | <component>[ | source=…][ | decision=…][ | intent=…][ | kind=…]
  row | <row>
edge | <layer> | <id> | <from> → <to> | <label>
```

- **Lines:**
  - Vertices (`node`, `group`, `entity`) print the first form.
  - Labels have line breaks replaced by a single space.
  - Provenance keys print in that order, when present.
  - Edges and relations print the `edge` form.
  - Rows follow their vertex.
- **Discovery:** `**/*.mmd` in revisions and the worktree.
- **`semantic()`** compares `[data, label, type, shape, from, to, parent, classes minus layer classes, rows]`. On a transition, the layer classes are already excluded. `addedSource` (realizes) ignores a newly added `source`; `retires` ignores decision and intent, as today.
- **ERD exemption in `compare`:** a snapshot counts as generated when `(after ?? before).generator === GENERATED`. The worktree-match test becomes `after.text === readDiagram(path)`.
- `parseDeclaration`, `compare`, `candidates` and the CLI are otherwise unchanged. `candidates` reads `e.data.component`.

## 8. Review comment (`tools/diagram-review.ts`)

**CLI:** `bun tools/diagram-review.ts <base> (<head> | --worktree)`. It prints Markdown to stdout; exit 0 even when nothing changed (it prints `No diagram changes.` under the marker). Errors exit 1, like delta.

**Output:**

1. `<!-- mosaic:diagram-review -->`
2. `### Diagram changes`
3. The legend line `🟢 new · 🟣 planned (intended) · 🟡 changed · 🔴 retiring or removed`.
4. Per changed file, with flowcharts before ERDs:
   - `#### \`<file>\``.
   - The change list, one bullet per change: icon, **kind**, description.
     - Icons:
       - 🟢 `adds`, `builds`, `realizes` (🟣 when the new element is intended)
       - 🟡 `changes`
       - 🔴 `retires`, `removes`, `withdraws`
     - Descriptions:
       - edges: `<from label> → <to label> “<label>”`
       - tables and entities: `table “<label>”`
       - other vertices: `“<label>”`
     - Planned additions append ` (planned: <decision>, <intent>)`.
     - `changes` items list sub-bullets: `<key>: \`old\` → \`new\`` for metadata/label/endpoint differences, and `` `+ <row>` `` / `` `- <row>` `` for row changes.
   - A collapsed `<details><summary>Before</summary>` block with the base version, then an open **After** block with the head version, each a ` ```mermaid ` block.
     - Flowcharts: the file text plus review lines appended after the canonical block:
       ```
       classDef rv-new stroke:#1a7f37,stroke-width:3px
       classDef rv-planned stroke:#8250df,stroke-width:3px
       classDef rv-changed stroke:#bf8700,stroke-width:3px,color:#bf8700
       classDef rv-removed stroke:#cf222e,stroke-width:3px
       class <ids> rv-…
       ```
       Before: removed, retired and withdrawn elements get `rv-removed`; changed ones `rv-changed`. After: new ones `rv-new` (intended ones `rv-planned`), changed ones `rv-changed`, retired ones `rv-removed`.
     - ERDs: the file text plus `style <id> stroke:<colour>,stroke-width:3px` lines for entities with the same colour rules.
       - Added rows get ` 🟢 new` appended to their comment (or a new comment `"🟢 new"`) in After.
       - Removed rows get ` 🔴 removed` in Before.
       - Rows are located through `rowLines`.
     - A file that does not exist on one side shows only the other side.

**Posting** (not done by the tool):
- Create once with `gh pr comment <pr> --body-file <file>`.
- Afterwards, update the comment whose body starts with the marker: find it with `gh api repos/<owner>/<repo>/issues/<pr>/comments --paginate --jq '.[] | select(.body | startswith("<!-- mosaic:diagram-review -->")) | .id'` (all pages: a busy pull request has more than 30 comments), then `gh api -X PATCH repos/<owner>/<repo>/issues/comments/<id> -F body=@<file>`.

## 9. Converter (`install/drawio-to-mermaid.ts`, source-side only)

**CLI**, run from the installed project root:

```sh
bun <mosaic>/install/drawio-to-mermaid.ts --root <diagrams root> [--plans <plans dir>] [--keep]
```

- **Old-format code:** it embeds its own copy of the pre-migration XML reader, `Drawing` and `project()` from the last drawio commit (`e2b4125`). It imports nothing from the installed project.
- **Generated ERDs:** every `**/*.drawio` under the root whose `mxfile` has `generator="mosaic-prisma-erd"` is deleted, to be regenerated afterwards by the new `erd-generate.ts`.
- **Hand-authored files:** each other `.drawio` is converted to the sibling `.mmd`:
  - **Header:** `flowchart LR`.
  - **Containers:** a vertex with child elements becomes a `subgraph <id>["<label>"]` with its data line after `end`.
  - **Order:** vertices in document order, respecting nesting; then edges in document order with their data lines; then class lines grouped by class in `CLASS_DEFS` order; then `CLASS_DEFS`.
  - **Shapes:** `shape=cylinder*` → `cyl`; `rounded=1` → `rounded`; tables → `rect` with `table: "true"` and label `<title><br/><row1><br/>…` (rows in document order); otherwise `rect`.
  - **Layers:** layer parents become layer classes.
  - **Categories:** the `fillColor`/`strokeColor` pair via the converter's own `CATEGORY_BY_PALETTE`, when it matches.
  - **Edge kinds:**
    - `dashed=1` with a `dashPattern` whose first number ≤ 2 → `observe`
    - any other `dashed=1` → `async`
    - otherwise sync (no class)
  - **Metadata:** the `<object>` attributes other than `id` and `label` become data pairs, values encoded per section 2. The label goes to the node's `label` pair, the edge's `|"…"|` or the group's `["…"]`.
  - **Keyword ids:** an id in `MERMAID_KEYWORDS` stops the run with a list (exit 1) before any file is written.
- **Equivalence gate:** for each converted file, the embedded old projection of the `.drawio` and the new kit's `project()` of the `.mmd` (imported from the converter's own checkout, `kit/tools/diagram-delta.ts`) must contain the same multiset of element blocks; a block is an element line plus its row lines. Order may differ because subgraph nesting reorders definitions.
  - On mismatch it prints a unified diff of the sorted blocks per file, writes nothing, and exits 1.
  - On success it writes all `.mmd` files and then deletes the `.drawio` sources (`--keep` retains them).
- **Plan references:** with `--plans <dir>`, it rewrites `.drawio` to `.mmd` inside `diagram:<path>#<id>` and `<path>#<id>` references, in the frontmatter `areas:` lines and `## Architecture delta` sections of plans under `<dir>`, excluding `<dir>/archived/**`.
- **Report:** it prints converted files, deleted generated ERDs and rewritten plans.
