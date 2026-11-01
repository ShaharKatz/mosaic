# Architecture diagrams

Scope: topology under `{{DIAGRAMS_ROOT}}/`. Review text projections and deltas, not pixels or layout. Commands run from the installed repository root. `tools/diagram-check.ts`, `tools/diagram-delta.ts`, and `tools/constants/diagrams.ts` enforce this contract.

## Files and views

Every diagram is a Mermaid source file `**/*.mmd` under this home. Use `system.mmd` for one element per configured component and cross-component edges; use `<component-slug>.mmd` for detail. Draw named runtime integrations with other components, cloud services or external APIs reached through contracts/credentials; omit passive asset downloads, tests and unused factories. Components are manifest member paths (multi-repo) or component paths (monorepo), recorded in `.omp/mosaic.json`'s `diagrams.components`; `platform` and `external` are additional valid bindings.

Hand-authored files use a line-oriented flowchart subset. Leading spaces, blank lines and `%%` comment lines are ignored; every other line is exactly one statement, in this section order:

1. Header: `flowchart LR` or `flowchart TB`.
2. Nodes and groups: node definitions `<id>@{ shape: …, label: "…", … }` (shape `rounded`, `rect` or `cyl`; each id defined once); groups `subgraph <id>["<label>"]` … `end`, which may nest, with the group's data line `<id>@{ … }` (no shape or label) on the line right after its `end`.
3. Edges, top level only: `<from> <id>@--> <to>` or `<from> <id>@-->|"<label>"| <to>`, each followed on the next statement line by its data line `<id>@{ … }`. The arrow is always `-->`; edge kind comes from classes. Endpoints are defined node ids, never groups.
4. Classes: `class <id>[,<id>…] <class>`, repeated as needed.
5. The canonical `classDef` block (below), exactly, nothing after it.

Layers are classes: no layer class means **as-built**, `intended` and `retiring` mark the other layers, at most one per element. **As-built view** is as-built + retiring; **intended view** is as-built + intended.

## Elements and provenance

Every node, edge and group is an element with a stable logical id matching `^[a-z0-9][a-z0-9._-]*$`, unique across the file's nodes, edges and groups, that Mermaid reads as one id: not a Mermaid keyword (`end`, `graph`, `flowchart`, `subgraph`, `class`, `classdef`, `style`, `linkstyle`, `click`, `direction`, `default`, `call`, `href`, `interpolate`), not one of `end`, `graph`, `flowchart`, `subgraph`, `class`, `style`, `default`, `interpolate` before its first `-` or `.` (`end-user` reads as `end`), not starting `swimlane-beta`, and without `--`, `-.` or `.-` (they start links). References are `<file>#<id>`, with file relative to this diagrams home.

Data blocks hold `<key>: <value>` pairs separated by `, `. Keys match `^[a-z][a-zA-Z0-9_]*$` and appear once. `shape` is bare; every other value is double-quoted, with `#quot;` for a quote and `<br/>` for a line break in labels; a raw `"` or `\` is invalid. Mermaid also decodes numeric entity codes (`#32;` space, `#37;` percent), so a literal `#35;`-style sequence is written with `#35;` for its `#`. Mermaid swallows any line containing `direction` followed by `TB`, `BT`, `RL`, `LR` or `TD` as a direction statement, so such text is invalid on every line; reword it or write the space as `#32;`. An edge label, when present, is non-empty. Nodes carry `shape`, `label` and metadata; edges and groups carry metadata only (their labels live in the edge or `subgraph` line). Reserved Mermaid keys (`icon`, `form`, `pos`, `img`, `w`, `h`, `constraint`, `animate`, `animation`, `curve`, `labelLocation`) are rejected; other unknown keys are kept as semantic metadata.

| Metadata | Requirement |
|---|---|
| `label` | Non-empty on every node and group, including legends. Edge labels are optional. |
| `component` | An installed component binding, `platform`, or `external`; required except legends. |
| `source` | Required on as-built and retiring. Comma-separated existing repo-relative paths, optional trailing `:L<n>` per token. Absolute paths, `..` and symlink escapes fail. Cite the proving operation, not a comment, import or signature; validation proves containment/existence only, so reviewers must open the source. |
| `decision` | Required on intended/retiring, optional on as-built. Whenever present, a global `D<n>` row in `docs/architecture/README.md`'s decision map or, where a project keeps one, the frozen `docs/architecture/decisions-archive.md`; a number listed in both fails. |
| `intent` | Required on intended/retiring, optional on as-built. With tracking `none`, `plan:NNNN` names an approved plan; otherwise `tracker://<key>` names intent resolved per the tracker rule. Existence/status/approval is audited by humans, not queried by CI. |
| `kind: "legend"` | Presentation only; exempt from component/provenance, transitions and the decision predicate, but projected and counted. |

**Tables:** a node with `table: "true"` has rows = its label's lines after the first; its projected label is the first line only. Any other multi-line label projects with lines joined by one space. **Legends:** legend edges connect legends only; architecture elements cannot sit inside a legend group, and no edge joins a legend and a non-legend element.

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
  (canonical classDef block)
```

An as-built edge has two as-built endpoints; intended endpoints are as-built or intended; retiring endpoints are as-built or retiring. An edge must be visible with both endpoints in every view where it appears. Move/redeclare edges when moving vertices.

## Classes

Each element has at most one class of each kind. Layer: `intended`, `retiring` (nodes, edges, groups). Category: `service`, `agent`, `store`, `messaging`, `external`, `legend` (nodes and groups only). Edge kind: `async` (dashed) or `observe` (dotted) on edges only; none means sync/owned. Unknown class names or class statements naming undefined ids fail. Every flowchart ends with exactly this block (categories, then edge kinds, then layers, so layer styles override category colours):

```text
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

Layout is Mermaid's: there are no coordinates, page sizes or font rules to check. Keep node order readable; group related elements with subgraphs.

## Projection, delta and comparison

`bun tools/diagram-delta.ts project <file>` emits definition-order lines:

```text
<layer> | <id> | <label> | <component> | source=… | decision=… | intent=…
  row | <row text>
edge | <layer> | <id> | <from> → <to> | <label>
```

Only present provenance keys appear; legends include `kind=legend`. `delta <base> <head> [paths]` reads git revisions; `delta <base> --worktree [paths]` includes untracked files without changing HEAD or the index.

| Before → after | Kind |
|---|---|
| absent → intended | `adds` |
| intended → as-built | `realizes` |
| absent → as-built | `builds` |
| as-built → retiring | `retires` |
| retiring → absent, or as-built → absent | `removes` |
| intended → absent | `withdraws` |
| surviving element, semantic edit | `changes` |

Reject as-built → intended, retiring → intended and intended → retiring. Creation/deletion reports only its transition. Surviving elements can report both a transition and `changes`. Mechanical transition edits are layer class changes, newly added `source` on realizes, and added/replaced decision/intent on retires. Labels, shapes, components, endpoints, group membership, rows, other metadata and non-layer classes are semantic. Statement order, indentation and comments are layout only. Legends appear separately, outside compare; retagging architecture to/from legend is a real removal/addition under snapshot-local classification.

### Decision predicate

New decisions and intent are required on the element for `adds`, `builds`, `retires`; in the declaration for as-built → absent, intended → absent, and any semantic edit whose **before** layer is intended (including realizes plus changes). Pure realizes, retiring removal, or changes tracking code on as-built/retiring require no new decision. Record global decisions and intent before drawing; drafts use `D-NNNN-n` until the records task assigns the global number.

`bun tools/diagram-delta.ts compare <plan> <base> (<head> | --worktree)` strictly parses one Architecture delta section with all seven kinds and `diagrams:`. Entries are `<file>#<id>`, optionally `(D<n>, plan:NNNN)` or `(D<n>, tracker://<key>)`; use `none` for empty lines. Diagrams lists relative files or trailing-slash directory prefixes. Reject observed-but-undeclared, declared-but-unobserved, missing/invalid required citations, unlisted changed files, illegal transitions and malformed sections. Core has **no generated-folder exemption**, including folders named `erd/`.

`delta <base> <head> --candidates --plan <plan>` writes only docimpact-shaped JSON to stdout (`candidates: [{doc,class:"diagram",why}], cannotEvaluate: []`); the delta goes to stderr. Candidates include semantic/legend changes and unchanged diagrams with components matching plan areas.
Plan `areas:` accepts single-line inline sequences and block list items. Quote inline paths containing commas; commas inside complete quoted items are not separators. Doubled single quotes and backslash-escaped double quotes/backslashes are decoded; other backslash sequences remain literal. Malformed quoted items fail rather than silently dropping diagram candidates; multiline flow sequences are unsupported.

## Validation and editing

`bun tools/diagram-check.ts [files]` defaults to every `.mmd` under this home. Exit 0 prints file/element counts; exit 1 names failures: (1) grammar, section order and containment; (2) classes; (3) ids/metadata/components; (4) source containment/existence; (5) mapped decisions; (6) intent syntax for tracking mode; (7) classDef block; (8) endpoints/visibility; (9) when `system.mmd` exists, non-legend as-built/retiring coverage for every configured component; (10) legend isolation.

Editors: agents edit the text directly (diagrams skill, diagram-keeper). Humans can use Orca's `.mmd` viewer and its Source view, or the Mermaid Live Editor. The Mermaid Chart Visual Editor may rewrite formatting; rerun `bun tools/diagram-check.ts` after it. Validation, projections and comparisons work offline. The contract is a project-owned starter; installed tool/rule/skill baselines stay kit-owned. Core does not ship a schema generator.

## Review comment

`bun tools/diagram-review.ts <base> (<head> | --worktree)` prints one Markdown review of the diagram changes between two revisions: the changes in words, then per changed file a collapsed Before and an open After Mermaid drawing with changed elements outlined (green new, purple planned, amber changed, red retiring or removed; ERD rows gain `🟢 new`/`🔴 removed` markers). It starts with the `<!-- mosaic:diagram-review -->` marker and lists delta problems, such as unsupported transitions, under `Problems:`; `diagram-delta compare` stays the gate.
{{LANDING_PULL_REQUEST}}

`rule://git-flow` posts it on the pull request and updates the marked comment after each push. Optional CI posts the same comment from GitHub Actions with the job's default `GITHUB_TOKEN` (nothing is uploaded); fork pull requests get a read-only token, so the step cannot post there. Manual and CI posting update the same marked comment.

```yaml
name: diagram review
on:
  pull_request:
    paths: ["{{DIAGRAMS_ROOT}}/**"]
permissions:
  contents: read
  pull-requests: write
jobs:
  comment:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - uses: oven-sh/setup-bun@v2
      - run: bun tools/diagram-review.ts "origin/$GITHUB_BASE_REF" HEAD > diagram-review.md
      - uses: actions/github-script@v7
        with:
          script: |
            const body = require("fs").readFileSync("diagram-review.md", "utf8");
            const marker = "<!-- mosaic:diagram-review -->";
            const { owner, repo, number: issue_number } = context.issue;
            const comments = await github.paginate(github.rest.issues.listComments, { owner, repo, issue_number });
            const existing = comments.find(comment => comment.body?.startsWith(marker));
            if (existing) await github.rest.issues.updateComment({ owner, repo, comment_id: existing.id, body });
            else await github.rest.issues.createComment({ owner, repo, issue_number, body });
```
{{/LANDING_PULL_REQUEST}}
{{TRACKING_MCP}}

With MCP tracking, the same Markdown may also be posted on the linked tracker item when the tracker renders Mermaid code blocks (Linear does). Before relying on the review colours there, confirm its Mermaid version parses edge ids (`a e1@--> b`) and their classes; older versions reject them.
{{/TRACKING_MCP}}
{{DIAGRAMS_ERD}}

## Enabled Prisma adapter

This installation additionally selects `diagrams.erd`. Its output is generated-only `<output>/<stem>.erd.mmd` `erDiagram` files, never keeper-edited: line 1 is the `%% generated: mosaic-prisma-erd from <schema>; <label>; do not edit` marker, and each entity and relationship is preceded by a `%% @<id> component: "…", source: "…"` metadata line. Attribute types and names Mermaid would misread (`PK`/`FK`/`UK` in any case, spaces, a leading digit) are backtick-quoted; entity and relationship labels write `"`, `%`, `\` and the space in `direction <dir>` as entity codes. See the generated-ERD section of `docs/process/diagrams.md` for generation, read-only sync checks, file selection and verification-command integration. The optional adapter adds a conditional exception to core comparison: only its marked generated files, inside its safe configured output and matching a passing full sync check for the compared snapshot, are exempt from declarations. Other folders, disabled adapters and stale output retain the core contract.
Implicit many-to-many lists pair by relation name or a single unnamed back-reference; ambiguous pairings fail with schema path and line. Cross-file targets retain source references. Relationships preserve one-to-one uniqueness, many-to-many cardinality, and explicit `onDelete`/`onUpdate` actions. Required relation fields use `}o--||` (many-to-one) or `|o--||` (one-to-one); optional relation fields (`?`) use `}o--o|` or `|o--o|` respectively, with zero-or-one at the referenced end. Implicit many-to-many uses `}o--o{`. Schema globs exclude dependency directories named `node_modules`; mapped names require positional string arguments.
{{/DIAGRAMS_ERD}}
